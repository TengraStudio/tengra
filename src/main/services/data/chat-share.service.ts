/**
 * Chat Share Service
 * Generate shareable JSON exports of conversations with deep link support.
 */

import * as fs from 'fs';
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
        this.ensureDirectories();
    }

    /** Ensure required directories and registry file exist. */
    private ensureDirectories(): void {
        if (!fs.existsSync(this.sharesDir)) {
            fs.mkdirSync(this.sharesDir, { recursive: true });
        }
        if (!fs.existsSync(this.registryPath)) {
            this.writeRegistry({ entries: [] });
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
        fs.writeFileSync(sharePath, JSON.stringify(payload, null, 2), 'utf-8');

        const entry: ChatShareEntry = {
            id: shareId,
            chatId,
            title,
            createdAt: now,
            messageCount: messagesResult.rows.length,
        };

        const registry = this.readRegistry();
        registry.entries.push(entry);
        this.writeRegistry(registry);

        this.logInfo(`Created share ${shareId} for chat ${chatId}`);
        return entry;
    }

    /** Get a share payload by share ID. */
    getShare(shareId: string): ChatSharePayload | undefined {
        const sharePath = path.join(this.sharesDir, `${shareId}.json`);
        if (!fs.existsSync(sharePath)) {return undefined;}
        try {
            const content = fs.readFileSync(sharePath, 'utf-8');
            return JSON.parse(content) as ChatSharePayload;
        } catch (error) {
            appLogger.error('ChatShareService', `Failed to read share ${shareId}`, error as Error);
            return undefined;
        }
    }

    /** Delete a share by its ID. */
    deleteShare(shareId: string): boolean {
        const sharePath = path.join(this.sharesDir, `${shareId}.json`);
        if (fs.existsSync(sharePath)) {
            fs.unlinkSync(sharePath);
        }
        const registry = this.readRegistry();
        const initialLength = registry.entries.length;
        registry.entries = registry.entries.filter((e) => e.id !== shareId);
        this.writeRegistry(registry);
        const deleted = registry.entries.length < initialLength;
        if (deleted) {this.logInfo(`Deleted share: ${shareId}`);}
        return deleted;
    }

    /** List all share entries. */
    listShares(): ChatShareEntry[] {
        return this.readRegistry().entries;
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
    private readRegistry(): ShareRegistryData {
        try {
            const content = fs.readFileSync(this.registryPath, 'utf-8');
            return JSON.parse(content) as ShareRegistryData;
        } catch {
            return { entries: [] };
        }
    }

    /** Write the share registry to disk. */
    private writeRegistry(data: ShareRegistryData): void {
        fs.writeFileSync(this.registryPath, JSON.stringify(data, null, 2), 'utf-8');
    }

    async cleanup(): Promise<void> {
        this.logInfo('Cleaning up chat share service');
    }
}
