import { DataService } from './data.service'
import { LanceDbService } from './lancedb.service'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'

export interface Folder {
    id: string
    name: string
    color?: string
    createdAt: number
    updatedAt: number
}

export interface Prompt {
    id: string
    title: string
    content: string
    tags: string[]
    createdAt: number
    updatedAt: number
}

export interface ChatMessage {
    role: string
    content: string
    timestamp?: number
    vector?: number[]
    [key: string]: any
}

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

    async initialize() {
        await this.loadFolders()
        await this.loadPrompts()
        await this.loadCouncilSessions()
        await this.loadProjects()
    }

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

    private async saveCouncilSessions() {
        try {
            await fs.promises.writeFile(this.councilPath, JSON.stringify(this.councilSessions, null, 2), 'utf-8')
        } catch (error) {
            console.error('Failed to save council sessions:', error)
        }
    }

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

    private async savePrompts() {
        try {
            await fs.promises.writeFile(this.promptsPath, JSON.stringify(this.prompts, null, 2), 'utf-8')
        } catch (error) {
            console.error('Failed to save prompts:', error)
        }
    }

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

    private async saveFolders() {
        try {
            await fs.promises.writeFile(this.foldersPath, JSON.stringify(this.folders, null, 2), 'utf-8')
        } catch (error) {
            console.error('Failed to save folders:', error)
        }
    }

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

    private async saveProjects() {
        try {
            await fs.promises.writeFile(this.projectsPath, JSON.stringify(this.projects, null, 2), 'utf-8')
        } catch (error) {
            console.error('Failed to save projects:', error)
        }
    }

    // Chat
    async createChat(_chat: any) { return { success: true } }
    async updateChat(_id: string, _updates: any) { return { success: true } }
    async deleteChat(_id: string) { return { success: true } }
    async duplicateChat(_id: string) { return null }
    async archiveChat(_id: string, _isArchived: boolean) { return { success: true } }
    async getChat(_id: string) { return null }
    async getAllChats() { return [] }
    async searchChats(_query: string) { return [] }
    async addMessage(_message: any) { return { success: true } }
    async deleteMessage(_id: string) { return { success: true } }
    async updateMessage(_id: string, _updates: any) { return { success: true } }
    async deleteAllChats() { return { success: true } }
    async deleteMessages(_chatId: string) { return { success: true } }
    async getMessages(_chatId: string) { return [] }
    // Alias for getMessages as used in db.ts/MemoryService
    async getChatMessages(_chatId: string): Promise<ChatMessage[]> { return [] }
    async deleteChatsByTitle(_title: string) { return { success: true } }

    // Stats
    async getStats() { return { chatCount: 0, messageCount: 0, dbSize: 0 } }
    async getDetailedStats(_period: string) { return { chatCount: 0, messageCount: 0, dbSize: 0, totalTokens: 0, promptTokens: 0, completionTokens: 0, tokenTimeline: [], activity: [] } }

    // Projects
    async getProjects() {
        return this.projects
    }

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

    async updateProject(id: string, updates: any) {
        const index = this.projects.findIndex(p => p.id === id)
        if (index !== -1) {
            this.projects[index] = { ...this.projects[index], ...updates, updatedAt: Date.now() }
            await this.saveProjects()
            return this.projects[index]
        }
    }

    async deleteProject(id: string) {
        this.projects = this.projects.filter(p => p.id !== id)
        await this.saveProjects()
    }

    async archiveProject(id: string, isArchived: boolean) {
        const index = this.projects.findIndex(p => p.id === id)
        if (index !== -1) {
            this.projects[index].status = isArchived ? 'archived' : 'active'
            this.projects[index].updatedAt = Date.now()
            await this.saveProjects()
        }
    }

    // Folders
    async getFolders() {
        return this.folders
    }

    async getAllFolders() {
        return this.folders
    }

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

    async deleteFolder(id: string) {
        this.folders = this.folders.filter(f => f.id !== id)
        await this.saveFolders()
    }

    async updateFolder(id: string, updates: any) {
        const index = this.folders.findIndex(f => f.id === id)
        if (index !== -1) {
            this.folders[index] = { ...this.folders[index], ...updates, updatedAt: Date.now() }
            await this.saveFolders()
        }
    }

    // Prompts
    async getPrompts() {
        return this.prompts
    }

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

    async deletePrompt(id: string) {
        this.prompts = this.prompts.filter(p => p.id !== id)
        await this.savePrompts()
    }

    async updatePrompt(id: string, updates: Partial<Prompt>) {
        const index = this.prompts.findIndex(p => p.id === id)
        if (index !== -1) {
            this.prompts[index] = { ...this.prompts[index], ...updates, updatedAt: Date.now() }
            await this.savePrompts()
        }
    }

    // Semantic Memory
    async storeSemanticFragment(_fragment: SemanticFragment) { }
    async searchSemanticFragments(_vector: number[], _limit: number): Promise<SemanticFragment[]> { return [] }
    async searchSemanticFragmentsByText(_query: string, _limit: number): Promise<SemanticFragment[]> { return [] }
    async deleteSemanticFragment(_id: string): Promise<boolean> { return true }
    async getAllSemanticFragments(): Promise<SemanticFragment[]> { return [] }

    // Episodic Memory
    async storeEpisodicMemory(_memory: EpisodicMemory) { }
    async searchEpisodicMemories(_vector: number[], _limit: number): Promise<EpisodicMemory[]> { return [] }
    async searchEpisodicMemoriesByText(_query: string, _limit: number): Promise<EpisodicMemory[]> { return [] }
    async getAllEpisodicMemories(): Promise<EpisodicMemory[]> { return [] }

    // Entity Knowledge
    async storeEntityKnowledge(_knowledge: EntityKnowledge) { }
    async getEntityKnowledge(_entityName: string): Promise<EntityKnowledge[]> { return [] }
    async deleteEntityKnowledge(_id: string): Promise<boolean> { return true }
    async getAllEntityKnowledge(): Promise<EntityKnowledge[]> { return [] }

    // General Memory
    async recallMemory(_key: string): Promise<string | null> { return null }
    async storeMemory(_key: string, _value: string) { }

    // Code Intelligence
    async searchCodeSymbols(_vector: number[]): Promise<any[]> { return [] }
    async clearCodeSymbols(_projectId: string) { }
    async storeCodeSymbol(_symbol: any) { }

    // Council / Agents
    async getCouncilSessions() {
        // Return shallow copy (or reverse order) if needed, for now straight return
        return this.councilSessions
    }

    async getCouncilSession(id: string) {
        return this.councilSessions.find(s => s.id === id) || null
    }

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

    // Unused stub replacement
    async saveCouncilSession(_session: any, _agents: any[]) {
        // Deprecated/Shim: Use createCouncilSession logic or update
    }

    // Vector Store (Local implementation)
    private vectorStore: { path: string; content: string; embedding: number[]; metadata: any }[] = []

    // Helper: Cosine Similarity
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

    async clearVectors(path: string) {
        this.vectorStore = this.vectorStore.filter(v => v.path !== path)
        // In a real app we would strictly persist this immediately or debounced
    }

    async storeVector(path: string, content: string, vector: number[], metadata: any) {
        this.vectorStore.push({ path, content, embedding: vector, metadata })
    }

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
