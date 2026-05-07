/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */


import { appLogger } from '@main/logging/logger';
import { ChatMessage, ToolCall } from '@main/types/llm.types';
import { CatchError, JsonObject } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/system/error.util';

export interface LLMTool {
    type: string;
    function: {
        name: string;
        description: string;
        parameters: JsonObject;
    };
}

export interface ChatResponse {
    content: string;
    tool_calls?: ToolCall[];
    images?: string[];
}

export abstract class BaseLLMService {
    constructor() { }

    abstract chat(messages: ChatMessage[], model: string, tools?: LLMTool[]): Promise<ChatResponse>;
    abstract streamChat(messages: ChatMessage[], model: string, tools?: LLMTool[]): Promise<ReadableStream<Uint8Array> | null | AsyncIterable<string>>;

    /**
     * Standardizes and filters tools for LLM consumption.
     * Ensures MCP tools and native tools are formatted flexibly for diff providers.
     */
    protected prepareTools(tools?: LLMTool[]): LLMTool[] | undefined {
        if (!tools || tools.length === 0) { return undefined; }

        // Common filtering logic can go here if needed
        // For now, we pass them through but ensure structure is clean
        return tools.map(tool => {
            // Ensure strict OpenAI format compatible structure
            return {
                type: tool.type,
                function: {
                    name: tool.function.name,
                    description: tool.function.description,
                    parameters: tool.function.parameters
                }
            };
        });
    }

    /**
     * Common error handling wrapper
     */
    protected handleError(error: CatchError, context: string): never {
        appLogger.error(this.constructor.name, `${context} Error: ${getErrorMessage(error)}`);
        throw error; // Re-throw for caller to handle
    }
}

