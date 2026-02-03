import {
    autoUpdate,
    flip,
    FloatingPortal,
    offset,
    shift,
    useFloating,
} from '@floating-ui/react';
import type { GroupedModels } from '@renderer/features/models/utils/model-fetcher';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useDebounce } from '@/hooks/useDebounce';
import { Language, useTranslation } from '@/i18n';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { AppSettings, CodexUsage, QuotaResponse } from '@/types';

import { useModelCategories } from '../hooks/useModelCategories';
import { useModelSelectorLogic } from '../hooks/useModelSelectorLogic';

import { ModelSelectorContent } from './ModelSelectorContent';
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
    onOpenChange?: (isOpen: boolean) => void;
    contextTokens?: number;
    language?: Language;
    onRemoveModel?: (provider: string, model: string) => void;
    isFavorite?: (modelId: string) => boolean;
    toggleFavorite?: (modelId: string) => void;
    isIconOnly?: boolean;
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
    onOpenChange,
    contextTokens = 0,
    language = 'en',
    onRemoveModel,
    isFavorite,
    toggleFavorite,
    isIconOnly
}: ModelSelectorProps) {
    const { t } = useTranslation(language);
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    const { x, y, strategy, refs, placement } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        middleware: [offset(8), flip({ fallbackAxisSideDirection: 'end' }), shift({ padding: 16 })],
        whileElementsMounted: autoUpdate,
    });

    const { setReference, setFloating } = refs;

    useEffect(() => { onOpenChange?.(isOpen); }, [isOpen, onOpenChange]);

    useEffect(() => {
        if (!isOpen) { return; }
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            const ref1 = refs.domReference.current;
            const ref2 = refs.floating.current;
            if (ref1 && !ref1.contains(event.target as Node) && ref2 && !ref2.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen, refs.domReference, refs.floating]);

    const { isModelDisabled } = useModelSelectorLogic({ settings, groupedModels, quotas, codexUsage });
    const categories = useModelCategories({ groupedModels, debouncedSearchQuery, settings, selectedModel, isModelDisabled, t });

    const currentModelInfo = useMemo(() => {
        const normalized = selectedModel.toLowerCase();
        for (const cat of categories) {
            const m = cat.models.find(m => m.id === selectedModel || m.id.toLowerCase() === normalized);
            if (m) { return m; }
        }
        return null;
    }, [categories, selectedModel]);

    const contextLimit = useMemo(() => {
        if (currentModelInfo?.contextWindow) { return currentModelInfo.contextWindow; }
        const id = selectedModel.toLowerCase();
        if (id.includes('gpt-4') || id.includes('o1') || id.includes('gpt-5')) { return 128000; }
        if (id.includes('claude-3')) { return 200000; }
        if (id.includes('gemini-1.5')) { return 1000000; }
        return 32000;
    }, [selectedModel, currentModelInfo]);

    const contextUsagePercent = Math.min(100, (contextTokens / contextLimit) * 100);

    const handleModelSelect = useCallback((p: string, id: string, m: boolean) => {
        onSelect(p, id, m);
        if (!m) { setIsOpen(false); setSearchQuery(''); }
    }, [onSelect]);

    const currentCat = categories.find(c => c.models.some(m => m.id === selectedModel)) ?? categories.find(c => c.id === selectedProvider);

    return (
        <div className="relative">
            <ModelSelectorTrigger
                ref={setReference}
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

            <AnimatePresence>
                {isOpen && (
                    <FloatingPortal>
                        <motion.div
                            ref={setFloating}
                            initial={{ opacity: 0, y: placement.startsWith('top') ? 5 : -5, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: placement.startsWith('top') ? 5 : -5, scale: 0.95 }}
                            transition={{ duration: 0.1 }}
                            style={{ position: strategy, top: y, left: x, zIndex: 9999 }}
                            className="w-72 max-h-[70vh] flex flex-col bg-popover/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
                            onMouseDown={e => e.stopPropagation()}
                        >
                            <ModelSelectorContent
                                searchQuery={searchQuery}
                                setSearchQuery={setSearchQuery}
                                categories={categories}
                                selectedModels={selectedModels}
                                selectedModel={selectedModel}
                                selectedProvider={selectedProvider}
                                onSelect={handleModelSelect}
                                onRemoveModel={onRemoveModel}
                                isFavorite={isFavorite}
                                toggleFavorite={toggleFavorite}
                                t={t}
                            />
                        </motion.div>
                    </FloatingPortal>
                )}
            </AnimatePresence>
        </div>
    );
}
