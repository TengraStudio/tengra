import { useCallback, useEffect, useState } from 'react'

export function useOllamaManager() {
    const [isOllamaRunning, setIsOllamaRunning] = useState(false)
    const [statusMessage, setStatusMessage] = useState('')

    const checkOllama = useCallback(async () => {
        try {
            const running = await window.electron.isOllamaRunning()
            setIsOllamaRunning(!!running)
        } catch {
            setIsOllamaRunning(false)
        }
    }, [])

    useEffect(() => {
        void checkOllama()
    }, [checkOllama])

    const startOllama = useCallback(async () => {
        try {
            const result = await window.electron.startOllama()
            if (result.message) {
                setStatusMessage(result.message)
                setTimeout(() => setStatusMessage(''), 2000)
            }
        } catch (error) {
            console.error('Failed to start Ollama:', error)
        } finally {
            void checkOllama()
        }
    }, [checkOllama])

    return {
        isOllamaRunning,
        statusMessage,
        setStatusMessage,
        checkOllama,
        startOllama
    }
}
