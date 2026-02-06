import { appLogger } from '@main/logging/logger';
import { LinkedAccount } from '@main/services/data/database.service';
import { AuthService } from '@main/services/security/auth.service';
import { TokenService } from '@main/services/security/token.service';
import { SettingsService } from '@main/services/system/settings.service';
import { JsonObject, JsonValue } from '@shared/types/common';
import { ClaudeQuota, CodexUsage, CopilotQuota, ModelQuotaItem, QuotaInfo, QuotaResponse } from '@shared/types/quota';
import { getErrorMessage } from '@shared/utils/error.util';

import { AntigravityHandler } from './quota/antigravity-handler';
import { ClaudeHandler } from './quota/claude-handler';
import { CodexHandler } from './quota/codex-handler';
import { CopilotHandler } from './quota/copilot-handler';

export interface QuotaModel {
    displayName?: string;
    quotaInfo?: {
        remainingFraction?: number;
        remainingQuota?: number;
        totalQuota?: number;
    }
}

export class QuotaService {
    private antigravityHandler: AntigravityHandler;
    private codexHandler: CodexHandler;
    private claudeHandler: ClaudeHandler;
    private copilotHandler: CopilotHandler;

    constructor(
        private settingsService: SettingsService,
        private authService: AuthService,
        private processManager: import('@main/services/system/process-manager.service').ProcessManagerService,
        private tokenService: TokenService
    ) {
        this.antigravityHandler = new AntigravityHandler(this.tokenService);
        this.codexHandler = new CodexHandler(this.settingsService, this.authService);
        this.claudeHandler = new ClaudeHandler(this.authService);
        this.copilotHandler = new CopilotHandler();

        void this.processManager.startService({
            name: 'quota-service',
            executable: 'Tandem-quota-service',
            persistent: true
        }).catch(err => {
            appLogger.error('QuotaService', `Failed to start quota service: ${getErrorMessage(err)}`);
        });
    }

    // --- Core API ---

    async getQuota(_proxyPort: number, _proxyKey: string): Promise<{ accounts: Array<QuotaResponse & { accountId?: string; email?: string }> } | null> {
        try {
            const allAccounts = await this.authService.getAllAccountsFull();
            const antigravityAccounts = allAccounts.filter(a => a.provider.startsWith('antigravity') || a.provider.startsWith('google'));

            if (antigravityAccounts.length === 0) { return null; }

            const results = [];
            for (const account of antigravityAccounts) {
                const quota = await this.fetchAntigravityQuotaForToken(account);
                if (quota) {
                    results.push({ ...quota, accountId: account.id, email: account.email });
                }
            }
            return { accounts: results };
        } catch (e) {
            appLogger.error('QuotaService', `Failed to get quota: ${getErrorMessage(e)}`);
            return null;
        }
    }

    // --- Antigravity ---

    async fetchAntigravityQuota(): Promise<QuotaResponse | null> {
        const accounts = await this.authService.getAllAccountsFull();
        const account = accounts.find(a => a.provider.startsWith('antigravity') || a.provider.startsWith('google'));
        if (!account) { return null; }
        return this.fetchAntigravityQuotaForToken(account);
    }

    public async fetchAntigravityUpstreamForToken(account: LinkedAccount): Promise<unknown> {
        return this.antigravityHandler.fetchAntigravityUpstreamForToken(account);
    }

    private async fetchAntigravityQuotaForToken(account: LinkedAccount): Promise<QuotaResponse | null> {
        try {
            const data = await this.antigravityHandler.fetchAntigravityUpstreamForToken(account);
            if (data) {
                return this.antigravityHandler.parseQuotaResponse(data as { models?: Record<string, { displayName?: string; quotaInfo?: QuotaInfo }> });
            }
        } catch (error) {
            if (error instanceof Error && error.message === 'AUTH_EXPIRED') {
                return { success: false, authExpired: true, status: 'Expired', next_reset: '-', models: [] };
            }
        }
        return null;
    }

    async getAntigravityAvailableModels(): Promise<ModelQuotaItem[]> {
        try {
            const accounts = await this.authService.getAllAccountsFull();
            const account = accounts.find(a => a.provider.startsWith('antigravity') || a.provider.startsWith('google'));
            if (account === undefined) { return []; }
            const data = await this.antigravityHandler.fetchAntigravityUpstreamForToken(account) as { models?: Record<string, { displayName?: string; quotaInfo?: QuotaInfo }> } | null;
            if (data?.models) {
                return this.antigravityHandler.parseQuotaResponse(data)?.models ?? [];
            }
        } catch (err) {
            appLogger.debug('QuotaService', `Failed to get Antigravity models: ${getErrorMessage(err)}`);
        }
        return [];
    }

