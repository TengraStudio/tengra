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
