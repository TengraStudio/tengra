import { useAuthManager } from '@renderer/features/settings/hooks/useAuthManager';
import { createContext, ReactNode, useContext, useMemo } from 'react';

type AuthContextType = ReturnType<typeof useAuthManager>

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const authManager = useAuthManager();

    // Memoize the context value to prevent unnecessary re-renders
    const value = useMemo(() => authManager, [authManager]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
