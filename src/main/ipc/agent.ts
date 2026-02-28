/**
 * IPC handlers for Agent Service
 */
import { AgentService } from '@main/services/llm/agent.service';
import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { BrowserWindow, ipcMain } from 'electron';
import { z } from 'zod';

const agentSchema = z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    systemPrompt: z.string().optional(),
    tools: z.array(z.string()).optional(),
    parentModel: z.string().optional(),
    color: z.string().optional()
});

const createAgentPayloadSchema = z.object({
    agent: agentSchema.optional(),
    options: z.object({
        cloneFromId: z.string().optional(),
        createWorkspace: z.boolean().optional()
    }).optional()
});

const deleteAgentOptionsSchema = z.object({
    confirm: z.boolean().optional(),
    softDelete: z.boolean().optional(),
    backupBeforeDelete: z.boolean().optional()
}).optional();

const templateSchema = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    systemPrompt: z.string().optional(),
    tools: z.array(z.string()).optional(),
    parentModel: z.string().optional(),
    color: z.string().optional()
});

type CreateAgentPayload = z.infer<typeof createAgentPayloadSchema>;
type DeleteAgentOptions = z.infer<typeof deleteAgentOptionsSchema>;
type Template = z.infer<typeof templateSchema>;

export function registerAgentIpc(getMainWindow: () => BrowserWindow | null, agentService: AgentService) {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'agent operation');

    /**
     * Get all agents
     * Returns an empty array on failure
     */
    ipcMain.handle('agent:get-all', createValidatedIpcHandler('agent:get-all', async (event) => {
        validateSender(event);
        return await agentService.getAllAgents();
    }, { defaultValue: [] }));

    /**
     * Get a specific agent by ID
     * Returns null on failure
     */
    ipcMain.handle('agent:get', createValidatedIpcHandler('agent:get', async (event, id: string) => {
        validateSender(event);
        return await agentService.getAgent(id);
    }, {
        defaultValue: null,
        argsSchema: z.tuple([z.string()])
    }));

    ipcMain.handle('agent:create', createValidatedIpcHandler('agent:create', async (event, payload: CreateAgentPayload) => {
        validateSender(event);
        const { agent, options } = payload;
        if (!agent) {
            return { success: false, error: 'Invalid agent payload' };
        }
        return await agentService.createAgent({
            id: agent.id,
            name: agent.name ?? '',
            description: agent.description ?? '',
            systemPrompt: agent.systemPrompt ?? '',
            tools: agent.tools ?? [],
            parentModel: agent.parentModel,
            color: agent.color
        }, options);
    }, {
        defaultValue: { success: false, error: 'create failed' },
        argsSchema: z.tuple([createAgentPayloadSchema])
    }));

    ipcMain.handle('agent:delete', createValidatedIpcHandler('agent:delete', async (event, id: string, options?: DeleteAgentOptions) => {
        validateSender(event);
        return await agentService.deleteAgent(id, options ?? { confirm: false });
    }, {
        defaultValue: { success: false, error: 'delete failed' },
        argsSchema: z.tuple([z.string(), deleteAgentOptionsSchema])
    }));

    ipcMain.handle('agent:clone', createValidatedIpcHandler('agent:clone', async (event, id: string, newName?: string) => {
        validateSender(event);
        return await agentService.cloneAgent(id, newName);
    }, {
        defaultValue: { success: false, error: 'clone failed' },
        argsSchema: z.tuple([z.string(), z.string().optional()])
    }));

    ipcMain.handle('agent:export', createValidatedIpcHandler('agent:export', async (event, id: string) => {
        validateSender(event);
        const agent = await agentService.getAgent(id);
        if (!agent) {
            return null;
        }
        return agentService.exportAgent(agent);
    }, {
        defaultValue: null,
        argsSchema: z.tuple([z.string()])
    }));

    ipcMain.handle('agent:import', createValidatedIpcHandler('agent:import', async (event, payload: string) => {
        validateSender(event);
        return await agentService.importAgent(payload);
    }, {
        defaultValue: { success: false, error: 'import failed' },
        argsSchema: z.tuple([z.string()])
    }));

    ipcMain.handle('agent:get-templates-library', createValidatedIpcHandler('agent:get-templates-library', async (event) => {
        validateSender(event);
        return await agentService.getAgentTemplatesLibrary();
    }, { defaultValue: [] }));

    ipcMain.handle('agent:validate-template', createValidatedIpcHandler('agent:validate-template', async (event, template: Template) => {
        validateSender(event);
        return agentService.validateAgentTemplate({
            name: template.name,
            description: template.description,
            systemPrompt: template.systemPrompt,
            tools: template.tools ?? [],
            parentModel: template.parentModel,
            color: template.color
        });
    }, {
        defaultValue: { valid: false, errors: ['validation failed'] },
        argsSchema: z.tuple([templateSchema])
    }));

    ipcMain.handle('agent:recover', createValidatedIpcHandler('agent:recover', async (event, archiveId: string) => {
        validateSender(event);
        return await agentService.recoverAgentFromArchive(archiveId);
    }, {
        defaultValue: { success: false, error: 'recovery failed' },
        argsSchema: z.tuple([z.string()])
    }));
}
