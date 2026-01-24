import { LinkedAccountInfo } from '@renderer/electron.d'
import { DeviceCodeModal, DeviceCodeModalState } from '@renderer/features/settings/components/DeviceCodeModal'
import { UseLinkedAccountsResult } from '@renderer/features/settings/hooks/useLinkedAccounts'
import { ChevronDown, ExternalLink, Plus, RefreshCw } from 'lucide-react'
import React, { useState } from 'react'

import antigravityLogo from '@/assets/antigravity.svg'
import chatgptLogo from '@/assets/chatgpt.svg'
import claudeLogo from '@/assets/claude.svg'
import copilotLogo from '@/assets/copilot.png'
import ollamaLogo from '@/assets/ollama.svg'
import { cn } from '@/lib/utils'
import { AppSettings } from '@/types'

import { AccountRow } from './accounts/AccountRow'

type ProviderCategory = 'ai' | 'developer' | 'local'

interface ProviderConfig {
    id: string
    name: string
    description: string
    logo: string
    category: ProviderCategory
}

const PROVIDERS: ProviderConfig[] = [
    // AI Providers
    { id: 'claude', name: 'accounts.providers.claude.name', description: 'accounts.providers.claude.description', logo: claudeLogo, category: 'ai' },
    { id: 'codex', name: 'accounts.providers.codex.name', description: 'accounts.providers.codex.description', logo: chatgptLogo, category: 'ai' },
    { id: 'antigravity', name: 'accounts.providers.antigravity.name', description: 'accounts.providers.antigravity.description', logo: antigravityLogo, category: 'ai' },
    // Developer Tools
    { id: 'github', name: 'accounts.providers.github.name', description: 'accounts.providers.github.description', logo: copilotLogo, category: 'developer' },
    { id: 'copilot', name: 'accounts.providers.copilot.name', description: 'accounts.providers.copilot.description', logo: copilotLogo, category: 'developer' },
]

interface AccountsTabProps {
    settings: AppSettings | null
    linkedAccounts: UseLinkedAccountsResult
    authBusy: string | null
    authMessage: string
    isOllamaRunning: boolean
    refreshAuthStatus: () => void
    connectGitHubProfile: () => void
    connectCopilot: () => void
    connectBrowserProvider: (p: 'codex' | 'claude' | 'antigravity') => void
    startOllama: () => void
    checkOllama: () => void
    handleSave: (s?: AppSettings) => void
    setSettings: (s: AppSettings) => void
    deviceCodeModal?: DeviceCodeModalState
    closeDeviceCodeModal?: () => void
    setManualSessionModal: (state: import('./ManualSessionModal').ManualSessionModalState) => void
    t: (key: string) => string
}

interface ProviderCardProps {
    provider: ProviderConfig
    accounts: LinkedAccountInfo[]
    authBusy: string | null
    onConnect: (providerId: string) => void
    onUnlink: (accountId: string) => Promise<void>
    onSetActive: (providerId: string, accountId: string) => Promise<void>
    onShowManualSession: (accountId: string, email?: string) => void
    t: (key: string) => string
}

