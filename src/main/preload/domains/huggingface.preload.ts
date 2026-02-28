import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface HuggingFaceBridge {
    searchModels: (
        query: string,
        limit: number,
        page: number,
        sort?: string
    ) => Promise<{ models: { id: string; downloads: number; likes: number }[]; total: number }>;
    getRecommendations: (
        limit?: number,
        query?: string
    ) => Promise<{ id: string; downloads: number; likes: number; category: string; recommendationScore: number }[]>;
    getFiles: (
        modelId: string
    ) => Promise<{ path: string; size: number; oid: string; quantization: string }[]>;
    getModelPreview: (modelId: string) => Promise<unknown>;
    compareModels: (modelIds: string[]) => Promise<unknown>;
    validateCompatibility: (
        file: { path: string; size: number; oid?: string; quantization: string },
        availableRamGB?: number,
        availableVramGB?: number
    ) => Promise<{
        compatible: boolean;
        reasons: string[];
        estimatedRamGB: number;
        estimatedVramGB: number;
    }>;
    getWatchlist: () => Promise<string[]>;
    addToWatchlist: (modelId: string) => Promise<{ success: boolean }>;
    removeFromWatchlist: (modelId: string) => Promise<{ success: boolean }>;
    getCacheStats: () => Promise<{
        size: number;
        maxSize: number;
        ttlMs: number;
        oldestAgeMs: number;
        watchlistSize: number;
    }>;
    clearCache: () => Promise<{ success: boolean; removed: number }>;
    testDownloadedModel: (filePath: string) => Promise<{
        success: boolean;
        error?: string;
        metadata?: { architecture?: string; contextLength?: number };
    }>;
    getConversionPresets: () => Promise<Array<{
        id: 'balanced' | 'quality' | 'speed' | 'tiny';
        quantization: 'F16' | 'Q8_0' | 'Q6_K' | 'Q5_K_M' | 'Q4_K_M';
        description: string;
    }>>;
    getOptimizationSuggestions: (options: {
        sourcePath: string;
        outputPath: string;
        quantization: string;
        preset?: string;
        modelId?: string;
    }) => Promise<string[]>;
    validateConversion: (options: {
        sourcePath: string;
        outputPath: string;
        quantization: string;
        preset?: string;
        modelId?: string;
    }) => Promise<{ valid: boolean; errors: string[] }>;
    convertModel: (options: {
        sourcePath: string;
        outputPath: string;
        quantization: string;
        preset?: string;
        modelId?: string;
    }) => Promise<{ success: boolean; error?: string; warnings?: string[] }>;
    onConversionProgress: (
        callback: (progress: { stage: string; percent: number; message: string }) => void
    ) => () => void;
    getModelVersions: (modelId: string) => Promise<Array<{
        versionId: string;
        modelId: string;
        path: string;
        createdAt: number;
        notes?: string;
        pinned?: boolean;
        metadata?: { architecture?: string; contextLength?: number };
    }>>;
    registerModelVersion: (modelId: string, filePath: string, notes?: string) => Promise<unknown>;
    compareModelVersions: (modelId: string, leftVersionId: string, rightVersionId: string) => Promise<unknown>;
    rollbackModelVersion: (modelId: string, versionId: string, targetPath: string) => Promise<{ success: boolean; error?: string }>;
    pinModelVersion: (modelId: string, versionId: string, pinned: boolean) => Promise<{ success: boolean }>;
    getVersionNotifications: (modelId: string) => Promise<string[]>;
    prepareFineTuneDataset: (inputPath: string, outputPath: string) => Promise<{
        success: boolean;
        outputPath: string;
        records: number;
        error?: string;
    }>;
    startFineTune: (
        modelId: string,
        datasetPath: string,
        outputPath: string,
        options?: { epochs?: number; learningRate?: number }
    ) => Promise<unknown>;
    listFineTuneJobs: (modelId?: string) => Promise<unknown[]>;
    getFineTuneJob: (jobId: string) => Promise<unknown>;
    cancelFineTuneJob: (jobId: string) => Promise<{ success: boolean }>;
    evaluateFineTuneJob: (jobId: string) => Promise<unknown>;
    exportFineTunedModel: (jobId: string, exportPath: string) => Promise<{ success: boolean; error?: string }>;
    onFineTuneProgress: (callback: (job: unknown) => void) => () => void;
    downloadFile: (
        url: string,
        outputPath: string,
        expectedSize: number,
        expectedSha256: string,
        scheduleAtMs?: number
    ) => Promise<{ success: boolean; error?: string }>;
    onDownloadProgress: (
        callback: (progress: { filename: string; received: number; total: number }) => void
    ) => void;
    cancelDownload: () => void;
}

