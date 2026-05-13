/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Chat Import Service
 * Imports chat data from external AI tools (ChatGPT, Claude) into the local database.
 */

import { promises as fs } from 'fs';

import { BaseService } from '@main/services/base.service';
import { Chat as DbChat, DatabaseService } from '@main/services/data/database.service';
import { JsonObject } from '@shared/types/common';
import { safeJsonParse } from '@shared/utils/sanitize.util';

/** Supported import formats. */
export type ImportFormat = 'chatgpt' | 'claude' | 'tengra-json';

/** Result of a chat import operation. */
export interface ChatImportResult {
    success: boolean;
    importedCount: number;
    errors: string[];
}

/** Unified intermediate message shape for import mapping. */
interface ImportedMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
}

/** Unified intermediate chat shape for import mapping. */
interface ImportedChat {
    title: string;
    messages: ImportedMessage[];
    createdAt: Date;
}

/** ChatGPT export conversation structure. */
interface ChatGPTConversation {
    title?: string;
    create_time?: number;
    mapping?: Record<string, ChatGPTNode>;
}

/** ChatGPT message node in the mapping tree. */
interface ChatGPTNode {
    message?: {
        author?: { role?: string };
        content?: { parts?: string[] };
        create_time?: number;
    };
    children?: string[];
}

/** Claude export conversation structure. */
interface ClaudeConversation {
    name?: string;
    created_at?: string;
    chat_messages?: ClaudeMessage[];
}

/** Claude message structure. */
interface ClaudeMessage {
    sender?: string;
    text?: string;
    created_at?: string;
}

/**
 * Parses and imports chat conversations from ChatGPT and Claude export formats.
 */
export class ChatImportService extends BaseService {
    static readonly serviceName = 'chatImportService';
    static readonly dependencies = ['databaseService'] as const;
    constructor(private readonly databaseService: DatabaseService) {
        super('ChatImportService');
    }

    /** Initializes the import service. */
    async initialize(): Promise<void> {
        this.logInfo('Chat import service initialized');
    }

