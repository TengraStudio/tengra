import { ActivityLog } from '../../components/agent/ActivityStream';
import { ExecutionPlan } from '../../components/agent/ExecutionPlanView';
import { ToolExecution } from '../../components/agent/ToolTracking';

import { convertEventToActivityLog } from './eventLogConverters';

export interface StatusResponse {
    success: boolean;
    status?: {
        taskId: string;
        state: string;
        currentStep?: number;
        totalSteps?: number;
        plan?: {
            steps?: Array<{
                index?: number;
                description?: string;
                status?: string;
            }>;
        };
        error?: string | null;
        createdAt?: string;
        metrics?: {
            tokensUsed?: number;
            llmCalls?: number;
            toolCalls?: number;
            estimatedCost?: number;
        };
    };
}

export interface MessageResponse {
    success: boolean;
    messages?: Array<{
        id: string;
        role: string;
        content: string;
        timestamp: Date | string;
    }>;
}

export interface EventResponse {
    success: boolean;
    events?: Array<{
        id: string;
        type: string;
        timestamp: Date;
        payload: Record<string, unknown>;
    }>;
}

export interface TelemetryResponse {
    success: boolean;
    telemetry?: Array<{
        toolCallId: string;
        toolName: string;
        success: boolean;
        startTime: Date | string;
        endTime: Date | string | null;
        duration: number;
        error?: string;
    }>;
}

/**
 * Compute the execution plan status based on state
 */
const getExecutionPlanStatus = (
    state: string
): 'completed' | 'failed' | 'executing' => {
    if (state === 'completed') {
        return 'completed';
    }
    if (state === 'failed') {
        return 'failed';
    }
    return 'executing';
};

/**
 * Transform a step for the execution plan
 */
const transformStep = (
    step: { index?: number; description?: string; status?: string },
    idx: number
): { id: string; description: string; status: 'pending' | 'executing' | 'completed' | 'failed' } => ({
    id: String(step.index ?? idx),
    description: step.description ?? `Step ${idx + 1}`,
    status: (step.status ?? 'pending') as 'pending' | 'executing' | 'completed' | 'failed'
});

/**
 * Build execution plan from status
 */
const buildExecutionPlan = (
    taskId: string,
    state: string,
    currentStepIdx: number,
    steps: Array<{ index?: number; description?: string; status?: string }> | undefined
): ExecutionPlan | null => {
    if (!steps) {
        return null;
    }

    return {
        id: taskId,
        taskId,
        planNumber: 1,
        status: getExecutionPlanStatus(state),
        steps: steps.map(transformStep),
        currentStep: currentStepIdx,
        createdAt: new Date()
    };
};

/**
 * Create error response for status processing
 */
const createErrorResponse = () => ({
    taskId: null,
    state: 'unknown',
    progress: 0,
    currentStep: '',
    error: 'Failed to fetch status',
    currentPlan: null
});

/**
 * Extract step counts from status
 */
const extractStepCounts = (status: {
    currentStep?: number;
    totalSteps?: number;
    plan?: { steps?: Array<unknown> };
}): { currentStepIdx: number; totalSteps: number } => ({
    currentStepIdx: status.currentStep ?? 0,
    totalSteps: status.plan?.steps?.length ?? status.totalSteps ?? 1
});

/**
 * Calculate progress percentage
 */
const calculateProgress = (currentStepIdx: number, totalSteps: number): number => {
    return Math.round((currentStepIdx / totalSteps) * 100);
};

/**
 * Get current step description
 */
const getCurrentStepDescription = (
    steps: Array<{ description?: string }> | undefined,
    currentStepIdx: number
): string => {
    return steps?.[currentStepIdx]?.description ?? '';
};

/**
 * Process status response and return formatted AgentTaskStatus data
 */
export const processStatusResponse = (statusRes: StatusResponse): {
    taskId: string | null;
    state: string;
    progress: number;
    currentStep: string;
    error: string | null;
    metrics?: Record<string, number>;
    currentPlan: ExecutionPlan | null;
} => {
    if (!statusRes.success || !statusRes.status) {
        return createErrorResponse();
    }

    const status = statusRes.status;
    const { currentStepIdx, totalSteps } = extractStepCounts(status);
    const progress = calculateProgress(currentStepIdx, totalSteps);
    const currentPlan = buildExecutionPlan(status.taskId, status.state, currentStepIdx, status.plan?.steps);
    const currentStep = getCurrentStepDescription(status.plan?.steps, currentStepIdx);

    return {
        taskId: status.taskId,
        state: status.state,
        progress,
        currentStep,
        error: (status.error as string | null) ?? null,
        metrics: status.metrics,
        currentPlan
    };
};

/**
 * Process event response and convert to activity logs
 */
export const processEventResponse = (eventsRes: EventResponse): ActivityLog[] => {
    const eventLogs: ActivityLog[] = [];

    if (!eventsRes.success || !eventsRes.events) {
        return eventLogs;
    }

    for (const event of eventsRes.events) {
        const log = convertEventToActivityLog(event);
        if (log) {
            eventLogs.push(log);
        }
    }

    return eventLogs;
};

/**
 * Process message response and convert to activity logs (for backwards compatibility)
 */
export const processMessageResponse = (messagesRes: MessageResponse): ActivityLog[] => {
    const messageLogs: ActivityLog[] = [];

    if (!messagesRes.success || !messagesRes.messages) {
        return messageLogs;
    }

    return messagesRes.messages.map((m) => ({
        id: m.id,
        type: m.role === 'assistant' ? 'llm' : 'info',
        message: m.content,
        timestamp: new Date(m.timestamp)
    }));
};

/**
 * Process telemetry response and convert to tool executions
 */
export const processTelemetryResponse = (telemetryRes: TelemetryResponse): ToolExecution[] => {
    const executions: ToolExecution[] = [];

    if (!telemetryRes.success || !telemetryRes.telemetry) {
        return executions;
    }

    return telemetryRes.telemetry.map((t) => ({
        id: t.toolCallId,
        name: t.toolName,
        status: t.success ? 'completed' : 'error',
        startTime: new Date(t.startTime),
        endTime: t.endTime ? new Date(t.endTime) : undefined,
        duration: t.duration,
        error: t.error
    }));
};

/**
 * Combine and sort all activity logs by timestamp
 */
export const combineAndSortLogs = (eventLogs: ActivityLog[], messageLogs: ActivityLog[]): ActivityLog[] => {
    const allLogs = [...eventLogs, ...messageLogs];
    allLogs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return allLogs;
};
