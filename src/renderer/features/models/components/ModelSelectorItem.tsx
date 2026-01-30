import { Check, ImageIcon, Info, Pin } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

interface ModelItem {
    id: string;
    label: string;
    disabled: boolean;
    provider: string;
    type: string;
    contextWindow?: number;
    pinned?: boolean;
}

interface ModelSelectorItemProps {
    model: ModelItem;
    isSelected: boolean;
    isPrimary: boolean;
    onSelect: (provider: string, model: string, isMultiSelect: boolean) => void;
    toggleFavorite?: (modelId: string) => void;
    modelIndex?: number;
    t: (key: string) => string;
}

const ModelLabelSection: React.FC<{ model: ModelItem }> = ({ model }) => (
    <span className="truncate flex-1 flex items-center gap-2">
        {model.label}
        {model.type === 'image' && <ImageIcon className="w-3.5 h-3.5 text-success" />}
        {(model.contextWindow ?? 0) > 0 && (
            <span className="text-[9px] text-muted-foreground bg-muted/50 px-1 rounded border border-border/50">
                {(model.contextWindow ?? 0) >= 1000000 ? `${(model.contextWindow ?? 0) / 1000000}m` : `${(model.contextWindow ?? 0) / 1000}k`}
            </span>
        )}
    </span>
);

const ModelInfoBadges: React.FC<{ model: ModelItem, t: (k: string) => string }> = ({ model, t }) => (
    <>
        {model.type === 'image' && (
            <span className="text-[9px] font-black text-success bg-success/10 px-1.5 py-0.5 rounded leading-none mr-1">
                {t('modelSelector.image')}
            </span>
        )}
        {model.disabled && (
            <span className="text-[9px] font-black text-destructive flex items-center gap-1 bg-destructive/10 px-1.5 py-0.5 rounded leading-none">
                <Info className="w-2.5 h-2.5" />
                {t('modelSelector.limit')}
            </span>
        )}
    </>
);

const ModelActions: React.FC<{
    model: ModelItem;
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
                    model.pinned ? "text-yellow opacity-100" : "text-muted-foreground/50 opacity-0 group-hover:opacity-100"
                )}
            >
                <Pin className={cn("w-3 h-3", model.pinned && "fill-current")} />
            </div>
        )}
        {(isPrimary || isSelected) && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
        {isSelected && modelIndex !== undefined && modelIndex >= 0 && (
            <span className="text-[8px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded leading-none">
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
                "w-full flex items-center gap-2 px-3 py-1.5 rounded-md transition-all text-left text-sm group relative my-0.5",
                isSelected
                    ? "bg-primary/20 text-foreground font-bold border-l-2 border-primary"
                    : (model.disabled ? "opacity-30 cursor-not-allowed grayscale" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")
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
