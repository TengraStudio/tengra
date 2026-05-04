/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import antigravityLogo from '@assets/antigravity.svg?url';
import chatgptLogo from '@assets/chatgpt.svg?url';
import claudeLogo from '@assets/claude.svg?url';
import copilotLogo from '@assets/copilot.svg?url';
import geminiLogo from '@assets/gemini.png';
import ollamaLogo from '@assets/ollama.svg?url';
import opencodeLogo from '@assets/opencode.svg?url';
import { IconBolt,IconChevronDown, IconCpu, IconExternalLink, IconGlobe, IconInfoCircle, IconKey, IconPlus, IconRefresh, IconRobot, IconShield, IconSparkles, IconTerminal, IconTrash, IconUserPlus } from '@tabler/icons-react';
import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LinkedAccountInfo } from '@/electron.d';
import { DeviceCodeModal, DeviceCodeModalState } from '@/features/settings/components/DeviceCodeModal';
import { UseLinkedAccountsResult } from '@/features/settings/hooks/useLinkedAccounts';
import { cn } from '@/lib/utils';
import { AppSettings } from '@/types';
import type { QuotaResponse } from '@/types/quota';
import type { AntigravityCreditUsageMode } from '@/types/settings';

import { AccountWrapper, AuthBusyState } from '../types';

import { AccountRow } from './accounts/AccountRow';

/* Batch-02: Extracted Long Classes */
const C_ACCOUNTSTAB_1 = "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/20 bg-muted/30 text-foreground";
const C_ACCOUNTSTAB_2 = "flex flex-1 items-center gap-3 rounded-xl border border-border/40 bg-background px-4 py-2.5 font-mono typo-body text-muted-foreground shadow-sm sm:gap-4";
const C_ACCOUNTSTAB_3 = "h-10 w-10 min-w-10 rounded-xl border-border/30 text-muted-foreground hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive transition-colors";
const C_ACCOUNTSTAB_4 = "group/docs flex h-auto items-center gap-2 p-0 typo-body font-medium text-muted-foreground/60 hover:text-primary transition-colors";
const C_ACCOUNTSTAB_5 = "h-9 rounded-xl border-border/30 bg-background px-5 typo-body font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground";
const C_ACCOUNTSTAB_6 = "h-9 rounded-xl border-primary/25 bg-primary/5 px-5 typo-body font-medium text-primary hover:bg-primary hover:text-primary-foreground";
const C_ACCOUNTSTAB_7 = "group flex h-10 items-center gap-3 rounded-xl border-border/30 bg-background px-5 typo-body font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground sm:gap-4";
const C_ACCOUNTSTAB_8 = "h-8 rounded-lg border-border/30 bg-background px-4 typo-body font-medium text-muted-foreground hover:border-destructive/20 hover:bg-destructive/5 hover:text-destructive";


const PROVIDER_CARD_BASE = "group overflow-hidden rounded-2xl border transition-colors";
const PROVIDER_CARD_CONTENT = "flex flex-col gap-4 p-4 transition-colors sm:flex-row sm:items-center sm:gap-5 sm:p-5";
const BUTTON_PRIMARY_GHOST = "h-10 rounded-xl border-primary/25 bg-primary/5 px-4 typo-body font-medium text-primary hover:bg-primary hover:text-primary-foreground";
const BUTTON_SECONDARY_GHOST = "group/btn flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/40 typo-body font-medium text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary";
const KEY_ROW_BASE = "group/key animate-in fade-in slide-in-from-left-2 flex flex-col gap-3 duration-300 sm:flex-row sm:items-center";

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
    copilot: ['copilot', 'copilot_token'],
    opencode: ['opencode']
};

function normalizeEmail(email?: string): string | null {
    if (typeof email !== 'string') {
        return null;
    }
    const normalized = email.trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
}

