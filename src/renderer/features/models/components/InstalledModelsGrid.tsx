import {
    AlertCircle,
    Brain,
    Check,
    ChevronDown,
    ChevronRight,
    Cloud,
    Cpu,
    Eye,
    EyeOff,
    Globe,
    Heart,
    Loader2,
    RefreshCw,
    Sparkles,
    Star,
    User,
    Zap
} from 'lucide-react';
import React, { memo, useMemo, useState } from 'react';

import type { LinkedAccountInfo } from '@/electron';
import { cn } from '@/lib/utils';
import type { AppSettings } from '@/types/settings';

import type { ProviderAccounts, ProviderQuotas } from '../pages/ModelsPage';
import type { GroupedModels, ModelInfo } from '../utils/model-fetcher';

interface InstalledModelsGridProps {
    groupedModels: GroupedModels;
    loading: boolean;
    onRefresh: () => void;
    accounts: ProviderAccounts;
    quotas: ProviderQuotas;
    settings: AppSettings | null;
    onToggleHidden: (modelId: string) => void;
    onSetDefault: (modelId: string) => void;
    onToggleFavorite: (modelId: string) => void;
    onSetActiveAccount: (provider: string, accountId: string) => void;
    t: (key: string) => string;
}

interface ProviderConfig {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    label: string;
}

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
    copilot: {
        icon: Sparkles,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/20',
        label: 'GitHub Copilot'
    },
    openai: {
        icon: Brain,
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/20',
        label: 'OpenAI'
    },
    anthropic: {
        icon: Zap,
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/20',
        label: 'Anthropic'
    },
    claude: {
        icon: Zap,
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/20',
        label: 'Claude'
    },
    ollama: {
        icon: Cpu,
        color: 'text-purple-500',
        bgColor: 'bg-purple-500/10',
        borderColor: 'border-purple-500/20',
        label: 'Ollama'
    },
    codex: {
        icon: Globe,
        color: 'text-cyan-500',
        bgColor: 'bg-cyan-500/10',
        borderColor: 'border-cyan-500/20',
        label: 'Codex'
    },
    antigravity: {
        icon: Cloud,
        color: 'text-pink-500',
        bgColor: 'bg-pink-500/10',
        borderColor: 'border-pink-500/20',
        label: 'Google AI'
    },
    nvidia: {
        icon: Cpu,
        color: 'text-green-500',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/20',
        label: 'NVIDIA'
    },
    opencode: {
        icon: Globe,
        color: 'text-indigo-500',
        bgColor: 'bg-indigo-500/10',
        borderColor: 'border-indigo-500/20',
        label: 'OpenCode'
    },
    custom: {
        icon: AlertCircle,
        color: 'text-muted-foreground',
        bgColor: 'bg-muted/30',
        borderColor: 'border-border/50',
        label: 'Custom'
    }
};

function getProviderConfig(provider: string): ProviderConfig {
    return PROVIDER_CONFIGS[provider] ?? PROVIDER_CONFIGS.custom;
}

// Quota display component
interface QuotaDisplayProps {
    provider: string;
    quotas: ProviderQuotas;
    accountId?: string;
}

