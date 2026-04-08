import antigravityLogo from '@renderer/assets/antigravity.svg';
import chatgptLogo from '@renderer/assets/chatgpt.svg';
import claudeLogo from '@renderer/assets/claude.svg';
import copilotLogo from '@renderer/assets/copilot.png';
import geminiLogo from '@renderer/assets/gemini.png';
import ollamaLogo from '@renderer/assets/ollama.svg';
import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { LinkedAccountInfo } from '@renderer/electron.d';
import { DeviceCodeModal, DeviceCodeModalState } from '@renderer/features/settings/components/DeviceCodeModal';
import { UseLinkedAccountsResult } from '@renderer/features/settings/hooks/useLinkedAccounts';
import { cn } from '@renderer/lib/utils';
import { Bot, ChevronDown, Cpu, ExternalLink, Globe, Info, Key, Plus, RefreshCw, Shield, Sparkles, Terminal, Trash2, UserPlus, Zap } from 'lucide-react';
import React, { useState } from 'react';

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
    { id: 'ollama', name: 'accounts.providers.ollama.name', description: 'accounts.providers.ollama.description', logo: ollamaLogo, category: 'ai' },
    // Developer Tools
    { id: 'github', name: 'accounts.providers.github.name', description: 'accounts.providers.github.description', logo: copilotLogo, category: 'developer' },
    { id: 'copilot', name: 'accounts.providers.copilot.name', description: 'accounts.providers.copilot.description', logo: copilotLogo, category: 'developer' },
];

const PROVIDER_ACCOUNT_ALIASES: Record<string, string[]> = {
    claude: ['claude', 'anthropic'],
    codex: ['codex', 'openai'],
    antigravity: ['antigravity', 'google', 'gemini'],
    ollama: ['ollama'],
    github: ['github'],
    copilot: ['copilot', 'copilot_token']
};

/**
 * API Key provider configuration for direct API access
 */
interface ApiKeyProviderConfig {
    id: keyof Pick<AppSettings, 'openai' | 'anthropic' | 'gemini' | 'mistral' | 'groq' | 'together' | 'perplexity' | 'cohere' | 'xai' | 'deepseek' | 'openrouter' | 'nvidia'>;
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
    { id: 'nvidia', name: 'accounts.providers.nvidia.name', description: 'accounts.providers.nvidia.description', icon: Cpu, placeholder: 'nvapi-...', docsUrl: 'https://build.nvidia.com/explore/discover' },
    { id: 'mistral', name: 'accounts.apiProviders.mistral.name', description: 'accounts.apiProviders.mistral.description', icon: Sparkles, placeholder: 'API key', docsUrl: 'https://console.mistral.ai/api-keys' },
    { id: 'groq', name: 'accounts.apiProviders.groq.name', description: 'accounts.apiProviders.groq.description', icon: Zap, placeholder: 'gsk_...', docsUrl: 'https://console.groq.com/keys' },
    { id: 'together', name: 'accounts.apiProviders.together.name', description: 'accounts.apiProviders.together.description', icon: Bot, placeholder: 'API key', docsUrl: 'https://api.together.xyz/settings/api-keys' },
    { id: 'perplexity', name: 'accounts.apiProviders.perplexity.name', description: 'accounts.apiProviders.perplexity.description', icon: Sparkles, placeholder: 'pplx-...', docsUrl: 'https://www.perplexity.ai/settings/api' },
    { id: 'cohere', name: 'accounts.apiProviders.cohere.name', description: 'accounts.apiProviders.cohere.description', icon: Bot, placeholder: 'API key', docsUrl: 'https://dashboard.cohere.com/api-keys' },
    { id: 'xai', name: 'accounts.apiProviders.xai.name', description: 'accounts.apiProviders.xai.description', icon: Sparkles, placeholder: 'xai-...', docsUrl: 'https://console.x.ai/' },
    { id: 'deepseek', name: 'accounts.apiProviders.deepseek.name', description: 'accounts.apiProviders.deepseek.description', icon: Bot, placeholder: 'sk-...', docsUrl: 'https://platform.deepseek.com/api_keys' },
    { id: 'openrouter', name: 'accounts.apiProviders.openrouter.name', description: 'accounts.apiProviders.openrouter.description', icon: Key, placeholder: 'sk-or-...', docsUrl: 'https://openrouter.ai/keys' },
];

