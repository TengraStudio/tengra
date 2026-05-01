/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { DatabaseService } from '@main/services/data/database.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { SESSION_COUNCIL_CHANNELS } from '@shared/constants/ipc-channels';
import type { IpcValue, JsonObject } from '@shared/types/common';
import type { TaskType, WorkspaceStep } from '@shared/types/council';
import { BrowserWindow, ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

interface StoredChat {
    id: string;
    metadata?: JsonObject;
}

interface TimelineEventRecord {
    id: string;
    timestamp: number;
    type: string;
    stateBeforeTransition: string;
    stateAfterTransition: string;
    payload?: IpcValue;
}

const WORKSPACE_AGENT_METADATA_KEY = 'workspaceAgentSession';

const taskIdRequestSchema = z.object({
    taskId: z.string().min(1),
});

const taskPlanRequestSchema = z.object({
    taskId: z.string().min(1),
    task: z.string().min(1),
});

function readJsonObject(value: JsonObject | undefined, key: string): JsonObject | null {
    const candidate = value?.[key];
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return null;
    }
    return candidate as JsonObject;
}

function getSessionMetadata(chat: StoredChat): JsonObject {
    return readJsonObject(chat.metadata, WORKSPACE_AGENT_METADATA_KEY) ?? {};
}

function buildFallbackPlan(task: string): WorkspaceStep[] {
    return [
        {
            id: randomUUID(),
            text: task.trim(),
            status: 'pending',
            priority: 'normal',
            taskType: 'general',
        },
    ];
}

function normalizeWorkspaceSteps(rawSteps: unknown): WorkspaceStep[] {
    if (!Array.isArray(rawSteps)) {
        return [];
    }

    const isTaskType = (value: unknown): value is TaskType =>
        value === 'code_generation' ||
        value === 'code_review' ||
        value === 'research' ||
        value === 'documentation' ||
        value === 'debugging' ||
        value === 'testing' ||
        value === 'refactoring' ||
        value === 'planning' ||
        value === 'general';

    return rawSteps
        .filter((step): step is Record<string, unknown> => Boolean(step) && typeof step === 'object' && !Array.isArray(step))
        .map((step, index) => ({
            id: typeof step.id === 'string' && step.id.trim().length > 0 ? step.id : `step-${index + 1}`,
            text: typeof step.text === 'string' && step.text.trim().length > 0 ? step.text : `Step ${index + 1}`,
            status:
                step.status === 'running' ||
                step.status === 'completed' ||
                step.status === 'failed' ||
                step.status === 'skipped' ||
                step.status === 'awaiting_step_approval'
                    ? step.status
                    : 'pending',
            priority:
                step.priority === 'low' ||
                step.priority === 'high' ||
                step.priority === 'critical'
                    ? step.priority
                    : 'normal',
            taskType: isTaskType(step.taskType) ? step.taskType : 'general',
        }));
}

function readStoredPlan(chat: StoredChat): WorkspaceStep[] {
    const metadata = getSessionMetadata(chat);
    const council = readJsonObject(metadata, 'council');
    const rawProposal = council?.['proposal'];
    if (Array.isArray(rawProposal)) {
        return normalizeWorkspaceSteps(rawProposal);
    }

    const rawDrafts = council?.['drafts'];
    if (Array.isArray(rawDrafts) && rawDrafts.length > 0) {
        return rawDrafts.map((draft, index) => ({
            id:
                typeof (draft as Record<string, unknown>).id === 'string'
                    ? String((draft as Record<string, unknown>).id)
                    : `draft-${index + 1}`,
            text:
                typeof (draft as Record<string, unknown>).patchSummary === 'string' &&
                String((draft as Record<string, unknown>).patchSummary).trim().length > 0
                    ? String((draft as Record<string, unknown>).patchSummary)
                    : `Draft ${index + 1}`,
            status: 'pending',
            priority: 'normal',
            taskType: 'general',
        }));
    }

    return [];
}

function toTimelineEvent(log: { id: string; created_at: number; role: string; content: string }): TimelineEventRecord {
    return {
        id: log.id,
        timestamp: log.created_at,
        type: log.role === 'system' ? 'PLAN_READY' : 'MESSAGE',
        stateBeforeTransition: 'planning',
        stateAfterTransition: 'executing',
        payload: {
            content: log.content,
            role: log.role,
        },
    };
}

async function ensureCouncilTask(
    databaseService: DatabaseService,
    taskId: string,
    task: string
): Promise<void> {
    const existingTask = await databaseService.uac.getTask(taskId);
    if (!existingTask) {
        await databaseService.uac.createTask({
            workspaceId: taskId,
            description: task,
            status: 'planning',
            metadata: { taskId, source: 'workspace-agent-council' },
        });
    }

    const existingSteps = await databaseService.uac.getSteps(taskId);
    if (existingSteps.length === 0) {
        await databaseService.uac.createSteps(taskId, buildFallbackPlan(task));
    }

    await databaseService.uac.addLog(taskId, 'system', `Plan requested: ${task}`);
}

