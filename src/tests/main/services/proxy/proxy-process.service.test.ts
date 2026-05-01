/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as fs from 'fs';

import { appLogger } from '@main/logging/logger';
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
            getActiveToken: vi.fn().mockImplementation((provider) => {
                if (provider === 'proxy_key') {return Promise.resolve('proxy-api-key');}
                return Promise.resolve(null);
            }),
            getAccountsByProviderFull: vi.fn().mockResolvedValue([]),
            getRuntimeMasterKeyHex: vi.fn().mockReturnValue('mock-key'),
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
        Object.defineProperty(service, 'isPortAcceptingConnections', {
            value: vi.fn().mockResolvedValue(false),
        });
        Object.defineProperty(service, 'isExistingProxyHealthy', {
            value: vi.fn().mockResolvedValue(false),
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

    it('passes provider OAuth timeout config to proxy environment', async () => {
        vi.mocked(settingsService.getSettings).mockReturnValue({
            ollama: {
                url: 'http://127.0.0.1:11434',
            },
            proxy: {
                enabled: true,
                url: 'http://127.0.0.1:8317/v1',
                key: '',
                apiKey: 'proxy-api-key',
                authStoreKey: '',
                managementPassword: 'management-password',
                oauthTimeoutMs: {
                    default: 30000,
                    codex: 45000,
                    claude: 120000,
                    antigravity: 60000,
                    ollama: 90000,
                },
            },
        } as never);

        const buildOAuthTimeoutEnv = Reflect.get(service, 'buildOAuthTimeoutEnv') as
            | (() => Record<string, string>)
            | undefined;
        expect(buildOAuthTimeoutEnv).toBeTypeOf('function');
        expect(buildOAuthTimeoutEnv?.call(service)).toEqual({
            TENGRA_OAUTH_TIMEOUT_SECS: '30',
            TENGRA_OAUTH_TIMEOUT_CODEX_SECS: '45',
            TENGRA_OAUTH_TIMEOUT_CLAUDE_SECS: '120',
            TENGRA_OAUTH_TIMEOUT_ANTIGRAVITY_SECS: '60',
            TENGRA_OAUTH_TIMEOUT_OLLAMA_SECS: '90',
        });

        const buildOllamaBaseUrlEnv = Reflect.get(service, 'buildOllamaBaseUrlEnv') as
            | (() => Record<string, string>)
            | undefined;
        expect(buildOllamaBaseUrlEnv).toBeTypeOf('function');
        expect(buildOllamaBaseUrlEnv?.call(service)).toEqual({
            TENGRA_OLLAMA_BASE_URL: 'http://127.0.0.1:11434',
        });
    });

    it('rejects invalid provider OAuth timeout config', () => {
        vi.mocked(settingsService.getSettings).mockReturnValue({
            proxy: {
                enabled: true,
                url: 'http://127.0.0.1:8317/v1',
                key: '',
                apiKey: 'proxy-api-key',
                authStoreKey: '',
                managementPassword: 'management-password',
                oauthTimeoutMs: {
                    codex: 5000,
                },
            },
        } as never);

        const buildOAuthTimeoutEnv = Reflect.get(service, 'buildOAuthTimeoutEnv') as
            | (() => Record<string, string>)
            | undefined;
        expect(buildOAuthTimeoutEnv).toBeTypeOf('function');
        expect(() => buildOAuthTimeoutEnv?.call(service)).toThrow('Invalid OAuth timeout for codex');
    });

    it('fails startup when fixed OAuth bridge port 1455 is occupied', async () => {
        Object.defineProperty(service, 'isPortAcceptingConnections', {
            value: vi.fn().mockResolvedValue(true),
        });
        Object.defineProperty(service, 'isExistingProxyHealthy', {
            value: vi.fn().mockResolvedValue(false),
        });
        Object.defineProperty(service, 'ensureBinary', {
            value: vi.fn().mockResolvedValue('C:/runtime/bin/tengra-proxy.exe'),
        });

        const status = await service.start({ port: 8317 });
        expect(status.running).toBe(false);
        expect(status.errorCode).toBe('PROXY_PORT_IN_USE');
        expect(status.error).toContain('1455');
    });

    it('consumes auth update marker lines and refreshes auth cache without logging secrets', async () => {
        const processProxyLogLine = Reflect.get(service, 'processProxyLogLine') as
            | ((line: string, defaultLevel: 'info' | 'error') => void)
            | undefined;

        expect(processProxyLogLine).toBeTypeOf('function');

        processProxyLogLine?.call(
            service,
            '__TENGRA_AUTH_UPDATE__:{"provider":"codex","accountId":"codex_default","tokenData":{"accessToken":"mock-secret"}}',
            'info'
        );

        await Promise.resolve();
        await Promise.resolve();

        expect(authService.updateFromProxy).toHaveBeenCalledWith({
            provider: 'codex',
            accountId: 'codex_default',
            tokenData: {
                accessToken: 'mock-secret',
            },
        });
        expect(authService.reloadLinkedAccountsCache).toHaveBeenCalledTimes(1);
        expect(rendererSendMock).toHaveBeenCalledWith('auth:account-changed', {
            type: 'updated',
            provider: 'codex',
            accountId: 'codex_default',
        });
    });

    it('logs explicit callback DB write failure markers', () => {
        const processProxyLogLine = Reflect.get(service, 'processProxyLogLine') as
            | ((line: string, defaultLevel: 'info' | 'error') => void)
            | undefined;

        processProxyLogLine?.call(
            service,
            '__TENGRA_AUTH_UPDATE_FAILURE__:{"provider":"codex","accountId":"codex_default","attempts":3,"error":"db unavailable"}',
            'error'
        );

        expect(appLogger.error).toHaveBeenCalledWith(
            'Proxy',
            expect.stringContaining('OAuth callback DB write failure')
        );
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
        vi.stubEnv('USERPROFILE', 'C:\\Users\\mockuser');
        const normalizeSlashes = (value: string): string => value.split('/').join('\\');
        vi.mocked(fs.existsSync).mockImplementation((target) =>
            normalizeSlashes(String(target)) === 'C:\\Users\\mockuser\\.cargo\\bin\\cargo.exe'
        );

        const resolveCargoCommand = Reflect.get(service, 'resolveCargoCommand') as (() => string) | undefined;
        expect(resolveCargoCommand).toBeTypeOf('function');
        const resolved = resolveCargoCommand?.call(service);
        expect(resolved ? normalizeSlashes(resolved) : resolved).toBe('"C:\\Users\\mockuser\\.cargo\\bin\\cargo.exe"');
    });
});
