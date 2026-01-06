// DatabaseService - SQLite chat history persistence using sql.js (pure JS, no native modules)

import { join } from 'path'
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

// Types
export interface ChatMessage {
    id: string
    chatId: string
    role: 'user' | 'assistant' | 'system'
    content: string
    toolCalls?: string // JSON
    toolResults?: string // JSON
    timestamp: number
    promptTokens?: number
    completionTokens?: number
    isPinned?: number // 0 or 1
    provider?: string
    model?: string
    rating?: number // 1: up, -1: down, 0: none
    images?: string | string[] // JSON string in DB, but can accept array
}

export interface Chat {
    id: string
    title: string
    model: string
    backend: 'ollama' | 'llama.cpp' | 'openai' | 'anthropic' | 'gemini' | 'groq' | 'antigravity'
    createdAt: number
    updatedAt: number
    isPinned?: number // 0 or 1
    isArchived?: number // 0 or 1
    isFavorite?: number // 0 or 1
    folderId?: string
}

export interface Folder {
    id: string
    name: string
    createdAt: number
    updatedAt: number
}

export interface CouncilSessionRecord {
    id: string
    projectId: string
    taskId: string
    status: string
    plan?: string
    solution?: string
    createdAt: number
    updatedAt: number
}

export interface CouncilAgentRecord {
    id: string
    sessionId: string
    name: string
    role: string
    model: string
    provider: string
}

export interface CouncilLogRecord {
    sessionId: string
    timestamp: number
    agent: string
    message: string
}

// Lazy load sql.js
let SQL: any = null
let db: any = null

export class DatabaseService {
    private dbPath: string
    private dataDir: string
    private initialized: boolean = false

    constructor() {
        try {
            this.dataDir = join(app.getPath('userData'), 'data')
            if (!existsSync(this.dataDir)) {
                mkdirSync(this.dataDir, { recursive: true })
            }
            this.dbPath = join(this.dataDir, 'chats.db')
        } catch (e) {
            this.dataDir = './data'
            this.dbPath = './data/chats.db'
        }
    }

