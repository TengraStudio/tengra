import { BaseService } from '@main/services/base.service';
import { withRetry } from '@main/utils/retry.util';
import { JsonValue } from '@shared/types/common';
import { Workflow, WorkflowExecutionResult } from '@shared/types/workflow.types';
import { WorkflowContext, WorkflowStepResult } from '@shared/types/workflow-context.types';

import { IWorkflowActionHandler } from './actions/action.interface';
import { IWorkflowTriggerHandler } from './triggers/trigger.interface';
import { WorkflowError, WorkflowErrorCode } from './workflow-error';

export class WorkflowRunner extends BaseService {
    private actionHandlers: Map<string, IWorkflowActionHandler> = new Map();
    private triggerHandlers: Map<string, IWorkflowTriggerHandler> = new Map();

    constructor() {
        super('WorkflowRunner');
    }

    public registerActionHandler(handler: IWorkflowActionHandler): void {
        this.actionHandlers.set(handler.type, handler);
        this.logInfo(`Registered action handler: ${handler.type}`);
    }

    public registerTriggerHandler(handler: IWorkflowTriggerHandler): void {
        this.triggerHandlers.set(handler.type, handler);
        this.logInfo(`Registered trigger handler: ${handler.type}`);
    }

    public async executeWorkflow(
        workflow: Workflow,
        initialContext?: Partial<WorkflowContext>
    ): Promise<WorkflowExecutionResult> {
        const startTime = Date.now();
        const logs: string[] = [];
        const stepResults: WorkflowStepResult[] = [];

        // Initialize workflow context
        const context: WorkflowContext = {
            variables: {},
            timestamp: startTime,
            executionMode: 'inline', // Default to inline execution
            ...initialContext,
        };

        let currentStepId: string | undefined = workflow.steps[0]?.id;

        try {
            while (currentStepId) {
                const step = workflow.steps.find(s => s.id === currentStepId);
                if (!step) {
                    throw new WorkflowError(
                        WorkflowErrorCode.STEP_NOT_FOUND,
                        `Step not found: ${currentStepId}`
                    );
                }

                logs.push(`Executing step: ${step.name}`);
                this.logInfo(`Executing step: ${step.name} (${step.id})`);

                const handler = this.actionHandlers.get(step.action.type);
                if (!handler) {
                    throw new WorkflowError(
                        WorkflowErrorCode.HANDLER_NOT_FOUND,
                        `No handler registered for action type: ${step.action.type}`
                    );
                }

                const stepStartTime = Date.now();
                try {
                    let output: JsonValue | void;

                    if (step.retryPolicy) {
                        const policy = step.retryPolicy;
                        output = await withRetry(
                            () => handler.execute(step.action, context),
                            {
                                maxRetries: policy.maxRetries,
                                baseDelayMs: policy.baseDelayMs,
                                maxDelayMs: policy.maxDelayMs,
                                shouldRetry: () => true,
                                onRetry: (_err, attempt, delay) => {
                                    const msg = `Retrying step "${step.name}" (attempt ${attempt + 1}/${policy.maxRetries}) after ${delay}ms`;
                                    logs.push(msg);
                                    this.logInfo(msg);
                                },
                            }
                        );
                    } else {
                        output = await handler.execute(step.action, context);
                    }

                    const stepEndTime = Date.now();

                    logs.push(`Completed step: ${step.name}`);
                    stepResults.push({
                        stepId: step.id,
                        success: true,
                        output: output || undefined,
                        duration: stepEndTime - stepStartTime,
                    });
                } catch (error) {
                    const stepEndTime = Date.now();
                    const errorMessage = error instanceof Error ? error.message : String(error);

                    stepResults.push({
                        stepId: step.id,
                        success: false,
                        error: errorMessage,
                        duration: stepEndTime - stepStartTime,
                    });

                    // Non-critical steps: log and continue to the next step
                    if (step.critical === false) {
                        const fallbackMsg = `Non-critical step failed (continuing): ${step.name} - ${errorMessage}`;
                        logs.push(fallbackMsg);
                        this.logWarn(fallbackMsg);
                        currentStepId = step.nextStepId;
                        continue;
                    }

                    throw new WorkflowError(
                        WorkflowErrorCode.STEP_FAILED,
                        errorMessage
                    );
                }

                currentStepId = step.nextStepId;
            }

            const endTime = Date.now();
            return {
                workflowId: workflow.id,
                status: 'success',
                startTime,
                endTime,
                logs,
            };
        } catch (error) {
            const endTime = Date.now();
            const errorMessage = error instanceof Error ? error.message : String(error);
            logs.push(`Error: ${errorMessage}`);
            this.logError('Workflow execution failed', error);

            return {
                workflowId: workflow.id,
                status: 'failure',
                startTime,
                endTime,
                logs,
                error: errorMessage,
            };
        }
    }
}
