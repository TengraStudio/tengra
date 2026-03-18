import { useCallback, useState } from 'react';

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
        if (!appSettings) { return; }
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
            setAppSettings({
                ...appSettings,
                general: {
                    ...appSettings.general,
                    defaultModel: normalizedModel,
                    lastProvider: provider
                }
            });
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
                setSelectedModel(filtered[0].model);
                setSelectedProvider(filtered[0].provider);
            }
            return filtered;
        });
    }, []);

    const clearMultiSelection = useCallback(() => {
        if (selectedModels.length > 0) {
            const first = selectedModels[0];
            setSelectedModels([first]);
            setSelectedModel(first.model);
            setSelectedProvider(first.provider);
        }
    }, [selectedModels]);

    return {
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
    };
}
