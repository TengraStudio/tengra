import { useState, useCallback, useEffect } from 'react'

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
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [isSupported, setIsSupported] = useState(false)
    const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null)

    useEffect(() => {
        if ('speechSynthesis' in window) {
            setIsSupported(true)
        }
    }, [])

    const stop = useCallback(() => {
        if (!isSupported) return
        window.speechSynthesis.cancel()
        setIsSpeaking(false)
        setSpeakingMessageId(null)
    }, [isSupported])

    const speak = useCallback((text: string, messageId?: string) => {
        if (!isSupported) return

        // Cancel any ongoing speech
        window.speechSynthesis.cancel()

        const utterance = new SpeechSynthesisUtterance(text)

        if (options.voice) utterance.voice = options.voice
        if (options.rate) utterance.rate = options.rate
        if (options.pitch) utterance.pitch = options.pitch
        if (options.volume) utterance.volume = options.volume

        utterance.onstart = () => {
            setIsSpeaking(true)
            if (messageId) setSpeakingMessageId(messageId)
        }
        utterance.onend = () => {
            setIsSpeaking(false)
            setSpeakingMessageId(null)
            options.onEnd?.()
        }
        utterance.onerror = () => {
            setIsSpeaking(false)
            setSpeakingMessageId(null)
        }

        window.speechSynthesis.speak(utterance)
    }, [isSupported, options.voice, options.rate, options.pitch, options.volume, options.onEnd])

    return {
        speak,
        stop,
        isSpeaking,
        isSupported,
        speakingMessageId
    }
}
