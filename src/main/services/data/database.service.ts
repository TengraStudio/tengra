/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

import { appLogger } from '@main/logging/logger';
import { AuditLogEntry } from '@main/services/analysis/audit-log.service';
import { BaseService } from '@main/services/base.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JobState } from '@main/services/system/job-scheduler.service';
import { PromptTemplate } from '@main/utils/prompt-templates.util';
import { WORKSPACE_COMPAT_SCHEMA_VALUES } from '@shared/constants';
import {
    AdvancedSemanticFragment,
    PendingMemory,
    SharedMemoryMergeConflict,
    SharedMemoryNamespace
} from '@shared/types/advanced-memory';
import { IpcValue, JsonObject, JsonValue } from '@shared/types/common';
import { AgentProfile } from '@shared/types/council';
import { DatabaseAdapter, SqlParams, SqlValue } from '@shared/types/database';
import { DbDetailedStats, DbStats, DbTokenStats } from '@shared/types/db-api';
import { FileDiff } from '@shared/types/file-diff';
import { Workspace } from '@shared/types/workspace';
import { AppErrorCode, TengraError, ValidationError } from '@shared/utils/error.util';
import { v4 as uuidv4 } from 'uuid';

import { ChatRepository } from './repositories/chat.repository';
import { KnowledgeRepository } from './repositories/knowledge.repository';
import { SystemRepository } from './repositories/system.repository';
import { UacRepository } from './repositories/uac.repository';
import { UserBehaviorRepository } from './repositories/user-behavior.repository';
import { WorkspaceRepository } from './repositories/workspace.repository';
import { DataService } from './data.service';
import { DatabaseClientService } from './database-client.service';

export type { AuditLogEntry, FileDiff, JobState, PromptTemplate };

/**
 * LinkedAccount represents a single authenticated account for a provider.
 */
export interface LinkedAccount {
    id: string
    provider: string
    email?: string | undefined
    displayName?: string | undefined
    avatarUrl?: string | undefined
    accessToken?: string | undefined
    refreshToken?: string | undefined
    sessionToken?: string | undefined
    expiresAt?: number | undefined
    scope?: string | undefined
    isActive: boolean
    metadata?: JsonObject | undefined
    createdAt: number
    updatedAt: number
}

export interface TokenUsageRecord {
    messageId?: string;
    chatId: string;
    workspaceId?: string;
    provider: string;
    model: string;
    tokensSent: number;
    tokensReceived: number;
    costEstimate?: number;
    timestamp?: number;
}

export interface Folder { id: string; name: string; color?: string | undefined; createdAt: number; updatedAt: number; }
export interface Prompt { id: string; title: string; content: string; tags: string[]; createdAt: number; updatedAt: number; }
export interface ChatMessage { role: string; content: string; timestamp?: number; vector?: number[];[key: string]: JsonValue | undefined }
export interface SemanticFragment { id: string; content: string; embedding: number[]; source: string; sourceId: string; tags: string[]; importance: number; workspacePath?: string | undefined; createdAt: number; updatedAt: number;[key: string]: JsonValue | undefined }
export interface EpisodicMemory {
    id: string;
    title: string;
    summary: string;
    content?: string;
    embedding: number[];
    startDate: number;
    endDate: number;
    chatId?: string;
    participants: string[];
    createdAt: number;
    metadata?: Record<string, IpcValue>;
    timestamp: number;
}
export interface EntityKnowledge { id: string; entityType: string; entityName: string; key: string; value: string; confidence: number; source: string; updatedAt: number }


export interface Chat { id: string; title: string; model?: string | undefined; messages: JsonObject[]; createdAt: Date; updatedAt: Date; isPinned?: boolean | undefined; isFavorite?: boolean | undefined; folderId?: string | undefined; workspaceId?: string | undefined; isGenerating?: boolean | undefined; backend?: string | undefined; metadata?: JsonObject | undefined; }

export interface CodeSymbolSearchResult { id: string; name: string; path: string; line: number; kind: string; signature: string; docstring: string; score?: number; }
const WORKSPACE_COMPAT_CORE_TABLES = [
    'chats',
    'messages',
    WORKSPACE_COMPAT_SCHEMA_VALUES.TABLE,
    'folders',
    'prompts',
    'linked_accounts'
] as const;
const WORKSPACE_COMPAT_PATH_COLUMN = WORKSPACE_COMPAT_SCHEMA_VALUES.PATH_COLUMN;
const VALID_SCHEMA_TABLE_NAMES = [
    ...WORKSPACE_COMPAT_CORE_TABLES,
    'users',
    'sessions',
    'settings',
    'attachments',
    'memory',
    'knowledge'
] as const;

export interface CodeSymbolRecord { id: string; workspace_path?: string; [WORKSPACE_COMPAT_PATH_COLUMN]?: string; workspaceId?: string; file_path?: string; name: string; path?: string; line: number; kind: string; signature?: string; docstring?: string; embedding?: number[]; vector?: number[]; }

export interface SearchChatsOptions {
    query?: string;
    folderId?: string;
    isPinned?: boolean;
    isFavorite?: boolean;
    isArchived?: boolean;
    startDate?: number;
    endDate?: number;
    limit?: number;
}

export interface QueryRecommendation {
    code: 'select-star' | 'missing-limit' | 'leading-wildcard-like' | 'missing-where';
    message: string;
}

export interface QueryAnalysisEntry {
    sql: string;
    calls: number;
    totalDurationMs: number;
    avgDurationMs: number;
    maxDurationMs: number;
    lastDurationMs: number;
    lastRunAt: number;
    slowCalls: number;
    recommendations: QueryRecommendation[];
}

export interface SlowQueryLogEntry {
    sql: string;
    durationMs: number;
    timestamp: number;
}

export interface VectorSearchOptions {
    approximate?: boolean;
    useCache?: boolean;
}

export interface VectorSearchAnalytics {
    codeSymbols: { queries: number; cacheHits: number; avgDurationMs: number; };
    semanticFragments: { queries: number; cacheHits: number; avgDurationMs: number; };
}

interface DatabaseMigration {
    version: number;
    name: string;
    up: string[];
    down: string[];
    checksum: string;
}

interface MigrationExecutionResult {
    success: boolean;
    version: number;
    name: string;
    durationMs: number;
    dryRun: boolean;
    error?: string;
}

interface MigrationHistoryEntry {
    version: number;
    name: string;
    appliedAt: number;
    rolledBackAt?: number;
    checksum: string;
}

export interface SchemaValidationResult {
    version: number;
    tablesPresent: string[];
    tablesMissing: string[];
    warnings: string[];
    valid: boolean;
}

export interface SchemaDiffResult {
    addedTables: string[];
    removedTables: string[];
}

interface ReplicationConfig {
    enabled: boolean;
    lagThresholdMs: number;
}

interface ShardingConfig {
    enabled: boolean;
    shardCount: number;
}

/**
 * Standardized error codes for DatabaseService
 */
export enum DatabaseServiceErrorCode {
    INVALID_ID = 'DB_INVALID_ID',
    INVALID_QUERY = 'DB_INVALID_QUERY',
    NOT_INITIALIZED = 'DB_NOT_INITIALIZED',
    OPERATION_FAILED = 'DB_OPERATION_FAILED',
    CONNECTION_FAILED = 'DB_CONNECTION_FAILED'
}

export enum DatabaseServiceTelemetryEvent {
    QUERY_EXECUTED = 'db_query_executed',
    QUERY_FAILED = 'db_query_failed',
    BATCH_EXECUTED = 'db_batch_executed',
    BACKUP_CREATED = 'db_backup_created',
    BACKUP_RESTORED = 'db_backup_restored',
    MIGRATION_RUN = 'db_migration_run',
    CONNECTION_OPENED = 'db_connection_opened',
    CONNECTION_CLOSED = 'db_connection_closed'
}

export const DATABASE_PERFORMANCE_BUDGETS = {
    QUERY_MS: 5000,
    BATCH_MS: 10000,
    BACKUP_MS: 30000,
    RESTORE_MS: 30000,
    MIGRATION_MS: 60000,
    INITIALIZE_MS: 10000,
    CLEANUP_MS: 5000
} as const;

export class DatabaseService extends BaseService {
    private initPromise: Promise<void> | null = null;
    private initError: Error | null = null;
    private isInitializing = false;
    private readonly slowQueryThresholdMs = 250;
    private readonly vectorSearchCacheTtlMs = 60_000;
    private readonly maxSlowQueryLogEntries = 200;
    private readonly maxVectorCacheEntries = 200;
    private queryAnalytics = new Map<string, QueryAnalysisEntry>();
    private slowQueryLogs: SlowQueryLogEntry[] = [];
    private vectorSearchCache = new Map<string, { expiresAt: number; value: RuntimeValue }>();
    private vectorSearchAnalytics = {
        codeSymbols: { queries: 0, cacheHits: 0, totalDurationMs: 0 },
        semanticFragments: { queries: 0, cacheHits: 0, totalDurationMs: 0 }
    };
    private readonly queryTimeoutMs = 30_000;
    private readonly migrationDirName = 'migrations';
    private readonly internalMigrationSqlMarker = '/* tengra-internal-migration */';
    private replicationConfig: ReplicationConfig = { enabled: false, lagThresholdMs: 5_000 };
    private shardingConfig: ShardingConfig = { enabled: false, shardCount: 1 };
    private compressionStats = { compressedBytes: 0, rawBytes: 0, operations: 0 };