const LOGO_INVERT_PROVIDERS = new Set([
    'claude',
    'anthropic',
    'codex',
    'github',
    'copilot',
    'ollama',
    'deepseek',
]);

function ProviderIdentity({
    logo,
    icon: IconComponent,
    providerId,
}: {
    logo?: string;
    icon?: React.ComponentType<{ className?: string }>;
    providerId: string;
}) {
    return (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/20 bg-muted/30 text-foreground">
            {logo ? (
                <img
                    src={logo}
                    alt=""
                    className={cn(
                        'h-7 w-7 object-contain',
                        LOGO_INVERT_PROVIDERS.has(providerId) && 'theme-logo-invert'
                    )}
                    onError={event => {
                        event.currentTarget.style.display = 'none';
                    }}
                />
            ) : IconComponent ? (
                <IconComponent className="h-6 w-6 text-foreground/80" />
            ) : (
                <Key className="h-6 w-6 text-foreground/80" />
            )}
        </div>
    );
}

interface AccountsTabProps {
    settings: AppSettings | null
    linkedAccounts: UseLinkedAccountsResult
    authBusy: AuthBusyState | null
    authMessage: string
    isOllamaRunning: boolean
    refreshAuthStatus: () => void
    connectGitHubProfile: () => void
    connectCopilot: () => void
    connectBrowserProvider: (p: 'codex' | 'claude' | 'antigravity' | 'ollama') => void
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

    React.useEffect(() => {
        if (accounts.length > 0 && !expanded) {
            setExpanded(true);
        }
    }, [accounts.length, expanded]);

