import * as fs from 'fs';

import { QuotaService } from '@main/services/proxy/quota.service';
import { AuthService } from '@main/services/security/auth.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
import { SettingsService } from '@main/services/system/settings.service';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequest, mockCookiesGet } = vi.hoisted(() => {
    return {
        mockRequest: vi.fn(),
        mockCookiesGet: vi.fn().mockResolvedValue([])
    }
});

vi.mock('electron', () => {
    return {
        app: { getPath: () => '/tmp' },
        net: {
            request: mockRequest
        },
        session: {
            defaultSession: {
                cookies: {
                    get: mockCookiesGet
                }
            }
        }
    };
});

vi.mock('axios');
vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fs')>();
    return {
        ...actual,
        promises: {
            ...actual.promises,
            readFile: vi.fn(),
            readdir: vi.fn(),
        },
        existsSync: vi.fn()
    };
});

describe('QuotaService', () => {
    let quotaService: QuotaService;
    let mockSettingsService: SettingsService;
    let mockAuthService: AuthService;
    let mockProcessManager: ProcessManagerService;

    beforeEach(() => {
        vi.clearAllMocks();

        mockSettingsService = {
            getSettings: vi.fn().mockReturnValue({
                ai: {
                    antigravity: {
                        baseUrl: 'https://api.antigravity.ai'
                    }
                }
            })
        } as unknown as SettingsService;

        mockAuthService = {
            getToken: vi.fn(),
            getAuthToken: vi.fn()
        } as unknown as AuthService;

        mockProcessManager = {
            startService: vi.fn(),
            sendRequest: vi.fn()
        } as unknown as ProcessManagerService;

        quotaService = new QuotaService(mockSettingsService, mockAuthService, mockProcessManager);
    });

    describe('getQuota', () => {
        it('should return null if no token is available', async () => {
            vi.mocked(mockAuthService.getAuthToken).mockResolvedValue(null);
            const result = await quotaService.getQuota(8080, 'key');
            expect(result).toBeNull();
        });

        it('should return quota data on successful API call', async () => {
            vi.mocked(mockAuthService.getAuthToken).mockResolvedValue({
                accessToken: 'mock-token',
                id: 'antigravity',
                accountId: 'mock-account',
                provider: 'antigravity',
                updatedAt: Date.now()
            });

            vi.mocked(mockProcessManager.sendRequest).mockResolvedValue({
                success: true,
                quota: {
                    total: 100,
                    remaining: 50,
                    reset_at: 'tomorrow'
                }
            });

            const result = await quotaService.getQuota(8080, 'key');

            expect(result).not.toBeNull();
            expect(result?.status).toBe('50%');
        });

        it('should handle API errors gracefully', async () => {
            vi.mocked(mockAuthService.getAuthToken).mockResolvedValue({
                accessToken: 'mock-token',
                id: 'antigravity',
                accountId: 'mock-account',
                provider: 'antigravity',
                updatedAt: Date.now()
            });
            vi.mocked(mockProcessManager.sendRequest).mockResolvedValue({ success: false, error: 'Failed' });

            const result = await quotaService.getQuota(8080, 'key');
            expect(result).toBeNull();
        });
    });

    describe('getCopilotQuota', () => {
        it('should return default structure if no token', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const result = await quotaService.getCopilotQuota();
            expect(result.success).toBe(false);
        });
    });
});
