import { Bot, Brain, Clock, Search, Sparkles, Star, X, Zap } from 'lucide-react';
import React from 'react';
import { Virtuoso } from 'react-virtuoso';

import { cn } from '@/lib/utils';

import { ModelCategory, ModelListItem } from '../../types';
import { scoreModelForMode } from '../../utils/model-selector-metadata';
import { ModelSelectorItem } from '../ModelSelectorItem';

export type SelectorChatMode = 'instant' | 'thinking' | 'agent';

const MODE_CONFIG: Record<
    SelectorChatMode,
    { icon: React.ElementType; color: string; bg: string }
> = {
    instant: { icon: Zap, color: 'text-warning', bg: 'bg-warning/10' },
    thinking: { icon: Brain, color: 'text-accent', bg: 'bg-accent/10' },
    agent: { icon: Bot, color: 'text-info', bg: 'bg-info/10' },
};

interface ModelSelectorHeaderProps {
    title: string;
    closeLabel: string;
    onClose: () => void;
}

export const ModelSelectorHeader: React.FC<ModelSelectorHeaderProps> = ({
    title,
    closeLabel,
    onClose,
}) => (
    <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 id="model-selector-title" className="text-lg font-semibold">
                {title}
            </h2>
        </div>
        <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
            aria-label={closeLabel}
        >
            <X className="w-5 h-5" />
        </button>
    </div>
);

interface ModelSelectorModeTabsProps {
    modeLabel: string;
    chatMode: SelectorChatMode;
    onChatModeChange?: (mode: SelectorChatMode) => void;
    activeTab: 'models' | 'reasoning';
    onTabChange: (tab: 'models' | 'reasoning') => void;
    showReasoningTab: boolean;
}

export const ModelSelectorModeTabs: React.FC<ModelSelectorModeTabsProps> = ({
    modeLabel,
    chatMode,
    onChatModeChange,
    activeTab,
    onTabChange,
    showReasoningTab,
}) => (
    <div className="px-4 py-3 border-b border-border/50 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">{modeLabel}:</span>
            <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
                {(Object.keys(MODE_CONFIG) as SelectorChatMode[]).map(mode => {
                    const config = MODE_CONFIG[mode];
                    const Icon = config.icon;
                    const isActive = chatMode === mode;
                    return (
                        <button
                            key={mode}
                            onClick={() => onChatModeChange?.(mode)}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                                isActive
                                    ? cn(config.bg, config.color)
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            )}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            <span className="capitalize">{mode}</span>
                        </button>
                    );
                })}
            </div>
        </div>

        {showReasoningTab && (
            <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1 ml-auto">
                <button
                    onClick={() => onTabChange('models')}
                    className={cn(
                        'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                        activeTab === 'models'
                            ? 'bg-primary/20 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                >
                    Models
                </button>
                <button
                    onClick={() => onTabChange('reasoning')}
                    className={cn(
                        'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                        activeTab === 'reasoning'
                            ? 'bg-primary/20 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                >
                    Reasoning
                </button>
            </div>
        )}
    </div>
);

interface ModelSelectorSearchProps {
    searchQuery: string;
    onSearchQueryChange: (query: string) => void;
    searchInputRef: React.RefObject<HTMLInputElement>;
    placeholder: string;
}

export const ModelSelectorSearch: React.FC<ModelSelectorSearchProps> = ({
    searchQuery,
    onSearchQueryChange,
    searchInputRef,
    placeholder,
}) => (
    <div className="p-3 border-b border-border/50">
        <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2 border border-border/50 focus-within:border-primary/50 transition-colors">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
                ref={searchInputRef}
                type="text"
                placeholder={placeholder}
                value={searchQuery}
                onChange={e => onSearchQueryChange(e.target.value)}
                className="bg-transparent border-none p-0 text-sm focus:ring-0 w-full placeholder:text-muted-foreground/50 outline-none text-foreground"
            />
        </div>
    </div>
);

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
    t,
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
                    isSelected={selectedModels.some(
                        m => m.provider === model.provider && m.model === model.id
                    )}
                    isPrimary={selectedModel === model.id && selectedProvider === model.provider}
                    onSelect={onSelect}
                    toggleFavorite={toggleFavorite}
                    t={t}
                    modelIndex={selectedModels.findIndex(
                        m => m.provider === model.provider && m.model === model.id
                    )}
                />
            ))}
        </div>
    </div>
);

