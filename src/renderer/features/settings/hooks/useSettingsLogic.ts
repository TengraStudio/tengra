import { useState, useEffect, useRef, useCallback } from 'react'
import { AppSettings, QuotaResponse, CodexUsage, JsonValue } from '../../../../shared/types'
import { CopilotQuota } from '@/types';

type DetailedStats = Awaited<ReturnType<Window['electron']['db']['getDetailedStats']>>
type AuthStatusState = { codex: boolean; claude: boolean; antigravity: boolean; copilot?: boolean }
type AuthFile = { provider?: string; type?: string; name?: string }
type PersonaDraft = { name: string; description: string; prompt: string }

const deepEqual = (obj1: JsonValue, obj2: JsonValue) => JSON.stringify(obj1) === JSON.stringify(obj2)

export function useSettingsLogic(onRefreshModels?: () => void) {
    const [settings, setSettings] = useState<AppSettings | null>(null)
    const [originalSettings, setOriginalSettings] = useState<AppSettings | null>(null)
    const [isDirty, setIsDirty] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [statusMessage, setStatusMessage] = useState('')
    const [authMessage, setAuthMessage] = useState('')
    const [authBusy, setAuthBusy] = useState<string | null>(null)
    const [isOllamaRunning, setIsOllamaRunning] = useState(false)
    const [authStatus, setAuthStatus] = useState<AuthStatusState>({ codex: false, claude: false, antigravity: false, copilot: false })

    // Stats and Quota State
    const [statsLoading, setStatsLoading] = useState(false)
    const [statsPeriod, setStatsPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily')
    const [statsData, setStatsData] = useState<DetailedStats | null>(null)
    const [quotaData, setQuotaData] = useState<QuotaResponse | null>(null)
    const [copilotQuota, setCopilotQuota] = useState<CopilotQuota | null>(null)
    const [codexUsage, setCodexUsage] = useState<CodexUsage | null>(null)
    const [claudeQuota, setClaudeQuota] = useState<{ success: boolean; fiveHour?: { utilization: number; resetsAt: string }; sevenDay?: { utilization: number; resetsAt: string } } | null>(null)
    const [reloadTrigger, setReloadTrigger] = useState(0)

    // Benchmark State
    const [benchmarkResult, setBenchmarkResult] = useState<{ tokensPerSec: number; latency: number } | null>(null)
    const [isBenchmarking, setIsBenchmarking] = useState(false)

    // Personas State
    const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null)
    const [personaDraft, setPersonaDraft] = useState<PersonaDraft>({ name: '', description: '', prompt: '' })

    const authMessageTimer = useRef<NodeJS.Timeout | null>(null)

    const refreshAuthStatus = useCallback(async () => {
        try {
            const status = await window.electron.checkAuthStatus()
            const files = (status?.files || []) as AuthFile[]
            const hasProvider = (providerNames: string[]) => {
                return files.some((f: AuthFile) => {
                    const fileProvider = (f.provider || f.type || '').toLowerCase()
                    const fileName = (f.name || '').toLowerCase()
                    return providerNames.some(name =>
                        fileProvider === name || fileName.startsWith(name + '-')
                    )
                })
            }

            console.log('[SettingsLogic] refreshAuthStatus: Auth files found:', JSON.stringify(files));
            const newStatus = {
                codex: hasProvider(['codex', 'openai']),
                claude: hasProvider(['claude', 'anthropic']),
                antigravity: hasProvider(['antigravity']),
                copilot: hasProvider(['copilot', 'copilot_token'])
            };
            console.log('[SettingsLogic] refreshAuthStatus: Computed status:', JSON.stringify(newStatus));
            setAuthStatus(newStatus)
        } catch (error) {
            console.error('Auth check failed:', error)
        }
    }, [])

    const loadSettings = useCallback(async () => {
        console.log('[useSettingsLogic] loadSettings: Calling window.electron.getSettings()');
        const data = await window.electron.getSettings()
        console.log(`[useSettingsLogic] loadSettings: Received settings. GitHub token length: ${data.github?.token?.length || 0}, Copilot token length: ${data.copilot?.token?.length || 0}, Antigravity token length: ${data.antigravity?.token?.length || 0}`);
        setOriginalSettings(JSON.parse(JSON.stringify(data)))
        setSettings(data)
        refreshAuthStatus()
    }, [refreshAuthStatus])

    const checkOllama = useCallback(async () => {
        try {
            const running = await window.electron.isOllamaRunning()
            setIsOllamaRunning(!!running)
        } catch {
            setIsOllamaRunning(false)
        }
    }, [])

    useEffect(() => {
        loadSettings()
        checkOllama()
    }, [loadSettings, checkOllama])

    useEffect(() => {
        if (settings && originalSettings) setIsDirty(!deepEqual(settings, originalSettings))
    }, [settings, originalSettings])

    const handleSave = async (newSettings?: AppSettings) => {
        const toSave = newSettings || settings
        if (!toSave) return
        setIsLoading(true)
        try {
            await window.electron.saveSettings(toSave)
            const saved = await window.electron.getSettings()
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
        const equal = deepEqual(settings, originalSettings)
        if (equal) return

        console.log('[useSettingsLogic] Auto-save triggered! Settings differ from originalSettings.');

        const timeout = setTimeout(async () => {
            try {
                console.log('[useSettingsLogic] Executing auto-save...');
                await window.electron.saveSettings(settings)
                setOriginalSettings(JSON.parse(JSON.stringify(settings)))
                setStatusMessage('Ayarlar otomatik kaydedildi')
                setTimeout(() => setStatusMessage(''), 2000)
                console.log('[useSettingsLogic] Auto-save success.');
            } catch (e) {
                console.error('[useSettingsLogic] Auto-save failed:', e)
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

    const updateSpeech = (patch: Partial<NonNullable<AppSettings['speech']>>) => {
        if (!settings) return
        const updated = { ...settings, speech: { ...settings.speech, ...patch } } as AppSettings
        setSettings(updated)
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
                const updated: AppSettings = {
                    ...settings,
                    github: { username: (settings.github as { username?: string })?.username || 'GitHub User', token: pollResult.token }
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
                const updated: AppSettings = {
                    ...settings,
                    copilot: { ...(settings.copilot || { connected: false }), connected: true, token: pollResult.token }
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

    const connectBrowserProvider = async (provider: 'codex' | 'claude' | 'antigravity') => {
        setAuthBusy(provider)
        setAuthNotice('')
        try {
            const loginFn = {
                codex: window.electron.codexLogin,
                claude: window.electron.claudeLogin,
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
                    const files = (status?.files || []) as AuthFile[]
                    const providerIdentifiers: string[] = []
                    switch (provider) {
                        case 'claude': providerIdentifiers.push('claude', 'anthropic'); break
                        case 'antigravity': providerIdentifiers.push('antigravity'); break
                        case 'codex': providerIdentifiers.push('codex', 'openai'); break
                    }

                    const isConnected = files.some((f: AuthFile) => {
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
                return false
            }
            setTimeout(check, 2000)
        } catch (error) {
            console.error(`${provider} auth failed:`, error)
            setAuthNotice('Baglanti basarisiz.')
        } finally {
            setAuthBusy(null)
        }
    }

    const disconnectProvider = async (provider: 'copilot' | 'codex' | 'claude' | 'antigravity') => {
        if (!settings) return
        const updated: AppSettings = { ...settings }

        try {
            const status = await window.electron.checkAuthStatus()
            const files = (status?.files || []) as AuthFile[]
            const providerIdentifiers: string[] = []
            switch (provider) {
                case 'claude': providerIdentifiers.push('claude', 'anthropic'); break
                case 'antigravity': providerIdentifiers.push('antigravity'); break
                case 'codex': providerIdentifiers.push('codex'); break
                case 'copilot': providerIdentifiers.push('copilot'); break
            }

            const targets = files.filter((f) => {
                const fileProvider = (f.provider || f.type || '').toLowerCase()
                const fileName = (f.name || '').toLowerCase()
                return providerIdentifiers.some(id => fileProvider === id || fileName.startsWith(id + '-'))
            })

            for (const t of targets) {
                await window.electron.deleteProxyAuthFile(t.name || '')
            }
        } catch (e) {
            console.error('[SettingsLogic] Backend auth deletion failed:', e)
        }

        if (provider === 'copilot') updated.copilot = { connected: false }
        if (provider === 'codex') {
            if (updated.openai?.apiKey === 'connected') updated.openai = { ...updated.openai, apiKey: '' }
            updated.codex = { connected: false }
            setAuthStatus(prev => ({ ...prev, codex: false }))
        }
        if (provider === 'claude') {
            if (updated.claude?.apiKey === 'connected') updated.claude = { ...updated.claude, apiKey: '' }
            if (updated.anthropic?.apiKey === 'connected') updated.anthropic = { ...updated.anthropic, apiKey: '' }
            setAuthStatus(prev => ({ ...prev, claude: false }))
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
                } catch (e) {
                    console.error('Failed to load quota:', e)
                }

                try {
                    const cpQuota = await window.electron.getCopilotQuota()
                    setCopilotQuota(cpQuota)
                } catch (e) {
                    console.error('Failed to load copilot quota:', e)
                }

                try {
                    const usage = await window.electron.getCodexUsage()
                    setCodexUsage(usage?.usage || null)
                } catch (e) {
                    console.error('Failed to load codex usage:', e)
                }

                try {
                    const cQuota = await window.electron.getClaudeQuota()
                    console.log('[SettingsLogic] Claude Quota received:', JSON.stringify(cQuota))
                    setClaudeQuota(cQuota)
                } catch (e) {
                    console.error('Failed to load claude quota:', e)
                }
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
        const personas = settings.personas || []
        next.personas = personas.filter(p => p.id !== personaId)
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
        claudeQuota,
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
