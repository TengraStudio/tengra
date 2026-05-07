/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { SystemService } from '@main/services/system/system.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}));

vi.mock('@shared/utils/error.util', () => ({
    getErrorMessage: (e: Error) => e?.message ?? 'unknown'
}));

const mockSpawnChild = {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn()
};

vi.mock('child_process', () => ({
    spawn: vi.fn(() => mockSpawnChild)
}));

vi.mock('os', () => ({
    cpus: vi.fn().mockReturnValue([{ model: 'cpu', speed: 2000 }]),
    totalmem: vi.fn().mockReturnValue(16_000_000_000),
    freemem: vi.fn().mockReturnValue(8_000_000_000),
    uptime: vi.fn().mockReturnValue(3600),
    hostname: vi.fn().mockReturnValue('test-host'),
    release: vi.fn().mockReturnValue('10.0'),
    platform: vi.fn().mockReturnValue('win32'),
    userInfo: vi.fn().mockReturnValue({ username: 'test-user' }),
    homedir: vi.fn().mockReturnValue('C:\\Users\\test-user'),
    tmpdir: vi.fn().mockReturnValue('C:\\Users\\test-user\\AppData\\Local\\Temp')
}));

describe('SystemService', () => {
    let service: SystemService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new SystemService();
    });

    afterEach(async () => {
        await service.cleanup();
    });

    describe('initialize', () => {
        it('should cache system info on init', async () => {
            await service.initialize();
            // getSystemInfo should have been called internally
            const info = await service.getSystemInfo();
            expect(info.hostname).toBe('test-host');
        });
    });

    describe('cleanup', () => {
        it('should clear cached system info', async () => {
            await service.initialize();
            await service.cleanup();
            // Should still work after cleanup (re-fetches)
            const info = await service.getSystemInfo();
            expect(info).toBeDefined();
        });
    });

    describe('getSystemInfo', () => {
        it('should return system information', async () => {
            const info = await service.getSystemInfo();
            expect(info.platform).toBe(process.platform);
            expect(info.arch).toBe(process.arch);
            expect(info.cpus).toBe(1);
            expect(info.totalMemory).toBe(16_000_000_000);
            expect(info.hostname).toBe('test-host');
        });
    });

    describe('setVolume', () => {
        it('should clamp volume to 0-100', async () => {
            mockSpawnChild.on.mockImplementation((evt: string, cb: (...args: TestValue[]) => void) => {
                if (evt === 'close') {cb(0);}
            });
            mockSpawnChild.stdout.on.mockImplementation(() => {});
            mockSpawnChild.stderr.on.mockImplementation(() => {});

            const result = await service.setVolume(150);
            expect(result.success).toBe(true);
        });
    });

    describe('getProcessOnPort', () => {
        it('should reject invalid port numbers', async () => {
            const result = await service.getProcessOnPort(-1);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid port number');
        });

        it('should reject non-integer ports', async () => {
            const result = await service.getProcessOnPort(3.5);
            expect(result.success).toBe(false);
        });

        it('should reject out of range ports', async () => {
            const result = await service.getProcessOnPort(70000);
            expect(result.success).toBe(false);
        });
    });

    describe('mediaControl', () => {
        it('should reject invalid action', async () => {
            const result = await service.mediaControl('invalid');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid media action');
        });
    });

    describe('launchApp', () => {
        it('should reject invalid app names', async () => {
            const result = await service.launchApp('bad;app');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid app name');
        });
    });

    describe('setWallpaper', () => {
        it('should reject paths with injection chars', async () => {
            const result = await service.setWallpaper('image";rm -rf /');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid image path');
        });
    });

    describe('healthCheck', () => {
        it('should return healthy status', async () => {
            const result = await service.healthCheck();
            expect(result.success).toBe(true);
            expect(result.result?.status).toBe('healthy');
            expect(result.result?.platform).toBe(process.platform);
        });
    });
});

