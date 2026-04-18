/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';
import { LinkedAccount } from '@main/services/data/database.service';
import { AuthService } from '@main/services/security/auth.service';
import { JsonObject, JsonValue } from '@shared/types/common';
import { ClaudeQuota } from '@shared/types/quota';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { net } from 'electron';



export class ClaudeHandler {
    constructor(private authService: AuthService) { }

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

    async fetchClaudeQuotaForToken(account: LinkedAccount): Promise<ClaudeQuota | null> {
        const accessToken = this.resolveAccessToken(account);
        const sessionKey = account.sessionToken;
        if (!accessToken && !sessionKey) { return { success: false, error: 'No access token or session key' }; }

        try {
            const orgId = await this.ensureOrgId(account, accessToken, sessionKey);
            if (!orgId) { return { success: false, error: 'Failed to retrieve Organization ID' }; }

            const usage = await this.fetchClaudeUsage(accessToken ?? '', orgId, sessionKey ?? null);
            return usage ? this.formatClaudeUsage(usage) : { success: false, error: 'Failed to fetch usage information' };
        } catch (e) {
            return { success: false, error: getErrorMessage(e) };
        }
    }

    private resolveAccessToken(account: LinkedAccount): string | undefined {
        let token = account.accessToken;
        if (token?.trim().startsWith('{')) {
            try {
                const parsed = safeJsonParse<JsonObject>(token, {});
                if (parsed.access_token) { token = parsed.access_token as string; }
            } catch { /* ignore */ }
        }
        return token;
    }

    private async ensureOrgId(account: LinkedAccount, accessToken: string | undefined, sessionKey: string | null | undefined): Promise<string | null> {
        let orgId = account.metadata?.claudeOrgId as string | undefined;
        if (!orgId) {
            orgId = (await this.fetchClaudeOrganizationId(accessToken ?? '', sessionKey ?? null)) ?? undefined;
            if (orgId) { await this.persistOrgId(account, orgId); }
        }
        return orgId ?? null;
    }

    private async persistOrgId(account: LinkedAccount, orgId: string): Promise<void> {
        try {
            const currentMeta = account.metadata ?? {};
            await this.authService.updateToken(account.id, {
                metadata: { ...currentMeta, claudeOrgId: orgId }
            });
        } catch (err) {
            appLogger.warn('ClaudeHandler', `Failed to persist Claude Org ID: ${getErrorMessage(err)}`);
        }
    }

    private formatClaudeUsage(usage: JsonObject): ClaudeQuota {
        const fiveHour = usage.five_hour as JsonObject | undefined;
        const sevenDay = usage.seven_day as JsonObject | undefined;

        return {
            success: true,
            fiveHour: this.parseClaudeUsageItem(fiveHour),
            sevenDay: this.parseClaudeUsageItem(sevenDay)
        };
    }

    private parseClaudeUsageItem(item: JsonObject | undefined): { utilization: number; resetsAt: string } | undefined {
        if (!item) { return undefined; }
        return {
            utilization: item.utilization as number ?? 0,
            resetsAt: item.resets_at as string ?? ''
        };
    }

    async fetchClaudeOrganizationId(accessToken: string, sessionKey: string | null): Promise<string | null> {
        const idFromJwt = this.extractOrgIdFromJwt(accessToken);
        if (idFromJwt) { return idFromJwt; }

        const url = 'https://claude.ai/api/organizations';
        try {
            const data = await this.fetchWithNet(url, this.getClaudeHeaders(accessToken, sessionKey));
            if (Array.isArray(data) && data.length > 0) {
                const first = data[0] as JsonObject;
                return (first.uuid ?? first.id ?? null) as string | null;
            }
        } catch (e) {
            appLogger.warn('ClaudeHandler', `fetchClaudeOrganizationId failed: ${getErrorMessage(e)}`);
        }
        return null;
    }

    private extractOrgIdFromJwt(accessToken: string): string | null {
        if (!accessToken) { return null; }
        try {
            const parts = accessToken.split('.');
            if (parts.length === 3) {
                const payload = safeJsonParse<JsonObject>(Buffer.from(parts[1], 'base64').toString(), {});
                return (payload.org_id ?? payload.organization_id ?? payload.org_uuid ?? payload.uuid ?? null) as string | null;
            }
        } catch { /* ignore */ }
        return null;
    }

    private getClaudeHeaders(accessToken: string, sessionKey: string | null): Record<string, string> {
        const headers: Record<string, string> = {
            'accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
        };
        const tokenToUse = sessionKey ?? accessToken;
        if (tokenToUse) { headers['Cookie'] = `sessionKey=${tokenToUse}`; }
        return headers;
    }

    async fetchClaudeUsage(accessToken: string, orgId: string, sessionKey: string | null): Promise<JsonObject | null> {
        const oauthUsage = await this.fetchClaudeOAuthUsage(accessToken);
        if (oauthUsage) { return oauthUsage; }

        const url = `https://claude.ai/api/organizations/${orgId}/usage`;
        try {
            const data = await this.fetchWithNet(url, this.getClaudeHeaders(accessToken, sessionKey));
            if (data && typeof data === 'object' && !Array.isArray(data)) { return data as JsonObject; }
        } catch (e) {
            appLogger.warn('ClaudeHandler', `fetchClaudeUsage failed: ${getErrorMessage(e)}`);
        }
        return null;
    }

    private async fetchClaudeOAuthUsage(accessToken: string): Promise<JsonObject | null> {
        if (!accessToken) { return null; }
        try {
            const url = 'https://api.anthropic.com/api/oauth/usage';
            const headers = {
                'Authorization': `Bearer ${accessToken}`,
                'anthropic-beta': 'oauth-2025-04-20',
                'Accept': 'application/json'
            };
            const data = await this.fetchWithNet(url, headers);
            if (data && typeof data === 'object' && !Array.isArray(data)) { return data as JsonObject; }
        } catch { /* ignore */ }
        return null;
    }
    /**
     * Validates and saves a Claude session key to the database.
     * Fetches the organization ID and updates the specified account.
     */
    async saveClaudeSession(sessionKey: string, accountId?: string): Promise<{ success: boolean; error?: string }> {
        try {
            const orgId = await this.fetchClaudeOrganizationId('', sessionKey);
            if (!orgId) { return { success: false, error: 'Failed to retrieve Organization ID' }; }

            if (accountId) {
                const accounts = await this.authService.getAccountsByProviderFull('claude');
                const account = accounts.find(a => a.id === accountId);
                if (account) {
                    await this.persistOrgId(account, orgId);
                    await this.authService.updateToken(accountId, { sessionToken: sessionKey });
                }
            } else {
                await this.authService.linkAccount('claude', {
                    sessionToken: sessionKey,
                    metadata: { claudeOrgId: orgId }
                });
            }
            return { success: true };
        } catch (e) {
            return { success: false, error: getErrorMessage(e) };
        }
    }
}
