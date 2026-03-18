import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/i18n';
import { pushNotification } from '@/store/notification-center.store';
import type { GroupedModels, ModelInfo } from '@/types';
import { AppSettings } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import { fetchModels, getSelectableProviderId, groupModels } from '../utils/model-fetcher';

import { useModelSelection } from './useModelSelection';

const LOCALE_MODEL_HINTS: Record<string, string[]> = {
    tr: ['gpt-4o', 'claude', 'qwen'],
    ar: ['gpt-4o', 'claude', 'qwen'],
    de: ['gpt-4o', 'claude', 'llama'],
    es: ['gpt-4o', 'claude', 'llama'],
    fr: ['gpt-4o', 'claude', 'llama'],
    ja: ['gpt-4o', 'claude', 'qwen'],
    zh: ['qwen', 'deepseek', 'glm', 'gpt-4o'],
};

function normalizeSelectionProvider(provider: string | undefined): string {
    const raw = (provider ?? '').trim().toLowerCase();
    if (raw === 'github') {
        return 'copilot';
    }
    if (raw === 'anthropic') {
        return 'claude';
    }
    return raw;
}

function pickLocalePreferredModel(models: ModelInfo[], locale: string): { provider: string; model: string } | null {
    const hints = LOCALE_MODEL_HINTS[locale] ?? [];
    for (const hint of hints) {
        const preferred = models.find(model => {
            const id = model.id?.toLowerCase() ?? '';
            return id.includes(hint);
        });
        if (preferred?.id) {
            return { provider: getSelectableProviderId(preferred), model: preferred.id };
        }
    }

    const firstValidModel = models.find(model => model.id && getSelectableProviderId(model) !== '');
    return firstValidModel?.id
        ? { provider: getSelectableProviderId(firstValidModel), model: firstValidModel.id }
        : null;
}

function areSelectionsEqual(
    currentSelection: Array<{ provider: string; model: string }>,
    nextSelection: Array<{ provider: string; model: string }>
): boolean {
    if (currentSelection.length !== nextSelection.length) {
        return false;
    }

    return currentSelection.every((selection, index) => {
        const nextItem = nextSelection[index];
        return nextItem?.provider === selection.provider && nextItem.model === selection.model;
    });
}

