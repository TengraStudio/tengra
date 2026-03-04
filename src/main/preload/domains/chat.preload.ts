import { Message } from '@shared/types/chat';
import { ChatRequest, ChatStreamRequest } from '@shared/types/index';
import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface ChatBridge {
    chat: (messages: Message[], model: string) => Promise<{ content: string; done: boolean }>;
    chatOpenAI: (request: ChatRequest) => Promise<{
        content: string;
        toolCalls?: import('@shared/types/index').ToolCall[];
        reasoning?: string;
        images?: string[];
        sources?: string[];
    }>;
    chatStream: (params: ChatStreamRequest) => Promise<{ success: boolean; queued?: boolean; data?: { queued?: boolean }; error?: { message: string; code?: string } }>;
    abortChat: (chatId: string) => void;
    onStreamChunk: (
        callback: (chunk: {
            chatId?: string;
            content?: string;
            reasoning?: string;
            done?: boolean;
            type?: 'error' | 'metadata';
            sources?: string[];
            toolCalls?: import('@shared/types/index').ToolCall[];
        }) => void
    ) => () => void;
    removeStreamChunkListener: () => void;
    onChatGenerationStatus: (callback: (data: unknown) => void) => () => void;
}

export function createChatBridge(ipc: IpcRenderer): ChatBridge {
    return {
        chat: (messages, model) => ipc.invoke('chat:copilot', [messages, model]),
        chatOpenAI: request => ipc.invoke('chat:openai', request),
        chatStream: params => ipc.invoke('chat:stream', params),
        abortChat: chatId => ipc.send('chat:cancel', { chatId }),

        onStreamChunk: callback => {
            const listener = (_event: IpcRendererEvent, chunk: unknown) => callback(chunk as Parameters<typeof callback>[0]);
            ipc.on('ollama:streamChunk', listener);
            return () => ipc.removeListener('ollama:streamChunk', listener);
        },
        removeStreamChunkListener: () => {
            ipc.removeAllListeners('ollama:streamChunk');
        },
        onChatGenerationStatus: callback => {
            const listener = (_event: IpcRendererEvent, data: unknown) => callback(data);
            ipc.on('chat:generationStatus', listener);
            return () => ipc.removeListener('chat:generationStatus', listener);
        }
    };
}
