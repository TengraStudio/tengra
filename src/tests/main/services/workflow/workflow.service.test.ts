/**
 * Unit tests for WorkflowService (BACKLOG-0431)
 * Covers: CRUD operations, validation, execution, state transitions, error handling
 */
import * as fs from 'fs/promises';

import {
    WORKFLOW_PERFORMANCE_BUDGETS,
    WorkflowErrorCode,
    WorkflowService,
    WorkflowTelemetryEvent,
} from '@main/services/workflow/workflow.service';
import { Workflow, WorkflowExecutionResult } from '@shared/types/workflow.types';
import { WorkflowContext } from '@shared/types/workflow-context.types';
import { v4 as uuidv4 } from 'uuid';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('fs/promises', () => ({
    readFile: vi.fn(),
    writeFile: vi.fn(),
}));

vi.mock('uuid', () => ({
    v4: vi.fn(),
}));

interface WorkflowRunnerLike {
    executeWorkflow(
        workflow: Workflow,
        initialContext?: Partial<WorkflowContext>
    ): Promise<WorkflowExecutionResult>;
    registerActionHandler: ReturnType<typeof vi.fn>;
    registerTriggerHandler: ReturnType<typeof vi.fn>;
}

const createWorkflowInput = (
    overrides?: Partial<Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>>
): Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'> => ({
    name: 'Test Workflow',
    description: 'A test workflow',
    enabled: true,
    triggers: [{ id: 'trigger-1', type: 'manual', config: {} }],
    steps: [
        {
            id: 'step-1',
            name: 'Step One',
            action: { id: 'action-1', type: 'command', config: { command: 'echo hello' } },
        },
    ],
    ...overrides,
});

