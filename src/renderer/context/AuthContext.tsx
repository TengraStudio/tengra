/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createContext, ReactNode, useContext, useMemo } from 'react';

import { useAuthManager } from '@/features/settings/hooks/useAuthManager';
import { translateErrorMessage } from '@/utils/error-handler.util';

type AuthContextType = ReturnType<typeof useAuthManager>
type AuthLanguageContextType = {
    language: AuthContextType['language'];
};
type AuthSettingsUiContextType = Pick<
    AuthContextType,
    | 'settingsCategory'
    | 'setSettingsCategory'
    | 'isAuthModalOpen'
    | 'setIsAuthModalOpen'
    | 'handleAntigravityLogout'
>;

const AuthContext = createContext<AuthContextType | null>(null);
const AuthLanguageContext = createContext<AuthLanguageContextType | null>(null);
const AuthSettingsUiContext = createContext<AuthSettingsUiContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const authManager = useAuthManager();

    // Memoize the context value to prevent unnecessary re-renders
    const value = useMemo(() => authManager, [authManager]);
    const languageValue = useMemo(
        () => ({ language: authManager.language }),
        [authManager.language]
    );
    const settingsUiValue = useMemo(
        () => ({
            settingsCategory: authManager.settingsCategory,
            setSettingsCategory: authManager.setSettingsCategory,
            isAuthModalOpen: authManager.isAuthModalOpen,
            setIsAuthModalOpen: authManager.setIsAuthModalOpen,
            handleAntigravityLogout: authManager.handleAntigravityLogout,
        }),
        [
            authManager.settingsCategory,
            authManager.setSettingsCategory,
            authManager.isAuthModalOpen,
            authManager.setIsAuthModalOpen,
            authManager.handleAntigravityLogout,
        ]
    );

    return (
        <AuthLanguageContext.Provider value={languageValue}>
            <AuthSettingsUiContext.Provider value={settingsUiValue}>
                <AuthContext.Provider value={value}>
                    {children}
                </AuthContext.Provider>
            </AuthSettingsUiContext.Provider>
        </AuthLanguageContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error(translateErrorMessage('useAuth must be used within an AuthProvider'));
    }
    return context;
}

export function useAuthLanguage() {
    const context = useContext(AuthLanguageContext);
    if (!context) {
        throw new Error(translateErrorMessage('useAuthLanguage must be used within an AuthProvider'));
    }
    return context;
}

export function useAuthSettingsUi() {
    const context = useContext(AuthSettingsUiContext);
    if (!context) {
        throw new Error(translateErrorMessage('useAuthSettingsUi must be used within an AuthProvider'));
    }
    return context;
}
