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
function validateQuery(value: RuntimeValue): string {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim().slice(0, MAX_QUERY_LENGTH);
}

/**
 * Validates a model ID
 */
function validateModelId(value: RuntimeValue): string | null {
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
function validateUrl(value: RuntimeValue): string | null {
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
function validatePath(value: RuntimeValue): string | null {
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
function validateLimit(value: RuntimeValue): number {
    const num = Number(value);
    if (!Number.isInteger(num) || num < 1) {
        return 10;
    }
    return Math.min(num, MAX_LIMIT);
}

/**
 * Validates a page number
 */
function validatePage(value: RuntimeValue): number {
    const num = Number(value);
    if (!Number.isInteger(num) || num < 0) {
        return 0;
    }
    return Math.min(num, MAX_PAGE);
}

/**
 * Validates a sort option
 */
function validateSort(value: RuntimeValue): string {
    if (typeof value !== 'string') {
        return 'downloads';
    }
    const validSorts = ['downloads', 'likes', 'trending', 'lastModified', 'updated', 'name'];
    return validSorts.includes(value) ? value : 'downloads';
}

/**
 * Validates expected file size
 */
function validateFileSize(value: RuntimeValue): number {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
        return 0;
    }
    return num;
}

function validateModelIdList(value: RuntimeValue): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map(v => validateModelId(v))
        .filter((v): v is string => typeof v === 'string')
        .slice(0, 4);
}

/**
 * Validates expected SHA256 hash
 */
function validateSha256(value: RuntimeValue): string {
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

function validateConversionQuantization(value: RuntimeValue): 'F16' | 'Q8_0' | 'Q6_K' | 'Q5_K_M' | 'Q4_K_M' {
    if (typeof value !== 'string') {
        return 'Q4_K_M';
    }
    const allowed = new Set(['F16', 'Q8_0', 'Q6_K', 'Q5_K_M', 'Q4_K_M']);
    const normalized = value.toUpperCase();
    if (!allowed.has(normalized)) {
        return 'Q4_K_M';
    }
    return normalized as 'F16' | 'Q8_0' | 'Q6_K' | 'Q5_K_M' | 'Q4_K_M';
}

/**
 * Registers IPC handlers for HuggingFace model operations
 */
export function registerHFModelIpc(llmService: LLMService, hfService: HuggingFaceService) {
    appLogger.debug('HuggingFaceIPC', 'Registering HuggingFace IPC handlers');

    ipcMain.handle('hf:search-models', createSafeIpcHandler('hf:search-models',
        async (_event: IpcMainInvokeEvent, queryRaw: RuntimeValue, limitRaw: RuntimeValue, pageRaw: RuntimeValue, sortRaw: RuntimeValue) => {
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
        async (_event: IpcMainInvokeEvent, modelIdRaw: RuntimeValue) => {
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
        async (event: IpcMainInvokeEvent, paramsRaw: RuntimeValue) => {
            const params = paramsRaw as {
                url: RuntimeValue;
                outputPath: RuntimeValue;
                expectedSize: RuntimeValue;
                expectedSha256: RuntimeValue;
                scheduleAt: RuntimeValue;
            };
            const url = validateUrl(params.url);
            const outputPath = validatePath(params.outputPath);
            if (!url || !outputPath) {
                throw new Error('Invalid URL or output path');
            }
            const expectedSize = validateFileSize(params.expectedSize);
            const expectedSha256 = validateSha256(params.expectedSha256);
            const scheduleAtMs = typeof params.scheduleAt === 'number' && Number.isFinite(params.scheduleAt)
                ? params.scheduleAt
                : undefined;
            appLogger.info('HuggingFaceIPC', `Downloading file to ${outputPath}`);
            return await hfService.downloadFile(url, outputPath, {
                expectedSize,
                expectedSha256,
                scheduleAtMs,
                onProgress: (received: number, total: number) => {
                    event.sender.send('hf:download-progress', { filename: outputPath, received, total });
                }
            });
        }
    ));

    ipcMain.handle('hf:cancel-download', createSafeIpcHandler('hf:cancel-download',
        async () => {
            const cancelled = await hfService.cancelPendingDownloads();
            return { cancelled: true, pendingCancelled: cancelled };
        }, { cancelled: false, pendingCancelled: 0 }
    ));

    ipcMain.handle('hf:get-recommendations', createSafeIpcHandler(
        'hf:get-recommendations',
        async (_event: IpcMainInvokeEvent, limitRaw: RuntimeValue, queryRaw: RuntimeValue) => {
            const limit = validateLimit(limitRaw);
            const query = validateQuery(queryRaw);
            return await withRateLimit('huggingface', async () => hfService.getRecommendations(limit, query));
        },
        []
    ));

    ipcMain.handle('hf:get-model-preview', createSafeIpcHandler(
        'hf:get-model-preview',
        async (_event: IpcMainInvokeEvent, modelIdRaw: RuntimeValue) => {
            const modelId = validateModelId(modelIdRaw);
            if (!modelId) {
                throw new Error('Invalid model ID');
            }
            return await withRateLimit('huggingface', async () => hfService.getModelPreview(modelId));
        },
        null
    ));

    ipcMain.handle('hf:get-bulk-model-previews', createSafeIpcHandler(
        'hf:get-bulk-model-previews',
        async (_event: IpcMainInvokeEvent, modelIdsRaw: RuntimeValue) => {
            const modelIds = Array.isArray(modelIdsRaw) ? modelIdsRaw.filter((id): id is string => typeof id === 'string').map(id => validateModelId(id)).filter(Boolean) as string[] : [];
            if (modelIds.length === 0) {
                return {};
            }
            return await withRateLimit('huggingface', async () => hfService.getBulkModelPreviews(modelIds));
        },
        {}
    ));

    ipcMain.handle('hf:compare-models', createSafeIpcHandler(
        'hf:compare-models',
        async (_event: IpcMainInvokeEvent, modelIdsRaw: RuntimeValue) => {
            const modelIds = validateModelIdList(modelIdsRaw);
            return await withRateLimit('huggingface', async () => hfService.compareModels(modelIds));
        },
        { previews: [], recommendation: {} }
    ));

    ipcMain.handle('hf:validate-compatibility', createSafeIpcHandler(
        'hf:validate-compatibility',
        async (_event: IpcMainInvokeEvent, fileRaw: RuntimeValue, ramRaw: RuntimeValue, vramRaw: RuntimeValue) => {
            const file = fileRaw as { path: string; size: number; oid?: string; quantization: string };
            if (!file || typeof file.path !== 'string' || typeof file.size !== 'number' || typeof file.quantization !== 'string') {
                throw new Error('Invalid file payload');
            }
            const ram = typeof ramRaw === 'number' && Number.isFinite(ramRaw) ? ramRaw : 16;
            const vram = typeof vramRaw === 'number' && Number.isFinite(vramRaw) ? vramRaw : 8;
            return await hfService.validateModelCompatibility({ ...file, oid: file.oid }, ram, vram);
        },
        { compatible: true, reasons: [], estimatedRamGB: 0, estimatedVramGB: 0 }
    ));

    ipcMain.handle('hf:watchlist:get', createSafeIpcHandler(
        'hf:watchlist:get',
        async () => hfService.getWatchlist(),
        []
    ));

    ipcMain.handle('hf:watchlist:add', createSafeIpcHandler(
        'hf:watchlist:add',
        async (_event: IpcMainInvokeEvent, modelIdRaw: RuntimeValue) => {
            const modelId = validateModelId(modelIdRaw);
            if (!modelId) {
                throw new Error('Invalid model ID');
            }
            return { success: await hfService.addToWatchlist(modelId) };
        },
        { success: false }
    ));

    ipcMain.handle('hf:watchlist:remove', createSafeIpcHandler(
        'hf:watchlist:remove',
        async (_event: IpcMainInvokeEvent, modelIdRaw: RuntimeValue) => {
            const modelId = validateModelId(modelIdRaw);
            if (!modelId) {
                throw new Error('Invalid model ID');
            }
            return { success: await hfService.removeFromWatchlist(modelId) };
        },
        { success: false }
    ));

    ipcMain.handle('hf:cache-stats', createSafeIpcHandler(
        'hf:cache-stats',
        async () => hfService.getCacheStats(),
        { size: 0, maxSize: 0, ttlMs: 0, oldestAgeMs: 0, watchlistSize: 0 }
    ));

    ipcMain.handle('hf:cache-clear', createSafeIpcHandler(
        'hf:cache-clear',
        async () => hfService.clearCache(),
        { success: false, removed: 0 }
    ));

    ipcMain.handle('hf:test-downloaded-model', createSafeIpcHandler(
        'hf:test-downloaded-model',
        async (_event: IpcMainInvokeEvent, filePathRaw: RuntimeValue) => {
            const filePath = validatePath(filePathRaw);
            if (!filePath) {
                throw new Error('Invalid file path');
            }
            return await hfService.testDownloadedModel(filePath);
        },
        { success: false, error: 'Test failed' }
    ));

    ipcMain.handle('hf:get-conversion-presets', createSafeIpcHandler(
        'hf:get-conversion-presets',
        async () => hfService.getConversionPresets(),
        []
    ));

    ipcMain.handle('hf:get-optimization-suggestions', createSafeIpcHandler(
        'hf:get-optimization-suggestions',
        async (_event: IpcMainInvokeEvent, optionsRaw: RuntimeValue) => {
            const options = optionsRaw as {
                sourcePath: string;
                outputPath: string;
                quantization: string;
                preset?: string;
                modelId?: string;
            };
            return hfService.getOptimizationSuggestions({
                sourcePath: validatePath(options?.sourcePath) ?? '',
                outputPath: validatePath(options?.outputPath) ?? '',
                quantization: validateConversionQuantization(options?.quantization),
                preset: typeof options?.preset === 'string' ? options.preset as 'balanced' | 'quality' | 'speed' | 'tiny' : undefined,
                modelId: validateModelId(options?.modelId ?? '') ?? undefined
            });
        },
        []
    ));

    ipcMain.handle('hf:validate-conversion', createSafeIpcHandler(
        'hf:validate-conversion',
        async (_event: IpcMainInvokeEvent, optionsRaw: RuntimeValue) => {
            const options = optionsRaw as {
                sourcePath: string;
                outputPath: string;
                quantization: string;
                preset?: string;
                modelId?: string;
            };
            return hfService.validateConversionOptions({
                sourcePath: validatePath(options?.sourcePath) ?? '',
                outputPath: validatePath(options?.outputPath) ?? '',
                quantization: validateConversionQuantization(options?.quantization),
                preset: typeof options?.preset === 'string' ? options.preset as 'balanced' | 'quality' | 'speed' | 'tiny' : undefined,
                modelId: validateModelId(options?.modelId ?? '') ?? undefined
            });
        },
        { valid: false, errors: ['validation failed'] }
    ));

    ipcMain.handle('hf:convert-model', createSafeIpcHandler(
        'hf:convert-model',
        async (event: IpcMainInvokeEvent, optionsRaw: RuntimeValue) => {
            const options = optionsRaw as {
                sourcePath: string;
                outputPath: string;
                quantization: string;
                preset?: string;
                modelId?: string;
            };
            return await hfService.convertModelToGGUF(
                {
                    sourcePath: validatePath(options?.sourcePath) ?? '',
                    outputPath: validatePath(options?.outputPath) ?? '',
                    quantization: validateConversionQuantization(options?.quantization),
                    preset: typeof options?.preset === 'string' ? options.preset as 'balanced' | 'quality' | 'speed' | 'tiny' : undefined,
                    modelId: validateModelId(options?.modelId ?? '') ?? undefined
                },
                (progress) => {
                    event.sender.send('hf:conversion-progress', progress);
                }
            );
        },
        { success: false, error: 'conversion failed' }
    ));

    ipcMain.handle('hf:versions:list', createSafeIpcHandler(
        'hf:versions:list',
        async (_event: IpcMainInvokeEvent, modelIdRaw: RuntimeValue) => {
            const modelId = validateModelId(modelIdRaw);
            if (!modelId) {
                throw new Error('Invalid model ID');
            }
            return await hfService.getModelVersions(modelId);
        },
        []
    ));

    ipcMain.handle('hf:versions:register', createSafeIpcHandler(
        'hf:versions:register',
        async (_event: IpcMainInvokeEvent, modelIdRaw: RuntimeValue, filePathRaw: RuntimeValue, notesRaw: RuntimeValue) => {
            const modelId = validateModelId(modelIdRaw);
            const filePath = validatePath(filePathRaw);
            if (!modelId || !filePath) {
                throw new Error('Invalid model ID or file path');
            }
            const notes = typeof notesRaw === 'string' ? notesRaw.slice(0, 500) : undefined;
            return await hfService.registerModelVersion(modelId, filePath, notes);
        },
        null
    ));

    ipcMain.handle('hf:versions:compare', createSafeIpcHandler(
        'hf:versions:compare',
        async (_event: IpcMainInvokeEvent, modelIdRaw: RuntimeValue, leftRaw: RuntimeValue, rightRaw: RuntimeValue) => {
            const modelId = validateModelId(modelIdRaw);
            const left = validateModelId(leftRaw);
            const right = validateModelId(rightRaw);
            if (!modelId || !left || !right) {
                throw new Error('Invalid comparison arguments');
            }
            return await hfService.compareModelVersions(modelId, left, right);
        },
        { summary: 'comparison failed', deltas: { createdAtMs: 0, architectureChanged: false, contextLengthDelta: 0 } }
    ));

    ipcMain.handle('hf:versions:rollback', createSafeIpcHandler(
        'hf:versions:rollback',
        async (_event: IpcMainInvokeEvent, modelIdRaw: RuntimeValue, versionIdRaw: RuntimeValue, targetPathRaw: RuntimeValue) => {
            const modelId = validateModelId(modelIdRaw);
            const versionId = validateModelId(versionIdRaw);
            const targetPath = validatePath(targetPathRaw);
            if (!modelId || !versionId || !targetPath) {
                throw new Error('Invalid rollback arguments');
            }
            return await hfService.rollbackModelVersion(modelId, versionId, targetPath);
        },
        { success: false, error: 'rollback failed' }
    ));

    ipcMain.handle('hf:versions:pin', createSafeIpcHandler(
        'hf:versions:pin',
        async (_event: IpcMainInvokeEvent, modelIdRaw: RuntimeValue, versionIdRaw: RuntimeValue, pinnedRaw: RuntimeValue) => {
            const modelId = validateModelId(modelIdRaw);
            const versionId = validateModelId(versionIdRaw);
            if (!modelId || !versionId) {
                throw new Error('Invalid pin arguments');
            }
            const pinned = Boolean(pinnedRaw);
            return await hfService.pinModelVersion(modelId, versionId, pinned);
        },
        { success: false }
    ));

    ipcMain.handle('hf:versions:notifications', createSafeIpcHandler(
        'hf:versions:notifications',
        async (_event: IpcMainInvokeEvent, modelIdRaw: RuntimeValue) => {
            const modelId = validateModelId(modelIdRaw);
            if (!modelId) {
                throw new Error('Invalid model ID');
            }
            return await hfService.getVersionNotifications(modelId);
        },
        []
    ));

    ipcMain.handle('hf:finetune:prepare-dataset', createSafeIpcHandler(
        'hf:finetune:prepare-dataset',
        async (_event: IpcMainInvokeEvent, inputRaw: RuntimeValue, outputRaw: RuntimeValue) => {
            const inputPath = validatePath(inputRaw);
            const outputPath = validatePath(outputRaw);
            if (!inputPath || !outputPath) {
                throw new Error('Invalid dataset paths');
            }
            return await hfService.prepareFineTuneDataset(inputPath, outputPath);
        },
        { success: false, outputPath: '', records: 0, error: 'dataset preparation failed' }
    ));

    ipcMain.handle('hf:finetune:start', createSafeIpcHandler(
        'hf:finetune:start',
        async (event: IpcMainInvokeEvent, modelIdRaw: RuntimeValue, datasetRaw: RuntimeValue, outputRaw: RuntimeValue, optionsRaw: RuntimeValue) => {
            const modelId = validateModelId(modelIdRaw);
            const datasetPath = validatePath(datasetRaw);
            const outputPath = validatePath(outputRaw);
            if (!modelId || !datasetPath || !outputPath) {
                throw new Error('Invalid fine-tune args');
            }
            const options = optionsRaw as { epochs?: number; learningRate?: number } | undefined;
            return await hfService.startFineTune(modelId, datasetPath, outputPath, {
                epochs: typeof options?.epochs === 'number' ? options.epochs : undefined,
                learningRate: typeof options?.learningRate === 'number' ? options.learningRate : undefined,
                onProgress: (job) => {
                    event.sender.send('hf:finetune-progress', job);
                }
            });
        },
        null
    ));

    ipcMain.handle('hf:finetune:list', createSafeIpcHandler(
        'hf:finetune:list',
        async (_event: IpcMainInvokeEvent, modelIdRaw: RuntimeValue) => {
            const modelId = validateModelId(modelIdRaw ?? '');
            return await hfService.listFineTuneJobs(modelId ?? undefined);
        },
        []
    ));

    ipcMain.handle('hf:finetune:get', createSafeIpcHandler(
        'hf:finetune:get',
        async (_event: IpcMainInvokeEvent, jobIdRaw: RuntimeValue) => {
            const jobId = validateModelId(jobIdRaw);
            if (!jobId) {
                throw new Error('Invalid job ID');
            }
            return await hfService.getFineTuneJob(jobId);
        },
        null
    ));

    ipcMain.handle('hf:finetune:cancel', createSafeIpcHandler(
        'hf:finetune:cancel',
        async (_event: IpcMainInvokeEvent, jobIdRaw: RuntimeValue) => {
            const jobId = validateModelId(jobIdRaw);
            if (!jobId) {
                throw new Error('Invalid job ID');
            }
            return await hfService.cancelFineTuneJob(jobId);
        },
        { success: false }
    ));

    ipcMain.handle('hf:finetune:evaluate', createSafeIpcHandler(
        'hf:finetune:evaluate',
        async (_event: IpcMainInvokeEvent, jobIdRaw: RuntimeValue) => {
            const jobId = validateModelId(jobIdRaw);
            if (!jobId) {
                throw new Error('Invalid job ID');
            }
            return await hfService.evaluateFineTuneJob(jobId);
        },
        { success: false, error: 'evaluation failed' }
    ));

    ipcMain.handle('hf:finetune:export', createSafeIpcHandler(
        'hf:finetune:export',
        async (_event: IpcMainInvokeEvent, jobIdRaw: RuntimeValue, exportPathRaw: RuntimeValue) => {
            const jobId = validateModelId(jobIdRaw);
            const exportPath = validatePath(exportPathRaw);
            if (!jobId || !exportPath) {
                throw new Error('Invalid export arguments');
            }
            return await hfService.exportFineTunedModel(jobId, exportPath);
        },
        { success: false, error: 'export failed' }
    ));

    ipcMain.handle('hf:delete-model', createSafeIpcHandler('hf:delete-model',
        async (_event: IpcMainInvokeEvent, modelIdRaw: RuntimeValue) => {
            const modelId = validateModelId(modelIdRaw);
            if (!modelId) {
                throw new Error('Invalid model ID');
            }
            return await hfService.deleteModel(modelId);
        },
        { success: false, error: 'delete failed' }
    ));
}
