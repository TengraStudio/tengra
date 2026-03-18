/**
 * Hook for managing idea research and generation pipeline
 */
import {
    IdeaProgress,
    ResearchData,
    ResearchProgress,
    ResearchStage,
    WorkspaceIdea} from '@shared/types/ideas';
import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';

interface UseIdeaGenerationReturn {
    // Research state
    researchStage: ResearchStage
    researchProgress: number
    researchMessage: string
    researchData: ResearchData | null
    isResearching: boolean

    // Generation state
    ideas: WorkspaceIdea[]
    generationProgress: IdeaProgress | null
    isGenerating: boolean

    // Actions
    startResearch: (sessionId: string) => Promise<ResearchData | null>
    startGeneration: (sessionId: string) => Promise<void>
    enrichIdea: (ideaId: string) => Promise<WorkspaceIdea | null>
    loadIdeas: (sessionId?: string) => Promise<void>

    // Error handling
    error: string | null
    clearError: () => void
}

export function useIdeaGeneration(): UseIdeaGenerationReturn {
    const { t } = useTranslation();
    // Research state
    const [researchStage, setResearchStage] = useState<ResearchStage>('idle');
    const [researchProgress, setResearchProgress] = useState(0);
    const [researchMessage, setResearchMessage] = useState('');
    const [researchData, setResearchData] = useState<ResearchData | null>(null);
    const [isResearching, setIsResearching] = useState(false);

    // Generation state
    const [ideas, setIdeas] = useState<WorkspaceIdea[]>([]);
    const [generationProgress, setGenerationProgress] = useState<IdeaProgress | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // Error state
    const [error, setError] = useState<string | null>(null);
    const resolveErrorMessage = useCallback((err: Error | { messageKey?: string; messageParams?: Record<string, string | number> } | null | undefined, fallbackKey: string): string => {
        const errorWithI18n = err as {
            messageKey?: string;
            messageParams?: Record<string, string | number>;
        };
        if (typeof errorWithI18n.messageKey === 'string' && errorWithI18n.messageKey.length > 0) {
            return t(errorWithI18n.messageKey, errorWithI18n.messageParams);
        }
        if (err instanceof Error) {
            return err.message.startsWith('ideas.') || err.message.startsWith('errors.')
                ? t(err.message)
                : err.message;
        }
        return t(fallbackKey);
    }, [t]);

    // Set up event listeners for progress updates
    useEffect(() => {
        const handleResearchProgress = (progress: ResearchProgress) => {
            setResearchStage(progress.stage);
            setResearchProgress(progress.progress);
            setResearchMessage(progress.message ?? '');
        };

        const handleIdeaProgress = (progress: IdeaProgress) => {
            setGenerationProgress(progress);
            if (progress.currentIdea?.id) {
                const newIdea = progress.currentIdea as WorkspaceIdea;
                setIdeas(prev => {
                    const existing = prev.find(i => i.id === newIdea.id);
                    if (existing) {
                        return prev.map(i => i.id === newIdea.id ? newIdea : i);
                    }
                    return [...prev, newIdea];
                });
            }
        };

        const unsubscribeResearch = window.electron.ideas.onResearchProgress(handleResearchProgress);
        const unsubscribeIdea = window.electron.ideas.onIdeaProgress(handleIdeaProgress);

        return () => {
            unsubscribeResearch();
            unsubscribeIdea();
        };
    }, [t]);

    const startResearch = useCallback(async (sessionId: string): Promise<ResearchData | null> => {
        setIsResearching(true);
        setError(null);
        setResearchStage('understanding');
        setResearchProgress(0);
        setResearchMessage('');

        try {
            const result = await window.electron.ideas.startResearch(sessionId);
            if (result.success && result.data) {
                setResearchData(result.data);
                setResearchStage('complete');
                setResearchProgress(100);
                return result.data;
            }
            throw new Error(t('ideas.errors.researchFailed'));
        } catch (err) {
            const message = resolveErrorMessage(err as Error | { messageKey?: string; messageParams?: Record<string, string | number> }, 'ideas.errors.researchFailed');
            setError(message);
            setResearchStage('idle');
            return null;
        } finally {
            setIsResearching(false);
        }
    }, [resolveErrorMessage, t]);

    const startGeneration = useCallback(async (sessionId: string): Promise<void> => {
        setIsGenerating(true);
        setError(null);
        setIdeas([]);
        setGenerationProgress(null);

        try {
            const result = await window.electron.ideas.startGeneration(sessionId);
            if (!result.success) {
                throw new Error(t('ideas.errors.generationFailed'));
            }
        } catch (err) {
            const message = resolveErrorMessage(err as Error | { messageKey?: string; messageParams?: Record<string, string | number> }, 'ideas.errors.generationFailed');
            setError(message);
        } finally {
            setIsGenerating(false);
        }
    }, [resolveErrorMessage, t]);

    const enrichIdea = useCallback(async (ideaId: string): Promise<WorkspaceIdea | null> => {
        setError(null);
        try {
            const result = await window.electron.ideas.enrichIdea(ideaId);
            if (result.success && result.data) {
                const enrichedIdea = result.data;
                setIdeas(prev => prev.map(i => i.id === ideaId ? enrichedIdea : i));
                return enrichedIdea;
            }
            throw new Error(t('ideas.errors.enrichmentFailed'));
        } catch (err) {
            const message = resolveErrorMessage(err as Error | { messageKey?: string; messageParams?: Record<string, string | number> }, 'ideas.errors.enrichmentFailed');
            setError(message);
            return null;
        }
    }, [resolveErrorMessage, t]);

    const loadIdeas = useCallback(async (sessionId?: string): Promise<void> => {
        setError(null);
        try {
            const loadedIdeas = await window.electron.ideas.getIdeas(sessionId);
            setIdeas(loadedIdeas);
        } catch (err) {
            const message = resolveErrorMessage(err as Error | { messageKey?: string; messageParams?: Record<string, string | number> }, 'ideas.errors.loadIdeasFailed');
            setError(message);
        }
    }, [resolveErrorMessage]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        researchStage,
        researchProgress,
        researchMessage,
        researchData,
        isResearching,
        ideas,
        generationProgress,
        isGenerating,
        startResearch,
        startGeneration,
        enrichIdea,
        loadIdeas,
        error,
        clearError
    };
}
