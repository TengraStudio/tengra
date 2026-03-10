import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { AutomationWorkflowService } from '@main/services/workspace/automation-workflow.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { SESSION_COUNCIL_CHANNELS } from '@shared/constants/ipc-channels';
import {
    sessionCouncilApproveProposalRequestSchema,
    sessionCouncilBooleanResponseSchema,
    sessionCouncilBuildConsensusRequestSchema,
    sessionCouncilBuildConsensusResponseSchema,
    sessionCouncilCleanupExpiredMessagesResponseSchema,
    sessionCouncilCreateDebateSessionRequestSchema,
    sessionCouncilCreateDebateSessionResponseSchema,
    sessionCouncilCreateVotingSessionRequestSchema,
    sessionCouncilCreateVotingSessionResponseSchema,
    sessionCouncilGenerateDebateSummaryResponseSchema,
    sessionCouncilGenerateHelperHandoffRequestSchema,
    sessionCouncilGenerateHelperHandoffResponseSchema,
    sessionCouncilGeneratePlanRequestSchema,
    sessionCouncilGetDebateReplayResponseSchema,
    sessionCouncilGetDebateSessionResponseSchema,
    sessionCouncilGetMessagesRequestSchema,
    sessionCouncilGetMessagesResponseSchema,
    sessionCouncilGetProposalRequestSchema,
    sessionCouncilGetVotingSessionResponseSchema,
    sessionCouncilListAvailableWorkersRequestSchema,
    sessionCouncilListAvailableWorkersResponseSchema,
    sessionCouncilListDebateHistoryResponseSchema,
    sessionCouncilNoArgsRequestSchema,
    sessionCouncilOptionalTaskRequestSchema,
    sessionCouncilOverrideDebateSessionRequestSchema,
    sessionCouncilOverrideDebateSessionResponseSchema,
    sessionCouncilOverrideVotingDecisionRequestSchema,
    sessionCouncilOverrideVotingDecisionResponseSchema,
    sessionCouncilProposalResponseSchema,
    sessionCouncilQuotaInterruptRequestSchema,
    sessionCouncilQuotaInterruptResponseSchema,
    sessionCouncilRegisterWorkerAvailabilityRequestSchema,
    sessionCouncilRegisterWorkerAvailabilityResponseSchema,
    sessionCouncilRejectProposalRequestSchema,
    sessionCouncilRequestVotesRequestSchema,
    sessionCouncilRequestVotesResponseSchema,
    sessionCouncilReviewHelperMergeRequestSchema,
    sessionCouncilReviewHelperMergeResponseSchema,
    sessionCouncilScoreHelperCandidatesRequestSchema,
    sessionCouncilScoreHelperCandidatesResponseSchema,
    sessionCouncilSendMessageRequestSchema,
    sessionCouncilSendMessageResponseSchema,
    sessionCouncilSessionIdRequestSchema,
    sessionCouncilSubmitDebateArgumentRequestSchema,
    sessionCouncilSubmitDebateArgumentResponseSchema,
    sessionCouncilSubmitVoteRequestSchema,
    sessionCouncilSubmitVoteResponseSchema,
    sessionCouncilTeamworkAnalyticsResponseSchema,
    sessionCouncilTimelineRequestSchema,
    sessionCouncilTimelineResponseSchema,
    sessionCouncilUpdateVotingConfigurationRequestSchema,
    sessionCouncilUpdateVotingConfigurationResponseSchema,
    sessionCouncilVotingAnalyticsResponseSchema,
    sessionCouncilVotingConfigurationResponseSchema,
    sessionCouncilVotingSessionsResponseSchema,
    sessionCouncilVotingTemplatesResponseSchema,
} from '@shared/schemas/session-council-ipc.schema';
import type { AgentEventRecord } from '@shared/types/agent-state';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';

const STREAM_EVENT_VERSION = 'v1' as const;
let councilEventSequence = 0;

type OptionalTaskPayload = { taskId?: string };
type ValidatedArgsSchema =
    | z.ZodTuple<[]>
    | z.ZodTuple<[z.ZodTypeAny, ...z.ZodTypeAny[]]>;

