import { Bot, Box, Brain, Clock, Search, Sparkles, Star, X, Zap } from 'lucide-react';
import React from 'react';
import { Virtuoso } from 'react-virtuoso';

import { cn } from '@/lib/utils';
import type { ClaudeQuota, CodexUsage, CopilotQuota, QuotaResponse } from '@/types/quota';

import { ModelCategory, ModelListItem } from '../../types';
import { scoreModelForMode } from '../../utils/model-selector-metadata';
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
    t: (key: string) => string;
}

export const ModelSelectorModeTabs: React.FC<ModelSelectorModeTabsProps> = ({
    modeLabel,
    chatMode,
    onChatModeChange,
    activeTab,
    onTabChange,
    showReasoningTab,
    t,
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
                            <span>{t(`modelSelector.modeOptions.${mode}`)}</span>
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
                    {t('modelSelector.tabs.models')}
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
                    {t('modelSelector.tabs.reasoning')}
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
    const tone = getQuotaTone(normalized);

    return (
        <div className="flex items-center gap-1.5">
            <div className={cn("relative flex h-7 w-7 items-center justify-center rounded-full border", tone.split(' ').slice(2).join(' '))}>
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
                        className={tone.split(' ').slice(0, 1).join(' ')}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                    />
                </svg>
                <span className="text-xxxs font-black text-foreground/90">{normalized}</span>
            </div>
            <span className="text-xxxs font-black uppercase tracking-wider text-muted-foreground/70">{label}</span>
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
                <>
                    <span className="text-xxxs text-primary font-black uppercase tracking-widest bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 leading-none">
                        {remaining}/{limit || 0} {t('modelSelector.creditsLeft')}
                    </span>
                    {rateLimit && (
                        <span className="text-xxxs text-warning font-black uppercase tracking-widest bg-warning/10 px-1.5 py-0.5 rounded border border-warning/20 leading-none">
                            {t('statistics.rateLimit')} {rateLimit.remaining}/{rateLimit.limit}
                        </span>
                    )}
                </>
            ),
            progress: (
                <div className="px-4 pb-3 bg-popover/95">
                    <div className="flex items-center justify-between text-xxxs font-black uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                        <span>{t('statistics.usageStatus')}</span>
                        <span className="text-foreground/80">{creditsPercent}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted/30 overflow-hidden">
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
                <>
                    {fiveHour && <CircularQuota value={100 - fiveHour.utilization} label="5H" />}
                    {sevenDay && <CircularQuota value={100 - sevenDay.utilization} label="7D" />}
                </>
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
                <>
                    {hasDaily && <CircularQuota value={100 - (usage.dailyUsedPercent ?? 0)} label={t('modelSelector.quota.day')} />}
                    {hasWeekly && <CircularQuota value={100 - (usage.weeklyUsedPercent ?? 0)} label={t('modelSelector.quota.week')} />}
                </>
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
            className="sticky top-0 z-10 w-full px-4 py-3 text-xxxs font-bold uppercase tracking-widest text-muted-foreground/70 flex items-center gap-2 bg-popover/95 backdrop-blur-md hover:text-foreground transition-all group/cat relative overflow-hidden"
            aria-expanded={!collapsed}
            aria-label={`${category.name} ${t('modelSelector.categoryLabelSuffix')}`}
        >
            <div className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0 animate-pulse",
                category.color.replace('text-', 'bg-')
            )} />
            <span className="truncate">{category.name}</span>
            {providerQuota?.badges && (
                <div className="ml-2 flex items-center gap-1.5 shrink-0">
                    {providerQuota.badges}
                </div>
            )}
            <span className="text-muted-foreground/30 font-normal ml-1">({category.models.length})</span>
            <span className="ml-auto opacity-0 group-hover/cat:opacity-100 transition-opacity">
                {collapsed ? <Zap className="w-3 h-3" /> : <Box className="w-3 h-3" />}
            </span>
        </button>
        {providerQuota?.progress}
        {!collapsed && (
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
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

            {showCuratedSections && recentModelItems.length > 0 && (
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

            {showCuratedSections && deprecatedModels.length > 0 && (
                <ModelSection
                    title={t('modelSelector.deprecated')}
                    icon={<Brain className="w-3.5 h-3.5 text-warning" />}
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
                <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/20 border-b border-border/30">
                    {t('modelSelector.allModels')}
                </div>
            )}

            {modeFilteredCategories.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>{t('modelSelector.noModelsFound')}</p>
                </div>
            ) : shouldVirtualize ? (
                <div className="h-96 sm:h-96">
                    <Virtuoso
                        style={{ height: '100%' }}
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