const QuotaDisplay: React.FC<QuotaDisplayProps> = memo(({ provider, quotas, accountId }) => {
    if (provider === 'copilot') {
        const quota = quotas.copilot.find(q => q.accountId === accountId) ?? quotas.copilot[0];
        if (!quota) { return null; }
        const percent = quota.limit > 0 ? Math.round((quota.remaining / quota.limit) * 100) : 0;
        return (
            <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 bg-muted/50 rounded-full overflow-hidden">
                    <div
                        className={cn("h-full rounded-full transition-all", percent > 50 ? "bg-success" : percent > 20 ? "bg-warning" : "bg-destructive")}
                        style={{ width: `${percent}%` }}
                    />
                </div>
                <span className="text-xxs text-muted-foreground">{quota.remaining}/{quota.limit}</span>
            </div>
        );
    }

    if (provider === 'claude' || provider === 'anthropic') {
        const quota = quotas.claude.find(q => q.accountId === accountId) ?? quotas.claude[0];
        if (!quota?.fiveHour) { return null; }
        const percent = 100 - Math.round(quota.fiveHour.utilization * 100);
        return (
            <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 bg-muted/50 rounded-full overflow-hidden">
                    <div
                        className={cn("h-full rounded-full transition-all", percent > 50 ? "bg-success" : percent > 20 ? "bg-warning" : "bg-destructive")}
                        style={{ width: `${percent}%` }}
                    />
                </div>
                <span className="text-xxs text-muted-foreground">{percent}%</span>
            </div>
        );
    }

    if (provider === 'codex' || provider === 'openai') {
        const quota = quotas.codex.find(q => q.accountId === accountId) ?? quotas.codex[0];
        if (!quota?.usage?.dailyLimit) { return null; }
        const percent = 100 - Math.round((quota.usage.dailyUsedPercent ?? 0));
        return (
            <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 bg-muted/50 rounded-full overflow-hidden">
                    <div
                        className={cn("h-full rounded-full transition-all", percent > 50 ? "bg-success" : percent > 20 ? "bg-warning" : "bg-destructive")}
                        style={{ width: `${percent}%` }}
                    />
                </div>
                <span className="text-xxs text-muted-foreground">{percent}%</span>
            </div>
        );
    }

    if (provider === 'antigravity') {
        const quota = quotas.antigravity.find(q => q.accountId === accountId) ?? quotas.antigravity[0];
        if (!quota?.models?.length) { return null; }
        const avgPercent = quota.models.reduce((sum, m) => sum + (m.percentage ?? 0), 0) / quota.models.length;
        return (
            <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 bg-muted/50 rounded-full overflow-hidden">
                    <div
                        className={cn("h-full rounded-full transition-all", avgPercent > 50 ? "bg-success" : avgPercent > 20 ? "bg-warning" : "bg-destructive")}
                        style={{ width: `${avgPercent}%` }}
                    />
                </div>
                <span className="text-xxs text-muted-foreground">{Math.round(avgPercent)}%</span>
            </div>
        );
    }

    return null;
});

QuotaDisplay.displayName = 'QuotaDisplay';

// Account tabs component
interface AccountTabsProps {
    provider: string;
    accounts: LinkedAccountInfo[];
    activeAccountId?: string;
    onSetActiveAccount: (provider: string, accountId: string) => void;
    quotas: ProviderQuotas;
    config: ProviderConfig;
}

const AccountTabs: React.FC<AccountTabsProps> = memo(({
    provider,
    accounts,
    activeAccountId,
    onSetActiveAccount,
    quotas,
    config
}) => {
    if (accounts.length <= 1) { return null; }

    return (
        <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-2">
            {accounts.map((account) => {
                const isActive = account.isActive || account.id === activeAccountId;
                return (
                    <button
                        key={account.id}
                        onClick={() => onSetActiveAccount(provider, account.id)}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                            isActive
                                ? cn(config.bgColor, config.color, "border", config.borderColor)
                                : "bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-transparent"
                        )}
                    >
                        <User className="w-3 h-3" />
                        <span>{account.email ?? account.displayName ?? `Account ${account.id.slice(0, 6)}`}</span>
                        {isActive && <Check className="w-3 h-3" />}
                        <QuotaDisplay provider={provider} quotas={quotas} accountId={account.id} />
                    </button>
                );
            })}
        </div>
    );
});

AccountTabs.displayName = 'AccountTabs';

// Model card with actions
interface InstalledModelCardProps {
    model: ModelInfo;
    providerConfig: ProviderConfig;
    isHidden: boolean;
    isDefault: boolean;
    isFavorite: boolean;
    onToggleHidden: (modelId: string) => void;
    onSetDefault: (modelId: string) => void;
    onToggleFavorite: (modelId: string) => void;
    t: (key: string) => string;
}

