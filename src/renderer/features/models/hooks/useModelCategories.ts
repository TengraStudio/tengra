/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconBolt,IconBox, IconBrain, IconCode, IconKey, IconLayoutGrid, IconServer, IconSparkles } from '@tabler/icons-react';
import { useMemo } from 'react';

import type { GroupedModels, ModelInfo } from '@/types';
import { AppSettings } from '@/types';

import { ModelCategory, ModelListItem } from '../types';
import { getSelectableProviderId } from '../utils/model-fetcher';
import { getModelLifecycleMeta } from '../utils/model-selector-metadata';

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
        { id: 'favorites', name: t('common.favorites'), icon: IconBolt, color: 'text-warning', bg: 'bg-warning/10', providerId: 'favorites', models: [] },
        { id: 'copilot', name: t('frontend.providerLabels.githubCopilot'), icon: IconBolt, color: 'text-info', bg: 'bg-info/10', providerId: 'copilot', models: [] },
        { id: 'openai', name: t('frontend.providerLabels.openai'), icon: IconSparkles, color: 'text-success', bg: 'bg-success/10', providerId: 'openai', models: [] },
        { id: 'claude', name: t('frontend.providerLabels.anthropic'), icon: IconBrain, color: 'text-accent', bg: 'bg-accent/10', providerId: 'anthropic', models: [] },
        { id: 'antigravity', name: t('frontend.providerLabels.antigravity'), icon: IconLayoutGrid, color: 'text-accent', bg: 'bg-accent/10', providerId: 'antigravity', models: [] },
        { id: 'codex', name: 'Codex', icon: IconCode, color: 'text-info', bg: 'bg-info/10', providerId: 'codex', models: [] },
        { id: 'cursor', name: 'Cursor', icon: IconSparkles, color: 'text-info', bg: 'bg-info/10', providerId: 'cursor', models: [] },
        { id: 'opencode', name: t('frontend.modelSelector.openCode'), icon: IconCode, color: 'text-info', bg: 'bg-info/10', providerId: 'opencode', models: [] },
        { id: 'mistral', name: 'Mistral', icon: IconSparkles, color: 'text-primary', bg: 'bg-primary/10', providerId: 'mistral', models: [] },
        { id: 'groq', name: 'Groq', icon: IconBolt, color: 'text-warning', bg: 'bg-warning/10', providerId: 'groq', models: [] },
        { id: 'xai', name: 'xAI (Grok)', icon: IconSparkles, color: 'text-foreground', bg: 'bg-foreground/10', providerId: 'xai', models: [] },
        { id: 'deepseek', name: 'DeepSeek', icon: IconBolt, color: 'text-primary', bg: 'bg-primary/10', providerId: 'deepseek', models: [] },
        { id: 'openrouter', name: 'OpenRouter', icon: IconKey, color: 'text-info', bg: 'bg-info/10', providerId: 'openrouter', models: [] },
        { id: 'ollama', name: t('frontend.providerLabels.ollama'), icon: IconServer, color: 'text-warning', bg: 'bg-warning/10', providerId: 'ollama', models: [] },
        { id: 'huggingface', name: t('frontend.marketplace.tabs.huggingface'), icon: IconBox, color: 'text-info', bg: 'bg-info/10', providerId: 'huggingface', models: [] },
        { id: 'nvidia', name: 'NVIDIA', icon: IconBolt, color: 'text-success', bg: 'bg-success/10', providerId: 'nvidia', models: [] },
        { id: 'custom', name: t('frontend.modelSelector.proxyCustom'), icon: IconBox, color: 'text-muted-foreground', bg: 'bg-muted/10', providerId: 'openai', models: [] }
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
        codex: 'codex',
        anthropic: 'claude',
        claude: 'claude',
        antigravity: 'antigravity',
        opencode: 'opencode',
        nvidia: 'nvidia',
        'nvidia-key': 'nvidia',
        'nvidia_key': 'nvidia',
        'nvidia-nim': 'nvidia',
        'nvidia_nim': 'nvidia',
        'nvidia_openai': 'nvidia',
        nvapi: 'nvidia',
        nim: 'nvidia',
        tensorrt: 'nvidia',
        local: 'ollama',
        'local-ai': 'ollama',
        'lm_studio': 'ollama',
        huggingface: 'huggingface',
        google: 'antigravity',
        gemini: 'antigravity',
        kimi: 'opencode',
        moonshot: 'opencode',
        mistral: 'mistral',
        groq: 'groq',
        xai: 'xai',
        grok: 'xai',
        deepseek: 'deepseek',
        openrouter: 'openrouter',
        cursor: 'cursor',
        'sd-cpp': 'custom',
        custom: 'custom'
    };

    const favCat = cats.find(c => c.id === 'favorites');

    for (const [key, group] of Object.entries(groupedModels)) {
        const catId = brandsMapping[key] ?? 'custom';
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
    const p = pricing as { input?: number; output?: number };
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
    const provider = getSelectableProviderId(m);
    if (shouldHideModel(id, m.label ?? m.name, provider)) { return null; }
    if (!matchesSearch(m, ctx.searchLower)) { return null; }
    if (ctx.hidden.has(id) && id !== ctx.selectedModel) { return null; }

    // Extract thinking levels from model data (Rust service sends as camelCase: thinkingLevels)
    const thinkingLevels = Array.isArray(m.thinkingLevels) ? m.thinkingLevels as string[] : undefined;
    const description = typeof m.description === 'string' ? m.description : undefined;

    const disabled = ctx.isModelDisabled(id, provider);
    const isLocalProvider = provider === 'ollama' || provider === 'local' || provider === 'lm_studio' || provider === 'huggingface';
    const pricing = extractPricing(m.pricing);
    const hasPricing = !!(pricing?.input || pricing?.output);
    const isFree = !hasPricing && ((typeof m.label === 'string' && m.label.toLowerCase().includes('free')) ||
        (typeof m.name === 'string' && m.name.toLowerCase().includes('free')) ||
        (!pricing?.input && !pricing?.output));
    const lifecycleMeta = getModelLifecycleMeta(m);

    // Robust reasoning detection for ALL providers (Claude, GPT-4, o1, Gemini models)
    let finalThinkingLevels = thinkingLevels;
    let finalSupportsReasoning = Array.isArray(thinkingLevels) && thinkingLevels.length > 0;

    if (!finalSupportsReasoning) {
        const lowerLabel = (m.label ?? m.name ?? id).toLowerCase();
        // Detect Claude models (Anthropic, Antigravity, Copilot, etc.)
        const isClaude = lowerLabel.includes('claude');
        // Detect GPT-4 and reasoning models
        const isReasoningModel = lowerLabel.includes('gpt-4o') || lowerLabel.includes('o1-') || lowerLabel.includes('gpt-4-turbo') || lowerLabel.includes('o3-') || lowerLabel.includes('reasoning');
        // Detect high-end Gemini models
        const isHighEndGemini = lowerLabel.includes('gemini-1.5-pro') || lowerLabel.includes('gemini-2.0-pro') || lowerLabel.includes('gemini-3');
        // Detect open source high-end models
        const isOpenSourceHighEnd = lowerLabel.includes('llama-3') || lowerLabel.includes('mistral-large') || lowerLabel.includes('mixtral-8x22b') || lowerLabel.includes('deepseek-v3') || lowerLabel.includes('deepseek-r1');

        if (isClaude || isReasoningModel || isHighEndGemini || isOpenSourceHighEnd) {
            finalThinkingLevels = ['low', 'high', 'max'];
            finalSupportsReasoning = true;
        }
    }

    return {
        id,
        label: formatDisplayLabel(m),
        disabled,
        disabledReason: disabled ? 'Usage limit reached' : undefined,
        provider,
        type: typeof m.type === 'string' ? m.type : 'text',
        contextWindow: m.contextWindow,
        pricing,
        pinned: ctx.favorites.has(id),
        thinkingLevels: finalThinkingLevels,
        description,
        isLocal: isLocalProvider,
        isFree,
        supportsReasoning: finalSupportsReasoning,
        lifecycle: lifecycleMeta.lifecycle,
        replacementModelId: lifecycleMeta.replacementModelId,
        sunsetDate: lifecycleMeta.sunsetDate,
        quotaInfo: m.quotaInfo,
        percentage: typeof m.percentage === 'number' ? m.percentage : undefined,
        reset: typeof m.reset === 'string' ? m.reset : undefined,
        creditMultiplier: typeof m.creditMultiplier === 'number' ? m.creditMultiplier : undefined,
    };
}

