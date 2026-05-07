/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ToolCall } from '@main/types/llm.types';
import { OpenAIResponse } from '@main/types/llm.types';
import { JsonObject } from '@shared/types/common';
import { ApiError } from '@shared/utils/error.util';
 
/**
 * Parses the OpenCode Responses API format into an OpenAIResponse.
 */
export function parseOpenCodeResponse(json: JsonObject): OpenAIResponse {
    const rawOutput = json['output'];
    const outputArray = Array.isArray(rawOutput) ? rawOutput : [rawOutput];
    const output = outputArray.find(
        (o: RuntimeValue) => o && typeof o === 'object' && (o as JsonObject).type === 'message'
    ) as JsonObject | undefined;

    if (!output) {
        throw new ApiError('Unexpected response format from OpenCode', 'opencode', 200);
    }

    const { content, reasoning, tool_calls } = extractOpenCodeContent(output);

    return {
        content: content,
        role: 'assistant',
        reasoning_content: reasoning || undefined,
        tool_calls: tool_calls.length > 0 ? tool_calls : undefined
    } as OpenAIResponse;
}

/**
 * Extracts content, reasoning, and tool calls from an OpenCode output block.
 */
function extractOpenCodeContent(output: JsonObject): {
    content: string;
    reasoning: string;
    tool_calls: ToolCall[];
} {
    let content = '';
    let reasoning = '';
    const tool_calls: ToolCall[] = [];
    const rawContent = output['content'];

    if (Array.isArray(rawContent)) {
        for (const part of rawContent as JsonObject[]) {
            if (part['type'] === 'output_text') {
                content += (part['text'] as string);
            } else if (part['type'] === 'reasoning' || part['type'] === 'summary_text') {
                reasoning += (part['text'] as string);
            } else if (part['type'] === 'function_call' && part['function_call']) {
                tool_calls.push(parseOpenCodeToolCall(part['function_call'] as JsonObject));
            }
        }
    }
    return { content, reasoning, tool_calls };
}

/**
 * Parses a single OpenCode tool call.
 */
function parseOpenCodeToolCall(call: JsonObject): ToolCall {
    return {
        id: (call['id'] as string) || `call_${crypto.randomUUID().substring(0, 8)}`,
        type: 'function',
        function: {
            name: call['name'] as string,
            arguments: typeof call['arguments'] === 'string'
                ? call['arguments']
                : JSON.stringify(call['arguments'])
        }
    };
}