export function findMatchingQuotaAccount(
    account: LinkedAccountInfo,
    quotaData: AccountWrapper<QuotaResponse> | null
): QuotaResponse | null {
    if (!quotaData?.accounts?.length) {
        return null;
    }

    const normalizedEmail = normalizeEmail(account.email);
    const idMatch = quotaData.accounts.find(quotaAccount => quotaAccount.accountId === account.id);
    if (idMatch) {
        return idMatch;
    }

    if (normalizedEmail === null) {
        return null;
    }

    return quotaData.accounts.find(quotaAccount => normalizeEmail(quotaAccount.email) === normalizedEmail) ?? null;
}

export function getCreditUsageMode(
    settings: AppSettings,
    accountId: string,
    quotaAccount: QuotaResponse | null
): AntigravityCreditUsageMode {
    const savedMode = settings.antigravity?.creditUsageModeByAccount?.[accountId];
    if (savedMode) {
        return savedMode;
    }
    return quotaAccount?.antigravityAiCredits?.useAICredits === true ? 'auto' : 'ask-every-time';
}

export function buildAntigravityCreditModeSettings(
    settings: AppSettings,
    accountId: string,
    mode: AntigravityCreditUsageMode
): AppSettings {
    const currentAntigravity: NonNullable<AppSettings['antigravity']> = settings.antigravity ?? {
        connected: false,
        creditUsageModeByAccount: {},
    };
    return {
        ...settings,
        antigravity: {
            ...currentAntigravity,
            creditUsageModeByAccount: {
                ...(currentAntigravity.creditUsageModeByAccount ?? {}),
                [accountId]: mode,
            }
        }
    };
}

/**
 * API Key provider configuration for direct API access
 */
interface ApiKeyProviderConfig {
    id: keyof Pick<AppSettings, 'openai' | 'anthropic' | 'gemini' | 'mistral' | 'groq' | 'together' | 'perplexity' | 'cohere' | 'xai' | 'deepseek' | 'openrouter' | 'nvidia' | 'opencode'>;
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
    { id: 'nvidia', name: 'accounts.providers.nvidia.name', description: 'accounts.providers.nvidia.description', icon: IconCpu, placeholder: 'nvapi-...', docsUrl: 'https://build.nvidia.com/explore/discover' },
    { id: 'mistral', name: 'accounts.apiProviders.mistral.name', description: 'accounts.apiProviders.mistral.description', icon: IconSparkles, placeholder: 'API key', docsUrl: 'https://console.mistral.ai/api-keys' },
    { id: 'groq', name: 'accounts.apiProviders.groq.name', description: 'accounts.apiProviders.groq.description', icon: IconBolt, placeholder: 'gsk_...', docsUrl: 'https://console.groq.com/keys' },
    { id: 'together', name: 'accounts.apiProviders.together.name', description: 'accounts.apiProviders.together.description', icon: IconRobot, placeholder: 'API key', docsUrl: 'https://api.together.xyz/settings/api-keys' },
    { id: 'perplexity', name: 'accounts.apiProviders.perplexity.name', description: 'accounts.apiProviders.perplexity.description', icon: IconSparkles, placeholder: 'pplx-...', docsUrl: 'https://www.perplexity.ai/settings/api' },
    { id: 'cohere', name: 'accounts.apiProviders.cohere.name', description: 'accounts.apiProviders.cohere.description', icon: IconRobot, placeholder: 'API key', docsUrl: 'https://dashboard.cohere.com/api-keys' },
    { id: 'xai', name: 'accounts.apiProviders.xai.name', description: 'accounts.apiProviders.xai.description', icon: IconSparkles, placeholder: 'xai-...', docsUrl: 'https://console.x.ai/' },
    { id: 'deepseek', name: 'accounts.apiProviders.deepseek.name', description: 'accounts.apiProviders.deepseek.description', icon: IconRobot, placeholder: 'sk-...', docsUrl: 'https://platform.deepseek.com/api_keys' },
    { id: 'openrouter', name: 'accounts.apiProviders.openrouter.name', description: 'accounts.apiProviders.openrouter.description', icon: IconKey, placeholder: 'sk-or-...', docsUrl: 'https://openrouter.ai/keys' },
    { id: 'opencode', name: 'accounts.apiProviders.opencode.name', description: 'accounts.apiProviders.opencode.description', logo: opencodeLogo, placeholder: 'API key', docsUrl: 'https://opencode.ai' },
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
        <div className={C_ACCOUNTSTAB_1}>
            {logo ? (
                <img
                    src={logo}
                    alt=""
                    className={cn(
                        'h-7 w-7 object-contain transition-all duration-300',
                        !['antigravity', 'gemini', 'huggingface', 'nvidia'].includes(providerId) && 'theme-logo-invert',
                        LOGO_INVERT_PROVIDERS.has(providerId) ? 'opacity-90' : 'opacity-60'
                    )}
                />
            ) : IconComponent ? (
                <IconComponent className="h-6 w-6 text-foreground/80" />
            ) : (
                <IconKey className="h-6 w-6 text-foreground/80" />
            )}
        </div>
    );
}

