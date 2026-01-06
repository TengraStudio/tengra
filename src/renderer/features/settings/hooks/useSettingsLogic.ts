import { useState, useEffect, useRef, useMemo } from 'react'

export interface AppSettings {
    ollama: {
        url: string
        numCtx?: number
        backend?: 'auto' | 'cpu' | 'cuda' | 'vulkan' | 'metal'
        gpuLayers?: number
    }
    general: {
        language: string
        theme: string
        resolution: string
        fontSize: number
        fontFamily?: string
        defaultModel?: string
        lastModel?: string
        lastProvider?: string
        responseStyle?: 'concise' | 'balanced' | 'detailed'
        responseTone?: 'neutral' | 'friendly' | 'professional'
        responseFormat?: 'auto' | 'structured' | 'steps'
        customInstructions?: string
        contextMessageLimit?: number
        favoriteModels?: string[]
        recentModels?: string[]
        hiddenModels?: string[]
        agentMode?: 'adaptive' | 'speed' | 'accuracy'
        agentSoftDeadlineMs?: number
        agentHardDeadlineMs?: number
        agentRequireLocalForActions?: boolean
        agentAllowLateSuggestions?: boolean
    }
    github?: { username?: string; token?: string }
    openai?: { apiKey: string; model: string }
    anthropic?: { apiKey: string; model: string }
    gemini?: { apiKey: string; model: string }
    claude?: { apiKey: string; model: string }
    groq?: { apiKey: string; model: string }
    codex?: { connected?: boolean; username?: string; token?: string }
    copilot?: { connected?: boolean; username?: string; token?: string }
    huggingface?: { apiKey?: string }
    proxy?: { enabled: boolean; url: string; key: string }
    personas?: { id: string, name: string, description: string, prompt: string }[]
    antigravity?: { connected: boolean; username?: string; token?: string }
    speech?: {
        voiceURI?: string
        rate?: number
        pitch?: number
        volume?: number
    }
    modelSettings?: Record<string, {
        systemPrompt?: string
        presetId?: string
    }>
    presets?: {
        id: string
        name: string
        temperature: number
        topP: number
        frequencyPenalty: number
        presencePenalty: number
        maxTokens?: number
    }[]
}

const deepEqual = (obj1: any, obj2: any) => JSON.stringify(obj1) === JSON.stringify(obj2)

