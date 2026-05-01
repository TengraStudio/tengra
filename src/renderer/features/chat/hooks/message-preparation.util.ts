/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { getSystemPrompt } from '@/lib/identity';
import { generateId } from '@/lib/utils';
import { AppSettings, Chat, Message } from '@/types';

import { formatMessageContent, getPresetOptions } from './utils';

export interface PrepareMessagesOptions {
    chatId: string;
    chats: Chat[];
    userMessage: Message;
    appSettings: AppSettings | undefined;
    selectedModel: string;
    selectedProvider: string;
    language: string;
    activeWorkspacePath?: string | undefined;
    workspaceTitle?: string | undefined;
    workspaceDescription?: string | undefined;
    systemMode: 'thinking' | 'agent' | 'fast';
    toolingEnabled?: boolean | undefined;
}

export function prepareMessages(options: PrepareMessagesOptions): {
    allMessages: Message[];
    presetOptions: Record<string, RendererDataValue>;
} {
    const {
        chatId,
        chats,
        userMessage,
        appSettings,
        selectedModel,
        selectedProvider,
        language,
        activeWorkspacePath,
        systemMode,
        toolingEnabled = systemMode === 'agent',
    } = options;

    const dbRefChat = chats.find(chat => chat.id === chatId);
    const contextMessages = (dbRefChat?.messages ?? []).slice(-15);

    const chatMessages = [...contextMessages, userMessage].map(message => ({
        ...message,
        content: formatMessageContent(message),
    }));

    const modelSettings = appSettings?.modelSettings ?? {};
    const modelConfig = modelSettings[selectedModel] ?? {};
    const systemPrompt =
        modelConfig.systemPrompt ??
        getSystemPrompt(
            language,
            selectedProvider,
            selectedModel
        );

    const systemMessage: Message = {
        role: 'system',
        content: systemPrompt,
        id: generateId(),
        timestamp: new Date(),
    };

    const workspaceHintMessage: Message | null =
        toolingEnabled &&
            typeof activeWorkspacePath === 'string' &&
            activeWorkspacePath.trim().length > 0
            ? {
                role: 'system',
                content: `
You are currently operating in a specialized Coding Environment for the following workspace:
- Title: ${options.workspaceTitle || 'Unnamed Workspace'}
- Description: ${options.workspaceDescription || 'No description provided.'}
- Root Path: ${activeWorkspacePath}

Your primary identity in this mode is a Senior Software Architect and Coding Expert. 
You have direct access to the files in this workspace. Use the available tools to explore, analyze, and modify the codebase.

Guidelines:
1. Use '${activeWorkspacePath}' as the default working directory for all terminal and file operations.
2. When creating new codebases, stick to a consistent project structure.
3. If the user asks for multi-step tasks, prefer persistent terminal sessions.
4. Focus exclusively on technical, architectural, and coding-related assistance. You are a tool-use expert; use your available tools to solve problems instead of just talking about them.
5. You are operating within a sandboxed environment where you are expected to be the primary developer. Take initiative in exploration and implementation.
                `.trim(),
                id: generateId(),
                timestamp: new Date(),
            }
            : null;

    const presetOptions = getPresetOptions(appSettings, modelConfig);

    return {
        allMessages: [systemMessage, ...(workspaceHintMessage ? [workspaceHintMessage] : []), ...chatMessages],
        presetOptions,
    };
}
