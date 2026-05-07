/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { generateId } from '@/lib/utils';
import { Message } from '@/types';

export interface ExecuteBatchToolCallsParams {
    toolCalls: NonNullable<Message['toolCalls']>;
    workspacePath: string | undefined;
    t: (key: string) => string;
    chatId: string | undefined;
    accumulatedMessages: Message[];
    executeToolCall: (
        toolCall: NonNullable<Message['toolCalls']>[number],
        activeWorkspacePath: string | undefined,
        translate: (key: string) => string,
        activeChatId?: string
    ) => Promise<{
        toolMessage: Message;
        generatedImages: string[];
    }>;
    onToolProgress?: (toolResults: Message[]) => void;
}

export async function executeBatchToolCalls(
    params: ExecuteBatchToolCallsParams
): Promise<{ toolResults: Message[]; generatedImages: string[] }> {
    const {
        toolCalls,
        workspacePath,
        t,
        chatId,
        accumulatedMessages,
        executeToolCall,
        onToolProgress,
    } = params;
    const toolResults: Message[] = [];
    const generatedImages: string[] = [];

    for (const toolCall of toolCalls) {
        try {
            const executedTool = await executeToolCall(toolCall, workspacePath, t, chatId);
            generatedImages.push(...executedTool.generatedImages);
            toolResults.push(executedTool.toolMessage);
            accumulatedMessages.push(executedTool.toolMessage);
            onToolProgress?.([...toolResults]);
        } catch (error) {
            const syntheticToolMessage: Message = {
                id: generateId(),
                role: 'tool',
                content: JSON.stringify({
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    tool: toolCall.function.name,
                }),
                toolCallId: toolCall.id,
                timestamp: new Date(),
            };
            toolResults.push(syntheticToolMessage);
            accumulatedMessages.push(syntheticToolMessage);
            onToolProgress?.([...toolResults]);
        }
    }

    return { toolResults, generatedImages };
}

