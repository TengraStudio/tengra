/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from '@/i18n';
import { appLogger } from '@/utils/renderer-logger';

export function useOllamaManager() {
    const { t } = useTranslation();
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
            const status = await window.electron.forceOllamaHealthCheck();
            setIsOllamaRunning(status.status === 'ok');
        } catch (error) {
            appLogger.error('OllamaManager', 'Failed to check Ollama status', error as Error);
            setIsOllamaRunning(false);
        }
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void checkOllama();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [checkOllama]);

    const startOllama = useCallback(async () => {
        try {
            if (statusTimeoutRef.current !== null) {
                clearTimeout(statusTimeoutRef.current);
            }
            const result = await window.electron.startOllama();
            if (result.message) {
                const localizedMessage = result.messageKey
                    ? t(result.messageKey, result.messageParams)
                    : result.message;
                setStatusMessage(localizedMessage);
                statusTimeoutRef.current = setTimeout(() => setStatusMessage(''), 2000);
            }
        } catch (error) {
            appLogger.error('OllamaManager', 'Failed to start Ollama', error as Error);
        } finally {
            void checkOllama();
        }
    }, [checkOllama, t]);

    return {
        isOllamaRunning,
        statusMessage,
        setStatusMessage,
        checkOllama,
        startOllama
    };
}

