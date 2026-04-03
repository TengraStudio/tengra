import {
    IPC_CONTRACT_MIN_MAIN_VERSION,
    IPC_CONTRACT_VERSION,
    type IpcContractVersionInfo,
    isIpcContractCompatible,
} from '@shared/constants/ipc-contract';
import { IpcContractEntry, IpcContractMap, IpcValue } from '@shared/types/common';
import { z, ZodError, ZodType } from 'zod';

import { translateErrorMessage } from '@/utils/error-handler.util';

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 150;
const DEFAULT_MAX_DELAY_MS = 1500;
const JITTER_FACTOR = 0.2;
const DEFAULT_DEDUP_WINDOW_MS = 100;
const ipcContractInfoSchema = z.object({
    version: z.number().int().nonnegative(),
    minRendererVersion: z.number().int().nonnegative(),
    minMainVersion: z.number().int().nonnegative(),
});
let contractCompatibilityPromise: Promise<void> | null = null;

/** In-flight request cache for request deduplication */
const inflightRequests = new Map<string, Promise<RendererDataValue>>();

export type { IpcContractEntry, IpcContractMap };

export interface IpcInvokeOptions<T> {
    argsSchema?: z.ZodTuple<[z.ZodTypeAny, ...z.ZodTypeAny[]]> | z.ZodTuple<[]>;
    responseSchema: ZodType<T>;
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (error: RendererDataValue) => boolean;
    /** Enable request deduplication for identical concurrent calls */
    deduplicate?: boolean;
    /** Time in ms to keep dedup entry after settlement (default: 100) */
    dedupWindowMs?: number;
}

function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getErrorMessage(error: RendererDataValue): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

function isRetryableError(error: RendererDataValue): boolean {
    if (error instanceof ZodError) {
        return false;
    }

    if (error instanceof Error && error.name === 'AbortError') {
        return false;
    }

    const message = getErrorMessage(error).toLowerCase();
    if (
        message.includes('validation') ||
        message.includes('invalid') ||
        message.includes('not found') ||
        message.includes('unauthorized') ||
        message.includes('forbidden')
    ) {
        return false;
    }

    return (
        message.includes('timeout') ||
        message.includes('timed out') ||
        message.includes('econnreset') ||
        message.includes('econnrefused') ||
        message.includes('network') ||
        message.includes('temporarily unavailable')
    );
}

function ensureElectronApi(): void {
    if (!window.electron?.ipcRenderer?.invoke) {
        throw new Error(translateErrorMessage('IPC bridge is not available'));
    }
}

function formatContractMismatch(info: IpcContractVersionInfo): string {
    return translateErrorMessage(`Incompatible IPC contract: renderer v${IPC_CONTRACT_VERSION} (requires main >= v${IPC_CONTRACT_MIN_MAIN_VERSION}), main v${info.version} (requires renderer >= v${info.minRendererVersion})`);
}

async function ensureIpcContractCompatibility(): Promise<void> {
    if (contractCompatibilityPromise) {
        return contractCompatibilityPromise;
    }

    contractCompatibilityPromise = (async () => {
        try {
            const rawContractInfo = window.electron.ipcContract?.getVersion
                ? await window.electron.ipcContract.getVersion()
                : await window.electron.ipcRenderer.invoke('ipc:contract:get');
            const contractInfo = ipcContractInfoSchema.parse(rawContractInfo);
            if (!isIpcContractCompatible(contractInfo)) {
                throw new Error(formatContractMismatch(contractInfo));
            }
        } catch (error) {
            throw new Error(translateErrorMessage(`IPC contract negotiation failed: ${getErrorMessage(error as TypeAssertionValue)}`));
        }
    })();

    return contractCompatibilityPromise;
}

function getRetryDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
    const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
    const jitter = exponential * JITTER_FACTOR * Math.random();
    return Math.round(exponential + jitter);
}

/**
 * Generates a deduplication key from channel name and arguments.
 * @param channel - IPC channel name
 * @param args - Positional IPC arguments
 * @returns Unique cache key for the channel + args combination
 */
function buildDedupKey(channel: string, args: IpcValue[]): string {
    return `${channel}::${JSON.stringify(args)}`;
}

