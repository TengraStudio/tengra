import { AgentTemplateService } from '@main/services/workspace/agent/agent-template.service';
import { AgentTemplate, AgentTemplateExport } from '@shared/types/project-agent';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('crypto', () => ({
    randomUUID: vi.fn(() => 'mock-uuid-1234'),
}));

interface MockDatabaseService {
    getAgentTemplates: ReturnType<typeof vi.fn>;
    saveAgentTemplate: ReturnType<typeof vi.fn>;
    deleteAgentTemplate: ReturnType<typeof vi.fn>;
}

function createMockDeps(): { database: MockDatabaseService } {
    return {
        database: {
            getAgentTemplates: vi.fn().mockResolvedValue([]),
            saveAgentTemplate: vi.fn().mockResolvedValue(undefined),
            deleteAgentTemplate: vi.fn().mockResolvedValue(undefined),
        },
    };
}

describe('AgentTemplateService', () => {
    let service: AgentTemplateService;
    let mockDeps: ReturnType<typeof createMockDeps>;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockDeps = createMockDeps();
        service = new AgentTemplateService(mockDeps as never);
        await service.initialize();
    });

    describe('initialize', () => {
        it('should load built-in templates', () => {
            const builtIns = service.getBuiltInTemplates();
            expect(builtIns.length).toBeGreaterThan(0);
            expect(builtIns.every(t => t.isBuiltIn)).toBe(true);
        });

        it('should load user templates from database', async () => {
            const userTemplate: AgentTemplate = {
                id: 'template-user-custom',
                name: 'Custom',
                description: 'Custom template',
                category: 'feature',
                taskTemplate: 'Do {{thing}}',
                predefinedSteps: ['step1'],
                variables: [{ name: 'thing', type: 'string', description: 'The thing', required: true }],
                tags: ['custom'],
                isBuiltIn: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            mockDeps.database.getAgentTemplates.mockResolvedValue([userTemplate]);

            const svc = new AgentTemplateService(mockDeps as never);
            await svc.initialize();

            expect(svc.getTemplate('template-user-custom')).toBeDefined();
        });

        it('should handle database load failure gracefully', async () => {
            mockDeps.database.getAgentTemplates.mockRejectedValue(new Error('DB error'));
            const svc = new AgentTemplateService(mockDeps as never);
            await svc.initialize(); // should not throw
        });
    });

    describe('createTemplate', () => {
        it('should create a user template with generated id', async () => {
            const result = await service.createTemplate({
                name: 'My Template',
                description: 'A test template',
                category: 'feature',
                taskTemplate: 'Do {{task}}',
                predefinedSteps: ['step1'],
                variables: [],
                tags: ['test'],
                isBuiltIn: false,
            });

            expect(result.id).toContain('template-user-');
            expect(result.name).toBe('My Template');
            expect(result.isBuiltIn).toBe(false);
            expect(mockDeps.database.saveAgentTemplate).toHaveBeenCalledWith(result);
        });
    });

    describe('updateTemplate', () => {
        it('should update a user template', async () => {
            const created = await service.createTemplate({
                name: 'Updatable',
                description: 'Desc',
                category: 'feature',
                taskTemplate: 'Task',
                predefinedSteps: [],
                variables: [],
                tags: [],
                isBuiltIn: false,
            });

            const updated = await service.updateTemplate(created.id, { name: 'Updated Name' });

            expect(updated?.name).toBe('Updated Name');
            expect(updated?.id).toBe(created.id);
        });

        it('should return null for non-existent template', async () => {
            const result = await service.updateTemplate('nonexistent', { name: 'X' });
            expect(result).toBeNull();
        });

        it('should return null when trying to update built-in template', async () => {
            const builtIn = service.getBuiltInTemplates()[0];
            const result = await service.updateTemplate(builtIn.id, { name: 'Hacked' });
            expect(result).toBeNull();
        });
    });

    describe('deleteTemplate', () => {
        it('should delete a user template', async () => {
            const created = await service.createTemplate({
                name: 'Deletable',
                description: 'Desc',
                category: 'feature',
                taskTemplate: 'Task',
                predefinedSteps: [],
                variables: [],
                tags: [],
                isBuiltIn: false,
            });

            const deleted = await service.deleteTemplate(created.id);
            expect(deleted).toBe(true);
            expect(service.getTemplate(created.id)).toBeNull();
        });

        it('should return false for non-existent template', async () => {
            expect(await service.deleteTemplate('nonexistent')).toBe(false);
        });

        it('should not delete built-in template', async () => {
            const builtIn = service.getBuiltInTemplates()[0];
            expect(await service.deleteTemplate(builtIn.id)).toBe(false);
        });
    });

    describe('applyVariables', () => {
        it('should substitute variables in task and steps', () => {
            const template: AgentTemplate = {
                id: 't1',
                name: 'Test',
                description: 'Desc',
                category: 'feature',
                taskTemplate: 'Fix {{file_path}} using {{pattern}}',
                predefinedSteps: ['Open {{file_path}}', 'Apply {{pattern}}'],
                variables: [
                    { name: 'file_path', type: 'file_path', description: 'File', required: true },
                    { name: 'pattern', type: 'string', description: 'Pattern', required: false, defaultValue: 'clean-code' },
                ],
                tags: [],
                isBuiltIn: false,
                createdAt: 0,
                updatedAt: 0,
            };

            const result = service.applyVariables(template, { file_path: 'src/app.ts' });

            expect(result.task).toBe('Fix src/app.ts using clean-code');
            expect(result.steps[0]).toBe('Open src/app.ts');
        });

        it('should throw when required variable is missing', () => {
            const template: AgentTemplate = {
                id: 't1',
                name: 'Test',
                description: 'Desc',
                category: 'feature',
                taskTemplate: '{{required_var}}',
                predefinedSteps: [],
                variables: [
                    { name: 'required_var', type: 'string', description: 'Required', required: true },
                ],
                tags: [],
                isBuiltIn: false,
                createdAt: 0,
                updatedAt: 0,
            };

            expect(() => service.applyVariables(template, {})).toThrow('Required variable missing');
        });
    });

    describe('validateVariables', () => {
        it('should validate required fields', () => {
            const template: AgentTemplate = {
                id: 't1',
                name: 'Test',
                description: 'Desc',
                category: 'feature',
                taskTemplate: '',
                predefinedSteps: [],
                variables: [
                    { name: 'name', type: 'string', description: 'Name', required: true },
                ],
                tags: [],
                isBuiltIn: false,
                createdAt: 0,
                updatedAt: 0,
            };

            const result = service.validateVariables(template, {});
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('name is required');
        });

        it('should validate select options', () => {
            const template: AgentTemplate = {
                id: 't1',
                name: 'Test',
                description: 'Desc',
                category: 'feature',
                taskTemplate: '',
                predefinedSteps: [],
                variables: [
                    { name: 'type', type: 'select', description: 'Type', required: false, options: ['a', 'b'] },
                ],
                tags: [],
                isBuiltIn: false,
                createdAt: 0,
                updatedAt: 0,
            };

            const result = service.validateVariables(template, { type: 'c' });
            expect(result.valid).toBe(false);
        });

        it('should pass validation for valid values', () => {
            const template: AgentTemplate = {
                id: 't1',
                name: 'Test',
                description: 'Desc',
                category: 'feature',
                taskTemplate: '',
                predefinedSteps: [],
                variables: [
                    { name: 'name', type: 'string', description: 'Name', required: true },
                ],
                tags: [],
                isBuiltIn: false,
                createdAt: 0,
                updatedAt: 0,
            };

            const result = service.validateVariables(template, { name: 'hello' });
            expect(result.valid).toBe(true);
        });
    });

    describe('exportTemplate / importTemplate', () => {
        it('should export a template', () => {
            const builtIn = service.getBuiltInTemplates()[0];
            const exported = service.exportTemplate(builtIn.id);

            expect(exported).toBeDefined();
            expect(exported?.version).toBe(1);
            expect(exported?.template.isBuiltIn).toBe(false);
        });

        it('should return null for non-existent template export', () => {
            expect(service.exportTemplate('nonexistent')).toBeNull();
        });

        it('should import a template', async () => {
            const exportData: AgentTemplateExport = {
                version: 1,
                template: {
                    id: 'old-id',
                    name: 'Imported',
                    description: 'Imported desc',
                    category: 'feature',
                    taskTemplate: 'Do thing',
                    predefinedSteps: [],
                    variables: [],
                    tags: ['imported'],
                    isBuiltIn: false,
                    createdAt: 0,
                    updatedAt: 0,
                },
                exportedAt: Date.now(),
            };

            const imported = await service.importTemplate(exportData);
            expect(imported.id).toContain('template-imported-');
            expect(imported.name).toBe('Imported');
        });

        it('should throw for unsupported export version', async () => {
            const exportData = {
                version: 99,
                template: {} as AgentTemplate,
                exportedAt: Date.now(),
            } as unknown as AgentTemplateExport;

            await expect(service.importTemplate(exportData)).rejects.toThrow('Unsupported export version');
        });
    });

    describe('query methods', () => {
        it('should get all templates', () => {
            const all = service.getAllTemplates();
            expect(all.length).toBeGreaterThan(0);
        });

        it('should get templates by category', () => {
            const refactorTemplates = service.getTemplatesByCategory('refactor');
            expect(refactorTemplates.every(t => t.category === 'refactor')).toBe(true);
        });

        it('should search templates by name', () => {
            const results = service.searchTemplates('Bug Fix');
            expect(results.length).toBeGreaterThan(0);
        });

        it('should search templates by tag', () => {
            const results = service.searchTemplates('security');
            expect(results.length).toBeGreaterThan(0);
        });
    });
});
