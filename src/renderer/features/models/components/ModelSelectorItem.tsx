import { Brain, Check, ImageIcon, Info, Pin, Zap } from 'lucide-react';
import React, { useState } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ModelQuotaItem, QuotaResponse } from '@/types/quota';

import { ModelListItem } from '../types';

import { ModelLifecycleBadge } from './model-selector/ModelLifecycleBadge';

interface ModelSelectorItemProps {
    model: ModelListItem;
    isSelected: boolean;
    isPrimary: boolean;
    onSelect: (provider: string, model: string, isMultiSelect: boolean, level?: string) => void;
    toggleFavorite?: (modelId: string) => void;
    modelIndex?: number;
    t: (key: string) => string;
    activeAntigravityQuota?: QuotaResponse | null;
    thinkingLevel?: string;
    onThinkingLevelChange?: (modelId: string, level: string) => void;
}

const ANTIGRAVITY_QUOTA_GROUPS: Record<string, string[]> = {
    'gemini-3-pro': [
        'gemini-3.1-pro',
        'gemini-3.1-pro-low',
        'gemini-3.1-pro-high',
        'gemini-3-pro-preview',
        'gemini-3-pro-low',
        'gemini-3-pro-high'
    ],
    'shared-antigravity': [
        'gpt-oss',
        'gpt-oss-120b',
        'claude-3-5-sonnet',
        'claude-3-opus',
        'claude-3-haiku',
        'deepseek-v3',
        'deepseek-r1'
    ]
};

const THINKING_LEVEL_LABEL_KEYS: Record<string, string> = {
    low: 'modelSelector.thinking.low',
    high: 'modelSelector.thinking.high',
    max: 'modelSelector.thinking.max',
};

function getAntigravityAliases(modelId: string, label: string): string[] {
    const normalizedId = modelId.replace(/-antigravity$/i, '').toLowerCase();
    const normalizedLabel = label.toLowerCase();
    if (normalizedId.includes('gemini-3.1-pro') || normalizedLabel.includes('gemini 3.1 pro')) {
        return ANTIGRAVITY_QUOTA_GROUPS['gemini-3-pro'];
    }
    if (normalizedId.includes('gpt-oss') || normalizedId.includes('claude-3')) {
        return ANTIGRAVITY_QUOTA_GROUPS['shared-antigravity'];
    }
    for (const groupModels of Object.values(ANTIGRAVITY_QUOTA_GROUPS)) {
        if (groupModels.some(item => item.toLowerCase() === normalizedId)) {
            return groupModels.map(item => item.toLowerCase());
        }
    }
    return [normalizedId];
}

function extractPercent(value: {
    percentage?: number;
    quotaInfo?: { remainingFraction?: number; remainingQuota?: number; totalQuota?: number };
}): number | null {
    if (typeof value.quotaInfo?.remainingFraction === 'number' && Number.isFinite(value.quotaInfo.remainingFraction)) {
        return Math.round(Math.max(0, Math.min(1, value.quotaInfo.remainingFraction)) * 100);
    }
    if (typeof value.percentage === 'number' && Number.isFinite(value.percentage)) {
        return Math.round(Math.max(0, Math.min(100, value.percentage)));
    }
    if (
        typeof value.quotaInfo?.remainingQuota === 'number' &&
        typeof value.quotaInfo?.totalQuota === 'number' &&
        Number.isFinite(value.quotaInfo.remainingQuota) &&
        Number.isFinite(value.quotaInfo.totalQuota) &&
        value.quotaInfo.totalQuota > 0
    ) {
        return Math.round((value.quotaInfo.remainingQuota / value.quotaInfo.totalQuota) * 100);
    }
    return null;
}

function getAntigravityPercent(model: ModelListItem, activeAntigravityQuota?: QuotaResponse | null): number | null {
    // Prioritize specific percentage already in the model data from the proxy/engine
    const localPercent = extractPercent(model);
    if (localPercent !== null) {
        return localPercent;
    }

    const quotaMatch = getAntigravityQuotaMatch(model, activeAntigravityQuota);
    if (quotaMatch) {
        return extractPercent(quotaMatch);
    }

    const familyLabel = model.label.toLowerCase().replace(/\s*\((high|low)\)\s*$/i, '').trim();
    const fallbackMatches = activeAntigravityQuota?.models.filter(item => {
        const normalizedName = item.name.toLowerCase();
        return normalizedName.includes(familyLabel) || familyLabel.includes(normalizedName);
    }) ?? [];
    const quotaPercents = fallbackMatches
        .map(item => extractPercent(item))
        .filter((percent): percent is number => percent !== null);

    if (quotaPercents.length > 0) {
        return Math.min(...quotaPercents);
    }

    if (familyLabel.includes('gemini 3.1 pro')) {
        return 0;
    }
    return null;
}

