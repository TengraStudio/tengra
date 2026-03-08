import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { WorkspaceAgentService } from '@main/services/workspace/workspace-agent.service';
import { createSafeIpcHandler, createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import {
    DebateCitationSchema,
    DebateSessionSchema,
    DebateSideSchema,
    VotingConfigurationSchema,
    VotingSessionSchema,
} from '@shared/schemas/workspace-agent-hardening.schema';
import type {
    AgentPerformanceMetrics,
    AgentTeamworkAnalytics,
    ConsensusResult,
    DebateCitation,
    DebateReplay,
    DebateSession,
    DebateSide,
    VotingAnalytics,
    VotingConfiguration,
    VotingSession,
    VotingTemplate,
} from '@shared/types/workspace-agent';
import type { BrowserWindow } from 'electron';
import { ipcMain } from 'electron';
import { z } from 'zod';

export function registerWorkspaceAgentDecisionHandlers(
    workspaceAgentService: WorkspaceAgentService,
    getMainWindow: () => BrowserWindow | null
): void {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'workspace agent decision workflows');

    ipcMain.handle(
        'agent:create-voting-session',
        createValidatedIpcHandler<VotingSession | null, [{ taskId: string; stepIndex: number; question: string; options: string[] }]>(
            'agent:create-voting-session',
            async (
                event,
                payload: { taskId: string; stepIndex: number; question: string; options: string[] }
            ): Promise<VotingSession | null> => {
                validateSender(event);
                return workspaceAgentService.createVotingSession(
                    payload.taskId,
                    payload.stepIndex,
                    payload.question,
                    payload.options
                );
            },
            {
                argsSchema: z.tuple([z.object({
                    taskId: z.string().min(1),
                    stepIndex: z.number().int().nonnegative(),
                    question: z.string().min(1),
                    options: z.array(z.string()).min(2)
                })]),
                responseSchema: VotingSessionSchema.nullable(),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:submit-vote',
        createValidatedIpcHandler<VotingSession | null, [{
            sessionId: string;
            modelId: string;
            provider: string;
            decision: string;
            confidence: number;
            reasoning?: string;
        }]>(
            'agent:submit-vote',
            async (
                event,
                payload: {
                    sessionId: string;
                    modelId: string;
                    provider: string;
                    decision: string;
                    confidence: number;
                    reasoning?: string;
                }
            ): Promise<VotingSession | null> => {
                validateSender(event);
                return await workspaceAgentService.submitVote({
                    sessionId: payload.sessionId,
                    modelId: payload.modelId,
                    provider: payload.provider,
                    decision: payload.decision,
                    confidence: payload.confidence,
                    reasoning: payload.reasoning
                });
            },
            {
                argsSchema: z.tuple([z.object({
                    sessionId: z.string().min(1),
                    modelId: z.string().min(1),
                    provider: z.string().min(1),
                    decision: z.string().min(1),
                    confidence: z.number().min(0).max(100),
                    reasoning: z.string().optional()
                })]),
                responseSchema: VotingSessionSchema.nullable(),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:request-votes',
        createValidatedIpcHandler<VotingSession | null, [{ sessionId: string; models: Array<{ provider: string; model: string }> }]>(
            'agent:request-votes',
            async (event, payload: { sessionId: string; models: Array<{ provider: string; model: string }> }): Promise<VotingSession | null> => {
                validateSender(event);
                return await workspaceAgentService.requestVotes(payload.sessionId, payload.models);
            },
            {
                argsSchema: z.tuple([z.object({
                    sessionId: z.string().min(1),
                    models: z.array(z.object({ provider: z.string(), model: z.string() }))
                })]),
                responseSchema: VotingSessionSchema.nullable(),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:resolve-voting',
        createValidatedIpcHandler<VotingSession | null, [string]>(
            'agent:resolve-voting',
            async (event, sessionId: string): Promise<VotingSession | null> => {
                validateSender(event);
                return workspaceAgentService.resolveVoting(sessionId);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                responseSchema: VotingSessionSchema.nullable(),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:get-voting-session',
        createValidatedIpcHandler<VotingSession | null, [string]>(
            'agent:get-voting-session',
            async (event, sessionId: string): Promise<VotingSession | null> => {
                validateSender(event);
                return workspaceAgentService.getVotingSession(sessionId);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                responseSchema: VotingSessionSchema.nullable(),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:list-voting-sessions',
        createValidatedIpcHandler<VotingSession[], [{ taskId?: string } | undefined]>(
            'agent:list-voting-sessions',
            async (event, payload?: { taskId?: string }): Promise<VotingSession[]> => {
                validateSender(event);
                return workspaceAgentService.getVotingSessions(payload?.taskId);
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().optional() }).optional()]),
                responseSchema: z.array(VotingSessionSchema),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:override-voting',
        createValidatedIpcHandler<VotingSession | null, [{ sessionId: string; finalDecision: string; reason?: string }]>(
            'agent:override-voting',
            async (
                event,
                payload: { sessionId: string; finalDecision: string; reason?: string }
            ): Promise<VotingSession | null> => {
                validateSender(event);
                return workspaceAgentService.overrideVotingDecision(
                    payload.sessionId,
                    payload.finalDecision,
                    payload.reason
                );
            },
            {
                argsSchema: z.tuple([z.object({
                    sessionId: z.string().min(1),
                    finalDecision: z.string().min(1),
                    reason: z.string().optional()
                })]),
                responseSchema: VotingSessionSchema.nullable(),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:get-voting-analytics',
        createValidatedIpcHandler<VotingAnalytics, [{ taskId?: string } | undefined]>(
            'agent:get-voting-analytics',
            async (event, payload?: { taskId?: string }): Promise<VotingAnalytics> => {
                validateSender(event);
                return workspaceAgentService.getVotingAnalytics(payload?.taskId);
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().optional() }).optional()]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:get-voting-config',
        createValidatedIpcHandler<VotingConfiguration, []>(
            'agent:get-voting-config',
            async (event): Promise<VotingConfiguration> => {
                validateSender(event);
                return workspaceAgentService.getVotingConfiguration();
            },
            {
                responseSchema: VotingConfigurationSchema,
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:update-voting-config',
        createValidatedIpcHandler<VotingConfiguration, [Partial<VotingConfiguration>]>(
            'agent:update-voting-config',
            async (event, patch: Partial<VotingConfiguration>): Promise<VotingConfiguration> => {
                validateSender(event);
                return workspaceAgentService.updateVotingConfiguration(patch);
            },
            {
                argsSchema: z.tuple([VotingConfigurationSchema.partial()]),
                responseSchema: VotingConfigurationSchema,
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:list-voting-templates',
        createValidatedIpcHandler<VotingTemplate[], []>(
            'agent:list-voting-templates',
            async (event): Promise<VotingTemplate[]> => {
                validateSender(event);
                return workspaceAgentService.getVotingTemplates();
            },
            {
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:build-consensus',
        createValidatedIpcHandler<ConsensusResult | null, [Array<{ modelId: string; provider: string; output: string }>]>(
            'agent:build-consensus',
            async (event, outputs: Array<{ modelId: string; provider: string; output: string }>): Promise<ConsensusResult | null> => {
                validateSender(event);
                return await workspaceAgentService.buildConsensus(outputs);
            },
            {
                argsSchema: z.tuple([z.array(z.object({ modelId: z.string(), provider: z.string(), output: z.string() }))]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:create-debate-session',
        createValidatedIpcHandler<DebateSession | null, [{ taskId: string; stepIndex: number; topic: string }]>(
            'agent:create-debate-session',
            async (
                event,
                payload: { taskId: string; stepIndex: number; topic: string }
            ): Promise<DebateSession | null> => {
                validateSender(event);
                return workspaceAgentService.createDebateSession(payload.taskId, payload.stepIndex, payload.topic);
            },
            {
                argsSchema: z.tuple([z.object({
                    taskId: z.string().min(1),
                    stepIndex: z.number().int().nonnegative(),
                    topic: z.string().min(1)
                })]),
                responseSchema: DebateSessionSchema.nullable(),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:submit-debate-argument',
        createValidatedIpcHandler<DebateSession | null, [{
            sessionId: string;
            agentId: string;
            provider: string;
            side: DebateSide;
            content: string;
            confidence: number;
            citations?: DebateCitation[];
        }]>(
            'agent:submit-debate-argument',
            async (
                event,
                payload: {
                    sessionId: string;
                    agentId: string;
                    provider: string;
                    side: DebateSide;
                    content: string;
                    confidence: number;
                    citations?: DebateCitation[];
                }
            ): Promise<DebateSession | null> => {
                validateSender(event);
                return workspaceAgentService.submitDebateArgument(payload);
            },
            {
                argsSchema: z.tuple([z.object({
                    sessionId: z.string().min(1),
                    agentId: z.string().min(1),
                    provider: z.string().min(1),
                    side: DebateSideSchema,
                    content: z.string().min(1),
                    confidence: z.number().min(0).max(100),
                    citations: z.array(DebateCitationSchema).optional()
                })]),
                responseSchema: DebateSessionSchema.nullable(),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:resolve-debate-session',
        createValidatedIpcHandler<DebateSession | null, [string]>(
            'agent:resolve-debate-session',
            async (event, sessionId: string): Promise<DebateSession | null> => {
                validateSender(event);
                return workspaceAgentService.resolveDebateSession(sessionId);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                responseSchema: DebateSessionSchema.nullable(),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:override-debate-session',
        createValidatedIpcHandler<DebateSession | null, [{ sessionId: string; moderatorId: string; decision: DebateSide | 'balanced'; reason?: string }]>(
            'agent:override-debate-session',
            async (
                event,
                payload: { sessionId: string; moderatorId: string; decision: DebateSide | 'balanced'; reason?: string }
            ): Promise<DebateSession | null> => {
                validateSender(event);
                return workspaceAgentService.overrideDebateSession(
                    payload.sessionId,
                    payload.moderatorId,
                    payload.decision,
                    payload.reason
                );
            },
            {
                argsSchema: z.tuple([z.object({
                    sessionId: z.string().min(1),
                    moderatorId: z.string().min(1),
                    decision: z.union([DebateSideSchema, z.literal('balanced')]),
                    reason: z.string().optional()
                })]),
                responseSchema: DebateSessionSchema.nullable(),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:get-debate-session',
        createSafeIpcHandler(
            'agent:get-debate-session',
            async (event, sessionId: string): Promise<DebateSession | null> => {
                createMainWindowSenderValidator(getMainWindow, 'debate-session')(event);
                z.string().parse(sessionId);
                return workspaceAgentService.getDebateSession(sessionId);
            },
            null
        )
    );

    ipcMain.handle(
        'agent:list-debate-history',
        createValidatedIpcHandler<DebateSession[], [{ taskId?: string } | undefined]>(
            'agent:list-debate-history',
            async (event, payload?: { taskId?: string }): Promise<DebateSession[]> => {
                validateSender(event);
                return workspaceAgentService.getDebateHistory(payload?.taskId);
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().optional() }).optional()]),
                responseSchema: z.array(DebateSessionSchema),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:get-debate-replay',
        createValidatedIpcHandler<DebateReplay | null, [string]>(
            'agent:get-debate-replay',
            async (event, sessionId: string): Promise<DebateReplay | null> => {
                validateSender(event);
                return workspaceAgentService.getDebateReplay(sessionId);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:generate-debate-summary',
        createValidatedIpcHandler<string | null, [string]>(
            'agent:generate-debate-summary',
            async (event, sessionId: string): Promise<string | null> => {
                validateSender(event);
                return workspaceAgentService.generateDebateSummary(sessionId);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                responseSchema: z.string().nullable(),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:get-teamwork-analytics',
        createValidatedIpcHandler<AgentTeamworkAnalytics | null, [{ taskId?: string } | undefined]>(
            'agent:get-teamwork-analytics',
            async (event): Promise<AgentTeamworkAnalytics | null> => {
                validateSender(event);
                return workspaceAgentService.getTeamworkAnalytics();
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().optional() }).optional()]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:get-performance-metrics',
        createValidatedIpcHandler<AgentPerformanceMetrics | null, [string]>(
            'agent:get-performance-metrics',
            async (event, taskId: string): Promise<AgentPerformanceMetrics | null> => {
                validateSender(event);
                return workspaceAgentService.getPerformanceMetrics(taskId) ?? null;
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );
}
