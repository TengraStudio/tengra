import { Brain } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';

import { ModelCategory, ModelListItem } from '../types';

import {
    ModelSelectorCategoryList,
    ModelSelectorHeader,
    ModelSelectorModeTabs,
    ModelSelectorSearch,
    SelectorChatMode,
} from './model-selector/ModelSelectorSections';

/** Minimum padding from viewport edges in pixels */
const VIEWPORT_PADDING = 16;

export type ChatMode = 'instant' | 'thinking' | 'agent';
export type ThinkingLevel =
    | 'none'
    | 'minimal'
    | 'low'
    | 'medium'
    | 'high'
    | 'xhigh'
    | 'max'
    | string;
type ModelFilter = 'local' | 'cloud' | 'free' | 'reasoning' | 'deprecated';
interface ModelSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    categories: ModelCategory[];
    selectedModels: Array<{ provider: string; model: string }>;
    selectedModel: string;
    selectedProvider: string;
    onSelect: (provider: string, id: string, isMultiSelect: boolean, keepOpen?: boolean) => void;
    onRemoveModel?: (provider: string, model: string) => void;
    isFavorite?: (modelId: string) => boolean;
    toggleFavorite?: (modelId: string) => void;
    recentModels?: string[];
    t: (key: string) => string;
    chatMode?: SelectorChatMode;
    onChatModeChange?: (mode: SelectorChatMode) => void;
    thinkingLevel?: string;
    onThinkingLevelChange?: (modelId: string, level: string) => void;
    onConfirmSelection?: () => void;
    copilotQuota?: { accounts: Array<import('@shared/types/quota').CopilotQuota & { accountId?: string; email?: string; isActive?: boolean }> } | null;
    activeCopilotAccountId?: string | null;
    activeCopilotAccountEmail?: string | null;
    activeClaudeQuota?: import('@shared/types/quota').ClaudeQuota | null;
    activeCodexUsage?: ({ usage: import('@shared/types/quota').CodexUsage; accountId?: string; email?: string } & { isActive?: boolean }) | null;
    activeAntigravityQuota?: import('@shared/types/quota').QuotaResponse | null;
}

const THINKING_LEVEL_LABEL_KEYS: Record<ThinkingLevel, string> = {
    none: 'modelSelector.reasoningLevels.none',
    minimal: 'modelSelector.reasoningLevels.minimal',
    low: 'modelSelector.reasoningLevels.low',
    medium: 'modelSelector.reasoningLevels.medium',
    high: 'modelSelector.reasoningLevels.high',
    xhigh: 'modelSelector.reasoningLevels.max',
};

const MODEL_FILTER_OPTIONS: ReadonlyArray<readonly [ModelFilter, string]> = [
    ['local', 'modelSelector.local'],
    ['cloud', 'modelSelector.cloud'],
    ['free', 'modelSelector.free'],
    ['reasoning', 'modelSelector.reasoning'],
    ['deprecated', 'modelSelector.deprecated']
];

function resolvePreferredThinkingLevel(levels: string[], currentLevel?: string): string | null {
    if (levels.length === 0) {
        return null;
    }
    if (currentLevel && levels.includes(currentLevel)) {
        return currentLevel;
    }
    if (levels.includes('low')) {
        return 'low';
    }
    return levels[0] ?? null;
}

