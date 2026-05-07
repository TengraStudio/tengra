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
 * Workspace Agent State Machine Types
 * 
 * NASA Power of Ten Compliance:
 * - Rule #6: Minimal variable scope
 * - Rule #8: Simple type definitions
 * - Rule #9: No 'any' types
 */

import { Message } from './chat';

// ============================================================================
// Core State Types
// ============================================================================

/**
 * Agent execution states
 * 
 * State Transition Flow:
 * idle → initializing → planning → executing → (completed | failed)
 *                                    ↓
 *              (waiting_llm | waiting_tool | waiting_user | recovering | rotating_provider | fallback)
 */
export type AgentState =
    | 'idle'              // No task running, ready to accept new task
    | 'initializing'      // Validating task, loading context
    | 'planning'          // Agent creating execution plan
    | 'executing'         // Actively executing plan steps
    | 'waiting_llm'       // Awaiting LLM response
    | 'waiting_tool'      // Awaiting tool execution completion
    | 'waiting_user'      // User interrupt - awaiting manual intervention
    | 'recovering'        // Self-healing from transient error
    | 'rotating_provider' // Switching to next provider/key
    | 'fallback'          // Using fallback model (cloud → local)
    | 'paused'            // User paused execution
    | 'completed'         // Task successfully finished
    | 'failed';           // Terminal failure, cannot recover

/**
 * Provider rotation status
 */
export type ProviderStatus = 'active' | 'quota_exceeded' | 'error' | 'unavailable';

/**
 * Tool execution status for usageStats
 */
export type ToolExecutionStatus = 'pending' | 'running' | 'success' | 'error' | 'cancelled';

// ============================================================================
// Event Types (State Machine Events)
// ============================================================================

export type AgentEvent =
    | { type: 'START_TASK'; payload: { taskId: string; task: string; workspaceId: string } }
    | { type: 'TASK_VALIDATED'; payload: { context: AgentContext } }
    | { type: 'PLAN_READY'; payload: { plan: ExecutionPlan } }
    | { type: 'PLAN_APPROVED'; payload: { taskId: string } }
    | { type: 'PLAN_REJECTED'; payload: { taskId: string; reason?: string } }
    | { type: 'EXECUTE_STEP'; payload: { stepIndex: number } }
    | { type: 'LLM_REQUEST'; payload: { messages: Message[]; provider: string; model: string } }
    | { type: 'LLM_RESPONSE'; payload: { response: LLMResponse; duration: number; estimatedCost?: number } }
    | { type: 'LLM_ERROR'; payload: { error: LLMError; provider: string } }
    | { type: 'TOOL_START'; payload: { toolCall: ToolCallExecution } }
    | { type: 'TOOL_COMPLETE'; payload: { toolCallId: string; result: ToolResult; duration: number } }
    | { type: 'TOOL_ERROR'; payload: { toolCallId: string; error: ToolError } }
    | { type: 'QUOTA_EXCEEDED'; payload: { provider: string; retryAfter?: number } }
    | { type: 'ROTATE_PROVIDER'; payload: { fromProvider: string; toProvider: string } }
    | { type: 'FALLBACK_REQUIRED'; payload: { reason: string; availableProviders: string[] } }
    | { type: 'USER_INTERRUPT'; payload: { reason: string; availableModels: ModelOption[] } }
    | { type: 'USER_SELECT_MODEL'; payload: { provider: string; model: string } }
    | { type: 'RECOVERY_ATTEMPT'; payload: { attemptNumber: number; maxAttempts: number } }
    | { type: 'RECOVERY_SUCCESS' }
    | { type: 'RECOVERY_FAILED'; payload: { error: string } }
    | { type: 'TASK_COMPLETE'; payload: { summary: string; artifacts: string[] } }
    | { type: 'TASK_FAILED'; payload: { error: string; canRetry: boolean } }
    | { type: 'PAUSE' }
    | { type: 'RESUME' }
    | { type: 'STOP' };

// ============================================================================
// Data Structures
// ============================================================================

/**
 * Main agent task state
 */
export interface AgentTaskState {
    // Identity
    taskId: string;
    workspaceId: string;

    // Task details
    description: string;

    // State machine
    state: AgentState;
    currentStep: number;
    totalSteps: number;

    // Execution data
    plan: ExecutionPlan | null;
    context: AgentContext;

    // History
    messageHistory: Message[];
    eventHistory: AgentEventRecord[];

    // Provider tracking
    currentProvider: ProviderConfig;
    providerHistory: ProviderAttempt[];

    // Error tracking
    errors: AgentError[];
    recoveryAttempts: number;

    // Metadata
    createdAt: Date;
    updatedAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;

