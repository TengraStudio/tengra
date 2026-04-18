/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
    ) => Promise<Array<{
        path: string;
        size: number;
        oid: string;
        quantization: string;
        fileFormat?: 'gguf' | 'safetensors' | 'ckpt' | 'unknown';
        runtimeProvider?: 'llama.cpp' | 'hf-native';
    }>>;
    getModelPreview: (modelId: string) => Promise<RuntimeValue>;
    getBulkModelPreviews: (modelIds: string[]) => Promise<Record<string, RuntimeValue>>;
    compareModels: (modelIds: string[]) => Promise<RuntimeValue>;
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
        fileFormat?: 'gguf' | 'safetensors' | 'ckpt' | 'unknown';
        runtimeProvider?: 'llama.cpp' | 'hf-native';
        metadata?: { architecture?: string; contextLength?: number };
    }>>;
    registerModelVersion: (modelId: string, filePath: string, notes?: string) => Promise<RuntimeValue>;
    compareModelVersions: (modelId: string, leftVersionId: string, rightVersionId: string) => Promise<RuntimeValue>;
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
    ) => Promise<RuntimeValue>;
    listFineTuneJobs: (modelId?: string) => Promise<RuntimeValue[]>;
    getFineTuneJob: (jobId: string) => Promise<RuntimeValue>;
    cancelFineTuneJob: (jobId: string) => Promise<{ success: boolean }>;
    evaluateFineTuneJob: (jobId: string) => Promise<RuntimeValue>;
    exportFineTunedModel: (jobId: string, exportPath: string) => Promise<{ success: boolean; error?: string }>;
    onFineTuneProgress: (callback: (job: RuntimeValue) => void) => () => void;
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
            ipc.invoke('hf:search-models', query, limit, page, sort),
        getRecommendations: (limit, query) =>
            ipc.invoke('hf:get-recommendations', limit, query),
        getFiles: (modelId) => ipc.invoke('hf:get-files', modelId),
        getModelPreview: (modelId) => ipc.invoke('hf:get-model-preview', modelId),
        getBulkModelPreviews: (modelIds) => ipc.invoke('hf:get-bulk-model-previews', modelIds),
        compareModels: (modelIds) => ipc.invoke('hf:compare-models', modelIds),
        validateCompatibility: (file, availableRamGB, availableVramGB) =>
            ipc.invoke('hf:validate-compatibility', file, availableRamGB, availableVramGB),
        getWatchlist: () => ipc.invoke('hf:watchlist:get'),
        addToWatchlist: (modelId) => ipc.invoke('hf:watchlist:add', modelId),
        removeFromWatchlist: (modelId) => ipc.invoke('hf:watchlist:remove', modelId),
        getCacheStats: () => ipc.invoke('hf:cache-stats'),
        clearCache: () => ipc.invoke('hf:cache-clear'),
        testDownloadedModel: (filePath) => ipc.invoke('hf:test-downloaded-model', filePath),
        getConversionPresets: () => ipc.invoke('hf:get-conversion-presets'),
        getOptimizationSuggestions: (options) =>
            ipc.invoke('hf:get-optimization-suggestions', options),
        validateConversion: (options) => ipc.invoke('hf:validate-conversion', options),
        convertModel: (options) => ipc.invoke('hf:convert-model', options),
        onConversionProgress: (callback) => {
            const listener = (
                _event: IpcRendererEvent,
                progress: { stage: string; percent: number; message: string }
            ) => callback(progress);
            ipc.on('hf:conversion-progress', listener);
            return () => ipc.removeListener('hf:conversion-progress', listener);
        },
        getModelVersions: (modelId) => ipc.invoke('hf:versions:list', modelId),
        registerModelVersion: (modelId, filePath, notes) =>
            ipc.invoke('hf:versions:register', modelId, filePath, notes),
        compareModelVersions: (modelId, leftVersionId, rightVersionId) =>
            ipc.invoke('hf:versions:compare', modelId, leftVersionId, rightVersionId),
        rollbackModelVersion: (modelId, versionId, targetPath) =>
            ipc.invoke('hf:versions:rollback', modelId, versionId, targetPath),
        pinModelVersion: (modelId, versionId, pinned) =>
            ipc.invoke('hf:versions:pin', modelId, versionId, pinned),
        getVersionNotifications: (modelId) => ipc.invoke('hf:versions:notifications', modelId),
        prepareFineTuneDataset: (inputPath, outputPath) =>
            ipc.invoke('hf:finetune:prepare-dataset', inputPath, outputPath),
        startFineTune: (modelId, datasetPath, outputPath, options) =>
            ipc.invoke('hf:finetune:start', modelId, datasetPath, outputPath, options),
        listFineTuneJobs: (modelId) => ipc.invoke('hf:finetune:list', modelId),
        getFineTuneJob: (jobId) => ipc.invoke('hf:finetune:get', jobId),
        cancelFineTuneJob: (jobId) => ipc.invoke('hf:finetune:cancel', jobId),
        evaluateFineTuneJob: (jobId) => ipc.invoke('hf:finetune:evaluate', jobId),
        exportFineTunedModel: (jobId, exportPath) =>
            ipc.invoke('hf:finetune:export', jobId, exportPath),
        onFineTuneProgress: (callback) => {
            const listener = (_event: IpcRendererEvent, job: RuntimeValue) => callback(job);
            ipc.on('hf:finetune-progress', listener);
            return () => ipc.removeListener('hf:finetune-progress', listener);
        },
        downloadFile: (url, outputPath, expectedSize, expectedSha256, scheduleAtMs) =>
            ipc.invoke('hf:download-file', {
                url,
                outputPath,
                expectedSize,
                expectedSha256,
                scheduleAt: scheduleAtMs,
            }),
        onDownloadProgress: (callback) => {
            const listener = (
                _event: IpcRendererEvent,
                progress: { filename: string; received: number; total: number }
            ) => callback(progress);
            ipc.on('hf:download-progress', listener);
            return () => ipc.removeListener('hf:download-progress', listener);
        },
        cancelDownload: () => {
            void ipc.invoke('hf:cancel-download');
        },
    };
}
