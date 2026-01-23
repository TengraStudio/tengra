import * as fs from 'fs'
import * as path from 'path'

import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite/vector'
import { appLogger } from '@main/logging/logger'
import { AuditLogEntry } from '@main/services/analysis/audit-log.service'
import { BaseService } from '@main/services/base.service'
import { DataService } from '@main/services/data/data.service'
import { MigrationManager } from '@main/services/data/db-migration.service'
import { EventBusService } from '@main/services/system/event-bus.service'
import { JobState } from '@main/services/system/job-scheduler.service'
import { PromptTemplate } from '@main/utils/prompt-templates.util'
import { JsonObject, JsonValue } from '@shared/types/common'
import { DatabaseAdapter, SqlParams, SqlValue } from '@shared/types/database'
import { getErrorMessage } from '@shared/utils/error.util'
import { safeJsonParse } from '@shared/utils/sanitize.util'
import { v4 as uuidv4 } from 'uuid'

import { getMigrationDefinitions } from './migrations'

interface TransactionLike {
    query: (sql: string, params?: unknown[], options?: Record<string, unknown>) => Promise<unknown>;
    exec: (sql: string) => Promise<unknown>;
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

// Re-export interfaces from previous implementation (copy-pasted for clarity/continuity)
export interface Folder { id: string; name: string; color?: string | undefined; createdAt: number; updatedAt: number }
export interface Prompt { id: string; title: string; content: string; tags: string[]; createdAt: number; updatedAt: number }
export interface ChatMessage { role: string; content: string; timestamp?: number; vector?: number[];[key: string]: JsonValue | undefined }
export interface SemanticFragment { id: string; content: string; embedding: number[]; source: string; sourceId: string; tags: string[]; importance: number; projectId?: string | undefined; createdAt: number; updatedAt: number;[key: string]: JsonValue | undefined }
export interface EpisodicMemory { id: string; title: string; summary: string; embedding: number[]; startDate: number; endDate: number; chatId: string; participants: string[]; createdAt: number }
export interface EntityKnowledge { id: string; entityType: string; entityName: string; key: string; value: string; confidence: number; source: string; updatedAt: number }
export interface CouncilLog { id: string; sessionId: string; agentId: string; message: string; timestamp: number; type: 'info' | 'error' | 'success' | 'plan' | 'action' }
export interface AgentProfile { id: string; name: string; role: string; description: string }
export interface CouncilSession { id: string; goal: string; status: 'created' | 'planning' | 'executing' | 'reviewing' | 'completed' | 'failed'; logs: CouncilLog[]; agents: AgentProfile[]; plan?: string | undefined; solution?: string | undefined; createdAt: number; updatedAt: number }
import { Project } from '@shared/types/project'

export interface Chat { id: string; title: string; model?: string | undefined; messages: JsonObject[]; createdAt: Date; updatedAt: Date; isPinned?: boolean | undefined; isFavorite?: boolean | undefined; folderId?: string | undefined; projectId?: string | undefined; isGenerating?: boolean | undefined; backend?: string | undefined; metadata?: JsonObject | undefined }
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
    private db: PGlite | null = null
    private dbPath: string
    private initPromise: Promise<void> | null = null
    private initError: Error | null = null
    private isTest: boolean = false
    private foldersPath: string
    private promptsPath: string
    private councilPath: string
    private projectsPath: string
    private chatsPath: string
    private messagesPath: string

    constructor(
        private dataService: DataService,
        private eventBus: EventBusService
    ) {
        super('DatabaseService')
        this.isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'
        // Use a subdirectory 'pg_data' to keep Postgres files separate
        this.dbPath = path.join(this.dataService.getPath('db'), 'pg_data')

        // Legacy paths for migration
        this.foldersPath = path.join(this.dataService.getPath('db'), 'folders.json')
        this.promptsPath = path.join(this.dataService.getPath('db'), 'prompts.json')
        this.councilPath = path.join(this.dataService.getPath('db'), 'council.json')
        this.projectsPath = path.join(this.dataService.getPath('db'), 'projects.json')
        this.chatsPath = path.join(this.dataService.getPath('db'), 'chats.json')
        this.messagesPath = path.join(this.dataService.getPath('db'), 'messages.json')
    }

    override async initialize(): Promise<void> {
        if (this.initPromise) {
            return this.initPromise
        }
        this.initPromise = this.initDatabase()
        return this.initPromise
    }

    private async initDatabase() {
        try {
            const effectivePath = this.isTest ? undefined : this.dbPath

            appLogger.info('DatabaseService', `Initializing at ${effectivePath ?? 'memory'}`)

            // Ensure directory exists only if not in-memory
            if (effectivePath) {
                try {
                    await fs.promises.access(effectivePath)
                } catch {
                    await fs.promises.mkdir(effectivePath, { recursive: true })
                }
            }

            this.db = new PGlite(effectivePath, {
                ...(this.isTest ? {} : { extensions: { vector } })
            })
            await this.db.waitReady

            // Enable vector extension if not in test
            if (!this.isTest) {
                await this.db.query('CREATE EXTENSION IF NOT EXISTS vector')
            }

            await this.runMigrations()

            // Migrate legacy JSON data to Postgres tables
            await this.migrateLegacyJsonData()

            appLogger.info('DatabaseService', 'Initialization complete!')
            this.eventBus.emit('db:ready', { timestamp: Date.now() })
        } catch (error) {
            appLogger.error('DatabaseService', 'Failed to initialize PGlite:', error as Error)
            this.initError = error instanceof Error ? error : new Error(String(error))
            this.eventBus.emit('db:error', { error: this.initError.message })
            this.db = null
            throw this.initError
        }
    }

    private async ensureDb(): Promise<DatabaseAdapter> {
        if (this.initPromise) {
            await this.initPromise
        }
        if (!this.db) {
            appLogger.error('DatabaseService', `Database not initialized. Reason: ${this.initError?.message ?? 'unknown'}`)
            throw new Error(`Database not initialized. Reason: ${this.initError?.message ?? 'unknown'}`)
        }
        return this.createAdapter()
    }

    // Create a compatible adapter for MigrationManager and internal usage
    private createAdapter(): DatabaseAdapter {
        if (!this.db) { throw new Error('DB not ready') }
        const db = this.db

        return {
            query: async <T = unknown>(sql: string, params?: SqlParams) => {
                const safeParams = params?.map(p => p === undefined ? null : p)
                const res = await db.query<T>(sql, safeParams)
                return { rows: res.rows, fields: res.fields }
            },
            exec: async (sql) => { await db.exec(sql); },
            transaction: <T>(fn: (tx: DatabaseAdapter) => Promise<T>) => {
                return db.transaction(async (tx) => {
                    const txAdapter = this.createAdapterFromTx(tx as unknown as TransactionLike);
                    return await fn(txAdapter);
                })
            },
            prepare: (sql: string) => {
                const normalized = this.normalizeSql(sql)
                return {
                    run: async (...params: SqlValue[]) => {
                        const safeParams = params.map(p => p === undefined ? null : p)
                        const res = await db.query(normalized, safeParams)
                        return { rowsAffected: res.affectedRows, insertId: undefined }
                    },
                    all: async <T = unknown>(...params: SqlValue[]) => {
                        const safeParams = params.map(p => p === undefined ? null : p)
                        const res = await db.query<T>(normalized, safeParams)
                        return res.rows
                    },
                    get: async <T = unknown>(...params: SqlValue[]) => {
                        const safeParams = params.map(p => p === undefined ? null : p)
                        const res = await db.query<T>(normalized, safeParams)
                        return res.rows[0]
                    }
                }
            }
        }
    }

    private createAdapterFromTx(tx: TransactionLike): DatabaseAdapter {
        // Reuse the tx object directly as it matches the shape we need mostly,
        // but we need to wrap it to match DatabaseAdapter exactly.
        const txObj = tx;
        return {
            query: async <T = unknown>(sql: string, params?: SqlParams) => {
                const safeParams = params?.map(p => p === undefined ? null : p)
                const res = await txObj.query(sql, safeParams) as { rows: T[]; fields: { name: string; dataTypeID: number }[]; affectedRows?: number }
                return { rows: res.rows, fields: res.fields }
            },
            exec: async (sql) => { await txObj.exec(sql); },
            transaction: <T>(fn: (nestedTx: DatabaseAdapter) => Promise<T>) => {
                return fn(this.createAdapterFromTx(tx))
            },
            prepare: (sql: string) => {
                const normalized = this.normalizeSql(sql)
                return {
                    run: async (...params: SqlValue[]) => {
                        const safeParams = params.map(p => p === undefined ? null : p)
                        const res = await txObj.query(normalized, safeParams) as { affectedRows: number }
                        return { rowsAffected: res.affectedRows, insertId: undefined }
                    },
                    all: async <T = unknown>(...params: SqlValue[]) => {
                        const safeParams = params.map(p => p === undefined ? null : p)
                        const res = await txObj.query(normalized, safeParams) as { rows: T[] }
                        return res.rows
                    },
                    get: async <T = unknown>(...params: SqlValue[]) => {
                        const safeParams = params.map(p => p === undefined ? null : p)
                        const res = await txObj.query(normalized, safeParams) as { rows: T[] }
                        return res.rows[0]
                    }
                }
            }
        }
    }

    private normalizeSql(sql: string): string {
        // If it looks like it has $1, $2, return as is
        if (/\$\d+/.test(sql)) { return sql }
        let i = 1
        return sql.replace(/\?/g, () => `$${i++}`)
    }

    getDatabase(): DatabaseAdapter {
        // Return the adapter, not raw PGlite, to maintain API compatibility
        if (!this.db) { throw new Error('DB not initialized') }
        return this.createAdapter()
    }

    private async runMigrations() {
        // IMPORTANT: Don't use ensureDb here - it waits for initPromise which would deadlock
        // since we're called FROM initDatabase which IS initPromise
        if (!this.db) {
            throw new Error('Cannot run migrations: db not ready')
        }
        const adapter = this.createAdapter()
        const manager = new MigrationManager(adapter)

        manager.registerAll(getMigrationDefinitions(this.isTest))

        await manager.migrate()
    }



    private async migrateLegacyJsonData() {
        if (!this.db) {
            appLogger.warn('DatabaseService', 'Cannot migrate legacy data: db not ready')
            return
        }
        const db = this.createAdapter()

        await this.handleFolderMigration(db)
        await this.handlePromptMigration(db)
        await this.handleCouncilMigration(db)
        await this.handleProjectMigration(db)
        await this.handleChatMigration(db)
        await this.handleMessageMigration(db)
    }

    private async handleFolderMigration(db: DatabaseAdapter) {
        if (!fs.existsSync(this.foldersPath)) { return }
        try {
            const content = await fs.promises.readFile(this.foldersPath, 'utf-8')
            const folders = safeJsonParse<Folder[]>(content, [])
            if (!Array.isArray(folders) || folders.length === 0) { return }

            const count = await db.prepare('SELECT COUNT(*) as c FROM folders').get() as { c: number }
            if (Number(count.c) !== 0) { return }

            for (const f of folders) {
                await db.prepare('INSERT INTO folders (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
                    f.id, f.name, f.color ?? null, f.createdAt, f.updatedAt
                )
            }
            await fs.promises.rename(this.foldersPath, `${this.foldersPath}.migrated`)
        } catch (error) {
            appLogger.error('DatabaseService', 'Failed migration folders', error as Error)
        }
    }

