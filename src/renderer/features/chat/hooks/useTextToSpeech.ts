import { useCallback, useState } from 'react';

export interface TextToSpeechReturn {
    speak: (text: string, messageId?: string) => void
    stop: () => void
    isSpeaking: boolean
    isSupported: boolean
    speakingMessageId: string | null
}

interface TTSOptions {
    voice?: SpeechSynthesisVoice | null
    rate?: number
    pitch?: number
    volume?: number
    onEnd?: () => void
}

export function useTextToSpeech(options: TTSOptions = {}): TextToSpeechReturn {
    const { voice, rate, pitch, volume, onEnd } = options;

    const [isSpeaking, setIsSpeaking] = useState(false);
    const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
    const [isSupported] = useState(() => {
        if (typeof window === 'undefined') { return false; }
        return 'speechSynthesis' in window;
    });

    const stop = useCallback(() => {
        if (!isSupported) { return; }
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setSpeakingMessageId(null);
    }, [isSupported]);

    const speak = useCallback((text: string, messageId?: string) => {
        if (!isSupported) { return; }

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        if (voice) { utterance.voice = voice; }
        if (rate) { utterance.rate = rate; }
        if (pitch) { utterance.pitch = pitch; }
        if (volume) { utterance.volume = volume; }

        utterance.onstart = () => {
            setIsSpeaking(true);
            if (messageId) { setSpeakingMessageId(messageId); }
        };
        utterance.onend = () => {
            setIsSpeaking(false);
            setSpeakingMessageId(null);
            onEnd?.();
        };
        utterance.onerror = () => {
            setIsSpeaking(false);
            setSpeakingMessageId(null);
        };

        window.speechSynthesis.speak(utterance);
    }, [isSupported, voice, rate, pitch, volume, onEnd]);

    return {
        speak,
        stop,
        isSpeaking,
        isSupported,
        speakingMessageId
    };
}