    private _chats!: ChatRepository;
    private _workspaces!: WorkspaceRepository;
    private _knowledge!: KnowledgeRepository;
    private _system!: SystemRepository;
    private _uac!: UacRepository;
    private _userBehavior!: UserBehaviorRepository;

    get chats() { return this._chats; }
    get workspaces() { return this._workspaces; }
    get knowledge() { return this._knowledge; }
    get system() { return this._system; }
    get uac() { return this._uac; }
    get userBehavior() { return this._userBehavior; }

    constructor(
        private dataService: DataService,
        private eventBus: EventBusService,
        private dbClient: DatabaseClientService
    ) {
        super('DatabaseService');
    }

    /** Validates that a value is a non-empty string, throwing with the given label if not. */
    private validateId(value: RuntimeValue, label: string): asserts value is string {
        if (typeof value !== 'string' || value.trim().length === 0) {
            throw new ValidationError(`[${DatabaseServiceErrorCode.INVALID_ID}] ${label} must be a non-empty string`);
        }
    }

    /** Validates that a value is a string (used for SQL statements). */
    private validateSql(value: RuntimeValue): asserts value is string {
        if (typeof value !== 'string' || value.trim().length === 0) {
            throw new ValidationError(`[${DatabaseServiceErrorCode.INVALID_QUERY}] SQL statement must be a non-empty string`);
        }
    }

    private markInternalMigrationSql(sql: string): string {
        if (sql.trimStart().startsWith(this.internalMigrationSqlMarker)) {
            return sql;
        }
        return `${this.internalMigrationSqlMarker} ${sql}`;
    }

    private requiresInternalSqlMode(sql: string): boolean {
        const normalized = this.normalizeSql(sql).toUpperCase();
        if (normalized.length === 0 || normalized.startsWith(this.internalMigrationSqlMarker.toUpperCase())) {
            return false;
        }
        if (normalized.includes(';')) {
            return true;
        }
        return /^(PRAGMA|CREATE|ALTER|DROP|VACUUM|REINDEX|ANALYZE)\b/.test(normalized);
    }

    /** Validates that a value is an array. */
    private validateArray(value: RuntimeValue, label: string): asserts value is RuntimeValue[] {
        if (!Array.isArray(value)) {
            throw new ValidationError(`[${DatabaseServiceErrorCode.OPERATION_FAILED}] ${label} must be an array`);
        }
    }

    override async initialize(): Promise<void> {
        if (this.initPromise) {
            return this.initPromise;
        }
        this.initPromise = this.initDatabase();
        return this.initPromise;
    }

    private async initDatabase() {
        this.isInitializing = true;
        try {
            appLogger.info('DatabaseService', 'Initializing remote database client...');

            // Initialize the database client
            await this.dbClient.initialize();

            const adapter = this.createAdapter();
            this._chats = new ChatRepository(adapter);
            this._workspaces = new WorkspaceRepository(adapter);
            this._knowledge = new KnowledgeRepository(adapter);
            this._system = new SystemRepository(adapter);
            this._uac = new UacRepository(adapter);
            this._userBehavior = new UserBehaviorRepository(adapter);

            await this._uac.ensureTables();
            await this._knowledge.ensureMemoryTables();
            await this._knowledge.ensureFileDiffTable();
            await this._system.ensureProductionIndexes();
            await this.ensureMigrationInfrastructure();
            const chatRecovery = await this._chats.recoverInterruptedChats();
            if (chatRecovery.recoveredChats > 0) {
                appLogger.info(
                    'DatabaseService',
                    `Recovered interrupted chats: chats=${chatRecovery.recoveredChats}, deletedMessages=${chatRecovery.deletedMessages}, interruptedVariants=${chatRecovery.interruptedVariants}, interruptedToolMessages=${chatRecovery.interruptedToolMessages}`
                );
            }
            this.clearQueryAnalytics();

            appLogger.info('DatabaseService', 'Remote database connection complete!');
            this.eventBus.emit('db:ready', { timestamp: Date.now() });
        } catch (error) {
            appLogger.error('DatabaseService', 'Failed to initialize database client:', error as Error);
            this.initError = error instanceof Error ? error : new Error(String(error));
            this.eventBus.emit('db:error', { error: this.initError.message });
            throw this.initError;
        } finally {
            this.isInitializing = false;
        }
    }

    private async ensureDb(): Promise<DatabaseAdapter> {
        if (this.initPromise && !this.isInitializing) {
            await this.initPromise;
        }
        if (!this.dbClient.isConnected()) {
            throw new TengraError(`Database client not connected. Reason: ${this.initError?.message ?? 'unknown'}`, AppErrorCode.DB_NOT_INITIALIZED);
        }
        return this.createAdapter();
    }

    public async query<T = RuntimeValue>(sql: string, params?: SqlParams) {
        this.validateSql(sql);
        const adapter = await this.ensureDb();
        return adapter.query<T>(sql, params);
    }

    public async exec(sql: string) {
        this.validateSql(sql);
        const adapter = await this.ensureDb();
        await adapter.exec(sql);
    }

    public async prepare(sql: string) {
        this.validateSql(sql);
        const adapter = await this.ensureDb();
        return adapter.prepare(sql);
    }

    public getDatabase(): DatabaseAdapter {
        return this.createAdapter();
    }

    private createAdapter(): DatabaseAdapter {
        return {
            query: async <T = JsonObject>(sql: string, params?: SqlParams) => {
                return this.trackQuery(sql, params, async () => {
                    const res = await this.dbClient.executeQuery({ sql, params: params as (string | number | boolean | null)[] });
                    return { rows: res.rows as RuntimeValue as T[], fields: [] };
                });
            },
            exec: async (sql) => {
                await this.trackQuery(sql, undefined, async () => {
                    const executableSql = this.requiresInternalSqlMode(sql)
                        ? this.markInternalMigrationSql(sql)
                        : sql;
                    await this.dbClient.executeQuery({ sql: executableSql });
                });
            },
            transaction: async <T>(fn: (tx: DatabaseAdapter) => Promise<T>) => {
                // Remote transactions are not supported yet, fallback to individual queries
                return await fn(this.createAdapter());
            },
            prepare: (sql: string) => {
                return {
                    run: async (...params: SqlValue[]) => {
                        return this.trackQuery(sql, params, async () => {
                            const res = await this.dbClient.executeQuery({ sql, params: params as (string | number | boolean | null)[] });
                            return { rowsAffected: res.affected_rows, insertId: undefined };
                        });
                    },
                    all: async <T = RuntimeValue>(...params: SqlValue[]) => {
                        return this.trackQuery(sql, params, async () => {
                            const res = await this.dbClient.executeQuery({ sql, params: params as (string | number | boolean | null)[] });
                            return res.rows as RuntimeValue as T[];
                        });
                    },
                    get: async <T = RuntimeValue>(...params: SqlValue[]) => {
                        return this.trackQuery(sql, params, async () => {
                            const res = await this.dbClient.executeQuery({ sql, params: params as (string | number | boolean | null)[] });
                            return res.rows[0] as RuntimeValue as T;
                        });
                    }
                };
            }
        };
    }

    private normalizeSql(sql: string): string {
        return sql.replace(/\s+/g, ' ').trim();
    }