    private async handlePromptMigration(db: DatabaseAdapter) {
        if (!fs.existsSync(this.promptsPath)) { return }
        try {
            const content = await fs.promises.readFile(this.promptsPath, 'utf-8')
            const prompts = safeJsonParse<Prompt[]>(content, [])
            if (!Array.isArray(prompts) || prompts.length === 0) { return }

            const count = await db.prepare('SELECT COUNT(*) as c FROM prompts').get() as { c: number }
            if (Number(count.c) !== 0) { return }

            for (const p of prompts) {
                await db.prepare('INSERT INTO prompts (id, title, content, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
                    p.id, p.title, p.content, JSON.stringify(p.tags), p.createdAt, p.updatedAt
                )
            }
            await fs.promises.rename(this.promptsPath, `${this.promptsPath}.migrated`)
        } catch (error) {
            appLogger.error('DatabaseService', 'Failed migration prompts', error as Error)
        }
    }

    private async handleCouncilMigration(db: DatabaseAdapter) {
        if (!fs.existsSync(this.councilPath)) { return }
        try {
            const content = await fs.promises.readFile(this.councilPath, 'utf-8')
            const sessions = safeJsonParse<CouncilSession[]>(content, [])
            if (!Array.isArray(sessions) || sessions.length === 0) { return }

            const count = await db.prepare('SELECT COUNT(*) as c FROM council_sessions').get() as { c: number }
            if (Number(count.c) !== 0) { return }

            for (const s of sessions) {
                await db.prepare('INSERT INTO council_sessions (id, goal, status, logs, agents, plan, solution, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
                    s.id, s.goal, s.status, JSON.stringify(s.logs), JSON.stringify(s.agents), s.plan ?? null, s.solution ?? null, s.createdAt, s.updatedAt
                )
            }
            await fs.promises.rename(this.councilPath, `${this.councilPath}.migrated`)
        } catch (error) {
            appLogger.error('DatabaseService', 'Failed migration council', error as Error)
        }
    }

