import * as fs from 'fs';

import { LinkedAccount } from '@main/services/data/database.service';
import { QuotaService } from '@main/services/proxy/quota.service';
import { AuthService } from '@main/services/security/auth.service';
import { TokenService } from '@main/services/security/token.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
import { SettingsService } from '@main/services/system/settings.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('fs');
vi.mock('axios');
vi.mock('@main/logging/logger');

describe('QuotaService', () => {
    let quotaService: QuotaService;
    let mockSettingsService: SettingsService;
    let mockAuthService: AuthService;
    let mockProcessManager: ProcessManagerService;
    let mockTokenService: TokenService;

    beforeEach(() => {
        vi.clearAllMocks();

        mockSettingsService = {
            getSettings: vi.fn().mockReturnValue({
                proxy: {
                    codex: { organizationId: 'org-123' }
                }
            })
        } as unknown as SettingsService;

        mockAuthService = {
            getAllAccountsFull: vi.fn().mockResolvedValue([]),
            getAccountsByProviderFull: vi.fn().mockResolvedValue([]),
            updateToken: vi.fn().mockResolvedValue(undefined)
        } as unknown as AuthService;

        mockProcessManager = {
            startService: vi.fn().mockResolvedValue(undefined)
        } as unknown as ProcessManagerService;

        mockTokenService = {
            ensureFreshToken: vi.fn()
        } as unknown as TokenService;

        quotaService = new QuotaService(
            mockSettingsService as any,
            mockAuthService as any,
            mockProcessManager as any,
            mockTokenService as any
        );
    });

    describe('getQuota', () => {
        it('should return null if no accounts found', async () => {
            const result = await quotaService.getQuota(8080, 'key');
            expect(result).toBeNull();
        });

        it('should return results for antigravity accounts', async () => {
            const mockAccount: LinkedAccount = {
                id: 'acc-1',
                provider: 'antigravity-1',
                email: 'test@example.com',
                accessToken: 'token-123'
            } as LinkedAccount;

            vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([mockAccount]);

            // Mock handler behavior
            (quotaService as any).antigravityHandler.fetchAntigravityUpstreamForToken = vi.fn().mockResolvedValue({
                models: {
                    'gpt-4': { displayName: 'GPT-4', quotaInfo: { remainingQuota: 10, totalQuota: 100, remainingFraction: 0.1 } }
                }
            });

            const result = await quotaService.getQuota(8080, 'key');
            expect(result).not.toBeNull();
            expect(result?.accounts).toHaveLength(1);
            expect(result?.accounts[0].email).toBe('test@example.com');
        });
    });

    describe('getCopilotQuota', () => {
        it('should return default structure if no token', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);
            const result = await quotaService.getCopilotQuota();
            expect(result.accounts).toHaveLength(0);
        });
    });
});
