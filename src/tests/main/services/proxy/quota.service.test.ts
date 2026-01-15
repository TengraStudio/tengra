import * as fs from 'fs';

import { QuotaService } from '@main/services/proxy/quota.service';
import { AuthService } from '@main/services/security/auth.service';
import { SettingsService } from '@main/services/system/settings.service';
import axios from 'axios';
import { beforeEach,describe, expect, it, vi } from 'vitest';

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

        quotaService = new QuotaService(mockSettingsService, mockAuthService);
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
                provider: 'antigravity',
                updatedAt: Date.now()
            });

            vi.mocked(axios.post).mockResolvedValue({
                status: 200,
                data: {
                    models: {
                        'gpt-4': {
                            displayName: 'GPT-4',
                            quotaInfo: {
                                totalQuota: 100,
                                remainingQuota: 50
                            }
                        }
                    }
                }
            });

            const result = await quotaService.getQuota(8080, 'key');

            expect(result).not.toBeNull();
            expect(result?.models).toHaveLength(1);
            expect(result?.models[0].id).toBe('gpt-4');
        });

        it('should handle API errors gracefully', async () => {
            vi.mocked(mockAuthService.getAuthToken).mockResolvedValue({ accessToken: 'mock-token' } as any);
            vi.mocked(axios.post).mockRejectedValue(new Error('Network Error'));

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
