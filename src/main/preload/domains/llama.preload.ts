/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { LLAMA_CHANNELS } from '@shared/constants/ipc-channels';
import { IpcValue, Message, ToolCall } from '@shared/types';
import type { RuntimeValue } from '@shared/types/common';
import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface LlamaBridge {
    loadModel: (modelPath: string, config?: Record<string, RuntimeValue>) => Promise<{ success: boolean; error?: string }>;
    unloadModel: () => Promise<{ success: boolean }>;
    chat: (messages: Message[], modelPath: string, options?: Record<string, RuntimeValue>) => Promise<{ content: string; done: boolean }>;
    chatStream: (messages: Message[], modelPath: string, options?: Record<string, RuntimeValue>) => Promise<{ success: boolean }>;
    abortChat: () => void;
    onStreamChunk: (
        callback: (chunk: { content?: string; toolCalls?: ToolCall[]; reasoning?: string }) => void
    ) => () => void;
    removeStreamChunkListener: () => void;
    getModels: () => Promise<IpcValue>;
    getModelsDir: () => Promise<string>;
    getConfig: () => Promise<IpcValue>;
    setConfig: (config: Record<string, RuntimeValue>) => Promise<{ success: boolean }>;
    getGpuInfo: () => Promise<IpcValue>;
    getMetadata: (modelPath: string) => Promise<IpcValue>;
    validateModel: (modelPath: string) => Promise<{ valid: boolean; error?: string }>;
}

export function createLlamaBridge(ipc: IpcRenderer): LlamaBridge {
    return {
        loadModel: (modelPath, config) => ipc.invoke(LLAMA_CHANNELS.LOAD_MODEL, modelPath, config),
        unloadModel: () => ipc.invoke(LLAMA_CHANNELS.UNLOAD_MODEL),
        chat: (messages, modelPath, options) => ipc.invoke(LLAMA_CHANNELS.CHAT, { messages, modelPath, options }),
        chatStream: (messages, modelPath, options) =>
            ipc.invoke(LLAMA_CHANNELS.CHAT_STREAM, { messages, modelPath, options }),
        abortChat: () => ipc.send(LLAMA_CHANNELS.ABORT_CHAT),
        onStreamChunk: callback => {
            const listener = (_event: IpcRendererEvent, chunk: Record<string, RuntimeValue>) => callback(chunk as Parameters<Parameters<LlamaBridge['onStreamChunk']>[0]>[0]);
            ipc.on(LLAMA_CHANNELS.CHAT_STREAM_CHUNK, listener);
            return () => ipc.removeListener(LLAMA_CHANNELS.CHAT_STREAM_CHUNK, listener);
        },
        removeStreamChunkListener: () => ipc.removeAllListeners(LLAMA_CHANNELS.CHAT_STREAM_CHUNK),
        getModels: () => ipc.invoke(LLAMA_CHANNELS.GET_MODELS),
        getModelsDir: () => ipc.invoke(LLAMA_CHANNELS.GET_MODELS_DIR),
        getConfig: () => ipc.invoke(LLAMA_CHANNELS.GET_CONFIG),
        setConfig: config => ipc.invoke(LLAMA_CHANNELS.SET_CONFIG, config),
        getGpuInfo: () => ipc.invoke(LLAMA_CHANNELS.GET_GPU_INFO),
        getMetadata: modelPath => ipc.invoke(LLAMA_CHANNELS.GET_METADATA, modelPath),
        validateModel: modelPath => ipc.invoke(LLAMA_CHANNELS.VALIDATE_MODEL, modelPath),
    };
}

