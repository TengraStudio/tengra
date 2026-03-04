import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { ProjectAgentService } from '@main/services/project/project-agent.service';
import { createSafeIpcHandler, createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import {
    DebateCitationSchema,
    DebateSessionSchema,
    DebateSideSchema,
    VotingConfigurationSchema,
    VotingSessionSchema,
} from '@shared/schemas/project-agent-hardening.schema';
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
} from '@shared/types/project-agent';
import type { BrowserWindow } from 'electron';
import { ipcMain } from 'electron';
import { z } from 'zod';

export function registerProjectAgentDecisionHandlers(
    projectAgentService: ProjectAgentService,
    getMainWindow: () => BrowserWindow | null
): void {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'project decision workflows');

    ipcMain.handle(
        'project:create-voting-session',
        createValidatedIpcHandler<VotingSession | null, [{ taskId: string; stepIndex: number; question: string; options: string[] }]>(
            'project:create-voting-session',
            async (
                event,
                payload: { taskId: string; stepIndex: number; question: string; options: string[] }
            ): Promise<VotingSession | null> => {
                validateSender(event);
                return projectAgentService.createVotingSession(
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
        'project:submit-vote',
        createValidatedIpcHandler<VotingSession | null, [{
            sessionId: string;
            modelId: string;
            provider: string;
            decision: string;
            confidence: number;
            reasoning?: string;
        }]>(
            'project:submit-vote',
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
                return await projectAgentService.submitVote({
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
        'project:request-votes',
        createValidatedIpcHandler<VotingSession | null, [{ sessionId: string; models: Array<{ provider: string; model: string }> }]>(
            'project:request-votes',
            async (event, payload: { sessionId: string; models: Array<{ provider: string; model: string }> }): Promise<VotingSession | null> => {
                validateSender(event);
                return await projectAgentService.requestVotes(payload.sessionId, payload.models);
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
        'project:resolve-voting',
        createValidatedIpcHandler<VotingSession | null, [string]>(
            'project:resolve-voting',
            async (event, sessionId: string): Promise<VotingSession | null> => {
                validateSender(event);
                return projectAgentService.resolveVoting(sessionId);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                responseSchema: VotingSessionSchema.nullable(),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:get-voting-session',
        createValidatedIpcHandler<VotingSession | null, [string]>(
            'project:get-voting-session',
            async (event, sessionId: string): Promise<VotingSession | null> => {
                validateSender(event);
                return projectAgentService.getVotingSession(sessionId);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                responseSchema: VotingSessionSchema.nullable(),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:list-voting-sessions',
        createValidatedIpcHandler<VotingSession[], [{ taskId?: string } | undefined]>(
            'project:list-voting-sessions',
            async (event, payload?: { taskId?: string }): Promise<VotingSession[]> => {
                validateSender(event);
                return projectAgentService.getVotingSessions(payload?.taskId);
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().optional() }).optional()]),
                responseSchema: z.array(VotingSessionSchema),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:override-voting',
        createValidatedIpcHandler<VotingSession | null, [{ sessionId: string; finalDecision: string; reason?: string }]>(
            'project:override-voting',
            async (
                event,
                payload: { sessionId: string; finalDecision: string; reason?: string }
            ): Promise<VotingSession | null> => {
                validateSender(event);
                return projectAgentService.overrideVotingDecision(
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
        'project:get-voting-analytics',
        createValidatedIpcHandler<VotingAnalytics, [{ taskId?: string } | undefined]>(
            'project:get-voting-analytics',
            async (event, payload?: { taskId?: string }): Promise<VotingAnalytics> => {
                validateSender(event);
                return projectAgentService.getVotingAnalytics(payload?.taskId);
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().optional() }).optional()]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:get-voting-config',
        createValidatedIpcHandler<VotingConfiguration, []>(
            'project:get-voting-config',
            async (event): Promise<VotingConfiguration> => {
                validateSender(event);
                return projectAgentService.getVotingConfiguration();
            },
            {
                responseSchema: VotingConfigurationSchema,
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:update-voting-config',
        createValidatedIpcHandler<VotingConfiguration, [Partial<VotingConfiguration>]>(
            'project:update-voting-config',
            async (event, patch: Partial<VotingConfiguration>): Promise<VotingConfiguration> => {
                validateSender(event);
                return projectAgentService.updateVotingConfiguration(patch);
            },
            {
                argsSchema: z.tuple([VotingConfigurationSchema.partial()]),
                responseSchema: VotingConfigurationSchema,
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:list-voting-templates',
        createValidatedIpcHandler<VotingTemplate[], []>(
            'project:list-voting-templates',
            async (event): Promise<VotingTemplate[]> => {
                validateSender(event);
                return projectAgentService.getVotingTemplates();
            },
            {
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:build-consensus',
        createValidatedIpcHandler<ConsensusResult | null, [Array<{ modelId: string; provider: string; output: string }>]>(
            'project:build-consensus',
            async (event, outputs: Array<{ modelId: string; provider: string; output: string }>): Promise<ConsensusResult | null> => {
                validateSender(event);
                return await projectAgentService.buildConsensus(outputs);
            },
            {
                argsSchema: z.tuple([z.array(z.object({ modelId: z.string(), provider: z.string(), output: z.string() }))]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:create-debate-session',
        createValidatedIpcHandler<DebateSession | null, [{ taskId: string; stepIndex: number; topic: string }]>(
            'project:create-debate-session',
            async (
                event,
                payload: { taskId: string; stepIndex: number; topic: string }
            ): Promise<DebateSession | null> => {
                validateSender(event);
                return projectAgentService.createDebateSession(payload.taskId, payload.stepIndex, payload.topic);
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
        'project:submit-debate-argument',
        createValidatedIpcHandler<DebateSession | null, [{
            sessionId: string;
            agentId: string;
            provider: string;
            side: DebateSide;
            content: string;
            confidence: number;
            citations?: DebateCitation[];
        }]>(
            'project:submit-debate-argument',
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
                return projectAgentService.submitDebateArgument(payload);
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
        'project:resolve-debate-session',
        createValidatedIpcHandler<DebateSession | null, [string]>(
            'project:resolve-debate-session',
            async (event, sessionId: string): Promise<DebateSession | null> => {
                validateSender(event);
                return projectAgentService.resolveDebateSession(sessionId);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                responseSchema: DebateSessionSchema.nullable(),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:override-debate-session',
        createValidatedIpcHandler<DebateSession | null, [{ sessionId: string; moderatorId: string; decision: DebateSide | 'balanced'; reason?: string }]>(
            'project:override-debate-session',
            async (
                event,
                payload: { sessionId: string; moderatorId: string; decision: DebateSide | 'balanced'; reason?: string }
            ): Promise<DebateSession | null> => {
                validateSender(event);
                return projectAgentService.overrideDebateSession(
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
        'project:get-debate-session',
        createSafeIpcHandler(
            'project:get-debate-session',
            async (event, sessionId: string): Promise<DebateSession | null> => {
                createMainWindowSenderValidator(getMainWindow, 'debate-session')(event);
                z.string().parse(sessionId);
                return projectAgentService.getDebateSession(sessionId);
            },
            null
        )
    );

    ipcMain.handle(
        'project:list-debate-history',
        createValidatedIpcHandler<DebateSession[], [{ taskId?: string } | undefined]>(
            'project:list-debate-history',
            async (event, payload?: { taskId?: string }): Promise<DebateSession[]> => {
                validateSender(event);
                return projectAgentService.getDebateHistory(payload?.taskId);
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().optional() }).optional()]),
                responseSchema: z.array(DebateSessionSchema),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:get-debate-replay',
        createValidatedIpcHandler<DebateReplay | null, [string]>(
            'project:get-debate-replay',
            async (event, sessionId: string): Promise<DebateReplay | null> => {
                validateSender(event);
                return projectAgentService.getDebateReplay(sessionId);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:generate-debate-summary',
        createValidatedIpcHandler<string | null, [string]>(
            'project:generate-debate-summary',
            async (event, sessionId: string): Promise<string | null> => {
                validateSender(event);
                return projectAgentService.generateDebateSummary(sessionId);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                responseSchema: z.string().nullable(),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:get-teamwork-analytics',
        createValidatedIpcHandler<AgentTeamworkAnalytics | null, [{ taskId?: string } | undefined]>(
            'project:get-teamwork-analytics',
            async (event): Promise<AgentTeamworkAnalytics | null> => {
                validateSender(event);
                return projectAgentService.getTeamworkAnalytics();
            },
            {
                argsSchema: z.tuple([z.object({ taskId: z.string().optional() }).optional()]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'project:get-performance-metrics',
        createValidatedIpcHandler<AgentPerformanceMetrics | null, [string]>(
            'project:get-performance-metrics',
            async (event, taskId: string): Promise<AgentPerformanceMetrics | null> => {
                validateSender(event);
                return projectAgentService.getPerformanceMetrics(taskId) ?? null;
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );
}
