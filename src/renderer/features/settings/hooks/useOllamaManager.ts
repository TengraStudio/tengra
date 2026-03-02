import { useCallback, useEffect, useRef, useState } from 'react';

import { appLogger } from '@/utils/renderer-logger';

export function useOllamaManager() {
    const [isOllamaRunning, setIsOllamaRunning] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (statusTimeoutRef.current !== null) {
                clearTimeout(statusTimeoutRef.current);
            }
        };
    }, []);

    const checkOllama = useCallback(async () => {
        try {
            const running = await window.electron.isOllamaRunning();
            setIsOllamaRunning(!!running);
        } catch {
            setIsOllamaRunning(false);
        }
    }, []);

    useEffect(() => {
        void checkOllama();
    }, [checkOllama]);

    const startOllama = useCallback(async () => {
        try {
            const result = await window.electron.startOllama();
            if (result.message) {
                setStatusMessage(result.message);
                statusTimeoutRef.current = setTimeout(() => setStatusMessage(''), 2000);
            }
        } catch (error) {
            appLogger.error('OllamaManager', 'Failed to start Ollama', error as Error);
        } finally {
            void checkOllama();
        }
    }, [checkOllama]);

    return {
        isOllamaRunning,
        statusMessage,
        setStatusMessage,
        checkOllama,
        startOllama
    };
}
