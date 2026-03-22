import { appLogger } from '@main/logging/logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { spawnMock } = vi.hoisted(() => ({
    spawnMock: vi.fn(() => ({
        stdout: {
            on: vi.fn(),
        },
        stderr: {
            on: vi.fn(),
        },
        on: vi.fn((event: string, cb: (...args: TestValue[]) => void) => {
            if (event === 'close') {
                setTimeout(() => cb(0), 0);
            }
        }),
        unref: vi.fn(),
    }))
}));

const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');

function setProcessPlatform(value: NodeJS.Platform): void {
    Object.defineProperty(process, 'platform', { value });
}

function restoreProcessPlatform(): void {
    if (originalPlatformDescriptor) {
        Object.defineProperty(process, 'platform', originalPlatformDescriptor);
    }
}

// Mock BrowserWindow
const mockMainWindow = {
    webContents: { id: 1, getZoomFactor: vi.fn(), setZoomFactor: vi.fn() },
    minimize: vi.fn(),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    close: vi.fn(),
    setSize: vi.fn(),
    center: vi.fn(),
    setFullScreen: vi.fn(),
    isFullScreen: vi.fn(),
    isMaximized: vi.fn(),
    isMinimized: vi.fn(),
    isDestroyed: vi.fn(),
    restore: vi.fn(),
    focus: vi.fn(),
    once: vi.fn(),
    loadURL: vi.fn(),
};

const mockIpcMainHandlers = new Map<string, (...args: TestValue[]) => Promise<TestValue>>();
const mockIpcMainListeners = new Map<string, (...args: TestValue[]) => void>();

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
        fromWebContents: vi.fn((sender: TestValue) => {
            return (sender as Record<string, TestValue>).id === 1 ? mockMainWindow : null;
        }),
    },
    shell: {
        openExternal: vi.fn().mockResolvedValue(undefined),
        openPath: vi.fn().mockResolvedValue(''),
    },
    app: {
        getPath: vi.fn((name: string) => {
            if (name === 'userData') {
                return '/app/userData';
            }
            return '/app';
        }),
    },
    session: {
        defaultSession: {
            cookies: {
                get: vi.fn(),
                set: vi.fn(),
                remove: vi.fn(),
            },
        },
    },
}));

// Mock logger
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

// Mock child_process
vi.mock('child_process', () => ({
    spawn: spawnMock,
}));

// Import module under test AFTER mocks
import { registerWindowIpc } from '@main/ipc/window';

