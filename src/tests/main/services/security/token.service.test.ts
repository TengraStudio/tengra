import { CopilotService } from '@main/services/llm/copilot.service';
import { AuthService } from '@main/services/security/auth.service';
import { TokenService } from '@main/services/security/token.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
import { SettingsService } from '@main/services/system/settings.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
        getActiveAccountFull: vi.fn()
    } as unknown as AuthService;

    mockCopilotService = { setGithubToken: vi.fn(), refreshSession: vi.fn() } as unknown as CopilotService;

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
        mockSettingsService, mockCopilotService, mockAuthService, mockEventBus,
        { processManager: mockProcessManager, jobScheduler: mockJobScheduler }
    );
});

describe('TokenService - Lifecycle', () => {
    it('should register jobs with JobScheduler if available', async () => {
        await tokenService.initialize();
        expect(mockJobScheduler.registerRecurringJob).toHaveBeenCalledWith('token-refresh-oauth', expect.anything(), expect.anything());
        expect(mockJobScheduler.registerRecurringJob).toHaveBeenCalledWith('token-refresh-copilot', expect.anything(), expect.anything());
    });

    it('should use legacy intervals if JobScheduler is missing', async () => {
        const legacyService = new TokenService(mockSettingsService, mockCopilotService, mockAuthService, mockEventBus, { processManager: mockProcessManager });
        const setIntervalSpy = vi.spyOn(global, 'setInterval');
        await legacyService.initialize();
        // 3 intervals: oauth refresh, copilot refresh, and sync from service
        expect(setIntervalSpy).toHaveBeenCalledTimes(3);
        void legacyService.cleanup();
    });
});

describe('TokenService - Refresh Logic', () => {
    it('should refresh Google tokens when expired', async () => {
        vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([mockToken as any]);
        await tokenService.initialize();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockProcessManager.sendRequest).toHaveBeenCalledWith(
            'token-service',
            expect.objectContaining({ type: 'Refresh', token: expect.objectContaining({ id: 'google_user' }) })
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

        await tokenService.initialize();
        const jobCallback = vi.mocked(mockJobScheduler.registerRecurringJob).mock.calls.find(call => call[0] === 'token-refresh-copilot')?.[1];

        if (jobCallback) {
            await jobCallback();
            expect(mockProcessManager.sendRequest).toHaveBeenCalledWith(
                'token-service',
                expect.objectContaining({
                    type: 'Refresh',
                    token: expect.objectContaining({ provider: 'copilot' })
                })
            );
        }
    });

});
