/**
 * useVoice Hook - React hook for voice control
 * UI-11: Voice-first interface option
 */

import { VoiceCommand, VoiceEvent, VoiceInfo, VoiceSettings, VoiceSynthesisOptions } from '@shared/types/voice';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { voiceStore } from '@/store/voice.store';

/** Speech recognition interface */
interface BrowserSpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
    onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onspeechstart: (() => void) | null;
    onspeechend: (() => void) | null;
}

/** Speech recognition event */
interface BrowserSpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: BrowserSpeechRecognitionResultList;
}

interface BrowserSpeechRecognitionResultList {
    readonly length: number;
    item(index: number): BrowserSpeechRecognitionResult;
    [index: number]: BrowserSpeechRecognitionResult;
}

interface BrowserSpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): BrowserSpeechRecognitionAlternative;
    [index: number]: BrowserSpeechRecognitionAlternative;
}

interface BrowserSpeechRecognitionAlternative {
    readonly confidence: number;
    readonly transcript: string;
}

/** Speech recognition error event */
interface BrowserSpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

/** Get the SpeechRecognition constructor */
function getSpeechRecognition(): BrowserSpeechRecognitionConstructor | null {
    if (typeof window === 'undefined') {
        return null;
    }
    const voiceWindow = window as unknown as {
        SpeechRecognition: BrowserSpeechRecognitionConstructor;
        webkitSpeechRecognition: BrowserSpeechRecognitionConstructor;
    };
    return voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition ?? null;
}

/** Check if speech recognition is available */
export function isSpeechRecognitionAvailable(): boolean {
    return getSpeechRecognition() !== null;
}

/** Check if speech synthesis is available */
export function isSpeechSynthesisAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * useVoice Hook
 * Provides voice recognition and synthesis capabilities
 */
