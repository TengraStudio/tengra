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
    WorkspaceAgentContextTelemetry,
    WorkspaceAgentSessionModes,
    WorkspaceAgentSessionSummary,
} from '@shared/types/workspace-agent-session';
import { IconClipboardCheck, IconHierarchy, IconMessage2, IconSparkles } from '@tabler/icons-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { readAiPresentationMetadata } from '@/features/chat/components/message/message-presentation.util';
import { MessageList } from '@/features/chat/components/MessageList';
import { Language } from '@/i18n';
import type { ChatError, Message } from '@/types';

import { ChatErrorBanner } from './ChatErrorBanner';

interface WorkspaceAgentConversationProps {
    session: WorkspaceAgentSessionSummary | null;
    messages: Message[];
    language: Language;
    isLoading: boolean;
    streamingContent?: string;
    streamingReasoning?: string;
    streamingSpeed?: number | null;
    streamingToolCalls?: Message['toolCalls'];
    chatError: ChatError | null;
    selectedProvider: string;
    selectedModel: string;
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
        <div className="rounded-md border border-border/60 bg-background px-3 py-2">
            <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Active model
                </div>
                <div className="text-sm text-muted-foreground">
                    {Math.round(telemetry.usagePercent)}%
                </div>
            </div>
            <div className="mt-1 text-sm text-foreground">
                {telemetry.provider} / {telemetry.model}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
                Context {telemetry.usedTokens} / {telemetry.contextWindow} · {telemetry.pressureState}
                {telemetry.handoffCount > 0
                    ? ` · handoffs ${telemetry.handoffCount}`
                    : ''}
            </div>
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
                    <div className="rounded-md border border-border/60 bg-muted/50 px-2 py-1 text-sm text-muted-foreground">
                        {step.status}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function TimelineCard({ event }: { event: AgentEventRecord }): JSX.Element {
    return (
        <div className="rounded-md border border-border/60 bg-background px-3 py-2">
            <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {event.type}
                </div>
                <div className="text-sm text-muted-foreground">
                    {event.timestamp.toLocaleTimeString()}
                </div>
            </div>
            <div className="mt-1 text-sm text-foreground">
                {event.stateBeforeTransition} → {event.stateAfterTransition}
            </div>
        </div>
    );
}

export const WorkspaceAgentConversation: React.FC<WorkspaceAgentConversationProps> = ({
    session,
    messages,
    language,
    isLoading,
    streamingContent,
    streamingReasoning,
    streamingSpeed,
    streamingToolCalls,
    chatError,
    selectedProvider,
    selectedModel,
    modes,
    proposal,
    timeline,
    onRetry,
    onApprovePlan,
    onSourceClick,
    t,
}) => {
    // The store's messages already receive real-time streaming updates via
    // onMessageUpdated → updateChatCollection, so we use them directly.
    // A synthetic overlay is only needed when streaming data arrives before
    // the placeholder message has been persisted into the store.
    const liveMessages = React.useMemo(() => {
        if (!isLoading) {
            return messages;
        }

        const lastMessage = messages[messages.length - 1];
        const lastIsAssistantWithContent =
            lastMessage?.role === 'assistant' &&
            (
                (typeof lastMessage.content === 'string' && lastMessage.content.trim().length > 0) ||
                (typeof lastMessage.reasoning === 'string' && lastMessage.reasoning.trim().length > 0) ||
                (Array.isArray(lastMessage.toolCalls) && lastMessage.toolCalls.length > 0)
            );

        // If the store already has a populated assistant message, use it directly.
        if (lastIsAssistantWithContent) {
            return messages;
        }

        // Fallback: streaming data arrived but the store placeholder is still empty.
        // Overlay the streaming state onto the placeholder (or append if missing).
        const hasStreamingPayload =
            (typeof streamingContent === 'string' && streamingContent.length > 0) ||
            (typeof streamingReasoning === 'string' && streamingReasoning.length > 0) ||
            (Array.isArray(streamingToolCalls) && streamingToolCalls.length > 0);

        if (!hasStreamingPayload) {
            return messages;
        }

        const overlay: Partial<Message> = {
            content: streamingContent ?? '',
            reasoning: streamingReasoning && streamingReasoning.trim().length > 0 ? streamingReasoning : undefined,
            reasonings: streamingReasoning && streamingReasoning.trim().length > 0 ? [streamingReasoning] : undefined,
            toolCalls: Array.isArray(streamingToolCalls) && streamingToolCalls.length > 0 ? streamingToolCalls : undefined,
        };

        if (lastMessage?.role === 'assistant') {
            const nextMessages = [...messages];
            nextMessages[nextMessages.length - 1] = { ...lastMessage, ...overlay };
            return nextMessages;
        }

        // No assistant placeholder yet — append a synthetic one.
        return [
            ...messages,
            {
                id: `workspace-streaming-${session?.id ?? 'draft'}`,
                role: 'assistant' as const,
                ...overlay,
                content: overlay.content ?? '',
                timestamp: new Date(),
                provider: selectedProvider,
                model: selectedModel,
            },
        ];
    }, [
        isLoading,
        messages,
        selectedModel,
        selectedProvider,
        session?.id,
        streamingContent,
        streamingReasoning,
        streamingToolCalls,
    ]);

    const visibleMessages = React.useMemo(
        () =>
            liveMessages.filter(message => {
                if (message.role !== 'assistant') {
                    return true;
                }
                const hasText = typeof message.content === 'string' && message.content.trim().length > 0;
                const hasReasoning = typeof message.reasoning === 'string' && message.reasoning.trim().length > 0;
                const hasReasonings = Array.isArray(message.reasonings) && message.reasonings.length > 0;
                const hasToolCalls = Array.isArray(message.toolCalls) && message.toolCalls.length > 0;
                const hasToolResults = Array.isArray(message.toolResults) && message.toolResults.length > 0;
                const aiPresentation = readAiPresentationMetadata(
                    message,
                    typeof message.content === 'string' ? message.content : '',
                    streamingReasoning,
                    language,
                    isLoading
                );
                const hasPresentationReasoning = Boolean(aiPresentation?.hasReasoning);
                const hasPresentationTools =
                    (aiPresentation?.toolCallCount ?? 0) > 0 ||
                    (aiPresentation?.toolResultCount ?? 0) > 0;
                return (
                    hasText ||
                    hasReasoning ||
                    hasReasonings ||
                    hasToolCalls ||
                    hasToolResults ||
                    hasPresentationReasoning ||
                    hasPresentationTools ||
                    isLoading
                );
            }),
        [isLoading, language, liveMessages, streamingReasoning]
    );

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 min-h-0 overflow-hidden bg-background px-2 py-3 sm:px-3">
                {chatError && <ChatErrorBanner errorKind={chatError.kind} onRetry={onRetry} />}

                {visibleMessages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-4 rounded-md border border-dashed border-border/70 bg-accent/10 px-6 text-center">
                        <div className="rounded-md border border-border/60 bg-background p-3 text-muted-foreground">
                            {modes.plan ? <IconHierarchy className="h-5 w-5" /> : <IconMessage2 className="h-5 w-5" />}
                        </div>
                        <div className="max-w-sm space-y-2">
                            <div className="text-sm font-medium text-foreground">
                                {currentEmptyTitle(modes)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {currentEmptyDescription(modes)}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex h-full min-h-0 flex-col gap-4">
                        {session?.contextTelemetry && (
                            <TelemetryCard telemetry={session.contextTelemetry} />
                        )}

                        <div className="min-h-0 flex-1 p-0">
                            <MessageList
                                messages={visibleMessages}
                                streamingReasoning={streamingReasoning}
                                streamingSpeed={streamingSpeed ?? null}
                                isLoading={isLoading}
                                language={language}
                                selectedProvider={selectedProvider}
                                selectedModel={selectedModel}
                                onSpeak={() => {}} // TODO: Connect speech
                                onStopSpeak={() => {}}
                                speakingMessageId={null}
                                onAtBottomStateChange={() => {}}
                                onSourceClick={onSourceClick}
                            />
                        </div>

                        {modes.plan && proposal.length > 0 && (
                            <div className="space-y-3 rounded-md border border-border/60 bg-accent/10 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                        <IconHierarchy className="h-4 w-4 text-info" />
                                        Plan
                                    </div>
                                    <Button variant="secondary" size="sm" onClick={onApprovePlan}>
                                        <IconClipboardCheck className="mr-1.5 h-4 w-4" />
                                        Approve plan
                                    </Button>
                                </div>
                                {proposal.map((step, index) => (
                                    <PlanCard key={step.id} step={step} index={index} />
                                ))}
                            </div>
                        )}

                        {timeline.length > 0 && (
                            <div className="grid gap-3">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Activity
                                </div>
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

function currentEmptyTitle(modes: WorkspaceAgentSessionModes): string {
    if (modes.council) {
        return 'Council session is ready';
    }
    if (modes.plan) {
        return 'Plan mode is active';
    }
    if (modes.agent) {
        return 'Agent mode is active';
    }
    return 'Ask about this workspace';
}

function currentEmptyDescription(modes: WorkspaceAgentSessionModes): string {
    if (modes.council) {
        return 'Open council setup below to assign roles, or send a task to start the session.';
    }
    if (modes.plan) {
        return 'Send a task and the agent will produce an ordered plan before making changes.';
    }
    if (modes.agent) {
        return 'Send a task and the agent can inspect files, reason about the codebase, and execute the workflow.';
    }
    return 'Send a question to inspect code, explain files, or prepare a task for this workspace.';
}

