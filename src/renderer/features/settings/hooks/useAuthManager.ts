import { useState, useEffect, useCallback } from 'react'
import { Language } from '@/i18n'

export function useAuthManager() {
    const [appSettings, setAppSettings] = useState<any>(null)
    const [language, setLanguage] = useState<Language>('tr')
    const [quotas, setQuotas] = useState<any>(null)
    const [codexUsage, setCodexUsage] = useState<any>(null)
    const [antigravityError, setAntigravityError] = useState<string | null>(null)
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
    const [showOnboarding, setShowOnboarding] = useState(false)
    const [settingsCategory, setSettingsCategory] = useState<'accounts' | 'general' | 'appearance' | 'models' | 'statistics' | 'gallery' | 'personas' | 'mcp-servers' | 'mcp-marketplace'>('general')

    const loadAppSettings = useCallback(async (selectedModel?: string, onModelSelect?: (provider: string, model: string) => void) => {
        try {
            const data = await window.electron.getSettings()

            try {
                const status = await window.electron.checkAuthStatus()
                const files = status?.files || []

                if (files.find((f: any) => f.provider === 'codex' || f.provider === 'openai')) {
                    if (!data.openai) data.openai = {}
                    data.openai.apiKey = 'connected'
                }
                if (files.find((f: any) => f.provider === 'claude' || f.provider === 'anthropic')) {
                    if (!data.claude) data.claude = {}
                    data.claude.apiKey = 'connected'
                }
                if (files.find((f: any) => f.provider === 'gemini' || f.provider === 'gemini-cli')) {
                    if (!data.gemini) data.gemini = {}
                    data.gemini.apiKey = 'connected'
                }
                if (files.find((f: any) => f.provider === 'antigravity')) {
                    if (!data.antigravity) data.antigravity = {}
                    data.antigravity.connected = true
                }
            } catch (e) {
                console.error('Auth check failed:', e)
            }

            setAppSettings(data)

            if (data?.general?.language) {
                setLanguage(data.general.language)
            }

            if (data?.general?.defaultModel && !selectedModel && onModelSelect) {
                const preferredModel = data.general.lastModel || data.general.defaultModel
                const preferredProvider = data.general.lastProvider || 'copilot'
                if (preferredModel) {
                    onModelSelect(preferredProvider, preferredModel)
                }
            }
        } catch (e) {
            console.error('Failed to load settings:', e)
        }
    }, [])

    const loadQuotas = useCallback(async () => {
        try {
            const q = await window.electron.getQuota()
            if (q) setQuotas(q)
            const u = await window.electron.getCodexUsage()
            if (u) setCodexUsage(u)
        } catch (e) { }
    }, [])

    const checkAntigravityAuth = useCallback(async () => {
        if (!appSettings?.antigravity?.connected) return

        try {
            const quota = await window.electron.getQuota()
            if (quota?.authExpired) {
                setAntigravityError('Google Antigravity oturumunuzun sÃ¼resi doldu.')
                setIsAuthModalOpen(true)
                return
            }

            const modelsResp: any = await window.electron.getModels()
            if (modelsResp?.antigravityError) {
                setAntigravityError(modelsResp.antigravityError)
                setIsAuthModalOpen(true)
            }
        } catch (e: any) {
            console.error('[useAuthManager] Global auth check failed:', e.message)
        }
    }, [appSettings?.antigravity?.connected])

    const handleAntigravityLogout = async () => {
        try {
            await window.electron.deleteProxyAuthFile('antigravity')
            setAppSettings((prev: any) => ({
                ...prev,
                antigravity: { ...prev?.antigravity, connected: false }
            }))
        } catch (e) {
            console.error('Logout failed:', e)
        }
    }

    useEffect(() => {
        loadAppSettings()
        loadQuotas()
    }, [loadAppSettings, loadQuotas])

    useEffect(() => {
        if (!appSettings) return

        if (appSettings.general?.theme) {
            const theme = appSettings.general.theme
            const effectiveTheme = (theme === 'dark') ? 'graphite' : theme
            document.documentElement.setAttribute('data-theme', effectiveTheme)
        }

        if (appSettings.general?.onboardingCompleted === false) {
            setShowOnboarding(true)
        }

        const fontSize = appSettings.general?.fontSize || 14
        const fontFamily = appSettings.general?.fontFamily || 'Inter, sans-serif'
        document.documentElement.style.fontSize = `${fontSize}px`
        document.documentElement.style.fontFamily = fontFamily
    }, [appSettings])

    useEffect(() => {
        checkAntigravityAuth()
        const timer = setInterval(checkAntigravityAuth, 30000)
        return () => clearInterval(timer)
    }, [checkAntigravityAuth])

    return {
        appSettings,
        setAppSettings,
        language,
        setLanguage,
        quotas,
        codexUsage,
        antigravityError,
        setAntigravityError,
        isAuthModalOpen,
        setIsAuthModalOpen,
        showOnboarding,
        setShowOnboarding,
        loadAppSettings,
        loadQuotas,
        settingsCategory,
        setSettingsCategory,
        handleAntigravityLogout
    }
}
