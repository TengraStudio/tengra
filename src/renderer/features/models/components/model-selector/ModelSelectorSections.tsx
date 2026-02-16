import { Bot, Brain, Clock, Search, Sparkles, Star, X, Zap } from 'lucide-react';
import React from 'react';
import { Virtuoso } from 'react-virtuoso';

import { cn } from '@/lib/utils';

import { ModelCategory, ModelListItem } from '../../types';
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
    onSelect: (provider: string, id: string, isMultiSelect: boolean) => void;
    toggleFavorite?: (modelId: string) => void;
    t: (key: string) => string;
}

const CategoryRow: React.FC<{
    category: ModelCategory;
    selectedModels: Array<{ provider: string; model: string }>;
    selectedModel: string;
    selectedProvider: string;
    onSelect: (provider: string, id: string, isMultiSelect: boolean) => void;
    toggleFavorite?: (modelId: string) => void;
    t: (key: string) => string;
}> = ({ category, selectedModels, selectedModel, selectedProvider, onSelect, toggleFavorite, t }) => (
    <div className="border-b border-border/30 last:border-b-0">
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

export const ModelSelectorCategoryList: React.FC<ModelSelectorCategoryListProps> = ({
    filteredCategories,
    favoriteModels,
    recentModelItems,
    searchQuery,
    selectedModels,
    selectedModel,
    selectedProvider,
    onSelect,
    toggleFavorite,
    t,
}) => {
    const shouldVirtualize = filteredCategories.length > 5;

    return (
        <>
            {!searchQuery && favoriteModels.length > 0 && (
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

            {!searchQuery && recentModelItems.length > 0 && (
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

            {filteredCategories.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>{t('modelSelector.noModelsFound')}</p>
                </div>
            ) : shouldVirtualize ? (
                <Virtuoso
                    style={{ height: '100%' }}
                    data={filteredCategories}
                    itemContent={(_, category) => (
                        <CategoryRow
                            category={category}
                            selectedModels={selectedModels}
                            selectedModel={selectedModel}
                            selectedProvider={selectedProvider}
                            onSelect={onSelect}
                            toggleFavorite={toggleFavorite}
                            t={t}
                        />
                    )}
                />
            ) : (
                filteredCategories.map(category => (
                    <CategoryRow
                        key={category.id}
                        category={category}
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
