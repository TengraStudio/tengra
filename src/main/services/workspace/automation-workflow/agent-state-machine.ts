/**
 * Agent State Machine
 * 
 * Core state machine implementation using reducer pattern
 * NASA Power of Ten Compliance:
 * - Rule #1: Simple control flow (no recursion)
 * - Rule #2: Fixed loop bounds
 * - Rule #4: Short functions (≤60 lines)
 * - Rule #5: Assertions via TypeScript guards
 * - Rule #6: Minimal variable scope
 * - Rule #9: No 'any' types
 */

import { randomUUID } from 'crypto';

import { appLogger } from '@main/logging/logger';
import {
    AgentEvent,
    AgentEventRecord,
    AgentState,
    AgentStateReducer,
    AgentTaskState,
    StateTransitionGuard
} from '@shared/types/agent-state';

// ============================================================================
// Constants (NASA Rule #2: Fixed bounds)
// ============================================================================

const MAX_ITERATIONS = 100; // Maximum execution loop iterations
const MAX_RECOVERY_ATTEMPTS = 3; // Maximum self-healing attempts
const MAX_PROVIDER_ROTATIONS = 10; // Maximum provider switches per task
const MAX_EVENT_HISTORY = 1000; // Maximum events to keep in history
const MAX_MESSAGE_HISTORY = 100; // Maximum messages to keep in history
const MAX_TASK_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const RECOVERY_TIMEOUT_MS = 60 * 1000; // 1 minute timeout for recovery state

// ============================================================================
// State Transition Guards
// ============================================================================

/**
 * Validates if a state transition is allowed
 * NASA Rule #5: Assertions for validation
 */
const canTransition: StateTransitionGuard = (
    currentState: AgentState,
    event: AgentEvent,
    _context: AgentTaskState
): boolean => {
    // Define allowed transitions as a map
    const transitionMap: Record<AgentState, Set<AgentEvent['type']>> = {
        idle: new Set(['START_TASK']),
        initializing: new Set(['TASK_VALIDATED', 'TASK_FAILED', 'STOP']),
        planning: new Set(['PLAN_READY', 'LLM_ERROR', 'TASK_FAILED', 'PAUSE', 'STOP', 'LLM_REQUEST']),
        executing: new Set([
            'EXECUTE_STEP',
            'LLM_REQUEST',
            'TOOL_START',
            'TASK_COMPLETE',
            'TASK_FAILED',
            'PAUSE',
            'STOP'
        ]),
        waiting_llm: new Set(['LLM_RESPONSE', 'LLM_ERROR', 'QUOTA_EXCEEDED', 'PAUSE', 'STOP', 'RESUME']),
        waiting_tool: new Set(['TOOL_COMPLETE', 'TOOL_ERROR', 'PAUSE', 'STOP']),
        waiting_user: new Set(['USER_SELECT_MODEL', 'PAUSE', 'STOP', 'RESUME']),
        recovering: new Set(['RECOVERY_SUCCESS', 'RECOVERY_FAILED', 'TASK_FAILED', 'STOP']),
        rotating_provider: new Set(['ROTATE_PROVIDER', 'FALLBACK_REQUIRED', 'USER_INTERRUPT', 'STOP']),
        fallback: new Set(['LLM_RESPONSE', 'LLM_ERROR', 'USER_INTERRUPT', 'STOP']),
        paused: new Set(['RESUME', 'STOP']),
        completed: new Set([]),
        failed: new Set(['RESUME', 'STOP'])
    };

    return transitionMap[currentState].has(event.type);
};

// ============================================================================
// State Reducer
// ============================================================================

/**
 * Main state machine reducer
 * Processes events and transitions state
 */
