

import { DataService } from '@main/services/data/data.service';
import {
    DeviceCodeResponse,
    PROXY_PERFORMANCE_BUDGETS,
    ProxyErrorCode,
    ProxyService,
    ProxyTelemetryEvent
} from '@main/services/proxy/proxy.service';
import { ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
import { QuotaService } from '@main/services/proxy/quota.service';
import { AuthService } from '@main/services/security/auth.service';
import { SecurityService } from '@main/services/security/security.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { SettingsService } from '@main/services/system/settings.service';
import { AppErrorCode, ProxyServiceError } from '@shared/utils/error.util';
import { net } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockProxyRequest {
    on: ReturnType<typeof vi.fn>;
    setHeader: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
}

interface MockProxyResponse {
    statusCode?: number;
    on: ReturnType<typeof vi.fn>;
}

type ResponseCallback = (response: MockProxyResponse) => void;
type ResponseEventCallback = (chunk?: Buffer) => void;

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
        } as never as SettingsService;

        mockDataService = { getPath: vi.fn().mockReturnValue('/mock/auth/path') } as never as DataService;
        mockSecurityService = {
            encryptSync: vi.fn().mockReturnValue('encrypted'),
            decryptSync: vi.fn().mockReturnValue('{"decrypted": true}'),
        } as never as SecurityService;

        mockProcessManager = {
            start: vi.fn().mockResolvedValue({ running: true }),
            stop: vi.fn().mockResolvedValue(undefined),
            getStatus: vi.fn().mockReturnValue({ running: false }),
            generateConfig: vi.fn().mockResolvedValue(undefined),
        } as never as ProxyProcessManager;

        mockQuotaService = {
            getQuota: vi.fn(),
            getAntigravityAvailableModels: vi.fn().mockResolvedValue([]),
            getCopilotQuota: vi.fn().mockResolvedValue({ accounts: [] }),
            getClaudeQuota: vi.fn().mockResolvedValue({ accounts: [] }),
            fetchCodexUsage: vi.fn().mockResolvedValue({}),
            extractCodexUsageFromWham: vi.fn().mockReturnValue({}),
        } as never as QuotaService;

        mockEventBus = {
            on: vi.fn(),
            off: vi.fn(),
            emit: vi.fn(),
            emitCustom: vi.fn(),
        } as never as EventBusService;

        const mockAuthService = { saveToken: vi.fn(), getToken: vi.fn(), getAuthToken: vi.fn() } as never as AuthService;

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
            const mockReq: MockProxyRequest = {
                on: vi.fn().mockReturnThis(),
                setHeader: vi.fn().mockReturnThis(),
                write: vi.fn().mockReturnThis(),
                end: vi.fn().mockReturnThis()
            };

            vi.mocked(net.request).mockReturnValue(mockReq as never);

            mockReq.on.mockImplementation((event: string, cb: ResponseCallback) => {
                if (event === 'response') {
                    const response: MockProxyResponse = {
                        on: vi.fn().mockImplementation((ev: string, evCb: ResponseEventCallback) => {
                            if (ev === 'data') { evCb(Buffer.from(JSON.stringify({ device_code: '123' }))); }
                            if (ev === 'end') { evCb(); }
                        })
                    };
                    cb(response);
                }
                return mockReq;
            });

            const res = (await proxyService.initiateGitHubAuth('profile')) as DeviceCodeResponse;
            expect(res.device_code).toBe('123');
        });
    });

    describe('getModels', () => {
        it('should fetch and merge models', async () => {
            const mockReq: MockProxyRequest = {
                on: vi.fn().mockReturnThis(),
                setHeader: vi.fn().mockReturnThis(),
                write: vi.fn().mockReturnThis(),
                end: vi.fn().mockReturnThis()
            };

            vi.mocked(net.request).mockReturnValue(mockReq as never);

            mockReq.on.mockImplementation((event: string, cb: ResponseCallback) => {
                if (event === 'response') {
                    const response: MockProxyResponse = {
                        statusCode: 200,
                        on: vi.fn().mockImplementation((ev: string, evCb: ResponseEventCallback) => {
                            if (ev === 'data') { evCb(Buffer.from(JSON.stringify({ data: [{ id: 'gpt-4', provider: 'openai' }] }))); }
                            if (ev === 'end') { evCb(); }
                        })
                    };
                    cb(response);
                }
                return mockReq;
            });

            const result = await proxyService.getModels();
            expect(result.data).toHaveLength(1);
            expect(result.data[0].id).toBe('gpt-4');
        });
    });
});

