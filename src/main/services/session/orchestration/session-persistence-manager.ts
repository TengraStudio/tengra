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
import { DatabaseService } from '@main/services/data/database.service';
import { ChatSessionRegistryService } from '@main/services/session/chat-session-registry.service';
import {
    buildConversationAssistantMetadata,
    createConversationAssistantRecord,
} from '@main/services/session/orchestration/session-runtime-orchestrator';
import { SettingsService } from '@main/services/system/settings.service';
import { Message, SystemMode, ToolCall, ToolResult } from '@shared/types/chat';
import { JsonObject } from '@shared/types/common';
import { SessionMessageEnvelope } from '@shared/types/session-engine';
import { getErrorMessage } from '@shared/utils/error.util';

interface RecordConversationTokensParams {
    databaseService: DatabaseService;
    model: string;
    provider: string;
    workspaceId?: string;
    chatId?: string;
    promptTokens?: number;
    completionTokens?: number;
    messages: Message[];
}

interface PersistConversationAssistantMessageParams {
    databaseService: DatabaseService;
    chatSessionRegistryService: ChatSessionRegistryService;
    settingsService: SettingsService;
    chatId: string;
    messages: Message[];
    content: string;
    reasoning: string;
    toolCalls: ToolCall[];
    toolResults?: ToolResult[];
    model: string;
    provider: string;
    systemMode?: SystemMode;
    assistantId?: string;
}

export async function recordConversationTokens(
    params: RecordConversationTokensParams
): Promise<void> {
    const {
        databaseService,
        model,
        provider,
        workspaceId,
        chatId,
        promptTokens,
        completionTokens,
        messages,
    } = params;
    try {
        const lastUserMessage = messages.filter(message => message.role === 'user').pop();

        await databaseService.system.addTokenUsage({
            chatId: chatId ?? 'system',
            workspaceId,
            provider,
            model,
            tokensSent: promptTokens ?? 0,
            tokensReceived: completionTokens ?? 0,
            messageId: lastUserMessage?.id,
        });
    } catch (error) {
        appLogger.error('Chat', `Failed to record tokens: ${getErrorMessage(error as Error)}`);
    }
}

export async function persistConversationAssistantMessage(
    params: PersistConversationAssistantMessageParams
): Promise<void> {
    const {
        databaseService,
        chatSessionRegistryService,
        settingsService,
        chatId,
        messages,
        content,
        reasoning,
        toolCalls,
        toolResults,
        model,
        provider,
        systemMode,
        assistantId,
    } = params;
    const assistantMetadata = buildConversationAssistantMetadata({
        messages,
        settingsService,
        systemMode,
        content,
        reasoning,
        toolCalls,
        toolResults,
    });

    await databaseService.addMessage(createConversationAssistantRecord({
        chatId,
        messages,
        settingsService,
        systemMode,
        content,
        reasoning,
        toolCalls,
        toolResults,
        model,
        provider,
        timestamp: Date.now(),
        assistantId,
    }));

    await chatSessionRegistryService.appendMessage(
        chatId,
        createConversationAssistantEnvelope(content, {
            ...assistantMetadata,
            model,
            provider,
            reasoning,
        })
    );
}

function createConversationAssistantEnvelope(
    content: string,
    metadata?: JsonObject
): SessionMessageEnvelope {
    return {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content,
        createdAt: Date.now(),
        metadata,
    };
}