const InstalledModelCard = memo(({
    model,
    providerConfig,
    isHidden,
    isDefault,
    isFavorite,
    onToggleHidden,
    onSetDefault,
    onToggleFavorite,
    t
}: InstalledModelCardProps) => {
    const modelId = model.id ?? '';

    const hasQuota = model.quotaInfo?.remainingQuota !== undefined || model.percentage !== undefined;
    const quotaPercent = model.quotaInfo?.remainingFraction !== undefined
        ? Math.round(model.quotaInfo.remainingFraction * 100)
        : model.percentage;

    const formatContextWindow = (ctx: number | undefined): string => {
        if (ctx === undefined) { return '-'; }
        if (ctx >= 1000000) { return `${(ctx / 1000000).toFixed(1)}M`; }
        if (ctx >= 1000) { return `${Math.round(ctx / 1000)}K`; }
        return String(ctx);
    };

    const formatPricing = (price: number | undefined): string => {
        if (price === undefined) { return '-'; }
        if (price === 0) { return t('modelsPage.free'); }
        return `$${price.toFixed(4)}`;
    };

    return (
        <div className={cn(
            "group relative bg-card border rounded-2xl p-5 transition-all duration-200",
            "hover:shadow-lg hover:-translate-y-0.5",
            isHidden && "opacity-50",
            isDefault ? "border-primary ring-1 ring-primary/20" : providerConfig.borderColor,
            isFavorite && "ring-1 ring-yellow-500/30"
        )}>
            {/* Favorite indicator */}
            {isFavorite && (
                <div className="absolute -top-1.5 -right-1.5">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                </div>
            )}

            {/* Header with provider badge and quota */}
            <div className="flex items-center justify-between mb-3">
                <div className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md text-xxs font-bold uppercase tracking-wider",
                    providerConfig.bgColor,
                    providerConfig.color
                )}>
                    <providerConfig.icon className="w-3 h-3" />
                    <span>{model.provider}</span>
                </div>
                {hasQuota && quotaPercent !== undefined && (
                    <div className={cn(
                        "px-2 py-0.5 rounded text-xxs font-bold",
                        quotaPercent > 50 ? "bg-success/10 text-success" :
                            quotaPercent > 20 ? "bg-warning/10 text-warning" :
                                "bg-destructive/10 text-destructive"
                    )}>
                        {quotaPercent}%
                    </div>
                )}
            </div>

            {/* Model Name */}
            <h3 className="font-bold text-sm text-foreground mb-0.5 line-clamp-1 pr-6" title={model.name ?? model.id}>
                {model.name ?? model.id}
            </h3>

            {/* Model ID */}
            {model.name && model.id && model.name !== model.id && (
                <p className="text-xxs text-muted-foreground/60 font-mono mb-2 line-clamp-1" title={model.id}>
                    {model.id}
                </p>
            )}

            {/* Description */}
            {model.description && (
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
                    {model.description}
                </p>
            )}

            {/* Stats */}
            <div className="flex flex-wrap gap-2 mb-3">
                {model.contextWindow !== undefined && (
                    <div className="bg-muted/30 rounded px-2 py-1">
                        <span className="text-xxxs text-muted-foreground/60 mr-1">{t('modelsPage.context')}</span>
                        <span className="text-xxs font-bold">{formatContextWindow(model.contextWindow)}</span>
                    </div>
                )}
                {model.pricing && (
                    <div className="bg-muted/30 rounded px-2 py-1">
                        <span className="text-xxxs text-muted-foreground/60 mr-1">{t('modelsPage.pricing')}</span>
                        <span className="text-xxs font-bold">{formatPricing(model.pricing.input)}</span>
                    </div>
                )}
            </div>

            {/* Thinking Levels */}
            {Array.isArray(model.thinkingLevels) && model.thinkingLevels.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                    {model.thinkingLevels.slice(0, 3).map(level => (
                        <span key={level} className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xxxs font-bold">
                            {level}
                        </span>
                    ))}
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-1 pt-2 border-t border-border/50">
                {/* Default button */}
                <button
                    onClick={() => onSetDefault(modelId)}
                    disabled={isDefault}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xxs font-bold transition-all",
                        isDefault
                            ? "bg-primary/20 text-primary cursor-default"
                            : "bg-muted/30 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    )}
                    title={isDefault ? t('modelsPage.isDefault') : t('modelsPage.setDefault')}
                >
                    <Check className="w-3 h-3" />
                    {isDefault ? t('modelsPage.default') : t('modelsPage.setDefault')}
                </button>

                {/* Favorite button */}
                <button
                    onClick={() => onToggleFavorite(modelId)}
                    className={cn(
                        "p-1.5 rounded-lg transition-all",
                        isFavorite
                            ? "bg-yellow-500/20 text-yellow-500"
                            : "bg-muted/30 text-muted-foreground hover:bg-yellow-500/10 hover:text-yellow-500"
                    )}
                    title={isFavorite ? t('modelsPage.unfavorite') : t('modelsPage.favorite')}
                >
                    <Heart className={cn("w-3.5 h-3.5", isFavorite && "fill-current")} />
                </button>

                {/* Hide button */}
                <button
                    onClick={() => onToggleHidden(modelId)}
                    className={cn(
                        "p-1.5 rounded-lg transition-all",
                        isHidden
                            ? "bg-muted/50 text-muted-foreground"
                            : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                    )}
                    title={isHidden ? t('modelsPage.show') : t('modelsPage.hide')}
                >
                    {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
            </div>

            {/* Default indicator line */}
            {isDefault && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-primary rounded-b-2xl" />
            )}
        </div>
    );
});

