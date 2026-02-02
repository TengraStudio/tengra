import { ActivityLog } from '../../components/agent/ActivityStream';

// Type definitions for event payloads
interface LLMRequestPayload {
    provider?: string;
}

interface LLMResponsePayload {
    response?: {
        content?: string;
        thoughts?: string;
    };
}

interface ToolStartPayload {
    toolCall?: {
        toolName?: string;
    };
}

interface ToolCompletePayload {
    toolCallId?: string;
    duration?: number;
}

interface ToolErrorPayload {
    toolCallId?: string;
    error?: {
        message?: string;
    };
}

interface LLMErrorPayload {
    error?: {
        message?: string;
    };
}

interface RotateProviderPayload {
    fromProvider?: string;
    toProvider?: string;
}

interface TaskFailedPayload {
    error?: string;
}

interface TaskCompletePayload {
    summary?: string;
}

// Handler functions for each event type
const handleLLMRequest = (baseLog: Omit<ActivityLog, 'type' | 'message'>, payload: LLMRequestPayload): ActivityLog => ({
    ...baseLog,
    type: 'llm',
    message: `🤖 Sending request to ${payload.provider ?? 'LLM'}...`
});

const handleLLMResponse = (baseLog: Omit<ActivityLog, 'type' | 'message'>, payload: LLMResponsePayload): ActivityLog => ({
    ...baseLog,
    type: 'llm',
    message: payload.response?.content ?? 'Received response from LLM',
    details: payload.response?.thoughts
});

const handleToolStart = (baseLog: Omit<ActivityLog, 'type' | 'message'>, payload: ToolStartPayload): ActivityLog => ({
    ...baseLog,
    type: 'tool',
    message: `🔧 Running tool: ${payload.toolCall?.toolName ?? 'unknown'}`
});

const handleToolComplete = (baseLog: Omit<ActivityLog, 'type' | 'message'>, payload: ToolCompletePayload): ActivityLog => ({
    ...baseLog,
    type: 'success',
    message: '✓ Tool completed',
    details: payload.duration ? `Duration: ${payload.duration}ms` : undefined
});

const handleToolError = (baseLog: Omit<ActivityLog, 'type' | 'message'>, payload: ToolErrorPayload): ActivityLog => ({
    ...baseLog,
    type: 'error',
    message: '✗ Tool failed',
    details: payload.error?.message
});

const handleLLMError = (baseLog: Omit<ActivityLog, 'type' | 'message'>, payload: LLMErrorPayload): ActivityLog => ({
    ...baseLog,
    type: 'error',
    message: `Error: ${payload.error?.message ?? 'Unknown error'}`
});

const handleRotateProvider = (baseLog: Omit<ActivityLog, 'type' | 'message'>, payload: RotateProviderPayload): ActivityLog => ({
    ...baseLog,
    type: 'info',
    message: `Switched provider: ${payload.fromProvider ?? '?'} → ${payload.toProvider ?? '?'}`
});

const handleTaskFailed = (baseLog: Omit<ActivityLog, 'type' | 'message'>, payload: TaskFailedPayload): ActivityLog => ({
    ...baseLog,
    type: 'error',
    message: `Task failed: ${payload.error ?? 'Unknown error'}`
});

const handleTaskComplete = (baseLog: Omit<ActivityLog, 'type' | 'message'>, payload: TaskCompletePayload): ActivityLog => ({
    ...baseLog,
    type: 'success',
    message: `Task completed: ${payload.summary ?? 'Done'}`
});

const handlePlanReady = (baseLog: Omit<ActivityLog, 'type' | 'message'>): ActivityLog => ({
    ...baseLog,
    type: 'success',
    message: '✓ Execution plan created'
});

// Lookup table mapping event types to handler functions
type EventHandler = (baseLog: Omit<ActivityLog, 'type' | 'message'>, payload: Record<string, unknown>) => ActivityLog;

const eventHandlers: Record<string, EventHandler> = {
    LLM_REQUEST: handleLLMRequest,
    LLM_RESPONSE: handleLLMResponse,
    TOOL_START: handleToolStart,
    TOOL_COMPLETE: handleToolComplete,
    TOOL_ERROR: handleToolError,
    LLM_ERROR: handleLLMError,
    ROTATE_PROVIDER: handleRotateProvider,
    TASK_FAILED: handleTaskFailed,
    TASK_COMPLETE: handleTaskComplete,
    PLAN_READY: handlePlanReady
};

/**
 * Simplified event type for activity log conversion
 */
export interface SimpleEventRecord {
    id: string;
    timestamp: Date;
    type: string;
    payload: unknown;
}

/**
 * Convert event record to ActivityLog for UI display
 */
export const convertEventToActivityLog = (event: SimpleEventRecord): ActivityLog | null => {
    const baseLog = {
        id: event.id,
        timestamp: event.timestamp
    };

    const handler = eventHandlers[event.type];
    if (typeof handler === 'function') {
        return handler(baseLog, event.payload as Record<string, unknown>);
    }
    // Don't log internal state transitions like TASK_VALIDATED, EXECUTE_STEP, etc.
    return null;
};
