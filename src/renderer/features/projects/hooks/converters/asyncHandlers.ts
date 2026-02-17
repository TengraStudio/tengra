/**
 * Async handlers for agent task operations
 * Each handler encapsulates a single async operation to manage complexity
 */

import { invokeTypedIpc, type IpcContractMap } from '@/lib/ipc-client';
import { z } from 'zod';

import { EventResponse, MessageResponse, StatusResponse, TelemetryResponse } from './taskDetailsProcessor';

export interface IpcInvokeResult {
    success: boolean;
    error?: string;
}

type ProjectAgentIpcContract = IpcContractMap & {
    'project-agent:pause-task': { args: [{ taskId: string }]; response: IpcInvokeResult };
    'project-agent:stop-task': { args: [{ taskId: string }]; response: IpcInvokeResult };
    'project-agent:save-snapshot': {
        args: [{ taskId: string }];
        response: IpcInvokeResult & { checkpointId?: string };
    };
    'project-agent:resume-task': { args: [{ taskId: string }]; response: IpcInvokeResult };
    'project-agent:approve-plan': { args: [{ taskId: string }]; response: IpcInvokeResult };
    'project-agent:reject-plan': {
        args: [{ taskId: string; reason?: string }];
        response: IpcInvokeResult;
    };
    'project:resume-checkpoint': { args: [string]; response: void };
    'project:approve-step': { args: [{ taskId: string; stepId: string }]; response: void };
    'project:skip-step': { args: [{ taskId: string; stepId: string }]; response: void };
    'project:edit-step': { args: [{ taskId: string; stepId: string; text: string }]; response: void };
    'project:add-step-comment': {
        args: [{ taskId: string; stepId: string; comment: string }];
        response: void;
    };
    'project:insert-intervention': {
        args: [{ taskId: string; afterStepId: string }];
        response: void;
    };
    'project-agent:get-status': { args: [{ taskId: string }]; response: StatusResponse };
    'project-agent:get-messages': { args: [{ taskId: string }]; response: MessageResponse };
    'project-agent:get-events': { args: [{ taskId: string }]; response: EventResponse };
    'project-agent:get-telemetry': { args: [{ taskId: string }]; response: TelemetryResponse };
};

const taskIdPayloadSchema = z.tuple([z.object({ taskId: z.string().min(1) })]);
const successResultSchema = z.object({
    success: z.boolean(),
    error: z.string().optional()
});
const statusResponseSchema: z.ZodType<StatusResponse> = z.object({ success: z.boolean() }).passthrough();
const messageResponseSchema: z.ZodType<MessageResponse> = z.object({ success: z.boolean() }).passthrough();
const eventResponseSchema: z.ZodType<EventResponse> = z.object({ success: z.boolean() }).passthrough();
const telemetryResponseSchema: z.ZodType<TelemetryResponse> = z
    .object({ success: z.boolean() })
    .passthrough();

type SimpleTaskMutationChannel =
    | 'project-agent:pause-task'
    | 'project-agent:stop-task'
    | 'project-agent:save-snapshot';

/**
 * Invoke an IPC method and handle errors
 */
const invokeIpc = async (
    method: SimpleTaskMutationChannel,
    payload: { taskId: string }
): Promise<IpcInvokeResult> => {
    try {
        const result = await invokeTypedIpc<ProjectAgentIpcContract, typeof method>(
            method,
            [payload],
            {
                argsSchema: taskIdPayloadSchema,
                responseSchema: successResultSchema
            }
        );
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
        const result = await invokeTypedIpc<ProjectAgentIpcContract, 'project-agent:resume-task'>(
            'project-agent:resume-task',
            [{ taskId }],
            {
                argsSchema: taskIdPayloadSchema,
                responseSchema: successResultSchema
            }
        );
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
        await invokeTypedIpc<ProjectAgentIpcContract, 'project:resume-checkpoint'>(
            'project:resume-checkpoint',
            [checkpointId],
            {
                argsSchema: z.tuple([z.string().min(1)]),
                responseSchema: z.void()
            }
        );
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
        const result = await invokeTypedIpc<ProjectAgentIpcContract, 'project-agent:approve-plan'>(
            'project-agent:approve-plan',
            [{ taskId }],
            {
                argsSchema: taskIdPayloadSchema,
                responseSchema: successResultSchema
            }
        );
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
        const result = await invokeTypedIpc<ProjectAgentIpcContract, 'project-agent:reject-plan'>(
            'project-agent:reject-plan',
            [{ taskId, reason }],
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1), reason: z.string().optional() })]),
                responseSchema: successResultSchema
            }
        );
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
    await invokeTypedIpc<ProjectAgentIpcContract, 'project:approve-step'>(
        'project:approve-step',
        [{ taskId, stepId }],
        {
            argsSchema: z.tuple([z.object({ taskId: z.string().min(1), stepId: z.string().min(1) })]),
            responseSchema: z.void()
        }
    );
};

