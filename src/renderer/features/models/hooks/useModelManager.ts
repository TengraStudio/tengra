import { useState, useEffect, useRef, useCallback } from 'react'
import { GroupedModels, ModelInfo } from '../utils/model-fetcher'

export function useModelManager(appSettings: any, setAppSettings: (settings: any) => void) {
    const [models, setModels] = useState<ModelInfo[]>([])
    const [groupedModels, setGroupedModels] = useState<GroupedModels | null>(null)
    const [selectedModel, setSelectedModel] = useState<string>('')
    const [selectedProvider, setSelectedProvider] = useState<string>('')
    const [proxyModels, setProxyModels] = useState<any[]>([])
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false)

    const selectedModelRef = useRef('')
    const selectedProviderRef = useRef('')
    const isModelMenuOpenRef = useRef(false)
    const lastUserSelectionTimeRef = useRef(0)

    // Sync refs with state for use in async closures
    useEffect(() => {
        selectedModelRef.current = selectedModel
        selectedProviderRef.current = selectedProvider
    }, [selectedModel, selectedProvider])

    useEffect(() => {
        isModelMenuOpenRef.current = isModelMenuOpen
    }, [isModelMenuOpen])

    // We only initialize from settings once in loadModels. 
    // We DO NOT sync back from settings to state during runtime, because 
    // local interactions are the source of truth.
    // This prevents the "revert" bug when appSettings is slow to update.

    /* Removed sync effect */

    const persistLastSelection = useCallback(async (provider: string, model: string) => {
        const now = Date.now()
        lastUserSelectionTimeRef.current = now
        console.log(`%c[ModelSelection] PERSIST: ${model} (${provider})`, 'color: #3b82f6; font-weight: bold;')

        // 1. Immediate Optimistic Update
        setSelectedModel((prev) => {
            if (prev !== model) {
                selectedModelRef.current = model
                return model
            }
            return prev
        })
        setSelectedProvider((prev) => {
            if (prev !== provider) return provider
            return prev
        })

        if (!appSettings) return

        // 2. Persist to Backend
        const updated = {
            ...appSettings,
            general: {
                ...(appSettings.general || {}),
                lastModel: model,
                lastProvider: provider
            }
        }

        // Don't wait for this to finish to update UI
        setAppSettings(updated)

        try {
            await window.electron.saveSettings(updated)
            console.log('[ModelSelection] Settings saved to disk')
        } catch (e) {
            console.error('[ModelSelection] Failed to save settings:', e)
        }
    }, [appSettings, setAppSettings])


    const loadModels = useCallback(async (attempt: number = 0, force: boolean = false) => {
        if (isModelMenuOpenRef.current && !force) return

        try {
            const { fetchModels } = await import('../utils/model-fetcher')
            const grouped = await fetchModels(force || attempt > 0)

            const allModels = [
                ...grouped.ollama,
                ...grouped.copilot,
                ...grouped.openai,
                ...grouped.anthropic,
                ...grouped.gemini,
                ...grouped.antigravity,
                ...grouped.custom
            ]

            if (!isModelMenuOpenRef.current) {
                setModels(prev => {
                    const isEq = prev.length === allModels.length &&
                        prev.every((m, i) => (m.name || m.id) === (allModels[i].name || allModels[i].id))
                    return isEq ? prev : (allModels as any)
                })

                setGroupedModels(grouped)

                const proxyList = [
                    ...grouped.copilot,
                    ...grouped.openai,
                    ...grouped.anthropic,
                    ...grouped.gemini,
                    ...grouped.antigravity,
                    ...grouped.custom
                ]

                setProxyModels(prev => {
                    if (prev.length === proxyList.length &&
                        prev.every((m, i) => m.id === proxyList[i].id)) {
                        return prev
                    }
                    return proxyList
                })
            }

            // Sync with settings if not already selected
            // Use REF check to see what the CURRENT selection is, even across re-renders
            console.log(`[ModelSelection] loadModels check - selectedModelRef: "${selectedModelRef.current}", allModels: ${allModels.length}`)
            if (allModels.length > 0 && !selectedModelRef.current) {
                const preferredModel = appSettings?.general?.lastModel || appSettings?.general?.defaultModel || 'gpt-4o'
                const preferredProvider = appSettings?.general?.lastProvider || 'copilot'
                console.log(`[ModelSelection] loadModels: initializing with ${preferredModel} (${preferredProvider})`)
                setSelectedModel(preferredModel)
                setSelectedProvider(preferredProvider)
            }

            let hasProxyModels = allModels.some(m => m.provider !== 'ollama')
            if (attempt < 3 && (allModels.length === 0 || !hasProxyModels)) {
                setTimeout(() => loadModels(attempt + 1), 1200)
            }
        } catch (error) {
            console.error('Failed to load models:', error)
        }
    }, [appSettings, setSelectedModel, setSelectedProvider])

    // Initial load
    useEffect(() => {
        loadModels()
    }, [])

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
        loadModels,
        persistLastSelection
    }
}
