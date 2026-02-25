import { CopilotService } from '@main/services/llm/copilot.service';
import { AuthService } from '@main/services/security/auth.service';
import { TokenService } from '@main/services/security/token.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
import { SettingsService } from '@main/services/system/settings.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { en } from '../../../../renderer/i18n/en';
import { tr } from '../../../../renderer/i18n/tr';

vi.mock('@main/logging/logger');
vi.mock('@main/services/security/auth.service');
vi.mock('@main/services/llm/copilot.service');
vi.mock('@main/services/system/settings.service');
vi.mock('@main/services/system/job-scheduler.service');
vi.mock('@main/services/system/event-bus.service');
vi.mock('axios');

let tokenService: TokenService;
let mockAuthService: AuthService;
let mockCopilotService: CopilotService;
let mockSettingsService: SettingsService;
let mockJobScheduler: JobSchedulerService;
let mockProcessManager: ProcessManagerService;
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
        updateToken: vi.fn().mockResolvedValue(undefined)
    } as unknown as AuthService;

    mockCopilotService = { setGithubToken: vi.fn(), ensureCopilotToken: vi.fn() } as unknown as CopilotService;

    mockSettingsService = {
        getSettings: vi.fn().mockReturnValue({
            ai: { tokenRefreshInterval: 300000, copilotRefreshInterval: 900000 }
        })
    } as unknown as SettingsService;

    mockJobScheduler = { registerRecurringJob: vi.fn() } as unknown as JobSchedulerService;

    mockProcessManager = {
        startService: vi.fn().mockResolvedValue(undefined),
        on: vi.fn((event, callback) => {
            if (event === 'token-service:ready') { setTimeout(() => callback(1234), 0); }
        }),
        sendRequest: vi.fn().mockResolvedValue({ success: true, token: { id: 'test', accessToken: 'new-token' } })
    } as unknown as ProcessManagerService;

    mockEventBus = {
        emit: vi.fn(),
        on: vi.fn().mockReturnValue(() => { }), // Return unsubscribe function
        off: vi.fn()
    } as unknown as EventBusService;

    tokenService = new TokenService(
        mockSettingsService,
        mockCopilotService,
        mockAuthService,
        mockEventBus,
        {
            processManager: mockProcessManager,
            jobScheduler: mockJobScheduler
        }
    );
});

describe('TokenService - Lifecycle', () => {
    it('should register jobs with JobScheduler if available', async () => {
        await tokenService.initialize();
        expect(mockJobScheduler.registerRecurringJob).toHaveBeenCalledWith('token-refresh-oauth', expect.any(Function), expect.any(Function));
        expect(mockJobScheduler.registerRecurringJob).toHaveBeenCalledWith('token-refresh-copilot', expect.any(Function), expect.any(Function));
    });

    it('should use legacy intervals if JobScheduler is missing', async () => {
        const legacyService = new TokenService(
            mockSettingsService,
            mockCopilotService,
            mockAuthService,
            mockEventBus,
            {
                processManager: mockProcessManager,
                jobScheduler: undefined as any
            }
        );
        const setIntervalSpy = vi.spyOn(global, 'setInterval');
        await legacyService.initialize();
        // 3 intervals: oauth refresh, copilot refresh, and sync from service
        expect(setIntervalSpy).toHaveBeenCalledTimes(3);
        void legacyService.cleanup();
    });
});

describe('TokenService - Refresh Logic', () => {
    it('should reject empty provider names', async () => {
        await expect(tokenService.ensureFreshToken('   ')).rejects.toThrow('provider is required');
        expect(mockAuthService.getAccountsByProviderFull).not.toHaveBeenCalled();
    });


    it('should not refresh when provider has no accounts', async () => {
        vi.mocked(mockAuthService.getAccountsByProviderFull).mockResolvedValue([] as any);
        const refreshSpy = vi.spyOn(tokenService, 'refreshSingleToken');

        await tokenService.ensureFreshToken('google');

        expect(refreshSpy).not.toHaveBeenCalled();
    });

    it('should refresh Google tokens when expired', async () => {
        vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([mockToken as any]);
        await tokenService.initialize();

        const jobCallback = vi.mocked(mockJobScheduler.registerRecurringJob).mock.calls.find(call => call[0] === 'token-refresh-oauth')?.[1];
        if (jobCallback) {
            await jobCallback();
        } else {
            throw new Error('jobCallback not found');
        }

        expect(mockProcessManager.sendRequest).toHaveBeenCalledWith(
            'token-service',
            expect.objectContaining({ type: 'Refresh', token: expect.objectContaining({ id: 'google_user' }) })
        );
        expect(mockEventBus.emit).toHaveBeenCalledWith(
            'token:refreshed',
            expect.objectContaining({ provider: 'google', accountId: 'google_user' })
        );
    });

    it('should skip valid tokens', async () => {
        const validToken = { ...mockToken, expiresAt: Date.now() + 3600000 };
        vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([validToken as any]);
        await tokenService.initialize();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(mockProcessManager.sendRequest).not.toHaveBeenCalled();
    });

    it('should refresh Copilot token when expired', async () => {
        const copilotToken = { ...mockToken, provider: 'copilot', id: 'copilot_user' };
        vi.mocked(mockAuthService.getActiveAccountFull).mockResolvedValue(copilotToken as any);
        vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([copilotToken as any]);

        await tokenService.initialize();
        const jobCallback = vi.mocked(mockJobScheduler.registerRecurringJob).mock.calls.find(call => call[0] === 'token-refresh-oauth')?.[1];
        const copilotJobCallback = vi.mocked(mockJobScheduler.registerRecurringJob).mock.calls.find(call => call[0] === 'token-refresh-copilot')?.[1];

        if (jobCallback && copilotJobCallback) {
            await copilotJobCallback();
            expect(mockCopilotService.ensureCopilotToken).toHaveBeenCalled();
        } else {
            throw new Error('jobCallback or copilotJobCallback not found');
        }
    });

    it('should refresh only accounts that need refresh as integration regression', async () => {
        const refreshSpy = vi.spyOn(tokenService, 'refreshSingleToken').mockResolvedValue(undefined);
        vi.mocked(mockAuthService.getAccountsByProviderFull).mockResolvedValue([
            { ...mockToken, id: 'needs-refresh' },
            { ...mockToken, id: 'still-valid', expiresAt: Date.now() + 60 * 60 * 1000 },
        ] as never);

        await tokenService.ensureFreshToken('google');

        expect(refreshSpy).toHaveBeenCalledTimes(1);
        expect(refreshSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'needs-refresh' }), false);
    });

    it('should emit standardized error code when refresh retries are exhausted', async () => {
        vi.mocked(mockProcessManager.sendRequest).mockRejectedValue(new Error('network outage'));

        // Actually wait for it since we removed FakeTimers, which can be tricky with retry utility here depending on settings. 
        // TokenService uses retry utility which has delays.
        // We will mock the getSettings to have very fast retry delay for this test
        vi.mocked(mockSettingsService.getSettings).mockReturnValue({
            ai: { tokenRefreshInterval: 300000, copilotRefreshInterval: 900000 }
        } as any);

        const refreshPromise = tokenService.refreshSingleToken(mockToken as any, true);
        await expect(refreshPromise).rejects.toThrow('network outage');

        expect(mockEventBus.emit).toHaveBeenCalledWith(
            'token:error',
            expect.objectContaining({
                provider: 'google',
                error: expect.any(String),
            })
        );
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

});