describe('WorkflowService', () => {
    let service: WorkflowService;

    beforeEach(() => {
        vi.clearAllMocks();
        const missingFileError = Object.assign(new Error('not found'), { code: 'ENOENT' });
        vi.mocked(fs.readFile).mockRejectedValue(missingFileError);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(uuidv4).mockReturnValue('test-uuid-1');
        service = new WorkflowService();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createWorkflow', () => {
        it('creates a workflow with generated id and timestamps', async () => {
            const input = createWorkflowInput();
            const result = await service.createWorkflow(input);

            expect(result.id).toBe('test-uuid-1');
            expect(result.name).toBe('Test Workflow');
            expect(result.enabled).toBe(true);
            expect(result.createdAt).toBeTypeOf('number');
            expect(result.updatedAt).toBeTypeOf('number');
            expect(result.createdAt).toBe(result.updatedAt);
        });

        it('persists workflow to disk after creation', async () => {
            await service.createWorkflow(createWorkflowInput());
            expect(fs.writeFile).toHaveBeenCalledTimes(1);
        });

        it('stores workflow retrievable by getWorkflow', async () => {
            const created = await service.createWorkflow(createWorkflowInput());
            const retrieved = service.getWorkflow(created.id);
            expect(retrieved).toEqual(created);
        });

        it('creates multiple workflows with different ids', async () => {
            vi.mocked(uuidv4).mockReturnValueOnce('uuid-a').mockReturnValueOnce('uuid-b');

            const first = await service.createWorkflow(createWorkflowInput({ name: 'First' }));
            const second = await service.createWorkflow(createWorkflowInput({ name: 'Second' }));

            expect(first.id).toBe('uuid-a');
            expect(second.id).toBe('uuid-b');
            expect(service.getAllWorkflows()).toHaveLength(2);
        });

        it('rejects workflow with empty name', async () => {
            await expect(service.createWorkflow(createWorkflowInput({ name: '' }))).rejects.toThrow(
                /name must be a non-empty string/i
            );
        });

        it('rejects workflow with whitespace-only name', async () => {
            await expect(service.createWorkflow(createWorkflowInput({ name: '   ' }))).rejects.toThrow(
                /name must be a non-empty string/i
            );
        });

        it('rejects workflow when triggers is not an array', async () => {
            const input = createWorkflowInput();
            delete (input as Record<string, unknown>)['triggers'];
            await expect(
                service.createWorkflow(input as Parameters<typeof service.createWorkflow>[0])
            ).rejects.toThrow(/createWorkflow/);
        });

        it('rejects workflow when steps is not an array', async () => {
            const input = createWorkflowInput();
            delete (input as Record<string, unknown>)['steps'];
            await expect(
                service.createWorkflow(input as Parameters<typeof service.createWorkflow>[0])
            ).rejects.toThrow(/createWorkflow/);
        });

        it('allows creation with empty triggers and steps arrays', async () => {
            const result = await service.createWorkflow(
                createWorkflowInput({ triggers: [], steps: [] })
            );
            expect(result.triggers).toEqual([]);
            expect(result.steps).toEqual([]);
        });

        it('rejects workflow name exceeding 200 characters', async () => {
            const longName = 'A'.repeat(201);
            await expect(service.createWorkflow(createWorkflowInput({ name: longName }))).rejects.toThrow(
                /at most 200 characters/
            );
        });

        it('rejects workflow with oversized description', async () => {
            const longDesc = 'D'.repeat(2001);
            await expect(service.createWorkflow(createWorkflowInput({ description: longDesc }))).rejects.toThrow(
                /at most 2000 characters/
            );
        });

        it('rejects workflow with invalid trigger type', async () => {
            const input = createWorkflowInput({
                triggers: [{ id: 't1', type: 'bogus' as 'manual', config: {} }],
            });
            await expect(service.createWorkflow(input)).rejects.toThrow(/createWorkflow/);
        });

        it('rejects workflow with invalid action type in step', async () => {
            const input = createWorkflowInput({
                steps: [{
                    id: 's1',
                    name: 'Bad Step',
                    action: { id: 'a1', type: 'unknown_action' as 'command', config: {} },
                }],
            });
            await expect(service.createWorkflow(input)).rejects.toThrow(/createWorkflow/);
        });

        it('rejects workflow with duplicate step ids', async () => {
            const input = createWorkflowInput({
                steps: [
                    { id: 'dup', name: 'First', action: { id: 'a1', type: 'command', config: { command: 'echo 1' } } },
                    { id: 'dup', name: 'Second', action: { id: 'a2', type: 'command', config: { command: 'echo 2' } } },
                ],
            });
            await expect(service.createWorkflow(input)).rejects.toThrow(/unique ids/);
        });

        it('rejects workflow with duplicate trigger ids', async () => {
            const input = createWorkflowInput({
                triggers: [
                    { id: 'dup-t', type: 'manual', config: {} },
                    { id: 'dup-t', type: 'manual', config: {} },
                ],
            });
            await expect(service.createWorkflow(input)).rejects.toThrow(/unique ids/);
        });

        it('rejects workflow with step missing name', async () => {
            const input = createWorkflowInput({
                steps: [{
                    id: 's1',
                    name: '',
                    action: { id: 'a1', type: 'command', config: { command: 'echo hi' } },
                }],
            });
            await expect(service.createWorkflow(input)).rejects.toThrow(/createWorkflow/);
        });

        it('rejects workflow with step missing action id', async () => {
            const input = createWorkflowInput({
                steps: [{
                    id: 's1',
                    name: 'Step',
                    action: { id: '', type: 'command', config: { command: 'echo hi' } },
                }],
            });
            await expect(service.createWorkflow(input)).rejects.toThrow(/createWorkflow/);
        });

        it('rejects workflow with trigger missing id', async () => {
            const input = createWorkflowInput({
                triggers: [{ id: '', type: 'manual', config: {} }],
            });
            await expect(service.createWorkflow(input)).rejects.toThrow(/createWorkflow/);
        });

        it('sets INVALID_INPUT error code on validation failure', async () => {
            try {
                await service.createWorkflow(createWorkflowInput({ name: '' }));
                expect.unreachable('should have thrown');
            } catch (err) {
                expect((err as Error & { code?: string }).code).toBe(WorkflowErrorCode.INVALID_INPUT);
            }
        });

        it('rejects workflow with too many steps', async () => {
            const manySteps = Array.from({ length: 101 }, (_, i) => ({
                id: `step-${i}`,
                name: `Step ${i}`,
                action: { id: `a-${i}`, type: 'command' as const, config: { command: 'echo' } },
            }));
            await expect(service.createWorkflow(createWorkflowInput({ steps: manySteps }))).rejects.toThrow(
                /at most 100 steps/
            );
        });

        it('rejects workflow with too many triggers', async () => {
            const manyTriggers = Array.from({ length: 51 }, (_, i) => ({
                id: `trigger-${i}`,
                type: 'manual' as const,
                config: {},
            }));
            await expect(service.createWorkflow(createWorkflowInput({ triggers: manyTriggers }))).rejects.toThrow(
                /at most 50 triggers/
            );
        });
    });

    describe('updateWorkflow', () => {
        it('updates workflow fields and refreshes updatedAt', async () => {
            const created = await service.createWorkflow(createWorkflowInput());
            const originalUpdatedAt = created.updatedAt;

            // Small delay to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 5));

            const updated = await service.updateWorkflow(created.id, { name: 'Renamed' });
            expect(updated.name).toBe('Renamed');
            expect(updated.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
        });

        it('preserves id on update attempt to change it', async () => {
            const created = await service.createWorkflow(createWorkflowInput());
            const updated = await service.updateWorkflow(created.id, {
                id: 'hacked-id',
            } as Partial<Workflow>);
            expect(updated.id).toBe(created.id);
        });

        it('preserves createdAt on update', async () => {
            const created = await service.createWorkflow(createWorkflowInput());
            const updated = await service.updateWorkflow(created.id, {
                createdAt: 999999,
            } as Partial<Workflow>);
            expect(updated.createdAt).toBe(created.createdAt);
        });

        it('persists to disk after update', async () => {
            const created = await service.createWorkflow(createWorkflowInput());
            vi.mocked(fs.writeFile).mockClear();

            await service.updateWorkflow(created.id, { name: 'Updated' });
            expect(fs.writeFile).toHaveBeenCalled();
        });

        it('throws NOT_FOUND for nonexistent workflow', async () => {
            try {
                await service.updateWorkflow('nonexistent', { name: 'New' });
                expect.unreachable('should have thrown');
            } catch (err) {
                expect((err as Error).message).toContain('Workflow not found');
                expect((err as Error & { code?: string }).code).toBe(WorkflowErrorCode.NOT_FOUND);
            }
        });

        it('rejects empty id', async () => {
            await expect(service.updateWorkflow('', { name: 'New' })).rejects.toThrow(
                'id must be a non-empty string'
            );
        });

        it('rejects whitespace-only id', async () => {
            await expect(service.updateWorkflow('   ', { name: 'New' })).rejects.toThrow(
                'id must be a non-empty string'
            );
        });

        it('can toggle enabled status', async () => {
            const created = await service.createWorkflow(createWorkflowInput({ enabled: true }));
            const updated = await service.updateWorkflow(created.id, { enabled: false });
            expect(updated.enabled).toBe(false);
        });

        it('rejects update with oversized name', async () => {
            const created = await service.createWorkflow(createWorkflowInput());
            await expect(
                service.updateWorkflow(created.id, { name: 'X'.repeat(201) })
            ).rejects.toThrow(/at most 200 characters/);
        });

        it('rejects update with empty name', async () => {
            const created = await service.createWorkflow(createWorkflowInput());
            await expect(
                service.updateWorkflow(created.id, { name: '' })
            ).rejects.toThrow(/name must be a non-empty string/i);
        });

        it('rejects update with invalid trigger type', async () => {
            const created = await service.createWorkflow(createWorkflowInput());
            await expect(
                service.updateWorkflow(created.id, {
                    triggers: [{ id: 't1', type: 'invalid' as 'manual', config: {} }],
                })
            ).rejects.toThrow(/updateWorkflow/);
        });

        it('rejects update with duplicate step ids', async () => {
            const created = await service.createWorkflow(createWorkflowInput());
            await expect(
                service.updateWorkflow(created.id, {
                    steps: [
                        { id: 'dup', name: 'A', action: { id: 'a1', type: 'command', config: {} } },
                        { id: 'dup', name: 'B', action: { id: 'a2', type: 'command', config: {} } },
                    ],
                })
            ).rejects.toThrow(/unique ids/);
        });

        it('sets INVALID_INPUT error code on validation failure', async () => {
            const created = await service.createWorkflow(createWorkflowInput());
            try {
                await service.updateWorkflow(created.id, { name: '' });
                expect.unreachable('should have thrown');
            } catch (err) {
                expect((err as Error & { code?: string }).code).toBe(WorkflowErrorCode.INVALID_INPUT);
            }
        });
    });

    describe('deleteWorkflow', () => {
        it('removes workflow from internal store', async () => {
            const created = await service.createWorkflow(createWorkflowInput());
            await service.deleteWorkflow(created.id);
            expect(service.getWorkflow(created.id)).toBeUndefined();
        });

        it('persists to disk after deletion', async () => {
            const created = await service.createWorkflow(createWorkflowInput());
            vi.mocked(fs.writeFile).mockClear();

            await service.deleteWorkflow(created.id);
            expect(fs.writeFile).toHaveBeenCalledTimes(1);
        });

        it('throws NOT_FOUND for nonexistent workflow', async () => {
            try {
                await service.deleteWorkflow('nonexistent');
                expect.unreachable('should have thrown');
            } catch (err) {
                expect((err as Error).message).toContain('Workflow not found');
                expect((err as Error & { code?: string }).code).toBe(WorkflowErrorCode.NOT_FOUND);
            }
        });

        it('rejects empty id', async () => {
            await expect(service.deleteWorkflow('')).rejects.toThrow('id must be a non-empty string');
        });
    });
});

describe('WorkflowService - queries & execution', () => {
    let service: WorkflowService;

    beforeEach(() => {
        vi.clearAllMocks();
        const missingFileError = Object.assign(new Error('not found'), { code: 'ENOENT' });
        vi.mocked(fs.readFile).mockRejectedValue(missingFileError);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(uuidv4).mockReturnValue('test-uuid-1');
        service = new WorkflowService();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getWorkflow', () => {
        it('returns undefined for nonexistent id', () => {
            expect(service.getWorkflow('does-not-exist')).toBeUndefined();
        });

        it('returns undefined for empty string', () => {
            expect(service.getWorkflow('')).toBeUndefined();
        });

        it('returns undefined for whitespace-only string', () => {
            expect(service.getWorkflow('   ')).toBeUndefined();
        });

        it('returns the correct workflow by id', async () => {
            const created = await service.createWorkflow(createWorkflowInput());
            const result = service.getWorkflow(created.id);
            expect(result).toBeDefined();
            expect(result?.name).toBe('Test Workflow');
        });
    });

    describe('getAllWorkflows', () => {
        it('returns empty array initially', () => {
            expect(service.getAllWorkflows()).toEqual([]);
        });

        it('returns all created workflows', async () => {
            vi.mocked(uuidv4).mockReturnValueOnce('id-1').mockReturnValueOnce('id-2');
            await service.createWorkflow(createWorkflowInput({ name: 'WF-1' }));
            await service.createWorkflow(createWorkflowInput({ name: 'WF-2' }));

            const all = service.getAllWorkflows();
            expect(all).toHaveLength(2);
            expect(all.map(w => w.name)).toEqual(['WF-1', 'WF-2']);
        });

        it('excludes deleted workflows', async () => {
            vi.mocked(uuidv4).mockReturnValueOnce('keep-id').mockReturnValueOnce('delete-id');
            await service.createWorkflow(createWorkflowInput({ name: 'Keep' }));
            const toDelete = await service.createWorkflow(createWorkflowInput({ name: 'Delete' }));

            await service.deleteWorkflow(toDelete.id);
            expect(service.getAllWorkflows()).toHaveLength(1);
            expect(service.getAllWorkflows()[0].name).toBe('Keep');
        });
    });

    describe('getHealth', () => {
        it('reports zero when no workflows exist', () => {
            const health = service.getHealth();
            expect(health.totalWorkflows).toBe(0);
            expect(health.enabledWorkflows).toBe(0);
            expect(health.workflowIds).toEqual([]);
        });

        it('counts enabled and total workflows correctly', async () => {
            vi.mocked(uuidv4).mockReturnValueOnce('id-enabled').mockReturnValueOnce('id-disabled');
            await service.createWorkflow(createWorkflowInput({ name: 'Enabled', enabled: true }));
            await service.createWorkflow(createWorkflowInput({ name: 'Disabled', enabled: false }));

            const health = service.getHealth();
            expect(health.totalWorkflows).toBe(2);
            expect(health.enabledWorkflows).toBe(1);
            expect(health.workflowIds).toHaveLength(2);
            expect(health.workflowIds).toContain('id-enabled');
            expect(health.workflowIds).toContain('id-disabled');
        });
    });

    describe('executeWorkflow', () => {
        it('delegates to workflowRunner and returns result', async () => {
            const created = await service.createWorkflow(createWorkflowInput());
            const runner = (service as unknown as { workflowRunner: WorkflowRunnerLike }).workflowRunner;

            const executionResult: WorkflowExecutionResult = {
                workflowId: created.id,
                status: 'success',
                startTime: 100,
                endTime: 200,
                logs: ['step done'],
            };
            vi.spyOn(runner, 'executeWorkflow').mockResolvedValue(executionResult);

            const result = await service.executeWorkflow(created.id);
            expect(result).toEqual(executionResult);
        });

        it('passes context to workflowRunner', async () => {
            const created = await service.createWorkflow(createWorkflowInput());
            const runner = (service as unknown as { workflowRunner: WorkflowRunnerLike }).workflowRunner;

            const executionResult: WorkflowExecutionResult = {
                workflowId: created.id,
                status: 'success',
                startTime: 100,
                endTime: 200,
                logs: [],
            };
            const executeSpy = vi.spyOn(runner, 'executeWorkflow').mockResolvedValue(executionResult);

            const ctx: Partial<WorkflowContext> = {
                variables: { key: 'value' },
                executionMode: 'async',
                timestamp: 500,
            };
            await service.executeWorkflow(created.id, ctx);

            expect(executeSpy).toHaveBeenCalledWith(expect.objectContaining({ id: created.id }), ctx);
        });

        it('updates lastRunAt and lastRunStatus on success', async () => {
            const created = await service.createWorkflow(createWorkflowInput());
            const runner = (service as unknown as { workflowRunner: WorkflowRunnerLike }).workflowRunner;

            vi.spyOn(runner, 'executeWorkflow').mockResolvedValue({
                workflowId: created.id,
                status: 'success',
                startTime: 100,
                endTime: 999,
                logs: [],
            });

            await service.executeWorkflow(created.id);
            const workflow = service.getWorkflow(created.id);
            expect(workflow?.lastRunAt).toBe(999);
            expect(workflow?.lastRunStatus).toBe('success');
        });

        it('updates lastRunAt and lastRunStatus on failure', async () => {
            const created = await service.createWorkflow(createWorkflowInput());
            const runner = (service as unknown as { workflowRunner: WorkflowRunnerLike }).workflowRunner;

            vi.spyOn(runner, 'executeWorkflow').mockResolvedValue({
                workflowId: created.id,
                status: 'failure',
                startTime: 100,
                endTime: 500,
                logs: ['Error: something broke'],
                error: 'something broke',
            });

            const result = await service.executeWorkflow(created.id);
            expect(result.status).toBe('failure');

            const workflow = service.getWorkflow(created.id);
            expect(workflow?.lastRunAt).toBe(500);
            expect(workflow?.lastRunStatus).toBe('failure');
        });

        it('throws NOT_FOUND for nonexistent workflow', async () => {
            try {
                await service.executeWorkflow('does-not-exist');
                expect.unreachable('should have thrown');
            } catch (err) {
                expect((err as Error & { code?: string }).code).toBe(WorkflowErrorCode.NOT_FOUND);
            }
        });

        it('throws DISABLED for disabled workflow', async () => {
            const created = await service.createWorkflow(createWorkflowInput({ enabled: false }));
            try {
                await service.executeWorkflow(created.id);
                expect.unreachable('should have thrown');
            } catch (err) {
                expect((err as Error).message).toContain('Workflow is disabled');
                expect((err as Error & { code?: string }).code).toBe(WorkflowErrorCode.DISABLED);
            }
        });

        it('rejects empty id', async () => {
            await expect(service.executeWorkflow('')).rejects.toThrow('id must be a non-empty string');
        });

        it('rejects invalid context executionMode', async () => {
            const created = await service.createWorkflow(createWorkflowInput());
            await expect(
                service.executeWorkflow(created.id, { executionMode: 'bad' as 'inline' })
            ).rejects.toThrow(/executeWorkflow/);
        });

        it('sets INVALID_INPUT error code for bad context', async () => {
            const created = await service.createWorkflow(createWorkflowInput());
            try {
                await service.executeWorkflow(created.id, { executionMode: 'bad' as 'inline' });
                expect.unreachable('should have thrown');
            } catch (err) {
                expect((err as Error & { code?: string }).code).toBe(WorkflowErrorCode.INVALID_INPUT);
            }
        });
    });

    describe('triggerManualWorkflow', () => {
        it('rejects empty triggerId', () => {
            expect(() => service.triggerManualWorkflow('')).toThrow('id must be a non-empty string');
        });

        it('rejects whitespace-only triggerId', () => {
            expect(() => service.triggerManualWorkflow('   ')).toThrow('id must be a non-empty string');
        });

        it('does not throw for valid triggerId with no registered callback', () => {
            expect(() => service.triggerManualWorkflow('unregistered-trigger')).not.toThrow();
        });
    });

    describe('initialize', () => {
        it('handles missing workflows file gracefully', async () => {
            await expect(service.initialize()).resolves.not.toThrow();
            expect(service.getAllWorkflows()).toEqual([]);
        });

        it('loads workflows from disk on initialization', async () => {
            const existingWorkflows: Workflow[] = [
                {
                    id: 'loaded-1',
                    name: 'Pre-existing',
                    enabled: true,
                    triggers: [],
                    steps: [],
                    createdAt: 1000,
                    updatedAt: 1000,
                },
            ];
            vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(existingWorkflows));

            await service.initialize();
            expect(service.getAllWorkflows()).toHaveLength(1);
            expect(service.getWorkflow('loaded-1')?.name).toBe('Pre-existing');
        });

        it('handles corrupted workflows file without crashing', async () => {
            vi.mocked(fs.readFile).mockResolvedValueOnce('not valid json');
            await expect(service.initialize()).resolves.not.toThrow();
        });
    });

    describe('cleanup', () => {
        it('saves workflows to disk on cleanup', async () => {
            await service.createWorkflow(createWorkflowInput());
            vi.mocked(fs.writeFile).mockClear();

            await service.cleanup();
            expect(fs.writeFile).toHaveBeenCalledTimes(1);
        });
    });

    describe('WorkflowErrorCode enum', () => {
        it('contains all expected error codes', () => {
            expect(WorkflowErrorCode.NOT_FOUND).toBe('WORKFLOW_NOT_FOUND');
            expect(WorkflowErrorCode.DISABLED).toBe('WORKFLOW_DISABLED');
            expect(WorkflowErrorCode.INVALID_INPUT).toBe('WORKFLOW_INVALID_INPUT');
            expect(WorkflowErrorCode.SAVE_FAILED).toBe('WORKFLOW_SAVE_FAILED');
            expect(WorkflowErrorCode.LOAD_FAILED).toBe('WORKFLOW_LOAD_FAILED');
            expect(WorkflowErrorCode.EXECUTION_FAILED).toBe('WORKFLOW_EXECUTION_FAILED');
            expect(WorkflowErrorCode.STEP_NOT_FOUND).toBe('WORKFLOW_STEP_NOT_FOUND');
            expect(WorkflowErrorCode.HANDLER_NOT_FOUND).toBe('WORKFLOW_HANDLER_NOT_FOUND');
            expect(WorkflowErrorCode.STEP_FAILED).toBe('WORKFLOW_STEP_FAILED');
        });
    });

    describe('WorkflowTelemetryEvent enum', () => {
        it('contains all expected telemetry events', () => {
            expect(WorkflowTelemetryEvent.WORKFLOW_CREATED).toBe('workflow_created');
            expect(WorkflowTelemetryEvent.WORKFLOW_UPDATED).toBe('workflow_updated');
            expect(WorkflowTelemetryEvent.WORKFLOW_DELETED).toBe('workflow_deleted');
            expect(WorkflowTelemetryEvent.WORKFLOW_EXECUTED).toBe('workflow_executed');
            expect(WorkflowTelemetryEvent.WORKFLOW_EXECUTION_FAILED).toBe('workflow_execution_failed');
            expect(WorkflowTelemetryEvent.WORKFLOWS_LOADED).toBe('workflow_loaded_from_disk');
            expect(WorkflowTelemetryEvent.WORKFLOWS_SAVED).toBe('workflow_saved_to_disk');
        });
    });

    describe('WORKFLOW_PERFORMANCE_BUDGETS', () => {
        it('has positive budget values for all operations', () => {
            expect(WORKFLOW_PERFORMANCE_BUDGETS.CREATE_MS).toBeGreaterThan(0);
            expect(WORKFLOW_PERFORMANCE_BUDGETS.UPDATE_MS).toBeGreaterThan(0);
            expect(WORKFLOW_PERFORMANCE_BUDGETS.DELETE_MS).toBeGreaterThan(0);
            expect(WORKFLOW_PERFORMANCE_BUDGETS.EXECUTE_MS).toBeGreaterThan(0);
            expect(WORKFLOW_PERFORMANCE_BUDGETS.LOAD_MS).toBeGreaterThan(0);
            expect(WORKFLOW_PERFORMANCE_BUDGETS.SAVE_MS).toBeGreaterThan(0);
        });
    });
});
