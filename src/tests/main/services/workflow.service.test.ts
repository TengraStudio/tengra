import * as fs from 'fs/promises';

import { WorkflowService } from '@main/services/workflow/workflow.service';
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
    description: 'Run project checks',
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
});
