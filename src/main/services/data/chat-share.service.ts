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
 * Chat Share Service
 * Generate shareable JSON exports of conversations with deep link support.
 */

import * as fsp from 'fs/promises';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import { DatabaseService } from '@main/services/data/database.service';
import { JsonObject } from '@shared/types/common';
import { v4 as uuidv4 } from 'uuid';

/** Metadata for a shared chat link. */
export interface ChatShareEntry {
    id: string;
    chatId: string;
    title: string;
    createdAt: number;
    messageCount: number;
}

/** Full share payload including conversation data. */
export interface ChatSharePayload {
    id: string;
    chatId: string;
    title: string;
    messages: JsonObject[];
    createdAt: number;
    exportedAt: number;
}

/** Registry row from the share_registry file. */
interface ShareRegistryData {
    entries: ChatShareEntry[];
}

const SHARE_REGISTRY_FILE = 'share-registry.json';
const SHARES_DIR = 'shares';
const TENGRA_PROTOCOL = 'tengra';

export class ChatShareService extends BaseService {
    static readonly serviceName = 'chatShareService';
    static readonly dependencies = ['db', 'dataService'] as const;
    private registryPath: string = '';
    private sharesDir: string = '';

    constructor(
        private readonly db: DatabaseService,
        private readonly dataService: DataService
    ) {
        super('ChatShareService');
    }

    /** Initialize the service and ensure directories exist. */
    async initialize(): Promise<void> {
        this.logInfo('Initializing chat share service...');
        const basePath = this.dataService.getPath('config');
        this.registryPath = path.join(basePath, SHARE_REGISTRY_FILE);
        this.sharesDir = path.join(basePath, SHARES_DIR);
        await this.ensureDirectories();
    }

    /** Ensure required directories and registry file exist. */
    private async ensureDirectories(): Promise<void> {
        await fsp.mkdir(this.sharesDir, { recursive: true });
        try {
            await fsp.access(this.registryPath);
        } catch {
            await this.writeRegistry({ entries: [] });
        }
    }

    /** Create a shareable export from a chat conversation. */
    async createShare(chatId: string): Promise<ChatShareEntry> {
        const chatResult = await this.db.query<JsonObject>(
            'SELECT * FROM chats WHERE id = $1', [chatId]
        );
        if (chatResult.rows.length === 0) {
            throw new Error(`Chat not found: ${chatId}`);
        }
        const chat = chatResult.rows[0];
        const messagesResult = await this.db.query<JsonObject>(
            'SELECT * FROM messages WHERE chat_id = $1 ORDER BY timestamp ASC', [chatId]
        );

        const shareId = uuidv4();
        const now = Date.now();
        const title = (chat.title as string) ?? 'Untitled Chat';
        const payload: ChatSharePayload = {
            id: shareId,
            chatId,
            title,
            messages: messagesResult.rows,
            createdAt: now,
            exportedAt: now,
        };

        const sharePath = path.join(this.sharesDir, `${shareId}.json`);
        await fsp.writeFile(sharePath, JSON.stringify(payload, null, 2), 'utf-8');

        const entry: ChatShareEntry = {
            id: shareId,
            chatId,
            title,
            createdAt: now,
            messageCount: messagesResult.rows.length,
        };

        const registry = await this.readRegistry();
        registry.entries.push(entry);
        await this.writeRegistry(registry);

        this.logInfo(`Created share ${shareId} for chat ${chatId}`);
        return entry;
    }

    /** Get a share payload by share ID. */
    async getShare(shareId: string): Promise<ChatSharePayload | undefined> {
        const sharePath = path.join(this.sharesDir, `${shareId}.json`);
        try {
            await fsp.access(sharePath);
        } catch {
            return undefined;
        }
        try {
            const content = await fsp.readFile(sharePath, 'utf-8');
            return JSON.parse(content) as ChatSharePayload;
        } catch (error) {
            appLogger.error('ChatShareService', `Failed to read share ${shareId}`, error as Error);
            return undefined;
        }
    }

    /** Delete a share by its ID. */
    async deleteShare(shareId: string): Promise<boolean> {
        const sharePath = path.join(this.sharesDir, `${shareId}.json`);
        try {
            await fsp.access(sharePath);
            await fsp.unlink(sharePath);
        } catch {
            // File doesn't exist, continue with registry cleanup
        }
        const registry = await this.readRegistry();
        const initialLength = registry.entries.length;
        registry.entries = registry.entries.filter((e) => e.id !== shareId);
        await this.writeRegistry(registry);
        const deleted = registry.entries.length < initialLength;
        if (deleted) {this.logInfo(`Deleted share: ${shareId}`);}
        return deleted;
    }

    /** List all share entries. */
    async listShares(): Promise<ChatShareEntry[]> {
        return (await this.readRegistry()).entries;
    }

    /** Generate a deep link URL for a share. */
    generateDeepLink(shareId: string): string {
        return `${TENGRA_PROTOCOL}://share/${shareId}`;
    }

    /** Parse a share ID from a deep link URL. */
    static parseDeepLink(url: string): string | undefined {
        const prefix = `${TENGRA_PROTOCOL}://share/`;
        if (url.startsWith(prefix)) {
            return url.slice(prefix.length);
        }
        return undefined;
    }

    /** Read the share registry from disk. */
    private async readRegistry(): Promise<ShareRegistryData> {
        try {
            const content = await fsp.readFile(this.registryPath, 'utf-8');
            return JSON.parse(content) as ShareRegistryData;
        } catch {
            return { entries: [] };
        }
    }

    /** Write the share registry to disk. */
    private async writeRegistry(data: ShareRegistryData): Promise<void> {
        await fsp.writeFile(this.registryPath, JSON.stringify(data, null, 2), 'utf-8');
    }

    async cleanup(): Promise<void> {
        this.logInfo('Cleaning up chat share service');
    }
}

