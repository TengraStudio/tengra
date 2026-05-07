/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { AgentEventRecord } from '@shared/types/agent-state';
import type { WorkspaceStep } from '@shared/types/council';
import type {
    CouncilAssistEvent,
    CouncilInterAgentMessage,
    CouncilReviewDecision,
    CouncilRunConfig,
    CouncilSubagentRuntime,
    CouncilSubagentWorkspaceDraft,
    WorkspaceAgentSessionSummary,
} from '@shared/types/workspace-agent-session';
import { IconArrowRight, IconCircleCheck, IconGitBranch, IconHierarchy,IconLayoutRows, IconMap, IconMessages, IconSparkles, IconUserCog } from '@tabler/icons-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTheme } from '@/hooks/useTheme';
import { resolveCssColorVariable, resolveCssVariableStyle, resolveCssVariableValue } from '@/lib/theme-css';
import { cn } from '@/lib/utils';

interface SessionCouncilRuntime {
    chairman?: CouncilSubagentRuntime;
    subagents: CouncilSubagentRuntime[];
    drafts: CouncilSubagentWorkspaceDraft[];
    reviewQueue: CouncilSubagentWorkspaceDraft[];
    decisions: CouncilReviewDecision[];
    assistEvents: CouncilAssistEvent[];
    messages: CouncilInterAgentMessage[];
}

interface WorkspaceAgentCouncilBoardProps {
    session: WorkspaceAgentSessionSummary;
    runtime: SessionCouncilRuntime;
    proposal: WorkspaceStep[];
    timeline: AgentEventRecord[];
    onApprovePlan: () => void;
    onSwitchView: (view: CouncilRunConfig['activeView']) => void;
    onSubmitDraft: (agentId: string) => void;
    onReviewDraft: (
        draftId: string,
        decision: CouncilReviewDecision['decision']
    ) => void;
    onAssignAssist: (helperAgentId: string, ownerAgentId: string) => void;
    onSendMessage: (content: string, fromAgentId: string, toAgentId?: string) => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}