export const agentStateReducer: AgentStateReducer = (
    state: AgentTaskState,
    event: AgentEvent
): AgentTaskState => {
    // Guard: Validate transition
    if (!canTransition(state.state, event, state)) {
        appLogger.warn('AgentStateMachine', `Invalid transition: ${state.state} → ${event.type}`);
        return state;
    }

    // Record event in history
    const eventRecord: AgentEventRecord = {
        id: randomUUID(),
        timestamp: new Date(),
        type: event.type,
        payload: 'payload' in event ? event.payload : undefined,
        stateBeforeTransition: state.state,
        stateAfterTransition: state.state // Will be updated after transition
    };

    // Delegate to specific handlers
    let nextState: AgentTaskState;

    if (isLifecycleEvent(event.type)) {
        nextState = handleLifecycleEvents(state, event);
    } else if (isExecutionEvent(event.type)) {
        nextState = handleExecutionEvents(state, event);
    } else if (isInteractionEvent(event.type)) {
        nextState = handleInteractionEvents(state, event);
    } else if (isRecoveryEvent(event.type)) {
        nextState = handleRecoveryEvents(state, event);
    } else {
        nextState = state;
    }

    // Update event record with new state
    eventRecord.stateAfterTransition = nextState.state;

    return finalizeTransition(nextState, eventRecord);
};

/**
 * Finalizes state transition by handling history and timeouts
 * NASA Rule #4: Short functions
 */
function finalizeTransition(state: AgentTaskState, record: AgentEventRecord): AgentTaskState {
    const newHistory = [...state.eventHistory, record];
    const truncatedEventHistory = newHistory.length > MAX_EVENT_HISTORY
        ? newHistory.slice(-MAX_EVENT_HISTORY)
        : newHistory;

    const truncatedMessageHistory = state.messageHistory.length > MAX_MESSAGE_HISTORY
        ? state.messageHistory.slice(-MAX_MESSAGE_HISTORY)
        : state.messageHistory;

    return {
        ...state,
        state: checkTaskTimeout(state),
        eventHistory: truncatedEventHistory,
        messageHistory: truncatedMessageHistory,
        updatedAt: new Date()
    };
}

function checkTaskTimeout(state: AgentTaskState): AgentState {
    // Check for overall task timeout
    if (state.startedAt && (new Date().getTime() - state.startedAt.getTime() > MAX_TASK_DURATION_MS)) {
        if (!['failed', 'completed', 'idle'].includes(state.state)) {
            appLogger.warn('AgentStateMachine', `Task ${state.taskId} timed out after ${MAX_TASK_DURATION_MS}ms`);
            return 'failed';
        }
    }

    // Check for recovery state timeout - prevent stuck in recovering
    if (state.state === 'recovering') {
        const lastEvent = state.eventHistory[state.eventHistory.length - 1];
        if (lastEvent?.timestamp) {
            const timeInRecovery = new Date().getTime() - lastEvent.timestamp.getTime();
            if (timeInRecovery > RECOVERY_TIMEOUT_MS) {
                appLogger.warn('AgentStateMachine', `Recovery timeout for task ${state.taskId} after ${RECOVERY_TIMEOUT_MS}ms`);
                return 'failed';
            }
        }
    }

    return state.state;
}

function isLifecycleEvent(type: AgentEvent['type']): boolean {
    return ['START_TASK', 'TASK_VALIDATED', 'TASK_COMPLETE', 'TASK_FAILED', 'PAUSE', 'RESUME', 'STOP'].includes(type);
}

function handleLifecycleEvents(state: AgentTaskState, event: AgentEvent): AgentTaskState {
    switch (event.type) {
        case 'START_TASK': return handleStartTask(state, event as Extract<AgentEvent, { type: 'START_TASK' }>);
        case 'TASK_VALIDATED': return handleTaskValidated(state, event as Extract<AgentEvent, { type: 'TASK_VALIDATED' }>);
        case 'TASK_COMPLETE': return handleTaskComplete(state, event as Extract<AgentEvent, { type: 'TASK_COMPLETE' }>);
        case 'TASK_FAILED': return handleTaskFailed(state, event as Extract<AgentEvent, { type: 'TASK_FAILED' }>);
        case 'PAUSE': return handlePause(state);
        case 'RESUME': return handleResume(state);
        case 'STOP': return handleStop(state);
        default: return state;
    }
}

