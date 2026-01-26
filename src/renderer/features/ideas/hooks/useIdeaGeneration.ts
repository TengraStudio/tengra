/**
 * Hook for managing idea research and generation pipeline
 */
import {
    IdeaProgress,
    ProjectIdea,
    ResearchData,
    ResearchProgress,
    ResearchStage
} from '@shared/types/ideas';
import { useCallback, useEffect, useState } from 'react';

interface UseIdeaGenerationReturn {
    // Research state
    researchStage: ResearchStage
    researchProgress: number
    researchMessage: string
    researchData: ResearchData | null
    isResearching: boolean

    // Generation state
    ideas: ProjectIdea[]
    generationProgress: IdeaProgress | null
    isGenerating: boolean

    // Actions
    startResearch: (sessionId: string) => Promise<ResearchData | null>
    startGeneration: (sessionId: string) => Promise<void>
    enrichIdea: (ideaId: string) => Promise<ProjectIdea | null>
    loadIdeas: (sessionId?: string) => Promise<void>

    // Error handling
    error: string | null
    clearError: () => void
}

export function useIdeaGeneration(): UseIdeaGenerationReturn {
    // Research state
    const [researchStage, setResearchStage] = useState<ResearchStage>('idle');
    const [researchProgress, setResearchProgress] = useState(0);
    const [researchMessage, setResearchMessage] = useState('');
    const [researchData, setResearchData] = useState<ResearchData | null>(null);
    const [isResearching, setIsResearching] = useState(false);

    // Generation state
    const [ideas, setIdeas] = useState<ProjectIdea[]>([]);
    const [generationProgress, setGenerationProgress] = useState<IdeaProgress | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // Error state
    const [error, setError] = useState<string | null>(null);

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
                const newIdea = progress.currentIdea as ProjectIdea;
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
    }, []);

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
            throw new Error('Research failed');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Research failed';
            setError(message);
            setResearchStage('idle');
            return null;
        } finally {
            setIsResearching(false);
        }
    }, []);

    const startGeneration = useCallback(async (sessionId: string): Promise<void> => {
        setIsGenerating(true);
        setError(null);
        setIdeas([]);
        setGenerationProgress(null);

        try {
            const result = await window.electron.ideas.startGeneration(sessionId);
            if (!result.success) {
                throw new Error('Generation failed');
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Generation failed';
            setError(message);
        } finally {
            setIsGenerating(false);
        }
    }, []);

    const enrichIdea = useCallback(async (ideaId: string): Promise<ProjectIdea | null> => {
        setError(null);
        try {
            const result = await window.electron.ideas.enrichIdea(ideaId);
            if (result.success && result.data) {
                const enrichedIdea = result.data;
                setIdeas(prev => prev.map(i => i.id === ideaId ? enrichedIdea : i));
                return enrichedIdea;
            }
            throw new Error('Enrichment failed');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Enrichment failed';
            setError(message);
            return null;
        }
    }, []);

    const loadIdeas = useCallback(async (sessionId?: string): Promise<void> => {
        setError(null);
        try {
            const loadedIdeas = await window.electron.ideas.getIdeas(sessionId);
            setIdeas(loadedIdeas);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load ideas';
            setError(message);
        }
    }, []);

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
