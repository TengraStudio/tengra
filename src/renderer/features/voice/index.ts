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
 * Voice Feature Module
 * UI-11: Voice-first interface option
 */

// Hooks
export { isSpeechRecognitionAvailable, isSpeechSynthesisAvailable,useVoice } from './hooks/useVoice';
export type { NavigationTarget, UseVoiceNavigationProps } from './hooks/useVoiceNavigation';
export { useVoiceNavigation } from './hooks/useVoiceNavigation';

// Components
export { VoiceControl } from './components/VoiceControl';
export { VoiceSettingsPanel } from './components/VoiceSettingsPanel';

// Types
export type {
    DEFAULT_VOICE_COMMANDS,
    DEFAULT_VOICE_SETTINGS,
    VoiceAction,
    VoiceCommand,
    VoiceCommandCategory,
    VoiceEvent,
    VoiceEventType,
    VoiceInfo,
    VoiceRecognitionResult,
    VoiceSessionState,
    VoiceSettings,
    VoiceShortcut,
    VoiceSynthesisOptions,
} from '@shared/types/voice';

