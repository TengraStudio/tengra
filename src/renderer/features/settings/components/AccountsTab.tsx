import { LinkedAccountInfo } from '@renderer/electron.d';
import { DeviceCodeModal, DeviceCodeModalState } from '@renderer/features/settings/components/DeviceCodeModal';
import { UseLinkedAccountsResult } from '@renderer/features/settings/hooks/useLinkedAccounts';
import { Bot, ChevronDown, Cpu, ExternalLink, Key, Plus, RefreshCw, Sparkles, Trash2, Zap } from 'lucide-react';
import React, { useState } from 'react';

import antigravityLogo from '@/assets/antigravity.svg';
import chatgptLogo from '@/assets/chatgpt.svg';
import claudeLogo from '@/assets/claude.svg';
import copilotLogo from '@/assets/copilot.png';
import geminiLogo from '@/assets/gemini.png';
import ollamaLogo from '@/assets/ollama.svg';
import { cn } from '@/lib/utils';
import { AppSettings } from '@/types';

import { AuthBusyState } from '../types';

import { AccountRow } from './accounts/AccountRow';

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
];

const PROVIDER_ACCOUNT_ALIASES: Record<string, string[]> = {
    claude: ['claude', 'anthropic'],
    codex: ['codex', 'openai'],
    antigravity: ['antigravity', 'google', 'gemini'],
    github: ['github'],
    copilot: ['copilot', 'copilot_token']
};

/**
 * API Key provider configuration for direct API access
 */
interface ApiKeyProviderConfig {
    id: keyof Pick<AppSettings, 'openai' | 'anthropic' | 'gemini' | 'mistral' | 'groq' | 'together' | 'perplexity' | 'cohere' | 'xai' | 'deepseek' | 'openrouter'>;
    name: string;
    description: string;
    logo?: string;
    icon?: React.ComponentType<{ className?: string }>;
    placeholder: string;
    docsUrl?: string;
}

const API_KEY_PROVIDERS: ApiKeyProviderConfig[] = [
    { id: 'openai', name: 'accounts.apiProviders.openai.name', description: 'accounts.apiProviders.openai.description', logo: chatgptLogo, placeholder: 'sk-...', docsUrl: 'https://platform.openai.com/api-keys' },
    { id: 'anthropic', name: 'accounts.apiProviders.anthropic.name', description: 'accounts.apiProviders.anthropic.description', logo: claudeLogo, placeholder: 'sk-ant-...', docsUrl: 'https://console.anthropic.com/settings/keys' },
    { id: 'gemini', name: 'accounts.apiProviders.gemini.name', description: 'accounts.apiProviders.gemini.description', logo: geminiLogo, placeholder: 'AIza...', docsUrl: 'https://aistudio.google.com/apikey' },
    { id: 'mistral', name: 'accounts.apiProviders.mistral.name', description: 'accounts.apiProviders.mistral.description', icon: Sparkles, placeholder: 'API key', docsUrl: 'https://console.mistral.ai/api-keys' },
    { id: 'groq', name: 'accounts.apiProviders.groq.name', description: 'accounts.apiProviders.groq.description', icon: Zap, placeholder: 'gsk_...', docsUrl: 'https://console.groq.com/keys' },
    { id: 'together', name: 'accounts.apiProviders.together.name', description: 'accounts.apiProviders.together.description', icon: Bot, placeholder: 'API key', docsUrl: 'https://api.together.xyz/settings/api-keys' },
    { id: 'perplexity', name: 'accounts.apiProviders.perplexity.name', description: 'accounts.apiProviders.perplexity.description', icon: Sparkles, placeholder: 'pplx-...', docsUrl: 'https://www.perplexity.ai/settings/api' },
    { id: 'cohere', name: 'accounts.apiProviders.cohere.name', description: 'accounts.apiProviders.cohere.description', icon: Bot, placeholder: 'API key', docsUrl: 'https://dashboard.cohere.com/api-keys' },
    { id: 'xai', name: 'accounts.apiProviders.xai.name', description: 'accounts.apiProviders.xai.description', icon: Sparkles, placeholder: 'xai-...', docsUrl: 'https://console.x.ai/' },
    { id: 'deepseek', name: 'accounts.apiProviders.deepseek.name', description: 'accounts.apiProviders.deepseek.description', icon: Bot, placeholder: 'sk-...', docsUrl: 'https://platform.deepseek.com/api_keys' },
    { id: 'openrouter', name: 'accounts.apiProviders.openrouter.name', description: 'accounts.apiProviders.openrouter.description', icon: Key, placeholder: 'sk-or-...', docsUrl: 'https://openrouter.ai/keys' },
];

