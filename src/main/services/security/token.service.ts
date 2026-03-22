import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { LinkedAccount } from '@main/services/data/database.service';
import { CopilotService } from '@main/services/llm/copilot.service';
import { AuthService } from '@main/services/security/auth.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
import { SettingsService } from '@main/services/system/settings.service';
import { SystemEventKey } from '@shared/types/events';
import { getErrorMessage } from '@shared/utils/error.util';

export class TokenService extends BaseService {
    private static readonly REFRESH_THRESHOLD_MS = 30 * 60 * 1000; // 30 mins
    private static readonly PROACTIVE_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 mins
    private static readonly PERFORMANCE_BUDGET = { fastMs: 30, executeMs: 260 };

    public static readonly ERROR_CODES = {
        REFRESH_TEMP_FAILURE: 'token:refresh:temp_failure',
        REFRESH_PERMANENT_FAILURE: 'token:refresh:permanent_failure',
        REFRESH_RETRY_FAILED: 'token:refresh:retry_failed'
    } as const;

    private static readonly UI_MESSAGE_KEYS = {
        ready: 'serviceHealth.token.ready',
        empty: 'serviceHealth.token.empty',
        failure: 'serviceHealth.token.failure',
    } as const;

    private telemetry = {
        refreshAttempts: 0,
        refreshFailures: 0,
        lastRefreshAt: 0,
        lastRefreshSuccessAt: 0,
        lastError: null as string | null
    };

    private intervals: NodeJS.Timeout[] = [];
    private unsubscribers: Array<() => void> = [];

    constructor(
        _settingsService: SettingsService,
        private copilotService: CopilotService,
        private authService: AuthService,
        private eventBus: EventBusService,
        private options: {
            processManager: ProcessManagerService;
            jobScheduler: JobSchedulerService;
        }
    ) {
        super('TokenService');
    }

    async initialize(): Promise<void> {
        this.logInfo('TokenService initializing...');

        try {
            await this.options.processManager.startService({
                name: 'token-service',
                executable: 'tengra-token-service',
                persistent: true
            });
        } catch (error) {
            appLogger.error('TokenService', `Failed to start token-service: ${getErrorMessage(error)}`);
        }

        await this.registerExistingAccountsForMonitoring();
        this.subscribeToAccountEvents();

        if (this.options.jobScheduler) {
            this.options.jobScheduler.registerRecurringJob(
                'token-refresh-oauth',
                async () => {
                    await this.refreshAllTokens();
                },
                () => this.getOAuthRefreshInterval()
            );

            this.options.jobScheduler.registerRecurringJob(
                'token-refresh-copilot',
                async () => { void this.copilotService.ensureCopilotToken(); },
                () => this.getCopilotRefreshInterval()
            );

            this.options.jobScheduler.registerRecurringJob(
                'token-refresh-sync',
                async () => {
                    await this.syncTokensFromService();
                },
                () => 30000,
                {
                    persistState: false,
                    runOnStart: false,
                }
            );
        } else {
            // Legacy/test fallback
            const oauthInterval = setInterval(() => void this.refreshAllTokens(), this.getOAuthRefreshInterval());
            const copilotInterval = setInterval(() => { void this.copilotService.ensureCopilotToken(); }, this.getCopilotRefreshInterval());
            const syncInterval = setInterval(() => void this.syncTokensFromService(), 30000);
            this.intervals.push(oauthInterval, copilotInterval, syncInterval);
        }
    }

    async cleanup(): Promise<void> {
        this.logInfo('TokenService cleaning up...');
        for (const interval of this.intervals) {
            clearInterval(interval);
        }
        this.intervals = [];
        for (const unsubscribe of this.unsubscribers) {
            unsubscribe();
        }
        this.unsubscribers = [];
    }

