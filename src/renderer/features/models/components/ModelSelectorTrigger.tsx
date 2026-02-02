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
    isIconOnly?: boolean;
}

const CategoryIconBadge: React.FC<{ category?: MinimalCategory; isIconOnly?: boolean }> = ({ category, isIconOnly }) => (
    <div className={cn(
        "rounded-lg flex items-center justify-center shrink-0 shadow-inner transition-all",
        category?.bg ?? 'bg-muted/50',
        isIconOnly ? "w-5 h-5" : "w-6 h-6"
    )}>
        {category?.icon && <category.icon className={cn(
            category.color,
            isIconOnly ? "w-3 h-3" : "w-3.5 h-3.5"
        )} />}
    </div>
);

const getContextColor = (usagePercent: number): string => {
    if (usagePercent > 90) { return "bg-destructive"; }
    if (usagePercent > 70) { return "bg-orange"; }
    return "bg-success/50";
};

interface ModelLabelInfoProps {
    currentCatName: string;
    selectedModelsCount: number;
    modelLabel: string;
    modelType?: string;
    contextTokens: number;
    contextUsagePercent: number;
    t: (k: string) => string;
}

const shouldRenderExtraModelCount = (count: number): boolean => count > 1;

const shouldRenderContextBar = (tokens: number): boolean => tokens > 0;

const shouldRenderImageTypeIcon = (modelType?: string): boolean => modelType === 'image';

const ModelLabelInfo: React.FC<ModelLabelInfoProps> = ({ 
    currentCatName, 
    selectedModelsCount, 
    modelLabel, 
    modelType, 
    contextTokens, 
    contextUsagePercent 
}) => (
    <div className="flex flex-col items-start leading-none overflow-hidden flex-1 text-left">
        <div className="flex items-center justify-between w-full pr-1">
            <span className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.05em] truncate">
                {currentCatName}
                {shouldRenderExtraModelCount(selectedModelsCount) && (
                    <span className="ml-1.5 text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[8px]">+{selectedModelsCount - 1}</span>
                )}
            </span>
        </div>
        <div className="flex items-center gap-1.5 font-bold text-sm text-foreground truncate w-full mt-1 tracking-tight">
            <span className="truncate">{modelLabel}</span>
            {shouldRenderImageTypeIcon(modelType) && <ImageIcon className="w-2.5 h-2.5 text-success" />}
        </div>
        {shouldRenderContextBar(contextTokens) && (
            <div className="w-full h-[2px] bg-border/30 rounded-full mt-1.5 overflow-hidden">
                <div
                    className={cn("h-full transition-all duration-500", getContextColor(contextUsagePercent))}
                    style={{ width: `${contextUsagePercent}%` }}
                />
            </div>
        )}
    </div>
);

const getButtonClasses = (isIconOnly: boolean): string => {
    return cn(
        "flex items-center gap-2.5 bg-muted/30 hover:bg-muted/40 border border-border/50 hover:border-border rounded-xl transition-all outline-none justify-between group/sel shadow-sm",
        isIconOnly ? "p-1.5 w-auto min-w-0" : "px-3 py-1.5 min-w-[150px]"
    );
};

const shouldRenderModelInfo = (isIconOnly: boolean): boolean => !isIconOnly;

const shouldRenderChevron = (isIconOnly: boolean): boolean => !isIconOnly;

const getChevronClasses = (isOpen: boolean): string => {
    return cn(
        "w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0 ml-1 group-hover/sel:text-foreground",
        isOpen && "rotate-180"
    );
};

const getCategoryName = (currentCategory: MinimalCategory | undefined, t: (key: string) => string): string => {
    return currentCategory?.name ?? t('modelSelector.model');
};

const getButtonTitle = (isIconOnly: boolean, currentModelInfo: MinimalModel | null | undefined, selectedModel: string): string | undefined => {
    return isIconOnly ? (currentModelInfo?.label ?? selectedModel) : undefined;
};

interface TriggerContentProps {
    currentCategory?: MinimalCategory;
    currentModelInfo?: MinimalModel | null;
    selectedModel: string;
    selectedModels: Array<{ provider: string; model: string }>;
    contextTokens: number;
    contextUsagePercent: number;
    t: (key: string) => string;
    isIconOnly?: boolean;
    isOpen: boolean;
}

const TriggerContent: React.FC<TriggerContentProps> = ({
    currentCategory,
    currentModelInfo,
    selectedModel,
    selectedModels,
    contextTokens,
    contextUsagePercent,
    t,
    isIconOnly,
    isOpen
}) => (
    <>
        <div className="flex items-center gap-2.5 overflow-hidden flex-1">
            <CategoryIconBadge category={currentCategory} isIconOnly={isIconOnly} />
            {shouldRenderModelInfo(isIconOnly ?? false) && (
                <ModelLabelInfo
                    currentCatName={getCategoryName(currentCategory, t)}
                    selectedModelsCount={selectedModels.length}
                    modelLabel={currentModelInfo?.label ?? selectedModel}
                    modelType={currentModelInfo?.type}
                    contextTokens={contextTokens}
                    contextUsagePercent={contextUsagePercent}
                    t={t}
                />
            )}
        </div>
        {shouldRenderChevron(isIconOnly ?? false) && (
            <ChevronDown className={getChevronClasses(isOpen)} />
        )}
    </>
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
    t,
    isIconOnly
}, ref) => (
    <button
        ref={ref}
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className={getButtonClasses(isIconOnly ?? false)}
        title={getButtonTitle(isIconOnly ?? false, currentModelInfo, selectedModel)}
    >
        <TriggerContent
            currentCategory={currentCategory}
            currentModelInfo={currentModelInfo}
            selectedModel={selectedModel}
            selectedModels={selectedModels}
            contextTokens={contextTokens}
            contextUsagePercent={contextUsagePercent}
            t={t}
            isIconOnly={isIconOnly}
            isOpen={isOpen}
        />
    </button>
));

ModelSelectorTrigger.displayName = 'ModelSelectorTrigger';
