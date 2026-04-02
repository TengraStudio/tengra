import { WorkspaceAgentCouncilBoard } from '@renderer/features/workspace/components/workspace/WorkspaceAgentCouncilBoard';
import type {
    CouncilReviewDecision,
    CouncilSubagentRuntime,
    CouncilSubagentWorkspaceDraft,
    WorkspaceAgentSessionSummary,
} from '@shared/types/workspace-agent-session';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

function createSession(): WorkspaceAgentSessionSummary {
    return {
        id: 'session-1',
        workspaceId: 'workspace-1',
        title: 'Council Session',
        status: 'reviewing',
        updatedAt: Date.now(),
        createdAt: Date.now(),
        messageCount: 3,
        lastMessagePreview: 'preview',
        modes: {
            ask: false,
            plan: true,
            agent: true,
            council: true,
        },
        strategy: 'reasoning-first',
        permissionPolicy: {
            commandPolicy: 'allowlist',
            pathPolicy: 'workspace-root-only',
            allowedCommands: ['npm'],
            disallowedCommands: [],
            allowedPaths: ['c:/workspace'],
        },
        contextTelemetry: {
            model: 'sonnet',
            provider: 'claude',
            strategy: 'reasoning-first',
            contextWindow: 200_000,
            usedTokens: 50_000,
            remainingTokens: 150_000,
            usagePercent: 25,
            pressureState: 'low',
            handoffCount: 0,
        },
        councilConfig: {
            enabled: true,
            chairman: { mode: 'auto' },
            strategy: 'reasoning-first',
            requestedSubagentCount: 4,
            activeView: 'board',
        },
        background: false,
        archived: false,
    };
}

function createAgent(overrides?: Partial<CouncilSubagentRuntime>): CouncilSubagentRuntime {
    return {
        id: overrides?.id ?? 'agent-1',
        name: overrides?.name ?? 'Agent One',
        provider: overrides?.provider ?? 'claude',
        model: overrides?.model ?? 'sonnet',
        workspaceId: overrides?.workspaceId ?? 'sandbox-agent-1',
        status: overrides?.status ?? 'working',
        stageGoal: overrides?.stageGoal ?? 'Investigate auth',
        progressPercent: overrides?.progressPercent ?? 72,
        helpAvailable: overrides?.helpAvailable ?? false,
        ownerStageId: overrides?.ownerStageId,
    };
}

function createDraft(overrides?: Partial<CouncilSubagentWorkspaceDraft>): CouncilSubagentWorkspaceDraft {
    return {
        id: overrides?.id ?? 'draft-1',
        agentId: overrides?.agentId ?? 'agent-1',
        workspaceId: overrides?.workspaceId ?? 'sandbox-agent-1',
        baseRevision: overrides?.baseRevision ?? 'workspace-head',
        changedFiles: overrides?.changedFiles ?? ['src/auth.ts'],
        patchSummary: overrides?.patchSummary ?? 'Auth changes',
        riskFlags: overrides?.riskFlags ?? [],
        submittedAt: overrides?.submittedAt ?? 10,
    };
}

function createDecision(overrides?: Partial<CouncilReviewDecision>): CouncilReviewDecision {
    return {
        draftId: overrides?.draftId ?? 'draft-1',
        decision: overrides?.decision ?? 'reassign-model',
        chairmanAgentId: overrides?.chairmanAgentId ?? 'chair-1',
        note: overrides?.note ?? 'Escalate reasoning depth',
        decidedAt: overrides?.decidedAt ?? 20,
    };
}

describe('WorkspaceAgentCouncilBoard', () => {
    it('renders review decisions in the activity feed', () => {
        render(
            <WorkspaceAgentCouncilBoard
                session={createSession()}
                runtime={{
                    chairman: createAgent({
                        id: 'chair-1',
                        name: 'Chairman',
                        status: 'reviewing',
                        progressPercent: 100,
                    }),
                    subagents: [createAgent()],
                    drafts: [createDraft()],
                    reviewQueue: [],
                    decisions: [createDecision()],
                    assistEvents: [],
                    messages: [],
                }}
                proposal={[]}
                timeline={[]}
                onApprovePlan={vi.fn()}
                onSwitchView={vi.fn()}
                onSubmitDraft={vi.fn()}
                onReviewDraft={vi.fn()}
                onAssignAssist={vi.fn()}
                onSendMessage={vi.fn()}
                t={(key: string) => key}
            />
        );

        expect(screen.getByText('reassign-model')).toBeInTheDocument();
        expect(screen.getByText('Escalate reasoning depth')).toBeInTheDocument();
    });
});
