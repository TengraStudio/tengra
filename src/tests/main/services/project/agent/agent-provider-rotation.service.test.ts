
import { AgentProviderRotationService } from '@main/services/project/agent/agent-provider-rotation.service';
import { AuthService } from '@main/services/security/auth.service';
import { KeyRotationService } from '@main/services/security/key-rotation.service';
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
    });
});
