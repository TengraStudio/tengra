import { useCallback, useEffect, useRef, useState } from 'react';

export interface VoiceInputReturn {
    isListening: boolean
    startListening: () => void
    stopListening: () => void
    isSupported: boolean
}

type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string } }
type SpeechRecognitionResultListLike = { length: number;[index: number]: SpeechRecognitionResultLike }
type SpeechRecognitionEventLike = { resultIndex: number; results: SpeechRecognitionResultListLike }
type SpeechRecognitionErrorEventLike = { error: string }

interface SpeechRecognitionLike {
    continuous: boolean
    interimResults: boolean
    lang: string
    onresult: ((event: SpeechRecognitionEventLike) => void) | null
    onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
    onend: (() => void) | null
    start: () => void
    stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

declare global {
    interface Window {
        webkitSpeechRecognition?: SpeechRecognitionConstructor
        SpeechRecognition?: SpeechRecognitionConstructor
    }
}

export function useVoiceInput(onFinalResult: (text: string) => void, language: string = 'tr-TR'): VoiceInputReturn {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const [isSupported] = useState(() => {
        if (typeof window === 'undefined') { return false; }
        return ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);
    });

    const manualStop = useRef(false);

    useEffect(() => {
        if (isSupported) {
            const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognitionCtor) { return; }
            const recognitionInstance = new SpeechRecognitionCtor();
            recognitionInstance.lang = language;

            recognitionInstance.onresult = (event: SpeechRecognitionEventLike) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    }
                }
                if (finalTranscript) { onFinalResult(finalTranscript); }
            };

            recognitionInstance.onerror = (event: SpeechRecognitionErrorEventLike) => {
                console.error('Speech recognition error:', event.error);
                // 'no-speech' is common, don't stop strictly
                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    setIsListening(false);
                }
            };

            recognitionInstance.onend = () => {
                // If not manually stopped, try to restart (handling silence timeouts)
                if (!manualStop.current && isListening) {
                    try {
                        recognitionInstance.start();
                    } catch {
                        setIsListening(false);
                    }
                } else {
                    setIsListening(false);
                }
            };

            recognitionRef.current = recognitionInstance;
        }
    }, [language, onFinalResult, isListening, isSupported]);

    const startListening = useCallback(() => {
        if (recognitionRef.current) {
            manualStop.current = false;
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch (error) {
                console.error('Failed to start recognition:', error);
            }
        }
    }, []);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            manualStop.current = true;
            recognitionRef.current.stop();
            setIsListening(false);
        }
    }, []);

    return {
        isListening,
        startListening,
        stopListening,
        isSupported
    };
}
