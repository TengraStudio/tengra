import type { MarketplaceRegistry, MarketplaceRuntimeProfile, MarketplaceSkill } from '@shared/types/marketplace';
import type { ProxySkill } from '@shared/types/skill';
import {
    Globe,
    Grid3X3,
    MessageSquare,
    Package,
    Palette,
    Sparkles,
    Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useAuthLanguage } from '@/context/AuthContext';
import { useModel } from '@/context/ModelContext';
import { useTranslation } from '@/i18n';
import { pushNotification } from '@/store/notification-center.store';

import { McpMarketplace, type McpPlugin } from './components/McpMarketplace';
import { SkillsMarketplace } from './components/SkillsMarketplace';
import {
    createDefaultMarketplaceQueries,
    type MarketplaceQueryState,
    type MarketplaceTab,
} from './marketplace-query.types';

interface LegacyMcpListItem {
    name: string;
    status: string;
}

function normalizeMcpPlugins(items: Array<McpPlugin | LegacyMcpListItem>): McpPlugin[] {
    return items.map(item => {
        if ('id' in item) {
            return item;
        }
        const isEnabled = item.status.toLowerCase() === 'enabled' || item.status.toLowerCase() === 'active';
        return {
            id: item.name,
            name: item.name,
            description: item.name,
            source: 'remote',
            isAlive: isEnabled,
            isEnabled,
            actions: [],
        };
    });
}

