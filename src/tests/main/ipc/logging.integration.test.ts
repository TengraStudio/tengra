/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface LogEntry {
    id: string;
    level: string;
    source: string;
    message: string;
    timestamp: Date;
}

const mockIpcMainHandlers = new Map<string, (...args: TestValue[]) => Promise<TestValue>>();
const mockIpcMainListeners = new Map<string, (...args: TestValue[]) => void>();
const mockWindows: TestValue[] = [];

// Mock electron
vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: TestValue[]) => TestValue | Promise<TestValue>) => {
            mockIpcMainHandlers.set(channel, async (...args: TestValue[]) => Promise.resolve(handler(...args)));
        }),
        on: vi.fn((channel: string, handler: (...args: TestValue[]) => void) => {
            mockIpcMainListeners.set(channel, handler);
        }),
        removeHandler: vi.fn((channel: string) => {
            mockIpcMainHandlers.delete(channel);
        }),
        removeListener: vi.fn((channel: string) => {
            mockIpcMainListeners.delete(channel);
        }),
    },
    BrowserWindow: {
        getAllWindows: vi.fn(() => mockWindows),
        fromWebContents: vi.fn((sender: TestValue) => {
            return { id: (sender as { id: number }).id };
        }),
    },
}));

// Mock logger
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
    LogLevel: {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
    },
}));

// Mock IPC wrapper

// Import module under test AFTER mocks
import { pushLogEntry, registerLoggingIpc } from '@main/ipc/logging';

