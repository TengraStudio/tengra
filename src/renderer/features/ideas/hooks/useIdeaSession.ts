/**
 * Hook for managing idea generation sessions
 */
import { IdeaSession, IdeaSessionConfig } from '@shared/types/ideas'
import { useCallback, useEffect, useState } from 'react'

interface UseIdeaSessionReturn {
    sessions: IdeaSession[]
    currentSession: IdeaSession | null
    isLoading: boolean
    error: string | null
    createSession: (config: IdeaSessionConfig) => Promise<IdeaSession | null>
    loadSessions: () => Promise<void>
    selectSession: (sessionId: string) => Promise<void>
    cancelSession: (sessionId: string) => Promise<void>
    clearError: () => void
}

export function useIdeaSession(): UseIdeaSessionReturn {
    const [sessions, setSessions] = useState<IdeaSession[]>([])
    const [currentSession, setCurrentSession] = useState<IdeaSession | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const loadSessions = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const loadedSessions = await window.electron.ideas.getSessions()
            setSessions(loadedSessions)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load sessions'
            setError(message)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const createSession = useCallback(async (config: IdeaSessionConfig): Promise<IdeaSession | null> => {
        setIsLoading(true)
        setError(null)
        try {
            const session = await window.electron.ideas.createSession(config)
            setSessions(prev => [session, ...prev])
            setCurrentSession(session)
            return session
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to create session'
            setError(message)
            return null
        } finally {
            setIsLoading(false)
        }
    }, [])

    const selectSession = useCallback(async (sessionId: string) => {
        setIsLoading(true)
        setError(null)
        try {
            const session = await window.electron.ideas.getSession(sessionId)
            setCurrentSession(session)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load session'
            setError(message)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const cancelSession = useCallback(async (sessionId: string) => {
        setIsLoading(true)
        setError(null)
        try {
            await window.electron.ideas.cancelSession(sessionId)
            setSessions(prev => prev.map(s =>
                s.id === sessionId ? { ...s, status: 'cancelled' as const } : s
            ))
            if (currentSession?.id === sessionId) {
                setCurrentSession(prev => prev ? { ...prev, status: 'cancelled' as const } : null)
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to cancel session'
            setError(message)
        } finally {
            setIsLoading(false)
        }
    }, [currentSession?.id])

    const clearError = useCallback(() => {
        setError(null)
    }, [])

    // Load sessions on mount
    useEffect(() => {
        void loadSessions()
    }, [loadSessions])

    return {
        sessions,
        currentSession,
        isLoading,
        error,
        createSession,
        loadSessions,
        selectSession,
        cancelSession,
        clearError
    }
}
