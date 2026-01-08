import { createContext, useContext, ReactNode } from 'react'
import { useAuthManager } from '../features/settings/hooks/useAuthManager'

type AuthContextType = ReturnType<typeof useAuthManager>

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const authManager = useAuthManager()

    return (
        <AuthContext.Provider value={authManager}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