    async refreshSingleToken(account: LinkedAccount, force: boolean = false): Promise<void> {
        this.telemetry.refreshAttempts += 1;
        this.telemetry.lastRefreshAt = Date.now();

        try {
            if (this.isNativeProvider(account)) {
                await this.refreshNativeToken(account, force);
            } else if (this.isGithubProvider(account)) {
                await this.refreshGithubToken(account);
            }

            this.telemetry.lastRefreshSuccessAt = Date.now();
            this.telemetry.lastError = null;
        } catch (error) {
            const errorMsg = getErrorMessage(error);
            this.telemetry.refreshFailures += 1;
            this.telemetry.lastError = errorMsg;
            this.trackTelemetry('token:error', account.provider, account.id, errorMsg);
            appLogger.error('TokenService', `Failed to refresh token for ${account.provider} after retries: ${errorMsg}`);

            this.eventBus.emit('token:error', {
                provider: account.provider,
                error: errorMsg,
            });
            throw error;
        }
    }

    async ensureFreshToken(provider: string, force: boolean = false): Promise<void> {
        const normalizedProvider = provider.trim();
        if (normalizedProvider.length === 0) {
            throw new Error('provider is required');
        }

        const accounts = await this.authService.getAccountsByProviderFull(normalizedProvider);
        if (accounts.length === 0) {
            return;
        }

        for (const account of accounts) {
            const now = Date.now();
            const isExpiring = account.expiresAt && (account.expiresAt - now) < TokenService.REFRESH_THRESHOLD_MS;
            const isCritical = account.expiresAt && (account.expiresAt - now) < TokenService.PROACTIVE_REFRESH_BUFFER_MS;

            if (!account.accessToken || isExpiring || isCritical || force) {
                appLogger.info('TokenService', `Refreshing token for ${normalizedProvider}:${account.id}`);
                await this.refreshSingleToken(account, force);
            }
        }
    }

    getHealthMetrics() {
        const uiState = this.telemetry.refreshFailures > 0
            ? 'failure'
            : this.telemetry.refreshAttempts === 0
                ? 'empty'
                : 'ready';
        return {
            status: (this.telemetry.refreshFailures > 0 ? 'degraded' : 'healthy') as 'healthy' | 'degraded',
            uiState: uiState as 'ready' | 'empty' | 'failure',
            messageKey: TokenService.UI_MESSAGE_KEYS[uiState as keyof typeof TokenService.UI_MESSAGE_KEYS],
            performanceBudget: TokenService.PERFORMANCE_BUDGET,
            refreshAttempts: this.telemetry.refreshAttempts,
            refreshFailures: this.telemetry.refreshFailures,
            lastRefreshAt: this.telemetry.lastRefreshAt,
            lastRefreshSuccessAt: this.telemetry.lastRefreshSuccessAt,
            lastError: this.telemetry.lastError,
        };
    }

    private trackTelemetry(name: SystemEventKey, provider: string, _accountId: string, error?: string): void {
        if (name === 'token:error') {
            this.eventBus.emit('token:error', {
                provider,
                error: error ?? 'Unknown error'
            });
        }
    }

    private isNativeProvider(account: LinkedAccount): boolean {
        return this.isGoogleProvider(account) || this.isCodexProvider(account) || this.isClaudeProvider(account) || this.isCopilotProvider(account);
    }

    private isGoogleProvider(account: LinkedAccount): boolean {
        const provider = (account.provider || account.id).toLowerCase();
        return provider.startsWith('google') || provider.startsWith('antigravity');
    }

    private isCodexProvider(account: LinkedAccount): boolean {
        const provider = (account.provider || account.id).toLowerCase();
        return provider.startsWith('codex') || provider.startsWith('openai');
    }

    private isClaudeProvider(account: LinkedAccount): boolean {
        const provider = (account.provider || account.id).toLowerCase();
        return provider.startsWith('claude') || provider.startsWith('anthropic');
    }

    private isGithubProvider(account: LinkedAccount): boolean {
        return account.provider.toLowerCase() === 'github';
    }

    private isCopilotProvider(account: LinkedAccount): boolean {
        return account.provider.toLowerCase() === 'copilot';
    }

