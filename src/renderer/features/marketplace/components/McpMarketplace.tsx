import { formatBytes } from '@renderer/utils/format.util';
import type { InstallRequest, MarketplaceItem, MarketplaceLanguage, MarketplaceMcp, MarketplaceModel, MarketplaceRegistry, MarketplaceRuntimeProfile } from '@shared/types/marketplace';
import { Package, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useModel } from '@/context/ModelContext';
import { useLanguage, useTranslation } from '@/i18n';
import { pushNotification } from '@/store/notification-center.store';
import type { ModelInfo } from '@/types';
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
    actions: Array<{ name: string; description: string }>;
}

interface McpMarketplaceProps {
    mode: MarketplaceMode;
    registry: MarketplaceRegistry | null;
    localPlugins: McpPlugin[];
    installedModels?: ModelInfo[];
    runtimeProfile?: MarketplaceRuntimeProfile | null;
    loading: boolean;
    onRefreshRegistry: () => Promise<void>;
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
    const [installingId, setInstallingId] = useState<string | null>(null);
    const [hfReadmeByModelId, setHfReadmeByModelId] = useState<Record<string, string>>({});
    const [hfPreviewByModelId, setHfPreviewByModelId] = useState<Record<string, HFPreviewData>>({});
    const [hfPreviewLoadingId, setHfPreviewLoadingId] = useState<string | null>(null);
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
                throw new Error(installResult.message || t('marketplace.installFailed', { name: item.name }));
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
            await onRefreshRegistry();
            void refreshModels(); // Background refresh of local models
            pushNotification({ type: 'success', message: t('marketplace.installSuccess', { name: item.name }) });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : t('marketplace.installFailed', { name: item.name });
            pushNotification({ type: 'error', message });
        } finally {
            setInstallingId(null);
        }
    }, [installingId, onRefreshMcpPlugins, onRefreshRegistry, refreshModels, t]);

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

    const selectedItem = useMemo<MarketplaceInfoItem | null>(() => {
        const entry = selectedEntry;
        if (!entry) { return null; }
        if (entry.type === 'local') {
            return {
                id: entry.plugin.id,
                name: entry.plugin.name,
                description: entry.plugin.description,
                author: 'System',
                version: '1.0.0',
                installed: true,
                installedVersion: '1.0.0',
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
            readme: resolvedReadme,
            totalSize: displaySize,
            downloads: modelItem?.downloads,
            pullCount: modelItem?.pullCount,
            likes: modelItem?.likes,
            submodels: modelItem?.submodels,
            performance,
            provider: modelItem?.provider,
            isReadmeLoading: isHf
                && !resolvedReadme
                && hfPreviewLoadingId === modelItem.id,
        };
    }, [hfPreviewLoadingId, hfReadmeByModelId, hfPreviewByModelId, selectedEntry]);

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

    if (loading) { return <Loader t={t} />; }

    return (
        <div className="space-y-6">
            {mode === 'models' && (
                <div className="flex items-center gap-2 border-b border-border/20 pb-4">
                    {(['ollama', 'huggingface', 'community'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => onQueryChange(prev => ({ ...prev, modelTab: tab, page: 1, selectedItemId: null }))}
                            className={`px-4 py-1.5 rounded-full typo-body font-bold transition-all ${query.modelTab === tab
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                                }`}
                        >
                            {t(`marketplace.tabs.${tab}`)}
                        </button>
                    ))}
                </div>
            )}

            <MarketplaceToolbar
                mode={mode}
                query={query}
                onQueryChange={onQueryChange}
                totalCount={totalCount}
                authors={authors}
                categories={categories}
                mcpView={query.mcpView}
            />

            <div className={`grid grid-cols-1 gap-6 transition-all duration-300 ${selectedItem ? 'xl:grid-cols-[minmax(0,1fr)_460px]' : 'xl:grid-cols-1'}`}>
                <div className="space-y-6">
                    <div className={`grid grid-cols-1 gap-6 ${selectedItem ? 'md:grid-cols-1 lg:grid-cols-1 2xl:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-3'}`}>
                        {enrichedPagedItems.map(entry => (
                            <div
                                key={entry.key}
                                onClick={() => setSelectedItemId(entry.type === 'local' ? entry.plugin.id : entry.item.id)}
                                className={`cursor-pointer transition-all duration-200 active:scale-[0.98] ${selectedItemId === (entry.type === 'local' ? entry.plugin.id : entry.item.id) ? 'ring-2 ring-primary ring-offset-2 ring-offset-background rounded-xl' : ''}`}
                            >
                                {entry.type === 'local' ? (
                                    <McpCard
                                        plugin={entry.plugin}
                                        t={t}
                                    />
                                ) : (
                                    <MarketCard
                                        item={entry.item}
                                        isActive={entry.item.itemType === 'language' && (entry.item as MarketplaceLanguage).locale === activeLanguage}
                                        isInstalling={installingId === entry.item.id}
                                        onInstall={(it) => void handleInstall(it)}
                                        onActivateLanguage={(it) => void handleActivateLanguage(it)}
                                    />
                                )}
                            </div>
                        ))}
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
                    <div className="relative">
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
        personas: 'marketplace.tabs.personas',
        models: 'marketplace.tabs.models',
        prompts: 'marketplace.tabs.prompts',
        languages: 'marketplace.tabs.languages',
    };
    return (
        <div className="col-span-full py-20 text-center border border-dashed border-border/40 rounded-xl bg-muted/5">
            <Package className="w-10 h-10 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground font-bold">{t('marketplace.emptyState', { mode: t(modeKeyByMode[mode]) })}</p>
        </div>
    );
}


function Loader({ t }: { t: (key: string) => string }) {
    return (
        <div className="flex flex-col items-center justify-center py-32 space-y-5">
            <RefreshCw className="w-8 h-8 text-primary animate-spin opacity-40" />
            <p className="typo-caption font-bold text-muted-foreground animate-pulse">{t('marketplace.syncing')}</p>
        </div>
    );
}

import { ChevronLeft, ChevronRight } from 'lucide-react';
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
        <div className="flex items-center justify-center gap-3 pt-6 border-t border-border/20">
            <button
                type="button"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="inline-flex items-center gap-1 rounded-md border border-border/40 px-3 py-1.5 typo-caption font-semibold text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
                <ChevronLeft className="h-3.5 w-3.5" />
                {t('common.previous')}
            </button>
            <span className="typo-caption font-semibold text-muted-foreground">
                {t('common.pageOf', { current: currentPage, total: totalPages })}
            </span>
            <button
                type="button"
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                className="inline-flex items-center gap-1 rounded-md border border-border/40 px-3 py-1.5 typo-caption font-semibold text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
                {t('common.next')}
                <ChevronRight className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}
