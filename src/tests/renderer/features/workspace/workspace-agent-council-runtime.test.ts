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
    CouncilSubagentRuntime,
    CouncilSubagentWorkspaceDraft,
} from '@shared/types/workspace-agent-session';
import { describe, expect, it } from 'vitest';

import type { SessionCouncilRuntime } from '@/features/workspace/types/workspace-agent-session-local';
import {
    appendCouncilDiscussionMessage,
    applyCouncilReviewDecision,
    assignCouncilAssist,
    deriveCouncilRuntimeStatus,
    submitCouncilDraftForReview,
} from '@/features/workspace/utils/workspace-agent-council-runtime';

function createAgent(
    overrides: Partial<CouncilSubagentRuntime> & Pick<CouncilSubagentRuntime, 'id' | 'name'>
): CouncilSubagentRuntime {
    return {
        id: overrides.id,
        name: overrides.name,
        provider: overrides.provider ?? 'claude',
        model: overrides.model ?? 'sonnet',
        workspaceId: overrides.workspaceId ?? `sandbox-${overrides.id}`,
        status: overrides.status ?? 'working',
        stageGoal: overrides.stageGoal ?? `stage-${overrides.id}`,
        progressPercent: overrides.progressPercent ?? 60,
        helpAvailable: overrides.helpAvailable ?? false,
        ownerStageId: overrides.ownerStageId,
    };
}

function createDraft(
    overrides: Partial<CouncilSubagentWorkspaceDraft> &
        Pick<CouncilSubagentWorkspaceDraft, 'id' | 'agentId' | 'workspaceId'>
): CouncilSubagentWorkspaceDraft {
    return {
        id: overrides.id,
        agentId: overrides.agentId,
        workspaceId: overrides.workspaceId,
        baseRevision: overrides.baseRevision ?? 'workspace-head',
        changedFiles: overrides.changedFiles ?? [],
        patchSummary: overrides.patchSummary ?? '',
        riskFlags: overrides.riskFlags ?? [],
        submittedAt: overrides.submittedAt ?? 1,
    };
}

function createRuntime(): SessionCouncilRuntime {
    return {
        chairman: createAgent({
            id: 'chair',
            name: 'Chairman',
            status: 'reviewing',
            progressPercent: 100,
        }),
        subagents: [
            createAgent({ id: 'agent-a', name: 'Agent A' }),
            createAgent({
                id: 'agent-b',
                name: 'Agent B',
                status: 'completed',
                progressPercent: 100,
                helpAvailable: true,
            }),
        ],
        drafts: [
            createDraft({
                id: 'draft-a',
                agentId: 'agent-a',
                workspaceId: 'sandbox-agent-a',
            }),
            createDraft({
                id: 'draft-b',
                agentId: 'agent-b',
                workspaceId: 'sandbox-agent-b',
            }),
        ],
        reviewQueue: [],
        decisions: [],
        assistEvents: [],
        messages: [],
    };
}

describe('workspace-agent-council-runtime', () => {
    it('submits a private draft into the chairman review queue', () => {
        const runtime = createRuntime();

        const updatedRuntime = submitCouncilDraftForReview(runtime, 'agent-a', 42);

        expect(updatedRuntime.reviewQueue).toHaveLength(1);
        expect(updatedRuntime.reviewQueue[0]).toMatchObject({
            id: 'draft-a',
            submittedAt: 42,
            patchSummary: 'stage-agent-a',
        });
        expect(updatedRuntime.subagents[0]).toMatchObject({
            id: 'agent-a',
            status: 'reviewing',
            progressPercent: 100,
        });
        expect(deriveCouncilRuntimeStatus(updatedRuntime)).toBe('reviewing');
    });

    it('approves a reviewed draft and unlocks the subagent for help', () => {
        const runtime = submitCouncilDraftForReview(createRuntime(), 'agent-a', 42);

        const updatedRuntime = applyCouncilReviewDecision(runtime, {
            draftId: 'draft-a',
            decision: 'approve',
            chairmanAgentId: 'chair',
            decidedAt: 52,
        });

        expect(updatedRuntime.reviewQueue).toHaveLength(0);
        expect(updatedRuntime.decisions[0]).toMatchObject({
            draftId: 'draft-a',
            decision: 'approve',
            chairmanAgentId: 'chair',
            decidedAt: 52,
        });
        expect(updatedRuntime.subagents[0]).toMatchObject({
            id: 'agent-a',
            status: 'completed',
            helpAvailable: true,
            progressPercent: 100,
        });
    });

    it('reassigns a reviewed draft to a new model and reopens the agent workspace', () => {
        const runtime = submitCouncilDraftForReview(createRuntime(), 'agent-a', 42);

        const updatedRuntime = applyCouncilReviewDecision(runtime, {
            draftId: 'draft-a',
            decision: 'reassign-model',
            fallbackModel: {
                provider: 'copilot',
                model: 'gpt-5',
            },
        });

        expect(updatedRuntime.subagents[0]).toMatchObject({
            id: 'agent-a',
            status: 'working',
            provider: 'copilot',
            model: 'gpt-5',
            helpAvailable: false,
        });
        expect(deriveCouncilRuntimeStatus(updatedRuntime)).toBe('executing');
    });

    it('assigns a finished helper to another active stage', () => {
        const runtime = createRuntime();

        const updatedRuntime = assignCouncilAssist(runtime, {
            helperAgentId: 'agent-b',
            ownerAgentId: 'agent-a',
            createdAt: 88,
        });

        expect(updatedRuntime.assistEvents).toHaveLength(1);
        expect(updatedRuntime.assistEvents[0]).toMatchObject({
            helperAgentId: 'agent-b',
            ownerAgentId: 'agent-a',
            createdAt: 88,
        });
        expect(updatedRuntime.subagents[1]).toMatchObject({
            id: 'agent-b',
            status: 'assisting',
            helpAvailable: false,
            ownerStageId: 'agent-a',
        });
    });

    it('appends private and group discussion messages', () => {
        const runtime = createRuntime();

        const withGroupMessage = appendCouncilDiscussionMessage(runtime, {
            content: 'status sync',
            fromAgentId: 'chair',
            createdAt: 90,
        });
        const withPrivateMessage = appendCouncilDiscussionMessage(withGroupMessage, {
            content: 'focus auth path',
            fromAgentId: 'agent-a',
            toAgentId: 'agent-b',
            createdAt: 91,
        });

        expect(withPrivateMessage.messages).toHaveLength(2);
        expect(withPrivateMessage.messages[0]).toMatchObject({
            fromAgentId: 'chair',
            channel: 'group',
            content: 'status sync',
        });
        expect(withPrivateMessage.messages[1]).toMatchObject({
            fromAgentId: 'agent-a',
            toAgentId: 'agent-b',
            channel: 'private',
            content: 'focus auth path',
        });
    });
});
