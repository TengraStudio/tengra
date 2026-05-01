/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { InstallRequest, MarketplaceExtension, MarketplaceItem, MarketplaceLanguage, MarketplaceMcp, MarketplaceModel, MarketplaceRegistry, MarketplaceRuntimeProfile } from '@shared/types/marketplace';
import { IconPackage, IconRefresh } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useModel } from '@/context/ModelContext';
import { useSettings } from '@/context/SettingsContext';
import { useLanguage, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { marketplaceStore } from '@/store/marketplace.store';
import { pushNotification } from '@/store/notification-center.store';
import type { ModelInfo } from '@/types';
import { formatBytes } from '@/utils/format.util';
import { appLogger } from '@/utils/renderer-logger';

import { useMarketplaceItems } from '../hooks/useMarketplaceItems';
import { type MarketplaceQueryState, type MarketplaceTab as MarketplaceMode } from '../marketplace-query.types';
import { extractParametersFromName } from '../utils/marketplace-performance.util';

import { MarketCard } from './MarketCard';
import { type MarketplaceInfoItem, MarketplaceInfoPanel } from './MarketplaceInfoPanel';
import { MarketplaceToolbar } from './MarketplaceToolbar';
import { McpCard } from './McpCard';

export interface McpPlugin {
    id: string;
    name: string;
    description: string;
    isEnabled: boolean;
    isAlive: boolean;
    source: 'core' | 'user' | 'remote';
    version?: string;
    actions: Array<{ name: string; description: string }>;
}

interface McpMarketplaceProps {
    mode: MarketplaceMode;
    registry: MarketplaceRegistry | null;
    localPlugins: McpPlugin[];
    installedModels?: ModelInfo[];
    runtimeProfile?: MarketplaceRuntimeProfile | null;
    loading: boolean;
    onRefreshRegistry: (force?: boolean) => Promise<void>;
    onRefreshMcpPlugins: () => Promise<void>;
    query: MarketplaceQueryState;
    onQueryChange: (updater: (prev: MarketplaceQueryState) => MarketplaceQueryState) => void;
}

interface HFPreviewData {
    model?: { id: string };
    requirements?: {
        diskGB?: number;
        minRamGB?: number;
        minVramGB?: number;
    };
    benchmark?: {
        speed?: number;
    };
    readme?: string;
}

const BYTES_IN_GB = 1024 ** 3;

function isMissingSizeLabel(value?: string): boolean {
    if (!value) {
        return true;
    }
    const normalized = value.replace(/\s+/g, '').toLowerCase();
    return normalized === '0kb' || normalized === '0b' || normalized === '0gb' || normalized === '0.0gb';
}

function toBytes(value?: number): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return undefined;
    }
    return Math.round(value * BYTES_IN_GB);
}

function mergePerformanceWithPreview(
    performance: MarketplaceModel['performance'],
    hfPreview: HFPreviewData | null | undefined
): MarketplaceModel['performance'] {
    if (!performance || !hfPreview?.requirements) {
        return performance;
    }
    const diskBytes = toBytes(hfPreview.requirements.diskGB);
    const ramBytes = toBytes(hfPreview.requirements.minRamGB);
    const vramBytes = toBytes(hfPreview.requirements.minVramGB);
    return {
        ...performance,
        estimatedDiskBytes: diskBytes ?? performance.estimatedDiskBytes,
        estimatedMemoryBytes: ramBytes ?? performance.estimatedMemoryBytes,
        estimatedVramBytes: vramBytes ?? performance.estimatedVramBytes,
    };
}

export type MarketplaceEntry =
    | { type: 'local'; plugin: McpPlugin; key: string }
    | { type: 'store'; item: MarketplaceItem; key: string };

function readObject(value: unknown): Record<string, unknown> | null {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

function readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function readNumber(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null;
    }
    return value;
}

function readStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        .map(entry => entry.trim());
}

