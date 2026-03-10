import type { ChatRequest, ChatStreamRequest, ToolCall } from './chat';

export interface SessionConversationCompleteResult {
    content: string;
    toolCalls?: ToolCall[];
    reasoning?: string;
    images?: string[];
    sources?: string[];
}

export interface SessionConversationStreamStartResult {
    success: boolean;
    queued?: boolean;
    data?: { queued?: boolean };
    error?: { message: string; code?: string };
}

export interface SessionConversationStreamChunk {
    chatId?: string;
    content?: string;
    reasoning?: string;
    done?: boolean;
    type?: 'error' | 'metadata';
    sources?: string[];
    toolCalls?: ToolCall[];
    error?: string;
}

export interface SessionConversationGenerationStatus {
    chatId?: string;
    isGenerating?: boolean;
}

export interface SessionConversationApi {
    complete: (request: ChatRequest) => Promise<SessionConversationCompleteResult>;
    stream: (request: ChatStreamRequest) => Promise<SessionConversationStreamStartResult>;
    abort: (chatId: string) => void;
    onStreamChunk: (
        callback: (chunk: SessionConversationStreamChunk) => void
    ) => () => void;
    onGenerationStatus: (
        callback: (data: SessionConversationGenerationStatus) => void
    ) => () => void;
}
