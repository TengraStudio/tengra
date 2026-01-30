import { appLogger } from '@main/logging/logger';
import { AuditLogEntry } from '@main/services/analysis/audit-log.service';
import { BaseService } from '@main/services/base.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JobState } from '@main/services/system/job-scheduler.service';
import { PromptTemplate } from '@main/utils/prompt-templates.util';
import { AdvancedSemanticFragment, PendingMemory } from '@shared/types/advanced-memory';
import { CouncilSessionStatus } from '@shared/types/agent';
import { IpcValue, JsonObject, JsonValue } from '@shared/types/common';
import { DatabaseAdapter, SqlParams, SqlValue } from '@shared/types/database';
import { FileDiff } from '@shared/types/file-diff';
import { Project } from '@shared/types/project';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { v4 as uuidv4 } from 'uuid';

import { ChatRepository } from './repositories/chat.repository';
import { KnowledgeRepository } from './repositories/knowledge.repository';
import { ProjectRepository } from './repositories/project.repository';
import { SystemRepository } from './repositories/system.repository';
import { DataService } from './data.service';
import { DatabaseClientService } from './database-client.service';

export type { AuditLogEntry, CouncilSessionStatus, FileDiff, JobState, PromptTemplate };

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
    projectId?: string;
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
export interface SemanticFragment { id: string; content: string; embedding: number[]; source: string; sourceId: string; tags: string[]; importance: number; projectPath?: string | undefined; createdAt: number; updatedAt: number;[key: string]: JsonValue | undefined }
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

