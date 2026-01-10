import { DataService } from './data.service'
import { LanceDbService } from './lancedb.service'
import Database from 'better-sqlite3'
import type { Database as DatabaseType } from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { WorkspaceMount } from '../../../shared/types/workspace'
import { JsonObject, JsonValue } from '../../../shared/types/common'
import { getErrorMessage } from '../../../shared/utils/error.util'

// Code intelligence types for stub methods
export interface CodeSymbolSearchResult {
    id: string;
    name: string;
    path: string;
    line: number;
    score?: number;
}

export interface CodeSymbolRecord {
    id: string;
    project_path?: string;  // Alternative for projectId
    projectId?: string;
    file_path?: string;     // Alternative for path
    name: string;
    path?: string;
    line: number;
    kind: string;
    signature?: string;
    docstring?: string;
    embedding?: number[];
    vector?: number[];      // Alternative for embedding
}

/**
 * Represents a logical grouping of chats.
 * 
 * @interface Folder
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {string} [color] - Optional hex color code for UI decoration
 * @property {number} createdAt - Timestamp of creation
 * @property {number} updatedAt - Timestamp of last modification
 */
export interface Folder {
    id: string
    name: string
    color?: string
    createdAt: number
    updatedAt: number
}

/**
 * Reusable system or user-defined prompt template.
 * 
 * @interface Prompt
 * @property {string} id - Unique identifier
 * @property {string} title - Short descriptive title
 * @property {string} content - The prompt text content
 * @property {string[]} tags - Taxonomy tags for categorization
 * @property {number} createdAt - Timestamp of creation
 * @property {number} updatedAt - Timestamp of last modification
 */
export interface Prompt {
    id: string
    title: string
    content: string
    tags: string[]
    createdAt: number
    updatedAt: number
}

/**
 * Individual message within a chat conversation.
 * 
 * @interface ChatMessage
 * @property {string} role - Message sender role (user, assistant, system)
 * @property {string} content - Text content of the message
 * @property {number} [timestamp] - Time of message creation
 * @property {number[]} [vector] - Embedding vector for semantic search
 */
export interface ChatMessage {
    role: string
    content: string
    timestamp?: number
    vector?: number[]
    [key: string]: JsonValue | undefined
}

/**
 * Vector-searchable fragment of semantic knowledge.
 * 
 * @interface SemanticFragment
 * @property {string} id - Unique identifier
 * @property {string} content - Text content
 * @property {number[]} embedding - Vector representation
 * @property {string} source - Origin source type (e.g. 'chat', 'document')
 * @property {string} sourceId - ID of the origin source
 * @property {string[]} tags - Categorization tags
 * @property {number} importance - Relevance score (0-1)
 * @property {number} createdAt - Creation timestamp
 * @property {number} updatedAt - Update timestamp
 */
export interface SemanticFragment {
    id: string
    content: string
    embedding: number[]
    source: string
    sourceId: string
    tags: string[]
    importance: number
    createdAt: number
    updatedAt: number
    [key: string]: string | number | string[] | number[]
}

/**
 * High-level memory summary of a conversation event.
 * 
 * @interface EpisodicMemory
 * @property {string} id - Unique identifier
 * @property {string} title - Short summary title
 * @property {string} summary - Detailed summary content
 * @property {number[]} embedding - Vector representation of the summary
 * @property {number} startDate - Start time of the episode
 * @property {number} endDate - End time of the episode
 * @property {string} chatId - Associated chat ID
 * @property {string[]} participants - List of participant identifiers
 * @property {number} createdAt - Creation timestamp
 */
export interface EpisodicMemory {
    id: string
    title: string
    summary: string
    embedding: number[]
    startDate: number
    endDate: number
    chatId: string
    participants: string[]
    createdAt: number
}

/**
 * Structured key-value knowledge extracted from conversations.
 * 
 * @interface EntityKnowledge
 * @property {string} id - Unique identifier
 * @property {string} entityType - Type of entity (e.g. 'user', 'project')
 * @property {string} entityName - Name of the specific entity
 * @property {string} key - Attribute key
 * @property {string} value - Attribute value
 * @property {number} confidence - Extraction confidence score (0-1)
 * @property {string} source - Origin of this knowledge
 * @property {number} updatedAt - Last update timestamp
 */