function isExecutionEvent(type: AgentEvent['type']): boolean {
    return ['PLAN_READY', 'EXECUTE_STEP', 'LLM_REQUEST', 'LLM_RESPONSE', 'LLM_ERROR', 'TOOL_START', 'TOOL_COMPLETE', 'TOOL_ERROR'].includes(type);
}

function handleExecutionEvents(state: AgentTaskState, event: AgentEvent): AgentTaskState {
    switch (event.type) {
        case 'PLAN_READY': return handlePlanReady(state, event as Extract<AgentEvent, { type: 'PLAN_READY' }>);
        case 'EXECUTE_STEP': return handleExecuteStep(state, event as Extract<AgentEvent, { type: 'EXECUTE_STEP' }>);
        case 'LLM_REQUEST': return handleLLMRequest(state, event as Extract<AgentEvent, { type: 'LLM_REQUEST' }>);
        case 'LLM_RESPONSE': return handleLLMResponse(state, event as Extract<AgentEvent, { type: 'LLM_RESPONSE' }>);
        case 'LLM_ERROR': return handleLLMError(state, event as Extract<AgentEvent, { type: 'LLM_ERROR' }>);
        case 'TOOL_START': return handleToolStart(state, event as Extract<AgentEvent, { type: 'TOOL_START' }>);
        case 'TOOL_COMPLETE': return handleToolComplete(state, event as Extract<AgentEvent, { type: 'TOOL_COMPLETE' }>);
        case 'TOOL_ERROR': return handleToolError(state, event as Extract<AgentEvent, { type: 'TOOL_ERROR' }>);
        default: return state;
    }
}

function isInteractionEvent(type: AgentEvent['type']): boolean {
    return ['USER_INTERRUPT', 'USER_SELECT_MODEL', 'QUOTA_EXCEEDED', 'ROTATE_PROVIDER', 'FALLBACK_REQUIRED'].includes(type);
}

function handleInteractionEvents(state: AgentTaskState, event: AgentEvent): AgentTaskState {
    switch (event.type) {
        case 'USER_INTERRUPT': return handleUserInterrupt(state, event as Extract<AgentEvent, { type: 'USER_INTERRUPT' }>);
        case 'USER_SELECT_MODEL': return handleUserSelectModel(state, event as Extract<AgentEvent, { type: 'USER_SELECT_MODEL' }>);
        case 'QUOTA_EXCEEDED': return handleQuotaExceeded(state, event as Extract<AgentEvent, { type: 'QUOTA_EXCEEDED' }>);
        case 'ROTATE_PROVIDER': return handleRotateProvider(state, event as Extract<AgentEvent, { type: 'ROTATE_PROVIDER' }>);
        case 'FALLBACK_REQUIRED': return handleFallbackRequired(state, event as Extract<AgentEvent, { type: 'FALLBACK_REQUIRED' }>);
        default: return state;
    }
}

function isRecoveryEvent(type: AgentEvent['type']): boolean {
    return ['RECOVERY_ATTEMPT', 'RECOVERY_SUCCESS', 'RECOVERY_FAILED'].includes(type);
}

function handleRecoveryEvents(state: AgentTaskState, event: AgentEvent): AgentTaskState {
    switch (event.type) {
        case 'RECOVERY_ATTEMPT': return handleRecoveryAttempt(state, event as Extract<AgentEvent, { type: 'RECOVERY_ATTEMPT' }>);
        case 'RECOVERY_SUCCESS': return handleRecoverySuccess(state, event as Extract<AgentEvent, { type: 'RECOVERY_SUCCESS' }>);
        case 'RECOVERY_FAILED': return handleRecoveryFailed(state, event as Extract<AgentEvent, { type: 'RECOVERY_FAILED' }>);
        default: return state;
    }
}

