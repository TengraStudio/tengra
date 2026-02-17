import { JsonValue } from './common';

/**
 * Workflow execution context that persists across steps
 * Allows actions to read and write variables
 */
export interface WorkflowContext {
    /** Variables that can be read/written by workflow steps */
    variables: Record<string, JsonValue>;

    /** ID of the agent task that initiated this workflow (if any) */
    agentTaskId?: string;

    /** User ID for audit/security purposes */
    userId?: string;

    /** Timestamp when workflow execution started */
    timestamp: number;

    /** Execution mode: inline (wait) or async (fire and forget) */
    executionMode: 'inline' | 'async';
}

/**
 * Result of a single workflow step execution
 */
export interface WorkflowStepResult {
    /** ID of the step that was executed */
    stepId: string;

    /** Whether the step completed successfully */
    success: boolean;

    /** Output data from the step (stored in context) */
    output?: JsonValue;

    /** Error message if step failed */
    error?: string;

    /** Duration in milliseconds */
    duration: number;
}
