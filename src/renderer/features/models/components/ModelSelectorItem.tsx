import { ModelLifecycleBadge } from '@renderer/features/models/components/model-selector/ModelLifecycleBadge';
import type { ModelListItem } from '@renderer/features/models/types';
import { Check, ImageIcon, Info, Pin } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

interface ModelSelectorItemProps {
    model: ModelListItem;
    isSelected: boolean;
    isPrimary: boolean;
    onSelect: (provider: string, model: string, isMultiSelect: boolean) => void;
    toggleFavorite?: (modelId: string) => void;
    modelIndex?: number;
    t: (key: string) => string;
}

const ModelLabelSection: React.FC<{ model: ModelListItem }> = ({ model }) => (
    <span className="truncate flex-1 flex items-center gap-2 font-semibold">
        {model.label}
        {model.type === 'image' && <ImageIcon className="w-3.5 h-3.5 text-success" />}
        {(model.contextWindow ?? 0) > 0 && (
            <span className="text-xxxs text-muted-foreground bg-muted/50 px-1 rounded border border-border/50">
                {(model.contextWindow ?? 0) >= 1000000 ? `${(model.contextWindow ?? 0) / 1000000}m` : `${(model.contextWindow ?? 0) / 1000}k`}
            </span>
        )}
    </span>
);

const ModelInfoBadges: React.FC<{ model: ModelListItem, t: (k: string) => string }> = ({ model, t }) => (
    <>
        <ModelLifecycleBadge model={model} />
        {model.disabled && (
            <span className="text-xxxs font-black text-destructive flex items-center gap-1 bg-destructive/10 px-1.5 py-0.5 rounded leading-none" title={model.disabledReason ?? t('modelSelector.limit')}>
                <Info className="w-2.5 h-2.5" />
                {model.disabledReason ?? t('modelSelector.limit')}
            </span>
        )}
    </>
);

const ModelActions: React.FC<{
    model: ModelListItem;
    isSelected: boolean;
    isPrimary: boolean;
    toggleFavorite?: (modelId: string) => void;
    modelIndex?: number;
}> = ({ model, isSelected, isPrimary, toggleFavorite, modelIndex }) => (
    <div className="flex items-center gap-1 ml-auto shrink-0">
        {toggleFavorite && (
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(model.id);
                }}
                className={cn(
                    "p-1 rounded hover:bg-muted/50 transition-colors cursor-pointer mr-1",
                    model.pinned ? "text-warning opacity-100" : "text-muted-foreground/50 opacity-0 group-hover:opacity-100"
                )}
            >
                <Pin className={cn("w-3 h-3", model.pinned && "fill-current")} />
            </div>
        )}
        {(isPrimary || isSelected) && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
        {isSelected && modelIndex !== undefined && modelIndex >= 0 && (
            <span className="text-xxxs font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded leading-none">
                {modelIndex + 1}
            </span>
        )}
    </div>
);

export const ModelSelectorItem: React.FC<ModelSelectorItemProps> = ({
    model,
    isSelected,
    isPrimary,
    onSelect,
    toggleFavorite,
    modelIndex,
    t
}) => {
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                onSelect(model.provider, model.id, e.shiftKey);
            }}
            className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left text-sm group relative my-0.5 border",
                isSelected
                    ? "bg-primary/15 text-foreground border-primary/40"
                    : (model.disabled
                        ? "opacity-50 cursor-not-allowed border-border/20"
                        : model.lifecycle && model.lifecycle !== 'active'
                            ? "text-muted-foreground/80 hover:bg-warning/5 hover:text-foreground border-warning/25"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border-border/30")
            )}
            disabled={model.disabled}
        >
            <ModelLabelSection model={model} />
            <ModelInfoBadges model={model} t={t} />
            <ModelActions
                model={model}
                isSelected={isSelected}
                isPrimary={isPrimary}
                toggleFavorite={toggleFavorite}
                modelIndex={modelIndex}
            />
        </button>
    );
};

ModelSelectorItem.displayName = 'ModelSelectorItem';