// ============================================================================
// Event Handlers (NASA Rule #4: ≤60 lines each)
// ============================================================================

function handleStartTask(
    state: AgentTaskState,
    event: Extract<AgentEvent, { type: 'START_TASK' }>
): AgentTaskState {
    return {
        ...state,
        taskId: event.payload.taskId,
        workspaceId: event.payload.workspaceId,
        description: event.payload.task,
        state: 'initializing',
        startedAt: new Date()
    };
}

function handleTaskValidated(
    state: AgentTaskState,
    event: Extract<AgentEvent, { type: 'TASK_VALIDATED' }>
): AgentTaskState {
    return {
        ...state,
        context: event.payload.context,
        state: 'planning'
    };
}

function handlePlanReady(
    state: AgentTaskState,
    event: Extract<AgentEvent, { type: 'PLAN_READY' }>
): AgentTaskState {
    return {
        ...state,
        plan: event.payload.plan,
        totalSteps: event.payload.plan.steps.length,
        state: 'executing'
    };
}

function handleExecuteStep(
    state: AgentTaskState,
    event: Extract<AgentEvent, { type: 'EXECUTE_STEP' }>
): AgentTaskState {
    return {
        ...state,
        currentStep: event.payload.stepIndex,
        state: 'executing'
    };
}

function handleLLMRequest(
    state: AgentTaskState,
    _event: Extract<AgentEvent, { type: 'LLM_REQUEST' }>
): AgentTaskState {
    return {
        ...state,
        state: 'waiting_llm',
        metrics: {
            ...state.metrics,
            llmCalls: state.metrics.llmCalls + 1
        }
    };
}

function handleLLMResponse(
    state: AgentTaskState,
    event: Extract<AgentEvent, { type: 'LLM_RESPONSE' }>
): AgentTaskState {
    return {
        ...state,
        state: 'executing',
        metrics: {
            ...state.metrics,
            tokensUsed: state.metrics.tokensUsed + event.payload.response.usage.totalTokens,
            estimatedCost: (state.metrics.estimatedCost ?? 0) + (event.payload.estimatedCost ?? 0)
        }
    };
}

function handleLLMError(
    state: AgentTaskState,
    event: Extract<AgentEvent, { type: 'LLM_ERROR' }>
): AgentTaskState {
    const error = {
        id: randomUUID(),
        timestamp: new Date(),
        state: state.state,
        type: 'llm_error' as const,
        message: event.payload.error.message,
        details: { provider: event.payload.provider },
        recovered: false
    };

    // Determine next state based on error type
    if (event.payload.error.type === 'quota') {
        return {
            ...state,
            errors: [...state.errors, error],
            state: 'rotating_provider'
        };
    }

    // Resource errors (e.g., insufficient memory) require user intervention
    if (event.payload.error.type === 'resource') {
        return {
            ...state,
            errors: [...state.errors, error],
            state: 'waiting_user'
        };
    }

    if (event.payload.error.retryable && state.recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
        return {
            ...state,
            errors: [...state.errors, error],
            recoveryAttempts: state.recoveryAttempts + 1,
            state: 'recovering'
        };
    }

    return {
        ...state,
        errors: [...state.errors, error],
        state: 'failed'
    };
}

function handleToolStart(
    state: AgentTaskState,
    _event: Extract<AgentEvent, { type: 'TOOL_START' }>
): AgentTaskState {
    return {
        ...state,
        state: 'waiting_tool',
        metrics: {
            ...state.metrics,
            toolCalls: state.metrics.toolCalls + 1
        }
    };
}

function handleToolComplete(
    state: AgentTaskState,
    _event: Extract<AgentEvent, { type: 'TOOL_COMPLETE' }>
): AgentTaskState {
    return {
        ...state,
        state: 'executing'
    };
}

