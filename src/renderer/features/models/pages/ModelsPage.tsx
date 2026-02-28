import React, { useCallback, useEffect, useRef, useState } from 'react';

import type { LinkedAccountInfo } from '@/electron';
import type { Language } from '@/i18n';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import type { GroupedModels, ModelInfo } from '@/types';
import type { ClaudeQuota, CodexUsage, CopilotQuota, QuotaResponse } from '@/types/quota';
import type { AppSettings } from '@/types/settings';

import { InstalledModelsGrid } from '../components/InstalledModelsGrid';
import { MarketplaceGrid } from '../components/MarketplaceGrid';
import { fetchModels, groupModels } from '../utils/model-fetcher';

interface ModelsPageProps {
    language?: Language;
}

type TabType = 'installed' | 'marketplace';

export interface ProviderAccounts {
    [provider: string]: LinkedAccountInfo[];
}

export interface ProviderQuotas {
    copilot: Array<CopilotQuota & { accountId?: string; email?: string }>;
    claude: Array<ClaudeQuota & { accountId?: string; email?: string }>;
    codex: Array<{ usage: CodexUsage; accountId?: string; email?: string }>;
    antigravity: Array<QuotaResponse & { accountId?: string; email?: string }>;
}

export function ModelsPage({ language = 'en' }: ModelsPageProps): React.ReactElement {
    const { t } = useTranslation(language);
    const [activeTab, setActiveTab] = useState<TabType>('installed');
    const [, setModels] = useState<ModelInfo[]>([]);
    const [groupedModels, setGroupedModels] = useState<GroupedModels>({});
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<ProviderAccounts>({});
    const [quotas, setQuotas] = useState<ProviderQuotas>({
        copilot: [],
        claude: [],
        codex: [],
        antigravity: []
    });
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const hasFetched = useRef(false);

    const loadModels = useCallback(async (bypassCache = false) => {
        setLoading(true);
        const fetchedModels = await fetchModels(bypassCache);
        setModels(fetchedModels);
        setGroupedModels(groupModels(fetchedModels));
        setLoading(false);
    }, []);

    const loadAccounts = useCallback(async () => {
        const providers = ['copilot', 'openai', 'anthropic', 'codex', 'antigravity', 'nvidia', 'claude'];
        const accountsMap: ProviderAccounts = {};

        const results = await Promise.all(
            providers.map(async (provider) => {
                const providerAccounts = await window.electron.getLinkedAccounts(provider);
                return { provider, accounts: providerAccounts };
            })
        );

        results.forEach(({ provider, accounts: accts }) => {
            if (accts.length > 0) {
                accountsMap[provider] = accts;
            }
        });

        setAccounts(accountsMap);
    }, []);

    const loadQuotas = useCallback(async () => {
        const [copilotResult, claudeResult, codexResult, antigravityResult] = await Promise.all([
            window.electron.getCopilotQuota().catch(() => ({ accounts: [] })),
            window.electron.getClaudeQuota().catch(() => ({ accounts: [] })),
            window.electron.getCodexUsage().catch(() => ({ accounts: [] })),
            window.electron.getQuota().catch(() => null)
        ]);

        setQuotas({
            copilot: copilotResult.accounts,
            claude: claudeResult.accounts,
            codex: codexResult.accounts,
            antigravity: antigravityResult?.accounts ?? []
        });
    }, []);

    useEffect(() => {
        if (hasFetched.current) { return; }
        hasFetched.current = true;

        const initializeData = async (): Promise<void> => {
            try {
                const [fetchedModels, , , settingsData] = await Promise.all([
                    fetchModels(),
                    window.electron.getLinkedAccounts().then(allAccounts => {
                        const accountsMap: ProviderAccounts = {};
                        const providers = ['copilot', 'openai', 'anthropic', 'codex', 'antigravity', 'nvidia', 'claude'];
                        providers.forEach(provider => {
                            const providerAccounts = allAccounts.filter(a => a.provider === provider);
                            if (providerAccounts.length > 0) {
                                accountsMap[provider] = providerAccounts;
                            }
                        });
                        setAccounts(accountsMap);
                    }),
                    Promise.all([
                        window.electron.getCopilotQuota().catch(() => ({ accounts: [] })),
                        window.electron.getClaudeQuota().catch(() => ({ accounts: [] })),
                        window.electron.getCodexUsage().catch(() => ({ accounts: [] })),
                        window.electron.getQuota().catch(() => null)
                    ]).then(([copilotResult, claudeResult, codexResult, antigravityResult]) => {
                        setQuotas({
                            copilot: copilotResult.accounts,
                            claude: claudeResult.accounts,
                            codex: codexResult.accounts,
                            antigravity: antigravityResult?.accounts ?? []
                        });
                    }),
                    window.electron.getSettings()
                ]);
                setModels(fetchedModels);
                setGroupedModels(groupModels(fetchedModels));
                setSettings(settingsData);
            } catch {
                // Ignore errors
            } finally {
                setLoading(false);
            }
        };

        void initializeData();
    }, []);

    const handleRefresh = useCallback(() => {
        void loadModels(true);
        void loadAccounts();
        void loadQuotas();
    }, [loadModels, loadAccounts, loadQuotas]);

    const handleToggleHidden = useCallback((modelId: string) => {
        if (!settings) { return; }
        const hiddenModels = settings.general.hiddenModels ?? [];
        const isHidden = hiddenModels.includes(modelId);
        const newHidden = isHidden
            ? hiddenModels.filter(id => id !== modelId)
            : [...hiddenModels, modelId];

        const updated = {
            ...settings,
            general: { ...settings.general, hiddenModels: newHidden }
        };
        void window.electron.saveSettings(updated);
        setSettings(updated);
    }, [settings]);

    const handleSetDefault = useCallback((modelId: string) => {
        if (!settings) { return; }
        const updated = {
            ...settings,
            general: { ...settings.general, defaultModel: modelId }
        };
        void window.electron.saveSettings(updated);
        setSettings(updated);
    }, [settings]);

    const handleToggleFavorite = useCallback((modelId: string) => {
        if (!settings) { return; }
        const favorites = settings.general.favoriteModels ?? [];
        const isFavorite = favorites.includes(modelId);
        const newFavorites = isFavorite
            ? favorites.filter(id => id !== modelId)
            : [...favorites, modelId];

        const updated = {
            ...settings,
            general: { ...settings.general, favoriteModels: newFavorites }
        };
        void window.electron.saveSettings(updated);
        setSettings(updated);
    }, [settings]);

    const handleSetActiveAccount = useCallback((provider: string, accountId: string) => {
        const switchAccount = async (): Promise<void> => {
            await window.electron.setActiveLinkedAccount(provider, accountId);
            await loadAccounts();
            // Refresh models after account change
            void loadModels(true);
        };
        void switchAccount();
    }, [loadAccounts, loadModels]);

    return (
        <div className="h-full flex flex-col bg-background">
            {/* Header */}
            <div className="px-8 pt-8 pb-6 border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-black tracking-tight">{t('modelsPage.title')}</h1>
                            <p className="text-sm text-muted-foreground mt-1">{t('modelsPage.subtitle')}</p>
                        </div> 
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setActiveTab('installed')}
                            className={cn(
                                "px-5 py-2.5 rounded-full text-xs font-bold border transition-all duration-200",
                                activeTab === 'installed'
                                    ? "bg-primary/20 text-primary border-primary/30 shadow-sm"
                                    : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50 hover:border-border"
                            )}
                        >
                            {t('modelsPage.installedModels')}
                        </button>
                        <button
                            onClick={() => setActiveTab('marketplace')}
                            className={cn(
                                "px-5 py-2.5 rounded-full text-xs font-bold border transition-all duration-200",
                                activeTab === 'marketplace'
                                    ? "bg-primary/20 text-primary border-primary/30 shadow-sm"
                                    : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50 hover:border-border"
                            )}
                        >
                            {t('modelsPage.marketplace')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'installed' ? (
                    <InstalledModelsGrid
                        groupedModels={groupedModels}
                        loading={loading}
                        onRefresh={handleRefresh}
                        accounts={accounts}
                        quotas={quotas}
                        settings={settings}
                        onToggleHidden={handleToggleHidden}
                        onSetDefault={handleSetDefault}
                        onToggleFavorite={handleToggleFavorite}
                        onSetActiveAccount={handleSetActiveAccount}
                        t={t}
                    />
                ) : (
                    <MarketplaceGrid t={t} />
                )}
            </div>
        </div>
    );
}
