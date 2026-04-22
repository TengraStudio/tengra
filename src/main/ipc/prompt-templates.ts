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
import { PromptTemplatesService } from '@main/services/llm/prompt-templates.service';
import { createIpcHandler, createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { PromptTemplate } from '@main/utils/prompt-templates.util';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

/**
 * Registers IPC handlers for prompt templates library
 */
export function registerPromptTemplatesIpc(getMainWindow: () => BrowserWindow | null, promptTemplatesService: PromptTemplatesService) {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'prompt-templates operation');
    /**
     * Get all templates (builtin + custom)
     */
    ipcMain.handle('prompt-templates:getAll', createSafeIpcHandler('prompt-templates:getAll', async (event) => {
        validateSender(event);
        return promptTemplatesService.getAllTemplates();
    }, []));

    /**
     * Get templates by category
     */

    /**
     * Get templates by tag
     */

    /**
     * Search templates
     */
    ipcMain.handle('prompt-templates:search', createSafeIpcHandler('prompt-templates:search', async (event: IpcMainInvokeEvent, query: string) => {
        validateSender(event);
        if (typeof query !== 'string') {
            throw new Error('Query must be a string');
        }
        return promptTemplatesService.search(query);
    }, []));

    /**
     * Get a template by ID
     */
    ipcMain.handle('prompt-templates:get', createSafeIpcHandler('prompt-templates:get', async (event: IpcMainInvokeEvent, id: string) => {
        validateSender(event);
        if (typeof id !== 'string') {
            throw new Error('ID must be a string');
        }
        const template = promptTemplatesService.getTemplate(id);
        return template ?? null;
    }, null));

    /**
     * Create a new custom template
     */
    ipcMain.handle('prompt-templates:create', createIpcHandler('prompt-templates:create', async (event: IpcMainInvokeEvent, template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
        validateSender(event);
        return promptTemplatesService.createTemplate(template);
    }));

    /**
     * Update an existing custom template
     */
    ipcMain.handle('prompt-templates:update', createIpcHandler('prompt-templates:update', async (event: IpcMainInvokeEvent, id: string, updates: Partial<Omit<PromptTemplate, 'id' | 'createdAt'>>) => {
        validateSender(event);
        const result = await promptTemplatesService.updateTemplate(id, updates);
        if (!result) {
            throw new Error(`Template not found: ${id}`);
        }
        return result;
    }));

    /**
     * Delete a custom template
     */
    ipcMain.handle('prompt-templates:delete', createIpcHandler('prompt-templates:delete', async (event: IpcMainInvokeEvent, id: string) => {
        validateSender(event);
        const success = await promptTemplatesService.deleteTemplate(id);
        if (!success) {
            throw new Error(`Template not found: ${id}`);
        }
        return { success: true };
    }));

    /**
     * Render a template with variables
     */

    /**
     * Get all categories
     */
    ipcMain.handle('prompt-templates:getCategories', createSafeIpcHandler('prompt-templates:getCategories', async (event) => {
        validateSender(event);
        return promptTemplatesService.getCategories();
    }, []));

    /**
     * Get all tags
     */
}
