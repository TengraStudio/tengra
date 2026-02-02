/* eslint-disable complexity, max-depth */
import { appLogger } from '@main/logging/logger';
import { DataService } from '@main/services/data/data.service';
import { LinkedAccount } from '@main/services/data/database.service';
import { AuthService } from '@main/services/security/auth.service';
import { TokenService } from '@main/services/security/token.service';
import { SettingsService } from '@main/services/system/settings.service';
import { JsonObject, JsonValue } from '@shared/types/common';
import { ClaudeQuota, CodexUsage, CopilotQuota, ModelQuotaItem, QuotaInfo, QuotaResponse } from '@shared/types/quota';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import axios from 'axios';
import { net, session } from 'electron';

export class QuotaService {

    constructor(
        private settingsService: SettingsService,
        private authService: AuthService,
        private processManager: import('@main/services/system/process-manager.service').ProcessManagerService,
        private tokenService: TokenService,
        private dataService: DataService
    ) {
        void this.processManager.startService({
            name: 'quota-service',
            executable: 'Tandem-quota-service',
            persistent: true
        }).catch(err => appLogger.error('QuotaService', `Failed to start quota service: ${err}`));


    }

    private fetchWithNet(url: string, headers: Record<string, string>): Promise<JsonValue | null> {
        return new Promise((resolve, reject) => {
            try {
                const req = net.request({ url, method: 'GET' });
                for (const [k, v] of Object.entries(headers)) {
                    req.setHeader(k, v);
                }
                req.on('response', (response) => {
                    let body = '';
                    response.on('data', (chunk) => body += chunk.toString());
                    response.on('end', () => {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            resolve(safeJsonParse(body, null));
                        } else {
                            reject(new Error(`Request failed with status code ${response.statusCode}`));
                        }
                    });
                    response.on('error', (err) => reject(err));
                });
                req.on('error', (err) => reject(err));
                req.end();
            } catch (e) { reject(e); }
        });
    }

    private async makeRequest(path: string, port: number, apiKey: string): Promise<JsonObject | { success: boolean; error?: string; raw?: string }> {
        return new Promise((resolve, reject) => {
            const options = {
                method: 'GET', protocol: 'http:' as const, hostname: '127.0.0.1', port, path
            };
            const request = net.request(options);
            request.setHeader('Authorization', `Bearer ${apiKey}`);
            request.on('response', (res) => {
                let d = '';
                res.on('data', (chunk: Buffer) => { d += chunk.toString(); });
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 400) {
                        resolve({ success: false, error: `HTTP ${res.statusCode}`, raw: d });
                        return;
                    }
                    resolve(safeJsonParse(d, { success: false, error: 'Invalid JSON', raw: d }) as JsonObject);
                });
            });
            request.on('error', (e: Error) => reject(e));
            request.end();
        });
    }

    async getQuota(_proxyPort: number, _proxyKey: string): Promise<{ accounts: Array<QuotaResponse & { accountId?: string; email?: string }> } | null> {
        try {
            const allAccounts = await this.authService.getAllAccountsFull();
            appLogger.info('QuotaService', `getQuota: Found ${allAccounts.length} total accounts. Providers: ${allAccounts.map(a => a.provider).join(', ')}`);
            const antigravityAccounts = allAccounts.filter(a => a.provider.startsWith('antigravity') || a.provider.startsWith('google'));
            appLogger.info('QuotaService', `getQuota: Found ${antigravityAccounts.length} Antigravity accounts`);

            if (antigravityAccounts.length === 0) { return null; }

            const results = [];
            for (const account of antigravityAccounts) {
                if (account.accessToken) {
                    const quota = await this.fetchAntigravityQuotaForToken(account);
                    if (quota) {
                        results.push({
                            ...quota,
                            accountId: account.id,
                            email: account.email
                        });
                    } else {
                        appLogger.warn('QuotaService', `Failed to fetch quota for account ${account.email ?? account.id}`);
                    }
                }
            }

            appLogger.info('QuotaService', `getQuota: Returning ${results.length} account quotas out of ${antigravityAccounts.length} accounts`);
            return { accounts: results };
        } catch (e) {
            appLogger.error('QuotaService', `Failed to get quota: ${e}`);
            return null;
        }
    }

    private async fetchAntigravityQuotaForToken(account: LinkedAccount): Promise<QuotaResponse | null> {
        try {
            const data = await this.fetchAntigravityUpstreamForToken(account);
            if (data) {
                return this.parseQuotaResponse(data as { models?: Record<string, { displayName?: string; quotaInfo?: QuotaInfo }> });
            }
        } catch (error) {
            if (error instanceof Error && error.message === 'AUTH_EXPIRED') {
                return { success: false, authExpired: true, status: 'Expired', next_reset: '-', models: [] };
            }
        }
        return null;
    }

    // --- Antigravity ---

    /**
     * Public method to fetch Antigravity upstream data for a specific account
     * Used by LocalImageService to check image model quota
     */
    async fetchAntigravityUpstreamForToken(account: LinkedAccount): Promise<JsonObject | null> {
        const accessToken = account.accessToken;
        if (!accessToken) { return null; }

        const upstreamUrl = 'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels';
        try {
            const response = await axios.post(upstreamUrl, {}, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'antigravity/1.104.0 darwin/arm64'
                },
                timeout: 8000
            });
            if (response.status === 200 && response.data) { return response.data as JsonObject; }
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 401) {
                appLogger.warn('QuotaService', 'Antigravity token invalid/expired (401). Triggering forced refresh.');
                void this.tokenService.ensureFreshToken(account.provider, true);
            }
        }
        return null;
    }


    async fetchAntigravityQuota(): Promise<QuotaResponse | null> {
        const accounts = await this.authService.getAllAccountsFull();
        const account = accounts.find(a => a.provider.startsWith('antigravity') || a.provider.startsWith('google'));
        if (!account) { return null; }
        return this.fetchAntigravityQuotaForToken(account);
    }


    async getAntigravityAvailableModels(): Promise<ModelQuotaItem[]> {
        try {
            const accounts = await this.authService.getAllAccountsFull();
            const account = accounts.find(a => a.provider.startsWith('antigravity') || a.provider.startsWith('google'));
            if (!account) { return []; }
            const data = await this.fetchAntigravityUpstreamForToken(account) as { models?: Record<string, { displayName?: string; quotaInfo?: QuotaInfo }> } | null;
            if (data?.models) {
                const models: ModelQuotaItem[] = [];
                // Removed restrictive filtering for 'chat_' and 'rev' prefixes to show all models


                for (const [key, val] of Object.entries(data.models)) {
                    // Filter out unwanted internal/restricted models
                    if (['chat_23310', 'chat_20706', 'rev19-uic3-1p', 'tab_flash_lite_preview'].includes(key)) {
                        continue;
                    }
                    let percentage = 100;
                    let reset = '-';

                    if (val.quotaInfo) {
                        const q = val.quotaInfo;
                        if (typeof q.remainingFraction === 'number') {
                            percentage = Math.round(q.remainingFraction * 100);
                        } else if (typeof q.remainingQuota === 'number' && typeof q.totalQuota === 'number' && q.totalQuota > 0) {
                            percentage = Math.round((q.remainingQuota / q.totalQuota) * 100);
                        } else if (q.resetTime) {
                            percentage = 0;
                        }

                        if (q.resetTime) {
                            try {
                                reset = new Date(q.resetTime).toLocaleString('tr-TR', {
                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                });
                            } catch {
                                // ignore
                            }
                        }
                    }

                    models.push({
                        id: key,
                        name: (val.displayName ?? key) as string,
                        object: 'model',
                        owned_by: 'antigravity',
                        provider: 'antigravity',
                        percentage,
                        reset,
                        permission: [],
                        quotaInfo: val.quotaInfo
                    });
                }
                return models;
            }
        } catch {
            // ignore
        }
        return [];
    }

    // --- Legacy ---

    async fetchLegacyQuota(): Promise<QuotaResponse | null> {
        try {
            const legacy = await this.getLegacyQuota();
            if (legacy.success) { return legacy as QuotaResponse; }
        } catch {
            // ignore
        }
        return null;
    }

    async getLegacyQuota(): Promise<{ success: boolean; authExpired?: boolean; data?: JsonObject } & Partial<QuotaResponse>> {
        const token = await this.authService.getActiveToken('antigravity');
        if (!token) { return { success: false, next_reset: '-', models: [], status: 'Error' }; }
        return { success: true, data: { authenticated: true }, models: [], next_reset: '-', status: 'Authenticated' };
    }

    // --- Proxy ---

    async fetchProxyQuota(port: number, key: string): Promise<QuotaResponse | null> {
        try {
            const res = await this.makeRequest('/v1/quota', port, key) as { success?: boolean; models?: unknown; status?: unknown };
            // Check if the response indicates an error (404, etc.)
            if (res.success === false) {
                // Proxy doesn't have /v1/quota endpoint or returned error
                return null;
            }
            // Only return if it looks like a valid QuotaResponse
            if ('models' in res || 'status' in res) {
                return res as unknown as QuotaResponse;
            }
        } catch {
            // ignore
        }
        return null;
    }

    // --- Codex ---

    async fetchCodexQuota(): Promise<QuotaResponse | null> {
        try {
            const codexData = await this.fetchCodexUsage();
            if (codexData) { return this.parseCodexUsageToQuota(codexData); }
        } catch {
            // ignore
        }
        return null;
    }

    async getCodexUsage(): Promise<{ accounts: Array<{ usage: JsonObject | { error: string }; accountId?: string; email?: string }> }> {
        const allAccounts = await this.authService.getAllAccountsFull();
        const codexAccounts = allAccounts.filter(a => a.provider === 'codex' || a.provider === 'openai');
        appLogger.info('QuotaService', `getCodexUsage: Found ${codexAccounts.length} Codex accounts (Total: ${allAccounts.length})`);

        const results = [];
        for (const account of codexAccounts) {
            const usage = await this.fetchCodexUsageForToken(account);
            if (usage) {
                results.push({
                    usage,
                    accountId: account.id,
                    email: account.email
                });
            }
        }
        return { accounts: results };
    }

    private async fetchCodexUsageForToken(account: LinkedAccount): Promise<JsonObject | { error: string } | null> {
        const accessToken = account.accessToken;
        if (!accessToken) { return null; }

        try {
            const response = await axios.get('https://api.openai.com/dashboard/billing/usage', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'OpenAI-Organization': account.metadata?.organizationId as string
                }
            });
            return response.data;
        } catch (e) {
            return { error: (e instanceof Error ? e.message : String(e)) };
        }
    }

    async fetchCodexUsage(): Promise<JsonObject | null> {
        const settings = this.settingsService.getSettings();
        let token = settings.openai?.accessToken ?? settings.openai?.apiKey;

        if (!token || token === 'connected') {
            try {
                const dbToken = await this.authService.getActiveToken('codex');
                if (dbToken) { token = dbToken; }
            } catch {
                // ignore
            }
        }

        if (!token || token === 'connected') {
            try {
                const cookies = await session.defaultSession.cookies.get({ url: 'https://chatgpt.com' });
                if (cookies.length > 0) {
                    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
                    const sessionRes = await axios.get('https://chatgpt.com/api/auth/session', {
                        headers: {
                            'Cookie': cookieHeader,
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        }
                    });
                    const sessionData = sessionRes.data as { accessToken?: string } | null;
                    if (sessionData?.accessToken) { token = sessionData.accessToken; }
                }
            } catch (error) {
                appLogger.debug('quota.service', '[QuotaService] Failed to fetch ChatGPT session cookies:', getErrorMessage(error));
            }
        }

        if (!token || token === 'connected') { return null; }

        const data = await this.fetchCodexUsageFromWham(token) as ({ email?: string } & JsonObject) | null;

        return data;
    }

    // --- Copilot ---

    // --- Claude/Anthropic ---

    async getClaudeQuota(): Promise<{ accounts: Array<ClaudeQuota> }> {
        const accounts = await this.authService.getAllAccountsFull();
        const claudeAccounts = accounts.filter(a => a.provider === 'claude' || a.provider === 'anthropic');
        appLogger.info('QuotaService', `getClaudeQuota: Found ${claudeAccounts.length} Claude accounts`);

        const results: ClaudeQuota[] = [];
        for (const account of claudeAccounts) {
            const quota = await this.fetchClaudeQuotaForToken(account);
            if (quota) {
                results.push({
                    ...quota,
                    accountId: account.id,
                    email: account.email
                });
            }
        }
        return { accounts: results };
    }

    private async fetchClaudeQuotaForToken(account: LinkedAccount): Promise<ClaudeQuota | null> {
        appLogger.info('quota.service', `Fetching Claude quota for account: ${account.id}`, { account } as unknown as JsonObject);
        let accessToken = account.accessToken;
        // Check if accessToken is actually a JSON string (e.g. OAuth response) and extract the real token
        if (accessToken?.trim().startsWith('{')) {
            try {
                const parsed = safeJsonParse<JsonObject>(accessToken, {});
                if (parsed.access_token) {
                    accessToken = parsed.access_token as string;
                }
            } catch { /* ignore */ }
        }

        const sessionKey = account.sessionToken;
        if (!accessToken && !sessionKey) { return { success: false, error: 'No access token or session key' }; }

        try {
            // Check for persisted Org ID first
            let orgId: string | null | undefined = account.metadata?.claudeOrgId as string | undefined;

            if (!orgId) {
                appLogger.info('QuotaService', 'Fetching Claude Organization ID from API...');
                orgId = await this.fetchClaudeOrganizationId(accessToken ?? '', sessionKey ?? null);

                if (orgId) {
                    // Persist the Org ID if found
                    try {
                        const currentMeta = account.metadata ?? {};
                        await this.authService.updateToken(account.id, {
                            metadata: { ...currentMeta, claudeOrgId: orgId }
                        });
                        appLogger.info('QuotaService', `Persisted Claude Org ID: ${orgId}`);
                    } catch (err) {
                        appLogger.warn('QuotaService', `Failed to persist Claude Org ID: ${getErrorMessage(err)}`);
                    }
                }
            } else {
                appLogger.info('QuotaService', `Using persisted Claude Org ID: ${orgId}`);
            }

            if (!orgId) { return { success: false, error: 'Failed to retrieve Organization ID' }; }

            const usage = await this.fetchClaudeUsage(accessToken ?? '', orgId, sessionKey ?? null);
            if (!usage) { return { success: false, error: 'Failed to fetch usage information' }; }

            return this.formatClaudeUsage(usage);
        } catch (e) {
            return { success: false, error: (e instanceof Error ? e.message : String(e)) };
        }
    }

    private formatClaudeUsage(usage: { five_hour?: { utilization?: number; resets_at?: string }; seven_day?: { utilization?: number; resets_at?: string } }): ClaudeQuota {
        return {
            success: true,
            fiveHour: usage.five_hour ? {
                utilization: usage.five_hour.utilization ?? 0,
                resetsAt: usage.five_hour.resets_at ?? ''
            } : undefined,
            sevenDay: usage.seven_day ? {
                utilization: usage.seven_day.utilization ?? 0,
                resetsAt: usage.seven_day.resets_at ?? ''
            } : undefined
        };
    }

    /**
     * Validates and saves a Claude session key to the database.
     * Fetches the organization ID and updates the specified account.
     */
    public async saveClaudeSession(sessionKey: string, accountId?: string): Promise<{ success: boolean; error?: string }> {
        try {
            // Validate key format locally
            if (!sessionKey.startsWith('sk-ant-sid')) {
                return { success: false, error: 'Invalid session key format. Must start with sk-ant-sid' };
            }

            // Fetch Org ID to validate the session
            const orgId = await this.fetchClaudeOrganizationId('', sessionKey);
            if (!orgId) {
                return { success: false, error: 'Failed to retrieve Organization ID. The session key might be invalid or expired.' };
            }

            if (accountId) {
                // Targeted update for a specific account (ideal for manual flow)
                await this.authService.updateToken(accountId, {
                    sessionToken: sessionKey,
                    metadata: { claudeOrgId: orgId }
                });
                appLogger.info('QuotaService', `Updated Claude account ${accountId} with manual sessionKey`);
            } else {
                // Fallback: look for matches (legacy behavior or generic entry)
                const fullAccounts = await this.authService.getAllAccountsFull();
                const claudeAccounts = fullAccounts.filter(a => a.provider === 'claude');
                const accountToUpdate = claudeAccounts.find(a =>
                    a.sessionToken === sessionKey || a.metadata?.claudeOrgId === orgId
                );

                if (accountToUpdate) {
                    await this.authService.updateToken(accountToUpdate.id, {
                        sessionToken: sessionKey,
                        metadata: { ...accountToUpdate.metadata, claudeOrgId: orgId }
                    });
                } else {
                    await this.authService.linkAccount('claude', {
                        sessionToken: sessionKey,
                        email: `claude-manual-${orgId.substring(0, 8)}`,
                        metadata: { claudeOrgId: orgId }
                    });
                }
            }
            return { success: true };
        } catch (err) {
            const msg = getErrorMessage(err);
            appLogger.error('QuotaService', `Failed to save Claude session: ${msg}`);
            return { success: false, error: msg };
        }
    }

    /**
     * Imports Claude authentication data from legacy JSON files in the auth directory.
     * This handles the transition from file-based to database-based authentication.
     */
    private async importLegacyClaudeFiles(): Promise<void> {
        const authDir = this.dataService.getPath('auth');
        const fs = await import('fs');
        const path = await import('path');

        if (!fs.existsSync(authDir)) { return; }

        try {
            const files = fs.readdirSync(authDir);
            for (const file of files) {
                if (file.endsWith('.json') && (file.toLowerCase().startsWith('claude') || file.toLowerCase().startsWith('anthropic'))) {
                    const filePath = path.join(authDir, file);
                    try {
                        const content = fs.readFileSync(filePath, 'utf8');
                        const data = safeJsonParse<JsonObject>(content, {});

                        // Check if we already have this account in DB (by email)
                        const email = data.email;
                        if (email) {
                            const existing = await this.authService.getAccountsByProvider('claude');
                            if (existing.some(a => a.email === email)) {
                                // Already in DB, skip
                                continue;
                            }
                        }

                        // Save to DB
                        const tokenData = {
                            accessToken: (data.access_token ?? data.accessToken ?? undefined) as string | undefined,
                            refreshToken: (data.refresh_token ?? data.refreshToken ?? undefined) as string | undefined,
                            sessionToken: (data.session_token ?? data.sessionToken ?? data.session_key ?? undefined) as string | undefined,
                            email: (data.email ?? undefined) as string | undefined,
                            expiresAt: (data.expires_at || data.expiresAt) ? Number(data.expires_at ?? data.expiresAt) : undefined,
                            scope: (data.scope ?? undefined) as string | undefined,
                            metadata: data
                        };
                        await this.authService.linkAccount('claude', tokenData);
                        appLogger.info('QuotaService', `Imported legacy Claude auth file to database: ${file}`);

                        // Optional: Rename file to .migrated to avoid re-processing
                        fs.renameSync(filePath, filePath + '.migrated');
                    } catch (err) {
                        appLogger.error('QuotaService', `Error importing legacy file ${file}: ${getErrorMessage(err)}`);
                    }
                }
            }
        } catch (err) {
            appLogger.error('QuotaService', `Failed to read auth directory: ${getErrorMessage(err)}`);
        }
    }

    private async fetchClaudeOrganizationId(accessToken: string, sessionKey: string | null): Promise<string | null> {
        if (accessToken) {
            try {
                const parts = accessToken.split('.');
                if (parts.length === 3) {
                    const payload = safeJsonParse<JsonObject>(Buffer.from(parts[1], 'base64').toString(), {});
                    const id = (payload.org_id ?? payload.organization_id ?? payload.org_uuid ?? payload.uuid ?? null) as string | null;
                    if (id) { return id; }
                }
            } catch { /* ignore */ }
        }
        appLogger.info('quota.service', 'Fetching Claude organization ID', { accessToken, sessionKey });

        // User explicitly requested to use ONLY claude.ai with specific headers
        const url = 'https://claude.ai/api/organizations';

        try {
            // Headers copied from user's working curl command
            const headers: Record<string, string> = {
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'accept-language': 'en-US,en;q=0.9',
                'cache-control': 'max-age=0',
                'priority': 'u=0, i',
                'sec-ch-ua': '"Opera";v="125", "Not?A_Brand";v="8", "Chromium";v="141"',
                'sec-ch-ua-arch': '"x86"',
                'sec-ch-ua-bitness': '"64"',
                'sec-ch-ua-full-version': '"125.0.5729.49"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-model': '""',
                'sec-ch-ua-platform': '"Windows"',
                'sec-ch-ua-platform-version': '"19.0.0"',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'none',
                'sec-fetch-user': '?1',
                'upgrade-insecure-requests': '1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 OPR/125.0.0.0 (Edition Yx TR PA)',
            };

            // Always use Cookie for claude.ai
            const tokenToUse = sessionKey ?? accessToken;
            if (tokenToUse) {
                headers['Cookie'] = `sessionKey=${tokenToUse}`;
            }

            const data = await this.fetchWithNet(url, headers);
            if (Array.isArray(data) && data.length > 0) {
                const first = data[0] as JsonObject;
                return (first.uuid ?? first.id ?? null) as string | null;
            }
        } catch (e) {
            appLogger.warn('QuotaService', `fetchClaudeOrganizationId failed for ${url}: ${getErrorMessage(e)}`);
        }
        return null;
    }

    private async fetchClaudeUsage(accessToken: string, orgId: string, sessionKey: string | null): Promise<Record<string, unknown> | null> {
        // Try the new Anthropic OAuth usage endpoint first (for OAuth tokens)
        if (accessToken) {
            try {
                const oauthUrl = 'https://api.anthropic.com/api/oauth/usage';
                const oauthHeaders: Record<string, string> = {
                    'Authorization': `Bearer ${accessToken}`,
                    'anthropic-beta': 'oauth-2025-04-20',
                    'Accept': 'application/json'
                };

                appLogger.info('QuotaService', `Trying Anthropic OAuth usage endpoint: ${oauthUrl}`);
                const oauthData = await this.fetchWithNet(oauthUrl, oauthHeaders);
                if (oauthData && typeof oauthData === 'object' && !Array.isArray(oauthData)) {
                    return oauthData as Record<string, unknown>;
                }
            } catch (e) {
                appLogger.warn('QuotaService', `Anthropic OAuth usage endpoint failed: ${getErrorMessage(e)}`);
            }
        }

        // Fallback to claude.ai endpoint (for session keys)
        const url = `https://claude.ai/api/organizations/${orgId}/usage`;

        try {
            const headers: Record<string, string> = {
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'accept-language': 'en-US,en;q=0.9',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 OPR/125.0.0.0 (Edition Yx TR PA)',
            };

            const tokenToUse = sessionKey ?? accessToken;
            if (tokenToUse) {
                headers['Cookie'] = `sessionKey=${tokenToUse}`;
            }

            const data = await this.fetchWithNet(url, headers);
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                return data as Record<string, unknown>;
            }
        } catch (e) {
            appLogger.warn('QuotaService', `fetchClaudeUsage failed for ${url}: ${getErrorMessage(e)}`);
        }
        return null;
    }


    async getCopilotQuota(): Promise<{ accounts: Array<CopilotQuota & { accountId?: string; email?: string }> }> {
        const allAccounts = await this.authService.getAllAccountsFull();
        appLogger.info('QuotaService', `getCopilotQuota: All available token providers: ${allAccounts.map(a => a.provider).join(', ')}`);

        const copilotAccounts = allAccounts.filter(a => a.provider === 'copilot' || a.provider === 'github');
        appLogger.info('QuotaService', `getCopilotQuota: Found ${copilotAccounts.length} Copilot/GitHub candidates`);

        // Deduplicate by identity (email or token) to avoid showing same account twice
        // We treat 'github' and 'copilot' as synonymous providers for the same user
        const seenIdentities = new Set<string>();
        const uniqueAccounts: LinkedAccount[] = [];

        for (const account of copilotAccounts) {
            // Identity resolution: try to use email as primary key
            const email = account.email?.toLowerCase().trim();
            const token = account.accessToken?.trim();
            const identity = email ?? token;

            if (!identity) {
                continue;
            }

            if (seenIdentities.has(identity)) {
                appLogger.info('QuotaService', `getCopilotQuota: Merging duplicate provider/account for identity: ${identity.substring(0, 10)}... (Provider: ${account.provider})`);
                continue;
            }

            // Also check if we already have an account with the same email if this one is just a token
            if (email && seenIdentities.has(email)) {
                continue;
            }
            if (token && seenIdentities.has(token)) {
                continue;
            }

            seenIdentities.add(identity);
            if (email) {
                seenIdentities.add(email);
            }
            if (token) {
                seenIdentities.add(token);
            }

            uniqueAccounts.push(account);
        }

        // Final safety: as the user noted, multiple accounts with different tokens/emails
        // are often actually the same person in the context of Copilot/GitHub.
        // If we still have more than one, we consolidate to a single representative account.
        if (uniqueAccounts.length > 1) {
            appLogger.info('QuotaService', `getCopilotQuota: Consolidating ${uniqueAccounts.length} candidate accounts into one primary view.`);
            const primary = uniqueAccounts.find(a => a.provider === 'github') ?? uniqueAccounts[0];
            uniqueAccounts.splice(0, uniqueAccounts.length, primary);
        }

        appLogger.info('QuotaService', `getCopilotQuota: Consolidated to ${uniqueAccounts.length} unique logical account(s).`);

        const results = [];
        for (const account of uniqueAccounts) {
            const quota = await this.fetchCopilotQuotaForToken(account);
            if (quota) {
                results.push({
                    ...quota,
                    accountId: account.id,
                    email: account.email
                });
            }
        }
        return { accounts: results };
    }

    private async fetchCopilotQuotaForToken(account: LinkedAccount): Promise<CopilotQuota | null> {
        const githubToken = account.accessToken;
        if (!githubToken) { return null; }

        try {
            // 1. Fetch Billing Info (Restored to copilot_internal/user)
            const billingRes = await axios.get('https://api.github.com/copilot_internal/user', {
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github+json',
                    'User-Agent': 'GithubCopilot/1.250.0'
                }
            });

            const data = billingRes.data as {
                quota_snapshots?: { premium_interactions?: { entitlement?: number; remaining?: number } };
                copilot_plan?: string;
                quota_reset_date?: string;
            };
            const premium = data.quota_snapshots?.premium_interactions;
            const quota: CopilotQuota = {
                copilot_plan: data.copilot_plan ?? 'unknown',
                limit: premium?.entitlement ?? 0,
                remaining: premium?.remaining ?? 0,
                reset: data.quota_reset_date ?? undefined,
                // rate_limit will be filled below
            };

            // 2. Fetch Rate Limit Info (Parallel)
            try {
                const rateLimitRes = await axios.get('https://api.github.com/rate_limit', {
                    headers: {
                        'Authorization': `token ${githubToken}`,
                        'Accept': 'application/vnd.github+json',
                        'User-Agent': 'GithubCopilot/1.250.0'
                    }
                });
                const rl = rateLimitRes.data as { resources: { core: { limit: number; remaining: number; reset: number } } };
                quota.rate_limit = {
                    limit: rl.resources.core.limit,
                    remaining: rl.resources.core.remaining,
                    reset: new Date(rl.resources.core.reset * 1000).toISOString()
                };
            } catch {
                // Ignore rate limit errors, we still have billing info
            }

            return quota;
        } catch (e) {
            return { error: (e instanceof Error ? e.message : String(e)), remaining: 0, limit: 0, copilot_plan: 'unknown' };
        }
    }

    private async fetchCopilotBilling(): Promise<JsonObject | null> {
        const token = await this.authService.getActiveToken('copilot');

        if (!token || token === 'connected') { return null; }

        try {
            const response = await axios.get('https://api.github.com/copilot_internal/user', {
                headers: { 'Authorization': `token ${token}`, 'User-Agent': 'GithubCopilot/1.250.0' }
            });
            return response.data as JsonObject;
        } catch (error) {
            appLogger.debug('quota.service', '[QuotaService] fetchCopilotBilling failed:', getErrorMessage(error));
            return null;
        }
    }

    // --- Helpers ---


    extractCodexUsageFromWham(data: JsonValue): CodexUsage | null {
        if (!data || typeof data !== 'object') { return null; }
        const d = data as JsonObject;
        const rateLimit = this.asObject(d.rate_limit);
        const primaryWindow = rateLimit ? this.asObject(rateLimit.primary_window) : null;
        const secondaryWindow = rateLimit ? this.asObject(rateLimit.secondary_window) : null;

        const result: Record<string, number | string | undefined | null> = {
            totalRequests: this.findNumberByKeys(d, ['total_requests', 'totalRequests', 'request_count', 'requests_used', 'requests']),
            totalTokens: this.findNumberByKeys(d, ['total_tokens', 'totalTokens', 'token_count', 'tokens_used', 'tokens']),
            remainingRequests: this.findNumberByKeys(d, ['remaining_requests', 'remainingRequests', 'requests_remaining']),
            remainingTokens: this.findNumberByKeys(d, ['remaining_tokens', 'remainingTokens', 'tokens_remaining']),
            dailyUsage: this.findNumberByKeys(d, ['daily_usage', 'dailyUsage', 'daily_used', 'usage_daily', 'requests_daily', 'requests_today', 'cap_usage', 'usage']),
            dailyLimit: this.findNumberByKeys(d, ['daily_limit', 'dailyLimit', 'limit_daily', 'daily_quota', 'cap_limit', 'limit']),
            weeklyUsage: this.findNumberByKeys(d, ['weekly_usage', 'weeklyUsage', 'weekly_used', 'usage_weekly', 'requests_weekly']),
            weeklyLimit: this.findNumberByKeys(d, ['weekly_limit', 'weeklyLimit', 'limit_weekly', 'weekly_quota']),
            dailyUsedPercent: this.toNumber(primaryWindow?.used_percent ?? null) ?? this.findNumberByKeys(d, ['rate_limit.primary_window.used_percent']),
            weeklyUsedPercent: this.toNumber(secondaryWindow?.used_percent ?? null) ?? this.findNumberByKeys(d, ['rate_limit.secondary_window.used_percent']),
            dailyResetAt: this.normalizeResetAt(primaryWindow?.reset_at ?? this.findNumberByKeys(d, ['rate_limit.primary_window.reset_at'])),
            weeklyResetAt: this.normalizeResetAt(secondaryWindow?.reset_at ?? this.findNumberByKeys(d, ['rate_limit.secondary_window.reset_at'])),
            resetAt: this.normalizeResetAt(
                this.findStringByKeys(d, ['reset_at', 'resetAt', 'reset_time', 'resetTime', 'next_reset', 'renew_at', 'renewAt']) ??
                this.findNumberByKeys(d, ['reset_at', 'resetAt', 'reset_time', 'resetTime', 'next_reset', 'renew_at', 'renewAt'])
            ),
        };

        const filtered = Object.fromEntries(
            Object.entries(result).filter(([, v]) => v !== undefined)
        ) as CodexUsage;

        return Object.keys(filtered).length > 0 ? filtered : null;
    }

    private async fetchCodexUsageFromWham(accessToken: string): Promise<JsonObject | null> {
        const endpoints = ['https://chatgpt.com/backend-api/wham/usage', 'https://chat.openai.com/backend-api/wham/usage'];
        for (const endpoint of endpoints) {
            try {
                const response = await axios.get(endpoint, {
                    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
                    timeout: 10000
                });
                if (response.data && typeof response.data === 'object') { return response.data as JsonObject; }
            } catch (e) {
                if (axios.isAxiosError(e) && (e.response?.status === 401 || e.response?.status === 403)) { break; }
            }
        }
        return null;
    }


    private parseQuotaResponse(data: { models?: Record<string, { displayName?: string; quotaInfo?: QuotaInfo }> }): QuotaResponse | null {
        if (!data.models) { return null; }

        const filteredModels = Object.entries(data.models)
            .filter(([key]) => {
                if (['chat_23310', 'chat_20706', 'rev19-uic3-1p', 'tab_flash_lite_preview'].includes(key)) {
                    appLogger.info('QuotaService', `parseQuotaResponse: Skipping filtered model: ${key}`);
                    return false;
                }
                return true;
            });

        const models: ModelQuotaItem[] = filteredModels
            .map(([key, val]) => {
                try {
                    return this.mapAntigravityModel(key, val);
                } catch {
                    return null;
                }
            })
            .filter((m): m is ModelQuotaItem => m !== null);

        return {
            status: models.length > 0 ? `${Math.round(models.reduce((sum, m) => sum + m.percentage, 0) / models.length)}%` : 'Available',
            next_reset: models.length > 0 ? models[0].reset : '-',
            models: models.sort((a, b) => a.name.localeCompare(b.name))
        };
    }

    private mapAntigravityModel(key: string, val: { displayName?: string; quotaInfo?: QuotaInfo }): ModelQuotaItem {
        let percentage = 100;
        let reset = '-';
        let quotaInfo: QuotaInfo | undefined;

        if (val.quotaInfo) {
            const q = val.quotaInfo;
            if (typeof q.remainingFraction === 'number') {
                percentage = Math.round(q.remainingFraction * 100);
            } else if (typeof q.remainingQuota === 'number' && typeof q.totalQuota === 'number' && q.totalQuota > 0) {
                percentage = Math.round((q.remainingQuota / q.totalQuota) * 100);
            } else if (q.resetTime) {
                percentage = 0;
            }

            if (q.resetTime) {
                try {
                    reset = new Date(q.resetTime).toLocaleString('tr-TR', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    });
                } catch {
                    // ignore
                }
            }
            quotaInfo = {
                remainingQuota: q.remainingQuota,
                totalQuota: q.totalQuota,
                remainingFraction: q.remainingFraction,
                resetTime: q.resetTime
            };
        }

        return {
            id: key,
            name: val.displayName ?? key,
            object: 'model',
            owned_by: 'antigravity',
            provider: 'antigravity',
            percentage,
            reset,
            permission: [],
            quotaInfo
        };
    }

    private parseCodexUsageToQuota(data: JsonObject): QuotaResponse {
        const rateLimit = this.asObject(data.rate_limit);
        const primaryWindow = rateLimit ? this.asObject(rateLimit.primary_window) : null;
        const secondaryWindow = rateLimit ? this.asObject(rateLimit.secondary_window) : null;
        const planType = typeof data.plan_type === 'string' ? data.plan_type : '';
        return {
            success: true,
            status: 'ChatGPT Usage',
            next_reset: primaryWindow?.reset_at ? String(primaryWindow.reset_at) : '-',
            models: [],
            usage: {
                dailyUsedPercent: this.toNumber(primaryWindow?.used_percent ?? null) ?? 0,
                weeklyUsedPercent: this.toNumber(secondaryWindow?.used_percent ?? null) ?? 0,
                dailyResetAt: primaryWindow?.reset_at ? String(primaryWindow.reset_at) : undefined,
                weeklyResetAt: secondaryWindow?.reset_at ? String(secondaryWindow.reset_at) : undefined,
                planType: String(planType || 'Free').toLowerCase().includes('plus') ? 'Plus' : (planType ? planType.charAt(0).toUpperCase() + planType.slice(1) : 'Free')
            }
        };
    }


    private findInObject<T>(
        root: JsonValue,
        keys: string[],
        predicate: (val: JsonValue) => T | null,
        maxDepth: number = 4
    ): T | null {
        const queue: Array<{ value: JsonValue; depth: number }> = [{ value: root, depth: 0 }];
        while (queue.length > 0) {
            const current = queue.shift();
            if (!current || !current.value || typeof current.value !== 'object') {
                continue;
            }

            const { value, depth } = current;
            const obj = value as JsonObject;

            // Search current level keys if not array
            if (!Array.isArray(obj)) {
                for (const key of keys) {
                    const candidate = obj[key];
                    if (candidate !== undefined && candidate !== null) {
                        const result = predicate(candidate);
                        if (result !== null) { return result; }
                    }
                }
            }

            // Go deeper
            if (depth < maxDepth) {
                const children = Array.isArray(obj) ? (obj as unknown as JsonValue[]) : Object.values(obj);
                for (const child of children) {
                    if (child && typeof child === 'object') {
                        queue.push({ value: child, depth: depth + 1 });
                    }
                }
            }
        }
        return null;
    }

    private findNumberByKeys(root: JsonValue, keys: string[]): number | null {
        return this.findInObject(root, keys, (val) => {
            const num = Number(val);
            return !Number.isNaN(num) ? num : null;
        });
    }

    private findStringByKeys(root: JsonValue, keys: string[]): string | null {
        return this.findInObject(root, keys, (val) => {
            if (typeof val === 'string' && val.trim()) {
                return val.trim();
            }
            return null;
        });
    }

    private normalizeResetAt(value: JsonValue): string | null {
        if (typeof value === 'string' && value.trim()) { return value.trim(); }
        const numeric = this.toNumber(value);
        if (numeric === null) { return null; }
        const ms = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
        return new Date(ms).toISOString();
    }

    private toNumber(value: JsonValue): number | null {
        if (typeof value === 'number' && Number.isFinite(value)) { return value; }
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) { return null; }
            const parsed = Number(trimmed);
            if (!Number.isNaN(parsed)) { return parsed; }
        }
        return null;
    }

    private asObject(value: JsonValue | undefined): JsonObject | null {
        if (!value || typeof value !== 'object' || Array.isArray(value)) { return null; }
        return value as JsonObject;
    }

}

