/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { OLLAMA_CHANNELS } from '@shared/constants/ipc-channels';
import { IpcValue, Message, ModelDefinition, OllamaLibraryModel, ToolCall } from '@shared/types';
import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface OllamaBridge {
    // Chat
    getModels: () => Promise<ModelDefinition[] | { antigravityError?: string }>;
    chat: (messages: Message[], model: string) => Promise<{ content: string; done: boolean }>;
    chatOpenAI: (request: Record<string, RuntimeValue>) => Promise<{
        content: string;
        toolCalls?: ToolCall[];
        reasoning?: string;
        images?: string[];
        sources?: string[];
    }>;
    chatStream: (request: Record<string, RuntimeValue>) => Promise<{ success: boolean; queued?: boolean }>;
    abortChat: () => void;
    onStreamChunk: (
        callback: (chunk: { content?: string; toolCalls?: ToolCall[]; reasoning?: string }) => void
    ) => () => void;

    removeStreamChunkListener: () => void;

    // Management
    isOllamaRunning: () => Promise<boolean>;
    startOllama: () => Promise<{
        success: boolean;
        message: string;
        messageKey?: string;
        messageParams?: Record<string, string | number>;
    }>;
    pullModel: (modelName: string) => Promise<{ success: boolean; error?: string }>;
    deleteModel: (modelName: string) => Promise<{ success: boolean; error?: string }>;
    getLibraryModels: () => Promise<OllamaLibraryModel[]>;
    onPullProgress: (
        callback: (progress: {
            status: string;
            digest?: string;
            total?: number;
            completed?: number;
            modelName?: string;
        }) => void
    ) => () => void;
    removePullProgressListener: () => void;

    // Health and GPU checks
    getHealthStatus: () => Promise<IpcValue>;
    forceHealthCheck: () => Promise<void>;
    checkCuda: () => Promise<{ hasCuda: boolean; detail?: string }>;
    onStatusChange: (callback: (status: 'ok' | 'error' | 'stopped') => void) => void;

    // Model Health & Recommendations
    checkModelHealth: (modelName: string) => Promise<IpcValue>;
    checkAllModelsHealth: () => Promise<IpcValue[]>;
    getRecommendations: (category?: 'coding' | 'creative' | 'reasoning' | 'general' | 'multimodal') => Promise<IpcValue[]>;
    getRecommendedModelForTask: (task: string) => Promise<IpcValue | null>;

    // Connection Handling
    getConnectionStatus: () => Promise<IpcValue>;
    testConnection: () => Promise<IpcValue>;
    reconnect: () => Promise<boolean>;

    // GPU Monitoring
    getGPUInfo: () => Promise<IpcValue>;
    startGPUMonitoring: (intervalMs?: number) => Promise<{ success: boolean; intervalMs: number }>;
    stopGPUMonitoring: () => Promise<{ success: boolean }>;
    setGPUAlertThresholds: (thresholds: { highMemoryPercent?: number; highTemperatureC?: number; lowMemoryMB?: number }) => Promise<{ success: boolean }>;
    getGPUAlertThresholds: () => Promise<{ highMemoryPercent: number; highTemperatureC: number; lowMemoryMB: number }>;
    onGPUAlert: (callback: (alert: IpcValue) => void) => () => void;
    onGPUStatus: (callback: (status: IpcValue) => void) => () => void;

    // Cloud Account Authentication
    initiateConnect: () => Promise<IpcValue>;
    pollConnectStatus: (code: string, privateKeyB64: string, publicKeyB64: string) => Promise<IpcValue>;
    getOllamaAccounts: () => Promise<IpcValue[]>;
}

