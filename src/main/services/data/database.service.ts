import * as fs from 'fs';
import * as path from 'path';

import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { appLogger } from '@main/logging/logger';
import { AuditLogEntry } from '@main/services/analysis/audit-log.service';
import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import { MigrationManager } from '@main/services/data/db-migration.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JobState } from '@main/services/system/job-scheduler.service';
import { PromptTemplate } from '@main/utils/prompt-templates.util';
import { CouncilSessionStatus } from '@shared/types/agent';
import { IpcValue, JsonObject, JsonValue } from '@shared/types/common';
import { DatabaseAdapter, SqlParams, SqlValue } from '@shared/types/database';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { v4 as uuidv4 } from 'uuid';

export type { AuditLogEntry, JobState, PromptTemplate };
import { FileDiff } from '@shared/types/file-diff';

import { ChatRepository } from './repositories/chat.repository';
import { KnowledgeRepository } from './repositories/knowledge.repository';
import { ProjectRepository } from './repositories/project.repository';
import { SystemRepository } from './repositories/system.repository';
import { getMigrationDefinitions } from './migrations';

interface TransactionLike {
    query: (sql: string, params?: SqlValue[], options?: Record<string, SqlValue>) => Promise<{ rows: JsonObject[]; fields: { name: string; dataTypeID: number }[]; affectedRows?: number }>;
    exec: (sql: string) => Promise<void>;
}