describe('ProxyErrorCode enum', () => {
    it('should have exactly 10 error codes', () => {
        const values = Object.values(ProxyErrorCode);
        expect(values).toHaveLength(10);
    });

    it('should contain all expected error codes', () => {
        expect(ProxyErrorCode.NOT_INITIALIZED).toBe('PROXY_NOT_INITIALIZED');
        expect(ProxyErrorCode.START_FAILED).toBe('PROXY_START_FAILED');
        expect(ProxyErrorCode.STOP_FAILED).toBe('PROXY_STOP_FAILED');
        expect(ProxyErrorCode.AUTH_FAILED).toBe('PROXY_AUTH_FAILED');
        expect(ProxyErrorCode.REQUEST_FAILED).toBe('PROXY_REQUEST_FAILED');
        expect(ProxyErrorCode.INVALID_CONFIG).toBe('PROXY_INVALID_CONFIG');
        expect(ProxyErrorCode.CONNECTION_FAILED).toBe('PROXY_CONNECTION_FAILED');
        expect(ProxyErrorCode.TIMEOUT).toBe('PROXY_TIMEOUT');
        expect(ProxyErrorCode.PORT_IN_USE).toBe('PROXY_PORT_IN_USE');
        expect(ProxyErrorCode.BINARY_NOT_FOUND).toBe('PROXY_BINARY_NOT_FOUND');
    });
});

describe('ProxyTelemetryEvent enum', () => {
    it('should have exactly 8 telemetry events', () => {
        const values = Object.values(ProxyTelemetryEvent);
        expect(values).toHaveLength(8);
    });

    it('should contain all expected telemetry events', () => {
        expect(ProxyTelemetryEvent.PROXY_STARTED).toBe('proxy_started');
        expect(ProxyTelemetryEvent.PROXY_STOPPED).toBe('proxy_stopped');
        expect(ProxyTelemetryEvent.REQUEST_SENT).toBe('proxy_request_sent');
        expect(ProxyTelemetryEvent.REQUEST_FAILED).toBe('proxy_request_failed');
        expect(ProxyTelemetryEvent.AUTH_INITIATED).toBe('proxy_auth_initiated');
        expect(ProxyTelemetryEvent.AUTH_COMPLETED).toBe('proxy_auth_completed');
        expect(ProxyTelemetryEvent.AUTH_FAILED).toBe('proxy_auth_failed');
        expect(ProxyTelemetryEvent.HEALTH_CHECK).toBe('proxy_health_check');
    });
});

describe('PROXY_PERFORMANCE_BUDGETS', () => {
    it('should have all budget values as positive numbers', () => {
        const budgetKeys: (keyof typeof PROXY_PERFORMANCE_BUDGETS)[] = [
            'START_MS',
            'STOP_MS',
            'REQUEST_MS',
            'AUTH_MS',
            'HEALTH_CHECK_MS',
            'INITIALIZE_MS',
            'CONFIG_GENERATION_MS',
            'GET_MODELS_MS'
        ];

        for (const key of budgetKeys) {
            const value = PROXY_PERFORMANCE_BUDGETS[key];
            expect(value).toBeTypeOf('number');
            expect(value).toBeGreaterThan(0);
        }
    });

    it('should have exactly 8 budget entries', () => {
        const keys = Object.keys(PROXY_PERFORMANCE_BUDGETS);
        expect(keys).toHaveLength(8);
    });
});

