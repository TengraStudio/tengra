/**
 * Hook for managing idea generation sessions
 */
import { IdeaSession, IdeaSessionConfig } from '@shared/types/ideas';
import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';

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
    const { t } = useTranslation();
    const [sessions, setSessions] = useState<IdeaSession[]>([]);
    const [currentSession, setCurrentSession] = useState<IdeaSession | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const resolveErrorMessage = useCallback((err: Error | { messageKey?: string; messageParams?: Record<string, string | number> } | null | undefined, fallbackKey: string): string => {
        const errorWithI18n = err as {
            messageKey?: string;
            messageParams?: Record<string, string | number>;
        };
        if (typeof errorWithI18n.messageKey === 'string' && errorWithI18n.messageKey.length > 0) {
            return t(errorWithI18n.messageKey, errorWithI18n.messageParams);
        }
        if (err instanceof Error) {
            return err.message.startsWith('ideas.') || err.message.startsWith('errors.')
                ? t(err.message)
                : err.message;
        }
        return t(fallbackKey);
    }, [t]);

    const loadSessions = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const loadedSessions = await window.electron.ideas.getSessions();
            setSessions(loadedSessions);
        } catch (err) {
            const message = resolveErrorMessage(err as Error | { messageKey?: string; messageParams?: Record<string, string | number> }, 'ideas.errors.loadSessionsFailed');
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [resolveErrorMessage]);

    const createSession = useCallback(async (config: IdeaSessionConfig): Promise<IdeaSession | null> => {
        setIsLoading(true);
        setError(null);
        try {
            const session = await window.electron.ideas.createSession(config);
            setSessions(prev => [session, ...prev]);
            setCurrentSession(session);
            return session;
        } catch (err) {
            const message = resolveErrorMessage(err as Error | { messageKey?: string; messageParams?: Record<string, string | number> }, 'ideas.errors.createSessionFailed');
            setError(message);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [resolveErrorMessage]);

    const selectSession = useCallback(async (sessionId: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const session = await window.electron.ideas.getSession(sessionId);
            setCurrentSession(session);
        } catch (err) {
            const message = resolveErrorMessage(err as Error | { messageKey?: string; messageParams?: Record<string, string | number> }, 'ideas.errors.loadSessionFailed');
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [resolveErrorMessage]);

    const cancelSession = useCallback(async (sessionId: string) => {
        setIsLoading(true);
        setError(null);
        try {
            await window.electron.ideas.cancelSession(sessionId);
            setSessions(prev => prev.map(s =>
                s.id === sessionId ? { ...s, status: 'cancelled' as const } : s
            ));
            if (currentSession?.id === sessionId) {
                setCurrentSession(prev => prev ? { ...prev, status: 'cancelled' as const } : null);
            }
        } catch (err) {
            const message = resolveErrorMessage(err as Error | { messageKey?: string; messageParams?: Record<string, string | number> }, 'ideas.errors.cancelSessionFailed');
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [currentSession?.id, resolveErrorMessage]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // Load sessions on mount
    useEffect(() => {
        void loadSessions();
    }, [loadSessions]);

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
    };
}