export function useVoice() {
    const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
    const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

    // Get session state from store
    const session = useSyncExternalStore(
        voiceStore.subscribe,
        voiceStore.getSnapshot
    );

    // Local state
    const [voices, setVoices] = useState<VoiceInfo[]>([]);
    const [isSupported, setIsSupported] = useState(false);

    /** Speak text using synthesis */
    const speak = useCallback((options: VoiceSynthesisOptions) => {
        if (!isSpeechSynthesisAvailable()) {
            voiceStore.setError('Speech synthesis not available');
            return;
        }

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(options.text);
        const settings = voiceStore.getSettings();
        utterance.rate = options.rate ?? settings.speechRate;
        utterance.pitch = options.pitch ?? settings.speechPitch;
        utterance.volume = options.volume ?? settings.speechVolume;

        if (options.voice) {
            const selectedVoice = voices.find((v) => v.id === options.voice);
            if (selectedVoice) {
                const synthVoices = window.speechSynthesis.getVoices();
                const voice = synthVoices.find((v) => v.voiceURI === selectedVoice.id);
                if (voice) {
                    utterance.voice = voice;
                }
            }
        }

        utterance.onstart = () => {
            voiceStore.setSpeaking(true);
        };

        utterance.onend = () => {
            voiceStore.setSpeaking(false);
        };

        utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
            voiceStore.setError(event.error);
            voiceStore.setSpeaking(false);
        };

        synthesisRef.current = utterance;
        window.speechSynthesis.speak(utterance);
    }, [voices]);

    /** Execute a voice command */
    const executeCommand = useCallback(async (command: VoiceCommand) => {
        await window.electron.voice.executeCommand(command);

        // Provide audio feedback if enabled
        const settings = voiceStore.getSettings();
        if (settings.enabled && settings.audioFeedback) {
            speak({ text: command.description });
        }

        // Handle navigation and other commands via CustomEvents
        const eventType = `voice:${command.action.type}`;
        const detail = command.action.type === 'navigate'
            ? command.action.target
            : command.action.type === 'execute'
                ? command.action.command
                : command.action;

        window.dispatchEvent(new CustomEvent(eventType, { detail }));
    }, [speak]);

    /** Handle transcript and match commands */
    const handleTranscript = useCallback(async (transcript: string) => {
        voiceStore.setProcessing(true);
        try {
            // Send to main process for command matching
            const result = await window.electron.voice.processTranscript(transcript);

            if (result.success && result.command) {
                voiceStore.updateSession({ lastCommand: result.command });
                await executeCommand(result.command);
            }
        } catch (error) {
            window.electron.log.error(`Voice: Failed to process transcript: ${error instanceof Error ? error.message : String(error)}`);
            voiceStore.setError(error instanceof Error ? error.message : 'Processing error');
        } finally {
            voiceStore.setProcessing(false);
        }
    }, [executeCommand]);

    // Initialize speech recognition
    useEffect(() => {
        const SpeechRecognitionClass = getSpeechRecognition();
        if (!SpeechRecognitionClass) {
            setIsSupported(false);
            return;
        }

        setIsSupported(true);
        const recognition = new SpeechRecognitionClass();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = voiceStore.getSettings().recognitionLanguage;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            voiceStore.setListening(true);
        };

        recognition.onend = () => {
            voiceStore.setListening(false);
        };

        recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
            const result = event.results[event.resultIndex];
            if (!result) {
                return;
            }

            const transcript = result[0]?.transcript || '';
            voiceStore.setLastTranscript(transcript);

            if (result.isFinal) {
                void handleTranscript(transcript);
            }
        };

        recognition.onerror = (event: BrowserSpeechRecognitionErrorEvent) => {
            voiceStore.setError(event.error);
            voiceStore.setListening(false);
        };

        recognitionRef.current = recognition;

        // Load available voices
        if (isSpeechSynthesisAvailable()) {
            const loadVoices = () => {
                const availableVoices = window.speechSynthesis.getVoices();
                setVoices(
                    availableVoices.map((voice) => ({
                        id: voice.voiceURI,
                        name: voice.name,
                        lang: voice.lang,
                        localService: voice.localService,
                        default: voice.default,
                    }))
                );
            };

            loadVoices();
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
        };
    }, [handleTranscript]);

    /** Start listening */
    const startListening = useCallback(() => {
        if (!recognitionRef.current) {
            voiceStore.setError('Speech recognition not available');
            return;
        }

        try {
            recognitionRef.current.start();
        } catch (error) {
            if (error instanceof Error && !error.message.includes('already started')) {
                voiceStore.setError(error.message);
            }
        }
    }, []);

    /** Stop listening */
    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
    }, []);

    /** Toggle listening */
    const toggleListening = useCallback(() => {
        if (session.isListening) {
            stopListening();
        } else {
            startListening();
        }
    }, [session.isListening, startListening, stopListening]);

    /** Stop speaking */
    const stopSpeaking = useCallback(() => {
        if (isSpeechSynthesisAvailable()) {
            window.speechSynthesis.cancel();
            voiceStore.setSpeaking(false);
        }
    }, []);

    /** Update voice settings */
    const updateSettings = useCallback(async (settings: Partial<VoiceSettings>) => {
        const result = await window.electron.voice.updateSettings(settings);
        if (result.success) {
            voiceStore.updateSettings(settings);
            if (settings.recognitionLanguage && recognitionRef.current) {
                recognitionRef.current.lang = settings.recognitionLanguage;
            }
        }
        return result;
    }, []);

    /** Get all commands */
    const getCommands = useCallback(async () => {
        const result = await window.electron.voice.getCommands();
        if (result) {
            voiceStore.updateCommands(result);
        }
        return result;
    }, []);

    /** Add a custom command */
    const addCommand = useCallback(async (command: VoiceCommand) => {
        const result = await window.electron.voice.addCommand(command);
        if (result.success) {
            voiceStore.addCommand(command);
        }
        return result;
    }, []);

    /** Remove a command */
    const removeCommand = useCallback(async (commandId: string) => {
        const result = await window.electron.voice.removeCommand(commandId);
        if (result.success) {
            voiceStore.removeCommand(commandId);
        }
        return result;
    }, []);

    /** Subscribe to voice events */
    const subscribeToEvents = useCallback((callback: (event: VoiceEvent) => void) => {
        return voiceStore.subscribeToEvents(callback);
    }, []);

    return {
        session,
        voices,
        isSupported,
        settings: voiceStore.getSettings(),
        startListening,
        stopListening,
        toggleListening,
        speak,
        stopSpeaking,
        updateSettings,
        getCommands,
        addCommand,
        removeCommand,
        subscribeToEvents,
    };
}

export type UseVoiceReturn = ReturnType<typeof useVoice>;
