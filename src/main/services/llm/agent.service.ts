import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { app } from 'electron';

export interface AgentDefinition {
    id?: string
    name: string
    description: string
    systemPrompt: string
    tools: string[]
    parentModel?: string
    color?: string
}

export interface AgentTemplate extends AgentDefinition {
    category?: string;
}

export interface AgentCreateOptions {
    cloneFromId?: string;
    createWorkspace?: boolean;
}

export interface AgentDeleteOptions {
    confirm?: boolean;
    softDelete?: boolean;
    backupBeforeDelete?: boolean;
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

interface AgentArchiveRow {
    id: string;
    original_id: string;
    payload: string;
    deleted_at: number;
}

export class AgentService extends BaseService {
    constructor(private dbService: DatabaseService) {
        super('AgentService');
    }

    override async initialize(): Promise<void> {
        await this.ensureArchiveTable();
        await this.seedBuiltInAgents();
    }

    async registerAgent(agent: AgentDefinition): Promise<string> {
        const id = agent.id ?? randomUUID();
        const now = Date.now();
        const toolsJson = JSON.stringify(agent.tools);
        const db = this.dbService.getDatabase();

        // Check for existing by name
        const existing = await db.prepare('SELECT id FROM agents WHERE name = $1').get(agent.name) as { id: string } | undefined;

        if (existing) {
            // Update
            await db.prepare(`
                UPDATE agents
                SET system_prompt = $1, tools = $2, parent_model = $3, updated_at = $4
                WHERE name = $5
             `).run(agent.systemPrompt, toolsJson, agent.parentModel ?? 'gpt-4o', now, agent.name);
            return existing.id;
        } else {
            await db.prepare(`
                INSERT INTO agents (id, name, system_prompt, tools, parent_model, created_at, updated_at) 
                VALUES ($1, $2, $3, $4, $5, $6, $7)
             `).run(id, agent.name, agent.systemPrompt, toolsJson, agent.parentModel ?? 'gpt-4o', now, now);
            return id;
        }
    }

