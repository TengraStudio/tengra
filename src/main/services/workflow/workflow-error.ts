/**
 * Standardized error codes and typed error class for WorkflowService.
 */

/**
 * Discriminated error codes for all workflow-related failures.
 */
export enum WorkflowErrorCode {
    NOT_FOUND = 'WORKFLOW_NOT_FOUND',
    DISABLED = 'WORKFLOW_DISABLED',
    INVALID_INPUT = 'WORKFLOW_INVALID_INPUT',
    SAVE_FAILED = 'WORKFLOW_SAVE_FAILED',
    LOAD_FAILED = 'WORKFLOW_LOAD_FAILED',
    EXECUTION_FAILED = 'WORKFLOW_EXECUTION_FAILED',
    STEP_NOT_FOUND = 'WORKFLOW_STEP_NOT_FOUND',
    HANDLER_NOT_FOUND = 'WORKFLOW_HANDLER_NOT_FOUND',
    STEP_FAILED = 'WORKFLOW_STEP_FAILED',
}

/**
 * Typed error class for workflow failures.
 * Always carries a WorkflowErrorCode for programmatic handling.
 */
export class WorkflowError extends Error {
    public readonly code: WorkflowErrorCode;

    constructor(code: WorkflowErrorCode, message: string) {
        super(message);
        this.name = 'WorkflowError';
        this.code = code;
    }
}