interface AccountsTabProps {
    settings: AppSettings | null
    quotaData: AccountWrapper<QuotaResponse> | null
    linkedAccounts: UseLinkedAccountsResult
    authBusy: AuthBusyState | null
    authMessage: string
    isOllamaRunning: boolean
    refreshAuthStatus: () => Promise<void>
    connectGitHubProfile: () => Promise<void>
    connectCopilot: () => Promise<void>
    connectBrowserProvider: (p: 'codex' | 'claude' | 'antigravity' | 'ollama') => Promise<void>
    cancelAuthFlow: () => void
    startOllama: () => Promise<void>
    checkOllama: () => Promise<void>
    handleSave: (s?: AppSettings) => Promise<void>
    setSettings: (s: AppSettings) => Promise<void>
    deviceCodeModal?: DeviceCodeModalState
    closeDeviceCodeModal?: () => void
    setManualSessionModal: (state: import('./ManualSessionModal').ManualSessionModalState) => void
    linkAccount?: (provider: string, tokenData: { key?: string; accessToken?: string; metadata?: Record<string, unknown> }) => Promise<void>
    t: (key: string) => string
}

interface ProviderCardProps {
    provider: ProviderConfig
    accounts: LinkedAccountInfo[]
    quotaData: AccountWrapper<QuotaResponse> | null
    settings: AppSettings
    authBusy: AuthBusyState | null
    onConnect: (providerId: string) => void
    onUnlink: (accountId: string) => Promise<void>
    onSetActive: (providerId: string, accountId: string) => Promise<void>
    onShowManualSession: (accountId: string, email?: string) => void
    onCreditUsageModeChange: (accountId: string, mode: AntigravityCreditUsageMode) => void
    t: (key: string) => string
}