/**
 * LinkedAccount represents a single authenticated account for a provider.
 * This is the new simplified schema that replaces the auth_accounts + auth_tokens dual-table structure.
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
    projectId?: string;
    provider: string;
    model: string;
    tokensSent: number;
    tokensReceived: number;
    costEstimate?: number;
    timestamp?: number;
}

// Re-export interfaces from previous implementation (copy-pasted for clarity/continuity)
export interface Folder { id: string; name: string; color?: string | undefined; createdAt: number; updatedAt: number; }
export interface Prompt { id: string; title: string; content: string; tags: string[]; createdAt: number; updatedAt: number; }
export interface ChatMessage { role: string; content: string; timestamp?: number; vector?: number[];[key: string]: JsonValue | undefined }
export interface SemanticFragment { id: string; content: string; embedding: number[]; source: string; sourceId: string; tags: string[]; importance: number; projectId?: string | undefined; createdAt: number; updatedAt: number;[key: string]: JsonValue | undefined }
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
export interface CouncilLog { id: string; sessionId: string; agentId: string; message: string; timestamp: number; type: 'info' | 'error' | 'success' | 'plan' | 'action' | 'thought' | 'result' }
export interface AgentProfile { id: string; name: string; role: string; bio?: string; avatar?: string; description?: string }
export interface CouncilSession { id: string; goal: string; status: CouncilSessionStatus; logs: CouncilLog[]; agents: AgentProfile[]; plan?: string | undefined; solution?: string | undefined; createdAt: number; updatedAt: number; model?: string; provider?: string; }
import { Project } from '@shared/types/project';

export interface Chat { id: string; title: string; model?: string | undefined; messages: JsonObject[]; createdAt: Date; updatedAt: Date; isPinned?: boolean | undefined; isFavorite?: boolean | undefined; folderId?: string | undefined; projectId?: string | undefined; isGenerating?: boolean | undefined; backend?: string | undefined; metadata?: JsonObject | undefined; }
// Need to import WorkspaceMount properly or redefine it matching shared/types/workspace
// Assuming local redefinition or import if accessible. Importing 'WorkspaceMount' was in original.

export interface CodeSymbolSearchResult { id: string; name: string; path: string; line: number; kind: string; signature: string; docstring: string; score?: number; }
export interface CodeSymbolRecord { id: string; project_path?: string; projectId?: string; file_path?: string; name: string; path?: string; line: number; kind: string; signature?: string; docstring?: string; embedding?: number[]; vector?: number[]; }



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

export class DatabaseService extends BaseService {
    private db: PGlite | null = null;
    private dbPath: string;
    private initPromise: Promise<void> | null = null;
    private initError: Error | null = null;
    private isTest: boolean = false;
    private foldersPath: string;
    private promptsPath: string;
    private councilPath: string;
    private projectsPath: string;
    private chatsPath: string;
    private messagesPath: string;

    private _chats!: ChatRepository;
    private _projects!: ProjectRepository;
    private _knowledge!: KnowledgeRepository;
    private _system!: SystemRepository;

    get chats() { return this._chats; }
    get projects() { return this._projects; }
    get knowledge() { return this._knowledge; }
    get system() { return this._system; }

    constructor(
        private dataService: DataService,
        private eventBus: EventBusService
    ) {
        super('DatabaseService');
        this.isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
        // Use a subdirectory 'pg_data' to keep Postgres files separate
        this.dbPath = path.join(this.dataService.getPath('db'), 'pg_data');

        // Legacy paths for migration
        this.foldersPath = path.join(this.dataService.getPath('db'), 'folders.json');
        this.promptsPath = path.join(this.dataService.getPath('db'), 'prompts.json');
        this.councilPath = path.join(this.dataService.getPath('db'), 'council.json');
        this.projectsPath = path.join(this.dataService.getPath('db'), 'projects.json');
        this.chatsPath = path.join(this.dataService.getPath('db'), 'chats.json');
        this.messagesPath = path.join(this.dataService.getPath('db'), 'messages.json');
    }

    override async initialize(): Promise<void> {
        if (this.initPromise) {
            return this.initPromise;
        }
        this.initPromise = this.initDatabase();
        return this.initPromise;
    }

    private async initDatabase() {
        try {
            const effectivePath = this.isTest ? undefined : this.dbPath;

            appLogger.info('DatabaseService', `Initializing at ${effectivePath ?? 'memory'}`);

            // Ensure directory exists only if not in-memory
            if (effectivePath) {
                try {
                    await fs.promises.access(effectivePath);
                } catch {
                    await fs.promises.mkdir(effectivePath, { recursive: true });
                }
            }

            this.db = new PGlite(effectivePath, {
                ...(this.isTest ? {} : { extensions: { vector } })
            });
            await this.db.waitReady;

            const adapter = this.createAdapter();
            this._chats = new ChatRepository(adapter);
            this._projects = new ProjectRepository(adapter);
            this._knowledge = new KnowledgeRepository(adapter);
            this._system = new SystemRepository(adapter);

            // Enable vector extension if not in test
            if (!this.isTest) {
                await this.db.query('CREATE EXTENSION IF NOT EXISTS vector');
            }

            await this.runMigrations();

            // Migrate legacy JSON data to Postgres tables
            await this.migrateLegacyJsonData();

            appLogger.info('DatabaseService', 'Initialization complete!');
            this.eventBus.emit('db:ready', { timestamp: Date.now() });
        } catch (error) {
            appLogger.error('DatabaseService', 'Failed to initialize PGlite:', error as Error);
            this.initError = error instanceof Error ? error : new Error(String(error));
            this.eventBus.emit('db:error', { error: this.initError.message });
            this.db = null;
            throw this.initError;
        }
    }

    private async ensureDb(): Promise<DatabaseAdapter> {
        if (this.initPromise) {
            await this.initPromise;
        }
        if (!this.db) {
            appLogger.error('DatabaseService', `Database not initialized. Reason: ${this.initError?.message ?? 'unknown'}`);
            throw new Error(`Database not initialized. Reason: ${this.initError?.message ?? 'unknown'}`);
        }
        return this.createAdapter();
    }

    public async query<T = unknown>(sql: string, params?: SqlParams) {
        const adapter = await this.ensureDb();
        return await adapter.query<T>(sql, params);
    }

    public async exec(sql: string) {
        const adapter = await this.ensureDb();
        await adapter.exec(sql);
    }

    public async prepare(sql: string) {
        const adapter = await this.ensureDb();
        return adapter.prepare(sql);
    }

    // Create a compatible adapter for MigrationManager and internal usage
    private createAdapter(): DatabaseAdapter {
        if (!this.db) { throw new Error('DB not ready'); }
        const db = this.db;

        return {
            query: async <T = JsonObject>(sql: string, params?: SqlParams) => {
                const safeParams = params?.map(p => p === undefined ? null : p);
                const res = await db.query<T>(sql, safeParams);
                return { rows: res.rows as unknown as T[], fields: res.fields };
            },
            exec: async (sql) => { await db.exec(sql); },
            transaction: <T>(fn: (tx: DatabaseAdapter) => Promise<T>) => {
                return db.transaction(async (tx) => {
                    const txAdapter = this.createAdapterFromTx(tx as unknown as TransactionLike);
                    return await fn(txAdapter);
                });
            },
            prepare: (sql: string) => {
                const normalized = this.normalizeSql(sql);
                return {
                    run: async (...params: SqlValue[]) => {
                        const safeParams = params.map(p => p === undefined ? null : p);
                        const res = await db.query(normalized, safeParams);
                        return { rowsAffected: res.affectedRows, insertId: undefined };
                    },
                    all: async <T = unknown>(...params: SqlValue[]) => {
                        const safeParams = params.map(p => p === undefined ? null : p);
                        const res = await db.query<T>(normalized, safeParams);
                        return res.rows;
                    },
                    get: async <T = unknown>(...params: SqlValue[]) => {
                        const safeParams = params.map(p => p === undefined ? null : p);
                        const res = await db.query<T>(normalized, safeParams);
                        return res.rows[0];
                    }
                };
            }
        };
    }

    private createAdapterFromTx(tx: TransactionLike): DatabaseAdapter {
        // Reuse the tx object directly as it matches the shape we need mostly,
        // but we need to wrap it to match DatabaseAdapter exactly.
        const txObj = tx;
        return {
            query: async <T = unknown>(sql: string, params?: SqlParams) => {
                const safeParams = params?.map(p => p === undefined ? null : p);
                const res = await txObj.query(sql, safeParams) as unknown as { rows: T[]; fields: { name: string; dataTypeID: number }[]; affectedRows?: number };
                return { rows: res.rows, fields: res.fields };
            },
            exec: async (sql) => { await txObj.exec(sql); },
            transaction: <T>(fn: (nestedTx: DatabaseAdapter) => Promise<T>) => {
                return fn(this.createAdapterFromTx(tx));
            },
            prepare: (sql: string) => {
                const normalized = this.normalizeSql(sql);
                return {
                    run: async (...params: SqlValue[]) => {
                        const safeParams = params.map(p => p === undefined ? null : p);
                        const res = await txObj.query(normalized, safeParams) as { affectedRows: number };
                        return { rowsAffected: res.affectedRows, insertId: undefined };
                    },
                    all: async <T = unknown>(...params: SqlValue[]) => {
                        const safeParams = params.map(p => p === undefined ? null : p);
                        const res = await txObj.query(normalized, safeParams) as unknown as { rows: T[] };
                        return res.rows;
                    },
                    get: async <T = unknown>(...params: SqlValue[]) => {
                        const safeParams = params.map(p => p === undefined ? null : p);
                        const res = await txObj.query(normalized, safeParams) as unknown as { rows: T[] };
                        return res.rows[0];
                    }
                };
            }
        };
    }

    private normalizeSql(sql: string): string {
        // If it looks like it has $1, $2, return as is
        if (/\$\d+/.test(sql)) { return sql; }
        let i = 1;
        return sql.replace(/\?/g, () => `$${i++}`);
    }

    getDatabase(): DatabaseAdapter {
        // Return the adapter, not raw PGlite, to maintain API compatibility
        if (!this.db) { throw new Error('DB not initialized'); }
        return this.createAdapter();
    }

    private async runMigrations() {
        // IMPORTANT: Don't use ensureDb here - it waits for initPromise which would deadlock
        // since we're called FROM initDatabase which IS initPromise
        if (!this.db) {
            throw new Error('Cannot run migrations: db not ready');
        }
        const adapter = this.createAdapter();
        const manager = new MigrationManager(adapter);

        manager.registerAll(getMigrationDefinitions(this.isTest));

        await manager.migrate();
    }



    private async migrateLegacyJsonData() {
        if (!this.db) {
            appLogger.warn('DatabaseService', 'Cannot migrate legacy data: db not ready');
            return;
        }
        const db = this.createAdapter();

        await this.handleFolderMigration(db);
        await this.handlePromptMigration(db);
        await this.handleCouncilMigration(db);
        await this.handleProjectMigration(db);
        await this.handleChatMigration(db);
        await this.handleMessageMigration(db);
    }

    private async handleFolderMigration(db: DatabaseAdapter) {
        if (!fs.existsSync(this.foldersPath)) { return; }
        try {
            const content = await fs.promises.readFile(this.foldersPath, 'utf-8');
            const folders = safeJsonParse<Folder[]>(content, []);
            if (!Array.isArray(folders) || folders.length === 0) { return; }

            const count = await db.prepare('SELECT COUNT(*) as c FROM folders').get() as { c: number };
            if (Number(count.c) !== 0) { return; }

            for (const f of folders) {
                await db.prepare('INSERT INTO folders (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
                    f.id, f.name, f.color ?? null, f.createdAt, f.updatedAt
                );
            }
            await fs.promises.rename(this.foldersPath, `${this.foldersPath}.migrated`);
        } catch (error) {
            appLogger.error('DatabaseService', 'Failed migration folders', error as Error);
        }
    }

    private async handlePromptMigration(db: DatabaseAdapter) {
        if (!fs.existsSync(this.promptsPath)) { return; }
        try {
            const content = await fs.promises.readFile(this.promptsPath, 'utf-8');
            const prompts = safeJsonParse<Prompt[]>(content, []);
            if (!Array.isArray(prompts) || prompts.length === 0) { return; }

            const count = await db.prepare('SELECT COUNT(*) as c FROM prompts').get() as { c: number };
            if (Number(count.c) !== 0) { return; }

            for (const p of prompts) {
                await db.prepare('INSERT INTO prompts (id, title, content, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
                    p.id, p.title, p.content, JSON.stringify(p.tags), p.createdAt, p.updatedAt
                );
            }
            await fs.promises.rename(this.promptsPath, `${this.promptsPath}.migrated`);
        } catch (error) {
            appLogger.error('DatabaseService', 'Failed migration prompts', error as Error);
        }
    }

    private async handleCouncilMigration(db: DatabaseAdapter) {
        if (!fs.existsSync(this.councilPath)) { return; }
        try {
            const content = await fs.promises.readFile(this.councilPath, 'utf-8');
            const sessions = safeJsonParse<CouncilSession[]>(content, []);
            if (!Array.isArray(sessions) || sessions.length === 0) { return; }

            const count = await db.prepare('SELECT COUNT(*) as c FROM council_sessions').get() as { c: number };
            if (Number(count.c) !== 0) { return; }

            for (const s of sessions) {
                await db.prepare('INSERT INTO council_sessions (id, goal, status, logs, agents, plan, solution, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
                    s.id, s.goal, s.status, JSON.stringify(s.logs), JSON.stringify(s.agents), s.plan ?? null, s.solution ?? null, s.createdAt, s.updatedAt
                );
            }
            await fs.promises.rename(this.councilPath, `${this.councilPath}.migrated`);
        } catch (error) {
            appLogger.error('DatabaseService', 'Failed migration council', error as Error);
        }
    }

    private async handleProjectMigration(db: DatabaseAdapter) {
        if (!fs.existsSync(this.projectsPath)) { return; }
        try {
            const countP = await db.prepare('SELECT COUNT(*) as c FROM projects').get() as { c: number };
            if (Number(countP.c) !== 0) { return; }

            const content = await fs.promises.readFile(this.projectsPath, 'utf-8');
            const projects = safeJsonParse<Project[]>(content, []);
            if (!Array.isArray(projects) || projects.length === 0) { return; }

            for (const p of projects) {
                await db.prepare(`
                    INSERT INTO projects(id, title, description, path, mounts, chat_ids, council_config, status, metadata, created_at, updated_at)
                    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    p.id, p.title, p.description, p.path,
                    JSON.stringify(p.mounts), JSON.stringify(p.chatIds), JSON.stringify(p.councilConfig),
                    p.status, JSON.stringify(p.metadata), p.createdAt, p.updatedAt
                );
            }
            await fs.promises.rename(this.projectsPath, `${this.projectsPath}.migrated`);
        } catch (error) {
            appLogger.error('DatabaseService', 'Failed migration projects', error as Error);
        }
    }

    private async handleChatMigration(db: DatabaseAdapter) {
        if (!fs.existsSync(this.chatsPath)) { return; }
        try {
            const count = await db.prepare('SELECT COUNT(*) as c FROM chats').get() as { c: number };
            if (Number(count.c) !== 0) { return; }

            appLogger.info('DatabaseService', 'Migrating legacy chats...');
            const content = await fs.promises.readFile(this.chatsPath, 'utf-8');
            const chats = safeJsonParse<JsonObject[]>(content, []);
            if (!Array.isArray(chats) || chats.length === 0) { return; }

            for (const c of chats) {
                await this.migrateSingleChat(db, c);
            }
            await fs.promises.rename(this.chatsPath, `${this.chatsPath}.migrated`);
            appLogger.info('DatabaseService', `Migrated ${chats.length} chats.`);
        } catch (error) {
            appLogger.error('DatabaseService', 'Failed migration chats', error as Error);
        }
    }

    private async migrateSingleChat(db: DatabaseAdapter, c: JsonObject) {
        const id = String(c.id ?? '');
        if (!id) { return; }
        const values = this.getChatMigrationValues(c, id);
        await db.prepare(`
            INSERT INTO chats (id, title, model, backend, folder_id, project_id, is_pinned, is_favorite, is_archived, metadata, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(...values);
    }

    // eslint-disable-next-line complexity
    private getChatMigrationValues(c: JsonObject, id: string): SqlValue[] {
        return [
            id,
            String(c.title ?? 'Imported Chat'),
            String(c.model ?? ''),
            String(c.backend ?? 'unknown'),
            (c.folderId as string | null) ?? null,
            (c.projectId as string | null) ?? null,
            Number(c.isPinned ?? c.is_pinned ?? 0),
            Number(c.isFavorite ?? c.is_favorite ?? 0),
            Number(c.isArchived ?? c.is_archived ?? 0),
            JSON.stringify(c.metadata ?? {}),
            Number(c.createdAt ?? c.created_at ?? Date.now()),
            Number(c.updatedAt ?? c.updated_at ?? Date.now())
        ];
    }

    private async handleMessageMigration(db: DatabaseAdapter) {
        if (!fs.existsSync(this.messagesPath)) { return; }
        try {
            const count = await db.prepare('SELECT COUNT(*) as c FROM messages').get() as { c: number };
            if (Number(count.c) !== 0) { return; }

            appLogger.info('DatabaseService', 'Migrating legacy messages...');
            const content = await fs.promises.readFile(this.messagesPath, 'utf-8');
            const messages = safeJsonParse<JsonObject[]>(content, []);
            if (!Array.isArray(messages) || messages.length === 0) { return; }

            for (const m of messages) {
                await this.migrateSingleMessage(db, m);
            }
            await fs.promises.rename(this.messagesPath, `${this.messagesPath}.migrated`);
            appLogger.info('DatabaseService', `Migrated ${messages.length} messages.`);
        } catch (error) {
            appLogger.error('DatabaseService', 'Failed migration messages', error as Error);
        }
    }

    private async migrateSingleMessage(db: DatabaseAdapter, m: JsonObject) {
        const id = String(m.id ?? '');
        const chatId = String(m.chatId ?? m.chat_id ?? '');
        if (!id || !chatId) { return; }
        const values = this.getMessageMigrationValues(m, id, chatId);
        await db.prepare(`
            INSERT INTO messages (id, chat_id, role, content, timestamp, provider, model, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(...values);
    }

    private getMessageMigrationValues(m: JsonObject, id: string, chatId: string): SqlValue[] {
        return [
            id,
            chatId,
            String(m.role ?? 'user'),
            String(m.content ?? ''),
            Number(m.timestamp ?? Date.now()),
            (m.provider as string | null) ?? null,
            (m.model as string | null) ?? null,
            JSON.stringify(m.metadata ?? {})
        ];
    }

    // --- CRUD Implementations ---
    // (Examples showing how they adapt)

    // --- CRUD Delegations ---

    async hasData(): Promise<boolean> { return true; }

    // Folders
    async getFolders() { return this._system.getFolders(); }
    async getFolder(id: string) { return (await this.getFolders()).find(f => f.id === id); }
    async createFolder(name: string, color?: string) { return this._system.createFolder(name, color); }
    async updateFolder(id: string, updates: Partial<Folder>) { return this._system.updateFolder(id, updates); }
    async deleteFolder(id: string) { return this._system.deleteFolder(id); }

    // Prompts
    async getPrompts() { return this._system.getPrompts(); }
    async getPrompt(id: string) { return (await this.getPrompts()).find(p => p.id === id); }
    async createPrompt(title: string, content: string, tags: string[] = []) { return this._system.createPrompt(title, content, tags); }
    async updatePrompt(id: string, updates: Partial<Prompt>) { return this._system.updatePrompt(id, updates); }
    async deletePrompt(id: string) { return this._system.deletePrompt(id); }

    // Projects
    async getProjects() { return this._projects.getProjects(); }
    async getProject(id: string) { return this._projects.getProject(id); }
    async hasIndexedSymbols(projectId: string) { return this._projects.hasIndexedSymbols(projectId); }
    async createProject(title: string, path: string, desc: string = '', m?: string, c?: string) { return this._projects.createProject(title, path, desc, m, c); }
    async updateProject(id: string, updates: Partial<Project>) { return this._projects.updateProject(id, updates); }
    async deleteProject(id: string, deleteFiles: boolean = false) { return this._projects.deleteProject(id, deleteFiles); }
    async archiveProject(id: string, isArchived: boolean) { return this._projects.updateProject(id, { status: isArchived ? 'archived' : 'active' }); }
    async bulkDeleteProjects(ids: string[], deleteFiles: boolean = false) { for (const id of ids) { await this.deleteProject(id, deleteFiles); } }
    async bulkArchiveProjects(ids: string[], isArchived: boolean) { for (const id of ids) { await this.archiveProject(id, isArchived); } }

    // Chats & Messages
    async createChat(chat: Chat) { return this._chats.createChat(chat); }
    async getAllChats() { return this._chats.getAllChats(); }
    async getChat(id: string) { return this._chats.getChat(id); }
    async getChats(projectId?: string) { return this._chats.getChats(projectId); }
    async updateChat(id: string, updates: Partial<Chat>) { return this._chats.updateChat(id, updates); }
    async deleteChat(id: string) { return this._chats.deleteChat(id); }
    async archiveChat(id: string, isArchived: boolean) { return this._chats.updateChat(id, { metadata: { isArchived } }); }
    async getBookmarkedMessages() { return this._chats.getBookmarkedMessages(); }
    async searchChats(options: SearchChatsOptions) { return this._chats.searchChats(options); }
    async deleteAllChats() { return this._chats.deleteAllChats(); }
    async deleteChatsByTitle(title: string) { return this._chats.deleteChatsByTitle(title); }

    // Knowledge & Memories
    async findCodeSymbolsByName(projectId: string, name: string) { return this._knowledge.findCodeSymbolsByName(projectId, name); }
    async searchCodeSymbols(vec: number[]) { return this._knowledge.searchCodeSymbols(vec); }
    async storeCodeSymbol(symbol: CodeSymbolRecord) { return this._knowledge.storeCodeSymbol(symbol); }
    async clearCodeSymbols(projectId: string) { return this._knowledge.clearCodeSymbols(projectId); }
    async deleteCodeSymbolsForFile(projectId: string, filePath: string) { return this._knowledge.deleteCodeSymbolsForFile(projectId, filePath); }
    async searchCodeContentByText(projectId: string, query: string) { return this._knowledge.searchCodeContentByText(projectId, query); }
    async storeSemanticFragment(f: SemanticFragment) { return this._knowledge.storeSemanticFragment(f); }
    async searchSemanticFragments(v: number[], l: number) { return this._knowledge.searchSemanticFragments(v, l); }
    async getAllSemanticFragments() { return this._knowledge.getAllSemanticFragments(); }
    async clearSemanticFragments(projectId: string) { return this._knowledge.clearSemanticFragments(projectId); }
    async deleteSemanticFragmentsForFile(projectId: string, filePath: string) { return this._knowledge.deleteSemanticFragmentsForFile(projectId, filePath); }
    async storeEpisodicMemory(m: EpisodicMemory) { return this._knowledge.storeEpisodicMemory(m); }
    async searchEpisodicMemories(e: number[], l: number = 10) { return this._knowledge.searchEpisodicMemories(e, l); }
    async storeEntityKnowledge(k: EntityKnowledge) { return this._knowledge.storeEntityKnowledge(k); }
    async getEntityKnowledge(name: string) { return this._knowledge.getEntityKnowledge(name); }
    async getAllEntityKnowledge() { return this._knowledge.getAllEntityKnowledge(); }

    // Council Sessions
    async getCouncilSessions() { return this._system.getCouncilSessions(); }
    async createCouncilSession(goal: string, model?: string, provider?: string) { return this._system.createCouncilSession(goal, model, provider); }
    async getCouncilSession(id: string) { return this._system.getCouncilSession(id); }
    async updateCouncilStatus(id: string, status: string, plan?: string, solution?: string) { return this._system.updateCouncilStatus(id, status, plan, solution); }
    async addCouncilLog(id: string, aid: string, msg: string, type: string) { return this._system.addCouncilLog(id, aid, msg, type); }

    // Stats & Tracking
    async getStats() { return this._system.getStats(); }
    async getDetailedStats(period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'daily') { return this._system.getDetailedStats(period); }
    async getTimeStats() { return this._system.getTimeStats(); }
    async getMigrationStatus() { return this._system.getMigrationStatus(); }
    async addTokenUsage(record: TokenUsageRecord) { return this._system.addTokenUsage(record); }
    async getTokenUsageStats(period: 'daily' | 'weekly' | 'monthly') { return this._system.getTokenUsageStats(period); }
    async duplicateChat(id: string) {
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
    async addMessage(msg: JsonObject) { return this._chats.addMessage(msg); }
    async getMessages(chatId: string) { return this._chats.getMessages(chatId); }
    async getAllMessages() { return this._chats.getAllMessages(); }
    async updateMessage(id: string, updates: JsonObject) { return this._chats.updateMessage(id, updates); }
    async deleteMessage(id: string) { return this._chats.deleteMessage(id); }
    async deleteMessages(ids: string[]) {
        const db = await this.ensureDb();
        for (const id of ids) { await db.prepare('DELETE FROM messages WHERE id = ?').run(id); }
        return { success: true };
    }
    async deleteMessagesByChatId(chatId: string) { return this._chats.deleteMessagesByChatId(chatId); }

    // --- Usage Tracking Methods ---

    async addUsageRecord(record: { provider: string; model: string; timestamp: number }) { return this._system.addUsageRecord(record); }
    async getUsageCount(since: number, provider?: string, model?: string) { return this._system.getUsageCount(since, provider, model); }
    async cleanupUsageRecords(before: number) { return this._system.cleanupUsageRecords(before); }

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

    // --- Audit Log Methods ---

    async addAuditLog(entry: AuditLogEntry): Promise<void> { return this._system.addAuditLog(entry); }
    async getAuditLogs(options: { category?: string; startDate?: number; endDate?: number; limit?: number } = {}) { return this._system.getAuditLogs(options); }
    async clearAuditLogs() { return this._system.clearAuditLogs(); }

    // --- Job Scheduler Methods ---

    async getJobState(id: string) { return this._system.getJobState(id); }
    async getAllJobStates() { return this._system.getAllJobStates(); }
    async saveJobState(id: string, state: JobState) { return this._system.saveJobState(id, state); }
    async updateJobLastRun(id: string, lastRun: number) { return this.saveJobState(id, { lastRun }); }
    async deleteJobState(id: string) { return this._system.deleteJobState(id); }

    // File Diffs
    async getFileDiff(id: string) { return this._knowledge.getFileDiff(id); }
    async storeFileDiff(diff: FileDiff) {
        return this._knowledge.storeFileDiff({
            id: diff.id,
            projectId: '', // projectId not available in FileDiff
            filePath: diff.filePath,
            diffContent: diff.diffContent,
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
    async recallMemory(key: string) {
        const memories = await this.searchEpisodicMemories([], 100);
        return memories.find(m => m.metadata?.key === key);
    }
    async deleteEntityKnowledge(name: string) { return this._knowledge.deleteEntityKnowledge(name); }
    async searchSemanticFragmentsByText(projectId: string, query: string) { return this._knowledge.searchSemanticFragmentsByText(projectId, query); }
    async getSemanticFragmentsByIds(ids: string[]) { return this._knowledge.getSemanticFragmentsByIds(ids); }
    async searchEpisodicMemoriesByText(query: string) { return this._knowledge.searchEpisodicMemoriesByText(query); }
    async getEpisodicMemoriesByIds(ids: string[]) { return this._knowledge.getEpisodicMemoriesByIds(ids); }
    async getAllEpisodicMemories() { return this._knowledge.getAllEpisodicMemories(); }
    async deleteSemanticFragment(id: string) { return this._knowledge.deleteSemanticFragment(id); }

    // Helper
    private parseJsonField<T>(json: string | null | undefined, defaultValue: T): T {
        if (typeof json !== 'string' || json.trim() === '') { return defaultValue; }
        const parsed = safeJsonParse<unknown>(json, defaultValue);
        return (typeof parsed === 'string' ? safeJsonParse<T>(parsed, defaultValue) : parsed) as T;
    }
}