function getAntigravityQuotaMatch(
    model: ModelListItem,
    activeAntigravityQuota?: QuotaResponse | null
): ModelQuotaItem | null {
    const aliases = new Set(getAntigravityAliases(model.id, model.label));
    const quotaMatches = activeAntigravityQuota?.models.filter(item => aliases.has(item.id.toLowerCase())) ?? [];
    if (quotaMatches.length > 0) {
        return quotaMatches.reduce((lowest, current) =>
            current.percentage < lowest.percentage ? current : lowest
        );
    }
    return null;
}

function getQuotaTone(percent: number): string {
    if (percent <= 10) { return 'stroke-destructive text-destructive bg-destructive/10 border-destructive/20'; }
    if (percent <= 30) { return 'stroke-warning text-warning bg-warning/10 border-warning/20'; }
    return 'stroke-primary text-primary bg-primary/10 border-primary/20';
}

const ModelQuotaDisplay: React.FC<{
    model: ModelListItem;
    activeAntigravityQuota?: QuotaResponse | null;
    t: (key: string) => string;
}> = ({ model, activeAntigravityQuota, t }) => {
    if (model.provider !== 'antigravity' && model.provider !== 'copilot') { return null; }

    const quotaMatch = getAntigravityQuotaMatch(model, activeAntigravityQuota);
    const percent = getAntigravityPercent(model, activeAntigravityQuota);
    const creditMultiplier = model.creditMultiplier;

    if (percent === null && !creditMultiplier) { return null; }

    const aiCredits = quotaMatch?.quotaInfo?.aiCredits;
    const creditLabel = typeof aiCredits?.creditAmount === 'number'
        ? `${t('models.creditsLeft')}: ${Math.max(0, Math.round(aiCredits.creditAmount))}`
        : null;

    return (
        <div className="mt-2 space-y-1">
            {percent !== null && model.provider !== 'copilot' && (
                <>
                    <div className="flex items-center justify-between gap-2 text-[10px] font-bold">
                        <span className="text-muted-foreground/55 uppercase tracking-tight">{t('statistics.quotaStatus')}</span>
                        <span className={cn("rounded border px-1.5 py-0.5 leading-none", getQuotaTone(percent).split(' ').slice(1))}>
                            {percent}%
                        </span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-muted/20 overflow-hidden">
                        <div
                            className={cn(
                                "h-full transition-all duration-700 ease-out",
                                percent <= 10 ? 'bg-destructive/70' : percent <= 30 ? 'bg-warning/70' : 'bg-primary/70'
                            )}
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                </>
            )}

            <div className="flex items-center justify-between gap-2 mt-1">
                {creditLabel && (
                    <div className="text-[10px] font-bold text-muted-foreground/45">
                        {creditLabel}
                    </div>
                )}
                {creditMultiplier !== undefined && creditMultiplier > 0 && (
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-primary/5 border border-primary/10 text-[9px] font-black uppercase tracking-wider text-primary/70">
                        <Zap className="w-2.5 h-2.5 fill-current" />
                        <span>{creditMultiplier} {creditMultiplier === 1 ? 'Credit' : 'Credits'}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export const ModelSelectorItem: React.FC<ModelSelectorItemProps> = ({
    model,
    isSelected,
    onSelect,
    toggleFavorite,
    t,
    activeAntigravityQuota,
    thinkingLevel
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        if (hoverTimeoutRef.current) { clearTimeout(hoverTimeoutRef.current); }
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        hoverTimeoutRef.current = setTimeout(() => {
            setIsHovered(false);
        }, 300); // More generous delay for moving to popover
    };

    return (
        <Popover open={isHovered} onOpenChange={setIsHovered}>
            <PopoverTrigger asChild>
                <button
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelect(model.provider, model.id, e.shiftKey);
                    }}
                    className={cn(
                        "w-full flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all text-left group relative border",
                        isSelected
                            ? "bg-primary/10 text-foreground border-primary/30 shadow-sm"
                            : (model.disabled
                                ? "opacity-50 cursor-not-allowed border-transparent"
                                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground border-transparent hover:border-border/20")
                    )}
                    disabled={model.disabled}
                >
                    <div className={cn(
                        "w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-muted/50 border border-border/10 transition-colors",
                        isSelected ? "border-primary/40 bg-primary/5" : "group-hover:bg-muted"
                    )}>
                        {model.type === 'image' ? <ImageIcon className="w-4 h-4 text-success/70" /> : <Zap className={cn("w-4 h-4", isSelected ? "text-primary" : "text-muted-foreground/40")} />}
                    </div>

                    <div className="min-w-0 flex-1 flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="truncate font-semibold tracking-tight text-foreground/90 text-[13px]">
                                {model.label}
                            </span>
                            {model.supportsReasoning && (
                                <Brain className={cn("w-3 h-3 transition-colors", isSelected ? "text-accent" : "text-muted-foreground/30")} />
                            )}
                            <ModelLifecycleBadge model={model} />
                        </div>



                        <ModelQuotaDisplay
                            model={model}
                            activeAntigravityQuota={activeAntigravityQuota}
                            t={t}
                        />
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-1">
                        {toggleFavorite && (
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFavorite(model.id);
                                }}
                                className={cn(
                                    "p-1 rounded-md hover:bg-muted transition-all cursor-pointer",
                                    model.pinned ? "text-warning" : "text-muted-foreground/20 opacity-0 group-hover:opacity-100"
                                )}
                            >
                                <Pin className={cn("w-3.5 h-3.5", model.pinned && "fill-current")} />
                            </div>
                        )}
                        {isSelected && (
                            <div className="bg-primary/20 p-1 rounded-full">
                                <Check className="w-3 h-3 text-primary" />
                            </div>
                        )}
                    </div>
                </button>
            </PopoverTrigger>

            <PopoverContent
                side="right"
                align="start"
                sideOffset={12}
                className="w-64 p-4 space-y-4 rounded-2xl border-border/40 shadow-2xl backdrop-blur-3xl bg-popover/95 animate-in fade-in zoom-in-95 duration-200 z-[10002]"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div className="space-y-3">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-bold text-foreground/90 uppercase tracking-wider">
                            <Info className="w-3.5 h-3.5 text-primary" />
                            {model.label}
                        </div>

                    </div>

                    {model.creditMultiplier !== undefined && (
                        <div className="flex flex-col gap-1 px-3 py-2 rounded-xl bg-muted/30 border border-border/10">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-tighter">Usage Cost</span>
                                <div className="flex items-center gap-1 text-primary">
                                    <Zap className="w-3 h-3 fill-current" />
                                    <span className="text-xs font-black">{model.creditMultiplier} Credits</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {model.supportsReasoning && model.thinkingLevels && model.thinkingLevels.length > 0 && (
                    <div className="space-y-3 pt-3 border-t border-border/10">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 px-0.5">
                            <Brain className="w-3 h-3" />
                            Thinking Mode
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {model.thinkingLevels.map(level => {
                                const isActive = thinkingLevel === level;
                                return (
                                    <button
                                        key={level}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            // Handle both changing the level and selecting the model with that level
                                            onSelect(model.provider, model.id, false, level);
                                        }}
                                        className={cn(
                                            "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border",
                                            isActive
                                                ? "bg-primary/10 text-primary border-primary/30 shadow-sm"
                                                : "bg-muted/10 text-muted-foreground/60 border-transparent hover:bg-muted/20 hover:text-foreground"
                                        )}
                                    >
                                        {t(THINKING_LEVEL_LABEL_KEYS[level] ?? '') || (level.charAt(0).toUpperCase() + level.slice(1))}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="pt-2 flex flex-col gap-1.5 border-t border-border/10">
                    <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground/50">
                        <span>Context Window</span>
                        <span className="text-foreground/70 font-bold">{model.contextWindow || '128k'} tokens</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground/50">
                        <span>Training Data</span>
                        <span className="text-foreground/70 font-bold">Up to 2024</span>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};

ModelSelectorItem.displayName = 'ModelSelectorItem';
