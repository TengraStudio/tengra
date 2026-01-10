import React from 'react'
import { RefreshCw, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AppSettings } from '../../../../shared/types'
import chatgptLogo from '@/assets/chatgpt.svg'
import antigravityLogo from '@/assets/antigravity.svg'
import claudeLogo from '@/assets/claude.svg'

import copilotLogo from '@/assets/copilot.png'
import ollamaLogo from '@/assets/ollama.svg'

interface AccountsTabProps {
    settings: AppSettings | null
    authStatus: { codex: boolean; claude: boolean; antigravity: boolean }
    authBusy: string | null
    authMessage: string
    isOllamaRunning: boolean
    refreshAuthStatus: () => void
    connectGitHubProfile: () => void
    connectCopilot: () => void
    connectBrowserProvider: (p: 'codex' | 'claude' | 'antigravity') => void
    disconnectProvider: (p: 'copilot' | 'codex' | 'claude' | 'antigravity') => void
    startOllama: () => void
    checkOllama: () => void
    handleSave: (s?: AppSettings) => void
    setSettings: (s: AppSettings) => void
    t: (key: string) => string
}

export const AccountsTab: React.FC<AccountsTabProps> = ({
    settings, authStatus, authBusy, authMessage, isOllamaRunning, refreshAuthStatus,
    connectGitHubProfile, connectCopilot, connectBrowserProvider, disconnectProvider,
    startOllama, checkOllama, handleSave, setSettings, t
}) => {
    if (!settings) return null

    const isCopilotConnected = Boolean(settings.copilot?.connected || settings.copilot?.token)
    const isGitHubConnected = Boolean(settings.github?.token)
    const isCodexConnected = authStatus.codex
    const isClaudeConnected = authStatus.claude

    const isAntigravityConnected = authStatus.antigravity

    const accountCards = [
        { id: 'github', title: t('accounts.services.github'), description: t('accounts.githubDesc'), logo: copilotLogo, connected: isGitHubConnected, onConnect: connectGitHubProfile, onDisconnect: () => { const updated = { ...settings, github: { ...settings.github, token: '' } }; setSettings(updated); handleSave(updated); } },
        { id: 'copilot', title: t('accounts.services.copilot'), description: t('accounts.copilotDesc'), logo: copilotLogo, connected: isCopilotConnected, onConnect: connectCopilot, onDisconnect: () => disconnectProvider('copilot') },
        { id: 'antigravity', title: t('accounts.services.antigravity'), description: t('accounts.antigravityDesc'), logo: antigravityLogo, connected: isAntigravityConnected, onConnect: () => connectBrowserProvider('antigravity'), onDisconnect: () => disconnectProvider('antigravity') },
        { id: 'codex', title: t('accounts.services.codex'), description: t('accounts.codexDesc'), logo: chatgptLogo, connected: isCodexConnected, onConnect: () => connectBrowserProvider('codex'), onDisconnect: () => disconnectProvider('codex') },
        { id: 'claude', title: t('accounts.services.claude'), description: t('accounts.claudeDesc'), logo: claudeLogo, connected: isClaudeConnected, onConnect: () => connectBrowserProvider('claude'), onDisconnect: () => disconnectProvider('claude') }
    ]

    const normalizeKeyValue = (value?: string) => (value === 'connected' ? '' : (value || ''))
    const apiKeyProviders = ['openai', 'anthropic', 'groq', 'huggingface'] as const
    type ApiKeyProvider = typeof apiKeyProviders[number]

    const getProviderApiKey = (provider: ApiKeyProvider): string => {
        if (provider === 'huggingface') return normalizeKeyValue(settings.huggingface?.apiKey)
        if (provider === 'openai') return normalizeKeyValue(settings.openai?.apiKey)
        if (provider === 'anthropic') return normalizeKeyValue(settings.anthropic?.apiKey)

        if (provider === 'groq') return normalizeKeyValue(settings.groq?.apiKey)
        return ''
    }

    const updateProviderApiKey = (provider: ApiKeyProvider, apiKey: string) => {
        const updated = { ...settings }
        if (provider === 'huggingface') {
            updated.huggingface = { apiKey }
        } else if (provider === 'openai') {
            updated.openai = { apiKey, model: updated.openai?.model || '' }
        } else if (provider === 'anthropic') {
            updated.anthropic = { apiKey, model: updated.anthropic?.model || '' }

        } else if (provider === 'groq') {
            updated.groq = { apiKey, model: updated.groq?.model || '' }
        }
        setSettings(updated)
        handleSave(updated)
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-white">{t('accounts.title')}</h3>
                    <p className="text-xs text-muted-foreground">{t('accounts.subtitle')}</p>
                </div>
                <button onClick={refreshAuthStatus} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors">
                    <RefreshCw className="h-3.5 w-3.5" /> {t('common.refresh')}
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
                                    {card.connected ? t('accounts.connected') : t('accounts.disconnected')}
                                </span>
                                {card.connected ? (
                                    <button onClick={card.onDisconnect} className="px-2.5 py-1 rounded-md text-xs font-bold bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 border border-white/10">{t('accounts.disconnect')}</button>
                                ) : (
                                    <button onClick={card.onConnect} disabled={!!authBusy} className={cn("px-2.5 py-1 rounded-md text-xs font-bold border border-white/10 flex items-center gap-1", isBusy ? "bg-white/5 text-muted-foreground" : authBusy ? "opacity-50 cursor-not-allowed text-muted-foreground" : "bg-primary/20 text-primary hover:bg-primary/30")}>
                                        <ExternalLink className="h-3 w-3" /> {t('accounts.connect')}
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
                    <div className="flex-1 text-sm font-bold text-white">Ollama</div>
                    <span className={cn("text-xs font-bold uppercase tracking-wider", isOllamaRunning ? "text-emerald-400" : "text-muted-foreground")}>{isOllamaRunning ? t('accounts.running') : t('accounts.notRunning')}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-xs font-bold uppercase text-muted-foreground">{t('accounts.serverAddress')}</label>
                        <input type="text" value={settings?.ollama?.url} onChange={e => setSettings({ ...settings, ollama: { ...settings.ollama, url: e.target.value } })} onBlur={() => handleSave()} className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 font-mono text-primary" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold uppercase text-muted-foreground">{t('accounts.contextLimit')}</label>
                        <input type="number" value={settings?.ollama?.numCtx} onChange={e => setSettings({ ...settings, ollama: { ...settings.ollama, numCtx: Number(e.target.value) } })} onBlur={() => handleSave()} className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 font-mono text-primary" />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={checkOllama} className="px-2.5 py-1 rounded-md text-xs font-bold bg-white/5 text-muted-foreground border border-white/10">{t('accounts.check')}</button>
                    {!isOllamaRunning && <button onClick={startOllama} className="px-2.5 py-1 rounded-md text-xs font-bold bg-primary/20 text-primary border border-white/10">{t('accounts.start')}</button>}
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">{t('accounts.apiKey')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {apiKeyProviders.map(p => (
                        <div key={p} className="bg-card p-4 rounded-xl border border-border space-y-2">
                            <label className="text-xs font-bold uppercase text-muted-foreground">{p}</label>
                            <input
                                type="password"
                                value={getProviderApiKey(p)}
                                onChange={e => updateProviderApiKey(p, e.target.value)}
                                className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 font-mono text-primary"
                                placeholder={t('accounts.enterApiKey')}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
