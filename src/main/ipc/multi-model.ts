import { appLogger } from '@main/logging/logger';
import { ComparisonRequest, MultiModelComparisonService } from '@main/services/llm/multi-model-comparison.service';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { withRateLimit } from '@main/utils/rate-limiter.util';
import { ipcMain, IpcMainInvokeEvent } from 'electron';

/** Maximum models count */
const MAX_MODELS_COUNT = 10;
/** Maximum chat ID length */
const MAX_CHAT_ID_LENGTH = 128;

/**
 * Validates a comparison request
 */
function validateComparisonRequest(value: unknown): ComparisonRequest | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const raw = value as Record<string, unknown>;

    // Validate chatId
    if (typeof raw.chatId !== 'string' || !raw.chatId.trim() || raw.chatId.length > MAX_CHAT_ID_LENGTH) {
        return null;
    }

    // Validate messages array
    if (!Array.isArray(raw.messages)) {
        return null;
    }

    // Validate models array
    if (!Array.isArray(raw.models) || raw.models.length === 0) {
        return null;
    }
    if (raw.models.length > MAX_MODELS_COUNT) {
        return null;
    }

    // Validate each model entry
    const validModels = raw.models.filter((model): model is { provider: string; model: string } => {
        if (!model || typeof model !== 'object') {
            return false;
        }
        const m = model as Record<string, unknown>;
        return typeof m.provider === 'string' && typeof m.model === 'string';
    });

    if (validModels.length === 0) {
        return null;
    }

    return {
        chatId: raw.chatId,
        messages: raw.messages,
        models: validModels
    } as ComparisonRequest;
}

/**
 * Registers IPC handlers for multi-model comparison operations
 */
export function registerMultiModelIpc(comparisonService: MultiModelComparisonService): void {
    appLogger.info('MultiModelIPC', 'Registering multi-model IPC handlers');

    ipcMain.handle(
        'llm:compare-models',
        createIpcHandler(
            'llm:compare-models',
            async (_event: IpcMainInvokeEvent, requestRaw: unknown) => {
                const request = validateComparisonRequest(requestRaw);
                if (!request) {
                    throw new Error('Invalid comparison request');
                }

                return await withRateLimit('llm', async () =>
                    comparisonService.compareModels(request)
                );
            }
        )
    );
}
