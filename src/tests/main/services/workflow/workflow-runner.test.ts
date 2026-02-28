/**
 * Unit tests for WorkflowRunner (BACKLOG-0431)
 * Covers: step execution, branching, context passing, error handling, handler registration
 */
import { IWorkflowActionHandler } from '@main/services/workflow/actions/action.interface';
import { IWorkflowTriggerHandler } from '@main/services/workflow/triggers/trigger.interface';
import { WorkflowRunner } from '@main/services/workflow/workflow-runner';
import { Workflow, WorkflowStep } from '@shared/types/workflow.types';
import { WorkflowContext } from '@shared/types/workflow-context.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createWorkflow = (steps: WorkflowStep[], overrides?: Partial<Workflow>): Workflow => ({
    id: 'wf-test',
    name: 'Test Workflow',
    description: 'Test',
    enabled: true,
    triggers: [],
    steps,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
});

const createHandler = (
    type: string,
    execute: IWorkflowActionHandler['execute'] = vi.fn().mockResolvedValue(undefined)
): IWorkflowActionHandler => ({ type, execute });

describe('WorkflowRunner', () => {
    let runner: WorkflowRunner;

    beforeEach(() => {
        runner = new WorkflowRunner();
    });

    describe('registerActionHandler', () => {
        it('registers a handler that can be used during execution', async () => {
            const executeMock = vi.fn().mockResolvedValue({ result: 'ok' });
            runner.registerActionHandler(createHandler('command', executeMock));

            const workflow = createWorkflow([
                {
                    id: 's1',
                    name: 'Run',
                    action: { id: 'a1', type: 'command', config: {} },
                },
            ]);
            const result = await runner.executeWorkflow(workflow);
            expect(result.status).toBe('success');
            expect(executeMock).toHaveBeenCalledTimes(1);
        });

        it('overwrites handler when registering same type twice', async () => {
            const firstMock = vi.fn().mockResolvedValue('first');
            const secondMock = vi.fn().mockResolvedValue('second');

            runner.registerActionHandler(createHandler('command', firstMock));
            runner.registerActionHandler(createHandler('command', secondMock));

            const workflow = createWorkflow([
                {
                    id: 's1',
                    name: 'Run',
                    action: { id: 'a1', type: 'command', config: {} },
                },
            ]);
            await runner.executeWorkflow(workflow);

            expect(firstMock).not.toHaveBeenCalled();
            expect(secondMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('registerTriggerHandler', () => {
        it('registers a trigger handler without error', () => {
            const triggerHandler: IWorkflowTriggerHandler = {
                type: 'manual',
                register: vi.fn(),
                unregister: vi.fn(),
            };
            expect(() => runner.registerTriggerHandler(triggerHandler)).not.toThrow();
        });
    });

    describe('executeWorkflow - linear steps', () => {
        it('executes a single step workflow successfully', async () => {
            const executeMock = vi.fn().mockResolvedValue('output-data');
            runner.registerActionHandler(createHandler('command', executeMock));

            const workflow = createWorkflow([
                {
                    id: 'step-1',
                    name: 'Only Step',
                    action: { id: 'a1', type: 'command', config: { command: 'ls' } },
                },
            ]);

            const result = await runner.executeWorkflow(workflow);
            expect(result.status).toBe('success');
            expect(result.workflowId).toBe('wf-test');
            expect(result.startTime).toBeLessThanOrEqual(result.endTime);
            expect(result.logs).toContain('Executing step: Only Step');
            expect(result.logs).toContain('Completed step: Only Step');
        });

        it('executes multiple linked steps in order', async () => {
            const callOrder: string[] = [];
            const mockA = vi.fn().mockImplementation(() => {
                callOrder.push('A');
                return Promise.resolve(undefined);
            });
            const mockB = vi.fn().mockImplementation(() => {
                callOrder.push('B');
                return Promise.resolve(undefined);
            });

            runner.registerActionHandler(createHandler('command', mockA));
            runner.registerActionHandler(createHandler('log', mockB));

            const workflow = createWorkflow([
                {
                    id: 'step-a',
                    name: 'Step A',
                    action: { id: 'a1', type: 'command', config: {} },
                    nextStepId: 'step-b',
                },
                {
                    id: 'step-b',
                    name: 'Step B',
                    action: { id: 'a2', type: 'log', config: {} },
                },
            ]);

            const result = await runner.executeWorkflow(workflow);
            expect(result.status).toBe('success');
            expect(callOrder).toEqual(['A', 'B']);
        });

        it('returns success with empty logs for workflow with no steps', async () => {
            const workflow = createWorkflow([]);
            const result = await runner.executeWorkflow(workflow);
            expect(result.status).toBe('success');
            expect(result.logs).toEqual([]);
        });
    });

    describe('executeWorkflow - branching', () => {
        it('follows nextStepId to branch and skips unreferenced steps', async () => {
            const executedSteps: string[] = [];
            const trackingMock = vi.fn().mockImplementation(
                (action: { config: Record<string, unknown> }) => {
                    executedSteps.push(action.config['label'] as string);
                    return Promise.resolve(undefined);
                }
            );
            runner.registerActionHandler(createHandler('command', trackingMock));

            const workflow = createWorkflow([
                {
                    id: 'start',
                    name: 'Start',
                    action: { id: 'a1', type: 'command', config: { label: 'start' } },
                    nextStepId: 'branch-a',
                },
                {
                    id: 'branch-a',
                    name: 'Branch A',
                    action: { id: 'a2', type: 'command', config: { label: 'branch-a' } },
                },
                {
                    id: 'branch-b',
                    name: 'Branch B (skipped)',
                    action: { id: 'a3', type: 'command', config: { label: 'branch-b' } },
                },
            ]);

            const result = await runner.executeWorkflow(workflow);
            expect(result.status).toBe('success');
            expect(executedSteps).toEqual(['start', 'branch-a']);
        });

        it('returns failure when nextStepId references a missing step', async () => {
            runner.registerActionHandler(createHandler('command', vi.fn().mockResolvedValue(undefined)));

            const workflow = createWorkflow([
                {
                    id: 'start',
                    name: 'Start',
                    action: { id: 'a1', type: 'command', config: {} },
                    nextStepId: 'ghost-step',
                },
            ]);

            const result = await runner.executeWorkflow(workflow);
            expect(result.status).toBe('failure');
            expect(result.error).toBe('Step not found: ghost-step');
            expect(result.logs).toContain('Error: Step not found: ghost-step');
        });
    });

    describe('executeWorkflow - context passing', () => {
        it('passes initial context to first step handler', async () => {
            const executeMock = vi.fn().mockResolvedValue(undefined);
            runner.registerActionHandler(createHandler('command', executeMock));

            const workflow = createWorkflow([
                {
                    id: 's1',
                    name: 'Step 1',
                    action: { id: 'a1', type: 'command', config: {} },
                },
            ]);

            const initialContext: Partial<WorkflowContext> = {
                variables: { env: 'test' },
                executionMode: 'async',
                timestamp: 42,
            };

            await runner.executeWorkflow(workflow, initialContext);
            const passedContext = executeMock.mock.calls[0]?.[1] as WorkflowContext;
            expect(passedContext.variables).toEqual({ env: 'test' });
            expect(passedContext.executionMode).toBe('async');
            expect(passedContext.timestamp).toBe(42);
        });

        it('shares same context object across all steps', async () => {
            const contexts: WorkflowContext[] = [];
            const trackMock = vi.fn().mockImplementation(
                (_action: unknown, ctx: WorkflowContext) => {
                    contexts.push(ctx);
                    return Promise.resolve(undefined);
                }
            );
            runner.registerActionHandler(createHandler('command', trackMock));

            const workflow = createWorkflow([
                {
                    id: 's1',
                    name: 'Step 1',
                    action: { id: 'a1', type: 'command', config: {} },
                    nextStepId: 's2',
                },
                {
                    id: 's2',
                    name: 'Step 2',
                    action: { id: 'a2', type: 'command', config: {} },
                },
            ]);

            await runner.executeWorkflow(workflow);
            expect(contexts).toHaveLength(2);
            expect(contexts[0]).toBe(contexts[1]); // Same reference
        });

        it('uses default context when none provided', async () => {
            const executeMock = vi.fn().mockResolvedValue(undefined);
            runner.registerActionHandler(createHandler('command', executeMock));

            const workflow = createWorkflow([
                {
                    id: 's1',
                    name: 'Step 1',
                    action: { id: 'a1', type: 'command', config: {} },
                },
            ]);

            await runner.executeWorkflow(workflow);
            const passedContext = executeMock.mock.calls[0]?.[1] as WorkflowContext;
            expect(passedContext.variables).toEqual({});
            expect(passedContext.executionMode).toBe('inline');
            expect(passedContext.timestamp).toBeTypeOf('number');
        });
    });
});

describe('WorkflowRunner - error handling & advanced', () => {
    let runner: WorkflowRunner;

    beforeEach(() => {
        runner = new WorkflowRunner();
    });

    describe('executeWorkflow - error handling', () => {
        it('returns failure when action handler throws', async () => {
            runner.registerActionHandler(
                createHandler('command', vi.fn().mockRejectedValue(new Error('handler exploded')))
            );

            const workflow = createWorkflow([
                {
                    id: 's1',
                    name: 'Failing Step',
                    action: { id: 'a1', type: 'command', config: {} },
                },
            ]);

            const result = await runner.executeWorkflow(workflow);
            expect(result.status).toBe('failure');
            expect(result.error).toBe('handler exploded');
            expect(result.logs).toContain('Executing step: Failing Step');
            expect(result.logs).toContain('Error: handler exploded');
        });

        it('returns failure when no handler is registered for action type', async () => {
            const workflow = createWorkflow([
                {
                    id: 's1',
                    name: 'Unhandled Step',
                    // @ts-expect-error - testing invalid action type
                    action: { id: 'a1', type: 'unknown_action', config: {} },
                },
            ]);

            const result = await runner.executeWorkflow(workflow);
            expect(result.status).toBe('failure');
            expect(result.error).toContain('No handler registered for action type: unknown_action');
        });

        it('stops execution at first failing step', async () => {
            const callOrder: string[] = [];
            const successMock = vi.fn().mockImplementation(() => {
                callOrder.push('success');
                return Promise.resolve(undefined);
            });
            const failMock = vi.fn().mockImplementation(() => {
                callOrder.push('fail');
                return Promise.reject(new Error('boom'));
            });

            runner.registerActionHandler(createHandler('command', successMock));
            runner.registerActionHandler(createHandler('log', failMock));

            const workflow = createWorkflow([
                {
                    id: 's1',
                    name: 'Good',
                    action: { id: 'a1', type: 'command', config: {} },
                    nextStepId: 's2',
                },
                {
                    id: 's2',
                    name: 'Bad',
                    action: { id: 'a2', type: 'log', config: {} },
                    nextStepId: 's3',
                },
                {
                    id: 's3',
                    name: 'Never Reached',
                    action: { id: 'a3', type: 'command', config: {} },
                },
            ]);

            const result = await runner.executeWorkflow(workflow);
            expect(result.status).toBe('failure');
            expect(callOrder).toEqual(['success', 'fail']);
        });

        it('handles non-Error thrown values gracefully', async () => {
            runner.registerActionHandler(
                createHandler('command', vi.fn().mockRejectedValue('string-error'))
            );

            const workflow = createWorkflow([
                {
                    id: 's1',
                    name: 'Step',
                    action: { id: 'a1', type: 'command', config: {} },
                },
            ]);

            const result = await runner.executeWorkflow(workflow);
            expect(result.status).toBe('failure');
            expect(result.error).toBe('string-error');
        });
    });

    describe('executeWorkflow - typed error codes', () => {
        it('uses STEP_NOT_FOUND code when nextStepId references a missing step', async () => {
            runner.registerActionHandler(createHandler('command', vi.fn().mockResolvedValue(undefined)));

            const workflow = createWorkflow([
                {
                    id: 'start',
                    name: 'Start',
                    action: { id: 'a1', type: 'command', config: {} },
                    nextStepId: 'ghost-step',
                },
            ]);

            const result = await runner.executeWorkflow(workflow);
            expect(result.status).toBe('failure');
            expect(result.error).toBe('Step not found: ghost-step');
        });

        it('uses HANDLER_NOT_FOUND code when no handler is registered', async () => {
            const workflow = createWorkflow([
                {
                    id: 's1',
                    name: 'Step',
                    // @ts-expect-error - testing invalid action type
                    action: { id: 'a1', type: 'unknown_action', config: {} },
                },
            ]);

            const result = await runner.executeWorkflow(workflow);
            expect(result.status).toBe('failure');
            expect(result.error).toContain('No handler registered for action type: unknown_action');
        });

        it('uses STEP_FAILED code when a critical step throws', async () => {
            runner.registerActionHandler(
                createHandler('command', vi.fn().mockRejectedValue(new Error('boom')))
            );

            const workflow = createWorkflow([
                {
                    id: 's1',
                    name: 'Failing Step',
                    action: { id: 'a1', type: 'command', config: {} },
                },
            ]);

            const result = await runner.executeWorkflow(workflow);
            expect(result.status).toBe('failure');
            expect(result.error).toBe('boom');
        });
    });

    describe('executeWorkflow - retry behavior', () => {
        it('retries a step according to retryPolicy and succeeds', async () => {
            const executeMock = vi.fn()
                .mockRejectedValueOnce(new Error('transient'))
                .mockResolvedValue('ok');

            runner.registerActionHandler(createHandler('command', executeMock));

            const workflow = createWorkflow([
                {
                    id: 's1',
                    name: 'Retry Step',
                    action: { id: 'a1', type: 'command', config: {} },
                    retryPolicy: { maxRetries: 2, baseDelayMs: 1 },
                },
            ]);

            const result = await runner.executeWorkflow(workflow);
            expect(result.status).toBe('success');
            expect(executeMock).toHaveBeenCalledTimes(2);
            expect(result.logs.some(l => l.includes('Retrying step'))).toBe(true);
        });

        it('fails after exhausting retries', async () => {
            const executeMock = vi.fn().mockRejectedValue(new Error('persistent'));
            runner.registerActionHandler(createHandler('command', executeMock));

            const workflow = createWorkflow([
                {
                    id: 's1',
                    name: 'Always Fails',
                    action: { id: 'a1', type: 'command', config: {} },
                    retryPolicy: { maxRetries: 2, baseDelayMs: 1 },
                },
            ]);

            const result = await runner.executeWorkflow(workflow);
            expect(result.status).toBe('failure');
            // 1 initial + 2 retries = 3 calls
            expect(executeMock).toHaveBeenCalledTimes(3);
            expect(result.error).toBe('persistent');
        });

        it('does not retry when no retryPolicy is set', async () => {
            const executeMock = vi.fn().mockRejectedValue(new Error('no-retry'));
            runner.registerActionHandler(createHandler('command', executeMock));

            const workflow = createWorkflow([
                {
                    id: 's1',
                    name: 'No Retry',
                    action: { id: 'a1', type: 'command', config: {} },
                },
            ]);

            const result = await runner.executeWorkflow(workflow);
            expect(result.status).toBe('failure');
            expect(executeMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('executeWorkflow - fallback for non-critical steps', () => {
        it('continues execution when a non-critical step fails', async () => {
            const callOrder: string[] = [];
            const successMock = vi.fn().mockImplementation(() => {
                callOrder.push('success');
                return Promise.resolve(undefined);
            });
            const failMock = vi.fn().mockImplementation(() => {
                callOrder.push('fail');
                return Promise.reject(new Error('non-critical boom'));
            });

            runner.registerActionHandler(createHandler('command', successMock));
            runner.registerActionHandler(createHandler('log', failMock));

            const workflow = createWorkflow([
                {
                    id: 's1',
                    name: 'Good Step',
                    action: { id: 'a1', type: 'command', config: {} },
                    nextStepId: 's2',
                },
                {
                    id: 's2',
                    name: 'Optional Step',
                    action: { id: 'a2', type: 'log', config: {} },
                    critical: false,
                    nextStepId: 's3',
                },
                {
                    id: 's3',
                    name: 'Final Step',
                    action: { id: 'a3', type: 'command', config: {} },
                },
            ]);

            const result = await runner.executeWorkflow(workflow);
            expect(result.status).toBe('success');
            expect(callOrder).toEqual(['success', 'fail', 'success']);
        });

        it('includes non-critical failure message in logs', async () => {
            runner.registerActionHandler(
                createHandler('command', vi.fn().mockRejectedValue(new Error('oops')))
            );

            const workflow = createWorkflow([
                {
                    id: 's1',
                    name: 'Optional',
                    action: { id: 'a1', type: 'command', config: {} },
                    critical: false,
                },
            ]);

            const result = await runner.executeWorkflow(workflow);
            expect(result.status).toBe('success');
            expect(result.logs.some(l => l.includes('Non-critical step failed'))).toBe(true);
            expect(result.logs.some(l => l.includes('oops'))).toBe(true);
        });

        it('returns success when only non-critical steps fail', async () => {
            runner.registerActionHandler(
                createHandler('command', vi.fn().mockRejectedValue(new Error('optional fail')))
            );

            const workflow = createWorkflow([
                {
                    id: 's1',
                    name: 'Non-critical Only',
                    action: { id: 'a1', type: 'command', config: {} },
                    critical: false,
                },
            ]);

            const result = await runner.executeWorkflow(workflow);
            expect(result.status).toBe('success');
        });

        it('still fails workflow when a critical step (default) fails', async () => {
            runner.registerActionHandler(
                createHandler('command', vi.fn().mockRejectedValue(new Error('critical fail')))
            );

            const workflow = createWorkflow([
                {
                    id: 's1',
                    name: 'Critical Step',
                    action: { id: 'a1', type: 'command', config: {} },
                    // critical defaults to true (undefined)
                },
            ]);

            const result = await runner.executeWorkflow(workflow);
            expect(result.status).toBe('failure');
            expect(result.error).toBe('critical fail');
        });

        it('combines retry and fallback: non-critical step retries then continues', async () => {
            const executeMock = vi.fn().mockRejectedValue(new Error('stubborn'));
            runner.registerActionHandler(createHandler('log', executeMock));

            const successMock = vi.fn().mockResolvedValue('done');
            runner.registerActionHandler(createHandler('command', successMock));

            const workflow = createWorkflow([
                {
                    id: 's1',
                    name: 'Retry Then Skip',
                    action: { id: 'a1', type: 'log', config: {} },
                    critical: false,
                    retryPolicy: { maxRetries: 1, baseDelayMs: 1 },
                    nextStepId: 's2',
                },
                {
                    id: 's2',
                    name: 'After Fallback',
                    action: { id: 'a2', type: 'command', config: {} },
                },
            ]);

            const result = await runner.executeWorkflow(workflow);
            expect(result.status).toBe('success');
            // 1 initial + 1 retry = 2 calls for the failing step
            expect(executeMock).toHaveBeenCalledTimes(2);
            expect(successMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('executeWorkflow - timing', () => {
        it('records startTime before endTime', async () => {
            runner.registerActionHandler(createHandler('command', vi.fn().mockResolvedValue(undefined)));

            const workflow = createWorkflow([
                {
                    id: 's1',
                    name: 'Step',
                    action: { id: 'a1', type: 'command', config: {} },
                },
            ]);

            const result = await runner.executeWorkflow(workflow);
            expect(result.startTime).toBeLessThanOrEqual(result.endTime);
        });
    });
});