const createEventDedupeKey = (prefix: string, taskId: string, sequence: number): string => {
    return `${STREAM_EVENT_VERSION}:${prefix}:${taskId}:${Date.now()}:${sequence}`;
};

function registerSessionCouncilHandler<
    Response,
    Schema extends ValidatedArgsSchema,
>(
    options: {
        getMainWindow: () => BrowserWindow | null;
        channel: string;
        label: string;
        argsSchema: Schema;
        responseSchema: z.ZodType<Response>;
    },
    handler: (event: IpcMainInvokeEvent, ...args: z.infer<Schema>) => Promise<Response>
): void {
    const { getMainWindow, channel, label, argsSchema, responseSchema } = options;
    const validateSender = createMainWindowSenderValidator(getMainWindow, label);
    ipcMain.handle(
        channel,
        createValidatedIpcHandler<Response, z.infer<Schema>>(
            channel,
            async (event, ...args) => {
                validateSender(event);
                return handler(event, ...args);
            },
            {
                argsSchema,
                responseSchema,
            }
        )
    );
}

function registerProposalHandlers(
    getMainWindow: () => BrowserWindow | null,
    automationWorkflowService: AutomationWorkflowService
): void {
    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.GENERATE_PLAN,
            label: 'session council generate plan',
            argsSchema: sessionCouncilGeneratePlanRequestSchema,
            responseSchema: sessionCouncilBooleanResponseSchema,
        },
        async (_event, payload) => {
            await automationWorkflowService.generatePlan({
                task: payload.task,
                workspaceId: payload.taskId,
                agentProfileId: 'council-president',
            });
            return { success: true };
        }
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.GET_PROPOSAL,
            label: 'session council get proposal',
            argsSchema: sessionCouncilGetProposalRequestSchema,
            responseSchema: sessionCouncilProposalResponseSchema,
        },
        async (_event, payload) => {
            const status = await automationWorkflowService.getStatus(payload.taskId);
            return {
                success: true,
                plan: status.plan ?? [],
            };
        }
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.APPROVE_PROPOSAL,
            label: 'session council approve proposal',
            argsSchema: sessionCouncilApproveProposalRequestSchema,
            responseSchema: sessionCouncilBooleanResponseSchema,
        },
        async (_event, payload) => {
            const success = await automationWorkflowService.approveCurrentPlan(payload.taskId);
            return {
                success,
                error: success ? undefined : 'Failed to approve current plan',
            };
        }
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.REJECT_PROPOSAL,
            label: 'session council reject proposal',
            argsSchema: sessionCouncilRejectProposalRequestSchema,
            responseSchema: sessionCouncilBooleanResponseSchema,
        },
        async (_event, payload) => {
            const success = await automationWorkflowService.rejectCurrentPlan(payload.taskId, payload.reason);
            return {
                success,
                error: success ? undefined : 'Failed to reject current plan',
            };
        }
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.START_EXECUTION,
            label: 'session council start execution',
            argsSchema: sessionCouncilTimelineRequestSchema,
            responseSchema: sessionCouncilBooleanResponseSchema,
        },
        async (_event, payload) => {
            const success = await automationWorkflowService.resumeTask(payload.taskId);
            return {
                success,
                error: success ? undefined : 'Failed to start execution',
            };
        }
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.PAUSE_EXECUTION,
            label: 'session council pause execution',
            argsSchema: sessionCouncilTimelineRequestSchema,
            responseSchema: sessionCouncilBooleanResponseSchema,
        },
        async (_event, payload) => {
            await automationWorkflowService.pauseTask(payload.taskId);
            return { success: true };
        }
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.RESUME_EXECUTION,
            label: 'session council resume execution',
            argsSchema: sessionCouncilTimelineRequestSchema,
            responseSchema: sessionCouncilBooleanResponseSchema,
        },
        async (_event, payload) => {
            const success = await automationWorkflowService.resumeTask(payload.taskId);
            return {
                success,
                error: success ? undefined : 'Failed to resume execution',
            };
        }
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.GET_TIMELINE,
            label: 'session council get timeline',
            argsSchema: sessionCouncilTimelineRequestSchema,
            // SAFETY: agent event records are emitted as plain IPC-safe objects by the
            // automation workflow services and only need envelope validation here.
            responseSchema: sessionCouncilTimelineResponseSchema as z.ZodType<{
                success: boolean;
                events?: AgentEventRecord[];
                error?: string;
            }>,
        },
        async (_event, payload) => {
            const timeline = await automationWorkflowService.getTaskEvents(payload.taskId);
            return {
                success: true,
                events: timeline.events ?? [],
            };
        }
    );
}

