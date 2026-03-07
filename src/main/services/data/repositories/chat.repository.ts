import { appLogger } from '@main/logging/logger';
import { JsonObject } from '@shared/types/common';
import { DatabaseAdapter, SqlValue } from '@shared/types/database';
import { getErrorMessage } from '@shared/utils/error.util';
import { v4 as uuidv4 } from 'uuid';

import { Chat, SearchChatsOptions } from '../database.service';

import { BaseRepository } from './base.repository';

export class ChatRepository extends BaseRepository {
    constructor(adapter: DatabaseAdapter) {
        super(adapter);
    }

    async createChat(chat: Chat): Promise<{ success: boolean; id: string; error?: string }> {
        try {
            const chatId = chat.id || uuidv4();
            const now = Date.now();
            const chatData = this.prepareChatInsertData(chat, chatId, now);
            await this.adapter.prepare(`
                INSERT INTO chats(
                    id, title, is_Generating, backend, model,
                    folder_id, project_id, is_pinned, is_favorite,
                    metadata, created_at, updated_at
                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(...chatData);
            return { success: true, id: chatId };
        } catch (error) {
            appLogger.error('ChatRepository', 'Failed to create chat:', error as Error);
            return { success: false, id: '', error: getErrorMessage(error) };
        }
    }

    private prepareChatInsertData(chat: Partial<Chat>, id: string, now: number): SqlValue[] {
        return [
            id,
            chat.title ?? 'New Chat',
            chat.isGenerating ? 1 : 0,
            chat.backend ?? null,
            chat.model ?? null,
            chat.folderId ?? null,
            chat.workspaceId ?? null,
            chat.isPinned ? 1 : 0,
            chat.isFavorite ? 1 : 0,
            JSON.stringify(chat.metadata ?? {}),
            now,
            now
        ];
    }

    async getAllChats(): Promise<Chat[]> {
        const rows = await this.selectAllPaginated<JsonObject>('SELECT * FROM chats ORDER BY updated_at DESC');
        return rows.map(row => this.mapRowToChat(row));
    }

    async getChat(id: string): Promise<Chat | undefined> {
        const row = await this.adapter.prepare('SELECT * FROM chats WHERE id = ?').get<JsonObject>(id);
        if (!row) { return undefined; }
        return this.mapRowToChat(row);
    }

    async getChats(workspaceId?: string): Promise<Chat[]> {
        let sql = 'SELECT * FROM chats';
        const params: SqlValue[] = [];

        if (workspaceId) {
            sql += ' WHERE project_id = ?';
            params.push(workspaceId);
        }

        sql += ' ORDER BY updated_at DESC';
        const rows = await this.selectAllPaginated<JsonObject>(sql, params);
        return rows.map(row => this.mapRowToChat(row));
    }

    async updateChat(id: string, updates: Partial<Chat>) {
        try {
            const fields: string[] = [];
            const values: unknown[] = [];

            this.collectChatUpdates(updates, fields, values);

            if (fields.length > 0) {
                values.push(id);
                await this.adapter.prepare(`UPDATE chats SET ${fields.join(', ')} WHERE id = ? `).run(...(values as SqlValue[]));
            }
            return { success: true };
        } catch (error) {
            appLogger.error('ChatRepository', `Failed to update chat: ${getErrorMessage(error)} `);
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    private collectChatUpdates(updates: Partial<Chat>, fields: string[], values: unknown[]) {
        this.addFieldUpdating(fields, values, 'title', updates.title);
        this.addFieldUpdating(fields, values, 'backend', updates.backend);
        this.addFieldUpdating(fields, values, 'model', updates.model);
        this.addFieldUpdating(fields, values, 'folder_id', updates.folderId);
        this.addFieldUpdating(fields, values, 'project_id', updates.workspaceId);

        if (updates.isGenerating !== undefined) {
            fields.push('is_Generating = ?');
            values.push(updates.isGenerating ? 1 : 0);
        }
        if (updates.isPinned !== undefined) {
            fields.push('is_pinned = ?');
            values.push(updates.isPinned ? 1 : 0);
        }
        if (updates.isFavorite !== undefined) {
            fields.push('is_favorite = ?');
            values.push(updates.isFavorite ? 1 : 0);
        }
        if (updates.metadata !== undefined) {
            fields.push('metadata = ?');
            values.push(JSON.stringify(updates.metadata));
        }

        fields.push('updated_at = ?');
        values.push(Date.now());
    }

    private addFieldUpdating(fields: string[], values: unknown[], fieldName: string, value: unknown) {
        if (value !== undefined) {
            fields.push(`${fieldName} = ?`);
            values.push(value);
        }
    }

    async deleteChat(id: string) {
        try {
            await this.adapter.transaction(async (tx) => {
                await tx.prepare('DELETE FROM messages WHERE chat_id = ?').run(id);
                await tx.prepare('DELETE FROM chats WHERE id = ?').run(id);
            });
            return { success: true };
        } catch (error) {
            appLogger.error('ChatRepository', `Failed to delete chat: ${getErrorMessage(error)} `);
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async addMessage(msg: JsonObject) {
        try {
            const msgId = (msg.id as string | undefined) ?? uuidv4();
            const vec = Array.isArray(msg.vector) && msg.vector.length > 0 ? `[${msg.vector.join(',')}]` : null;

            await this.adapter.prepare(`
                INSERT INTO messages(id, chat_id, role, content, timestamp, provider, model, metadata, vector)
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                msgId, msg.chatId as string, msg.role as string, msg.content as string, (msg.timestamp as number | undefined) ?? Date.now(),
                (msg.provider as string | undefined) ?? null, (msg.model as string | undefined) ?? null, JSON.stringify(msg.metadata ?? {}), vec
            );

            await this.adapter.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(Date.now(), msg.chatId as string);
            return { success: true, id: msgId };
        } catch (error) {
            appLogger.error('ChatRepository', `Failed to add message: ${getErrorMessage(error)} `);
            throw error;
        }
    }

