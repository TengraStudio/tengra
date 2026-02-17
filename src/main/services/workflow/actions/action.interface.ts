import { JsonValue } from '@shared/types/common';
import { WorkflowAction } from '@shared/types/workflow.types';
import { WorkflowContext } from '@shared/types/workflow-context.types';

/**
 * Base interface for workflow action handlers
 * Actions can now access and modify the workflow context
 */
export interface IWorkflowActionHandler {
    type: string;

    /**
     * Execute the action
     * @param action - The action configuration
     * @param context - The workflow execution context (optional)
     * @returns Promise that resolves when action completes, optionally with output data
     */
    execute(action: WorkflowAction, context?: WorkflowContext): Promise<JsonValue | void>;
}