const ProviderCard = React.memo<ProviderCardProps>(({
    provider, accounts, authBusy, onConnect, onUnlink, onSetActive, onShowManualSession, t
}) => {
    const [expanded, setExpanded] = useState(accounts.length > 0)
    const isBusy = authBusy === provider.id
    const hasAccounts = accounts.length > 0
    const accountCount = accounts.length

    // Update expanded state when accounts change (e.g. first account added)
    React.useEffect(() => {
        if (accounts.length > 0 && !expanded) {
            setExpanded(true)
        }
    }, [accounts.length, expanded])

    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Provider Header */}
            <div
                className={cn(
                    "p-4 flex items-center gap-4 transition-colors",
                    hasAccounts && "cursor-pointer hover:bg-muted/30"
                )}
                onClick={() => hasAccounts && setExpanded(!expanded)}
            >
                <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center overflow-hidden shrink-0">
                    <img
                        src={provider.logo}
                        alt=""
                        className={cn(
                            "h-7 w-7 object-contain",
                            ["anthropic", "github", "ollama", "deepseek", "claude", "antigravity", "codex", "copilot"].includes(provider.id) && "theme-logo-invert"
                        )}
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-foreground">{t(provider.name)}</div>
                    <div className="text-xs text-muted-foreground truncate">{t(provider.description)}</div>
                </div>
                <div className="flex items-center gap-3">
                    {hasAccounts ? (
                        <>
                            <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-500 text-xs font-bold">
                                {accountCount} {t('accounts.accountCount').replace('{{count}}', '').trim()}
                            </span>
                            <ChevronDown className={cn(
                                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                                expanded && "rotate-180"
                            )} />
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!authBusy) {
                                    onConnect(provider.id);
                                }
                            }}
                            disabled={!!authBusy}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1.5",
                                isBusy ? "bg-muted/50 text-muted-foreground border-border" :
                                    authBusy ? "opacity-50 cursor-not-allowed text-muted-foreground border-border" :
                                        "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                            )}
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {t('accounts.connect')}
                        </button>
                    )}
                </div>
            </div>

            {/* Expanded Account List */}
            {hasAccounts && expanded && (
                <div className="border-t border-border">
                    {accounts.map((account, index) => (
                        <AccountRow
                            key={account.id}
                            account={account}
                            isLast={index === accounts.length - 1}
                            providerId={provider.id}
                            onUnlink={onUnlink}
                            onSetActive={onSetActive}
                            onShowManualSession={onShowManualSession}
                            t={t}
                        />
                    ))}

                    {/* Add Another Account Button */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onConnect(provider.id);
                        }}
                        disabled={!!authBusy}
                        className={cn(
                            "w-full px-3 py-2.5 rounded-lg text-xs font-medium border border-dashed flex items-center justify-center gap-2 transition-colors",
                            authBusy ? "opacity-50 cursor-not-allowed text-muted-foreground border-border" :
                                "text-muted-foreground border-border hover:text-foreground hover:border-foreground/30 hover:bg-muted/30"
                        )}
                    >
                        <Plus className="h-3.5 w-3.5" />
                        {t('accounts.addAnotherAccount')}
                    </button>
                </div>
            )}
        </div>
    )
})

const ProviderList = React.memo(({
    title,
    providers,
    accounts,
    authBusy,
    onConnect,
    onUnlink,
    onSetActive,
    onShowManualSession,
    t
}: {
    title: string
    providers: ProviderConfig[]
    accounts: LinkedAccountInfo[]
    authBusy: string | null
    onConnect: (id: string) => void
    onUnlink: (id: string) => Promise<void>
    onSetActive: (pid: string, aid: string) => Promise<void>
    onShowManualSession: (aid: string, email?: string) => void
    t: (k: string) => string
}) => {
    return (
        <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {title}
            </h3>
            <div className="space-y-3">
                {providers.map(provider => (
                    <ProviderCard
                        key={provider.id}
                        provider={provider}
                        accounts={accounts.filter(a => a.provider === provider.id)}
                        authBusy={authBusy}
                        onConnect={onConnect}
                        onUnlink={onUnlink}
                        onSetActive={onSetActive}
                        onShowManualSession={onShowManualSession}
                        t={t}
                    />
                ))}
            </div>
        </section>
    )
})
ProviderList.displayName = 'ProviderList'

const OllamaSection = React.memo(({
    isRunning,
    settings,
    setSettings,
    handleSave,
    startOllama,
    checkOllama,
    t
}: {
    isRunning: boolean
    settings: AppSettings
    setSettings: (s: AppSettings) => void
    handleSave: (s?: AppSettings) => void
    startOllama: () => void
    checkOllama: () => void
    t: (k: string) => string
}) => {
    return (
        <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t('accounts.categories.localModels')}
            </h3>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="p-4 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center overflow-hidden shrink-0">
                        <img src={ollamaLogo} alt="Ollama" className="h-7 w-7 object-contain theme-logo-invert" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-foreground">{t('accounts.providers.ollama.name')}</div>
                        <div className="text-xs text-muted-foreground">{t('accounts.providers.ollama.description')}</div>
                    </div>
                    <span className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-bold",
                        isRunning
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-muted text-muted-foreground"
                    )}>
                        {isRunning ? t('accounts.running') : t('accounts.notRunning')}
                    </span>
                </div>

                <div className="border-t border-border p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase text-muted-foreground">{t('accounts.serverAddress')}</label>
                            <input
                                type="text"
                                value={settings.ollama.url}
                                onChange={e => setSettings({ ...settings, ollama: { ...settings.ollama, url: e.target.value } })}
                                onBlur={() => handleSave()}
                                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 font-mono text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase text-muted-foreground">{t('accounts.contextLimit')}</label>
                            <input
                                type="number"
                                value={settings.ollama.numCtx ?? 16384}
                                onChange={e => setSettings({ ...settings, ollama: { ...settings.ollama, numCtx: Number(e.target.value) } })}
                                onBlur={() => handleSave()}
                                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 font-mono text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                checkOllama();
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-muted/50 text-muted-foreground border border-border hover:bg-muted hover:text-foreground transition-colors"
                        >
                            {t('accounts.check')}
                        </button>
                        {!isRunning && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    startOllama();
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                            >
                                {t('accounts.start')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </section>
    )
})
OllamaSection.displayName = 'OllamaSection'