    async getMessages(chatId: string) {
        const rows = await this.selectAllPaginated<JsonObject>(
            'SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC',
            [chatId]
        );
        return rows.map((row) => ({
            id: String(row.id),
            chatId: String(row.chat_id),
            role: String(row.role),
            content: String(row.content),
            timestamp: Number(row.timestamp),
            provider: row.provider as string | undefined,
            model: row.model as string | undefined,
            metadata: this.parseJsonField(row.metadata as string | null, {})
        }));
    }

    async getAllMessages() {
        const rows = await this.selectAllPaginated<JsonObject>('SELECT * FROM messages ORDER BY timestamp ASC');
        return rows.map((row) => ({
            id: String(row.id),
            chatId: String(row.chat_id),
            role: String(row.role),
            content: String(row.content),
            timestamp: Number(row.timestamp),
            provider: row.provider as string | undefined,
            model: row.model as string | undefined,
            metadata: this.parseJsonField(row.metadata as string | null, {})
        }));
    }

    async searchChats(options: SearchChatsOptions): Promise<Chat[]> {
        const conditions: string[] = [];
        const params: SqlValue[] = [];

        this.buildSearchConditions(options, conditions, params);

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const limitClause = options.limit ? `LIMIT ?` : '';
        const sql = `SELECT c.* FROM chats c ${whereClause} ORDER BY c.updated_at DESC ${limitClause}`;
        
        if (options.limit) {
            params.push(options.limit);
        }

        const rows = await this.adapter.prepare(sql).all<JsonObject>(...params);
        return rows.map(row => this.mapRowToChat(row));
    }

    private buildSearchConditions(options: SearchChatsOptions, conditions: string[], params: SqlValue[]) {
        if (options.query) {
            // Sanitize LIKE pattern to prevent wildcard injection
            const sanitizedQuery = options.query.replace(/[%_]/g, '\\$&');
            // PERF-003-5: Optimize EXISTS subquery with indexed join
            conditions.push('(c.title LIKE ? ESCAPE \'\\\' OR c.id IN (SELECT m.chat_id FROM messages m WHERE m.content LIKE ? ESCAPE \'\\\'))');
            params.push(`%${sanitizedQuery}%`, `%${sanitizedQuery}%`);
        }
        if (options.folderId) {
            conditions.push('c.folder_id = ?');
            params.push(options.folderId);
        }
        if (options.isPinned !== undefined) {
            conditions.push('c.is_pinned = ?');
            params.push(options.isPinned ? 1 : 0);
        }
        if (options.isFavorite !== undefined) {
            conditions.push('c.is_favorite = ?');
            params.push(options.isFavorite ? 1 : 0);
        }
        if (options.isArchived !== undefined) {
            conditions.push('COALESCE(json_extract(c.metadata, \'$.isArchived\'), 0) = ?');
            params.push(options.isArchived ? 1 : 0);
        }

        if (options.startDate) {
            conditions.push('c.created_at >= ?');
            params.push(options.startDate);
        }
        if (options.endDate) {
            conditions.push('c.created_at <= ?');
            params.push(options.endDate);
        }
    }

