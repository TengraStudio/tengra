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
import { CredentialMode } from '@shared/utils/provider-credentials.util';

import { QuotaService } from './quota.service';

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
    'claude',
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
 * @param quota      - QuotaService instance for checking remaining quota.
 * @param auth       - AuthService instance for checking linked accounts.
 * @param settings   - SettingsService instance for reading API keys.
 * @returns The resolved auth method and a human-readable reason.
 */
export async function resolveAuthRoute(
    provider: AIProvider,
    quota: QuotaService,
    auth: AuthService,
    settings: SettingsService
): Promise<AuthRouteResult> {
    if (OAUTH_ONLY_PROVIDERS.has(provider)) {
        return { method: 'oauth', reason: `${provider} is OAuth-only` };
    }

    const oauthAvailable = await checkOAuthWithQuota(provider, quota, auth);
    if (oauthAvailable) {
        appLogger.debug('AuthRouting', `${provider}: OAuth with quota available`);
        return { method: 'oauth', reason: 'OAuth session active with remaining quota' };
    }

    const hasKey = checkApiKeyConfigured(provider, settings);
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
 * @param quota    - QuotaService for fetching quota data.
 * @param auth     - AuthService for verifying linked accounts.
 * @returns `true` if OAuth is linked and quota has not been exceeded.
 */
async function checkOAuthWithQuota(
    provider: AIProvider,
    quota: QuotaService,
    auth: AuthService
): Promise<boolean> {
    const hasAccount = await auth.hasLinkedAccount(provider);
    if (!hasAccount) {
        return false;
    }

    try {
        const quotaData = await fetchQuotaForProvider(provider, quota);
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
 * Fetches quota data for the given provider using the appropriate QuotaService method.
 *
 * @param provider - The AI provider.
 * @param quota    - QuotaService instance.
 * @returns QuotaResponse-like object or `null` if unavailable.
 */
async function fetchQuotaForProvider(
    provider: AIProvider,
    quota: QuotaService
): Promise<{ status?: string; authExpired?: boolean } | null> {
    switch (provider) {
        case 'antigravity':
            return quota.fetchAntigravityQuota();
        case 'openai': {
            const codex = await quota.fetchCodexQuota();
            return codex;
        }
        case 'anthropic':
        case 'claude': {
            const claude = await quota.getClaudeQuota();
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
 * @param provider - The AI provider to look up in settings.
 * @param settings - SettingsService for reading current configuration.
 * @returns `true` if a non-empty API key exists in settings.
 */
function checkApiKeyConfigured(
    provider: AIProvider,
    settings: SettingsService
): boolean {
    if (!API_KEY_PROVIDERS.has(provider)) {
        return false;
    }

    const appSettings = settings.getSettings();
    const providerConfig = appSettings[provider as keyof typeof appSettings];

    if (
        providerConfig !== undefined &&
        typeof providerConfig === 'object' &&
        providerConfig !== null &&
        'apiKey' in providerConfig
    ) {
        const key = (providerConfig as { apiKey: string }).apiKey;
        return typeof key === 'string' && key.trim().length > 0;
    }

    return false;
}
