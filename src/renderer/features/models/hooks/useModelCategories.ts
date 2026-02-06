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
        { id: 'favorites', name: t('common.favorites'), icon: Zap, color: 'text-warning', bg: 'bg-yellow/10', providerId: 'favorites', models: [] },
        { id: 'copilot', name: t('providerLabels.githubCopilot'), icon: Zap, color: 'text-indigo', bg: 'bg-indigo/10', providerId: 'copilot', models: [] },
        { id: 'openai', name: t('providerLabels.openai'), icon: Sparkles, color: 'text-success', bg: 'bg-success/10', providerId: 'openai', models: [] },
        { id: 'claude', name: t('providerLabels.anthropic'), icon: BrainCircuit, color: 'text-purple', bg: 'bg-pink/10', providerId: 'anthropic', models: [] },
        { id: 'antigravity', name: t('providerLabels.antigravity'), icon: LayoutGrid, color: 'text-pink', bg: 'bg-pink/10', providerId: 'antigravity', models: [] },
        { id: 'opencode', name: t('modelSelector.openCode'), icon: Code2, color: 'text-cyan', bg: 'bg-cyan/10', providerId: 'opencode', models: [] },
        { id: 'ollama', name: t('providerLabels.ollama'), icon: Server, color: 'text-orange', bg: 'bg-warning/10', providerId: 'ollama', models: [] },
        { id: 'nvidia', name: 'NVIDIA', icon: Zap, color: 'text-green', bg: 'bg-green/10', providerId: 'nvidia', models: [] },
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
        github: 'copilot',
        openai: 'openai',
        codex: 'openai',
        anthropic: 'claude',
        antigravity: 'antigravity',
        opencode: 'opencode',
        nvidia: 'nvidia',
        custom: 'custom'
    };

    const favCat = cats.find(c => c.id === 'favorites');

    for (const [key, catId] of Object.entries(brandsMapping)) {
        if (!(key in groupedModels)) { continue; }
        const group = groupedModels[key];
        const cat = cats.find(c => c.id === catId);
        if (!cat) { continue; }

        for (const m of group.models) {
            const modelItem = mapModelToItem(m, { searchLower, favorites, hidden, selectedModel, isModelDisabled });
            if (modelItem === null) { continue; }

            cat.models.push(modelItem);
            if (modelItem.pinned && favCat !== undefined) {
                favCat.models.push({ ...modelItem });
            }
        }
    }
}

function matchesSearch(m: ModelInfo, searchLower: string): boolean {
    const id = m.id ?? '';
    const label = m.label ?? m.name ?? id;
    return searchLower === '' || label.toLowerCase().includes(searchLower) || id.toLowerCase().includes(searchLower);
}

function formatDisplayLabel(m: ModelInfo): string {
    const id = m.id ?? '';
    const label = m.label ?? m.name ?? id;
    let displayLabel = label.replace(/^(github-|copilot-|ollama-|claude-|anthropic-)/i, '');
    if (displayLabel.startsWith('gpt-')) { displayLabel = displayLabel.toUpperCase(); }
    return displayLabel;
}

function extractPricing(pricing: ModelInfo['pricing']): { input?: number; output?: number } | undefined {
    if (!pricing || typeof pricing !== 'object' || Array.isArray(pricing)) { return undefined; }
    const p = pricing as { input?: unknown; output?: unknown };
    return {
        input: typeof p.input === 'number' ? p.input : undefined,
        output: typeof p.output === 'number' ? p.output : undefined
    };
}

function mapModelToItem(
    m: ModelInfo,
    ctx: { searchLower: string, favorites: Set<string>, hidden: Set<string>, selectedModel: string, isModelDisabled: (id: string, p: string) => boolean }
): ModelListItem | null {
    const id = m.id ?? '';
    if (!matchesSearch(m, ctx.searchLower)) { return null; }
    if (ctx.hidden.has(id) && id !== ctx.selectedModel) { return null; }

    // Extract thinking levels from model data
    const thinkingLevels = Array.isArray(m.thinking_levels) ? m.thinking_levels as string[] : undefined;
    const description = typeof m.description === 'string' ? m.description : undefined;

    return {
        id,
        label: formatDisplayLabel(m),
        disabled: ctx.isModelDisabled(id, m.provider ?? ''),
        provider: m.provider ?? '',
        type: typeof m.type === 'string' ? m.type : 'text',
        contextWindow: m.contextWindow,
        pricing: extractPricing(m.pricing),
        pinned: ctx.favorites.has(id),
        thinkingLevels,
        description
    };
}

function finalizeCategories(cats: ModelCategory[]): ModelCategory[] {
    for (const cat of cats) {
        cat.models.sort((a, b) => a.label.localeCompare(b.label));
    }
    return cats.filter(cat => cat.models.length > 0);
}
