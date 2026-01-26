/**
 * Hook for managing logo generation (Antigravity users only)
 */
import { useCallback, useEffect, useState } from 'react';

interface UseLogoGenerationReturn {
    canGenerateLogo: boolean
    isGenerating: boolean
    logoPath: string | null
    error: string | null
    checkAvailability: () => Promise<void>
    generateLogo: (ideaId: string, prompt: string) => Promise<string | null>
    clearLogo: () => void
    clearError: () => void
}

export function useLogoGeneration(): UseLogoGenerationReturn {
    const [canGenerateLogo, setCanGenerateLogo] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [logoPath, setLogoPath] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const checkAvailability = useCallback(async () => {
        try {
            const available = await window.electron.ideas.canGenerateLogo();
            setCanGenerateLogo(available);
        } catch {
            setCanGenerateLogo(false);
        }
    }, []);

    const generateLogo = useCallback(async (ideaId: string, prompt: string): Promise<string | null> => {
        if (!canGenerateLogo) {
            setError('Logo generation not available');
            return null;
        }

        setIsGenerating(true);
        setError(null);
        setLogoPath(null);

        try {
            const result = await window.electron.ideas.generateLogo(ideaId, prompt);
            if (result.success && result.logoPath) {
                setLogoPath(result.logoPath);
                return result.logoPath;
            }
            throw new Error('Logo generation failed');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Logo generation failed';
            setError(message);
            return null;
        } finally {
            setIsGenerating(false);
        }
    }, [canGenerateLogo]);

    const clearLogo = useCallback(() => {
        setLogoPath(null);
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
        logoPath,
        error,
        checkAvailability,
        generateLogo,
        clearLogo,
        clearError
    };
}