InstalledModelCard.displayName = 'InstalledModelCard';

// Provider section
interface ProviderSectionProps {
    provider: string;
    providerData: { label: string; models: ModelInfo[] };
    accounts: LinkedAccountInfo[];
    quotas: ProviderQuotas;
    settings: AppSettings | null;
    onToggleHidden: (modelId: string) => void;
    onSetDefault: (modelId: string) => void;
    onToggleFavorite: (modelId: string) => void;
    onSetActiveAccount: (provider: string, accountId: string) => void;
    t: (key: string) => string;
    showHidden: boolean;
}

const ProviderSection = memo(({
    provider,
    providerData,
    accounts,
    quotas,
    settings,
    onToggleHidden,
    onSetDefault,
    onToggleFavorite,
    onSetActiveAccount,
    t,
    showHidden
}: ProviderSectionProps) => {
    const config = getProviderConfig(provider);
    const Icon = config.icon;
    const [isCollapsed, setIsCollapsed] = useState(false);

    const hiddenModels = useMemo(() => settings?.general.hiddenModels ?? [], [settings?.general.hiddenModels]);
    const defaultModel = settings?.general.defaultModel ?? '';
    const favoriteModels = settings?.general.favoriteModels ?? [];

    const activeAccount = accounts.find(a => a.isActive);

    // Filter models based on showHidden
    const visibleModels = useMemo(() => {
        if (!providerData || !Array.isArray(providerData.models)) {
            return [];
        }
        return providerData.models.filter(m => {
            const modelId = m.id ?? '';
            return showHidden || !hiddenModels.includes(modelId);
        });
    }, [providerData, hiddenModels, showHidden]);

    if (visibleModels.length === 0) { return null; }

    return (
        <div className="mb-8">
            {/* Provider Header */}
            <div className="flex items-center gap-3 mb-4">
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="flex items-center gap-3 group cursor-pointer"
                >
                    <div className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
                        config.bgColor,
                        "group-hover:ring-2 group-hover:ring-offset-2 group-hover:ring-offset-background",
                        config.borderColor.replace('border-', 'group-hover:ring-')
                    )}>
                        <Icon className={cn("w-4 h-4", config.color)} />
                    </div>
                    <div>
                        <h2 className="font-bold text-base text-foreground group-hover:text-primary transition-colors">
                            {config.label}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            {visibleModels.length} {t('modelsPage.modelsCount')}
                            {accounts.length > 1 && ` · ${accounts.length} ${t('modelsPage.accounts')}`}
                        </p>
                    </div>
                </button>

                {/* Quota for active account */}
                {activeAccount && (
                    <div className="ml-auto">
                        <QuotaDisplay provider={provider} quotas={quotas} accountId={activeAccount.id} />
                    </div>
                )}

                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-1 rounded hover:bg-muted/50 transition-colors"
                >
                    {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
            </div>

            {/* Content */}
            {!isCollapsed && (
                <>
                    {/* Account Tabs */}
                    <AccountTabs
                        provider={provider}
                        accounts={accounts}
                        activeAccountId={activeAccount?.id}
                        onSetActiveAccount={onSetActiveAccount}
                        quotas={quotas}
                        config={config}
                    />

                    {/* Models Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                        {visibleModels.map(model => {
                            const modelId = model.id ?? '';
                            return (
                                <InstalledModelCard
                                    key={modelId}
                                    model={model}
                                    providerConfig={config}
                                    isHidden={hiddenModels.includes(modelId)}
                                    isDefault={defaultModel === modelId}
                                    isFavorite={favoriteModels.includes(modelId)}
                                    onToggleHidden={onToggleHidden}
                                    onSetDefault={onSetDefault}
                                    onToggleFavorite={onToggleFavorite}
                                    t={t}
                                />
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
});

ProviderSection.displayName = 'ProviderSection';

export function InstalledModelsGrid({
    groupedModels,
    loading,
    onRefresh,
    accounts,
    quotas,
    settings,
    onToggleHidden,
    onSetDefault,
    onToggleFavorite,
    onSetActiveAccount,
    t
}: InstalledModelsGridProps): React.ReactElement {
    const [searchQuery, setSearchQuery] = useState('');
    const [showHidden, setShowHidden] = useState(false);

    const filteredGroups = useMemo(() => {
        if (!groupedModels) { return {}; }
        if (!searchQuery.trim()) { return groupedModels; }

        const query = searchQuery.toLowerCase();
        const filtered: GroupedModels = {};

        Object.entries(groupedModels).forEach(([provider, data]) => {
            if (!data || !Array.isArray(data.models)) { return; }
            const matchingModels = data.models.filter(model =>
                (model.name?.toLowerCase().includes(query)) ??
                (model.id?.toLowerCase().includes(query)) ??
                (model.description?.toLowerCase().includes(query))
            );
            if (matchingModels.length > 0) {
                filtered[provider] = { ...data, models: matchingModels };
            }
        });

        return filtered;
    }, [groupedModels, searchQuery]);

    const sortedProviders = useMemo(() => {
        const priority = ['copilot', 'anthropic', 'claude', 'openai', 'codex', 'ollama', 'antigravity', 'nvidia', 'opencode'];
        return Object.keys(filteredGroups).sort((a, b) => {
            const aIdx = priority.indexOf(a);
            const bIdx = priority.indexOf(b);
            if (aIdx === -1 && bIdx === -1) { return a.localeCompare(b); }
            if (aIdx === -1) { return 1; }
            if (bIdx === -1) { return -1; }
            return aIdx - bIdx;
        });
    }, [filteredGroups]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="text-sm">{t('modelsPage.loadingModels')}</p>
            </div>
        );
    }

    return (
        <div className="p-8">
            {/* Actions Bar */}
            <div className="flex items-center justify-between gap-4 mb-6">
                <div className="relative flex-1 max-w-md">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder={t('modelsPage.searchPlaceholder')}
                        className="w-full h-10 bg-muted/30 border border-border/50 rounded-xl pl-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowHidden(!showHidden)}
                        className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all",
                            showHidden
                                ? "bg-muted/50 text-foreground border border-border"
                                : "bg-muted/30 text-muted-foreground border border-border/50 hover:bg-muted/50"
                        )}
                    >
                        {showHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        {showHidden ? t('modelsPage.hideHidden') : t('modelsPage.showHidden')}
                    </button>

                    <button
                        onClick={onRefresh}
                        className="flex items-center gap-2 px-4 py-2 bg-muted/30 border border-border/50 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        {t('modelsPage.refresh')}
                    </button>
                </div>
            </div>

            {/* Provider Sections */}
            {sortedProviders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <AlertCircle className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-sm">{t('modelsPage.noModelsFound')}</p>
                </div>
            ) : (
                sortedProviders.map(provider => (
                    <ProviderSection
                        key={provider}
                        provider={provider}
                        providerData={filteredGroups[provider]}
                        accounts={accounts[provider] ?? []}
                        quotas={quotas}
                        settings={settings}
                        onToggleHidden={onToggleHidden}
                        onSetDefault={onSetDefault}
                        onToggleFavorite={onToggleFavorite}
                        onSetActiveAccount={onSetActiveAccount}
                        t={t}
                        showHidden={showHidden}
                    />
                ))
            )}
        </div>
    );
}
