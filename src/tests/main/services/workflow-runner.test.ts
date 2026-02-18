import { IWorkflowActionHandler } from '@main/services/workflow/actions/action.interface';
import { WorkflowRunner } from '@main/services/workflow/workflow-runner';
import { Workflow } from '@shared/types/workflow.types';
import { WorkflowContext } from '@shared/types/workflow-context.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createWorkflow = (steps: Workflow['steps']): Workflow => ({
    id: 'workflow-runner-test',
    name: 'Workflow Runner Test',
    description: 'Runner behavior test workflow',
    enabled: true,
    triggers: [],
    steps,
    createdAt: 1,
    updatedAt: 1,
});

const createActionHandler = (
    type: IWorkflowActionHandler['type'],
    execute: IWorkflowActionHandler['execute']
): IWorkflowActionHandler => ({ type, execute });

describe('WorkflowRunner', () => {
    let runner: WorkflowRunner;

    beforeEach(() => {
        runner = new WorkflowRunner();
    });

    it('executes linked steps and follows nextStepId branching', async () => {
        const commandExecuteMock = vi.fn<IWorkflowActionHandler['execute']>().mockResolvedValue({
            command: 'ok',
        });
        const logExecuteMock = vi.fn<IWorkflowActionHandler['execute']>().mockResolvedValue(undefined);

        runner.registerActionHandler(createActionHandler('command', commandExecuteMock));
        runner.registerActionHandler(createActionHandler('log', logExecuteMock));

        const workflow = createWorkflow([
            {
                id: 'start',
                name: 'Start',
                action: { id: 'action-1', type: 'command', config: {} },
                nextStepId: 'branch-a',
            },
            {
                id: 'branch-a',
                name: 'Branch A',
                action: { id: 'action-2', type: 'log', config: {} },
            },
            {
                id: 'branch-b',
                name: 'Unused Branch',
                action: { id: 'action-3', type: 'log', config: {} },
            },
        ]);
        const initialContext: Partial<WorkflowContext> = {
            variables: { source: 'test' },
            executionMode: 'async',
            timestamp: 123,
        };

        const result = await runner.executeWorkflow(workflow, initialContext);

        expect(result.status).toBe('success');
        expect(commandExecuteMock).toHaveBeenCalledTimes(1);
        expect(logExecuteMock).toHaveBeenCalledTimes(1);
        expect(result.logs).toEqual(
            expect.arrayContaining([
                'Executing step: Start',
                'Completed step: Start',
                'Executing step: Branch A',
                'Completed step: Branch A',
            ])
        );
        expect(result.logs.join(' | ')).not.toContain('Unused Branch');

        const firstContext = commandExecuteMock.mock.calls[0]?.[1];
        const secondContext = logExecuteMock.mock.calls[0]?.[1];
        expect(firstContext?.executionMode).toBe('async');
        expect(firstContext?.timestamp).toBe(123);
        expect(firstContext?.variables).toEqual({ source: 'test' });
        expect(secondContext).toBe(firstContext);
    });

    it('returns failure when branching points to a missing step', async () => {
        const commandExecuteMock = vi.fn<IWorkflowActionHandler['execute']>().mockResolvedValue({
            command: 'ok',
        });
        runner.registerActionHandler(createActionHandler('command', commandExecuteMock));

        const workflow = createWorkflow([
            {
                id: 'start',
                name: 'Start',
                action: { id: 'action-1', type: 'command', config: {} },
                nextStepId: 'missing-step',
            },
        ]);

        const result = await runner.executeWorkflow(workflow);

        expect(result.status).toBe('failure');
        expect(result.error).toBe('Step not found: missing-step');
        expect(result.logs).toEqual(
            expect.arrayContaining([
                'Executing step: Start',
                'Completed step: Start',
                'Error: Step not found: missing-step',
            ])
        );
    });
});
