import { appLogger } from '@main/logging/logger';
import { PromptTemplate } from '@main/utils/prompt-templates.util';
import { WORKSPACE_COMPAT_INDEX_VALUES, WORKSPACE_COMPAT_SCHEMA_VALUES } from '@shared/constants';
import { JsonObject } from '@shared/types/common';
import { DatabaseAdapter, SqlValue } from '@shared/types/database';
import { DbDetailedStats, DbStats, DbTokenStats } from '@shared/types/db-api';
import { AgentProfile, AgentTemplate } from '@shared/types/workspace-agent';
import { v4 as uuidv4 } from 'uuid';

import { AuditLogEntry, Folder, JobState, LinkedAccount, Prompt, TokenUsageRecord } from '../database.service';

import { BaseRepository } from './base.repository';

const LEGACY_CHAT_WORKSPACE_INDEX = WORKSPACE_COMPAT_INDEX_VALUES.CHATS_BY_SINGULAR_ID;
const LEGACY_TOKEN_USAGE_WORKSPACE_TIME_INDEX = WORKSPACE_COMPAT_INDEX_VALUES.TOKEN_USAGE_BY_SINGULAR_TIME;
const WORKSPACE_COMPAT_ID_COLUMN = WORKSPACE_COMPAT_SCHEMA_VALUES.ID_COLUMN;
const WORKSPACE_COMPAT_PATH_COLUMN = WORKSPACE_COMPAT_SCHEMA_VALUES.PATH_COLUMN;

export class SystemRepository extends BaseRepository {
    constructor(adapter: DatabaseAdapter) {
        super(adapter);
    }