export interface Chat { id: string; title: string; model?: string | undefined; messages: JsonObject[]; createdAt: Date; updatedAt: Date; isPinned?: boolean | undefined; isFavorite?: boolean | undefined; folderId?: string | undefined; projectId?: string | undefined; isGenerating?: boolean | undefined; backend?: string | undefined; metadata?: JsonObject | undefined; }

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
    private initPromise: Promise<void> | null = null;
    private initError: Error | null = null;

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
        private eventBus: EventBusService,
        private dbClient: DatabaseClientService
    ) {
        super('DatabaseService');
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
            appLogger.info('DatabaseService', 'Initializing remote database client...');

            // Initialize the database client
            await this.dbClient.initialize();

            const adapter = this.createAdapter();
            this._chats = new ChatRepository(adapter);
            this._projects = new ProjectRepository(adapter);
            this._knowledge = new KnowledgeRepository(adapter);
            this._system = new SystemRepository(adapter);

            appLogger.info('DatabaseService', 'Remote database connection complete!');
            this.eventBus.emit('db:ready', { timestamp: Date.now() });
        } catch (error) {
            appLogger.error('DatabaseService', 'Failed to initialize database client:', error as Error);
            this.initError = error instanceof Error ? error : new Error(String(error));
            this.eventBus.emit('db:error', { error: this.initError.message });
            throw this.initError;
        }
    }

    private async ensureDb(): Promise<DatabaseAdapter> {
        if (this.initPromise) {
            await this.initPromise;
        }
        if (!this.dbClient.isConnected()) {
            throw new Error(`Database client not connected. Reason: ${this.initError?.message ?? 'unknown'}`);
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

    public getDatabase(): DatabaseAdapter {
        return this.createAdapter();
    }

    private createAdapter(): DatabaseAdapter {
        return {
            query: async <T = JsonObject>(sql: string, params?: SqlParams) => {
                const res = await this.dbClient.executeQuery({ sql, params: params as (string | number | boolean | null)[] });
                return { rows: res.rows as unknown as T[], fields: [] };
            },
            exec: async (sql) => {
                await this.dbClient.executeQuery({ sql });
            },
            transaction: async <T>(fn: (tx: DatabaseAdapter) => Promise<T>) => {
                // Remote transactions are not supported yet, fallback to individual queries
                return await fn(this.createAdapter());
            },
            prepare: (sql: string) => {
                return {
                    run: async (...params: SqlValue[]) => {
                        const res = await this.dbClient.executeQuery({ sql, params: params as (string | number | boolean | null)[] });
                        return { rowsAffected: res.affected_rows, insertId: undefined };
                    },
                    all: async <T = unknown>(...params: SqlValue[]) => {
                        const res = await this.dbClient.executeQuery({ sql, params: params as (string | number | boolean | null)[] });
                        return res.rows as unknown as T[];
                    },
                    get: async <T = unknown>(...params: SqlValue[]) => {
                        const res = await this.dbClient.executeQuery({ sql, params: params as (string | number | boolean | null)[] });
                        return res.rows[0] as unknown as T;
                    }
                };
            }
        };
    }

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
    async hasIndexedSymbols(projectPath: string) { return this._projects.hasIndexedSymbols(projectPath); }
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
    async findCodeSymbolsByName(projectPath: string, name: string) { return this._knowledge.findCodeSymbolsByName(projectPath, name); }
    async searchCodeSymbols(vec: number[], projectPath?: string): Promise<CodeSymbolSearchResult[]> {
        // Use HTTP API for vector search (handled by Rust service with cosine similarity)
        const results = await this.dbClient.searchCodeSymbols({ embedding: vec, limit: 10, project_path: projectPath });
        return results.map(r => ({
            id: r.id,
            name: r.name,
            path: r.file_path,
            line: r.line,
            kind: r.kind,
            signature: r.signature ?? '',
            docstring: r.docstring ?? '',
            score: 0.9
        }));
    }
    async storeCodeSymbol(symbol: CodeSymbolRecord) {
        // Use HTTP API for storing code symbols with embeddings
        await this.dbClient.storeCodeSymbol({
            id: symbol.id,
            project_path: symbol.project_path ?? symbol.projectId ?? '',
            file_path: symbol.file_path ?? symbol.path ?? '',
            name: symbol.name,
            line: symbol.line,
            kind: symbol.kind,
            signature: symbol.signature,
            docstring: symbol.docstring,
            embedding: symbol.embedding ?? symbol.vector
        });
    }
    async clearCodeSymbols(projectPath: string) { return this._knowledge.clearCodeSymbols(projectPath); }
    async deleteCodeSymbolsForFile(projectPath: string, filePath: string) { return this._knowledge.deleteCodeSymbolsForFile(projectPath, filePath); }
    async searchCodeContentByText(projectPath: string, query: string) { return this._knowledge.searchCodeContentByText(projectPath, query); }
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
            project_path: f.projectPath
        });
    }
    async searchSemanticFragments(v: number[], l: number, projectPath?: string): Promise<SemanticFragment[]> {
        // Use HTTP API for vector search (handled by Rust service with cosine similarity)
        const results = await this.dbClient.searchSemanticFragments({ embedding: v, limit: l, project_path: projectPath });
        return results.map(r => ({
            id: r.id,
            content: r.content,
            embedding: r.embedding,
            source: r.source,
            sourceId: r.source_id,
            tags: r.tags,
            importance: r.importance,
            projectPath: r.project_path,
            createdAt: r.created_at,
            updatedAt: r.updated_at
        }));
    }
    async getAllSemanticFragments() { return this._knowledge.getAllSemanticFragments(); }
    async clearSemanticFragments(projectPath: string) { return this._knowledge.clearSemanticFragments(projectPath); }
    async deleteSemanticFragmentsForFile(projectPath: string, filePath: string) { return this._knowledge.deleteSemanticFragmentsForFile(projectPath, filePath); }
    async storeEpisodicMemory(m: EpisodicMemory) { return this._knowledge.storeEpisodicMemory(m); }
    async searchEpisodicMemories(e: number[], l: number = 10) {
        // For episodic memories, use text search when no embedding, otherwise fallback to knowledge repo
        if (e.length === 0) {
            return this._knowledge.searchEpisodicMemories(e, l);
        }
        // TODO: Add dedicated episodic memory vector search endpoint to Rust service
        return this._knowledge.searchEpisodicMemories(e, l);
    }
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
    async addTokenUsage(record: TokenUsageRecord) {
        let projectPath = record.projectId;
        if (projectPath && !projectPath.includes('/') && !projectPath.includes('\\')) {
            // It looks like a UUID, try to resolve to path
            const projects = await this.getProjects();
            const project = projects.find(p => p.id === projectPath);
            if (project) { projectPath = project.path; }
        }
        return this._system.addTokenUsage({ ...record, projectId: projectPath });
    }
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

    async addUsageRecord(record: { provider: string; model: string; timestamp: number }) {
        await this.ensureInitialized();
        return this._system.addUsageRecord(record);
    }
    async getUsageCount(since: number, provider?: string, model?: string) {
        await this.ensureInitialized();
        return this._system.getUsageCount(since, provider, model);
    }
    async cleanupUsageRecords(before: number) {
        await this.ensureInitialized();
        return this._system.cleanupUsageRecords(before);
    }

    private async ensureInitialized(): Promise<void> {
        if (!this._system) {
            await this.initialize();
        }
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
        // Resolve project by path to get its root path for the project_path column
        const projects = await this.getProjects();
        // Sort projects by path length descending to find the closest match (most specific root)
        const sortedProjects = [...projects].sort((a, b) => b.path.length - a.path.length);
        const project = sortedProjects.find(p => diff.filePath.startsWith(p.path));

        return this._knowledge.storeFileDiff({
            id: diff.id,
            projectId: project?.path ?? '', // Use path for project_path column
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
    async searchSemanticFragmentsByText(projectPath: string, query: string) { return this._knowledge.searchSemanticFragmentsByText(projectPath, query); }
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

    // Helper
    private parseJsonField<T>(json: string | null | undefined, defaultValue: T): T {
        if (typeof json !== 'string' || json.trim() === '') { return defaultValue; }
        const parsed = safeJsonParse<unknown>(json, defaultValue);
        return (typeof parsed === 'string' ? safeJsonParse<T>(parsed, defaultValue) : parsed) as T;
    }
}
