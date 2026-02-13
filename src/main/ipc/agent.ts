/**
 * IPC handlers for Agent Service
 */
import { AgentService } from '@main/services/llm/agent.service';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { ipcMain } from 'electron';

export function registerAgentIpc(agentService: AgentService) {
    /**
     * Get all agents
     * Returns an empty array on failure
     */
    ipcMain.handle('agent:get-all', createSafeIpcHandler('agent:get-all', async () => {
        const agents = await agentService.getAllAgents();
        return safeJsonParse(JSON.stringify(agents), agents);
    }, []));

    /**
     * Get a specific agent by ID
     * Returns null on failure
     */
    ipcMain.handle('agent:get', createSafeIpcHandler('agent:get', async (_event, id: string) => {
        return await agentService.getAgent(id);
    }, null));

    ipcMain.handle('agent:create', createSafeIpcHandler('agent:create', async (_event, payload: unknown) => {
        const data = safeJsonParse(JSON.stringify(payload), payload) as {
            agent?: {
                id?: string;
                name?: string;
                description?: string;
                systemPrompt?: string;
                tools?: string[];
                parentModel?: string;
                color?: string;
            };
            options?: { cloneFromId?: string; createWorkspace?: boolean };
        };
        if (!data.agent) {
            return { success: false, error: 'Invalid agent payload' };
        }
        return await agentService.createAgent({
            id: data.agent.id,
            name: data.agent.name ?? '',
            description: data.agent.description ?? '',
            systemPrompt: data.agent.systemPrompt ?? '',
            tools: Array.isArray(data.agent.tools) ? data.agent.tools : [],
            parentModel: data.agent.parentModel,
            color: data.agent.color
        }, data.options);
    }, { success: false, error: 'create failed' }));

    ipcMain.handle('agent:delete', createSafeIpcHandler('agent:delete', async (_event, id: string, options: unknown) => {
        const opts = safeJsonParse(JSON.stringify(options), options) as {
            confirm?: boolean;
            softDelete?: boolean;
            backupBeforeDelete?: boolean;
        } | undefined;
        return await agentService.deleteAgent(id, opts ?? { confirm: false });
    }, { success: false, error: 'delete failed' }));

    ipcMain.handle('agent:clone', createSafeIpcHandler('agent:clone', async (_event, id: string, newName?: string) => {
        return await agentService.cloneAgent(id, newName);
    }, { success: false, error: 'clone failed' }));

    ipcMain.handle('agent:export', createSafeIpcHandler('agent:export', async (_event, id: string) => {
        const agent = await agentService.getAgent(id);
        if (!agent) {
            return null;
        }
        return agentService.exportAgent(agent);
    }, null));

    ipcMain.handle('agent:import', createSafeIpcHandler('agent:import', async (_event, payload: string) => {
        return await agentService.importAgent(payload);
    }, { success: false, error: 'import failed' }));

    ipcMain.handle('agent:get-templates-library', createSafeIpcHandler('agent:get-templates-library', async () => {
        return await agentService.getAgentTemplatesLibrary();
    }, []));

    ipcMain.handle('agent:validate-template', createSafeIpcHandler('agent:validate-template', async (_event, template: unknown) => {
        const data = safeJsonParse(JSON.stringify(template), template) as {
            name?: string;
            description?: string;
            systemPrompt?: string;
            tools?: string[];
            parentModel?: string;
            color?: string;
        };
        return agentService.validateAgentTemplate({
            name: data.name,
            description: data.description,
            systemPrompt: data.systemPrompt,
            tools: Array.isArray(data.tools) ? data.tools : [],
            parentModel: data.parentModel,
            color: data.color
        });
    }, { valid: false, errors: ['validation failed'] }));

    ipcMain.handle('agent:recover', createSafeIpcHandler('agent:recover', async (_event, archiveId: string) => {
        return await agentService.recoverAgentFromArchive(archiveId);
    }, { success: false, error: 'recovery failed' }));
}