function handleToolError(
    state: AgentTaskState,
    event: Extract<AgentEvent, { type: 'TOOL_ERROR' }>
): AgentTaskState {
    const error = {
        id: randomUUID(),
        timestamp: new Date(),
        state: state.state,
        type: 'tool_error' as const,
        message: event.payload.error.message,
        details: { toolCallId: event.payload.toolCallId },
        recovered: false
    };

    if (event.payload.error.retryable && state.recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
        return {
            ...state,
            errors: [...state.errors, error],
            recoveryAttempts: state.recoveryAttempts + 1,
            state: 'recovering'
        };
    }

    return {
        ...state,
        errors: [...state.errors, error],
        state: 'executing' // Continue with next step
    };
}

function handleQuotaExceeded(
    state: AgentTaskState,
    _event: Extract<AgentEvent, { type: 'QUOTA_EXCEEDED' }>
): AgentTaskState {
    return {
        ...state,
        state: 'rotating_provider'
    };
}

function handleRotateProvider(
    state: AgentTaskState,
    event: Extract<AgentEvent, { type: 'ROTATE_PROVIDER' }>
): AgentTaskState {
    // Check if rotation limit reached
    if (state.providerHistory.length >= MAX_PROVIDER_ROTATIONS) {
        return {
            ...state,
            state: 'waiting_user' // Require user intervention
        };
    }

    return {
        ...state,
        currentProvider: {
            provider: event.payload.toProvider,
            model: state.currentProvider.model,
            accountIndex: 0,
            status: 'active'
        },
        state: 'executing'
    };
}

function handleFallbackRequired(
    state: AgentTaskState,
    _event: Extract<AgentEvent, { type: 'FALLBACK_REQUIRED' }>
): AgentTaskState {
    return {
        ...state,
        state: 'fallback'
    };
}

function handleUserInterrupt(
    state: AgentTaskState,
    _event: Extract<AgentEvent, { type: 'USER_INTERRUPT' }>
): AgentTaskState {
    return {
        ...state,
        state: 'waiting_user'
    };
}

function handleUserSelectModel(
    state: AgentTaskState,
    event: Extract<AgentEvent, { type: 'USER_SELECT_MODEL' }>
): AgentTaskState {
    return {
        ...state,
        currentProvider: {
            provider: event.payload.provider,
            model: event.payload.model,
            accountIndex: 0,
            status: 'active'
        },
        state: 'executing'
    };
}

function handleRecoveryAttempt(
    state: AgentTaskState,
    _event: Extract<AgentEvent, { type: 'RECOVERY_ATTEMPT' }>
): AgentTaskState {
    // Check if recovery attempts are exhausted
    if (state.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
        appLogger.warn('AgentStateMachine', `Recovery attempts exhausted (${state.recoveryAttempts}/${MAX_RECOVERY_ATTEMPTS}), transitioning to failed`);
        return {
            ...state,
            state: 'failed',
            completedAt: new Date()
        };
    }

    return {
        ...state,
        state: 'recovering'
    };
}

function handleRecoverySuccess(
    state: AgentTaskState,
    _event: Extract<AgentEvent, { type: 'RECOVERY_SUCCESS' }>
): AgentTaskState {
    // Mark last error as recovered
    const updatedErrors = state.errors.map((err, idx) =>
        idx === state.errors.length - 1 ? { ...err, recovered: true } : err
    );

    return {
        ...state,
        errors: updatedErrors,
        state: 'executing'
    };
}

function handleRecoveryFailed(
    state: AgentTaskState,
    _event: Extract<AgentEvent, { type: 'RECOVERY_FAILED' }>
): AgentTaskState {
    return {
        ...state,
        state: 'failed'
    };
}

