/**
 * Integration and regression tests for WorkflowService (BACKLOG-0432)
 * Covers: full CRUD lifecycle, execute flow, health tracking,
 * concurrent operations, disk persistence, and regression scenarios.
 */
import * as fs from 'fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    app: { getPath: vi.fn().mockReturnValue('/mock/userData') }
}));

vi.mock('fs/promises', () => ({
    readFile: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

import {
    WORKFLOW_PERFORMANCE_BUDGETS,
    WorkflowErrorCode,
    WorkflowService,
    WorkflowTelemetryEvent,
} from '@main/services/workflow/workflow.service';
import { Workflow, WorkflowExecutionResult } from '@shared/types/workflow.types';
import { WorkflowContext } from '@shared/types/workflow-context.types';

interface WorkflowRunnerLike {
    executeWorkflow(
        workflow: Workflow,
        initialContext?: Partial<WorkflowContext>
    ): Promise<WorkflowExecutionResult>;
    registerActionHandler: ReturnType<typeof vi.fn>;
    registerTriggerHandler: ReturnType<typeof vi.fn>;
}

const validInput = (
    overrides?: Partial<Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>>
): Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'> => ({
    name: 'Integration Workflow',
    description: 'Test',
    enabled: true,
    triggers: [{ id: 't1', type: 'manual', config: {} }],
    steps: [{ id: 's1', name: 'Step 1', action: { id: 'a1', type: 'command', config: { command: 'echo ok' } } }],
    ...overrides,
});

describe('WorkflowService Integration', () => {
    let service: WorkflowService;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.mocked(fs.readFile).mockRejectedValue(Object.assign(new Error('not found'), { code: 'ENOENT' }));
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        service = new WorkflowService();
        await service.initialize();
    });

    afterEach(async () => {
        await service.cleanup();
    });

    it('starts with no workflows and reports empty health', () => {
        expect(service.getAllWorkflows()).toHaveLength(0);
        const health = service.getHealth();
        expect(health.totalWorkflows).toBe(0);
        expect(health.enabledWorkflows).toBe(0);
    });

    it('full CRUD lifecycle: create → read → update → execute → delete', async () => {
        const created = await service.createWorkflow(validInput());
        expect(created.id).toBeTruthy();
        expect(service.getWorkflow(created.id)).toEqual(created);

        const updated = await service.updateWorkflow(created.id, { name: 'Renamed' });
        expect(updated.name).toBe('Renamed');
        expect(updated.id).toBe(created.id);

        const runner = (service as unknown as { workflowRunner: WorkflowRunnerLike }).workflowRunner;
        vi.spyOn(runner, 'executeWorkflow').mockResolvedValue({
            workflowId: created.id, status: 'success', startTime: 100, endTime: 200, logs: [],
        });
        const result = await service.executeWorkflow(created.id);
        expect(result.status).toBe('success');

        const afterExec = service.getWorkflow(created.id);
        expect(afterExec?.lastRunStatus).toBe('success');
        expect(afterExec?.lastRunAt).toBe(200);

        await service.deleteWorkflow(created.id);
        expect(service.getWorkflow(created.id)).toBeUndefined();
        expect(service.getAllWorkflows()).toHaveLength(0);
    });

    it('health tracks enabled/disabled workflows accurately', async () => {
        await service.createWorkflow(validInput({ name: 'A', enabled: true }));
        await service.createWorkflow(validInput({ name: 'B', enabled: false }));
        await service.createWorkflow(validInput({ name: 'C', enabled: true }));

        const health = service.getHealth();
        expect(health.totalWorkflows).toBe(3);
        expect(health.enabledWorkflows).toBe(2);
        expect(health.workflowIds).toHaveLength(3);
    });

    it('loads pre-existing workflows from disk on initialize', async () => {
        const existing: Workflow[] = [{
            id: 'disk-1', name: 'Disk WF', enabled: true,
            triggers: [], steps: [], createdAt: 1, updatedAt: 1,
        }];
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existing));

        const fresh = new WorkflowService();
        await fresh.initialize();
        expect(fresh.getAllWorkflows()).toHaveLength(1);
        expect(fresh.getWorkflow('disk-1')?.name).toBe('Disk WF');
    });

    it('persists every mutation to disk', async () => {
        vi.mocked(fs.writeFile).mockClear();
        const created = await service.createWorkflow(validInput());
        expect(fs.writeFile).toHaveBeenCalled();

        vi.mocked(fs.writeFile).mockClear();
        await service.updateWorkflow(created.id, { name: 'X' });
        expect(fs.writeFile).toHaveBeenCalled();

        vi.mocked(fs.writeFile).mockClear();
        await service.deleteWorkflow(created.id);
        expect(fs.writeFile).toHaveBeenCalled();
    });

    describe('regression: error codes on all failure paths', () => {
        it('create with invalid input returns INVALID_INPUT code', async () => {
            try {
                await service.createWorkflow(validInput({ name: '' }));
                expect.unreachable('should throw');
            } catch (err) {
                expect((err as Error & { code: string }).code).toBe(WorkflowErrorCode.INVALID_INPUT);
            }
        });

        it('update on missing workflow returns NOT_FOUND code', async () => {
            try {
                await service.updateWorkflow('ghost-id', { name: 'X' });
                expect.unreachable('should throw');
            } catch (err) {
                expect((err as Error & { code: string }).code).toBe(WorkflowErrorCode.NOT_FOUND);
            }
        });

        it('execute on disabled workflow returns DISABLED code', async () => {
            const wf = await service.createWorkflow(validInput({ enabled: false }));
            try {
                await service.executeWorkflow(wf.id);
                expect.unreachable('should throw');
            } catch (err) {
                expect((err as Error & { code: string }).code).toBe(WorkflowErrorCode.DISABLED);
            }
        });

        it('delete on missing workflow returns NOT_FOUND code', async () => {
            try {
                await service.deleteWorkflow('ghost-id');
                expect.unreachable('should throw');
            } catch (err) {
                expect((err as Error & { code: string }).code).toBe(WorkflowErrorCode.NOT_FOUND);
            }
        });
    });

    describe('regression: id immutability and timestamp integrity', () => {
        it('update cannot overwrite id or createdAt', async () => {
            const created = await service.createWorkflow(validInput());
            const updated = await service.updateWorkflow(created.id, {
                id: 'hacked', createdAt: 0,
            } as Partial<Workflow>);
            expect(updated.id).toBe(created.id);
            expect(updated.createdAt).toBe(created.createdAt);
        });

        it('updatedAt advances on each update', async () => {
            const created = await service.createWorkflow(validInput());
            await new Promise(r => setTimeout(r, 5));
            const updated = await service.updateWorkflow(created.id, { name: 'V2' });
            expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
        });
    });

    describe('exports and constants', () => {
        it('exports all WorkflowErrorCode values', () => {
            const codes = Object.values(WorkflowErrorCode);
            expect(codes).toHaveLength(9);
            expect(codes).toContain('WORKFLOW_NOT_FOUND');
            expect(codes).toContain('WORKFLOW_STEP_FAILED');
        });

        it('exports all WorkflowTelemetryEvent values', () => {
            const events = Object.values(WorkflowTelemetryEvent);
            expect(events).toHaveLength(7);
            expect(events).toContain('workflow_created');
        });

        it('performance budgets are all positive numbers', () => {
            for (const value of Object.values(WORKFLOW_PERFORMANCE_BUDGETS)) {
                expect(value).toBeGreaterThan(0);
            }
        });
    });
});
