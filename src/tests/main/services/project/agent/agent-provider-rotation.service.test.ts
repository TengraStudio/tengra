
import { AgentProviderRotationService } from '@main/services/project/agent/agent-provider-rotation.service';
import { AuthService } from '@main/services/security/auth.service';
import { KeyRotationService } from '@main/services/security/key-rotation.service';
import { SettingsService } from '@main/services/system/settings.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@main/services/security/auth.service');
vi.mock('@main/services/security/key-rotation.service');

describe('AgentProviderRotationService', () => {
    let service: AgentProviderRotationService;
    let mockAuthService: AuthService;
    let mockKeyRotationService: KeyRotationService;

    beforeEach(() => {
        vi.clearAllMocks();

        mockAuthService = new AuthService({} as any, {} as any, {} as any, {} as any);
        mockKeyRotationService = new KeyRotationService({} as any);

        // Setup default mocks
        mockAuthService.getAllAccounts = vi.fn().mockResolvedValue([
            { provider: 'openai', isActive: true },
            { provider: 'anthropic', isActive: true },
            { provider: 'google', isActive: true }
        ]);
        // Mock to return active account for any provider by default
        mockAuthService.getAccountsByProvider = vi.fn().mockImplementation(async (provider: string) => {
            return [{ provider, isActive: true, email: `user@${provider}.com` }];
        });
        mockKeyRotationService.rotateKey = vi.fn().mockReturnValue(true);

        service = new AgentProviderRotationService(
            mockKeyRotationService,
            mockAuthService
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('initialize', () => {
        it('should load configured providers from auth service', async () => {
            mockAuthService.getAllAccounts = vi.fn().mockResolvedValue([
                { provider: 'openai', isActive: true },
                { provider: 'anthropic', isActive: true },
                { provider: 'google', isActive: false }
            ]);

            await service.initialize();

            // We can check private fallbackChain if exported or via logging, 
            // but simpler to check if dependencies were called
            expect(mockAuthService.getAllAccounts).toHaveBeenCalled();
        });
    });

    describe('getInitialProvider', () => {
        it('should return user selected provider', async () => {
            const result = await service.getInitialProvider('google');
            expect(result.provider).toBe('google');
        });

        it('should return first cloud provider if no user selection', async () => {
            const result = await service.getInitialProvider();
            // Default first provider is usually openai in fallbackChain
            expect(result.provider).toBe('openai');
        });
    });

    describe('getNextProvider', () => {
        it('should rotate account if multiple active accounts exist', async () => {
            const currentProvider = { provider: 'openai', model: 'gpt-4', accountIndex: 0, status: 'active' };

            mockAuthService.getAccountsByProvider = vi.fn().mockResolvedValue([
                { provider: 'openai', isActive: true },
                { provider: 'openai', isActive: true }
            ]);

            const result = await service.getNextProvider(currentProvider as any);

            expect(result).toBeDefined();
            expect(result?.provider).toBe('openai');
            expect(result?.accountIndex).toBe(1);
        });

        it('should rotate to next cloud provider if accounts exhausted', async () => {
            const currentProvider = { provider: 'openai', model: 'gpt-4', accountIndex: 0, status: 'active' };

            // Single account, so rotation fails for same provider
            mockAuthService.getAccountsByProvider = vi.fn().mockResolvedValue([
                { provider: 'openai', isActive: true }
            ]);

            // Also exhaust key rotation
            mockKeyRotationService.rotateKey = vi.fn().mockReturnValue(false);

            const result = await service.getNextProvider(currentProvider as any);

            expect(result).toBeDefined();
            // Next in chain after openai is anthropic
            expect(result?.provider).toBe('anthropic');
            expect(result?.accountIndex).toBe(0);
        });

        it('should skip cloud providers with exhausted quota', async () => {
            const currentProvider = { provider: 'openai', model: 'gpt-4', accountIndex: 0, status: 'active' };

            mockAuthService.getAccountsByProvider = vi.fn().mockResolvedValue([
                { provider: 'openai', isActive: true }
            ]);
            mockKeyRotationService.rotateKey = vi.fn().mockReturnValue(false);
            service.setQuotaProvider(async (provider: string) => {
                if (provider === 'anthropic') {
                    return 0;
                }
                return undefined;
            });

            const result = await service.getNextProvider(currentProvider as any);

            expect(result).toBeDefined();
            expect(result?.provider).toBe('google');
            expect(result?.accountIndex).toBe(0);
        });
    });

    describe('rotation settings persistence', () => {
        it('should persist fallback chain per project', async () => {
            const settingsService = new SettingsService();
            const saveSettings = vi
                .spyOn(settingsService, 'saveSettings')
                .mockResolvedValue(settingsService.getSettings());
            vi.spyOn(settingsService, 'getSettings').mockReturnValue({
                ...settingsService.getSettings(),
                ai: {}
            });

            service = new AgentProviderRotationService(
                mockKeyRotationService,
                mockAuthService,
                settingsService
            );

            await service.updateFallbackChain(
                { cloud: ['anthropic', 'openai'], local: ['ollama'] },
                'project-alpha',
                'balanced'
            );

            expect(saveSettings).toHaveBeenCalledTimes(1);
            expect(service.getFallbackChain('project-alpha').cloud).toEqual(['anthropic', 'openai']);
        });
    });
});
