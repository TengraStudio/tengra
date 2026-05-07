/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Auth-route precedence utility for provider routing in `auto` mode.
 *
 * Precedence (AUTH-ROUTE-001):
 *   1. OAuth with remaining quota  → use OAuth session
 *   2. API key (if configured)     → use API key
 *   3. OAuth without API fallback  → use OAuth regardless of quota
 *
 * Special cases:
 *   - `antigravity` is OAuth/session-only — always returns `'oauth'`.
 *
 * @module auth-routing.util
 */
import { appLogger } from '@main/logging/logger';
import { AuthService } from '@main/services/security/auth.service';
import { SettingsService } from '@main/services/system/settings.service';
import { AIProvider } from '@shared/types/ai';
import type { RuntimeValue } from '@shared/types/common';
import { CredentialMode } from '@shared/utils/provider-credentials.util';

import { ProxyService } from './proxy.service';

/** Result of resolving the auth route for a provider. */
export interface AuthRouteResult {
    method: CredentialMode;
    reason: string;
}

/** Providers that only support OAuth and never use API keys. */
const OAUTH_ONLY_PROVIDERS: ReadonlySet<string> = new Set<string>([
    'antigravity',
    'copilot',
    'codex',
]);

/** Provider keys in AppSettings that carry an `apiKey` field. */
const API_KEY_PROVIDERS: ReadonlySet<string> = new Set<string>([
    'openai',
    'anthropic',
    'groq',
    'nvidia',
    'huggingface',
]);

/**
 * Resolves the effective auth method for a provider under `auto` mode.
 *
 * **Precedence (AUTH-ROUTE-001):**
 * 1. If OAuth session exists **and** quota is available → `'oauth'`
 * 2. If a valid API key is configured → `'api'`
 * 3. Fallback to OAuth regardless of quota → `'oauth'`
 *
 * For OAuth-only providers (e.g. `antigravity`) the result is always `'oauth'`.
 *
 * @param provider   - The AI provider identifier.
 * @param proxy      - ProxyService instance for checking remaining quota.
 * @param auth       - AuthService instance for checking linked accounts.
 * @param _settings  - Unused legacy parameter kept for call-site compatibility.
 * @returns The resolved auth method and a human-readable reason.
 */
export async function resolveAuthRoute(
    provider: AIProvider,
    proxy: ProxyService,
    auth: AuthService,
    _settings: SettingsService
): Promise<AuthRouteResult> {
    if (OAUTH_ONLY_PROVIDERS.has(provider)) {
        return { method: 'oauth', reason: `${provider} is OAuth-only` };
    }

    const oauthAvailable = await checkOAuthWithQuota(provider, proxy, auth);
    if (oauthAvailable) {
        appLogger.debug('AuthRouting', `${provider}: OAuth with quota available`);
        return { method: 'oauth', reason: 'OAuth session active with remaining quota' };
    }

    const hasKey = await checkApiKeyConfigured(provider, auth);
    if (hasKey) {
        appLogger.debug('AuthRouting', `${provider}: falling back to API key`);
        return { method: 'api', reason: 'API key configured, OAuth quota unavailable' };
    }

    appLogger.debug('AuthRouting', `${provider}: OAuth fallback (no API key)`);
    return { method: 'oauth', reason: 'OAuth fallback — no API key configured' };
}

/**
 * Checks whether the provider has an active OAuth session with remaining quota.
 *
 * @param provider - The AI provider to check.
 * @param proxy    - ProxyService for fetching quota data.
 * @param auth     - AuthService for verifying linked accounts.
 * @returns `true` if OAuth is linked and quota has not been exceeded.
 */
async function checkOAuthWithQuota(
    provider: AIProvider,
    proxy: ProxyService,
    auth: AuthService
): Promise<boolean> {
    const hasAccount = await auth.hasLinkedAccount(provider);
    if (!hasAccount) {
        return false;
    }

    try {
        const quotaData = await fetchQuotaForProvider(provider, proxy);
        if (quotaData === null) {
            return false;
        }
        if (quotaData.authExpired === true) {
            return false;
        }
        if (quotaData.status === 'Exceeded' || quotaData.status === 'Locked') {
            return false;
        }
        return true;
    } catch (err) {
        appLogger.warn('AuthRouting', `Quota check failed for ${provider}: ${String(err)}`);
        return false;
    }
}