function AgentCanvas({
    chairman,
    subagents,
    drafts,
    assistEvents,
    messages,
    decisions,
    t,
}: {
    chairman?: CouncilSubagentRuntime;
    subagents: CouncilSubagentRuntime[];
    drafts: CouncilSubagentWorkspaceDraft[];
    assistEvents: CouncilAssistEvent[];
    messages: CouncilInterAgentMessage[];
    decisions: CouncilReviewDecision[];
    t: (key: string, options?: Record<string, string | number>) => string;
}): JSX.Element {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const { theme } = useTheme();

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }
        const context = canvas.getContext('2d');
        if (!context) {
            return;
        }

        const width = canvas.width;
        const height = canvas.height;
        const boardBackground = resolveCssColorVariable('council-board-bg', 'hsl(222 27% 8%)');
        const orbitColor = resolveCssColorVariable('council-board-orbit', 'hsl(189 94% 43% / 0.35)');
        const connectionColor = resolveCssColorVariable('council-board-connection', 'hsl(0 0% 100% / 0.14)');
        const chairFillColor = resolveCssColorVariable('council-board-chair-fill', 'hsl(189 94% 43%)');
        const chairTextColor = resolveCssColorVariable('council-board-chair-text', 'hsl(190 100% 92%)');
        const agentFillColor = resolveCssColorVariable('council-board-agent-fill', 'hsl(141 76% 73%)');
        const helperFillColor = resolveCssColorVariable('council-board-helper-fill', 'hsl(38 92% 50%)');
        const agentTextColor = resolveCssColorVariable('council-board-agent-text', 'hsl(210 40% 98%)');
        const assistStrokeColor = resolveCssColorVariable('council-board-assist-stroke', 'hsl(38 92% 50% / 0.65)');
        const draftStrokeColor = resolveCssColorVariable('council-board-draft-stroke', 'hsl(300 76% 53% / 0.65)');
        const approveStrokeColor = resolveCssColorVariable('council-board-approve-stroke', 'hsl(141 76% 73% / 0.7)');
        const rejectStrokeColor = resolveCssColorVariable('council-board-reject-stroke', 'hsl(0 93% 73% / 0.7)');
        const reviseStrokeColor = resolveCssColorVariable('council-board-revise-stroke', 'hsl(48 96% 64% / 0.7)');
        const messageStrokeColor = resolveCssColorVariable('council-board-message-stroke', 'hsl(197 97% 61% / 0.35)');
        const boardFontFamily = resolveCssVariableStyle('fontFamily', 'font-family', 'sans-serif');
        const boardFontSize = resolveCssVariableValue('text-sm', '0.75rem');

        context.clearRect(0, 0, width, height);
        context.fillStyle = boardBackground;
        context.fillRect(0, 0, width, height);

        const centerX = width / 2;
        const centerY = height / 2;
        const orbit = Math.min(width, height) / 3;
        const nodePositions = new globalThis.Map<string, { x: number; y: number }>();

        context.strokeStyle = orbitColor;
        context.lineWidth = 1;
        context.beginPath();
        context.arc(centerX, centerY, orbit, 0, Math.PI * 2);
        context.stroke();

        context.fillStyle = chairFillColor;
        context.beginPath();
        context.arc(centerX, centerY, 20, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = chairTextColor;
        context.font = `500 ${boardFontSize} ${boardFontFamily}`;
        context.textAlign = 'center';
        context.fillText(chairman?.name ?? t('frontend.workspaceAgent.chairmanFallback'), centerX, centerY + 40);
        nodePositions.set(chairman?.id ?? 'chairman', { x: centerX, y: centerY });

        subagents.forEach((agent, index) => {
            const angle = (Math.PI * 2 * index) / Math.max(1, subagents.length);
            const x = centerX + Math.cos(angle) * orbit;
            const y = centerY + Math.sin(angle) * orbit;
            nodePositions.set(agent.id, { x, y });
            context.strokeStyle = connectionColor;
            context.beginPath();
            context.moveTo(centerX, centerY);
            context.lineTo(x, y);
            context.stroke();
            context.fillStyle = agent.helpAvailable ? helperFillColor : agentFillColor;
            context.beginPath();
            context.arc(x, y, 14, 0, Math.PI * 2);
            context.fill();
            context.fillStyle = agentTextColor;
            context.fillText(agent.name, x, y + 28);
        });

        assistEvents.forEach(event => {
            const owner = nodePositions.get(event.ownerAgentId);
            const helper = nodePositions.get(event.helperAgentId);
            if (!owner || !helper) {
                return;
            }
            context.strokeStyle = assistStrokeColor;
            context.lineWidth = 2;
            context.beginPath();
            context.moveTo(helper.x, helper.y);
            context.lineTo(owner.x, owner.y);
            context.stroke();
        });

        drafts.forEach(draft => {
            const source = nodePositions.get(draft.agentId);
            if (!source) {
                return;
            }
            context.strokeStyle = draftStrokeColor;
            context.lineWidth = 2;
            context.beginPath();
            context.moveTo(source.x, source.y);
            context.lineTo(centerX, centerY);
            context.stroke();
        });

        decisions.forEach(decision => {
            const draft = drafts.find(candidate => candidate.id === decision.draftId);
            const source = draft ? nodePositions.get(draft.agentId) : null;
            if (!source) {
                return;
            }
            context.strokeStyle =
                decision.decision === 'approve'
                    ? approveStrokeColor
                    : decision.decision === 'reject'
                        ? rejectStrokeColor
                        : reviseStrokeColor;
            context.setLineDash([4, 6]);
            context.beginPath();
            context.moveTo(centerX, centerY);
            context.lineTo(source.x, source.y);
            context.stroke();
            context.setLineDash([]);
        });

        messages.slice(-6).forEach(message => {
            if (!message.toAgentId) {
                return;
            }
            const from = nodePositions.get(message.fromAgentId);
            const to = nodePositions.get(message.toAgentId);
            if (!from || !to) {
                return;
            }
            context.strokeStyle = messageStrokeColor;
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(from.x, from.y);
            context.lineTo(to.x, to.y);
            context.stroke();
        });
    }, [assistEvents, chairman, decisions, drafts, messages, subagents, t, theme]);

    return (
        <canvas
            ref={canvasRef}
            width={560}
            height={280}
            className="w-full rounded-3xl border border-border/50 bg-background/90"
        />
    );
}

