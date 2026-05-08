/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { fetchLinkedAccountsSnapshot } from '@/features/settings/hooks/useLinkedAccounts';
import { useTranslation } from '@/i18n';
import { pushNotification } from '@/store/notification-center.store';
import { getSettingsSnapshot } from '@/store/settings.store';
import type { GroupedModels, ModelInfo } from '@/types';
import { AppSettings } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import { fetchModels, getSelectableProviderId, groupModels } from '../utils/model-fetcher';

import { useModelSelection } from './useModelSelection';

const LOCALE_MODEL_HINTS: Record<string, string[]> = {
    en: ['gpt-4o', 'claude', 'llama'],
    tr: ['gpt-4o', 'claude', 'qwen'],
};

const MODEL_REFRESH_RETRY_DELAY_MS = 3500;
const MIN_HEALTHY_NVIDIA_MODEL_COUNT = 2;

function normalizeLinkedProvider(provider: string): string {
    const normalized = provider.trim().toLowerCase();
    if (normalized === 'openai') {
        return 'codex';
    }
    if (normalized === 'anthropic') {
        return 'claude';
    }
    if (normalized === 'github' || normalized === 'copilot_token') {
        return 'copilot';
    }
    if (normalized === 'google' || normalized === 'gemini') {
        return 'antigravity';
    }
    return normalized;
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
        return false;
    }
    return left.every((item, index) => right[index] === item);
}

function hasRemoteModels(models: ModelInfo[]): boolean {
    return models.some(model => {
        const provider = getSelectableProviderId(model);
        return provider !== '' && provider !== 'ollama' && provider !== 'local-ai' && provider !== 'huggingface';
    });
}

function getExpectedRemoteProviders(
    settings: AppSettings | null,
    linkedProviders: ReadonlySet<string>
): string[] {
    if (!settings) {
        return [];
    }

    const providers = new Set<string>();
    if (linkedProviders.has('nvidia')) {
        providers.add('nvidia');
    }
    if (linkedProviders.has('codex') || settings.codex?.connected === true) {
        providers.add('codex');
    }
    if (linkedProviders.has('claude')) {
        providers.add('claude');
    }
    if (linkedProviders.has('antigravity') || settings.antigravity?.connected === true) {
        providers.add('antigravity');
    }
    if (linkedProviders.has('copilot') || settings.copilot?.connected === true) {
        providers.add('copilot');
    }
    if (linkedProviders.has('groq')) {
        providers.add('custom');
    }

    return Array.from(providers);
}

function hasExpectedRemoteCoverage(models: ModelInfo[], expectedProviders: string[]): boolean {
    if (expectedProviders.length === 0) {
        return hasRemoteModels(models);
    }

    const availableProviders = new Set(
        models
            .map(model => getSelectableProviderId(model))
            .filter(provider => provider !== '' && provider !== 'ollama' && provider !== 'local-ai' && provider !== 'huggingface')
    );

    return expectedProviders.every(provider => availableProviders.has(provider));
}

function hasHealthyNvidiaCoverage(
    models: ModelInfo[],
    linkedProviders: ReadonlySet<string>
): boolean {
    if (!linkedProviders.has('nvidia')) {
        return true;
    }

    const nvidiaModelCount = models.filter(model => getSelectableProviderId(model) === 'nvidia').length;
    return nvidiaModelCount >= MIN_HEALTHY_NVIDIA_MODEL_COUNT;
}

