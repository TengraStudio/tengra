import { fetchModels, GroupedModels, groupModels, ModelInfo } from '@renderer/features/models/utils/model-fetcher'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { AppSettings } from '@/types'

export function useModelManager(
    appSettings: AppSettings | null,
    setAppSettings: (settings: AppSettings) => void
) {
    const [models, setModels] = useState<ModelInfo[]>([])
    const [groupedModels, setGroupedModels] = useState<GroupedModels | null>(null)
    const [selectedModel, setSelectedModel] = useState<string>('')
    const [selectedProvider, setSelectedProvider] = useState<string>('')
    const [proxyModels, setProxyModels] = useState<ModelInfo[]>([])
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    const refreshModels = useCallback(async () => {
        setIsLoading(true)
        try {
            const fetched = await fetchModels()
            setModels(fetched)
            // Proxy models are those that are NOT local (ollama) or copilot (usually treated separately but can be considered proxy-like here depending on UI needs)
            // For now, let's include everything that isn't 'ollama' or 'local'
            setProxyModels(fetched.filter(m => m.provider !== 'ollama' && m.provider !== 'local-ai'))
            setGroupedModels(groupModels(fetched))
        } catch (error) {
            console.error('Failed to refresh models:', error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        void refreshModels()
    }, [refreshModels])

    useEffect(() => {
        if (appSettings?.general?.defaultModel) {
            setSelectedModel(appSettings.general.defaultModel)
            // defaultProvider does not exist, using lastProvider as fallback or just empty
            setSelectedProvider(appSettings.general.lastProvider ?? '')
        }
    }, [appSettings])

    const handleSelectModel = useCallback((provider: string, model: string) => {
        if (!appSettings) { return }
        setSelectedModel(model)
        setSelectedProvider(provider)
        setAppSettings({
            ...appSettings,
            general: {
                ...appSettings.general,
                defaultModel: model,
                lastProvider: provider
            }
        })
        setIsModelMenuOpen(false)
    }, [appSettings, setAppSettings])

    const persistLastSelection = useCallback((provider: string, model: string) => {
        if (!appSettings) { return }
        setAppSettings({
            ...appSettings,
            general: {
                ...appSettings.general,
                defaultModel: model,
                lastProvider: provider
            }
        })
    }, [appSettings, setAppSettings])

    const toggleFavorite = useCallback((modelId: string) => {
        if (!appSettings) { return }
        const currentFavorites = appSettings.general.favoriteModels ?? []
        const isFav = currentFavorites.includes(modelId)

        let newFavorites: string[]
        if (isFav) {
            newFavorites = currentFavorites.filter(id => id !== modelId)
        } else {
            newFavorites = [...currentFavorites, modelId]
        }

        setAppSettings({
            ...appSettings,
            general: {
                ...appSettings.general,
                favoriteModels: newFavorites
            }
        })
    }, [appSettings, setAppSettings])

    const isFavorite = useCallback((modelId: string) => {
        return appSettings?.general.favoriteModels?.includes(modelId) ?? false
    }, [appSettings])

    return useMemo(() => ({
        models,
        groupedModels,
        selectedModel,
        setSelectedModel,
        selectedProvider,
        setSelectedProvider,
        proxyModels,
        isModelMenuOpen,
        setIsModelMenuOpen,
        isLoading,
        refreshModels,
        loadModels: refreshModels,
        handleSelectModel,
        persistLastSelection,
        toggleFavorite,
        isFavorite
    }), [
        models, groupedModels, selectedModel, selectedProvider, proxyModels,
        isModelMenuOpen, isLoading, refreshModels, handleSelectModel,
        persistLastSelection, toggleFavorite, isFavorite
    ])
}