export function useModelManager(
    appSettings: AppSettings | null,
    setAppSettings: (settings: AppSettings) => void
) {
    const { t } = useTranslation();
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [groupedModels, setGroupedModels] = useState<GroupedModels | null>(null);
    const [proxyModels, setProxyModels] = useState<ModelInfo[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    // const lifecycleNoticeRef = useRef<Set<string>>(new Set());

    const selection = useModelSelection(appSettings, setAppSettings);
    const {
        selectedModel,
        selectedProvider,
        selectedModels,
        setSelectedModel,
        setSelectedProvider,
        setSelectedModels
    } = selection;

    const refreshModels = useCallback(async (bypassCache = false) => {
        setIsLoading(true);
        try {
            const fetched = await fetchModels(bypassCache);
            setModels(fetched);
            setProxyModels(fetched.filter(m => m.provider !== 'ollama' && m.provider !== 'local-ai'));
            setGroupedModels(groupModels(fetched));
        } catch (error) {
            appLogger.error('ModelManager', 'Failed to refresh models', error as Error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void refreshModels();
    }, [refreshModels]);

    useEffect(() => {
        const hasNvidia = !!appSettings?.nvidia?.apiKey;
        const hasOpenAI = !!appSettings?.openai?.apiKey;
        const hasAnthropic = !!appSettings?.anthropic?.apiKey;
        const hasGroq = !!appSettings?.groq?.apiKey;
        const hasAntigravity = appSettings?.antigravity?.connected === true;
        const hasCodex = appSettings?.codex?.connected === true;
        const hasCopilot = appSettings?.copilot?.connected === true;

        if (hasNvidia || hasOpenAI || hasAnthropic || hasGroq || hasAntigravity || hasCodex || hasCopilot) {
            void refreshModels(true);
        }
    }, [
        refreshModels,
        appSettings?.nvidia?.apiKey,
        appSettings?.openai?.apiKey,
        appSettings?.anthropic?.apiKey,
        appSettings?.groq?.apiKey,
        appSettings?.antigravity?.connected,
        appSettings?.codex?.connected,
        appSettings?.copilot?.connected
    ]);

    useEffect(() => {
        const defaultModel = appSettings?.general.defaultModel;
        const locale = appSettings?.general.language ?? 'en';
        const availableModels = models.filter(m => getSelectableProviderId(m) !== '');

        const resolveFallback = (): { provider: string; model: string } | null => {
            const preferred = pickLocalePreferredModel(availableModels, locale);
            if (preferred) {
                return preferred;
            }
            const first = availableModels[0];
            if (!first?.id) {
                return null;
            }
            return { provider: getSelectableProviderId(first), model: first.id };
        };

        const persistedProvider = normalizeSelectionProvider(appSettings?.general.lastProvider);
        const persistedPairExists = availableModels.some(m =>
            m.id?.toLowerCase() === defaultModel?.toLowerCase() && getSelectableProviderId(m) === persistedProvider
        );
        const syncedSelection = defaultModel && persistedProvider
            ? [{ provider: persistedProvider, model: defaultModel }]
            : [];
        const isSelectionSynced =
            selectedModel === defaultModel &&
            selectedProvider === persistedProvider &&
            areSelectionsEqual(selectedModels, syncedSelection);

        if (defaultModel && persistedProvider && !persistedPairExists) {
            const fallback = resolveFallback();
            if (!fallback) {
                return;
            }
            if (
                selectedModel !== fallback.model ||
                selectedProvider !== fallback.provider ||
                !areSelectionsEqual(selectedModels, [fallback])
            ) {
                setSelectedModel(fallback.model);
                setSelectedProvider(fallback.provider);
                setSelectedModels([fallback]);
            }
            if (
                appSettings &&
                (
                    appSettings.general.defaultModel !== fallback.model ||
                    appSettings.general.lastProvider !== fallback.provider
                )
            ) {
                setAppSettings({
                    ...appSettings,
                    general: {
                        ...appSettings.general,
                        defaultModel: fallback.model,
                        lastProvider: fallback.provider
                    }
                });
            }
            pushNotification({
                type: 'warning',
                title: t('modelsPage.defaultModelSwitchedTitle'),
                message: t('modelsPage.defaultModelSwitchedMessage', { model: fallback.model }),
                source: 'models',
            });
            return;
        }

        if (defaultModel && persistedProvider && persistedPairExists) {
            if (appSettings?.general.lastProvider !== persistedProvider) {
                setAppSettings({
                    ...appSettings,
                    general: {
                        ...appSettings.general,
                        lastProvider: persistedProvider
                    }
                });
            }
            if (isSelectionSynced) {
                return;
            }

            setSelectedModel(defaultModel);
            setSelectedProvider(persistedProvider);
            setSelectedModels(syncedSelection);
            return;
        }

        if (!defaultModel && availableModels.length > 0) {
            // Only resolve fallback if NO model is selected whatsoever
            if (selectedModel !== '' || selectedModels.length > 0) {
                return;
            }

            const preferred = pickLocalePreferredModel(availableModels, locale);
            if (!preferred) {
                return;
            }
            setSelectedModel(preferred.model);
            setSelectedProvider(preferred.provider);
            setSelectedModels([preferred]);
            return;
        }
    }, [
        appSettings,
        appSettings?.general.defaultModel,
        appSettings?.general.lastProvider,
        appSettings?.general.language,
        appSettings?.codex?.connected,
        appSettings?.copilot?.connected,
        appSettings?.antigravity?.connected,
        appSettings?.openai?.apiKey,
        appSettings?.anthropic?.apiKey,
        appSettings?.claude?.apiKey,
        appSettings?.nvidia?.apiKey,
        models,
        selectedModel,
        selectedProvider,
        selectedModels,
        setSelectedModel,
        setSelectedProvider,
        setSelectedModels,
        setAppSettings,
        t
    ]);

    const persistLastSelection = useCallback((provider: string, model: string) => {
        if (!appSettings) { return; }
        setAppSettings({
            ...appSettings,
            general: {
                ...appSettings.general,
                defaultModel: model,
                lastProvider: provider
            }
        });
    }, [appSettings, setAppSettings]);

    const toggleFavorite = useCallback((modelId: string) => {
        if (!appSettings) { return; }
        const currentFavorites = appSettings.general.favoriteModels ?? [];
        const isFav = currentFavorites.includes(modelId);
        const newFavorites = isFav
            ? currentFavorites.filter(id => id !== modelId)
            : [...currentFavorites, modelId];

        setAppSettings({
            ...appSettings,
            general: { ...appSettings.general, favoriteModels: newFavorites }
        });
    }, [appSettings, setAppSettings]);

    const isFavorite = useCallback((modelId: string) => {
        return appSettings?.general.favoriteModels?.includes(modelId) ?? false;
    }, [appSettings]);

    const getModelReasoningLevel = useCallback((modelId: string) => {
        return appSettings?.modelSettings?.[modelId]?.reasoningLevel;
    }, [appSettings]);

    const setModelReasoningLevel = useCallback((modelId: string, reasoningLevel: string) => {
        if (!appSettings) { return; }
        const modelSettings = { ...(appSettings.modelSettings ?? {}) };
        const current = modelSettings[modelId] ?? {};
        modelSettings[modelId] = { ...current, reasoningLevel };

        setAppSettings({
            ...appSettings,
            modelSettings
        });
    }, [appSettings, setAppSettings]);

    useEffect(() => {
        if (!appSettings) {
            return;
        }
        const activeModelId = selectedModel || appSettings.general.defaultModel;
        const activeProvider = selectedProvider || appSettings.general.lastProvider;
        if (!activeModelId || !activeProvider) {
            return;
        }

        const activeModelInfo = models.find(model =>
            model.id === activeModelId && getSelectableProviderId(model) === activeProvider
        );
        const thinkingLevels = activeModelInfo?.thinkingLevels;
        if (!Array.isArray(thinkingLevels) || thinkingLevels.length === 0) {
            return;
        }

        const currentReasoningLevel = appSettings.modelSettings?.[activeModelId]?.reasoningLevel;
        if (currentReasoningLevel && thinkingLevels.includes(currentReasoningLevel)) {
            return;
        }

        const defaultReasoningLevel = thinkingLevels.includes('low')
            ? 'low'
            : thinkingLevels[0];
        if (!defaultReasoningLevel) {
            return;
        }

        setModelReasoningLevel(activeModelId, defaultReasoningLevel);
    }, [
        appSettings,
        models,
        selectedModel,
        selectedProvider,
        setModelReasoningLevel
    ]);

    return useMemo(() => ({
        models,
        groupedModels,
        ...selection,
        proxyModels,
        isLoading,
        refreshModels,
        loadModels: refreshModels,
        persistLastSelection,
        toggleFavorite,
        isFavorite,
        getModelReasoningLevel,
        setModelReasoningLevel
    }), [
        models, groupedModels, selection, proxyModels, isLoading, refreshModels,
        persistLastSelection, toggleFavorite, isFavorite, getModelReasoningLevel, setModelReasoningLevel
    ]);
}