export const AccountsTab: React.FC<AccountsTabProps> = React.memo(({
    settings, linkedAccounts, authBusy, authMessage, isOllamaRunning,
    connectGitHubProfile, connectCopilot, connectBrowserProvider,
    startOllama, checkOllama, handleSave, setSettings, deviceCodeModal, closeDeviceCodeModal,
    setManualSessionModal, t
}) => {
    const handleConnect = React.useCallback((providerId: string) => {
        switch (providerId) {
            case 'github': connectGitHubProfile(); break
            case 'copilot': connectCopilot(); break
            case 'codex': connectBrowserProvider('codex'); break
            case 'claude': connectBrowserProvider('claude'); break
            case 'antigravity': connectBrowserProvider('antigravity'); break
        }
    }, [connectGitHubProfile, connectCopilot, connectBrowserProvider])

    const handleRefresh = React.useCallback(() => {
        void linkedAccounts.refreshAccounts()
    }, [linkedAccounts])

    const aiProviders = React.useMemo(() => PROVIDERS.filter(p => p.category === 'ai'), [])
    const developerProviders = React.useMemo(() => PROVIDERS.filter(p => p.category === 'developer'), [])

    const handleShowManualSession = React.useCallback((accountId: string, email?: string) => {
        setManualSessionModal({ isOpen: true, accountId, email })
    }, [setManualSessionModal])

    if (!settings) { return null }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-foreground">{t('accounts.title')}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">{t('accounts.subtitle')}</p>
                </div>
                <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRefresh();
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                    <RefreshCw className={cn("h-3.5 w-3.5", linkedAccounts.loading && "animate-spin")} />
                    {t('common.refresh')}
                </button>
            </div>

            {/* Auth Message */}
            {authMessage && (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground animate-in fade-in slide-in-from-top-2">
                    {authMessage}
                </div>
            )}

            <ProviderList
                title={t('accounts.categories.aiProviders')}
                providers={aiProviders}
                accounts={linkedAccounts.accounts}
                authBusy={authBusy}
                onConnect={handleConnect}
                onUnlink={linkedAccounts.unlinkAccount}
                onSetActive={linkedAccounts.setActiveAccount}
                onShowManualSession={handleShowManualSession}
                t={t}
            />

            <ProviderList
                title={t('accounts.categories.developerTools')}
                providers={developerProviders}
                accounts={linkedAccounts.accounts}
                authBusy={authBusy}
                onConnect={handleConnect}
                onUnlink={linkedAccounts.unlinkAccount}
                onSetActive={linkedAccounts.setActiveAccount}
                onShowManualSession={handleShowManualSession}
                t={t}
            />

            <OllamaSection
                isRunning={isOllamaRunning}
                settings={settings}
                setSettings={setSettings}
                handleSave={handleSave}
                startOllama={startOllama}
                checkOllama={checkOllama}
                t={t}
            />

            {/* Device Code Modal */}
            {deviceCodeModal && closeDeviceCodeModal && (
                <DeviceCodeModal
                    {...deviceCodeModal}
                    onClose={closeDeviceCodeModal}
                />
            )}
        </div>
    )
})

ProviderCard.displayName = 'ProviderCard'
AccountsTab.displayName = 'AccountsTab'
