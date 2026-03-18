import { IpcValue, Message, ToolCall } from '@shared/types';
import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface LlamaBridge {
    chat: (messages: Message[], modelPath: string, options?: Record<string, RuntimeValue>) => Promise<{ content: string; done: boolean }>;
    chatStream: (messages: Message[], modelPath: string, options?: Record<string, RuntimeValue>) => Promise<{ success: boolean }>;
    abortChat: () => void;
    onStreamChunk: (
        callback: (chunk: { content?: string; toolCalls?: ToolCall[]; reasoning?: string }) => void
    ) => () => void;
    removeStreamChunkListener: () => void;
    getMetadata: (modelPath: string) => Promise<IpcValue>;
    validateModel: (modelPath: string) => Promise<{ valid: boolean; error?: string }>;
}

export function createLlamaBridge(ipc: IpcRenderer): LlamaBridge {
    return {
        chat: (messages, modelPath, options) => ipc.invoke('llama:chat', { messages, modelPath, options }),
        chatStream: (messages, modelPath, options) =>
            ipc.invoke('llama:chat:stream', { messages, modelPath, options }),
        abortChat: () => ipc.send('llama:chat:abort'),
        onStreamChunk: callback => {
            const listener = (_event: IpcRendererEvent, chunk: Record<string, RuntimeValue>) => callback(chunk as Parameters<Parameters<LlamaBridge['onStreamChunk']>[0]>[0]);
            ipc.on('llama:chat:stream:chunk', listener);
            return () => ipc.removeListener('llama:chat:stream:chunk', listener);
        },
        removeStreamChunkListener: () => ipc.removeAllListeners('llama:chat:stream:chunk'),
        getMetadata: modelPath => ipc.invoke('llama:get-metadata', modelPath),
        validateModel: modelPath => ipc.invoke('llama:validate-model', modelPath),
    };
}
