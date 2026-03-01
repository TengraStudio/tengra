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

vi.mock('child_process', () => ({
    exec: vi.fn((_cmd: string, _opts: unknown, cb?: (...args: unknown[]) => void) => {
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