export function createOllamaBridge(ipc: IpcRenderer): OllamaBridge {
    return {
        getModels: () => ipc.invoke(OLLAMA_CHANNELS.GET_MODELS),
        chat: (messages, model) => ipc.invoke(OLLAMA_CHANNELS.CHAT, messages, model),
        chatOpenAI: (request) => ipc.invoke(OLLAMA_CHANNELS.CHAT_OPENAI, request),
        chatStream: (request) => ipc.invoke(OLLAMA_CHANNELS.CHAT_STREAM, request),
        abortChat: () => ipc.send(OLLAMA_CHANNELS.ABORT),
        onStreamChunk: callback => {
            const listener = (_event: IpcRendererEvent, chunk: Record<string, RuntimeValue>) => callback(chunk as Parameters<Parameters<OllamaBridge['onStreamChunk']>[0]>[0]);
            ipc.on(OLLAMA_CHANNELS.STREAM_CHUNK, listener);
            return () => ipc.removeListener(OLLAMA_CHANNELS.STREAM_CHUNK, listener);
        },
        removeStreamChunkListener: () => ipc.removeAllListeners(OLLAMA_CHANNELS.STREAM_CHUNK),

        isOllamaRunning: () => ipc.invoke(OLLAMA_CHANNELS.IS_RUNNING),
        startOllama: () => ipc.invoke(OLLAMA_CHANNELS.START),
        pullModel: modelName => ipc.invoke(OLLAMA_CHANNELS.PULL, modelName),
        deleteModel: modelName => ipc.invoke(OLLAMA_CHANNELS.DELETE_MODEL, modelName),
        getLibraryModels: () => ipc.invoke(OLLAMA_CHANNELS.GET_LIBRARY_MODELS),
        onPullProgress: callback => {
            const listener = (_event: IpcRendererEvent, progress: Record<string, RuntimeValue>) => callback(progress as Parameters<Parameters<OllamaBridge['onPullProgress']>[0]>[0]);
            ipc.on(OLLAMA_CHANNELS.PULL_PROGRESS, listener);
            return () => ipc.removeListener(OLLAMA_CHANNELS.PULL_PROGRESS, listener);
        },
        removePullProgressListener: () => ipc.removeAllListeners(OLLAMA_CHANNELS.PULL_PROGRESS),

        getHealthStatus: () => ipc.invoke(OLLAMA_CHANNELS.HEALTH_STATUS),
        forceHealthCheck: () => ipc.invoke(OLLAMA_CHANNELS.FORCE_HEALTH_CHECK),
        checkCuda: () => ipc.invoke(OLLAMA_CHANNELS.CHECK_CUDA),
        onStatusChange: callback => {
            const listener = (_event: IpcRendererEvent, status: 'ok' | 'error' | 'stopped') => callback(status);
            ipc.on(OLLAMA_CHANNELS.STATUS_CHANGE, listener);
            return () => ipc.removeListener(OLLAMA_CHANNELS.STATUS_CHANGE, listener);
        },

        checkModelHealth: modelName => ipc.invoke(OLLAMA_CHANNELS.CHECK_MODEL_HEALTH, modelName),
        checkAllModelsHealth: () => ipc.invoke(OLLAMA_CHANNELS.CHECK_ALL_MODELS_HEALTH),
        getRecommendations: category => ipc.invoke(OLLAMA_CHANNELS.GET_MODEL_RECOMMENDATIONS, category),
        getRecommendedModelForTask: task => ipc.invoke(OLLAMA_CHANNELS.GET_RECOMMENDED_MODEL_FOR_TASK, task),

        getConnectionStatus: () => ipc.invoke(OLLAMA_CHANNELS.GET_CONNECTION_STATUS),
        testConnection: () => ipc.invoke(OLLAMA_CHANNELS.TEST_CONNECTION),
        reconnect: () => ipc.invoke(OLLAMA_CHANNELS.RECONNECT),

        getGPUInfo: () => ipc.invoke(OLLAMA_CHANNELS.GET_GPU_INFO),
        startGPUMonitoring: intervalMs => ipc.invoke(OLLAMA_CHANNELS.START_GPU_MONITORING, intervalMs),
        stopGPUMonitoring: () => ipc.invoke(OLLAMA_CHANNELS.STOP_GPU_MONITORING),
        setGPUAlertThresholds: thresholds => ipc.invoke(OLLAMA_CHANNELS.SET_GPU_ALERT_THRESHOLDS, thresholds),
        getGPUAlertThresholds: () => ipc.invoke(OLLAMA_CHANNELS.GET_GPU_ALERT_THRESHOLDS),
        onGPUAlert: callback => {
            const listener = (_event: IpcRendererEvent, alert: IpcValue) => callback(alert);
            ipc.on(OLLAMA_CHANNELS.GPU_ALERT, listener);
            return () => ipc.removeListener(OLLAMA_CHANNELS.GPU_ALERT, listener);
        },
        onGPUStatus: callback => {
            const listener = (_event: IpcRendererEvent, status: IpcValue) => callback(status);
            ipc.on(OLLAMA_CHANNELS.GPU_STATUS, listener);
            return () => ipc.removeListener(OLLAMA_CHANNELS.GPU_STATUS, listener);
        },

        // Cloud Account Authentication
        initiateConnect: () => ipc.invoke(OLLAMA_CHANNELS.INITIATE_CONNECT),
        pollConnectStatus: (code, privateKeyB64, publicKeyB64) =>
            ipc.invoke(OLLAMA_CHANNELS.POLL_CONNECT_STATUS, code, privateKeyB64, publicKeyB64),
        getOllamaAccounts: () => ipc.invoke(OLLAMA_CHANNELS.GET_OLLAMA_ACCOUNTS),
    };
}

