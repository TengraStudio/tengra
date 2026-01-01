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
}

export interface Chat {
    id: string
    title: string
    model: string
    backend: 'ollama' | 'llama.cpp'
    createdAt: number
    updatedAt: number
    isPinned?: number // 0 or 1
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
          isPinned INTEGER DEFAULT 0
        )
      `)

            try {
                db.run("ALTER TABLE chats ADD COLUMN isPinned INTEGER DEFAULT 0")
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
          FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE
        )
      `)

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

    // Chat operations
    createChat(chat: Chat): void {
        if (!db) return

        console.log('Creating chat (DB):', chat)

        const stmt = db.prepare(`
      INSERT INTO chats (id, title, model, backend, createdAt, updatedAt, isPinned)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
        const cleanChat = [
            chat.id,
            chat.title,
            chat.model || '',
            chat.backend || 'ollama',
            typeof chat.createdAt === 'object' ? (chat.createdAt as any).getTime() : chat.createdAt || Date.now(),
            typeof chat.updatedAt === 'object' ? (chat.updatedAt as any).getTime() : chat.updatedAt || Date.now(),
            chat.isPinned ? 1 : 0
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
        const stmt = db.prepare('SELECT * FROM chats ORDER BY isPinned DESC, updatedAt DESC')

        while (stmt.step()) {
            results.push(stmt.getAsObject() as Chat)
        }
        stmt.free()
        return results
    }

    searchChats(query: string): Chat[] {
        if (!db) return []

        const searchTerm = `%${query}%`
        const results: Chat[] = []
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
        return results
    }

    // Message operations
    addMessage(message: ChatMessage): void {
        if (!db) return

        const stmt = db.prepare(`
      INSERT INTO messages (id, chatId, role, content, toolCalls, toolResults, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
        stmt.run([
            message.id,
            message.chatId,
            message.role,
            message.content,
            message.toolCalls || null,
            message.toolResults || null,
            message.timestamp
        ])
        stmt.free()

        // Update chat's updatedAt
        db.run('UPDATE chats SET updatedAt = ? WHERE id = ?', [Date.now(), message.chatId])
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

    deleteMessage(id: string): void {
        if (!db) return

        db.run('DELETE FROM messages WHERE id = ?', [id])
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
}
