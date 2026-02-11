/**
 * Hook for managing logo generation (Antigravity users only)
 */
import { useCallback, useEffect, useState } from 'react';

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
    const [canGenerateLogo, setCanGenerateLogo] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [logoPaths, setLogoPaths] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

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
                setError('Logo generation not available');
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
                throw new Error('Logo generation failed');
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Logo generation failed';
                setError(message);
                return null;
            } finally {
                setIsGenerating(false);
            }
        },
        [canGenerateLogo]
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