function finalizeCategories(cats: ModelCategory[]): ModelCategory[] {
    for (const cat of cats) {
        if (cat.id === 'antigravity') {
            cat.models = dedupeAntigravityModels(cat.models);
        }
        cat.models.sort((a, b) => a.label.localeCompare(b.label));
    }
    return cats.filter(cat => {
        // Always keep these categories even if empty, so the user can see them in the selector
        // and potentially add accounts or see empty state.
        if (['ollama', 'local', 'lm_studio', 'custom', 'opencode'].includes(cat.id)) {
            return true;
        }
        // Only show other categories if they actually have models from the API
        return cat.models.length > 0;
    });
}

function shouldHideModel(modelId: string, label: string | undefined, provider: string): boolean {
    if (provider !== 'antigravity') {
        return false;
    }
    const normalizedId = modelId.toLowerCase();
    const normalizedLabel = (label ?? '').toLowerCase();
    const isImageModel = normalizedId.includes('image') || normalizedLabel.includes(' image');
    if (isImageModel) {
        return normalizedId.includes('tab_jump_flash_lite_preview');
    }

    return normalizedId.includes('gemini-3-pro')
        || normalizedLabel.includes('gemini 3 pro')
        || normalizedId.includes('tab_jump_flash_lite_preview');
}