    async ensureProductionIndexes(): Promise<void> {
        const indexStatements = [
            // Chat and message hot paths
            'CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC)',
            `CREATE INDEX IF NOT EXISTS ${LEGACY_CHAT_WORKSPACE_INDEX} ON chats(${WORKSPACE_COMPAT_ID_COLUMN})`,
            'CREATE INDEX IF NOT EXISTS idx_chats_folder_id ON chats(folder_id)',
            'CREATE INDEX IF NOT EXISTS idx_messages_chat_time ON messages(chat_id, timestamp ASC)',
            'CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC)',

            // Stats and usage hot paths
            'CREATE INDEX IF NOT EXISTS idx_token_usage_timestamp ON token_usage(timestamp DESC)',
            'CREATE INDEX IF NOT EXISTS idx_token_usage_provider_model_time ON token_usage(provider, model, timestamp DESC)',
            `CREATE INDEX IF NOT EXISTS ${LEGACY_TOKEN_USAGE_WORKSPACE_TIME_INDEX} ON token_usage(${WORKSPACE_COMPAT_PATH_COLUMN}, timestamp DESC)`,
            'CREATE INDEX IF NOT EXISTS idx_usage_tracking_timestamp ON usage_tracking(timestamp DESC)',
            'CREATE INDEX IF NOT EXISTS idx_usage_tracking_provider_model ON usage_tracking(provider, model)',

            // Operational dashboards
            'CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC)',
            'CREATE INDEX IF NOT EXISTS idx_audit_logs_category_timestamp ON audit_logs(category, timestamp DESC)',
            'CREATE INDEX IF NOT EXISTS idx_linked_accounts_provider_active ON linked_accounts(provider, is_active)',
            'CREATE INDEX IF NOT EXISTS idx_prompts_created_at ON prompts(created_at DESC)'
        ];

        for (const statement of indexStatements) {
            try {
                await this.adapter.exec(statement);
            } catch (error) {
                appLogger.warn('SystemRepository', `Skipping index statement due to runtime DB constraints: ${statement} (${String(error)})`);
            }
        }
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

    async getFolder(id: string): Promise<Folder | undefined> {
        const row = await this.adapter.prepare('SELECT * FROM folders WHERE id = ?').get<JsonObject>(id);
        if (!row) { return undefined; }
        return {
            id: String(row.id),
            name: String(row.name),
            color: row.color as string | undefined,
            createdAt: Number(row.created_at),
            updatedAt: Number(row.updated_at)
        };
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

    async getPrompt(id: string): Promise<Prompt | undefined> {
        const row = await this.adapter.prepare('SELECT * FROM prompts WHERE id = ?').get<JsonObject>(id);
        if (!row) { return undefined; }
        return {
            id: String(row.id),
            title: String(row.title),
            content: String(row.content),
            tags: this.parseJsonField(row.tags as string | null, [] as string[]),
            createdAt: Number(row.created_at),
            updatedAt: Number(row.updated_at)
        };
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
    async getStats(): Promise<DbStats> {
        const chatRow = await this.adapter.prepare('SELECT count(*) as count FROM chats').get<{ count: number }>();
        const messageRow = await this.adapter.prepare('SELECT count(*) as count FROM messages').get<{ count: number }>();
        return {
            chatCount: chatRow?.count ?? 0,
            messageCount: messageRow?.count ?? 0,
            dbSize: 0
        };
    }

    async getDetailedStats(period: string): Promise<DbDetailedStats> {
        const since = this.getStartTime(period);
        const chatCount = await this.getChatCount();
        const messageCount = await this.getMessageCount();

        const tokenStats = await this.adapter.prepare(`
            SELECT
                SUM(tokens_sent) as sent,
                SUM(tokens_received) as received,
                SUM(tokens_sent + tokens_received) as total
            FROM token_usage
            WHERE timestamp >= ?
        `).get<{ sent: number; received: number; total: number }>(since);

        // Fetch token timeline data grouped by time bucket
        const tokenTimeline = await this.getTokenTimeline(period, since);

        // Fetch activity data (message counts per hour for daily, per day for others)
        const activity = await this.getActivityData(period, since);

        return {
            chatCount,
            messageCount,
            dbSize: 0,
            totalTokens: tokenStats?.total ?? 0,
            promptTokens: tokenStats?.sent ?? 0,
            completionTokens: tokenStats?.received ?? 0,
            tokenTimeline,
            activity
        };
    }

    private async getTokenTimeline(period: string, since: number): Promise<Array<{
        timestamp: number;
        promptTokens: number;
        completionTokens: number;
        modelBreakdown?: Record<string, { prompt: number; completion: number }>;
    }>> {
        const { bucketMs, bucketCount } = this.getBucketConfig(period);

        const rows = await this.adapter.prepare(`
            SELECT timestamp, tokens_sent, tokens_received, model
            FROM token_usage
            WHERE timestamp >= ?
            ORDER BY timestamp ASC
        `).all<{ timestamp: number; tokens_sent: number; tokens_received: number; model: string }>(since);

        const buckets = this.initializeBuckets(bucketMs, bucketCount);
        this.aggregateTokenData(rows, buckets, bucketMs);

        return Array.from(buckets.entries())
            .sort(([a], [b]) => a - b)
            .map(([timestamp, data]) => ({
                timestamp,
                promptTokens: data.promptTokens,
                completionTokens: data.completionTokens,
                modelBreakdown: Object.keys(data.modelBreakdown).length > 0 ? data.modelBreakdown : undefined
            }));
    }

    private getBucketConfig(period: string): { bucketMs: number; bucketCount: number } {
        switch (period) {
            case 'yearly': return { bucketMs: 30 * 24 * 60 * 60 * 1000, bucketCount: 12 };
            case 'monthly': return { bucketMs: 24 * 60 * 60 * 1000, bucketCount: 30 };
            case 'weekly': return { bucketMs: 24 * 60 * 60 * 1000, bucketCount: 7 };
            default: return { bucketMs: 60 * 60 * 1000, bucketCount: 24 };
        }
    }

    private initializeBuckets(bucketMs: number, bucketCount: number): Map<number, {
        promptTokens: number;
        completionTokens: number;
        modelBreakdown: Record<string, { prompt: number; completion: number }>;
    }> {
        const buckets = new Map<number, {
            promptTokens: number;
            completionTokens: number;
            modelBreakdown: Record<string, { prompt: number; completion: number }>;
        }>();
        const now = Date.now();
        for (let i = 0; i < bucketCount; i++) {
            const bucketStart = now - (bucketCount - 1 - i) * bucketMs;
            const bucketKey = Math.floor(bucketStart / bucketMs) * bucketMs;
            buckets.set(bucketKey, { promptTokens: 0, completionTokens: 0, modelBreakdown: {} });
        }
        return buckets;
    }

    private aggregateTokenData(
        rows: Array<{ timestamp: number; tokens_sent: number; tokens_received: number; model: string }>,
        buckets: Map<number, { promptTokens: number; completionTokens: number; modelBreakdown: Record<string, { prompt: number; completion: number }> }>,
        bucketMs: number
    ): void {
        for (const row of rows) {
            const bucketKey = Math.floor(row.timestamp / bucketMs) * bucketMs;
            const bucket = buckets.get(bucketKey) ?? { promptTokens: 0, completionTokens: 0, modelBreakdown: {} };
            if (!buckets.has(bucketKey)) {
                buckets.set(bucketKey, bucket);
            }
            bucket.promptTokens += row.tokens_sent;
            bucket.completionTokens += row.tokens_received;

            const model = row.model || 'unknown';
            const modelEntry = bucket.modelBreakdown[model] ?? { prompt: 0, completion: 0 };
            bucket.modelBreakdown[model] = modelEntry;
            modelEntry.prompt += row.tokens_sent;
            modelEntry.completion += row.tokens_received;
        }
    }

    private async getActivityData(period: string, since: number): Promise<number[]> {
        // For daily: 24 hours, for weekly/monthly: days
        const isDaily = period === 'daily';
        const bucketCount = isDaily ? 24 : (period === 'weekly' ? 7 : 30);

        const rows = await this.adapter.prepare(`
            SELECT timestamp FROM messages WHERE timestamp >= ?
        `).all<{ timestamp: number }>(since);

        const activity = new Array(bucketCount).fill(0);
        const now = Date.now();

        for (const row of rows) {
            const ts = row.timestamp;
            if (isDaily) {
                // Bucket by hour
                const hour = new Date(ts).getHours();
                activity[hour]++;
            } else {
                // Bucket by day offset from today
                const dayOffset = Math.floor((now - ts) / (24 * 60 * 60 * 1000));
                const idx = bucketCount - 1 - dayOffset;
                if (idx >= 0 && idx < bucketCount) {
                    activity[idx]++;
                }
            }
        }

        return activity;
    }

    private getStartTime(period: string): number {
        const now = Date.now();
        switch (period) {
            case 'weekly': return now - 7 * 24 * 60 * 60 * 1000;
            case 'monthly': return now - 30 * 24 * 60 * 60 * 1000;
            case 'yearly': return now - 365 * 24 * 60 * 60 * 1000;
            default: return now - 24 * 60 * 60 * 1000;
        }
    }

    private async getChatCount(): Promise<number> {
        return (await this.adapter.prepare('SELECT count(*) as count FROM chats').get<{ count: number }>())?.count ?? 0;
    }

    private async getMessageCount(): Promise<number> {
        return (await this.adapter.prepare('SELECT count(*) as count FROM messages').get<{ count: number }>())?.count ?? 0;
    }

    async getTimeStats() {
        // This will be delegated by DatabaseService, but provided here as fallback
        return {
            totalOnlineTime: 0,
            totalCodingTime: 0,
            workspaceCodingTime: {}
        };
    }

    async getMigrationStatus() {
        return { version: 0, lastMigration: 0 };
    }

    async addTokenUsage(record: TokenUsageRecord): Promise<void> {
        const id = uuidv4();
        const timestamp = record.timestamp ?? Date.now();
        await this.adapter.prepare(`
            INSERT INTO token_usage(id, chat_id, ${WORKSPACE_COMPAT_PATH_COLUMN}, message_id, provider, model, tokens_sent, tokens_received, cost_estimate, timestamp)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, record.chatId, record.workspaceId ?? null, record.messageId ?? null, record.provider, record.model, record.tokensSent, record.tokensReceived, record.costEstimate ?? 0, timestamp);
    }

    async getTokenUsageStats(period: 'daily' | 'weekly' | 'monthly'): Promise<DbTokenStats> {
        const now = Date.now();
        let since = now - 24 * 60 * 60 * 1000;
        if (period === 'weekly') { since = now - 7 * 24 * 60 * 60 * 1000; }
        if (period === 'monthly') { since = now - 30 * 24 * 60 * 60 * 1000; }

        const rows = await this.adapter.prepare(`
            SELECT 
                SUM(tokens_sent) as sent, 
                SUM(tokens_received) as received,
                SUM(cost_estimate) as cost
            FROM token_usage 
            WHERE timestamp >= ?
        `).all<{ sent: number; received: number; cost: number }>(since);

        const total = rows[0] || { sent: 0, received: 0, cost: 0 };

        return {
            totalSent: total.sent || 0,
            totalReceived: total.received || 0,
            totalCost: total.cost || 0,
            timeline: [],
            byProvider: {},
            byModel: {}
        };
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
            account.isActive,
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

    async countAuditLogs(): Promise<number> {
        const row = await this.adapter.prepare('SELECT count(*) as count FROM audit_logs').get<{ count: number }>();
        return row?.count ?? 0;
    }

    async pruneAuditLogsOlderThan(timestamp: number): Promise<number> {
        const result = await this.adapter.prepare('DELETE FROM audit_logs WHERE timestamp < ?').run(timestamp);
        return Number((result as { changes?: number }).changes ?? 0);
    }

    async pruneAuditLogsToMaxEntries(maxEntries: number): Promise<number> {
        const bounded = Math.max(0, Math.floor(maxEntries));
        if (bounded === 0) {
            await this.clearAuditLogs();
            return 0;
        }
        const result = await this.adapter.prepare(`
            DELETE FROM audit_logs
            WHERE id IN (
                SELECT id FROM audit_logs
                ORDER BY timestamp DESC
                LIMIT -1 OFFSET ?
            )
        `).run(bounded);
        return Number((result as { changes?: number }).changes ?? 0);
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

    // --- Agent Profiles ---
    async getAgentProfiles(): Promise<AgentProfile[]> {
        const rows = await this.adapter.prepare('SELECT * FROM agent_profiles ORDER BY name').all<JsonObject>();
        return rows.map(row => ({
            id: String(row.id),
            name: String(row.name),
            role: String(row.role),
            persona: String(row.persona ?? ''),
            systemPrompt: String(row.system_prompt ?? ''),
            skills: this.parseJsonField(row.skills as string | null, [] as string[])
        }));
    }

    async saveAgentProfile(profile: AgentProfile): Promise<void> {
        const now = Date.now();
        await this.adapter.prepare(`
            INSERT INTO agent_profiles (id, name, role, persona, system_prompt, skills, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = EXCLUDED.name,
                role = EXCLUDED.role,
                persona = EXCLUDED.persona,
                system_prompt = EXCLUDED.system_prompt,
                skills = EXCLUDED.skills,
                updated_at = EXCLUDED.updated_at
        `).run(
            profile.id,
            profile.name,
            profile.role,
            profile.persona,
            profile.systemPrompt,
            JSON.stringify(profile.skills),
            now,
            now
        );
    }

    async deleteAgentProfile(id: string): Promise<void> {
        await this.adapter.prepare('DELETE FROM agent_profiles WHERE id = ?').run(id);
    }

    // --- Agent Templates ---
    async getAgentTemplates(): Promise<AgentTemplate[]> {
        const rows = await this.adapter.prepare('SELECT * FROM agent_templates ORDER BY name').all<JsonObject>();
        return rows.map(row => ({
            id: String(row.id),
            name: String(row.name),
            description: String(row.description ?? ''),
            category: String(row.category ?? 'custom') as AgentTemplate['category'],
            systemPromptOverride: row.system_prompt_override as string | undefined,
            taskTemplate: String(row.task_template ?? ''),
            predefinedSteps: this.parseJsonField(row.predefined_steps as string | null, undefined),
            variables: this.parseJsonField(row.variables as string | null, []),
            modelRouting: this.parseJsonField(row.model_routing as string | null, undefined),
            tags: this.parseJsonField(row.tags as string | null, []),
            isBuiltIn: Boolean(row.is_built_in),
            authorId: row.author_id as string | undefined,
            createdAt: Number(row.created_at),
            updatedAt: Number(row.updated_at),
        }));
    }

    async saveAgentTemplate(template: AgentTemplate): Promise<void> {
        const now = Date.now();
        await this.adapter.prepare(`
            INSERT INTO agent_templates (
                id, name, description, category, system_prompt_override,
                task_template, predefined_steps, variables, model_routing,
                tags, is_built_in, author_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                category = EXCLUDED.category,
                system_prompt_override = EXCLUDED.system_prompt_override,
                task_template = EXCLUDED.task_template,
                predefined_steps = EXCLUDED.predefined_steps,
                variables = EXCLUDED.variables,
                model_routing = EXCLUDED.model_routing,
                tags = EXCLUDED.tags,
                is_built_in = EXCLUDED.is_built_in,
                author_id = EXCLUDED.author_id,
                updated_at = EXCLUDED.updated_at
        `).run(
            template.id,
            template.name,
            template.description,
            template.category,
            template.systemPromptOverride ?? null,
            template.taskTemplate,
            template.predefinedSteps ? JSON.stringify(template.predefinedSteps) : null,
            JSON.stringify(template.variables),
            template.modelRouting ? JSON.stringify(template.modelRouting) : null,
            JSON.stringify(template.tags),
            template.isBuiltIn ? 1 : 0,
            template.authorId ?? null,
            template.createdAt ?? now,
            now
        );
    }

    async deleteAgentTemplate(id: string): Promise<void> {
        await this.adapter.prepare('DELETE FROM agent_templates WHERE id = ?').run(id);
    }
}