    /**
     * Imports chats from a file path in the specified format.
     * @param filePath - Path to the export file.
     * @param format - The source format to parse.
     */
    async importFromFile(filePath: string, format: ImportFormat): Promise<ChatImportResult> {
        this.logInfo(`Importing from ${filePath} (format: ${format})`);
        const errors: string[] = [];

        try {
            const raw = await fs.readFile(filePath, 'utf-8');
            const chats = this.parseChats(raw, format);

            if (chats.length === 0) {
                return { success: false, importedCount: 0, errors: ['No valid chats found in file'] };
            }

            let importedCount = 0;
            for (let i = 0; i < chats.length; i++) {
                try {
                    await this.persistChat(chats[i]);
                    importedCount++;
                } catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    errors.push(`Chat "${chats[i].title}": ${msg}`);
                    this.logError(`Failed to import chat: ${chats[i].title}`, error);
                }
            }

            this.logInfo(`Import complete: ${importedCount}/${chats.length} chats`);
            return { success: importedCount > 0, importedCount, errors };
        } catch (error) {
            this.logError('Import failed', error);
            return { success: false, importedCount: 0, errors: [error instanceof Error ? error.message : String(error)] };
        }
    }

    /** Routes parsing to the correct format handler. */
    private parseChats(raw: string, format: ImportFormat): ImportedChat[] {
        switch (format) {
            case 'chatgpt': return this.parseChatGPT(raw);
            case 'claude': return this.parseClaude(raw);
            case 'tengra-json': return this.parseTengraJson(raw);
            default: return [];
        }
    }

    /** Parses ChatGPT export JSON (array of conversations with mapping). */
    private parseChatGPT(raw: string): ImportedChat[] {
        const data = safeJsonParse<ChatGPTConversation[]>(raw, []);
        if (!Array.isArray(data)) {return [];}

        const results: ImportedChat[] = [];
        for (let i = 0; i < data.length; i++) {
            const conv = data[i];
            const messages = this.extractChatGPTMessages(conv.mapping);
            if (messages.length > 0) {
                results.push({
                    title: conv.title || `Imported Chat ${i + 1}`,
                    messages,
                    createdAt: conv.create_time ? new Date(conv.create_time * 1000) : new Date(),
                });
            }
        }
        return results;
    }

    /** Extracts messages from ChatGPT mapping structure. */
    private extractChatGPTMessages(
        mapping: Record<string, ChatGPTNode> | undefined
    ): ImportedMessage[] {
        if (!mapping) {return [];}
        const messages: ImportedMessage[] = [];

        const nodeIds = Object.keys(mapping);
        for (let i = 0; i < nodeIds.length; i++) {
            const node = mapping[nodeIds[i]];
            const msg = node.message;
            if (!msg?.content?.parts?.length || !msg.author?.role) {continue;}

            const role = this.mapRole(msg.author.role);
            if (!role) {continue;}

            messages.push({
                role,
                content: msg.content.parts.join('\n'),
                timestamp: msg.create_time ? new Date(msg.create_time * 1000) : new Date(),
            });
        }
        return messages;
    }

    /** Parses Claude export JSON (array of conversations). */
    private parseClaude(raw: string): ImportedChat[] {
        const data = safeJsonParse<ClaudeConversation[]>(raw, []);
        if (!Array.isArray(data)) {return [];}

        const results: ImportedChat[] = [];
        for (let i = 0; i < data.length; i++) {
            const conv = data[i];
            const chatMessages = conv.chat_messages;
            if (!Array.isArray(chatMessages) || chatMessages.length === 0) {continue;}

            const messages: ImportedMessage[] = [];
            for (let j = 0; j < chatMessages.length; j++) {
                const cm = chatMessages[j];
                const role = this.mapRole(cm.sender || '');
                if (!role || !cm.text) {continue;}
                messages.push({
                    role,
                    content: cm.text,
                    timestamp: cm.created_at ? new Date(cm.created_at) : new Date(),
                });
            }

            if (messages.length > 0) {
                results.push({
                    title: conv.name || `Imported Chat ${i + 1}`,
                    messages,
                    createdAt: conv.created_at ? new Date(conv.created_at) : new Date(),
                });
            }
        }
        return results;
    }

    /** Parses Tengra's own JSON export format. */
    private parseTengraJson(raw: string): ImportedChat[] {
        const data = safeJsonParse<{
            title?: string;
            createdAt?: string;
            messages?: Array<{ role?: string; content?: string; timestamp?: string }>;
        }>(raw, { messages: [] });

        const messages: ImportedMessage[] = [];
        const rawMessages = data.messages ?? [];
        for (let i = 0; i < rawMessages.length; i++) {
            const m = rawMessages[i];
            const role = this.mapRole(m.role || '');
            if (!role || !m.content) {continue;}
            messages.push({
                role,
                content: m.content,
                timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
            });
        }

        if (messages.length === 0) {return [];}
        return [{
            title: data.title || 'Imported Chat',
            messages,
            createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        }];
    }

    /** Maps external role names to local role values. */
    private mapRole(role: string): 'user' | 'assistant' | 'system' | null {
        const normalized = role.toLowerCase();
        if (normalized === 'user' || normalized === 'human') {return 'user';}
        if (normalized === 'assistant' || normalized === 'bot') {return 'assistant';}
        if (normalized === 'system') {return 'system';}
        return null;
    }

    /** Persists an imported chat and its messages to the database. */
    private async persistChat(chat: ImportedChat): Promise<void> {
        const chatId = crypto.randomUUID();
        const chatRecord: DbChat = {
            id: chatId,
            title: chat.title,
            model: 'imported',
            messages: [],
            createdAt: chat.createdAt,
            updatedAt: new Date(),
        };
        await this.databaseService.chats.createChat(chatRecord);

        for (let i = 0; i < chat.messages.length; i++) {
            const msg = chat.messages[i];
            const messageRecord: JsonObject = {
                id: crypto.randomUUID(),
                chatId,
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp.getTime(),
            };
            await this.databaseService.chats.addMessage(messageRecord);
        }
    }
}

