import { IdeaSession, IdeaSessionConfig, WorkspaceIdea } from '@shared/types/ideas';
import { useCallback, useState } from 'react';

import type { Workspace } from '@/types';

import { WorkflowStage } from '../types';

interface IdeasHandlersOptions {
    currentSession: IdeaSession | null;
    loadIdeas: (sessionId: string) => Promise<void>;
    createSession: (config: IdeaSessionConfig) => Promise<IdeaSession | null>;
    startResearch: (sessionId: string) => Promise<import('@shared/types/ideas').ResearchData | null>;
    startGeneration: (sessionId: string) => Promise<boolean>;
    approveIdea: (ideaId: string, workspacePath: string, selectedName?: string) => Promise<Workspace | null>;
    rejectIdea: (ideaId: string) => Promise<boolean>;
    archiveIdea: (ideaId: string) => Promise<boolean>;
    setWorkflowStage: (stage: WorkflowStage) => void;
    onNavigateToWorkspace?: (workspaceId: string) => void;
}

export function useIdeasHandlers({
    currentSession, loadIdeas, createSession, startResearch, startGeneration,
    approveIdea, rejectIdea, archiveIdea, setWorkflowStage, onNavigateToWorkspace
}: IdeasHandlersOptions) {
    const [selectedIdea, setSelectedIdea] = useState<WorkspaceIdea | null>(null);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id?: string; type: 'idea' | 'session' | 'bulk'; ids?: string[] }>({
        isOpen: false,
        type: 'idea'
    });

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

    const handleApprove = useCallback(async (workspacePath: string, selectedName?: string) => {
        if (!selectedIdea || !currentSession?.id) { return; }
        const originalIdea = selectedIdea;
        setSelectedIdea({ ...selectedIdea, status: 'approved' });
        try {
            const workspace = await approveIdea(selectedIdea.id, workspacePath, selectedName);
            if (workspace) {
                setSelectedIdea(null);
                if (onNavigateToWorkspace) {
                    onNavigateToWorkspace(workspace.id);
                } else {
                    void loadIdeas(currentSession.id);
                }
            }
        } catch {
            setSelectedIdea(originalIdea);
        }
    }, [selectedIdea, approveIdea, currentSession, loadIdeas, onNavigateToWorkspace]);

    const handleReject = useCallback(async () => {
        if (!selectedIdea || !currentSession?.id) { return; }
        const originalIdea = selectedIdea;
        setSelectedIdea({ ...selectedIdea, status: 'rejected' });
        try {
            if (await rejectIdea(selectedIdea.id)) {
                setSelectedIdea(null);
                void loadIdeas(currentSession.id);
            }
        } catch {
            setSelectedIdea(originalIdea);
        }
    }, [selectedIdea, rejectIdea, currentSession, loadIdeas]);

    const handleArchive = useCallback(async () => {
        if (!selectedIdea || !currentSession?.id) { return; }
        const originalIdea = selectedIdea;
        setSelectedIdea({ ...selectedIdea, status: 'archived' });
        try {
            if (await archiveIdea(selectedIdea.id)) {
                setSelectedIdea(null);
                void loadIdeas(currentSession.id);
            }
        } catch {
            setSelectedIdea(originalIdea);
        }
    }, [selectedIdea, archiveIdea, currentSession, loadIdeas]);

    const handleRegenerateIdea = useCallback(async () => {
        if (!selectedIdea || !currentSession) { return; }
        setIsRegenerating(true);
        try {
            const response = await window.electron.ideas.regenerateIdea(selectedIdea.id);
            if (response.success && response.idea) {
                void loadIdeas(currentSession.id);
                setSelectedIdea(response.idea);
            }
        } finally {
            setIsRegenerating(false);
        }
    }, [selectedIdea, currentSession, loadIdeas]);

    const confirmDelete = useCallback(async () => {
        if (!currentSession?.id) { return; }
        try {
            if (deleteConfirm.type === 'idea' && deleteConfirm.id) {
                await window.electron.ideas.deleteIdea(deleteConfirm.id);
                if (selectedIdea?.id === deleteConfirm.id) {
                    setSelectedIdea(null);
                }
            } else if (deleteConfirm.type === 'bulk' && deleteConfirm.ids) {
                await Promise.all(deleteConfirm.ids.map(id => window.electron.ideas.deleteIdea(id)));
            }
            void loadIdeas(currentSession.id);
        } finally {
            setDeleteConfirm({ isOpen: false, type: 'idea' });
        }
    }, [currentSession, deleteConfirm, loadIdeas, selectedIdea]);

    return {
        selectedIdea, setSelectedIdea, isRegenerating, deleteConfirm, setDeleteConfirm,
        handleCreateSession, handleApprove, handleReject, handleArchive, handleRegenerateIdea, confirmDelete, startGeneration
    };
}
