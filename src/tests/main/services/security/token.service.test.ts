import { appLogger } from '@main/logging/logger';
import { CopilotService } from '@main/services/llm/copilot.service';
import { AuthService } from '@main/services/security/auth.service';
import { TokenService } from '@main/services/security/token.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { SettingsService } from '@main/services/system/settings.service';
import axios from 'axios';
import { beforeEach,describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger');
vi.mock('@main/services/security/auth.service');
vi.mock('@main/services/llm/copilot.service');
vi.mock('@main/services/system/settings.service');
vi.mock('@main/services/system/job-scheduler.service');
vi.mock('axios');

describe('TokenService', () => {
    let tokenService: TokenService;
    let mockAuthService: AuthService;
    let mockCopilotService: CopilotService;
    let mockSettingsService: SettingsService;
    let mockJobScheduler: JobSchedulerService;

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
            getAllFullTokens: vi.fn().mockResolvedValue([]),
            saveToken: vi.fn().mockResolvedValue(true),
            getToken: vi.fn(),
            getAllTokens: vi.fn(),
            getAuthToken: vi.fn()
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

        tokenService = new TokenService(
            mockSettingsService,
            mockCopilotService,
            mockAuthService,
            mockJobScheduler
        );
    });

    describe('Lifecycle', () => {
        it('should register jobs with JobScheduler if available', () => {
            tokenService.start();
            expect(mockJobScheduler.registerRecurringJob).toHaveBeenCalledWith(
                'token-refresh-oauth',
                expect.any(Function),
                expect.any(Function)
            );
            expect(mockJobScheduler.registerRecurringJob).toHaveBeenCalledWith(
                'token-refresh-copilot',
                expect.any(Function),
                expect.any(Function)
            );
        });

        it('should use legacy intervals if JobScheduler is missing', () => {
            const legacyService = new TokenService(mockSettingsService, mockCopilotService, mockAuthService);
            const setIntervalSpy = vi.spyOn(global, 'setInterval');
            legacyService.start();
            expect(setIntervalSpy).toHaveBeenCalledTimes(2);
            expect(appLogger.warn).toHaveBeenCalledWith('TokenService', expect.stringContaining('No JobScheduler provided'));
            legacyService.stop();
        });
    });

    describe('Token Refresh Logic', () => {
        it('should refresh Google tokens when expired', async () => {
            vi.mocked(mockAuthService.getAllFullTokens).mockResolvedValue([mockToken as any]);
            vi.mocked(axios.post).mockResolvedValue({
                data: {
                    access_token: 'new-access',
                    refresh_token: 'new-refresh',
                    expires_in: 3600
                }
            });

            // Trigger internal refreshAllTokens via a private method access or by mocking the start behavior
            // Since we want to test the logic, we can use a more direct approach if possible, 
            // but TokenService keeps refreshAllTokens private.
            // We'll call start() which triggers it once.
            await tokenService.start();

            // Wait for the async call inside start()
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(axios.post).toHaveBeenCalledWith(
                'https://oauth2.googleapis.com/token',
                expect.stringContaining('refresh_token=valid-refresh'),
                expect.any(Object)
            );
            expect(mockAuthService.saveToken).toHaveBeenCalledWith('google_user', expect.objectContaining({
                accessToken: 'new-access'
            }));
        });

        it('should not refresh tokens that are still valid', async () => {
            const validToken = { ...mockToken, expiresAt: Date.now() + 3600000 };
            vi.mocked(mockAuthService.getAllFullTokens).mockResolvedValue([validToken as any]);

            await tokenService.start();
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(axios.post).not.toHaveBeenCalled();
        });

        it('should handle refresh errors and log them', async () => {
            vi.mocked(mockAuthService.getAllFullTokens).mockResolvedValue([mockToken as any]);
            vi.mocked(axios.post).mockRejectedValue({
                response: {
                    status: 400,
                    data: { error: 'invalid_grant' }
                }
            });

            await tokenService.start();
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(appLogger.warn).toHaveBeenCalledWith('TokenService', expect.stringContaining('User needs to re-authenticate'));
        });

        it('should refresh Codex (OpenAI) tokens', async () => {
            const codexToken = { ...mockToken, id: 'codex_user', provider: 'codex' };
            vi.mocked(mockAuthService.getAllFullTokens).mockResolvedValue([codexToken as any]);
            vi.mocked(axios.post).mockResolvedValue({
                data: {
                    access_token: 'codex-access',
                    expires_in: 3600
                }
            });

            await tokenService.start();
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(axios.post).toHaveBeenCalledWith(
                'https://auth.openai.com/oauth/token',
                expect.stringContaining('grant_type=refresh_token'),
                expect.any(Object)
            );
            expect(mockAuthService.saveToken).toHaveBeenCalledWith('codex_user', expect.objectContaining({
                accessToken: 'codex-access'
            }));
        });
    });

    describe('Copilot Refresh', () => {
        it('should refresh Copilot token from settings', async () => {
            vi.mocked(mockSettingsService.getSettings).mockReturnValue({
                copilot: { token: 'gh-token' }
            } as any);

            // We can't call private refreshCopilotToken directly, but we can verify start() calls it if scheduler isn't used
            // Or better, we can test it through the job registration if we capture the callback
            tokenService.start();
            const jobCallback = vi.mocked(mockJobScheduler.registerRecurringJob).mock.calls.find(call => call[0] === 'token-refresh-copilot')?.[1];

            if (jobCallback) {
                await jobCallback();
                expect(mockCopilotService.setGithubToken).toHaveBeenCalledWith('gh-token');
            }
        });
    });
});
