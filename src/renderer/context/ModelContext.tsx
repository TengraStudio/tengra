import { useAuth } from '@renderer/context/AuthContext';
import { useModelManager } from '@renderer/features/models/hooks/useModelManager';
import { createContext, ReactNode, useContext, useMemo } from 'react';

type ModelContextType = ReturnType<typeof useModelManager>

const ModelContext = createContext<ModelContextType | null>(null);

export function ModelProvider({ children }: { children: ReactNode }) {
    const { appSettings, setAppSettings } = useAuth();
    const modelManager = useModelManager(appSettings, (settings) => void setAppSettings(settings));

    // Memoize the context value to prevent unnecessary re-renders
    const value = useMemo(() => modelManager, [modelManager]);

    return (
        <ModelContext.Provider value={value}>
            {children}
        </ModelContext.Provider>
    );
}

export function useModel() {
    const context = useContext(ModelContext);
    if (!context) {
        throw new Error('useModel must be used within a ModelProvider');
    }
    return context;
}
