import { BaseService } from '@main/services/base.service';
import { DatabaseService, LinkedAccount } from '@main/services/data/database.service';
import { AuthService } from '@main/services/security/auth.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';

export class TokenService extends BaseService {
    private static readonly PERFORMANCE_BUDGET = { fastMs: 30, executeMs: 260 };

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
        private databaseService: DatabaseService,
        private authService: AuthService,
        private eventBus: EventBusService,
        private options: {
            jobScheduler: JobSchedulerService;
        }
    ) {
        super('TokenService');
    }

    async initialize(): Promise<void> {
        this.logInfo('TokenService initializing...');

        await this.registerExistingAccountsForMonitoring();
        this.subscribeToAccountEvents();

        if (this.options.jobScheduler) {
            this.options.jobScheduler.registerRecurringJob(
                'token-refresh-sync',
                async () => {
                    await this.syncTokensFromProxy();
                },
                () => 30000,
                {
                    persistState: false,
                    runOnStart: false,
                }
            );
        } else {
            const syncInterval = setInterval(() => void this.syncTokensFromProxy(), 30000);
            this.intervals.push(syncInterval);
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

    async ensureFreshToken(provider: string, force: boolean = false): Promise<void> {
        const normalizedProvider = provider.trim();
        if (normalizedProvider.length === 0) {
            throw new Error('provider is required');
        }
        await this.syncTokensFromProxy(normalizedProvider);
        if (force) {
            this.logDebug(`Forced token sync requested for ${normalizedProvider} from tengra-proxy state`);
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

    private async syncTokensFromProxy(provider?: string): Promise<void> {
        this.telemetry.refreshAttempts += 1;
        this.telemetry.lastRefreshAt = Date.now();
        try {
            const dbAccounts = provider
                ? await this.databaseService.getLinkedAccounts(provider)
                : await this.databaseService.getLinkedAccounts();
            const currentAccounts = await this.authService.getAllAccountsFull();
            const currentAccountsById = new Map(currentAccounts.map(account => [account.id, account]));
            let changed = false;

            for (const dbAccount of dbAccounts) {
                const currentAccount = currentAccountsById.get(dbAccount.id);
                if (!currentAccount) {
                    continue;
                }

                const nextAccessToken = this.authService.decryptToken(dbAccount.accessToken ?? '');
                const nextRefreshToken = this.authService.decryptToken(dbAccount.refreshToken ?? '');
                const nextSessionToken = this.authService.decryptToken(dbAccount.sessionToken ?? '');
                const shouldSync = this.shouldSyncMonitoredToken(currentAccount, {
                    access_token: nextAccessToken,
                    refresh_token: nextRefreshToken,
                    session_token: nextSessionToken,
                    expires_at: dbAccount.expiresAt
                });

                if (!shouldSync) {
                    continue;
                }

                await this.authService.updateToken(dbAccount.id, {
                    accessToken: nextAccessToken,
                    refreshToken: nextRefreshToken,
                    sessionToken: nextSessionToken,
                    expiresAt: dbAccount.expiresAt,
                    email: dbAccount.email,
                    displayName: dbAccount.displayName,
                    avatarUrl: dbAccount.avatarUrl,
                    metadata: dbAccount.metadata
                });
                this.eventBus.emit('token:refreshed', { provider: dbAccount.provider, accountId: dbAccount.id });
                changed = true;
            }

            this.telemetry.lastRefreshSuccessAt = Date.now();
            this.telemetry.lastError = null;
            if (changed) {
                await this.authService.reloadLinkedAccountsCache();
            }
        } catch (error) {
            this.telemetry.refreshFailures += 1;
            this.telemetry.lastError = error instanceof Error ? error.message : String(error);
            throw error;
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
        await this.syncTokensFromProxy(account.provider);
    }

    private async unregisterAccount(_accountId: string): Promise<void> {
        await this.authService.reloadLinkedAccountsCache();
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
