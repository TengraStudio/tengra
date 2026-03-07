/**
 * useVoiceNavigation Hook - Handles voice-based navigation
 * UI-11: Voice-first interface option
 */

import { useCallback,useEffect } from 'react';

import { useVoice } from './useVoice';

/** Navigation target mapping */
type NavigationTarget =
    | 'home'
    | 'chat'
    | 'settings'
    | 'workspaces'
    | 'models'
    | 'memory'
    | 'ideas'
    | 'terminal'
    | 'mcp';

/** Props for voice navigation hook */
interface UseVoiceNavigationProps {
    /** Callback when navigation is requested */
    onNavigate?: (target: NavigationTarget) => void;
    /** Callback when command is executed */
    onExecute?: (command: string) => void;
    /** Callback when setting is toggled */
    onToggle?: (setting: string) => void;
    /** Callback when scroll is requested */
    onScroll?: (direction: 'up' | 'down' | 'left' | 'right', amount?: number) => void;
    /** Callback when chat message is sent */
    onChat?: (message: string) => void;
    /** Enable voice navigation */
    enabled?: boolean;
}

/**
 * Hook for handling voice-based navigation and actions
 */
export function useVoiceNavigation({
    onNavigate,
    onExecute,
    onToggle,
    onScroll,
    onChat,
    enabled = true,
}: UseVoiceNavigationProps = {}) {
    const { session, startListening, stopListening, speak, settings } = useVoice();

    /** Handle voice navigation events */
    useEffect(() => {
        if (!enabled) {
            return;
        }

        const handleNavigate = (event: CustomEvent<string>) => {
            const target = event.detail as NavigationTarget;
            if (onNavigate) {
                onNavigate(target);
            }
            // Provide audio feedback if enabled
            if (settings.audioFeedback) {
                speak({ text: `Navigating to ${target}` });
            }
        };

        const handleExecute = (event: CustomEvent<string>) => {
            if (onExecute) {
                onExecute(event.detail);
            }
        };

        const handleToggle = (event: CustomEvent<string>) => {
            if (onToggle) {
                onToggle(event.detail);
            }
        };

        const handleScroll = (event: CustomEvent<{ direction: 'up' | 'down' | 'left' | 'right'; amount?: number }>) => {
            if (onScroll) {
                onScroll(event.detail.direction, event.detail.amount);
            }
        };

        const handleChat = (event: CustomEvent<string>) => {
            if (onChat) {
                onChat(event.detail);
            }
        };

        window.addEventListener('voice:navigate', handleNavigate as EventListener);
        window.addEventListener('voice:execute', handleExecute as EventListener);
        window.addEventListener('voice:toggle', handleToggle as EventListener);
        window.addEventListener('voice:scroll', handleScroll as EventListener);
        window.addEventListener('voice:chat', handleChat as EventListener);

        return () => {
            window.removeEventListener('voice:navigate', handleNavigate as EventListener);
            window.removeEventListener('voice:execute', handleExecute as EventListener);
            window.removeEventListener('voice:toggle', handleToggle as EventListener);
            window.removeEventListener('voice:scroll', handleScroll as EventListener);
            window.removeEventListener('voice:chat', handleChat as EventListener);
        };
    }, [enabled, onNavigate, onExecute, onToggle, onScroll, onChat, settings.audioFeedback, speak]);

    /** Execute a scroll action */
    const executeScroll = useCallback((direction: 'up' | 'down' | 'left' | 'right', amount = 300) => {
        window.dispatchEvent(new CustomEvent('voice:scroll', {
            detail: { direction, amount }
        }));
    }, []);

    /** Execute a navigation action */
    const executeNavigation = useCallback((target: NavigationTarget) => {
        window.dispatchEvent(new CustomEvent('voice:navigate', {
            detail: target
        }));
    }, []);

    /** Execute a command action */
    const executeCommand = useCallback((command: string) => {
        window.dispatchEvent(new CustomEvent('voice:execute', {
            detail: command
        }));
    }, []);

    /** Execute a toggle action */
    const executeToggle = useCallback((setting: string) => {
        window.dispatchEvent(new CustomEvent('voice:toggle', {
            detail: setting
        }));
    }, []);

    /** Send a chat message via voice */
    const sendChatMessage = useCallback((message: string) => {
        window.dispatchEvent(new CustomEvent('voice:chat', {
            detail: message
        }));
    }, []);

    return {
        /** Current voice session state */
        session,
        /** Whether voice is currently listening */
        isListening: session.isListening,
        /** Whether voice is currently processing */
        isProcessing: session.isProcessing,
        /** Whether voice is currently speaking */
        isSpeaking: session.isSpeaking,
        /** Start listening for voice commands */
        startListening,
        /** Stop listening for voice commands */
        stopListening,
        /** Execute a scroll action programmatically */
        executeScroll,
        /** Execute a navigation action programmatically */
        executeNavigation,
        /** Execute a command action programmatically */
        executeCommand,
        /** Execute a toggle action programmatically */
        executeToggle,
        /** Send a chat message programmatically */
        sendChatMessage,
    };
}

export type { NavigationTarget, UseVoiceNavigationProps };
