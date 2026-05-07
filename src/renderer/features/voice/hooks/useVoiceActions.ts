/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * useVoiceActions Hook - Manages global side effects for voice commands
 * UI-11: Voice-first interface option
 */

import { useCallback, useEffect } from 'react';

import { useTranslation } from '@/i18n';
import { appLogger } from '@/utils/renderer-logger';

interface UseVoiceActionsParams {
    setCurrentView: (view: 'chat' | 'workspace' | 'settings' | 'models') => void;
    addToast: (toast: { type: 'info'; message: string }) => void;
    createNewChat: () => void;
    handleSend: () => Promise<void> | void;
    setInput: (value: string) => void;
}

export function useVoiceActions({
    setCurrentView,
    addToast,
    createNewChat,
    handleSend,
    setInput,
}: UseVoiceActionsParams) {
    const { t } = useTranslation();

    const handleNavigate = useCallback((event: Event) => {
        const customEvent = event as CustomEvent<string>;
        const target = customEvent.detail;

        switch (target) {
            case 'home':
                setCurrentView('chat'); // Default home
                break;
            case 'settings':
                setCurrentView('settings');
                break;
            case 'chat':
                createNewChat();
                setCurrentView('chat');
                break;
            case 'workspaces':
            case 'workspace':
                setCurrentView('workspace');
                break;
            case 'models':
                setCurrentView('models');
                break;
            default:
                appLogger.warn('VoiceActions', `Unknown navigation target: ${target}`);
        }
    }, [setCurrentView, createNewChat]);

    const handleExecute = useCallback((event: Event) => {
        const customEvent = event as CustomEvent<string>;
        const command = customEvent.detail;

        switch (command) {
            case 'chat-send':
                void handleSend();
                break;
            case 'chat-clear':
                window.dispatchEvent(new CustomEvent('app:clear-chat'));
                break;
            case 'copy-last-response':
                window.dispatchEvent(new CustomEvent('app:copy-last-response'));
                break;
            case 'show-voice-help':
                addToast({
                    type: 'info',
                    message: t('frontend.voice.helpToast'),
                });
                break;
            default:
                appLogger.warn('VoiceActions', `Unknown execute command: ${command}`);
        }
    }, [handleSend, addToast, t]);

    const handleScroll = useCallback((event: Event) => {
        const customEvent = event as CustomEvent<{ direction: string; amount?: number }>;
        const { direction, amount = 300 } = customEvent.detail;

        const mainContent = document.querySelector('.main-content-scrollable');
        if (mainContent) {
            switch (direction) {
                case 'up':
                    mainContent.scrollBy({ top: -amount, behavior: 'smooth' });
                    break;
                case 'down':
                    mainContent.scrollBy({ top: amount, behavior: 'smooth' });
                    break;
            }
        }
    }, []);

    const handleChat = useCallback((event: Event) => {
        const customEvent = event as CustomEvent<string>;
        const message = customEvent.detail;
        setInput(message);
    }, [setInput]);

    useEffect(() => {
        window.addEventListener('voice:navigate', handleNavigate);
        window.addEventListener('voice:execute', handleExecute);
        window.addEventListener('voice:scroll', handleScroll);
        window.addEventListener('voice:chat', handleChat);

        return () => {
            window.removeEventListener('voice:navigate', handleNavigate);
            window.removeEventListener('voice:execute', handleExecute);
            window.removeEventListener('voice:scroll', handleScroll);
            window.removeEventListener('voice:chat', handleChat);
        };
    }, [handleNavigate, handleExecute, handleScroll, handleChat]);
}

