import { appLogger } from '@main/logging/logger';
import { HuggingFaceService } from '@main/services/llm/huggingface.service';
import { LLMService } from '@main/services/llm/llm.service';
import { createIpcHandler, createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { withRateLimit } from '@main/utils/rate-limiter.util';
import { ipcMain, IpcMainInvokeEvent } from 'electron';

/** Maximum query length */
const MAX_QUERY_LENGTH = 256;
/** Maximum model ID length */
const MAX_MODEL_ID_LENGTH = 256;
/** Maximum URL length */
const MAX_URL_LENGTH = 2048;
/** Maximum output path length */
const MAX_PATH_LENGTH = 4096;
/** Maximum results limit */
const MAX_LIMIT = 100;
/** Maximum page number */
const MAX_PAGE = 1000;

/**
 * Validates a query string
 */
function validateQuery(value: unknown): string {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim().slice(0, MAX_QUERY_LENGTH);
}

/**
 * Validates a model ID
 */
function validateModelId(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_MODEL_ID_LENGTH) {
        return null;
    }
    // Model IDs should not contain dangerous characters
    if (/[<>"'`\\]/.test(trimmed)) {
        return null;
    }
    return trimmed;
}

/**
 * Validates a URL
 */
function validateUrl(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_URL_LENGTH) {
        return null;
    }
    try {
        const url = new URL(trimmed);
        // Only allow https URLs to HuggingFace
        if (url.protocol !== 'https:') {
            return null;
        }
        if (!url.hostname.includes('huggingface.co')) {
            return null;
        }
        return trimmed;
    } catch {
        return null;
    }
}

/**
 * Validates an output path
 */
function validatePath(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_PATH_LENGTH) {
        return null;
    }
    return trimmed;
}

/**
 * Validates a numeric limit
 */
function validateLimit(value: unknown): number {
    const num = Number(value);
    if (!Number.isInteger(num) || num < 1) {
        return 10;
    }
    return Math.min(num, MAX_LIMIT);
}

/**
 * Validates a page number
 */
function validatePage(value: unknown): number {
    const num = Number(value);
    if (!Number.isInteger(num) || num < 0) {
        return 0;
    }
    return Math.min(num, MAX_PAGE);
}

/**
 * Validates a sort option
 */
function validateSort(value: unknown): string {
    if (typeof value !== 'string') {
        return 'downloads';
    }
    const validSorts = ['downloads', 'likes', 'trending', 'lastModified'];
    return validSorts.includes(value) ? value : 'downloads';
}

/**
 * Validates expected file size
 */
function validateFileSize(value: unknown): number {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
        return 0;
    }
    return num;
}

/**
 * Validates expected SHA256 hash
 */
function validateSha256(value: unknown): string {
    if (typeof value !== 'string') {
        return '';
    }
    const trimmed = value.trim().toLowerCase();
    // SHA256 is 64 hex characters
    if (trimmed && !/^[a-f0-9]{64}$/.test(trimmed)) {
        return '';
    }
    return trimmed;
}

/**
 * Registers IPC handlers for HuggingFace model operations
 */
export function registerHFModelIpc(llmService: LLMService, hfService: HuggingFaceService) {
    appLogger.info('HuggingFaceIPC', 'Registering HuggingFace IPC handlers');

    ipcMain.handle('hf:search-models', createSafeIpcHandler('hf:search-models',
        async (_event: IpcMainInvokeEvent, queryRaw: unknown, limitRaw: unknown, pageRaw: unknown, sortRaw: unknown) => {
            const query = validateQuery(queryRaw);
            const limit = validateLimit(limitRaw);
            const page = validatePage(pageRaw);
            const sort = validateSort(sortRaw);
            return await withRateLimit('huggingface', async () =>
                llmService.searchHFModels(query, limit, page, sort)
            );
        }, { models: [], total: 0 }
    ));

    ipcMain.handle('hf:get-files', createSafeIpcHandler('hf:get-files',
        async (_event: IpcMainInvokeEvent, modelIdRaw: unknown) => {
            const modelId = validateModelId(modelIdRaw);
            if (!modelId) {
                throw new Error('Invalid model ID');
            }
            return await withRateLimit('huggingface', async () =>
                hfService.getModelFiles(modelId)
            );
        }, []
    ));

    ipcMain.handle('hf:download-file', createIpcHandler('hf:download-file',
        async (event: IpcMainInvokeEvent, urlRaw: unknown, outputPathRaw: unknown, expectedSizeRaw: unknown, expectedSha256Raw: unknown) => {
            const url = validateUrl(urlRaw);
            const outputPath = validatePath(outputPathRaw);
            if (!url || !outputPath) {
                throw new Error('Invalid URL or output path');
            }
            const expectedSize = validateFileSize(expectedSizeRaw);
            const expectedSha256 = validateSha256(expectedSha256Raw);
            appLogger.info('HuggingFaceIPC', `Downloading file to ${outputPath}`);
            return await hfService.downloadFile(url, outputPath, expectedSize, expectedSha256, (received: number, total: number) => {
                event.sender.send('hf:download-progress', { filename: outputPath, received, total });
            });
        }
    ));

    ipcMain.handle('hf:cancel-download', createSafeIpcHandler('hf:cancel-download',
        async () => {
            // Implement cancellation logic if we store the controller/stream
            // For now, placeholder
            return { cancelled: true };
        }, { cancelled: false }
    ));
}