/**
 * Fetches quota data for the given provider using the appropriate ProxyService method.
 *
 * @param provider - The AI provider.
 * @param proxy    - ProxyService instance.
 * @returns QuotaResponse-like object or `null` if unavailable.
 */
async function fetchQuotaForProvider(
    provider: AIProvider,
    proxy: ProxyService
): Promise<{ status?: string; authExpired?: boolean } | null> {
    switch (provider) {
        case 'antigravity': {
            const quota = await proxy.getQuota();
            return quota?.accounts?.length ? { status: 'OK', authExpired: false } : null;
        }
        case 'openai': {
            const codex = await proxy.getCodexUsage();
            return codex.accounts.length > 0 ? { status: 'OK', authExpired: false } : null;
        }
        case 'anthropic':
        case 'claude': {
            const claude = await proxy.getClaudeQuota();
            return claude.accounts.length > 0
                ? { status: 'OK', authExpired: false }
                : null;
        }
        default:
            return null;
    }
}

/**
 * Checks whether an API key is configured for the given provider.
 *
 * @param provider - The AI provider to inspect.
 * @param auth - AuthService for reading linked accounts.
 * @returns `true` when at least one account is classified as API key.
 */
async function checkApiKeyConfigured(
    provider: AIProvider,
    auth: AuthService
): Promise<boolean> {
    if (!API_KEY_PROVIDERS.has(provider)) {
        return false;
    }

    const aliases: Record<string, string[]> = {
        antigravity: ['antigravity', 'google', 'gemini'],
        openai: ['openai', 'codex'],
        codex: ['codex', 'openai'],
        anthropic: ['anthropic'],
        claude: ['claude'],
        copilot: ['copilot'],
        ollama: ['ollama'],
        huggingface: ['huggingface'],
        llama: ['llama'],
        groq: ['groq'],
        gemini: ['gemini', 'google', 'antigravity'],
        nvidia: ['nvidia'],
        mistral: ['mistral'],
        together: ['together'],
        perplexity: ['perplexity'],
        cohere: ['cohere'],
        xai: ['xai'],
        deepseek: ['deepseek'],
        openrouter: ['openrouter']
    };

    for (const alias of aliases[provider] ?? [provider]) {
        const accounts = await auth.getAccountsByProviderFull(alias);
        const hasApiKey = accounts.some(accountHasApiKeyCredential);
        if (hasApiKey) {
            return true;
        }
    }

    return false;
}

function accountHasApiKeyCredential(account: {
    accessToken?: string;
    refreshToken?: string;
    sessionToken?: string;
    metadata?: RuntimeValue;
}): boolean {
    const metadata = (account.metadata && typeof account.metadata === 'object' && !Array.isArray(account.metadata))
        ? (account.metadata as Record<string, unknown>)
        : undefined;
    const authType = readMetadataString(metadata, 'auth_type', 'authType');
    const metadataType = readMetadataString(metadata, 'type');
    if (authType === 'oauth' || metadataType === 'oauth') {
        return false;
    }

    if (authType === 'api_key' || metadataType === 'api_key') {
        return typeof account.accessToken === 'string' && account.accessToken.trim().length > 0;
    }

    if (typeof account.refreshToken === 'string' && account.refreshToken.trim().length > 0) {
        return false;
    }
    if (typeof account.sessionToken === 'string' && account.sessionToken.trim().length > 0) {
        return false;
    }

    return looksLikeApiKey(account.accessToken);
}

function readMetadataString(
    metadata: Record<string, unknown> | undefined,
    ...keys: string[]
): string | undefined {
    if (!metadata) {
        return undefined;
    }
    for (const key of keys) {
        const value = metadata[key];
        if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim().toLowerCase();
        }
    }
    return undefined;
}

function looksLikeApiKey(token: string | undefined): boolean {
    if (typeof token !== 'string') {
        return false;
    }
    const normalized = token.trim().toLowerCase();
    if (!normalized) {
        return false;
    }
    return normalized.startsWith('sk-')
        || normalized.startsWith('sk_')
        || normalized.startsWith('gsk_')
        || normalized.startsWith('hf_')
        || normalized.startsWith('nvapi-')
        || normalized.startsWith('aiza')
        || normalized.startsWith('pplx-')
        || normalized.startsWith('xai-');
}