export function MarketplaceView(): JSX.Element {
    const { language } = useAuthLanguage();
    const { t } = useTranslation(language);
    const { models: installedModels } = useModel();
    const [activeTab, setActiveTab] = useState<MarketplaceTab>('mcp');
    const [registry, setRegistry] = useState<MarketplaceRegistry | null>(null);
    const [localPlugins, setLocalPlugins] = useState<McpPlugin[]>([]);
    const [installedSkills, setInstalledSkills] = useState<ProxySkill[]>([]);
    const [marketplaceSkills, setMarketplaceSkills] = useState<MarketplaceSkill[]>([]);
    const [runtimeProfile, setRuntimeProfile] = useState<MarketplaceRuntimeProfile | null>(null);
    const [isSyncing, setIsSyncing] = useState(true);
    const [queries, setQueries] = useState<Record<MarketplaceTab, MarketplaceQueryState>>(createDefaultMarketplaceQueries());
    const tRef = useRef(t);
    const registryInFlightRef = useRef<Promise<void> | null>(null);
    const mcpInFlightRef = useRef<Promise<void> | null>(null);
    const skillsInFlightRef = useRef<Promise<void> | null>(null);
    const runtimeProfileInFlightRef = useRef<Promise<void> | null>(null);
    const preloadInFlightRef = useRef<Promise<void> | null>(null);

    const tabs: Array<{ id: MarketplaceTab, icon: React.ElementType }> = [
        { id: 'mcp', icon: Package },
        { id: 'extensions', icon: Zap },
        { id: 'skills', icon: Sparkles },
        { id: 'themes', icon: Palette },
        { id: 'personas', icon: Sparkles },
        { id: 'models', icon: Zap },
        { id: 'prompts', icon: MessageSquare },
        { id: 'languages', icon: Globe },
    ];
    const tabLabels: Record<MarketplaceTab, string> = {
        mcp: t('marketplace.tabs.mcp'),
        extensions: t('marketplace.tabs.extensions'),
        skills: t('marketplace.tabs.skills'),
        themes: t('marketplace.tabs.themes'),
        personas: t('marketplace.tabs.personas'),
        models: t('marketplace.tabs.models'),
        prompts: t('marketplace.tabs.prompts'),
        languages: t('marketplace.tabs.languages'),
    };
    const registryItems = registry ?? {
        version: '',
        lastUpdated: '',
        themes: [],
        mcp: [],
        personas: [],
        models: [],
        prompts: [],
        languages: [],
        skills: [],
    };
    const totalInstalled = (registryItems.themes?.filter(item => item.installed).length ?? 0)
        + (registryItems.mcp?.filter(item => item.installed).length ?? 0)
        + (registryItems.personas?.filter(item => item.installed).length ?? 0)
        + (registryItems.models?.filter(item => item.installed).length ?? 0)
        + (registryItems.prompts?.filter(item => item.installed).length ?? 0)
        + (registryItems.languages?.filter(item => item.installed).length ?? 0)
        + installedSkills.length;
    const totalAvailable = (registryItems.themes?.length ?? 0)
        + (registryItems.mcp?.length ?? 0)
        + (registryItems.personas?.length ?? 0)
        + (registryItems.models?.length ?? 0)
        + (registryItems.prompts?.length ?? 0)
        + (registryItems.languages?.length ?? 0)
        + marketplaceSkills.length;
    const totalExternalMcp = localPlugins.filter(plugin => plugin.source !== 'core').length;
    const updateActiveQuery = (updater: (prev: MarketplaceQueryState) => MarketplaceQueryState): void => {
        setQueries(prev => ({
            ...prev,
            [activeTab]: updater(prev[activeTab]),
        }));
    };

    useEffect(() => {
        tRef.current = t;
    }, [t]);

    const refreshRegistry = useCallback(async () => {
        if (registryInFlightRef.current) {
            await registryInFlightRef.current;
            return;
        }
        registryInFlightRef.current = (async () => {
            try {
                const data = await window.electron.marketplace.fetch();
                setRegistry(data);
                setMarketplaceSkills(data.skills ?? []);
            } catch {
                pushNotification({ type: 'error', message: tRef.current('marketplace.loadError') });
            } finally {
                registryInFlightRef.current = null;
            }
        })();
        await registryInFlightRef.current;
    }, []);

    const refreshMcpPlugins = useCallback(async () => {
        if (mcpInFlightRef.current) {
            await mcpInFlightRef.current;
            return;
        }
        mcpInFlightRef.current = (async () => {
            try {
                const list = await window.electron.mcp.list() as Array<McpPlugin | LegacyMcpListItem>;
                setLocalPlugins(normalizeMcpPlugins(list));
            } catch {
                pushNotification({ type: 'error', message: tRef.current('marketplace.mcp.localLoadError') });
            } finally {
                mcpInFlightRef.current = null;
            }
        })();
        await mcpInFlightRef.current;
    }, []);

    const refreshInstalledSkills = useCallback(async () => {
        if (skillsInFlightRef.current) {
            await skillsInFlightRef.current;
            return;
        }
        skillsInFlightRef.current = (async () => {
            try {
                setInstalledSkills(await window.electron.listSkills());
            } catch {
                pushNotification({ type: 'error', message: tRef.current('marketplace.loadError') });
            } finally {
                skillsInFlightRef.current = null;
            }
        })();
        await skillsInFlightRef.current;
    }, []);

    const refreshRuntimeProfile = useCallback(async () => {
        if (runtimeProfileInFlightRef.current) {
            await runtimeProfileInFlightRef.current;
            return;
        }
        runtimeProfileInFlightRef.current = (async () => {
            try {
                setRuntimeProfile(await window.electron.marketplace.getRuntimeProfile());
            } catch {
                setRuntimeProfile(null);
            } finally {
                runtimeProfileInFlightRef.current = null;
            }
        })();
        await runtimeProfileInFlightRef.current;
    }, []);

    const preloadMarketplace = useCallback(async () => {
        if (preloadInFlightRef.current) {
            await preloadInFlightRef.current;
            return;
        }
        setIsSyncing(true);
        preloadInFlightRef.current = (async () => {
            await Promise.all([
                refreshRegistry(),
                refreshMcpPlugins(),
                refreshInstalledSkills(),
                refreshRuntimeProfile(),
            ]);
        })();
        try {
            await preloadInFlightRef.current;
        } finally {
            preloadInFlightRef.current = null;
            setIsSyncing(false);
        }
    }, [refreshInstalledSkills, refreshMcpPlugins, refreshRegistry, refreshRuntimeProfile]);

    useEffect(() => {
        const handleStateChange = () => {
             void refreshRegistry();
             void refreshMcpPlugins();
        };
        const cleanup = window.electron.on('extension:state-changed', handleStateChange);
        return () => {
             cleanup();
        };
    }, [refreshRegistry, refreshMcpPlugins]);

    useEffect(() => {
        void preloadMarketplace();
    }, [preloadMarketplace]);

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="flex flex-col h-full">
                {/* Header Section */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <Grid3X3 className="w-5 h-5 text-primary" />
                        <div>
                            <h1 className="text-lg font-bold leading-none">
                                {t('marketplace.title')}
                            </h1>
                            <p className="typo-caption text-muted-foreground mt-1 font-medium">
                                {t('marketplace.subtitle')}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-muted/40 px-2.5 py-1 typo-body font-semibold text-muted-foreground">
                                    {`${t('marketplace.results')}: ${totalAvailable}`}
                                </span>
                                <span className="rounded-full bg-primary/10 px-2.5 py-1 typo-body font-semibold text-primary">
                                    {`${t('modelExplorer.installed')}: ${totalInstalled}`}
                                </span>
                                <span className="rounded-full bg-muted/40 px-2.5 py-1 typo-body font-semibold text-muted-foreground">
                                    {`${t('marketplace.tabs.mcp')} ${t('marketplace.mcp.filters.user')}: ${totalExternalMcp}`}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <nav className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg border border-border/40">
                        {tabs.map((tab) => {
                            const isEnabled = true;
                            return (
                                <button
                                    key={tab.id}
                                    disabled={!isEnabled}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-md typo-caption font-semibold transition-all ${activeTab === tab.id
                                        ? 'bg-background text-foreground shadow-sm'
                                        : isEnabled
                                            ? 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                                            : 'text-muted-foreground/30 cursor-not-allowed grayscale pointer-events-none'
                                        }`}
                                >
                                    <tab.icon className="w-3.5 h-3.5" />
                                    <span>{tabLabels[tab.id]}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Content Area */}
                <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
                    <div className="max-w-6xl mx-auto">
                        {activeTab === 'skills' ? (
                            <SkillsMarketplace
                                skills={installedSkills}
                                marketplaceSkills={marketplaceSkills}
                                loading={isSyncing}
                                onRefreshSkills={refreshInstalledSkills}
                                onRefreshRegistry={refreshRegistry}
                                query={queries.skills}
                                onQueryChange={(updater) => {
                                    setQueries(prev => ({
                                        ...prev,
                                        skills: updater(prev.skills),
                                    }));
                                }}
                            />
                        ) : (
                            <McpMarketplace
                                mode={activeTab}
                                registry={registry}
                                localPlugins={localPlugins}
                                installedModels={installedModels}
                                runtimeProfile={runtimeProfile}
                                loading={isSyncing}
                                onRefreshRegistry={refreshRegistry}
                                onRefreshMcpPlugins={refreshMcpPlugins}
                                query={queries[activeTab]}
                                onQueryChange={updateActiveQuery}
                            />
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

export default MarketplaceView;