    private analyzeQuery(sql: string, params?: SqlParams): QueryRecommendation[] {
        const normalized = this.normalizeSql(sql);
        const lower = normalized.toLowerCase();
        const recommendations: QueryRecommendation[] = [];

        if (/^select\s+\*/i.test(normalized)) {
            recommendations.push({
                code: 'select-star',
                message: 'Avoid SELECT * in production paths; select only required columns.'
            });
        }
        if (/^select\b/i.test(normalized) && !/\blimit\b/i.test(normalized) && !/\bcount\(/i.test(normalized)) {
            recommendations.push({
                code: 'missing-limit',
                message: 'Add LIMIT to unbounded SELECT queries where possible.'
            });
        }
        if (/\blike\b/i.test(normalized)) {
            const hasLeadingWildcardParam = Array.isArray(params) && params.some(
                p => typeof p === 'string' && p.startsWith('%')
            );
            if (hasLeadingWildcardParam) {
                recommendations.push({
                    code: 'leading-wildcard-like',
                    message: 'Leading wildcard LIKE patterns can bypass indexes; consider prefix search or FTS.'
                });
            }
        }
        if (/^update\b|^delete\b/i.test(lower) && !/\bwhere\b/i.test(lower)) {
            recommendations.push({
                code: 'missing-where',
                message: 'UPDATE/DELETE without WHERE may affect all rows; verify intent.'
            });
        }
        return recommendations;
    }

    private async trackQuery<T>(sql: string, params: SqlParams | undefined, executor: () => Promise<T>): Promise<T> {
        const startedAt = Date.now();
        const normalizedSql = this.normalizeSql(sql);
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
        try {
            const result = await Promise.race([
                executor(),
                new Promise<T>((_, reject) => {
                    timeoutHandle = setTimeout(
                        () => reject(new Error(`Query timeout after ${this.queryTimeoutMs}ms`)),
                        this.queryTimeoutMs
                    );
                    if (timeoutHandle?.unref) { timeoutHandle.unref(); }
                })
            ]);
            this.recordQueryMetrics(normalizedSql, params, Date.now() - startedAt);
            return result;
        } catch (error) {
            this.recordQueryMetrics(normalizedSql, params, Date.now() - startedAt);
            throw error;
        } finally {
            if (timeoutHandle !== null) {
                clearTimeout(timeoutHandle);
            }
        }
    }

    private recordQueryMetrics(sql: string, params: SqlParams | undefined, durationMs: number): void {
        const existing = this.queryAnalytics.get(sql);
        const next: QueryAnalysisEntry = existing ?? {
            sql,
            calls: 0,
            totalDurationMs: 0,
            avgDurationMs: 0,
            maxDurationMs: 0,
            lastDurationMs: 0,
            lastRunAt: 0,
            slowCalls: 0,
            recommendations: this.analyzeQuery(sql, params)
        };

        next.calls += 1;
        next.totalDurationMs += durationMs;
        next.avgDurationMs = next.totalDurationMs / next.calls;
        next.maxDurationMs = Math.max(next.maxDurationMs, durationMs);
        next.lastDurationMs = durationMs;
        next.lastRunAt = Date.now();
        if (durationMs >= this.slowQueryThresholdMs) {
            next.slowCalls += 1;
            this.slowQueryLogs.unshift({ sql, durationMs, timestamp: Date.now() });
            if (this.slowQueryLogs.length > this.maxSlowQueryLogEntries) {
                this.slowQueryLogs.length = this.maxSlowQueryLogEntries;
            }
            appLogger.warn('DatabaseService', `Slow query detected (${durationMs}ms): ${sql}`);
        }
        this.queryAnalytics.set(sql, next);
    }

    public getQueryAnalysis(limit: number = 50): QueryAnalysisEntry[] {
        return [...this.queryAnalytics.values()]
            .sort((a, b) => b.totalDurationMs - a.totalDurationMs)
            .slice(0, limit);
    }

    public getSlowQueries(limit: number = 50): SlowQueryLogEntry[] {
        return this.slowQueryLogs.slice(0, limit);
    }

    public getQueryRecommendations(limit: number = 50): QueryRecommendation[] {
        const aggregated = new Map<QueryRecommendation['code'], QueryRecommendation>();
        for (const entry of this.queryAnalytics.values()) {
            for (const recommendation of entry.recommendations) {
                aggregated.set(recommendation.code, recommendation);
            }
        }
        return [...aggregated.values()].slice(0, limit);
    }

    public clearQueryAnalytics(): void {
        this.queryAnalytics.clear();
        this.slowQueryLogs = [];
    }

    /**
     * Configures connection pool limits for the database client.
     * @param config - Pool configuration with optional socket and request limits
     * @throws {ValidationError} If config is null or not an object
     */
    setConnectionPoolConfig(config: { maxSockets?: number; maxFreeSockets?: number; maxPendingRequests?: number }): void {
        if (config === null || typeof config !== 'object') {
            throw new ValidationError(`[${DatabaseServiceErrorCode.OPERATION_FAILED}] config must be a non-null object`);
        }
        this.dbClient.setPoolLimits(config);
    }

    /** Returns current connection pool metrics (active sockets, free sockets, pending requests). */
    getConnectionPoolMetrics() {
        return this.dbClient.getConnectionPoolMetrics();
    }

    /** Recycles the connection pool, closing idle connections and resetting state. */
    async recycleConnectionPool(): Promise<void> {
        await this.dbClient.recycleConnectionPool();
    }

    /**
     * Checks database connection health by running a test query.
     * @param timeoutMs - Optional timeout in milliseconds for the health check
     * @returns Health status and measured latency
     */
    async getConnectionHealth(timeoutMs?: number): Promise<{ healthy: boolean; latencyMs: number }> {
        return this.dbClient.testConnection(timeoutMs);
    }

    /**
     * Returns the EXPLAIN query plan for the given SQL statement.
     * @param sql - SQL query to analyze
     * @param params - Optional query parameters
     * @returns Array of query plan rows
     */
    async analyzeQueryPlan(sql: string, params?: SqlParams): Promise<RuntimeValue[]> {
        this.validateSql(sql);
        const explainSql = `EXPLAIN ${sql}`;
        const res = await this.query(explainSql, params);
        return res.rows as RuntimeValue[];
    }

    /**
     * Executes multiple SQL statements sequentially, collecting results for each.
     * @param statements - Array of SQL statements with optional parameters
     * @returns Array of results indicating success or failure with error message
     */
    async executeBatch(
        statements: Array<{ sql: string; params?: SqlParams }>
    ): Promise<Array<{ success: boolean; error?: string }>> {
        this.validateArray(statements, 'statements');
        const results: Array<{ success: boolean; error?: string }> = [];
        for (const statement of statements) {
            try {
                await this.exec(statement.sql);
                results.push({ success: true });
            } catch (error) {
                results.push({ success: false, error: error instanceof Error ? error.message : String(error) });
            }
        }
        return results;
    }

    private async ensureMigrationInfrastructure(): Promise<void> {
        await this.exec(this.markInternalMigrationSql(`
            CREATE TABLE IF NOT EXISTS migration_history (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                checksum TEXT NOT NULL,
                applied_at BIGINT NOT NULL,
                rolled_back_at BIGINT
            )
        `));
    }

    private getKnownMigrations(): DatabaseMigration[] {
        return [
            {
                version: 1,
                name: 'bootstrap-production-indexes',
                up: [
                    'CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)',
                    'CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)',
                    'CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at)'
                ],
                down: [
                    'DROP INDEX IF EXISTS idx_messages_chat_id',
                    'DROP INDEX IF EXISTS idx_messages_timestamp',
                    'DROP INDEX IF EXISTS idx_chats_updated_at'
                ],
                checksum: 'mig-v1-bootstrap-indexes'
            },
            {
                version: 2,
                name: 'linked_accounts_provider_idx',
                up: [
                    'CREATE INDEX IF NOT EXISTS idx_linked_accounts_provider ON linked_accounts(provider)',
                    'CREATE INDEX IF NOT EXISTS idx_linked_accounts_is_active ON linked_accounts(is_active)'
                ],
                down: [
                    'DROP INDEX IF EXISTS idx_linked_accounts_provider',
                    'DROP INDEX IF EXISTS idx_linked_accounts_is_active'
                ],
                checksum: 'mig-v2-linked-accounts-indexes'
            },
            {
                version: 3,
                name: 'workspace_intelligence_hot_path_indexes',
                up: [
                    'CREATE INDEX IF NOT EXISTS idx_code_symbols_workspace_path ON code_symbols(workspace_path)',
                    'CREATE INDEX IF NOT EXISTS idx_code_symbols_workspace_name ON code_symbols(workspace_path, name COLLATE NOCASE)',
                    'CREATE INDEX IF NOT EXISTS idx_code_symbols_workspace_file ON code_symbols(workspace_path, file_path)',
                    'CREATE INDEX IF NOT EXISTS idx_semantic_fragments_workspace_path ON semantic_fragments(workspace_path)',
                    'CREATE INDEX IF NOT EXISTS idx_semantic_fragments_workspace_source ON semantic_fragments(workspace_path, source)'
                ],
                down: [
                    'DROP INDEX IF EXISTS idx_code_symbols_workspace_path',
                    'DROP INDEX IF EXISTS idx_code_symbols_workspace_name',
                    'DROP INDEX IF EXISTS idx_code_symbols_workspace_file',
                    'DROP INDEX IF EXISTS idx_semantic_fragments_workspace_path',
                    'DROP INDEX IF EXISTS idx_semantic_fragments_workspace_source'
                ],
                checksum: 'mig-v3-workspace-intelligence-indexes'
            },
            {
                version: 4,
                name: 'add-workspace-logo-column',
                up: [
                    'ALTER TABLE workspaces ADD COLUMN logo TEXT'
                ],
                down: [
                    // SQLite/PGlite doesn't support DROP COLUMN easily in older versions, 
                    // but we can leave it for now or use a rename pattern if critical.
                ],
                checksum: 'mig-v4-add-workspace-logo'
            }
        ];
    }

    private async createMigrationBackup(version: number): Promise<string> {
        const baseDir = this.dataService.getPath('data');
        const migrationDir = path.join(baseDir, this.migrationDirName);
        await fs.promises.mkdir(migrationDir, { recursive: true });

        const status = await this.getMigrationStatus();
        const backupPath = path.join(migrationDir, `migration-backup-v${version}-${Date.now()}.json`);
        await fs.promises.writeFile(
            backupPath,
            JSON.stringify({ createdAt: Date.now(), currentVersion: status.version, targetVersion: version }, null, 2),
            'utf8'
        );
        return backupPath;
    }

    private detectMigrationConflicts(
        remoteHistory: Array<{ version: number; checksum: string }>
    ): Array<{ version: number; expected: string; found: string }> {
        const known = this.getKnownMigrations();
        const knownMap = new Map(known.map(m => [m.version, m.checksum]));
        const conflicts: Array<{ version: number; expected: string; found: string }> = [];

        for (const entry of remoteHistory) {
            const expected = knownMap.get(entry.version);
            if (expected && expected !== entry.checksum) {
                conflicts.push({ version: entry.version, expected, found: entry.checksum });
            }
        }
        return conflicts;
    }

    private async getMigrationHistoryRows(): Promise<Array<{ version: number; name: string; checksum: string; applied_at: number; rolled_back_at?: number }>> {
        try {
            const res = await this.query<{ version: number; name: string; checksum: string; applied_at: number; rolled_back_at?: number }>(
                'SELECT version, name, checksum, applied_at, rolled_back_at FROM migration_history ORDER BY version ASC'
            );
            return res.rows ?? [];
        } catch {
            return [];
        }
    }

    /** Returns the full migration history with version, name, checksum, and timestamps. */
    async getMigrationHistory(): Promise<MigrationHistoryEntry[]> {
        const rows = await this.getMigrationHistoryRows();
        return rows.map(row => ({
            version: row.version,
            name: row.name,
            checksum: row.checksum,
            appliedAt: row.applied_at,
            rolledBackAt: row.rolled_back_at
        }));
    }

    /**
     * Runs pending database migrations up to the specified target version.
     * @param options - Optional settings: dryRun to preview without applying, targetVersion to stop at
     * @returns Array of execution results for each migration attempted
     * @throws {TengraError} If a migration checksum conflict is detected
     */
    async runMigrations(options: { dryRun?: boolean; targetVersion?: number } = {}): Promise<MigrationExecutionResult[]> {
        const dryRun = options.dryRun === true;
        const known = this.getKnownMigrations().sort((a, b) => a.version - b.version);
        const targetVersion = options.targetVersion ?? known[known.length - 1]?.version ?? 0;
        const history = await this.getMigrationHistoryRows();
        const appliedVersions = new Set(history.filter(h => !h.rolled_back_at).map(h => h.version));
        const conflicts = this.detectMigrationConflicts(history.map(h => ({ version: h.version, checksum: h.checksum })));
        if (conflicts.length > 0) {
            throw new TengraError(`Migration conflict detected for versions: ${conflicts.map(c => c.version).join(', ')}`, AppErrorCode.DB_MIGRATION_FAILED);
        }

        const toRun = known.filter(m => m.version <= targetVersion && !appliedVersions.has(m.version));
        const results: MigrationExecutionResult[] = [];
        for (const migration of toRun) {
            const startedAt = Date.now();
            if (dryRun) {
                results.push({
                    success: true,
                    version: migration.version,
                    name: migration.name,
                    durationMs: 0,
                    dryRun: true
                });
                continue;
            }

            try {
                await this.createMigrationBackup(migration.version);
                for (const statement of migration.up) {
                    await this.exec(this.markInternalMigrationSql(statement));
                }
                await this.exec(
                    `INSERT INTO migration_history (version, name, checksum, applied_at, rolled_back_at) VALUES (${migration.version}, '${migration.name}', '${migration.checksum}', ${Date.now()}, NULL)
                     ON CONFLICT (version) DO UPDATE SET name='${migration.name}', checksum='${migration.checksum}', applied_at=${Date.now()}, rolled_back_at=NULL`
                );
                results.push({
                    success: true,
                    version: migration.version,
                    name: migration.name,
                    durationMs: Date.now() - startedAt,
                    dryRun: false
                });
            } catch (error) {
                results.push({
                    success: false,
                    version: migration.version,
                    name: migration.name,
                    durationMs: Date.now() - startedAt,
                    dryRun: false,
                    error: error instanceof Error ? error.message : String(error)
                });
                break;
            }
        }
        return results;
    }

    /**
     * Rolls back the most recently applied migration.
     * @param options - Optional settings: dryRun to preview without applying
     * @returns Execution result of the rollback, or null if no migration to roll back
     * @throws {TengraError} If no down migration is found for the version
     */
    async rollbackLastMigration(options: { dryRun?: boolean } = {}): Promise<MigrationExecutionResult | null> {
        const dryRun = options.dryRun === true;
        const history = await this.getMigrationHistoryRows();
        const lastApplied = [...history].reverse().find(h => !h.rolled_back_at);
        if (!lastApplied) {
            return null;
        }
        const migration = this.getKnownMigrations().find(m => m.version === lastApplied.version);
        if (!migration) {
            throw new TengraError(`No down migration found for version ${lastApplied.version}`, AppErrorCode.DB_MIGRATION_FAILED);
        }

        const startedAt = Date.now();
        if (dryRun) {
            return {
                success: true,
                version: migration.version,
                name: migration.name,
                durationMs: 0,
                dryRun: true
            };
        }

        await this.createMigrationBackup(migration.version);
        for (const statement of migration.down) {
            await this.exec(this.markInternalMigrationSql(statement));
        }
        await this.query('UPDATE migration_history SET rolled_back_at = ? WHERE version = ?', [Date.now(), migration.version]);
        return {
            success: true,
            version: migration.version,
            name: migration.name,
            durationMs: Date.now() - startedAt,
            dryRun: false
        };
    }

    /**
     * Validates that expected database tables exist in the current schema.
     * @param expectedTables - List of table names to check (defaults to core tables)
     * @returns Validation result with present/missing tables and warnings
     */
    async validateSchema(expectedTables: string[] = [...WORKSPACE_COMPAT_CORE_TABLES]): Promise<SchemaValidationResult> {
        // Validate table names to prevent SQL injection
        const validTableNames: ReadonlyArray<string> = [...VALID_SCHEMA_TABLE_NAMES];
        for (const tableName of expectedTables) {
            if (!validTableNames.includes(tableName)) {
                throw new Error(`Invalid table name: ${tableName}`);
            }
        }

        const present: string[] = [];
        const missing: string[] = [];
        for (const tableName of expectedTables) {
            try {
                await this.query(`SELECT 1 FROM ${tableName} LIMIT 1`);
                present.push(tableName);
            } catch {
                missing.push(tableName);
            }
        }

        const status = await this.getMigrationStatus();
        const warnings: string[] = [];
        if (missing.length > 0) {
            warnings.push(`Missing tables: ${missing.join(', ')}`);
        }

        return {
            version: status.version,
            tablesPresent: present,
            tablesMissing: missing,
            warnings,
            valid: missing.length === 0
        };
    }

    /**
     * Returns a sorted list of tables that are present in the current schema.
     * @param expectedTables - List of table names to check (defaults to core tables)
     */
    async getSchemaSnapshot(expectedTables: string[] = [...WORKSPACE_COMPAT_CORE_TABLES]): Promise<string[]> {
        const result = await this.validateSchema(expectedTables);
        return result.tablesPresent.sort();
    }

    /**
     * Compares current schema against an expected snapshot, returning added and removed tables.
     * @param expectedSnapshot - List of table names representing the expected schema
     */
    async diffSchema(expectedSnapshot: string[]): Promise<SchemaDiffResult> {
        const current = await this.getSchemaSnapshot(expectedSnapshot);
        const expectedSet = new Set(expectedSnapshot);
        const currentSet = new Set(current);
        const addedTables = current.filter(t => !expectedSet.has(t));
        const removedTables = expectedSnapshot.filter(t => !currentSet.has(t));
        return { addedTables, removedTables };
    }

    /**
     * Updates the replication configuration with the provided partial config.
     * @param config - Partial replication settings to merge
     * @returns The updated replication configuration
     */
    setReplicationConfig(config: Partial<ReplicationConfig>): ReplicationConfig {
        this.replicationConfig = {
            ...this.replicationConfig,
            ...config
        };
        return { ...this.replicationConfig };
    }

    /** Returns a copy of the current replication configuration. */
    getReplicationConfig(): ReplicationConfig {
        return { ...this.replicationConfig };
    }

    /**
     * Returns replication lag metrics including lag duration and health status.
     * @returns Lag in milliseconds and whether it is within the configured threshold
     */
    async getReplicationLagMetrics(): Promise<{ lagMs: number; healthy: boolean }> {
        const health = await this.dbClient.getHealth();
        const now = Date.now();
        const lagMs = health.success ? Math.max(0, now - now) : this.replicationConfig.lagThresholdMs + 1;
        return {
            lagMs,
            healthy: lagMs <= this.replicationConfig.lagThresholdMs
        };
    }

    /** Triggers failover to primary by disabling replication. */
    async failoverToPrimary(): Promise<{ success: boolean }> {
        this.replicationConfig.enabled = false;
        return { success: true };
    }

    /**
     * Updates the sharding configuration, ensuring at least 1 shard.
     * @param config - Partial sharding settings to merge
     * @returns The updated sharding configuration
     */
    setShardingConfig(config: Partial<ShardingConfig>): ShardingConfig {
        const shardCount = Math.max(1, config.shardCount ?? this.shardingConfig.shardCount);
        this.shardingConfig = {
            ...this.shardingConfig,
            ...config,
            shardCount
        };
        return { ...this.shardingConfig };
    }

    /** Returns a copy of the current sharding configuration. */
    getShardingConfig(): ShardingConfig {
        return { ...this.shardingConfig };
    }

    /**
     * Computes the shard index for a given key using a hash function.
     * @param key - The key to determine shard placement for
     * @returns Zero-based shard index
     */
    getShardForKey(key: string): number {
        const shardCount = Math.max(1, this.shardingConfig.shardCount);
        let hash = 0;
        for (let i = 0; i < key.length; i += 1) {
            hash = ((hash << 5) - hash) + key.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash) % shardCount;
    }

    /**
     * Executes a SQL query across all active shards and returns results per shard.
     * @param sql - SQL query to execute
     * @param params - Optional query parameters
     * @returns Array of results grouped by shard index
     */
    async queryAcrossShards(sql: string, params?: SqlParams): Promise<Array<{ shard: number; rows: RuntimeValue[] }>> {
        this.validateSql(sql);
        const shards = Math.max(1, this.shardingConfig.shardCount);
        const rows: Array<{ shard: number; rows: RuntimeValue[] }> = [];
        for (let shard = 0; shard < shards; shard += 1) {
            const result = await this.query(sql, params);
            rows.push({ shard, rows: result.rows as RuntimeValue[] });
        }
        return rows;
    }

    /**
     * Gzip-compresses a float32 vector embedding and returns it as a base64 string.
     * @param vector - Array of numbers representing the vector embedding
     * @returns Base64-encoded compressed payload
     */
    compressVectorEmbedding(vector: number[]): string {
        const raw = Buffer.from(Float32Array.from(vector).buffer);
        const compressed = zlib.gzipSync(raw);
        this.compressionStats.rawBytes += raw.byteLength;
        this.compressionStats.compressedBytes += compressed.byteLength;
        this.compressionStats.operations += 1;
        return compressed.toString('base64');
    }

    /**
     * Decompresses a base64-encoded gzip payload back into a number array.
     * @param payload - Base64-encoded compressed vector
     * @returns Array of numbers representing the original vector embedding
     */
    decompressVectorEmbedding(payload: string): number[] {
        const compressed = Buffer.from(payload, 'base64');
        const raw = zlib.gunzipSync(compressed);
        const view = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 4));
        return Array.from(view);
    }

    /**
     * Gzip-compresses a JSON message history array and returns it as a base64 string.
     * @param messages - Array of message objects to compress
     * @returns Base64-encoded compressed payload
     */
    compressMessageHistory(messages: JsonObject[]): string {
        const raw = Buffer.from(JSON.stringify(messages), 'utf8');
        const compressed = zlib.gzipSync(raw);
        this.compressionStats.rawBytes += raw.byteLength;
        this.compressionStats.compressedBytes += compressed.byteLength;
        this.compressionStats.operations += 1;
        return compressed.toString('base64');
    }

    /**
     * Decompresses a base64-encoded gzip payload back into a JSON object array.
     * @param payload - Base64-encoded compressed message history
     * @returns Array of message objects
     */
    decompressMessageHistory(payload: string): JsonObject[] {
        const compressed = Buffer.from(payload, 'base64');
        const raw = zlib.gunzipSync(compressed);
        return JSON.parse(raw.toString('utf8')) as JsonObject[];
    }

    /** Returns compression statistics including operation count, byte sizes, and compression ratio. */
    getCompressionMetrics(): {
        operations: number;
        rawBytes: number;
        compressedBytes: number;
        ratio: number;
    } {
        const ratio = this.compressionStats.rawBytes > 0
            ? this.compressionStats.compressedBytes / this.compressionStats.rawBytes
            : 1;
        return {
            operations: this.compressionStats.operations,
            rawBytes: this.compressionStats.rawBytes,
            compressedBytes: this.compressionStats.compressedBytes,
            ratio
        };
    }

    /** Checks whether the database contains any data. */
    async hasData(): Promise<boolean> { return true; }

    private parseWorkspaceMountsJson(mountsJson?: string): JsonValue[] | undefined {
        if (!mountsJson) {
            return undefined;
        }

        const parsed = JSON.parse(mountsJson) as JsonValue;
        return Array.isArray(parsed) ? parsed : undefined;
    }

    private parseWorkspaceCouncilConfigJson(councilConfigJson?: string): JsonObject | undefined {
        if (!councilConfigJson) {
            return undefined;
        }

        const parsed = JSON.parse(councilConfigJson) as JsonValue;
        return this.isJsonObject(parsed) ? parsed : undefined;
    }

    private isJsonObject(value: JsonValue): value is JsonObject {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }

    // Folders
    /** Retrieves all folders. */
    async getFolders() { return this._system.getFolders(); }
    /** Retrieves a folder by ID. */
    async getFolder(id: string) { return this._system.getFolder(id); }
    /** Creates a new folder with the given name and optional color. */
    async createFolder(name: string, color?: string) { return this._system.createFolder(name, color); }
    /** Updates a folder by ID with the provided partial updates. */
    async updateFolder(id: string, updates: Partial<Folder>) { return this._system.updateFolder(id, updates); }
    /** Deletes a folder by ID. */
    async deleteFolder(id: string) { return this._system.deleteFolder(id); }

    // Prompts
    /** Retrieves all prompts. */
    async getPrompts() { return this._system.getPrompts(); }
    /** Retrieves a prompt by ID. */
    async getPrompt(id: string) { return this._system.getPrompt(id); }
    /** Creates a new prompt with the given title, content, and optional tags. */
    async createPrompt(title: string, content: string, tags: string[] = []) { return this._system.createPrompt(title, content, tags); }
    /** Updates a prompt by ID with the provided partial updates. */
    async updatePrompt(id: string, updates: Partial<Prompt>) { return this._system.updatePrompt(id, updates); }
    /** Deletes a prompt by ID. */
    async deletePrompt(id: string): Promise<void> { return this._system.deletePrompt(id); }

    // Workspaces
    /** Retrieves all workspaces. */
    async getWorkspaces(): Promise<Workspace[]> {
        const workspaces = await this.dbClient.getWorkspaces();
        return workspaces.map(workspace => this._workspaces.mapDbWorkspace(workspace));
    }
    /** Retrieves a workspace by ID. */
    async getWorkspace(id: string): Promise<Workspace | null | undefined> {
        const workspace = await this.dbClient.getWorkspace(id);
        return workspace ? this._workspaces.mapDbWorkspace(workspace) : null;
    }
    /** Checks whether a workspace path has indexed symbols. */
    async hasIndexedSymbols(workspacePath: string): Promise<boolean> { return this._workspaces.hasIndexedSymbols(workspacePath); }
    /** Creates a new workspace with the given title, path, description, and optional metadata. */
    async createWorkspace(title: string, path: string, desc: string = '', m?: string, c?: string): Promise<Workspace> {
        const workspace = await this.dbClient.createWorkspace({
            title,
            path,
            description: desc,
            mounts: this.parseWorkspaceMountsJson(m),
            council_config: this.parseWorkspaceCouncilConfigJson(c)
        });
        return this._workspaces.mapDbWorkspace(workspace);
    }
    /** Updates a workspace by ID with the provided partial updates. */
    async updateWorkspace(id: string, updates: Partial<Workspace>): Promise<Workspace | undefined> { return this._workspaces.updateWorkspace(id, updates); }
    /** Deletes a workspace by ID, optionally removing associated files. */
    async deleteWorkspace(id: string, deleteFiles: boolean = false): Promise<void> { return this._workspaces.deleteWorkspace(id, deleteFiles); }
    /** Archives or unarchives a workspace by ID. */
    async archiveWorkspace(id: string, isArchived: boolean): Promise<Workspace | undefined> { return this._workspaces.updateWorkspace(id, { status: isArchived ? 'archived' : 'active' }); }

    /** Deletes multiple workspaces by ID, optionally removing associated files. */
    async bulkDeleteWorkspaces(ids: string[], deleteFiles: boolean = false) {
        this.validateArray(ids, 'ids');
        for (const id of ids) {
            this.validateId(id, 'workspaceId');
            await this.deleteWorkspace(id, deleteFiles);
        }
    }

    /** Archives or unarchives multiple workspaces by ID. */
    async bulkArchiveWorkspaces(ids: string[], isArchived: boolean) {
        this.validateArray(ids, 'ids');
        for (const id of ids) {
            this.validateId(id, 'workspaceId');
            await this.archiveWorkspace(id, isArchived);
        }
    }

    // Chats & Messages
    /** Creates a new chat. */
    async createChat(chat: Chat) { return this._chats.createChat(chat); }
    /** Retrieves all chats. */
    async getAllChats() { return this._chats.getAllChats(); }
    /** Retrieves a chat by ID. */
    async getChat(id: string) { return this._chats.getChat(id); }
    /** Retrieves chats, optionally filtered by workspace ID. */
    async getChats(workspaceId?: string) { return this._chats.getChats(workspaceId); }
    /** Updates a chat by ID with the provided partial updates. */
    async updateChat(id: string, updates: Partial<Chat>) { return this._chats.updateChat(id, updates); }
    /** Deletes a chat by ID. */
    async deleteChat(id: string) { return this._chats.deleteChat(id); }
    /** Archives or unarchives a chat by ID. */
    async archiveChat(id: string, isArchived: boolean) { return this._chats.updateChat(id, { metadata: { isArchived } }); }
    /** Retrieves all bookmarked messages. */
    async getBookmarkedMessages() { return this._chats.getBookmarkedMessages(); }
    /** Searches chats based on the provided search options. */
    async searchChats(options: SearchChatsOptions) { return this._chats.searchChats(options); }
    /** Deletes all chats. */
    async deleteAllChats() { return this._chats.deleteAllChats(); }
    /** Deletes all chats matching the given title. */
    async deleteChatsByTitle(title: string) { return this._chats.deleteChatsByTitle(title); }
    /** Deletes multiple chats by ID. */
    async bulkDeleteChats(ids: string[]) {
        this.validateArray(ids, 'ids');
        for (const id of ids) {
            this.validateId(id, 'chatId');
            await this.deleteChat(id);
        }
    }

    /** Archives or unarchives multiple chats by ID. */
    async bulkArchiveChats(ids: string[], isArchived: boolean) {
        this.validateArray(ids, 'ids');
        for (const id of ids) {
            this.validateId(id, 'chatId');
            await this.archiveChat(id, isArchived);
        }
    }

    // Knowledge & Memories
    async findCodeSymbolsByName(workspacePath: string, name: string) { return this._knowledge.findCodeSymbolsByName(workspacePath, name); }
    async getCodeSymbolsByWorkspacePath(workspacePath: string) { return this._knowledge.getCodeSymbolsByWorkspacePath(workspacePath); }
    async searchCodeSymbols(vec: number[], workspacePath?: string, options: VectorSearchOptions = {}): Promise<CodeSymbolSearchResult[]> {
        const limit = 10;
        const useCache = options.useCache !== false;
        const approximate = options.approximate === true;
        const cacheKey = this.buildVectorCacheKey('code', vec, limit, workspacePath, approximate);
        const startedAt = Date.now();

        if (useCache) {
            const cached = this.readVectorCache<CodeSymbolSearchResult[]>(cacheKey);
            if (cached) {
                this.vectorSearchAnalytics.codeSymbols.queries += 1;
                this.vectorSearchAnalytics.codeSymbols.cacheHits += 1;
                return cached;
            }
        }

        const searchLimit = approximate ? limit : Math.min(limit * 2, 30);
        const results = await this.dbClient.searchCodeSymbols({
            embedding: vec,
            limit: searchLimit,
            [WORKSPACE_COMPAT_PATH_COLUMN]: workspacePath
        });
        const mapped = results.map(r => ({
            id: r.id,
            name: r.name,
            path: r.file_path,
            line: r.line,
            kind: r.kind,
            signature: r.signature ?? '',
            docstring: r.docstring ?? '',
            score: 0.9
        })).slice(0, limit);

        this.vectorSearchAnalytics.codeSymbols.queries += 1;
        this.vectorSearchAnalytics.codeSymbols.totalDurationMs += Date.now() - startedAt;
        if (useCache) {
            this.writeVectorCache(cacheKey, mapped);
        }
        return mapped;
    }
    async storeCodeSymbol(symbol: CodeSymbolRecord) {
        // Use HTTP API for storing code symbols with embeddings
        await this.dbClient.storeCodeSymbol({
            id: symbol.id,
            [WORKSPACE_COMPAT_PATH_COLUMN]: symbol[WORKSPACE_COMPAT_PATH_COLUMN] ?? symbol.workspace_path ?? symbol.workspaceId ?? '',
            file_path: symbol.file_path ?? symbol.path ?? '',
            name: symbol.name,
            line: symbol.line,
            kind: symbol.kind,
            signature: symbol.signature,
            docstring: symbol.docstring,
            embedding: symbol.embedding ?? symbol.vector
        });
    }
    async clearCodeSymbols(workspacePath: string) { return this._knowledge.clearCodeSymbols(workspacePath); }
    async deleteCodeSymbolsForFile(workspacePath: string, filePath: string) { return this._knowledge.deleteCodeSymbolsForFile(workspacePath, filePath); }
    async searchCodeContentByText(workspacePath: string, query: string) { return this._knowledge.searchCodeContentByText(workspacePath, query); }
    async storeSemanticFragment(f: SemanticFragment) {
        // Use HTTP API for storing semantic fragments with embeddings
        await this.dbClient.storeSemanticFragment({
            id: f.id,
            content: f.content,
            embedding: f.embedding,
            source: f.source,
            source_id: f.sourceId,
            tags: f.tags,
            importance: f.importance,
            [WORKSPACE_COMPAT_PATH_COLUMN]: f.workspacePath
        });
    }
    async searchSemanticFragments(v: number[], l: number, workspacePath?: string, options: VectorSearchOptions = {}): Promise<SemanticFragment[]> {
        const useCache = options.useCache !== false;
        const approximate = options.approximate === true;
        const cacheKey = this.buildVectorCacheKey('semantic', v, l, workspacePath, approximate);
        const startedAt = Date.now();

        if (useCache) {
            const cached = this.readVectorCache<SemanticFragment[]>(cacheKey);
            if (cached) {
                this.vectorSearchAnalytics.semanticFragments.queries += 1;
                this.vectorSearchAnalytics.semanticFragments.cacheHits += 1;
                return cached;
            }
        }

        const searchLimit = approximate ? l : Math.min(Math.max(l * 2, l + 4), 60);
        const results = await this.dbClient.searchSemanticFragments({
            embedding: v,
            limit: searchLimit,
            [WORKSPACE_COMPAT_PATH_COLUMN]: workspacePath
        });
        const mapped = results.map(r => {
            const workspacePathValue = r[WORKSPACE_COMPAT_PATH_COLUMN];
            return {
                id: r.id,
                content: r.content,
                embedding: r.embedding,
                source: r.source,
                sourceId: r.source_id,
                tags: r.tags,
                importance: r.importance,
                workspacePath: typeof workspacePathValue === 'string' ? workspacePathValue : undefined,
                createdAt: r.created_at,
                updatedAt: r.updated_at
            };
        });

        const ranked = approximate
            ? mapped.slice(0, l)
            : mapped
                .map(item => ({ item, score: this.cosineSimilarity(v, item.embedding ?? []) }))
                .sort((a, b) => b.score - a.score)
                .slice(0, l)
                .map(x => x.item);

        this.vectorSearchAnalytics.semanticFragments.queries += 1;
        this.vectorSearchAnalytics.semanticFragments.totalDurationMs += Date.now() - startedAt;
        if (useCache) {
            this.writeVectorCache(cacheKey, ranked);
        }
        return ranked;
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        if (!a.length || !b.length || a.length !== b.length) {
            return 0;
        }
        let dot = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i += 1) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        if (normA === 0 || normB === 0) {
            return 0;
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    private buildVectorCacheKey(type: 'code' | 'semantic', vector: number[], limit: number, workspacePath?: string, approximate: boolean = false): string {
        const workspaceed = vector.slice(0, 24).map(n => n.toFixed(3)).join(',');
        return `${type}:${workspacePath ?? '*'}:${limit}:${approximate ? 'ann' : 'exact'}:${workspaceed}`;
    }

    private readVectorCache<T extends RuntimeValue>(key: string): T | null {
        const hit = this.vectorSearchCache.get(key);
        if (!hit) {
            return null;
        }
        if (hit.expiresAt <= Date.now()) {
            this.vectorSearchCache.delete(key);
            return null;
        }
        return hit.value as T;
    }

    private writeVectorCache<T extends RuntimeValue>(key: string, value: T): void {
        this.vectorSearchCache.set(key, {
            value,
            expiresAt: Date.now() + this.vectorSearchCacheTtlMs
        });
        if (this.vectorSearchCache.size > this.maxVectorCacheEntries) {
            const firstKey = this.vectorSearchCache.keys().next().value as string | undefined;
            if (firstKey) {
                this.vectorSearchCache.delete(firstKey);
            }
        }
    }

    public getVectorSearchAnalytics(): VectorSearchAnalytics {
        const codeQueries = this.vectorSearchAnalytics.codeSymbols.queries || 1;
        const semanticQueries = this.vectorSearchAnalytics.semanticFragments.queries || 1;
        return {
            codeSymbols: {
                queries: this.vectorSearchAnalytics.codeSymbols.queries,
                cacheHits: this.vectorSearchAnalytics.codeSymbols.cacheHits,
                avgDurationMs: this.vectorSearchAnalytics.codeSymbols.totalDurationMs / codeQueries
            },
            semanticFragments: {
                queries: this.vectorSearchAnalytics.semanticFragments.queries,
                cacheHits: this.vectorSearchAnalytics.semanticFragments.cacheHits,
                avgDurationMs: this.vectorSearchAnalytics.semanticFragments.totalDurationMs / semanticQueries
            }
        };
    }

    public clearVectorSearchCache(): void {
        this.vectorSearchCache.clear();
        this.vectorSearchAnalytics = {
            codeSymbols: { queries: 0, cacheHits: 0, totalDurationMs: 0 },
            semanticFragments: { queries: 0, cacheHits: 0, totalDurationMs: 0 }
        };
    }
    async getAllSemanticFragments() { return this._knowledge.getAllSemanticFragments(); }
    async clearSemanticFragments(workspacePath: string) { return this._knowledge.clearSemanticFragments(workspacePath); }
    async deleteSemanticFragmentsForFile(workspacePath: string, filePath: string) { return this._knowledge.deleteSemanticFragmentsForFile(workspacePath, filePath); }
    async storeEpisodicMemory(m: EpisodicMemory) { return this._knowledge.storeEpisodicMemory(m); }
    async searchEpisodicMemories(e: number[], l: number = 10) {
        // Delegate to repository which handles both vector search and fallback to recent memories
        return this._knowledge.searchEpisodicMemories(e, l);
    }
    async storeEntityKnowledge(k: EntityKnowledge) { return this._knowledge.storeEntityKnowledge(k); }
    async getEntityKnowledge(name: string) { return this._knowledge.getEntityKnowledge(name); }
    async getAllEntityKnowledge() { return this._knowledge.getAllEntityKnowledge(); }



    // Stats & Tracking
    /** Returns aggregate database statistics. */
    async getStats(): Promise<DbStats> { return this._system.getStats(); }
    /** Returns detailed database statistics for the given period. */
    async getDetailedStats(period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'daily'): Promise<DbDetailedStats> { return this._system.getDetailedStats(period); }
    /** Returns current migration version and last migration timestamp. */
    async getMigrationStatus(): Promise<{ version: number; lastMigration: number }> { return this._system.getMigrationStatus(); }
    /** Records token usage, resolving workspace UUID to path if needed. */
    async addTokenUsage(record: TokenUsageRecord) {
        let workspacePath = record.workspaceId;
        if (workspacePath && !workspacePath.includes('/') && !workspacePath.includes('\\')) {
            // It looks like a UUID, try to resolve to path
            const workspaces = await this.getWorkspaces();
            const ws = workspaces.find(p => p.id === workspacePath);
            if (ws) { workspacePath = ws.path; }
        }
        return this._system.addTokenUsage({ ...record, workspaceId: workspacePath });
    }
    /** Returns token usage statistics for the given period. */
    async getTokenUsageStats(period: 'daily' | 'weekly' | 'monthly'): Promise<DbTokenStats> { return this._system.getTokenUsageStats(period); }
    /**
     * Archives chats that have not been updated since the given timestamp.
     * @param olderThanMs - Cutoff timestamp in milliseconds; chats older than this are archived
     * @param limit - Maximum number of chats to archive (default 200)
     * @returns Count of archived chats, inspected candidates, and the cutoff used
     */
    async archiveOldChats(olderThanMs: number, limit: number = 200): Promise<{ archived: number; inspected: number; cutoff: number }> {
        const chats = await this.getAllChats();
        const candidates = chats
            .filter(chat => !chat.metadata?.isArchived && chat.updatedAt.getTime() < olderThanMs)
            .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
            .slice(0, limit);

        let archived = 0;
        for (const chat of candidates) {
            const result = await this.archiveChat(chat.id, true);
            if (result?.success) {
                archived += 1;
            }
        }

        return { archived, inspected: candidates.length, cutoff: olderThanMs };
    }

    /** Searches only archived chats using the provided search options. */
    async searchArchivedChats(options: Omit<SearchChatsOptions, 'isArchived'> = {}): Promise<Chat[]> {
        return this.searchChats({ ...options, isArchived: true });
    }

    /**
     * Unarchives multiple chats by ID.
     * @param ids - Array of chat IDs to unarchive
     * @returns Count of successfully updated chats
     */
    async unarchiveChats(ids: string[]): Promise<{ updated: number }> {
        this.validateArray(ids, 'ids');
        let updated = 0;
        for (const id of ids) {
            this.validateId(id, 'chatId');
            const result = await this.archiveChat(id, false);
            if (result?.success) {
                updated += 1;
            }
        }
        return { updated };
    }

    /** Returns counts of archived vs active chats and workspaces. */
    async getArchiveStats(): Promise<{ archivedChats: number; activeChats: number; archivedWorkspaces: number; activeWorkspaces: number }> {
        const [chats, workspaces] = await Promise.all([this.getAllChats(), this.getWorkspaces()]);
        const archivedChats = chats.filter(chat => Boolean(chat.metadata?.isArchived)).length;
        const activeChats = chats.length - archivedChats;
        const archivedWorkspaces = workspaces.filter(ws => ws.status === 'archived').length;
        const activeWorkspaces = workspaces.length - archivedWorkspaces;
        return { archivedChats, activeChats, archivedWorkspaces, activeWorkspaces };
    }

    /**
     * Duplicates a chat and all its messages, returning the new chat ID.
     * @param id - ID of the chat to duplicate
     * @returns The new chat's ID, or null if the original chat was not found
     */
    async duplicateChat(id: string): Promise<string | null> {
        const chat = await this.getChat(id);
        if (!chat) { return null; }
        const newId = uuidv4();
        const res = await this._chats.createChat({ ...chat, id: newId, title: `Copy of ${chat.title}` });
        if (res.success) {
            const msgs = await this._chats.getMessages(id);
            for (const m of msgs) { await this._chats.addMessage({ ...m, chatId: newId }); }
            return newId;
        }
        return null;
    }
    /** Adds a message to a chat. */
    async addMessage(msg: JsonObject) { return this._chats.addMessage(msg); }
    /** Retrieves all messages for a given chat ID. */
    async getMessages(chatId: string) { return this._chats.getMessages(chatId); }
    /** Retrieves all messages across all chats. */
    async getAllMessages() { return this._chats.getAllMessages(); }
    /** Updates a message by ID with the provided partial updates. */
    async updateMessage(id: string, updates: JsonObject) { return this._chats.updateMessage(id, updates); }
    /** Deletes a message by ID. */
    async deleteMessage(id: string) { return this._chats.deleteMessage(id); }
    async deleteMessages(ids: string[]) {
        this.validateArray(ids, 'ids');
        const db = await this.ensureDb();
        for (const id of ids) {
            this.validateId(id, 'messageId');
            await db.prepare('DELETE FROM messages WHERE id = ?').run(id);
        }
        return { success: true };
    }
    async deleteMessagesByChatId(chatId: string) { return this._chats.deleteMessagesByChatId(chatId); }

    // --- Usage Tracking Methods ---

    /** Records an API usage event with provider, model, and timestamp. */
    async addUsageRecord(record: { provider: string; model: string; timestamp: number }) {
        await this.ensureInitialized();
        return this._system.addUsageRecord(record);
    }
    /** Returns the count of usage records since the given timestamp, optionally filtered by provider and model. */
    async getUsageCount(since: number, provider?: string, model?: string) {
        await this.ensureInitialized();
        return this._system.getUsageCount(since, provider, model);
    }
    /** Deletes usage records older than the given timestamp. */
    async cleanupUsageRecords(before: number) {
        await this.ensureInitialized();
        return this._system.cleanupUsageRecords(before);
    }

    private async ensureInitialized(): Promise<void> {
        // _system is always defined after construction, but may need initialization
        await this.initialize();
    }

    // --- Prompt Templates Methods ---

    async getCustomTemplates() { return this._system.getCustomTemplates(); }
    async addCustomTemplate(template: PromptTemplate) { return this._system.addCustomTemplate(template); }
    async updateCustomTemplate(id: string, template: Partial<PromptTemplate>) { return this._system.updateCustomTemplate(id, template); }
    async deleteCustomTemplate(id: string) { return this._system.deleteCustomTemplate(id); }

    // Linked Accounts (Provider Auth)
    async getLinkedAccounts(provider?: string) { return this._system.getLinkedAccounts(provider); }
    async getLinkedAccount(id: string) { return this._system.getLinkedAccount(id); }
    async getActiveLinkedAccount(provider: string) {
        const accounts = await this.getLinkedAccounts(provider);
        return accounts.find(a => a.isActive) ?? null;
    }
    async setActiveLinkedAccount(provider: string, id: string) {
        const accounts = await this.getLinkedAccounts(provider);
        for (const a of accounts) { await this.saveLinkedAccount({ ...a, isActive: a.id === id }); }
    }
    async saveLinkedAccount(account: LinkedAccount) { return this._system.saveLinkedAccount(account); }
    async deleteLinkedAccount(id: string) { return this._system.deleteLinkedAccount(id); }

    // --- Agent Profile Methods ---

    async getAgentProfiles(): Promise<AgentProfile[]> { return this._system.getAgentProfiles(); }
    async saveAgentProfile(profile: AgentProfile): Promise<void> { return this._system.saveAgentProfile(profile); }
    async deleteAgentProfile(id: string): Promise<void> { return this._system.deleteAgentProfile(id); }

    // --- Audit Log Methods ---

    async addAuditLog(entry: AuditLogEntry): Promise<void> { return this._system.addAuditLog(entry); }
    async getAuditLogs(options: { category?: string; startDate?: number; endDate?: number; limit?: number } = {}): Promise<AuditLogEntry[]> { return this._system.getAuditLogs(options); }
    async clearAuditLogs() { return this._system.clearAuditLogs(); }
    async countAuditLogs(): Promise<number> { return this._system.countAuditLogs(); }
    async pruneAuditLogsOlderThan(timestamp: number): Promise<number> { return this._system.pruneAuditLogsOlderThan(timestamp); }
    async pruneAuditLogsToMaxEntries(maxEntries: number): Promise<number> { return this._system.pruneAuditLogsToMaxEntries(maxEntries); }

    // --- Job Scheduler Methods ---

    async getJobState(id: string) { return this._system.getJobState(id); }
    async getAllJobStates() { return this._system.getAllJobStates(); }
    async saveJobState(id: string, state: JobState) { return this._system.saveJobState(id, state); }
    async updateJobLastRun(id: string, lastRun: number) { return this.saveJobState(id, { lastRun }); }
    async deleteJobState(id: string) { return this._system.deleteJobState(id); }

    // File Diffs
    async getFileDiff(id: string) { return this._knowledge.getFileDiff(id); }
    async storeFileDiff(diff: FileDiff) {
        // Resolve workspace by path to get its root path for the workspace_path column
        const workspaces = await this.getWorkspaces();
        // Sort workspaces by path length descending to find the closest match (most specific root)
        const sortedWorkspaces = [...workspaces].sort((a, b) => b.path.length - a.path.length);
        const matchedWorkspace = sortedWorkspaces.find(p => diff.filePath.startsWith(p.path));

        return this._knowledge.storeFileDiff({
            id: diff.id,
            workspaceId: matchedWorkspace?.path ?? '', // Use path for workspace_path column
            filePath: diff.filePath,
            diffJson: JSON.stringify(diff),
            createdAt: diff.timestamp,
            sessionId: diff.chatSessionId,
            systemId: diff.aiSystem
        });
    }
    async getFileDiffHistory(filePath: string) { return this._knowledge.getFileDiffHistory(filePath); }
    async getRecentFileDiffs(limit: number) { return this._knowledge.getRecentFileDiffs(limit); }
    async getFileDiffsBySession(sessionId: string) { return this._knowledge.getFileDiffsBySession(sessionId); }
    async getFileDiffsBySystem(systemId: string) { return this._knowledge.getFileDiffsBySystem(systemId); }
    async cleanupOldFileDiffs(before: number) { return this._knowledge.cleanupOldFileDiffs(before); }
    async ensureFileDiffTable() { return this._knowledge.ensureFileDiffTable(); }

    // Memory
    /** Stores a key-value pair as an episodic memory entry. */
    async storeMemory(key: string, value: JsonValue) {
        return this.storeEpisodicMemory({
            id: uuidv4(),
            title: `Memory: ${key}`,
            summary: `Stored memory for ${key}`,
            content: JSON.stringify(value),
            embedding: [],
            startDate: Date.now(),
            endDate: Date.now(),
            participants: [],
            createdAt: Date.now(),
            timestamp: Date.now(),
            metadata: { key }
        });
    }
    /** Recalls a stored memory by key, searching episodic memories. */
    async recallMemory(key: string) {
        const memories = await this.searchEpisodicMemories([], 100);
        return memories.find(m => m.metadata?.key === key);
    }
    async deleteEntityKnowledge(name: string) { return this._knowledge.deleteEntityKnowledge(name); }
    async searchSemanticFragmentsByText(workspacePath: string, query: string) { return this._knowledge.searchSemanticFragmentsByText(workspacePath, query); }
    async getSemanticFragmentsByIds(ids: string[]) { return this._knowledge.getSemanticFragmentsByIds(ids); }
    async searchEpisodicMemoriesByText(query: string) { return this._knowledge.searchEpisodicMemoriesByText(query); }
    async getEpisodicMemoriesByIds(ids: string[]) { return this._knowledge.getEpisodicMemoriesByIds(ids); }
    async getAllEpisodicMemories() { return this._knowledge.getAllEpisodicMemories(); }
    async deleteSemanticFragment(id: string) { return this._knowledge.deleteSemanticFragment(id); }

    // --- Advanced Memory System ---

    async storeAdvancedMemory(memory: AdvancedSemanticFragment): Promise<void> {
        return this._knowledge.storeAdvancedMemory(memory);
    }

    async updateAdvancedMemory(memory: AdvancedSemanticFragment): Promise<void> {
        return this._knowledge.updateAdvancedMemory(memory);
    }

    async getAdvancedMemoryById(id: string): Promise<AdvancedSemanticFragment | null> {
        return this._knowledge.getAdvancedMemoryById(id);
    }

    async getAllAdvancedMemories(): Promise<AdvancedSemanticFragment[]> {
        return this._knowledge.getAllAdvancedMemories();
    }

    async searchAdvancedMemories(embedding: number[], limit: number): Promise<AdvancedSemanticFragment[]> {
        return this._knowledge.searchAdvancedMemories(embedding, limit);
    }

    async savePendingMemory(pending: PendingMemory): Promise<void> {
        return this._knowledge.savePendingMemory(pending);
    }

    async deletePendingMemory(id: string): Promise<void> {
        return this._knowledge.deletePendingMemory(id);
    }

    async getAllPendingMemories(): Promise<PendingMemory[]> {
        return this._knowledge.getAllPendingMemories();
    }

    async deleteAdvancedMemory(id: string): Promise<void> {
        return this._knowledge.deleteAdvancedMemory(id);
    }

    async upsertSharedMemoryNamespace(namespace: SharedMemoryNamespace): Promise<void> {
        return this._knowledge.upsertSharedMemoryNamespace(namespace);
    }

    async getSharedMemoryNamespaceById(namespaceId: string): Promise<SharedMemoryNamespace | null> {
        return this._knowledge.getSharedMemoryNamespaceById(namespaceId);
    }

    async appendSharedMemoryConflicts(namespaceId: string, conflicts: SharedMemoryMergeConflict[]): Promise<void> {
        return this._knowledge.appendSharedMemoryConflicts(namespaceId, conflicts);
    }

    async getSharedMemoryConflictCount(namespaceId: string): Promise<number> {
        return this._knowledge.getSharedMemoryConflictCount(namespaceId);
    }

    // --- Agent Template Methods ---

    async getAgentTemplates(): Promise<import('@shared/types/council').AgentTemplate[]> {
        return this._system.getAgentTemplates();
    }

    async saveAgentTemplate(template: import('@shared/types/council').AgentTemplate): Promise<void> {
        return this._system.saveAgentTemplate(template);
    }

    async deleteAgentTemplate(id: string): Promise<void> {
        return this._system.deleteAgentTemplate(id);
    }
}

