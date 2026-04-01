import { DatabaseService } from '@main/services/data/database.service';
import { AuthService } from '@main/services/security/auth.service';
import { TokenService } from '@main/services/security/token.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { en } from '../../../../renderer/i18n/en';
import { tr } from '../../../../renderer/i18n/tr';

vi.mock('@main/logging/logger');
vi.mock('@main/services/security/auth.service');
vi.mock('@main/services/system/job-scheduler.service');
vi.mock('@main/services/system/event-bus.service');
vi.mock('axios');

let tokenService: TokenService;
let mockAuthService: AuthService;
let mockDatabaseService: DatabaseService;
let mockJobScheduler: JobSchedulerService;
let mockEventBus: EventBusService;

const mockToken = {
    id: 'google_user',
    provider: 'google',
    accessToken: 'old-access',
    refreshToken: 'valid-refresh',
    expiresAt: Date.now() - 1000,
    updatedAt: Date.now() - 1000
};

beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTIGRAVITY_CLIENT_SECRET = 'mock-secret';

    mockAuthService = {
        getAllAccountsFull: vi.fn().mockResolvedValue([]),
        linkAccount: vi.fn().mockResolvedValue(true),
        getActiveToken: vi.fn(),
        getActiveAccountFull: vi.fn(),
        getAccountsByProviderFull: vi.fn().mockResolvedValue([]),
        updateToken: vi.fn().mockResolvedValue(undefined),
        decryptToken: vi.fn((value?: string) => {
            if (!value) {
                return undefined;
            }
            return value;
        }),
        reloadLinkedAccountsCache: vi.fn().mockResolvedValue(undefined),
    } as never as AuthService;

    mockDatabaseService = {
        getLinkedAccounts: vi.fn().mockResolvedValue([])
    } as never as DatabaseService;

    mockJobScheduler = { registerRecurringJob: vi.fn() } as never as JobSchedulerService;

    mockEventBus = {
        emit: vi.fn(),
        on: vi.fn().mockReturnValue(() => { }), // Return unsubscribe function
        off: vi.fn()
    } as never as EventBusService;

    tokenService = new TokenService(
        mockDatabaseService,
        mockAuthService,
        mockEventBus,
        {
            jobScheduler: mockJobScheduler
        }
    );
});

describe('TokenService - Lifecycle', () => {
    it('should register only proxy sync job with JobScheduler if available', async () => {
        await tokenService.initialize();
        expect(mockJobScheduler.registerRecurringJob).toHaveBeenCalledTimes(1);
        expect(mockJobScheduler.registerRecurringJob).toHaveBeenCalledWith(
            'token-refresh-sync',
            expect.any(Function),
            expect.any(Function),
            expect.objectContaining({
                persistState: false,
                runOnStart: false,
            })
        );
    });

    it('should use legacy intervals if JobScheduler is missing', async () => {
        const legacyService = new TokenService(
            mockDatabaseService,
            mockAuthService,
            mockEventBus,
            {
                jobScheduler: undefined as never
            }
        );
        const setIntervalSpy = vi.spyOn(global, 'setInterval');
        await legacyService.initialize();
        expect(setIntervalSpy).toHaveBeenCalledTimes(1);
        void legacyService.cleanup();
    });
});

