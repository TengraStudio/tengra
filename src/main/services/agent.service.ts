import { LanceDbService, type AgentRecord } from './data/lancedb.service'
import { randomUUID } from 'crypto'

export interface AgentDefinition {
    id?: string
    name: string
    description: string
    systemPrompt: string
    tools: string[]
    parentModel?: string
    color?: string
}

export class AgentService {
    constructor(private lanceDb: LanceDbService) { }

    async init() {
        await this.seedBuiltInAgents()
    }

    async registerAgent(agent: AgentDefinition): Promise<string> {
        const table = await this.lanceDb.getTable('agents')
        const id = agent.id || randomUUID()

        // Check if exists
        const existing = await table.query().where(`name = '${agent.name}'`).limit(1).toArray()
        if (existing.length > 0) {
            // Update
            await table.delete(`name = '${agent.name}'`)
        }

        await table.add([{
            id: id,
            name: agent.name,
            system_prompt: agent.systemPrompt,
            tools: agent.tools,
            parent_model: agent.parentModel || 'gpt-4o'
        }])

        return id
    }

    async getAgent(idOrName: string): Promise<AgentDefinition | null> {
        const table = await this.lanceDb.getTable('agents')
        let results = await table.query().where(`id = '${idOrName}'`).limit(1).toArray()

        if (results.length === 0) {
            results = await table.query().where(`name = '${idOrName}'`).limit(1).toArray()
        }

        if (results.length === 0) return null

        const record = results[0] as unknown as AgentRecord
        return {
            id: record.id,
            name: record.name,
            description: 'Agent', // Schema doesn't have description yet, implicit
            systemPrompt: record.system_prompt,
            tools: record.tools,
            parentModel: record.parent_model
        }
    }

    async getAllAgents(): Promise<AgentDefinition[]> {
        const table = await this.lanceDb.getTable('agents')
        const records = await table.query().toArray() as unknown as AgentRecord[]

        return records.map(r => ({
            id: r.id,
            name: r.name,
            description: 'Agent',
            systemPrompt: r.system_prompt,
            tools: r.tools,
            parentModel: r.parent_model
        }))
    }

    private async seedBuiltInAgents() {
        const builtIns: AgentDefinition[] = [
            {
                name: 'TechLead',
                description: 'Senior Technical Architect',
                systemPrompt: 'You are an expert Technical Lead. You always think about system architecture, scalability, and clean code patterns. You are strict about types and error handling.',
                tools: [],
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
            await this.registerAgent(agent)
        }
    }
}
