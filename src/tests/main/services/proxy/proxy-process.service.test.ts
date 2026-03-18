import * as fs from 'fs';

import { ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
import { AuthService } from '@main/services/security/auth.service';
import { AuthAPIService } from '@main/services/security/auth-api.service';
import { SettingsService } from '@main/services/system/settings.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    app: {
        isPackaged: false,
    },
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
    getManagedRuntimeBinaryPath: vi.fn().mockReturnValue('C:/runtime/bin/cliproxy-embed.exe'),
}));

vi.mock('fs', async importOriginal => {
    const actual = await importOriginal<typeof import('fs')>();
    return {
        ...actual,
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

type ProxyProcessManagerInternals = ProxyProcessManager & {
    ensureBinary: () => Promise<string>;
    isPortBusy: (port: number) => Promise<boolean>;
    killExistingProxyProcesses: () => Promise<void>;
    setupAuthAPI: () => number;
    spawnProxyProcess: (
        binaryPath: string,
        runtimeConfig: { managementPassword: string;
            port: number;
            proxyApiKey: string;
        },
        authPort: number,
        persistent?: boolean
    ) => void;
};

describe('ProxyProcessManager runtime launch configuration', () => {
    let service: ProxyProcessManager;
    let settingsService: SettingsService;

    beforeEach(() => {
        vi.clearAllMocks();

        settingsService = {
            getSettings: vi.fn().mockReturnValue({
                proxy: {
                    enabled: true,
                    url: 'http://127.0.0.1:8317/v1',
                    key: 'proxy-api-key',
                    authStoreKey: 'management-password',
                },
            }),
            saveSettings: vi.fn().mockResolvedValue(undefined),
        } as never as SettingsService;

        service = new ProxyProcessManager(settingsService, {} as AuthService, {
                getPort: vi.fn().mockReturnValue(43111),
                setApiKey: vi.fn(),
            } as never as AuthAPIService
        );
    });

    it('prepares runtime launch inputs without writing a YAML config file', async () => {
        const runtimeConfig = await service.prepareRuntimeLaunchConfig(8317);

        expect(runtimeConfig).toEqual({
            managementPassword: 'management-password',
            port: 8317,
            proxyApiKey: 'proxy-api-key',
        });
        expect(fs.promises.writeFile).not.toHaveBeenCalled();
        expect(settingsService.saveSettings).toHaveBeenCalledWith({
            proxy: {
                enabled: true,
                url: 'http://127.0.0.1:8317/v1',
                key: 'proxy-api-key',
                authStoreKey: 'management-password',
            },
        });
    });

    it('starts the proxy with runtime flags instead of a config path', async () => {
        const internals = service as ProxyProcessManagerInternals;
        const spawnProxyProcess = vi.fn();

        Object.defineProperty(internals, 'ensureBinary', {
            value: vi.fn().mockResolvedValue('C:/runtime/bin/cliproxy-embed.exe'),
        });
        Object.defineProperty(internals, 'killExistingProxyProcesses', {
            value: vi.fn().mockResolvedValue(undefined),
        });
        Object.defineProperty(internals, 'isPortBusy', {
            value: vi.fn().mockResolvedValue(false),
        });
        Object.defineProperty(internals, 'setupAuthAPI', {
            value: vi.fn().mockReturnValue(43111),
        });
        Object.defineProperty(internals, 'spawnProxyProcess', {
            value: spawnProxyProcess,
        });

        await service.start({ port: 8317 });

        expect(spawnProxyProcess).toHaveBeenCalledWith(
            'C:/runtime/bin/cliproxy-embed.exe',
            {
                managementPassword: 'management-password',
                port: 8317,
                proxyApiKey: 'proxy-api-key',
            },
            43111,
            undefined
        );
    });
});