describe('TokenService - Refresh Logic', () => {
    it('should reject empty provider names', async () => {
        await expect(tokenService.ensureFreshToken('   ')).rejects.toThrow('provider is required');
        expect(mockDatabaseService.getLinkedAccounts).not.toHaveBeenCalled();
    });


    it('should not refresh when provider has no accounts', async () => {
        vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([] as never);

        await tokenService.ensureFreshToken('google');

        expect(mockAuthService.updateToken).not.toHaveBeenCalled();
    });

    it('should sync Google tokens from proxy-backed state when changed', async () => {
        vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([mockToken as never]);
        vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue([
            {
                ...mockToken,
                accessToken: 'new-access',
                refreshToken: 'new-refresh',
                expiresAt: Date.now() + 3600000,
            }
        ] as never);
        await tokenService.initialize();

        const jobCallback = vi.mocked(mockJobScheduler.registerRecurringJob).mock.calls.find(call => call[0] === 'token-refresh-sync')?.[1];
        if (jobCallback) {
            await jobCallback();
        } else {
            throw new Error('jobCallback not found');
        }

        expect(mockAuthService.updateToken).toHaveBeenCalledWith(
            'google_user',
            expect.objectContaining({
                accessToken: 'new-access',
                refreshToken: 'new-refresh',
            })
        );
        expect(mockEventBus.emit).toHaveBeenCalledWith(
            'token:refreshed',
            expect.objectContaining({ provider: 'google', accountId: 'google_user' })
        );
    });

    it('should skip valid tokens', async () => {
        const validToken = { ...mockToken, expiresAt: Date.now() + 3600000 };
        vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([validToken as never]);
        vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue([validToken as never]);
        await tokenService.initialize();
        expect(mockAuthService.updateToken).not.toHaveBeenCalled();
    });

    it('should refresh only accounts that need refresh as integration regression', async () => {
        vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([
            { ...mockToken, id: 'needs-refresh' },
            { ...mockToken, id: 'still-valid', expiresAt: Date.now() + 60 * 60 * 1000 },
        ] as never);
        vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue([
            { ...mockToken, id: 'needs-refresh', accessToken: 'new-access' },
            { ...mockToken, id: 'still-valid', expiresAt: Date.now() + 60 * 60 * 1000 },
        ] as never);

        await tokenService.ensureFreshToken('google');

        expect(mockAuthService.updateToken).toHaveBeenCalledTimes(1);
        expect(mockAuthService.updateToken).toHaveBeenCalledWith(
            'needs-refresh',
            expect.objectContaining({ accessToken: 'new-access' })
        );
    });

    it('should expose degraded health metrics after a proxy sync failure', async () => {
        vi.mocked(mockDatabaseService.getLinkedAccounts).mockRejectedValue(new Error('db offline'));

        await expect(tokenService.ensureFreshToken('google')).rejects.toThrow('db offline');

        expect(tokenService.getHealthMetrics()).toMatchObject({
            refreshAttempts: 1,
            refreshFailures: 1,
            status: 'degraded',
            uiState: 'failure',
        });
    });

    it('should expose budgets and i18n-backed health message keys', () => {
        const emptyMetrics = tokenService.getHealthMetrics();
        expect(emptyMetrics.uiState).toBe('empty');
        expect(emptyMetrics.performanceBudget.executeMs).toBeDefined();
        expect(en.serviceHealth.token.empty).toBe(emptyMetrics.messageKey);
        expect(tr.serviceHealth.token.empty).toBeTruthy();
    });

    it('should bootstrap native accounts from proxy-backed database state on initialize', async () => {
        const codexToken = {
            id: 'codex_user',
            provider: 'codex',
            accessToken: 'codex-access',
            refreshToken: 'codex-refresh',
            expiresAt: Date.now() + 60000
        };
        vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([codexToken as never]);
        vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue([codexToken as never]);

        await tokenService.initialize();

        expect(mockDatabaseService.getLinkedAccounts).toHaveBeenCalledWith('codex');
    });

    it('should sync refreshed tokens back from proxy-backed database state', async () => {
        const codexToken = {
            id: 'codex_user',
            provider: 'codex',
            accessToken: 'old-access',
            refreshToken: 'old-refresh',
            expiresAt: 100
        };
        vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([codexToken as never]);
        vi.mocked(mockDatabaseService.getLinkedAccounts).mockResolvedValue([
            {
                ...codexToken,
                accessToken: 'new-access',
                refreshToken: 'new-refresh',
                expiresAt: 200
            }
        ] as never);

        await tokenService.initialize();

        const syncJobCallback = vi.mocked(mockJobScheduler.registerRecurringJob).mock.calls.find(call => call[0] === 'token-refresh-sync')?.[1];
        if (!syncJobCallback) {
            throw new Error('syncJobCallback not found');
        }

        await syncJobCallback();

        expect(mockAuthService.updateToken).toHaveBeenCalledWith('codex_user', {
            accessToken: 'new-access',
            refreshToken: 'new-refresh',
            sessionToken: undefined,
            expiresAt: 200
        });
    });

});