function buildHfMarketplaceReadme(preview: unknown): string | null {
    const root = readObject(preview);
    if (!root) {
        return null;
    }
    const model = readObject(root.model);
    const card = readObject(root.card);
    const requirements = readObject(root.requirements);
    const benchmark = readObject(root.benchmark);
    const modelId = readString(model?.id);
    const summary = readString(card?.summary);
    const highlights = readStringArray(card?.highlights);
    const diskGb = readNumber(requirements?.diskGB);
    const minRamGb = readNumber(requirements?.minRamGB);
    const recRamGb = readNumber(requirements?.recommendedRamGB);
    const minVramGb = readNumber(requirements?.minVramGB);
    const quality = readNumber(benchmark?.quality);
    const speed = readNumber(benchmark?.speed);
    const memoryEfficiency = readNumber(benchmark?.memoryEfficiency);

    const sections: string[] = [];
    if (modelId.length > 0) {
        sections.push(`# ${modelId}`);
    }
    if (summary.length > 0) {
        sections.push(summary);
    }
    if (highlights.length > 0) {
        sections.push('## Highlights');
        sections.push(...highlights.map(item => `- ${item}`));
    }
    const requirementRows: string[] = [];
    if (minRamGb !== null) {
        requirementRows.push(`- Min RAM: ${minRamGb} GB`);
    }
    if (recRamGb !== null) {
        requirementRows.push(`- Recommended RAM: ${recRamGb} GB`);
    }
    if (minVramGb !== null) {
        requirementRows.push(`- Min VRAM: ${minVramGb} GB`);
    }
    if (diskGb !== null) {
        requirementRows.push(`- Disk: ${diskGb} GB`);
    }
    if (requirementRows.length > 0) {
        sections.push('## Requirements');
        sections.push(...requirementRows);
    }
    const benchmarkRows: string[] = [];
    if (quality !== null) {
        benchmarkRows.push(`- Quality: ${quality}`);
    }
    if (speed !== null) {
        benchmarkRows.push(`- Speed: ${speed}`);
    }
    if (memoryEfficiency !== null) {
        benchmarkRows.push(`- Memory efficiency: ${memoryEfficiency}`);
    }
    if (benchmarkRows.length > 0) {
        sections.push('## Benchmark');
        sections.push(...benchmarkRows);
    }

    const markdown = sections.join('\n\n').trim();
    return markdown.length > 0 ? markdown : null;
}