    private getClientId(account: LinkedAccount): string | undefined {
        if (this.isGoogleProvider(account)) {
            return '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
        }
        if (this.isCodexProvider(account)) {
            return 'app_EMoamEEZ73f0CkXaXp7hrann';
        }
        if (this.isClaudeProvider(account)) {
            return '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
        }
        if (this.isCopilotProvider(account)) {
            return '01ab8ac9400c4e429b23';
        }
        return undefined;
    }

    private getClientSecret(account: LinkedAccount): string | undefined {
        if (this.isGoogleProvider(account)) {
            return process.env.ANTIGRAVITY_CLIENT_SECRET;
        }
        if (this.isClaudeProvider(account)) {
            return process.env.ANTHROPIC_CLIENT_SECRET;
        }
        return undefined;
    }

    private async refreshNativeToken(account: LinkedAccount, _force: boolean): Promise<void> {
        const clientId = this.getClientId(account);
        const clientSecret = this.getClientSecret(account);
        if (!clientId) {
            return;
        }

        const nativeToken = {
            id: account.id,
            provider: account.provider,
            access_token: account.accessToken,
            refresh_token: account.refreshToken,
            session_token: account.sessionToken,
            expires_at: account.expiresAt,
            scope: account.scope,
            email: account.email
        };

        let response: {
            success: boolean;
            token?: {
                access_token?: string;
                refresh_token?: string;
                session_token?: string;
                expires_at?: number;
            };
            error?: string;
        };
        try {
            response = await this.options.processManager.sendRequest<{
                success: boolean;
                token?: {
                    access_token?: string;
                    refresh_token?: string;
                    session_token?: string;
                    expires_at?: number;
                };
                error?: string;
            }>('token-service', {
                type: 'Refresh',
                token: nativeToken,
                client_id: clientId,
                client_secret: clientSecret
            });
        } catch (error) {
            const message = getErrorMessage(error);
            if (message.includes('Service token-service port not discovered')) {
                appLogger.warn(
                    'TokenService',
                    `Skipping native token refresh for ${account.provider}:${account.id} because token-service is unavailable`
                );
            }
            throw error;
        }

        if (!response.success) {
            throw new Error(response.error ?? 'Unknown error refreshing token');
        }

        if (response.token) {
            await this.authService.updateToken(account.id, {
                accessToken: response.token.access_token,
                refreshToken: response.token.refresh_token,
                sessionToken: response.token.session_token,
                expiresAt: response.token.expires_at
            });
            this.eventBus.emit('token:refreshed', { provider: account.provider, accountId: account.id });
        }
    }

