/**
 * Type guard utilities for runtime type validation
 * Used to safely validate IPC data before casting to typed interfaces
 */

import { Message } from '../types/chat';
import { AgentStartOptions, ProjectState, ProjectStep } from '../types/project-agent';

/**
 * Valid status values for agent state
 */
const PROJECT_STATE_STATUSES = new Set([
    'idle', 'planning', 'waiting_for_approval', 'running',
    'paused', 'failed', 'completed', 'error'
]);

/**
 * Valid status values for agent step
 */
const PROJECT_STEP_STATUSES = new Set(['pending', 'running', 'completed', 'failed']);

/**
 * Valid system modes for AgentStartOptions
 */
const SYSTEM_MODES = new Set(['fast', 'thinking', 'architect']);

/**
 * Checks if a value is a non-null object
 */
function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Checks if a value is a string
 */
function isString(value: unknown): value is string {
    return typeof value === 'string';
}

/**
 * Checks if an optional string field is valid
 */
function isOptionalString(value: unknown): boolean {
    return value === undefined || isString(value);
}

/**
 * Checks if all items in an array pass a type guard
 */
function arrayOf<T>(arr: unknown[], guard: (item: unknown) => item is T): arr is T[] {
    return arr.every(guard);
}

/**
 * Validates model field in AgentStartOptions
 */
function isValidModel(model: unknown): boolean {
    return isObject(model) && isString(model.provider) && isString(model.model);
}

/**
 * Validates systemMode field in AgentStartOptions
 */
function isValidSystemMode(mode: unknown): boolean {
    return isString(mode) && SYSTEM_MODES.has(mode);
}

/**
 * Type guard for agent step (ProjectStep)
 */
export function isProjectStep(value: unknown): value is ProjectStep {
    if (!isObject(value)) {
        return false;
    }

    return (
        isString(value.id) &&
        isString(value.text) &&
        isString(value.status) &&
        PROJECT_STEP_STATUSES.has(value.status)
    );
}

/**
 * Type guard for Message (basic check)
 */
export function isMessage(value: unknown): value is Message {
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
export function isAgentStartOptions(value: unknown): value is AgentStartOptions {
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
function hasValidRequiredFields(value: Record<string, unknown>): boolean {
    // status must be valid
    if (!isString(value.status) || !PROJECT_STATE_STATUSES.has(value.status)) {
        return false;
    }

    // currentTask must be a string
    if (!isString(value.currentTask)) {
        return false;
    }

    // plan must be an array of valid agent steps
    if (!Array.isArray(value.plan) || !arrayOf(value.plan, isProjectStep)) {
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
function hasValidOptionalFields(value: Record<string, unknown>): boolean {
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
 * Type guard for agent state (ProjectState)
 * Validates the structure of incoming IPC data before casting
 */
export function isProjectState(value: unknown): value is ProjectState {
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
export function assertProjectState(value: unknown, context?: string): ProjectState {
    if (isProjectState(value)) {
        return value;
    }

    const contextMsg = context ? ` (${context})` : '';
    throw new Error(`Invalid ProjectState received${contextMsg}`);
}

/**
 * Safely converts an unknown value to agent state
 * Returns undefined if the value is not a valid agent state
 *
 * @param value - The value to convert
 * @returns agent state or undefined
 */
export function toProjectState(value: unknown): ProjectState | undefined {
    if (isProjectState(value)) {
        return value;
    }
    return undefined;
}
