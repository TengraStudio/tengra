/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { AgentService } from '@main/services/llm/agent.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import {
    AgentCreatePayloadSchema,
    AgentCreateResultSchema,
    AgentDefinitionSchema,
    AgentDeleteOptionsSchema,
    AgentDeleteResultSchema,
    AgentOperationResultSchema,
    AgentTemplateSchema,
    AgentValidationResultSchema
} from '@shared/schemas/service-hardening.schema';
import { BrowserWindow, ipcMain } from 'electron';
import { z } from 'zod';

/**
 * Registers all IPC handlers for the Agent Service.
 * Implements strict Zod validation for both requests and responses.
 *
 * @param getMainWindow - Function to get the main application window
 * @param agentService - The agent service instance
 */
export function registerAgentIpc(getMainWindow: () => BrowserWindow | null, agentService: AgentService): void {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'agent operation');

    /**
     * Get all agents
     * Returns an empty array on failure
     */
    ipcMain.handle('agent:get-all', createValidatedIpcHandler('agent:get-all', async (event): Promise<z.infer<typeof AgentDefinitionSchema>[]> => {
        validateSender(event);
        return await agentService.getAllAgents();
    }, {
        defaultValue: [],
        responseSchema: z.array(AgentDefinitionSchema),
        wrapResponse: true
    }));

    /**
     * Get a specific agent by ID
     * Returns null on failure
     */
    ipcMain.handle('agent:get', createValidatedIpcHandler('agent:get', async (event, id: string): Promise<z.infer<typeof AgentDefinitionSchema> | null> => {
        validateSender(event);
        return await agentService.getAgent(id);
    }, {
        defaultValue: null,
        argsSchema: z.tuple([z.string().min(1)]),
        responseSchema: AgentDefinitionSchema.nullable(),
        wrapResponse: true
    }));

    /**
     * Create a new agent (optionally cloned from another)
     */
    ipcMain.handle('agent:create', createValidatedIpcHandler('agent:create', async (event, payload: z.infer<typeof AgentCreatePayloadSchema>): Promise<z.infer<typeof AgentCreateResultSchema>> => {
        validateSender(event);
        const { agent, options } = payload;
        if (!agent) {
            throw new Error('Invalid agent payload');
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
        argsSchema: z.tuple([AgentCreatePayloadSchema]),
        responseSchema: AgentCreateResultSchema,
        wrapResponse: true
    }));

    /**
     * Delete an agent
     */
    ipcMain.handle('agent:delete', createValidatedIpcHandler('agent:delete', async (event, id: string, options: z.infer<typeof AgentDeleteOptionsSchema> | undefined): Promise<z.infer<typeof AgentDeleteResultSchema>> => {
        validateSender(event);
        return await agentService.deleteAgent(id, options ?? { confirm: false });
    }, {
        defaultValue: { success: false, error: 'delete failed' },
        argsSchema: z.tuple([z.string().min(1), AgentDeleteOptionsSchema.optional()]),
        responseSchema: AgentDeleteResultSchema,
        wrapResponse: true
    }));

    /**
     * Clone an existing agent
     */
    ipcMain.handle('agent:clone', createValidatedIpcHandler('agent:clone', async (event, id: string, newName?: string): Promise<z.infer<typeof AgentOperationResultSchema>> => {
        validateSender(event);
        return await agentService.cloneAgent(id, newName);
    }, {
        defaultValue: { success: false, error: 'clone failed' },
        argsSchema: z.tuple([z.string().min(1), z.string().optional()]),
        responseSchema: AgentOperationResultSchema,
        wrapResponse: true
    }));

    /**
     * Export an agent definition to string
     */
    ipcMain.handle('agent:export', createValidatedIpcHandler('agent:export', async (event, id: string): Promise<string | null> => {
        validateSender(event);
        const agent = await agentService.getAgent(id);
        if (!agent) {
            return null;
        }
        return agentService.exportAgent(agent);
    }, {
        defaultValue: null,
        argsSchema: z.tuple([z.string().min(1)]),
        responseSchema: z.string().nullable(),
        wrapResponse: true
    }));

    /**
     * Import an agent definition from string
     */
    ipcMain.handle('agent:import', createValidatedIpcHandler('agent:import', async (event, payload: string): Promise<z.infer<typeof AgentOperationResultSchema>> => {
        validateSender(event);
        return await agentService.importAgent(payload);
    }, {
        defaultValue: { success: false, error: 'import failed' },
        argsSchema: z.tuple([z.string().min(1)]),
        responseSchema: AgentOperationResultSchema,
        wrapResponse: true
    }));

    /**
     * Get the built-in and user-defined templates library
     */
    ipcMain.handle('agent:get-templates-library', createValidatedIpcHandler('agent:get-templates-library', async (event): Promise<z.infer<typeof AgentTemplateSchema>[]> => {
        validateSender(event);
        return await agentService.getAgentTemplatesLibrary();
    }, {
        defaultValue: [],
        responseSchema: z.array(AgentTemplateSchema),
        wrapResponse: true
    }));

    /**
     * Validate an agent template before creation
     */
    ipcMain.handle('agent:validate-template', createValidatedIpcHandler('agent:validate-template', async (event, template: z.infer<typeof AgentDefinitionSchema>): Promise<z.infer<typeof AgentValidationResultSchema>> => {
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
        argsSchema: z.tuple([AgentDefinitionSchema.partial()]),
        responseSchema: AgentValidationResultSchema,
        wrapResponse: true
    }));

    /**
     * Recover a deleted agent from the archive
     */
    ipcMain.handle('agent:recover', createValidatedIpcHandler('agent:recover', async (event, archiveId: string): Promise<z.infer<typeof AgentOperationResultSchema>> => {
        validateSender(event);
        return await agentService.recoverAgentFromArchive(archiveId);
    }, {
        defaultValue: { success: false, error: 'recovery failed' },
        argsSchema: z.tuple([z.string().min(1)]),
        responseSchema: AgentOperationResultSchema,
        wrapResponse: true
    }));

    appLogger.debug('registerAgentIpc', 'Agent IPC handlers registered with Zod validation');
}
