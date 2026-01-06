import { useState, useEffect, useMemo, useRef } from 'react'
import type { GroupedModels } from '../lib/model-fetcher'

interface AppSettings {
    general?: {
        defaultModel?: string
        lastModel?: string
        lastProvider?: string
    }
}

export function useModelManager(appSettings: AppSettings | null, setAppSettings: (settings: any) => void) {
    const [models, setModels] = useState<any[]>([])
    const [groupedModels, setGroupedModels] = useState<GroupedModels | null>(null)
    const [selectedModel, setSelectedModel] = useState<string>('gpt-4o')
    const [selectedProvider, setSelectedProvider] = useState<string>('copilot')
    const [proxyModels, setProxyModels] = useState<any[]>([])
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false)
    const isModelMenuOpenRef = useRef(false)

    useEffect(() => {
        isModelMenuOpenRef.current = isModelMenuOpen
    }, [isModelMenuOpen])

    // Auto-sync provider when model changes
    useEffect(() => {
        if (!selectedModel || !groupedModels) return
        for (const [provider, models] of Object.entries(groupedModels)) {
            if (Array.isArray(models) && models.some((m: any) => m.id === selectedModel)) {
                if (selectedProvider !== provider) {
                    console.log('[useModelManager] Auto-sync provider for model:', selectedModel, '->', provider)
                    setSelectedProvider(provider)
                }
                break
            }
        }
    }, [selectedModel, groupedModels, selectedProvider])

    const persistLastSelection = async (provider: string, model: string) => {
        if (!appSettings?.general) return
        const updated = {
            ...appSettings,
            general: {
                ...appSettings.general,
                lastModel: model,
                lastProvider: provider
            }
        }
        setAppSettings(updated)
        try {
            await window.electron.saveSettings(updated)
        } catch (e) {
            console.error('Failed to save last model selection:', e)
        }
    }

    const loadModels = async (attempt: number = 0) => {
        if (isModelMenuOpenRef.current) return

        try {
            const { fetchModels } = await import('../lib/model-fetcher')
            const grouped = await fetchModels()

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
                    const isEq = JSON.stringify(prev) === JSON.stringify(proxyList)
                    return isEq ? prev : proxyList
                })
            }

            if (!selectedModel && allModels.length > 0) {
                const preferredModel = appSettings?.general?.lastModel || appSettings?.general?.defaultModel
                const preferredProvider = appSettings?.general?.lastProvider || 'copilot'

                if (preferredModel) {
                    setSelectedModel(preferredModel)
                    setSelectedProvider(preferredProvider)
                } else {
                    setSelectedModel(allModels[0].id)
                    setSelectedProvider(allModels[0].provider)
                }
            }

            let hasProxyModels = allModels.some(m => m.provider !== 'ollama')
            if (attempt < 3 && (allModels.length === 0 || !hasProxyModels)) {
                setTimeout(() => loadModels(attempt + 1), 1200)
            }
        } catch (error) {
            console.error('Failed to load models:', error)
        }
    }

    // Validation Effect
    useEffect(() => {
        if (!groupedModels || !selectedModel) return

        const allModels = [
            ...groupedModels.ollama,
            ...groupedModels.copilot,
            ...groupedModels.openai,
            ...groupedModels.anthropic,
            ...groupedModels.gemini,
            ...groupedModels.antigravity,
            ...groupedModels.custom
        ]

        if (allModels.length === 0) return

        const currentExists = allModels.some(m => m.id === selectedModel)
        if (!currentExists) {
            const normalized = selectedModel.toLowerCase()
            const fallback = allModels.find(m => m.id === selectedModel)
                || allModels.find(m => m.id.toLowerCase() === normalized)
                || allModels.find(m => m.id.toLowerCase().includes(normalized))
                || allModels.find(m => m.id.toLowerCase().includes('sonnet'))
                || allModels.find(m => m.id.includes('gpt-4o'))
                || allModels[0]

            if (fallback && fallback.id !== selectedModel) {
                setSelectedModel(fallback.id)
                setSelectedProvider(fallback.provider)
            }
        }
    }, [selectedModel, groupedModels])

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