    async createAgent(agent: AgentDefinition, options: AgentCreateOptions = {}): Promise<{ success: boolean; id?: string; workspacePath?: string; error?: string }> {
        const validation = this.validateAgentTemplate(agent);
        if (!validation.valid) {
            return { success: false, error: validation.errors.join('; ') };
        }

        try {
            if (options.cloneFromId) {
                const cloned = await this.cloneAgent(options.cloneFromId, agent.name);
                if (!cloned.success) {
                    return cloned;
                }
                const workspacePath = options.createWorkspace === false
                    ? undefined
                    : await this.setupAgentWorkspace(cloned.id as string);
                return { success: true, id: cloned.id, workspacePath };
            }

            const id = await this.registerAgent(agent);
            const workspacePath = options.createWorkspace === false
                ? undefined
                : await this.setupAgentWorkspace(id);
            return { success: true, id, workspacePath };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    async cloneAgent(sourceId: string, newName?: string): Promise<{ success: boolean; id?: string; error?: string }> {
        const source = await this.getAgent(sourceId);
        if (!source) {
            return { success: false, error: 'Source agent not found' };
        }
        const clone: AgentDefinition = {
            ...source,
            id: undefined,
            name: newName?.trim() || `${source.name}-clone-${Date.now()}`,
            description: source.description || `Clone of ${source.name}`
        };
        const id = await this.registerAgent(clone);
        return { success: true, id };
    }

    exportAgent(agent: AgentDefinition): string {
        return JSON.stringify({
            version: 1,
            exportedAt: Date.now(),
            agent
        }, null, 2);
    }

    async importAgent(payload: string): Promise<{ success: boolean; id?: string; error?: string }> {
        try {
            const parsed = safeJsonParse(payload, {}) as { agent?: AgentDefinition };
            if (!parsed.agent) {
                return { success: false, error: 'Invalid import payload' };
            }
            const result = await this.createAgent(parsed.agent, { createWorkspace: true });
            return result;
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    async getAgentTemplatesLibrary(): Promise<AgentTemplate[]> {
        const builtIns: AgentTemplate[] = [
            {
                name: 'Debugger',
                description: 'Root-cause focused debugging specialist',
                systemPrompt: 'You are a debugging specialist. You isolate root causes and propose minimal-risk fixes.',
                tools: ['code_search'],
                parentModel: 'gpt-4o',
                category: 'engineering'
            },
            {
                name: 'SecurityReviewer',
                description: 'Security-first reviewer',
                systemPrompt: 'You analyze attack surfaces and prioritize exploitability and blast radius.',
                tools: ['code_search'],
                parentModel: 'gpt-4o',
                category: 'security'
            },
            {
                name: 'DocsWriter',
                description: 'Technical documentation assistant',
                systemPrompt: 'You convert code and architecture into concise, accurate technical docs.',
                tools: [],
                parentModel: 'gpt-4o',
                category: 'documentation'
            }
        ];
        return builtIns;
    }

    validateAgentTemplate(agent: Partial<AgentDefinition>): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        if (!agent.name || agent.name.trim().length < 2) {
            errors.push('Agent name is required');
        }
        if (!agent.systemPrompt || agent.systemPrompt.trim().length < 10) {
            errors.push('System prompt must be at least 10 characters');
        }
        if (!Array.isArray(agent.tools)) {
            errors.push('Tools must be an array');
        }
        if (agent.parentModel && agent.parentModel.trim().length < 2) {
            errors.push('Parent model is invalid');
        }
        return { valid: errors.length === 0, errors };
    }

    async deleteAgent(agentId: string, options: AgentDeleteOptions = {}): Promise<{ success: boolean; archivedId?: string; recoveryToken?: string; error?: string }> {
        if (!options.confirm) {
            return { success: false, error: 'Deletion not confirmed' };
        }
        const agent = await this.getAgent(agentId);
        if (!agent) {
            return { success: false, error: 'Agent not found' };
        }

        try {
            if (options.backupBeforeDelete !== false) {
                await this.backupAgent(agent);
            }

            const archivedId = await this.archiveAgent(agent);
            const db = this.dbService.getDatabase();
            await db.prepare('DELETE FROM agents WHERE id = $1 OR name = $1').run(agentId);

            if (options.softDelete !== false) {
                const recoveryToken = `recover_${agent.id}_${Date.now()}`;
                return { success: true, archivedId, recoveryToken };
            }

            await this.deleteAgentWorkspace(agent.id ?? agentId);
            return { success: true, archivedId };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    async recoverAgentFromArchive(archiveId: string): Promise<{ success: boolean; id?: string; error?: string }> {
        const db = this.dbService.getDatabase();
        const archive = await db.prepare('SELECT * FROM agent_archives WHERE id = $1').get(archiveId) as AgentArchiveRow | undefined;
        if (!archive) {
            return { success: false, error: 'Archive not found' };
        }
        const parsed = safeJsonParse(archive.payload, null) as AgentDefinition | null;
        if (!parsed) {
            return { success: false, error: 'Archive payload is invalid' };
        }
        const id = await this.registerAgent({ ...parsed, id: parsed.id ?? undefined });
        await this.setupAgentWorkspace(id);
        return { success: true, id };
    }

    async getAgent(idOrName: string): Promise<AgentDefinition | null> {
        const db = this.dbService.getDatabase();
        let result = await db.prepare('SELECT * FROM agents WHERE id = $1').get(idOrName) as AgentRow | undefined;

        result ??= (await db.prepare('SELECT * FROM agents WHERE name = $1').get(idOrName)) as AgentRow | undefined;

        if (!result) { return null; }

        return {
            id: result.id,
            name: result.name,
            description: 'Agent',
            systemPrompt: result.system_prompt,
            tools: safeJsonParse(result.tools, []),
            parentModel: result.parent_model
        };
    }

    async getAllAgents(): Promise<AgentDefinition[]> {
        const db = this.dbService.getDatabase();
        const results = await db.prepare('SELECT * FROM agents ORDER BY name').all<AgentRow>();
        return results.map(result => ({
            id: result.id,
            name: result.name,
            description: 'Agent',
            systemPrompt: result.system_prompt,
            tools: safeJsonParse(result.tools, []),
            parentModel: result.parent_model
        }));
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
        ];

        for (const agent of builtIns) {
            try {
                await this.registerAgent(agent);
            } catch (error) {
                // Database might not be ready yet (table doesn't exist)
                this.logWarn(`Failed to seed agent ${agent.name}`, error as Error);
            }
        }
    }

    private async ensureArchiveTable(): Promise<void> {
        const db = this.dbService.getDatabase();
        await db.prepare(`
            CREATE TABLE IF NOT EXISTS agents (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                system_prompt TEXT NOT NULL,
                tools TEXT NOT NULL DEFAULT '[]',
                parent_model TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `).run();
        await db.prepare(`
            CREATE TABLE IF NOT EXISTS agent_archives (
                id TEXT PRIMARY KEY,
                original_id TEXT NOT NULL,
                payload TEXT NOT NULL,
                deleted_at INTEGER NOT NULL
            )
        `).run();
    }

    private getAgentWorkspacesRoot(): string {
        return path.join(app.getPath('userData'), 'agent-workspaces');
    }

    private async setupAgentWorkspace(agentId: string): Promise<string> {
        const workspacePath = path.join(this.getAgentWorkspacesRoot(), agentId);
        await fs.mkdir(workspacePath, { recursive: true });
        await fs.writeFile(path.join(workspacePath, 'README.md'), `# Agent Workspace\n\nAgent: ${agentId}\n`, 'utf8');
        return workspacePath;
    }

    private async deleteAgentWorkspace(agentId: string): Promise<void> {
        const workspacePath = path.join(this.getAgentWorkspacesRoot(), agentId);
        await fs.rm(workspacePath, { recursive: true, force: true });
    }

    private async backupAgent(agent: AgentDefinition): Promise<void> {
        const backupRoot = path.join(app.getPath('userData'), 'agent-backups');
        await fs.mkdir(backupRoot, { recursive: true });
        const backupFile = path.join(backupRoot, `${agent.id ?? agent.name}-${Date.now()}.json`);
        await fs.writeFile(backupFile, this.exportAgent(agent), 'utf8');
    }

    private async archiveAgent(agent: AgentDefinition): Promise<string> {
        const db = this.dbService.getDatabase();
        const id = randomUUID();
        await db.prepare(`
            INSERT INTO agent_archives (id, original_id, payload, deleted_at)
            VALUES ($1, $2, $3, $4)
        `).run(id, agent.id ?? agent.name, JSON.stringify(agent), Date.now());
        return id;
    }
}
