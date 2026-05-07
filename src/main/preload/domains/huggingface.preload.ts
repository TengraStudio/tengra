/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { HF_CHANNELS, HF_FINETUNE_CHANNELS, HF_VERSIONS_CHANNELS } from '@shared/constants/ipc-channels';
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
    deleteModel: (modelId: string) => Promise<{ success: boolean; error?: string }>;
}

export function createHuggingFaceBridge(ipc: IpcRenderer): HuggingFaceBridge {
    return {
        searchModels: (query, limit, page, sort) =>
            ipc.invoke(HF_CHANNELS.SEARCH_MODELS, query, limit, page, sort),
        getRecommendations: (limit, query) =>
            ipc.invoke(HF_CHANNELS.GET_RECOMMENDATIONS, limit, query),
        getFiles: (modelId) => ipc.invoke(HF_CHANNELS.GET_FILES, modelId),
        getModelPreview: (modelId) => ipc.invoke(HF_CHANNELS.GET_MODEL_PREVIEW, modelId),
        getBulkModelPreviews: (modelIds) => ipc.invoke(HF_CHANNELS.GET_BULK_MODEL_PREVIEWS, modelIds),
        compareModels: (modelIds) => ipc.invoke(HF_CHANNELS.COMPARE_MODELS, modelIds),
        validateCompatibility: (file, availableRamGB, availableVramGB) =>
            ipc.invoke(HF_CHANNELS.VALIDATE_COMPATIBILITY, file, availableRamGB, availableVramGB),
        getWatchlist: () => ipc.invoke(HF_CHANNELS.GET_WATCHLIST),
        addToWatchlist: (modelId) => ipc.invoke(HF_CHANNELS.ADD_TO_WATCHLIST, modelId),
        removeFromWatchlist: (modelId) => ipc.invoke(HF_CHANNELS.REMOVE_FROM_WATCHLIST, modelId),
        getCacheStats: () => ipc.invoke(HF_CHANNELS.CACHE_STATS),
        clearCache: () => ipc.invoke(HF_CHANNELS.CACHE_CLEAR),
        testDownloadedModel: (filePath) => ipc.invoke(HF_CHANNELS.TEST_DOWNLOADED_MODEL, filePath),
        getConversionPresets: () => ipc.invoke(HF_CHANNELS.GET_CONVERSION_PRESETS),
        getOptimizationSuggestions: (options) =>
            ipc.invoke(HF_CHANNELS.GET_OPTIMIZATION_SUGGESTIONS, options),
        validateConversion: (options) => ipc.invoke(HF_CHANNELS.VALIDATE_CONVERSION, options),
        convertModel: (options) => ipc.invoke(HF_CHANNELS.CONVERT_MODEL, options),
        onConversionProgress: (callback) => {
            const listener = (
                _event: IpcRendererEvent,
                progress: { stage: string; percent: number; message: string }
            ) => callback(progress);
            ipc.on(HF_CHANNELS.CONVERSION_PROGRESS, listener);
            return () => ipc.removeListener(HF_CHANNELS.CONVERSION_PROGRESS, listener);
        },
        getModelVersions: (modelId) => ipc.invoke(HF_VERSIONS_CHANNELS.LIST, modelId),
        registerModelVersion: (modelId, filePath, notes) =>
            ipc.invoke(HF_VERSIONS_CHANNELS.REGISTER, modelId, filePath, notes),
        compareModelVersions: (modelId, leftVersionId, rightVersionId) =>
            ipc.invoke(HF_VERSIONS_CHANNELS.COMPARE, modelId, leftVersionId, rightVersionId),
        rollbackModelVersion: (modelId, versionId, targetPath) =>
            ipc.invoke(HF_VERSIONS_CHANNELS.ROLLBACK, modelId, versionId, targetPath),
        pinModelVersion: (modelId, versionId, pinned) =>
            ipc.invoke(HF_VERSIONS_CHANNELS.PIN, modelId, versionId, pinned),
        getVersionNotifications: (modelId) => ipc.invoke(HF_VERSIONS_CHANNELS.NOTIFICATIONS, modelId),
        prepareFineTuneDataset: (inputPath, outputPath) =>
            ipc.invoke(HF_FINETUNE_CHANNELS.PREPARE_DATASET, inputPath, outputPath),
        startFineTune: (modelId, datasetPath, outputPath, options) =>
            ipc.invoke(HF_FINETUNE_CHANNELS.START, modelId, datasetPath, outputPath, options),
        listFineTuneJobs: (modelId) => ipc.invoke(HF_FINETUNE_CHANNELS.LIST, modelId),
        getFineTuneJob: (jobId) => ipc.invoke(HF_FINETUNE_CHANNELS.GET, jobId),
        cancelFineTuneJob: (jobId) => ipc.invoke(HF_FINETUNE_CHANNELS.CANCEL, jobId),
        evaluateFineTuneJob: (jobId) => ipc.invoke(HF_FINETUNE_CHANNELS.EVALUATE, jobId),
        exportFineTunedModel: (jobId, exportPath) =>
            ipc.invoke(HF_FINETUNE_CHANNELS.EXPORT, jobId, exportPath),
        onFineTuneProgress: (callback) => {
            const listener = (_event: IpcRendererEvent, job: RuntimeValue) => callback(job);
            ipc.on(HF_FINETUNE_CHANNELS.PROGRESS, listener);
            return () => ipc.removeListener(HF_FINETUNE_CHANNELS.PROGRESS, listener);
        },
        downloadFile: (url, outputPath, expectedSize, expectedSha256, scheduleAtMs) =>
            ipc.invoke(HF_CHANNELS.DOWNLOAD_FILE, {
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
            ipc.on(HF_CHANNELS.DOWNLOAD_PROGRESS, listener);
            return () => ipc.removeListener(HF_CHANNELS.DOWNLOAD_PROGRESS, listener);
        },
        cancelDownload: () => {
            void ipc.invoke(HF_CHANNELS.CANCEL_DOWNLOAD);
        },
        deleteModel: (modelId) => ipc.invoke(HF_CHANNELS.DELETE_MODEL, modelId),
    };
}

