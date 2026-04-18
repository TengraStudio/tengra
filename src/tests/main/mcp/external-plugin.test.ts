/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { EventEmitter } from 'events';

import { ExternalMcpPlugin } from '@main/mcp/external-plugin';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

class MockChildProcess extends EventEmitter {
    stdin = { write: vi.fn(), end: vi.fn() };
    stdout = new EventEmitter() as EventEmitter & { setEncoding: ReturnType<typeof vi.fn> };
    stderr = new EventEmitter() as EventEmitter & { setEncoding: ReturnType<typeof vi.fn> };
    killed = false;
    pid = 12345;
    kill = vi.fn(() => { this.killed = true; });

    constructor() {
        super();
        this.stdout.setEncoding = vi.fn();
        this.stderr.setEncoding = vi.fn();
    }
}

let mockSpawnReturn: MockChildProcess;

vi.mock('child_process', () => ({
    spawn: vi.fn(() => mockSpawnReturn)
}));

vi.mock('fs', async (importOriginal) => {
    const originalModule = await importOriginal<typeof import('fs')>();
    return {
        ...originalModule,
        existsSync: vi.fn(() => true),
        statSync: vi.fn(() => ({ isFile: () => true, isDirectory: () => false, size: 0 })),
        realpathSync: vi.fn((p: string) => p),
    };
});

vi.mock('path', async (importOriginal) => {
    const originalModule = await importOriginal<typeof import('path')>();
    return {
        ...originalModule,
        resolve: (...args: string[]) => args.join('/'),
    };
});

