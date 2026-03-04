/**
 * Async handlers for agent task operations.
 */

import { AgentEventRecord } from '@shared/types/agent-state';
import { ProjectState } from '@shared/types/project-agent';

import { EventResponse, MessageResponse, StatusResponse, TelemetryResponse } from './taskDetailsProcessor';

const getWorkspaceAgentBridge = () => window.electron.projectAgent;

export interface IpcInvokeResult {
    success: boolean;
    error?: string;
}

const mapProjectStepStatus = (
    status: string | undefined
): 'pending' | 'executing' | 'completed' | 'failed' => {
    if (status === 'running') {
        return 'executing';
    }
    if (status === 'completed') {
        return 'completed';
    }
    if (status === 'failed' || status === 'error') {
        return 'failed';
    }
    return 'pending';
};

const mapProjectStatusToUiState = (status: ProjectState['status']): string => {
    if (status === 'waiting_for_approval') {
        return 'waiting_approval';
    }
    if (status === 'running') {
        return 'executing';
    }
    return status;
};

const buildStatusResponse = (taskId: string, status: ProjectState): StatusResponse => {
    const runningIndex = status.plan.findIndex(step => step.status === 'running');
    const currentStep = runningIndex >= 0 ? runningIndex : 0;
    const totalSteps = status.plan.length;

    return {
        success: true,
        status: {
            taskId: status.taskId ?? taskId,
            state: mapProjectStatusToUiState(status.status),
            currentStep,
            totalSteps,
            plan: {
                steps: status.plan.map((step, index) => ({
                    index,
                    description: step.text,
                    status: mapProjectStepStatus(step.status),
                })),
            },
            error: status.lastError ?? null,
        },
    };
};

const buildMessagesResponse = (status: ProjectState): MessageResponse => {
    return {
        success: true,
        messages: status.history.map(message => ({
            id: message.id,
            role: message.role,
            content: typeof message.content === 'string' ? message.content : '',
            timestamp: message.timestamp,
        })),
    };
};

const buildEventsResponse = (
    eventsResponse: { success: boolean; events?: AgentEventRecord[] }
): EventResponse => {
    return {
        success: eventsResponse.success,
        events: (eventsResponse.events ?? []).map(event => ({
            id: event.id,
            type: event.type,
            timestamp: event.timestamp,
            payload:
                typeof event.payload === 'object' &&
                event.payload !== null &&
                !Array.isArray(event.payload)
                    ? (event.payload as Record<string, unknown>)
                    : {},
        })),
    };
};

/**
 * Pause a running task.
 */
export const pauseTaskHandler = async (taskId: string): Promise<void> => {
    await getWorkspaceAgentBridge().pauseTask(taskId);
};

/**
 * Stop a running task.
 */
export const stopTaskHandler = async (taskId: string): Promise<void> => {
    await getWorkspaceAgentBridge().stop(taskId);
};

/**
 * Save a snapshot of the current task.
 */
export const saveSnapshotHandler = async (taskId: string): Promise<boolean> => {
    const result = await getWorkspaceAgentBridge().saveSnapshot(taskId);
    return result.success;
};

/**
 * Resume a paused task.
 */
export const resumeTaskHandler = async (taskId: string): Promise<IpcInvokeResult> => {
    return await getWorkspaceAgentBridge().resumeTask(taskId);
};

/**
 * Resume from a checkpoint.
 */
export const resumeCheckpointHandler = async (checkpointId: string): Promise<IpcInvokeResult> => {
    try {
        await window.electron.invoke('project:resume-checkpoint', checkpointId);
        return { success: true };
    } catch (error) {
        window.electron.log.error('Failed to resume checkpoint:', error as Error);
        return {
            success: false,
            error: 'Failed to resume checkpoint',
        };
    }
};

/**
 * Approve an execution plan.
 */
export const approvePlanHandler = async (taskId: string): Promise<boolean> => {
    const result = await getWorkspaceAgentBridge().approveCurrentPlan(taskId);
    if (!result.success) {
        window.electron.log.error('Failed to approve plan:', result.error ?? 'Unknown error');
    }
    return result.success;
};

/**
 * Reject an execution plan with optional reason.
 */
export const rejectPlanHandler = async (taskId: string, reason?: string): Promise<boolean> => {
    const result = await getWorkspaceAgentBridge().rejectCurrentPlan(taskId, reason);
    if (!result.success) {
        window.electron.log.error('Failed to reject plan:', result.error ?? 'Unknown error');
    }
    return result.success;
};

/**
 * Approve a specific step (AGT-HIL-01).
 */
export const approveStepHandler = async (taskId: string, stepId: string): Promise<void> => {
    await getWorkspaceAgentBridge().approveStep(taskId, stepId);
};

/**
 * Skip a specific step (AGT-HIL-03).
 */
export const skipStepHandler = async (taskId: string, stepId: string): Promise<void> => {
    await getWorkspaceAgentBridge().skipStep(taskId, stepId);
};

/**
 * Edit a specific step text (AGT-HIL-02).
 */
export const editStepHandler = async (
    taskId: string,
    stepId: string,
    text: string
): Promise<void> => {
    await getWorkspaceAgentBridge().editStep(taskId, stepId, text);
};

/**
 * Add a comment to a step (AGT-HIL-05).
 */
export const addStepCommentHandler = async (
    taskId: string,
    stepId: string,
    comment: string
): Promise<void> => {
    await getWorkspaceAgentBridge().addStepComment(taskId, stepId, comment);
};

/**
 * Insert a manual intervention point (AGT-HIL-04).
 */
export const insertInterventionHandler = async (
    taskId: string,
    afterStepId: string
): Promise<void> => {
    await getWorkspaceAgentBridge().insertInterventionPoint(taskId, afterStepId);
};

/**
 * Fetch all task details in parallel.
 */
export const fetchTaskDetailsHandler = async (
    taskId: string
): Promise<{
    statusRes: StatusResponse;
    messagesRes: MessageResponse;
    eventsRes: EventResponse;
    telemetryRes: TelemetryResponse;
}> => {
    try {
        const [status, eventsResponse] = await Promise.all([
            getWorkspaceAgentBridge().getStatus(taskId),
            getWorkspaceAgentBridge().getTaskEvents(taskId),
        ]);

        return {
            statusRes: buildStatusResponse(taskId, status),
            messagesRes: buildMessagesResponse(status),
            eventsRes: buildEventsResponse(eventsResponse),
            telemetryRes: {
                success: true,
                telemetry: [],
            },
        };
    } catch (error) {
        window.electron.log.error('Failed to fetch task details:', error as Error);
        throw error;
    }
};