interface ModelSelectorCategoryListProps {
    filteredCategories: ModelCategory[];
    favoriteModels: ModelListItem[];
    recentModelItems: ModelListItem[];
    searchQuery: string;
    selectedModels: Array<{ provider: string; model: string }>;
    selectedModel: string;
    selectedProvider: string;
    chatMode: SelectorChatMode;
    onSelect: (provider: string, id: string, isMultiSelect: boolean) => void;
    toggleFavorite?: (modelId: string) => void;
    t: (key: string) => string;
    compactRows?: boolean;
}

const CategoryRow: React.FC<{
    category: ModelCategory;
    collapsed: boolean;
    onToggleCollapse: (categoryId: string) => void;
    selectedModels: Array<{ provider: string; model: string }>;
    selectedModel: string;
    selectedProvider: string;
    onSelect: (provider: string, id: string, isMultiSelect: boolean) => void;
    toggleFavorite?: (modelId: string) => void;
    t: (key: string) => string;
}> = ({ category, collapsed, onToggleCollapse, selectedModels, selectedModel, selectedProvider, onSelect, toggleFavorite, t }) => (
    <div className="border-b border-border/30 last:border-b-0">
        <button
            type="button"
            onClick={() => onToggleCollapse(category.id)}
            className="sticky top-0 z-10 w-full px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 bg-popover/95 backdrop-blur-md hover:text-foreground transition-colors"
            aria-expanded={!collapsed}
            aria-label={`${category.name} category`}
        >
            <category.icon className={cn('w-3.5 h-3.5', category.color)} />
            <span>{category.name}</span>
            <span className="text-muted-foreground/50 font-normal">({category.models.length})</span>
            <span className="ml-auto">
                {collapsed ? '+' : '-'}
            </span>
        </button>
        {!collapsed && (
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {category.models.map(model => (
                    <ModelSelectorItem
                        key={`${category.id}-${model.provider}-${model.id}`}
                        model={model}
                        isSelected={selectedModels.some(
                            m => m.provider === model.provider && m.model === model.id
                        )}
                        isPrimary={selectedModel === model.id && selectedProvider === model.provider}
                        onSelect={onSelect}
                        toggleFavorite={toggleFavorite}
                        t={t}
                        modelIndex={selectedModels.findIndex(
                            m => m.provider === model.provider && m.model === model.id
                        )}
                    />
                ))}
            </div>
        )}
    </div>
);

