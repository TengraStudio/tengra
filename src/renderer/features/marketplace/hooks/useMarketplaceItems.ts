import type { 
    MarketplaceItem, 
    MarketplaceMcp, 
    MarketplaceModel, 
    MarketplacePrompt,
    MarketplaceRegistry, 
    MarketplaceRuntimeProfile} from '@shared/types/marketplace';
import { useCallback,useMemo } from 'react';

import type { ModelInfo } from '@/types';

import type { McpPlugin } from '../components/McpMarketplace';
import type { MarketplaceQueryState } from '../marketplace-query.types';
import { enrichMarketplaceModel, sortMarketplaceModels } from '../utils/marketplace-performance.util';

interface UseMarketplaceItemsProps {
    mode: string;
    registry: MarketplaceRegistry | null;
    localPlugins: McpPlugin[];
    query: MarketplaceQueryState;
    installedModels?: ModelInfo[];
    runtimeProfile?: MarketplaceRuntimeProfile | null;
}

export function useMarketplaceItems({ mode, registry, localPlugins, query, installedModels = [], runtimeProfile = null }: UseMarketplaceItemsProps) {
    const { search, filter, sort, mcpView, page: currentPage, modelTab, modelFit, modelTarget } = query;

    const installedModelsSet = useMemo(
        () => new Set(installedModels.map(m => String(m.id ?? '').toLowerCase()).filter(Boolean)),
        [installedModels]
    );

    const getStoreItems = useCallback((): MarketplaceItem[] => {
        if (!registry) {
            return [];
        }
        let items: MarketplaceItem[] = [];
        switch (mode) {
            case 'mcp': items = registry.mcp || []; break;
            case 'themes': items = registry.themes || []; break;
            case 'personas': items = registry.personas || []; break;
            case 'prompts': items = registry.prompts || []; break;
            case 'languages': items = registry.languages || []; break;
            case 'models': {
                const models = registry.models || [];
                if (modelTab === 'ollama') {
                    items = models.filter(m => m.provider === 'ollama');
                } else if (modelTab === 'huggingface') {
                    items = models.filter(m => m.provider === 'huggingface');
                } else if (modelTab === 'community') {
                    items = models.filter(m => m.provider === 'custom');
                } else {
                    items = models;
                }
                break;
            }
            default: items = [];
        }

        // Enrich with local installation status for models
        return items.map(item => {
            if (item.itemType === 'model') {
                const model = item as MarketplaceModel;
                const isInstalledLocally = installedModelsSet.has(model.id.toLowerCase()) || 
                                          model.submodels?.some(sm => installedModelsSet.has(sm.id.toLowerCase()));
                return {
                    ...item,
                    installed: isInstalledLocally || Boolean(item.installed),
                    ...enrichMarketplaceModel(model, runtimeProfile),
                };
            }
            return item;
        });
    }, [registry, mode, modelTab, installedModelsSet, runtimeProfile]);

    const storeItems = useMemo(() => getStoreItems(), [getStoreItems]);

    const categories = useMemo(() => {
        const set = new Set<string>();
        storeItems.forEach((item) => {
            let category: string | undefined;
            if (item.itemType === 'mcp') {
                category = (item as MarketplaceMcp).category;
            } else if (item.itemType === 'model') {
                category = (item as MarketplaceModel).category;
            } else if (item.itemType === 'prompt') {
                category = (item as MarketplacePrompt).category;
            }

            if (category) {
                set.add(category);
            }
        });
        return Array.from(set).sort();
    }, [storeItems]);

    const authors = useMemo(() => {
        const set = new Set<string>();
        storeItems.forEach((item) => {
            if (item.author) {
                set.add(item.author);
            }
        });
        return Array.from(set).sort();
    }, [storeItems]);

    const filteredStoreItems = useMemo(() => {
        const filtered = storeItems.filter(i => {
            const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase()) ||
                i.description.toLowerCase().includes(search.toLowerCase());
            if (!matchesSearch) {
                return false;
            }

            const installed = Boolean(i.installed);
            if (mode !== 'mcp') {
                if (filter === 'installed' && !installed) {
                    return false;
                }
                if (filter === 'not_installed' && installed) {
                    return false;
                }
            }

            if (query.author && i.author !== query.author) {
                return false;
            }
            
            const modelItem = i.itemType === 'model' ? (i as MarketplaceModel) : null;
            if (mode === 'models' && modelItem?.performance) {
                if (modelFit && modelFit !== 'all' && modelItem.performance.fit !== modelFit) {
                    return false;
                }
                if (modelTarget && modelTarget !== 'all' && modelItem.performance.backend !== modelTarget) {
                    return false;
                }
            }
            if (query.category && modelItem?.category !== query.category) {
                return false;
            }

            return true;
        });
        if (mode === 'models') {
            const modelItems = filtered.filter((item): item is MarketplaceModel => item.itemType === 'model');
            return sortMarketplaceModels(modelItems, sort);
        }
        return filtered.sort((a, b) => {
            if (sort === 'name_asc') {
                return a.name.localeCompare(b.name);
            }
            if (sort === 'name_desc') {
                return b.name.localeCompare(a.name);
            }

            const modelA = a.itemType === 'model' ? (a as MarketplaceModel) : null;
            const modelB = b.itemType === 'model' ? (b as MarketplaceModel) : null;

            if (sort === 'downloads_desc') {
                const popA = (modelA?.downloads || 0) + (modelA?.pullCount || 0);
                const popB = (modelB?.downloads || 0) + (modelB?.pullCount || 0);
                return popB - popA;
            }
            if (sort === 'likes_desc') {
                return (modelB?.likes || 0) - (modelA?.likes || 0);
            }
            return b.version.localeCompare(a.version);
        });
    }, [storeItems, search, filter, query.author, query.category, sort, mode, modelFit, modelTarget]);

    const filteredLocal = useMemo(() => mode === 'mcp'
        ? localPlugins
            .filter(p =>
                p.name.toLowerCase().includes(search.toLowerCase()) ||
                p.description?.toLowerCase().includes(search.toLowerCase())
            )
            .filter(p => (mcpView === 'external' ? p.source !== 'core' : true))
            .sort((a, b) => (sort === 'name_desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)))
        : [], [localPlugins, search, mcpView, sort, mode]);

    const combinedItems = useMemo(() => {
        const localItems = filteredLocal.map((plugin, index) => ({ 
            type: 'local' as const, 
            plugin, 
            key: `local-${plugin.id ?? plugin.name ?? index}` 
        }));
        const remoteItems = filteredStoreItems.map(item => ({ 
            type: 'store' as const, 
            item, 
            key: `store-${item.itemType}-${item.id}` 
        }));
        return mode === 'mcp' ? [...localItems, ...remoteItems] : remoteItems;
    }, [filteredLocal, filteredStoreItems, mode]);

    const totalCount = combinedItems.length;
    const totalPages = Math.ceil(totalCount / 24);
    const effectivePage = Math.min(currentPage, totalPages || 1);
    const pagedItems = combinedItems.slice((effectivePage - 1) * 24, effectivePage * 24);

    return {
        storeItems,
        categories,
        authors,
        filteredStoreItems,
        filteredLocal,
        combinedItems,
        totalCount,
        totalPages,
        effectivePage,
        pagedItems
    };
}
