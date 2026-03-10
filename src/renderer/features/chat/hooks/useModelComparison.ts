/**
 * Custom hook for Model A/B Testing comparison logic.
 * Manages prompt, selected models, responses, loading, and error state.
 */

import { useCallback, useRef, useState } from 'react';

import { useTranslation } from '@/i18n';

/** Single model comparison result. */
export interface ComparisonResult {
    provider: string;
    model: string;
    content: string;
    responseTime: number;
    tokenCount: number;
    tokensPerSecond: number;
    error?: string;
}

interface UseModelComparisonReturn {
    prompt: string;
    setPrompt: (value: string) => void;
    selectedModels: Array<{ provider: string; model: string }>;
    addModel: (provider: string, model: string) => void;
    removeModel: (index: number) => void;
    results: ComparisonResult[];
    isComparing: boolean;
    error: string | null;
    startComparison: () => Promise<void>;
    cancelComparison: () => void;
    clearResults: () => void;
    ratings: Record<string, 1 | -1 | 0>;
    rateModel: (modelKey: string, rating: 1 | -1) => void;
}

/** Encapsulates all state and logic for model A/B comparison. */
export function useModelComparison(): UseModelComparisonReturn {
    const { t } = useTranslation();
    const [prompt, setPrompt] = useState('');
    const [selectedModels, setSelectedModels] = useState<Array<{ provider: string; model: string }>>([]);
    const [results, setResults] = useState<ComparisonResult[]>([]);
    const [isComparing, setIsComparing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ratings, setRatings] = useState<Record<string, 1 | -1 | 0>>({});
    const abortRef = useRef(false);

    const addModel = useCallback((provider: string, model: string) => {
        setSelectedModels((cur) => [...cur, { provider, model }]);
    }, []);

    const removeModel = useCallback((index: number) => {
        setSelectedModels((cur) => cur.filter((_, i) => i !== index));
    }, []);

    const clearResults = useCallback(() => {
        setResults([]);
        setError(null);
        setRatings({});
    }, []);

    const cancelComparison = useCallback(() => {
        abortRef.current = true;
    }, []);

    const rateModel = useCallback((modelKey: string, rating: 1 | -1) => {
        setRatings((prev) => ({
            ...prev,
            [modelKey]: prev[modelKey] === rating ? 0 : rating,
        }));
    }, []);

    const startComparison = useCallback(async () => {
        if (selectedModels.length < 2) {
            setError(t('modelComparison.noModels'));
            return;
        }
        if (!prompt.trim()) {
            setError(t('modelComparison.enterPrompt'));
            return;
        }

        setIsComparing(true);
        setError(null);
        setResults([]);
        setRatings({});
        abortRef.current = false;

        try {
            const response = await window.electron.modelCollaboration.run({
                messages: [{ id: 'cmp-1', role: 'user', content: prompt.trim(), timestamp: new Date() }],
                models: selectedModels,
            });

            if (abortRef.current) { return; }

            const mapped: ComparisonResult[] = response.responses.map((r) => {
                const tokens = r.content.split(/\s+/).length;
                const seconds = r.latency / 1000;
                return {
                    provider: r.provider,
                    model: r.model,
                    content: r.content,
                    responseTime: r.latency,
                    tokenCount: tokens,
                    tokensPerSecond: seconds > 0 ? Math.round(tokens / seconds) : 0,
                };
            });
            setResults(mapped);
        } catch (err) {
            if (!abortRef.current) {
                setError(err instanceof Error ? err.message : t('modelComparison.compareFailed'));
            }
        } finally {
            setIsComparing(false);
        }
    }, [prompt, selectedModels, t]);

    return {
        prompt, setPrompt, selectedModels, addModel, removeModel,
        results, isComparing, error, startComparison, cancelComparison,
        clearResults, ratings, rateModel,
    };
}