describe('Window IPC Handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIpcMainHandlers.clear();
        mockIpcMainListeners.clear();

        mockMainWindow.isMaximized.mockReturnValue(false);
        mockMainWindow.isFullScreen.mockReturnValue(false);
        mockMainWindow.isMinimized.mockReturnValue(false);
        mockMainWindow.isDestroyed.mockReturnValue(false);
        mockMainWindow.webContents.getZoomFactor.mockReturnValue(1);

        // Trigger registration
        registerWindowIpc(() => mockMainWindow as never, new Set<string>(['/app']));
    });

    const mockEvent = { sender: { id: 1 } } as never;


    afterEach(() => {
        restoreProcessPlatform();
        // Clean up handlers
        mockIpcMainHandlers.clear();
        mockIpcMainListeners.clear();
    });

    describe('window:minimize', () => {
        it('should minimize window', () => {
            const handler = mockIpcMainListeners.get('window:minimize');
            expect(handler).toBeDefined();


            handler!(mockEvent);

            expect(mockMainWindow.minimize).toHaveBeenCalled();
        });

        it('should ignore unauthorized sender', async () => {
            const handler = mockIpcMainListeners.get('window:minimize');
            expect(handler).toBeDefined();

            const unauthorizedEvent = { sender: { id: 999 } }; // Unauthorized
            handler!(unauthorizedEvent as never);

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockMainWindow.minimize).not.toHaveBeenCalled();
            expect(appLogger.warn).toHaveBeenCalledWith(
                'Security',
                expect.stringContaining('Unauthorized window operation attempt')
            );
        });
    });

    describe('window:maximize', () => {
        it('should maximize window when not maximized', () => {
            mockMainWindow.isMaximized.mockReturnValue(false);

            const handler = mockIpcMainListeners.get('window:maximize');
            expect(handler).toBeDefined();


            handler!(mockEvent);

            expect(mockMainWindow.maximize).toHaveBeenCalled();
            expect(mockMainWindow.unmaximize).not.toHaveBeenCalled();
        });

        it('should unmaximize window when already maximized', () => {
            mockMainWindow.isMaximized.mockReturnValue(true);

            const handler = mockIpcMainListeners.get('window:maximize');

            handler!(mockEvent);

            expect(mockMainWindow.unmaximize).toHaveBeenCalled();
            expect(mockMainWindow.maximize).not.toHaveBeenCalled();
        });
    });

    describe('window:close', () => {
        it('should close window', () => {
            const handler = mockIpcMainListeners.get('window:close');
            expect(handler).toBeDefined();


            handler!(mockEvent);

            expect(mockMainWindow.close).toHaveBeenCalled();
        });
    });

    describe('window:toggle-compact', () => {
        it('should enable compact mode', () => {
            const handler = mockIpcMainListeners.get('window:toggle-compact');
            expect(handler).toBeDefined();


            handler!(mockEvent, true);


            expect(mockMainWindow.setSize).toHaveBeenCalledWith(400, 600);
        });

        it('should disable compact mode', () => {
            const handler = mockIpcMainListeners.get('window:toggle-compact');


            handler!(mockEvent, false);


            expect(mockMainWindow.setSize).toHaveBeenCalledWith(1200, 800);
        });
    });

    describe('window:resize', () => {
        it('should resize window to specified resolution', () => {
            const handler = mockIpcMainListeners.get('window:resize');
            expect(handler).toBeDefined();


            handler!(mockEvent, '1920x1080');


            expect(mockMainWindow.setSize).toHaveBeenCalledWith(1920, 1080);
            expect(mockMainWindow.center).toHaveBeenCalled();
        });

        it('should handle invalid resolution format gracefully', () => {
            const handler = mockIpcMainListeners.get('window:resize');


            handler!(mockEvent, 'invalid');


            // Should not throw or crash
            expect(mockMainWindow.setSize).not.toHaveBeenCalled();
        });

        it('should ignore resolution with missing dimensions', () => {
            const handler = mockIpcMainListeners.get('window:resize');


            handler!(mockEvent, '1920x');


            expect(mockMainWindow.setSize).not.toHaveBeenCalled();
        });
    });

    describe('window:toggle-fullscreen', () => {
        it('should enable fullscreen when not in fullscreen', () => {
            mockMainWindow.isFullScreen.mockReturnValue(false);

            const handler = mockIpcMainListeners.get('window:toggle-fullscreen');
            expect(handler).toBeDefined();


            handler!(mockEvent);

            expect(mockMainWindow.setFullScreen).toHaveBeenCalledWith(true);
        });

        it('should disable fullscreen when in fullscreen', () => {
            mockMainWindow.isFullScreen.mockReturnValue(true);

            const handler = mockIpcMainListeners.get('window:toggle-fullscreen');


            handler!(mockEvent);

            expect(mockMainWindow.setFullScreen).toHaveBeenCalledWith(false);
        });
    });

    describe('window zoom', () => {
        it('should return current zoom factor', async () => {
            const handler = mockIpcMainHandlers.get('window:get-zoom-factor');
            expect(handler).toBeDefined();

            const result = await handler!(mockEvent);

            expect(result).toEqual({ zoomFactor: 1 });
        });

        it('should set zoom factor', async () => {
            const handler = mockIpcMainHandlers.get('window:set-zoom-factor');
            expect(handler).toBeDefined();

            const result = await handler!(mockEvent, 1.25);

            expect(mockMainWindow.webContents.setZoomFactor).toHaveBeenCalledWith(1.25);
            expect(result).toEqual({ zoomFactor: 1.25 });
        });

        it('should step zoom factor', async () => {
            const handler = mockIpcMainHandlers.get('window:step-zoom-factor');
            expect(handler).toBeDefined();

            const result = await handler!(mockEvent, 1);

            expect(mockMainWindow.webContents.setZoomFactor).toHaveBeenCalledWith(1.1);
            expect(result).toEqual({ zoomFactor: 1.1 });
        });
    });

    describe('shell:openExternal', () => {
        it('should open URL in external browser', async () => {
            const electron = await import('electron');

            const handler = mockIpcMainHandlers.get('shell:openExternal');
            expect(handler).toBeDefined();

            const result = await handler!(mockEvent, 'https://example.com');

            expect(electron.shell.openExternal).toHaveBeenCalledWith('https://example.com/');
            expect(result).toEqual({ success: true, data: { success: true } });
        });

        it('should reject empty URL', async () => {
            const handler = mockIpcMainHandlers.get('shell:openExternal');

            const result = await handler!(mockEvent, '');

            expect(result).toEqual({
                success: true,
                data: {
                    success: false,
                    error: 'Validation failed',
                    messageKey: 'mainProcess.window.shellOpenExternal.validationFailed'
                }
            });
        });

        it('should reject overly long URL', async () => {
            const handler = mockIpcMainHandlers.get('shell:openExternal');
            const longUrl = 'https://' + 'a'.repeat(2500) + '.com';

            const result = await handler!(mockEvent, longUrl);

            expect(result).toEqual({
                success: true,
                data: {
                    success: false,
                    error: 'Validation failed',
                    messageKey: 'mainProcess.window.shellOpenExternal.validationFailed'
                }
            });
        });
    });

    describe('shell:openTerminal', () => {
        it('should open terminal with command', async () => {
            const handler = mockIpcMainHandlers.get('shell:openTerminal');
            expect(handler).toBeDefined();

            const result = await handler!(mockEvent, 'echo hello');

            expect(result).toEqual({ success: true, data: true });
        });
    });

    describe('shell:runCommand', () => {
        it('should run command with args and cwd', async () => {
            const handler = mockIpcMainHandlers.get('shell:runCommand');
            expect(handler).toBeDefined();

            const result = await handler!(mockEvent, 'git', ['status'], '/app');


            expect(result).toEqual({ success: true, data: { stdout: '', stderr: '', code: 0, error: '' } });
        });

        it('should allow Windows shim commands without throwing spawn errors', async () => {
            const handler = mockIpcMainHandlers.get('shell:runCommand');
            expect(handler).toBeDefined();

            const originalComSpec = process.env.ComSpec;
            setProcessPlatform('win32');
            process.env.ComSpec = 'C:\\Windows\\System32\\cmd.exe';

            const result = await handler!(mockEvent, 'npm', ['--version'], '/app');

            expect(result).toEqual({ success: true, data: { stdout: '', stderr: '', code: 0, error: '' } });
            expect(spawnMock).toHaveBeenCalledWith(
                'C:\\Windows\\System32\\cmd.exe',
                ['/d', '/s', '/c', 'npm.cmd', '--version'],
                {
                    cwd: '/app',
                    shell: false
                }
            );
            if (originalComSpec === undefined) {
                delete process.env.ComSpec;
            } else {
                process.env.ComSpec = originalComSpec;
            }
        });
    });

    describe('window:captureCookies', () => {
        it('should have captureCookies handler registered', () => {
            const handler = mockIpcMainHandlers.get('window:captureCookies');
            expect(handler).toBeDefined();
        });
    });
});