function mergePreservedProviderModels(
    previousModels: ModelInfo[],
    fetchedModels: ModelInfo[],
    _settings: AppSettings | null,
    _linkedProviders: ReadonlySet<string>
): ModelInfo[] {
    return fetchedModels;
}

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
    
    // Stable refs to prevent render loops while maintaining correct logic
    const appSettingsRef = useRef(appSettings);
    const linkedProvidersRef = useRef<string[]>([]);
    const lastSyncedRef = useRef<{ defaultModel?: string; lastProvider?: string }>({});
    const hasScheduledRemoteRetryRef = useRef(false);
    const [linkedProviders, setLinkedProviders] = useState<string[]>([]);
    const linkedProviderSet = useMemo(() => new Set(linkedProviders), [linkedProviders]);
    const linkedProviderSignature = useMemo(() => linkedProviders.join('|'), [linkedProviders]);

    useEffect(() => {
        appSettingsRef.current = appSettings;
    }, [appSettings]);

    useEffect(() => {
        linkedProvidersRef.current = linkedProviders;
    }, [linkedProviders]);

    const refreshLinkedProviders = useCallback(async () => {
        try {
            const accounts = await fetchLinkedAccountsSnapshot();
            const normalizedProviders = Array.from(
                new Set(
                    accounts
                        .map(account => normalizeLinkedProvider(account.provider))
                        .filter(provider => provider.length > 0)
                )
            ).sort();
            setLinkedProviders(previousProviders => (
                areStringArraysEqual(previousProviders, normalizedProviders)
                    ? previousProviders
                    : normalizedProviders
            ));
        } catch (error) {
            appLogger.error('ModelManager', 'Failed to load linked providers', error as Error);
            setLinkedProviders([]);
        }
    }, []);

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
            setModels(previousModels => {
                const currentSettings = appSettingsRef.current;
                const nextModels = mergePreservedProviderModels(
                    previousModels,
                    fetched,
                    currentSettings,
                    new Set(linkedProvidersRef.current)
                );
                setProxyModels(nextModels.filter(m => m.provider !== 'ollama' && m.provider !== 'local-ai' && m.provider !== 'huggingface'));
                setGroupedModels(groupModels(nextModels));
                return nextModels;
            });
        } catch (error) {
            appLogger.error('ModelManager', 'Failed to refresh models', error as Error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void refreshLinkedProviders();
        }, 0);

        const removeListener = window.electron.auth.onAccountChanged(() => {
            void refreshLinkedProviders();
        });

        return () => {
            window.clearTimeout(timeoutId);
            removeListener();
        };
    }, [refreshLinkedProviders]);

    useEffect(() => {
        const unsubscribe = window.electron.on('model-downloader:progress', (_event, raw) => {
            const progress = raw as { status?: string };
            if (progress.status === 'completed') {
                void refreshModels(true);
            }
        });
        return () => unsubscribe();
    }, [refreshModels]);

    useEffect(() => {
        const unsubscribe = window.electron.on('model:updated', () => {
            appLogger.info('ModelManager', 'Received model:updated event from backend, refreshing...');
            void refreshModels(true);
        });
        let cancelled = false;
        let timeoutId: number | null = null;
        const requestIdle = (window as Window & {
            requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
        }).requestIdleCallback;

        const triggerInitialRefresh = () => {
            if (cancelled) {
                return;
            }
            void refreshModels();
        };

        if (requestIdle) {
            requestIdle(() => {
                triggerInitialRefresh();
            }, { timeout: 1200 });
        } else {
            timeoutId = window.setTimeout(() => {
                triggerInitialRefresh();
            }, 180);
        }

        return () => {
            cancelled = true;
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
            }
            unsubscribe();
        };
    }, [refreshModels]);

    useEffect(() => {
        if (hasScheduledRemoteRetryRef.current || models.length === 0 || isLoading) {
            return;
        }

        const expectedRemoteProviders = getExpectedRemoteProviders(appSettings, linkedProviderSet);
        if (
            hasExpectedRemoteCoverage(models, expectedRemoteProviders) &&
            hasHealthyNvidiaCoverage(models, linkedProviderSet)
        ) {
            return;
        }

        hasScheduledRemoteRetryRef.current = true;
        const retryTimer = window.setTimeout(() => {
            void refreshModels(true);
            hasScheduledRemoteRetryRef.current = false;
        }, MODEL_REFRESH_RETRY_DELAY_MS);

        return () => {
            window.clearTimeout(retryTimer);
            hasScheduledRemoteRetryRef.current = false;
        };
    }, [appSettings, isLoading, models, refreshModels, linkedProviderSet]);

    useEffect(() => {
        const hasNvidia = linkedProviderSet.has('nvidia');
        const hasOpenAI = linkedProviderSet.has('codex');
        const hasAnthropic = linkedProviderSet.has('claude');
        const hasGroq = linkedProviderSet.has('groq');
        const hasAntigravity = linkedProviderSet.has('antigravity') || appSettings?.antigravity?.connected === true;
        const hasCodex = linkedProviderSet.has('codex') || appSettings?.codex?.connected === true;
        const hasCopilot = linkedProviderSet.has('copilot') || appSettings?.copilot?.connected === true;

        if (hasNvidia || hasOpenAI || hasAnthropic || hasGroq || hasAntigravity || hasCodex || hasCopilot) {
            const timeoutId = window.setTimeout(() => {
                void refreshModels(true);
            }, 0);
            return () => window.clearTimeout(timeoutId);
        }
        return;
    }, [
        refreshModels,
        linkedProviderSignature,
        linkedProviderSet,
        appSettings?.antigravity?.connected,
        appSettings?.codex?.connected,
        appSettings?.copilot?.connected
    ]);

    useEffect(() => {
        const currentSettings = getSettingsSnapshot().settings ?? appSettings;
        if (!currentSettings) { return; }

        const defaultModel = currentSettings.general.defaultModel;
        const lastProvider = currentSettings.general.lastProvider;
        const locale = currentSettings.general.language ?? 'en';

        // Stricter guard using refs to prevent recursive runs within the same render cycle
        if (lastSyncedRef.current.defaultModel === defaultModel && lastSyncedRef.current.lastProvider === lastProvider) {
            return;
        }

        const availableModels = models.filter(m => getSelectableProviderId(m) !== '');
        if (availableModels.length === 0) {
            return;
        }

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

        const persistedProvider = normalizeSelectionProvider(lastProvider);
        const matchingDefaultModels = availableModels.filter(m => m.id?.toLowerCase() === defaultModel?.toLowerCase());
        const resolvedPersistedProvider = persistedProvider !== ''
            ? persistedProvider
            : (matchingDefaultModels[0] ? getSelectableProviderId(matchingDefaultModels[0]) : '');
        
        const persistedPairExists = matchingDefaultModels.some(m =>
            getSelectableProviderId(m) === resolvedPersistedProvider
        );
        
        const syncedSelection = defaultModel && resolvedPersistedProvider
            ? [{ provider: resolvedPersistedProvider, model: defaultModel }]
            : [];
            
        const isSelectionSynced =
            selectedModel === defaultModel &&
            selectedProvider === resolvedPersistedProvider &&
            areSelectionsEqual(selectedModels, syncedSelection);

        // CASE 1: Default model from settings is missing or invalid in current set
        if (defaultModel && matchingDefaultModels.length === 0) {
            const fallback = resolveFallback();
            if (!fallback) {
                return;
            }

            // Optimization: Update selection first
            if (
                selectedModel !== fallback.model ||
                selectedProvider !== fallback.provider ||
                !areSelectionsEqual(selectedModels, [fallback])
            ) {
                setSelectedModel(fallback.model);
                setSelectedProvider(fallback.provider);
                setSelectedModels([fallback]);
            }

            // Sync settings if different
            if (
                currentSettings.general.defaultModel !== fallback.model ||
                currentSettings.general.lastProvider !== fallback.provider
            ) {
                lastSyncedRef.current = { defaultModel: fallback.model, lastProvider: fallback.provider };
                setAppSettings({
                    ...currentSettings,
                    general: {
                        ...currentSettings.general,
                        defaultModel: fallback.model,
                        lastProvider: fallback.provider
                    }
                });
            }
            
            pushNotification({
                type: 'warning',
                title: t('frontend.modelsPage.defaultModelSwitchedTitle'),
                message: t('frontend.modelsPage.defaultModelSwitchedMessage', { model: fallback.model }),
                source: 'models',
            });
            return;
        }

        // CASE 2: Valid pair exists, ensure UI state matches settings
        if (defaultModel && resolvedPersistedProvider && persistedPairExists) {
            // First ensure lastProvider in settings is normalized
            if (currentSettings.general.lastProvider !== resolvedPersistedProvider) {
                lastSyncedRef.current = { defaultModel, lastProvider: resolvedPersistedProvider };
                setAppSettings({
                    ...currentSettings,
                    general: {
                        ...currentSettings.general,
                        lastProvider: resolvedPersistedProvider
                    }
                });
                return;
            }

            if (isSelectionSynced) {
                return;
            }

            setSelectedModel(defaultModel);
            setSelectedProvider(resolvedPersistedProvider);
            setSelectedModels(syncedSelection);
            return;
        }

        // CASE 3: No default model set yet
        if (!defaultModel && availableModels.length > 0) {
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
        const currentSettings = appSettingsRef.current;
        if (!currentSettings) { return; }
        if (currentSettings.general.defaultModel === model && currentSettings.general.lastProvider === provider) {
            return;
        }

        void setAppSettings({
            ...currentSettings,
            general: {
                ...currentSettings.general,
                defaultModel: model,
                lastProvider: provider
            }
        });
    }, [setAppSettings]);

    const toggleFavorite = useCallback((modelId: string) => {
        const currentSettings = appSettingsRef.current;
        if (!currentSettings) { return; }
        const currentFavorites = currentSettings.general.favoriteModels ?? [];
        const isFav = currentFavorites.includes(modelId);
        const newFavorites = isFav
            ? currentFavorites.filter(id => id !== modelId)
            : [...currentFavorites, modelId];

        setAppSettings({
            ...currentSettings,
            general: { ...currentSettings.general, favoriteModels: newFavorites }
        });
    }, [setAppSettings]);

    const isFavorite = useCallback((modelId: string) => {
        return appSettingsRef.current?.general.favoriteModels?.includes(modelId) ?? false;
    }, []);

    const getModelReasoningLevel = useCallback((modelId: string) => {
        return appSettingsRef.current?.modelSettings?.[modelId]?.reasoningLevel;
    }, []);

    const setModelReasoningLevel = useCallback((modelId: string, reasoningLevel: string) => {
        const currentSettings = appSettingsRef.current;
        if (!currentSettings) { return; }

        const currentLevel = currentSettings.modelSettings?.[modelId]?.reasoningLevel;
        if (currentLevel === reasoningLevel) { return; }

        const modelSettings = { ...(currentSettings.modelSettings ?? {}) };
        const current = modelSettings[modelId] ?? {};
        modelSettings[modelId] = { ...current, reasoningLevel };

        setAppSettings({
            ...currentSettings,
            modelSettings
        });
    }, [setAppSettings]);

    useEffect(() => {
        const currentSettings = appSettingsRef.current;
        if (!currentSettings) {
            return;
        }

        const activeModelId = selectedModel || currentSettings.general.defaultModel;
        const activeProvider = selectedProvider || currentSettings.general.lastProvider;
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

        const currentReasoningLevel = currentSettings.modelSettings?.[activeModelId]?.reasoningLevel;
        if (currentReasoningLevel && thinkingLevels.includes(currentReasoningLevel)) {
            return;
        }

        const defaultReasoningLevel = thinkingLevels.includes('low')
            ? 'low'
            : thinkingLevels[0];
            
        if (!defaultReasoningLevel || currentReasoningLevel === defaultReasoningLevel) {
            return;
        }

        setModelReasoningLevel(activeModelId, defaultReasoningLevel);
    }, [
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

