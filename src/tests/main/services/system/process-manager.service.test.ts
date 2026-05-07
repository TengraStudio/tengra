/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import path from 'path';

import { ProcessManagerService } from '@main/services/system/process-manager.service';
import { app } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}));

vi.mock('electron', () => ({
    app: {
        isPackaged: false,
        getPath: vi.fn().mockReturnValue('/mock/appData')
    }
}));

vi.mock('child_process', () => ({
    exec: vi.fn(),
    spawn: vi.fn(() => ({
        pid: 9999,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        unref: vi.fn(),
        kill: vi.fn(),
        removeAllListeners: vi.fn()
    }))
}));

vi.mock('util', () => ({
    promisify: () => vi.fn().mockResolvedValue({ stdout: '', stderr: '' })
}));

vi.mock('fs', () => ({
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue(''),
    unlinkSync: vi.fn()
}));

vi.mock('net', () => {
    const mockSocket = {
        setTimeout: vi.fn(),
        on: vi.fn(),
        connect: vi.fn(),
        destroy: vi.fn()
    };
    return { Socket: vi.fn(() => mockSocket) };
});

vi.mock('axios', () => ({
    default: {
        post: vi.fn(),
        get: vi.fn(),
        isAxiosError: vi.fn().mockReturnValue(false)
    }
}));

vi.mock('@shared/constants/timeouts', () => ({
    OPERATION_TIMEOUTS: { PORT_CHECK_FAST: 500 }
}));

vi.mock('@shared/utils/error.util', () => ({
    getErrorMessage: (e: Error) => e?.message ?? 'unknown'
}));

describe('ProcessManagerService', () => {
    let service: ProcessManagerService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ProcessManagerService();
    });

    afterEach(async () => {
        await service.cleanup();
    });

    describe('initialize', () => {
        it('should initialize without errors', async () => {
            await expect(service.initialize()).resolves.not.toThrow();
        });
    });

    describe('cleanup', () => {
        it('should clean up without errors', async () => {
            await expect(service.cleanup()).resolves.not.toThrow();
        });
    });

    describe('stopService', () => {
        it('should not throw for unknown service', () => {
            expect(() => service.stopService('unknown')).not.toThrow();
        });
    });

    describe('killAll', () => {
        it('should not throw when no processes exist', () => {
            expect(() => service.killAll()).not.toThrow();
        });

        it('should accept force parameter', () => {
            expect(() => service.killAll(true)).not.toThrow();
        });
    });

    describe('getServicePort', () => {
        it('should return undefined for unknown service', () => {
            expect(service.getServicePort('nonexistent')).toBeUndefined();
        });
    });

    describe('portable discovery paths', () => {
        it('should prefer userData service port files', () => {
            vi.mocked(app.getPath).mockImplementation((name: string) => {
                if (name === 'userData') {
                    return '/mock/portable';
                }
                return '/mock/roaming';
            });

            const candidates = Reflect.get(service, 'getPortFileCandidates').call(service, 'db-service') as string[];

            expect(candidates[0]).toBe(path.join('/mock/portable', 'services', 'db-service.port'));
            expect(candidates).toContain(path.join('/mock/roaming', 'Tengra', 'services', 'db-service.port'));
        });
    });

    describe('sendRequest', () => {
        it('should throw when service port not discovered', async () => {
            await expect(service.sendRequest('unknown', {}))
                .rejects.toThrow('Service unknown port not discovered');
        });
    });

    describe('sendGetRequest', () => {
        it('should throw when service port not discovered', async () => {
            await expect(service.sendGetRequest('unknown', '/health'))
                .rejects.toThrow('Service unknown port not discovered');
        });
    });
});

