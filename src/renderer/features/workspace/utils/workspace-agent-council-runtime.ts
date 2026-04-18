/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type {
    CouncilReviewDecision,
    CouncilSubagentRuntime,
    CouncilSubagentWorkspaceDraft,
    WorkspaceAgentSession,
} from '@shared/types/workspace-agent-session';

import { generateId } from '@/lib/utils';

import type { SessionCouncilRuntime } from '../types/workspace-agent-session-local';

function updateSubagentRuntime(
    subagents: CouncilSubagentRuntime[],
    agentId: string,
    updater: (agent: CouncilSubagentRuntime) => CouncilSubagentRuntime
): CouncilSubagentRuntime[] {
    return subagents.map(agent => (agent.id === agentId ? updater(agent) : agent));
}

function updateDraftRuntime(
    drafts: CouncilSubagentWorkspaceDraft[],
    draftId: string,
    updater: (draft: CouncilSubagentWorkspaceDraft) => CouncilSubagentWorkspaceDraft
): CouncilSubagentWorkspaceDraft[] {
    return drafts.map(draft => (draft.id === draftId ? updater(draft) : draft));
}

function buildSubmittedDraft(
    draft: CouncilSubagentWorkspaceDraft,
    agent: CouncilSubagentRuntime,
    submittedAt: number
): CouncilSubagentWorkspaceDraft {
    return {
        ...draft,
        patchSummary: draft.patchSummary || agent.stageGoal,
        submittedAt,
    };
}

export function deriveCouncilRuntimeStatus(
    runtime: SessionCouncilRuntime
): WorkspaceAgentSession['status'] {
    if (runtime.reviewQueue.length > 0) {
        return 'reviewing';
    }
    if (runtime.subagents.some(agent => agent.status === 'reviewing')) {
        return 'reviewing';
    }
    if (
        runtime.subagents.some(
            agent => agent.status === 'working' || agent.status === 'assisting'
        )
    ) {
        return 'executing';
    }
    if (
        runtime.subagents.length > 0 &&
        runtime.subagents.every(agent => agent.status === 'completed')
    ) {
        return 'completed';
    }
    return 'planning';
}

export function submitCouncilDraftForReview(
    runtime: SessionCouncilRuntime,
    agentId: string,
    submittedAt: number = Date.now()
): SessionCouncilRuntime {
    const agent = runtime.subagents.find(entry => entry.id === agentId);
    const draft = runtime.drafts.find(entry => entry.agentId === agentId);
    if (!agent || !draft) {
        return runtime;
    }
    if (runtime.reviewQueue.some(entry => entry.id === draft.id)) {
        return runtime;
    }

    const nextDraft = buildSubmittedDraft(draft, agent, submittedAt);
    return {
        ...runtime,
        drafts: updateDraftRuntime(runtime.drafts, draft.id, () => nextDraft),
        reviewQueue: [...runtime.reviewQueue, nextDraft],
        subagents: updateSubagentRuntime(runtime.subagents, agentId, currentAgent => ({
            ...currentAgent,
            status: 'reviewing',
            helpAvailable: false,
            progressPercent: Math.max(currentAgent.progressPercent, 100),
        })),
    };
}

function buildDecisionRecord(
    draftId: string,
    decision: CouncilReviewDecision['decision'],
    chairmanAgentId: string | undefined,
    note: string | undefined,
    decidedAt: number
): CouncilReviewDecision {
    return {
        draftId,
        decision,
        chairmanAgentId,
        note,
        decidedAt,
    };
}

function applyReworkState(
    agent: CouncilSubagentRuntime,
    fallbackModel?: { provider: string; model: string }
): CouncilSubagentRuntime {
    return {
        ...agent,
        provider: fallbackModel?.provider ?? agent.provider,
        model: fallbackModel?.model ?? agent.model,
        status: 'working',
        helpAvailable: false,
        progressPercent: Math.min(agent.progressPercent, 92),
    };
}