function AgentCard({
    agent,
    draftQueued,
    onSubmitDraft,
    t,
}: {
    agent: CouncilSubagentRuntime;
    draftQueued: boolean;
    onSubmitDraft: (agentId: string) => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}): JSX.Element {
    return (
        <Card className="border-border/50 bg-card/70">
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">
                            {agent.name}
                        </div>
                        <div className="mt-1 typo-caption text-muted-foreground">
                            {agent.provider} · {agent.model}
                        </div>
                    </div>
                    <Badge variant="outline" className="border-border/60 bg-muted/30 text-sm">
                        {agent.status}
                    </Badge>
                </div>
                <div className="mt-3 space-y-2 typo-caption text-muted-foreground">
                    <div className="inline-flex items-center gap-1">
                        <IconGitBranch className="h-3.5 w-3.5" />
                        {agent.workspaceId}
                    </div>
                    <div>{agent.stageGoal}</div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-accent/40">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-info/70 via-accent/70 to-success/70"
                            style={{ width: `${agent.progressPercent}%` }}
                        />
                    </div>
                </div>
                {!draftQueued && agent.status !== 'completed' && agent.status !== 'reviewing' && (
                    <div className="mt-3">
                        <Button
                            size="sm"
                            variant="secondary"
                            className="w-full"
                            onClick={() => void onSubmitDraft(agent.id)}
                        >
                            <IconCircleCheck className="mr-1.5 h-4 w-4" />
                            {t('common.update')}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function ReviewQueueCard({
    drafts,
    onReviewDraft,
    t,
}: {
    drafts: CouncilSubagentWorkspaceDraft[];
    onReviewDraft: (
        draftId: string,
        decision: CouncilReviewDecision['decision']
    ) => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}): JSX.Element {
    return (
        <Card className="border-border/50 bg-card/70">
            <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <IconSparkles className="h-4 w-4 text-accent-foreground" />
                    {t('frontend.workspaceAgent.reviewQueue')}
                </div>
                <div className="mt-3 space-y-2">
                    {drafts.length > 0 ? (
                        drafts.map(draft => (
                            <div key={draft.id} className="rounded-2xl border border-border/50 bg-muted/30 p-3">
                                <div className="text-sm text-foreground">{draft.workspaceId}</div>
                                <div className="mt-1 typo-caption text-muted-foreground">
                                    {t('frontend.workspaceAgent.filesCount', { count: draft.changedFiles.length })} ·{' '}
                                    {draft.patchSummary || draft.baseRevision}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => void onReviewDraft(draft.id, 'approve')}
                                    >
                                        {t('common.confirm')}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => void onReviewDraft(draft.id, 'reject')}
                                    >
                                        {t('common.cancel')}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => void onReviewDraft(draft.id, 'revise')}
                                    >
                                        {t('common.retry')}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => void onReviewDraft(draft.id, 'reassign-model')}
                                    >
                                        {t('common.update')}
                                    </Button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-sm text-muted-foreground">
                            {t('common.pending')}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function AssistQueueCard({
    helpers,
    targets,
    onAssignAssist,
    t,
}: {
    helpers: CouncilSubagentRuntime[];
    targets: CouncilSubagentRuntime[];
    onAssignAssist: (helperAgentId: string, ownerAgentId: string) => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}): JSX.Element {
    return (
        <Card className="border-border/50 bg-card/70">
            <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <IconArrowRight className="h-4 w-4 text-info" />
                    {t('frontend.workspaceAgent.assistQueue')}
                </div>
                <div className="mt-3 space-y-3">
                    {helpers.length > 0 && targets.length > 0 ? (
                        helpers.map(helper => (
                            <div key={helper.id} className="rounded-2xl border border-border/50 bg-muted/30 p-3">
                                <div className="text-sm text-foreground">{helper.name}</div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {targets
                                        .filter(target => target.id !== helper.id)
                                        .map(target => (
                                            <Button
                                                key={`${helper.id}-${target.id}`}
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => void onAssignAssist(helper.id, target.id)}
                                            >
                                                {target.name}
                                            </Button>
                                        ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-sm text-muted-foreground">
                            {t('common.pending')}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function ActivityFeedCard({
    runtime,
    timeline,
    onSendMessage,
    t,
}: {
    runtime: SessionCouncilRuntime;
    timeline: AgentEventRecord[];
    onSendMessage: (content: string, fromAgentId: string, toAgentId?: string) => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}): JSX.Element {
    const participants = React.useMemo(
        () => [runtime.chairman, ...runtime.subagents].filter(Boolean) as CouncilSubagentRuntime[],
        [runtime.chairman, runtime.subagents]
    );
    const [messageAuthorId, setMessageAuthorId] = React.useState(
        runtime.chairman?.id ?? runtime.subagents[0]?.id ?? ''
    );
    const [messageTargetId, setMessageTargetId] = React.useState('group');
    const [messageValue, setMessageValue] = React.useState('');

    React.useEffect(() => {
        if (participants.some(agent => agent.id === messageAuthorId)) {
            return;
        }
        setMessageAuthorId(runtime.chairman?.id ?? runtime.subagents[0]?.id ?? '');
    }, [messageAuthorId, participants, runtime.chairman?.id, runtime.subagents]);

    const handleSend = React.useCallback(() => {
        if (!messageAuthorId || !messageValue.trim()) {
            return;
        }
        onSendMessage(
            messageValue,
            messageAuthorId,
            messageTargetId === 'group' ? undefined : messageTargetId
        );
        setMessageValue('');
        setMessageTargetId('group');
    }, [messageAuthorId, messageTargetId, messageValue, onSendMessage]);

    return (
        <Card className="border-border/50 bg-card/70">
            <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <IconMessages className="h-4 w-4 text-warning" />
                    {t('frontend.workspaceAgent.activity')}
                </div>
                <div className="mt-3 space-y-2">
                    {runtime.messages.slice(-4).map(message => (
                        <div key={message.id} className="rounded-2xl border border-border/50 bg-muted/30 p-3">
                            <div className="text-sm text-muted-foreground">
                                {message.fromAgentId}
                            </div>
                            <div className="mt-1 text-sm text-foreground">{message.content}</div>
                        </div>
                    ))}
                    {runtime.assistEvents.slice(-3).map(event => (
                        <div key={event.id} className="rounded-2xl border border-border/50 bg-muted/30 p-3 text-sm text-foreground">
                            <div className="inline-flex items-center gap-2">
                                <IconArrowRight className="h-4 w-4 text-info" />
                                {event.summary}
                            </div>
                        </div>
                    ))}
                    {runtime.decisions.slice(-4).map(decision => (
                        <div key={`${decision.draftId}-${decision.decidedAt}`} className="rounded-2xl border border-border/50 bg-muted/30 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-sm text-muted-foreground">
                                    {decision.draftId}
                                </div>
                                <Badge variant="outline" className="border-border/60 bg-muted/40 text-sm">
                                    {decision.decision}
                                </Badge>
                            </div>
                            {decision.note && (
                                <div className="mt-1 text-sm text-foreground">{decision.note}</div>
                            )}
                        </div>
                    ))}
                    {timeline.slice(-3).map(event => (
                        <div key={event.id} className="rounded-2xl border border-border/50 bg-muted/30 p-3">
                            <div className="text-sm text-muted-foreground">
                                {event.type}
                            </div>
                            <div className="mt-1 text-sm text-foreground">
                                {event.stateBeforeTransition}
                                <span className={cn('mx-1 text-muted-foreground')}>→</span>
                                {event.stateAfterTransition}
                            </div>
                        </div>
                    ))}
                </div>

                {participants.length > 0 && (
                    <div className="mt-4 rounded-2xl border border-border/50 bg-muted/30 p-3">
                        <div className="grid gap-2 md:grid-cols-2">
                            <Select value={messageAuthorId} onValueChange={setMessageAuthorId}>
                                <SelectTrigger className="h-10 rounded-2xl border-border/60 bg-muted/40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {participants.map(agent => (
                                        <SelectItem key={agent.id} value={agent.id}>
                                            {agent.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={messageTargetId} onValueChange={setMessageTargetId}>
                                <SelectTrigger className="h-10 rounded-2xl border-border/60 bg-muted/40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="group">{t('frontend.agents.council')}</SelectItem>
                                    {participants
                                        .filter(agent => agent.id !== messageAuthorId)
                                        .map(agent => (
                                            <SelectItem key={agent.id} value={agent.id}>
                                                {agent.name}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Textarea
                            value={messageValue}
                            onChange={event => setMessageValue(event.target.value)}
                            className="mt-2 min-h-24 rounded-2xl border-border/60 bg-muted/40"
                        />
                        <div className="mt-2 flex justify-end">
                            <Button size="sm" variant="secondary" onClick={handleSend}>
                                {t('common.send')}
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export const WorkspaceAgentCouncilBoard: React.FC<WorkspaceAgentCouncilBoardProps> = ({
    session,
    runtime,
    proposal,
    timeline,
    onApprovePlan,
    onSwitchView,
    onSubmitDraft,
    onReviewDraft,
    onAssignAssist,
    onSendMessage,
    t,
}) => {
    const activeView = session.councilConfig?.activeView ?? 'board';
    const availableHelpers = runtime.subagents.filter(agent => agent.helpAvailable);
    const activeTargets = runtime.subagents.filter(agent => agent.status !== 'completed');

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
            <div className="rounded-3xl border border-border/50 bg-info/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <IconUserCog className="h-4 w-4 text-info" />
                            {runtime.chairman?.name ?? t('frontend.workspaceAgent.chairmanFallback')}
                        </div>
                        <div className="mt-1 typo-caption text-muted-foreground">
                            {runtime.chairman?.provider ?? session.strategy} ·{' '}
                            {runtime.chairman?.model ?? session.usageStats?.model ?? t('frontend.workspaceAgent.sessionFallback')}
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Button
                            variant={activeView === 'board' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => void onSwitchView('board')}
                        >
                            <IconLayoutRows className="mr-1.5 h-4 w-4" />
                            {t('frontend.workspaceAgent.boardView')}
                        </Button>
                        <Button
                            variant={activeView === 'map' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => void onSwitchView('map')}
                        >
                            <IconMap className="mr-1.5 h-4 w-4" />
                            {t('frontend.workspaceAgent.mapView')}
                        </Button>
                    </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div className="space-y-4">
                        {activeView === 'map' ? (
                            <AgentCanvas
                                chairman={runtime.chairman}
                                subagents={runtime.subagents}
                                drafts={runtime.drafts}
                                assistEvents={runtime.assistEvents}
                                messages={runtime.messages}
                                decisions={runtime.decisions}
                                t={t}
                            />
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2">
                                {runtime.subagents.map(agent => (
                                    <AgentCard
                                        key={agent.id}
                                        agent={agent}
                                        draftQueued={runtime.reviewQueue.some(draft => draft.agentId === agent.id)}
                                        onSubmitDraft={onSubmitDraft}
                                        t={t}
                                    />
                                ))}
                            </div>
                        )}

                        <Card className="border-border/50 bg-card/70">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                        <IconHierarchy className="h-4 w-4 text-info" />
                                        {t('frontend.agents.taskRouting')}
                                    </div>
                                    {proposal.length > 0 && (
                                        <Button size="sm" variant="secondary" onClick={onApprovePlan}>
                                            <IconCircleCheck className="mr-1.5 h-4 w-4" />
                                            {t('common.confirm')}
                                        </Button>
                                    )}
                                </div>
                                <div className="mt-3 space-y-2">
                                    {proposal.length > 0 ? (
                                        proposal.map((step, index) => (
                                            <div key={step.id} className="rounded-2xl border border-border/50 bg-muted/30 p-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="text-sm text-foreground">
                                                        {index + 1}. {step.text}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {step.status}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-sm text-muted-foreground">
                                            {t('frontend.agents.waitingActivity')}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-4">
                        <ReviewQueueCard
                            drafts={runtime.reviewQueue}
                            onReviewDraft={onReviewDraft}
                            t={t}
                        />

                        <AssistQueueCard
                            helpers={availableHelpers}
                            targets={activeTargets}
                            onAssignAssist={onAssignAssist}
                            t={t}
                        />

                        <ActivityFeedCard
                            runtime={runtime}
                            timeline={timeline}
                            onSendMessage={onSendMessage}
                            t={t}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};


