import { ModelLifecycleBadge } from '@renderer/features/models/components/model-selector/ModelLifecycleBadge';
import type { ModelListItem } from '@renderer/features/models/types';
import { Check, ImageIcon, Info, Pin } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';
import type { QuotaResponse } from '@/types/quota';

interface ModelSelectorItemProps {
    model: ModelListItem;
    isSelected: boolean;
    isPrimary: boolean;
    onSelect: (provider: string, model: string, isMultiSelect: boolean) => void;
    toggleFavorite?: (modelId: string) => void;
    modelIndex?: number;
    t: (key: string) => string;
    activeAntigravityQuota?: QuotaResponse | null;
}

const ANTIGRAVITY_QUOTA_GROUPS: Record<string, string[]> = {
    'gemini-3-pro': [
        'gemini-3.1-pro',
        'gemini-3.1-pro-low',
        'gemini-3.1-pro-high',
        'gemini-3-pro-preview',
        'gemini-3-pro-low',
        'gemini-3-pro-high'
    ]
};

function getAntigravityAliases(modelId: string, label: string): string[] {
    const normalizedId = modelId.replace(/-antigravity$/i, '').toLowerCase();
    const normalizedLabel = label.toLowerCase();
    if (normalizedId.includes('gemini-3.1-pro') || normalizedLabel.includes('gemini 3.1 pro')) {
        return ANTIGRAVITY_QUOTA_GROUPS['gemini-3-pro'];
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
    const aliases = new Set(getAntigravityAliases(model.id, model.label));
    const quotaMatches = activeAntigravityQuota?.models.filter(item => aliases.has(item.id.toLowerCase())) ?? [];
    const familyLabel = model.label.toLowerCase().replace(/\s*\((high|low)\)\s*$/i, '').trim();
    const fallbackMatches = activeAntigravityQuota?.models.filter(item => {
        const normalizedName = item.name.toLowerCase();
        return normalizedName.includes(familyLabel) || familyLabel.includes(normalizedName);
    }) ?? [];
    const quotaPercents = quotaMatches
        .concat(fallbackMatches)
        .map(item => extractPercent(item))
        .filter((percent): percent is number => percent !== null);

    if (quotaPercents.length > 0) {
        return Math.min(...quotaPercents);
    }

    if (familyLabel.includes('gemini 3.1 pro')) {
        return 0;
    }
    return extractPercent(model);
}

function getQuotaTone(percent: number): string {
    if (percent <= 10) { return 'stroke-destructive text-destructive bg-destructive/10 border-destructive/20'; }
    if (percent <= 30) { return 'stroke-warning text-warning bg-warning/10 border-warning/20'; }
    return 'stroke-primary text-primary bg-primary/10 border-primary/20';
}

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

const ModelQuotaDisplay: React.FC<{
    model: ModelListItem;
    activeAntigravityQuota?: QuotaResponse | null;
    t: (key: string) => string;
}> = ({ model, activeAntigravityQuota, t }) => {
    if (model.provider === 'antigravity') {
        const percent = getAntigravityPercent(model, activeAntigravityQuota);
        if (percent === null) {
            return null;
        }

        return (
            <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between gap-2 text-xxxs font-black uppercase tracking-widest">
                    <span className="text-muted-foreground/55">{t('statistics.quotaStatus')}</span>
                    <span className={cn("rounded border px-1.5 py-0.5 leading-none", getQuotaTone(percent).split(' ').slice(1).join(' '))}>
                        {percent}%
                    </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted/20 overflow-hidden">
                    <div
                        className={cn(
                            "h-full transition-all duration-700 ease-out",
                            percent <= 10 ? 'bg-destructive/70' : percent <= 30 ? 'bg-warning/70' : 'bg-primary/70'
                        )}
                        style={{ width: `${percent}%` }}
                    />
                </div>
            </div>
        );
    }

    return null;
};

export const ModelSelectorItem: React.FC<ModelSelectorItemProps> = ({
    model,
    isSelected,
    isPrimary,
    onSelect,
    toggleFavorite,
    modelIndex,
    t,
    activeAntigravityQuota
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
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="truncate flex-1 flex items-center gap-2 font-semibold">
                        {model.label}
                        {model.type === 'image' && <ImageIcon className="w-3.5 h-3.5 text-success" />}
                        {(model.contextWindow ?? 0) > 0 && (
                            <span className="text-xxxs text-muted-foreground bg-muted/50 px-1 rounded border border-border/50">
                                {(model.contextWindow ?? 0) >= 1000000 ? `${(model.contextWindow ?? 0) / 1000000}m` : `${(model.contextWindow ?? 0) / 1000}k`}
                            </span>
                        )}
                    </span>
                    <ModelInfoBadges model={model} t={t} />
                    <ModelActions
                        model={model}
                        isSelected={isSelected}
                        isPrimary={isPrimary}
                        toggleFavorite={toggleFavorite}
                        modelIndex={modelIndex}
                    />
                </div>
                <ModelQuotaDisplay
                    model={model}
                    activeAntigravityQuota={activeAntigravityQuota}
                    t={t}
                />
            </div>
        </button>
    );
};

ModelSelectorItem.displayName = 'ModelSelectorItem';