    // --- Codex ---

    async fetchCodexQuota(): Promise<QuotaResponse | null> {
        try {
            const codexData = await this.codexHandler.fetchCodexUsage();
            if (codexData) { return this.codexHandler.parseCodexUsageToQuota(codexData); }
        } catch (err) {
            appLogger.debug('QuotaService', `Failed to fetch Codex quota: ${getErrorMessage(err)}`);
        }
        return null;
    }

    async getCodexUsage(): Promise<{ accounts: Array<{ usage: CodexUsage | { error: string }; accountId?: string; email?: string }> }> {
        const allAccounts = await this.authService.getAllAccountsFull();
        const codexAccounts = allAccounts.filter(a => a.provider === 'codex' || a.provider === 'openai');

        const results = [];
        for (const account of codexAccounts) {
            const usage = await this.codexHandler.fetchCodexUsage();
            if (usage) {
                const parsed = this.codexHandler.extractCodexUsageFromWham(usage);
                results.push({ usage: parsed ?? { error: 'Failed to parse usage' }, accountId: account.id, email: account.email });
            }
        }
        return { accounts: results };
    }

    async fetchCodexUsage(): Promise<JsonObject | null> {
        return this.codexHandler.fetchCodexUsage();
    }

    extractCodexUsageFromWham(data: JsonValue): CodexUsage | null {
        return this.codexHandler.extractCodexUsageFromWham(data);
    }

    // --- Claude/Anthropic ---

    async getClaudeQuota(): Promise<{ accounts: Array<ClaudeQuota> }> {
        const accounts = await this.authService.getAllAccountsFull();
        const claudeAccounts = accounts.filter(a => a.provider === 'claude' || a.provider === 'anthropic');

        const results: ClaudeQuota[] = [];
        for (const account of claudeAccounts) {
            const quota = await this.fetchClaudeQuotaForToken(account);
            if (quota) {
                results.push({ ...quota, accountId: account.id, email: account.email });
            }
        }
        return { accounts: results };
    }

    private async fetchClaudeQuotaForToken(account: LinkedAccount): Promise<ClaudeQuota | null> {
        return this.claudeHandler.fetchClaudeQuotaForToken(account);
    }

    public async saveClaudeSession(sessionKey: string, accountId?: string): Promise<{ success: boolean; error?: string }> {
        return this.claudeHandler.saveClaudeSession(sessionKey, accountId);
    }

    // --- Copilot ---

    async getCopilotQuota(): Promise<{ accounts: Array<CopilotQuota & { accountId?: string; email?: string }> }> {
        const allAccounts = await this.authService.getAllAccountsFull();
        const copilotAccounts = allAccounts.filter(a => a.provider === 'copilot' || a.provider === 'github');
        const uniqueAccounts = this.deduplicateCopilotAccounts(copilotAccounts);

        const results = [];
        for (const account of uniqueAccounts) {
            const quota = await this.fetchCopilotQuotaForToken(account);
            if (quota) {
                results.push({ ...quota, accountId: account.id, email: account.email });
            }
        }
        return { accounts: results };
    }

    private async fetchCopilotQuotaForToken(account: LinkedAccount): Promise<CopilotQuota | null> {
        return this.copilotHandler.fetchCopilotQuotaForToken(account);
    }

    private deduplicateCopilotAccounts(accounts: LinkedAccount[]): LinkedAccount[] {
        const unique: LinkedAccount[] = [];
        const seen = new Set<string>();

        for (const account of accounts) {
            const id = account.email?.toLowerCase().trim() ?? account.accessToken?.trim();
            if (!id || seen.has(id)) { continue; }
            seen.add(id);
            if (account.email) { seen.add(account.email.toLowerCase().trim()); }
            unique.push(account);
        }

        return unique.length > 1 ? [unique.find(a => a.provider === 'github') ?? unique[0]] : unique;
    }

    // --- Legacy ---

    async getLegacyQuota(): Promise<{ success: boolean; authExpired?: boolean; data?: JsonObject } & Partial<QuotaResponse>> {
        const usage = await this.codexHandler.fetchCodexUsage();
        if (!usage) { return { success: false }; }
        const quota = this.codexHandler.parseCodexUsageToQuota(usage);
        return { success: true, ...quota };
    }
}
