import { appLogger } from '@main/logging/logger';
import { LinkedAccount } from '@main/services/data/database.service';
import { AuthService } from '@main/services/security/auth.service';
import { TokenService } from '@main/services/security/token.service';
import { SettingsService } from '@main/services/system/settings.service';
import { JsonObject, JsonValue } from '@shared/types/common';
import { ClaudeQuota, CodexUsage, CopilotQuota, ModelQuotaItem, QuotaInfo, QuotaResponse } from '@shared/types/quota';
import { getErrorMessage, TengraError } from '@shared/utils/error.util';

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

/**
 * Standardized error codes for QuotaService
 */
export enum QuotaErrorCode {
    INVALID_SESSION_KEY = 'QUOTA_INVALID_SESSION_KEY',
    INVALID_INPUT = 'QUOTA_INVALID_INPUT',
    FETCH_FAILED = 'QUOTA_FETCH_FAILED',
    AUTH_EXPIRED = 'QUOTA_AUTH_EXPIRED',
    NO_ACCOUNTS = 'QUOTA_NO_ACCOUNTS',
    PARSE_FAILED = 'QUOTA_PARSE_FAILED',
    QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
    REFRESH_FAILED = 'QUOTA_REFRESH_FAILED',
    ACCOUNT_LOCKED = 'QUOTA_ACCOUNT_LOCKED'
}

/**
 * Typed error class for all QuotaService failures.
 */
export class QuotaError extends TengraError {
    public readonly quotaCode: QuotaErrorCode;

