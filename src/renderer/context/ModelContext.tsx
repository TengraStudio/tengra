/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createContext, ReactNode, useCallback, useContext, useMemo } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useModelManager } from '@/features/models/hooks/useModelManager';
import { AppSettings } from '@/types';
import { translateErrorMessage } from '@/utils/error-handler.util';

type ModelContextType = ReturnType<typeof useModelManager>

const ModelContext = createContext<ModelContextType | null>(null);

export function ModelProvider({ children }: { children: ReactNode }) {
    const { appSettings, setAppSettings } = useAuth();
    
    const handleSetSettings = useCallback((settings: AppSettings) => {
        void setAppSettings(settings);
    }, [setAppSettings]);

    const modelManager = useModelManager(appSettings, handleSetSettings);

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
        throw new Error(translateErrorMessage('useModel must be used within a ModelProvider'));
    }
    return context;
}

