import { IpcValue } from '@shared/types/common';
import { z, ZodType } from 'zod';

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 150;

export interface IpcInvokeOptions<T> {
    argsSchema?: z.ZodTuple<[z.ZodTypeAny, ...z.ZodTypeAny[]]> | z.ZodTuple<[]>;
    responseSchema: ZodType<T>;
    maxAttempts?: number;
    baseDelayMs?: number;
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
    const message = getErrorMessage(error).toLowerCase();
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
            await wait(baseDelayMs * attempt);
        }
    }

    throw new Error(`IPC ${channel} failed after ${maxAttempts} attempt(s): ${getErrorMessage(lastError)}`);
}