export interface EntityKnowledge {
    id: string
    entityType: string
    entityName: string
    key: string
    value: string
    confidence: number
    source: string
    updatedAt: number
}

/**
 * Log entry for Council (AI Agent) operations.
 * 
 * @interface CouncilLog
 * @property {string} id - Unique identifier
 * @property {string} sessionId - Associated session ID
 * @property {string} agentId - ID of the agent generating the log
 * @property {string} message - Log content
 * @property {number} timestamp - Time of occurrence
 * @property {string} type - Log severity/type
 */
export interface CouncilLog {
    id: string
    sessionId: string
    agentId: string
    message: string
    timestamp: number
    type: 'info' | 'error' | 'success' | 'plan' | 'action'
}

export interface AgentProfile {
    id: string
    name: string
    role: string
    description: string
}

/**
 * A collaborative session between multiple AI agents.
 * 
 * @interface CouncilSession
 * @property {string} id - Unique identifier
 * @property {string} goal - The objective of the session
 * @property {string} status - Current execution state
 * @property {CouncilLog[]} logs - Interaction history
 * @property {AgentProfile[]} agents - Participating agents
 * @property {string} [plan] - Derived execution plan
 * @property {string} [solution] - Final outcome
 * @property {number} createdAt - Creation timestamp
 * @property {number} updatedAt - Update timestamp
 */
export interface CouncilSession {
    id: string
    goal: string
    status: 'planning' | 'executing' | 'completed' | 'failed'
    logs: CouncilLog[]
    agents: AgentProfile[]
    plan?: string
    solution?: string
    createdAt: number
    updatedAt: number
}

/**
 * Project workspace configuration.
 * 
 * @interface Project
 * @property {string} id - Unique identifier
 * @property {string} title - Display name
 * @property {string} description - Short description
 * @property {string} path - Absolute filesystem path
 * @property {WorkspaceMount[]} mounts - Mounted directories (local/SSH)
 * @property {string[]} chatIds - Associated chat IDs
 * @property {object} councilConfig - AI Council configuration
 * @property {'active' | 'archived' | 'draft'} status - Project state
 * @property {string} [logo] - Optional logo path or data URI
 * @property {JsonObject} [metadata] - Extra metadata
 * @property {number} createdAt - Creation timestamp
 * @property {number} updatedAt - Update timestamp
 */
export interface Project {
    id: string
    title: string
    description: string
    path: string
    mounts: WorkspaceMount[]
    chatIds: string[]
    councilConfig: {
        enabled: boolean
        members: string[]
        consensusThreshold: number
    }
    status: 'active' | 'archived' | 'draft'
    logo?: string
    metadata?: JsonObject
    createdAt: number
    updatedAt: number
}

/**
 * Persists and manages application state, including Folders, Prompts, Sessions, and Projects.
 * 
 * Acts as a local JSON-based database with basic CRUD operations and vector search capabilities.
 */
export class DatabaseService {
    private foldersPath: string
    private folders: Folder[] = []
    private promptsPath: string
    private prompts: Prompt[] = []
    private councilPath: string
    private councilSessions: CouncilSession[] = []
    private projectsPath: string // Legacy JSON path for migration
    private db: DatabaseType // SQLite database connection

    constructor(private dataService: DataService, _lanceDbService: LanceDbService) {
        this.foldersPath = path.join(this.dataService.getPath('db'), 'folders.json')
        this.promptsPath = path.join(this.dataService.getPath('db'), 'prompts.json')
        this.councilPath = path.join(this.dataService.getPath('db'), 'council.json')
        this.projectsPath = path.join(this.dataService.getPath('db'), 'projects.json')

        // Initialize SQLite database
        const dbPath = path.join(this.dataService.getPath('db'), 'orbit.db')
        this.db = new Database(dbPath)

        // Task 13: SQLite Optimizations ("Connection Pooling" context)
        this.db.pragma('journal_mode = WAL') // Better concurrency
        this.db.pragma('synchronous = NORMAL') // Faster writes, still safe in WAL
        this.db.pragma('busy_timeout = 5000') // Wait up to 5s if locked
        this.db.pragma('cache_size = -4000') // Use ~4MB cache

        this.runMigrations()
    }

