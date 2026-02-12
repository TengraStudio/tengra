/**
 * Async handlers for agent task operations
 * Each handler encapsulates a single async operation to manage complexity
 */

import { EventResponse, MessageResponse, StatusResponse, TelemetryResponse } from './taskDetailsProcessor';

export interface IpcInvokeResult {
    success: boolean;
    error?: string;
}

/**
 * Invoke an IPC method and handle errors
 */
const invokeIpc = async (method: string, payload: Record<string, unknown>): Promise<IpcInvokeResult> => {
    try {
        const result = await window.electron.ipcRenderer.invoke(method, payload);
        return result as IpcInvokeResult;
    } catch (error) {
        window.electron.log.error(`IPC error for ${method}:`, error as Error);
        return {
            success: false,
            error: `Failed to invoke ${method}`
        };
    }
};

/**
 * Pause a running task
 */
export const pauseTaskHandler = async (taskId: string): Promise<void> => {
    await invokeIpc('project-agent:pause-task', { taskId });
};

/**
 * Stop a running task
 */
export const stopTaskHandler = async (taskId: string): Promise<void> => {
    await invokeIpc('project-agent:stop-task', { taskId });
};

/**
 * Save a snapshot of the current task
 */
export const saveSnapshotHandler = async (taskId: string): Promise<boolean> => {
    const result = await invokeIpc('project-agent:save-snapshot', { taskId });
    return result.success;
};

/**
 * Resume a paused task
 */
export const resumeTaskHandler = async (taskId: string): Promise<IpcInvokeResult> => {
    try {
        const result = (await window.electron.ipcRenderer.invoke('project-agent:resume-task', {
            taskId
        })) as IpcInvokeResult;
        return result;
    } catch (error) {
        window.electron.log.error('Failed to resume task:', error as Error);
        return {
            success: false,
            error: 'Failed to resume task'
        };
    }
};

/**
 * Resume from a checkpoint
 */
export const resumeCheckpointHandler = async (checkpointId: string): Promise<IpcInvokeResult> => {
    try {
        // This IPC invocation doesn't return a standard result object in the backend implementation I wrote?
        // Wait, I wrote: await projectAgentService.resumeFromCheckpoint(checkpointId);
        // It returns void in the backend service currently?
        // Let me check projectAgentService.resumeFromCheckpoint return type.
        // It returns void in the service.
        // So IPC returns void (undefined).
        await window.electron.ipcRenderer.invoke('project:resume-checkpoint', checkpointId);
        return { success: true };
    } catch (error) {
        window.electron.log.error('Failed to resume checkpoint:', error as Error);
        return {
            success: false,
            error: 'Failed to resume checkpoint'
        };
    }
};

/**
 * Approve an execution plan
 */
export const approvePlanHandler = async (taskId: string): Promise<boolean> => {
    try {
        const result = (await window.electron.ipcRenderer.invoke('project-agent:approve-plan', {
            taskId
        })) as IpcInvokeResult;
        if (!result.success) {
            window.electron.log.error('Failed to approve plan:', result.error);
        }
        return result.success;
    } catch (error) {
        window.electron.log.error('Failed to approve plan:', error as Error);
        return false;
    }
};

/**
 * Reject an execution plan with optional reason
 */
export const rejectPlanHandler = async (taskId: string, reason?: string): Promise<boolean> => {
    try {
        const result = (await window.electron.ipcRenderer.invoke('project-agent:reject-plan', {
            taskId,
            reason
        })) as IpcInvokeResult;
        if (!result.success) {
            window.electron.log.error('Failed to reject plan:', result.error);
        }
        return result.success;
    } catch (error) {
        window.electron.log.error('Failed to reject plan:', error as Error);
        return false;
    }
};

/**
 * Approve a specific step (AGT-HIL-01)
 */
export const approveStepHandler = async (taskId: string, stepId: string): Promise<void> => {
    await window.electron.ipcRenderer.invoke('project:approve-step', { taskId, stepId });
};

/**
 * Skip a specific step (AGT-HIL-03)
 */
export const skipStepHandler = async (taskId: string, stepId: string): Promise<void> => {
    await window.electron.ipcRenderer.invoke('project:skip-step', { taskId, stepId });
};

/**
 * Edit a specific step text (AGT-HIL-02)
 */
export const editStepHandler = async (taskId: string, stepId: string, text: string): Promise<void> => {
    await window.electron.ipcRenderer.invoke('project:edit-step', { taskId, stepId, text });
};

/**
 * Add a comment to a step (AGT-HIL-05)
 */
export const addStepCommentHandler = async (taskId: string, stepId: string, comment: string): Promise<void> => {
    await window.electron.ipcRenderer.invoke('project:add-step-comment', { taskId, stepId, comment });
};

/**
 * Insert a manual intervention point (AGT-HIL-04)
 */
export const insertInterventionHandler = async (taskId: string, afterStepId: string): Promise<void> => {
    await window.electron.ipcRenderer.invoke('project:insert-intervention', { taskId, afterStepId });
};

/**
 * Fetch all task details in parallel
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
        const [statusRes, messagesRes, eventsRes, telemetryRes] = await Promise.all([
            window.electron.ipcRenderer.invoke('project-agent:get-status', { taskId }),
            window.electron.ipcRenderer.invoke('project-agent:get-messages', { taskId }),
            window.electron.ipcRenderer.invoke('project-agent:get-events', { taskId }),
            window.electron.ipcRenderer.invoke('project-agent:get-telemetry', { taskId })
        ]);

        return {
            statusRes: statusRes as StatusResponse,
            messagesRes: messagesRes as MessageResponse,
            eventsRes: eventsRes as EventResponse,
            telemetryRes: telemetryRes as TelemetryResponse
        };
    } catch (error) {
        window.electron.log.error('Failed to fetch task details:', error as Error);
        throw error;
    }
};
