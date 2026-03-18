import { useAuth } from '@renderer/context/AuthContext';
import { useWorkspaceAgentSessions } from '@renderer/features/workspace/hooks/useWorkspaceAgentSessions';
import { WorkspaceAgentComposer } from '@renderer/features/workspace/workspace-agent/WorkspaceAgentComposer';
import { WorkspaceAgentConversation } from '@renderer/features/workspace/workspace-agent/WorkspaceAgentConversation';
import { WorkspaceAgentCouncilBoard } from '@renderer/features/workspace/workspace-agent/WorkspaceAgentCouncilBoard';
import { WorkspaceAgentPanelHeader } from '@renderer/features/workspace/workspace-agent/WorkspaceAgentPanelHeader';
import { WorkspaceAgentSessionModal } from '@renderer/features/workspace/workspace-agent/WorkspaceAgentSessionModal';
import { motion } from '@renderer/lib/framer-motion-compat';
import React from 'react';

import { Language } from '@/i18n';
import type { Workspace } from '@/types';

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
            className="flex h-full min-w-0 flex-col overflow-hidden bg-black/[0.65] backdrop-blur-2xl"
        >
            <WorkspaceAgentPanelHeader
                recentSessions={panel.recentSessions}
                currentSession={panel.currentSession}
                onSelectSession={sessionId => void panel.selectSession(sessionId)}
                onArchiveSession={(sessionId, archived) =>
                    void panel.archiveSession(sessionId, archived)
                }
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
                        chatError={panel.chatError}
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
                <div className="flex flex-1 items-center justify-center px-8 text-center">
                    <div className="max-w-sm text-sm text-muted-foreground">
                        {t('agents.welcomeMessage')}
                    </div>
                </div>
            )}

            <WorkspaceAgentComposer
                currentSession={panel.currentSession}
                currentModes={panel.currentModes}
                currentPermissionPolicy={panel.currentPermissionPolicy}
                composerValue={panel.composerValue}
                setComposerValue={panel.setComposerValue}
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
                onClose={() => panel.setShowSessionPicker(false)}
                onSelectSession={sessionId => void panel.selectSession(sessionId)}
                onArchiveSession={(sessionId, archived) =>
                    void panel.archiveSession(sessionId, archived)
                }
                onRenameSession={(sessionId, title) =>
                    panel.renameSession(sessionId, title)
                }
                t={t}
            />
        </motion.div>
    );
};
