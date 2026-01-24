
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { AppSettings, JsonValue } from '@/types'

interface SettingsContextType {
    settings: AppSettings | null
    isLoading: boolean
    updateSettings: (newSettings: AppSettings, saveImmediately?: boolean) => Promise<void>
    reloadSettings: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextType | null>(null)

const deepEqual = (obj1: JsonValue, obj2: JsonValue) => JSON.stringify(obj1) === JSON.stringify(obj2)

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<AppSettings | null>(null)
    const [originalSettings, setOriginalSettings] = useState<AppSettings | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const reloadSettings = useCallback(async () => {
        try {
            const data = await window.electron.getSettings()
            setSettings(data)
            setOriginalSettings(structuredClone(data))
        } catch (error) {
            console.error('Failed to load settings:', error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        void reloadSettings()
    }, [reloadSettings])

    const updateSettings = useCallback(async (newSettings: AppSettings, saveImmediately = true) => {
        setSettings(newSettings)
        if (saveImmediately) {
            try {
                await window.electron.saveSettings(newSettings)
                setOriginalSettings(structuredClone(newSettings))
            } catch (error) {
                console.error('Failed to save settings:', error)
            }
        }
    }, [])

    // Auto-save logic
    useEffect(() => {
        if (!settings || !originalSettings) { return }
        if (deepEqual(settings, originalSettings)) { return }

        const timeout = setTimeout(() => {
            void (async () => {
                try {
                    await window.electron.saveSettings(settings)
                    setOriginalSettings(structuredClone(settings))
                } catch (error) {
                    console.error('Auto-save failed:', error)
                }
            })()
        }, 2000)

        return () => clearTimeout(timeout)
    }, [settings, originalSettings])

    // Apply global appearances settings
    useEffect(() => {
        if (settings?.general?.fontSize) {
            document.documentElement.style.setProperty('--font-size-base', `${settings.general.fontSize}px`)
        }
        if (settings?.general?.theme) {
            document.documentElement.setAttribute('data-theme', settings.general.theme)
        }
    }, [settings?.general?.fontSize, settings?.general?.theme])

    const value = useMemo(() => ({
        settings,
        isLoading,
        updateSettings,
        reloadSettings
    }), [settings, isLoading, updateSettings, reloadSettings])

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    )
}

export function useSettings() {
    const context = useContext(SettingsContext)
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider')
    }
    return context
}
