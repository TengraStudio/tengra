import * as fs from 'fs';

import { DatabaseService } from '@main/services/data/database.service';
import { ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
import { AuthService } from '@main/services/security/auth.service';
import { SettingsService } from '@main/services/system/settings.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rendererSendMock = vi.fn();

vi.mock('electron', () => ({
    app: {
        isPackaged: false,
    },
}));

vi.mock('@main/startup/window', () => ({
    getMainWindow: vi.fn(() => ({
        isDestroyed: () => false,
        webContents: {
            send: rendererSendMock,
        },
    })),
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('@main/services/system/runtime-path.service', () => ({
    getManagedRuntimeBinaryPath: vi.fn().mockReturnValue('C:/runtime/bin/tengra-proxy.exe'),
}));

vi.mock('fs', async importOriginal => {
    const actual = await importOriginal<typeof import('fs')>();
    return {
        ...actual,
        existsSync: vi.fn().mockReturnValue(false),
        promises: {
            ...actual.promises,
            mkdir: vi.fn().mockResolvedValue(undefined),
            writeFile: vi.fn().mockResolvedValue(undefined),
            access: vi.fn().mockResolvedValue(undefined),
            stat: vi.fn().mockResolvedValue({ mtimeMs: 0 }),
            copyFile: vi.fn().mockResolvedValue(undefined),
        },
        readdirSync: vi.fn().mockReturnValue([]),
    };
});

describe('ProxyProcessManager runtime launch configuration', () => {
    let service: ProxyProcessManager;
    let settingsService: SettingsService;
    let authService: AuthService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
        rendererSendMock.mockReset();

        settingsService = {
            getSettings: vi.fn().mockReturnValue({
                openai: { apiKey: 'openai-key', model: 'gpt-4.1' },
                anthropic: { apiKey: 'anthropic-key', model: 'claude-sonnet-4' },
                groq: { apiKey: 'groq-key', model: 'llama-3.3-70b' },
                nvidia: { apiKey: 'nvidia-key', model: 'nvidia/llama3-chatqa-1.5-70b' },
                proxy: {
                    enabled: true,
                    url: 'http://127.0.0.1:8317/v1',
                    key: '',
                    apiKey: 'proxy-api-key',
                    authStoreKey: '',
                    managementPassword: 'management-password',
                },
            }),
            saveSettings: vi.fn().mockResolvedValue(undefined),
        } as never as SettingsService;

        authService = {
            linkAccount: vi.fn().mockResolvedValue(undefined),
            updateFromProxy: vi.fn().mockResolvedValue(undefined),
            reloadLinkedAccountsCache: vi.fn().mockResolvedValue(undefined),
        } as never as AuthService;

        service = new ProxyProcessManager(
            settingsService,
            authService,
            {
                exec: vi.fn(),
                getLinkedAccounts: vi.fn().mockResolvedValue([]),
            } as never as DatabaseService
        );
    });

    it('prepares runtime launch inputs without writing a YAML config file', async () => {
        const runtimeConfig = await service.generateConfig(8317);

        expect(runtimeConfig).toEqual({
            managementPassword: 'management-password',
            port: 8317,
            proxyApiKey: 'proxy-api-key',
        });
        expect(fs.promises.writeFile).not.toHaveBeenCalled();
        expect(authService.linkAccount).toHaveBeenCalledWith('nvidia_key', { accessToken: 'nvidia-key' });
        expect(settingsService.saveSettings).toHaveBeenCalledWith(expect.objectContaining({
            proxy: {
                enabled: true,
                url: 'http://127.0.0.1:8317/v1',
                key: '',
                apiKey: 'proxy-api-key',
                authStoreKey: '',
                managementPassword: 'management-password',
                port: 8317,
            },
        }));
    });

    it('starts the proxy with runtime flags instead of a config path', async () => {
        const spawnProxyProcess = vi.fn();

        Object.defineProperty(service, 'ensureBinary', {
            value: vi.fn().mockResolvedValue('C:/runtime/bin/tengra-proxy.exe'),
        });
        Object.defineProperty(service, 'killExistingProxyProcesses', {
            value: vi.fn().mockResolvedValue(undefined),
        });
        Object.defineProperty(service, 'waitForHealthy', {
            value: vi.fn().mockResolvedValue(undefined),
        });
        Object.defineProperty(service, 'spawnProxyProcess', {
            value: spawnProxyProcess,
        });

        await service.start({ port: 8317 });

        expect(spawnProxyProcess).toHaveBeenCalledWith(
            'C:/runtime/bin/tengra-proxy.exe',
            {
                managementPassword: 'management-password',
                port: 8317,
                proxyApiKey: 'proxy-api-key',
            },
            undefined
        );
    });

    it('consumes auth update marker lines and refreshes auth cache without logging secrets', async () => {
        const processProxyLogLine = Reflect.get(service, 'processProxyLogLine') as
            | ((line: string, defaultLevel: 'info' | 'error') => void)
            | undefined;

        expect(processProxyLogLine).toBeTypeOf('function');

        processProxyLogLine?.call(
            service,
            '__TENGRA_AUTH_UPDATE__:{"provider":"codex","accountId":"codex_default","tokenData":{"accessToken":"secret"}}',
            'info'
        );

        await Promise.resolve();
        await Promise.resolve();

        expect(authService.updateFromProxy).toHaveBeenCalledWith({
            provider: 'codex',
            accountId: 'codex_default',
            tokenData: {
                accessToken: 'secret',
            },
        });
        expect(authService.reloadLinkedAccountsCache).toHaveBeenCalledTimes(1);
        expect(rendererSendMock).toHaveBeenCalledWith('auth:account-changed', {
            type: 'updated',
            provider: 'codex',
            accountId: 'codex_default',
        });
    });

    it('prefers the explicit CARGO environment variable when present', () => {
        vi.stubEnv('CARGO', 'C:\\Tools\\cargo\\bin\\cargo.exe');
        vi.mocked(fs.existsSync).mockReturnValue(false);

        const resolveCargoCommand = Reflect.get(service, 'resolveCargoCommand') as (() => string) | undefined;
        expect(resolveCargoCommand).toBeTypeOf('function');
        expect(resolveCargoCommand?.call(service)).toBe('C:\\Tools\\cargo\\bin\\cargo.exe');
    });

    it('falls back to the local cargo binary when available', () => {
        vi.unstubAllEnvs();
        vi.stubEnv('USERPROFILE', 'C:\\Users\\agnes');
        const normalizeSlashes = (value: string): string => value.split('/').join('\\');
        vi.mocked(fs.existsSync).mockImplementation((target) =>
            normalizeSlashes(String(target)) === 'C:\\Users\\agnes\\.cargo\\bin\\cargo.exe'
        );

        const resolveCargoCommand = Reflect.get(service, 'resolveCargoCommand') as (() => string) | undefined;
        expect(resolveCargoCommand).toBeTypeOf('function');
        const resolved = resolveCargoCommand?.call(service);
        expect(resolved ? normalizeSlashes(resolved) : resolved).toBe('"C:\\Users\\agnes\\.cargo\\bin\\cargo.exe"');
    });
});
