/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useMemo, useState } from 'react';

import { getSettingsSnapshot } from '@/store/settings.store';
import { AppSettings } from '@/types';

function normalizeSelectedModelId(provider: string, model: string): string {
    const normalizedProvider = provider.trim().toLowerCase();
    if (normalizedProvider === 'antigravity' && model.toLowerCase().endsWith('-antigravity')) {
        return model.slice(0, -'-antigravity'.length);
    }
    return model;
}

export function useModelSelection(
    appSettings: AppSettings | null,
    setAppSettings: (settings: AppSettings) => void
) {
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [selectedProvider, setSelectedProvider] = useState<string>('');
    const [selectedModels, setSelectedModels] = useState<Array<{ provider: string; model: string }>>([]);
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);

    const handleSelectModel = useCallback((provider: string, model: string, isMultiSelect = false) => {
        const currentSettings = getSettingsSnapshot().settings ?? appSettings;
        if (!currentSettings) { return; }
        const normalizedModel = normalizeSelectedModelId(provider, model);

        if (isMultiSelect) {
            setSelectedModels(prev => {
                const exists = prev.some(m => m.provider === provider && m.model === normalizedModel);
                if (exists || prev.length >= 4) {
                    return prev;
                }
                return [...prev, { provider, model: normalizedModel }];
            });
        } else {
            setSelectedModel(normalizedModel);
            setSelectedProvider(provider);
            setSelectedModels([{ provider, model: normalizedModel }]);
            
            // Optimization: Only update settings if they actually differ
            if (
                currentSettings.general.defaultModel !== normalizedModel ||
                currentSettings.general.lastProvider !== provider
            ) {
                void Promise.resolve(setAppSettings({
                    ...currentSettings,
                    general: {
                        ...currentSettings.general,
                        defaultModel: normalizedModel,
                        lastProvider: provider
                    }
                }));
            }
            setIsModelMenuOpen(false);
        }
    }, [appSettings, setAppSettings]);

    const removeSelectedModel = useCallback((provider: string, model: string) => {
        setSelectedModels(prev => {
            const filtered = prev.filter(m => !(m.provider === provider && m.model === model));
            if (filtered.length === 0 && prev.length > 0) {
                return prev;
            }
            if (filtered.length > 0) {
                const first = filtered[0];
                setSelectedModel(first.model);
                setSelectedProvider(first.provider);
            }
            return filtered;
        });
    }, []);

    const clearMultiSelection = useCallback(() => {
        setSelectedModels(prev => {
            if (prev.length === 0) {
                return prev;
            }
            const first = prev[0];
            setSelectedModel(first.model);
            setSelectedProvider(first.provider);
            return [first];
        });
    }, []);

    return useMemo(() => ({
        selectedModel,
        setSelectedModel,
        selectedProvider,
        setSelectedProvider,
        selectedModels,
        setSelectedModels,
        isModelMenuOpen,
        setIsModelMenuOpen,
        handleSelectModel,
        removeSelectedModel,
        clearMultiSelection
    }), [
        selectedModel,
        selectedProvider,
        selectedModels,
        isModelMenuOpen,
        handleSelectModel,
        removeSelectedModel,
        clearMultiSelection
    ]);
}

