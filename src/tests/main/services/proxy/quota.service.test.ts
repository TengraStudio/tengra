import * as fs from 'fs';

import { DataService } from '@main/services/data/data.service';
import { QuotaService } from '@main/services/proxy/quota.service';
import { AuthService } from '@main/services/security/auth.service';
import { TokenService } from '@main/services/security/token.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
import { SettingsService } from '@main/services/system/settings.service';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequest, mockCookiesGet } = vi.hoisted(() => {
    return {
        mockRequest: vi.fn(),
        mockCookiesGet: vi.fn().mockResolvedValue([])
    };
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
    let mockTokenService: TokenService;
    let mockDataService: DataService;

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
            getAllAccountsFull: vi.fn().mockResolvedValue([]),
            getActiveToken: vi.fn(),
            getActiveAccountFull: vi.fn()
        } as unknown as AuthService;

        mockProcessManager = {
            startService: vi.fn().mockResolvedValue(undefined),
            sendRequest: vi.fn()
        } as unknown as ProcessManagerService;

        mockTokenService = {
            ensureFreshToken: vi.fn()
        } as unknown as TokenService;

        mockDataService = {
            // Mock methods if needed
        } as unknown as DataService;

        quotaService = new QuotaService(mockSettingsService, mockAuthService, mockProcessManager, mockTokenService, mockDataService);
    });

    describe('getQuota', () => {
        it('should return null if no token is available', async () => {
            vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([]);
            const result = await quotaService.getQuota(8080, 'key');
            expect(result).toBeNull();
        });

        // Add 401 test
        it('should trigger token refresh on 401', async () => {
            const mockAccount = {
                accessToken: 'bad-token',
                id: 'antigravity',
                provider: 'antigravity',
                updatedAt: Date.now()
            };
            vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([mockAccount as any]);
            vi.mocked(axios.isAxiosError).mockReturnValue(true);
            vi.mocked(axios.post).mockRejectedValue({
                isAxiosError: true,
                response: { status: 401 }
            });

            const result = await quotaService.getAntigravityAvailableModels();

            expect(mockTokenService.ensureFreshToken).toHaveBeenCalledWith('antigravity', true);
            expect(result).toEqual([]);
        });
    });

    describe('getCopilotQuota', () => {
        it('should return default structure if no token', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const result = await quotaService.getCopilotQuota();
            expect(result.accounts).toEqual([]);
        });
    });
});
