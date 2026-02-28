import { PromptTemplatesService } from '@main/services/llm/prompt-templates.service';
import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
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
    ipcMain.handle('prompt-templates:getByCategory', createSafeIpcHandler('prompt-templates:getByCategory', async (event: IpcMainInvokeEvent, category: string) => {
        validateSender(event);
        if (typeof category !== 'string') {
            throw new Error('Category must be a string');
        }
        return promptTemplatesService.getByCategory(category);
    }, []));

    /**
     * Get templates by tag
     */
    ipcMain.handle('prompt-templates:getByTag', createSafeIpcHandler('prompt-templates:getByTag', async (event: IpcMainInvokeEvent, tag: string) => {
        validateSender(event);
        if (typeof tag !== 'string') {
            throw new Error('Tag must be a string');
        }
        return promptTemplatesService.getByTag(tag);
    }, []));

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
    ipcMain.handle('prompt-templates:render', createSafeIpcHandler('prompt-templates:render', async (event: IpcMainInvokeEvent, templateId: string, variables: Record<string, string>) => {
        validateSender(event);
        if (typeof templateId !== 'string') {
            throw new Error('Template ID must be a string');
        }
        if (typeof variables !== 'object') {
            throw new Error('Variables must be an object');
        }
        const result = promptTemplatesService.renderTemplate(templateId, variables);
        if (!result) {
            throw new Error(`Template not found: ${templateId}`);
        }
        return result;
    }, ''));

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
    ipcMain.handle('prompt-templates:getTags', createSafeIpcHandler('prompt-templates:getTags', async (event) => {
        validateSender(event);
        return promptTemplatesService.getTags();
    }, []));
}
