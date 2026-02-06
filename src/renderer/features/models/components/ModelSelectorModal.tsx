import { Bot, Brain, Clock, Search, Sparkles, Star, X, Zap } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';

import { ModelCategory, ModelListItem } from '../types';

import { ModelSelectorItem } from './ModelSelectorItem';

export type ChatMode = 'instant' | 'thinking' | 'agent';
export type ThinkingLevel = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | string;
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
    chatMode?: ChatMode;
    onChatModeChange?: (mode: ChatMode) => void;
    thinkingLevel?: string;
    onThinkingLevelChange?: (level: string) => void;
}

const MODE_CONFIG: Record<ChatMode, { icon: React.ElementType; color: string; bg: string }> = {
    instant: { icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    thinking: { icon: Brain, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    agent: { icon: Bot, color: 'text-blue-500', bg: 'bg-blue-500/10' }
};

const THINKING_LEVEL_LABELS: Record<ThinkingLevel, string> = {
    none: 'None',
    minimal: 'Minimal',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    xhigh: 'Max'
};

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
    thinkingLevel = 'medium',
    onThinkingLevelChange
}) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'models' | 'reasoning'>('models');
    const handleClose = useCallback(() => {
        if (searchQuery) { setSearchQuery(''); }
        setActiveTab('models');
        onClose();
    }, [onClose, searchQuery]);

    // ESC key handler
    useEffect(() => {
        if (!isOpen) { return; }
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { handleClose(); }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [handleClose, isOpen]);

    // Body scroll lock
    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
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
        if (recentModels.length === 0) { return []; }
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
            const found = cat.models.find(m => m.id === selectedModel);
            if (found?.thinkingLevels) { return found.thinkingLevels; }
        }
        return null;
    }, [categories, selectedModel]);

    const currentModelInfo = useMemo(() => {
        for (const cat of categories) {
            const found = cat.models.find(m => m.id === selectedModel);
            if (found) { return found; }
        }
        return null;
    }, [categories, selectedModel]);

    useEffect(() => {
        let timer: NodeJS.Timeout | undefined;
        if (activeTab === 'reasoning' && (!currentModelThinkingLevels || currentModelThinkingLevels.length === 0)) {
            // Use setTimeout to avoid synchronous setState in effect body
            timer = setTimeout(() => setActiveTab('models'), 0);
        }
        return () => {
            if (timer) { clearTimeout(timer); }
        };
    }, [activeTab, currentModelThinkingLevels]);

    const supportsReasoning = useCallback((provider: string, id: string) => {
        for (const cat of categories) {
            const found = cat.models.find(m => m.id === id && m.provider === provider);
            if (found?.thinkingLevels && found.thinkingLevels.length > 0) { return true; }
        }
        return false;
    }, [categories]);

    // Filter categories based on search
    const filteredCategories = useMemo(() => {
        if (!searchQuery.trim()) {
            return categories.filter(c => c.id !== 'favorites');
        }
        const query = searchQuery.toLowerCase();
        return categories
            .filter(c => c.id !== 'favorites')
            .map(cat => ({
                ...cat,
                models: cat.models.filter(m =>
                    m.label.toLowerCase().includes(query) ||
                    m.id.toLowerCase().includes(query)
                )
            }))
            .filter(cat => cat.models.length > 0);
    }, [categories, searchQuery]);

    const handleSelect = useCallback((provider: string, id: string, isMulti: boolean) => {
        const keepOpen = !isMulti && supportsReasoning(provider, id);
        onSelect(provider, id, isMulti, keepOpen);
        if (isMulti) { return; }
        if (keepOpen) {
            setActiveTab('reasoning');
            return;
        }
        handleClose();
    }, [handleClose, onSelect, supportsReasoning]);

    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) { handleClose(); }
    }, [handleClose]);

    if (!isOpen) { return null; }

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
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
                className={cn(
                    'relative w-full max-w-3xl max-h-[85vh] flex flex-col',
                    'bg-popover/95 backdrop-blur-xl rounded-2xl shadow-2xl',
                    'border border-border/50',
                    'animate-in fade-in-0 zoom-in-95 duration-200'
                )}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border/50">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        <h2 id="model-selector-title" className="text-lg font-semibold">
                            {t('modelSelector.selectModel')}
                        </h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
                        aria-label={t('common.close')}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Mode & Tabs */}
                <div className="px-4 py-3 border-b border-border/50 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-medium">{t('modelSelector.mode')}:</span>
                        <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
                            {(Object.keys(MODE_CONFIG) as ChatMode[]).map(mode => {
                                const config = MODE_CONFIG[mode];
                                const Icon = config.icon;
                                const isActive = chatMode === mode;
                                return (
                                    <button
                                        key={mode}
                                        onClick={() => onChatModeChange?.(mode)}
                                        className={cn(
                                            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                                            isActive ? cn(config.bg, config.color) : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                        )}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        <span className="capitalize">{mode}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {currentModelThinkingLevels && currentModelThinkingLevels.length > 0 && (
                        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1 ml-auto">
                            <button
                                onClick={() => setActiveTab('models')}
                                className={cn(
                                    'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                                    activeTab === 'models' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                )}
                            >
                                Models
                            </button>
                            <button
                                onClick={() => setActiveTab('reasoning')}
                                className={cn(
                                    'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                                    activeTab === 'reasoning' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                )}
                            >
                                Reasoning
                            </button>
                        </div>
                    )}
                </div>

                {/* Search */}
                {activeTab === 'models' && (
                    <div className="p-3 border-b border-border/50">
                        <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2 border border-border/50 focus-within:border-primary/50 transition-colors">
                            <Search className="w-4 h-4 text-muted-foreground" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder={t('modelSelector.searchModels')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-transparent border-none p-0 text-sm focus:ring-0 w-full placeholder:text-muted-foreground/50 outline-none text-foreground"
                            />
                        </div>
                    </div>
                )}

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {activeTab === 'reasoning' && currentModelThinkingLevels && currentModelThinkingLevels.length > 0 && (
                        <div className="p-4">
                            <div className="text-xs text-muted-foreground font-medium mb-2">
                                {t('modelSelector.reasoning')} • {currentModelInfo?.label ?? selectedModel}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {currentModelThinkingLevels.map(level => {
                                    const isActive = thinkingLevel === level;
                                    return (
                                        <button
                                            key={level}
                                            onClick={() => onThinkingLevelChange?.(level)}
                                            className={cn(
                                                'px-3 py-1.5 rounded-md text-xs font-medium transition-all border border-border/50',
                                                isActive ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                            )}
                                        >
                                            {THINKING_LEVEL_LABELS[level as ThinkingLevel] ?? level}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Favorites Section */}
                    {activeTab === 'models' && !searchQuery && favoriteModels.length > 0 && (
                        <ModelSection
                            title={t('common.favorites')}
                            icon={<Star className="w-3.5 h-3.5 text-yellow-500" />}
                            models={favoriteModels}
                            selectedModels={selectedModels}
                            selectedModel={selectedModel}
                            selectedProvider={selectedProvider}
                            onSelect={handleSelect}
                            toggleFavorite={toggleFavorite}
                            t={t}
                        />
                    )}

                    {/* Recent Models Section */}
                    {activeTab === 'models' && !searchQuery && recentModelItems.length > 0 && (
                        <ModelSection
                            title={t('modelSelector.recentModels')}
                            icon={<Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                            models={recentModelItems}
                            selectedModels={selectedModels}
                            selectedModel={selectedModel}
                            selectedProvider={selectedProvider}
                            onSelect={handleSelect}
                            toggleFavorite={toggleFavorite}
                            t={t}
                        />
                    )}

                    {/* All Models by Category */}
                    {activeTab === 'models' && filteredCategories.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                            <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>{t('modelSelector.noModelsFound')}</p>
                        </div>
                    ) : activeTab === 'models' ? (
                        filteredCategories.map(category => (
                            <div key={category.id} className="border-b border-border/30 last:border-b-0">
                                <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 bg-muted/20">
                                    <category.icon className={cn('w-3.5 h-3.5', category.color)} />
                                    <span>{category.name}</span>
                                    <span className="text-muted-foreground/50 font-normal">({category.models.length})</span>
                                </div>
                                <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                                    {category.models.map(model => (
                                        <ModelSelectorItem
                                            key={`${category.id}-${model.provider}-${model.id}`}
                                            model={model}
                                            isSelected={selectedModels.some(m => m.provider === model.provider && m.model === model.id)}
                                            isPrimary={selectedModel === model.id && selectedProvider === model.provider}
                                            onSelect={handleSelect}
                                            toggleFavorite={toggleFavorite}
                                            t={t}
                                            modelIndex={selectedModels.findIndex(m => m.provider === model.provider && m.model === model.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : null}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-border/50 bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
                    <span>{t('modelSelector.shiftClickMulti')}</span>
                    <span className="text-muted-foreground/50">ESC {t('common.toClose')}</span>
                </div>
            </div>
        </div>,
        document.body
    );
};

ModelSelectorModal.displayName = 'ModelSelectorModal';

// Helper component for model sections
interface ModelSectionProps {
    title: string;
    icon: React.ReactNode;
    models: ModelListItem[];
    selectedModels: Array<{ provider: string; model: string }>;
    selectedModel: string;
    selectedProvider: string;
    onSelect: (provider: string, id: string, isMultiSelect: boolean) => void;
    toggleFavorite?: (modelId: string) => void;
    t: (key: string) => string;
}

const ModelSection: React.FC<ModelSectionProps> = ({
    title,
    icon,
    models,
    selectedModels,
    selectedModel,
    selectedProvider,
    onSelect,
    toggleFavorite,
    t
}) => (
    <div className="border-b border-border/30">
        <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 bg-muted/20">
            {icon}
            <span>{title}</span>
        </div>
        <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
            {models.map(model => (
                <ModelSelectorItem
                    key={`section-${model.provider}-${model.id}`}
                    model={model}
                    isSelected={selectedModels.some(m => m.provider === model.provider && m.model === model.id)}
                    isPrimary={selectedModel === model.id && selectedProvider === model.provider}
                    onSelect={onSelect}
                    toggleFavorite={toggleFavorite}
                    t={t}
                    modelIndex={selectedModels.findIndex(m => m.provider === model.provider && m.model === model.id)}
                />
            ))}
        </div>
    </div>
);