/**
 * Skip a specific step (AGT-HIL-03)
 */
export const skipStepHandler = async (taskId: string, stepId: string): Promise<void> => {
    await invokeTypedIpc<ProjectAgentIpcContract, 'project:skip-step'>(
        'project:skip-step',
        [{ taskId, stepId }],
        {
            argsSchema: z.tuple([z.object({ taskId: z.string().min(1), stepId: z.string().min(1) })]),
            responseSchema: z.void()
        }
    );
};

/**
 * Edit a specific step text (AGT-HIL-02)
 */
export const editStepHandler = async (taskId: string, stepId: string, text: string): Promise<void> => {
    await invokeTypedIpc<ProjectAgentIpcContract, 'project:edit-step'>(
        'project:edit-step',
        [{ taskId, stepId, text }],
        {
            argsSchema: z.tuple([
                z.object({
                    taskId: z.string().min(1),
                    stepId: z.string().min(1),
                    text: z.string().min(1)
                })
            ]),
            responseSchema: z.void()
        }
    );
};

/**
 * Add a comment to a step (AGT-HIL-05)
 */
export const addStepCommentHandler = async (taskId: string, stepId: string, comment: string): Promise<void> => {
    await invokeTypedIpc<ProjectAgentIpcContract, 'project:add-step-comment'>(
        'project:add-step-comment',
        [{ taskId, stepId, comment }],
        {
            argsSchema: z.tuple([
                z.object({
                    taskId: z.string().min(1),
                    stepId: z.string().min(1),
                    comment: z.string().min(1)
                })
            ]),
            responseSchema: z.void()
        }
    );
};

/**
 * Insert a manual intervention point (AGT-HIL-04)
 */
export const insertInterventionHandler = async (taskId: string, afterStepId: string): Promise<void> => {
    await invokeTypedIpc<ProjectAgentIpcContract, 'project:insert-intervention'>(
        'project:insert-intervention',
        [{ taskId, afterStepId }],
        {
            argsSchema: z.tuple([
                z.object({ taskId: z.string().min(1), afterStepId: z.string().min(1) })
            ]),
            responseSchema: z.void()
        }
    );
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
            invokeTypedIpc<ProjectAgentIpcContract, 'project-agent:get-status'>(
                'project-agent:get-status',
                [{ taskId }],
                { argsSchema: taskIdPayloadSchema, responseSchema: statusResponseSchema }
            ),
            invokeTypedIpc<ProjectAgentIpcContract, 'project-agent:get-messages'>(
                'project-agent:get-messages',
                [{ taskId }],
                { argsSchema: taskIdPayloadSchema, responseSchema: messageResponseSchema }
            ),
            invokeTypedIpc<ProjectAgentIpcContract, 'project-agent:get-events'>(
                'project-agent:get-events',
                [{ taskId }],
                { argsSchema: taskIdPayloadSchema, responseSchema: eventResponseSchema }
            ),
            invokeTypedIpc<ProjectAgentIpcContract, 'project-agent:get-telemetry'>(
                'project-agent:get-telemetry',
                [{ taskId }],
                { argsSchema: taskIdPayloadSchema, responseSchema: telemetryResponseSchema }
            )
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
