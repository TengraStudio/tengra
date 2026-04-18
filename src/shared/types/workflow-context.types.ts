/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