    private async handleProjectMigration(db: DatabaseAdapter) {
        if (!fs.existsSync(this.projectsPath)) { return }
        try {
            const countP = await db.prepare('SELECT COUNT(*) as c FROM projects').get() as { c: number }
            if (Number(countP.c) !== 0) { return }

            const content = await fs.promises.readFile(this.projectsPath, 'utf-8')
            const projects = safeJsonParse<Project[]>(content, [])
            if (!Array.isArray(projects) || projects.length === 0) { return }

            for (const p of projects) {
                await db.prepare(`
                    INSERT INTO projects(id, title, description, path, mounts, chat_ids, council_config, status, metadata, created_at, updated_at)
                    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    p.id, p.title, p.description, p.path,
                    JSON.stringify(p.mounts), JSON.stringify(p.chatIds), JSON.stringify(p.councilConfig),
                    p.status, JSON.stringify(p.metadata), p.createdAt, p.updatedAt
                )
            }
            await fs.promises.rename(this.projectsPath, `${this.projectsPath}.migrated`)
        } catch (error) {
            appLogger.error('DatabaseService', 'Failed migration projects', error as Error)
        }
    }

    private async handleChatMigration(db: DatabaseAdapter) {
        if (!fs.existsSync(this.chatsPath)) { return }
        try {
            const count = await db.prepare('SELECT COUNT(*) as c FROM chats').get() as { c: number }
            if (Number(count.c) !== 0) { return }

            appLogger.info('DatabaseService', 'Migrating legacy chats...')
            const content = await fs.promises.readFile(this.chatsPath, 'utf-8')
            const chats = safeJsonParse<JsonObject[]>(content, [])
            if (!Array.isArray(chats) || chats.length === 0) { return }

            for (const c of chats) {
                await this.migrateSingleChat(db, c)
            }
            await fs.promises.rename(this.chatsPath, `${this.chatsPath}.migrated`)
            appLogger.info('DatabaseService', `Migrated ${chats.length} chats.`)
        } catch (error) {
            appLogger.error('DatabaseService', 'Failed migration chats', error as Error)
        }
    }

    private async migrateSingleChat(db: DatabaseAdapter, c: JsonObject) {
        const id = String(c.id ?? '')
        if (!id) { return }
        const values = this.getChatMigrationValues(c, id)
        await db.prepare(`
            INSERT INTO chats (id, title, model, backend, folder_id, project_id, is_pinned, is_favorite, is_archived, metadata, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(...values)
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
        ]
    }

    private async handleMessageMigration(db: DatabaseAdapter) {
        if (!fs.existsSync(this.messagesPath)) { return }
        try {
            const count = await db.prepare('SELECT COUNT(*) as c FROM messages').get() as { c: number }
            if (Number(count.c) !== 0) { return }

            appLogger.info('DatabaseService', 'Migrating legacy messages...')
            const content = await fs.promises.readFile(this.messagesPath, 'utf-8')
            const messages = safeJsonParse<JsonObject[]>(content, [])
            if (!Array.isArray(messages) || messages.length === 0) { return }

            for (const m of messages) {
                await this.migrateSingleMessage(db, m)
            }
            await fs.promises.rename(this.messagesPath, `${this.messagesPath}.migrated`)
            appLogger.info('DatabaseService', `Migrated ${messages.length} messages.`)
        } catch (error) {
            appLogger.error('DatabaseService', 'Failed migration messages', error as Error)
        }
    }

    private async migrateSingleMessage(db: DatabaseAdapter, m: JsonObject) {
        const id = String(m.id ?? '')
        const chatId = String(m.chatId ?? m.chat_id ?? '')
        if (!id || !chatId) { return }
        const values = this.getMessageMigrationValues(m, id, chatId)
        await db.prepare(`
            INSERT INTO messages (id, chat_id, role, content, timestamp, provider, model, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(...values)
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
        ]
    }

    // --- CRUD Implementations ---
    // (Examples showing how they adapt)

    async hasData(): Promise<boolean> {
        return true;
    }

    // Folders
    async getFolders(): Promise<Folder[]> {
        const db = await this.ensureDb()
        const rows = await db.prepare('SELECT * FROM folders ORDER BY name').all<JsonObject>()
        return rows.map(row => ({
            id: String(row.id),
            name: String(row.name),
            color: row.color as string | undefined,
            createdAt: Number(row.created_at),
            updatedAt: Number(row.updated_at)
        }))
    }

    async getFolder(id: string): Promise<Folder | undefined> {
        const db = await this.ensureDb()
        const row = await db.prepare('SELECT * FROM folders WHERE id = ?').get<JsonObject>(id)
        if (!row) { return undefined }
        return {
            id: String(row.id),
            name: String(row.name),
            color: row.color as string | undefined,
            createdAt: Number(row.created_at),
            updatedAt: Number(row.updated_at)
        }
    }

    async createFolder(name: string, color?: string) {
        const db = await this.ensureDb()
        const id = uuidv4()
        const now = Date.now()
        await db.prepare('INSERT INTO folders (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, name, color ?? null, now, now)
        return { id, name, color, createdAt: now, updatedAt: now }
    }

    async updateFolder(id: string, updates: Partial<Folder>) {
        const db = await this.ensureDb()
        if (updates.name) { await db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(updates.name, id) }
        if (updates.color) { await db.prepare('UPDATE folders SET color = ? WHERE id = ?').run(updates.color, id) }
        await db.prepare('UPDATE folders SET updated_at = ? WHERE id = ?').run(Date.now(), id)
        return this.getFolder(id)
    }

    async deleteFolder(id: string) {
        const db = await this.ensureDb()
        await db.prepare('DELETE FROM folders WHERE id = ?').run(id)
    }

    // ... Repeat for Prompts, Council ...
    async getPrompts(): Promise<Prompt[]> {
        const db = await this.ensureDb()
        const rows = await db.prepare('SELECT * FROM prompts ORDER BY created_at DESC').all<JsonObject>()
        return rows.map(r => ({
            id: String(r.id),
            title: String(r.title),
            content: String(r.content),
            tags: this.parseJsonField(r.tags as string | null, [] as string[]),
            createdAt: Number(r.created_at),
            updatedAt: Number(r.updated_at)
        }))
    }

    async getPrompt(id: string): Promise<Prompt | undefined> {
        const db = await this.ensureDb()
        const row = await db.prepare('SELECT * FROM prompts WHERE id = ?').get<JsonObject>(id)
        if (!row) { return undefined }
        return {
            id: String(row.id),
            title: String(row.title),
            content: String(row.content),
            tags: this.parseJsonField(row.tags as string | null, [] as string[]),
            createdAt: Number(row.created_at),
            updatedAt: Number(row.updated_at)
        }
    }

    async createPrompt(title: string, content: string, tags: string[] = []): Promise<Prompt> {
        const db = await this.ensureDb()
        const id = uuidv4()
        const now = Date.now()
        await db.prepare('INSERT INTO prompts (id, title, content, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, title, content, JSON.stringify(tags), now, now)
        return { id, title, content, tags, createdAt: now, updatedAt: now }
    }

    async updatePrompt(id: string, updates: Partial<Prompt>) {
        const db = await this.ensureDb()
        if (updates.title) { await db.prepare('UPDATE prompts SET title = ? WHERE id = ?').run(updates.title, id) }
        if (updates.content) { await db.prepare('UPDATE prompts SET content = ? WHERE id = ?').run(updates.content, id) }
        if (updates.tags) { await db.prepare('UPDATE prompts SET tags = ? WHERE id = ?').run(JSON.stringify(updates.tags), id) }
        await db.prepare('UPDATE prompts SET updated_at = ? WHERE id = ?').run(Date.now(), id)
        return this.getPrompt(id)
    }

    async deletePrompt(id: string) {
        const db = await this.ensureDb()
        await db.prepare('DELETE FROM prompts WHERE id = ?').run(id)
    }

    // ... Projects (Adapt mapRowToProject) ...
    private mapRowToProject(row: JsonObject): Project {
        return {
            id: String(row.id),
            title: String(row.title),
            description: (row.description as string | null) ?? '',
            path: String(row.path),
            mounts: (this.parseJsonField(row.mounts as string, []) as Array<{ id?: string; name: string; type: 'local' | 'ssh'; path?: string; rootPath?: string }>).map(m => ({
                id: m.id ?? uuidv4(),
                name: m.name ?? 'Untitled Mount',
                type: (m.type as 'local' | 'ssh') ?? 'local',
                rootPath: m.rootPath ?? m.path ?? ''
            })),
            chatIds: this.parseJsonField(row.chat_ids as string, []),
            councilConfig: this.parseJsonField(row.council_config as string, { enabled: false, members: [], consensusThreshold: 0.7 }),
            status: (String(row.status) as 'active' | 'archived' | 'draft') || 'active',
            logo: row.logo as string | undefined,
            metadata: this.parseJsonField(row.metadata as string, {}),
            createdAt: Number(row.created_at ?? row.createdAt ?? Date.now()),
            updatedAt: Number(row.updated_at ?? row.updatedAt ?? Date.now())
        }
    }

    private parseJsonField<T>(json: string | null | undefined, defaultValue: T): T {
        if (typeof json !== 'string' || json.trim() === '') {
            return defaultValue
        }
        const first = safeJsonParse<unknown>(json, defaultValue as unknown)
        if (typeof first === 'string') {
            return safeJsonParse<T>(first, defaultValue)
        }
        return first as T
    }

    async getProjects(): Promise<Project[]> {
        const db = await this.ensureDb()
        const rows = await db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all<JsonObject>()
        return rows.map(r => this.mapRowToProject(r))
    }

    async getProject(id: string): Promise<Project | undefined> {
        const db = await this.ensureDb()
        const row = await db.prepare('SELECT * FROM projects WHERE id = ?').get<JsonObject>(id)
        return row ? this.mapRowToProject(row) : undefined
    }

    async hasIndexedSymbols(projectId: string): Promise<boolean> {
        const db = await this.ensureDb()
        const row = await db.prepare('SELECT COUNT(*) as count FROM code_symbols WHERE project_path = ?').get<{ count: number }>(projectId)
        return (row?.count ?? 0) > 0
    }

    async createProject(title: string, projectPath: string, description: string = '', mountsJson?: string, councilConfigJson?: string): Promise<Project> {
        const db = await this.ensureDb()
        const id = uuidv4()
        const now = Date.now()

        // Default values
        const mounts = mountsJson ?? '[]'
        const chatIds = '[]'
        const councilConfig = councilConfigJson ?? JSON.stringify({ enabled: false, members: [], consensusThreshold: 0.7 })
        const status = 'active'
        const metadata = '{}'

        await db.prepare(`
            INSERT INTO projects(id, title, description, path, mounts, chat_ids, council_config, status, metadata, created_at, updated_at) 
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
            id, title, description, projectPath, mounts, chatIds, councilConfig, status, metadata, now, now
        )

        return {
            id,
            title,
            description,
            path: projectPath,
            mounts: (this.parseJsonField(mounts, []) as Array<{ id?: string; name: string; type: 'local' | 'ssh'; path?: string; rootPath?: string }>).map(m => ({
                id: m.id ?? uuidv4(),
                name: m.name,
                type: m.type,
                rootPath: m.rootPath ?? m.path ?? ''
            })),
            chatIds: [],
            councilConfig: this.parseJsonField(councilConfig, { enabled: false, members: [], consensusThreshold: 0.7 }) as Project['councilConfig'],
            status: 'active',
            metadata: {},
            createdAt: now,
            updatedAt: now
        }
    }

    async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
        const db = await this.ensureDb()
        const fields: string[] = []
        const values: unknown[] = []

        this.collectProjectUpdates(updates, fields, values)

        if (fields.length === 0) {
            return this.getProject(id)
        }

        fields.push('updated_at = ?')
        values.push(Date.now())
        values.push(id)

        await db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ? `).run(...(values as SqlValue[]))
        return this.getProject(id)
    }

    private collectProjectUpdates(updates: Partial<Project>, fields: string[], values: unknown[]) {
        if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title) }
        if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description) }
        if (updates.path !== undefined) { fields.push('path = ?'); values.push(updates.path) }
        if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status) }
        if (updates.logo !== undefined) { fields.push('logo = ?'); values.push(updates.logo) }
        if (updates.mounts !== undefined) { fields.push('mounts = ?'); values.push(JSON.stringify(updates.mounts)) }
        if (updates.chatIds !== undefined) { fields.push('chat_ids = ?'); values.push(JSON.stringify(updates.chatIds)) }
        if (updates.councilConfig !== undefined) { fields.push('council_config = ?'); values.push(JSON.stringify(updates.councilConfig)) }
        if (updates.metadata !== undefined) { fields.push('metadata = ?'); values.push(JSON.stringify(updates.metadata)) }
    }

    async deleteProject(id: string, deleteFiles: boolean = false): Promise<void> {
        const db = await this.ensureDb()

        // If deleteFiles is true, get the project path first and delete the folder
        if (deleteFiles) {
            const project = await this.getProject(id)
            if (project?.path) {
                try {
                    // Check if path exists before attempting deletion
                    if (fs.existsSync(project.path)) {
                        await fs.promises.rm(project.path, { recursive: true, force: true })
                        appLogger.info('DatabaseService', `Deleted project files at: ${project.path}`)
                    }
                } catch (error) {
                    appLogger.error('DatabaseService', `Failed to delete project files at ${project.path}`, error as Error)
                    // Continue to delete the database record even if file deletion fails
                }
            }
        }

        await db.prepare('DELETE FROM projects WHERE id = ?').run(id)
    }

    async archiveProject(id: string, isArchived: boolean): Promise<void> {
        const status = isArchived ? 'archived' : 'active'
        await this.updateProject(id, { status })
    }

    async bulkDeleteProjects(ids: string[], deleteFiles: boolean = false): Promise<void> {
        for (const id of ids) {
            await this.deleteProject(id, deleteFiles)
        }
    }

    async bulkArchiveProjects(ids: string[], isArchived: boolean): Promise<void> {
        for (const id of ids) {
            await this.archiveProject(id, isArchived)
        }
    }

    // ... Chats ...
    async createChat(chat: Chat): Promise<{ success: boolean; id: string; error?: string }> {
        try {
            const db = await this.ensureDb()
            const chatId = chat.id
            const now = Date.now()
            const chatData = this.prepareChatInsertData(chat, chatId, now)
            await db.prepare(`
                INSERT INTO chats(
                        id, title, is_Generating, backend, model,
                        folder_id, project_id, is_pinned, is_favorite,
                        metadata, created_at, updated_at
                    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(...chatData)
            appLogger.info('DatabaseService', `Created chat: ${chatId} (${chat.title})`)
            return { success: true, id: chatId }
        } catch (error) {
            appLogger.error('DatabaseService', 'Failed to create chat:', error as Error)
            return { success: false, id: '', error: getErrorMessage(error) }
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
            chat.projectId ?? null,
            chat.isPinned ? 1 : 0,
            chat.isFavorite ? 1 : 0,
            JSON.stringify(chat.metadata ?? {}),
            now,
            now
        ]
    }

    async getAllChats(): Promise<Chat[]> {
        const db = await this.ensureDb()
        const rows = await db.prepare('SELECT * FROM chats ORDER BY updated_at DESC').all<JsonObject>()
        return rows.map(row => this.mapRowToChat(row))
    }

    async getChat(id: string): Promise<Chat | undefined> {
        const db = await this.ensureDb()
        const row = await db.prepare('SELECT * FROM chats WHERE id = ?').get<JsonObject>(id)
        if (!row) { return undefined }
        return {
            id: String(row.id),
            title: String(row.title),
            isGenerating: Boolean(row.is_Generating),
            backend: row.backend as string | undefined,
            model: row.model as string | undefined,
            folderId: row.folder_id as string | undefined,
            projectId: row.project_id as string | undefined,
            isPinned: Boolean(row.is_pinned),
            isFavorite: Boolean(row.is_favorite),
            metadata: this.parseJsonField(row.metadata as string | null, {}),
            messages: [],
            createdAt: new Date(Number(row.created_at)),
            updatedAt: new Date(Number(row.updated_at))
        }
    }

    async getChats(projectId?: string): Promise<Chat[]> {
        const db = await this.ensureDb()
        let sql = 'SELECT * FROM chats'
        const params: SqlValue[] = []

        if (projectId) {
            sql += ' WHERE project_id = ?'
            params.push(projectId)
        }

        sql += ' ORDER BY updated_at DESC'

        const rows = await db.prepare(sql).all<JsonObject>(...params)
        return rows.map(row => ({
            id: String(row.id),
            title: String(row.title),
            isGenerating: Boolean(row.is_Generating),
            backend: row.backend as string | undefined,
            model: row.model as string | undefined,
            folderId: row.folder_id as string | undefined,
            projectId: row.project_id as string | undefined,
            isPinned: Boolean(row.is_pinned),
            isFavorite: Boolean(row.is_favorite),
            metadata: this.parseJsonField(row.metadata as string | null, {}),
            messages: [],
            createdAt: new Date(Number(row.created_at)),
            updatedAt: new Date(Number(row.updated_at))
        }))
    }

    async findCodeSymbolsByName(projectId: string, name: string): Promise<CodeSymbolSearchResult[]> {
        const db = await this.ensureDb()
        const rows = await db.prepare("SELECT * FROM code_symbols WHERE project_path = ? AND name ILIKE ? LIMIT 50").all<JsonObject>(projectId, `%${name}%`)
        return rows.map(r => ({
            id: String(r.id),
            name: String(r.name),
            path: String(r.file_path ?? ''),
            line: Number(r.line ?? 0),
            kind: String(r.kind ?? ''),
            signature: String(r.signature ?? ''),
            docstring: String(r.docstring ?? ''),
            score: 0.9 // High score for direct name match
        }))
    }

    async searchCodeContentByText(projectId: string, query: string): Promise<CodeSymbolSearchResult[]> {
        const db = await this.ensureDb()
        // Search in semantic_fragments for text content
        const rows = await db.prepare("SELECT * FROM semantic_fragments WHERE project_id = ? AND content ILIKE ? LIMIT 50").all<JsonObject>(projectId, `%${query}%`)
        return rows.map(r => ({
            id: String(r.id),
            name: String(r.content).substring(0, 50),
            path: String(r.source_id ?? ''),
            line: 1, // Fragments don't always have precise line
            kind: 'content',
            signature: '',
            docstring: String(r.content).substring(0, 200),
            score: 0.7
        }))
    }

    async searchCodeSymbols(vector: number[]): Promise<CodeSymbolSearchResult[]> {
        const db = await this.ensureDb()
        const k = 10
        const vecStr = `[${vector.join(',')}]`

        const rows = await db.prepare(`
        SELECT *, embedding < -> $1 as distance 
            FROM code_symbols 
            ORDER BY embedding < -> $1 
            LIMIT ${k}
        `).all<JsonObject & { distance?: number }>(vecStr)

        return rows.map(r => ({
            id: String(r.id),
            name: String(r.name),
            path: String(r.file_path ?? ''),
            line: Number(r.line ?? 0),
            kind: String(r.kind ?? ''),
            signature: String(r.signature ?? ''),
            docstring: String(r.docstring ?? ''),
            score: 1 - (r.distance ?? 0)
        }))
    }

    // IMPORTANT: Fill in other methods (updateChat, deleteChat, addMessage, etc.) adhering to this pattern.
    // To keep this overwrite manageable, I've covered key integration points. 
    // Ensure remaining methods from original file are present or errors will occur.

    async updateChat(id: string, updates: Partial<Chat>) {
        try {
            const db = await this.ensureDb()
            const fields: string[] = []
            const values: unknown[] = []

            this.collectChatUpdates(updates, fields, values)

            if (fields.length > 0) {
                values.push(id)
                await db.prepare(`UPDATE chats SET ${fields.join(', ')} WHERE id = ? `).run(...(values as SqlValue[]))
                appLogger.info('DatabaseService', `Updated chat: ${id} with ${fields.join(', ')}`)
            }
            return { success: true }
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to update chat: ${getErrorMessage(error)} `)
            return { success: false, error: getErrorMessage(error as Error) }
        }
    }

    private collectChatUpdates(updates: Partial<Chat>, fields: string[], values: unknown[]) {
        if (updates.title !== undefined) {
            fields.push('title = ?')
            values.push(updates.title)
        }
        this.collectChatStateUpdates(updates, fields, values)
        this.collectChatContextUpdates(updates, fields, values)

        if (updates.metadata !== undefined) {
            fields.push('metadata = ?')
            values.push(JSON.stringify(updates.metadata))
        }
    }

    private collectChatStateUpdates(updates: Partial<Chat>, fields: string[], values: unknown[]) {
        if (updates.isGenerating !== undefined) { fields.push('is_Generating = ?'); values.push(updates.isGenerating ? 1 : 0) }
        if (updates.backend !== undefined) { fields.push('backend = ?'); values.push(updates.backend) }
        if (updates.model !== undefined) { fields.push('model = ?'); values.push(updates.model) }
    }

    private collectChatContextUpdates(updates: Partial<Chat>, fields: string[], values: unknown[]) {
        if (updates.folderId !== undefined) { fields.push('folder_id = ?'); values.push(updates.folderId) }
        if (updates.projectId !== undefined) { fields.push('project_id = ?'); values.push(updates.projectId) }
        if (updates.isPinned !== undefined) { fields.push('is_pinned = ?'); values.push(updates.isPinned ? 1 : 0) }
        if (updates.isFavorite !== undefined) { fields.push('is_favorite = ?'); values.push(updates.isFavorite ? 1 : 0) }
    }

    async deleteChat(id: string) {
        try {
            const db = await this.ensureDb()
            await db.transaction(async (tx) => {
                await tx.prepare('DELETE FROM messages WHERE chat_id = ?').run(id)
                await tx.prepare('DELETE FROM chats WHERE id = ?').run(id)
            })
            appLogger.info('DatabaseService', `Deleted chat: ${id}`)
            return { success: true }
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to delete chat: ${getErrorMessage(error)} `)
            return { success: false, error: getErrorMessage(error as Error) }
        }
    }

    async addMessage(msg: JsonObject) {
        try {
            const db = await this.ensureDb()
            const msgId = (msg.id as string | undefined) ?? uuidv4()
            const vec = Array.isArray(msg.vector) && msg.vector.length > 0 ? `[${msg.vector.join(',')}]` : null

            await db.prepare(`
                INSERT INTO messages(id, chat_id, role, content, timestamp, provider, model, metadata, vector)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
             `).run(
                msgId, msg.chatId as string, msg.role as string, msg.content as string, (msg.timestamp as number | undefined) ?? Date.now(),
                (msg.provider as string | undefined) ?? null, (msg.model as string | undefined) ?? null, JSON.stringify(msg.metadata ?? {}), vec
            )

            await db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(Date.now(), msg.chatId as string)
            return { success: true, id: msgId }
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to add message: ${getErrorMessage(error)} `)
            throw error
        }
    }

    async getMessages(chatId: string) {
        try {
            const db = await this.ensureDb()
            const rows = await db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC').all<JsonObject>(chatId)
            return rows.map((row) => ({
                id: String(row.id),
                chatId: String(row.chat_id),
                role: String(row.role),
                content: String(row.content),
                timestamp: Number(row.timestamp),
                provider: row.provider as string | undefined,
                model: row.model as string | undefined,
                metadata: this.parseJsonField(row.metadata as string | null, {})
            }))
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to get messages: ${getErrorMessage(error)} `)
            return []
        }
    }

