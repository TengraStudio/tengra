/**
 * Main Ideas Page component with workflow state machine
 */
import { IdeaSession, IdeaSessionConfig, IdeaSessionStatus, ProjectIdea } from '@shared/types/ideas';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { useTranslation } from '@/i18n';

import {
    IdeaDetailsModal,
    IdeasHeader,
    SessionHistory,
    WorkflowStages
} from './components';
import { useIdeaApproval, useIdeaGeneration, useIdeaSession, useLogoGeneration } from './hooks';
import { WorkflowStage } from './types';

const IdeasError: React.FC<{ error: string | null }> = ({ error }) => {
    if (!error) {
        return null;
    }
    return (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive font-medium flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            {error}
        </div>
    );
};

/**
 * Custom hook to sync workflow stage with current session status.
 * Uses the adjustment during render pattern to avoid useEffect cascading renders.
 */
function useWorkflowSync(currentSession: IdeaSession | null) {
    const [workflowStage, setWorkflowStage] = useState<WorkflowStage>('setup');
    const [prevSessionId, setPrevSessionId] = useState<string | undefined>(undefined);
    const [prevStatus, setPrevStatus] = useState<IdeaSessionStatus | undefined>(undefined);

    if (currentSession?.id !== prevSessionId || currentSession?.status !== prevStatus) {
        setPrevSessionId(currentSession?.id);
        setPrevStatus(currentSession?.status);
        if (currentSession?.status) {
            const nextStage: WorkflowStage =
                currentSession.status === 'completed'
                    ? 'review'
                    : currentSession.status === 'generating'
                        ? 'generation'
                        : 'research';
            setWorkflowStage(nextStage);
        } else if (!currentSession) {
            setWorkflowStage('setup');
        }
    }

    return [workflowStage, setWorkflowStage] as const;
}

interface IdeasPageProps {
    language: string
    /** Callback to navigate to a newly created project */
    onNavigateToProject?: (projectId: string) => void
}

