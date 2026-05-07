/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useWorkspaceAgentSessions } from '@/features/workspace/hooks/useWorkspaceAgentSessions';
import { WorkspaceAgentComposer } from '@/features/workspace/workspace-agent/WorkspaceAgentComposer';
import { WorkspaceAgentConversation } from '@/features/workspace/workspace-agent/WorkspaceAgentConversation';
import { WorkspaceAgentCouncilBoard } from '@/features/workspace/workspace-agent/WorkspaceAgentCouncilBoard';
import { WorkspaceAgentPanelHeader } from '@/features/workspace/workspace-agent/WorkspaceAgentPanelHeader';
import { WorkspaceAgentSessionModal } from '@/features/workspace/workspace-agent/WorkspaceAgentSessionModal';
import { Language } from '@/i18n';
import { motion } from '@/lib/framer-motion-compat';
import type { Workspace } from '@/types';
import { formatRelativeTime } from '@/utils/format.util';

interface AIAssistantSidebarProps {
    workspace: Workspace;
    t: (key: string) => string;
    language: Language;
    onSourceClick?: ((path: string) => void) | undefined;
}

export const AIAssistantSidebar: React.FC<AIAssistantSidebarProps> = ({
    workspace,
    t,
    language,
    onSourceClick,
}) => {
    const { quotas, codexUsage, settings } = useAuth();
    const panel = useWorkspaceAgentSessions({ workspace, language });

    const handleRetry = React.useCallback(() => {
        const lastUserMessage = [...panel.currentMessages]
            .reverse()
            .find(message => message.role === 'user');
        if (!lastUserMessage) {
            return;
        }

        panel.setComposerValue(
            typeof lastUserMessage.content === 'string'
                ? lastUserMessage.content
                : ''
        );
    }, [panel]);

    return (
        <motion.div
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 18 }}
            className="flex h-full min-w-3 flex-col overflow-hidden bg-background backdrop-blur-2xl"
        >
            <WorkspaceAgentPanelHeader
                currentSession={panel.currentSession}
                onArchiveSession={(sessionId, archived) =>
                    void panel.archiveSession(sessionId, archived)
                }
                onDeleteSession={sessionId => void panel.deleteSession(sessionId)}
                onOpenSessionPicker={() => panel.setShowSessionPicker(true)}
                onCreateSession={() => void panel.openEmptySession()}
                t={t}
            />

            {panel.currentSession ? (
                panel.currentModes.council ? (
                    <WorkspaceAgentCouncilBoard
                        session={panel.currentSession}
                        runtime={panel.currentCouncilRuntime}
                        proposal={panel.currentCouncilState.proposal}
                        timeline={panel.currentCouncilState.timeline}
                        onApprovePlan={() => void panel.approvePlan()}
                        onSwitchView={view => void panel.switchCouncilView(view)}
                        onSubmitDraft={agentId => void panel.submitDraft(agentId)}
                        onReviewDraft={(draftId, decision) =>
                            void panel.reviewDraft(draftId, decision)
                        }
                        onAssignAssist={(helperAgentId, ownerAgentId) =>
                            void panel.assignAssist(helperAgentId, ownerAgentId)
                        }
                        onSendMessage={(content, fromAgentId, toAgentId) =>
                            void panel.sendDiscussionMessage(content, fromAgentId, toAgentId)
                        }
                        t={t}
                    />
                ) : (
                    <WorkspaceAgentConversation
                        session={panel.currentSession}
                        messages={panel.currentMessages}
                        language={language}
                        isLoading={panel.isLoading}
                        streamingContent={panel.currentStreamingState?.content}
                        streamingReasoning={panel.currentStreamingState?.reasoning}
                        streamingSpeed={panel.currentStreamingState?.speed}
                        streamingToolCalls={panel.currentStreamingState?.toolCalls}
                        chatError={panel.chatError}
                        selectedProvider={panel.selectedProvider}
                        selectedModel={panel.selectedModel}
                        modes={panel.currentModes}
                        proposal={panel.currentCouncilState.proposal}
                        timeline={panel.currentCouncilState.timeline}
                        onRetry={handleRetry}
                        onApprovePlan={() => void panel.approvePlan()}
                        onSourceClick={onSourceClick}
                        t={t}
                    />
                )
            ) : (
                <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-3 py-6">
                    <div className="w-full max-w-md space-y-5 text-center">
                        <div className="space-y-2">
                            <div className="text-sm text-muted-foreground">
                                {t('frontend.agents.welcomeMessage')}
                            </div>
                        </div>

                        {panel.recentSessions.length > 0 ? (
                            <section className="space-y-2 text-left">
                                <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                    <span>Recent sessions</span>
                                    <span>{panel.recentSessions.length}</span>
                                </div>
                                <div className="space-y-1.5">
                                    {panel.recentSessions.map(session => (
                                        <button
                                            key={session.id}
                                            type="button"
                                            onClick={() => void panel.selectSession(session.id)}
                                            className="flex w-full items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2 text-left transition-colors hover:bg-accent/30"
                                        >
                                            <div className="min-w-0">
                                                <div className="truncate text-sm text-foreground">{session.title}</div>
                                                <div className="truncate text-xs text-muted-foreground">
                                                    {session.lastMessagePreview || session.strategy}
                                                </div>
                                            </div>
                                            <div className="ml-3 shrink-0 text-xs text-muted-foreground">
                                                {formatRelativeTime(new Date(session.createdAt), language)}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        ) : null}
                    </div>
                </div>
            )}

            <WorkspaceAgentComposer
                currentSession={panel.currentSession}
                currentModes={panel.currentModes}
                currentPermissionPolicy={panel.currentPermissionPolicy}
                composerValue={panel.composerValue}
                setComposerValue={panel.setComposerValue}
                deliveryMode={panel.deliveryMode}
                setDeliveryMode={panel.setDeliveryMode}
                queuedMessageCount={panel.queuedMessageCount}
                onSend={() => void panel.handleSend()}
                onStop={() => void panel.stopGeneration()}
                onToggleCouncil={() => void panel.toggleCouncil()}
                onSelectPreset={preset => void panel.selectPreset(preset)}
                showCouncilSetup={panel.showCouncilSetup}
                councilSetup={panel.councilSetup}
                setCouncilSetup={panel.setCouncilSetup}
                onApplyCouncilSetup={() => void panel.applyCouncilSetup()}
                onUpdatePermissionPolicy={panel.updateEffectivePermissions}
                isLoading={panel.isLoading}
                selectedProvider={panel.selectedProvider}
                selectedModel={panel.selectedModel}
                groupedModels={panel.groupedModels}
                setSelectedProvider={panel.setSelectedProvider}
                setSelectedModel={panel.setSelectedModel}
                persistLastSelection={panel.persistLastSelection}
                settings={settings ?? undefined}
                quotas={quotas}
                codexUsage={codexUsage}
                t={t}
            />

            <WorkspaceAgentSessionModal
                isOpen={panel.showSessionPicker}
                sessions={panel.sessions}
                currentSessionId={panel.currentSessionId}
                language={language}
                onClose={() => panel.setShowSessionPicker(false)}
                onSelectSession={sessionId => void panel.selectSession(sessionId)}
                onArchiveSession={(sessionId, archived) =>
                    void panel.archiveSession(sessionId, archived)
                }
                onDeleteSession={sessionId => void panel.deleteSession(sessionId)}
                onRenameSession={(sessionId, title) =>
                    panel.renameSession(sessionId, title)
                }
                t={t}
            />
        </motion.div>
    );
};