export function createHuggingFaceBridge(ipc: IpcRenderer): HuggingFaceBridge {
    return {
        searchModels: (query, limit, page, sort) =>
            ipc.invoke('huggingface:search-models', { query, limit, page, sort }),
        getRecommendations: (limit, query) =>
            ipc.invoke('huggingface:get-recommendations', { limit, query }),
        getFiles: (modelId) => ipc.invoke('huggingface:get-files', modelId),
        getModelPreview: (modelId) => ipc.invoke('huggingface:get-model-preview', modelId),
        compareModels: (modelIds) => ipc.invoke('huggingface:compare-models', modelIds),
        validateCompatibility: (file, availableRamGB, availableVramGB) =>
            ipc.invoke('huggingface:validate-compatibility', {
                file,
                availableRamGB,
                availableVramGB,
            }),
        getWatchlist: () => ipc.invoke('huggingface:get-watchlist'),
        addToWatchlist: (modelId) => ipc.invoke('huggingface:add-to-watchlist', modelId),
        removeFromWatchlist: (modelId) => ipc.invoke('huggingface:remove-from-watchlist', modelId),
        getCacheStats: () => ipc.invoke('huggingface:get-cache-stats'),
        clearCache: () => ipc.invoke('huggingface:clear-cache'),
        testDownloadedModel: (filePath) => ipc.invoke('huggingface:test-downloaded-model', filePath),
        getConversionPresets: () => ipc.invoke('huggingface:get-conversion-presets'),
        getOptimizationSuggestions: (options) =>
            ipc.invoke('huggingface:get-optimization-suggestions', options),
        validateConversion: (options) => ipc.invoke('huggingface:validate-conversion', options),
        convertModel: (options) => ipc.invoke('huggingface:convert-model', options),
        onConversionProgress: (callback) => {
            const listener = (
                _event: IpcRendererEvent,
                progress: { stage: string; percent: number; message: string }
            ) => callback(progress);
            ipc.on('huggingface:conversion-progress', listener);
            return () => ipc.removeListener('huggingface:conversion-progress', listener);
        },
        getModelVersions: (modelId) => ipc.invoke('huggingface:get-model-versions', modelId),
        registerModelVersion: (modelId, filePath, notes) =>
            ipc.invoke('huggingface:register-model-version', { modelId, filePath, notes }),
        compareModelVersions: (modelId, leftVersionId, rightVersionId) =>
            ipc.invoke('huggingface:compare-model-versions', {
                modelId,
                leftVersionId,
                rightVersionId,
            }),
        rollbackModelVersion: (modelId, versionId, targetPath) =>
            ipc.invoke('huggingface:rollback-model-version', { modelId, versionId, targetPath }),
        pinModelVersion: (modelId, versionId, pinned) =>
            ipc.invoke('huggingface:pin-model-version', { modelId, versionId, pinned }),
        getVersionNotifications: (modelId) => ipc.invoke('huggingface:get-version-notifications', modelId),
        prepareFineTuneDataset: (inputPath, outputPath) =>
            ipc.invoke('huggingface:prepare-fine-tune-dataset', { inputPath, outputPath }),
        startFineTune: (modelId, datasetPath, outputPath, options) =>
            ipc.invoke('huggingface:start-fine-tune', {
                modelId,
                datasetPath,
                outputPath,
                options,
            }),
        listFineTuneJobs: (modelId) => ipc.invoke('huggingface:list-fine-tune-jobs', modelId),
        getFineTuneJob: (jobId) => ipc.invoke('huggingface:get-fine-tune-job', jobId),
        cancelFineTuneJob: (jobId) => ipc.invoke('huggingface:cancel-fine-tune-job', jobId),
        evaluateFineTuneJob: (jobId) => ipc.invoke('huggingface:evaluate-fine-tune-job', jobId),
        exportFineTunedModel: (jobId, exportPath) =>
            ipc.invoke('huggingface:export-fine-tuned-model', { jobId, exportPath }),
        onFineTuneProgress: (callback) => {
            const listener = (_event: IpcRendererEvent, job: unknown) => callback(job);
            ipc.on('huggingface:fine-tune-progress', listener);
            return () => ipc.removeListener('huggingface:fine-tune-progress', listener);
        },
        downloadFile: (url, outputPath, expectedSize, expectedSha256, scheduleAtMs) =>
            ipc.invoke('huggingface:download-file', {
                url,
                outputPath,
                expectedSize,
                expectedSha256,
                scheduleAtMs,
            }),
        onDownloadProgress: (callback) => {
            const listener = (
                _event: IpcRendererEvent,
                progress: { filename: string; received: number; total: number }
            ) => callback(progress);
            ipc.on('huggingface:download-progress', listener);
            return () => ipc.removeListener('huggingface:download-progress', listener);
        },
        cancelDownload: () => ipc.send('huggingface:cancel-download'),
    };
}
