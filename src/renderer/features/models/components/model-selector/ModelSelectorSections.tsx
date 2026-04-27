/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconBolt,IconBox, IconBrain, IconClock, IconRobot, IconSearch, IconSparkles, IconStar, IconX } from '@tabler/icons-react';
import React from 'react';
import { Virtuoso } from 'react-virtuoso';

import { cn } from '@/lib/utils';
import type { ClaudeQuota, CodexUsage, CopilotQuota, QuotaResponse } from '@/types/quota';

import { ModelCategory, ModelListItem } from '../../types';
import { scoreModelForMode } from '../../utils/model-selector-metadata';
import { ModelSelectorItem } from '../ModelSelectorItem';

/* Batch-02: Extracted Long Classes */
const C_MODELSELECTORSECTIONS_1 = "flex items-center gap-3 bg-background/50 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-border/50 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-sm sm:gap-4";
const C_MODELSELECTORSECTIONS_2 = "bg-transparent border-none p-0 text-sm focus:ring-0 w-full placeholder:text-muted-foreground/40 outline-none text-foreground font-medium";
const C_MODELSELECTORSECTIONS_3 = "sticky top-0 z-10 w-full px-4 py-3.5 typo-body font-bold text-muted-foreground/60 flex items-center gap-2 bg-popover/95 backdrop-blur-md hover:text-foreground transition-all group/cat relative overflow-hidden uppercase ";


export type SelectorChatMode = 'instant' | 'thinking' | 'agent';

const MODE_CONFIG: Record<
    SelectorChatMode,
    { icon: React.ElementType; color: string; bg: string }
> = {
    instant: { icon: IconBolt, color: 'text-warning', bg: 'bg-warning/10' },
    thinking: { icon: IconBrain, color: 'text-accent', bg: 'bg-accent/10' },
    agent: { icon: IconRobot, color: 'text-info', bg: 'bg-info/10' },
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
            <IconSparkles className="w-5 h-5 text-primary" />
            <h2 id="model-selector-title" className="text-lg font-semibold">
                {title}
            </h2>
        </div>
        <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
            aria-label={closeLabel}
        >
            <IconX className="w-5 h-5" />
        </button>
    </div>
);

interface ModelSelectorModeTabsProps {
    modeLabel: string;
    chatMode: SelectorChatMode;
    onChatModeChange?: (mode: SelectorChatMode) => void;
    activeTab: 'models' | 'reasoning' | 'permissions';
    onTabChange: (tab: 'models' | 'reasoning' | 'permissions') => void;
    showReasoningTab: boolean;
    showPermissionsTab?: boolean;
    t: (key: string) => string;
}

