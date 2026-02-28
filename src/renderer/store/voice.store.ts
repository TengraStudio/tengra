/**
 * Voice Store - External store for voice state management
 * UI-11: Voice-first interface option
 */

import {
    DEFAULT_VOICE_COMMANDS,
    DEFAULT_VOICE_SETTINGS,
    VoiceCommand,
    VoiceEvent,
    VoiceSessionState,
    VoiceSettings,
} from '@shared/types/voice';

/** Voice store state */
interface VoiceStore {
    settings: VoiceSettings;
    commands: VoiceCommand[];
    session: VoiceSessionState;
    listeners: Set<() => void>;
    eventListeners: Set<(event: VoiceEvent) => void>;
}

/** Create the voice store */
function createVoiceStore(): VoiceStore {
    return {
        settings: { ...DEFAULT_VOICE_SETTINGS },
        commands: [...DEFAULT_VOICE_COMMANDS],
        session: {
            isListening: false,
            isProcessing: false,
            isSpeaking: false,
            lastTranscript: '',
            lastCommand: null,
            error: null,
            wakeWordDetected: false,
        },
        listeners: new Set(),
        eventListeners: new Set(),
    };
}

// Singleton store instance
const store = createVoiceStore();
let sessionRevision = 0;
let cachedSessionRevision = -1;
let cachedSessionSnapshot: VoiceSessionState = { ...store.session };

/** Subscribe to store changes */
function subscribe(listener: () => void): () => void {
    store.listeners.add(listener);
    return () => {
        store.listeners.delete(listener);
    };
}

/** Subscribe to voice events */
function subscribeToEvents(listener: (event: VoiceEvent) => void): () => void {
    store.eventListeners.add(listener);
    return () => {
        store.eventListeners.delete(listener);
    };
}

/** Notify all listeners of state change */
function notifyListeners(): void {
    sessionRevision += 1;
    store.listeners.forEach((listener) => listener());
}

/** Notify event listeners */
function notifyEventListeners(event: VoiceEvent): void {
    store.eventListeners.forEach((listener) => listener(event));
}

/** Get current snapshot */
function getSnapshot(): VoiceSessionState {
    if (cachedSessionRevision !== sessionRevision) {
        cachedSessionSnapshot = { ...store.session };
        cachedSessionRevision = sessionRevision;
    }
    return cachedSessionSnapshot;
}

/** Get current settings */
function getSettings(): VoiceSettings {
    return { ...store.settings };
}

/** Get current commands */
function getCommands(): VoiceCommand[] {
    return [...store.commands];
}

/** Update settings */
function updateSettings(settings: Partial<VoiceSettings>): void {
    store.settings = { ...store.settings, ...settings };
    notifyListeners();
}

/** Update commands */
function updateCommands(commands: VoiceCommand[]): void {
    store.commands = commands;
    notifyListeners();
}

/** Add a command */
function addCommand(command: VoiceCommand): void {
    store.commands.push(command);
    notifyListeners();
}

/** Remove a command */
function removeCommand(commandId: string): void {
    const index = store.commands.findIndex((c) => c.id === commandId);
    if (index !== -1) {
        store.commands.splice(index, 1);
        notifyListeners();
    }
}

/** Update session state */
function updateSession(partial: Partial<VoiceSessionState>): void {
    store.session = { ...store.session, ...partial };
    notifyListeners();
}

/** Handle voice event from main process */
function handleVoiceEvent(event: VoiceEvent): void {
    switch (event.type) {
        case 'listening-started':
            store.session.isListening = true;
            store.session.error = null;
            break;
        case 'listening-stopped':
            store.session.isListening = false;
            store.session.wakeWordDetected = false;
            break;
        case 'wake-word-detected':
            store.session.wakeWordDetected = true;
            break;
        case 'command-recognized':
            if (event.data && typeof event.data === 'object' && 'id' in event.data) {
                store.session.lastCommand = event.data as VoiceCommand;
            }
            break;
        case 'command-executed':
            store.session.isProcessing = false;
            break;
        case 'speech-started':
            store.session.isSpeaking = true;
            break;
        case 'speech-ended':
            store.session.isSpeaking = false;
            break;
        case 'error':
            store.session.error = event.data instanceof Error
                ? event.data.message
                : String(event.data);
            break;
        case 'settings-updated':
            if (event.data && typeof event.data === 'object') {
                store.settings = event.data as unknown as VoiceSettings;
            }
            break;
        case 'command-added':
        case 'command-removed':
        case 'command-updated':
            // Commands will be re-fetched from main process
            break;
    }
    notifyListeners();
    notifyEventListeners(event);
}

/** Set listening state */
function setListening(isListening: boolean): void {
    store.session.isListening = isListening;
    notifyListeners();
}

/** Set processing state */
function setProcessing(isProcessing: boolean): void {
    store.session.isProcessing = isProcessing;
    notifyListeners();
}

/** Set speaking state */
function setSpeaking(isSpeaking: boolean): void {
    store.session.isSpeaking = isSpeaking;
    notifyListeners();
}

/** Set last transcript */
function setLastTranscript(transcript: string): void {
    store.session.lastTranscript = transcript;
    notifyListeners();
}

/** Set error */
function setError(error: string | null): void {
    store.session.error = error;
    notifyListeners();
}

/** Reset session state */
function resetSession(): void {
    store.session = {
        isListening: false,
        isProcessing: false,
        isSpeaking: false,
        lastTranscript: '',
        lastCommand: null,
        error: null,
        wakeWordDetected: false,
    };
    notifyListeners();
}

// Export the store API
export const voiceStore = {
    subscribe,
    subscribeToEvents,
    getSnapshot,
    getSettings,
    getCommands,
    updateSettings,
    updateCommands,
    addCommand,
    removeCommand,
    updateSession,
    handleVoiceEvent,
    setListening,
    setProcessing,
    setSpeaking,
    setLastTranscript,
    setError,
    resetSession,
};

export type { VoiceStore };