export function registerSessionCouncilIpc(
    getMainWindow: () => BrowserWindow | null,
    databaseService: DatabaseService
): void {
    const validateSender = createMainWindowSenderValidator(
        getMainWindow,
        'session council operation'
    );

    ipcMain.handle(
        SESSION_COUNCIL_CHANNELS.GENERATE_PLAN,
        createValidatedIpcHandler<{ success: boolean; error?: string }, [z.infer<typeof taskPlanRequestSchema>]>(
            SESSION_COUNCIL_CHANNELS.GENERATE_PLAN,
            async (event, payload) => {
                validateSender(event);
                await ensureCouncilTask(databaseService, payload.taskId, payload.task);
                return { success: true };
            },
            {
                argsSchema: z.tuple([taskPlanRequestSchema]),
                wrapResponse: true,
            }
        )
    );

    ipcMain.handle(
        SESSION_COUNCIL_CHANNELS.GET_PROPOSAL,
        createValidatedIpcHandler<{ success: boolean; plan?: WorkspaceStep[]; error?: string }, [z.infer<typeof taskIdRequestSchema>]>(
            SESSION_COUNCIL_CHANNELS.GET_PROPOSAL,
            async (event, payload) => {
                validateSender(event);
                const chat = await databaseService.getChat(payload.taskId);
                const storedPlan = chat ? readStoredPlan(chat as StoredChat) : [];

                if (storedPlan.length > 0) {
                    return { success: true, plan: storedPlan };
                }

                const steps = await databaseService.uac.getSteps(payload.taskId);
                const plan = steps.map(step => ({
                    id: step.id,
                    text: step.text,
                    status:
                        step.status === 'running' ||
                        step.status === 'completed' ||
                        step.status === 'failed' ||
                        step.status === 'skipped' ||
                        step.status === 'awaiting_step_approval'
                            ? step.status
                            : 'pending',
                } satisfies WorkspaceStep));

                return { success: true, plan };
            },
            {
                argsSchema: z.tuple([taskIdRequestSchema]),
                wrapResponse: true,
            }
        )
    );

    ipcMain.handle(
        SESSION_COUNCIL_CHANNELS.GET_TIMELINE,
        createValidatedIpcHandler<{ success: boolean; events?: TimelineEventRecord[]; error?: string }, [z.infer<typeof taskIdRequestSchema>]>(
            SESSION_COUNCIL_CHANNELS.GET_TIMELINE,
            async (event, payload) => {
                validateSender(event);
                const logs = await databaseService.uac.getLogs(payload.taskId);
                return {
                    success: true,
                    events: logs.map(toTimelineEvent),
                };
            },
            {
                argsSchema: z.tuple([taskIdRequestSchema]),
                wrapResponse: true,
            }
        )
    );

    const simpleSuccessHandler = (
        channel: string,
        handler: (taskId: string, reason?: string) => Promise<void>
    ): void => {
        ipcMain.handle(
            channel,
            createValidatedIpcHandler<{ success: boolean; error?: string }, [z.infer<typeof taskIdRequestSchema> | { taskId: string; reason?: string }]>(
                channel,
                async (event, payload) => {
                    validateSender(event);
                    await handler(payload.taskId, 'reason' in payload ? payload.reason : undefined);
                    return { success: true };
                },
                {
                    argsSchema: z.tuple([z.object({ taskId: z.string().min(1), reason: z.string().optional() })]),
                    wrapResponse: true,
                }
            )
        );
    };

    simpleSuccessHandler(SESSION_COUNCIL_CHANNELS.APPROVE_PROPOSAL, async taskId => {
        await databaseService.uac.updateTaskStatus(taskId, 'waiting_for_approval');
        await databaseService.uac.addLog(taskId, 'system', 'Proposal approved');
    });

    simpleSuccessHandler(SESSION_COUNCIL_CHANNELS.REJECT_PROPOSAL, async (taskId, reason) => {
        await databaseService.uac.updateTaskStatus(taskId, 'failed');
        await databaseService.uac.addLog(taskId, 'system', `Proposal rejected${reason ? `: ${reason}` : ''}`);
    });

    simpleSuccessHandler(SESSION_COUNCIL_CHANNELS.START_EXECUTION, async taskId => {
        await databaseService.uac.updateTaskStatus(taskId, 'running');
        await databaseService.uac.addLog(taskId, 'system', 'Execution started');
    });

    simpleSuccessHandler(SESSION_COUNCIL_CHANNELS.PAUSE_EXECUTION, async taskId => {
        await databaseService.uac.updateTaskStatus(taskId, 'paused');
        await databaseService.uac.addLog(taskId, 'system', 'Execution paused');
    });

    simpleSuccessHandler(SESSION_COUNCIL_CHANNELS.RESUME_EXECUTION, async taskId => {
        await databaseService.uac.updateTaskStatus(taskId, 'running');
        await databaseService.uac.addLog(taskId, 'system', 'Execution resumed');
    });
}
