import { createContext, useContext, ReactNode } from 'react'
import { useModelManager } from '@renderer/features/models/hooks/useModelManager'
import { useAuth } from '@renderer/context/AuthContext'

type ModelContextType = ReturnType<typeof useModelManager>

const ModelContext = createContext<ModelContextType | null>(null)

export function ModelProvider({ children }: { children: ReactNode }) {
    const { appSettings, setAppSettings } = useAuth()
    const modelManager = useModelManager(appSettings, setAppSettings)

    return (
        <ModelContext.Provider value={modelManager}>
            {children}
        </ModelContext.Provider>
    )
}

export function useModel() {
    const context = useContext(ModelContext)
    if (!context) {
        throw new Error('useModel must be used within a ModelProvider')
    }
    return context
}
