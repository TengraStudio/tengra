/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Restore real fs and path (global setup mocks them)
vi.unmock('fs');
vi.unmock('path');

import { PluginSandbox } from '@main/mcp/sandbox';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

describe('PluginSandbox', () => {
    let sandbox: PluginSandbox;

    beforeEach(() => {
        sandbox = new PluginSandbox({
            maxMemoryMB: 64,
            maxExecutionTimeMs: 5000,
            allowedPaths: ['/tmp/safe'],
            deniedPaths: ['/tmp/safe/secret'],
            networkAccess: false,
        });
    });

    describe('execute', () => {
        it('should execute simple code and return result', async () => {
            const result = await sandbox.execute<number>('return 2 + 2');
            expect(result.success).toBe(true);
            expect(result.result).toBe(4);
            expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
            expect(result.memoryUsedMB).toBeGreaterThanOrEqual(0);
        });

        it('should handle async code execution', async () => {
            const result = await sandbox.execute<string>(
                'return new Promise(resolve => setTimeout(() => resolve("done"), 50))'
            );
            expect(result.success).toBe(true);
            expect(result.result).toBe('done');
        });

        it('should enforce execution timeout', async () => {
            const shortTimeoutSandbox = new PluginSandbox({ maxExecutionTimeMs: 100 });
            const result = await shortTimeoutSandbox.execute(
                'return new Promise(resolve => setTimeout(resolve, 10000))'
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('timed out');
        });

        it('should catch runtime errors in sandboxed code', async () => {
            const result = await sandbox.execute('throw new Error("boom")');
            expect(result.success).toBe(false);
            expect(result.error).toContain('boom');
        });

        it('should report execution time', async () => {
            const result = await sandbox.execute(
                'return new Promise(resolve => setTimeout(() => resolve(true), 100))'
            );
            expect(result.executionTimeMs).toBeGreaterThanOrEqual(50);
        });
    });

    describe('isPathAllowed', () => {
        it('should allow paths within allowed directories', () => {
            expect(sandbox.isPathAllowed('/tmp/safe/file.txt')).toBe(true);
        });

        it('should deny paths within denied directories', () => {
            expect(sandbox.isPathAllowed('/tmp/safe/secret/key.pem')).toBe(false);
        });

        it('should deny paths outside allowed directories', () => {
            expect(sandbox.isPathAllowed('/etc/passwd')).toBe(false);
        });

        it('should allow all paths when no allowedPaths configured', () => {
            const openSandbox = new PluginSandbox({ allowedPaths: [], deniedPaths: [] });
            expect(openSandbox.isPathAllowed('/any/path')).toBe(true);
        });
    });

    describe('getConfig', () => {
        it('should return sandbox configuration', () => {
            const config = sandbox.getConfig();
            expect(config.maxMemoryMB).toBe(64);
            expect(config.maxExecutionTimeMs).toBe(5000);
            expect(config.networkAccess).toBe(false);
        });

        it('should use defaults when no config provided', () => {
            const defaultSandbox = new PluginSandbox();
            const config = defaultSandbox.getConfig();
            expect(config.maxMemoryMB).toBe(128);
            expect(config.maxExecutionTimeMs).toBe(30_000);
        });
    });
});