    // Metrics
    metrics: TaskMetrics;

    // Results
    result: TaskResult | null;
}

/**
 * Execution plan created by the agent
 */
export interface ExecutionPlan {
    steps: PlanStep[];
    estimatedDuration?: number; // milliseconds
    requiredTools: string[];
    dependencies: string[]; // External dependencies needed
}

/**
 * Individual step in execution plan
 */
export interface PlanStep {
    index: number;
    description: string;
    type: 'analysis' | 'code_generation' | 'refactoring' | 'testing' | 'documentation' | 'deployment';
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
    toolsUsed: string[];
    thoughts?: string; // Optional reasoning for this step
    startedAt?: Date;
    completedAt?: Date;
}

/**
 * Agent execution context
 */
export interface AgentContext {
    workspacePath: string;
    workspaceName: string;
    workspace: {
        rootPath: string;
        gitRoot?: string;
        hasGit: boolean;
        hasDependencies: boolean;
    };
    constraints: {
        maxIterations: number; // NASA Rule #2: Fixed loop bounds
        maxDuration: number; // milliseconds
        maxToolCalls: number;
        allowedTools: string[];
    };
    uploadedFiles?: Array<{ path: string; name: string; type: 'file' | 'image'; content?: string }>;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
    provider: string; // 'openai', 'anthropic', 'google', 'ollama', etc.
    model: string;
    accountIndex: number; // For multi-account rotation
    status: ProviderStatus;
}

/**
 * Provider attempt record
 */
export interface ProviderAttempt {
    provider: string;
    model: string;
    accountIndex: number;
    startedAt: Date;
    endedAt?: Date;
    status: 'success' | 'quota_exceeded' | 'error' | 'timeout';
    error?: string;
    requestCount: number;
}

/**
 * Model selection option for user interrupt
 */
export interface ModelOption {
    provider: string;
    model: string;
    displayName: string;
    type: 'cloud' | 'local';
    available: boolean;
    quotaRemaining?: number;
}

/**
 * LLM Response
 */
export interface LLMResponse {
    content: string;
    toolCalls: ToolCallExecution[];
    finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

/**
 * LLM Error
 */
export interface LLMError {
    type: 'quota' | 'network' | 'auth' | 'timeout' | 'invalid_request' | 'server_error' | 'resource';
    message: string;
    statusCode?: number;
    retryable: boolean;
    retryAfter?: number; // milliseconds
}

/**
 * Tool call execution tracking
 */
export interface ToolCallExecution {
    id: string;
    name: string;
    arguments: Record<string, RuntimeValue>;
    status: ToolExecutionStatus;
    startedAt?: Date;
    completedAt?: Date;
    duration?: number; // milliseconds
}

/**
 * Tool execution result
 */
export interface ToolResult {
    success: boolean;
    data?: RuntimeValue;
    error?: string;
}

/**
 * Tool execution error
 */
export interface ToolError {
    message: string;
    code?: string;
    retryable: boolean;
}

/**
 * Agent error record
 */
export interface AgentError {
    id: string;
    timestamp: Date;
    state: AgentState;
    type: 'llm_error' | 'tool_error' | 'validation_error' | 'system_error';
    message: string;
    details?: Record<string, RuntimeValue>;
    recovered: boolean;
}

/**
 * Event record for audit trail
 */
export interface AgentEventRecord {
    id: string;
    timestamp: Date;
    type: AgentEvent['type'];
    payload: RuntimeValue;
    stateBeforeTransition: AgentState;
    stateAfterTransition: AgentState;
}

/**
 * Task execution result
 */
export interface TaskResult {
    success: boolean;
    summary: string;
    artifacts: TaskArtifact[];
    metrics: TaskMetrics;
}

/**
 * Task artifact (file created/modified)
 */
export interface TaskArtifact {
    type: 'file_created' | 'file_modified' | 'file_deleted' | 'command_executed';
    path?: string;
    description: string;
}

/**
 * Task execution metrics
 */
export interface TaskMetrics {
    duration: number; // milliseconds
    llmCalls: number;
    toolCalls: number;
    tokensUsed: number;
    providersUsed: string[];
    errorCount: number;
    recoveryCount: number;
    estimatedCost?: number;
}

// ============================================================================
// State Machine Reducer Type
// ============================================================================

/**
 * State machine reducer function type
 */
export type AgentStateReducer = (
    state: AgentTaskState,
    event: AgentEvent
) => AgentTaskState;

/**
 * State transition guard (validation before transition)
 */
export type StateTransitionGuard = (
    currentState: AgentState,
    event: AgentEvent,
    context: AgentTaskState
) => boolean;

