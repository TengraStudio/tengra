/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { DataService } from '@main/services/data/data.service';
import { DatabaseService } from '@main/services/data/database.service';
import { PromptTemplatesService } from '@main/services/llm/prompt-templates.service';
import { BUILTIN_TEMPLATES, PromptTemplate } from '@main/utils/prompt-templates.util';
import { beforeEach,describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('fs', () => ({
    existsSync: vi.fn(() => false),
    promises: {
        readFile: vi.fn(),
        rename: vi.fn(),
    },
}));

function createService() {
    const mockDataService: Pick<DataService, 'getPath'> = {
        getPath: vi.fn(() => '/fake/db/path'),
    };

    const mockDatabaseService: Pick<
        DatabaseService,
        'getCustomTemplates' | 'addCustomTemplate' | 'updateCustomTemplate' | 'deleteCustomTemplate'
    > = {
        getCustomTemplates: vi.fn(async (): Promise<PromptTemplate[]> => []),
        addCustomTemplate: vi.fn(async () => undefined),
        updateCustomTemplate: vi.fn(async () => undefined),
        deleteCustomTemplate: vi.fn(async () => undefined),
    };

    const service = new PromptTemplatesService(
        mockDataService as DataService,
        mockDatabaseService as DatabaseService
    );

    return { service, mockDataService, mockDatabaseService };
}

describe('PromptTemplatesService', () => {
    let service: PromptTemplatesService;
    let mockDatabaseService: ReturnType<typeof createService>['mockDatabaseService'];

    beforeEach(async () => {
        vi.restoreAllMocks();
        const created = createService();
        service = created.service;
        mockDatabaseService = created.mockDatabaseService;
        await service.initialize();
    });

    describe('getAllTemplates', () => {
        it('returns builtin templates when no custom ones exist', () => {
            const templates = service.getAllTemplates();
            expect(templates.length).toBe(BUILTIN_TEMPLATES.length);
        });
    });

    describe('getByCategory', () => {
        it('filters templates by category', () => {
            const firstBuiltin = BUILTIN_TEMPLATES[0];
            if (!firstBuiltin?.category) {return;}
            const results = service.getByCategory(firstBuiltin.category);
            expect(results.length).toBeGreaterThan(0);
            results.forEach(t => expect(t.category).toBe(firstBuiltin.category));
        });

        it('returns empty for unknown category', () => {
            expect(service.getByCategory('nonexistent-category-xyz')).toEqual([]);
        });
    });

    describe('getByTag', () => {
        it('filters templates by tag', () => {
            const firstWithTags = BUILTIN_TEMPLATES.find(t => t.tags && t.tags.length > 0);
            if (!firstWithTags?.tags?.[0]) {return;}
            const results = service.getByTag(firstWithTags.tags[0]);
            expect(results.length).toBeGreaterThan(0);
        });
    });

    describe('search', () => {
        it('searches templates by name (case insensitive)', () => {
            const first = BUILTIN_TEMPLATES[0];
            if (!first) {return;}
            const results = service.search(first.name.toUpperCase());
            expect(results.some(t => t.id === first.id)).toBe(true);
        });

        it('returns empty for no match', () => {
            expect(service.search('zzz-no-match-zzz')).toEqual([]);
        });
    });

    describe('getTemplate', () => {
        it('returns a template by id', () => {
            const first = BUILTIN_TEMPLATES[0];
            if (!first) {return;}
            expect(service.getTemplate(first.id)?.id).toBe(first.id);
        });

        it('returns undefined for unknown id', () => {
            expect(service.getTemplate('unknown-id')).toBeUndefined();
        });
    });

    describe('createTemplate', () => {
        it('creates and stores a custom template', async () => {
            const template = await service.createTemplate({
                name: 'New',
                template: 'Hi {{x}}',
                variables: [{ name: 'x', type: 'string' }],
                category: 'test',
            });

            expect(template.id).toMatch(/^custom-/);
            expect(template.name).toBe('New');
            expect(mockDatabaseService.addCustomTemplate).toHaveBeenCalledTimes(1);
            expect(service.getAllTemplates().some(t => t.id === template.id)).toBe(true);
        });
    });

    describe('updateTemplate', () => {
        it('updates an existing custom template', async () => {
            const template = await service.createTemplate({
                name: 'Original',
                template: '{{a}}',
                variables: [{ name: 'a', type: 'string' }],
            });

            const updated = await service.updateTemplate(template.id, { name: 'Updated' });
            expect(updated?.name).toBe('Updated');
            expect(mockDatabaseService.updateCustomTemplate).toHaveBeenCalled();
        });

        it('returns null for non-existent template', async () => {
            const result = await service.updateTemplate('missing-id', { name: 'X' });
            expect(result).toBeNull();
        });
    });

    describe('deleteTemplate', () => {
        it('deletes a custom template', async () => {
            const template = await service.createTemplate({
                name: 'ToDelete',
                template: '{{x}}',
                variables: [],
            });

            const result = await service.deleteTemplate(template.id);
            expect(result).toBe(true);
            expect(mockDatabaseService.deleteCustomTemplate).toHaveBeenCalledWith(template.id);
            expect(service.getTemplate(template.id)).toBeUndefined();
        });

        it('returns false for non-existent template', async () => {
            expect(await service.deleteTemplate('missing-id')).toBe(false);
        });
    });

    describe('renderTemplate', () => {
        it('renders a template with variables', async () => {
            const template = await service.createTemplate({
                name: 'Greeting',
                template: 'Hello {{name}}!',
                variables: [{ name: 'name', type: 'string' }],
            });

            const result = service.renderTemplate(template.id, { name: 'World' });
            expect(result).toBe('Hello World!');
        });

        it('returns null for unknown template id', () => {
            expect(service.renderTemplate('missing', { x: 'y' })).toBeNull();
        });
    });

    describe('getCategories / getTags', () => {
        it('returns sorted unique categories', () => {
            const categories = service.getCategories();
            const sorted = [...categories].sort();
            expect(categories).toEqual(sorted);
        });

        it('returns sorted unique tags', () => {
            const tags = service.getTags();
            const sorted = [...tags].sort();
            expect(tags).toEqual(sorted);
        });
    });

    describe('cleanup', () => {
        it('clears custom templates on cleanup', async () => {
            await service.createTemplate({
                name: 'Temp',
                template: '{{x}}',
                variables: [],
            });

            await service.cleanup();
            // After cleanup, only builtins remain
            expect(service.getAllTemplates().length).toBe(BUILTIN_TEMPLATES.length);
        });
    });

    describe('loadCustomTemplates error handling', () => {
        it('falls back to empty array on DB failure', async () => {
            const { service: svc, mockDatabaseService: db } = createService();
            vi.mocked(db.getCustomTemplates).mockRejectedValue(new Error('db error'));
            await svc.initialize();
            expect(svc.getAllTemplates().length).toBe(BUILTIN_TEMPLATES.length);
        });
    });
});