export function McpMarketplace({
    mode,
    registry,
    localPlugins,
    installedModels = [],
    runtimeProfile = null,
    loading,
    onRefreshRegistry,
    onRefreshMcpPlugins,
    query,
    onQueryChange,
}: McpMarketplaceProps): JSX.Element {
    const { t } = useTranslation();
    const { language: activeLanguage, setLanguage } = useLanguage();
    const { refreshModels } = useModel();
    const { settings, updateSettings } = useSettings();
    const [installingId, setInstallingId] = useState<string | null>(null);
    const [hfReadmeByModelId, setHfReadmeByModelId] = useState<Record<string, string>>({});
    const [hfPreviewByModelId, setHfPreviewByModelId] = useState<Record<string, HFPreviewData>>({});
    const [hfPreviewLoadingId, setHfPreviewLoadingId] = useState<string | null>(null);
    const [extensionReadmes, setExtensionReadmes] = useState<Record<string, string>>({});
    const [extReadmeLoadingId, setExtReadmeLoadingId] = useState<string | null>(null);
    const fetchedHfIdsRef = useRef<Set<string>>(new Set());
    const fetchingHfIdsRef = useRef<Set<string>>(new Set());

    const {
        categories,
        authors,
        totalCount,
        totalPages,
        effectivePage,
        pagedItems,
        combinedItems
    } = useMarketplaceItems({ mode, registry, localPlugins, query, installedModels, runtimeProfile });

    const selectedItemId = query.selectedItemId;
    const setSelectedItemId = (id: string | null) => {
        onQueryChange(prev => ({ ...prev, selectedItemId: id }));
    };

    const selectedEntry = useMemo<MarketplaceEntry | null>(() => {
        if (!selectedItemId) {
            return null;
        }
        return combinedItems.find(
            entry => (entry.type === 'local' ? entry.plugin.id : entry.item.id) === selectedItemId
        ) ?? null;
    }, [combinedItems, selectedItemId]);

    const selectedStoreItem = useMemo<MarketplaceItem | null>(() => {
        if (selectedEntry?.type !== 'store') {
            return null;
        }
        return selectedEntry.item;
    }, [selectedEntry]);

    const selectedStoreModel = useMemo<MarketplaceModel | null>(() => {
        if (selectedStoreItem?.itemType !== 'model') {
            return null;
        }
        return selectedStoreItem as MarketplaceModel;
    }, [selectedStoreItem]);

    const handleInstall = useCallback(async (item: MarketplaceItem) => {
        if (installingId) { return; }
        setInstallingId(item.id);
        const modelItem = item.itemType === 'model' ? (item as MarketplaceModel) : null;
        try {
            const installResult = await window.electron.marketplace.install({
                type: item.itemType as InstallRequest['type'],
                id: item.id,
                downloadUrl: item.downloadUrl,
                sourceUrl: modelItem?.sourceUrl,
                provider: modelItem?.provider
            });
            if (!installResult.success) {
                throw new Error(installResult.message || t('frontend.marketplace.installFailed', { name: item.name }));
            }
            if (item.itemType === 'mcp') {
                const mcpItem = item as MarketplaceMcp;
                const mcpConfig = installResult.mcpConfig ?? {
                    id: mcpItem.id,
                    name: mcpItem.id,
                    description: mcpItem.description,
                    command: mcpItem.command,
                    args: mcpItem.args,
                    env: mcpItem.env,
                    enabled: false,
                    permissionProfile: mcpItem.permissionProfile,
                    permissions: mcpItem.permissions,
                    tools: mcpItem.tools,
                    category: mcpItem.category,
                    publisher: mcpItem.author,
                    version: mcpItem.version,
                    extensionType: 'mcp_server',
                    isOfficial: true,
                    capabilities: mcpItem.capabilities,
                    storage: mcpItem.storage,
                };
                await window.electron.mcp.install(mcpConfig);
                await onRefreshMcpPlugins();
            }
            await onRefreshRegistry(true);
            if (item.itemType === 'icon-pack' && settings) {
                await updateSettings({
                    ...settings,
                    general: {
                        ...settings.general,
                        workspaceIconPack: item.id,
                    },
                }, true);
            }
            void refreshModels(); // Background refresh of local models
            pushNotification({ type: 'success', message: t('frontend.marketplace.installSuccess', { name: item.name }) });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : t('frontend.marketplace.installFailed', { name: item.name });
            pushNotification({ type: 'error', message });
        } finally {
            setInstallingId(null);
        }
    }, [installingId, onRefreshMcpPlugins, onRefreshRegistry, refreshModels, settings, t, updateSettings]);

    const handleActivateIconPack = useCallback(async (item: MarketplaceItem) => {
        if (!settings) {
            return;
        }
        await updateSettings({
            ...settings,
            general: {
                ...settings.general,
                workspaceIconPack: item.id,
            },
        }, true);
        pushNotification({ type: 'success', message: t('common.activate') });
    }, [settings, t, updateSettings]);

    useEffect(() => {
        const fetchBulkHuggingFaceMetadata = async (): Promise<void> => {
            const hfModels = pagedItems
                .filter((entry): entry is { type: 'store'; item: MarketplaceItem; key: string } => entry.type === 'store')
                .map(entry => entry.item)
                .filter((item): item is MarketplaceModel =>
                    item.itemType === 'model' &&
                    (item as MarketplaceModel).provider === 'huggingface'
                )
                .filter(model => !fetchedHfIdsRef.current.has(model.id) && !fetchingHfIdsRef.current.has(model.id));

            if (hfModels.length === 0) {
                return;
            }

            try {
                const modelIds = hfModels.map(m => m.id);
                modelIds.forEach(id => fetchingHfIdsRef.current.add(id));

                const results = await window.electron.huggingface.getBulkModelPreviews(modelIds);
                for (const modelId of modelIds) {
                    fetchingHfIdsRef.current.delete(modelId);
                    if (results[modelId]) {
                        fetchedHfIdsRef.current.add(modelId);
                    }
                }

                setHfPreviewByModelId(prev => ({
                    ...prev,
                    ...results
                }));
            } catch (error) {
                hfModels.forEach(model => fetchingHfIdsRef.current.delete(model.id));
                appLogger.error('McpMarketplace', 'Bulk fetch failed', error as Error);
            }
        };

        void fetchBulkHuggingFaceMetadata();
    }, [pagedItems]);

    const handleActivateLanguage = useCallback(async (item: MarketplaceLanguage) => {
        if (item.locale === activeLanguage) { return; }
        await setLanguage(item.locale);
        await onRefreshRegistry();
    }, [activeLanguage, onRefreshRegistry, setLanguage]);

    useEffect(() => {
        if (selectedStoreModel?.provider !== 'huggingface') {
            return;
        }
        if (hfPreviewByModelId[selectedStoreModel.id]) {
            return;
        }

        let active = true;
        const modelId = selectedStoreModel.id;
        setHfPreviewLoadingId(modelId);
        void window.electron.huggingface.getModelPreview(modelId)
            .then((preview) => {
                if (!active) {
                    return;
                }
                setHfPreviewByModelId(prev => ({
                    ...prev,
                    [modelId]: preview
                }));
                const hasExistingReadme = (selectedStoreModel.readme ?? '').trim().length > 0
                    || (hfReadmeByModelId[modelId] ?? '').trim().length > 0;
                const fallbackReadme = !hasExistingReadme ? buildHfMarketplaceReadme(preview) : null;
                if (fallbackReadme && fallbackReadme.trim().length > 0) {
                    setHfReadmeByModelId(prev => ({
                        ...prev,
                        [modelId]: fallbackReadme
                    }));
                }
            })
            .catch((error: Error | string) => {
                const message = typeof error === 'string' ? error : error.message;
                appLogger.warn('McpMarketplace', `Failed to load HF preview for ${modelId}: ${message}`);
            })
            .finally(() => {
                if (!active) {
                    return;
                }
                setHfPreviewLoadingId(current => (current === modelId ? null : current));
            });

        return () => {
            active = false;
        };
    }, [hfPreviewByModelId, hfReadmeByModelId, selectedStoreModel]);

    useEffect(() => {
        if (selectedStoreItem?.itemType !== 'extension') {
            return;
        }

        const extension = selectedStoreItem as MarketplaceExtension;
        const repoUrl = extension.repository;
        if (!repoUrl || extensionReadmes[extension.id]) {
            return;
        }

        let active = true;
        setExtReadmeLoadingId(extension.id);

        void marketplaceStore.fetchReadme(extension.id, repoUrl)
            .then((readme: string | null) => {
                if (!active || !readme) {
                    return;
                }
                setExtensionReadmes(prev => ({
                    ...prev,
                    [extension.id]: readme
                }));
            })
            .catch((err: Error) => {
                appLogger.warn('McpMarketplace', `Failed to fetch extension readme for ${extension.id}`, err);
            })
            .finally(() => {
                if (active) {
                    setExtReadmeLoadingId(null);
                }
            });

        return () => {
            active = false;
        };
    }, [extensionReadmes, selectedStoreItem]);

    const selectedItem = useMemo<MarketplaceInfoItem | null>(() => {
        const entry = selectedEntry;
        if (!entry) { return null; }
        if (entry.type === 'local') {
            return {
                id: entry.plugin.id,
                name: entry.plugin.name,
                description: entry.plugin.description,
                author: 'System',
                version: entry.plugin.version || '1.0.0',
                installed: true,
                installedVersion: entry.plugin.version || '1.0.0',
                itemType: 'mcp',
            };
        }
        const { item } = entry;
        const modelItem = item.itemType === 'model' ? (item as MarketplaceModel) : null;
        const resolvedReadme = modelItem?.provider === 'huggingface'
            ? (modelItem.readme ?? hfReadmeByModelId[modelItem.id])
            : modelItem?.readme;
        const hfPreview = (modelItem?.id ? hfPreviewByModelId[modelItem.id] : null) as HFPreviewData | null;
        const performance = mergePerformanceWithPreview(modelItem?.performance, hfPreview);

        const isHf = modelItem?.provider === 'huggingface';
        let displaySize = modelItem?.totalSize;

        if (performance?.estimatedDiskBytes && isMissingSizeLabel(displaySize)) {
            displaySize = formatBytes(performance.estimatedDiskBytes);
        }

        // Final fallback for display size from name if it is still missing
        if (!displaySize && modelItem?.name) {
            const params = extractParametersFromName(modelItem.name);
            if (params) {
                // Guestimate Q4 size if absolutely nothing else known
                displaySize = `~${(params * 0.6 / 1024 ** 3).toFixed(1)} GB`;
            }
        }

        return {
            id: item.id,
            name: item.name,
            description: item.description,
            author: item.author,
            version: item.version,
            installed: Boolean(item.installed),
            installedVersion: item.installedVersion,
            itemType: item.itemType,
            readme: resolvedReadme || extensionReadmes[item.id],
            totalSize: displaySize,
            downloads: modelItem?.downloads,
            pullCount: modelItem?.pullCount,
            likes: modelItem?.likes,
            submodels: modelItem?.submodels,
            performance,
            provider: modelItem?.provider,
            isReadmeLoading: (isHf && !resolvedReadme && hfPreviewLoadingId === modelItem.id) ||
                (item.itemType === 'extension' && !extensionReadmes[item.id] && extReadmeLoadingId === item.id),
        };
    }, [hfPreviewLoadingId, hfReadmeByModelId, hfPreviewByModelId, extensionReadmes, extReadmeLoadingId, selectedEntry]);

    const enrichedPagedItems = useMemo(() => {
        return pagedItems.map(entry => {
            if (entry.type !== 'store' || entry.item.itemType !== 'model') {
                return entry;
            }

            const modelItem = entry.item as MarketplaceModel;
            if (modelItem.provider !== 'huggingface') {
                return entry;
            }

            const hfPreview = hfPreviewByModelId[modelItem.id];
            if (!hfPreview) {
                return entry;
            }

            const performance = mergePerformanceWithPreview(modelItem.performance, hfPreview);

            let totalSize = modelItem.totalSize;
            if (performance?.estimatedDiskBytes && isMissingSizeLabel(totalSize)) {
                totalSize = formatBytes(performance.estimatedDiskBytes);
            }

            return {
                ...entry,
                item: {
                    ...entry.item,
                    performance,
                    totalSize,
                }
            };
        });
    }, [pagedItems, hfPreviewByModelId]);

    const handleUninstall = useCallback(async (item: MarketplaceItem) => {
        if (installingId) { return; }
        setInstallingId(item.id);
        try {
            const result = item.itemType === 'extension'
                ? await window.electron.extension.uninstall(item.id)
                : await window.electron.marketplace.uninstall(item.id, item.itemType);
            if (!result.success) {
                throw new Error(result.error || t('frontend.marketplace.uninstallFailure'));
            }

            if (item.itemType === 'mcp') {
                await onRefreshMcpPlugins();
            }
            if (item.itemType === 'icon-pack' && settings?.general.workspaceIconPack === item.id) {
                await updateSettings({
                    ...settings,
                    general: {
                        ...settings.general,
                        workspaceIconPack: '',
                    },
                }, true);
            }
            await onRefreshRegistry(true);

            // Determine notification message
            let successMessage = t('frontend.marketplace.uninstallSuccess', { name: item.name });
            if (result.messageKey) {
                successMessage = t(result.messageKey, { name: item.name });
            }

            pushNotification({
                type: result.messageKey === 'extension.uninstall.partial_success' ? 'warning' : 'success',
                message: successMessage
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : t('frontend.marketplace.uninstallFailure');
            pushNotification({ type: 'error', message });
        } finally {
            setInstallingId(null);
        }
    }, [installingId, onRefreshMcpPlugins, onRefreshRegistry, settings, t, updateSettings]);

    if (loading) { return <Loader t={t} />; }

    return (
        <div className="space-y-8">
            <MarketplaceToolbar
                mode={mode}
                query={query}
                onQueryChange={onQueryChange}
                totalCount={totalCount}
                authors={authors}
                categories={categories}
                mcpView={query.mcpView}
            />

            <div className="flex flex-col xl:flex-row gap-10 transition-all duration-300">
                <div className="flex-1 space-y-8">
                    <div className={cn(
                        'transition-all duration-300',
                        query.viewMode === 'grid'
                            ? 'grid grid-cols-1 lg:grid-cols-2 gap-4'
                            : 'flex flex-col gap-4'
                    )}>
                        {enrichedPagedItems.map(entry => {
                            const isSelected = selectedItemId === (entry.type === 'local' ? entry.plugin.id : entry.item.id);
                            return (
                                <div
                                    key={entry.key}
                                    onClick={() => setSelectedItemId(entry.type === 'local' ? entry.plugin.id : entry.item.id)}
                                    className={cn(
                                        'group relative flex items-start cursor-pointer transition-all duration-200 rounded-2xl overflow-hidden',
                                        isSelected ? 'bg-primary/[0.03] ring-1 ring-inset ring-primary/10 shadow-sm' : 'bg-transparent hover:bg-muted/30'
                                    )}
                                >
                                    <div className="flex-1">
                                        {entry.type === 'local' ? (
                                            <McpCard
                                                plugin={entry.plugin}
                                                t={t}
                                                onUninstall={(id, name) => void handleUninstall({ id, name, itemType: 'mcp' } as MarketplaceItem)}
                                            />
                                        ) : (
                                            <MarketCard
                                                item={entry.item}
                                                isActive={
                                                    (entry.item.itemType === 'language' && (entry.item as MarketplaceLanguage).locale === activeLanguage)
                                                    || (entry.item.itemType === 'icon-pack' && settings?.general.workspaceIconPack === entry.item.id)
                                                }
                                                isInstalling={installingId === entry.item.id}
                                                onInstall={(it) => void handleInstall(it)}
                                                onUninstall={(it) => void handleUninstall(it)}
                                                onActivateLanguage={(it) => void handleActivateLanguage(it)}
                                                onActivateIconPack={(it) => void handleActivateIconPack(it)}
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {totalCount === 0 && <EmptyState t={t} mode={mode} />}

                    {totalCount > 24 && (
                        <Pagination
                            currentPage={effectivePage}
                            totalPages={totalPages}
                            onPageChange={nextPage => onQueryChange(prev => ({ ...prev, page: nextPage }))}
                            t={t}
                        />
                    )}
                </div>

                {selectedItem && (
                    <div className="w-full xl:w-[480px] shrink-0">
                        <div className="sticky top-6">
                            <MarketplaceInfoPanel
                                item={selectedItem}
                                t={t}
                                onClose={() => setSelectedItemId(null)}
                                onInstall={(override) => {
                                    if (!selectedStoreItem) {
                                        return;
                                    }
                                    if (override) {
                                        void handleInstall({
                                            ...selectedStoreItem,
                                            id: override.id || selectedStoreItem.id,
                                            name: override.name || selectedStoreItem.name,
                                            downloadUrl: override.downloadUrl || selectedStoreItem.downloadUrl
                                        });
                                    } else {
                                        void handleInstall(selectedStoreItem);
                                    }
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function EmptyState({
    t,
    mode
}: {
    t: (key: string, options?: Record<string, string | number>) => string;
    mode: MarketplaceMode
}) {
    const modeKeyByMode: Record<MarketplaceMode, string> = {
        mcp: 'marketplace.tabs.mcp',
        extensions: 'marketplace.tabs.extensions',
        skills: 'marketplace.tabs.skills',
        themes: 'marketplace.tabs.themes',
        models: 'marketplace.tabs.models',
        prompts: 'marketplace.tabs.prompts',
        languages: 'marketplace.tabs.languages',
        iconPacks: 'marketplace.tabs.iconPacks',
    };
    return (
        <div className="py-32 flex flex-col items-center justify-center text-center">
            <IconPackage className="w-12 h-12 text-muted-foreground/10 mb-4" />
            <p className="text-sm text-muted-foreground/40 font-semibold ">
                {t('frontend.marketplace.emptyState', { mode: t(modeKeyByMode[mode]) })}
            </p>
        </div>
    );
}


function Loader({ t }: { t: (key: string) => string }) {
    return (
        <div className="flex flex-col items-center justify-center py-32 space-y-5">
            <IconRefresh className="w-8 h-8 text-primary/40 animate-spin" />
            <p className="text-sm font-bold uppercase  text-muted-foreground/30 animate-pulse">
                {t('frontend.marketplace.syncing')}
            </p>
        </div>
    );
}

import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

/* Batch-02: Extracted Long Classes */
const C_MCPMARKETPLACE_1 = "p-2.5 rounded-xl hover:bg-muted text-muted-foreground/20 hover:text-foreground transition-all disabled:opacity-0";
const C_MCPMARKETPLACE_2 = "p-2.5 rounded-xl hover:bg-muted text-muted-foreground/20 hover:text-foreground transition-all disabled:opacity-0";

function Pagination({
    currentPage,
    totalPages,
    onPageChange,
    t
}: {
    currentPage: number;
    totalPages: number;
    onPageChange: (nextPage: number) => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}) {
    return (
        <div className="flex items-center justify-center gap-8 pt-12">
            <button
                type="button"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className={C_MCPMARKETPLACE_1}
            >
                <IconChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-bold uppercase  text-muted-foreground/20">
                {t('common.pageOf', { current: currentPage, total: totalPages })}
            </span>
            <button
                type="button"
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                className={C_MCPMARKETPLACE_2}
            >
                <IconChevronRight className="h-5 w-5" />
            </button>
        </div>
    );
}
