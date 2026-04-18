/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { CommandService } from '@main/services/system/command.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}));

vi.mock('@main/utils/command-validator.util', () => ({
    validateCommand: vi.fn().mockReturnValue({ allowed: true })
}));

const mockExecCallback = vi.fn();
const mockSpawn = vi.fn();
let lastExecCommand = '';
let lastExecOptions: TestValue | undefined;

vi.mock('child_process', () => ({
    exec: vi.fn((cmd: string, opts: TestValue, cb?: (...args: TestValue[]) => void) => {
        lastExecCommand = cmd;
        lastExecOptions = opts;
        if (cb) {
            mockExecCallback(cb);
        }
        return { pid: 1234, kill: vi.fn() };
    }),
    spawn: vi.fn(() => mockSpawn())
}));

vi.mock('util', () => ({
    promisify: () => vi.fn().mockResolvedValue({ stdout: 'ok', stderr: '' })
}));

vi.mock('@shared/utils/error.util', () => ({
    getErrorMessage: (e: Error) => e?.message ?? 'unknown error'
}));

import { validateCommand } from '@main/utils/command-validator.util';

describe('CommandService', () => {
    let service: CommandService;

    beforeEach(() => {
        vi.clearAllMocks();
        lastExecCommand = '';
        lastExecOptions = undefined;
        service = new CommandService();
    });

    afterEach(async () => {
        await service.dispose();
    });

    describe('dispose', () => {
        it('should clear active processes', async () => {
            await service.dispose();
            // No error thrown
        });
    });

    describe('killCommand', () => {
        it('should return false for unknown id', () => {
            expect(service.killCommand('nonexistent')).toBe(false);
        });
    });

    describe('executeCommand', () => {
        it('should reject blocked commands', async () => {
            vi.mocked(validateCommand).mockReturnValueOnce({ allowed: false, reason: 'Blocked' });
            const result = await service.executeCommand('rm -rf /');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Blocked');
        });

        it('should reject blocked commands with default message', async () => {
            vi.mocked(validateCommand).mockReturnValueOnce({ allowed: false });
            const result = await service.executeCommand('bad');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Command blocked by safety policy');
        });

        it('normalizes common cmd-style Windows commands for PowerShell execution', async () => {
            const pending = service.executeCommand(
                'if not exist "%USERPROFILE%\\Desktop\\projects" mkdir "%USERPROFILE%\\Desktop\\projects" && dir "%USERPROFILE%\\Desktop\\projects"',
                { id: 'tracked-normalize' }
            );

            const callback = mockExecCallback.mock.calls.at(-1)?.[0] as
                | ((error: Error | null, stdout: string, stderr: string) => void)
                | undefined;
            callback?.(null, 'ok', '');
            const result = await pending;

            expect(result.success).toBe(true);
            if (process.platform === 'win32') {
                expect(lastExecCommand).toContain('$env:USERPROFILE');
                expect(lastExecCommand).toContain('Test-Path');
                expect(lastExecCommand).toContain('New-Item -ItemType Directory');
            } else {
                expect(lastExecCommand).toContain('if not exist');
            }
            expect(lastExecOptions).toBeDefined();
        });
    });

    describe('getSystemInfo', () => {
        it('should return system info shape', async () => {
            const info = await service.getSystemInfo();
            expect(info).toHaveProperty('cwd');
            expect(info).toHaveProperty('platform');
            expect(info).toHaveProperty('arch');
        });
    });
});
