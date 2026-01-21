

import { DataService } from '@main/services/data/data.service';
import { DeviceCodeResponse, ProxyService } from '@main/services/proxy/proxy.service';
import { ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
import { QuotaService } from '@main/services/proxy/quota.service';
import { SecurityService } from '@main/services/security/security.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { SettingsService } from '@main/services/system/settings.service';
import { net } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock electron
vi.mock('electron', () => ({
    app: { getPath: vi.fn().mockReturnValue('/mock/user/path') },
    net: { request: vi.fn() }
}));

vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fs')>();
    return {
        ...actual,
        promises: {
            ...actual.promises,
            access: vi.fn().mockResolvedValue(undefined),
            readdir: vi.fn().mockResolvedValue([]),
            writeFile: vi.fn().mockResolvedValue(undefined),
            unlink: vi.fn().mockResolvedValue(undefined),
            readFile: vi.fn().mockResolvedValue('{"mock": "data"}'),
        }
    };
});

// Mock logger
vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}));

describe('ProxyService', () => {
    let proxyService: ProxyService;
    let mockSettingsService: SettingsService;
    let mockDataService: DataService;
    let mockSecurityService: SecurityService;
    let mockProcessManager: ProxyProcessManager;
    let mockQuotaService: QuotaService;
    let mockEventBus: EventBusService;

    beforeEach(() => {
        vi.clearAllMocks();

        mockSettingsService = {
            getSettings: vi.fn().mockReturnValue({ proxy: { key: 'mock-key' } }),
            saveSettings: vi.fn().mockResolvedValue(undefined),
        } as unknown as SettingsService;

        mockDataService = { getPath: vi.fn().mockReturnValue('/mock/auth/path') } as unknown as DataService;
        mockSecurityService = {
            encryptSync: vi.fn().mockReturnValue('encrypted'),
            decryptSync: vi.fn().mockReturnValue('{"decrypted": true}'),
        } as unknown as SecurityService;

        mockProcessManager = {
            start: vi.fn().mockResolvedValue({ running: true }),
            stop: vi.fn().mockResolvedValue(undefined),
            getStatus: vi.fn().mockReturnValue({ running: false }),
            generateConfig: vi.fn().mockResolvedValue(undefined),
        } as unknown as ProxyProcessManager;

        mockQuotaService = {
            getQuota: vi.fn(),
            getAntigravityAvailableModels: vi.fn().mockResolvedValue([]),
            getCopilotQuota: vi.fn().mockResolvedValue({ accounts: [] }),
            getClaudeQuota: vi.fn().mockResolvedValue({ accounts: [] }),
            fetchCodexUsage: vi.fn().mockResolvedValue({}),
            extractCodexUsageFromWham: vi.fn().mockReturnValue({}),
        } as unknown as QuotaService;

        mockEventBus = {
            on: vi.fn(),
            off: vi.fn(),
            emit: vi.fn(),
        } as unknown as EventBusService;

        const mockAuthService = { saveToken: vi.fn(), getToken: vi.fn(), getAuthToken: vi.fn() } as any

        proxyService = new ProxyService({
            settingsService: mockSettingsService,
            dataService: mockDataService,
            securityService: mockSecurityService,
            processManager: mockProcessManager,
            quotaService: mockQuotaService,
            authService: mockAuthService,
            eventBus: mockEventBus
        });
    });

    it('should initialize correctly', () => {
        expect(proxyService).toBeDefined();
    });

    describe('GitHub Auth', () => {
        it('should initiate GitHub auth', async () => {
            const mockReq = {
                on: vi.fn().mockReturnThis(),
                setHeader: vi.fn().mockReturnThis(),
                write: vi.fn().mockReturnThis(),
                end: vi.fn().mockReturnThis()
            } as any;

            vi.mocked(net.request).mockReturnValue(mockReq);

            mockReq.on.mockImplementation((event: string, cb: any) => {
                if (event === 'response') {
                    cb({
                        on: vi.fn().mockImplementation((ev: string, evCb: any) => {
                            if (ev === 'data') { evCb(Buffer.from(JSON.stringify({ device_code: '123' }))); }
                            if (ev === 'end') { evCb(); }
                        })
                    });
                }
                return mockReq;
            });

            const res = (await proxyService.initiateGitHubAuth('profile')) as DeviceCodeResponse;
            expect(res.device_code).toBe('123');
        });
    });

    describe('getModels', () => {
        it('should fetch and merge models', async () => {
            const mockReq = {
                on: vi.fn().mockReturnThis(),
                setHeader: vi.fn().mockReturnThis(),
                write: vi.fn().mockReturnThis(),
                end: vi.fn().mockReturnThis()
            } as any;

            vi.mocked(net.request).mockReturnValue(mockReq);

            mockReq.on.mockImplementation((event: string, cb: any) => {
                if (event === 'response') {
                    cb({
                        statusCode: 200,
                        on: vi.fn().mockImplementation((ev: string, evCb: any) => {
                            if (ev === 'data') { evCb(Buffer.from(JSON.stringify({ data: [{ id: 'gpt-4', provider: 'openai' }] }))); }
                            if (ev === 'end') { evCb(); }
                        })
                    });
                }
                return mockReq;
            });

            const result = await proxyService.getModels();
            expect(result.data).toHaveLength(1);
            expect(result.data[0].id).toBe('gpt-4');
        });
    });
});
