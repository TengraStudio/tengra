/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock modules
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    }
}));


vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn()
    }
}));

// Import after mocks
import { registerPromptTemplatesIpc } from '@main/ipc/prompt-templates';
import type { PromptTemplatesService } from '@main/services/llm/prompt-templates.service';

describe('Prompt Templates IPC Handlers', () => {
    const ipcMainHandlers = new Map<string, CallableFunction>();
    let mockPromptTemplatesService: PromptTemplatesService;
    let mockEvent: IpcMainInvokeEvent;

    beforeEach(() => {
        vi.clearAllMocks();
        ipcMainHandlers.clear();

        // Capture IPC handlers
        vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: CallableFunction) => {
            ipcMainHandlers.set(channel, handler);
            return { channels: [channel] } as never as Electron.IpcMain;
        });

        // Mock prompt templates service
        mockPromptTemplatesService = {
            getAllTemplates: vi.fn().mockResolvedValue([]),
            getByCategory: vi.fn().mockResolvedValue([]),
            getByTag: vi.fn().mockResolvedValue([]),
            search: vi.fn().mockResolvedValue([]),
            getTemplate: vi.fn().mockResolvedValue(null),
            createTemplate: vi.fn().mockResolvedValue({ id: 'new-template', name: 'New Template' }),
            updateTemplate: vi.fn().mockResolvedValue({ id: 'updated', name: 'Updated Template' }),
            deleteTemplate: vi.fn().mockResolvedValue(true),
            renderTemplate: vi.fn().mockReturnValue('Rendered output')
        } as never as PromptTemplatesService;

        mockEvent = {} as IpcMainInvokeEvent;

        registerPromptTemplatesIpc(() => null, mockPromptTemplatesService);
    });

    describe('prompt-templates:getAll', () => {
        it('should get all templates', async () => {
            const handler = ipcMainHandlers.get('prompt-templates:getAll');
            expect(handler).toBeDefined();

            const templates = [
                { id: 'template1', name: 'Template 1', category: 'general', template: 'content 1', variables: [], createdAt: 1, updatedAt: 1 },
                { id: 'template2', name: 'Template 2', category: 'code', template: 'content 2', variables: [], createdAt: 1, updatedAt: 1 }
            ];
            vi.mocked(mockPromptTemplatesService.getAllTemplates).mockReturnValue(templates as never);


            const result = await handler!(mockEvent);

            expect(mockPromptTemplatesService.getAllTemplates).toHaveBeenCalled();
            expect(result).toEqual(templates);
        });

        it('should return empty array on error', async () => {
            const handler = ipcMainHandlers.get('prompt-templates:getAll');
            vi.mocked(mockPromptTemplatesService.getAllTemplates).mockRejectedValue(new Error('Service error'));

            const result = await handler!(mockEvent);

            expect(result).toEqual([]);
        });
    });

    describe('prompt-templates:getByCategory', () => {
        it('should get templates by category', async () => {
            const handler = ipcMainHandlers.get('prompt-templates:getByCategory');
            expect(handler).toBeDefined();

            const templates = [{ id: 'template1', name: 'Code Template', category: 'code', template: 'content', variables: [], createdAt: 1, updatedAt: 1 }];
            vi.mocked(mockPromptTemplatesService.getByCategory).mockReturnValue(templates as never);


            const result = await handler!(mockEvent, 'code');

            expect(mockPromptTemplatesService.getByCategory).toHaveBeenCalledWith('code');
            expect(result).toEqual(templates);
        });

        it('should reject non-string category', async () => {
            const handler = ipcMainHandlers.get('prompt-templates:getByCategory');

            const result = await handler!(mockEvent, 123);

            expect(result).toEqual([]);
        });

        it('should return empty array on error', async () => {
            const handler = ipcMainHandlers.get('prompt-templates:getByCategory');
            vi.mocked(mockPromptTemplatesService.getByCategory).mockRejectedValue(new Error('Error'));

            const result = await handler!(mockEvent, 'code');

            expect(result).toEqual([]);
        });
    });

    describe('prompt-templates:getByTag', () => {
        it('should get templates by tag', async () => {
            const handler = ipcMainHandlers.get('prompt-templates:getByTag');
            expect(handler).toBeDefined();

            const templates = [{ id: 'template1', name: 'Refactor Template', tags: ['refactor', 'code'], template: 'content', variables: [], createdAt: 1, updatedAt: 1 }];
            vi.mocked(mockPromptTemplatesService.getByTag).mockReturnValue(templates as never);


            const result = await handler!(mockEvent, 'refactor');

            expect(mockPromptTemplatesService.getByTag).toHaveBeenCalledWith('refactor');
            expect(result).toEqual(templates);
        });

        it('should reject non-string tag', async () => {
            const handler = ipcMainHandlers.get('prompt-templates:getByTag');

            const result = await handler!(mockEvent, null);

            expect(result).toEqual([]);
        });
    });

    describe('prompt-templates:search', () => {
        it('should search templates with query', async () => {
            const handler = ipcMainHandlers.get('prompt-templates:search');
            expect(handler).toBeDefined();

            const templates = [{ id: 'template1', name: 'React Component', template: 'content', variables: [], createdAt: 1, updatedAt: 1 }];
            vi.mocked(mockPromptTemplatesService.search).mockReturnValue(templates as never);


            const result = await handler!(mockEvent, 'react');

            expect(mockPromptTemplatesService.search).toHaveBeenCalledWith('react');
            expect(result).toEqual(templates);
        });

        it('should reject non-string query', async () => {
            const handler = ipcMainHandlers.get('prompt-templates:search');

            const result = await handler!(mockEvent, {});

            expect(result).toEqual([]);
        });

        it('should handle empty search results', async () => {
            const handler = ipcMainHandlers.get('prompt-templates:search');
            vi.mocked(mockPromptTemplatesService.search).mockResolvedValue([]);

            const result = await handler!(mockEvent, 'nonexistent');

            expect(result).toEqual([]);
        });
    });

    describe('prompt-templates:get', () => {
        it('should get template by ID', async () => {
            const handler = ipcMainHandlers.get('prompt-templates:get');
            expect(handler).toBeDefined();

            const template = { id: 'template1', name: 'My Template', template: 'content', variables: [], createdAt: 1, updatedAt: 1 };
            vi.mocked(mockPromptTemplatesService.getTemplate).mockReturnValue(template as never);


            const result = await handler!(mockEvent, 'template1');

            expect(mockPromptTemplatesService.getTemplate).toHaveBeenCalledWith('template1');
            expect(result).toEqual(template);
        });

        it('should return null if template not found', async () => {
            const handler = ipcMainHandlers.get('prompt-templates:get');
            vi.mocked(mockPromptTemplatesService.getTemplate).mockReturnValue(undefined);


            const result = await handler!(mockEvent, 'nonexistent');

            expect(result).toBeNull();
        });

        it('should reject non-string ID', async () => {
            const handler = ipcMainHandlers.get('prompt-templates:get');

            const result = await handler!(mockEvent, 123);

            expect(result).toBeNull();
        });
    });

    describe('prompt-templates:create', () => {
        it('should create new template', async () => {
            const handler = ipcMainHandlers.get('prompt-templates:create');
            expect(handler).toBeDefined();

            const newTemplate = {
                name: 'New Template',
                category: 'general',
                content: 'Template content',
                variables: []
            };

            const result = await handler!(mockEvent, newTemplate);

            expect(mockPromptTemplatesService.createTemplate).toHaveBeenCalledWith(newTemplate);
            expect(result).toEqual({ id: 'new-template', name: 'New Template' });
        });
    });

    describe('prompt-templates:update', () => {
        it('should update existing template', async () => {
            const handler = ipcMainHandlers.get('prompt-templates:update');
            expect(handler).toBeDefined();

            const updates = { name: 'Updated Name', content: 'Updated content' };

            const result = await handler!(mockEvent, 'template1', updates);

            expect(mockPromptTemplatesService.updateTemplate).toHaveBeenCalledWith('template1', updates);
            expect(result).toEqual({ id: 'updated', name: 'Updated Template' });
        });

        it('should throw error if template not found', async () => {
            const handler = ipcMainHandlers.get('prompt-templates:update');
            vi.mocked(mockPromptTemplatesService.updateTemplate).mockResolvedValue(null);

            await expect(handler!(mockEvent, 'nonexistent', { name: 'Test' }))
                .rejects.toThrow('Template not found: nonexistent');
        });
    });

    describe('prompt-templates:delete', () => {
        it('should delete template successfully', async () => {
            const handler = ipcMainHandlers.get('prompt-templates:delete');
            expect(handler).toBeDefined();

            const result = await handler!(mockEvent, 'template1');

            expect(mockPromptTemplatesService.deleteTemplate).toHaveBeenCalledWith('template1');
            expect(result).toEqual({ success: true });
        });

        it('should throw error if template not found', async () => {
            const handler = ipcMainHandlers.get('prompt-templates:delete');
            vi.mocked(mockPromptTemplatesService.deleteTemplate).mockResolvedValue(false);

            await expect(handler!(mockEvent, 'nonexistent'))
                .rejects.toThrow('Template not found: nonexistent');
        });
    });

    describe('prompt-templates:render', () => {
        it('should render template with variables', async () => {
            const handler = ipcMainHandlers.get('prompt-templates:render');
            expect(handler).toBeDefined();

            const variables = { name: 'John', language: 'TypeScript' };
            vi.mocked(mockPromptTemplatesService.renderTemplate).mockReturnValue('Hello John, write TypeScript code');

            const result = await handler!(mockEvent, 'template1', variables);

            expect(mockPromptTemplatesService.renderTemplate).toHaveBeenCalledWith('template1', variables);
            expect(result).toBe('Hello John, write TypeScript code');
        });

        it('should reject non-string template ID', async () => {
            const handler = ipcMainHandlers.get('prompt-templates:render');

            const result = await handler!(mockEvent, 123, {});

            expect(result).toBe('');
        });

        it('should reject non-object variables', async () => {
            const handler = ipcMainHandlers.get('prompt-templates:render');

            const result = await handler!(mockEvent, 'template1', 'not an object');

            expect(result).toBe('');
        });

        it('should return empty string if template not found', async () => {
            const handler = ipcMainHandlers.get('prompt-templates:render');
            vi.mocked(mockPromptTemplatesService.renderTemplate).mockReturnValue(null);

            const result = await handler!(mockEvent, 'nonexistent', {});

            expect(result).toBe('');
        });
    });
});
