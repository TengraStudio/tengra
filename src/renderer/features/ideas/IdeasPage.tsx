/**
 * Main Ideas Page component with workflow state machine
 */
import type { IdeaSession, IdeaSessionConfig, ProjectIdea, ResearchData } from '@shared/types/ideas';
import type { Project } from '@shared/types/project';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/i18n';
import { appLogger } from '@/utils/renderer-logger';

import { DeleteConfirmation } from './components/DeleteConfirmation';
import { IdeasError } from './components/IdeasError';
import { useDeleteConfirmation } from './hooks/useDeleteConfirmation';
import { useWorkflowSync } from './hooks/useWorkflowSync';
import { exportIdeas } from './utils/exportIdeas';
import { IdeaDetailsModal, IdeasHeader, SessionHistory, WorkflowStages } from './components';
import { useIdeaApproval, useIdeaGeneration, useIdeaSession, useLogoGeneration } from './hooks';

interface IdeasPageProps { language: string; onNavigateToProject?: (projectId: string) => void; }

interface UseIdeasPageLogicOptions {
    currentSession: IdeaSession | null;
    ideas: ProjectIdea[];
    createSession: (config: IdeaSessionConfig) => Promise<IdeaSession | null>;
    startResearch: (id: string) => Promise<ResearchData | null>;
    startGeneration: (id: string) => Promise<void>;
    loadIdeas: (id: string) => Promise<void>;
    approveIdea: (id: string, path: string, name?: string) => Promise<Project | null>;
    rejectIdea: (id: string) => Promise<boolean>;
    archiveIdea: (id: string) => Promise<boolean>;
    onNavigateToProject?: (id: string) => void;
}

const useIdeasPageLogic = (options: UseIdeasPageLogicOptions) => {
    const { currentSession, ideas, createSession, startResearch, startGeneration, loadIdeas, approveIdea, rejectIdea, archiveIdea, onNavigateToProject } = options;
    const [workflowStage, setWorkflowStage] = useWorkflowSync(currentSession);
    const [selectedIdea, setSelectedIdea] = useState<ProjectIdea | null>(null);
    const [isRegenerating, setIsRegenerating] = useState(false);

    const handleCreateSession = useCallback(async (config: IdeaSessionConfig) => {
        const session = await createSession(config);
        if (session) {
            setWorkflowStage('research');
            if (await startResearch(session.id)) {
                setWorkflowStage('generation');
                await startGeneration(session.id);
                setWorkflowStage('review');
            }
        }
    }, [createSession, startResearch, startGeneration, setWorkflowStage]);

    const handleApprove = useCallback(async (projectPath: string, selectedName?: string) => {
        if (!selectedIdea || !currentSession?.id) {
            return;
        }
        try {
            const project = await approveIdea(selectedIdea.id, projectPath, selectedName);
            if (project) {
                setSelectedIdea(null);
                if (onNavigateToProject) {
                    onNavigateToProject(project.id);
                } else {
                    void loadIdeas(currentSession.id);
                }
            }
        } catch {
            void loadIdeas(currentSession.id);
        }
    }, [selectedIdea, approveIdea, currentSession, loadIdeas, onNavigateToProject]);

    const handleReject = useCallback(async () => {
        if (!selectedIdea || !currentSession?.id) {
            return;
        }
        try {
            if (await rejectIdea(selectedIdea.id)) {
                setSelectedIdea(null);
                void loadIdeas(currentSession.id);
            }
        } catch {
            void loadIdeas(currentSession.id);
        }
    }, [selectedIdea, rejectIdea, currentSession, loadIdeas]);

    const handleArchive = useCallback(async () => {
        if (!selectedIdea || !currentSession?.id) {
            return;
        }
        try {
            if (await archiveIdea(selectedIdea.id)) {
                setSelectedIdea(null);
                void loadIdeas(currentSession.id);
            }
        } catch {
            void loadIdeas(currentSession.id);
        }
    }, [selectedIdea, archiveIdea, currentSession, loadIdeas]);

    const handleRegenerateIdea = useCallback(async () => {
        if (!selectedIdea || !currentSession?.id) {
            return;
        }
        setIsRegenerating(true);
        try {
            const res = await window.electron.ideas.regenerateIdea(selectedIdea.id);
            if (res.success && res.idea) {
                void loadIdeas(currentSession.id);
                setSelectedIdea(res.idea);
            }
        } catch (err) {
            appLogger.error('IdeasPage', 'Regen failed', err as Error);
        } finally {
            setIsRegenerating(false);
        }
    }, [selectedIdea, currentSession, loadIdeas]);

    const handleExport = useCallback((format: 'markdown' | 'json') => {
        if (!currentSession || ideas.length === 0) {
            return;
        }
        try {
            exportIdeas(currentSession, ideas, format);
        } catch (err) {
            appLogger.error('IdeasPage', 'Export failed', err as Error);
        }
    }, [currentSession, ideas]);

    return { workflowStage, setWorkflowStage, selectedIdea, setSelectedIdea, isRegenerating, handleCreateSession, handleApprove, handleReject, handleArchive, handleRegenerateIdea, handleExport };
};