    private async refreshGithubToken(account: LinkedAccount): Promise<void> {
        if (!account.refreshToken) {
            return;
        }
        try {
            const clientId = account.provider === 'copilot' ? '01ab8ac9400c4e429b23' : 'Ov23liBw1MLMHGdYxtUV';
            const response = await fetch('https://github.com/login/oauth/access_token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    client_id: clientId,
                    grant_type: 'refresh_token',
                    refresh_token: this.authService.decryptToken(account.refreshToken)
                })
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }
            const data = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number };

            if (data.access_token) {
                await this.authService.updateToken(account.id, {
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token,
                    expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined
                });
                if (account.provider === 'copilot') {
                    this.copilotService.setGithubToken(data.access_token);
                }
                this.eventBus.emit('token:refreshed', { provider: account.provider, accountId: account.id });
            }
        } catch (error) {
            const errorMsg = getErrorMessage(error);
            this.eventBus.emit('token:error', { provider: account.provider, error: errorMsg });
            throw error;
        }
    }

    private async refreshAllTokens(): Promise<void> {
        const accounts = await this.authService.getAllAccountsFull();
        for (const account of accounts) {
            if (this.isNativeProvider(account)) {
                try {
                    await this.refreshSingleToken(account);
                } catch (error) {
                    appLogger.warn(
                        'TokenService',
                        `Background refresh skipped for ${account.provider}:${account.id}: ${getErrorMessage(error)}`
                    );
                }
            }
        }
    }

    private getOAuthRefreshInterval(): number {
        return 300000; // 5 mins default
    }

    private getCopilotRefreshInterval(): number {
        return 900000; // 15 mins default
    }

    private async syncTokensFromService(): Promise<void> {
        interface SyncedTokenState {
            token: {
                id: string;
                provider: string;
                access_token?: string;
                refresh_token?: string;
                session_token?: string;
                expires_at?: number;
            };
        }

        let monitoredTokens: Record<string, SyncedTokenState>;
        try {
            monitoredTokens = await this.options.processManager.sendGetRequest<Record<string, SyncedTokenState>>(
                'token-service',
                '/sync'
            );
        } catch (error) {
            appLogger.debug('TokenService', `Token sync skipped: ${getErrorMessage(error)}`);
            return;
        }

        const accounts = await this.authService.getAllAccountsFull();
        const accountsById = new Map(accounts.map(account => [account.id, account]));

        for (const [accountId, monitored] of Object.entries(monitoredTokens)) {
            const account = accountsById.get(accountId);
            if (!account || !this.shouldSyncMonitoredToken(account, monitored.token)) {
                continue;
            }

            await this.authService.updateToken(account.id, {
                accessToken: monitored.token.access_token,
                refreshToken: monitored.token.refresh_token,
                sessionToken: monitored.token.session_token,
                expiresAt: monitored.token.expires_at
            });
            this.eventBus.emit('token:refreshed', { provider: account.provider, accountId: account.id });
        }
    }

    private subscribeToAccountEvents(): void {
        this.unsubscribers.push(
            this.eventBus.on('account:linked', payload => void this.monitorAccountById(payload.accountId)),
            this.eventBus.on('account:updated', payload => void this.monitorAccountById(payload.accountId)),
            this.eventBus.on('account:unlinked', payload => void this.unregisterAccount(payload.accountId))
        );
    }

    private async registerExistingAccountsForMonitoring(): Promise<void> {
        const accounts = await this.authService.getAllAccountsFull();
        for (const account of accounts) {
            await this.monitorAccount(account);
        }
    }

    private async monitorAccountById(accountId: string): Promise<void> {
        const accounts = await this.authService.getAllAccountsFull();
        const account = accounts.find(item => item.id === accountId);
        if (!account) {
            return;
        }
        await this.monitorAccount(account);
    }

    private async monitorAccount(account: LinkedAccount): Promise<void> {
        const clientId = this.getClientId(account);
        if (!clientId || !this.supportsMonitoring(account)) {
            return;
        }

        const token = {
            id: account.id,
            provider: account.provider,
            access_token: account.accessToken,
            refresh_token: account.refreshToken,
            session_token: account.sessionToken,
            expires_at: account.expiresAt,
            scope: account.scope,
            email: account.email
        };

        try {
            await this.options.processManager.sendRequest(
                'token-service',
                {
                    token,
                    client_id: clientId,
                    client_secret: this.getClientSecret(account)
                },
                10000,
                '/monitor'
            );
        } catch (error) {
            appLogger.warn(
                'TokenService',
                `Failed to register ${account.provider}:${account.id} for token monitoring: ${getErrorMessage(error)}`
            );
        }
    }

    private async unregisterAccount(accountId: string): Promise<void> {
        try {
            await this.options.processManager.sendRequest(
                'token-service',
                { id: accountId },
                10000,
                '/unregister'
            );
        } catch (error) {
            appLogger.warn(
                'TokenService',
                `Failed to unregister ${accountId} from token monitoring: ${getErrorMessage(error)}`
            );
        }
    }

    private supportsMonitoring(account: LinkedAccount): boolean {
        return this.isNativeProvider(account) || this.isGithubProvider(account);
    }

    private shouldSyncMonitoredToken(
        account: LinkedAccount,
        token: {
            access_token?: string;
            refresh_token?: string;
            session_token?: string;
            expires_at?: number;
        }
    ): boolean {
        return (
            token.access_token !== account.accessToken ||
            token.refresh_token !== account.refreshToken ||
            token.session_token !== account.sessionToken ||
            token.expires_at !== account.expiresAt
        );
    }
}
