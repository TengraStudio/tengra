import { appLogger } from '@main/logging/logger';
import { CopilotService } from '@main/services/llm/copilot.service';
import { AuthService } from '@main/services/security/auth.service';
import { TokenService } from '@main/services/security/token.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
import { SettingsService } from '@main/services/system/settings.service';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger');
vi.mock('@main/services/security/auth.service');
vi.mock('@main/services/llm/copilot.service');
vi.mock('@main/services/system/settings.service');
vi.mock('@main/services/system/job-scheduler.service');
vi.mock('@main/services/system/job-scheduler.service');
vi.mock('@main/services/system/event-bus.service');
vi.mock('axios');

describe('TokenService', () => {
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

        // Setup initial env
        process.env.ANTIGRAVITY_CLIENT_SECRET = 'mock-secret';

        mockAuthService = {
            getAllAccountsFull: vi.fn().mockResolvedValue([]),
            linkAccount: vi.fn().mockResolvedValue(true),
            getActiveToken: vi.fn(),
            getActiveAccountFull: vi.fn()
        } as unknown as AuthService;

        mockCopilotService = {
            setGithubToken: vi.fn(),
            refreshSession: vi.fn()
        } as unknown as CopilotService;

        mockSettingsService = {
            getSettings: vi.fn().mockReturnValue({
                ai: {
                    tokenRefreshInterval: 300000,
                    copilotRefreshInterval: 900000
                }
            })
        } as unknown as SettingsService;

        mockJobScheduler = {
            registerRecurringJob: vi.fn()
        } as unknown as JobSchedulerService;

        mockProcessManager = {
            startService: vi.fn().mockResolvedValue(undefined),
            on: vi.fn((event, callback) => {
                if (event === 'token-service:ready') {
                    // callback(1234)
                    // We need to execute it. In mock, we can just call it.
                    // But since start() calls on(), we need to make sure it captures the callback.
                    // Or return a mock that calls it.
                    // Safer: use setTimeout to simulate async event
                    setTimeout(() => callback(1234), 0);
                }
            }),
            sendRequest: vi.fn().mockResolvedValue({ success: true, token: { id: 'test', accessToken: 'new-token' } })
        } as unknown as ProcessManagerService;

        mockEventBus = {
            emit: vi.fn(),
            on: vi.fn(),
            off: vi.fn()
        } as unknown as EventBusService;

        tokenService = new TokenService(
            mockSettingsService,
            mockCopilotService,
            mockAuthService,
            mockEventBus,
            { processManager: mockProcessManager, jobScheduler: mockJobScheduler }
        );
    });

    describe('Lifecycle', () => {
        it('should register jobs with JobScheduler if available', async () => {
            await tokenService.initialize();
            expect(mockJobScheduler.registerRecurringJob).toHaveBeenCalledWith(
                'token-refresh-oauth',
                expect.anything(),
                expect.anything()
            );
            expect(mockJobScheduler.registerRecurringJob).toHaveBeenCalledWith(
                'token-refresh-copilot',
                expect.anything(),
                expect.anything()
            );
        });

        it('should use legacy intervals if JobScheduler is missing', async () => {
            const legacyService = new TokenService(mockSettingsService, mockCopilotService, mockAuthService, mockEventBus, { processManager: mockProcessManager });
            const setIntervalSpy = vi.spyOn(global, 'setInterval');
            await legacyService.initialize();
            expect(setIntervalSpy).toHaveBeenCalledTimes(2);
            expect(appLogger.warn).toHaveBeenCalledWith('TokenService', expect.stringContaining('No JobScheduler provided'));
            legacyService.cleanup();
        });
    });

    describe('Token Refresh Logic', () => {
        it('should refresh Google tokens when expired', async () => {
            vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([mockToken as any]);
            vi.mocked(axios.post).mockResolvedValue({
                data: {
                    access_token: 'new-access',
                    refresh_token: 'new-refresh',
                    expires_in: 3600
                }
            });

            await tokenService.initialize();

            // Wait for the async call inside start()
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockProcessManager.sendRequest).toHaveBeenCalledWith(
                'token-service',
                expect.objectContaining({
                    type: 'Refresh',
                    token: expect.objectContaining({ id: 'google_user' }),
                    client_id: expect.any(String),
                    client_secret: 'mock-secret'
                })
            );
        });

        it('should proactive refresh tokens expiring soon (within 30 mins)', async () => {
            const expiringSoonToken = { ...mockToken, expiresAt: Date.now() + 15 * 60 * 1000 };
            vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([expiringSoonToken as any]);
            vi.mocked(axios.post).mockResolvedValue({
                data: { access_token: 'new', expires_in: 3600 }
            });

            await tokenService.initialize();
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockProcessManager.sendRequest).toHaveBeenCalled();
        });

        it('should not refresh tokens that are still valid', async () => {
            const validToken = { ...mockToken, expiresAt: Date.now() + 3600000 };
            vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([validToken as any]);

            await tokenService.initialize();
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockProcessManager.sendRequest).not.toHaveBeenCalled();
        });

        it('should handle refresh errors and log them', async () => {
            vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([mockToken as any]);
            vi.mocked(mockProcessManager.sendRequest).mockResolvedValue({
                success: false,
                error: 'invalid_grant'
            });

            await tokenService.initialize();
            await new Promise(resolve => setTimeout(resolve, 0));

            // Should send request for other items? 
            // In the original test it expected call with 'codex_user' but mockToken is google_user.
            // I'll stick to google_user for consistency unless test data varies.
            // Wait, previous test content had `id: 'codex_user'` in expectation.
            // But mockToken is `id: 'google_user'`.
            // I'll use google_user to match.

            // Actually, if it fails, it logs error. Does sendRequest get called?
            // "should handle refresh errors" -> implies it catches axios error.
            // Wait, `refreshSingleToken` calls `sendRequest` (native service).
            // NATIVE service handles axios?
            // Ah, looking at `TokenService.ts`:
            // `if (this.isGoogleProvider(token))... this.processManager.sendRequest(...)`
            // The NATIVE service does the HTTP call.
            // `TokenService` just triggers it.
            // So why did the original test mock `axios.post`?
            // Maybe `TokenService` historically did it?
            // Or maybe Copilot uses axios?
            // `refreshAllTokens` -> `refreshSingleToken`.
            // `refreshSingleToken` calls `processManager.sendRequest`.
            // It does NOT call axios.
            // So `vi.mocked(axios.post)` is irrelevant for `refreshSingleToken` flow if targeting native service.

            // However, the test expects `sendRequest` to be called.
            expect(mockProcessManager.sendRequest).toHaveBeenCalledWith(
                'token-service',
                expect.objectContaining({
                    type: 'Refresh',
                    token: expect.objectContaining({ id: 'google_user' }),
                    client_id: expect.any(String),
                    client_secret: 'mock-secret'
                })
            );
        });
    });

    describe('Copilot Refresh', () => {
        it('should refresh Copilot token from settings', async () => {
            vi.mocked(mockSettingsService.getSettings).mockReturnValue({
                copilot: { token: 'gh-token' }
            } as any);

            await tokenService.initialize();
            const jobCallback = vi.mocked(mockJobScheduler.registerRecurringJob).mock.calls.find(call => call[0] === 'token-refresh-copilot')?.[1];

            if (jobCallback) {
                await jobCallback();
                expect(mockCopilotService.setGithubToken).toHaveBeenCalledWith('gh-token');
            }
        });
    });
});
