/**
 * Hook for managing logo generation (Antigravity users only)
 */
import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';

interface UseLogoGenerationReturn {
    canGenerateLogo: boolean;
    isGenerating: boolean;
    logoPaths: string[];
    error: string | null;
    checkAvailability: () => Promise<void>;
    generateLogo: (
        ideaId: string,
        options: { prompt: string; style: string; model: string; count: number }
    ) => Promise<string[] | null>;
    clearLogos: () => void;
    clearError: () => void;
}

export function useLogoGeneration(): UseLogoGenerationReturn {
    const { t } = useTranslation();
    const [canGenerateLogo, setCanGenerateLogo] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [logoPaths, setLogoPaths] = useState<string[]>([]);
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

    const checkAvailability = useCallback(async () => {
        try {
            const available = await window.electron.ideas.canGenerateLogo();
            setCanGenerateLogo(available);
        } catch {
            setCanGenerateLogo(false);
        }
    }, []);

    const generateLogo = useCallback(
        async (
            ideaId: string,
            options: { prompt: string; style: string; model: string; count: number }
        ): Promise<string[] | null> => {
            if (!canGenerateLogo) {
                setError(t('ideas.errors.logoUnavailable'));
                return null;
            }

            setIsGenerating(true);
            setError(null);
            setLogoPaths([]);

            try {
                const result = await window.electron.ideas.generateLogo(ideaId, options);
                if (result.success && result.logoPaths) {
                    setLogoPaths(result.logoPaths);
                    return result.logoPaths;
                }
                throw new Error(t('ideas.errors.logoFailed'));
            } catch (err) {
                const message = resolveErrorMessage(err as Error | { messageKey?: string; messageParams?: Record<string, string | number> }, 'ideas.errors.logoFailed');
                setError(message);
                return null;
            } finally {
                setIsGenerating(false);
            }
        },
        [canGenerateLogo, resolveErrorMessage, t]
    );

    const clearLogos = useCallback(() => {
        setLogoPaths([]);
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // Check availability on mount
    useEffect(() => {
        void checkAvailability();
    }, [checkAvailability]);

    return {
        canGenerateLogo,
        isGenerating,
        logoPaths,
        error,
        checkAvailability,
        generateLogo,
        clearLogos,
        clearError,
    };
}