function registerVotingHandlers(
    getMainWindow: () => BrowserWindow | null,
    automationWorkflowService: AutomationWorkflowService
): void {
    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.CREATE_VOTING_SESSION,
            label: 'session council create voting session',
            argsSchema: sessionCouncilCreateVotingSessionRequestSchema,
            responseSchema: sessionCouncilCreateVotingSessionResponseSchema,
        },
        async (_event, payload) =>
            automationWorkflowService.createVotingSession(
                payload.taskId,
                payload.stepIndex,
                payload.question,
                payload.options
            )
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.SUBMIT_VOTE,
            label: 'session council submit vote',
            argsSchema: sessionCouncilSubmitVoteRequestSchema,
            responseSchema: sessionCouncilSubmitVoteResponseSchema,
        },
        async (_event, payload) => automationWorkflowService.submitVote(payload)
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.REQUEST_VOTES,
            label: 'session council request votes',
            argsSchema: sessionCouncilRequestVotesRequestSchema,
            responseSchema: sessionCouncilRequestVotesResponseSchema,
        },
        async (_event, payload) =>
            automationWorkflowService.requestVotes(payload.sessionId, payload.models)
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.RESOLVE_VOTING,
            label: 'session council resolve voting',
            argsSchema: sessionCouncilSessionIdRequestSchema,
            responseSchema: sessionCouncilGetVotingSessionResponseSchema,
        },
        async (_event, sessionId) => automationWorkflowService.resolveVoting(sessionId)
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.GET_VOTING_SESSION,
            label: 'session council get voting session',
            argsSchema: sessionCouncilSessionIdRequestSchema,
            responseSchema: sessionCouncilGetVotingSessionResponseSchema,
        },
        async (_event, sessionId) => automationWorkflowService.getVotingSession(sessionId)
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.LIST_VOTING_SESSIONS,
            label: 'session council list voting sessions',
            argsSchema: sessionCouncilOptionalTaskRequestSchema,
            responseSchema: sessionCouncilVotingSessionsResponseSchema,
        },
        async (_event, payload?: OptionalTaskPayload) =>
            automationWorkflowService.getVotingSessions(payload?.taskId)
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.GET_VOTING_ANALYTICS,
            label: 'session council voting analytics',
            argsSchema: sessionCouncilOptionalTaskRequestSchema,
            responseSchema: sessionCouncilVotingAnalyticsResponseSchema,
        },
        async (_event, payload?: OptionalTaskPayload) =>
            automationWorkflowService.getVotingAnalytics(payload?.taskId)
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.GET_VOTING_CONFIGURATION,
            label: 'session council voting configuration',
            argsSchema: sessionCouncilNoArgsRequestSchema,
            responseSchema: sessionCouncilVotingConfigurationResponseSchema,
        },
        async () => automationWorkflowService.getVotingConfiguration()
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.UPDATE_VOTING_CONFIGURATION,
            label: 'session council update voting configuration',
            argsSchema: sessionCouncilUpdateVotingConfigurationRequestSchema,
            responseSchema: sessionCouncilUpdateVotingConfigurationResponseSchema,
        },
        async (_event, patch) => automationWorkflowService.updateVotingConfiguration(patch)
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.LIST_VOTING_TEMPLATES,
            label: 'session council list voting templates',
            argsSchema: sessionCouncilNoArgsRequestSchema,
            responseSchema: sessionCouncilVotingTemplatesResponseSchema,
        },
        async () => automationWorkflowService.getVotingTemplates()
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.BUILD_CONSENSUS,
            label: 'session council build consensus',
            argsSchema: sessionCouncilBuildConsensusRequestSchema,
            responseSchema: sessionCouncilBuildConsensusResponseSchema,
        },
        async (_event, outputs) => automationWorkflowService.buildConsensus(outputs)
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.OVERRIDE_VOTING_DECISION,
            label: 'session council override voting decision',
            argsSchema: sessionCouncilOverrideVotingDecisionRequestSchema,
            responseSchema: sessionCouncilOverrideVotingDecisionResponseSchema,
        },
        async (_event, payload) =>
            automationWorkflowService.overrideVotingDecision(
                payload.sessionId,
                payload.finalDecision,
                payload.reason
            )
    );
}

