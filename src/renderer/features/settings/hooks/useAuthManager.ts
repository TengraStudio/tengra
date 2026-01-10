import { useState } from 'react'
import { useSettingsLogic } from './useSettingsLogic'
import { SettingsCategory } from '../types'

export function useAuthManager() {
    const logic = useSettingsLogic()
    const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>('general')
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

    return {
        ...logic,
        language: logic.settings?.general?.language || 'en',
        settingsCategory,
        setSettingsCategory,
        isAuthModalOpen,
        setIsAuthModalOpen,
        handleAntigravityLogout: () => logic.disconnectProvider('antigravity'),
        appSettings: logic.settings,
        setAppSettings: logic.setSettings,
        quotas: logic.quotaData,
        codexUsage: logic.codexUsage,
        refresh: logic.refreshAuthStatus
    }
}