describe('ProxyService input validation', () => {
    let proxyService: ProxyService;
    let mockProcessManager: ProxyProcessManager;

    beforeEach(() => {
        vi.clearAllMocks();

        const mockSettingsService = {
            getSettings: vi.fn().mockReturnValue({ proxy: { key: 'mock-key' } }),
            saveSettings: vi.fn().mockResolvedValue(undefined),
        } as never as SettingsService;

        mockProcessManager = {
            start: vi.fn().mockResolvedValue({ running: true }),
            stop: vi.fn().mockResolvedValue(undefined),
            getStatus: vi.fn().mockReturnValue({ running: false }),
            generateConfig: vi.fn().mockResolvedValue(undefined),
        } as never as ProxyProcessManager;

        const mockAuthService = { saveToken: vi.fn(), getToken: vi.fn(), getAuthToken: vi.fn() } as never as AuthService;

        proxyService = new ProxyService({
            settingsService: mockSettingsService,
            dataService: { getPath: vi.fn().mockReturnValue('/mock') } as never as DataService,
            securityService: {} as never as SecurityService,
            processManager: mockProcessManager,
            quotaService: {} as never as QuotaService,
            authService: mockAuthService,
            eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn(), emitCustom: vi.fn() } as never as EventBusService,
        });
    });

    describe('startEmbeddedProxy validation', () => {
        it('should reject negative port', async () => {
            const result = await proxyService.startEmbeddedProxy({ port: -1 });
            expect(result.running).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.errorCode).toBe(AppErrorCode.PROXY_INVALID_CONFIG);
            expect(mockProcessManager.start).not.toHaveBeenCalled();
        });

        it('should reject port 0', async () => {
            const result = await proxyService.startEmbeddedProxy({ port: 0 });
            expect(result.running).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.errorCode).toBe(AppErrorCode.PROXY_INVALID_CONFIG);
        });

        it('should reject port above 65535', async () => {
            const result = await proxyService.startEmbeddedProxy({ port: 70000 });
            expect(result.running).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.errorCode).toBe(AppErrorCode.PROXY_INVALID_CONFIG);
        });

        it('should reject non-integer port', async () => {
            const result = await proxyService.startEmbeddedProxy({ port: 80.5 });
            expect(result.running).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.errorCode).toBe(AppErrorCode.PROXY_INVALID_CONFIG);
        });

        it('should accept valid port', async () => {
            const result = await proxyService.startEmbeddedProxy({ port: 8080 });
            expect(result.running).toBe(true);
            expect(mockProcessManager.start).toHaveBeenCalled();
        });

        it('should accept no options (default port)', async () => {
            const result = await proxyService.startEmbeddedProxy();
            expect(result.running).toBe(true);
        });

        it('should propagate errorCode from process manager on failure', async () => {
            vi.mocked(mockProcessManager.start).mockResolvedValue({
                running: false,
                error: 'Port 8317 is already in use.',
                errorCode: AppErrorCode.PROXY_PORT_IN_USE
            });
            const result = await proxyService.startEmbeddedProxy({ port: 8317 });
            expect(result.running).toBe(false);
            expect(result.errorCode).toBe(AppErrorCode.PROXY_PORT_IN_USE);
        });

        it('should default errorCode to PROXY_START_FAILED when process manager returns no code', async () => {
            vi.mocked(mockProcessManager.start).mockResolvedValue({
                running: false,
                error: 'Unknown failure'
            });
            const result = await proxyService.startEmbeddedProxy({ port: 8317 });
            expect(result.running).toBe(false);
            expect(result.errorCode).toBe(AppErrorCode.PROXY_START_FAILED);
        });
    });

    describe('generateConfig validation', () => {
        it('should reject negative port', async () => {
            await expect(proxyService.generateConfig(-1)).rejects.toThrow();
        });

        it('should reject port 0', async () => {
            await expect(proxyService.generateConfig(0)).rejects.toThrow();
        });

        it('should reject port above 65535', async () => {
            await expect(proxyService.generateConfig(99999)).rejects.toThrow();
        });

        it('should accept valid port', async () => {
            await proxyService.generateConfig(8317);
            expect(mockProcessManager.generateConfig).toHaveBeenCalledWith(8317);
        });

        it('should throw ProxyServiceError with PROXY_INVALID_CONFIG code', async () => {
            try {
                await proxyService.generateConfig(-1);
                expect.unreachable('should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(ProxyServiceError);
                expect((e as ProxyServiceError).code).toBe(AppErrorCode.PROXY_INVALID_CONFIG);
                expect((e as ProxyServiceError).retryable).toBe(false);
            }
        });
    });

    describe('stopEmbeddedProxy error handling', () => {
        it('should throw ProxyServiceError with PROXY_STOP_FAILED on failure', async () => {
            vi.mocked(mockProcessManager.stop).mockRejectedValue(new Error('kill failed'));
            try {
                await proxyService.stopEmbeddedProxy();
                expect.unreachable('should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(ProxyServiceError);
                expect((e as ProxyServiceError).code).toBe(AppErrorCode.PROXY_STOP_FAILED);
                expect((e as ProxyServiceError).retryable).toBe(true);
            }
        });
    });

    describe('waitForGitHubToken validation', () => {
        it('should reject empty device code', async () => {
            await expect(proxyService.waitForGitHubToken('', 5)).rejects.toThrow('Device code');
        });

        it('should reject whitespace-only device code', async () => {
            await expect(proxyService.waitForGitHubToken('   ', 5)).rejects.toThrow('Device code');
        });

        it('should reject zero interval', async () => {
            await expect(proxyService.waitForGitHubToken('valid-code', 0)).rejects.toThrow('Interval');
        });

        it('should reject negative interval', async () => {
            await expect(proxyService.waitForGitHubToken('valid-code', -5)).rejects.toThrow('Interval');
        });
    });

    describe('fetchGitHubProfile validation', () => {
        it('should return empty object for empty token', async () => {
            const result = await proxyService.fetchGitHubProfile('');
            expect(result).toEqual({});
        });

        it('should return empty object for whitespace-only token', async () => {
            const result = await proxyService.fetchGitHubProfile('   ');
            expect(result).toEqual({});
        });
    });

    describe('fetchGitHubEmails validation', () => {
        it('should return undefined for empty token', async () => {
            const result = await proxyService.fetchGitHubEmails('');
            expect(result).toBeUndefined();
        });

        it('should return undefined for whitespace-only token', async () => {
            const result = await proxyService.fetchGitHubEmails('   ');
            expect(result).toBeUndefined();
        });
    });

    describe('setProviderRateLimitConfig validation', () => {
        it('should reject empty provider', () => {
            expect(() => proxyService.setProviderRateLimitConfig('', {})).toThrow('Provider');
        });

        it('should reject whitespace-only provider', () => {
            expect(() => proxyService.setProviderRateLimitConfig('   ', {})).toThrow('Provider');
        });

        it('should accept valid provider', () => {
            const result = proxyService.setProviderRateLimitConfig('github', { maxRequests: 100 });
            expect(result.maxRequests).toBe(100);
        });
    });
});
