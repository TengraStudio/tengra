import { PromptTemplate } from '@main/utils/prompt-templates.util';
import { JsonObject } from '@shared/types/common';
import { DatabaseAdapter, SqlValue } from '@shared/types/database';
import { v4 as uuidv4 } from 'uuid';

import { AuditLogEntry, Folder, JobState, LinkedAccount, Prompt, TokenUsageRecord } from '../database.service';

import { BaseRepository } from './base.repository';

export class SystemRepository extends BaseRepository {
    constructor(adapter: DatabaseAdapter) {
        super(adapter);
    }

    // --- Folders ---
    async getFolders(): Promise<Folder[]> {
        const rows = await this.adapter.prepare('SELECT * FROM folders ORDER BY name').all<JsonObject>();
        return rows.map(row => ({
            id: String(row.id),
            name: String(row.name),
            color: row.color as string | undefined,
            createdAt: Number(row.created_at),
            updatedAt: Number(row.updated_at)
        }));
    }

    async createFolder(name: string, color?: string): Promise<Folder> {
        const id = uuidv4();
        const now = Date.now();
        await this.adapter.prepare('INSERT INTO folders (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, name, color ?? null, now, now);
        return { id, name, color, createdAt: now, updatedAt: now };
    }

    async updateFolder(id: string, updates: Partial<Folder>): Promise<void> {
        const fields: string[] = [];
        const params: (string | number | null)[] = [];
        if (updates.name !== undefined) { fields.push('name = ?'); params.push(updates.name); }
        if (updates.color !== undefined) { fields.push('color = ?'); params.push(updates.color); }
        if (fields.length > 0) {
            params.push(Date.now(), id);
            await this.adapter.prepare(`UPDATE folders SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`).run(...params);
        }
    }

    async deleteFolder(id: string): Promise<void> {
        await this.adapter.prepare('DELETE FROM folders WHERE id = ?').run(id);
    }

    // --- Prompts ---
    async getPrompts(): Promise<Prompt[]> {
        const rows = await this.adapter.prepare('SELECT * FROM prompts ORDER BY created_at DESC').all<JsonObject>();
        return rows.map(r => ({
            id: String(r.id),
            title: String(r.title),
            content: String(r.content),
            tags: this.parseJsonField(r.tags as string | null, [] as string[]),
            createdAt: Number(r.created_at),
            updatedAt: Number(r.updated_at)
        }));
    }

    async createPrompt(title: string, content: string, tags: string[] = []): Promise<Prompt> {
        const id = uuidv4();
        const now = Date.now();
        await this.adapter.prepare('INSERT INTO prompts (id, title, content, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, title, content, JSON.stringify(tags), now, now);
        return { id, title, content, tags, createdAt: now, updatedAt: now };
    }

    async updatePrompt(id: string, updates: Partial<Prompt>): Promise<void> {
        const fields: string[] = [];
        const params: (string | number | null)[] = [];
        if (updates.title !== undefined) { fields.push('title = ?'); params.push(updates.title); }
        if (updates.content !== undefined) { fields.push('content = ?'); params.push(updates.content); }
        if (updates.tags !== undefined) { fields.push('tags = ?'); params.push(JSON.stringify(updates.tags)); }
        if (fields.length > 0) {
            params.push(Date.now(), id);
            await this.adapter.prepare(`UPDATE prompts SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`).run(...params);
        }
    }

    async deletePrompt(id: string): Promise<void> {
        await this.adapter.prepare('DELETE FROM prompts WHERE id = ?').run(id);
    }



    // --- Stats ---
    async getStats() {
        const chatRow = await this.adapter.prepare('SELECT count(*) as count FROM chats').get<{ count: number }>();
        const messageRow = await this.adapter.prepare('SELECT count(*) as count FROM messages').get<{ count: number }>();
        return {
            chatCount: chatRow?.count ?? 0,
            messageCount: messageRow?.count ?? 0,
            dbSize: 0
        };
    }

    async getDetailedStats(period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'daily') {
        const now = Date.now();
        const since = period === 'daily' ? now - 86400000 : now - 2592000000;
        const result = await this.adapter.prepare('SELECT count(*) as count FROM messages WHERE timestamp >= ?').get<{ count: number }>(since);
        return { messageCount: result?.count ?? 0 };
    }

    async getTimeStats() {
        return { totalTime: 0, averageTime: 0 };
    }

    async getMigrationStatus() {
        return { version: 0, lastMigration: 0 };
    }

    async addTokenUsage(record: TokenUsageRecord): Promise<void> {
        const id = uuidv4();
        const timestamp = record.timestamp ?? Date.now();
        await this.adapter.prepare(`
            INSERT INTO token_usage(id, chat_id, project_path, message_id, provider, model, tokens_sent, tokens_received, cost_estimate, timestamp)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, record.chatId, record.projectId ?? null, record.messageId ?? null, record.provider, record.model, record.tokensSent, record.tokensReceived, record.costEstimate ?? 0, timestamp);
    }

    async getTokenUsageStats(_period: 'daily' | 'weekly' | 'monthly'): Promise<{ totalTokens: number }> {
        const rows = await this.adapter.prepare('SELECT sum(tokens_sent + tokens_received) as total FROM token_usage').all<{ total: number }>();
        return { totalTokens: rows[0]?.total ?? 0 };
    }

    // --- Usage Tracking ---
    async addUsageRecord(record: { provider: string; model: string; timestamp: number }) {
        await this.adapter.prepare('INSERT INTO usage_tracking (id, timestamp, provider, model) VALUES (?, ?, ?, ?)').run(uuidv4(), record.timestamp, record.provider, record.model);
        return { success: true };
    }

    async getUsageCount(since: number, provider?: string, model?: string): Promise<number> {
        let sql = 'SELECT count(*) as count FROM usage_tracking WHERE timestamp >= ?';
        const params: SqlValue[] = [since];
        if (provider) { sql += ' AND provider = ?'; params.push(provider); }
        if (model) { sql += ' AND model = ?'; params.push(model); }
        const result = await this.adapter.prepare(sql).get<{ count: number }>(...params);
        return result?.count ?? 0;
    }

    async cleanupUsageRecords(before: number): Promise<void> {
        await this.adapter.prepare('DELETE FROM usage_tracking WHERE timestamp < ?').run(before);
    }

    // --- Prompt Templates ---
    async getCustomTemplates(): Promise<PromptTemplate[]> {
        const rows = await this.adapter.prepare('SELECT * FROM prompt_templates').all<JsonObject>();
        return rows.map(row => ({
            id: String(row.id),
            name: String(row.name),
            description: String(row.description ?? ''),
            template: String(row.template),
            variables: this.parseJsonField(row.variables as string | null, []),
            category: String(row.category ?? ''),
            tags: this.parseJsonField(row.tags as string | null, undefined),
            createdAt: Number(row.created_at),
            updatedAt: Number(row.updated_at)
        }));
    }

    async addCustomTemplate(template: PromptTemplate): Promise<void> {
        await this.adapter.prepare('INSERT INTO prompt_templates(id, name, description, template, variables, category, tags, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(template.id, template.name, template.description, template.template, JSON.stringify(template.variables), template.category, template.tags ? JSON.stringify(template.tags) : null, template.createdAt, template.updatedAt);
    }

    async updateCustomTemplate(id: string, template: Partial<PromptTemplate>): Promise<void> {
        const updates: string[] = [];
        const params: (string | number | null)[] = [];
        if (template.name !== undefined) { updates.push('name = ?'); params.push(template.name); }
        if (template.description !== undefined) { updates.push('description = ?'); params.push(template.description); }
        if (template.template !== undefined) { updates.push('template = ?'); params.push(template.template); }
        if (template.variables !== undefined) { updates.push('variables = ?'); params.push(JSON.stringify(template.variables)); }
        if (template.category !== undefined) { updates.push('category = ?'); params.push(template.category); }
        if (template.tags !== undefined) { updates.push('tags = ?'); params.push(JSON.stringify(template.tags)); }
        params.push(Date.now(), id);
        await this.adapter.prepare(`UPDATE prompt_templates SET ${updates.join(', ')}, updated_at = ? WHERE id = ?`).run(...params);
    }

    async deleteCustomTemplate(id: string): Promise<void> {
        await this.adapter.prepare('DELETE FROM prompt_templates WHERE id = ?').run(id);
    }

    // --- Linked Accounts ---
    async getLinkedAccounts(provider?: string): Promise<LinkedAccount[]> {
        let sql = 'SELECT * FROM linked_accounts';
        const params: SqlValue[] = [];
        if (provider) {
            sql += ' WHERE provider = ?';
            params.push(provider);
        }
        const rows = await this.adapter.prepare(sql).all<JsonObject>(...params);
        return rows.map(row => ({
            id: String(row.id),
            provider: String(row.provider),
            email: row.email as string | undefined,
            displayName: row.display_name as string | undefined,
            avatarUrl: row.avatar_url as string | undefined,
            isActive: Boolean(row.is_active),
            createdAt: Number(row.created_at),
            updatedAt: Number(row.updated_at),
            accessToken: row.access_token as string | undefined,
            refreshToken: row.refresh_token as string | undefined,
            sessionToken: row.session_token as string | undefined,
            scope: row.scope as string | undefined,
            expiresAt: row.expires_at ? Number(row.expires_at) : undefined,
            metadata: this.parseJsonField(row.metadata as string | null, {})
        }));
    }

    async getLinkedAccount(id: string): Promise<LinkedAccount | null> {
        const row = await this.adapter.prepare('SELECT * FROM linked_accounts WHERE id = ?').get<JsonObject>(id);
        if (!row) { return null; }
        return {
            id: String(row.id),
            provider: String(row.provider),
            email: row.email as string | undefined,
            displayName: row.display_name as string | undefined,
            isActive: Boolean(row.is_active),
            createdAt: Number(row.created_at),
            updatedAt: Number(row.updated_at)
        };
    }

    async saveLinkedAccount(account: LinkedAccount): Promise<void> {
        await this.adapter.prepare(`
            INSERT INTO linked_accounts (
                id, provider, email, display_name, avatar_url, 
                access_token, refresh_token, session_token, 
                expires_at, scope, is_active, metadata, 
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET 
                email = EXCLUDED.email, 
                display_name = EXCLUDED.display_name, 
                avatar_url = EXCLUDED.avatar_url,
                access_token = EXCLUDED.access_token,
                refresh_token = EXCLUDED.refresh_token,
                session_token = EXCLUDED.session_token,
                expires_at = EXCLUDED.expires_at,
                scope = EXCLUDED.scope,
                is_active = EXCLUDED.is_active, 
                metadata = EXCLUDED.metadata,
                updated_at = EXCLUDED.updated_at
        `).run(
            account.id,
            account.provider,
            account.email ?? null,
            account.displayName ?? null,
            account.avatarUrl ?? null,
            account.accessToken ?? null,
            account.refreshToken ?? null,
            account.sessionToken ?? null,
            account.expiresAt ?? null,
            account.scope ?? null,
            account.isActive, // Pass boolean directly for PGlite
            account.metadata ? JSON.stringify(account.metadata) : null,
            account.createdAt,
            account.updatedAt
        );
    }

    async deleteLinkedAccount(id: string): Promise<void> {
        await this.adapter.prepare('DELETE FROM linked_accounts WHERE id = ?').run(id);
    }

    // --- Audit Logs ---
    async addAuditLog(entry: AuditLogEntry): Promise<void> {
        await this.adapter.prepare('INSERT INTO audit_logs(id, timestamp, action, category, user_id, details, success) VALUES(?, ?, ?, ?, ?, ?, ?)')
            .run(uuidv4(), entry.timestamp, entry.action, entry.category, entry.userId ?? null, entry.details ? JSON.stringify(entry.details) : null, entry.success ? 1 : 0);
    }

    async getAuditLogs(options: { category?: string; startDate?: number; endDate?: number; limit?: number } = {}): Promise<AuditLogEntry[]> {
        let sql = 'SELECT * FROM audit_logs WHERE 1=1';
        const params: (string | number | null)[] = [];
        if (options.category) { sql += ' AND category = ?'; params.push(options.category); }
        if (options.startDate) { sql += ' AND timestamp >= ?'; params.push(options.startDate); }
        if (options.endDate) { sql += ' AND timestamp <= ?'; params.push(options.endDate); }
        sql += ' ORDER BY timestamp DESC';
        if (options.limit) { sql += ' LIMIT ?'; params.push(options.limit); }
        const rows = await this.adapter.prepare(sql).all<JsonObject>(...params);
        return rows.map(row => ({
            timestamp: Number(row.timestamp),
            action: String(row.action),
            category: String(row.category) as AuditLogEntry['category'],
            userId: row.user_id as string | undefined,
            details: this.parseJsonField(row.details as string | null, undefined),
            success: Boolean(row.success)
        }));
    }

    async clearAuditLogs(): Promise<void> {
        await this.adapter.prepare('DELETE FROM audit_logs').run();
    }

    // --- Job States ---
    async getJobState(id: string) {
        const row = await this.adapter.prepare('SELECT last_run FROM scheduler_state WHERE id = ?').get<JsonObject>(id);
        return row ? { lastRun: Number(row.last_run) } : null;
    }

    async getAllJobStates() {
        const rows = await this.adapter.prepare('SELECT id, last_run FROM scheduler_state').all<JsonObject>();
        const res: Record<string, JobState> = {};
        for (const r of rows) { res[String(r.id)] = { lastRun: Number(r.last_run) }; }
        return res;
    }

    async saveJobState(id: string, state: JobState) {
        await this.adapter.prepare('INSERT INTO scheduler_state (id, last_run) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET last_run = EXCLUDED.last_run').run(id, state.lastRun);
    }

    async deleteJobState(id: string) {
        await this.adapter.prepare('DELETE FROM scheduler_state WHERE id = ?').run(id);
    }
}
