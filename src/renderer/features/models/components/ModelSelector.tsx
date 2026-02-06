import type { GroupedModels } from '@renderer/features/models/utils/model-fetcher';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useDebounce } from '@/hooks/useDebounce';
import { Language, useTranslation } from '@/i18n';
import { AppSettings, ClaudeQuota, CodexUsage, QuotaResponse } from '@/types';

import { useModelCategories } from '../hooks/useModelCategories';
import { useModelSelectorLogic } from '../hooks/useModelSelectorLogic';

import { ModelSelectorModal } from './ModelSelectorModal';
import { ModelSelectorTrigger } from './ModelSelectorTrigger';

interface ModelSelectorProps {
    selectedProvider: string;
    selectedModel: string;
    selectedModels?: Array<{ provider: string; model: string }>;
    onSelect: (provider: string, model: string, isMultiSelect?: boolean) => void;
    settings?: AppSettings;
    groupedModels?: GroupedModels;
    quotas?: { accounts: QuotaResponse[] } | null;
    codexUsage?: { accounts: { usage: CodexUsage }[] } | null;
    claudeQuota?: { accounts: ClaudeQuota[] } | null;
    onOpenChange?: (isOpen: boolean) => void;
    contextTokens?: number;
    language?: Language;
    onRemoveModel?: (provider: string, model: string) => void;
    isFavorite?: (modelId: string) => boolean;
    toggleFavorite?: (modelId: string) => void;
    isIconOnly?: boolean;
    thinkingLevel?: string;
    onThinkingLevelChange?: (level: string) => void;
}

export function ModelSelector({
    selectedProvider,
    selectedModel,
    selectedModels = [],
    onSelect,
    settings,
    groupedModels,
    quotas = null,
    codexUsage = null,
    claudeQuota = null,
    onOpenChange,
    contextTokens = 0,
    language = 'en',
    onRemoveModel,
    isFavorite,
    toggleFavorite,
    isIconOnly,
    thinkingLevel,
    onThinkingLevelChange
}: ModelSelectorProps) {
    const { t } = useTranslation(language);
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    useEffect(() => { onOpenChange?.(isOpen); }, [isOpen, onOpenChange]);

    const { isModelDisabled } = useModelSelectorLogic({ settings, groupedModels, quotas, codexUsage, claudeQuota });
    const categories = useModelCategories({ groupedModels, debouncedSearchQuery, settings, selectedModel, isModelDisabled, t });

    const normalizeProvider = useCallback((provider?: string) => {
        const p = (provider ?? '').toLowerCase();
        if (p === 'codex') { return 'openai'; }
        if (p === 'github') { return 'copilot'; }
        if (p === 'anthropic') { return 'claude'; }
        return p;
    }, []);

    const normalizedSelectedProvider = useMemo(() => {
        return normalizeProvider(selectedProvider);
    }, [selectedProvider, normalizeProvider]);

    const currentModelInfo = useMemo(() => {
        const normalized = selectedModel.toLowerCase();
        if (normalizedSelectedProvider) {
            for (const cat of categories) {
                const m = cat.models.find(m =>
                    (m.id === selectedModel || m.id.toLowerCase() === normalized) &&
                    normalizeProvider(m.provider) === normalizedSelectedProvider
                );
                if (m) { return m; }
            }
        }
        for (const cat of categories) {
            const m = cat.models.find(m => m.id === selectedModel || m.id.toLowerCase() === normalized);
            if (m) { return m; }
        }
        return null;
    }, [categories, selectedModel, normalizedSelectedProvider, normalizeProvider]);

    const contextLimit = useMemo(() => {
        if (currentModelInfo?.contextWindow) { return currentModelInfo.contextWindow; }
        const id = selectedModel.toLowerCase();
        if (id.includes('gpt-4') || id.includes('o1') || id.includes('gpt-5')) { return 128000; }
        if (id.includes('claude-3')) { return 200000; }
        if (id.includes('gemini-1.5')) { return 1000000; }
        return 32000;
    }, [selectedModel, currentModelInfo]);

    const contextUsagePercent = Math.min(100, (contextTokens / contextLimit) * 100);

    const effectiveThinkingLevel = useMemo(() => {
        const levels = currentModelInfo?.thinkingLevels;
        if (!levels || levels.length === 0) { return undefined; }
        if (thinkingLevel && levels.includes(thinkingLevel)) { return thinkingLevel; }
        if (levels.includes('medium')) { return 'medium'; }
        return levels[0];
    }, [currentModelInfo, thinkingLevel]);

    const handleModelSelect = useCallback((p: string, id: string, m?: boolean, keepOpen?: boolean) => {
        onSelect(p, id, m);
        if (!m && !keepOpen) { setIsOpen(false); }
    }, [onSelect]);

    const handleClose = useCallback(() => {
        setIsOpen(false);
    }, []);

    const currentCat = categories.find(c => c.models.some(m =>
        m.id === selectedModel &&
        (!normalizedSelectedProvider || normalizeProvider(m.provider) === normalizedSelectedProvider)
    )) ?? categories.find(c => c.models.some(m => m.id === selectedModel)) ?? categories.find(c => c.id === normalizedSelectedProvider);

    // Get recent models from settings
    const recentModels = settings?.general?.recentModels ?? [];

    return (
        <div className="relative">
            <ModelSelectorTrigger
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                currentCategory={currentCat}
                currentModelInfo={currentModelInfo}
                selectedModel={selectedModel}
                selectedModels={selectedModels}
                contextTokens={contextTokens}
                contextUsagePercent={contextUsagePercent}
                t={t}
                isIconOnly={isIconOnly}
            />

            <ModelSelectorModal
                isOpen={isOpen}
                onClose={handleClose}
                categories={categories}
                selectedModels={selectedModels}
                selectedModel={selectedModel}
                selectedProvider={selectedProvider}
                onSelect={handleModelSelect}
                onRemoveModel={onRemoveModel}
                isFavorite={isFavorite}
                toggleFavorite={toggleFavorite}
                recentModels={recentModels}
                t={t}
                thinkingLevel={effectiveThinkingLevel}
                onThinkingLevelChange={onThinkingLevelChange}
            />
        </div>
    );
}