    async initialize(): Promise<void> {
        if (this.initialized) return

        try {
            // Dynamic import for sql.js
            const initSqlJs = require('sql.js')
            SQL = await initSqlJs()

            // Load existing database or create new
            if (existsSync(this.dbPath)) {
                const fileBuffer = readFileSync(this.dbPath)
                db = new SQL.Database(fileBuffer)
            } else {
                db = new SQL.Database()
            }

            // Create tables
            db.run(`
        CREATE TABLE IF NOT EXISTS chats (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          model TEXT,
          backend TEXT DEFAULT 'ollama',
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL,
          isPinned INTEGER DEFAULT 0,
          isArchived INTEGER DEFAULT 0,
          isFavorite INTEGER DEFAULT 0,
          folderId TEXT
        )
      `)

            db.run(`
        CREATE TABLE IF NOT EXISTS folders (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        )
      `)

            try {
                db.run("ALTER TABLE chats ADD COLUMN isPinned INTEGER DEFAULT 0")
            } catch (e) {
                // Column likely already exists
            }

            try {
                db.run("ALTER TABLE chats ADD COLUMN isArchived INTEGER DEFAULT 0")
            } catch (e) {
                // Column likely already exists
            }

            try {
                db.run("ALTER TABLE chats ADD COLUMN isFavorite INTEGER DEFAULT 0")
            } catch (e) {
                // Column likely already exists
            }

            try {
                db.run("ALTER TABLE chats ADD COLUMN folderId TEXT")
            } catch (e) {
                // Column likely already exists
            }

            db.run(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          chatId TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          toolCalls TEXT,
          toolResults TEXT,
          timestamp INTEGER NOT NULL,
          promptTokens INTEGER DEFAULT 0,
          completionTokens INTEGER DEFAULT 0,
          provider TEXT,
          model TEXT,
          rating INTEGER DEFAULT 0,
          FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE
        )
      `)

            try {
                db.run("ALTER TABLE messages ADD COLUMN promptTokens INTEGER DEFAULT 0")
            } catch (e) { }

            try {
                db.run("ALTER TABLE messages ADD COLUMN completionTokens INTEGER DEFAULT 0")
            } catch (e) { }

            try {
                db.run("ALTER TABLE messages ADD COLUMN isPinned INTEGER DEFAULT 0")
            } catch (e) { }
            try {
                db.run("ALTER TABLE messages ADD COLUMN provider TEXT")
            } catch (e) { }

            try {
                db.run("ALTER TABLE messages ADD COLUMN model TEXT")
            } catch (e) { }

            try {
                db.run("ALTER TABLE messages ADD COLUMN rating INTEGER DEFAULT 0")
            } catch (e) { }

            try {
                db.run("ALTER TABLE messages ADD COLUMN images TEXT")
            } catch (e) { }

            db.run('CREATE INDEX IF NOT EXISTS idx_messages_chatId ON messages(chatId)')
            db.run('CREATE INDEX IF NOT EXISTS idx_chats_updatedAt ON chats(updatedAt DESC)')

            db.run(`
        CREATE TABLE IF NOT EXISTS memories (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updatedAt INTEGER NOT NULL
        )
      `)

            db.run(`
        CREATE TABLE IF NOT EXISTS indexed_documents (
          path TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          updatedAt INTEGER NOT NULL
        )
      `)

            db.run(`
        CREATE TABLE IF NOT EXISTS vectors (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          path TEXT NOT NULL,
          content TEXT NOT NULL,
          embedding TEXT NOT NULL,
          metadata TEXT,
          updatedAt INTEGER NOT NULL
        )
      `)

            db.run('CREATE INDEX IF NOT EXISTS idx_vectors_path ON vectors(path)')

            db.run(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          path TEXT,
          mounts TEXT,
          description TEXT,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        )
      `)

            try {
                db.run("ALTER TABLE projects ADD COLUMN mounts TEXT")
            } catch (e) { }

            try {
                db.run("ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'active'")
            } catch (e) { }

            db.run(`
                CREATE TABLE IF NOT EXISTS council_sessions (
                    id TEXT PRIMARY KEY,
                    projectId TEXT,
                    taskId TEXT,
                    status TEXT,
                    plan TEXT,
                    solution TEXT,
                    createdAt INTEGER,
                    updatedAt INTEGER
                )
            `)

            db.run(`
                CREATE TABLE IF NOT EXISTS council_agents (
                    id TEXT PRIMARY KEY,
                    sessionId TEXT,
                    name TEXT,
                    role TEXT,
                    model TEXT,
                    provider TEXT,
                    FOREIGN KEY (sessionId) REFERENCES council_sessions(id) ON DELETE CASCADE
                )
            `)

            db.run(`
                CREATE TABLE IF NOT EXISTS council_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sessionId TEXT,
                    agent TEXT,
                    message TEXT,
                    timestamp INTEGER,
                    FOREIGN KEY (sessionId) REFERENCES council_sessions(id) ON DELETE CASCADE
                )
            `)

            db.run('CREATE INDEX IF NOT EXISTS idx_council_logs_sessionId ON council_logs(sessionId)')
            db.run('CREATE INDEX IF NOT EXISTS idx_council_agents_sessionId ON council_agents(sessionId)')

            // FTS5 - Search Integration
            try {
                db.run(`
                  CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
                    id UNINDEXED,
                    chatId UNINDEXED,
                    content,
                    tokenize='unicode61'
                  )
                `)

                // Initial sync if FTS table is empty
                const ftsCount = db.prepare('SELECT count(*) as count FROM messages_fts').getAsObject().count
                if (ftsCount === 0) {
                    db.run(`
                      INSERT INTO messages_fts(id, chatId, content)
                      SELECT id, chatId, content FROM messages
                    `)
                }
            } catch (e) {
                // console.warn('[DatabaseService] FTS5 not auto-detected (skipping full-text indexing):', (e as any).message)
            }

            this.saveToFile()
            this.initialized = true
            console.log('Database initialized:', this.dbPath)
        } catch (error) {
            console.error('Failed to initialize database:', error)
            throw error
        }
    }

    private saveToFile(): void {
        if (db) {
            const data = db.export()
            const buffer = Buffer.from(data)
            writeFileSync(this.dbPath, buffer)
        }
    }

    deleteAllChats(): void {
        if (!db) return
        db.run('DELETE FROM messages')
        db.run('DELETE FROM chats')
        db.run('DELETE FROM folders')
        this.saveToFile()
    }

    // Folder operations
    createFolder(name: string): Folder {
        if (!db) throw new Error('DB not initialized')

        const id = Math.random().toString(36).substring(2, 15) // Simple ID generation
        const now = Date.now()
        const folder: Folder = {
            id,
            name,
            createdAt: now,
            updatedAt: now
        }

        const stmt = db.prepare(`
            INSERT INTO folders (id, name, createdAt, updatedAt)
            VALUES (?, ?, ?, ?)
        `)
        stmt.run([folder.id, folder.name, folder.createdAt, folder.updatedAt])
        stmt.free()
        this.saveToFile()
        return folder
    }

    deleteFolder(id: string): void {
        if (!db) return

        // Unlink chats first (move to root)
        db.run('UPDATE chats SET folderId = NULL WHERE folderId = ?', [id])
        // Delete folder
        db.run('DELETE FROM folders WHERE id = ?', [id])
        this.saveToFile()
    }

    updateFolder(id: string, name: string): void {
        if (!db) return
        db.run('UPDATE folders SET name = ?, updatedAt = ? WHERE id = ?', [name, Date.now(), id])
        this.saveToFile()
    }

    getFolders(): Folder[] {
        if (!db) return []
        const results: Folder[] = []
        const stmt = db.prepare('SELECT * FROM folders ORDER BY createdAt DESC')
        while (stmt.step()) {
            results.push(stmt.getAsObject() as Folder)
        }
        stmt.free()
        return results
    }

    // Chat operations
    createChat(chat: Chat): void {
        if (!db) return

        console.log('Creating chat (DB):', chat)

        const stmt = db.prepare(`
      INSERT INTO chats (id, title, model, backend, createdAt, updatedAt, isPinned, isArchived, isFavorite, folderId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
        const cleanChat = [
            chat.id,
            chat.title,
            chat.model || '',
            chat.backend || 'ollama',
            typeof chat.createdAt === 'object' ? (chat.createdAt as any).getTime() : chat.createdAt || Date.now(),
            typeof chat.updatedAt === 'object' ? (chat.updatedAt as any).getTime() : chat.updatedAt || Date.now(),
            chat.isPinned ? 1 : 0,
            chat.isArchived ? 1 : 0,
            chat.isFavorite ? 1 : 0,
            chat.folderId || null
        ]
        stmt.run(cleanChat)
        stmt.free()
        this.saveToFile()
    }

    updateChat(id: string, updates: Partial<Chat>): void {
        if (!db) return

        const fields: string[] = []
        const values: any[] = []

        if (updates.title !== undefined) {
            fields.push('title = ?')
            values.push(updates.title)
        }
        if (updates.model !== undefined) {
            fields.push('model = ?')
            values.push(updates.model)
        }
        if (updates.backend !== undefined) {
            fields.push('backend = ?')
            values.push(updates.backend)
        }
        if (updates.isPinned !== undefined) {
            fields.push('isPinned = ?')
            values.push(updates.isPinned ? 1 : 0)
        }
        if (updates.isArchived !== undefined) {
            fields.push('isArchived = ?')
            values.push(updates.isArchived ? 1 : 0)
        }
        if (updates.isFavorite !== undefined) {
            fields.push('isFavorite = ?')
            values.push(updates.isFavorite ? 1 : 0)
        }
        if (updates.folderId !== undefined) {
            fields.push('folderId = ?')
            values.push(updates.folderId)
        }

        fields.push('updatedAt = ?')
        values.push(Date.now())
        values.push(id)

        db.run(`UPDATE chats SET ${fields.join(', ')} WHERE id = ?`, values)
        this.saveToFile()
    }

    deleteChat(id: string): void {
        if (!db) return

        // Delete messages first
        db.run('DELETE FROM messages WHERE chatId = ?', [id])
        db.run('DELETE FROM chats WHERE id = ?', [id])
        this.saveToFile()
    }

    duplicateChat(id: string): Chat | null {
        if (!db) return null

        const original = this.getChat(id)
        if (!original) return null

        const messages = this.getMessages(id)
        const newId = Math.random().toString(36).substring(2, 15)
        const now = Date.now()

        const newChat: Chat = {
            ...original,
            id: newId,
            title: `${original.title} (Copy)`,
            createdAt: now,
            updatedAt: now,
            isPinned: 0,
            isArchived: 0
        }

        this.createChat(newChat)

        for (const msg of messages) {
            const newMsgId = Math.random().toString(36).substring(2, 15)
            this.addMessage({
                ...msg,
                id: newMsgId,
                chatId: newId
            })
        }

        this.saveToFile()
        return newChat
    }

    archiveChat(id: string, isArchived: boolean): void {
        if (!db) return

        db.run('UPDATE chats SET isArchived = ?, updatedAt = ? WHERE id = ?', [isArchived ? 1 : 0, Date.now(), id])
        this.saveToFile()
    }

    getChat(id: string): Chat | null {
        if (!db) return null

        const stmt = db.prepare('SELECT * FROM chats WHERE id = ?')
        stmt.bind([id])

        if (stmt.step()) {
            const row = stmt.getAsObject() as any
            stmt.free()
            return row as Chat
        }
        stmt.free()
        return null
    }

    getAllChats(): Chat[] {
        if (!db) return []

        const results: Chat[] = []
        const stmt = db.prepare('SELECT * FROM chats ORDER BY isPinned DESC, isFavorite DESC, updatedAt DESC')

        while (stmt.step()) {
            results.push(stmt.getAsObject() as Chat)
        }
        stmt.free()
        return results
    }

    searchChats(query: string): Chat[] {
        if (!db) return []

        const results: Chat[] = []
        try {
            // First try FTS5 for content matching
            const ftsStmt = db.prepare(`
              SELECT DISTINCT chatId FROM messages_fts WHERE content MATCH ?
            `)
            ftsStmt.bind([query])
            const chatIds = new Set<string>()
            while (ftsStmt.step()) {
                chatIds.add(ftsStmt.getAsObject().chatId)
            }
            ftsStmt.free()

            // Also search Titles (LIKE is fine for titles)
            const titleStmt = db.prepare('SELECT id FROM chats WHERE title LIKE ?')
            titleStmt.bind([`%${query}%`])
            while (titleStmt.step()) {
                chatIds.add(titleStmt.getAsObject().id)
            }
            titleStmt.free()

            if (chatIds.size > 0) {
                const idList = Array.from(chatIds).map(id => `'${id}'`).join(',')
                const chatStmt = db.prepare(`SELECT * FROM chats WHERE id IN (${idList}) ORDER BY updatedAt DESC`)
                while (chatStmt.step()) {
                    results.push(chatStmt.getAsObject() as Chat)
                }
                chatStmt.free()
            }
        } catch (e) {
            // Fallback to basic LIKE if FTS fails
            const searchTerm = `%${query}%`
            const stmt = db.prepare(`
              SELECT DISTINCT c.* FROM chats c
              LEFT JOIN messages m ON c.id = m.chatId
              WHERE c.title LIKE ? OR m.content LIKE ?
              ORDER BY c.updatedAt DESC
            `)
            stmt.bind([searchTerm, searchTerm])
            while (stmt.step()) {
                results.push(stmt.getAsObject() as Chat)
            }
            stmt.free()
        }
        return results
    }

    // Message operations
    private estimateTokensFromText(text: string): number {
        if (!text) return 0
        return Math.ceil(Array.from(text).length / 4)
    }

    private resolveTokensForRole(
        role: string,
        content: string,
        promptTokens?: number,
        completionTokens?: number
    ): { promptTokens: number; completionTokens: number } {
        const estimated = this.estimateTokensFromText(content)
        const normalizedRole = String(role || '').toLowerCase()
        const hasContent = Boolean(content && String(content).length > 0)

        if (normalizedRole === 'assistant') {
            const useCompletion = typeof completionTokens === 'number' && (completionTokens > 0 || !hasContent)
            const resolvedCompletion = useCompletion ? completionTokens : estimated
            return { promptTokens: 0, completionTokens: resolvedCompletion }
        }

        const usePrompt = typeof promptTokens === 'number' && (promptTokens > 0 || !hasContent)
        const resolvedPrompt = usePrompt ? promptTokens : estimated
        return { promptTokens: resolvedPrompt, completionTokens: 0 }
    }

    addMessage(message: ChatMessage): void {
        if (!db) return

        // 1. Empty Message Validation
        // Check content, images, toolCalls, toolResults
        const hasContent = (message.content && message.content.trim().length > 0)
        const hasImages = (message.images && message.images.length > 0)
        const hasTools = (message.toolCalls && message.toolCalls.length > 2) // "[]" is length 2
        const hasResults = (message.toolResults && message.toolResults.length > 2)

        if (!hasContent && !hasImages && !hasTools && !hasResults) {
            console.warn('[Database] Blocked empty message:', message.id)
            return
        }

        const resolved = this.resolveTokensForRole(
            message.role,
            message.content,
            message.promptTokens,
            message.completionTokens
        )

        // Serialize images if array
        const imagesStr = Array.isArray(message.images) ? JSON.stringify(message.images) : (message.images || null)

        const stmt = db.prepare(`
      INSERT INTO messages (id, chatId, role, content, toolCalls, toolResults, timestamp, promptTokens, completionTokens, isPinned, provider, model, rating, images)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
        stmt.run([
            message.id,
            message.chatId,
            message.role,
            message.content,
            message.toolCalls || null,
            message.toolResults || null,
            message.timestamp,
            resolved.promptTokens,
            resolved.completionTokens,
            message.isPinned ? 1 : 0,
            message.provider || null,
            message.model || null,
            message.rating || 0,
            imagesStr
        ])
        stmt.free()

        // Update chat's updatedAt
        db.run('UPDATE chats SET updatedAt = ? WHERE id = ?', [Date.now(), message.chatId])

        // Update FTS
        try {
            db.run('INSERT INTO messages_fts(id, chatId, content) VALUES (?, ?, ?)', [message.id, message.chatId, message.content])
        } catch (e) { }

        this.saveToFile()
    }

    getMessages(chatId: string): ChatMessage[] {
        if (!db) return []

        const results: ChatMessage[] = []
        const stmt = db.prepare('SELECT * FROM messages WHERE chatId = ? ORDER BY timestamp ASC')
        stmt.bind([chatId])

        while (stmt.step()) {
            results.push(stmt.getAsObject() as ChatMessage)
        }
        stmt.free()
        return results
    }

    deleteMessages(chatId: string): void {
        if (!db) return
        db.run('DELETE FROM messages WHERE chatId = ?', [chatId])
        this.saveToFile()
    }

    deleteMessage(id: string): void {
        if (!db) return

        db.run('DELETE FROM messages WHERE id = ?', [id])
        this.saveToFile()
    }

    updateMessage(id: string, updates: Partial<ChatMessage>): void {
        if (!db) return

        const fields: string[] = []
        const values: any[] = []

        if (updates.content !== undefined) {
            fields.push('content = ?')
            values.push(updates.content)
        }
        if (updates.isPinned !== undefined) {
            fields.push('isPinned = ?')
            values.push(updates.isPinned ? 1 : 0)
        }
        if (updates.provider !== undefined) {
            fields.push('provider = ?')
            values.push(updates.provider)
        }
        if (updates.model !== undefined) {
            fields.push('model = ?')
            values.push(updates.model)
        }
        if (updates.rating !== undefined) {
            fields.push('rating = ?')
            values.push(updates.rating)
        }
        if (updates.images !== undefined) {
            fields.push('images = ?')
            const val = Array.isArray(updates.images) ? JSON.stringify(updates.images) : updates.images
            values.push(val)
        }

        if (fields.length === 0) return

        values.push(id) // WHERE id = ?
        db.run(`UPDATE messages SET ${fields.join(', ')} WHERE id = ?`, values)
        this.saveToFile()
    }

    // Utility
    close(): void {
        if (db) {
            this.saveToFile()
            db.close()
            db = null
        }
        this.initialized = false
    }

    getStats(): { chatCount: number; messageCount: number; dbSize: number } {
        if (!db) return { chatCount: 0, messageCount: 0, dbSize: 0 }

        let chatCount = 0
        let messageCount = 0

        const chatStmt = db.prepare('SELECT COUNT(*) as count FROM chats')
        if (chatStmt.step()) {
            chatCount = (chatStmt.getAsObject() as any).count
        }
        chatStmt.free()

        const msgStmt = db.prepare('SELECT COUNT(*) as count FROM messages')
        if (msgStmt.step()) {
            messageCount = (msgStmt.getAsObject() as any).count
        }
        msgStmt.free()

        let dbSize = 0
        try {
            const fs = require('fs')
            const stats = fs.statSync(this.dbPath)
            dbSize = stats.size
        } catch (e) { }

        return { chatCount, messageCount, dbSize }
    }

    getDetailedStats(period: 'daily' | 'weekly' | 'monthly' | 'yearly'): {
        chatCount: number
        messageCount: number
        dbSize: number
        totalTokens: number
        promptTokens: number
        completionTokens: number
        tokenTimeline: { timestamp: number; promptTokens: number; completionTokens: number }[]
        activity: number[]
    } {
        if (!db) return { chatCount: 0, messageCount: 0, dbSize: 0, totalTokens: 0, promptTokens: 0, completionTokens: 0, tokenTimeline: [], activity: [] }

        // Basic Counts
        const basic = this.getStats()

        // Token Usage Sum
        let totalTokens = 0
        let promptTokens = 0
        let completionTokens = 0

        const now = new Date()
        let tokenTimeline: { timestamp: number; promptTokens: number; completionTokens: number }[] = []
        let timelineStart = 0
        let bucketMs = 0
        let timelineBuckets = 0

        if (period === 'daily') {
            timelineBuckets = 24
            bucketMs = 3600000
            const start = new Date(now)
            start.setMinutes(0, 0, 0)
            timelineStart = start.getTime() - (timelineBuckets - 1) * bucketMs
            tokenTimeline = Array.from({ length: timelineBuckets }, (_, idx) => ({
                timestamp: timelineStart + idx * bucketMs,
                promptTokens: 0,
                completionTokens: 0
            }))
        } else if (period === 'weekly') {
            timelineBuckets = 7
            bucketMs = 86400000
            const start = new Date(now)
            start.setHours(0, 0, 0, 0)
            timelineStart = start.getTime() - (timelineBuckets - 1) * bucketMs
            tokenTimeline = Array.from({ length: timelineBuckets }, (_, idx) => ({
                timestamp: timelineStart + idx * bucketMs,
                promptTokens: 0,
                completionTokens: 0
            }))
        } else if (period === 'monthly') {
            timelineBuckets = 30
            bucketMs = 86400000
            const start = new Date(now)
            start.setHours(0, 0, 0, 0)
            timelineStart = start.getTime() - (timelineBuckets - 1) * bucketMs
            tokenTimeline = Array.from({ length: timelineBuckets }, (_, idx) => ({
                timestamp: timelineStart + idx * bucketMs,
                promptTokens: 0,
                completionTokens: 0
            }))
        } else {
            timelineBuckets = 12
            const start = new Date(now.getFullYear(), now.getMonth(), 1)
            for (let i = timelineBuckets - 1; i >= 0; i--) {
                const monthStart = new Date(start.getFullYear(), start.getMonth() - i, 1)
                tokenTimeline.push({
                    timestamp: monthStart.getTime(),
                    promptTokens: 0,
                    completionTokens: 0
                })
            }
        }

        const tokenStmt = db.prepare('SELECT role, promptTokens, completionTokens, content, timestamp FROM messages')
        while (tokenStmt.step()) {
            const row = tokenStmt.getAsObject() as any
            const resolved = this.resolveTokensForRole(
                row.role,
                row.content || '',
                typeof row.promptTokens === 'number' ? row.promptTokens : undefined,
                typeof row.completionTokens === 'number' ? row.completionTokens : undefined
            )
            promptTokens += resolved.promptTokens
            completionTokens += resolved.completionTokens

            const rawTs = row.timestamp
            let ts = typeof rawTs === 'number' ? rawTs : Number(rawTs)
            if (!Number.isFinite(ts)) continue
            // Normalize seconds to milliseconds
            if (ts > 0 && ts < 1000000000000) ts *= 1000

            if (period === 'yearly') {
                const msgDate = new Date(ts)
                const diffMonths = (now.getFullYear() - msgDate.getFullYear()) * 12 + (now.getMonth() - msgDate.getMonth())
                const bucketIndex = (timelineBuckets - 1) - diffMonths
                if (bucketIndex >= 0 && bucketIndex < timelineBuckets) {
                    tokenTimeline[bucketIndex].promptTokens += resolved.promptTokens
                    tokenTimeline[bucketIndex].completionTokens += resolved.completionTokens
                }
            } else {
                const bucketIndex = Math.floor((ts - timelineStart) / bucketMs)
                if (bucketIndex >= 0 && bucketIndex < timelineBuckets) {
                    tokenTimeline[bucketIndex].promptTokens += resolved.promptTokens
                    tokenTimeline[bucketIndex].completionTokens += resolved.completionTokens
                }
            }
        }
        tokenStmt.free()

        totalTokens = promptTokens + completionTokens

        // Optimized Activity Chart (Single Pass or Reuse normalized buckets)
        // Activity chart in UI currently expected fixed lengths matches timelineBuckets
        const activityCount: number[] = new Array(timelineBuckets).fill(0)

        // Let's use the normalized timestamp logic again but specifically for activity counts
        // since the first loop combined tokens, this one can do message volume
        const activityStmt = db.prepare('SELECT timestamp FROM messages')
        while (activityStmt.step()) {
            const row = activityStmt.getAsObject() as any
            let ts = Number(row.timestamp)
            if (!ts) continue
            if (ts > 0 && ts < 1000000000000) ts *= 1000

            if (period === 'yearly') {
                const msgDate = new Date(ts)
                const diffMonths = (now.getFullYear() - msgDate.getFullYear()) * 12 + (now.getMonth() - msgDate.getMonth())
                const bucketIndex = 11 - diffMonths
                if (bucketIndex >= 0 && bucketIndex < 12) activityCount[bucketIndex]++
            } else {
                const bucketIndex = Math.floor((ts - timelineStart) / bucketMs)
                if (bucketIndex >= 0 && bucketIndex < timelineBuckets) activityCount[bucketIndex]++
            }
        }
        activityStmt.free()

        return { ...basic, totalTokens, promptTokens, completionTokens, tokenTimeline, activity: activityCount }
    }

    getProjects(): any[] {
        if (!db) return []
        const stmt = db.prepare('SELECT * FROM projects ORDER BY updatedAt DESC')
        const results = []
        while (stmt.step()) {
            const row = stmt.getAsObject() as any
            if (row.mounts && typeof row.mounts === 'string') {
                try {
                    row.mounts = JSON.parse(row.mounts)
                } catch (e) {
                    console.error('Failed to parse mounts for project defined in DB:', row.id, e)
                    row.mounts = []
                }
            }
            results.push(row)
        }
        stmt.free()
        return results
    }

    createProject(name: string, path: string, description: string, mounts?: string): void {
        if (!db) return
        db.run('INSERT INTO projects (id, name, path, mounts, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)', [
            Math.random().toString(36).substring(2, 10),
            name,
            path,
            mounts || null,
            description,
            Date.now(),
            Date.now()
        ])
        this.saveToFile()
    }

    updateProject(id: string, updates: { name?: string; path?: string; mounts?: string; description?: string; status?: string }): void {
        if (!db) return
        const fields: string[] = []
        const values: any[] = []

        if (updates.name !== undefined) {
            fields.push('name = ?')
            values.push(updates.name)
        }
        if (updates.path !== undefined) {
            fields.push('path = ?')
            values.push(updates.path)
        }
        if (updates.mounts !== undefined) {
            fields.push('mounts = ?')
            values.push(updates.mounts)
        }
        if (updates.description !== undefined) {
            fields.push('description = ?')
            values.push(updates.description)
        }
        if (updates.status !== undefined) {
            fields.push('status = ?')
            values.push(updates.status)
        }

        if (fields.length === 0) return

        fields.push('updatedAt = ?')
        values.push(Date.now())
        values.push(id)

        db.run(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, values)
        this.saveToFile()
    }

    deleteProject(id: string): void {
        if (!db) return
        db.run('DELETE FROM projects WHERE id = ?', [id])
        this.saveToFile()
    }

    archiveProject(id: string, isArchived: boolean): void {
        this.updateProject(id, { status: isArchived ? 'archived' : 'active' })
    }

    // Memory operations
    storeMemory(key: string, value: string): void {
        if (!db) return
        db.run('INSERT OR REPLACE INTO memories (key, value, updatedAt) VALUES (?, ?, ?)', [key, value, Date.now()])
        this.saveToFile()
    }

    recallMemory(key: string): string | null {
        if (!db) return null
        const stmt = db.prepare('SELECT value FROM memories WHERE key = ?')
        stmt.bind([key])
        if (stmt.step()) {
            const row = stmt.getAsObject() as any
            stmt.free()
            return row.value as string
        }
        stmt.free()
        return null
    }

    // RAG operations
    indexDocument(path: string, content: string): void {
        if (!db) return
        db.run('INSERT OR REPLACE INTO indexed_documents (path, content, updatedAt) VALUES (?, ?, ?)', [path, content, Date.now()])
        this.saveToFile()
    }

    queryDocuments(query: string): { path: string, content: string }[] {
        if (!db) return []
        const searchTerm = `%${query}%`
        const results: { path: string, content: string }[] = []
        const stmt = db.prepare('SELECT path, content FROM indexed_documents WHERE content LIKE ?')
        stmt.bind([searchTerm])
        while (stmt.step()) {
            results.push(stmt.getAsObject() as any)
        }
        stmt.free()
        return results
    }

    // Vector operations
    storeVector(path: string, content: string, embedding: number[], metadata?: any): void {
        if (!db) return
        db.run(
            'INSERT INTO vectors (path, content, embedding, metadata, updatedAt) VALUES (?, ?, ?, ?, ?)',
            [path, content, JSON.stringify(embedding), metadata ? JSON.stringify(metadata) : null, Date.now()]
        )
        this.saveToFile()
    }

    clearVectors(path: string): void {
        if (!db) return
        db.run('DELETE FROM vectors WHERE path = ?', [path])
        this.saveToFile()
    }

    searchVectors(queryEmbedding: number[], limit: number = 5): { path: string; content: string; similarity: number }[] {
        if (!db) return []

        const results: any[] = []
        const stmt = db.prepare('SELECT path, content, embedding FROM vectors')

        while (stmt.step()) {
            const row = stmt.getAsObject() as any
            const embedding = JSON.parse(row.embedding)
            const similarity = this.cosineSimilarity(queryEmbedding, embedding)
            results.push({
                path: row.path,
                content: row.content,
                similarity
            })
        }
        stmt.free()

        return results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit)
    }

    private cosineSimilarity(vecA: number[], vecB: number[]): number {
        let dotProduct = 0
        let normA = 0
        let normB = 0
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i]
            normA += vecA[i] * vecA[i]
            normB += vecB[i] * vecB[i]
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
    }

    // Council Operations
    saveCouncilSession(session: CouncilSessionRecord, agents: CouncilAgentRecord[]): void {
        if (!db) return

        db.run(`INSERT OR REPLACE INTO council_sessions (id, projectId, taskId, status, plan, solution, createdAt, updatedAt) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
            session.id, session.projectId, session.taskId, session.status,
            session.plan || null, session.solution || null, session.createdAt, session.updatedAt
        ])

        // Simple way: delete old agents and re-insert
        db.run('DELETE FROM council_agents WHERE sessionId = ?', [session.id])
        for (const agent of agents) {
            db.run(`INSERT INTO council_agents (id, sessionId, name, role, model, provider) VALUES (?, ?, ?, ?, ?, ?)`, [
                agent.id || Math.random().toString(36).substring(2, 10),
                session.id, agent.name, agent.role, agent.model, agent.provider
            ])
        }
        this.saveToFile()
    }

    updateCouncilStatus(id: string, status: string, plan?: string, solution?: string): void {
        if (!db) return
        const fields = ['status = ?', 'updatedAt = ?']
        const values = [status, Date.now()]

        if (plan !== undefined) {
            fields.push('plan = ?')
            values.push(plan)
        }
        if (solution !== undefined) {
            fields.push('solution = ?')
            values.push(solution)
        }
        values.push(id)

        db.run(`UPDATE council_sessions SET ${fields.join(', ')} WHERE id = ?`, values)
        this.saveToFile()
    }

    addCouncilLog(sessionId: string, agent: string, message: string): void {
        if (!db) return
        db.run(`INSERT INTO council_logs (sessionId, agent, message, timestamp) VALUES (?, ?, ?, ?)`, [
            sessionId, agent, message, Date.now()
        ])
        this.saveToFile()
    }

    getCouncilSessions(projectId?: string): CouncilSessionRecord[] {
        if (!db) return []
        const query = projectId
            ? 'SELECT * FROM council_sessions WHERE projectId = ? ORDER BY updatedAt DESC'
            : 'SELECT * FROM council_sessions ORDER BY updatedAt DESC'
        const stmt = db.prepare(query)
        if (projectId) stmt.bind([projectId])

        const results: CouncilSessionRecord[] = []
        while (stmt.step()) results.push(stmt.getAsObject() as any)
        stmt.free()
        return results
    }

    getCouncilSessionById(id: string): { session: CouncilSessionRecord, agents: CouncilAgentRecord[], logs: CouncilLogRecord[] } | null {
        if (!db) return null

        const sessionStmt = db.prepare('SELECT * FROM council_sessions WHERE id = ?')
        sessionStmt.bind([id])
        if (!sessionStmt.step()) {
            sessionStmt.free()
            return null
        }
        const session = sessionStmt.getAsObject() as any
        sessionStmt.free()

        const agentsStmt = db.prepare('SELECT * FROM council_agents WHERE sessionId = ?')
        agentsStmt.bind([id])
        const agents: CouncilAgentRecord[] = []
        while (agentsStmt.step()) agents.push(agentsStmt.getAsObject() as any)
        agentsStmt.free()

        const logsStmt = db.prepare('SELECT * FROM council_logs WHERE sessionId = ? ORDER BY timestamp ASC')
        logsStmt.bind([id])
        const logs: CouncilLogRecord[] = []
        while (logsStmt.step()) logs.push(logsStmt.getAsObject() as any)
        logsStmt.free()

        return { session, agents, logs }
    }
}
