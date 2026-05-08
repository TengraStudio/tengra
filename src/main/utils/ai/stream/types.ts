/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 */

import { ToolCall } from '@shared/types/ai/chat';

export interface StreamChunk {
    index?: number;
    content?: string;
    reasoning?: string;
    reasoning_summary?: string;
    images?: Array<string | { image_url: { url: string } }>;
    type?: string;
    tool_calls?: ToolCall[];
    tool_name?: string;
    tool_id?: string;
    finish_reason?: string | null;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export type OpenCodeToolCallState = {
    id: string;
    name: string;
    arguments: string;
};

export type OpenCodeStreamState = {
    toolCalls: Map<string, OpenCodeToolCallState>;
    processedMessageIds: Set<string>;
    lastContent: string;
};

export type CopilotToolCallState = {
    id: string;
    name: string;
    arguments: string;
};

export type CopilotStreamState = {
    toolCalls: Map<string, CopilotToolCallState>;
    lastContent: string;
    lastReasoning: string;
};

export type AntigravityStreamState = {
    toolCalls: Map<string, { id: string, name: string, arguments: string }>;
    lastContent: string;
    lastReasoning: string;
};

export type InterceptorState = {
    buffer: string;
    lastUpdateTime: number;
    lastEmittedToolName?: string;
};

export type OpenAIStreamDelta = {
    content?: string;
    reasoning_content?: string;
    reasoning?: string;
    thinking?: string;
    thought?: string;
    images?: Array<string | { image_url: { url: string } }>;
    tool_calls?: Partial<ToolCall>[];
};

export type OpenAIStreamPayload = {
    id?: string;
    object?: string;
    created?: number;
    model?: string;
    choices?: {
        index?: number;
        delta: {
            content?: string;
            reasoning_content?: string;
            reasoning?: string;
            thinking?: string;
            thought?: string;
            images?: Array<string | { image_url: { url: string } }>;
            tool_calls?: Partial<ToolCall>[];
        };
        finish_reason?: string | null;
    }[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
};

export type StreamItemContent = {
    type: string;
    text?: string;
};

export type StreamPayload = OpenAIStreamPayload & {
    type?: string;
    data?: RuntimeValue;
    delta?: string | { text?: string };
    message?: string;
    text?: string;
    item?: {
        id?: string;
        type?: string;
        call_id?: string;
        name?: string;
        result?: string;
        url?: string | { url?: string };
        image_url?: string | { url?: string };
        arguments?: string;
        function?: {
            name?: string;
            arguments?: string;
            thought_signature?: string;
        };
        content?: StreamItemContent[];
    };
    response_id?: string;
    item_id?: string;
    call_id?: string;
    name?: string;
    arguments?: string;
    tool_calls?: ToolCall[];
    tool_name?: string;
    tool_id?: string;
};

type RuntimePrimitive = string | number | boolean | null | undefined;
type RuntimeCollection = { [key: string]: RuntimeValue } | RuntimeValue[];
type RuntimeCallable = (...args: RuntimeValue[]) => RuntimeValue;
export type RuntimeValue =
    | RuntimePrimitive
    | RuntimeCollection
    | Response
    | ReadableStream<Uint8Array>
    | AsyncIterable<Uint8Array>
    | Uint8Array
    | RuntimeCallable;

export interface IStreamParserStrategy {
    parse(json: StreamPayload, state: unknown, interceptorState: InterceptorState): Generator<StreamChunk>;
}
    