    getDatabase(): DatabaseType {
        return this.db;
    }

    /**
     * Runs database migrations (Task 12).
     */
    private runMigrations() {
        // Ensure migrations table exists
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                run_at INTEGER NOT NULL
            )
        `);

        const migrations = [
            {
                id: 1,
                name: 'Initial Schema',
                up: () => {
                    this.db.exec(`
                        CREATE TABLE IF NOT EXISTS projects (
                            id TEXT PRIMARY KEY,
                            title TEXT NOT NULL,
                            description TEXT DEFAULT '',
                            path TEXT NOT NULL,
                            mounts TEXT DEFAULT '[]',
                            chat_ids TEXT DEFAULT '[]',
                            council_config TEXT DEFAULT '{"enabled":false,"members":[],"consensusThreshold":0.7}',
                            status TEXT DEFAULT 'active',
                            logo TEXT,
                            metadata TEXT DEFAULT '{}',
                            created_at INTEGER NOT NULL,
                            updated_at INTEGER NOT NULL
                        );
                        CREATE TABLE IF NOT EXISTS chat_events (
                            id TEXT PRIMARY KEY,
                            thread_id TEXT NOT NULL,
                            type TEXT NOT NULL,
                            payload TEXT NOT NULL,
                            timestamp INTEGER NOT NULL,
                            metadata TEXT DEFAULT '{}'
                        );
                        CREATE INDEX IF NOT EXISTS idx_chat_events_thread_id ON chat_events(thread_id);
                    `);
                }
            },
            // Future migrations can be added here
        ];

        const getAppliedMigrations = this.db.prepare('SELECT id FROM migrations').pluck();
        const appliedIds = new Set(getAppliedMigrations.all() as number[]);

        for (const migration of migrations) {
            if (!appliedIds.has(migration.id)) {
                console.log(`[Database] Running migration ${migration.id}: ${migration.name}`);
                try {
                    this.db.transaction(() => {
                        migration.up();
                        this.db.prepare('INSERT INTO migrations (id, name, run_at) VALUES (?, ?, ?)').run(migration.id, migration.name, Date.now());
                    })();
                } catch (error) {
                    console.error(`[Database] Migration ${migration.id} failed:`, error);
                    throw error; // Stop startup if migration fails
                }
            }
        }
    }

    /**
     * Initializes the database service.
     * 
     * Loads all persisted data (folders, prompts, council sessions, projects) into memory.
     * Should be called at application startup.
     */
    async initialize() {
        await this.loadFolders()
        await this.loadPrompts()
        await this.loadCouncilSessions()
        await this.migrateProjectsFromJson() // One-time migration
    }

    /**
     * Migrates projects from legacy JSON file to SQLite.
     * Only runs if projects.json exists and SQLite projects table is empty.
     * @private
     */
    private async migrateProjectsFromJson() {
        try {
            // Check if migration is needed
            const count = this.db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number }
            if (count.count > 0) return // Already migrated

            // Check if legacy JSON file exists
            if (!fs.existsSync(this.projectsPath)) return

            const data = await fs.promises.readFile(this.projectsPath, 'utf-8')
            const legacyProjects = JSON.parse(data) as JsonObject[]

            if (!Array.isArray(legacyProjects) || legacyProjects.length === 0) return

            // Prepare insert statement
            const insert = this.db.prepare(`
                INSERT INTO projects (id, title, description, path, mounts, chat_ids, council_config, status, logo, metadata, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)

