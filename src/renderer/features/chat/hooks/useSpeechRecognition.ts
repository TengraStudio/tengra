import { useCallback, useState } from 'react';

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
        SpeechRecognition?: SpeechRecognitionConstructor
        webkitSpeechRecognition?: SpeechRecognitionConstructor
        _activeRecognition?: SpeechRecognitionLike
    }
}

export const useSpeechRecognition = (
    language: string,
    onResult: (transcript: string) => void
) => {
    const [isListening, setIsListening] = useState(false);

    const startListening = useCallback(() => {
        const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
        if (!SpeechRecognitionCtor) {
            console.error('Speech recognition not supported');
            return;
        }

        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = language ?? 'tr-TR';

        recognition.onresult = (event: SpeechRecognitionEventLike) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const result = event.results[i];
                if (result?.isFinal) {
                    finalTranscript += result[0]?.transcript ?? '';
                }
            }
            if (finalTranscript) {
                onResult(finalTranscript);
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        try {
            recognition.start();
            setIsListening(true);
            window._activeRecognition = recognition;
        } catch (err) {
            console.error('Failed to start recognition:', err);
            setIsListening(false);
        }
    }, [language, onResult]);

    const stopListening = useCallback(() => {
        if (window._activeRecognition) {
            window._activeRecognition.stop();
            delete window._activeRecognition;
            setIsListening(false);
        }
    }, []);

    return {
        isListening,
        startListening,
        stopListening
    };
};
