import { IpcValue, Message, ModelDefinition, OllamaLibraryModel, ToolCall } from '@shared/types';
import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface OllamaBridge {
    // Chat
    getModels: () => Promise<ModelDefinition[] | { antigravityError?: string }>;
    chat: (messages: Message[], model: string) => Promise<{ content: string; done: boolean }>;
    chatOpenAI: (request: Record<string, unknown>) => Promise<{
        content: string;
        toolCalls?: ToolCall[];
        reasoning?: string;
        images?: string[];
        sources?: string[];
    }>;
    chatStream: (request: Record<string, unknown>) => Promise<{ success: boolean; queued?: boolean }>;
    abortChat: () => void;
    onStreamChunk: (
        callback: (chunk: { content?: string; toolCalls?: ToolCall[]; reasoning?: string }) => void
    ) => () => void;

    removeStreamChunkListener: () => void;

    // Management
    isOllamaRunning: () => Promise<boolean>;
    startOllama: () => Promise<{ success: boolean; message: string }>;
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
}

export function createOllamaBridge(ipc: IpcRenderer): OllamaBridge {
    return {
        getModels: () => ipc.invoke('ollama:get-models'),
        chat: (messages, model) => ipc.invoke('ollama:chat', messages, model),
        chatOpenAI: (request) => ipc.invoke('ollama:chat-openai', request),
        chatStream: (request) => ipc.invoke('ollama:chat-stream', request),
        abortChat: () => ipc.send('ollama:abort-chat'),
        onStreamChunk: callback => {
            const listener = (_event: IpcRendererEvent, chunk: Record<string, unknown>) => callback(chunk as Parameters<Parameters<OllamaBridge['onStreamChunk']>[0]>[0]);
            ipc.on('ollama:stream-chunk', listener);
            return () => ipc.removeListener('ollama:stream-chunk', listener);
        },
        removeStreamChunkListener: () => ipc.removeAllListeners('ollama:stream-chunk'),

        isOllamaRunning: () => ipc.invoke('ollama:is-running'),
        startOllama: () => ipc.invoke('ollama:start'),
        pullModel: modelName => ipc.invoke('ollama:pull-model', modelName),
        deleteModel: modelName => ipc.invoke('ollama:delete-model', modelName),
        getLibraryModels: () => ipc.invoke('ollama:get-library-models'),
        onPullProgress: callback => {
            const listener = (_event: IpcRendererEvent, progress: Record<string, unknown>) => callback(progress as Parameters<Parameters<OllamaBridge['onPullProgress']>[0]>[0]);
            ipc.on('ollama:pull-progress', listener);
            return () => ipc.removeListener('ollama:pull-progress', listener);
        },
        removePullProgressListener: () => ipc.removeAllListeners('ollama:pull-progress'),

        getHealthStatus: () => ipc.invoke('ollama:get-health-status'),
        forceHealthCheck: () => ipc.invoke('ollama:force-health-check'),
        checkCuda: () => ipc.invoke('ollama:check-cuda'),
        onStatusChange: callback => {
            const listener = (_event: IpcRendererEvent, status: 'ok' | 'error' | 'stopped') => callback(status);
            ipc.on('ollama:status-change', listener);
            return () => ipc.removeListener('ollama:status-change', listener);
        },

        checkModelHealth: modelName => ipc.invoke('ollama:check-model-health', modelName),
        checkAllModelsHealth: () => ipc.invoke('ollama:check-all-models-health'),
        getRecommendations: category => ipc.invoke('ollama:get-model-recommendations', category),
        getRecommendedModelForTask: task => ipc.invoke('ollama:get-recommended-model-for-task', task),

        getConnectionStatus: () => ipc.invoke('ollama:get-connection-status'),
        testConnection: () => ipc.invoke('ollama:test-connection'),
        reconnect: () => ipc.invoke('ollama:reconnect'),

        getGPUInfo: () => ipc.invoke('ollama:get-gpu-info'),
        startGPUMonitoring: intervalMs => ipc.invoke('ollama:start-gpu-monitoring', intervalMs),
        stopGPUMonitoring: () => ipc.invoke('ollama:stop-gpu-monitoring'),
        setGPUAlertThresholds: thresholds => ipc.invoke('ollama:set-gpu-alert-thresholds', thresholds),
        getGPUAlertThresholds: () => ipc.invoke('ollama:get-gpu-alert-thresholds'),
        onGPUAlert: callback => {
            const listener = (_event: IpcRendererEvent, alert: IpcValue) => callback(alert);
            ipc.on('ollama:gpu-alert', listener);
            return () => ipc.removeListener('ollama:gpu-alert', listener);
        },
        onGPUStatus: callback => {
            const listener = (_event: IpcRendererEvent, status: IpcValue) => callback(status);
            ipc.on('ollama:gpu-status', listener);
            return () => ipc.removeListener('ollama:gpu-status', listener);
        },
    };
}