function registerDebateHandlers(
    getMainWindow: () => BrowserWindow | null,
    automationWorkflowService: AutomationWorkflowService
): void {
    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.CREATE_DEBATE_SESSION,
            label: 'session council create debate session',
            argsSchema: sessionCouncilCreateDebateSessionRequestSchema,
            responseSchema: sessionCouncilCreateDebateSessionResponseSchema,
        },
        async (_event, payload) =>
            automationWorkflowService.createDebateSession(payload.taskId, payload.stepIndex, payload.topic)
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.SUBMIT_DEBATE_ARGUMENT,
            label: 'session council submit debate argument',
            argsSchema: sessionCouncilSubmitDebateArgumentRequestSchema,
            responseSchema: sessionCouncilSubmitDebateArgumentResponseSchema,
        },
        async (_event, payload) => automationWorkflowService.submitDebateArgument(payload)
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.RESOLVE_DEBATE_SESSION,
            label: 'session council resolve debate session',
            argsSchema: sessionCouncilSessionIdRequestSchema,
            responseSchema: sessionCouncilOverrideDebateSessionResponseSchema,
        },
        async (_event, sessionId) => automationWorkflowService.resolveDebateSession(sessionId)
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.OVERRIDE_DEBATE_SESSION,
            label: 'session council override debate session',
            argsSchema: sessionCouncilOverrideDebateSessionRequestSchema,
            responseSchema: sessionCouncilOverrideDebateSessionResponseSchema,
        },
        async (_event, payload) =>
            automationWorkflowService.overrideDebateSession(
                payload.sessionId,
                payload.moderatorId,
                payload.decision,
                payload.reason
            )
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.GET_DEBATE_SESSION,
            label: 'session council get debate session',
            argsSchema: sessionCouncilSessionIdRequestSchema,
            responseSchema: sessionCouncilGetDebateSessionResponseSchema,
        },
        async (_event, sessionId) => automationWorkflowService.getDebateSession(sessionId)
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.LIST_DEBATE_HISTORY,
            label: 'session council list debate history',
            argsSchema: sessionCouncilOptionalTaskRequestSchema,
            responseSchema: sessionCouncilListDebateHistoryResponseSchema,
        },
        async (_event, payload?: OptionalTaskPayload) =>
            automationWorkflowService.getDebateHistory(payload?.taskId)
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.GET_DEBATE_REPLAY,
            label: 'session council get debate replay',
            argsSchema: sessionCouncilSessionIdRequestSchema,
            responseSchema: sessionCouncilGetDebateReplayResponseSchema,
        },
        async (_event, sessionId) => automationWorkflowService.getDebateReplay(sessionId)
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.GENERATE_DEBATE_SUMMARY,
            label: 'session council generate debate summary',
            argsSchema: sessionCouncilSessionIdRequestSchema,
            responseSchema: sessionCouncilGenerateDebateSummaryResponseSchema,
        },
        async (_event, sessionId) => automationWorkflowService.generateDebateSummary(sessionId)
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.GET_TEAMWORK_ANALYTICS,
            label: 'session council teamwork analytics',
            argsSchema: sessionCouncilNoArgsRequestSchema,
            responseSchema: sessionCouncilTeamworkAnalyticsResponseSchema,
        },
        async () => automationWorkflowService.getTeamworkAnalytics()
    );
}

