/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useState } from 'react';

import { handleError } from '@/utils/error-handler.util';

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
            handleError(new Error('Speech recognition not supported'), 'SpeechRecognition.startListening', { userFacing: false });
            return;
        }

        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = language;

        recognition.onresult = (event: SpeechRecognitionEventLike) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalTranscript += result[0].transcript || '';
                }
            }
            if (finalTranscript) {
                onResult(finalTranscript);
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
            handleError(new Error(event.error), 'SpeechRecognition.onerror', { userFacing: false });
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
            handleError(err as TypeAssertionValue, 'SpeechRecognition.start');
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


