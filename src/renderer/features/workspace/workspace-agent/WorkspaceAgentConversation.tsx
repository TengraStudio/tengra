import { MessageBubble } from '@renderer/features/chat/components/MessageBubble';
import type { AgentEventRecord } from '@shared/types/agent-state';
import type { WorkspaceStep } from '@shared/types/council';
import type {
    WorkspaceAgentContextTelemetry,
    WorkspaceAgentSessionModes,
    WorkspaceAgentSessionSummary,
} from '@shared/types/workspace-agent-session';
import { ClipboardCheck, Sparkles, Workflow } from 'lucide-react';
import React from 'react';
import { Virtuoso } from 'react-virtuoso';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Language } from '@/i18n';
import type { ChatError, Message } from '@/types';

import { ChatErrorBanner } from './ChatErrorBanner';

interface WorkspaceAgentConversationProps {
    session: WorkspaceAgentSessionSummary | null;
    messages: Message[];
    language: Language;
    isLoading: boolean;
    chatError: ChatError | null;
    modes: WorkspaceAgentSessionModes;
    proposal: WorkspaceStep[];
    timeline: AgentEventRecord[];
    onRetry: () => void;
    onApprovePlan: () => void;
    onSourceClick?: ((path: string) => void) | undefined;
    t: (key: string) => string;
}

function TelemetryCard({
    telemetry,
}: {
    telemetry: WorkspaceAgentContextTelemetry;
}): JSX.Element | null {
    if (telemetry.handoffCount === 0 && telemetry.pressureState === 'low') {
        return null;
    }

    return (
        <div className="rounded-2xl border border-border/50 bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-info">
                    {telemetry.provider} · {telemetry.model}
                </div>
                <div className="text-xxs text-muted-foreground">
                    {Math.round(telemetry.usagePercent)}%
                </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
                {telemetry.pressureState} · {telemetry.usedTokens} / {telemetry.contextWindow}
            </div>
            {telemetry.handoffCount > 0 && (
                <div className="mt-1 text-xs text-muted-foreground">
                    {telemetry.handoffCount}x · {telemetry.lastHandoffLabel ?? telemetry.model}
                </div>
            )}
        </div>
    );
}

function PlanCard({
    step,
    index,
}: {
    step: WorkspaceStep;
    index: number;
}): JSX.Element {
    return (
        <Card className="border-border/50 bg-card/70">
            <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-foreground">
                        {index + 1}. {step.text}
                    </div>
                    <div className="rounded-full border border-border/60 bg-muted/30 px-2 py-1 text-xxs uppercase tracking-wide text-muted-foreground">
                        {step.status}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function TimelineCard({ event }: { event: AgentEventRecord }): JSX.Element {
    return (
        <div className="rounded-2xl border border-border/50 bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-info">
                    {event.type}
                </div>
                <div className="text-xxs text-muted-foreground">
                    {event.timestamp.toLocaleTimeString()}
                </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
                {event.stateBeforeTransition} → {event.stateAfterTransition}
            </div>
        </div>
    );
}

function ConversationMessageList({
    isLoading,
    language,
    messages,
    onSourceClick,
}: {
    isLoading: boolean;
    language: Language;
    messages: Message[];
    onSourceClick?: ((path: string) => void) | undefined;
}): JSX.Element {
    return (
        <Virtuoso
            style={{ height: '100%', width: '100%' }}
            data={messages}
            followOutput={isLoading ? 'smooth' : 'auto'}
            alignToBottom={true}
            initialTopMostItemIndex={Math.max(messages.length - 1, 0)}
            computeItemKey={_index => messages[_index].id || `msg-${_index}`}
            itemContent={(index, message) => (
                <div className="px-2 pb-2 sm:px-3 sm:pb-3">
                    <div className="mx-auto w-full max-w-full">
                        <MessageBubble
                            message={message}
                            isLast={index === messages.length - 1}
                            language={language}
                            backend={message.provider}
                            isStreaming={Boolean(
                                isLoading &&
                                    index === messages.length - 1 &&
                                    message.role === 'assistant'
                            )}
                            onSourceClick={onSourceClick}
                            footerConfig={{
                                showTimestamp: true,
                                showModel: true,
                                showTokens: false,
                                showResponseTime: false,
                            }}
                        />
                    </div>
                </div>
            )}
        />
    );
}

export const WorkspaceAgentConversation: React.FC<WorkspaceAgentConversationProps> = ({
    session,
    messages,
    language,
    isLoading,
    chatError,
    modes,
    proposal,
    timeline,
    onRetry,
    onApprovePlan,
    onSourceClick,
    t,
}) => {
    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 min-h-0 overflow-hidden px-2 py-3 sm:px-3">
                {chatError && <ChatErrorBanner errorKind={chatError.kind} onRetry={onRetry} />}

                {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                        <div className="rounded-full border border-info/20 bg-info/10 p-4 text-info">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <div className="max-w-xs text-sm text-muted-foreground">
                            {t('agents.welcomeMessage')}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col h-full space-y-4">
                        {session?.contextTelemetry && (
                            <TelemetryCard telemetry={session.contextTelemetry} />
                        )}

                        <div className="flex-1 min-h-0">
                            <ConversationMessageList
                                messages={messages}
                                language={language}
                                isLoading={isLoading}
                                onSourceClick={onSourceClick}
                            />
                        </div>

                        {modes.plan && proposal.length > 0 && (
                            <div className="space-y-3 rounded-3xl border border-border/50 bg-card/70 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                        <Workflow className="h-4 w-4 text-info" />
                                        {t('agents.plan')}
                                    </div>
                                    <Button variant="secondary" size="sm" onClick={onApprovePlan}>
                                        <ClipboardCheck className="mr-1.5 h-4 w-4" />
                                        {t('common.confirm')}
                                    </Button>
                                </div>
                                {proposal.map((step, index) => (
                                    <PlanCard key={step.id} step={step} index={index} />
                                ))}
                            </div>
                        )}

                        {timeline.length > 0 && (
                            <div className="grid gap-3">
                                {timeline.slice(-6).map(event => (
                                    <TimelineCard key={event.id} event={event} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