    constructor(message: string, code: QuotaErrorCode, context?: JsonObject) {
        super(message, code, context);
        this.quotaCode = code;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * Telemetry events emitted by QuotaService for health dashboards
 */
export enum QuotaTelemetryEvent {
    QUOTA_FETCHED = 'quota_fetched',
    QUOTA_FETCH_FAILED = 'quota_fetch_failed',
    CODEX_USAGE_FETCHED = 'quota_codex_usage_fetched',
    CLAUDE_QUOTA_FETCHED = 'quota_claude_quota_fetched',
    COPILOT_QUOTA_FETCHED = 'quota_copilot_quota_fetched',
    AUTH_EXPIRED = 'quota_auth_expired'
}

/**
 * Performance regression budgets (in ms) for QuotaService operations
 */
export const QUOTA_PERFORMANCE_BUDGETS = {
    FETCH_QUOTA_MS: 10000,
    FETCH_CODEX_USAGE_MS: 10000,
    FETCH_CLAUDE_QUOTA_MS: 10000,
    FETCH_COPILOT_QUOTA_MS: 10000,
    SAVE_SESSION_MS: 1000
} as const;

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
            executable: 'tengra-quota-service',
            persistent: true
        }).catch(err => {
            appLogger.error('QuotaService', `Failed to start quota service: ${getErrorMessage(err)}`);
        });
    }

    /** Logs a warning if elapsed time exceeds the performance budget. */
    private warnIfOverBudget(method: string, startMs: number, budgetMs: number): void {
        const elapsed = performance.now() - startMs;
        if (elapsed > budgetMs) {
            appLogger.warn('QuotaService', `${method} exceeded budget: ${elapsed.toFixed(1)}ms > ${budgetMs}ms`);
        }
    }

    // --- Validation helpers ---

    /** Validates that a port number is a safe positive integer. */
    private static isValidPort(port: unknown): port is number {
        return typeof port === 'number' && Number.isFinite(port) && Number.isInteger(port) && port > 0 && port <= 65535;
    }

    /** Validates that a value is a non-empty string after trimming. */
    private static isNonEmptyString(value: unknown): value is string {
        return typeof value === 'string' && value.trim().length > 0;
    }

    /** Validates a LinkedAccount has the minimum required fields. */
    private static isValidAccount(account: unknown): account is LinkedAccount {
        if (!account || typeof account !== 'object') { return false; }
        const acc = account as Record<string, unknown>;
        return QuotaService.isNonEmptyString(acc.id) && QuotaService.isNonEmptyString(acc.provider);
    }

    // --- Core API ---

    /**
     * Fetches quota information for all antigravity/google accounts.
     * @param proxyPort - Proxy port number (1–65535).
     * @param proxyKey - Non-empty proxy authentication key.
     */
    async getQuota(proxyPort: number, proxyKey: string): Promise<{ accounts: Array<QuotaResponse & { accountId?: string; email?: string }> } | null> {
        if (!QuotaService.isValidPort(proxyPort)) {
            appLogger.warn('QuotaService', `getQuota: invalid proxyPort "${String(proxyPort)}"`);
            return null;
        }
        if (!QuotaService.isNonEmptyString(proxyKey)) {
            appLogger.warn('QuotaService', 'getQuota: proxyKey must be a non-empty string');
            return null;
        }

        const start = performance.now();
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
            appLogger.info('QuotaService', `${QuotaTelemetryEvent.QUOTA_FETCHED}: ${results.length} accounts`);
            this.warnIfOverBudget('getQuota', start, QUOTA_PERFORMANCE_BUDGETS.FETCH_QUOTA_MS);
            return { accounts: results };
        } catch (e) {
            const msg = getErrorMessage(e);
            appLogger.error('QuotaService', `${QuotaTelemetryEvent.QUOTA_FETCH_FAILED}: ${msg}`);
            this.warnIfOverBudget('getQuota', start, QUOTA_PERFORMANCE_BUDGETS.FETCH_QUOTA_MS);
            throw new QuotaError(`Failed to get quota: ${msg}`, QuotaErrorCode.FETCH_FAILED, { originalError: msg });
        }
    }

    // --- Antigravity ---

    async fetchAntigravityQuota(): Promise<QuotaResponse | null> {
        const accounts = await this.authService.getAllAccountsFull();
        const account = accounts.find(a => a.provider.startsWith('antigravity') || a.provider.startsWith('google'));
        if (!account) { return null; }
        return this.fetchAntigravityQuotaForToken(account);
    }

    /**
     * Fetches upstream model data for a specific antigravity account.
     * @param account - A valid LinkedAccount with id and provider.
     */
    public async fetchAntigravityUpstreamForToken(account: LinkedAccount): Promise<unknown> {
        if (!QuotaService.isValidAccount(account)) {
            appLogger.warn('QuotaService', 'fetchAntigravityUpstreamForToken: invalid account');
            return null;
        }
        return this.antigravityHandler.fetchAntigravityUpstreamForToken(account);
    }

    private async fetchAntigravityQuotaForToken(account: LinkedAccount): Promise<QuotaResponse | null> {
        try {
            const data = await this.antigravityHandler.fetchAntigravityUpstreamForToken(account);
            if (data) {
                return this.antigravityHandler.parseQuotaResponse(data as { models?: Record<string, { displayName?: string; quotaInfo?: QuotaInfo }> });
            }
        } catch (error) {
            if (error instanceof QuotaError && error.quotaCode === QuotaErrorCode.AUTH_EXPIRED) {
                appLogger.info('QuotaService', QuotaTelemetryEvent.AUTH_EXPIRED);
                return { success: false, authExpired: true, status: 'Expired', next_reset: '-', models: [] };
            }
            if (error instanceof Error && error.message === 'AUTH_EXPIRED') {
                appLogger.info('QuotaService', QuotaTelemetryEvent.AUTH_EXPIRED);
                return { success: false, authExpired: true, status: 'Expired', next_reset: '-', models: [] };
            }
            if (error instanceof QuotaError && error.quotaCode === QuotaErrorCode.QUOTA_EXCEEDED) {
                return { success: false, authExpired: false, status: 'Exceeded', next_reset: '-', models: [] };
            }
            if (error instanceof QuotaError && error.quotaCode === QuotaErrorCode.ACCOUNT_LOCKED) {
                appLogger.warn('QuotaService', `Account locked: ${getErrorMessage(error)}`);
                return { success: false, authExpired: false, status: 'Locked', next_reset: '-', models: [] };
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
        const start = performance.now();
        try {
            const codexData = await this.codexHandler.fetchCodexUsage();
            if (codexData) {
                appLogger.info('QuotaService', QuotaTelemetryEvent.CODEX_USAGE_FETCHED);
                this.warnIfOverBudget('fetchCodexQuota', start, QUOTA_PERFORMANCE_BUDGETS.FETCH_CODEX_USAGE_MS);
                return this.codexHandler.parseCodexUsageToQuota(codexData);
            }
        } catch (err) {
            appLogger.debug('QuotaService', `Failed to fetch Codex quota: ${getErrorMessage(err)}`);
        }
        this.warnIfOverBudget('fetchCodexQuota', start, QUOTA_PERFORMANCE_BUDGETS.FETCH_CODEX_USAGE_MS);
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

    /**
     * Extracts structured CodexUsage from raw WHAM API data.
     * @param data - Non-null JSON value from the WHAM API.
     */
    extractCodexUsageFromWham(data: JsonValue): CodexUsage | null {
        if (data === null || data === undefined || typeof data !== 'object') {
            return null;
        }
        return this.codexHandler.extractCodexUsageFromWham(data);
    }

    // --- Claude/Anthropic ---

    async getClaudeQuota(): Promise<{ accounts: Array<ClaudeQuota> }> {
        const start = performance.now();
        const accounts = await this.authService.getAllAccountsFull();
        const claudeAccounts = accounts.filter(a => a.provider === 'claude' || a.provider === 'anthropic');

        const results: ClaudeQuota[] = [];
        for (const account of claudeAccounts) {
            const quota = await this.fetchClaudeQuotaForToken(account);
            if (quota) {
                results.push({ ...quota, accountId: account.id, email: account.email });
            }
        }
        appLogger.info('QuotaService', `${QuotaTelemetryEvent.CLAUDE_QUOTA_FETCHED}: ${results.length} accounts`);
        this.warnIfOverBudget('getClaudeQuota', start, QUOTA_PERFORMANCE_BUDGETS.FETCH_CLAUDE_QUOTA_MS);
        return { accounts: results };
    }

    private async fetchClaudeQuotaForToken(account: LinkedAccount): Promise<ClaudeQuota | null> {
        return this.claudeHandler.fetchClaudeQuotaForToken(account);
    }

    /**
     * Validates and saves a Claude session key.
     * @param sessionKey - Non-empty session key string.
     * @param accountId - Optional account identifier (must be a non-empty string if provided).
     */
    public async saveClaudeSession(sessionKey: string, accountId?: string): Promise<{ success: boolean; error?: string; code?: QuotaErrorCode }> {
        if (!sessionKey || typeof sessionKey !== 'string' || sessionKey.trim().length === 0) {
            return { success: false, error: 'Session key must be a non-empty string', code: QuotaErrorCode.INVALID_SESSION_KEY };
        }
        if (accountId !== undefined && !QuotaService.isNonEmptyString(accountId)) {
            return { success: false, error: 'accountId must be a non-empty string when provided', code: QuotaErrorCode.INVALID_INPUT };
        }
        const start = performance.now();
        const result = await this.claudeHandler.saveClaudeSession(sessionKey, accountId);
        this.warnIfOverBudget('saveClaudeSession', start, QUOTA_PERFORMANCE_BUDGETS.SAVE_SESSION_MS);
        return result;
    }

    // --- Copilot ---

    async getCopilotQuota(): Promise<{ accounts: Array<CopilotQuota & { accountId?: string; email?: string }> }> {
        const start = performance.now();
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
        appLogger.debug('QuotaService', `${QuotaTelemetryEvent.COPILOT_QUOTA_FETCHED}: ${results.length} accounts`);
        this.warnIfOverBudget('getCopilotQuota', start, QUOTA_PERFORMANCE_BUDGETS.FETCH_COPILOT_QUOTA_MS);
        return { accounts: results };
    }

    private async fetchCopilotQuotaForToken(account: LinkedAccount): Promise<CopilotQuota | null> {
        return this.copilotHandler.fetchCopilotQuotaForToken(account);
    }

    private deduplicateCopilotAccounts(accounts: LinkedAccount[]): LinkedAccount[] {
        if (!Array.isArray(accounts)) { return []; }
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

