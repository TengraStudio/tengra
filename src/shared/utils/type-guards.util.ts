/**
 * Type guard utilities for runtime type validation
 * Used to safely validate IPC data before casting to typed interfaces
 */

import { Message } from '../types/chat';
import { AgentStartOptions, WorkspaceState, WorkspaceStep } from '../types/council';

/**
 * Valid status values for agent state
 */
const WORKSPACE_STATE_STATUSES = new Set([
    'idle', 'planning', 'waiting_for_approval', 'running',
    'paused', 'failed', 'completed', 'error'
]);

/**
 * Valid status values for agent step
 */
const WORKSPACE_STEP_STATUSES = new Set(['pending', 'running', 'completed', 'failed']);

/**
 * Valid system modes for AgentStartOptions
 */
const SYSTEM_MODES = new Set(['fast', 'thinking', 'architect']);

/**
 * Checks if a value is a non-null object
 */
function isObject(value: RuntimeValue): value is Record<string, RuntimeValue> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Checks if a value is a string
 */
function isString(value: RuntimeValue): value is string {
    return typeof value === 'string';
}

/**
 * Checks if an optional string field is valid
 */
function isOptionalString(value: RuntimeValue): boolean {
    return value === undefined || isString(value);
}

/**
 * Checks if all items in an array pass a type guard
 */
function arrayOf<T extends RuntimeValue>(arr: RuntimeValue[], guard: (item: RuntimeValue) => item is T): arr is T[] {
    return arr.every(guard);
}

/**
 * Validates model field in AgentStartOptions
 */
function isValidModel(model: RuntimeValue): boolean {
    return isObject(model) && isString(model.provider) && isString(model.model);
}

/**
 * Validates systemMode field in AgentStartOptions
 */
function isValidSystemMode(mode: RuntimeValue): boolean {
    return isString(mode) && SYSTEM_MODES.has(mode);
}

/**
 * Type guard for agent step (WorkspaceStep)
 */
export function isWorkspaceStep(value: RuntimeValue): value is WorkspaceStep {
    if (!isObject(value)) {
        return false;
    }

    return (
        isString(value.id) &&
        isString(value.text) &&
        isString(value.status) &&
        WORKSPACE_STEP_STATUSES.has(value.status)
    );
}

/**
 * Type guard for Message (basic check)
 */
export function isMessage(value: RuntimeValue): value is Message {
    if (!isObject(value)) {
        return false;
    }

    return (
        isString(value.id) &&
        isString(value.role) &&
        (isString(value.content) || value.content === undefined || value.content === null)
    );
}

/**
 * Type guard for AgentStartOptions
 */
export function isAgentStartOptions(value: RuntimeValue): value is AgentStartOptions {
    if (!isObject(value)) {
        return false;
    }

    // task is required
    if (!isString(value.task)) {
        return false;
    }

    // Validate optional string fields
    const optionalStringFields = ['nodeId', 'workspaceId', 'agentProfileId'];
    const allStringsValid = optionalStringFields.every(field => isOptionalString(value[field]));
    if (!allStringsValid) {
        return false;
    }

    // Validate model if present
    if (value.model !== undefined && !isValidModel(value.model)) {
        return false;
    }

    // Validate systemMode if present
    if (value.systemMode !== undefined && !isValidSystemMode(value.systemMode)) {
        return false;
    }

    return true;
}

/**
 * Validates required fields of agent state
 */
function hasValidRequiredFields(value: Record<string, RuntimeValue>): boolean {
    // status must be valid
    if (!isString(value.status) || !WORKSPACE_STATE_STATUSES.has(value.status)) {
        return false;
    }

    // currentTask must be a string
    if (!isString(value.currentTask)) {
        return false;
    }

    // plan must be an array of valid agent steps
    if (!Array.isArray(value.plan) || !arrayOf(value.plan, isWorkspaceStep)) {
        return false;
    }

    // history must be an array of valid Messages
    if (!Array.isArray(value.history) || !arrayOf(value.history, isMessage)) {
        return false;
    }

    return true;
}

/**
 * Validates optional fields of agent state
 */
function hasValidOptionalFields(value: Record<string, RuntimeValue>): boolean {
    // lastError must be string if present
    if (!isOptionalString(value.lastError)) {
        return false;
    }

    // nodeId must be string if present
    if (!isOptionalString(value.nodeId)) {
        return false;
    }

    // config must be valid AgentStartOptions if present
    if (value.config !== undefined && !isAgentStartOptions(value.config)) {
        return false;
    }

    return true;
}

/**
 * Type guard for agent state (WorkspaceState)
 * Validates the structure of incoming IPC data before casting
 */
export function isWorkspaceState(value: RuntimeValue): value is WorkspaceState {
    if (!isObject(value)) {
        return false;
    }

    return hasValidRequiredFields(value) && hasValidOptionalFields(value);
}

/**
 * Asserts that a value is a valid agent state
 * Throws an error with details if validation fails
 *
 * @param value - The value to validate
 * @param context - Optional context string for error messages
 * @returns The validated state
 * @throws Error if validation fails
 */
export function assertWorkspaceState(value: RuntimeValue, context?: string): WorkspaceState {
    if (isWorkspaceState(value)) {
        return value;
    }

    const contextMsg = context ? ` (${context})` : '';
    throw new Error(`Invalid WorkspaceState received${contextMsg}`);
}

/**
 * Safely converts an unknown value to agent state
 * Returns undefined if the value is not a valid agent state
 *
 * @param value - The value to convert
 * @returns agent state or undefined
 */
export function toWorkspaceState(value: RuntimeValue): WorkspaceState | undefined {
    if (isWorkspaceState(value)) {
        return value;
    }
    return undefined;
}