    return (
        <div className={cn(
            'group overflow-hidden rounded-2xl border transition-colors',
            hasAccounts && expanded ? 'border-primary/20 bg-card' : 'border-border/30 bg-card hover:border-border/50'
        )}>
            <div
                className={cn(
                    'flex flex-col gap-4 p-4 transition-colors sm:flex-row sm:items-center sm:gap-5 sm:p-5',
                    hasAccounts ? 'cursor-pointer hover:bg-muted/5' : 'bg-muted/[0.03]'
                )}
                onClick={() => hasAccounts && setExpanded(!expanded)}
            >
                <ProviderIdentity logo={provider.logo} providerId={provider.id} />
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">{t(provider.name)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{t(provider.description)}</div>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    {hasAccounts ? (
                        <>
                            <Badge variant="secondary" className="h-6 border-success/20 bg-success/10 px-2.5 typo-body font-medium text-success">
                                {accountCount} {t('accounts.accountCount').replace('{{count}}', '').trim()}
                            </Badge>
                            <div className={cn(
                                'flex h-8 w-8 items-center justify-center rounded-full border border-border/30 bg-muted/20 text-muted-foreground transition-transform',
                                expanded && 'rotate-180 border-primary/20 bg-primary/10 text-primary'
                            )}>
                                <ChevronDown className="h-4 w-4" />
                            </div>
                        </>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onConnect(provider.id);
                            }}
                            disabled={isBusy}
                            className="h-10 rounded-xl border-primary/25 bg-primary/5 px-4 typo-body font-medium text-primary hover:bg-primary hover:text-primary-foreground"
                        >
                            <UserPlus className="h-4 w-4 mr-2" />
                            {t('accounts.connect')}
                        </Button>
                    )}
                </div>
            </div>

            {hasAccounts && expanded && (
                <div className="border-t border-border/20 bg-muted/[0.02] animate-in slide-in-from-top-2 duration-300">
                    <div className="py-2">
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
                    </div>

                    <div className="p-4 pt-1 mb-2">
                        <Button
                            variant="ghost"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onConnect(provider.id);
                            }}
                            disabled={isBusy}
                            className="group/btn flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/40 typo-body font-medium text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            {t('accounts.addAnotherAccount')}
                        </Button>
                    </div>
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
        <section className="space-y-4">
            <div className="flex items-center gap-3 mb-2 px-1">
                <Shield className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-medium text-muted-foreground">
                    {title}
                </h3>
            </div>
            <div className="grid grid-cols-1 gap-4">
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
        return `${key.slice(0, 4)}••••${key.slice(-4)}`;
    };

    return (
        <div className={cn(
            'group overflow-hidden rounded-2xl border transition-colors',
            hasKeys && expanded ? 'border-primary/20 bg-card' : 'border-border/30 bg-card hover:border-border/50'
        )}>
            <div
                className={cn(
                    'flex flex-col gap-4 p-4 transition-colors sm:flex-row sm:items-center sm:gap-5 sm:p-5',
                    hasKeys ? 'cursor-pointer hover:bg-muted/5' : 'bg-muted/[0.03]'
                )}
                onClick={() => hasKeys && setExpanded(!expanded)}
            >
                <ProviderIdentity logo={provider.logo} icon={IconComponent} providerId={provider.id} />
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">{t(provider.name)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{t(provider.description)}</div>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    {hasKeys ? (
                        <>
                            <Badge variant="outline" className="h-6 border-success/20 bg-success/10 px-2.5 typo-body font-medium text-success">
                                {apiKeys.length} {t('accounts.apiKey')}
                            </Badge>
                            <div className={cn(
                                'flex h-8 w-8 items-center justify-center rounded-full border border-border/30 bg-muted/20 text-muted-foreground transition-transform',
                                expanded && 'rotate-180 border-primary/20 bg-primary/10 text-primary'
                            )}>
                                <ChevronDown className="h-4 w-4" />
                            </div>
                        </>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setExpanded(true);
                            }}
                            className="h-10 rounded-xl border-primary/25 bg-primary/5 px-4 typo-body font-medium text-primary hover:bg-primary hover:text-primary-foreground"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            {t('accounts.addApiKey')}
                        </Button>
                    )}
                </div>
            </div>

            {/* Expanded Keys List */}
            {expanded && (
                <div className="animate-in slide-in-from-top-2 space-y-4 border-t border-border/20 bg-muted/[0.02] p-5 duration-300">
                    <div className="space-y-3">
                        {apiKeys.map((key, index) => (
                            <div key={index} className="group/key animate-in fade-in slide-in-from-left-2 flex flex-col gap-3 duration-300 sm:flex-row sm:items-center" style={{ animationDelay: `${index * 50}ms` }}>
                                <div className="flex flex-1 items-center gap-3 rounded-xl border border-border/40 bg-background px-4 py-2.5 font-mono typo-body text-muted-foreground">
                                    <Shield className="w-3 h-3 opacity-30" />
                                    <span className="opacity-80">{maskKey(key)}</span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onRemoveKey(index);
                                    }}
                                    className="h-10 w-10 min-w-[40px] rounded-xl border-border/30 text-muted-foreground hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
                                    title={t('common.delete')}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>

                    <div className="relative pt-2">
                        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                            <div className="relative flex-1">
                                <Input
                                    type="password"
                                    placeholder={provider.placeholder}
                                    value={newKey}
                                    onChange={(e) => setNewKey(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddKey()}
                                    className="h-11 rounded-xl border-border/40 bg-background pl-11 font-mono text-xs"
                                />
                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                            </div>
                            <Button
                                onClick={handleAddKey}
                                disabled={!newKey.trim()}
                                className={cn(
                                    'h-11 w-full rounded-xl p-0 transition-colors sm:w-11',
                                    newKey.trim()
                                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                        : 'cursor-not-allowed bg-muted text-muted-foreground'
                                )}
                            >
                                <Plus className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>

                    {provider.docsUrl && (
                        <div className="flex justify-center pt-1">
                            <Button
                                variant="link"
                                size="sm"
                                asChild
                                className="group/docs flex h-auto items-center gap-2 p-0 typo-body font-medium text-muted-foreground/60 hover:text-primary"
                            >
                                <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer">
                                    <Globe className="h-3 w-3" />
                                    {t('accounts.getApiKey')}
                                    <ExternalLink className="ml-1 h-2.5 w-2.5" />
                                </a>
                            </Button>
                        </div>
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
    // ... same logic for getApiKeys, handleAddKey, handleRemoveKey ...
    const getApiKeys = (providerId: ApiKeyProviderConfig['id']): string[] => {
        const provider = settings[providerId];
        if (!provider) {
            return [];
        }
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
            openai: 'gpt-4o', anthropic: 'claude-3-5-sonnet-20240620', gemini: 'gemini-1.5-pro',
            mistral: 'mistral-large-latest', groq: 'llama-3.1-70b-versatile', together: 'meta-llama/Llama-3-70b-chat-hf',
            perplexity: 'llama-3-sonar-large-32k-chat', cohere: 'command-r-plus', xai: 'grok-beta',
            deepseek: 'deepseek-chat', openrouter: 'anthropic/claude-3.5-sonnet',
            nvidia: 'nvidia/llama3-chatqa-1.5-70b',
        };
        const nextSettings = {
            ...settings,
            [providerId]: {
                ...settings[providerId],
                apiKeys: newKeys,
                model: settings[providerId]?.model ?? defaultModels[providerId] ?? ''
            }
        };
        void setSettings(nextSettings);
        void handleSave(nextSettings);
    };

    const handleRemoveKey = (providerId: ApiKeyProviderConfig['id'], index: number) => {
        const currentKeys = getApiKeys(providerId);
        const newKeys = currentKeys.filter((_, i) => i !== index);
        if (newKeys.length === 0) {
            const newSettings = { ...settings };
            delete newSettings[providerId];
            void setSettings(newSettings);
            void handleSave(newSettings);
        } else {
            const nextSettings = {
                ...settings,
                [providerId]: { ...settings[providerId], apiKeys: newKeys }
            };
            void setSettings(nextSettings);
            void handleSave(nextSettings);
        }
    };

    return (
        <section className="space-y-6 pt-4">
            <div className="flex flex-col gap-2 px-1">
                <div className="flex items-center gap-3">
                    <Key className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-medium text-muted-foreground">
                        {t('accounts.categories.apiKeyProviders')}
                    </h3>
                </div>
                <p className="text-xxs text-muted-foreground font-medium leading-relaxed opacity-70 max-w-2xl">
                    {t('accounts.apiKeyProvidersDescription')}
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-4">
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
        <section className="space-y-4 pt-4">
            <div className="flex items-center gap-3 mb-2 px-1">
                <Terminal className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-medium text-muted-foreground">
                    {t('accounts.categories.localModels')}
                </h3>
            </div>
            <div className="group overflow-hidden rounded-2xl border border-border/30 bg-card transition-colors hover:border-border/50">
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/20 bg-muted/30">
                        <img src={ollamaLogo} alt={t('accounts.providers.ollama.name')} className="h-7 w-7 object-contain theme-logo-invert" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-foreground">{t('accounts.providers.ollama.name')}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{t('accounts.providers.ollama.description')}</div>
                    </div>
                    <Badge className={cn(
                        'h-7 rounded-lg px-3 typo-body font-medium',
                        isRunning
                            ? 'border-success/20 bg-success/10 text-success'
                            : 'border-transparent bg-muted text-muted-foreground'
                    )}>
                        {isRunning ? t('accounts.running') : t('accounts.notRunning')}
                    </Badge>
                </div>

                <div className="border-t border-border/20 bg-muted/[0.02] p-5 space-y-5">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label className="pl-1 typo-body font-medium text-muted-foreground">{t('accounts.serverAddress')}</Label>
                            <Input
                                type="text"
                                value={settings.ollama.url}
                                onChange={e => {
                                    const nextSettings = {
                                        ...settings,
                                        ollama: { ...settings.ollama, url: e.target.value },
                                    };
                                    void setSettings(nextSettings);
                                }}
                                onBlur={event => {
                                    const nextSettings = {
                                        ...settings,
                                        ollama: { ...settings.ollama, url: event.target.value },
                                    };
                                    void handleSave(nextSettings);
                                }}
                                className="h-10 w-full rounded-xl border-border/40 bg-background font-mono text-xs"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="pl-1 typo-body font-medium text-muted-foreground">{t('accounts.contextLimit')}</Label>
                            <Input
                                type="number"
                                value={settings.ollama.numCtx ?? 16384}
                                onChange={e => {
                                    const nextSettings = {
                                        ...settings,
                                        ollama: {
                                            ...settings.ollama,
                                            numCtx: Number(e.target.value),
                                        },
                                    };
                                    void setSettings(nextSettings);
                                }}
                                onBlur={event => {
                                    const nextSettings = {
                                        ...settings,
                                        ollama: {
                                            ...settings.ollama,
                                            numCtx: Number(event.target.value),
                                        },
                                    };
                                    void handleSave(nextSettings);
                                }}
                                className="h-10 w-full rounded-xl border-border/40 bg-background font-mono text-xs"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                checkOllama();
                            }}
                            className="h-9 rounded-xl border-border/30 bg-background px-5 typo-body font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                        >
                            <RefreshCw className={cn("h-3 w-3 mr-2", !isRunning && "animate-spin")} />
                            {t('accounts.check')}
                        </Button>
                        {!isRunning && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    startOllama();
                                }}
                                className="h-9 rounded-xl border-primary/25 bg-primary/5 px-5 typo-body font-medium text-primary hover:bg-primary hover:text-primary-foreground"
                            >
                                <Zap className="h-3.5 w-3.5 mr-2" />
                                {t('accounts.start')}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
});
OllamaSection.displayName = 'OllamaSection';

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
            case 'ollama': connectBrowserProvider('ollama'); break;
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
        <div className="mx-auto max-w-5xl space-y-10 pb-10">
            <header className="flex flex-col justify-between gap-4 px-1 md:flex-row md:items-center">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-xl">
                            <UserPlus className="w-5 h-5 text-primary" />
                        </div>
                        <h2 className="text-2xl font-semibold text-foreground">{t('accounts.title')}</h2>
                    </div>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground/70">
                        <Info className="w-3 h-3" />
                        {t('accounts.subtitle')}
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRefresh();
                    }}
                    className="group flex h-10 items-center gap-3 rounded-xl border-border/30 bg-background px-5 typo-body font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                >
                    <RefreshCw className={cn("h-3.5 w-3.5 transition-transform duration-500", linkedAccounts.loading ? "animate-spin" : "group-hover:rotate-180")} />
                    {t('common.refresh')}
                </Button>
            </header>

            {authMessage && (
                <div className="animate-in slide-in-from-top-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 duration-500">
                    <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                            <span className="text-sm font-medium leading-relaxed text-primary">{authMessage}</span>
                        </div>
                        {authBusy && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    cancelAuthFlow();
                                }}
                                className="h-8 rounded-lg border-border/30 bg-background px-4 typo-body font-medium text-muted-foreground hover:border-destructive/20 hover:bg-destructive/5 hover:text-destructive"
                            >
                                {t('common.cancel')}
                            </Button>
                        )}
                    </div>
                </div>
            )}

            <div className="space-y-10">
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

                <div className="my-2 h-px bg-border/30" />

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

                <div className="my-2 h-px bg-border/30" />

                <ApiKeyProvidersSection
                    settings={settings}
                    setSettings={setSettings}
                    handleSave={handleSave}
                    t={t}
                />

                <div className="grid grid-cols-1 gap-6 pt-2">
                    <OllamaSection
                        isRunning={isOllamaRunning}
                        settings={settings}
                        setSettings={setSettings}
                        handleSave={handleSave}
                        startOllama={startOllama}
                        checkOllama={checkOllama}
                        t={t}
                    />
                </div>
            </div>

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
