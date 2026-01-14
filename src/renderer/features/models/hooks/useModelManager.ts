import { fetchModels, GroupedModels, groupModels,ModelInfo } from '@renderer/features/models/utils/model-fetcher'
import { useCallback,useEffect, useState } from 'react'

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
            setProxyModels(fetched.filter(m => (m.provider as string) === 'proxy'))
            setGroupedModels(groupModels(fetched))
        } catch (error) {
            console.error('Failed to refresh models:', error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        refreshModels()
    }, [refreshModels])

    useEffect(() => {
        if (appSettings?.general?.defaultModel) {
            setSelectedModel(appSettings.general.defaultModel)
            // defaultProvider does not exist, using lastProvider as fallback or just empty
            setSelectedProvider(appSettings.general.lastProvider || '')
        }
    }, [appSettings])

    const handleSelectModel = (provider: string, model: string) => {
        if (!appSettings) {return}
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
    }

    const persistLastSelection = (provider: string, model: string) => {
        if (!appSettings) {return}
        setAppSettings({
            ...appSettings,
            general: {
                ...appSettings.general,
                defaultModel: model,
                lastProvider: provider
            }
        })
    }

    return {
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
        persistLastSelection
    }
}
