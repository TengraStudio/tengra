import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { ProjectAgentService } from '@main/services/project/project-agent.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import {
    AgentCollaborationIntentSchema,
    AgentCollaborationPrioritySchema,
} from '@shared/schemas/project-agent-hardening.schema';
import type {
    AgentCollaborationIntent,
    AgentCollaborationPriority,
    HelperCandidateInput,
    HelperHandoffInput,
    HelperMergeGateDecision,
    HelperMergeGateInput,
    QuotaInterruptInput,
    QuotaInterruptResult,
    WorkerAvailabilityInput,
    WorkerAvailabilityRecord,
} from '@shared/types/project-agent';
import type {
    AgentCollaborationMessage,
    HelperCandidateScore,
    HelperHandoffPackage,
} from '@shared/types/project-agent';
import { BrowserWindow, ipcMain } from 'electron';
import { z } from 'zod';

const STREAM_EVENT_VERSION = 'v1' as const;
let councilEventSequence = 0;

const createEventDedupeKey = (prefix: string, taskId: string, sequence: number): string => {
    return `${STREAM_EVENT_VERSION}:${prefix}:${taskId}:${Date.now()}:${sequence}`;
};

export function registerProjectAgentCouncilHandlers(
    projectAgentService: ProjectAgentService,
    getMainWindow: () => BrowserWindow | null
): void {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'council messaging');

    ipcMain.handle(
        'project:council-send-message',
        createValidatedIpcHandler<AgentCollaborationMessage | null, [{
            taskId: string;
            stageId: string;
            fromAgentId: string;
            toAgentId?: string;
            intent: AgentCollaborationIntent;
            priority?: AgentCollaborationPriority;
            payload: Record<string, string | number | boolean | null>;
            expiresAt?: number;
        }]>(
            'project:council-send-message',
            async (event, payload): Promise<AgentCollaborationMessage | null> => {
                validateSender(event);
                return await projectAgentService.sendCollaborationMessage(payload);
            },
            {
                argsSchema: z.tuple([z.object({
                    taskId: z.string().min(1),
                    stageId: z.string().min(1),
                    fromAgentId: z.string().min(1),
                    toAgentId: z.string().optional(),
                    intent: AgentCollaborationIntentSchema,
                    priority: AgentCollaborationPrioritySchema.optional(),
                    payload: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
                    expiresAt: z.number().optional()
                })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:council-get-messages',
        createValidatedIpcHandler<AgentCollaborationMessage[], [{
            taskId: string;
            stageId?: string;
            agentId?: string;
            includeExpired?: boolean;
        }]>(
            'project:council-get-messages',
            async (event, payload): Promise<AgentCollaborationMessage[]> => {
                validateSender(event);
                return await projectAgentService.getCollaborationMessages(payload);
            },
            {
                argsSchema: z.tuple([z.object({
                    taskId: z.string().min(1),
                    stageId: z.string().optional(),
                    agentId: z.string().optional(),
                    includeExpired: z.boolean().optional()
                })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:council-cleanup-expired-messages',
        createValidatedIpcHandler<{ success: true; removed: number }, [{ taskId?: string } | undefined]>(
            'project:council-cleanup-expired-messages',
            async (event, payload?: { taskId?: string }): Promise<{ success: true; removed: number }> => {
                validateSender(event);
                const removed = await projectAgentService.cleanupExpiredCollaborationMessages(payload?.taskId);
                return { success: true, removed };
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().optional() }).optional()]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:council-handle-quota-interrupt',
        createValidatedIpcHandler<QuotaInterruptResult | null, [QuotaInterruptInput]>(
            'project:council-handle-quota-interrupt',
            async (event, payload): Promise<QuotaInterruptResult | null> => {
                validateSender(event);
                const result = await projectAgentService.handleQuotaExhaustedInterrupt(payload);
                councilEventSequence += 1;
                const eventPayload = {
                    ...result,
                    v: STREAM_EVENT_VERSION,
                    dedupeKey: createEventDedupeKey('quota_interrupt', payload.taskId, councilEventSequence),
                    emittedAt: Date.now(),
                };
                const windows = BrowserWindow.getAllWindows();
                for (const windowInstance of windows) {
                    windowInstance.webContents.send('project:quota-interrupt', eventPayload);
                }
                return result;
            },
            {
                argsSchema: z.tuple([z.object({
                    taskId: z.string().min(1),
                    stageId: z.string().optional(),
                    provider: z.string().min(1),
                    model: z.string().min(1),
                    reason: z.string().optional(),
                    autoSwitch: z.boolean().optional()
                })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:council-register-worker-availability',
        createValidatedIpcHandler<WorkerAvailabilityRecord | null, [WorkerAvailabilityInput]>(
            'project:council-register-worker-availability',
            async (event, payload): Promise<WorkerAvailabilityRecord | null> => {
                validateSender(event);
                return projectAgentService.registerWorkerAvailability(payload);
            },
            {
                argsSchema: z.tuple([z.object({
                    taskId: z.string().min(1),
                    agentId: z.string().min(1),
                    status: z.enum(['available', 'busy', 'offline']),
                    reason: z.string().optional(),
                    skills: z.array(z.string()).optional(),
                    contextReadiness: z.number().optional()
                })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:council-list-available-workers',
        createValidatedIpcHandler<WorkerAvailabilityRecord[], [{ taskId: string }]>(
            'project:council-list-available-workers',
            async (event, payload): Promise<WorkerAvailabilityRecord[]> => {
                validateSender(event);
                return projectAgentService.listAvailableWorkers(payload.taskId);
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().min(1) })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:council-score-helper-candidates',
        createValidatedIpcHandler<HelperCandidateScore[], [HelperCandidateInput]>(
            'project:council-score-helper-candidates',
            async (event, payload): Promise<HelperCandidateScore[]> => {
                validateSender(event);
                return projectAgentService.scoreHelperCandidates(payload);
            },
            {
                argsSchema: z.tuple([z.object({
                    taskId: z.string().min(1),
                    stageId: z.string().min(1),
                    requiredSkills: z.array(z.string()),
                    blockedAgentIds: z.array(z.string()).optional(),
                    contextReadinessOverrides: z.record(z.string(), z.number()).optional()
                })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:council-generate-helper-handoff-package',
        createValidatedIpcHandler<HelperHandoffPackage, [HelperHandoffInput]>(
            'project:council-generate-helper-handoff-package',
            async (event, payload): Promise<HelperHandoffPackage> => {
                validateSender(event);
                return projectAgentService.generateHelperHandoffPackage(payload);
            },
            {
                argsSchema: z.tuple([z.object({
                    taskId: z.string().min(1),
                    stageId: z.string().min(1),
                    ownerAgentId: z.string().min(1),
                    helperAgentId: z.string().min(1),
                    stageGoal: z.string().min(1),
                    acceptanceCriteria: z.array(z.string()),
                    constraints: z.array(z.string()),
                    contextNotes: z.string().optional()
                })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:council-review-helper-merge-gate',
        createValidatedIpcHandler<HelperMergeGateDecision, [HelperMergeGateInput]>(
            'project:council-review-helper-merge-gate',
            async (event, payload): Promise<HelperMergeGateDecision> => {
                validateSender(event);
                return projectAgentService.reviewHelperMergeGate(payload);
            },
            {
                argsSchema: z.tuple([z.object({
                    acceptanceCriteria: z.array(z.string()),
                    constraints: z.array(z.string()),
                    helperOutput: z.string().min(1),
                    reviewerNotes: z.string().optional()
                })]),
                wrapResponse: true
            }
        )
    );
}
