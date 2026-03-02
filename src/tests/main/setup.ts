import { vi } from 'vitest';

vi.mock('@main/ipc/sender-validator', () => ({
    createMainWindowSenderValidator: (getMainWindow: any, operationName: string) => (event: any) => {
        // If event is a minimal mock (empty object), skip validation to avoid breaking existing tests
        if (!event?.sender) { return; }

        const win = getMainWindow();
        const senderId = event.sender.id ?? event.sender.webContents?.id;
        const winId = win?.webContents?.id;

        if (winId !== undefined && senderId !== winId) {
            void import('@main/logging/logger').then(({ appLogger }) => {
                appLogger.warn('Security', `Unauthorized ${operationName} attempt from sender ${senderId}`);
            });
            throw new Error(`Unauthorized ${operationName}`);
        }
    }
}));

vi.mock('@main/utils/ipc-wrapper.util', async (importOriginal) => {
    const original: any = await importOriginal();

    const formatError = (error: any, wrapResponse: boolean) => {
        const message = error.message || String(error);
        const code = error.code || 'IPC_HANDLER_ERROR'; // Match createIpcHandler's default

        if (wrapResponse) {
            return {
                success: false,
                error: {
                    message,
                    code,
                    ...(error.context ? { context: error.context } : {})
                }
            };
        }
        throw error;
    };

    return {
        ...original,
        createIpcHandler: (name: string, handler: (...args: unknown[]) => unknown, options?: any) => async (...args: unknown[]) => {
            const wrapResponse = options?.wrapResponse === true;
            try {
                const result = await handler(...args as any);
                return wrapResponse ? { success: true, data: result } : result;
            } catch (error: any) {
                if (options?.onError) {
                    try {
                        const errorResult = await Promise.resolve(options.onError(error, name));
                        return wrapResponse ? { success: true, data: errorResult } : errorResult;
                    } catch (innerError: any) {
                        return formatError(innerError, wrapResponse);
                    }
                }
                return formatError(error, wrapResponse);
            }
        },
        createSafeIpcHandler: (_name: string, handler: (...args: unknown[]) => unknown, defaultValue: unknown, options?: any) => async (...args: unknown[]) => {
            const wrapResponse = options?.wrapResponse === true;
            try {
                const result = await (handler as any)(...args);
                return wrapResponse ? { success: true, data: result } : result;
            } catch {
                return wrapResponse ? { success: true, data: defaultValue } : defaultValue;
            }
        },
        createValidatedIpcHandler: (name: string, handler: (...args: any[]) => any, options: any) => {
            return async (...args: any[]) => {
                const wrapResponse = options?.wrapResponse === true;
                const restArgs = args.slice(1);

                if (options?.argsSchema) {
                    try {
                        options.argsSchema.parse(restArgs);
                    } catch (error: any) {
                        try {
                            if (options?.onValidationFailed) {
                                options.onValidationFailed(error, name);
                            }
                        } catch (onValError: any) {
                            return formatError(onValError, wrapResponse);
                        }

                        if (options?.onError) {
                            try {
                                const errorResult = await Promise.resolve(options.onError(error, name));
                                return wrapResponse ? { success: true, data: errorResult } : errorResult;
                            } catch (innerError: any) {
                                return formatError(innerError, wrapResponse);
                            }
                        }

                        if (options?.defaultValue !== undefined) {
                            return wrapResponse ? { success: true, data: options.defaultValue } : options.defaultValue;
                        }

                        return formatError(error, wrapResponse);
                    }
                }

                try {
                    const result = await handler(...args);
                    return wrapResponse ? { success: true, data: result } : result;
                } catch (error: any) {
                    if (options?.onError) {
                        try {
                            const errorResult = await Promise.resolve(options.onError(error, name));
                            return wrapResponse ? { success: true, data: errorResult } : errorResult;
                        } catch (innerError: any) {
                            return formatError(innerError, wrapResponse);
                        }
                    }
                    if (options?.defaultValue !== undefined) {
                        return wrapResponse ? { success: true, data: options.defaultValue } : options.defaultValue;
                    }
                    return formatError(error, wrapResponse);
                }
            };
        }
    };
});

// Global mocks for Electron
vi.mock('electron', () => ({
    app: {
        getPath: vi.fn(() => '/tmp'),
        isPackaged: false,
        getVersion: vi.fn(() => '0.0.0-test'),
        quit: vi.fn(),
        on: vi.fn(),
        whenReady: vi.fn().mockResolvedValue(undefined),
    },
    ipcMain: {
        handle: vi.fn(),
        on: vi.fn(),
        removeHandler: vi.fn(),
    },
    ipcRenderer: {
        invoke: vi.fn(),
        on: vi.fn(),
        send: vi.fn(),
        removeAllListeners: vi.fn(),
    },
    BrowserWindow: vi.fn(() => ({
        loadURL: vi.fn(),
        webContents: {
            send: vi.fn(),
            on: vi.fn(),
        },
        on: vi.fn(),
        isDestroyed: vi.fn(() => false),
    })),
    net: {
        request: vi.fn(),
    },
    session: {
        defaultSession: {
            cookies: {
                get: vi.fn(),
            },
        },
    },
    shell: {
        openExternal: vi.fn(),
    },
    dialog: {
        showOpenDialog: vi.fn(),
        showSaveDialog: vi.fn(),
    },
}));

// Mock fs
vi.mock('fs', async (importOriginal) => {
    const originalModule = await importOriginal<typeof import('fs')>();
    return {
        ...originalModule,
        existsSync: vi.fn(() => true),
        readFileSync: vi.fn(() => '{}'),
        writeFileSync: vi.fn(),
        mkdirSync: vi.fn(),
        readdirSync: vi.fn(() => []),
        statSync: vi.fn(() => ({ isDirectory: () => false, size: 0 })),
    };
});

// Mock path
vi.mock('path', async (importOriginal) => {
    const originalModule = await importOriginal<typeof import('path')>();
    return {
        ...originalModule,
        join: (...args: string[]) => args.join('/'),
        dirname: (p: string) => p.substring(0, p.lastIndexOf('/')),
        resolve: (...args: string[]) => args.join('/'),
    };
});

