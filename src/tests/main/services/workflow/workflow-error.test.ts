/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Unit tests for WorkflowError and WorkflowErrorCode (BACKLOG-0434)
 */
import { WorkflowError, WorkflowErrorCode } from '@main/services/workflow/workflow-error';
import { describe, expect, it } from 'vitest';

describe('WorkflowErrorCode', () => {
    it('contains all expected error codes', () => {
        expect(WorkflowErrorCode.NOT_FOUND).toBe('WORKFLOW_NOT_FOUND');
        expect(WorkflowErrorCode.DISABLED).toBe('WORKFLOW_DISABLED');
        expect(WorkflowErrorCode.INVALID_INPUT).toBe('WORKFLOW_INVALID_INPUT');
        expect(WorkflowErrorCode.SAVE_FAILED).toBe('WORKFLOW_SAVE_FAILED');
        expect(WorkflowErrorCode.LOAD_FAILED).toBe('WORKFLOW_LOAD_FAILED');
        expect(WorkflowErrorCode.EXECUTION_FAILED).toBe('WORKFLOW_EXECUTION_FAILED');
        expect(WorkflowErrorCode.STEP_NOT_FOUND).toBe('WORKFLOW_STEP_NOT_FOUND');
        expect(WorkflowErrorCode.HANDLER_NOT_FOUND).toBe('WORKFLOW_HANDLER_NOT_FOUND');
        expect(WorkflowErrorCode.STEP_FAILED).toBe('WORKFLOW_STEP_FAILED');
    });
});

describe('WorkflowError', () => {
    it('is an instance of Error', () => {
        const err = new WorkflowError(WorkflowErrorCode.NOT_FOUND, 'not found');
        expect(err).toBeInstanceOf(Error);
    });

    it('carries the correct code property', () => {
        const err = new WorkflowError(WorkflowErrorCode.DISABLED, 'disabled');
        expect(err.code).toBe(WorkflowErrorCode.DISABLED);
    });

    it('carries the correct message', () => {
        const err = new WorkflowError(WorkflowErrorCode.SAVE_FAILED, 'disk full');
        expect(err.message).toBe('disk full');
    });

    it('has name set to WorkflowError', () => {
        const err = new WorkflowError(WorkflowErrorCode.STEP_FAILED, 'step broke');
        expect(err.name).toBe('WorkflowError');
    });

    it('preserves code as readonly', () => {
        const err = new WorkflowError(WorkflowErrorCode.HANDLER_NOT_FOUND, 'missing');
        expect(err.code).toBe(WorkflowErrorCode.HANDLER_NOT_FOUND);
    });
});