            // Migrate each project
            const transaction = this.db.transaction((projects: JsonObject[]) => {
                for (const p of projects) {
                    const id = (p.id as string) || uuidv4()
                    const title = (p.title as string) || (p.name as string) || 'Untitled'
                    const description = (p.description as string) || ''
                    const projectPath = (p.path as string) || ''

                    // Handle mounts - could be string[] or WorkspaceMount[]
                    let mounts = p.mounts
                    if (typeof mounts === 'string') {
                        try { mounts = JSON.parse(mounts) } catch { mounts = [] }
                    }
                    if (!Array.isArray(mounts)) mounts = []

                    // Handle chatIds
                    let chatIds = p.chatIds
                    if (typeof chatIds === 'string') {
                        try { chatIds = JSON.parse(chatIds) } catch { chatIds = [] }
                    }
                    if (!Array.isArray(chatIds)) chatIds = []

                    // Handle councilConfig
                    let councilConfig = p.councilConfig
                    if (typeof councilConfig === 'string') {
                        try { councilConfig = JSON.parse(councilConfig) } catch { councilConfig = null }
                    }
                    if (!councilConfig || typeof councilConfig !== 'object') {
                        councilConfig = { enabled: false, members: [], consensusThreshold: 0.7 }
                    }

                    const status = (p.status as string) || 'active'
                    const logo = (p.logo as string) || null
                    const metadata = p.metadata && typeof p.metadata === 'object' ? p.metadata : {}
                    const createdAt = (p.createdAt as number) || Date.now()
                    const updatedAt = (p.updatedAt as number) || Date.now()

                    insert.run(
                        id,
                        title,
                        description,
                        projectPath,
                        JSON.stringify(mounts),
                        JSON.stringify(chatIds),
                        JSON.stringify(councilConfig),
                        status,
                        logo,
                        JSON.stringify(metadata),
                        createdAt,
                        updatedAt
                    )
                }
            })

            transaction(legacyProjects)
            console.log(`Migrated ${legacyProjects.length} projects from JSON to SQLite`)

