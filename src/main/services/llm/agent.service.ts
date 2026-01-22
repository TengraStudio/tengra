import { randomUUID } from 'crypto'

import { BaseService } from '@main/services/base.service'
import { DatabaseService } from '@main/services/data/database.service'

export interface AgentDefinition {
    id?: string
    name: string
    description: string
    systemPrompt: string
    tools: string[]
    parentModel?: string
    color?: string
}

interface AgentRow {
    id: string
    name: string
    system_prompt: string
    tools: string
    parent_model: string
    created_at: number
    updated_at: number
}

export class AgentService extends BaseService {
    constructor(private dbService: DatabaseService) {
        super('AgentService')
    }

    override async initialize(): Promise<void> {
        await this.seedBuiltInAgents()
    }

    async registerAgent(agent: AgentDefinition): Promise<string> {
        const id = agent.id ?? randomUUID()
        const now = Date.now()
        const toolsJson = JSON.stringify(agent.tools)
        const db = this.dbService.getDatabase()

        // Check for existing by name
        const existing = await db.prepare('SELECT id FROM agents WHERE name = $1').get(agent.name) as { id: string } | undefined

        if (existing) {
            // Update
            await db.prepare(`
                UPDATE agents
                SET system_prompt = $1, tools = $2, parent_model = $3, updated_at = $4
                WHERE name = $5
             `).run(agent.systemPrompt, toolsJson, agent.parentModel ?? 'gpt-4o', now, agent.name)
            return existing.id
        } else {
            await db.prepare(`
                INSERT INTO agents (id, name, system_prompt, tools, parent_model, created_at, updated_at) 
                VALUES ($1, $2, $3, $4, $5, $6, $7)
             `).run(id, agent.name, agent.systemPrompt, toolsJson, agent.parentModel ?? 'gpt-4o', now, now)
            return id
        }
    }

    async getAgent(idOrName: string): Promise<AgentDefinition | null> {
        const db = this.dbService.getDatabase()
        let result = await db.prepare('SELECT * FROM agents WHERE id = $1').get(idOrName) as AgentRow | undefined

        result ??= (await db.prepare('SELECT * FROM agents WHERE name = $1').get(idOrName)) as AgentRow | undefined

        if (!result) { return null }

        return {
            id: result.id,
            name: result.name,
            description: 'Agent',
            systemPrompt: result.system_prompt,
            tools: JSON.parse(result.tools),
            parentModel: result.parent_model
        }
    }

    async getAllAgents(): Promise<AgentDefinition[]> {
        const db = this.dbService.getDatabase()
        const results = await db.prepare('SELECT * FROM agents ORDER BY name').all<AgentRow>()
        return results.map(result => ({
            id: result.id,
            name: result.name,
            description: 'Agent',
            systemPrompt: result.system_prompt,
            tools: JSON.parse(result.tools),
            parentModel: result.parent_model
        }))
    }

    private async seedBuiltInAgents() {
        const builtIns: AgentDefinition[] = [
            {
                name: 'TechLead',
                description: 'Senior Technical Architect',
                systemPrompt: 'You are an expert Technical Lead. You always think about system architecture, scalability, and clean code patterns. You are strict about types and error handling.',
                tools: ['code_search'],
                parentModel: 'gpt-4o'
            },
            {
                name: 'QA',
                description: 'Quality Assurance Engineer',
                systemPrompt: 'You are a QA Engineer. Your goal is to break the code. You suggest edge cases, unit tests, and security vulnerabilities.',
                tools: [],
                parentModel: 'gpt-4o'
            },
            {
                name: 'Designer',
                description: 'UI/UX Designer',
                systemPrompt: 'You are a UI/UX expert. You focus on aesthetics, whitespace, color theory, and user experience. You critique usage of CSS and layout.',
                tools: [],
                parentModel: 'gpt-4o'
            }
        ]

        for (const agent of builtIns) {
            try {
                await this.registerAgent(agent)
            } catch (error) {
                // Database might not be ready yet (table doesn't exist)
                this.logWarn(`Failed to seed agent ${agent.name}`, error as Error)
            }
        }
    }
}