    async getAllMessages() {
        try {
            const db = await this.ensureDb()
            const rows = await db.prepare('SELECT * FROM messages ORDER BY timestamp ASC').all<JsonObject>()
            return rows.map((row) => ({
                id: String(row.id),
                chatId: String(row.chat_id),
                role: String(row.role),
                content: String(row.content),
                timestamp: Number(row.timestamp),
                provider: row.provider as string | undefined,
                model: row.model as string | undefined,
                metadata: this.parseJsonField(row.metadata as string | null, {})
            }))
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to get all messages: ${getErrorMessage(error)} `)
            return []
        }
    }

    async getCouncilSessions(): Promise<CouncilSession[]> {
        const db = await this.ensureDb();
        const rows = await db.prepare('SELECT * FROM council_sessions ORDER BY updated_at DESC').all<JsonObject>();
        return rows.map(r => ({
            id: String(r.id),
            goal: String(r.goal),
            status: String(r.status) as CouncilSession['status'],
            plan: r.plan as string | undefined,
            solution: r.solution as string | undefined,
            createdAt: Number(r.created_at),
            updatedAt: Number(r.updated_at),
            logs: this.parseJsonField<CouncilLog[]>(r.logs as string | null, []),
            agents: this.parseJsonField<AgentProfile[]>(r.agents as string | null, [])
        }))
    }

    async createCouncilSession(goal: string) {
        const db = await this.ensureDb()
        const id = uuidv4()
        const now = Date.now()
        const session: CouncilSession = {
            id, goal, status: 'planning', logs: [], agents: [], createdAt: now, updatedAt: now
        }
        await db.prepare('INSERT INTO council_sessions (id, goal, status, logs, agents, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            id, goal, 'planning', '[]', '[]', now, now
        )
        return session
    }

    async getCouncilSession(id: string): Promise<CouncilSession | null> {
        const db = await this.ensureDb()
        const row = await db.prepare('SELECT * FROM council_sessions WHERE id = ?').get<JsonObject>(id)
        if (!row) { return null }
        return {
            id: String(row.id),
            goal: String(row.goal),
            status: String(row.status) as CouncilSession['status'],
            plan: row.plan as string | undefined,
            solution: row.solution as string | undefined,
            logs: this.parseJsonField<CouncilLog[]>(row.logs as string | null, []),
            agents: this.parseJsonField<AgentProfile[]>(row.agents as string | null, []),
            createdAt: Number(row.created_at),
            updatedAt: Number(row.updated_at)
        }
    }

    async updateCouncilStatus(id: string, status: string, plan?: string, solution?: string) {
        const db = await this.ensureDb()
        const updates: SqlValue[] = [status, Date.now()]
        let sql = 'UPDATE council_sessions SET status = ?, updated_at = ?'

        if (plan !== undefined) { sql += ', plan = ?'; updates.push(plan) }
        if (solution !== undefined) { sql += ', solution = ?'; updates.push(solution) }

        sql += ' WHERE id = ?'
        updates.push(id)

        await db.prepare(sql).run(...updates)
    }

    async addCouncilLog(sessionId: string, agentId: string, message: string, type: string) {
        const db = await this.ensureDb()
        // We are storing logs in a JSON column 'logs' for now, or we could have a separate table.
        // The migration created 'logs' as TEXT DEFAULT '[]'. simple append.
        // Note: In Postgres, appending to JSON path is efficient if using JSONB, but we are using TEXT/JSON string.
        // We must Read-Modify-Write.

        // Wait, 'logs' column usage in 'createCouncilSession' mimics legacy.
        // Ideally we should have a `council_logs` table but for compatibility let's stick to JSON column or create table.
        // The previous migration I wrote (Step 497) only defined `council_sessions`. 
        // So I must do Read-Modify-Write.

        const session = await this.getCouncilSession(sessionId)
        if (!session) { return }

        const newLog: CouncilLog = {
            id: uuidv4(),
            sessionId,
            agentId,
            message,
            timestamp: Date.now(),
            type: type as CouncilLog['type']
        }
        const logs = [...session.logs, newLog]

        await db.prepare('UPDATE council_sessions SET logs = ?, updated_at = ? WHERE id = ?').run(
            JSON.stringify(logs), Date.now(), sessionId
        )
        return newLog
    }
    async clearCodeSymbols(projectId: string) {
        const db = await this.ensureDb()
        await db.prepare('DELETE FROM code_symbols WHERE project_path = ?').run(projectId)
    }

    async storeCodeSymbol(symbol: CodeSymbolRecord) {
        const db = await this.ensureDb()
        const vec = symbol.vector ? `[${symbol.vector.join(',')}]` : null

        await db.prepare(`
            INSERT INTO code_symbols(id, name, project_path, file_path, line, kind, signature, docstring, embedding)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
            symbol.id, symbol.name, symbol.project_path, symbol.file_path, symbol.line, symbol.kind, symbol.signature, symbol.docstring, vec
        )
    }

    async deleteCodeSymbolsForFile(projectId: string, filePath: string) {
        const db = await this.ensureDb()
        await db.prepare('DELETE FROM code_symbols WHERE project_path = ? AND file_path = ?').run(projectId, filePath)
    }

    async deleteSemanticFragmentsForFile(projectId: string, filePath: string) {
        const db = await this.ensureDb()
        await db.prepare('DELETE FROM semantic_fragments WHERE project_id = ? AND source_id = ?').run(projectId, filePath)
    }

