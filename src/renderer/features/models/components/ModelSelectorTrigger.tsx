/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconBolt, IconBrain, IconChevronDown, IconPhotoScan, IconRobot } from '@tabler/icons-react';
import React from 'react';

import { cn } from '@/lib/utils';

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
    chatMode?: 'instant' | 'thinking' | 'agent';
    showModeBadge?: boolean;
    triggerVariant?: 'default' | 'compact';
}

const CategoryIconBadge: React.FC<{ category?: MinimalCategory; isIconOnly?: boolean }> = ({ category, isIconOnly }) => (
    <div
        className={cn(
            'rounded-lg flex items-center justify-center shrink-0 shadow-inner transition-all',
            category?.bg ?? 'bg-muted/50',
            isIconOnly ? 'w-5 h-5' : 'w-6 h-6'
        )}
    >
        {category?.icon && (
            <category.icon
                className={cn(category.color, isIconOnly ? 'w-3 h-3' : 'w-3.5 h-3.5')}
            />
        )}
    </div>
);

const getContextColor = (usagePercent: number): string => {
    if (usagePercent > 90) { return 'bg-destructive'; }
    if (usagePercent > 70) { return 'bg-warning'; }
    return 'bg-success/50';
};

const getCategoryName = (currentCategory: MinimalCategory | undefined, t: (key: string) => string): string =>
    currentCategory?.name ?? t('frontend.modelSelector.model');

const getButtonTitle = (
    isIconOnly: boolean,
    currentModelInfo: MinimalModel | null | undefined,
    selectedModel: string
): string | undefined => (isIconOnly ? currentModelInfo?.label ?? selectedModel : undefined);

const getButtonClasses = (
    isIconOnly: boolean,
    triggerVariant: 'default' | 'compact'
): string =>
    cn(
        'flex items-center gap-2.5 border transition-all outline-none justify-between group/sel shadow-sm',
        triggerVariant === 'compact'
            ? 'min-w-0 w-full rounded-md border-border/60 bg-background px-2 py-1.5 hover:bg-accent/30'
            : isIconOnly
                ? 'w-auto min-w-0 rounded-xl bg-muted/30 p-1.5 hover:bg-muted/40 border-border/50 hover:border-border'
                : 'min-w-36 rounded-xl bg-muted/30 px-3 py-1.5 hover:bg-muted/40 border-border/50 hover:border-border'
    );

const shouldRenderModelInfo = (isIconOnly: boolean): boolean => !isIconOnly;

const shouldRenderChevron = (isIconOnly: boolean): boolean => !isIconOnly;

const getChevronClasses = (isOpen: boolean): string =>
    cn(
        'w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0 ml-1 group-hover/sel:text-foreground',
        isOpen && 'rotate-180'
    );

interface ModelLabelInfoProps {
    currentCatName: string;
    selectedModelsCount: number;
    modelLabel: string;
    modelType?: string;
    contextTokens: number;
    contextUsagePercent: number;
}

const ModelLabelInfo: React.FC<ModelLabelInfoProps> = ({
    currentCatName,
    selectedModelsCount,
    modelLabel,
    modelType,
    contextTokens,
    contextUsagePercent,
}) => (
    <div className="flex flex-col items-start leading-none overflow-hidden flex-1 text-left">
        <div className="flex items-center justify-between w-full pr-1">
            <span className="text-sm text-muted-foreground font-bold truncate">
                {currentCatName}
                {selectedModelsCount > 1 && (
                    <span className="ml-1.5 text-primary bg-primary/10 px-1.5 py-0.5 rounded text-sm">
                        +{selectedModelsCount - 1}
                    </span>
                )}
            </span>
        </div>
        <div className="flex items-center gap-1.5 font-bold text-sm text-foreground truncate w-full mt-1">
            <span className="truncate">{modelLabel}</span>
            {modelType === 'image' && <IconPhotoScan className="w-2.5 h-2.5 text-success" />}
        </div>
        {contextTokens > 0 && (
            <div className="w-full h-0.5 bg-border/30 rounded-full mt-1.5 overflow-hidden">
                <div
                    className={cn('h-full transition-all duration-500', getContextColor(contextUsagePercent))}
                    style={{ width: `${contextUsagePercent}%` }}
                />
            </div>
        )}
    </div>
);

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
    chatMode?: 'instant' | 'thinking' | 'agent';
    showModeBadge?: boolean;
    triggerVariant?: 'default' | 'compact';
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
    isOpen,
    chatMode = 'instant',
    showModeBadge = true,
    triggerVariant = 'default',
}) => {
    const ModeIcon = chatMode === 'thinking' ? IconBrain : chatMode === 'agent' ? IconRobot : IconBolt;
    const compact = triggerVariant === 'compact';

    return (
        <>
            <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                <div className="relative">
                    <CategoryIconBadge category={currentCategory} isIconOnly={isIconOnly} />
                    {isIconOnly && (
                        <div
                            className={cn(
                                'absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-background shadow-sm',
                                chatMode === 'thinking' ? 'bg-accent' : chatMode === 'agent' ? 'bg-info' : 'bg-warning'
                            )}
                        />
                    )}
                </div>
                {shouldRenderModelInfo(isIconOnly ?? false) && (
                    <div className="flex items-center gap-3 flex-1 overflow-hidden">
                        {compact ? (
                            <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                                <span className="truncate text-xs text-muted-foreground">
                                    {getCategoryName(currentCategory, t)}
                                </span>
                                <span className="text-xs text-muted-foreground">/</span>
                                <span className="truncate text-sm font-medium text-foreground">
                                    {currentModelInfo?.label ?? selectedModel}
                                </span>
                            </div>
                        ) : (
                            <ModelLabelInfo
                                currentCatName={getCategoryName(currentCategory, t)}
                                selectedModelsCount={selectedModels.length}
                                modelLabel={currentModelInfo?.label ?? selectedModel}
                                modelType={currentModelInfo?.type}
                                contextTokens={contextTokens}
                                contextUsagePercent={contextUsagePercent}
                            />
                        )}
                        {showModeBadge && (
                            <div
                                className={cn(
                                    'hidden xl:flex items-center gap-1.5 px-2 py-0.5 rounded-full border typo-body font-bold shrink-0',
                                    chatMode === 'thinking'
                                        ? 'bg-accent/10 text-accent border-accent/20'
                                        : chatMode === 'agent'
                                            ? 'bg-info/10 text-info border-info/20'
                                            : 'bg-warning/10 text-warning border-warning/20'
                                )}
                            >
                                <ModeIcon className="w-2.5 h-2.5" />
                                <span>{t(`modelSelector.modeOptions.${chatMode}`)}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {shouldRenderChevron(isIconOnly ?? false) && (
                <IconChevronDown className={getChevronClasses(isOpen)} />
            )}
        </>
    );
};

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
    chatMode,
    isIconOnly,
    showModeBadge = true,
    triggerVariant = 'default',
}, ref) => (
    <button
        ref={ref}
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className={cn(
            getButtonClasses(isIconOnly ?? false, triggerVariant),
            chatMode === 'thinking'
                ? 'focus-within:border-accent/50'
                : chatMode === 'agent'
                    ? 'focus-within:border-info/50'
                    : 'focus-within:border-warning/50'
        )}
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
            chatMode={chatMode}
            showModeBadge={showModeBadge}
            triggerVariant={triggerVariant}
        />
    </button>
));

ModelSelectorTrigger.displayName = 'ModelSelectorTrigger';
