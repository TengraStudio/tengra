import { Message, ToolDefinition } from '@shared/types/chat';
import { JsonObject } from '@shared/types/common';
import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface ChatBridge {
    chatStream: (params: {
        messages: Message[];
        model: string;
        tools?: ToolDefinition[];
        provider: string;
        optionsJson?: JsonObject;
        chatId: string;
        projectId?: string;
        systemMode?: string;
    }) => Promise<{ success: boolean; error?: string }>;

    onStreamChunk: (
        callback: (chunk: {
            chatId: string;
            content?: string;
            reasoning?: string;
            done?: boolean;
            type?: 'error' | 'metadata';
            sources?: string[];
        }) => void
    ) => () => void;

    abortChat: (chatId: string) => void;
}

export function createChatBridge(ipc: IpcRenderer): ChatBridge {
    return {
        chatStream: params => ipc.invoke('chat:stream', params),

        onStreamChunk: callback => {
            const listener = (_event: IpcRendererEvent, chunk: Parameters<typeof callback>[0]) => callback(chunk);
            ipc.on('ollama:streamChunk', listener);
            return () => ipc.removeListener('ollama:streamChunk', listener);
        },

        abortChat: chatId => ipc.send('chat:cancel', { chatId }),
    };
}
