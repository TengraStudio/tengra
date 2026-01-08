import { DataService } from './data.service'
import { LanceDbService } from './lancedb.service'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'

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
    [key: string]: any
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
    private projectsPath: string
    private projects: any[] = []

    constructor(private dataService: DataService, _lanceDbService: LanceDbService) {
        this.foldersPath = path.join(this.dataService.getPath('db'), 'folders.json')
        this.promptsPath = path.join(this.dataService.getPath('db'), 'prompts.json')
        this.councilPath = path.join(this.dataService.getPath('db'), 'council.json')
        this.projectsPath = path.join(this.dataService.getPath('db'), 'projects.json')
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
        await this.loadProjects()
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
            console.error('Failed to load council sessions:', error)
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
            console.error('Failed to save council sessions:', error)
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
            console.error('Failed to load prompts:', error)
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
            console.error('Failed to save prompts:', error)
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
            console.error('Failed to load folders:', error)
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
            console.error('Failed to save folders:', error)
        }
    }

    /**
     * Loads project configurations from disk.
     * @private
     */
    private async loadProjects() {
        try {
            if (await fs.promises.stat(this.projectsPath).then(() => true).catch(() => false)) {
                const data = await fs.promises.readFile(this.projectsPath, 'utf-8')
                this.projects = JSON.parse(data)
            }
        } catch (error) {
            console.error('Failed to load projects:', error)
            this.projects = []
        }
    }

    /**
     * Persists projects to `projects.json`.
     * @private
     */
    private async saveProjects() {
        try {
            await fs.promises.writeFile(this.projectsPath, JSON.stringify(this.projects, null, 2), 'utf-8')
        } catch (error) {
            console.error('Failed to save projects:', error)
        }
    }

    // --- Chat Management (Stubs) ---

    /**
     * Creates a new chat session.
     * @param _chat - Chat data object
     */
    async createChat(_chat: any) { return { success: true } }

    /**
     * Updates an existing chat.
     * @param _id - Chat ID
     * @param _updates - Fields to update
     */
    async updateChat(_id: string, _updates: any) { return { success: true } }

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
    async addMessage(_message: any) { return { success: true } }

    /**
     * Deletes a specific message.
     */
    async deleteMessage(_id: string) { return { success: true } }

    /**
     * Updates a specific message.
     */
    async updateMessage(_id: string, _updates: any) { return { success: true } }

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
     * Retrieves all registered projects.
     */
    async getProjects() {
        return this.projects
    }

    /**
     * Creates a new project workspace.
     * 
     * @param name - Project display name
     * @param path - Absolute filesystem path
     * @param description - Short description
     * @param mounts - JSON string of mounted directories
     * @returns Created project object
     */
    async createProject(name: string, path: string, description: string, mounts?: string) {
        const project = {
            id: uuidv4(),
            title: name,
            path,
            description,
            mounts: mounts ? JSON.parse(mounts) : [],
            status: 'active',
            createdAt: Date.now(),
            updatedAt: Date.now()
        }
        this.projects.push(project)
        await this.saveProjects()
        return project
    }

    /**
     * Updates an existing project.
     * 
     * @param id - Project ID
     * @param updates - Partial update object
     * @returns Updated project or undefined if not found
     */
    async updateProject(id: string, updates: any) {
        const index = this.projects.findIndex(p => p.id === id)
        if (index !== -1) {
            this.projects[index] = { ...this.projects[index], ...updates, updatedAt: Date.now() }
            await this.saveProjects()
            return this.projects[index]
        }
    }

    /**
     * Deletes a project by ID.
     */
    async deleteProject(id: string) {
        this.projects = this.projects.filter(p => p.id !== id)
        await this.saveProjects()
    }

    /**
     * Toggles a project's archived status.
     */
    async archiveProject(id: string, isArchived: boolean) {
        const index = this.projects.findIndex(p => p.id === id)
        if (index !== -1) {
            this.projects[index].status = isArchived ? 'archived' : 'active'
            this.projects[index].updatedAt = Date.now()
            await this.saveProjects()
        }
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
    async updateFolder(id: string, updates: any) {
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
    async searchCodeSymbols(_vector: number[]): Promise<any[]> { return [] }
    async clearCodeSymbols(_projectId: string) { }
    async storeCodeSymbol(_symbol: any) { }

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
            { id: 'planner', name: 'Planner', role: 'planner', description: 'Decomposes complex goals into actionable plans.' },
            { id: 'executor', name: 'Executor', role: 'executor', description: 'Executes commands and tools.' },
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
    async saveCouncilSession(_session: any, _agents: any[]) {
        // Deprecated/Shim: Use createCouncilSession logic or update
    }

    // --- Vector Store (Local Implementation) ---

    /**
     * In-memory storage for vector embeddings.
     * @private
     */
    private vectorStore: { path: string; content: string; embedding: number[]; metadata: any }[] = []

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
    async storeVector(path: string, content: string, vector: number[], metadata: any) {
        this.vectorStore.push({ path, content, embedding: vector, metadata })
    }

    /**
     * Searches the vector store using cosine similarity.
     * 
     * @param vector - Query vector
     * @param limit - Max results
     * @returns Ranked list of matches with similarity score
     */
    async searchVectors(vector: number[], limit: number): Promise<any[]> {
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
