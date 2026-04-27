/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { MarketplaceRegistry, MarketplaceRuntimeProfile, MarketplaceSkill } from '@shared/types/marketplace';
import type { ProxySkill } from '@shared/types/skill';
import { IconBolt,IconCircleCheck, IconGlobe, IconMessage, IconPackage, IconPalette, IconPhoto, IconSparkles } from '@tabler/icons-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useAuthLanguage } from '@/context/AuthContext';
import { useModel } from '@/context/ModelContext';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
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
        { id: 'mcp', icon: IconPackage },
        { id: 'extensions', icon: IconBolt },
        { id: 'skills', icon: IconSparkles },
        { id: 'themes', icon: IconPalette },
        { id: 'models', icon: IconBolt },
        { id: 'prompts', icon: IconMessage },
        { id: 'languages', icon: IconGlobe },
        { id: 'iconPacks', icon: IconPhoto },
    ];
    const tabLabels: Record<MarketplaceTab, string> = {
        mcp: t('marketplace.tabs.mcp'),
        extensions: t('marketplace.tabs.extensions'),
        skills: t('marketplace.tabs.skills'),
        themes: t('marketplace.tabs.themes'),
        models: t('marketplace.tabs.models'),
        prompts: t('marketplace.tabs.prompts'),
        languages: t('marketplace.tabs.languages'),
        iconPacks: t('marketplace.tabs.iconPacks'),
    };
    const registryItems = registry ?? {
        version: '',
        lastUpdated: '',
        themes: [],
        mcp: [],
        models: [],
        prompts: [],
        languages: [],
        skills: [],
        iconPacks: [],
    };
    const totalInstalled = (registryItems.themes?.filter(item => item.installed).length ?? 0)
        + (registryItems.mcp?.filter(item => item.installed).length ?? 0)
        + (registryItems.models?.filter(item => item.installed).length ?? 0)
        + (registryItems.prompts?.filter(item => item.installed).length ?? 0)
        + (registryItems.languages?.filter(item => item.installed).length ?? 0)
        + (registryItems.iconPacks?.filter(item => item.installed).length ?? 0)
        + installedSkills.length;
    const totalAvailable = (registryItems.themes?.length ?? 0)
        + (registryItems.mcp?.length ?? 0)
        + (registryItems.models?.length ?? 0)
        + (registryItems.prompts?.length ?? 0)
        + (registryItems.languages?.length ?? 0)
        + (registryItems.iconPacks?.length ?? 0)
        + marketplaceSkills.length;
    const updateActiveQuery = (updater: (prev: MarketplaceQueryState) => MarketplaceQueryState): void => {
        setQueries(prev => ({
            ...prev,
            [activeTab]: updater(prev[activeTab]),
        }));
    };

    useEffect(() => {
        tRef.current = t;
    }, [t]);

    const refreshRegistry = useCallback(async (force = false) => {
        if (!force && registryInFlightRef.current) {
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
        <div className="flex flex-col h-full bg-background overflow-hidden">
            {/* Header Section */}
            <header className="shrink-0 px-8 pt-8 pb-4">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold text-foreground">
                            {t('marketplace.title')}
                        </h1>
                        <p className="text-sm font-medium text-muted-foreground/50 uppercase ">
                            {t('marketplace.subtitle')}
                        </p>
                    </div>

                    {/* Navigation Tabs - More elegant and minimal */}
                    <nav className="flex items-center gap-1">
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        'relative px-4 py-2 text-sm font-bold uppercase transition-all',
                                        isActive ? 'text-primary' : 'text-muted-foreground/40 hover:text-foreground/70'
                                    )}
                                >
                                    {tabLabels[tab.id]}
                                    {isActive && (
                                        <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Status Bar - Refined Typography */}
                <div className="mt-8 flex items-center gap-6 px-1 border-b border-muted/10 pb-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground/40 uppercase ">
                        <IconPackage className="w-3.5 h-3.5 opacity-30" />
                        <span>{totalAvailable} {t('marketplace.results')}</span>
                    </div>
                    <div className="h-1 w-1 rounded-full bg-muted/20" />
                    <div className="flex items-center gap-2 text-sm font-bold text-primary/60 uppercase ">
                        <IconCircleCheck className="w-3.5 h-3.5 opacity-60" />
                        <span>{totalInstalled} {t('modelExplorer.installed')}</span>
                    </div>
                </div>
            </header>

            {/* Content Area */}
            <main className="flex-1 overflow-y-auto px-8 py-6 scroll-smooth custom-scrollbar">
                <div className="max-w-6xl mx-auto pb-12">
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
    );
}

export default MarketplaceView;