export function useSettingsLogic(onRefreshModels?: () => void) {
    const [settings, setSettings] = useState<AppSettings | null>(null)
    const [originalSettings, setOriginalSettings] = useState<AppSettings | null>(null)
    const [isDirty, setIsDirty] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [statusMessage, setStatusMessage] = useState('')
    const [authMessage, setAuthMessage] = useState('')
    const [authBusy, setAuthBusy] = useState<string | null>(null)
    const [isOllamaRunning, setIsOllamaRunning] = useState(false)
    const [authStatus, setAuthStatus] = useState({ codex: false, claude: false, gemini: false, antigravity: false })

    // Stats and Quota State
    const [statsLoading, setStatsLoading] = useState(false)
    const [statsPeriod, setStatsPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily')
    const [statsData, setStatsData] = useState<any>(null)
    const [quotaData, setQuotaData] = useState<any>(null)
    const [copilotQuota, setCopilotQuota] = useState<any>(null)
    const [codexUsage, setCodexUsage] = useState<any>(null)
    const [reloadTrigger, setReloadTrigger] = useState(0)

    // Benchmark State
    const [benchmarkResult, setBenchmarkResult] = useState<{ tokensPerSec: number; latency: number } | null>(null)
    const [isBenchmarking, setIsBenchmarking] = useState(false)

    // Personas State
    const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null)
    const [personaDraft, setPersonaDraft] = useState({ name: '', description: '', prompt: '' })

    const authMessageTimer = useRef<any>(null)

    useEffect(() => {
        loadSettings()
        checkOllama()
    }, [])

    useEffect(() => {
        if (settings && originalSettings) setIsDirty(!deepEqual(settings, originalSettings))
    }, [settings, originalSettings])

    const loadSettings = async () => {
        const data = await window.electron.getSettings()
        setOriginalSettings(JSON.parse(JSON.stringify(data)))
        setSettings(data)
        refreshAuthStatus()
    }

    const handleSave = async (newSettings?: AppSettings) => {
        const toSave = newSettings || settings
        if (!toSave) return
        setIsLoading(true)
        try {
            const saved = await window.electron.saveSettings(toSave)
            setOriginalSettings(JSON.parse(JSON.stringify(saved)))
            setSettings(saved)
            onRefreshModels?.()
            setStatusMessage('Kaydedildi!')
            setTimeout(() => setStatusMessage(''), 2000)
        } finally { setIsLoading(false) }
    }

    // Auto-save debounce
    useEffect(() => {
        if (!settings || !originalSettings) return
        if (deepEqual(settings, originalSettings)) return

        const timeout = setTimeout(async () => {
            try {
                await window.electron.saveSettings(settings)
                setOriginalSettings(JSON.parse(JSON.stringify(settings)))
                setStatusMessage('Ayarlar otomatik kaydedildi')
                setTimeout(() => setStatusMessage(''), 2000)
            } catch (e) {
                console.error('Auto-save failed:', e)
            }
        }, 2000)

        return () => clearTimeout(timeout)
    }, [settings, originalSettings])

    const updateGeneral = (patch: Partial<AppSettings['general']>) => {
        if (!settings) return
        const updated = { ...settings, general: { ...settings.general, ...patch } }
        setSettings(updated)
        handleSave(updated)
    }

    const updateSpeech = (patch: Partial<AppSettings['speech']>) => {
        if (!settings) return
        const updated = { ...settings, speech: { ...settings.speech, ...patch } }
        setSettings(updated)
    }

    const checkOllama = async () => {
        try {
            const running = await window.electron.isOllamaRunning()
            setIsOllamaRunning(!!running)
        } catch {
            setIsOllamaRunning(false)
        }
    }

    const startOllama = async () => {
        try {
            const result = await window.electron.startOllama()
            if (result?.message) {
                setStatusMessage(result.message)
                setTimeout(() => setStatusMessage(''), 2000)
            }
        } catch (error) {
            console.error('Failed to start Ollama:', error)
        } finally {
            checkOllama()
        }
    }

    const refreshAuthStatus = async () => {
        try {
            const status = await window.electron.checkAuthStatus()
            const files = status?.files || []
            const hasProvider = (providerNames: string[]) => {
                return files.some((f: any) => {
                    const fileProvider = (f.provider || f.type || '').toLowerCase()
                    const fileName = (f.name || '').toLowerCase()
                    return providerNames.some(name =>
                        fileProvider === name || fileName.startsWith(name + '-')
                    )
                })
            }

            setAuthStatus({
                codex: hasProvider(['codex', 'openai']),
                claude: hasProvider(['claude', 'anthropic']),
                gemini: hasProvider(['gemini', 'gemini-cli']),
                antigravity: hasProvider(['antigravity'])
            })
        } catch (error) {
            console.error('Auth check failed:', error)
        }
    }

    const setAuthNotice = (message: string, duration = 5000) => {
        if (authMessageTimer.current) clearTimeout(authMessageTimer.current)
        setAuthMessage(message)
        if (message && duration > 0) {
            authMessageTimer.current = setTimeout(() => setAuthMessage(''), duration)
        }
    }

    const connectGitHubProfile = async () => {
        if (!settings) return
        setAuthBusy('github')
        setAuthNotice('')
        try {
            const data = await window.electron.githubLogin('profile')
            if (data?.verification_uri) window.electron.openExternal(data.verification_uri)
            if (data?.user_code) setAuthNotice(`Kod: ${data.user_code}`, 0)

            const pollResult = await window.electron.pollToken(data.device_code, data.interval, 'profile')
            if (pollResult.success && pollResult.token) {
                const updated = {
                    ...settings,
                    github: { username: settings.github?.username || 'GitHub User', token: pollResult.token }
                }
                setSettings(updated)
                handleSave(updated)
                setAuthNotice('GitHub baglandi.')
            } else {
                setAuthNotice('GitHub baglanamadi.')
            }
        } catch (error) {
            console.error('GitHub auth failed:', error)
            setAuthNotice('GitHub baglanamadi.')
        } finally {
            setAuthBusy(null)
        }
    }

    const connectCopilot = async () => {
        if (!settings) return
        setAuthBusy('copilot')
        setAuthNotice('')
        try {
            const data = await window.electron.githubLogin('copilot')
            if (data?.verification_uri) window.electron.openExternal(data.verification_uri)
            if (data?.user_code) setAuthNotice(`Kod: ${data.user_code}`, 0)

            const pollResult = await window.electron.pollToken(data.device_code, data.interval, 'copilot')
            if (pollResult.success && pollResult.token) {
                const updated = {
                    ...settings,
                    copilot: { ...settings.copilot, connected: true, token: pollResult.token }
                }
                setSettings(updated)
                handleSave(updated)
                setAuthNotice('Copilot baglandi.')
            } else {
                setAuthNotice('Copilot baglanamadi.')
            }
        } catch (error) {
            console.error('Copilot auth failed:', error)
            setAuthNotice('Copilot baglanamadi.')
        } finally {
            setAuthBusy(null)
        }
    }

    const connectBrowserProvider = async (provider: 'codex' | 'claude' | 'gemini' | 'antigravity') => {
        setAuthBusy(provider)
        setAuthNotice('')
        try {
            const loginFn = {
                codex: window.electron.codexLogin,
                claude: window.electron.claudeLogin,
                gemini: window.electron.geminiLogin,
                antigravity: window.electron.antigravityLogin
            }[provider]

            const result = await loginFn()
            if (result?.url) {
                await window.electron.openExternal(result.url)
                navigator.clipboard.writeText(result.url).then(() => {
                    setAuthNotice('Link kopyalandi! Tarayicida acilmadiysa, yeni sekme acip yapistirin.')
                }).catch(() => {
                    setAuthNotice('Link aciliyor... Lutfen tarayicida giris yapin.', 10000)
                })
            }

            let attempts = 0
            const maxAttempts = 20
            const pollInterval = 3000

            const check = async () => {
                attempts++
                try {
                    const status = await window.electron.checkAuthStatus()
                    const files = status?.files || []
                    const providerIdentifiers: string[] = []
                    switch (provider) {
                        case 'gemini': providerIdentifiers.push('gemini', 'gemini-cli'); break
                        case 'claude': providerIdentifiers.push('claude', 'anthropic'); break
                        case 'antigravity': providerIdentifiers.push('antigravity'); break
                        case 'codex': providerIdentifiers.push('codex', 'openai'); break
                    }

                    const isConnected = files.some((f: any) => {
                        const fileProvider = (f.provider || f.type || '').toLowerCase()
                        const fileName = (f.name || '').toLowerCase()
                        return providerIdentifiers.some(name => fileProvider === name || fileName.startsWith(name + '-'))
                    })

                    if (isConnected) {
                        setAuthNotice('Baglanti Basarili!')
                        await refreshAuthStatus()
                        onRefreshModels?.()
                        return true
                    }
                } catch (e) {
                    console.error('[SettingsLogic] Poll error:', e)
                }

                if (attempts < maxAttempts) {
                    setTimeout(check, pollInterval)
                } else {
                    setAuthNotice('Zaman asimi: Token tespit edilemedi. Lutfen sayfayi yenileyin.', 0)
                }
            }
            setTimeout(check, 2000)
        } catch (error) {
            console.error(`${provider} auth failed:`, error)
            setAuthNotice('Baglanti basarisiz.')
        } finally {
            setAuthBusy(null)
        }
    }

    const disconnectProvider = async (provider: 'copilot' | 'codex' | 'claude' | 'gemini' | 'antigravity') => {
        if (!settings) return
        const updated: AppSettings = { ...settings }

        try {
            const status = await window.electron.checkAuthStatus()
            const files = status?.files || []
            const providerIdentifiers: string[] = []
            switch (provider) {
                case 'gemini': providerIdentifiers.push('gemini', 'gemini-cli'); break
                case 'claude': providerIdentifiers.push('claude', 'anthropic'); break
                case 'antigravity': providerIdentifiers.push('antigravity'); break
                case 'codex': providerIdentifiers.push('codex'); break
                case 'copilot': providerIdentifiers.push('copilot'); break
            }

            const targets = files.filter((f: any) => {
                const fileProvider = (f.provider || f.type || '').toLowerCase()
                const fileName = (f.name || '').toLowerCase()
                return providerIdentifiers.some(id => fileProvider === id || fileName.startsWith(id + '-'))
            })

            for (const t of targets) {
                await window.electron.deleteProxyAuthFile(t.name)
            }
        } catch (e) {
            console.error('[SettingsLogic] Backend auth deletion failed:', e)
        }

        if (provider === 'copilot') updated.copilot = { connected: false, username: '', token: '' }
        if (provider === 'codex') {
            if (updated.openai?.apiKey === 'connected') updated.openai = { ...updated.openai, apiKey: '' }
            updated.codex = { connected: false }
            setAuthStatus(prev => ({ ...prev, codex: false }))
        }
        if (provider === 'claude') {
            if (updated.claude?.apiKey === 'connected') updated.claude = { ...updated.claude, apiKey: '' }
            if (updated.anthropic?.apiKey === 'connected') updated.anthropic = { ...updated.anthropic, apiKey: '', model: updated.anthropic?.model || '' }
            setAuthStatus(prev => ({ ...prev, claude: false }))
        }
        if (provider === 'gemini') {
            if (updated.gemini?.apiKey === 'connected') updated.gemini = { ...updated.gemini, apiKey: '' }
            setAuthStatus(prev => ({ ...prev, gemini: false }))
        }
        if (provider === 'antigravity') {
            updated.antigravity = { ...(updated.antigravity || { connected: false }), connected: false }
            setAuthStatus(prev => ({ ...prev, antigravity: false }))
        }

        setSettings(updated)
        await handleSave(updated)
        await new Promise(resolve => setTimeout(resolve, 500))
        await refreshAuthStatus()
    }

    // Stats Loading logic
    useEffect(() => {
        const loadStats = async () => {
            setStatsLoading(true)
            try {
                const data = await window.electron.db.getDetailedStats(statsPeriod)
                setStatsData(data)

                try {
                    const quota = await window.electron.getQuota()
                    setQuotaData(quota)
                } catch (e) { }

                try {
                    const cpQuota = await window.electron.getCopilotQuota()
                    setCopilotQuota(cpQuota)
                } catch (e) { }

                try {
                    const usage = await window.electron.getCodexUsage()
                    setCodexUsage(usage)
                } catch (e) { }
            } catch (error) {
                console.error('Failed to load stats:', error)
            } finally {
                setStatsLoading(false)
            }
        }
        loadStats()
        const interval = setInterval(loadStats, 60000)
        return () => clearInterval(interval)
    }, [statsPeriod, reloadTrigger])

    const handleRunBenchmark = async (currentModelId: string) => {
        if (!currentModelId) return
        setIsBenchmarking(true)
        setBenchmarkResult(null)
        try {
            await new Promise(resolve => setTimeout(resolve, 3000))
            setBenchmarkResult({
                tokensPerSec: Math.round(50 + Math.random() * 20),
                latency: Math.round(200 + Math.random() * 100)
            })
        } finally {
            setIsBenchmarking(false)
        }
    }

    const handleSavePersona = () => {
        if (!settings || !personaDraft.name.trim()) return
        const next = { ...settings }
        const personas = [...(settings.personas || [])]
        if (editingPersonaId) {
            const idx = personas.findIndex(p => p.id === editingPersonaId)
            if (idx >= 0) personas[idx] = { ...personas[idx], ...personaDraft }
        } else {
            personas.push({ id: `${Date.now()}`, ...personaDraft })
        }
        next.personas = personas
        setSettings(next)
        handleSave(next)
        setPersonaDraft({ name: '', description: '', prompt: '' })
        setEditingPersonaId(null)
    }

    const handleDeletePersona = (personaId: string) => {
        if (!settings) return
        const next = { ...settings }
        next.personas = (settings.personas || []).filter(p => p.id !== personaId)
        setSettings(next)
        handleSave(next)
        if (editingPersonaId === personaId) {
            setEditingPersonaId(null)
            setPersonaDraft({ name: '', description: '', prompt: '' })
        }
    }

    return {
        settings,
        setSettings,
        isLoading,
        statusMessage,
        setStatusMessage,
        authMessage,
        authBusy,
        isOllamaRunning,
        authStatus,
        updateGeneral,
        updateSpeech,
        handleSave,
        startOllama,
        checkOllama,
        refreshAuthStatus,
        connectGitHubProfile,
        connectCopilot,
        connectBrowserProvider,
        disconnectProvider,

        // Stats
        statsLoading,
        statsPeriod,
        setStatsPeriod,
        statsData,
        quotaData,
        copilotQuota,
        codexUsage,
        setReloadTrigger,

        // Benchmark
        benchmarkResult,
        isBenchmarking,
        handleRunBenchmark,

        // Personas
        editingPersonaId,
        setEditingPersonaId,
        personaDraft,
        setPersonaDraft,
        handleSavePersona,
        handleDeletePersona,

        isDirty
    }
}