export const IdeasPage: React.FC<IdeasPageProps> = ({ language: _language, onNavigateToProject }) => {
    const { t } = useTranslation();

    // Hooks
    const {
        sessions,
        currentSession,
        isLoading: isSessionLoading,
        error: sessionError,
        createSession,
        loadSessions,
        selectSession
    } = useIdeaSession();

    const {
        researchStage,
        researchProgress,
        researchMessage,
        isResearching,
        ideas,
        isGenerating,
        startResearch,
        startGeneration,
        loadIdeas,
        error: generationError
    } = useIdeaGeneration();

    const { isApproving, isRejecting, isArchiving, approveIdea, rejectIdea, archiveIdea, error: approvalError } = useIdeaApproval();
    const { canGenerateLogo } = useLogoGeneration();

    // State management
    const [workflowStage, setWorkflowStage] = useWorkflowSync(currentSession);
    const [selectedIdea, setSelectedIdea] = useState<ProjectIdea | null>(null);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id?: string; type: 'idea' | 'session' | 'bulk'; ids?: string[] }>({
        isOpen: false,
        type: 'idea'
    });

    // Cached data to avoid repeated fetches
    const cachedIdeas = useMemo(() => {
        if (!currentSession?.id) { return []; }
        return ideas;
    }, [currentSession?.id, ideas]);

    const cachedSessions = useMemo(() => {
        return sessions.map(session => ({
            ...session,
            // Cache session metadata
            ideaCount: session.maxIdeas ?? 0,
            formattedDate: new Date(session.createdAt).toLocaleDateString()
        }));
    }, [sessions]);

    // Load ideas when session changes
    useEffect(() => {
        if (currentSession?.id) {
            void loadIdeas(currentSession.id);
        }
    }, [currentSession?.id, loadIdeas]);

    // Handle session creation
    const handleCreateSession = useCallback(
        async (config: IdeaSessionConfig) => {
            const session = await createSession(config);
            if (session) {
                setWorkflowStage('research');
                const researchData = await startResearch(session.id);
                if (researchData) {
                    setWorkflowStage('generation');
                    await startGeneration(session.id);
                    setWorkflowStage('review');
                }
            }
        },
        [createSession, startResearch, startGeneration, setWorkflowStage]
    );

    // Handle approval with optimistic update
    const handleApprove = useCallback(
        async (projectPath: string, selectedName?: string) => {
            if (!selectedIdea || !currentSession?.id) {
                return;
            }

            // Optimistic update: assume approval will succeed
            const optimisticIdea = { ...selectedIdea, status: 'approved' as const };
            setSelectedIdea(optimisticIdea);

            try {
                const project = await approveIdea(selectedIdea.id, projectPath, selectedName);
                if (project) {
                    setSelectedIdea(null);
                    // Navigate to the newly created project
                    if (onNavigateToProject) {
                        onNavigateToProject(project.id);
                    } else {
                        // Fallback: just reload ideas if no navigation callback provided
                        void loadIdeas(currentSession.id);
                    }
                }
            } catch {
                // Rollback on error
                setSelectedIdea(selectedIdea);
                void loadIdeas(currentSession.id);
            }
        },
        [selectedIdea, approveIdea, currentSession, loadIdeas, onNavigateToProject]
    );

    // Handle rejection with optimistic update
    const handleReject = useCallback(async () => {
        if (!selectedIdea || !currentSession?.id) {
            return;
        }

        // Optimistic update
        const optimisticIdea = { ...selectedIdea, status: 'rejected' as const };
        setSelectedIdea(optimisticIdea);

        try {
            const success = await rejectIdea(selectedIdea.id);
            if (success) {
                setSelectedIdea(null);
                void loadIdeas(currentSession.id);
            }
        } catch {
            setSelectedIdea(selectedIdea);
            void loadIdeas(currentSession.id);
        }
    }, [selectedIdea, rejectIdea, currentSession, loadIdeas]);

    // Handle archive with optimistic update
    const handleArchive = useCallback(async () => {
        if (!selectedIdea || !currentSession?.id) {
            return;
        }

        // Optimistic update
        const optimisticIdea = { ...selectedIdea, status: 'archived' as const };
        setSelectedIdea(optimisticIdea);

        try {
            const success = await archiveIdea(selectedIdea.id);
            if (success) {
                setSelectedIdea(null);
                void loadIdeas(currentSession.id);
            }
        } catch {
            setSelectedIdea(selectedIdea);
            void loadIdeas(currentSession.id);
        }
    }, [selectedIdea, archiveIdea, currentSession, loadIdeas]);

    // Handle delete requests
    const handleDeleteRequest = useCallback((id: string) => {
        setDeleteConfirm({ isOpen: true, type: 'idea', id });
    }, []);

    const handleBulkDeleteRequest = useCallback((ids: string[]) => {
        setDeleteConfirm({ isOpen: true, type: 'bulk', ids });
    }, []);

    const confirmDelete = useCallback(async () => {
        if (!currentSession?.id) { return; }

        try {
            if (deleteConfirm.type === 'idea' && deleteConfirm.id) {
                await window.electron.ideas.deleteIdea(deleteConfirm.id);
                if (selectedIdea?.id === deleteConfirm.id) { setSelectedIdea(null); }
            } else if (deleteConfirm.type === 'bulk' && deleteConfirm.ids) {
                await Promise.all(deleteConfirm.ids.map(id => window.electron.ideas.deleteIdea(id)));
            }
            void loadIdeas(currentSession.id);
        } catch (err) {
            console.error('Failed to delete:', err);
        } finally {
            setDeleteConfirm({ isOpen: false, type: 'idea' });
        }
    }, [currentSession, deleteConfirm, loadIdeas, selectedIdea]);

    // Reset to start new session
    const handleNewSession = useCallback(() => {
        setWorkflowStage('setup');
        setSelectedIdea(null);
    }, [setWorkflowStage]);

    // Show history view
    const handleShowHistory = useCallback(() => {
        void loadSessions();
        setWorkflowStage('history');
    }, [setWorkflowStage, loadSessions]);

    // Select session from history
    const handleSelectSession = useCallback(async (sessionId: string) => {
        await selectSession(sessionId);
        setWorkflowStage('review');
    }, [selectSession, setWorkflowStage]);

    // Export ideas to file
    const handleExportIdeas = useCallback(async (format: 'markdown' | 'json') => {
        if (!currentSession || ideas.length === 0) {
            return;
        }

        try {
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `ideas-${currentSession.id}-${timestamp}.${format === 'markdown' ? 'md' : 'json'}`;

            let content: string;

            if (format === 'markdown') {
                content = `# Project Ideas - ${new Date().toLocaleDateString()}\n\n`;
                content += `**Session ID:** ${currentSession.id}\n`;
                content += `**Total Ideas:** ${ideas.length}\n\n`;
                content += `---\n\n`;

                ideas.forEach((idea, idx) => {
                    const statusEmoji = idea.status === 'approved' ? '✅' : idea.status === 'rejected' ? '❌' : '⏳';
                    content += `## ${idx + 1}. ${idea.title} ${statusEmoji}\n\n`;
                    content += `**Category:** ${idea.category}\n`;
                    content += `**Status:** ${idea.status}\n\n`;
                    content += `${idea.description}\n\n`;

                    if (idea.marketResearch) {
                        content += `### Market Analysis\n${idea.marketResearch.categoryAnalysis ?? ''}\n\n`;
                    }

                    if (idea.techStack) {
                        content += `### Tech Stack\n`;
                        const stack = idea.techStack;
                        if (stack.frontend.length) { content += `- Frontend: ${stack.frontend.map(t => t.name).join(', ')}\n`; }
                        if (stack.backend.length) { content += `- Backend: ${stack.backend.map(t => t.name).join(', ')}\n`; }
                        content += '\n';
                    }

                    content += `---\n\n`;
                });
            } else {
                // JSON format
                const exportData = {
                    exportedAt: new Date().toISOString(),
                    sessionId: currentSession.id,
                    totalIdeas: ideas.length,
                    ideas: ideas.map(idea => ({
                        id: idea.id,
                        title: idea.title,
                        description: idea.description,
                        category: idea.category,
                        status: idea.status,
                        marketResearch: idea.marketResearch,
                        techStack: idea.techStack,
                        createdAt: idea.createdAt
                    }))
                };
                content = JSON.stringify(exportData, null, 2);
            }

            // Create blob and download
            const blob = new Blob([content], {
                type: format === 'markdown' ? 'text/markdown' : 'application/json'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to export ideas:', err);
        }
    }, [currentSession, ideas]);

    // Regenerate idea
    const handleRegenerateIdea = useCallback(async () => {
        if (!selectedIdea) {
            return;
        }

        setIsRegenerating(true);
        try {
            const response = await window.electron.ideas.regenerateIdea(selectedIdea.id);
            if (response.success && response.idea && currentSession) {
                // Reload ideas to get the updated one
                void loadIdeas(currentSession.id);
                // Update selected idea with new data
                setSelectedIdea(response.idea);
            }
        } catch (err) {
            console.error('Failed to regenerate idea:', err);
        } finally {
            setIsRegenerating(false);
        }
    }, [selectedIdea, currentSession, loadIdeas]);

    const error = sessionError ?? generationError ?? approvalError;

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-4xl mx-auto p-6">
                <IdeasHeader
                    workflowStage={workflowStage}
                    handleNewSession={handleNewSession}
                    handleShowHistory={handleShowHistory}
                    loadSessions={loadSessions}
                    hasIdeas={ideas.length > 0}
                    onExport={(format) => void handleExportIdeas(format)}
                    t={t}
                />

                <IdeasError error={error} />

                {workflowStage === 'history' ? (
                    <SessionHistory
                        sessions={cachedSessions}
                        onSelectIdea={setSelectedIdea}
                        onSelectSession={(id) => void handleSelectSession(id)}
                        onBulkDelete={handleBulkDeleteRequest}
                        t={t}
                    />
                ) : (
                    <WorkflowStages
                        workflowStage={workflowStage}
                        currentSession={currentSession}
                        researchStage={researchStage}
                        researchProgress={researchProgress}
                        researchMessage={researchMessage}
                        isSessionLoading={isSessionLoading}
                        isResearching={isResearching}
                        isGenerating={isGenerating}
                        ideas={cachedIdeas}
                        setSelectedIdea={setSelectedIdea}
                        handleCreateSession={handleCreateSession}
                        startGeneration={startGeneration}
                        setWorkflowStage={setWorkflowStage}
                        t={t}
                    />
                )}

                {selectedIdea && (
                    <IdeaDetailsModal
                        idea={selectedIdea}
                        onClose={() => setSelectedIdea(null)}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        onArchive={handleArchive}
                        onDelete={() => handleDeleteRequest(selectedIdea.id)}
                        onRegenerate={handleRegenerateIdea}
                        isApproving={isApproving}
                        isRejecting={isRejecting}
                        isArchiving={isArchiving}
                        isRegenerating={isRegenerating}
                        canGenerateLogo={canGenerateLogo}
                    />
                )}

                <ConfirmationModal
                    isOpen={deleteConfirm.isOpen}
                    onClose={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })}
                    onConfirm={() => void confirmDelete()}
                    title={deleteConfirm.type === 'idea' ? 'Delete Idea' : 'Delete Multiple Ideas'}
                    message={
                        deleteConfirm.type === 'idea'
                            ? 'Are you sure you want to delete this idea? This action cannot be undone.'
                            : `Are you sure you want to delete ${deleteConfirm.ids?.length ?? 0} ideas? This action cannot be undone.`
                    }
                    confirmLabel="Delete"
                    variant="danger"
                />
            </div>
        </div>
    );
};