describe('ExternalMcpPlugin', () => {
    let plugin: ExternalMcpPlugin;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        mockSpawnReturn = new MockChildProcess();
        plugin = new ExternalMcpPlugin('test-plugin', 'A test plugin', {
            command: 'node',
            args: ['server.js']
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('constructor', () => {
        it('should set source to "user" for non-remote plugins', () => {
            expect(plugin.source).toBe('user');
            expect(plugin.name).toBe('test-plugin');
            expect(plugin.description).toBe('A test plugin');
        });

        it('should set source to "remote" for remote plugins', () => {
            const remotePlugin = new ExternalMcpPlugin('remote-plugin', 'Remote', {
                command: 'node',
                args: [],
                isRemote: true
            });
            expect(remotePlugin.source).toBe('remote');
        });
    });

    describe('initialize', () => {
        it('should spawn a child process', async () => {
            const { spawn } = await import('child_process');
            await plugin.initialize();

            expect(spawn).toHaveBeenCalled();
            expect(plugin.isAlive()).toBe(true);
        });

        it('should not re-initialize if already alive', async () => {
            const { spawn } = await import('child_process');
            await plugin.initialize();
            await plugin.initialize();

            expect(spawn).toHaveBeenCalledTimes(1);
        });

        it('should reject forbidden path patterns in command', async () => {
            const badPlugin = new ExternalMcpPlugin('bad', 'Bad', {
                command: 'node; rm -rf /',
                args: []
            });

            await expect(badPlugin.initialize()).rejects.toThrow('MCP plugin verification failed');
        });

        it('should reject path traversal in command', async () => {
            const badPlugin = new ExternalMcpPlugin('bad', 'Bad', {
                command: '../../../evil',
                args: []
            });

            await expect(badPlugin.initialize()).rejects.toThrow('MCP plugin verification failed');
        });

        it('should reject null bytes in command', async () => {
            const badPlugin = new ExternalMcpPlugin('bad', 'Bad', {
                command: 'node\x00evil',
                args: []
            });

            await expect(badPlugin.initialize()).rejects.toThrow('MCP plugin verification failed');
        });

        it('should reject forbidden patterns in arguments', async () => {
            const badPlugin = new ExternalMcpPlugin('bad', 'Bad', {
                command: 'node',
                args: ['server.js', '../../../etc/passwd']
            });

            await expect(badPlugin.initialize()).rejects.toThrow('MCP plugin verification failed');
        });

        it('should reject shell metacharacters in command', async () => {
            const badPlugin = new ExternalMcpPlugin('bad', 'Bad', {
                command: 'node | cat',
                args: []
            });

            await expect(badPlugin.initialize()).rejects.toThrow('MCP plugin verification failed');
        });
    });

    describe('dispose', () => {
        it('should kill the process and clear state', async () => {
            await plugin.initialize();
            expect(plugin.isAlive()).toBe(true);

            await plugin.dispose();
            expect(plugin.isAlive()).toBe(false);
            expect(mockSpawnReturn.kill).toHaveBeenCalled();
        });

        it('should reject pending requests on dispose', async () => {
            await plugin.initialize();

            const dispatchPromise = plugin.dispatch('test-action', { key: 'value' });
            await plugin.dispose();

            const result = await dispatchPromise;
            expect(result.success).toBe(false);
        });

        it('should be safe to call dispose multiple times', async () => {
            await plugin.initialize();
            await plugin.dispose();
            await plugin.dispose();
            expect(plugin.isAlive()).toBe(false);
        });

        it('should be safe to dispose without initialization', async () => {
            await plugin.dispose();
            expect(plugin.isAlive()).toBe(false);
        });
    });

    describe('dispatch', () => {
        it('should auto-initialize if not started', async () => {
            const { spawn } = await import('child_process');

            // dispatch will call initialize internally, then set up a timeout
            const dispatchPromise = plugin.dispatch('action', {});

            // Allow the initialize microtask to complete
            await vi.advanceTimersByTimeAsync(0);
            expect(spawn).toHaveBeenCalled();

            // Now advance past the 30s request timeout
            await vi.advanceTimersByTimeAsync(31000);
            const result = await dispatchPromise;
            expect(result.success).toBe(false);
            expect(result.error).toContain('Timeout');
        });

        it('should handle timeout for unresponsive plugins', async () => {
            await plugin.initialize();

            const dispatchPromise = plugin.dispatch('slow-action', {});

            vi.advanceTimersByTime(31000);
            const result = await dispatchPromise;

            expect(result.success).toBe(false);
            expect(result.error).toContain('Timeout');
        });

        it('should reject when request queue is full', async () => {
            await plugin.initialize();

            // Fill the queue with 100 pending requests
            const promises: Promise<TestValue>[] = [];
            for (let i = 0; i < 100; i++) {
                promises.push(plugin.dispatch(`action-${i}`, {}));
            }

            // 101st should be rejected
            const result = await plugin.dispatch('overflow-action', {});
            expect(result.success).toBe(false);
            expect(result.error).toContain('Request queue full');

            // Cleanup: advance timers to resolve pending promises
            vi.advanceTimersByTime(31000);
            await Promise.all(promises);
        });

        it('should resolve successfully when valid JSON-RPC response received', async () => {
            await plugin.initialize();

            // Capture the write call to get the request id
            let capturedRequest: string | undefined;
            mockSpawnReturn.stdin.write.mockImplementation((data: string) => {
                capturedRequest = data;
                return true;
            });

            const dispatchPromise = plugin.dispatch('test-action', { key: 'value' });

            // Parse the written request to get the id
            await vi.advanceTimersByTimeAsync(10);
            const request = JSON.parse(capturedRequest!.trim());
            const responseMsg = JSON.stringify({
                jsonrpc: '2.0',
                id: request.id,
                result: { content: [{ type: 'text', text: 'success-data' }] }
            });

            // Simulate stdout data
            mockSpawnReturn.stdout.emit('data', responseMsg + '\n');

            const result = await dispatchPromise;
            expect(result.success).toBe(true);
            expect(result.data).toBe('success-data');
            expect(result.service).toBe('test-plugin');
            expect(result.action).toBe('test-action');
        });

        it('should handle JSON-RPC error responses', async () => {
            await plugin.initialize();

            let capturedRequest: string | undefined;
            mockSpawnReturn.stdin.write.mockImplementation((data: string) => {
                capturedRequest = data;
                return true;
            });

            const dispatchPromise = plugin.dispatch('fail-action', {});

            await vi.advanceTimersByTimeAsync(10);
            const request = JSON.parse(capturedRequest!.trim());
            const errorResponse = JSON.stringify({
                jsonrpc: '2.0',
                id: request.id,
                error: { code: -32600, message: 'Invalid Request' }
            });

            mockSpawnReturn.stdout.emit('data', errorResponse + '\n');

            const result = await dispatchPromise;
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid Request');
        });

        it('should write properly formatted JSON-RPC request', async () => {
            await plugin.initialize();

            void plugin.dispatch('my-tool', { arg1: 'hello' });

            await vi.advanceTimersByTimeAsync(10);
            expect(mockSpawnReturn.stdin.write).toHaveBeenCalled();
            const writtenData = mockSpawnReturn.stdin.write.mock.calls[0][0] as string;
            const parsed = JSON.parse(writtenData.trim());
            expect(parsed.jsonrpc).toBe('2.0');
            expect(parsed.method).toBe('tools/call');
            expect(parsed.params.name).toBe('my-tool');
            expect(parsed.params.arguments).toEqual({ arg1: 'hello' });
            expect(parsed.id).toBeDefined();

            // Cleanup
            vi.advanceTimersByTime(31000);
        });
    });

    describe('isAlive', () => {
        it('should return false before initialization', () => {
            expect(plugin.isAlive()).toBe(false);
        });

        it('should return true after initialization', async () => {
            await plugin.initialize();
            expect(plugin.isAlive()).toBe(true);
        });

        it('should return false after dispose', async () => {
            await plugin.initialize();
            await plugin.dispose();
            expect(plugin.isAlive()).toBe(false);
        });
    });

    describe('getActions', () => {
        it('should return empty array (discovery not yet implemented)', async () => {
            const actions = await plugin.getActions();
            expect(actions).toEqual([]);
        });
    });

    describe('process event handling', () => {
        it('should handle process exit event', async () => {
            await plugin.initialize();
            expect(plugin.isAlive()).toBe(true);

            mockSpawnReturn.emit('exit', 0);
            expect(plugin.isAlive()).toBe(false);
        });

        it('should handle buffer overflow protection', async () => {
            await plugin.initialize();

            // Create a chunk larger than 10MB
            const hugeChunk = 'x'.repeat(11 * 1024 * 1024);
            mockSpawnReturn.stdout.emit('data', hugeChunk);

            // Plugin should have been disposed due to buffer overflow
            expect(plugin.isAlive()).toBe(false);
        });

        it('should handle multi-line responses', async () => {
            await plugin.initialize();

            let capturedRequest: string | undefined;
            mockSpawnReturn.stdin.write.mockImplementation((data: string) => {
                capturedRequest = data;
                return true;
            });

            const dispatchPromise = plugin.dispatch('test', {});
            await vi.advanceTimersByTimeAsync(10);
            const request = JSON.parse(capturedRequest!.trim());

            // Send two responses in one chunk
            const response1 = JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { content: [{ type: 'text', text: 'ok' }] } });
            const extraLine = JSON.stringify({ jsonrpc: '2.0', id: 'unknown-id', result: {} });
            mockSpawnReturn.stdout.emit('data', response1 + '\n' + extraLine + '\n');

            const result = await dispatchPromise;
            expect(result.success).toBe(true);
            expect(result.data).toBe('ok');
        });

        it('should handle partial JSON arriving in chunks', async () => {
            await plugin.initialize();

            let capturedRequest: string | undefined;
            mockSpawnReturn.stdin.write.mockImplementation((data: string) => {
                capturedRequest = data;
                return true;
            });

            const dispatchPromise = plugin.dispatch('chunked', {});
            await vi.advanceTimersByTimeAsync(10);
            const request = JSON.parse(capturedRequest!.trim());

            const fullResponse = JSON.stringify({
                jsonrpc: '2.0',
                id: request.id,
                result: { content: [{ type: 'text', text: 'chunked-result' }] }
            });

            // Split the response into two chunks
            const mid = Math.floor(fullResponse.length / 2);
            mockSpawnReturn.stdout.emit('data', fullResponse.slice(0, mid));
            mockSpawnReturn.stdout.emit('data', fullResponse.slice(mid) + '\n');

            const result = await dispatchPromise;
            expect(result.success).toBe(true);
            expect(result.data).toBe('chunked-result');
        });
    });

    describe('resource monitoring', () => {
        it('should terminate plugin after max execution time', async () => {
            await plugin.initialize();
            expect(plugin.isAlive()).toBe(true);

            // Advance past the 5-minute max execution time + monitor interval
            vi.advanceTimersByTime(310000);

            // The resource monitor should have called dispose
            expect(plugin.isAlive()).toBe(false);
        });
    });

    describe('command resolution', () => {
        it('should accept whitelisted commands', async () => {
            const nodePlugin = new ExternalMcpPlugin('node-plugin', 'Node', {
                command: 'node',
                args: ['index.js']
            });

            await expect(nodePlugin.initialize()).resolves.toBeUndefined();
        });

        it('should accept npx command', async () => {
            const npxPlugin = new ExternalMcpPlugin('npx-plugin', 'NPX', {
                command: 'npx',
                args: ['some-tool']
            });

            await expect(npxPlugin.initialize()).resolves.toBeUndefined();
        });

        it('should accept python command', async () => {
            const pyPlugin = new ExternalMcpPlugin('py-plugin', 'Python', {
                command: 'python',
                args: ['server.py']
            });

            await expect(pyPlugin.initialize()).resolves.toBeUndefined();
        });
    });
});