function handleTaskComplete(
    state: AgentTaskState,
    event: Extract<AgentEvent, { type: 'TASK_COMPLETE' }>
): AgentTaskState {
    return {
        ...state,
        state: 'completed',
        completedAt: new Date(),
        metrics: {
            ...state.metrics,
            duration: new Date().getTime() - (state.startedAt?.getTime() ?? 0),
            providersUsed: Array.from(new Set(state.providerHistory.map(p => p.provider)))
        },
        result: {
            success: true,
            summary: event.payload.summary,
            artifacts: event.payload.artifacts.map(path => ({
                type: 'file_created' as const,
                path,
                description: `Created: ${path}`
            })),
            metrics: {
                ...state.metrics,
                duration: new Date().getTime() - (state.startedAt?.getTime() ?? 0),
                providersUsed: Array.from(new Set(state.providerHistory.map(p => p.provider)))
            }
        }
    };
}

function handleTaskFailed(
    state: AgentTaskState,
    event: Extract<AgentEvent, { type: 'TASK_FAILED' }>
): AgentTaskState {
    return {
        ...state,
        state: 'failed',
        completedAt: new Date(),
        metrics: {
            ...state.metrics,
            duration: new Date().getTime() - (state.startedAt?.getTime() ?? 0),
            providersUsed: Array.from(new Set(state.providerHistory.map(p => p.provider)))
        },
        result: {
            success: false,
            summary: `Task failed: ${event.payload.error}`,
            artifacts: [],
            metrics: {
                ...state.metrics,
                duration: new Date().getTime() - (state.startedAt?.getTime() ?? 0),
                providersUsed: Array.from(new Set(state.providerHistory.map(p => p.provider)))
            }
        }
    };
}

function handlePause(state: AgentTaskState): AgentTaskState {
    return {
        ...state,
        state: 'paused'
    };
}

function handleResume(state: AgentTaskState): AgentTaskState {
    // Determine target state based on current state and context
    let targetState: AgentState = 'executing';

    if (state.state === 'waiting_user' || state.state === 'paused') {
        // If paused or waiting for user, resume from where we were
        if (state.plan) {
            targetState = 'executing';
        } else {
            targetState = 'planning';
        }
    } else if (state.state === 'failed') {
        // If failed, restart from initialization
        targetState = 'initializing';
    }

    return {
        ...state,
        state: targetState
    };
}

function handleStop(state: AgentTaskState): AgentTaskState {
    appLogger.info('AgentStateMachine', `Stopping task ${state.taskId} and cleaning up resources`);
    return {
        ...state,
        state: 'idle',
        completedAt: new Date(),
        plan: null, // Cleanup resource-heavy plan on stop
        messageHistory: state.messageHistory.length > 50 ? state.messageHistory.slice(-50) : state.messageHistory // Prune history
    };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates initial agent task state
 */
export function createInitialAgentState(
    taskId: string,
    workspaceId: string
): AgentTaskState {
    const now = new Date();

    return {
        taskId,
        workspaceId,
        description: '',
        state: 'idle',
        currentStep: 0,
        totalSteps: 0,
        plan: null,
        context: {
            workspacePath: '',
            workspaceName: '',
            workspace: {
                rootPath: '',
                hasGit: false,
                hasDependencies: false
            },
            constraints: {
                maxIterations: MAX_ITERATIONS,
                maxDuration: 30 * 60 * 1000, // 30 minutes
                maxToolCalls: 500,
                allowedTools: []
            }
        },
        messageHistory: [],
        eventHistory: [],
        currentProvider: {
            provider: 'openai',
            model: 'gpt-4',
            accountIndex: 0,
            status: 'active'
        },
        providerHistory: [],
        errors: [],
        recoveryAttempts: 0,
        createdAt: now,
        updatedAt: now,
        startedAt: null,
        completedAt: null,
        metrics: {
            duration: 0,
            llmCalls: 0,
            toolCalls: 0,
            tokensUsed: 0,
            providersUsed: [],
            errorCount: 0,
            recoveryCount: 0
        },
        result: null
    };
}

/**
 * Exports
 */
export { MAX_ITERATIONS, MAX_PROVIDER_ROTATIONS, MAX_RECOVERY_ATTEMPTS, RECOVERY_TIMEOUT_MS };