export function applyCouncilReviewDecision(
    runtime: SessionCouncilRuntime,
    options: {
        draftId: string;
        decision: CouncilReviewDecision['decision'];
        chairmanAgentId?: string;
        note?: string;
        decidedAt?: number;
        fallbackModel?: { provider: string; model: string };
    }
): SessionCouncilRuntime {
    const draft = runtime.drafts.find(entry => entry.id === options.draftId);
    if (!draft) {
        return runtime;
    }

    const decidedAt = options.decidedAt ?? Date.now();
    const note = options.note?.trim() || undefined;
    const nextDecisions = [
        ...runtime.decisions,
        buildDecisionRecord(
            options.draftId,
            options.decision,
            options.chairmanAgentId,
            note,
            decidedAt
        ),
    ];

    return {
        ...runtime,
        drafts: updateDraftRuntime(runtime.drafts, draft.id, currentDraft => ({
            ...currentDraft,
            patchSummary: note ?? currentDraft.patchSummary,
            submittedAt:
                options.decision === 'approve' ? currentDraft.submittedAt : decidedAt,
        })),
        reviewQueue: runtime.reviewQueue.filter(entry => entry.id !== options.draftId),
        decisions: nextDecisions,
        subagents: updateSubagentRuntime(runtime.subagents, draft.agentId, agent => {
            if (options.decision === 'approve') {
                return {
                    ...agent,
                    status: 'completed',
                    helpAvailable: true,
                    progressPercent: 100,
                };
            }
            return applyReworkState(agent, options.fallbackModel);
        }),
    };
}

export function assignCouncilAssist(
    runtime: SessionCouncilRuntime,
    options: {
        helperAgentId: string;
        ownerAgentId: string;
        createdAt?: number;
        summary?: string;
    }
): SessionCouncilRuntime {
    if (options.helperAgentId === options.ownerAgentId) {
        return runtime;
    }

    const helperAgent = runtime.subagents.find(agent => agent.id === options.helperAgentId);
    const ownerAgent = runtime.subagents.find(agent => agent.id === options.ownerAgentId);
    if (!helperAgent || !ownerAgent || !helperAgent.helpAvailable) {
        return runtime;
    }

    const createdAt = options.createdAt ?? Date.now();
    return {
        ...runtime,
        assistEvents: [
            ...runtime.assistEvents,
            {
                id: generateId(),
                taskId: 'workspace-council',
                stageId: ownerAgent.ownerStageId ?? ownerAgent.id,
                ownerAgentId: ownerAgent.id,
                helperAgentId: helperAgent.id,
                summary: options.summary ?? `${helperAgent.name} -> ${ownerAgent.name}`,
                createdAt,
            },
        ],
        subagents: runtime.subagents.map(agent => {
            if (agent.id === helperAgent.id) {
                return {
                    ...agent,
                    status: 'assisting',
                    helpAvailable: false,
                    ownerStageId: ownerAgent.ownerStageId ?? ownerAgent.id,
                };
            }
            if (agent.id === ownerAgent.id) {
                return {
                    ...agent,
                    progressPercent: Math.min(agent.progressPercent + 5, 99),
                };
            }
            return agent;
        }),
    };
}

export function appendCouncilDiscussionMessage(
    runtime: SessionCouncilRuntime,
    options: {
        content: string;
        fromAgentId: string;
        toAgentId?: string;
        createdAt?: number;
    }
): SessionCouncilRuntime {
    const content = options.content.trim();
    if (!content) {
        return runtime;
    }

    const sender =
        runtime.chairman?.id === options.fromAgentId
            ? runtime.chairman
            : runtime.subagents.find(agent => agent.id === options.fromAgentId);
    if (!sender) {
        return runtime;
    }

    return {
        ...runtime,
        messages: [
            ...runtime.messages,
            {
                id: generateId(),
                taskId: 'workspace-council',
                stageId: sender.ownerStageId,
                fromAgentId: options.fromAgentId,
                toAgentId: options.toAgentId,
                content,
                createdAt: options.createdAt ?? Date.now(),
                channel: options.toAgentId ? 'private' : 'group',
            },
        ],
    };
}
