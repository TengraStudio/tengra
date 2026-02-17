import { IpcValue } from '@shared/types/common';
import { z, ZodError, ZodType } from 'zod';

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 150;
const DEFAULT_MAX_DELAY_MS = 1500;
const JITTER_FACTOR = 0.2;

export interface IpcContractEntry<Args extends readonly IpcValue[] = readonly IpcValue[], Response = unknown> {
    args: Args;
    response: Response;
}

export type IpcContractMap = Record<string, IpcContractEntry>;

export interface IpcInvokeOptions<T> {
    argsSchema?: z.ZodTuple<[z.ZodTypeAny, ...z.ZodTypeAny[]]> | z.ZodTuple<[]>;
    responseSchema: ZodType<T>;
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
}

function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

function isRetryableError(error: unknown): boolean {
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
        throw new Error('IPC bridge is not available');
    }
}

function getRetryDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
    const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
    const jitter = exponential * JITTER_FACTOR * Math.random();
    return Math.round(exponential + jitter);
}

/**
 * Invokes a main-process IPC channel with optional input/output schema validation
 * and bounded retry semantics for transient transport failures.
 *
 * @param channel - IPC channel name (e.g. `db:getChats`)
 * @param args - Positional IPC arguments
 * @param options - Validation and retry options
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
        shouldRetry = isRetryableError
    } = options;

    ensureElectronApi();

    const normalizedArgs = argsSchema ? argsSchema.parse(args) : args;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            const response = await window.electron.ipcRenderer.invoke(channel, ...normalizedArgs);
            return responseSchema.parse(response);
        } catch (error) {
            lastError = error;
            // Retry only on transient transport-like failures.
            if (attempt >= maxAttempts || !shouldRetry(error)) {
                break;
            }
            await wait(getRetryDelay(attempt, baseDelayMs, maxDelayMs));
        }
    }

    throw new Error(`IPC ${channel} failed after ${maxAttempts} attempt(s): ${getErrorMessage(lastError)}`);
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
    return invokeIpc<TContract[TChannel]['response']>(channel, args as unknown as IpcValue[], options);
}
