import { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from '@/i18n';

import type { PromptAnalysis, PromptSuggestion } from '../utils/prompt-optimizer';
import { PromptOptimizerService } from '../utils/prompt-optimizer';

const DEBOUNCE_MS = 500;
const MAX_CACHE_SIZE = 20;

interface UsePromptAnalysisReturn {
    analysis: PromptAnalysis | null;
    isAnalyzing: boolean;
    dismissSuggestion: (index: number) => void;
}

/**
 * Hook that provides debounced prompt analysis with caching.
 * @param prompt - The current prompt text to analyze.
 * @returns Analysis state, loading indicator, and dismiss handler.
 */
export function usePromptAnalysis(prompt: string): UsePromptAnalysisReturn {
    const { t } = useTranslation();
    const [analysis, setAnalysis] = useState<PromptAnalysis | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const cacheRef = useRef<Map<string, PromptAnalysis>>(new Map());
    const serviceRef = useRef<PromptOptimizerService>(new PromptOptimizerService(t));
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scheduleStateUpdate = useCallback((update: () => void) => {
        queueMicrotask(update);
    }, []);

    useEffect(() => {
        serviceRef.current = new PromptOptimizerService(t);
        cacheRef.current.clear();
    }, [t]);

    useEffect(() => {
        const trimmed = prompt.trim();

        if (trimmed.length === 0) {
            scheduleStateUpdate(() => {
                setAnalysis(null);
                setIsAnalyzing(false);
            });
            return;
        }

        const cached = cacheRef.current.get(trimmed);
        if (cached) {
            scheduleStateUpdate(() => {
                setAnalysis(cached);
                setIsAnalyzing(false);
            });
            return;
        }

        scheduleStateUpdate(() => {
            setIsAnalyzing(true);
        });

        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
            const result = serviceRef.current.analyzePrompt(trimmed);

            if (cacheRef.current.size >= MAX_CACHE_SIZE) {
                const firstKey = cacheRef.current.keys().next().value as string;
                cacheRef.current.delete(firstKey);
            }
            cacheRef.current.set(trimmed, result);

            setAnalysis(result);
            setIsAnalyzing(false);
        }, DEBOUNCE_MS);

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [prompt, scheduleStateUpdate]);

    const dismissSuggestion = useCallback((index: number) => {
        setAnalysis(prev => {
            if (!prev) {return prev;}
            const filtered = prev.suggestions.filter(
                (_: PromptSuggestion, i: number) => i !== index,
            );
            return { ...prev, suggestions: filtered };
        });
    }, []);

    return { analysis, isAnalyzing, dismissSuggestion };
}
