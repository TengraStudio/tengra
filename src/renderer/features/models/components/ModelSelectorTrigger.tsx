import { ChevronDown, ImageIcon } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

// We define minimal interfaces here that match what we actually use from the hooks
interface MinimalCategory {
    name: string;
    icon: React.ElementType;
    color: string;
    bg: string;
}

interface MinimalModel {
    label: string;
    type?: string;
}

interface ModelSelectorTriggerProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    currentCategory?: MinimalCategory;
    currentModelInfo?: MinimalModel | null;
    selectedModel: string;
    selectedModels: Array<{ provider: string; model: string }>;
    contextTokens: number;
    contextUsagePercent: number;
    t: (key: string) => string;
}

const CategoryIconBadge: React.FC<{ category?: MinimalCategory }> = ({ category }) => (
    <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center shrink-0 shadow-inner", category?.bg ?? 'bg-muted/50')}>
        {category?.icon && <category.icon className={cn("w-3.5 h-3.5", category.color ?? 'text-muted-foreground')} />}
    </div>
);

const ModelLabelInfo: React.FC<{
    currentCatName: string;
    selectedModelsCount: number;
    modelLabel: string;
    modelType?: string;
    contextTokens: number;
    contextUsagePercent: number;
    t: (k: string) => string;
}> = ({ currentCatName, selectedModelsCount, modelLabel, modelType, contextTokens, contextUsagePercent, t }) => (
    <div className="flex flex-col items-start leading-none overflow-hidden flex-1 text-left">
        <div className="flex items-center justify-between w-full pr-1">
            <span className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.05em] truncate">
                {currentCatName}
                {selectedModelsCount > 1 && (
                    <span className="ml-1.5 text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[8px]">+{selectedModelsCount - 1}</span>
                )}
            </span>
        </div>
        <div className="flex items-center gap-1.5 font-bold text-sm text-foreground truncate w-full mt-1 tracking-tight">
            <span className="truncate">{modelLabel}</span>
            {modelType === 'image' && <ImageIcon className="w-2.5 h-2.5 text-success" />}
        </div>
        {contextTokens > 0 && (
            <div className="w-full h-[2px] bg-border/30 rounded-full mt-1.5 overflow-hidden">
                <div
                    className={cn(
                        "h-full transition-all duration-500",
                        contextUsagePercent > 90 ? "bg-destructive" : contextUsagePercent > 70 ? "bg-orange" : "bg-success/50"
                    )}
                    style={{ width: `${contextUsagePercent}%` }}
                />
            </div>
        )}
    </div>
);

export const ModelSelectorTrigger = React.forwardRef<HTMLButtonElement, ModelSelectorTriggerProps>(({
    isOpen,
    setIsOpen,
    currentCategory,
    currentModelInfo,
    selectedModel,
    selectedModels,
    contextTokens,
    contextUsagePercent,
    t
}, ref) => {
    return (
        <button
            ref={ref}
            onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
            className="flex items-center gap-2.5 bg-muted/30 hover:bg-muted/40 border border-border/50 hover:border-border rounded-xl px-3 py-1.5 transition-all outline-none min-w-[150px] justify-between group/sel shadow-sm"
        >
            <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                <CategoryIconBadge category={currentCategory} />
                <ModelLabelInfo
                    currentCatName={currentCategory?.name ?? t('modelSelector.model')}
                    selectedModelsCount={selectedModels.length}
                    modelLabel={currentModelInfo?.label ?? selectedModel ?? t('modelSelector.selectModel')}
                    modelType={currentModelInfo?.type}
                    contextTokens={contextTokens}
                    contextUsagePercent={contextUsagePercent}
                    t={t}
                />
            </div>
            <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0 ml-1 group-hover/sel:text-foreground", isOpen && "rotate-180")} />
        </button>
    );
});

ModelSelectorTrigger.displayName = 'ModelSelectorTrigger';
