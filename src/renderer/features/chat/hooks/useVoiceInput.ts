import { useCallback, useEffect, useRef,useState } from 'react'

export interface VoiceInputReturn {
    isListening: boolean
    startListening: () => void
    stopListening: () => void
    isSupported: boolean
}

type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string } }
type SpeechRecognitionResultListLike = { length: number; [index: number]: SpeechRecognitionResultLike }
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
    const [isListening, setIsListening] = useState(false)
    const [recognition, setRecognition] = useState<SpeechRecognitionLike | null>(null)
    const [isSupported, setIsSupported] = useState(false)

    const manualStop = useRef(false)

    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            setIsSupported(true)
            const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition
            if (!SpeechRecognitionCtor) {return}
            const recognitionInstance = new SpeechRecognitionCtor()

            recognitionInstance.continuous = true
            recognitionInstance.interimResults = false
            recognitionInstance.lang = language

            recognitionInstance.onresult = (event: SpeechRecognitionEventLike) => {
                let finalTranscript = ''
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript
                    }
                }
                if (finalTranscript) {onFinalResult(finalTranscript)}
            }

            recognitionInstance.onerror = (event: SpeechRecognitionErrorEventLike) => {
                console.error('Speech recognition error:', event.error)
                // 'no-speech' is common, don't stop strictly
                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    setIsListening(false)
                }
            }

            recognitionInstance.onend = () => {
                // If not manually stopped, try to restart (handling silence timeouts)
                if (!manualStop.current && isListening) {
                    try {
                        recognitionInstance.start()
                    } catch (e) {
                        setIsListening(false)
                    }
                } else {
                    setIsListening(false)
                }
            }

            setRecognition(recognitionInstance)
        }
    }, [language, onFinalResult, isListening]) // isListening dependency is tricky here

    const startListening = useCallback(() => {
        if (recognition) {
            manualStop.current = false
            try {
                recognition.start()
                setIsListening(true)
            } catch (error) {
                console.error('Failed to start recognition:', error)
            }
        }
    }, [recognition])

    const stopListening = useCallback(() => {
        if (recognition) {
            manualStop.current = true
            recognition.stop()
            setIsListening(false)
        }
    }, [recognition])

    return {
        isListening,
        startListening,
        stopListening,
        isSupported
    }
}
