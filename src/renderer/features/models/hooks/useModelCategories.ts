import { Box, BrainCircuit, Code2, LayoutGrid, Server, Sparkles, Zap } from 'lucide-react';
import { useMemo } from 'react';

import { AppSettings } from '@/types';

import { ModelCategory, ModelListItem } from '../types';
import type { GroupedModels, ModelInfo } from '../utils/model-fetcher';

interface UseModelCategoriesProps {
    groupedModels?: GroupedModels;
    debouncedSearchQuery: string;
    settings?: AppSettings;
    selectedModel: string;
    isModelDisabled: (modelId: string, provider: string) => boolean;
    t: (key: string) => string;
}

export function useModelCategories({
    groupedModels,
    debouncedSearchQuery,
    settings,
    selectedModel,
    isModelDisabled,
    t
}: UseModelCategoriesProps) {
    return useMemo(() => {
        if (!groupedModels) { return []; }

        const cats: ModelCategory[] = createBaseCategories(t);
        const searchLower = debouncedSearchQuery.toLowerCase();
        const favorites = new Set(settings?.general.favoriteModels ?? []);
        const hidden = new Set<string>(settings?.general.hiddenModels ?? []);

        populateCategories({
            cats,
            groupedModels,
            searchLower,
            favorites,
            hidden,
            selectedModel,
            isModelDisabled
        });

        return finalizeCategories(cats);
    }, [groupedModels, debouncedSearchQuery, settings, selectedModel, t, isModelDisabled]);
}

function createBaseCategories(t: (k: string) => string): ModelCategory[] {
    return [
        { id: 'favorites', name: t('common.favorites'), icon: Zap, color: 'text-yellow', bg: 'bg-yellow/10', providerId: 'favorites', models: [] },
        { id: 'copilot', name: t('providerLabels.githubCopilot'), icon: Zap, color: 'text-indigo', bg: 'bg-indigo/10', providerId: 'copilot', models: [] },
        { id: 'openai', name: t('providerLabels.openai'), icon: Sparkles, color: 'text-success', bg: 'bg-success/10', providerId: 'openai', models: [] },
        { id: 'claude', name: t('providerLabels.anthropic'), icon: BrainCircuit, color: 'text-purple', bg: 'bg-pink/10', providerId: 'anthropic', models: [] },
        { id: 'antigravity', name: t('providerLabels.antigravity'), icon: LayoutGrid, color: 'text-pink', bg: 'bg-pink/10', providerId: 'antigravity', models: [] },
        { id: 'opencode', name: t('modelSelector.openCode'), icon: Code2, color: 'text-cyan', bg: 'bg-cyan/10', providerId: 'opencode', models: [] },
        { id: 'ollama', name: t('providerLabels.ollama'), icon: Server, color: 'text-orange', bg: 'bg-orange/10', providerId: 'ollama', models: [] },
        { id: 'custom', name: t('modelSelector.proxyCustom'), icon: Box, color: 'text-muted-foreground', bg: 'bg-muted/10', providerId: 'openai', models: [] }
    ];
}

interface PopulateProps {
    cats: ModelCategory[],
    groupedModels: GroupedModels,
    searchLower: string,
    favorites: Set<string>,
    hidden: Set<string>,
    selectedModel: string,
    isModelDisabled: (modelId: string, provider: string) => boolean
}

function populateCategories(props: PopulateProps) {
    const { cats, groupedModels, searchLower, favorites, hidden, selectedModel, isModelDisabled } = props;
    const brandsMapping: Record<string, string> = {
        ollama: 'ollama',
        copilot: 'copilot',
        openai: 'openai',
        anthropic: 'claude',
        antigravity: 'antigravity',
        opencode: 'opencode',
        custom: 'custom'
    };

    const favCat = cats.find(c => c.id === 'favorites');

    for (const [key, catId] of Object.entries(brandsMapping)) {
        const group = groupedModels[key];
        if (!group?.models) { continue; }
        const cat = cats.find(c => c.id === catId);
        if (!cat) { continue; }

        for (const m of group.models) {
            const modelItem = mapModelToItem(m, { searchLower, favorites, hidden, selectedModel, isModelDisabled });
            if (!modelItem) { continue; }

            cat.models.push(modelItem);
            if (modelItem.pinned && favCat) {
                favCat.models.push({ ...modelItem });
            }
        }
    }
}

function mapModelToItem(
    m: ModelInfo,
    ctx: { searchLower: string, favorites: Set<string>, hidden: Set<string>, selectedModel: string, isModelDisabled: (id: string, p: string) => boolean }
): ModelListItem | null {
    const id = m.id ?? '';
    const label = m.label ?? m.name ?? id;
    const matchesSearch = ctx.searchLower === '' || label.toLowerCase().includes(ctx.searchLower) || id.toLowerCase().includes(ctx.searchLower);

    if (!matchesSearch || (ctx.hidden.has(id) && id !== ctx.selectedModel)) { return null; }

    let displayLabel = label.replace(/^(github-|copilot-|ollama-|claude-|anthropic-)/i, '');
    if (displayLabel.startsWith('gpt-')) { displayLabel = displayLabel.toUpperCase(); }

    const modelType = typeof m.type === 'string' ? m.type : 'text';
    const modelPricing = m.pricing && typeof m.pricing === 'object' && !Array.isArray(m.pricing)
        ? { input: typeof m.pricing.input === 'number' ? m.pricing.input : undefined, output: typeof m.pricing.output === 'number' ? m.pricing.output : undefined }
        : undefined;

    return {
        id,
        label: displayLabel,
        disabled: ctx.isModelDisabled(id, m.provider ?? ''),
        provider: m.provider ?? '',
        type: modelType,
        contextWindow: m.contextWindow,
        pricing: modelPricing,
        pinned: ctx.favorites.has(id)
    };
}

function finalizeCategories(cats: ModelCategory[]): ModelCategory[] {
    for (const cat of cats) {
        cat.models.sort((a, b) => a.label.localeCompare(b.label));
    }
    return cats.filter(cat => cat.models.length > 0);
}
