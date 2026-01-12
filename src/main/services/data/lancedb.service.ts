import * as lancedb from '@lancedb/lancedb'
import * as path from 'path'
import { DataService } from './data.service'
import { JsonValue } from '../../../shared/types/common'

export interface AgentRecord {
    id: string
    name: string
    system_prompt: string
    tools: string[]
    parent_model: string
    [key: string]: JsonValue | undefined
}

export class LanceDbService {
    private db: lancedb.Connection | null = null
    private dbPath: string

    constructor(private dataService: DataService) {
        this.dbPath = path.join(this.dataService.getPath('db'), 'lancedb')
    }

    async connect(): Promise<lancedb.Connection> {
        if (!this.db) {
            try {
                this.db = await lancedb.connect(this.dbPath)
            } catch (error) {
                console.error('[LanceDbService] Failed to connect to LanceDB:', error)
                // Return a mock connection or throw handled error
                throw new Error('LanceDB connection failed')
            }
        }
        return this.db
    }

    async getTable(name: string): Promise<lancedb.Table> {
        const db = await this.connect()
        try {
            return await db.openTable(name)
        } catch {
            // Table doesn't exist, we'll create it with empty schema via specific methods or throw
            throw new Error(`Table ${name} not found. Use createTable first.`)
        }
    }

    async createTable(name: string, data: Record<string, unknown>[]): Promise<lancedb.Table | null> {
        const db = await this.connect()

        const tables = await db.tableNames()
        if (tables.includes(name)) {
            return await db.openTable(name)
        }

        if (data.length === 0) {
            // Cannot infer schema from empty data.
            // In a real app we would use Apache Arrow schema definition here.
            // For now, return null and let the caller handle lazy creation on first insert.
            return null;
        }

        return await db.createTable(name, data)
    }
}