const ProviderCard = React.memo<ProviderCardProps>(({
    provider,
    accounts,
    quotaData,
    settings,
    authBusy,
    onConnect,
    onUnlink,
    onSetActive,
    onShowManualSession,
    onCreditUsageModeChange,
    t
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
            PROVIDER_CARD_BASE,
            hasAccounts && expanded ? 'border-primary/20 bg-card' : 'border-border/30 bg-card hover:border-border/50'
        )}>
            <div
                className={cn(
                    PROVIDER_CARD_CONTENT,
                    hasAccounts ? 'cursor-pointer hover:bg-muted/5' : 'bg-muted/[0.03]'
                )}
                onClick={() => hasAccounts && setExpanded(!expanded)}
            >
                <ProviderIdentity logo={provider.logo} providerId={provider.id} />
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">{t(provider.name)}</div>
                    <div className="mt-1 typo-caption text-muted-foreground">{t(provider.description)}</div>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    {hasAccounts ? (
                        <>
                            <Badge variant="secondary" className="h-6 border-success/20 bg-success/10 px-2.5 typo-body font-medium text-success">
                                {accountCount} {t('frontend.accounts.accountCount').replace('{{count}}', '').trim()}
                            </Badge>
                            <div className={cn(
                                'flex h-8 w-8 items-center justify-center rounded-full border border-border/30 bg-muted/20 text-muted-foreground transition-transform',
                                expanded && 'rotate-180 border-primary/20 bg-primary/10 text-primary'
                            )}>
                                <IconChevronDown className="h-4 w-4" />
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
                            className={cn(BUTTON_PRIMARY_GHOST, "h-10 px-4")}
                        >
                            <IconUserPlus className="h-4 w-4 mr-2" />
                            {t('frontend.accounts.connect')}
                        </Button>
                    )}
                </div>
            </div>

            {hasAccounts && expanded && (
                <div className="border-t border-border/20 bg-muted/02 animate-in slide-in-from-top-2 duration-300">
                    <div className="py-2">
                        {accounts.map((account, index) => {
                            const quotaAccount = provider.id === 'antigravity'
                                ? findMatchingQuotaAccount(account, quotaData)
                                : null;

                            return (
                            <AccountRow
                                key={account.id}
                                account={account}
                                isLast={index === accounts.length - 1}
                                isBusy={isBusy}
                                providerId={provider.id}
                                creditAmount={quotaAccount?.antigravityAiCredits?.creditAmount}
                                creditUsageMode={getCreditUsageMode(settings, account.id, quotaAccount)}
                                onUnlink={onUnlink}
                                onSetActive={onSetActive}
                                onShowManualSession={onShowManualSession}
                                onCreditUsageModeChange={provider.id === 'antigravity' ? onCreditUsageModeChange : undefined}
                                t={t}
                            />
                            );
                        })}
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
                            className={BUTTON_SECONDARY_GHOST}
                        >
                            <IconPlus className="h-3.5 w-3.5" />
                            {t('frontend.accounts.addAnotherAccount')}
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
    quotaData,
    settings,
    authBusy,
    onConnect,
    onUnlink,
    onSetActive,
    onShowManualSession,
    onCreditUsageModeChange,
    t
}: {
    title: string
    providers: ProviderConfig[]
    accounts: LinkedAccountInfo[]
    quotaData: AccountWrapper<QuotaResponse> | null
    settings: AppSettings
    authBusy: AuthBusyState | null
    onConnect: (id: string) => void
    onUnlink: (id: string) => Promise<void>
    onSetActive: (pid: string, aid: string) => Promise<void>
    onShowManualSession: (aid: string, email?: string) => void
    onCreditUsageModeChange: (accountId: string, mode: AntigravityCreditUsageMode) => void
    t: (k: string) => string
}) => {
    return (
        <section className="space-y-4">
            <div className="flex items-center gap-3 mb-2 px-1">
                <IconShield className="w-4 h-4 text-primary" />
                <h3 className="typo-caption font-medium text-muted-foreground">
                    {title}
                </h3>
            </div>
            <div className="grid grid-cols-1 gap-4">
                {providers.map(provider => (
                    <ProviderCard
                        key={provider.id}
                        provider={provider}
                        accounts={accounts.filter(a => (PROVIDER_ACCOUNT_ALIASES[provider.id] ?? [provider.id]).includes(a.provider.toLowerCase()))}
                        quotaData={quotaData}
                        settings={settings}
                        authBusy={authBusy}
                        onConnect={onConnect}
                        onUnlink={onUnlink}
                        onSetActive={onSetActive}
                        onShowManualSession={onShowManualSession}
                        onCreditUsageModeChange={onCreditUsageModeChange}
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
            PROVIDER_CARD_BASE,
            hasKeys && expanded ? 'border-primary/20 bg-card' : 'border-border/30 bg-card hover:border-border/50'
        )}>
            <div
                className={cn(
                    PROVIDER_CARD_CONTENT,
                    hasKeys ? 'cursor-pointer hover:bg-muted/5' : 'bg-muted/[0.03]'
                )}
                onClick={() => hasKeys && setExpanded(!expanded)}
            >
                <ProviderIdentity logo={provider.logo} icon={IconComponent} providerId={provider.id} />
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">{t(provider.name)}</div>
                    <div className="mt-1 typo-caption text-muted-foreground">{t(provider.description)}</div>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    {hasKeys ? (
                        <>
                            <Badge variant="outline" className="h-6 border-success/20 bg-success/10 px-2.5 typo-body font-medium text-success">
                                {apiKeys.length} {t('frontend.accounts.apiKey')}
                            </Badge>
                            <div className={cn(
                                'flex h-8 w-8 items-center justify-center rounded-full border border-border/30 bg-muted/20 text-muted-foreground transition-transform',
                                expanded && 'rotate-180 border-primary/20 bg-primary/10 text-primary'
                            )}>
                                <IconChevronDown className="h-4 w-4" />
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
                            className={cn(BUTTON_PRIMARY_GHOST, "h-10 px-4")}
                        >
                            <IconPlus className="h-4 w-4 mr-2" />
                            {t('frontend.accounts.addApiKey')}
                        </Button>
                    )}
                </div>
            </div>

            {/* Expanded Keys List */}
            {expanded && (
                <div className="animate-in slide-in-from-top-2 space-y-4 border-t border-border/20 bg-muted/02 p-5 duration-300">
                    <div className="space-y-3">
                        {apiKeys.map((key, index) => (
                            <div key={index} className={cn(KEY_ROW_BASE, "flex flex-col gap-3 sm:flex-row sm:items-center")} style={{ animationDelay: `${index * 50}ms` }}>
                                <div className={C_ACCOUNTSTAB_2}>
                                    <IconShield className="w-3 h-3 opacity-30" />
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
                                    className={C_ACCOUNTSTAB_3}
                                    title={t('common.delete')}
                                >
                                    <IconTrash className="h-4 w-4" />
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
                                    className="h-11 rounded-xl border-border/40 bg-background pl-11 font-mono typo-caption"
                                />
                                <IconKey className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
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
                                <IconPlus className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>

                    {provider.docsUrl && (
                        <div className="flex justify-center pt-1">
                            <Button
                                variant="link"
                                size="sm"
                                asChild
                                className={C_ACCOUNTSTAB_4}
                            >
                                <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer">
                                    <IconGlobe className="h-3 w-3" />
                                    {t('frontend.accounts.getApiKey')}
                                    <IconExternalLink className="ml-1 h-2.5 w-2.5" />
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
    linkedAccounts,
    t
}: {
    settings: AppSettings
    setSettings: (s: AppSettings) => Promise<void>
    handleSave: (s?: AppSettings) => Promise<void>
    linkedAccounts: UseLinkedAccountsResult
    t: (k: string) => string
}) => {
    const getApiKeys = (providerId: ApiKeyProviderConfig['id']): string[] => {
        // API keys are database-backed; renderer only shows masked account entries.
        const dbAccounts = linkedAccounts.getAccountsByProvider(providerId);
        return dbAccounts.map(_a => '••••••••');
    };

    const handleAddKey = async (providerId: ApiKeyProviderConfig['id'], key: string) => {
        if (linkedAccounts.linkAccount) {
            await linkedAccounts.linkAccount(providerId, { 
                key,
                accessToken: key,
                metadata: { type: 'api_key', auth_type: 'api_key' }
            });
        }
        
        const defaultModels: Record<string, string> = {
            openai: 'gpt-4o', anthropic: 'claude-3-5-sonnet-20240620', gemini: 'gemini-1.5-pro',
            mistral: 'mistral-large-latest', groq: 'llama-3.1-70b-versatile', together: 'meta-llama/Llama-3-70b-chat-hf',
            perplexity: 'llama-3-sonar-large-32k-chat', cohere: 'command-r-plus', xai: 'grok-beta',
            deepseek: 'deepseek-chat', openrouter: 'anthropic/claude-3.5-sonnet',
            nvidia: 'nvidia/llama3-chatqa-1.5-70b',
            opencode: 'big-pickle',
        };
        const nextSettings = {
            ...settings,
            [providerId]: {
                ...settings[providerId],
                model: settings[providerId]?.model ?? defaultModels[providerId] ?? ''
            }
        };
        void setSettings(nextSettings);
        void handleSave(nextSettings);
    };

    const handleRemoveKey = async (providerId: ApiKeyProviderConfig['id'], index: number) => {
        const dbAccounts = linkedAccounts.getAccountsByProvider(providerId);
        if (dbAccounts[index]) {
            await linkedAccounts.unlinkAccount(dbAccounts[index].id);
        }
    };

    return (
        <section className="space-y-6 pt-4">
            <div className="flex flex-col gap-2 px-1">
                <div className="flex items-center gap-3">
                    <IconKey className="w-4 h-4 text-primary" />
                    <h3 className="typo-caption font-medium text-muted-foreground">
                        {t('frontend.accounts.categories.apiKeyProviders')}
                    </h3>
                </div>
                <p className="text-sm text-muted-foreground font-medium leading-relaxed opacity-70 max-w-2xl">
                    {t('frontend.accounts.apiKeyProvidersDescription')}
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-4">
                {API_KEY_PROVIDERS.map(provider => (
                    <ApiKeyProviderCard
                        key={provider.id}
                        provider={provider}
                        apiKeys={getApiKeys(provider.id)}
                        onAddKey={(key) => { void handleAddKey(provider.id, key); }}
                        onRemoveKey={(index) => { void handleRemoveKey(provider.id, index); }}
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
    setSettings: (s: AppSettings) => Promise<void>
    handleSave: (s?: AppSettings) => Promise<void>
    startOllama: () => Promise<void>
    checkOllama: () => Promise<void>
    t: (k: string) => string
}) => {
    return (
        <section className="space-y-4 pt-4">
            <div className="flex items-center gap-3 mb-2 px-1">
                <IconTerminal className="w-4 h-4 text-primary" />
                <h3 className="typo-caption font-medium text-muted-foreground">
                    {t('frontend.accounts.categories.localModels')}
                </h3>
            </div>
            <div className="group overflow-hidden rounded-2xl border border-border/30 bg-card transition-colors hover:border-border/50">
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/20 bg-muted/30">
                        <img 
                            src={ollamaLogo} 
                            alt={t('frontend.accounts.providers.ollama.name')} 
                            className="h-7 w-7 object-contain theme-logo-invert" 
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-foreground">{t('frontend.accounts.providers.ollama.name')}</div>
                        <div className="mt-1 typo-caption text-muted-foreground">{t('frontend.accounts.providers.ollama.description')}</div>
                    </div>
                    <Badge className={cn(
                        'h-7 rounded-lg px-3 typo-body font-medium',
                        isRunning
                            ? 'border-success/20 bg-success/10 text-success'
                            : 'border-transparent bg-muted text-muted-foreground'
                    )}>
                        {isRunning ? t('frontend.accounts.running') : t('frontend.accounts.notRunning')}
                    </Badge>
                </div>

                <div className="border-t border-border/20 bg-muted/02 p-5 space-y-5">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label className="pl-1 typo-body font-medium text-muted-foreground">{t('frontend.accounts.serverAddress')}</Label>
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
                                className="h-10 w-full rounded-xl border-border/40 bg-background font-mono typo-caption"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="pl-1 typo-body font-medium text-muted-foreground">{t('frontend.accounts.contextLimit')}</Label>
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
                                className="h-10 w-full rounded-xl border-border/40 bg-background font-mono typo-caption"
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
                                void checkOllama();
                            }}
                            className={C_ACCOUNTSTAB_5}
                        >
                            <IconRefresh className={cn("h-3 w-3 mr-2", !isRunning && "animate-spin")} />
                            {t('frontend.accounts.check')}
                        </Button>
                        {!isRunning && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void startOllama();
                                }}
                                className={C_ACCOUNTSTAB_6}
                            >
                                <IconBolt className="h-3.5 w-3.5 mr-2" />
                                {t('frontend.accounts.start')}
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
    settings, quotaData, linkedAccounts, authBusy, authMessage, isOllamaRunning,
    connectGitHubProfile, connectCopilot, connectBrowserProvider,
    cancelAuthFlow,
    startOllama, checkOllama, handleSave, setSettings, deviceCodeModal, closeDeviceCodeModal,
    setManualSessionModal, t
}) => {
    const handleConnect = React.useCallback((providerId: string) => {
        switch (providerId) {
            case 'github': void connectGitHubProfile(); break;
            case 'copilot': void connectCopilot(); break;
            case 'codex': void connectBrowserProvider('codex'); break;
            case 'claude': void connectBrowserProvider('claude'); break;
            case 'antigravity': void connectBrowserProvider('antigravity'); break;
            case 'ollama': void connectBrowserProvider('ollama'); break;
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

    const handleCreditUsageModeChange = React.useCallback((accountId: string, mode: AntigravityCreditUsageMode) => {
        if (!settings) {
            return;
        }
        const nextSettings = buildAntigravityCreditModeSettings(settings, accountId, mode);
        void setSettings(nextSettings);
        void handleSave(nextSettings);
    }, [handleSave, setSettings, settings]);

    if (!settings) { return null; }

    return (
        <div className="mx-auto max-w-5xl space-y-10 pb-10">
            <header className="flex flex-col justify-between gap-4 px-1 md:flex-row md:items-center">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-xl">
                            <IconUserPlus className="w-5 h-5 text-primary" />
                        </div>
                        <h2 className="text-2xl font-semibold text-foreground">{t('frontend.accounts.title')}</h2>
                    </div>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground/70">
                        <IconInfoCircle className="w-3 h-3" />
                        {t('frontend.accounts.subtitle')}
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
                    className={C_ACCOUNTSTAB_7}
                >
                    <IconRefresh className={cn("h-3.5 w-3.5 transition-transform duration-500", linkedAccounts.loading ? "animate-spin" : "group-hover:rotate-180")} />
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
                                className={C_ACCOUNTSTAB_8}
                            >
                                {t('common.cancel')}
                            </Button>
                        )}
                    </div>
                </div>
            )}

            <div className="space-y-10">
                <ProviderList
                    title={t('frontend.accounts.categories.aiProviders')}
                    providers={aiProviders}
                    accounts={linkedAccounts.accounts}
                    quotaData={quotaData}
                    settings={settings}
                    authBusy={authBusy}
                    onConnect={handleConnect}
                    onUnlink={linkedAccounts.unlinkAccount}
                    onSetActive={linkedAccounts.setActiveAccount}
                    onShowManualSession={handleShowManualSession}
                    onCreditUsageModeChange={handleCreditUsageModeChange}
                    t={t}
                />

                <div className="my-2 h-px bg-border/30" />

                <ProviderList
                    title={t('frontend.accounts.categories.developerTools')}
                    providers={developerProviders}
                    accounts={linkedAccounts.accounts}
                    quotaData={quotaData}
                    settings={settings}
                    authBusy={authBusy}
                    onConnect={handleConnect}
                    onUnlink={linkedAccounts.unlinkAccount}
                    onSetActive={linkedAccounts.setActiveAccount}
                    onShowManualSession={handleShowManualSession}
                    onCreditUsageModeChange={handleCreditUsageModeChange}
                    t={t}
                />

                <div className="my-2 h-px bg-border/30" />

                <ApiKeyProvidersSection
                    settings={settings}
                    setSettings={setSettings}
                    handleSave={handleSave}
                    linkedAccounts={linkedAccounts}
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
