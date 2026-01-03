import { useState, useEffect, useRef } from 'react'
import { useTranslation, Language } from '../i18n'
import { MCPPage } from './MCPPage'
import {
    Activity,
    BrainCircuit,
    Database,
    ExternalLink,
    RefreshCw,
    X,
    FolderPlus,
    Globe,
    LayoutGrid,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import chatgptLogo from '@/assets/chatgpt.svg'
import antigravityLogo from '@/assets/antigravity.svg'
import claudeLogo from '@/assets/claude.svg'
import geminiLogo from '@/assets/gemini.png'
import copilotLogo from '@/assets/copilot.png'
import ollamaLogo from '@/assets/ollama.svg'

interface SettingsPageProps {
    installedModels: any[]
    proxyModels?: any[]
    onRefreshModels: () => void
    activeTab?: 'accounts' | 'general' | 'appearance' | 'models' | 'statistics' | 'gallery' | 'personas' | 'mcp-servers' | 'mcp-marketplace'
    onTabChange?: (tab: 'accounts' | 'general' | 'appearance' | 'models' | 'statistics' | 'gallery' | 'personas' | 'mcp-servers' | 'mcp-marketplace') => void
    onSettingsChange?: (settings: any) => void
}

const deepEqual = (obj1: any, obj2: any) => JSON.stringify(obj1) === JSON.stringify(obj2)

interface AppSettings {
    ollama: {
        url: string
        numCtx?: number
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
}

export function SettingsPage({
    installedModels: _installedModels,
    proxyModels: _proxyModels,
    onRefreshModels,
    activeTab = 'general',
    onTabChange: _onTabChange,
    onSettingsChange: _onSettingsChange
}: SettingsPageProps) {

    const [settings, setSettings] = useState<AppSettings | null>(null)
    const [originalSettings, setOriginalSettings] = useState<AppSettings | null>(null)
    const [, setIsDirty] = useState(false)
    const [, setIsLoading] = useState(false)
    const [statusMessage, setStatusMessage] = useState('')
    const [authMessage, setAuthMessage] = useState('')
    const [authBusy, setAuthBusy] = useState<string | null>(null)
    const [isOllamaRunning, setIsOllamaRunning] = useState(false)
    const [authStatus, setAuthStatus] = useState({ codex: false, claude: false, gemini: false, antigravity: false })
    const { t } = useTranslation(settings?.general?.language as any || 'tr')
    const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null)
    const [personaDraft, setPersonaDraft] = useState({ name: '', description: '', prompt: '' })
    const [statsPeriod, setStatsPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily')
    const [statsData, setStatsData] = useState<any>(null)
    const [quotaData, setQuotaData] = useState<any>(null)
    const [copilotQuota, setCopilotQuota] = useState<any>(null)
    const [codexUsage, setCodexUsage] = useState<any>(null)
    const [modelsTab, setModelsTab] = useState<'installed' | 'discover'>('installed')
    const [modelSearch, setModelSearch] = useState('')
    const [showHiddenModels, setShowHiddenModels] = useState(false)
    const [ollamaLibrary, setOllamaLibrary] = useState<any[]>([])
    const [ollamaLibraryLoaded, setOllamaLibraryLoaded] = useState(false)
    const [hfQuery, setHfQuery] = useState('')
    const [hfResults, setHfResults] = useState<any[]>([])
    const [hfPage, setHfPage] = useState(0)
    const [hfLoading, setHfLoading] = useState(false)
    const importPromptResolve = useRef<((value: boolean) => void) | null>(null)
    const [, _setImportPromptProvider] = useState<string | null>(null)
    const authMessageTimer = useRef<any>(null)

    useEffect(() => {
        loadSettings()
        checkOllama()
        // Initialize unused ref to satisfy linter
        if (importPromptResolve.current) { }
    }, [])

    useEffect(() => {
        if (settings && originalSettings) setIsDirty(!deepEqual(settings, originalSettings))
    }, [settings, originalSettings])

    useEffect(() => {
        if (activeTab !== 'statistics') return
        const loadStats = async () => {
            try {
                const data = await window.electron.db.getDetailedStats(statsPeriod)
                setStatsData(data)
            } catch (error) {
                console.error('Failed to load stats:', error)
            }
            try {
                const quota = await window.electron.getQuota()
                setQuotaData(quota)
            } catch (error) {
                console.error('Failed to load quota:', error)
                setQuotaData(null)
            }
            try {
                const quota = await window.electron.getCopilotQuota()
                setCopilotQuota(quota)
            } catch (error) {
                console.error('Failed to load copilot quota:', error)
                setCopilotQuota(null)
            }
            try {
                const usage = await window.electron.getCodexUsage()
                setCodexUsage(usage)
            } catch (error) {
                console.error('Failed to load codex usage:', error)
                setCodexUsage(null)
            }
        }
        loadStats()
        const interval = setInterval(loadStats, 60000)
        return () => clearInterval(interval)
    }, [activeTab, statsPeriod])

    useEffect(() => {
        if (activeTab !== 'models' || modelsTab !== 'discover') return
        if (ollamaLibraryLoaded) return
        const loadLibrary = async () => {
            try {
                const data = await window.electron.getLibraryModels()
                setOllamaLibrary(Array.isArray(data) ? data : [])
            } catch (error) {
                console.error('Failed to load Ollama library:', error)
                setOllamaLibrary([])
            } finally {
                setOllamaLibraryLoaded(true)
            }
        }
        loadLibrary()
    }, [activeTab, modelsTab, ollamaLibraryLoaded])

    useEffect(() => {
        setHfPage(0)
    }, [hfQuery])

    useEffect(() => {
        if (activeTab !== 'models' || modelsTab !== 'discover') return
        const query = hfQuery.trim()
        if (query.length < 2) {
            setHfResults([])
            return
        }
        setHfLoading(true)
        const handle = setTimeout(async () => {
            try {
                const data = await window.electron.huggingface.searchModels(query, 12, hfPage)
                setHfResults(Array.isArray(data) ? data : [])
            } catch (error) {
                console.error('Failed to search HuggingFace models:', error)
                setHfResults([])
            } finally {
                setHfLoading(false)
            }
        }, 300)
        return () => clearTimeout(handle)
    }, [activeTab, modelsTab, hfQuery, hfPage])

    const loadSettings = async () => {
        const data = await window.electron.getSettings()
        setOriginalSettings(JSON.parse(JSON.stringify(data)))
        setSettings(data)
        refreshAuthStatus()
    }

    const applySettings = (next: AppSettings) => {
        setSettings(next)
        _onSettingsChange?.(next)
    }

    const handleSave = async (newSettings?: AppSettings) => {
        const toSave = newSettings || settings
        if (!toSave) return
        setIsLoading(true)
        try {
            const saved = await window.electron.saveSettings(toSave)
            setOriginalSettings(JSON.parse(JSON.stringify(saved)))
            applySettings(saved)
            onRefreshModels()
            setStatusMessage('Kaydedildi!')
            setTimeout(() => setStatusMessage(''), 2000)
        } finally { setIsLoading(false) }
    }

    const updateGeneral = (patch: Partial<AppSettings['general']>) => {
        if (!settings) return
        const updated = { ...settings, general: { ...settings.general, ...patch } }
        applySettings(updated)
        handleSave(updated)
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
            const hasProvider = (provider: string) => files.some((f: any) => f.provider === provider)
            setAuthStatus({
                codex: hasProvider('codex') || hasProvider('openai'),
                claude: hasProvider('claude') || hasProvider('anthropic'),
                gemini: hasProvider('gemini') || hasProvider('gemini-cli'),
                antigravity: hasProvider('antigravity')
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

    const normalizeKeyValue = (value?: string) => (value === 'connected' ? '' : (value || ''))

    const connectGitHubProfile = async () => {
        if (!settings) return
        setAuthBusy('github')
        setAuthNotice('')
        try {
            const data = await window.electron.githubLogin('profile')
            if (data?.verification_uri) {
                window.electron.openExternal(data.verification_uri)
            }
            if (data?.user_code) {
                setAuthNotice(`Kod: ${data.user_code}`, 0)
            }
            const pollResult = await window.electron.pollToken(data.device_code, data.interval, 'profile')
            if (pollResult.success && pollResult.token) {
                const updated = {
                    ...settings,
                    github: {
                        username: settings.github?.username || 'GitHub User',
                        token: pollResult.token
                    }
                }
                applySettings(updated)
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
            if (data?.verification_uri) {
                window.electron.openExternal(data.verification_uri)
            }
            if (data?.user_code) {
                setAuthNotice(`Kod: ${data.user_code}`, 0)
            }
            const pollResult = await window.electron.pollToken(data.device_code, data.interval, 'copilot')
            if (pollResult.success && pollResult.token) {
                const updated = {
                    ...settings,
                    copilot: {
                        ...settings.copilot,
                        connected: true,
                        token: pollResult.token
                    }
                }
                applySettings(updated)
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
                window.electron.openExternal(result.url)
                setAuthNotice('Tarayici acildi. Giris tamamlaninca kontrol edin.')
            }
            await refreshAuthStatus()
        } catch (error) {
            console.error(`${provider} auth failed:`, error)
            setAuthNotice('Baglanti basarisiz.')
        } finally {
            setAuthBusy(null)
        }
    }

    const disconnectProvider = (provider: 'copilot' | 'codex' | 'claude' | 'gemini' | 'antigravity') => {
        if (!settings) return
        const updated: AppSettings = { ...settings }
        if (provider === 'copilot') {
            updated.copilot = { connected: false, username: '', token: '' }
        }
        if (provider === 'codex') {
            if (updated.openai?.apiKey === 'connected') {
                updated.openai = { ...updated.openai, apiKey: '' }
            }
            updated.codex = { connected: false }
            setAuthStatus(prev => ({ ...prev, codex: false }))
        }
        if (provider === 'claude') {
            if (updated.claude?.apiKey === 'connected') {
                updated.claude = { ...updated.claude, apiKey: '' }
            }
            if (updated.anthropic?.apiKey === 'connected') {
                updated.anthropic = { ...updated.anthropic, apiKey: '', model: updated.anthropic?.model || '' }
            }
            setAuthStatus(prev => ({ ...prev, claude: false }))
        }
        if (provider === 'gemini') {
            if (updated.gemini?.apiKey === 'connected') {
                updated.gemini = { ...updated.gemini, apiKey: '' }
            }
            setAuthStatus(prev => ({ ...prev, gemini: false }))
        }
        if (provider === 'antigravity') {
            updated.antigravity = { ...(updated.antigravity || { connected: false }), connected: false }
            setAuthStatus(prev => ({ ...prev, antigravity: false }))
        }
        applySettings(updated)
        handleSave(updated)
    }

    const renderGeneral = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-card p-4 rounded-xl border border-border">
                    <label className="text-xs font-bold uppercase text-muted-foreground mr-2 flex items-center gap-1"><Globe className="w-3 h-3" /> {t('settings.language')}</label>
                    <select
                        value={settings?.general?.language || 'tr'}
                        onChange={e => updateGeneral({ language: e.target.value })}
                        className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 mt-2 font-mono text-primary appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                        <option value="tr">Türkçe</option>
                        <option value="en">English</option>
                    </select>
                </div>
                <div className="bg-card p-4 rounded-xl border border-border">
                    <label className="text-xs font-bold uppercase text-muted-foreground mr-2"><Activity className="w-3 h-3 inline mr-1" /> Kontekst Mesaj Limiti</label>
                    <input
                        type="number"
                        value={settings?.general?.contextMessageLimit || 50}
                        onChange={e => updateGeneral({ contextMessageLimit: parseInt(e.target.value) })}
                        className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 mt-2 font-mono text-primary"
                    />
                </div>
                <div className="bg-card p-4 rounded-xl border border-border flex items-center gap-3">
                    <Database className="w-8 h-8 text-primary/40" />
                    <div>
                        <div className="text-sm font-bold text-white uppercase tracking-wider">Veritabanı</div>
                        <div className="text-xs text-muted-foreground">Yerel verileriniz şifrelenmiş olarak saklanır.</div>
                    </div>
                </div>
            </div>
        </div>
    )

    const renderAccounts = () => {
        if (!settings) return null
        const isCopilotConnected = Boolean(settings.copilot?.connected || settings.copilot?.token)
        const isGitHubConnected = Boolean(settings.github?.token)
        const isCodexConnected = authStatus.codex || settings.codex?.connected || settings.openai?.apiKey === 'connected'
        const isClaudeConnected = authStatus.claude || settings.claude?.apiKey === 'connected' || settings.anthropic?.apiKey === 'connected'
        const isGeminiConnected = authStatus.gemini || settings.gemini?.apiKey === 'connected'
        const isAntigravityConnected = authStatus.antigravity || settings.antigravity?.connected
        const isHuggingFaceConnected = Boolean(settings.huggingface?.apiKey)

        const accountCards = [
            {
                id: 'github',
                title: 'GitHub Profile',
                description: 'Plan & Profil',
                logo: copilotLogo,
                connected: isGitHubConnected,
                onConnect: connectGitHubProfile,
                onDisconnect: () => {
                    const updated = { ...settings, github: { ...settings.github, token: '' } }
                    applySettings(updated)
                    handleSave(updated)
                }
            },
            {
                id: 'copilot',
                title: 'GitHub Copilot',
                description: 'Chat Erişimi (VS Code)',
                logo: copilotLogo,
                connected: isCopilotConnected,
                onConnect: connectCopilot,
                onDisconnect: () => disconnectProvider('copilot')
            },
            {
                id: 'antigravity',
                title: 'Antigravity',
                description: 'Proxy auth',
                logo: antigravityLogo,
                connected: isAntigravityConnected,
                onConnect: () => connectBrowserProvider('antigravity'),
                onDisconnect: () => disconnectProvider('antigravity')
            },
            {
                id: 'codex',
                title: 'ChatGPT Codex',
                description: 'Web auth',
                logo: chatgptLogo,
                connected: isCodexConnected,
                onConnect: () => connectBrowserProvider('codex'),
                onDisconnect: () => disconnectProvider('codex')
            },
            {
                id: 'claude',
                title: 'Claude',
                description: 'Anthropic auth',
                logo: claudeLogo,
                connected: isClaudeConnected,
                onConnect: () => connectBrowserProvider('claude'),
                onDisconnect: () => disconnectProvider('claude')
            },
            {
                id: 'gemini',
                title: 'Gemini',
                description: 'Google auth',
                logo: geminiLogo,
                connected: isGeminiConnected,
                onConnect: () => connectBrowserProvider('gemini'),
                onDisconnect: () => disconnectProvider('gemini')
            }
        ]

        return (
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-white">Bagli Hesaplar</h3>
                        <p className="text-xs text-muted-foreground">Proxy ve bulut servis baglantilari.</p>
                    </div>
                    <button
                        onClick={refreshAuthStatus}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Yenile
                    </button>
                </div>
                {authMessage && (
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground">
                        {authMessage}
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {accountCards.map(card => {
                        const isBusy = authBusy === card.id
                        return (
                            <div key={card.id} className="bg-card p-4 rounded-xl border border-border flex items-center gap-4">
                                <div className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden">
                                    <img src={card.logo} alt={card.title} className="h-6 w-6 object-contain" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-bold text-white">{card.title}</div>
                                    <div className="text-xs text-muted-foreground">{card.description}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={cn("text-xs font-bold uppercase tracking-wider", card.connected ? "text-emerald-400" : "text-muted-foreground")}>
                                        {card.connected ? 'Baglandi' : 'Bagli degil'}
                                    </span>
                                    {card.connected ? (
                                        <button
                                            onClick={card.onDisconnect}
                                            className="px-2.5 py-1 rounded-md text-xs font-bold bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 border border-white/10"
                                        >
                                            Cik
                                        </button>
                                    ) : (
                                        <button
                                            onClick={card.onConnect}
                                            disabled={!!authBusy}
                                            className={cn(
                                                "px-2.5 py-1 rounded-md text-xs font-bold border border-white/10 flex items-center gap-1",
                                                isBusy
                                                    ? "bg-white/5 text-muted-foreground"
                                                    : authBusy
                                                        ? "opacity-50 cursor-not-allowed text-muted-foreground"
                                                        : "bg-primary/20 text-primary hover:bg-primary/30"
                                            )}
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                            Baglan
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="bg-card p-4 rounded-xl border border-border space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden">
                            <img src={ollamaLogo} alt="Ollama" className="h-6 w-6 object-contain" />
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-bold text-white">Ollama</div>
                            <div className="text-xs text-muted-foreground">Yerel model sunucusu</div>
                        </div>
                        <span className={cn("text-xs font-bold uppercase tracking-wider", isOllamaRunning ? "text-emerald-400" : "text-muted-foreground")}>
                            {isOllamaRunning ? 'Calisiyor' : 'Kapali'}
                        </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-bold uppercase text-muted-foreground">Sunucu Adresi</label>
                            <input
                                type="text"
                                value={settings?.ollama?.url || 'http://localhost:11434'}
                                onChange={e => {
                                    const val = e.target.value
                                    const updated = { ...settings, ollama: { ...settings.ollama, url: val } }
                                    applySettings(updated)
                                }}
                                onBlur={() => handleSave()}
                                className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 font-mono text-primary"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold uppercase text-muted-foreground">Context (numCtx)</label>
                            <input
                                type="number"
                                min="1024"
                                step="1024"
                                value={settings?.ollama?.numCtx || 16384}
                                onChange={e => {
                                    const val = Number(e.target.value || 0)
                                    const updated = { ...settings, ollama: { ...settings.ollama, numCtx: val } }
                                    applySettings(updated)
                                }}
                                onBlur={() => handleSave()}
                                className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 font-mono text-primary"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={checkOllama}
                            className="px-2.5 py-1 rounded-md text-xs font-bold bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 border border-white/10"
                        >
                            Kontrol Et
                        </button>
                        {!isOllamaRunning && (
                            <button
                                onClick={startOllama}
                                className="px-2.5 py-1 rounded-md text-xs font-bold bg-primary/20 text-primary hover:bg-primary/30 border border-white/10"
                            >
                                Baslat
                            </button>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <h3 className="text-lg font-bold text-white">API Anahtarlari</h3>
                        <p className="text-xs text-muted-foreground">Klasik API anahtarlarini buradan yonetin.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-card p-4 rounded-xl border border-border space-y-2">
                            <label className="text-xs font-bold uppercase text-muted-foreground">OpenAI</label>
                            <input
                                type="password"
                                placeholder="sk-..."
                                value={normalizeKeyValue(settings?.openai?.apiKey)}
                                onChange={e => {
                                    const val = e.target.value
                                    const updated = { ...settings, openai: { ...settings.openai, apiKey: val, model: settings.openai?.model || 'gpt-4o' } }
                                    applySettings(updated)
                                    handleSave(updated)
                                }}
                                className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 font-mono text-primary outline-none focus:ring-1 focus:ring-primary"
                            />
                            {settings?.openai?.apiKey === 'connected' && (
                                <div className="text-xs text-muted-foreground">Codex baglantisi aktif.</div>
                            )}
                        </div>
                        <div className="bg-card p-4 rounded-xl border border-border space-y-2">
                            <label className="text-xs font-bold uppercase text-muted-foreground">Anthropic (Claude)</label>
                            <input
                                type="password"
                                placeholder="sk-ant-..."
                                value={normalizeKeyValue(settings?.anthropic?.apiKey)}
                                onChange={e => {
                                    const val = e.target.value
                                    const updated = { ...settings, anthropic: { ...settings.anthropic, apiKey: val, model: settings.anthropic?.model || 'claude-3-5-sonnet-20241022' } }
                                    applySettings(updated)
                                    handleSave(updated)
                                }}
                                className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 font-mono text-primary outline-none focus:ring-1 focus:ring-primary"
                            />
                            {settings?.anthropic?.apiKey === 'connected' && (
                                <div className="text-xs text-muted-foreground">Claude baglantisi aktif.</div>
                            )}
                        </div>
                        <div className="bg-card p-4 rounded-xl border border-border space-y-2">
                            <label className="text-xs font-bold uppercase text-muted-foreground">Google Gemini</label>
                            <input
                                type="password"
                                placeholder="AIza..."
                                value={normalizeKeyValue(settings?.gemini?.apiKey)}
                                onChange={e => {
                                    const val = e.target.value
                                    const updated = { ...settings, gemini: { ...settings.gemini, apiKey: val, model: settings.gemini?.model || 'gemini-1.5-pro' } }
                                    applySettings(updated)
                                    handleSave(updated)
                                }}
                                className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 font-mono text-primary outline-none focus:ring-1 focus:ring-primary"
                            />
                            {settings?.gemini?.apiKey === 'connected' && (
                                <div className="text-xs text-muted-foreground">Gemini baglantisi aktif.</div>
                            )}
                        </div>
                        <div className="bg-card p-4 rounded-xl border border-border space-y-2">
                            <label className="text-xs font-bold uppercase text-muted-foreground">Groq</label>
                            <input
                                type="password"
                                placeholder="gsk_..."
                                value={normalizeKeyValue(settings?.groq?.apiKey)}
                                onChange={e => {
                                    const val = e.target.value
                                    const updated = { ...settings, groq: { ...settings.groq, apiKey: val, model: settings.groq?.model || 'llama3-70b-8192' } }
                                    applySettings(updated)
                                    handleSave(updated)
                                }}
                                className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 font-mono text-primary outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>
                        <div className="bg-card p-4 rounded-xl border border-border space-y-2 md:col-span-2">
                            <label className="text-xs font-bold uppercase text-muted-foreground">HuggingFace</label>
                            <input
                                type="password"
                                placeholder="hf_..."
                                value={settings?.huggingface?.apiKey || ''}
                                onChange={e => {
                                    const val = e.target.value
                                    const updated = { ...settings, huggingface: { apiKey: val } }
                                    applySettings(updated)
                                    handleSave(updated)
                                }}
                                className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 font-mono text-primary outline-none focus:ring-1 focus:ring-primary"
                            />
                            <div className="text-xs text-muted-foreground">
                                {isHuggingFaceConnected ? 'Baglandi' : 'Opsiyonel'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const renderAppearance = () => {
        const themeOptions = [
            { id: 'graphite', label: 'Graphite' },
            { id: 'obsidian', label: 'Obsidian' },
            { id: 'midnight', label: 'Midnight' },
            { id: 'deep-forest', label: 'Deep Forest' },
            { id: 'dracula', label: 'Dracula' },
            { id: 'cyberpunk', label: 'Cyberpunk' },
            { id: 'matrix', label: 'Matrix' },
            { id: 'synthwave', label: 'Synthwave' },
            { id: 'lava', label: 'Lava' },
            { id: 'aurora', label: 'Aurora' },
            { id: 'snow', label: 'Snow' },
            { id: 'sand', label: 'Sand' },
            { id: 'sky', label: 'Sky' },
            { id: 'minimal', label: 'Minimal' },
            { id: 'paper', label: 'Paper' },
            { id: 'gold', label: 'Gold' },
            { id: 'ocean', label: 'Ocean' },
            { id: 'rose', label: 'Rose' },
            { id: 'coffee', label: 'Coffee' },
            { id: 'serenity', label: 'Serenity' }
        ]
        const rawTheme = settings?.general?.theme || 'graphite'
        const currentTheme = rawTheme === 'dark' || rawTheme === 'system'
            ? 'graphite'
            : rawTheme === 'light'
                ? 'snow'
                : rawTheme

        return (
            <div className="space-y-6">
                <div className="bg-card p-5 rounded-xl border border-border space-y-4">
                    <div>
                        <div className="text-sm font-bold text-white">{t('settings.theme') || 'Tema'}</div>
                        <div className="text-xs text-muted-foreground">Tema paletlerini secin.</div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {themeOptions.map((theme) => {
                            const isActive = currentTheme === theme.id
                            return (
                                <button
                                    key={theme.id}
                                    onClick={() => updateGeneral({ theme: theme.id })}
                                    className={cn(
                                        "w-full p-3 rounded-xl border transition-colors text-left",
                                        isActive ? "border-primary/40 bg-primary/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                                    )}
                                >
                                    <div className="flex items-center gap-3 w-full">
                                        <div
                                            data-theme={theme.id}
                                            className="h-10 w-10 rounded-xl border flex items-end p-2"
                                            style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                                        >
                                            <span className="h-2 w-6 rounded-full" style={{ background: 'hsl(var(--primary))' }} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-xs font-bold text-white">{theme.label}</div>
                                            <div className="text-xs text-muted-foreground">{theme.id}</div>
                                        </div>
                                        {isActive && <div className="h-2 w-2 rounded-full bg-primary" />}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div className="bg-card p-5 rounded-xl border border-border space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-bold text-white">{t('settings.font') || 'Yazi Boyutu'}</div>
                            <div className="text-xs text-muted-foreground">Arayuz olcegi</div>
                        </div>
                        <span className="font-mono text-xs text-muted-foreground">{settings?.general?.fontSize || 14}px</span>
                    </div>
                    <input
                        type="range"
                        min="12"
                        max="20"
                        step="1"
                        value={settings?.general?.fontSize || 14}
                        onChange={e => updateGeneral({ fontSize: parseInt(e.target.value) })}
                        className="w-full accent-primary"
                    />
                </div>
            </div>
        )
    }

    const renderModels = () => {
        if (!settings) return null
        const hiddenModels = settings.general.hiddenModels || []
        const defaultModel = settings.general.defaultModel || ''

        const combined = new Map()
        for (const model of _installedModels) {
            if (!model?.name) continue
            combined.set(model.name, {
                id: model.name,
                sources: ['ollama'],
                details: model
            })
        }
        for (const model of (_proxyModels || [])) {
            const id = String(model?.id || model?.name || '').trim()
            if (!id) continue
            const existing = combined.get(id)
            const source = model?.owned_by ? String(model.owned_by) : 'proxy'
            if (existing) {
                existing.sources = Array.from(new Set([...(existing.sources || []), source]))
            } else {
                combined.set(id, { id, sources: [source] })
            }
        }

        const modelList = Array.from(combined.values())
        const normalizedSearch = modelSearch.trim().toLowerCase()
        const filtered = modelList.filter((m: any) => {
            if (!showHiddenModels && hiddenModels.includes(m.id)) return false
            if (!normalizedSearch) return true
            return m.id.toLowerCase().includes(normalizedSearch)
        })

        const updateHidden = (modelId: string, hide: boolean) => {
            const nextHidden = hide
                ? Array.from(new Set([...hiddenModels, modelId]))
                : hiddenModels.filter(m => m !== modelId)
            const updated = {
                ...settings,
                general: {
                    ...settings.general,
                    hiddenModels: nextHidden
                }
            }
            applySettings(updated)
            handleSave(updated)
        }

        const setDefault = (modelId: string) => {
            const updated = {
                ...settings,
                general: {
                    ...settings.general,
                    defaultModel: modelId
                }
            }
            applySettings(updated)
            handleSave(updated)
        }

        return (
            <div className="space-y-6">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setModelsTab('installed')}
                        className={cn(
                            "px-4 py-2 rounded-full text-xs font-bold border transition-colors",
                            modelsTab === 'installed' ? "bg-primary/20 text-primary border-primary/30" : "bg-white/5 text-muted-foreground border-white/10 hover:text-foreground"
                        )}
                    >
                        Modellerim
                    </button>
                    <button
                        onClick={() => setModelsTab('discover')}
                        className={cn(
                            "px-4 py-2 rounded-full text-xs font-bold border transition-colors",
                            modelsTab === 'discover' ? "bg-primary/20 text-primary border-primary/30" : "bg-white/5 text-muted-foreground border-white/10 hover:text-foreground"
                        )}
                    >
                        Kesfet
                    </button>
                </div>

                {modelsTab === 'installed' ? (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <input
                                type="text"
                                value={modelSearch}
                                onChange={e => setModelSearch(e.target.value)}
                                placeholder="Model ara..."
                                className="h-10 w-64 max-w-full bg-muted/20 border border-border/50 rounded-xl px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                            />
                            <button
                                onClick={() => setShowHiddenModels(prev => !prev)}
                                className="px-3 py-2 rounded-lg text-xs font-bold bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 border border-white/10"
                            >
                                {showHiddenModels ? 'Gizlileri Sakla' : 'Gizlileri Goster'}
                            </button>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {filtered.length === 0 && (
                                <div className="text-xs text-muted-foreground">Model bulunamadi.</div>
                            )}
                            {filtered.map((model: any) => {
                                const isHidden = hiddenModels.includes(model.id)
                                const isDefault = defaultModel === model.id
                                return (
                                    <div key={model.id} className="bg-card p-4 rounded-xl border border-border flex items-center justify-between gap-4">
                                        <div>
                                            <div className="text-sm font-bold text-white">{model.id}</div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {(model.sources || []).map((source: string) => (
                                                    <span key={source} className="mr-2 uppercase tracking-wider">{source}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isDefault ? (
                                                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Varsayilan</span>
                                            ) : (
                                                <button
                                                    onClick={() => setDefault(model.id)}
                                                    className="px-2.5 py-1 rounded-md text-xs font-bold bg-primary/20 text-primary hover:bg-primary/30 border border-white/10"
                                                >
                                                    Varsayilan Yap
                                                </button>
                                            )}
                                            <button
                                                onClick={() => updateHidden(model.id, !isHidden)}
                                                className="px-2.5 py-1 rounded-md text-xs font-bold bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 border border-white/10"
                                            >
                                                {isHidden ? 'Goster' : 'Gizle'}
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-card p-5 rounded-xl border border-border space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-bold text-white">Ollama Kutuphanesi</div>
                                    <div className="text-xs text-muted-foreground">Ollama.com kaynakli modeller</div>
                                </div>
                                <button
                                    onClick={() => { setOllamaLibraryLoaded(false); }}
                                    className="px-2.5 py-1 rounded-md text-xs font-bold bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 border border-white/10"
                                >
                                    Yenile
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {ollamaLibrary.map((model: any) => (
                                    <div key={model.name} className="rounded-lg border border-white/10 bg-white/5 p-3">
                                        <div className="text-sm font-bold text-white">{model.name}</div>
                                        <div className="text-xs text-muted-foreground mt-1">{model.description}</div>
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {(model.tags || []).slice(0, 6).map((tag: string) => (
                                                <span key={tag} className="px-2 py-0.5 rounded-md text-xs font-bold bg-white/5 text-muted-foreground">{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {ollamaLibrary.length === 0 && (
                                    <div className="text-xs text-muted-foreground">Model listesi bulunamadi.</div>
                                )}
                            </div>
                        </div>

                        <div className="bg-card p-5 rounded-xl border border-border space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-bold text-white">HuggingFace</div>
                                    <div className="text-xs text-muted-foreground">GGUF modelleri ara</div>
                                </div>
                                <input
                                    type="text"
                                    value={hfQuery}
                                    onChange={e => setHfQuery(e.target.value)}
                                    placeholder="Model ara..."
                                    className="h-10 w-64 max-w-full bg-muted/20 border border-border/50 rounded-xl px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                                />
                            </div>
                            {hfLoading && <div className="text-xs text-muted-foreground">Yukleniyor...</div>}
                            {!hfLoading && hfResults.length === 0 && hfQuery.trim().length >= 2 && (
                                <div className="text-xs text-muted-foreground">Sonuc bulunamadi.</div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {hfResults.map((model: any) => (
                                    <div key={model.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                                        <div className="text-sm font-bold text-white">{model.name}</div>
                                        <div className="text-xs text-muted-foreground">{model.author}</div>
                                        <div className="text-xs text-muted-foreground mt-1">{model.description}</div>
                                    </div>
                                ))}
                            </div>
                            {hfQuery.trim().length >= 2 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setHfPage(prev => Math.max(0, prev - 1))}
                                        disabled={hfPage === 0}
                                        className="px-3 py-1.5 rounded-md text-xs font-bold bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 border border-white/10 disabled:opacity-40"
                                    >
                                        Onceki
                                    </button>
                                    <button
                                        onClick={() => setHfPage(prev => prev + 1)}
                                        className="px-3 py-1.5 rounded-md text-xs font-bold bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 border border-white/10"
                                    >
                                        Sonraki
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        )
    }

    const renderStatistics = () => {
        const fallbackLength = statsPeriod === 'daily' ? 24 : statsPeriod === 'weekly' ? 7 : statsPeriod === 'monthly' ? 30 : 12
        const timeline = (statsData?.tokenTimeline?.length
            ? statsData.tokenTimeline
            : Array.from({ length: fallbackLength }, (_, idx) => ({
                timestamp: Date.now() - (fallbackLength - 1 - idx) * 3600000,
                promptTokens: 0,
                completionTokens: 0
            }))
        )
        const totals = timeline.map((t: any) => (t.promptTokens || 0) + (t.completionTokens || 0))
        const maxTotal = Math.max(1, ...totals)
        const activity = (Array.isArray(statsData?.activity) && statsData.activity.length > 0)
            ? statsData.activity
            : new Array(fallbackLength).fill(0)
        const activityMax = Math.max(1, ...activity)
        const codex = codexUsage?.usage || {}
        const dailyUsed = typeof codex?.dailyUsedPercent === 'number' ? codex.dailyUsedPercent : null
        const weeklyUsed = typeof codex?.weeklyUsedPercent === 'number' ? codex.weeklyUsedPercent : null
        const dailyRemaining = dailyUsed === null ? null : Math.max(0, 100 - dailyUsed)
        const weeklyRemaining = weeklyUsed === null ? null : Math.max(0, 100 - weeklyUsed)
        const antigravityModels = Array.isArray(quotaData?.models) ? quotaData.models : []
        const copilotPercent = typeof copilotQuota?.percentage === 'number' ? copilotQuota.percentage : null

        const formatReset = (value?: string) => {
            if (!value) return '-'
            const date = new Date(value)
            if (Number.isNaN(date.getTime())) return String(value)
            return date.toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        }

        const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)))
        const renderRing = (value: number, color: string) => {
            const percent = clampPercent(value)
            return (
                <div className="relative h-12 w-12">
                    <div
                        className="absolute inset-0 rounded-full"
                        style={{ background: `conic-gradient(${color} ${percent}%, rgba(255,255,255,0.08) 0)` }}
                    />
                    <div className="absolute inset-1 rounded-full bg-card" />
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                        {percent}%
                    </div>
                </div>
            )
        }
        const renderMiniRing = (value: number, color: string) => {
            const percent = clampPercent(value)
            return (
                <div className="relative h-9 w-9">
                    <div
                        className="absolute inset-0 rounded-full"
                        style={{ background: `conic-gradient(${color} ${percent}%, rgba(255,255,255,0.08) 0)` }}
                    />
                    <div className="absolute inset-1 rounded-full bg-card" />
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                        {percent}%
                    </div>
                </div>
            )
        }

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-white">Istatistikler</h3>
                        <p className="text-xs text-muted-foreground">Token ve aktivite ozeti.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(period => (
                            <button
                                key={period}
                                onClick={() => setStatsPeriod(period)}
                                className={cn(
                                    "px-3 py-1.5 rounded-full text-xs font-bold border transition-colors",
                                    statsPeriod === period ? "bg-primary/20 text-primary border-primary/30" : "bg-white/5 text-muted-foreground border-white/10 hover:text-foreground"
                                )}
                            >
                                {period === 'daily' ? 'Gunluk' : period === 'weekly' ? 'Haftalik' : period === 'monthly' ? 'Aylik' : 'Yillik'}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-card p-4 rounded-xl border border-border">
                        <div className="text-xs font-bold uppercase text-muted-foreground">Sohbetler</div>
                        <div className="text-2xl font-black text-white mt-2">{statsData?.chatCount ?? 0}</div>
                    </div>
                    <div className="bg-card p-4 rounded-xl border border-border">
                        <div className="text-xs font-bold uppercase text-muted-foreground">Mesajlar</div>
                        <div className="text-2xl font-black text-white mt-2">{statsData?.messageCount ?? 0}</div>
                    </div>
                    <div className="bg-card p-4 rounded-xl border border-border">
                        <div className="text-xs font-bold uppercase text-muted-foreground">Toplam Token</div>
                        <div className="text-2xl font-black text-white mt-2">{statsData?.totalTokens ?? 0}</div>
                    </div>
                </div>
                <div className="bg-card p-6 rounded-xl border border-border space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-bold text-white">Token Akisi</div>
                            <div className="text-xs text-muted-foreground">Giden / Gelen</div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary/70" />Giden</span>
                            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400/70" />Gelen</span>
                        </div>
                    </div>
                    <div className="h-36 flex items-end gap-1">
                        {timeline.map((point: any, idx: number) => {
                            const prompt = point.promptTokens || 0
                            const completion = point.completionTokens || 0
                            const promptHeight = prompt ? Math.max(4, Math.round((prompt / maxTotal) * 100)) : 2
                            const completionHeight = completion ? Math.max(4, Math.round((completion / maxTotal) * 100)) : 2
                            return (
                                <div key={idx} className="flex-1 flex items-end gap-0.5">
                                    <div className="flex-1 flex items-end">
                                        <div
                                            className="w-full rounded-sm bg-primary/60"
                                            style={{ height: `${promptHeight}%` }}
                                        />
                                    </div>
                                    <div className="flex-1 flex items-end">
                                        <div
                                            className="w-full rounded-sm bg-emerald-400/60"
                                            style={{ height: `${completionHeight}%` }}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
                <div className="bg-card p-6 rounded-xl border border-border space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-bold text-white">Aktivite</div>
                        <div className="text-xs text-muted-foreground">Mesaj sayisi</div>
                    </div>
                    <div className="h-24 flex items-end gap-1">
                        {activity.map((count: number, idx: number) => {
                            const height = Math.max(3, Math.round((count / activityMax) * 100))
                            return (
                                <div key={idx} className="flex-1 flex items-end">
                                    <div
                                        className="w-full rounded-md bg-gradient-to-t from-primary/50 to-primary/10"
                                        style={{ height: `${height}%` }}
                                    />
                                </div>
                            )
                        })}
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-white">Kotalar</h3>
                            <p className="text-xs text-muted-foreground">Servis bazli kalan limitler.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-card p-5 rounded-xl border border-border space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-bold text-white">ChatGPT Codex</div>
                                <div className="text-xs text-muted-foreground">{codexUsage?.planType ? `Plan: ${codexUsage.planType}` : 'Plan: -'}</div>
                            </div>
                            {(dailyRemaining === null && weeklyRemaining === null) && (
                                <div className="text-xs text-muted-foreground">Veri yok.</div>
                            )}
                            {dailyRemaining !== null && (
                                <div className="flex items-center gap-3">
                                    {renderRing(dailyRemaining, 'hsl(var(--primary))')}
                                    <div>
                                        <div className="text-xs font-bold uppercase text-muted-foreground">Gunluk kalan</div>
                                        <div className="text-xs text-muted-foreground">Sifirlama: {formatReset(codex?.dailyResetAt)}</div>
                                    </div>
                                </div>
                            )}
                            {weeklyRemaining !== null && (
                                <div className="flex items-center gap-3">
                                    {renderRing(weeklyRemaining, 'hsl(142 76% 45%)')}
                                    <div>
                                        <div className="text-xs font-bold uppercase text-muted-foreground">Haftalik kalan</div>
                                        <div className="text-xs text-muted-foreground">Sifirlama: {formatReset(codex?.weeklyResetAt)}</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-card p-5 rounded-xl border border-border space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-bold text-white">GitHub Copilot</div>
                                {copilotQuota?.username && <div className="text-xs text-muted-foreground">{copilotQuota.username}</div>}
                            </div>
                            {copilotQuota?.error && (
                                <div className="text-xs text-muted-foreground">{copilotQuota.message || 'Baglanti sorunu.'}</div>
                            )}
                            {copilotPercent === null && !copilotQuota?.error && (
                                <div className="text-xs text-muted-foreground">Veri yok.</div>
                            )}
                            {copilotPercent !== null && (
                                <div className="flex items-center gap-3">
                                    {renderRing(copilotPercent, 'hsl(142 76% 45%)')}
                                    <div>
                                        <div className="text-xs font-bold uppercase text-muted-foreground">Kalan</div>
                                        <div className="text-xs text-muted-foreground">
                                            {copilotQuota?.remaining != null && copilotQuota?.limit ? `${copilotQuota.remaining}/${copilotQuota.limit}` : 'Limit bilgisi yok'}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-card p-5 rounded-xl border border-border space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm font-bold text-white">Antigravity</div>
                                <div className="text-xs text-muted-foreground">
                                    {quotaData?.remaining_credits ? `${quotaData.remaining_credits} kalan` : 'Kalan kredi bilinmiyor'}
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground">Reset: {quotaData?.next_reset || '-'}</div>
                        </div>
                        {antigravityModels.length === 0 && (
                            <div className="text-xs text-muted-foreground">Model kotasi bulunamadi.</div>
                        )}
                        {antigravityModels.length > 0 && (
                            <div className="max-h-64 overflow-y-auto pr-2 space-y-3">
                                {antigravityModels.map((model: any) => (
                                    <div key={model.name} className="rounded-lg border border-white/10 bg-white/5 p-3">
                                        <div className="flex items-center gap-3">
                                            {renderMiniRing(model.percentage, 'hsl(var(--primary))')}
                                            <div className="flex-1">
                                                <div className="text-xs font-bold text-white/80">{model.name}</div>
                                                <div className="text-xs text-muted-foreground">Reset: {model.reset || '-'}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    const renderGallery = () => (
        <div className="space-y-6">
            <div className="bg-card p-6 rounded-xl border border-border">
                <div className="flex items-center gap-3 text-muted-foreground">
                    <LayoutGrid className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Galeri</span>
                </div>
                <div className="text-sm text-muted-foreground mt-4">Henuz kayitli gorsel yok.</div>
            </div>
        </div>
    )

    const renderPersonas = () => {
        if (!settings) return null
        const personas = settings.personas || []
        const isEditing = Boolean(editingPersonaId)

        const handleSavePersona = () => {
            if (!personaDraft.name.trim()) return
            const next = { ...settings }
            const updatedList = [...personas]
            if (isEditing && editingPersonaId) {
                const idx = updatedList.findIndex(p => p.id === editingPersonaId)
                if (idx >= 0) {
                    updatedList[idx] = { ...updatedList[idx], ...personaDraft }
                }
            } else {
                updatedList.push({
                    id: `${Date.now()}`,
                    name: personaDraft.name,
                    description: personaDraft.description,
                    prompt: personaDraft.prompt
                })
            }
            next.personas = updatedList
            applySettings(next)
            handleSave(next)
            setPersonaDraft({ name: '', description: '', prompt: '' })
            setEditingPersonaId(null)
        }

        const handleEditPersona = (persona: any) => {
            setPersonaDraft({
                name: persona.name || '',
                description: persona.description || '',
                prompt: persona.prompt || ''
            })
            setEditingPersonaId(persona.id)
        }

        const handleDeletePersona = (personaId: string) => {
            const next = { ...settings }
            next.personas = personas.filter(p => p.id !== personaId)
            applySettings(next)
            handleSave(next)
            if (editingPersonaId === personaId) {
                setEditingPersonaId(null)
                setPersonaDraft({ name: '', description: '', prompt: '' })
            }
        }

        return (
            <div className="space-y-6">
                <div className="bg-card p-6 rounded-xl border border-border space-y-4">
                    <div>
                        <h3 className="text-lg font-bold text-white">Personalar</h3>
                        <p className="text-xs text-muted-foreground">Yaniti sekillendiren kisilestirme profilleri.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        <input
                            type="text"
                            placeholder="Persona adi"
                            value={personaDraft.name}
                            onChange={e => setPersonaDraft(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 text-sm text-primary"
                        />
                        <input
                            type="text"
                            placeholder="Kisa aciklama"
                            value={personaDraft.description}
                            onChange={e => setPersonaDraft(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 text-sm text-primary"
                        />
                        <textarea
                            placeholder="Prompt"
                            value={personaDraft.prompt}
                            onChange={e => setPersonaDraft(prev => ({ ...prev, prompt: e.target.value }))}
                            className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 text-sm text-primary min-h-[120px]"
                        />
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleSavePersona}
                                className="px-3 py-2 rounded-lg text-xs font-bold bg-primary/20 text-primary hover:bg-primary/30 border border-white/10"
                            >
                                {isEditing ? 'Guncelle' : 'Ekle'}
                            </button>
                            {isEditing && (
                                <button
                                    onClick={() => {
                                        setEditingPersonaId(null)
                                        setPersonaDraft({ name: '', description: '', prompt: '' })
                                    }}
                                    className="px-3 py-2 rounded-lg text-xs font-bold bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 border border-white/10"
                                >
                                    Iptal
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                    {personas.length === 0 && (
                        <div className="text-sm text-muted-foreground">Persona yok.</div>
                    )}
                    {personas.map(persona => (
                        <div key={persona.id} className="bg-card p-4 rounded-xl border border-border flex items-center justify-between gap-4">
                            <div>
                                <div className="text-sm font-bold text-white">{persona.name}</div>
                                <div className="text-xs text-muted-foreground">{persona.description}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleEditPersona(persona)}
                                    className="px-3 py-1.5 rounded-md text-xs font-bold bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 border border-white/10"
                                >
                                    Duzenle
                                </button>
                                <button
                                    onClick={() => handleDeletePersona(persona.id)}
                                    className="px-3 py-1.5 rounded-md text-xs font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                                >
                                    Sil
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (!settings) return <div className="p-10 text-center text-muted-foreground"><BrainCircuit className="w-10 h-10 animate-pulse mx-auto mb-4 opacity-20" /> Yükleniyor...</div>
    const language = settings?.general?.language as Language || 'tr'

    return (
        <div className="h-full w-full overflow-y-auto bg-background">
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="max-w-5xl mx-auto space-y-8 px-6 py-8"
            >
                {activeTab === 'general' && renderGeneral()}
                {(activeTab === 'mcp-servers' || activeTab === 'mcp-marketplace') && (
                    <MCPPage
                        language={language}
                        embedded
                        activeTab={activeTab === 'mcp-marketplace' ? 'marketplace' : 'servers'}
                    />
                )}
                {activeTab === 'accounts' && renderAccounts()}
                {activeTab === 'appearance' && renderAppearance()}
                {activeTab === 'models' && renderModels()}
                {activeTab === 'statistics' && renderStatistics()}
                {activeTab === 'gallery' && renderGallery()}
                {activeTab === 'personas' && renderPersonas()}
            </motion.div>
            {statusMessage && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="fixed bottom-8 right-8 bg-primary text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/20"
                >
                    <FolderPlus className="w-4 h-4" />
                    <span className="font-bold text-sm uppercase tracking-wider">{statusMessage}</span>
                    <button onClick={() => setStatusMessage('')}><X className="w-4 h-4 opacity-60" /></button>
                </motion.div>
            )}
        </div>
    )
}