    private mapRowToChat(row: JsonObject): Chat {
        return {
            id: String(row.id),
            title: String(row.title),
            model: row.model as string | undefined,
            backend: row.backend as string | undefined,
            messages: [],
            createdAt: new Date(Number(row.created_at)),
            updatedAt: new Date(Number(row.updated_at)),
            isPinned: Boolean(row.is_pinned),
            isFavorite: Boolean(row.is_favorite),
            folderId: row.folder_id as string | undefined,
            workspaceId: row.project_id as string | undefined,
            isGenerating: Boolean(row.is_Generating),
            metadata: this.parseJsonField(row.metadata as string, {})
        };
    }

    async updateMessage(id: string, updates: JsonObject): Promise<{ success: boolean; error?: string }> {
        try {
            const row = await this.adapter.prepare('SELECT metadata FROM messages WHERE id = ?').get<JsonObject>(id);
            if (!row) { return { success: false }; }

            const currentMetadata = this.parseJsonField<JsonObject>(row.metadata as string | null, {});
            const newMetadata: JsonObject = { ...currentMetadata };

            if ('isBookmarked' in updates) { newMetadata.isBookmarked = updates.isBookmarked as boolean; }
            if ('isPinned' in updates) { newMetadata.isPinned = updates.isPinned as boolean; }
            if ('rating' in updates) { newMetadata.rating = updates.rating as number; }
            if ('reactions' in updates) { newMetadata.reactions = updates.reactions as string[]; }

            const fields: string[] = ['metadata = ?'];
            const values: SqlValue[] = [JSON.stringify(newMetadata)];

            if ('content' in updates) {
                fields.push('content = ?');
                values.push(updates.content as string);
            }

            values.push(id);
            await this.adapter.prepare(`UPDATE messages SET ${fields.join(', ')} WHERE id = ? `).run(...values);
            return { success: true };
        } catch (error) {
            appLogger.error('ChatRepository', `Failed to update message: ${getErrorMessage(error)} `);
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async getBookmarkedMessages(): Promise<Array<{ id: string; chatId: string; content: string; timestamp: number; chatTitle?: string | undefined }>> {
        const rows = await this.selectAllPaginated<JsonObject>(`
            SELECT m.id, m.chat_id, m.content, m.timestamp, m.metadata, c.title as chat_title
            FROM messages m
            LEFT JOIN chats c ON m.chat_id = c.id
            WHERE json_extract(m.metadata, '$.isBookmarked') = 'true'
            ORDER BY m.timestamp DESC
        `);

        return rows.map(r => ({
            id: String(r.id),
            chatId: String(r.chat_id),
            content: String(r.content),
            timestamp: Number(r.timestamp),
            ...(r.chat_title ? { chatTitle: String(r.chat_title) } : {})
        }));
    }
    async deleteMessage(id: string): Promise<{ success: boolean; error?: string }> {
        try {
            await this.adapter.prepare('DELETE FROM messages WHERE id = ?').run(id);
            return { success: true };
        } catch (error) {
            appLogger.error('ChatRepository', `Failed to delete message: ${getErrorMessage(error as Error)}`);
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async deleteMessagesByChatId(chatId: string): Promise<{ success: boolean; error?: string }> {
        try {
            await this.adapter.prepare('DELETE FROM messages WHERE chat_id = ?').run(chatId);
            return { success: true };
        } catch (error) {
            appLogger.error('ChatRepository', `Failed to delete messages by chat id: ${getErrorMessage(error as Error)}`);
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async deleteAllChats(): Promise<{ success: boolean; error?: string }> {
        try {
            await this.adapter.transaction(async (tx) => {
                await tx.prepare('DELETE FROM messages').run();
                await tx.prepare('DELETE FROM chats').run();
            });
            return { success: true };
        } catch (error) {
            appLogger.error('ChatRepository', `Failed to delete all chats: ${getErrorMessage(error)}`);
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async deleteChatsByTitle(title: string): Promise<{ success: boolean; error?: string }> {
        try {
            const rows = await this.adapter.prepare('SELECT id FROM chats WHERE title = ?').all<{ id: string }>(title);
            const ids = rows.map(r => r.id);
            if (ids.length > 0) {
                await this.adapter.transaction(async (tx) => {
                    const placeholders = ids.map(() => '?').join(',');
                    await tx.prepare(`DELETE FROM messages WHERE chat_id IN (${placeholders})`).run(...ids);
                    await tx.prepare(`DELETE FROM chats WHERE id IN (${placeholders})`).run(...ids);
                });
            }
            return { success: true };
        } catch (error) {
            appLogger.error('ChatRepository', `Failed to delete chats by title: ${getErrorMessage(error)}`);
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }
}
