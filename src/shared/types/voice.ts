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
 * Voice interface types for UI-11: Voice-first interface option
 */

import { JsonValue } from './common';

/** Voice command definition */
export interface VoiceCommand {
    id: string;
    phrase: string;
    aliases: string[];
    action: VoiceAction;
    category: VoiceCommandCategory;
    description: string;
    enabled: boolean;
    isSystem?: boolean;
    [key: string]: JsonValue | undefined;
}

/** Voice action types */
export type VoiceAction =
    | { type: 'navigate'; target: string }
    | { type: 'execute'; command: string }
    | { type: 'toggle'; setting: string }
    | { type: 'select'; target: string }
    | { type: 'scroll'; direction: 'up' | 'down' | 'left' | 'right'; amount?: number }
    | { type: 'chat'; message: string }
    | { type: 'custom'; handlerId: string };

/** Voice command categories */
export type VoiceCommandCategory =
    | 'navigation'
    | 'actions'
    | 'chat'
    | 'settings'
    | 'accessibility'
    | 'custom';

/** Voice recognition result */
export interface VoiceRecognitionResult {
    success: boolean;
    transcript: string;
    confidence: number;
    isFinal: boolean;
    error?: string;
    timestamp: number;
    [key: string]: JsonValue | undefined;
}

/** Voice synthesis options */
export interface VoiceSynthesisOptions {
    text: string;
    rate?: number;
    pitch?: number;
    volume?: number;
    voice?: string;
    lang?: string;
    [key: string]: JsonValue | undefined;
}

/** Voice settings */
export interface VoiceSettings {
    /** Enable voice control */
    enabled: boolean;
    /** Wake word for activation */
    wakeWord: string;
    /** Custom wake words */
    customWakeWords: string[];
    /** Voice recognition language */
    recognitionLanguage: string;
    /** Voice synthesis voice ID */
    synthesisVoice: string;
    /** Speech rate (0.1 - 10) */
    speechRate: number;
    /** Speech pitch (0 - 2) */
    speechPitch: number;
    /** Speech volume (0 - 1) */
    speechVolume: number;
    /** Enable audio feedback for actions */
    audioFeedback: boolean;
    /** Enable visual feedback for voice */
    visualFeedback: boolean;
    /** Accessibility mode - enhanced feedback */
    accessibilityMode: boolean;
    /** Voice shortcuts */
    shortcuts: VoiceShortcut[];
    /** Custom commands */
    customCommands: VoiceCommand[];
    /** Continuous listening mode */
    continuousListening: boolean;
    /** Silence timeout in ms before processing */
    silenceTimeout: number;
    [key: string]: JsonValue | undefined;
}

/** Voice shortcut for common actions */
export interface VoiceShortcut {
    id: string;
    phrase: string;
    action: string;
    enabled: boolean;
    [key: string]: JsonValue | undefined;
}

/** Voice session state */
export interface VoiceSessionState {
    isListening: boolean;
    isProcessing: boolean;
    isSpeaking: boolean;
    lastTranscript: string;
    lastCommand: VoiceCommand | null;
    error: string | null;
    wakeWordDetected: boolean;
}

/** Available voice info */
export interface VoiceInfo {
    id: string;
    name: string;
    lang: string;
    localService: boolean;
    default: boolean;
    [key: string]: JsonValue | undefined;
}

/** Voice event types */
export type VoiceEventType =
    | 'listening-started'
    | 'listening-stopped'
    | 'wake-word-detected'
    | 'command-recognized'
    | 'command-executed'
    | 'command-added'
    | 'command-removed'
    | 'command-updated'
    | 'settings-updated'
    | 'speech-started'
    | 'speech-ended'
    | 'error';

/** Voice event callback */
export interface VoiceEvent {
    type: VoiceEventType;
    timestamp: number;
    data?: VoiceRecognitionResult | VoiceCommand | string | Error;
}

/** Default voice settings */
export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
    enabled: false,
    wakeWord: 'tengra',
    customWakeWords: [],
    recognitionLanguage: 'en-US',
    synthesisVoice: '',
    speechRate: 1.0,
    speechPitch: 1.0,
    speechVolume: 0.8,
    audioFeedback: true,
    visualFeedback: true,
    accessibilityMode: false,
    shortcuts: [],
    customCommands: [],
    continuousListening: false,
    silenceTimeout: 1500,
};

/** Default voice commands */
export const DEFAULT_VOICE_COMMANDS: VoiceCommand[] = [
    {
        id: 'nav-home',
        phrase: 'go home',
        aliases: ['go to home', 'navigate home', 'show home'],
        action: { type: 'navigate', target: 'home' },
        category: 'navigation',
        description: 'Navigate to home screen',
        enabled: true,
    },
    {
        id: 'nav-settings',
        phrase: 'open settings',
        aliases: ['go to settings', 'show settings', 'settings'],
        action: { type: 'navigate', target: 'settings' },
        category: 'navigation',
        description: 'Open settings panel',
        enabled: true,
    },
    {
        id: 'nav-chat',
        phrase: 'new chat',
        aliases: ['start chat', 'new conversation', 'begin chat'],
        action: { type: 'navigate', target: 'chat' },
        category: 'navigation',
        description: 'Start a new chat',
        enabled: true,
    },
    {
        id: 'nav-workspaces',
        phrase: 'show workspaces',
        aliases: ['open workspaces', 'go to workspaces', 'my workspaces'],
        action: { type: 'navigate', target: 'workspaces' },
        category: 'navigation',
        description: 'Open workspaces panel',
        enabled: true,
    },
    {
        id: 'nav-models',
        phrase: 'show models',
        aliases: ['open models', 'model selection', 'choose model'],
        action: { type: 'navigate', target: 'models' },
        category: 'navigation',
        description: 'Open model selection',
        enabled: true,
    },
    {
        id: 'action-send',
        phrase: 'send message',
        aliases: ['send', 'submit'],
        action: { type: 'execute', command: 'chat-send' },
        category: 'actions',
        description: 'Send the current message',
        enabled: true,
    },
    {
        id: 'action-clear',
        phrase: 'clear chat',
        aliases: ['clear conversation', 'new chat'],
        action: { type: 'execute', command: 'chat-clear' },
        category: 'actions',
        description: 'Clear the current chat',
        enabled: true,
    },
    {
        id: 'action-copy',
        phrase: 'copy response',
        aliases: ['copy last response', 'copy answer'],
        action: { type: 'execute', command: 'copy-last-response' },
        category: 'actions',
        description: 'Copy the last AI response',
        enabled: true,
    },
    {
        id: 'scroll-up',
        phrase: 'scroll up',
        aliases: ['page up', 'go up'],
        action: { type: 'scroll', direction: 'up', amount: 300 },
        category: 'navigation',
        description: 'Scroll up',
        enabled: true,
    },
    {
        id: 'scroll-down',
        phrase: 'scroll down',
        aliases: ['page down', 'go down'],
        action: { type: 'scroll', direction: 'down', amount: 300 },
        category: 'navigation',
        description: 'Scroll down',
        enabled: true,
    },
    {
        id: 'toggle-voice',
        phrase: 'stop listening',
        aliases: ['stop voice', 'turn off voice'],
        action: { type: 'toggle', setting: 'voice-enabled' },
        category: 'settings',
        description: 'Stop voice recognition',
        enabled: true,
    },
    {
        id: 'help',
        phrase: 'voice help',
        aliases: ['show voice commands', 'what can I say', 'voice commands'],
        action: { type: 'execute', command: 'show-voice-help' },
        category: 'accessibility',
        description: 'Show available voice commands',
        enabled: true,
    },
];