function registerCollaborationHandlers(
    getMainWindow: () => BrowserWindow | null,
    automationWorkflowService: AutomationWorkflowService
): void {
    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.SEND_MESSAGE,
            label: 'session council send message',
            argsSchema: sessionCouncilSendMessageRequestSchema,
            responseSchema: sessionCouncilSendMessageResponseSchema,
        },
        async (_event, payload) => automationWorkflowService.sendCollaborationMessage(payload)
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.GET_MESSAGES,
            label: 'session council get messages',
            argsSchema: sessionCouncilGetMessagesRequestSchema,
            responseSchema: sessionCouncilGetMessagesResponseSchema,
        },
        async (_event, payload) => automationWorkflowService.getCollaborationMessages(payload)
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.CLEANUP_EXPIRED_MESSAGES,
            label: 'session council cleanup expired messages',
            argsSchema: sessionCouncilOptionalTaskRequestSchema,
            responseSchema: sessionCouncilCleanupExpiredMessagesResponseSchema,
        },
        async (_event, payload?: OptionalTaskPayload) => {
            const removed = await automationWorkflowService.cleanupExpiredCollaborationMessages(
                payload?.taskId
            );
            return { success: true, removed };
        }
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.HANDLE_QUOTA_INTERRUPT,
            label: 'session council handle quota interrupt',
            argsSchema: sessionCouncilQuotaInterruptRequestSchema,
            responseSchema: sessionCouncilQuotaInterruptResponseSchema,
        },
        async (_event, payload) => {
            const result = await automationWorkflowService.handleQuotaExhaustedInterrupt(payload);
            if (!result) {
                return null;
            }

            councilEventSequence += 1;
            const eventPayload = {
                ...result,
                v: STREAM_EVENT_VERSION,
                dedupeKey: createEventDedupeKey(
                    'quota_interrupt',
                    payload.taskId,
                    councilEventSequence
                ),
                emittedAt: Date.now(),
            };

            const windows = BrowserWindow.getAllWindows();
            const maxWindowCount = windows.length;
            for (let index = 0; index < maxWindowCount; index += 1) {
                const windowInstance = windows[index];
                windowInstance.webContents.send(
                    SESSION_COUNCIL_CHANNELS.QUOTA_INTERRUPT_EVENT,
                    eventPayload
                );
            }

            return result;
        }
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.REGISTER_WORKER_AVAILABILITY,
            label: 'session council register worker availability',
            argsSchema: sessionCouncilRegisterWorkerAvailabilityRequestSchema,
            responseSchema: sessionCouncilRegisterWorkerAvailabilityResponseSchema,
        },
        async (_event, payload) => automationWorkflowService.registerWorkerAvailability(payload)
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.LIST_AVAILABLE_WORKERS,
            label: 'session council list available workers',
            argsSchema: sessionCouncilListAvailableWorkersRequestSchema,
            responseSchema: sessionCouncilListAvailableWorkersResponseSchema,
        },
        async (_event, payload) => automationWorkflowService.listAvailableWorkers(payload.taskId)
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.SCORE_HELPER_CANDIDATES,
            label: 'session council score helper candidates',
            argsSchema: sessionCouncilScoreHelperCandidatesRequestSchema,
            responseSchema: sessionCouncilScoreHelperCandidatesResponseSchema,
        },
        async (_event, payload) => automationWorkflowService.scoreHelperCandidates(payload)
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.GENERATE_HELPER_HANDOFF,
            label: 'session council generate helper handoff',
            argsSchema: sessionCouncilGenerateHelperHandoffRequestSchema,
            responseSchema: sessionCouncilGenerateHelperHandoffResponseSchema,
        },
        async (_event, payload) => automationWorkflowService.generateHelperHandoffPackage(payload)
    );

    registerSessionCouncilHandler(
        {
            getMainWindow,
            channel: SESSION_COUNCIL_CHANNELS.REVIEW_HELPER_MERGE,
            label: 'session council review helper merge',
            argsSchema: sessionCouncilReviewHelperMergeRequestSchema,
            responseSchema: sessionCouncilReviewHelperMergeResponseSchema,
        },
        async (_event, payload) => automationWorkflowService.reviewHelperMergeGate(payload)
    );
}

export function registerSessionCouncilIpc(
    getMainWindow: () => BrowserWindow | null,
    automationWorkflowService: AutomationWorkflowService
): void {
    registerProposalHandlers(getMainWindow, automationWorkflowService);
    registerVotingHandlers(getMainWindow, automationWorkflowService);
    registerDebateHandlers(getMainWindow, automationWorkflowService);
    registerCollaborationHandlers(getMainWindow, automationWorkflowService);
}

