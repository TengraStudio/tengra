/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { BaseService } from '@main/services/base.service';
import { DatabaseService, LinkedAccount } from '@main/services/data/database.service';
import { AuthService } from '@main/services/security/auth.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { SERVICE_INTERVALS } from '@shared/constants';

export class TokenService extends BaseService {
    static readonly serviceName = 'tokenService';
    static readonly dependencies = ['databaseService', 'authService', 'eventBus', 'options'] as const;
    private static readonly PERFORMANCE_BUDGET = { fastMs: 30, executeMs: 260 };

    private static readonly UI_MESSAGE_KEYS = {
        ready: 'serviceHealth.token.ready',
        empty: 'serviceHealth.token.empty',
        failure: 'serviceHealth.token.failure',
    } as const;

    private usageStats = {
        refreshAttempts: 0,
        refreshFailures: 0,
        lastRefreshAt: 0,
        lastRefreshSuccessAt: 0,
        lastError: null as string | null
    };

    private intervals: NodeJS.Timeout[] = [];
    private unsubscribers: Array<() => void> = [];
    private syncInFlight = new Map<string, Promise<void>>();
    private recentSyncByProvider = new Map<string, number>();
    private static readonly MIN_EVENT_SYNC_GAP_MS = 1500;

    constructor(
        private databaseService: DatabaseService,
        private authService: AuthService,
        private eventBus: EventBusService,
        private options: {
            jobScheduler: JobSchedulerService;
            getTokenRefreshIntervals?: () => {
                tokenRefreshInterval?: number;
                copilotRefreshInterval?: number;
            };
        }
    ) {
        super('TokenService');
    }

    async initialize(): Promise<void> {
        this.logInfo('TokenService initializing...');

        await this.bootstrapProviderSync();
        this.subscribeToAccountEvents();

        if (this.options.jobScheduler) {
            this.options.jobScheduler.registerRecurringJob(
                'token-refresh-sync',
                async () => {
                    await this.requestSyncFromProxy(undefined, 'scheduler:all');
                },
                () => this.getGeneralSyncInterval(),
                {
                    persistState: false,
                    runOnStart: false,
                }
            );
            this.options.jobScheduler.registerRecurringJob(
                'token-refresh-sync:copilot',
                async () => {
                    await this.requestSyncFromProxy('copilot', 'scheduler:copilot');
                },
                () => this.getCopilotSyncInterval(),
                {
                    persistState: false,
                    runOnStart: false,
                }
            );
        } else {
            const syncInterval = setInterval(
                () => void this.requestSyncFromProxy(undefined, 'interval:all'),
                this.getGeneralSyncInterval()
            );
            const copilotSyncInterval = setInterval(
                () => void this.requestSyncFromProxy('copilot', 'interval:copilot'),
                this.getCopilotSyncInterval()
            );
            this.intervals.push(syncInterval);
            this.intervals.push(copilotSyncInterval);
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
        const normalizedProvider = this.normalizeProvider(provider);
        if (normalizedProvider.length === 0) {
            throw new Error('provider is required');
        }
        await this.requestSyncFromProxy(normalizedProvider, force ? 'ensure:force' : 'ensure');
        if (force) {
            this.logDebug(`Forced token sync requested for ${normalizedProvider} from tengra-proxy state`);
        }
    }

    getHealthMetrics() {
        const uiState = this.usageStats.refreshFailures > 0
            ? 'failure'
            : this.usageStats.refreshAttempts === 0
                ? 'empty'
                : 'ready';
        return {
            status: (this.usageStats.refreshFailures > 0 ? 'degraded' : 'healthy') as 'healthy' | 'degraded',
            uiState: uiState as 'ready' | 'empty' | 'failure',
            messageKey: TokenService.UI_MESSAGE_KEYS[uiState as keyof typeof TokenService.UI_MESSAGE_KEYS],
            performanceBudget: TokenService.PERFORMANCE_BUDGET,
            refreshAttempts: this.usageStats.refreshAttempts,
            refreshFailures: this.usageStats.refreshFailures,
            lastRefreshAt: this.usageStats.lastRefreshAt,
            lastRefreshSuccessAt: this.usageStats.lastRefreshSuccessAt,
            lastError: this.usageStats.lastError,
        };
    }

    private async syncTokensFromProxy(provider?: string): Promise<void> {
        this.usageStats.refreshAttempts += 1;
        this.usageStats.lastRefreshAt = Date.now();
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

            this.usageStats.lastRefreshSuccessAt = Date.now();
            this.usageStats.lastError = null;
            if (changed) {
                await this.authService.reloadLinkedAccountsCache();
            }
        } catch (error) {
            this.usageStats.refreshFailures += 1;
            this.usageStats.lastError = error instanceof Error ? error.message : String(error);
            throw error;
        }
    }

    private subscribeToAccountEvents(): void {
        this.unsubscribers.push(
            this.eventBus.on('account:linked', payload => void this.requestSyncFromProxy(payload.provider, 'event:linked')),
            this.eventBus.on('account:updated', payload => void this.requestSyncFromProxy(payload.provider, 'event:updated')),
            this.eventBus.on('account:unlinked', payload => void this.unregisterAccount(payload.accountId, payload.provider))
        );
    }

    private async bootstrapProviderSync(): Promise<void> {
        const accounts = await this.authService.getAllAccountsFull();
        const providers = Array.from(new Set(accounts.map(account => this.normalizeProvider(account.provider))));
        for (const provider of providers) {
            await this.requestSyncFromProxy(provider, 'bootstrap');
        }
    }

    private async unregisterAccount(_accountId: string, provider?: string): Promise<void> {
        await this.requestSyncFromProxy(provider, 'event:unlinked');
        await this.authService.reloadLinkedAccountsCache();
    }

    private async requestSyncFromProxy(provider?: string, reason?: string): Promise<void> {
        const normalizedProvider = provider ? this.normalizeProvider(provider) : undefined;
        const key = normalizedProvider ?? '*';
        const now = Date.now();
        const isEventTriggered = reason?.startsWith('event:') ?? false;
        const lastSyncedAt = this.recentSyncByProvider.get(key) ?? 0;
        if (isEventTriggered && (now - lastSyncedAt) < TokenService.MIN_EVENT_SYNC_GAP_MS) {
            return;
        }

        const existing = this.syncInFlight.get(key);
        if (existing) {
            return existing;
        }

        const task = this.syncTokensFromProxy(normalizedProvider)
            .finally(() => {
                this.recentSyncByProvider.set(key, Date.now());
                this.syncInFlight.delete(key);
            });
        this.syncInFlight.set(key, task);
        return task;
    }

    private getGeneralSyncInterval(): number {
        const configured = this.options.getTokenRefreshIntervals?.().tokenRefreshInterval;
        return this.normalizeInterval(configured, SERVICE_INTERVALS.TOKEN_REFRESH);
    }

    private getCopilotSyncInterval(): number {
        const configured = this.options.getTokenRefreshIntervals?.().copilotRefreshInterval;
        return this.normalizeInterval(configured, SERVICE_INTERVALS.COPILOT_REFRESH);
    }

    private normalizeInterval(value: number | undefined, fallback: number): number {
        if (!Number.isFinite(value) || typeof value !== 'number') {
            return fallback;
        }
        return Math.max(10000, Math.floor(value));
    }

    private normalizeProvider(provider: string): string {
        return provider.trim().toLowerCase();
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