interface AccountsTabProps {
    settings: AppSettings | null
    linkedAccounts: UseLinkedAccountsResult
    authBusy: AuthBusyState | null
    authMessage: string
    isOllamaRunning: boolean
    refreshAuthStatus: () => void
    connectGitHubProfile: () => void
    connectCopilot: () => void
    connectBrowserProvider: (p: 'codex' | 'claude' | 'antigravity') => void
    cancelAuthFlow: () => void
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
    authBusy: AuthBusyState | null
    onConnect: (providerId: string) => void
    onUnlink: (accountId: string) => Promise<void>
    onSetActive: (providerId: string, accountId: string) => Promise<void>
    onShowManualSession: (accountId: string, email?: string) => void
    t: (key: string) => string
}

const ProviderCard = React.memo<ProviderCardProps>(({
    provider, accounts, authBusy, onConnect, onUnlink, onSetActive, onShowManualSession, t
}) => {
    const [expanded, setExpanded] = useState(accounts.length > 0);
    const isBusy = authBusy?.provider === provider.id;
    const hasAccounts = accounts.length > 0;
    const accountCount = accounts.length;

    // Update expanded state when accounts change (e.g. first account added)
    React.useEffect(() => {
        if (accounts.length > 0 && !expanded) {
            setExpanded(true);
        }
    }, [accounts.length, expanded]);

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
                            <span className="px-2.5 py-1 rounded-md bg-success/10 text-success text-xs font-bold">
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
                                onConnect(provider.id);
                            }}
                            disabled={isBusy}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1.5",
                                isBusy ? "bg-muted/50 text-muted-foreground border-border" :
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
                            isBusy={isBusy}
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
                        disabled={isBusy}
                        className={cn(
                            "w-full px-3 py-2.5 rounded-lg text-xs font-medium border border-dashed flex items-center justify-center gap-2 transition-colors",
                            isBusy ? "opacity-50 cursor-not-allowed text-muted-foreground border-border" :
                                "text-muted-foreground border-border hover:text-foreground hover:border-foreground/30 hover:bg-muted/30"
                        )}
                    >
                        <Plus className="h-3.5 w-3.5" />
                        {t('accounts.addAnotherAccount')}
                    </button>
                </div>
            )}
        </div>
    );
});

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
    authBusy: AuthBusyState | null
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
                        accounts={accounts.filter(a => (PROVIDER_ACCOUNT_ALIASES[provider.id] ?? [provider.id]).includes(a.provider.toLowerCase()))}
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
    );
});
ProviderList.displayName = 'ProviderList';

/**
 * Individual API Key Provider Card with multi-key support
 */