describe('Logging IPC Handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIpcMainHandlers.clear();
        mockIpcMainListeners.clear();
        mockWindows.length = 0;

        // Register handlers
        registerLoggingIpc();
    });

    describe('log:stream:start', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should enable log streaming', async () => {
            const handler = mockIpcMainHandlers.get('log:stream:start');
            expect(handler).toBeDefined();

            const result = await handler!({});

            expect(result).toEqual({ success: true });
        });

        it('should allow log entries to be streamed after start', async () => {
            const mockWindow = {
                webContents: {
                    send: vi.fn(),
                },
            };
            mockWindows.push(mockWindow);

            // Start streaming
            const handler = mockIpcMainHandlers.get('log:stream:start');
            await handler!({});

            // Push a log entry
            pushLogEntry('info', 'TestService', 'Test message');

            // Fast-forward time to trigger batch flush
            vi.advanceTimersByTime(100);

            // Verify it was sent to window
            expect(mockWindow.webContents.send).toHaveBeenCalledWith(
                'log:entry-batch',
                expect.arrayContaining([
                    expect.objectContaining({
                        level: 'info',
                        source: 'TestService',
                        message: 'Test message',
                    })
                ])
            );
        });
    });

    describe('log:stream:stop', () => {
        it('should disable log streaming', async () => {
            const handler = mockIpcMainHandlers.get('log:stream:stop');
            expect(handler).toBeDefined();

            const result = await handler!({});

            expect(result).toEqual({ success: true });
        });

        it('should stop streaming log entries after stop', async () => {
            const mockWindow = {
                webContents: {
                    send: vi.fn(),
                },
            };
            mockWindows.push(mockWindow);

            // Start then stop streaming
            await mockIpcMainHandlers.get('log:stream:start')!({});
            await mockIpcMainHandlers.get('log:stream:stop')!({});

            // Push a log entry
            pushLogEntry('info', 'TestService', 'Test message');

            // Verify it was NOT sent to window
            expect(mockWindow.webContents.send).not.toHaveBeenCalled();
        });
    });

    describe('log:buffer:get', () => {
        it('should return recent log entries', async () => {
            // Add some log entries
            pushLogEntry('debug', 'Service1', 'Debug message');
            pushLogEntry('info', 'Service2', 'Info message');
            pushLogEntry('warn', 'Service3', 'Warning message');
            pushLogEntry('error', 'Service4', 'Error message');

            const handler = mockIpcMainHandlers.get('log:buffer:get');
            expect(handler).toBeDefined();

            const result = await handler!({}) as LogEntry[];

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThanOrEqual(4);
            expect(result[result.length - 1]).toMatchObject({
                level: 'error',
                source: 'Service4',
                message: 'Error message',
            });
        });

        it('should return empty array if no logs', async () => {
            // Clear buffer first
            await mockIpcMainHandlers.get('log:buffer:clear')!({});

            const handler = mockIpcMainHandlers.get('log:buffer:get');
            const result = await handler!({});

            expect(result).toEqual([]);
        });

        it('should limit to last 500 entries', async () => {
            // Add more than 500 entries
            for (let i = 0; i < 600; i++) {
                pushLogEntry('info', 'TestService', `Message ${i}`);
            }

            const handler = mockIpcMainHandlers.get('log:buffer:get');
            const result = await handler!({}) as LogEntry[];

            expect(result.length).toBeLessThanOrEqual(500);
        });
    });

    describe('log:buffer:clear', () => {
        it('should clear log buffer', async () => {
            // Add some entries
            pushLogEntry('info', 'Service1', 'Message 1');
            pushLogEntry('info', 'Service2', 'Message 2');

            const handler = mockIpcMainHandlers.get('log:buffer:clear');
            expect(handler).toBeDefined();

            const result = await handler!({});

            expect(result).toEqual({ success: true });

            // Verify buffer is empty
            const getHandler = mockIpcMainHandlers.get('log:buffer:get');
            const buffer = await getHandler!({});
            expect(buffer).toEqual([]);
        });
    });

    describe('log:write', () => {
        it('should have log:write listener registered', () => {
            const handler = mockIpcMainListeners.get('log:write');
            expect(handler).toBeDefined();
        });

        it('should preserve structured renderer context for persisted log entries', async () => {
            const handler = mockIpcMainListeners.get('log:write');
            expect(handler).toBeDefined();

            await mockIpcMainHandlers.get('log:buffer:clear')!({});
            handler!(
                { sender: { id: 7 } },
                {
                    level: 1,
                    message: 'streaming-state apply chatId=test',
                    context: 'processChatStream',
                }
            );

            const getHandler = mockIpcMainHandlers.get('log:buffer:get');
            const buffer = await getHandler!({}) as LogEntry[];
            expect(buffer.at(-1)).toMatchObject({
                level: 'info',
                source: 'renderer:processChatStream',
                message: 'streaming-state apply chatId=test',
            });
        });
    });

    describe('pushLogEntry', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should add entry to buffer with timestamp and ID', async () => {
            const handler = mockIpcMainHandlers.get('log:buffer:clear');
            await handler!({});

            pushLogEntry('info', 'TestSource', 'Test message');

            const getHandler = mockIpcMainHandlers.get('log:buffer:get');
            const buffer = await getHandler!({}) as LogEntry[];

            expect(buffer.length).toBe(1);
            expect(buffer[0]).toMatchObject({
                level: 'info',
                source: 'TestSource',
                message: 'Test message',
            });
            expect(buffer[0].id).toBeDefined();
            expect(buffer[0].timestamp).toBeInstanceOf(Date);
        });

        it('should maintain buffer size limit of 1000', async () => {
            const handler = mockIpcMainHandlers.get('log:buffer:clear');
            await handler!({});

            // Add 1100 entries
            for (let i = 0; i < 1100; i++) {
                pushLogEntry('info', 'TestService', `Message ${i}`);
            }

            const getHandler = mockIpcMainHandlers.get('log:buffer:get');
            const buffer = await getHandler!({}) as LogEntry[];

            expect(buffer.length).toBeLessThanOrEqual(500); // get returns last 500
        });

        it('should handle window destruction gracefully during streaming', async () => {
            const mockWindow = {
                webContents: {
                    send: vi.fn(() => {
                        throw new Error('Window destroyed');
                    }),
                },
            };
            mockWindows.push(mockWindow);

            // Start streaming
            await mockIpcMainHandlers.get('log:stream:start')!({});

            // This should not throw
            expect(() => {
                pushLogEntry('info', 'TestService', 'Test message');
                vi.advanceTimersByTime(100);
            }).not.toThrow();
        });
    });
});