export const ModelSelectorModal: React.FC<ModelSelectorModalProps> = ({
    isOpen,
    onClose,
    categories,
    selectedModels,
    selectedModel,
    selectedProvider,
    onSelect,
    toggleFavorite,
    recentModels = [],
    t,
    chatMode = 'instant',
    onChatModeChange,
    thinkingLevel = 'low',
    onThinkingLevelChange,
    onConfirmSelection,
    copilotQuota,
    activeCopilotAccountId,
    activeCopilotAccountEmail,
    activeClaudeQuota,
    activeCodexUsage,
    activeAntigravityQuota,
}) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilters, setActiveFilters] = useState<ModelFilter[]>([]);
    const [internalChatMode, setInternalChatMode] = useState<SelectorChatMode>(chatMode);
    const [activeTab, setActiveTab] = useState<'models' | 'reasoning'>('models');
    const [pendingModel, setPendingModel] = useState<{ provider: string; id: string } | null>(null);
    const [modalStyle, setModalStyle] = useState<React.CSSProperties>({});

    // Calculate modal position to ensure it stays within viewport
    useEffect(() => {
        if (!isOpen || !modalRef.current) {
            return;
        }

        const updatePosition = () => {
            const modal = modalRef.current;
            if (!modal) {
                return;
            }

            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const modalRect = modal.getBoundingClientRect();

            const style: React.CSSProperties = {};

            // Check if modal is too wide for viewport
            if (modalRect.width > viewportWidth - 2 * VIEWPORT_PADDING) {
                style.width = `${viewportWidth - 2 * VIEWPORT_PADDING}px`;
                style.maxWidth = `${viewportWidth - 2 * VIEWPORT_PADDING}px`;
            }

            // Check if modal is too tall for viewport
            if (modalRect.height > viewportHeight - 2 * VIEWPORT_PADDING) {
                style.maxHeight = `${viewportHeight - 2 * VIEWPORT_PADDING}px`;
            }

            setModalStyle(style);
        };

        // Run after modal has rendered
        const timer = setTimeout(updatePosition, 0);
        window.addEventListener('resize', updatePosition);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isOpen]);
    const [pendingThinkingLevel, setPendingThinkingLevel] = useState<string | null>(null);

    useEffect(() => {
        setInternalChatMode(chatMode);
    }, [chatMode]);

    // Check if pending model requires reasoning level selection
    const pendingModelThinkingLevels = useMemo(() => {
        if (!pendingModel) {
            return null;
        }
        for (const cat of categories) {
            if (!Array.isArray(cat.models)) { continue; }
            const found = cat.models.find(
                m => m.id === pendingModel.id && m.provider === pendingModel.provider
            );
            if (found?.thinkingLevels && Array.isArray(found.thinkingLevels) && found.thinkingLevels.length > 0) {
                return found.thinkingLevels;
            }
        }
        return null;
    }, [categories, pendingModel]);

    const requiresReasoningSelection =
        pendingModel !== null &&
        pendingModelThinkingLevels !== null &&
        pendingModelThinkingLevels.length > 0;
    const canConfirm = !requiresReasoningSelection || pendingThinkingLevel !== null;

    const handleClose = useCallback(() => {
        if (searchQuery) {
            setSearchQuery('');
        }
        setActiveTab('models');
        setPendingModel(null);
        setPendingThinkingLevel(null);
        onClose();
    }, [onClose, searchQuery]);

    const handleCancelPending = useCallback(() => {
        setPendingModel(null);
        setPendingThinkingLevel(null);
        setActiveTab('models');
    }, []);

    // ESC key handler
    useEffect(() => {
        if (!isOpen) {
            return;
        }
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (requiresReasoningSelection && !canConfirm) {
                    handleCancelPending();
                    return;
                }
                handleClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [handleClose, handleCancelPending, isOpen, requiresReasoningSelection, canConfirm]);

    // Body scroll lock
    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Auto focus search input
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Get favorite models from categories
    const favoriteModels = useMemo(() => {
        const favCat = categories.find(c => c.id === 'favorites');
        return favCat?.models ?? [];
    }, [categories]);

    // Get recent models from all categories
    const recentModelItems = useMemo(() => {
        if (recentModels.length === 0) {
            return [];
        }
        const items: ModelListItem[] = [];
        for (const recentId of recentModels.slice(0, 5)) {
            for (const cat of categories) {
                const found = cat.models.find(m => m.id === recentId);
                if (found && !items.some(i => i.id === found.id)) {
                    items.push(found);
                    break;
                }
            }
        }
        return items;
    }, [categories, recentModels]);

    // Get current model's thinking levels
    const currentModelThinkingLevels = useMemo(() => {
        for (const cat of categories) {
            if (!Array.isArray(cat.models)) { continue; }
            const found = cat.models.find(m =>
                m.id === selectedModel && (selectedProvider === '' || m.provider === selectedProvider)
            );
            if (found?.thinkingLevels) {
                return found.thinkingLevels;
            }
        }
        return null;
    }, [categories, selectedModel, selectedProvider]);

    const currentModelInfo = useMemo(() => {
        for (const cat of categories) {
            if (!Array.isArray(cat.models)) { continue; }
            const found = cat.models.find(m =>
                m.id === selectedModel && (selectedProvider === '' || m.provider === selectedProvider)
            );
            if (found) {
                return found;
            }
        }
        return null;
    }, [categories, selectedModel, selectedProvider]);

    useEffect(() => {
        let timer: NodeJS.Timeout | undefined;
        if (
            activeTab === 'reasoning' &&
            (!pendingModelThinkingLevels || pendingModelThinkingLevels.length === 0) &&
            (!currentModelThinkingLevels || currentModelThinkingLevels.length === 0)
        ) {
            // Use setTimeout to avoid synchronous setState in effect body
            timer = setTimeout(() => setActiveTab('models'), 0);
        }
        return () => {
            if (timer) {
                clearTimeout(timer);
            }
        };
    }, [activeTab, currentModelThinkingLevels, pendingModelThinkingLevels]);

    const getThinkingLevels = useCallback(
        (provider: string, id: string) => {
            for (const cat of categories) {
                const found = cat.models.find(m => m.id === id && m.provider === provider);
                if (found?.thinkingLevels && found.thinkingLevels.length > 0) {
                    return found.thinkingLevels;
                }
            }
            return [];
        },
        [categories]
    );

    // Filter categories based on search
    const filteredCategories = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        const applyFilters = (model: ModelListItem) => {
            if (activeFilters.includes('local') && !model.isLocal) { return false; }
            if (activeFilters.includes('cloud') && model.isLocal) { return false; }
            if (activeFilters.includes('free') && !model.isFree) { return false; }
            if (activeFilters.includes('reasoning') && !model.supportsReasoning) { return false; }
            if (!activeFilters.includes('deprecated') && (model.lifecycle === 'deprecated' || model.lifecycle === 'retired')) { return false; }
            return true;
        };
        return categories
            .filter(c => c.id !== 'favorites')
            .map(cat => ({
                ...cat,
                models: Array.isArray(cat.models)
                    ? cat.models.filter(m =>
                        (query === '' || m.label.toLowerCase().includes(query) || m.id.toLowerCase().includes(query)) &&
                        applyFilters(m)
                    )
                    : [],
            }))
            .filter(cat => cat.models.length > 0);
    }, [categories, searchQuery, activeFilters]);

    const handleSelect = useCallback(
        (provider: string, id: string, isMulti: boolean) => {
            if (isMulti) {
                onSelect(provider, id, isMulti, true);
                return;
            }

            const thinkingLevels = getThinkingLevels(provider, id);
            if (thinkingLevels.length > 0) {
                setPendingModel({ provider, id });
                setPendingThinkingLevel(resolvePreferredThinkingLevel(thinkingLevels));
                setActiveTab('reasoning');
                return;
            }

            onSelect(provider, id, isMulti, false);
            handleClose();
        },
        [getThinkingLevels, handleClose, onSelect]
    );

    const handlePendingThinkingLevelChange = useCallback(
        (level: string) => {
            setPendingThinkingLevel(level);
            if (pendingModel) {
                onThinkingLevelChange?.(pendingModel.id, level);
            }
        },
        [onThinkingLevelChange, pendingModel]
    );

    const handleConfirmSelection = useCallback(() => {
        if (!pendingModel || !canConfirm) {
            return;
        }
        if (pendingThinkingLevel) {
            onThinkingLevelChange?.(pendingModel.id, pendingThinkingLevel);
        }
        onSelect(pendingModel.provider, pendingModel.id, false, false);
        onConfirmSelection?.();
        handleClose();
    }, [pendingModel, canConfirm, pendingThinkingLevel, onThinkingLevelChange, onSelect, onConfirmSelection, handleClose]);

    const handleBackdropClick = useCallback(
        (e: React.MouseEvent) => {
            if (e.target === e.currentTarget) {
                if (requiresReasoningSelection && !canConfirm) {
                    return;
                }
                handleClose();
            }
        },
        [handleClose, requiresReasoningSelection, canConfirm]
    );

    if (!isOpen) {
        return null;
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[320] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="model-selector-title"
            onClick={handleBackdropClick}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200"
                aria-hidden="true"
            />

            {/* Modal */}
            <div
                ref={modalRef}
                style={modalStyle}
                className={cn(
                    'relative w-full max-w-3xl max-h-[85vh] flex flex-col',
                    'bg-popover/95 backdrop-blur-xl rounded-2xl shadow-2xl',
                    'border border-border/50',
                    'animate-in fade-in-0 zoom-in-95 duration-200'
                )}
                onClick={e => e.stopPropagation()}
            >
                <ModelSelectorHeader
                    title={t('modelSelector.selectModel')}
                    closeLabel={t('common.close')}
                    onClose={handleClose}
                />

                <ModelSelectorModeTabs
                    modeLabel={t('modelSelector.mode')}
                    chatMode={internalChatMode}
                    onChatModeChange={(mode) => {
                        setInternalChatMode(mode);
                        onChatModeChange?.(mode);
                    }}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    t={t}
                    showReasoningTab={
                        !!pendingModelThinkingLevels?.length ||
                        !!currentModelThinkingLevels && currentModelThinkingLevels.length > 0
                    }
                />

                {activeTab === 'models' && (
                    <>
                        <ModelSelectorSearch
                            searchQuery={searchQuery}
                            onSearchQueryChange={setSearchQuery}
                            searchInputRef={searchInputRef}
                            placeholder={t('modelSelector.searchModels')}
                        />
                        <div className="px-4 pb-2 flex flex-wrap gap-2 border-b border-border/50">
                            {MODEL_FILTER_OPTIONS.map(([key, labelKey]) => {
                                const active = activeFilters.includes(key);
                                return (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            setActiveFilters(prev =>
                                                prev.includes(key)
                                                    ? prev.filter(f => f !== key)
                                                    : [...prev, key]
                                            );
                                        }}
                                        className={cn(
                                            'px-2.5 py-1 rounded-full text-xxs font-semibold border transition-colors',
                                            active
                                                ? 'bg-primary/15 text-primary border-primary/40'
                                                : 'bg-muted/30 text-muted-foreground border-border/40 hover:text-foreground'
                                        )}
                                    >
                                        {t(labelKey)}
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Pending Model Reasoning Selection */}
                    {activeTab === 'reasoning' &&
                        pendingModel &&
                        pendingModelThinkingLevels &&
                        pendingModelThinkingLevels.length > 0 && (
                            <div className="p-4">
                                <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Brain className="w-4 h-4 text-primary" />
                                        <span className="text-sm font-medium text-foreground">
                                            {t('modelSelector.selectReasoningLevel')}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {t('modelSelector.reasoningRequired')}
                                    </p>
                                </div>
                                <div className="text-xs text-muted-foreground font-medium mb-3">
                                    {categories
                                        .flatMap(c => Array.isArray(c.models) ? c.models : [])
                                        .find(m => m.id === pendingModel.id)?.label ??
                                        pendingModel.id}
                                </div>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {pendingModelThinkingLevels.map(level => {
                                        const isActive = pendingThinkingLevel === level;
                                        return (
                                            <button
                                                key={level}
                                                onClick={() =>
                                                    handlePendingThinkingLevelChange(level)
                                                }
                                                className={cn(
                                                    'px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                                                    isActive
                                                        ? 'bg-primary text-primary-foreground border-primary shadow-md'
                                                        : 'border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border'
                                                )}
                                            >
                                                {t(THINKING_LEVEL_LABEL_KEYS[level as ThinkingLevel] ?? '') || level}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="flex items-center gap-2 pt-3 border-t border-border/50">
                                    <button
                                        onClick={handleCancelPending}
                                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
                                    >
                                        {t('common.cancel')}
                                    </button>
                                    <button
                                        onClick={handleConfirmSelection}
                                        disabled={!canConfirm}
                                        className={cn(
                                            'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                                            canConfirm
                                                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                                : 'bg-muted text-muted-foreground cursor-not-allowed'
                                        )}
                                    >
                                        {canConfirm
                                            ? t('modelSelector.confirmModel')
                                            : t('modelSelector.selectLevelFirst')}
                                    </button>
                                </div>
                            </div>
                        )}

                    {/* Current Model Reasoning (when not in pending state) */}
                    {activeTab === 'reasoning' &&
                        !pendingModel &&
                        currentModelThinkingLevels &&
                        currentModelThinkingLevels.length > 0 && (
                            <div className="p-4">
                                <div className="text-xs text-muted-foreground font-medium mb-2">
                                    {t('modelSelector.reasoning')} •{' '}
                                    {currentModelInfo?.label ?? selectedModel}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {currentModelThinkingLevels.map(level => {
                                        const isActive = thinkingLevel === level;
                                        return (
                                            <button
                                                key={level}
                                                onClick={() =>
                                                    onThinkingLevelChange?.(
                                                        currentModelInfo?.id ?? selectedModel,
                                                        level
                                                    )
                                                }
                                                className={cn(
                                                    'px-3 py-1.5 rounded-md text-xs font-medium transition-all border border-border/50',
                                                    isActive
                                                        ? 'bg-primary/20 text-primary'
                                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                                )}
                                            >
                                                {t(THINKING_LEVEL_LABEL_KEYS[level as ThinkingLevel] ?? '') || level}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                    {activeTab === 'models' ? (
                        <ModelSelectorCategoryList
                            filteredCategories={filteredCategories}
                            favoriteModels={favoriteModels}
                            recentModelItems={recentModelItems}
                            searchQuery={searchQuery}
                            selectedModels={selectedModels}
                            selectedModel={selectedModel}
                            selectedProvider={selectedProvider}
                            chatMode={internalChatMode}
                            onSelect={handleSelect}
                            toggleFavorite={toggleFavorite}
                            copilotQuota={copilotQuota}
                            activeCopilotAccountId={activeCopilotAccountId}
                            activeCopilotAccountEmail={activeCopilotAccountEmail}
                            activeClaudeQuota={activeClaudeQuota}
                            activeCodexUsage={activeCodexUsage}
                            activeAntigravityQuota={activeAntigravityQuota}
                            t={t}
                        />
                    ) : null}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-border/50 bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
                    {requiresReasoningSelection && !canConfirm ? (
                        <span className="text-warning">
                            {t('modelSelector.mustSelectReasoning')}
                        </span>
                    ) : (
                        <span>{t('modelSelector.shiftClickMulti')}</span>
                    )}
                    <span className="text-muted-foreground/50">
                        {t('common.escKey')} {requiresReasoningSelection ? t('common.cancel') : t('common.toClose')}
                    </span>
                </div>
            </div>
        </div>,
        document.body
    );
};

ModelSelectorModal.displayName = 'ModelSelectorModal';