export const ModelSelectorCategoryList: React.FC<ModelSelectorCategoryListProps> = ({
    filteredCategories,
    favoriteModels,
    recentModelItems,
    searchQuery,
    selectedModels,
    selectedModel,
    selectedProvider,
    chatMode,
    onSelect,
    toggleFavorite,
    t,
    compactRows: _compactRows,
}) => {
    const [collapsedCategoryIds, setCollapsedCategoryIds] = React.useState<Set<string>>(
        () => new Set<string>()
    );
    const toggleCategoryCollapse = React.useCallback((categoryId: string) => {
        setCollapsedCategoryIds(prev => {
            const next = new Set(prev);
            if (next.has(categoryId)) {
                next.delete(categoryId);
            } else {
                next.add(categoryId);
            }
            return next;
        });
    }, []);

    const shouldVirtualize = filteredCategories.length > 5;

    const modeFilteredCategories = filteredCategories
        .map(category => ({
            ...category,
            models: [...category.models]
                .sort((a, b) => scoreModelForMode(b, chatMode) - scoreModelForMode(a, chatMode) || a.label.localeCompare(b.label))
        }))
        .filter(category => category.models.length > 0);

    const allModels = modeFilteredCategories.flatMap(category => category.models);
    const dedupe = (models: ModelListItem[]): ModelListItem[] => {
        const seen = new Set<string>();
        return models.filter(model => {
            const key = `${model.provider}:${model.id}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    };

    const recommendedModels = dedupe(
        [...allModels]
            .filter(model => model.lifecycle !== 'retired')
            .sort((a, b) => scoreModelForMode(b, chatMode) - scoreModelForMode(a, chatMode))
            .slice(0, 8)
    );

    const deprecatedModels = dedupe(
        allModels.filter(model => model.lifecycle === 'deprecated' || model.lifecycle === 'retired')
    );
    const showCuratedSections = searchQuery.trim() === '';

    return (
        <>
            {showCuratedSections && recommendedModels.length > 0 && (
                <ModelSection
                    title="Recommended"
                    icon={<Sparkles className="w-3.5 h-3.5 text-primary" />}
                    models={recommendedModels}
                    selectedModels={selectedModels}
                    selectedModel={selectedModel}
                    selectedProvider={selectedProvider}
                    onSelect={onSelect}
                    toggleFavorite={toggleFavorite}
                    t={t}
                />
            )}



            {showCuratedSections && favoriteModels.length > 0 && (
                <ModelSection
                    title={t('common.favorites')}
                    icon={<Star className="w-3.5 h-3.5 text-warning" />}
                    models={favoriteModels}
                    selectedModels={selectedModels}
                    selectedModel={selectedModel}
                    selectedProvider={selectedProvider}
                    onSelect={onSelect}
                    toggleFavorite={toggleFavorite}
                    t={t}
                />
            )}

            {showCuratedSections && recentModelItems.length > 0 && (
                <ModelSection
                    title={t('modelSelector.recentModels')}
                    icon={<Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                    models={recentModelItems}
                    selectedModels={selectedModels}
                    selectedModel={selectedModel}
                    selectedProvider={selectedProvider}
                    onSelect={onSelect}
                    toggleFavorite={toggleFavorite}
                    t={t}
                />
            )}

            {showCuratedSections && deprecatedModels.length > 0 && (
                <ModelSection
                    title="Deprecated"
                    icon={<Brain className="w-3.5 h-3.5 text-warning" />}
                    models={deprecatedModels}
                    selectedModels={selectedModels}
                    selectedModel={selectedModel}
                    selectedProvider={selectedProvider}
                    onSelect={onSelect}
                    toggleFavorite={toggleFavorite}
                    t={t}
                />
            )}

            {showCuratedSections && (
                <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/20 border-b border-border/30">
                    All Models
                </div>
            )}

            {modeFilteredCategories.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>{t('modelSelector.noModelsFound')}</p>
                </div>
            ) : shouldVirtualize ? (
                <div className="h-[360px] sm:h-[420px]">
                    <Virtuoso
                        style={{ height: '100%' }}
                        data={modeFilteredCategories}
                        itemContent={(_, category) => (
                        <CategoryRow
                            category={category}
                            collapsed={collapsedCategoryIds.has(category.id)}
                            onToggleCollapse={toggleCategoryCollapse}
                            selectedModels={selectedModels}
                            selectedModel={selectedModel}
                            selectedProvider={selectedProvider}
                                onSelect={onSelect}
                                toggleFavorite={toggleFavorite}
                                t={t}
                            />
                        )}
                    />
                </div>
            ) : (
                modeFilteredCategories.map(category => (
                    <CategoryRow
                        key={category.id}
                        category={category}
                        collapsed={collapsedCategoryIds.has(category.id)}
                        onToggleCollapse={toggleCategoryCollapse}
                        selectedModels={selectedModels}
                        selectedModel={selectedModel}
                        selectedProvider={selectedProvider}
                        onSelect={onSelect}
                        toggleFavorite={toggleFavorite}
                        t={t}
                    />
                ))
            )}
        </>
    );
};
