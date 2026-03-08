import * as fs from 'fs/promises';

import { WorkflowErrorCode,WorkflowService } from '@main/services/workflow/workflow.service';
import { Workflow, WorkflowExecutionResult } from '@shared/types/workflow.types';
import { WorkflowContext } from '@shared/types/workflow-context.types';
import { v4 as uuidv4 } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
}

const createWorkflowInput = (): Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'> => ({
    name: 'Daily Build',
    description: 'Run workspace checks',
    enabled: true,
    triggers: [{ id: 'manual-trigger', type: 'manual', config: {} }],
    steps: [
        {
            id: 'step-1',
            name: 'Run checks',
            action: {
                id: 'action-1',
                type: 'command',
                config: { command: 'npm run test' },
            },
        },
    ],
});

describe('WorkflowService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        const missingFileError = Object.assign(new Error('workflows file not found'), { code: 'ENOENT' });
        vi.mocked(fs.readFile).mockRejectedValue(missingFileError);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(uuidv4).mockReturnValue('workflow-1');
    });

    it('supports create -> execute -> delete lifecycle', async () => {
        const service = new WorkflowService();
        const createdWorkflow = await service.createWorkflow(createWorkflowInput());

        expect(createdWorkflow.id).toBe('workflow-1');
        expect(service.getWorkflow(createdWorkflow.id)).toEqual(createdWorkflow);
        expect(fs.writeFile).toHaveBeenCalledTimes(1);

        const workflowRunner = (service as unknown as { workflowRunner: WorkflowRunnerLike }).workflowRunner;
        const executionResult: WorkflowExecutionResult = {
            workflowId: createdWorkflow.id,
            status: 'success',
            startTime: 100,
            endTime: 250,
            logs: ['executed'],
        };
        const executeWorkflowMock = vi
            .spyOn(workflowRunner, 'executeWorkflow')
            .mockResolvedValue(executionResult);

        const runtimeContext: Partial<WorkflowContext> = {
            variables: { branch: 'main' },
            executionMode: 'async',
            timestamp: 99,
        };
        const result = await service.executeWorkflow(createdWorkflow.id, runtimeContext);

        expect(result).toEqual(executionResult);
        expect(executeWorkflowMock).toHaveBeenCalledWith(createdWorkflow, runtimeContext);
        expect(service.getWorkflow(createdWorkflow.id)?.lastRunAt).toBe(executionResult.endTime);
        expect(service.getWorkflow(createdWorkflow.id)?.lastRunStatus).toBe('success');

        await service.deleteWorkflow(createdWorkflow.id);

        expect(service.getWorkflow(createdWorkflow.id)).toBeUndefined();
        expect(fs.writeFile).toHaveBeenCalledTimes(3);
    });

    it('rejects execution for disabled workflows', async () => {
        const service = new WorkflowService();
        const disabledWorkflow = await service.createWorkflow({
            ...createWorkflowInput(),
            enabled: false,
        });
        const workflowRunner = (service as unknown as { workflowRunner: WorkflowRunnerLike }).workflowRunner;
        const executeWorkflowMock = vi.spyOn(workflowRunner, 'executeWorkflow');

        await expect(service.executeWorkflow(disabledWorkflow.id)).rejects.toThrow(
            `Workflow is disabled: ${disabledWorkflow.id}`
        );
        expect(executeWorkflowMock).not.toHaveBeenCalled();
    });

    describe('WorkflowErrorCode enum', () => {
        it('has expected error code values', () => {
            expect(WorkflowErrorCode.NOT_FOUND).toBe('WORKFLOW_NOT_FOUND');
            expect(WorkflowErrorCode.DISABLED).toBe('WORKFLOW_DISABLED');
            expect(WorkflowErrorCode.INVALID_INPUT).toBe('WORKFLOW_INVALID_INPUT');
            expect(WorkflowErrorCode.SAVE_FAILED).toBe('WORKFLOW_SAVE_FAILED');
            expect(WorkflowErrorCode.LOAD_FAILED).toBe('WORKFLOW_LOAD_FAILED');
            expect(WorkflowErrorCode.EXECUTION_FAILED).toBe('WORKFLOW_EXECUTION_FAILED');
        });
    });

    describe('createWorkflow input validation', () => {
        it('rejects workflow with empty name', async () => {
            const service = new WorkflowService();
            const input = { ...createWorkflowInput(), name: '' };
            await expect(service.createWorkflow(input)).rejects.toThrow(/name must be a non-empty string/i);
        });

        it('rejects workflow with missing triggers array', async () => {
            const service = new WorkflowService();
            const input = { ...createWorkflowInput() };
             
            delete (input as Record<string, unknown>)['triggers'];
            await expect(service.createWorkflow(input as Parameters<typeof service.createWorkflow>[0])).rejects.toThrow(
                /createWorkflow/
            );
        });

        it('rejects workflow with missing steps array', async () => {
            const service = new WorkflowService();
            const input = { ...createWorkflowInput() };
            delete (input as Record<string, unknown>)['steps'];
            await expect(service.createWorkflow(input as Parameters<typeof service.createWorkflow>[0])).rejects.toThrow(
                /createWorkflow/
            );
        });
    });

    describe('updateWorkflow input validation', () => {
        it('rejects empty id', async () => {
            const service = new WorkflowService();
            await expect(service.updateWorkflow('', { name: 'New' })).rejects.toThrow(
                'id must be a non-empty string'
            );
        });

        it('throws NOT_FOUND with error code for unknown id', async () => {
            const service = new WorkflowService();
            try {
                await service.updateWorkflow('nonexistent-id', { name: 'New' });
                expect.unreachable('should have thrown');
            } catch (err) {
                expect((err as Error).message).toContain('Workflow not found');
                expect((err as Error & { code?: string }).code).toBe(WorkflowErrorCode.NOT_FOUND);
            }
        });
    });

    describe('deleteWorkflow input validation', () => {
        it('rejects empty id', async () => {
            const service = new WorkflowService();
            await expect(service.deleteWorkflow('')).rejects.toThrow('id must be a non-empty string');
        });

        it('throws NOT_FOUND with error code for unknown id', async () => {
            const service = new WorkflowService();
            try {
                await service.deleteWorkflow('nonexistent-id');
                expect.unreachable('should have thrown');
            } catch (err) {
                expect((err as Error).message).toContain('Workflow not found');
                expect((err as Error & { code?: string }).code).toBe(WorkflowErrorCode.NOT_FOUND);
            }
        });
    });

    describe('executeWorkflow input validation', () => {
        it('rejects empty id', async () => {
            const service = new WorkflowService();
            await expect(service.executeWorkflow('')).rejects.toThrow('id must be a non-empty string');
        });

        it('throws NOT_FOUND with error code for unknown id', async () => {
            const service = new WorkflowService();
            try {
                await service.executeWorkflow('nonexistent-id');
                expect.unreachable('should have thrown');
            } catch (err) {
                expect((err as Error).message).toContain('Workflow not found');
                expect((err as Error & { code?: string }).code).toBe(WorkflowErrorCode.NOT_FOUND);
            }
        });

        it('throws DISABLED with error code for disabled workflow', async () => {
            const service = new WorkflowService();
            const workflow = await service.createWorkflow({ ...createWorkflowInput(), enabled: false });
            try {
                await service.executeWorkflow(workflow.id);
                expect.unreachable('should have thrown');
            } catch (err) {
                expect((err as Error).message).toContain('Workflow is disabled');
                expect((err as Error & { code?: string }).code).toBe(WorkflowErrorCode.DISABLED);
            }
        });
    });

    describe('getWorkflow input validation', () => {
        it('returns undefined for empty string id', () => {
            const service = new WorkflowService();
            expect(service.getWorkflow('')).toBeUndefined();
        });

        it('returns undefined for whitespace-only id', () => {
            const service = new WorkflowService();
            expect(service.getWorkflow('   ')).toBeUndefined();
        });
    });

    describe('triggerManualWorkflow input validation', () => {
        it('rejects empty triggerId', () => {
            const service = new WorkflowService();
            expect(() => service.triggerManualWorkflow('')).toThrow('id must be a non-empty string');
        });
    });
});