export const ModelSelectorModeTabs: React.FC<ModelSelectorModeTabsProps> = ({
    modeLabel,
    chatMode,
    onChatModeChange,
    activeTab,
    onTabChange,
    showReasoningTab,
    showPermissionsTab = false,
    t,
}) => (
    <div className="px-4 py-3.5 border-b border-border/40 flex flex-wrap items-center gap-6 bg-muted/5">
        <div className="flex items-center gap-3">
            <span className="typo-body text-muted-foreground/80 font-bold uppercase ">{modeLabel}</span>
            <div className="flex gap-1 bg-background/50 backdrop-blur-sm rounded-xl p-1 border border-border/40 shadow-sm">
                {(Object.keys(MODE_CONFIG) as SelectorChatMode[]).map(mode => {
                    const config = MODE_CONFIG[mode];
                    const Icon = config.icon;
                    const isActive = chatMode === mode;
                    return (
                        <button
                            key={mode}
                            onClick={() => onChatModeChange?.(mode)}
                            className={cn(
                                'flex items-center gap-2 px-3.5 py-1.5 rounded-lg typo-caption font-bold transition-all duration-200',
                                isActive
                                    ? cn(config.bg, config.color, "shadow-card-md scale-102")
                                    : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted/50'
                            )}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{t(`modelSelector.modeOptions.${mode}`)}</span>
                        </button>
                    );
                })}
            </div>
        </div>

        {(showReasoningTab || showPermissionsTab) && (
            <div className="flex items-center gap-1 bg-background/50 backdrop-blur-sm rounded-xl p-1 border border-border/40 shadow-sm ml-auto">
                <button
                    onClick={() => onTabChange('models')}
                    className={cn(
                        'px-4 py-1.5 rounded-lg typo-caption font-bold transition-all duration-200',
                        activeTab === 'models'
                            ? 'bg-primary/20 text-primary shadow-card-sm'
                            : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted/50'
                    )}
                >
                    {t('modelSelector.tabs.models')}
                </button>
                {showReasoningTab && (
                    <button
                        onClick={() => onTabChange('reasoning')}
                        className={cn(
                            'px-4 py-1.5 rounded-lg typo-caption font-bold transition-all duration-200',
                            activeTab === 'reasoning'
                                ? 'bg-primary/20 text-primary shadow-card-sm'
                                : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted/50'
                        )}
                    >
                        {t('modelSelector.tabs.reasoning')}
                    </button>
                )}
                {showPermissionsTab && (
                    <button
                        onClick={() => onTabChange('permissions')}
                        className={cn(
                            'px-4 py-1.5 rounded-lg typo-caption font-bold transition-all duration-200',
                            activeTab === 'permissions'
                                ? 'bg-primary/20 text-primary shadow-card-sm'
                                : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted/50'
                        )}
                    >
                        {t('workspaceAgent.permissions.title')}
                    </button>
                )}
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
    <div className="px-4 py-3 bg-muted/5 border-b border-border/40">
        <div className={C_MODELSELECTORSECTIONS_1}>
            <IconSearch className="w-4 h-4 text-muted-foreground/60" />
            <input
                ref={searchInputRef}
                type="text"
                placeholder={placeholder}
                value={searchQuery}
                onChange={e => onSearchQueryChange(e.target.value)}
                className={C_MODELSELECTORSECTIONS_2}
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

function getQuotaTone(percent: number): string {
    if (percent <= 10) { return 'stroke-destructive text-destructive bg-destructive/10 border-destructive/20'; }
    if (percent <= 30) { return 'stroke-warning text-warning bg-warning/10 border-warning/20'; }
    return 'stroke-primary text-primary bg-primary/10 border-primary/20';
}

const CircularQuota: React.FC<{ value: number; label: string }> = ({ value, label }) => {
    const normalized = Math.max(0, Math.min(100, Math.round(value)));
    const radius = 10;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (normalized / 100) * circumference; 

    return (
        <div className="flex items-center gap-1.5">
            <div className={cn("relative flex h-7 w-7 items-center justify-center rounded-full border", getQuotaTone(normalized).split(' ').slice(2))}>
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r={radius} stroke="currentColor" strokeWidth="2" className="opacity-15" fill="none" />
                    <circle
                        cx="12"
                        cy="12"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        fill="none"
                        className={cn(getQuotaTone(normalized).split(' ').slice(0, 1))}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                    />
                </svg>
                <span className="text-sm font-bold text-foreground/90">{normalized}</span>
            </div>
            <span className="text-sm font-bold text-muted-foreground/70">{label}</span>
        </div>
    );
};

function renderProviderQuota(categoryId: string, options: {
    copilotQuota?: { accounts: Array<CopilotQuota & { accountId?: string; email?: string; isActive?: boolean }> } | null;
    activeCopilotAccountId?: string | null;
    activeCopilotAccountEmail?: string | null;
    activeClaudeQuota?: ClaudeQuota | null;
    activeCodexUsage?: ({ usage: CodexUsage; accountId?: string; email?: string } & { isActive?: boolean }) | null;
    t: (key: string) => string;
}) {
    const {
        copilotQuota,
        activeCopilotAccountId,
        activeCopilotAccountEmail,
        activeClaudeQuota,
        activeCodexUsage,
        t
    } = options;
    if (categoryId === 'copilot') {
        const activeAccount = copilotQuota?.accounts?.find(acc => acc.accountId === activeCopilotAccountId)
            ?? copilotQuota?.accounts?.find(acc => acc.email?.toLowerCase() === activeCopilotAccountEmail)
            ?? copilotQuota?.accounts?.find(acc => acc.isActive === true)
            ?? (copilotQuota?.accounts?.length === 1 ? copilotQuota.accounts[0] : null);

        if (!activeAccount) {
            return null;
        }

        const limit = activeAccount.seat_breakdown ? activeAccount.seat_breakdown.total_seats : (activeAccount.limit ?? 0);
        const remaining = activeAccount.seat_breakdown ? (limit - activeAccount.seat_breakdown.active_seats) : (activeAccount.remaining ?? 0);
        const creditsPercent = limit > 0 ? Math.max(0, Math.min(100, Math.round((remaining / limit) * 100))) : 0;
        const rateLimit = activeAccount.rate_limit;

        return {
            badges: (
                <div className="flex items-center gap-1.5">
                    <span className="text-sm text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 leading-none">
                        {remaining}/{limit || 0} {t('modelSelector.creditsLeft')}
                    </span>
                    {rateLimit && (
                        <span className="text-sm text-warning font-bold bg-warning/10 px-2 py-0.5 rounded-full border border-warning/20 leading-none">
                            {t('statistics.rateLimit')} {rateLimit.remaining}/{rateLimit.limit}
                        </span>
                    )}
                </div>
            ),
            progress: (
                <div className="px-4 pb-3.5 bg-muted/5">
                    <div className="flex items-center justify-between typo-body font-bold text-muted-foreground/60 mb-1.5">
                        <span className="uppercase ">{t('statistics.usageStatus')}</span>
                        <span className="text-foreground/70">{creditsPercent}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted/30 overflow-hidden shadow-inner">
                        <div
                            className={cn(
                                "h-full transition-all duration-700 ease-out",
                                creditsPercent < 20 ? "bg-destructive/60" : creditsPercent < 50 ? "bg-warning/60" : "bg-primary/70"
                            )}
                            style={{ width: `${creditsPercent}%` }}
                        />
                    </div>
                </div>
            )
        };
    }

    if (categoryId === 'claude') {
        const fiveHour = activeClaudeQuota?.fiveHour;
        const sevenDay = activeClaudeQuota?.sevenDay;
        if (!fiveHour && !sevenDay) {
            return null;
        }
        return {
            badges: (
                <div className="flex items-center gap-2">
                    {fiveHour && <CircularQuota value={100 - fiveHour.utilization} label="5H" />}
                    {sevenDay && <CircularQuota value={100 - sevenDay.utilization} label="7D" />}
                </div>
            )
        };
    }

    if (categoryId === 'codex') {
        const usage = activeCodexUsage?.usage;
        if (!usage) {
            return null;
        }
        const hasDaily = typeof usage.dailyUsedPercent === 'number';
        const hasWeekly = typeof usage.weeklyUsedPercent === 'number';
        if (!hasDaily && !hasWeekly) {
            return null;
        }
        return {
            badges: (
                <div className="flex items-center gap-2">
                    {hasDaily && <CircularQuota value={100 - (usage.dailyUsedPercent ?? 0)} label={t('modelSelector.quota.day')} />}
                    {hasWeekly && <CircularQuota value={100 - (usage.weeklyUsedPercent ?? 0)} label={t('modelSelector.quota.week')} />}
                </div>
            )
        };
    }

    return null;
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
        <div className="px-4 py-2.5 typo-body font-bold text-muted-foreground/70 uppercase flex items-center gap-2 bg-muted/20">
            {icon}
            <span>{title}</span>
        </div>
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
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
    copilotQuota?: { accounts: Array<CopilotQuota & { accountId?: string; email?: string; isActive?: boolean }> } | null;
    activeCopilotAccountId?: string | null;
    activeCopilotAccountEmail?: string | null;
    activeClaudeQuota?: ClaudeQuota | null;
    activeCodexUsage?: ({ usage: CodexUsage; accountId?: string; email?: string } & { isActive?: boolean }) | null;
    activeAntigravityQuota?: QuotaResponse | null;
    t: (key: string) => string;
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
    copilotQuota?: { accounts: Array<CopilotQuota & { accountId?: string; email?: string; isActive?: boolean }> } | null;
    activeCopilotAccountId?: string | null;
    activeCopilotAccountEmail?: string | null;
    activeClaudeQuota?: ClaudeQuota | null;
    activeCodexUsage?: ({ usage: CodexUsage; accountId?: string; email?: string } & { isActive?: boolean }) | null;
    activeAntigravityQuota?: QuotaResponse | null;
    t: (key: string) => string;
}> = ({ category, collapsed, onToggleCollapse, selectedModels, selectedModel, selectedProvider, onSelect, toggleFavorite, copilotQuota, activeCopilotAccountId, activeCopilotAccountEmail, activeClaudeQuota, activeCodexUsage, activeAntigravityQuota, t }) => {
    const providerQuota = renderProviderQuota(category.id, {
        copilotQuota,
        activeCopilotAccountId,
        activeCopilotAccountEmail,
        activeClaudeQuota,
        activeCodexUsage,
        t
    });

    return (
        <div className="border-b border-border/30 last:border-b-0">
            <button
                type="button"
                onClick={() => onToggleCollapse(category.id)}
                className={C_MODELSELECTORSECTIONS_3}
                aria-expanded={!collapsed}
                aria-label={`${category.name} ${t('modelSelector.categoryLabelSuffix')}`}
            >
                <div className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0 animate-pulse shadow-card-dark",
                    category.color.replace('text-', 'bg-')
                )} />
                <span className="truncate">{category.name}</span>
                {providerQuota?.badges && (
                    <div className="ml-2 flex items-center gap-1.5 shrink-0">
                        {providerQuota.badges}
                    </div>
                )}
                <span className="text-muted-foreground/30 font-normal ml-1 normal-case">({category.models.length})</span>
                <span className="ml-auto opacity-0 group-hover/cat:opacity-100 transition-opacity">
                    {collapsed ? <IconBolt className="w-3.5 h-3.5 text-muted-foreground/40" /> : <IconBox className="w-3.5 h-3.5 text-muted-foreground/40" />}
                </span>
            </button>
            {providerQuota?.progress}
            {!collapsed && (
                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                            activeAntigravityQuota={activeAntigravityQuota}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

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
    copilotQuota,
    activeCopilotAccountId,
    activeCopilotAccountEmail,
    activeClaudeQuota,
    activeCodexUsage,
    activeAntigravityQuota,
    t,
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

    const deprecatedModels = dedupe(
        allModels.filter(model => model.lifecycle === 'deprecated' || model.lifecycle === 'retired')
    );
    const showCuratedSections = searchQuery.trim() === '';

    return (
        <>
            {showCuratedSections && favoriteModels.length > 0 && (
                <ModelSection
                    title={t('common.favorites')}
                    icon={<IconStar className="w-3.5 h-3.5 text-warning" />}
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
                    icon={<IconClock className="w-3.5 h-3.5 text-muted-foreground" />}
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
                    title={t('modelSelector.deprecated')}
                    icon={<IconBrain className="w-3.5 h-3.5 text-warning" />}
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
                <div className="px-4 py-2.5 typo-body font-bold text-muted-foreground/60 bg-muted/20 border-b border-border/30 uppercase ">
                    {t('modelSelector.allModels')}
                </div>
            )}

            {modeFilteredCategories.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground/50">
                    <IconSearch className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">{t('modelSelector.noModelsFound')}</p>
                </div>
            ) : shouldVirtualize ? (
                <div className="h-500">
                    <Virtuoso
                        className="h-full"
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
                                copilotQuota={copilotQuota}
                                activeCopilotAccountId={activeCopilotAccountId}
                                activeCopilotAccountEmail={activeCopilotAccountEmail}
                                activeClaudeQuota={activeClaudeQuota}
                                activeCodexUsage={activeCodexUsage}
                                activeAntigravityQuota={activeAntigravityQuota}
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
                        copilotQuota={copilotQuota}
                        activeCopilotAccountId={activeCopilotAccountId}
                        activeCopilotAccountEmail={activeCopilotAccountEmail}
                        activeClaudeQuota={activeClaudeQuota}
                        activeCodexUsage={activeCodexUsage}
                        activeAntigravityQuota={activeAntigravityQuota}
                        t={t}
                    />
                ))
            )}
        </>
    );
};
