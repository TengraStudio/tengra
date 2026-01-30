import { useMemo } from 'react';

import { ModelCategory } from '../types';

interface UseModelSelectorStateProps {
    categories: ModelCategory[];
    selectedModel: string;
    selectedProvider: string;
    contextTokens: number;
}

export function useModelSelectorState({
    categories,
    selectedModel,
    selectedProvider,
    contextTokens,
}: UseModelSelectorStateProps) {
    const currentModelInfo = useMemo(() => {
        const norm = selectedModel.toLowerCase();
        for (const cat of categories) {
            const m = cat.models.find(model => model.id === selectedModel) ??
                cat.models.find(model => model.id.toLowerCase() === norm) ??
                cat.models.find(model => model.id.replace(/\./g, '-').toLowerCase() === norm.replace(/\./g, '-'));
            if (m) { return m; }
        }
        return null;
    }, [categories, selectedModel]);

    const contextLimit = useMemo(() => {
        if (currentModelInfo?.contextWindow) { return currentModelInfo.contextWindow; }
        const id = selectedModel.toLowerCase();
        const map: Record<string, number> = {
            'gpt-4': 128000, 'o1-': 128000, 'gpt-5': 128000, 'codex': 128000,
            'claude-3-5': 200000, 'claude-3': 200000, 'gemini-1.5': 1000000,
            'gemini-3': 2000000, 'gpt-3.5': 160000
        };
        for (const [k, v] of Object.entries(map)) { if (id.includes(k)) { return v; } }
        return 32000;
    }, [selectedModel, currentModelInfo]);

    const currCat = useMemo(() =>
        categories.find(c => c.models.some(m => m.id === selectedModel)) ??
        categories.find(c => c.id === selectedProvider)
        , [categories, selectedModel, selectedProvider]);

    const contextUsagePercent = useMemo(() =>
        Math.min(100, (contextTokens / contextLimit) * 100)
        , [contextTokens, contextLimit]);

    return {
        currentModelInfo,
        contextLimit,
        currCat,
        contextUsagePercent
    };
}
