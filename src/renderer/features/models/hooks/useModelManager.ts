import { fetchModels, groupModels } from '@renderer/features/models/utils/model-fetcher';
import type { GroupedModels, ModelInfo } from '@/types';
import { getModelLifecycleMeta } from '@renderer/features/models/utils/model-selector-metadata';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { pushNotification } from '@/store/notification-center.store';
import { AppSettings } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

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

function pickLocalePreferredModel(models: ModelInfo[], locale: string): { provider: string; model: string } | null {
    const hints = LOCALE_MODEL_HINTS[locale] ?? [];
    for (const hint of hints) {
        const preferred = models.find(model => {
            const id = model.id?.toLowerCase() ?? '';
            return id.includes(hint);
        });
        if (preferred?.id && preferred.provider) {
            return { provider: preferred.provider, model: preferred.id };
        }
    }

    const firstValidModel = models.find(model => model.id && model.provider);
    return firstValidModel?.id && firstValidModel.provider
        ? { provider: firstValidModel.provider, model: firstValidModel.id }
        : null;
}

function hasCredential(value: string | undefined): boolean {
    return typeof value === 'string' && value.trim() !== '' && value !== 'connected';
}

function isProviderConfigured(provider: string, settings: AppSettings | null): boolean {
    const normalized = provider.toLowerCase();
    if (normalized === 'nvidia') { return hasCredential(settings?.nvidia?.apiKey); }
    if (normalized === 'openai') { return hasCredential(settings?.openai?.apiKey); }
    if (normalized === 'codex') { return settings?.codex?.connected === true || hasCredential(settings?.openai?.apiKey); }
    if (normalized === 'copilot' || normalized === 'github') { return settings?.copilot?.connected === true; }
    if (normalized === 'anthropic' || normalized === 'claude') { return hasCredential(settings?.anthropic?.apiKey) || hasCredential(settings?.claude?.apiKey); }
    if (normalized === 'antigravity') { return settings?.antigravity?.connected === true; }
    return true;
}

export function useModelManager(
    appSettings: AppSettings | null,
    setAppSettings: (settings: AppSettings) => void
) {
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [groupedModels, setGroupedModels] = useState<GroupedModels | null>(null);
    const [proxyModels, setProxyModels] = useState<ModelInfo[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const lifecycleNoticeRef = useRef<Set<string>>(new Set());

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

        if (hasNvidia || hasOpenAI || hasAnthropic || hasGroq) {
            void refreshModels(true);
        }
    }, [
        refreshModels,
        appSettings?.nvidia?.apiKey,
        appSettings?.openai?.apiKey,
        appSettings?.anthropic?.apiKey,
        appSettings?.groq?.apiKey
    ]);

    useEffect(() => {
        const defaultModel = appSettings?.general.defaultModel;
        const locale = appSettings?.general.language ?? 'en';
        const availableModels = models.filter(m => {
            const provider = m.provider ?? '';
            return provider !== '' && isProviderConfigured(provider, appSettings);
        });

        const resolveFallback = (): { provider: string; model: string } | null => {
            const preferred = pickLocalePreferredModel(availableModels, locale);
            if (preferred) {
                return preferred;
            }
            const first = availableModels[0];
            if (!first?.id || !first.provider) {
                return null;
            }
            return { provider: first.provider, model: first.id };
        };

        const persistedProvider = appSettings?.general.lastProvider ?? '';
        const persistedPairExists = availableModels.some(m =>
            m.id === defaultModel && m.provider === persistedProvider
        );
        const selectedMeta = availableModels.find(m => m.id === defaultModel && m.provider === persistedProvider);
        const lifecycleMeta = selectedMeta ? getModelLifecycleMeta(selectedMeta) : { lifecycle: 'active' as const };

        if (defaultModel && persistedProvider && !persistedPairExists) {
            const fallback = resolveFallback();
            if (!fallback) {
                return;
            }
            setSelectedModel(fallback.model);
            setSelectedProvider(fallback.provider);
            setSelectedModels([fallback]);
            if (appSettings) {
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
                title: 'Default model switched',
                message: `Previous default model is unavailable. Switched to ${fallback.model}.`,
                source: 'models',
            });
            return;
        }

        if (defaultModel && persistedProvider && persistedPairExists && lifecycleMeta.lifecycle === 'retired') {
            const replacementId = lifecycleMeta.replacementModelId;
            const replacement = replacementId
                ? availableModels.find(m => m.id?.toLowerCase() === replacementId.toLowerCase())
                : null;
            const fallback = replacement?.id && replacement.provider
                ? { provider: replacement.provider, model: replacement.id }
                : resolveFallback();
            if (!fallback) {
                return;
            }
            setSelectedModel(fallback.model);
            setSelectedProvider(fallback.provider);
            setSelectedModels([fallback]);
            if (appSettings) {
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
                title: 'Retired model migrated',
                message: `Default model ${defaultModel} is retired. Switched to ${fallback.model}.`,
                source: 'models',
            });
            return;
        }

        if (defaultModel && persistedProvider && persistedPairExists && lifecycleMeta.lifecycle === 'deprecated') {
            const key = `${persistedProvider}:${defaultModel}:deprecated`;
            if (lifecycleNoticeRef.current.has(key)) {
                return;
            }
            lifecycleNoticeRef.current.add(key);
            pushNotification({
                type: 'info',
                title: 'Deprecated default model',
                message: lifecycleMeta.replacementModelId
                    ? `${defaultModel} is deprecated. Recommended replacement: ${lifecycleMeta.replacementModelId}.`
                    : `${defaultModel} is deprecated. Consider selecting a newer model.`,
                source: 'models',
            });
        }

        if (!defaultModel) {
            if (selectedModels.length > 0 || selectedModel !== '' || availableModels.length === 0) {
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

        const lastProvider = persistedProvider;
        if (selectedModel !== defaultModel) {
            setSelectedModel(defaultModel);
        }
        if (selectedProvider !== lastProvider) {
            setSelectedProvider(lastProvider);
        }
        if (selectedModels.length === 0) {
            setSelectedModels([
                {
                    provider: lastProvider,
                    model: defaultModel
                }
            ]);
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
        selectedModels.length,
        setSelectedModel,
        setSelectedProvider,
        setSelectedModels,
        setAppSettings
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