/**
 * Tracks a promise for deduplication and schedules cleanup after settlement.
 * @param key - Deduplication key
 * @param promise - The in-flight promise to track
 * @param windowMs - Time in ms to keep the entry after the promise settles
 */
function trackDedupPromise<T>(key: string, promise: Promise<T>, windowMs: number): void {
    inflightRequests.set(key, promise as Promise<RendererDataValue>);
    void promise.finally(() => {
        setTimeout(() => {
            if (inflightRequests.get(key) === promise) {
                inflightRequests.delete(key);
            }
        }, windowMs);
    });
}

interface RetryOptions<T> {
    channel: string;
    args: IpcValue[];
    responseSchema: ZodType<T>;
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    shouldRetry: (error: RendererDataValue) => boolean;
}

/**
 * Executes an IPC call with bounded retry logic for transient failures.
 * @param opts - Channel, args, schema, and retry configuration
 * @returns Parsed response of type T
 */
async function executeWithRetry<T>(opts: RetryOptions<T>): Promise<T> {
    const { channel, args, responseSchema, maxAttempts, baseDelayMs, maxDelayMs, shouldRetry } = opts;
    let lastError: RendererDataValue;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            const response = await window.electron.ipcRenderer.invoke(channel, ...args);
            return responseSchema.parse(response);
        } catch (error) {
            const handledError = error as TypeAssertionValue;
            lastError = handledError;
            if (attempt >= maxAttempts || !shouldRetry(handledError)) {
                break;
            }
            await wait(getRetryDelay(attempt, baseDelayMs, maxDelayMs));
        }
    }

    throw new Error(translateErrorMessage(`IPC ${channel} failed after ${maxAttempts} attempt(s): ${getErrorMessage(lastError)}`));
}

/**
 * Invokes a main-process IPC channel with optional input/output schema validation,
 * bounded retry semantics for transient transport failures, and opt-in request
 * deduplication for identical concurrent calls.
 *
 * @param channel - IPC channel name (e.g. `db:getChats`)
 * @param args - Positional IPC arguments
 * @param options - Validation, retry, and deduplication options
 * @returns Parsed response of type `T`
 * @throws If input validation fails, retries are exhausted, or response validation fails
 */
export async function invokeIpc<T>(
    channel: string,
    args: IpcValue[] = [],
    options: IpcInvokeOptions<T>
): Promise<T> {
    const {
        argsSchema,
        responseSchema,
        maxAttempts = DEFAULT_MAX_ATTEMPTS,
        baseDelayMs = DEFAULT_BASE_DELAY_MS,
        maxDelayMs = DEFAULT_MAX_DELAY_MS,
        shouldRetry = isRetryableError,
        deduplicate = false,
        dedupWindowMs = DEFAULT_DEDUP_WINDOW_MS,
    } = options;

    ensureElectronApi();
    await ensureIpcContractCompatibility();

    const normalizedArgs = (argsSchema ? argsSchema.parse(args) : args) as IpcValue[];

    const retryOpts: RetryOptions<T> = {
        channel, args: normalizedArgs, responseSchema, maxAttempts, baseDelayMs, maxDelayMs, shouldRetry,
    };

    if (deduplicate) {
        const key = buildDedupKey(channel, normalizedArgs);
        const inflight = inflightRequests.get(key) as Promise<T> | undefined;
        if (inflight) {
            return inflight;
        }
        const promise = executeWithRetry(retryOpts);
        trackDedupPromise(key, promise, dedupWindowMs);
        return promise;
    }

    return executeWithRetry(retryOpts);
}

/**
 * Contract-driven typed wrapper for IPC invoke.
 * Allows callsites to statically enforce channel args/response while still
 * performing runtime schema validation via `invokeIpc` options.
 */
export async function invokeTypedIpc<
    TContract extends IpcContractMap,
    TChannel extends keyof TContract & string
>(
    channel: TChannel,
    args: TContract[TChannel]['args'],
    options: IpcInvokeOptions<TContract[TChannel]['response']>
): Promise<TContract[TChannel]['response']> {
    // SAFETY: The args conform to the strict contract schema at design-time but need to be coerced to IpcValue[] for the underlying generic IPC transport.
    return invokeIpc<TContract[TChannel]['response']>(channel, args as TypeAssertionValue as IpcValue[], options);
}