            // Optionally rename old file to mark as migrated
            await fs.promises.rename(this.projectsPath, this.projectsPath + '.migrated')
        } catch (error) {
            console.error('Failed to migrate projects from JSON:', getErrorMessage(error as Error))
        }
    }

    /**
     * Loads council sessions from disk.
     * Handles file read errors gracefully by initializing empty array.
     * @private
     */
    private async loadCouncilSessions() {
        try {
            if (await fs.promises.stat(this.councilPath).then(() => true).catch(() => false)) {
                const data = await fs.promises.readFile(this.councilPath, 'utf-8')
                this.councilSessions = JSON.parse(data)
            }
        } catch (error) {
            console.error('Failed to load council sessions:', getErrorMessage(error as Error))
            this.councilSessions = []
        }
    }

    /**
     * Persists council sessions to `council.json`.
     * @private
     */
    private async saveCouncilSessions() {
        try {
            await fs.promises.writeFile(this.councilPath, JSON.stringify(this.councilSessions, null, 2), 'utf-8')
        } catch (error) {
            console.error('Failed to save council sessions:', getErrorMessage(error as Error))
        }
    }

    /**
     * Loads prompts from disk.
     * @private
     */
    private async loadPrompts() {
        try {
            if (await fs.promises.stat(this.promptsPath).then(() => true).catch(() => false)) {
                const data = await fs.promises.readFile(this.promptsPath, 'utf-8')
                this.prompts = JSON.parse(data)
            }
        } catch (error) {
            console.error('Failed to load prompts:', getErrorMessage(error as Error))
            this.prompts = []
        }
    }

    /**
     * Persists prompts to `prompts.json`.
     * @private
     */
    private async savePrompts() {
        try {
            await fs.promises.writeFile(this.promptsPath, JSON.stringify(this.prompts, null, 2), 'utf-8')
        } catch (error) {
            console.error('Failed to save prompts:', getErrorMessage(error as Error))
        }
    }

    /**
     * Loads semantic folders from disk.
     * @private
     */
    private async loadFolders() {
        try {
            if (fs.existsSync(this.foldersPath)) {
                const data = await fs.promises.readFile(this.foldersPath, 'utf-8')
                this.folders = JSON.parse(data)
            }
        } catch (error) {
            console.error('Failed to load folders:', getErrorMessage(error as Error))
            this.folders = []
        }
    }

    /**
     * Persists folders to `folders.json`.
     * @private
     */
    private async saveFolders() {
        try {
            await fs.promises.writeFile(this.foldersPath, JSON.stringify(this.folders, null, 2), 'utf-8')
        } catch (error) {
            console.error('Failed to save folders:', getErrorMessage(error as Error))
        }
    }

    /**
     * Maps a SQLite row to a Project object.
     * Parses JSON fields and applies defaults.
     * @private
     */
    private mapRowToProject(row: JsonObject): Project {
        return {
            id: row.id as string,
            title: row.title as string,
            description: (row.description as string) || '',
            path: row.path as string,
            mounts: this.parseJsonField<WorkspaceMount[]>(row.mounts as string, []),
            chatIds: this.parseJsonField<string[]>(row.chat_ids as string, []),
            councilConfig: this.parseJsonField(row.council_config as string, {
                enabled: false,
                members: [],
                consensusThreshold: 0.7
            }),
            status: (row.status as Project['status']) || 'active',
            logo: row.logo as string | undefined,
            metadata: this.parseJsonField<JsonObject>(row.metadata as string, {}),
            createdAt: row.created_at as number,
            updatedAt: row.updated_at as number
        }
    }

    /**
     * Safely parses a JSON string with a fallback default.
     * @private
     */
    private parseJsonField<T>(json: string | null | undefined, defaultValue: T): T {
        if (!json) return defaultValue
        try {
            return JSON.parse(json) as T
        } catch {
            return defaultValue
        }
    }



    // --- Chat Management (Stubs) ---

    /**
     * Creates a new chat session.
     * @param _chat - Chat data object
     */
    async createChat(_chat: JsonObject) { return { success: true } }

    /**
     * Updates an existing chat.
     * @param _id - Chat ID
     * @param _updates - Fields to update
     */
    async updateChat(_id: string, _updates: JsonObject) { return { success: true } }

    /**
     * Deletes a chat session.
     * @param _id - Chat ID
     */
    async deleteChat(_id: string) { return { success: true } }

    /**
     * Duplicates an existing chat.
     * @param _id - Source chat ID
     */
    async duplicateChat(_id: string) { return null }

    /**
     * Archives or unarchives a chat.
     * @param _id - Chat ID
     * @param _isArchived - New archive state
     */
    async archiveChat(_id: string, _isArchived: boolean) { return { success: true } }

    /**
     * Retrieves a specific chat.
     * @param _id - Chat ID
     */
    async getChat(_id: string) { return null }

    /**
     * Retrieves all chat sessions.
     */
    async getAllChats() { return [] }

    /**
     * Searches chats by query string.
     * @param _query - Search term
     */
    async searchChats(_query: string) { return [] }

    /**
     * Adds a message to a chat.
     */
    async addMessage(_message: JsonObject) { return { success: true } }

    /**
     * Deletes a specific message.
     */
    async deleteMessage(_id: string) { return { success: true } }

    /**
     * Updates a specific message.
     */
    async updateMessage(_id: string, _updates: JsonObject) { return { success: true } }

    /**
     * Deletes all chat sessions.
     */
    async deleteAllChats() { return { success: true } }

    /**
     * Deletes all messages in a specific chat.
     */
    async deleteMessages(_chatId: string) { return { success: true } }

    /**
     * Retrieves all messages for a chat.
     */
    async getMessages(_chatId: string) { return [] }

    /**
     * Retrieves all messages for a chat (Typed).
     * Alias for getMessages.
     */
    async getChatMessages(_chatId: string): Promise<ChatMessage[]> { return [] }

    /**
     * Deletes chats matching a specific title.
     */
    async deleteChatsByTitle(_title: string) { return { success: true } }

    // --- Statistics ---

    /**
     * Retrieves basic database statistics.
     */
    async getStats() { return { chatCount: 0, messageCount: 0, dbSize: 0 } }

    /**
     * Retrieves detailed statistics for a specific period.
     */
    async getDetailedStats(_period: string) { return { chatCount: 0, messageCount: 0, dbSize: 0, totalTokens: 0, promptTokens: 0, completionTokens: 0, tokenTimeline: [], activity: [] } }

    // --- Project Management ---

    /**
     * Retrieves all registered projects from SQLite.
     */
    async getProjects(): Promise<Project[]> {
        const rows = this.db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as JsonObject[]
        return rows.map(row => this.mapRowToProject(row))
    }

    /**
     * Retrieves a single project by ID.
     */
    async getProject(id: string): Promise<Project | undefined> {
        const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as JsonObject | undefined
        return row ? this.mapRowToProject(row) : undefined
    }

    /**
     * Creates a new project workspace.
     * 
     * @param name - Project display name
     * @param projectPath - Absolute filesystem path
     * @param description - Short description
     * @param mounts - JSON string of mounted directories
     * @param councilConfig - Optional council configuration
     * @returns Created project object
     */
    async createProject(
        name: string,
        projectPath: string,
        description: string,
        mounts?: string,
        councilConfig?: string
    ): Promise<Project> {
        const id = uuidv4()
        const now = Date.now()
        const parsedMounts = mounts ? JSON.parse(mounts) : []
        const parsedCouncilConfig = councilConfig ? JSON.parse(councilConfig) : {
            enabled: false,
            members: [],
            consensusThreshold: 0.7
        }

        this.db.prepare(`
            INSERT INTO projects (id, title, description, path, mounts, chat_ids, council_config, status, logo, metadata, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            name,
            description || '',
            projectPath,
            JSON.stringify(parsedMounts),
            JSON.stringify([]),
            JSON.stringify(parsedCouncilConfig),
            'active',
            null,
            JSON.stringify({}),
            now,
            now
        )

        return {
            id,
            title: name,
            description: description || '',
            path: projectPath,
            mounts: parsedMounts,
            chatIds: [],
            councilConfig: parsedCouncilConfig,
            status: 'active',
            createdAt: now,
            updatedAt: now
        }
    }

    /**
     * Updates an existing project.
     * 
     * @param id - Project ID
     * @param updates - Partial update object
     * @returns Updated project or undefined if not found
     */
    async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
        const existing = await this.getProject(id)
        if (!existing) return undefined

        const now = Date.now()
        const merged = { ...existing, ...updates, updatedAt: now }

        this.db.prepare(`
            UPDATE projects SET
                title = ?,
                description = ?,
                path = ?,
                mounts = ?,
                chat_ids = ?,
                council_config = ?,
                status = ?,
                logo = ?,
                metadata = ?,
                updated_at = ?
            WHERE id = ?
        `).run(
            merged.title,
            merged.description,
            merged.path,
            JSON.stringify(merged.mounts),
            JSON.stringify(merged.chatIds),
            JSON.stringify(merged.councilConfig),
            merged.status,
            merged.logo || null,
            JSON.stringify(merged.metadata || {}),
            now,
            id
        )

        return merged
    }

    /**
     * Deletes a project by ID.
     */
    async deleteProject(id: string): Promise<void> {
        this.db.prepare('DELETE FROM projects WHERE id = ?').run(id)
    }

    /**
     * Toggles a project's archived status.
     */
    async archiveProject(id: string, isArchived: boolean): Promise<void> {
        const now = Date.now()
        this.db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?')
            .run(isArchived ? 'archived' : 'active', now, id)
    }

    // --- Folder Management ---

    /**
     * Retrieves all folders.
     */
    async getFolders() {
        return this.folders
    }

    /**
     * Alias for getFolders.
     */
    async getAllFolders() {
        return this.folders
    }

    /**
     * Creates a new folder.
     * 
     * @param name - Display name
     * @param color - Optional hex color
     */
    async createFolder(name: string, color?: string) {
        const folder: Folder = {
            id: uuidv4(),
            name,
            color,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }
        this.folders.push(folder)
        await this.saveFolders()
        return folder
    }

    /**
     * Deletes a folder by ID.
     */
    async deleteFolder(id: string) {
        this.folders = this.folders.filter(f => f.id !== id)
        await this.saveFolders()
    }

    /**
     * Updates an existing folder.
     */
    async updateFolder(id: string, updates: Partial<Folder>) {
        const index = this.folders.findIndex(f => f.id === id)
        if (index !== -1) {
            this.folders[index] = { ...this.folders[index], ...updates, updatedAt: Date.now() }
            await this.saveFolders()
            return this.folders[index]
        }
        return null
    }

    // --- Prompt Management ---

    /**
     * Retrieves all saved prompts.
     */
    async getPrompts() {
        return this.prompts
    }

    /**
     * Creates a new prompt template.
     * 
     * @param title - Prompt title
     * @param content - Text content
     * @param tags - Taxonomy tags
     */
    async createPrompt(title: string, content: string, tags: string[] = []) {
        const prompt: Prompt = {
            id: uuidv4(),
            title,
            content,
            tags,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }
        this.prompts.push(prompt)
        await this.savePrompts()
        return prompt
    }

    /**
     * Deletes a prompt by ID.
     */
    async deletePrompt(id: string) {
        this.prompts = this.prompts.filter(p => p.id !== id)
        await this.savePrompts()
    }

    /**
     * Updates an existing prompt.
     */
    async updatePrompt(id: string, updates: Partial<Prompt>) {
        const index = this.prompts.findIndex(p => p.id === id)
        if (index !== -1) {
            this.prompts[index] = { ...this.prompts[index], ...updates, updatedAt: Date.now() }
            await this.savePrompts()
            return this.prompts[index]
        }
        return null
    }

    // --- Semantic Memory (Stubs) ---
    async storeSemanticFragment(_fragment: SemanticFragment) { }
    async searchSemanticFragments(_vector: number[], _limit: number): Promise<SemanticFragment[]> { return [] }
    async searchSemanticFragmentsByText(_query: string, _limit: number): Promise<SemanticFragment[]> { return [] }
    async deleteSemanticFragment(_id: string): Promise<boolean> { return true }
    async getAllSemanticFragments(): Promise<SemanticFragment[]> { return [] }

    // --- Episodic Memory (Stubs) ---
    async storeEpisodicMemory(_memory: EpisodicMemory) { }
    async searchEpisodicMemories(_vector: number[], _limit: number): Promise<EpisodicMemory[]> { return [] }
    async searchEpisodicMemoriesByText(_query: string, _limit: number): Promise<EpisodicMemory[]> { return [] }
    async getAllEpisodicMemories(): Promise<EpisodicMemory[]> { return [] }

    // --- Entity Knowledge (Stubs) ---
    async storeEntityKnowledge(_knowledge: EntityKnowledge) { }
    async getEntityKnowledge(_entityName: string): Promise<EntityKnowledge[]> { return [] }
    async deleteEntityKnowledge(_id: string): Promise<boolean> { return true }
    async getAllEntityKnowledge(): Promise<EntityKnowledge[]> { return [] }

    // --- General Memory (Stubs) ---
    async recallMemory(_key: string): Promise<string | null> { return null }
    async storeMemory(_key: string, _value: string) { }

    // --- Code Intelligence (Stubs) ---
    async searchCodeSymbols(_vector: number[]): Promise<CodeSymbolSearchResult[]> { return [] }
    async clearCodeSymbols(_projectId: string) { }
    async storeCodeSymbol(_symbol: CodeSymbolRecord) { }

    // --- Council / Agents ---

    /**
     * Retrieves all council sessions.
     */
    async getCouncilSessions() {
        // Return shallow copy (or reverse order) if needed, for now straight return
        return this.councilSessions
    }

    /**
     * Retrieves a council session by ID.
     */
    async getCouncilSession(id: string) {
        return this.councilSessions.find(s => s.id === id) || null
    }

    /**
     * Creates a new council session.
     * 
     * Initializes default agents (Planner, Executor).
     * @param goal - High-level goal for the session
     * @returns Created session object
     */
    async createCouncilSession(goal: string) {
        // Default agents for now
        const agents: AgentProfile[] = [
            { id: 'uuid-planner', name: 'Planner', role: 'planner', description: 'Decomposes complex goals into actionable plans.' },
            { id: 'uuid-executor', name: 'Executor', role: 'executor', description: 'Executes commands and tools.' },
        ]

        const session: CouncilSession = {
            id: uuidv4(),
            goal,
            status: 'planning',
            logs: [],
            agents,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }

        // Add initial log
        session.logs.push({
            id: uuidv4(),
            sessionId: session.id,
            agentId: 'system',
            message: `Session initialized for goal: "${goal}"`,
            timestamp: Date.now(),
            type: 'info'
        })

        this.councilSessions.push(session)
        await this.saveCouncilSessions()
        return session
    }

    /**
     * Appends a log entry to a council session.
     * 
     * @param sessionId - Session to update
     * @param agentId - Agent adding the log
     * @param message - Content
     * @param type - Log type
     */
    async addCouncilLog(sessionId: string, agentId: string, message: string, type: 'info' | 'error' | 'success' | 'plan' | 'action' = 'info') {
        const session = this.councilSessions.find(s => s.id === sessionId)
        if (session) {
            const log = {
                id: uuidv4(),
                sessionId,
                agentId,
                message,
                timestamp: Date.now(),
                type
            }
            session.logs.push(log)
            session.updatedAt = Date.now()
            await this.saveCouncilSessions()
            return log
        }
        throw new Error('Session not found')
    }

    /**
     * Updates the status of a council session.
     * 
     * @param sessionId - Session ID
     * @param status - New status
     * @param plan - Optional plan string
     * @param solution - Optional solution outcome
     */
    async updateCouncilStatus(sessionId: string, status: 'planning' | 'executing' | 'completed' | 'failed', plan?: string, solution?: string) {
        const session = this.councilSessions.find(s => s.id === sessionId)
        if (session) {
            session.status = status
            if (plan !== undefined) session.plan = plan
            if (solution !== undefined) session.solution = solution
            session.updatedAt = Date.now()
            await this.saveCouncilSessions()
        }
    }

    // --- Deprecated / Shims ---

    /**
     * @deprecated Use createCouncilSession logic instead.
     */
    async saveCouncilSession(_session: JsonObject, _agents: JsonObject[]) {
        // Deprecated/Shim: Use createCouncilSession logic or update
    }

    // --- Vector Store (Local Implementation) ---

    /**
     * In-memory storage for vector embeddings.
     * @private
     */
    private vectorStore: { path: string; content: string; embedding: number[]; metadata: JsonObject }[] = []

    /**
     * Calculates Cosine Similarity between two vectors.
     * 
     * @param a - First vector
     * @param b - Second vector
     * @returns Similarity score (-1 to 1)
     * @private
     */
    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) return 0
        let dotProduct = 0
        let normA = 0
        let normB = 0
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i]
            normA += a[i] * a[i]
            normB += b[i] * b[i]
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
    }

    /**
     * Removes vectors associated with a specific file path.
     * @param path - File path identifier
     */
    async clearVectors(path: string) {
        this.vectorStore = this.vectorStore.filter(v => v.path !== path)
        // In a real app we would strictly persist this immediately or debounced
    }

    /**
     * Adds a vector embedding to the in-memory store.
     * 
     * @param path - Source file path
     * @param content - Text content
     * @param vector - Embedding vector
     * @param metadata - Arbitrary metadata
     */
    async storeVector(path: string, content: string, vector: number[], metadata: JsonObject) {
        this.vectorStore.push({ path, content, embedding: vector, metadata })
    }

    /**
     * Searches the vector store using cosine similarity.
     * 
     * @param vector - Query vector
     * @param limit - Max results
     * @returns Ranked list of matches with similarity score
     */
    async searchVectors(vector: number[], limit: number): Promise<VectorSearchResult[]> {
        if (!this.vectorStore.length) return []

        const scored = this.vectorStore.map(item => ({
            ...item,
            score: this.cosineSimilarity(vector, item.embedding)
        }))

        // Sort desc
        scored.sort((a, b) => b.score - a.score)

        return scored.slice(0, limit)
    }
}

interface VectorSearchResult {
    path: string;
    content: string;
    embedding: number[];
    metadata: JsonObject;
    score: number;
}