    async storeSemanticFragment(fragment: SemanticFragment) {
        const db = await this.ensureDb()
        const vec = fragment.embedding.length > 0 ? `[${fragment.embedding.join(',')}]` : null

        await db.prepare(`
            INSERT INTO semantic_fragments(id, content, embedding, source, source_id, tags, importance, project_id, created_at, updated_at)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
            fragment.id, fragment.content, vec, fragment.source, fragment.sourceId,
            JSON.stringify(fragment.tags), fragment.importance, fragment.projectId, fragment.createdAt, fragment.updatedAt
        )
    }

    async clearSemanticFragments(projectId: string) {
        const db = await this.ensureDb()
        await db.prepare('DELETE FROM semantic_fragments WHERE project_id = ?').run(projectId)
    }

    async searchSemanticFragments(vector: number[], limit: number): Promise<SemanticFragment[]> {
        const db = await this.ensureDb()
        const vecStr = `[${vector.join(',')}]`

        const rows = await db.prepare(`
        SELECT *, embedding < -> $1 as distance 
            FROM semantic_fragments 
            ORDER BY embedding < -> $1 
            LIMIT ${limit}
        `).all<JsonObject & { distance?: number }>(vecStr)

        return rows.map(r => ({
            id: String(r.id),
            content: String(r.content),
            embedding: [], // Don't return embedding to save bandwidth unless needed
            source: String(r.source),
            sourceId: String(r.source_id),
            tags: this.parseJsonField(r.tags as string | null, []),
            importance: Number(r.importance ?? 0),
            projectId: r.project_id as string | undefined,
            createdAt: Number(r.created_at),
            updatedAt: Number(r.updated_at),
            score: 1 - (r.distance ?? 0)
        }))
    }

    async storeMemory(key: string, value: string) {
        const db = await this.ensureDb()
        await db.prepare(`
            INSERT INTO memories(key, value, updated_at) VALUES(?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            `).run(key, value, Date.now())
    }

    async recallMemory(key: string): Promise<string | null> {
        const db = await this.ensureDb()
        const row = await db.prepare('SELECT value FROM memories WHERE key = ?').get(key) as { value: string } | undefined
        return row ? row.value : null
    }

    // --- Memory Service Support ---

    async getAllSemanticFragments(): Promise<SemanticFragment[]> {
        const db = await this.ensureDb()
        const rows = await db.prepare('SELECT * FROM semantic_fragments ORDER BY created_at DESC').all<JsonObject>()
        return rows.map(r => ({
            id: String(r.id),
            content: String(r.content),
            embedding: [],
            source: String(r.source),
            sourceId: String(r.source_id),
            tags: this.parseJsonField(r.tags as string | null, []),
            importance: Number(r.importance ?? 0),
            projectId: r.project_id as string | undefined,
            createdAt: Number(r.createdAt ?? r.created_at),
            updatedAt: Number(r.updatedAt ?? r.updated_at)
        }))
    }

    async getSemanticFragmentsByIds(ids: string[]): Promise<SemanticFragment[]> {
        if (ids.length === 0) { return []; }
        const db = await this.ensureDb();
        const placeholders = ids.map(() => '?').join(',');
        const rows = await db.prepare(`SELECT * FROM semantic_fragments WHERE id IN (${placeholders})`).all<JsonObject>(...ids);

        return rows.map(r => ({
            id: String(r.id),
            content: String(r.content),
            embedding: [],
            source: String(r.source),
            sourceId: String(r.source_id),
            tags: this.parseJsonField(r.tags as string | null, []),
            importance: Number(r.importance ?? 0),
            projectId: r.project_id as string | undefined,
            createdAt: Number(r.createdAt ?? r.created_at),
            updatedAt: Number(r.updatedAt ?? r.updated_at)
        }));
    }

    async searchSemanticFragmentsByText(query: string, limit: number): Promise<SemanticFragment[]> {
        const db = await this.ensureDb()
        const rows = await db.prepare(`
        SELECT * FROM semantic_fragments WHERE content ILIKE $1 LIMIT ${limit}
        `).all<JsonObject>(` % ${query}% `)
        return rows.map(r => ({
            id: String(r.id),
            content: String(r.content),
            embedding: [],
            source: String(r.source),
            sourceId: String(r.source_id),
            tags: this.parseJsonField(r.tags as string | null, []),
            importance: Number(r.importance ?? 0),
            projectId: r.project_id as string | undefined,
            createdAt: Number(r.created_at),
            updatedAt: Number(r.updated_at)
        }))
    }

    async deleteSemanticFragment(id: string): Promise<boolean> {
        const db = await this.ensureDb()
        await db.prepare('DELETE FROM semantic_fragments WHERE id = ?').run(id)
        return true
    }

    async storeEpisodicMemory(memory: EpisodicMemory) {
        const db = await this.ensureDb()
        const vec = `[${memory.embedding.join(',')}]`
        await db.prepare(`
            INSERT INTO episodic_memories(id, title, summary, embedding, start_date, end_date, chat_id, participants, created_at)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
            memory.id, memory.title, memory.summary, vec,
            memory.startDate, memory.endDate, memory.chatId,
            JSON.stringify(memory.participants), memory.createdAt
        )
    }

    async searchEpisodicMemories(embedding: number[], limit: number): Promise<EpisodicMemory[]> {
        const db = await this.ensureDb()
        const vecStr = `[${embedding.join(',')}]`
        const rows = await db.prepare(`
        SELECT *, embedding < -> $1 as distance 
            FROM episodic_memories 
            ORDER BY embedding < -> $1 
            LIMIT ${limit}
        `).all<JsonObject & { distance?: number }>(vecStr)

        return rows.map(r => ({
            id: String(r.id),
            title: String(r.title),
            summary: String(r.summary),
            embedding: [],
            startDate: Number(r.start_date),
            endDate: Number(r.end_date),
            chatId: String(r.chat_id),
            participants: this.parseJsonField(r.participants as string | null, []),
            createdAt: Number(r.created_at)
        }))
    }

    async searchEpisodicMemoriesByText(query: string, limit: number): Promise<EpisodicMemory[]> {
        const db = await this.ensureDb()
        // Simple ILIKE search
        const rows = await db.prepare(`
        SELECT * FROM episodic_memories 
            WHERE summary ILIKE $1 OR title ILIKE $1 
            ORDER BY created_at DESC LIMIT ${limit}
        `).all<JsonObject>(` % ${query}% `)

        return rows.map(r => ({
            id: String(r.id),
            title: String(r.title),
            summary: String(r.summary),
            embedding: [],
            startDate: Number(r.start_date),
            endDate: Number(r.end_date),
            chatId: String(r.chat_id),
            participants: this.parseJsonField(r.participants as string | null, []),
            createdAt: Number(r.created_at)
        }))
    }

    async getAllEpisodicMemories(): Promise<EpisodicMemory[]> {
        const db = await this.ensureDb()
        const rows = await db.prepare('SELECT * FROM episodic_memories ORDER BY created_at DESC').all<JsonObject>()
        return rows.map(r => ({
            id: String(r.id),
            title: String(r.title),
            summary: String(r.summary),
            embedding: [],
            startDate: Number(r.start_date),
            endDate: Number(r.end_date),
            chatId: String(r.chat_id),
            participants: this.parseJsonField(r.participants as string | null, []),
            createdAt: Number(r.created_at)
        }))
    }

    async getEpisodicMemoriesByIds(ids: string[]): Promise<EpisodicMemory[]> {
        if (ids.length === 0) { return []; }
        const db = await this.ensureDb();
        const placeholders = ids.map(() => '?').join(',');
        const rows = await db.prepare(`SELECT * FROM episodic_memories WHERE id IN (${placeholders})`).all<JsonObject>(...ids);

        return rows.map(r => ({
            id: String(r.id),
            title: String(r.title),
            summary: String(r.summary),
            embedding: [],
            startDate: Number(r.start_date),
            endDate: Number(r.end_date),
            chatId: String(r.chat_id),
            participants: this.parseJsonField(r.participants as string | null, []),
            createdAt: Number(r.created_at)
        }));
    }

    async storeEntityKnowledge(knowledge: EntityKnowledge) {
        const db = await this.ensureDb()
        await db.prepare(`
            INSERT INTO entity_knowledge(id, entity_type, entity_name, key, value, confidence, source, updated_at)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
        value = excluded.value,
            confidence = excluded.confidence,
            updated_at = excluded.updated_at
                `).run(
            knowledge.id, knowledge.entityType, knowledge.entityName,
            knowledge.key, knowledge.value, knowledge.confidence,
            knowledge.source, knowledge.updatedAt
        )
    }

    async getEntityKnowledge(entityName: string): Promise<EntityKnowledge[]> {
        const db = await this.ensureDb()
        const rows = await db.prepare('SELECT * FROM entity_knowledge WHERE entity_name = ?').all<JsonObject>(entityName)
        return rows.map(r => ({
            id: String(r.id),
            entityType: String(r.entity_type),
            entityName: String(r.entity_name),
            key: String(r.key),
            value: String(r.value),
            confidence: Number(r.confidence ?? 0),
            source: String(r.source),
            updatedAt: Number(r.updated_at)
        }))
    }

    async deleteEntityKnowledge(id: string): Promise<boolean> {
        const db = await this.ensureDb()
        await db.prepare('DELETE FROM entity_knowledge WHERE id = ?').run(id)
        return true
    }

    async getAllEntityKnowledge(): Promise<EntityKnowledge[]> {
        const db = await this.ensureDb()
        const rows = await db.prepare('SELECT * FROM entity_knowledge ORDER BY updated_at DESC').all<JsonObject>()
        return rows.map(r => ({
            id: String(r.id),
            entityType: String(r.entity_type),
            entityName: String(r.entity_name),
            key: String(r.key),
            value: String(r.value),
            confidence: Number(r.confidence ?? 0),
            source: String(r.source),
            updatedAt: Number(r.updated_at)
        }))
    }

    /**
     * Update a message with new values (bookmark, rating, etc.)
     * Updates are stored in the metadata JSON field
     */
    async updateMessage(id: string, updates: JsonObject): Promise<{ success: boolean }> {
        try {
            const db = await this.ensureDb()

            // Get current message to merge metadata
            const row = await db.prepare('SELECT metadata FROM messages WHERE id = ?').get<JsonObject>(id)
            if (!row) {
                return { success: false }
            }

            const currentMetadata = this.parseJsonField<JsonObject>(row.metadata as string | null, {})
            const newMetadata: JsonObject = { ...currentMetadata }

            // Handle special fields that go into metadata
            if ('isBookmarked' in updates) { newMetadata.isBookmarked = updates.isBookmarked as boolean }
            if ('isPinned' in updates) { newMetadata.isPinned = updates.isPinned as boolean }
            if ('rating' in updates) { newMetadata.rating = updates.rating as number }
            if ('reactions' in updates) { newMetadata.reactions = updates.reactions as string[] }

            // Build update query for direct columns
            const fields: string[] = ['metadata = ?']
            const values: SqlValue[] = [JSON.stringify(newMetadata)]

            if ('content' in updates) {
                fields.push('content = ?')
                values.push(updates.content as string)
            }

            values.push(id)

            await db.prepare(`UPDATE messages SET ${fields.join(', ')} WHERE id = ? `).run(...values)

            return { success: true }
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to update message: ${getErrorMessage(error)} `)
            return { success: false }
        }
    }

    /**
     * Get bookmarked messages across all chats
     */
    async getBookmarkedMessages(): Promise<Array<{ id: string; chatId: string; content: string; timestamp: number; chatTitle?: string | undefined }>> {
        try {
            const db = await this.ensureDb()
            const rows = await db.prepare(`
                SELECT m.id, m.chat_id, m.content, m.timestamp, m.metadata, c.title as chat_title
                FROM messages m
                LEFT JOIN chats c ON m.chat_id = c.id
        WHERE(m.metadata:: json ->> 'isBookmarked') = 'true'
                ORDER BY m.timestamp DESC
            `).all<JsonObject>()

            return rows.map(r => ({
                id: String(r.id),
                chatId: String(r.chat_id),
                content: String(r.content),
                timestamp: Number(r.timestamp),
                ...(r.chat_title ? { chatTitle: String(r.chat_title) } : {})
            }))
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to get bookmarked messages: ${getErrorMessage(error)} `)
            return []
        }
    }

