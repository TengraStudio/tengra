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
 * Agent Event Types for EventBus
 * 
 * Real-time events emitted by the agent system for UI updates
 */

import {
    AgentError,
    AgentState,
    ExecutionPlan,
    ProviderConfig,
    TaskMetrics,
    ToolCallExecution
} from './agent-state';

/**
 * Agent-specific events to add to SystemEvents
 */
export interface AgentSystemEvents {
    // Task lifecycle events
    'agent:task_started': {
        taskId: string;
        workspaceId: string;
        description: string;
        currentProvider?: ProviderConfig;
    };

    'agent:task_validated': {
        taskId: string;
        workspacePath: string;
    };

    'agent:task_completed': {
        taskId: string;
        success: boolean;
        summary?: string;
        metrics?: TaskMetrics;
    };

    'agent:task_failed': {
        taskId: string;
        error: string;
        canRetry: boolean;
    };

    'agent:task_paused': {
        taskId: string;
        reason?: string;
    };

    'agent:task_resumed': {
        taskId: string;
    };

    // State transition events
    'agent:state_changed': {
        taskId: string;
        previousState: AgentState;
        newState: AgentState;
        timestamp: Date;
    };

    // Tool execution events
    'agent:tool_started': {
        taskId: string | undefined;
        toolCall?: ToolCallExecution;
        toolName?: string;
        toolCallId?: string;
    };

    'agent:tool_completed': {
        taskId: string | undefined;
        toolCallId: string;
        toolName?: string;
        success: boolean;
        duration: number;
    };

    'agent:tool_error': {
        taskId: string | undefined;
        toolCallId: string;
        toolName?: string;
        error: string;
        duration?: number;
    };

    // Provider events
    'agent:provider_changed': {
        taskId: string;
        previousProvider?: ProviderConfig;
        newProvider?: ProviderConfig;
        fromProvider?: string;
        toProvider?: string;
        reason?: 'rotation' | 'fallback' | 'user_selection';
    };

    'agent:fallback_activated': {
        taskId: string;
        fallbackProvider: string;
    };

    'agent:quota_exceeded': {
        taskId: string;
        provider: string;
        retryAfter?: number;
    };

    // LLM interaction events
    'agent:llm_request': {
        taskId: string;
        provider: string;
        model: string;
        messageCount?: number;
    };

    'agent:llm_started': {
        taskId: string;
        provider: string;
        model: string;
    };

    'agent:llm_response': {
        taskId: string;
        provider: string;
        model: string;
        duration: number;
        tokensUsed?: number;
        content?: string; // For "Thought" visibility
        metrics?: TaskMetrics;
    };

    'agent:llm_completed': {
        taskId: string;
        duration: number;
    };

    // User interaction events
    'agent:interrupt_required': {
        taskId: string;
        reason: string;
        availableModels: Array<{
            provider: string;
            model: string;
            displayName: string;
        }>;
    };

    'agent:user_intervention': {
        taskId: string;
        action: 'model_selected' | 'paused' | 'cancelled';
        details?: Record<string, RuntimeValue>;
    };

    // Error and recovery events
    'agent:error_occurred': {
        taskId: string;
        error?: AgentError;
        errorType?: string;
        message?: string;
        retryable?: boolean;
    };

    'agent:resource_error': {
        taskId: string;
        message: string;
        currentProvider: string;
        currentModel: string;
    };

    'agent:recovery_started': {
        taskId: string;
        attemptNumber: number;
        maxAttempts?: number;
    };

    'agent:recovery_succeeded': {
        taskId: string;
        attemptNumber: number;
    };

    // Progress events
    'agent:plan_created': {
        taskId: string;
        stepCount: number;
        estimatedDuration?: number;
        tools?: string[];
    };

    'agent:plan_ready': {
        taskId: string;
        plan: ExecutionPlan;
    };

    'agent:plan_awaiting_approval': {
        taskId: string;
        plan: ExecutionPlan;
    };

    'agent:plan_approved': {
        taskId: string;
    };

    'agent:plan_rejected': {
        taskId: string;
        reason?: string;
    };

    'agent:step_started': {
        taskId: string;
        stepIndex: number;
        stepDescription?: string;
        description?: string;
        thoughts?: string; // For planning reasoning
    };

    'agent:step_completed': {
        taskId: string;
        stepIndex: number;
        success?: boolean;
        description?: string;
    };

    // usageStats events (for real-time UI updates)
    'agent:usageStats_update': {
        taskId: string;
        metrics: Partial<TaskMetrics>;
    };
}