const ApiKeyProviderCard = React.memo(({
    provider,
    apiKeys,
    onAddKey,
    onRemoveKey,
    t
}: {
    provider: ApiKeyProviderConfig
    apiKeys: string[]
    onAddKey: (key: string) => void
    onRemoveKey: (index: number) => void
    t: (k: string) => string
}) => {
    const [newKey, setNewKey] = useState('');
    const [expanded, setExpanded] = useState(false);
    const hasKeys = apiKeys.length > 0;
    const IconComponent = provider.icon;

    const handleAddKey = () => {
        if (newKey.trim()) {
            onAddKey(newKey.trim());
            setNewKey('');
        }
    };

    const maskKey = (key: string) => {
        if (key.length <= 8) {
            return '••••••••';
        }
        return `${key.slice(0, 4)}${'•'.repeat(Math.min(key.length - 8, 20))}${key.slice(-4)}`;
    };

    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div
                className={cn(
                    "p-4 flex items-center gap-4 transition-colors",
                    hasKeys && "cursor-pointer hover:bg-muted/30"
                )}
                onClick={() => hasKeys && setExpanded(!expanded)}
            >
                <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center overflow-hidden shrink-0">
                    {provider.logo ? (
                        <img
                            src={provider.logo}
                            alt=""
                            className={cn(
                                "h-7 w-7 object-contain",
                                ["anthropic", "deepseek", "claude"].includes(provider.id) && "theme-logo-invert"
                            )}
                        />
                    ) : IconComponent ? (
                        <IconComponent className="h-7 w-7 text-primary" />
                    ) : (
                        <Key className="h-7 w-7 text-primary" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-foreground">{t(provider.name)}</div>
                    <div className="text-xs text-muted-foreground truncate">{t(provider.description)}</div>
                </div>
                <div className="flex items-center gap-3">
                    {hasKeys ? (
                        <>
                            <span className="px-2.5 py-1 rounded-md bg-success/10 text-success text-xs font-bold">
                                {apiKeys.length} {t('accounts.apiKey')}
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
                                setExpanded(true);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                        >
                            <Plus className="h-3.5 w-3.5 inline mr-1" />
                            {t('accounts.addApiKey')}
                        </button>
                    )}
                </div>
            </div>

            {/* Expanded Keys List */}
            {expanded && (
                <div className="border-t border-border p-4 space-y-3">
                    {/* Existing Keys */}
                    {apiKeys.map((key, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <div className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2 font-mono text-sm text-muted-foreground">
                                {maskKey(key)}
                            </div>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onRemoveKey(index);
                                }}
                                className="p-2 rounded-lg border border-border text-destructive hover:bg-destructive/10 transition-colors"
                                title={t('common.delete')}
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))}

                    {/* Add New Key */}
                    <div className="flex items-center gap-2">
                        <input
                            type="password"
                            placeholder={provider.placeholder}
                            value={newKey}
                            onChange={(e) => setNewKey(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddKey()}
                            className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2 font-mono text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        />
                        <button
                            type="button"
                            onClick={handleAddKey}
                            disabled={!newKey.trim()}
                            className={cn(
                                "px-3 py-2 rounded-lg text-xs font-bold border transition-colors",
                                newKey.trim()
                                    ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                                    : "bg-muted/50 text-muted-foreground border-border cursor-not-allowed"
                            )}
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Docs Link */}
                    {provider.docsUrl && (
                        <a
                            href={provider.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                            <ExternalLink className="h-3 w-3" />
                            {t('accounts.getApiKey')}
                        </a>
                    )}
                </div>
            )}
        </div>
    );
});
ApiKeyProviderCard.displayName = 'ApiKeyProviderCard';

/**
 * API Key Providers Section - manages all API key based providers
 */
const ApiKeyProvidersSection = React.memo(({
    settings,
    setSettings,
    handleSave,
    t
}: {
    settings: AppSettings
    setSettings: (s: AppSettings) => void
    handleSave: (s?: AppSettings) => void
    t: (k: string) => string
}) => {
    const getApiKeys = (providerId: ApiKeyProviderConfig['id']): string[] => {
        const provider = settings[providerId];
        if (!provider) {
            return [];
        }
        // Support both new apiKeys array and legacy apiKey string
        if ('apiKeys' in provider && Array.isArray(provider.apiKeys)) {
            return provider.apiKeys;
        }
        if ('apiKey' in provider && typeof provider.apiKey === 'string' && provider.apiKey) {
            return [provider.apiKey];
        }
        return [];
    };

    const handleAddKey = (providerId: ApiKeyProviderConfig['id'], key: string) => {
        const currentKeys = getApiKeys(providerId);
        const newKeys = [...currentKeys, key];

        const defaultModels: Record<string, string> = {
            openai: 'gpt-4o',
            anthropic: 'claude-sonnet-4-6',
            gemini: 'gemini-2.5-flash',
            mistral: 'magistral-medium-2507',
            groq: 'llama-3.3-70b-versatile',
            together: 'Qwen/Qwen3.5-397B-A17B',
            perplexity: 'sonar-pro',
            cohere: 'command-a-03-2025',
            xai: 'grok-4.20',
            deepseek: 'deepseek-chat',
            openrouter: 'anthropic/claude-sonnet-4'
        };

        setSettings({
            ...settings,
            [providerId]: {
                ...settings[providerId],
                apiKeys: newKeys,
                model: settings[providerId]?.model ?? defaultModels[providerId] ?? ''
            }
        });
        handleSave();
    };

    const handleRemoveKey = (providerId: ApiKeyProviderConfig['id'], index: number) => {
        const currentKeys = getApiKeys(providerId);
        const newKeys = currentKeys.filter((_, i) => i !== index);

        if (newKeys.length === 0) {
            // Remove the provider settings entirely if no keys left
            const newSettings = { ...settings };
            delete newSettings[providerId];
            setSettings(newSettings);
        } else {
            setSettings({
                ...settings,
                [providerId]: {
                    ...settings[providerId],
                    apiKeys: newKeys
                }
            });
        }
        handleSave();
    };

    return (
        <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t('accounts.categories.apiKeyProviders')}
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
                {t('accounts.apiKeyProvidersDescription')}
            </p>
            <div className="space-y-3">
                {API_KEY_PROVIDERS.map(provider => (
                    <ApiKeyProviderCard
                        key={provider.id}
                        provider={provider}
                        apiKeys={getApiKeys(provider.id)}
                        onAddKey={(key) => handleAddKey(provider.id, key)}
                        onRemoveKey={(index) => handleRemoveKey(provider.id, index)}
                        t={t}
                    />
                ))}
            </div>
        </section>
    );
});
ApiKeyProvidersSection.displayName = 'ApiKeyProvidersSection';

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
                        <img src={ollamaLogo} alt={t('accounts.providers.ollama.name')} className="h-7 w-7 object-contain theme-logo-invert" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-foreground">{t('accounts.providers.ollama.name')}</div>
                        <div className="text-xs text-muted-foreground">{t('accounts.providers.ollama.description')}</div>
                    </div>
                    <span className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-bold",
                        isRunning
                            ? "bg-success/10 text-success"
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
    );
});
OllamaSection.displayName = 'OllamaSection';

