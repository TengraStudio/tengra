export type MarketplaceTab = 'mcp' | 'skills' | 'themes' | 'personas' | 'models' | 'prompts' | 'languages';
export type ModelTab = 'ollama' | 'huggingface' | 'community';
export type MarketplaceFilterValue = 'all' | 'installed' | 'not_installed';
export type MarketplaceModelFitValue = 'all' | 'recommended' | 'workable' | 'limited' | 'blocked';
export type MarketplaceModelTargetValue = 'all' | 'cpu' | 'gpu';
export type MarketplaceSortValue =
    | 'name_asc'
    | 'name_desc'
    | 'version_desc'
    | 'downloads_desc'
    | 'likes_desc'
    | 'performance_desc'
    | 'tokens_desc'
    | 'memory_asc'
    | 'storage_asc';
export type MarketplaceMcpView = 'all' | 'installed' | 'external';

export interface MarketplaceQueryState {
    search: string;
    filter: MarketplaceFilterValue;
    sort: MarketplaceSortValue;
    mcpView: MarketplaceMcpView;
    page: number;
    author?: string;
    category?: string;
    modelTab?: ModelTab;
    modelFit?: MarketplaceModelFitValue;
    modelTarget?: MarketplaceModelTargetValue;
    selectedItemId?: string | null;
}


const DEFAULT_QUERY_STATE: MarketplaceQueryState = {
    search: '',
    filter: 'all',
    sort: 'name_asc',
    mcpView: 'all',
    page: 1,
    modelTab: 'ollama',
    modelFit: 'all',
    modelTarget: 'all',
};

export function createDefaultMarketplaceQueries(): Record<MarketplaceTab, MarketplaceQueryState> {
    return {
        mcp: { ...DEFAULT_QUERY_STATE },
        skills: { ...DEFAULT_QUERY_STATE },
        themes: { ...DEFAULT_QUERY_STATE },
        personas: { ...DEFAULT_QUERY_STATE },
        models: { ...DEFAULT_QUERY_STATE, sort: 'performance_desc', modelTab: 'ollama' },
        prompts: { ...DEFAULT_QUERY_STATE },
        languages: { ...DEFAULT_QUERY_STATE },
    };
}