    /**
     * Search chats with various filters
     */
    async searchChats(options: SearchChatsOptions): Promise<Chat[]> {
        try {
            const db = await this.ensureDb()
            const { sql, params } = this.buildAdvancedSearchQuery(options)
            const rows = await db.prepare(sql).all<JsonObject>(...params)

            return rows.map(row => this.mapRowToChat(row))
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to search chats: ${getErrorMessage(error)} `)
            return []
        }
    }

    private buildAdvancedSearchQuery(options: SearchChatsOptions) {
        const conditions: string[] = []
        const params: SqlValue[] = []

        if (options.query) {
            conditions.push('(c.title ILIKE ? OR EXISTS (SELECT 1 FROM messages m WHERE m.chat_id = c.id AND m.content ILIKE ?))')
            params.push(`%${options.query}%`, `%${options.query}%`)
        }
        this.addBasicSearchFilters(options, conditions, params)
        this.addDateSearchFilters(options, conditions, params)

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
        const limitClause = options.limit ? `LIMIT ${options.limit}` : ''
        const sql = `SELECT c.* FROM chats c ${whereClause} ORDER BY c.updated_at DESC ${limitClause}`

        return { sql, params }
    }

    private addBasicSearchFilters(options: SearchChatsOptions, conditions: string[], params: SqlValue[]) {
        if (options.folderId) {
            conditions.push('c.folder_id = ?')
            params.push(options.folderId)
        }
        if (options.isPinned !== undefined) {
            conditions.push('c.is_pinned = ?')
            params.push(options.isPinned ? 1 : 0)
        }
        if (options.isFavorite !== undefined) {
            conditions.push('c.is_favorite = ?')
            params.push(options.isFavorite ? 1 : 0)
        }
        if (options.isArchived !== undefined) {
            conditions.push("json_extract(c.metadata, '$.isArchived') = ?")
            params.push(options.isArchived ? 1 : 0)
        }
    }

    private addDateSearchFilters(options: SearchChatsOptions, conditions: string[], params: SqlValue[]) {
        if (options.startDate) {
            conditions.push('c.created_at >= ?')
            params.push(options.startDate)
        }
        if (options.endDate) {
            conditions.push('c.created_at <= ?')
            params.push(options.endDate)
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
            isGenerating: Boolean(row.is_Generating),
            metadata: this.parseJsonField(row.metadata as string, {})
        }
    }

    async getMigrationStatus() {
        const db = await this.ensureDb()
        const manager = new MigrationManager(db)
        manager.registerAll(getMigrationDefinitions(this.isTest))
        return await manager.getStatus()
    }

    async getStats() {
        try {
            const db = await this.ensureDb()
            const chatRow = await db.prepare('SELECT count(*) as count FROM chats').get<{ count: number }>()
            const messageRow = await db.prepare('SELECT count(*) as count FROM messages').get<{ count: number }>()

            return {
                chatCount: chatRow?.count ?? 0,
                messageCount: messageRow?.count ?? 0,
                dbSize: 0
            }
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to get stats: ${getErrorMessage(error)} `)
            return { chatCount: 0, messageCount: 0, dbSize: 0 }
        }
    }

    async getDetailedStats(_period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'daily') {
        try {
            const db = await this.ensureDb()
            const stats = await this.getCoreCountStats(db)
            const messages = await db.prepare('SELECT metadata, timestamp FROM messages').all<JsonObject>()

            const usage = this.calculateTokenAndTimelineStats(messages)

            return {
                ...stats,
                totalPromptTokens: usage.totalPromptTokens,
                totalCompletionTokens: usage.totalCompletionTokens,
                tokenTimeline: usage.tokenTimeline,
                activity: usage.activity
            }
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to get detailed stats: ${getErrorMessage(error)} `)
            return { chatCount: 0, messageCount: 0, dbSize: 0, totalPromptTokens: 0, totalCompletionTokens: 0, tokenTimeline: [], activity: [] }
        }
    }

    private async getCoreCountStats(db: DatabaseAdapter) {
        const chatsRow = await db.prepare('SELECT count(*) as c FROM chats').get<{ c: number }>()
        const messagesRow = await db.prepare('SELECT count(*) as c FROM messages').get<{ c: number }>()
        return {
            chatCount: chatsRow?.c ?? 0,
            messageCount: messagesRow?.c ?? 0,
            dbSize: 0
        }
    }

    private calculateTokenAndTimelineStats(messages: JsonObject[]) {
        let totalPromptTokens = 0
        let totalCompletionTokens = 0
        const tokenTimelineMap = new Map<number, { prompt: number; completion: number }>()
        const activity = new Array(30).fill(0)
        const now = Date.now()
        const dayMs = 86400000

        for (const msg of messages) {
            const usage = this.extractUsageFromMessage(msg)
            totalPromptTokens += usage.p
            totalCompletionTokens += usage.c

            this.updateTokenTimeline(tokenTimelineMap, Number(msg.timestamp), usage.p, usage.c)
            this.updateActivity(activity, Number(msg.timestamp), now, dayMs)
        }

        const tokenTimeline = Array.from(tokenTimelineMap.entries())
            .map(([timestamp, tokens]) => ({ timestamp, promptTokens: tokens.prompt, completionTokens: tokens.completion }))
            .sort((a, b) => a.timestamp - b.timestamp)

        return { totalPromptTokens, totalCompletionTokens, tokenTimeline, activity }
    }

    private extractUsageFromMessage(msg: JsonObject) {
        const metadata = this.parseJsonField<JsonObject>(msg.metadata as string | null, {})
        const usage = (metadata.usage ?? {}) as JsonObject
        return {
            p: Number(metadata.promptTokens ?? usage.prompt_tokens ?? 0),
            c: Number(metadata.completionTokens ?? usage.completion_tokens ?? 0)
        }
    }

    private updateTokenTimeline(map: Map<number, { prompt: number; completion: number }>, timestamp: number, p: number, c: number) {
        if (p > 0 || c > 0) {
            const dayTimestamp = new Date(timestamp).setHours(0, 0, 0, 0)
            const existing = map.get(dayTimestamp) ?? { prompt: 0, completion: 0 }
            map.set(dayTimestamp, {
                prompt: existing.prompt + p,
                completion: existing.completion + c
            })
        }
    }

    private updateActivity(activity: number[], timestamp: number, now: number, dayMs: number) {
        const daysAgo = Math.floor((now - timestamp) / dayMs)
        if (daysAgo >= 0 && daysAgo < 30) {
            activity[29 - daysAgo]++
        }
    }

    async deleteMessage(id: string) {
        try {
            const db = await this.ensureDb()
            await db.prepare('DELETE FROM messages WHERE id = ?').run(id)
            return { success: true }
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to delete message: ${getErrorMessage(error)} `)
            return { success: false }
        }
    }

    async deleteMessages(ids: string[]) {
        try {
            const db = await this.ensureDb()
            for (const id of ids) {
                await db.prepare('DELETE FROM messages WHERE id = ?').run(id)
            }
            return { success: true }
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to delete messages: ${getErrorMessage(error)} `)
            return { success: false }
        }
    }

    async deleteAllChats() {
        try {
            const db = await this.ensureDb()
            await db.exec('DELETE FROM chats')
            return { success: true }
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to delete all chats: ${getErrorMessage(error)} `)
            return { success: false }
        }
    }

    async deleteChatsByTitle(title: string) {
        try {
            const db = await this.ensureDb()
            await db.prepare('DELETE FROM chats WHERE title = ?').run(title)
            return { success: true }
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to delete chats by title: ${getErrorMessage(error)} `)
            return { success: false }
        }
    }

    async getTimeStats() {
        try {
            const db = await this.ensureDb()
            const totalOnlineTimeRow = await db.prepare("SELECT sum(duration_ms) as total FROM time_tracking WHERE type = 'app_online'").get() as { total: number } | undefined
            const totalCodingTimeRow = await db.prepare("SELECT sum(duration_ms) as total FROM time_tracking WHERE type = 'coding'").get() as { total: number } | undefined
            const projectCodingTimeRows = await db.prepare("SELECT project_id, sum(duration_ms) as total FROM time_tracking WHERE type = 'project_coding' GROUP BY project_id").all() as Array<{ project_id: string; total: number }>

            const projectCodingTime: Record<string, number> = {}
            for (const row of projectCodingTimeRows) {
                if (row.project_id) { projectCodingTime[row.project_id] = Number(row.total) }
            }

            return {
                totalOnlineTime: Number(totalOnlineTimeRow?.total ?? 0),
                totalCodingTime: Number(totalCodingTimeRow?.total ?? 0),
                projectCodingTime
            }
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to get time stats: ${getErrorMessage(error)} `)
            return { totalOnlineTime: 0, totalCodingTime: 0, projectCodingTime: {} }
        }
    }

    // --- Token Usage Tracking ---

    async addTokenUsage(record: {
        messageId?: string
        chatId: string
        projectId?: string
        provider: string
        model: string
        tokensSent: number
        tokensReceived: number
        costEstimate?: number
    }): Promise<void> {
        try {
            const db = await this.ensureDb()
            const id = uuidv4()
            const now = Date.now()
            const date = new Date(now)

            await db.prepare(`
                INSERT INTO token_usage (
                    id, message_id, chat_id, project_id, provider, model,
                    tokens_sent, tokens_received, cost_estimate,
                    timestamp, hour, day, month, year, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                id,
                record.messageId ?? null,
                record.chatId,
                record.projectId ?? null,
                record.provider,
                record.model,
                record.tokensSent,
                record.tokensReceived,
                record.costEstimate ?? 0,
                now,
                date.getHours(),
                date.getDate(),
                date.getMonth() + 1,
                date.getFullYear(),
                now
            )
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to add token usage: ${getErrorMessage(error)}`)
        }
    }

    async getTokenUsageStats(period: 'daily' | 'weekly' | 'monthly'): Promise<{
        totalSent: number
        totalReceived: number
        totalCost: number
        timeline: Array<{ timestamp: number; sent: number; received: number }>
        byProvider: Record<string, { sent: number; received: number; cost: number }>
        byModel: Record<string, { sent: number; received: number; cost: number }>
    }> {
        try {
            const db = await this.ensureDb()
            const now = Date.now()
            const periodMs = this.getPeriodMs(period)
            const since = now - periodMs

            // Total stats
            const totalsRow = await db.prepare(`
                SELECT 
                    COALESCE(SUM(tokens_sent), 0) as total_sent,
                    COALESCE(SUM(tokens_received), 0) as total_received,
                    COALESCE(SUM(cost_estimate), 0) as total_cost
                FROM token_usage WHERE timestamp >= ?
            `).get(since) as { total_sent: number; total_received: number; total_cost: number }

            // Timeline data
            const timelineRows = await db.prepare(`
                SELECT timestamp, tokens_sent as sent, tokens_received as received
                FROM token_usage WHERE timestamp >= ?
                ORDER BY timestamp ASC
            `).all(since) as Array<{ timestamp: number; sent: number; received: number }>

            // By provider
            const providerRows = await db.prepare(`
                SELECT provider,
                    COALESCE(SUM(tokens_sent), 0) as sent,
                    COALESCE(SUM(tokens_received), 0) as received,
                    COALESCE(SUM(cost_estimate), 0) as cost
                FROM token_usage WHERE timestamp >= ?
                GROUP BY provider
            `).all(since) as Array<{ provider: string; sent: number; received: number; cost: number }>

            // By model
            const modelRows = await db.prepare(`
                SELECT model,
                    COALESCE(SUM(tokens_sent), 0) as sent,
                    COALESCE(SUM(tokens_received), 0) as received,
                    COALESCE(SUM(cost_estimate), 0) as cost
                FROM token_usage WHERE timestamp >= ?
                GROUP BY model
            `).all(since) as Array<{ model: string; sent: number; received: number; cost: number }>

            const byProvider: Record<string, { sent: number; received: number; cost: number }> = {}
            for (const row of providerRows) {
                byProvider[row.provider] = { sent: row.sent, received: row.received, cost: row.cost }
            }

            const byModel: Record<string, { sent: number; received: number; cost: number }> = {}
            for (const row of modelRows) {
                byModel[row.model] = { sent: row.sent, received: row.received, cost: row.cost }
            }

            return {
                totalSent: Number(totalsRow.total_sent),
                totalReceived: Number(totalsRow.total_received),
                totalCost: Number(totalsRow.total_cost),
                timeline: timelineRows,
                byProvider,
                byModel
            }
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to get token usage stats: ${getErrorMessage(error)}`)
            return { totalSent: 0, totalReceived: 0, totalCost: 0, timeline: [], byProvider: {}, byModel: {} }
        }
    }

    private getPeriodMs(period: 'daily' | 'weekly' | 'monthly'): number {
        const DAY_MS = 24 * 60 * 60 * 1000
        switch (period) {
            case 'daily': return DAY_MS
            case 'weekly': return 7 * DAY_MS
            case 'monthly': return 30 * DAY_MS
        }
    }

    async archiveChat(id: string, isArchived: boolean) {
        try {
            const db = await this.ensureDb()
            const chat = await this.getChat(id)
            if (!chat) { return { success: false } }

            const metadata = { ...chat.metadata, isArchived }
            await db.prepare('UPDATE chats SET metadata = ?, updated_at = ? WHERE id = ?')
                .run(JSON.stringify(metadata), Date.now(), id)

            return { success: true }
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to archive chat: ${getErrorMessage(error)} `)
            return { success: false }
        }
    }

    async duplicateChat(id: string) {
        try {
            const db = await this.ensureDb()
            const chat = await this.getChat(id)
            if (!chat) { return null }

            const newId = uuidv4()
            const now = Date.now()

            await db.transaction(async (tx) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await this.performChatDuplication(tx as any, chat, newId, now)
            })

            return newId
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to duplicate chat: ${getErrorMessage(error)} `)
            return null
        }
    }

    private async performChatDuplication(tx: TransactionLike, chat: Chat, newId: string, now: number) {
        const txAdapter = this.createAdapterFromTx(tx)
        await this.insertDuplicatedChat(txAdapter, chat, newId, now)
        await this.duplicateChatMessages(txAdapter, chat.id, newId)
    }

    private async insertDuplicatedChat(txAdapter: DatabaseAdapter, chat: Chat, newId: string, now: number) {
        await txAdapter.prepare(`
            INSERT INTO chats(id, title, is_Generating, backend, model, folder_id, project_id, is_pinned, is_favorite, metadata, created_at, updated_at)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            newId, `Copy of ${chat.title}`, 0, chat.backend ?? null, chat.model ?? null,
            chat.folderId ?? null, chat.projectId ?? null, chat.isPinned ? 1 : 0, chat.isFavorite ? 1 : 0,
            JSON.stringify(chat.metadata ?? {}), now, now
        )
    }

    private async duplicateChatMessages(txAdapter: DatabaseAdapter, oldChatId: string, newChatId: string) {
        const messages = await txAdapter.prepare('SELECT * FROM messages WHERE chat_id = ?').all<JsonObject>(oldChatId)
        for (const msg of messages) {
            await txAdapter.prepare(`
                INSERT INTO messages(id, chat_id, role, content, timestamp, provider, model, metadata)
                VALUES(?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                uuidv4(), newChatId, msg.role as SqlValue, msg.content as SqlValue, msg.timestamp as SqlValue,
                (msg.provider as SqlValue) ?? null, (msg.model as SqlValue) ?? null,
                (msg.metadata as SqlValue) ?? '{}'
            )
        }
    }

    async deleteMessagesByChatId(chatId: string) {
        try {
            const db = await this.ensureDb()
            await db.prepare('DELETE FROM messages WHERE chat_id = ?').run(chatId)
            return { success: true }
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to delete messages by chat id: ${getErrorMessage(error)} `)
            return { success: false }
        }
    }
    // --- Usage Tracking Methods ---

    async addUsageRecord(record: { provider: string; model: string; timestamp: number }) {
        try {
            const db = await this.ensureDb()
            await db.prepare('INSERT INTO usage_tracking (id, timestamp, provider, model) VALUES (?, ?, ?, ?)').run(
                uuidv4(), record.timestamp, record.provider, record.model
            )
            return { success: true }
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to add usage record: ${getErrorMessage(error)} `)
            return { success: false }
        }
    }

    async getUsageCount(since: number, provider?: string, model?: string): Promise<number> {
        try {
            const db = await this.ensureDb()
            let sql = 'SELECT count(*) as count FROM usage_tracking WHERE timestamp >= ?'
            const params: SqlValue[] = [since]

            if (provider) {
                sql += ' AND provider = ?'
                params.push(provider)
            }
            if (model) {
                sql += ' AND model = ?'
                params.push(model)
            }

            const rows = await db.prepare(sql).all<JsonObject>(...params)
            const row = rows[0]
            return Number(row.count ?? 0)
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to get usage count: ${getErrorMessage(error)} `)
            return 0
        }
    }

    async cleanupUsageRecords(before: number): Promise<void> {
        try {
            const db = await this.ensureDb()
            await db.prepare('DELETE FROM usage_tracking WHERE timestamp < ?').run(before)
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to cleanup usage records: ${getErrorMessage(error)} `)
        }
    }

    // --- Prompt Templates Methods ---

    async getCustomTemplates(): Promise<PromptTemplate[]> {
        try {
            const db = await this.ensureDb()
            const rows = await db.prepare('SELECT * FROM prompt_templates').all<JsonObject>()
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
            }))
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to get custom templates: ${getErrorMessage(error)} `)
            return []
        }
    }

    async addCustomTemplate(template: PromptTemplate): Promise<void> {
        try {
            const db = await this.ensureDb()
            await db.prepare(`
                INSERT INTO prompt_templates(id, name, description, template, variables, category, tags, created_at, updated_at)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                template.id,
                template.name,
                template.description,
                template.template,
                JSON.stringify(template.variables),
                template.category,
                template.tags ? JSON.stringify(template.tags) : null,
                template.createdAt,
                template.updatedAt
            )
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to add custom template: ${getErrorMessage(error)} `)
            throw error
        }
    }

    async updateCustomTemplate(id: string, template: Partial<PromptTemplate>): Promise<void> {
        try {
            const db = await this.ensureDb()

            // Build dynamic update query
            const updates: string[] = []
            const params: SqlValue[] = []

            if (template.name !== undefined) { updates.push('name = ?'); params.push(template.name) }
            if (template.description !== undefined) { updates.push('description = ?'); params.push(template.description) }
            if (template.template !== undefined) { updates.push('template = ?'); params.push(template.template) }
            if (template.variables !== undefined) { updates.push('variables = ?'); params.push(JSON.stringify(template.variables)) }
            if (template.category !== undefined) { updates.push('category = ?'); params.push(template.category) }
            if (template.tags !== undefined) {
                updates.push('tags = ?')
                params.push(JSON.stringify(template.tags))
            }

            updates.push('updated_at = ?')
            params.push(Date.now())

            params.push(id)

            await db.prepare(`
                UPDATE prompt_templates
                SET ${updates.join(', ')}
                WHERE id = ?
            `).run(...params)
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to update custom template: ${getErrorMessage(error)} `)
            throw error
        }
    }

    async deleteCustomTemplate(id: string): Promise<void> {
        try {
            const db = await this.ensureDb()
            await db.prepare('DELETE FROM prompt_templates WHERE id = ?').run(id)
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to delete custom template: ${getErrorMessage(error)} `)
            throw error
        }
    }


    // --- Audit Log Methods ---

    async addAuditLog(entry: AuditLogEntry): Promise<void> {
        try {
            const db = await this.ensureDb()
            await db.prepare(`
                INSERT INTO audit_logs(id, timestamp, action, category, user_id, details, ip_address, user_agent, success, error)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                uuidv4(),
                entry.timestamp,
                entry.action,
                entry.category,
                entry.userId ?? null,
                entry.details ? JSON.stringify(entry.details) : null,
                entry.ipAddress ?? null,
                entry.userAgent ?? null,
                entry.success ? 1 : 0,
                entry.error ?? null
            )
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to add audit log: ${getErrorMessage(error)} `)
            // Don't throw here to ensure audit logging failure doesn't break the app flow usually, 
            // but for critical systems maybe we should. Keeping consistent with previous catch blocks.
        }
    }

    async getAuditLogs(options: {
        category?: string
        startDate?: number
        endDate?: number
        limit?: number
    } = {}): Promise<AuditLogEntry[]> {
        try {
            const db = await this.ensureDb()
            let sql = 'SELECT * FROM audit_logs WHERE 1=1'
            const params: SqlValue[] = []

            if (options.category) {
                sql += ' AND category = ?'
                params.push(options.category)
            }
            if (options.startDate) {
                sql += ' AND timestamp >= ?'
                params.push(options.startDate)
            }
            if (options.endDate) {
                sql += ' AND timestamp <= ?'
                params.push(options.endDate)
            }

            sql += ' ORDER BY timestamp DESC'

            if (options.limit) {
                sql += ' LIMIT ?'
                params.push(options.limit)
            }

            const rows = await db.prepare(sql).all<JsonObject>(...params)
            return rows.map(row => ({
                timestamp: Number(row.timestamp),
                action: String(row.action),
                category: String(row.category) as AuditLogEntry['category'],
                userId: row.user_id as string | undefined,
                details: this.parseJsonField(row.details as string | null, undefined),
                ipAddress: row.ip_address as string | undefined,
                userAgent: row.user_agent as string | undefined,
                success: Boolean(row.success),
                error: row.error as string | undefined
            }))
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to get audit logs: ${getErrorMessage(error)} `)
            return []
        }
    }

    async clearAuditLogs(): Promise<void> {
        try {
            const db = await this.ensureDb()
            await db.prepare('DELETE FROM audit_logs').run()
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to clear audit logs: ${getErrorMessage(error)} `)
            throw error
        }
    }

    // --- Job Scheduler Methods ---

    async getJobState(id: string): Promise<JobState | null> {
        try {
            const db = await this.ensureDb()
            const row = await db.prepare('SELECT last_run FROM scheduler_state WHERE id = ?').get<JsonObject>(id)
            if (!row) { return null }
            return {
                lastRun: Number(row.last_run)
            }
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to get job state: ${getErrorMessage(error)} `)
            return null
        }
    }

    async getAllJobStates(): Promise<Record<string, JobState>> {
        try {
            const db = await this.ensureDb()
            const rows = await db.prepare('SELECT id, last_run FROM scheduler_state').all<JsonObject>()
            const states: Record<string, JobState> = {}
            for (const row of rows) {
                states[String(row.id)] = { lastRun: Number(row.last_run) }
            }
            return states
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to get all job states: ${getErrorMessage(error)} `)
            return {}
        }
    }

    async updateJobLastRun(id: string, lastRun: number): Promise<void> {
        try {
            const db = await this.ensureDb()
            await db.prepare(`
                INSERT INTO scheduler_state(id, last_run, updated_at)
        VALUES(?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET last_run = ?, updated_at = ?
            `).run(id, lastRun, Date.now(), lastRun, Date.now())
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to update job last run: ${getErrorMessage(error)} `)
        }
    }

    // --- Linked Account Methods (New Multi-Account System) ---

    async getLinkedAccounts(provider?: string): Promise<LinkedAccount[]> {
        try {
            const db = await this.ensureDb()
            let sql = 'SELECT * FROM linked_accounts'
            const params: SqlValue[] = []
            if (provider) {
                sql += ' WHERE provider = ?'
                params.push(provider)
            }
            sql += ' ORDER BY created_at ASC'
            const rows = await db.prepare(sql).all<JsonObject>(...params)
            return rows.map(row => this.mapLinkedAccountRow(row))
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to get linked accounts: ${getErrorMessage(error)}`)
            return []
        }
    }

    async getActiveLinkedAccount(provider: string): Promise<LinkedAccount | null> {
        try {
            const db = await this.ensureDb()
            const row = await db.prepare(
                'SELECT * FROM linked_accounts WHERE provider = ? AND is_active = true LIMIT 1'
            ).get<JsonObject>(provider)
            return row ? this.mapLinkedAccountRow(row) : null
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to get active linked account for ${provider}: ${getErrorMessage(error)}`)
            return null
        }
    }

    async saveLinkedAccount(account: LinkedAccount): Promise<void> {
        try {
            const db = await this.ensureDb()
            const values = this.getLinkedAccountParams(account)
            await db.prepare(`
                INSERT INTO linked_accounts(id, provider, email, display_name, avatar_url, access_token, refresh_token, session_token, expires_at, scope, is_active, metadata, created_at, updated_at)
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    provider = excluded.provider,
                    email = excluded.email,
                    display_name = excluded.display_name,
                    avatar_url = excluded.avatar_url,
                    access_token = excluded.access_token,
                    refresh_token = excluded.refresh_token,
                    session_token = excluded.session_token,
                    expires_at = excluded.expires_at,
                    scope = excluded.scope,
                    is_active = excluded.is_active,
                    metadata = excluded.metadata,
                    updated_at = excluded.updated_at
            `).run(...values)
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to save linked account ${account.id}: ${getErrorMessage(error)}`)
            throw error
        }
    }

    private getLinkedAccountParams(account: LinkedAccount): SqlValue[] {
        return [
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
        ]
    }

    async deleteLinkedAccount(id: string): Promise<void> {
        try {
            const db = await this.ensureDb()
            await db.prepare('DELETE FROM linked_accounts WHERE id = ?').run(id)
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to delete linked account ${id}: ${getErrorMessage(error)}`)
            throw error
        }
    }

    async setActiveLinkedAccount(provider: string, accountId: string): Promise<void> {
        try {
            const db = await this.ensureDb()
            // Deactivate all accounts for this provider
            await db.prepare('UPDATE linked_accounts SET is_active = false WHERE provider = ?').run(provider)
            // Activate the specified account
            await db.prepare('UPDATE linked_accounts SET is_active = true WHERE id = ? AND provider = ?').run(accountId, provider)
        } catch (error) {
            appLogger.error('DatabaseService', `Failed to set active linked account: ${getErrorMessage(error)}`)
            throw error
        }
    }

    private mapLinkedAccountRow(row: JsonObject): LinkedAccount {
        return {
            id: String(row.id),
            provider: String(row.provider),
            email: row.email as string | undefined,
            displayName: row.display_name as string | undefined,
            avatarUrl: row.avatar_url as string | undefined,
            accessToken: row.access_token as string | undefined,
            refreshToken: row.refresh_token as string | undefined,
            sessionToken: row.session_token as string | undefined,
            expiresAt: row.expires_at ? Number(row.expires_at) : undefined,
            scope: row.scope as string | undefined,
            isActive: Boolean(row.is_active),
            metadata: this.parseJsonField(row.metadata as string | null, undefined),
            createdAt: Number(row.created_at),
            updatedAt: Number(row.updated_at)
        }
    }

    // --- File Diff Methods ---

    async ensureFileDiffTable(): Promise<void> {
        const db = await this.ensureDb()
        await db.exec(`
            CREATE TABLE IF NOT EXISTS file_diffs (
                id TEXT PRIMARY KEY,
                chat_session_id TEXT,
                ai_system TEXT NOT NULL,
                file_path TEXT NOT NULL,
                before_content TEXT NOT NULL,
                after_content TEXT NOT NULL,
                diff_content TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                change_reason TEXT,
                metadata TEXT DEFAULT '{}'
            )
        `)

        // Create indexes for performance
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_file_diffs_file_path ON file_diffs(file_path)`)
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_file_diffs_timestamp ON file_diffs(timestamp)`)
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_file_diffs_chat_session ON file_diffs(chat_session_id)`)
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_file_diffs_ai_system ON file_diffs(ai_system)`)
    }

    async storeFileDiff(fileDiff: import('@shared/types/file-diff').FileDiff): Promise<void> {
        const db = await this.ensureDb()
        await db.prepare(`
            INSERT INTO file_diffs (
                id, chat_session_id, ai_system, file_path, before_content, 
                after_content, diff_content, timestamp, change_reason, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            fileDiff.id,
            fileDiff.chatSessionId || null,
            fileDiff.aiSystem,
            fileDiff.filePath,
            fileDiff.beforeContent,
            fileDiff.afterContent,
            fileDiff.diffContent,
            fileDiff.timestamp,
            fileDiff.changeReason || null,
            JSON.stringify(fileDiff.metadata || {})
        )
    }

    async getFileDiff(diffId: string): Promise<import('@shared/types/file-diff').FileDiff | null> {
        const db = await this.ensureDb()
        const row = await db.prepare('SELECT * FROM file_diffs WHERE id = ?').get<JsonObject>(diffId)
        if (!row) { return null }

        return {
            id: String(row.id),
            chatSessionId: row.chat_session_id as string | undefined,
            aiSystem: String(row.ai_system) as import('@shared/types/file-diff').AISystemType,
            filePath: String(row.file_path),
            beforeContent: String(row.before_content),
            afterContent: String(row.after_content),
            diffContent: String(row.diff_content),
            timestamp: Number(row.timestamp),
            changeReason: row.change_reason as string | undefined,
            metadata: this.parseJsonField(row.metadata as string | null, {})
        }
    }

    async getFileDiffHistory(filePath: string, limit: number = 50): Promise<import('@shared/types/file-diff').FileDiff[]> {
        const db = await this.ensureDb()
        const rows = await db.prepare(
            'SELECT * FROM file_diffs WHERE file_path = ? ORDER BY timestamp DESC LIMIT ?'
        ).all<JsonObject>(filePath, limit)

        return rows.map(row => ({
            id: String(row.id),
            chatSessionId: row.chat_session_id as string | undefined,
            aiSystem: String(row.ai_system) as import('@shared/types/file-diff').AISystemType,
            filePath: String(row.file_path),
            beforeContent: String(row.before_content),
            afterContent: String(row.after_content),
            diffContent: String(row.diff_content),
            timestamp: Number(row.timestamp),
            changeReason: row.change_reason as string | undefined,
            metadata: this.parseJsonField(row.metadata as string | null, {})
        }))
    }

    async getRecentFileDiffs(limit: number = 100): Promise<import('@shared/types/file-diff').FileDiff[]> {
        const db = await this.ensureDb()
        const rows = await db.prepare(
            'SELECT * FROM file_diffs ORDER BY timestamp DESC LIMIT ?'
        ).all<JsonObject>(limit)

        return rows.map(row => ({
            id: String(row.id),
            chatSessionId: row.chat_session_id as string | undefined,
            aiSystem: String(row.ai_system) as import('@shared/types/file-diff').AISystemType,
            filePath: String(row.file_path),
            beforeContent: String(row.before_content),
            afterContent: String(row.after_content),
            diffContent: String(row.diff_content),
            timestamp: Number(row.timestamp),
            changeReason: row.change_reason as string | undefined,
            metadata: this.parseJsonField(row.metadata as string | null, {})
        }))
    }

    async getFileDiffsBySession(chatSessionId: string): Promise<import('@shared/types/file-diff').FileDiff[]> {
        const db = await this.ensureDb()
        const rows = await db.prepare(
            'SELECT * FROM file_diffs WHERE chat_session_id = ? ORDER BY timestamp ASC'
        ).all<JsonObject>(chatSessionId)

        return rows.map(row => ({
            id: String(row.id),
            chatSessionId: row.chat_session_id as string | undefined,
            aiSystem: String(row.ai_system) as import('@shared/types/file-diff').AISystemType,
            filePath: String(row.file_path),
            beforeContent: String(row.before_content),
            afterContent: String(row.after_content),
            diffContent: String(row.diff_content),
            timestamp: Number(row.timestamp),
            changeReason: row.change_reason as string | undefined,
            metadata: this.parseJsonField(row.metadata as string | null, {})
        }))
    }

    async getFileDiffsBySystem(aiSystem: string, limit: number = 100): Promise<import('@shared/types/file-diff').FileDiff[]> {
        const db = await this.ensureDb()
        const rows = await db.prepare(
            'SELECT * FROM file_diffs WHERE ai_system = ? ORDER BY timestamp DESC LIMIT ?'
        ).all<JsonObject>(aiSystem, limit)

        return rows.map(row => ({
            id: String(row.id),
            chatSessionId: row.chat_session_id as string | undefined,
            aiSystem: String(row.ai_system) as import('@shared/types/file-diff').AISystemType,
            filePath: String(row.file_path),
            beforeContent: String(row.before_content),
            afterContent: String(row.after_content),
            diffContent: String(row.diff_content),
            timestamp: Number(row.timestamp),
            changeReason: row.change_reason as string | undefined,
            metadata: this.parseJsonField(row.metadata as string | null, {})
        }))
    }

    async cleanupOldFileDiffs(maxAgeMs: number): Promise<number> {
        const db = await this.ensureDb()
        const cutoffTime = Date.now() - maxAgeMs
        const result = await db.prepare('DELETE FROM file_diffs WHERE timestamp < ?').run(cutoffTime)
        return result.rowsAffected || 0
    }
}