const NvidiaSection = React.memo(({
    settings,
    setSettings,
    handleSave,
    t
}: {
    settings: AppSettings
    setSettings: (s: AppSettings) => void
    handleSave: (s?: AppSettings) => void
    t: (k: string) => string
}) => {
    return (
        <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t('accounts.categories.aiProvidersNvidia')}
            </h3>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="p-4 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center overflow-hidden shrink-0">
                        <Cpu className="h-7 w-7 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-foreground">{t('accounts.providers.nvidia.name')}</div>
                        <div className="text-xs text-muted-foreground">{t('accounts.providers.nvidia.description')}</div>
                    </div>
                    <span className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-bold",
                        settings.nvidia?.apiKey
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground"
                    )}>
                        {settings.nvidia?.apiKey ? t('accounts.connected') : t('accounts.disconnected')}
                    </span>
                </div>

                <div className="border-t border-border p-4 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-muted-foreground">{t('accounts.enterApiKey')}</label>
                        <input
                            type="password"
                            placeholder={t('placeholder.apiKeyPrefix')}
                            value={settings.nvidia?.apiKey ?? ''}
                            onChange={e => setSettings({ ...settings, nvidia: { ...settings.nvidia, apiKey: e.target.value, model: settings.nvidia?.model ?? 'nvidia/llama3-chatqa-1.5-70b' } })}
                            onBlur={() => handleSave()}
                            className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 font-mono text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
});
NvidiaSection.displayName = 'NvidiaSection';

export const AccountsTab: React.FC<AccountsTabProps> = React.memo(({
    settings, linkedAccounts, authBusy, authMessage, isOllamaRunning,
    connectGitHubProfile, connectCopilot, connectBrowserProvider,
    cancelAuthFlow,
    startOllama, checkOllama, handleSave, setSettings, deviceCodeModal, closeDeviceCodeModal,
    setManualSessionModal, t
}) => {
    const handleConnect = React.useCallback((providerId: string) => {
        switch (providerId) {
            case 'github': connectGitHubProfile(); break;
            case 'copilot': connectCopilot(); break;
            case 'codex': connectBrowserProvider('codex'); break;
            case 'claude': connectBrowserProvider('claude'); break;
            case 'antigravity': connectBrowserProvider('antigravity'); break;
        }
    }, [connectGitHubProfile, connectCopilot, connectBrowserProvider]);

    const handleRefresh = React.useCallback(() => {
        void linkedAccounts.refreshAccounts();
    }, [linkedAccounts]);

    const aiProviders = React.useMemo(() => PROVIDERS.filter(p => p.category === 'ai'), []);
    const developerProviders = React.useMemo(() => PROVIDERS.filter(p => p.category === 'developer'), []);

    const handleShowManualSession = React.useCallback((accountId: string, email?: string) => {
        setManualSessionModal({ isOpen: true, accountId, email });
    }, [setManualSessionModal]);

    if (!settings) { return null; }

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
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground animate-in fade-in slide-in-from-top-2 flex items-center justify-between gap-3">
                    <span>{authMessage}</span>
                    {authBusy && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                cancelAuthFlow();
                            }}
                            className="shrink-0 px-2.5 py-1 rounded-md border border-border bg-background/60 text-xxxs font-bold text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                    )}
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

            <ApiKeyProvidersSection
                settings={settings}
                setSettings={setSettings}
                handleSave={handleSave}
                t={t}
            />

            <NvidiaSection
                settings={settings}
                setSettings={setSettings}
                handleSave={handleSave}
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
    );
});

ProviderCard.displayName = 'ProviderCard';
AccountsTab.displayName = 'AccountsTab';
