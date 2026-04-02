import { Search } from 'lucide-react';
import React from 'react';

import { Skeleton } from '@/components/ui/skeleton';

import { ModelSelectorItem } from './ModelSelectorItem';

interface ModelItem {
    id: string;
    label: string;
    disabled: boolean;
    provider: string;
    type: string;
    contextWindow?: number;
    pinned?: boolean;
}

interface Category {
    id: string;
    name: string;
    icon: React.ElementType;
    color: string;
    bg: string;
    providerId: string;
    models: ModelItem[];
}

interface ModelSelectorContentProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    categories: Category[];
    selectedModels: Array<{ provider: string; model: string }>;
    selectedModel: string;
    selectedProvider: string;
    onSelect: (provider: string, id: string, isMultiSelect: boolean) => void;
    onRemoveModel?: (provider: string, model: string) => void;
    isFavorite?: (modelId: string) => boolean;
    toggleFavorite?: (modelId: string) => void;
    t: (key: string) => string;
}

export const ModelSelectorContent: React.FC<ModelSelectorContentProps> = ({
    searchQuery,
    setSearchQuery,
    categories,
    selectedModels,
    selectedModel,
    selectedProvider,
    onSelect,
    toggleFavorite,
    t
}) => {
    return (
        <>
            <div className="p-2 border-b border-border/50 bg-muted/30 sticky top-0 z-10">
                <div className="flex items-center gap-2 bg-background/50 rounded-lg px-2 py-1.5 border border-border/50 focus-within:border-primary/50 transition-colors">
                    <Search className="w-3.5 h-3.5 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder={t('modelSelector.searchModels')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-transparent border-none p-0 text-sm focus:ring-0 w-full placeholder:text-muted-foreground/30 outline-none text-foreground"
                        autoFocus
                    />
                </div>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 pb-2">
                {categories.length === 0 ? (
                    <div className="p-4 space-y-3">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                    </div>
                ) : (
                    categories.map(category => (
                        <div key={category.id} className="mb-1">
                            <div className="px-3 py-1.5 text-xxs font-bold text-muted-foreground flex items-center gap-2 bg-popover/95 sticky top-0 z-5 border-b border-border/50 shadow-sm">
                                <span>{category.name}</span>
                            </div>
                            <div className="px-1">
                                {Array.isArray(category.models) && category.models.map(model => (
                                    <ModelSelectorItem
                                        key={`${category.id}-${model.provider}-${model.id}`}
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
                    ))
                )}
            </div>
        </>
    );
};

ModelSelectorContent.displayName = 'ModelSelectorContent';