export const IdeasPage: React.FC<IdeasPageProps> = ({ language: _language, onNavigateToProject }) => {
    const { t } = useTranslation();
    const { sessions, currentSession, isLoading: isSessionLoading, error: sessionError, createSession, loadSessions, selectSession } = useIdeaSession();
    const { researchStage, researchProgress, researchMessage, isResearching, ideas, isGenerating, startResearch, startGeneration, loadIdeas, error: generationError } = useIdeaGeneration();
    const { isApproving, isRejecting, isArchiving, approveIdea, rejectIdea, archiveIdea, error: approvalError } = useIdeaApproval();
    const { canGenerateLogo } = useLogoGeneration();

    const logic = useIdeasPageLogic({ currentSession, ideas, createSession, startResearch, startGeneration, loadIdeas, approveIdea, rejectIdea, archiveIdea, onNavigateToProject });
    const { deleteConfirm, handleDeleteRequest, handleBulkDeleteRequest, closeDeleteConfirm, confirmDelete } = useDeleteConfirmation(loadIdeas, currentSession?.id, logic.selectedIdea, logic.setSelectedIdea);

    const cachedIdeas = useMemo(() => {
        return currentSession?.id ? ideas : [];
    }, [currentSession?.id, ideas]);

    const cachedSessions = useMemo(() => {
        return sessions.map(s => ({ ...s, ideaCount: s.maxIdeas, formattedDate: new Date(s.createdAt).toLocaleDateString() }));
    }, [sessions]);

    useEffect(() => {
        if (currentSession?.id) {
            void loadIdeas(currentSession.id).catch((err: Error) => {
                appLogger.error('IdeasPage', 'Failed to load ideas', err);
            });
        }
    }, [currentSession?.id, loadIdeas]);

    const handleSelectSession = useCallback(async (id: string) => {
        await selectSession(id);
        logic.setWorkflowStage('review');
    }, [selectSession, logic]);

    const handleDeleteConfirm = useCallback(async () => {
        await confirmDelete(async () => {
            if (deleteConfirm.type === 'idea' && deleteConfirm.id) {
                await window.electron.ideas.deleteIdea(deleteConfirm.id);
            } else if (deleteConfirm.type === 'bulk' && deleteConfirm.ids) {
                await Promise.all(deleteConfirm.ids.map(id => window.electron.ideas.deleteIdea(id)));
            }
        }, () => { });
    }, [confirmDelete, deleteConfirm]);

    const error = sessionError ?? generationError ?? approvalError;

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-4xl mx-auto p-6">
                <IdeasHeader workflowStage={logic.workflowStage} handleNewSession={() => { logic.setWorkflowStage('setup'); logic.setSelectedIdea(null); }} handleShowHistory={() => { void loadSessions(); logic.setWorkflowStage('history'); }} loadSessions={loadSessions} hasIdeas={ideas.length > 0} onExport={logic.handleExport} t={t} />
                <IdeasError error={error} />
                {logic.workflowStage === 'history' ? (
                    <SessionHistory sessions={cachedSessions} onSelectIdea={logic.setSelectedIdea} onSelectSession={(id: string) => { void handleSelectSession(id); }} onBulkDelete={handleBulkDeleteRequest} t={t} />
                ) : (
                    <WorkflowStages workflowStage={logic.workflowStage} currentSession={currentSession} researchStage={researchStage} researchProgress={researchProgress} researchMessage={researchMessage} isSessionLoading={isSessionLoading} isResearching={isResearching} isGenerating={isGenerating} ideas={cachedIdeas} setSelectedIdea={logic.setSelectedIdea} handleCreateSession={logic.handleCreateSession} startGeneration={startGeneration} setWorkflowStage={logic.setWorkflowStage} t={t} />
                )}
                {logic.selectedIdea && (
                    <IdeaDetailsModal idea={logic.selectedIdea} onClose={() => { logic.setSelectedIdea(null); }} onApprove={logic.handleApprove} onReject={logic.handleReject} onArchive={logic.handleArchive} onDelete={() => { if (logic.selectedIdea) { handleDeleteRequest(logic.selectedIdea.id); } }} onRegenerate={logic.handleRegenerateIdea} isApproving={isApproving} isRejecting={isRejecting} isArchiving={isArchiving} isRegenerating={logic.isRegenerating} canGenerateLogo={canGenerateLogo} />
                )}
                <DeleteConfirmation state={deleteConfirm} onClose={closeDeleteConfirm} onConfirm={handleDeleteConfirm} />
            </div>
        </div>
    );
};