function dedupeAntigravityModels(models: ModelListItem[]): ModelListItem[] {
    const deduped = new Map<string, ModelListItem>();

    for (const model of models) {
        const key = normalizeAntigravityLabel(model.label);
        const existing = deduped.get(key);
        if (!existing || shouldReplaceAntigravityModel(existing, model)) {
            deduped.set(key, model);
        }
    }

    return Array.from(deduped.values());
}

function normalizeAntigravityLabel(label: string): string {
    return label
        .toLowerCase()
        .replace(/\s*\(antigravity\)\s*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeAntigravityId(modelId: string): string {
    return modelId.toLowerCase().replace(/-antigravity$/, '');
}

function shouldReplaceAntigravityModel(existing: ModelListItem, candidate: ModelListItem): boolean {
    const existingPercent = getAntigravityPercent(existing);
    const candidatePercent = getAntigravityPercent(candidate);
    if (candidatePercent !== existingPercent) {
        return candidatePercent > existingPercent;
    }

    const existingIsPrimary = !existing.id.toLowerCase().endsWith('-antigravity');
    const candidateIsPrimary = !candidate.id.toLowerCase().endsWith('-antigravity');
    if (candidateIsPrimary !== existingIsPrimary) {
        return candidateIsPrimary;
    }

    const existingId = normalizeAntigravityId(existing.id);
    const candidateId = normalizeAntigravityId(candidate.id);
    return candidateId.localeCompare(existingId) < 0;
}

function getAntigravityPercent(model: ModelListItem): number {
    const fraction = model.quotaInfo?.remainingFraction;
    if (typeof fraction === 'number' && Number.isFinite(fraction)) {
        return Math.round(Math.max(0, Math.min(1, fraction)) * 100);
    }
    if (typeof model.percentage === 'number' && Number.isFinite(model.percentage)) {
        return Math.round(Math.max(0, Math.min(100, model.percentage)));
    }
    return 0;
}

