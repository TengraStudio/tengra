import * as os from 'os';
import * as path from 'path';

import { vi } from 'vitest';

interface MockWindow {
    webContents?: {
        id?: number;
    };
}

interface MockSender {
    id?: number;
    webContents?: {
        id?: number;
    };
}

interface MockIpcInvokeEvent {
    sender?: MockSender;
}

type MockHandler = (...args: readonly RuntimeValue[]) => RuntimeValue | Promise<RuntimeValue>;

interface MockSchema {
    parse: (args: readonly RuntimeValue[]) => RuntimeValue;
}

interface MockIpcHandlerOptions {
    wrapResponse?: boolean;
    onError?: (error: RuntimeValue, handlerName: string) => RuntimeValue | Promise<RuntimeValue>;
    argsSchema?: MockSchema;
    onValidationFailed?: (error: RuntimeValue, handlerName: string) => void;
    defaultValue?: RuntimeValue;
}

vi.mock('@main/ipc/sender-validator', () => ({
    createMainWindowSenderValidator: (
        getMainWindow: () => MockWindow | null,
        operationName: string
    ) => (event: MockIpcInvokeEvent) => {
        // If event is a minimal mock (empty object), skip validation to avoid breaking existing tests
        const senderId = event.sender?.id ?? event.sender?.webContents?.id;
        if (senderId === undefined) { return; }

        const win = getMainWindow();
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
    const original = await importOriginal<typeof import('@main/utils/ipc-wrapper.util')>();

    const toRuntimeValue = <T>(value: T): RuntimeValue => {
        if (
            typeof value === 'string'
            || typeof value === 'number'
            || typeof value === 'bigint'
            || typeof value === 'boolean'
            || typeof value === 'symbol'
            || value === null
            || value === undefined
            || typeof value === 'object'
        ) {
            return value as RuntimeValue;
        }
        return String(value);
    };

    const formatError = (error: RuntimeValue, wrapResponse: boolean): RuntimeValue => {
        const message = error instanceof Error
            ? error.message
            : typeof error === 'object' && error && 'message' in error
                ? String((error as Record<string, RuntimeValue>).message ?? error)
                : String(error);
        const code = typeof error === 'object' && error && 'code' in error
            ? String((error as Record<string, RuntimeValue>).code ?? 'IPC_HANDLER_ERROR')
            : 'IPC_HANDLER_ERROR';
        const context = typeof error === 'object' && error && 'context' in error
            ? (error as Record<string, RuntimeValue>).context
            : undefined;

        if (wrapResponse) {
            return {
                success: false,
                error: {
                    message,
                    code,
                    ...(context !== undefined ? { context } : {})
                }
            };
        }
        throw error instanceof Error ? error : new Error(message);
    };

    return {
        ...original,
        createIpcHandler: (
            name: string,
            handler: MockHandler,
            options: MockIpcHandlerOptions = {}
        ) => async (...args: readonly RuntimeValue[]) => {
            const wrapResponse = options?.wrapResponse === true;
            try {
                const result = await handler(...args);
                return wrapResponse ? { success: true, data: result } : result;
            } catch (error) {
                if (options?.onError) {
                    try {
                        const errorResult = await Promise.resolve(options.onError(toRuntimeValue(error), name));
                        return wrapResponse ? { success: true, data: errorResult } : errorResult;
                    } catch (innerError) {
                        return formatError(toRuntimeValue(innerError), wrapResponse);
                    }
                }
                return formatError(toRuntimeValue(error), wrapResponse);
            }
        },
        createSafeIpcHandler: (
            _name: string,
            handler: MockHandler,
            defaultValue: RuntimeValue,
            options: MockIpcHandlerOptions = {}
        ) => async (...args: readonly RuntimeValue[]) => {
            const wrapResponse = options?.wrapResponse === true;
            try {
                const result = await handler(...args);
                return wrapResponse ? { success: true, data: result } : result;
            } catch {
                return wrapResponse ? { success: true, data: defaultValue } : defaultValue;
            }
        },
        createValidatedIpcHandler: (
            name: string,
            handler: MockHandler,
            options: MockIpcHandlerOptions = {}
        ) => {
            return async (...args: readonly RuntimeValue[]) => {
                const wrapResponse = options?.wrapResponse === true;
                const restArgs = args.slice(1);

                if (options?.argsSchema) {
                    try {
                        options.argsSchema.parse(restArgs);
                    } catch (error) {
                        try {
                            if (options?.onValidationFailed) {
                                options.onValidationFailed(toRuntimeValue(error), name);
                            }
                        } catch (onValError) {
                            return formatError(toRuntimeValue(onValError), wrapResponse);
                        }

                        if (options?.onError) {
                            try {
                                const errorResult = await Promise.resolve(options.onError(toRuntimeValue(error), name));
                                return wrapResponse ? { success: true, data: errorResult } : errorResult;
                            } catch (innerError) {
                                return formatError(toRuntimeValue(innerError), wrapResponse);
                            }
                        }

                        if (options?.defaultValue !== undefined) {
                            return wrapResponse ? { success: true, data: options.defaultValue } : options.defaultValue;
                        }

                        return formatError(toRuntimeValue(error), wrapResponse);
                    }
                }

                try {
                    const result = await handler(...args);
                    return wrapResponse ? { success: true, data: result } : result;
                } catch (error) {
                    if (options?.onError) {
                        try {
                            const errorResult = await Promise.resolve(options.onError(toRuntimeValue(error), name));
                            return wrapResponse ? { success: true, data: errorResult } : errorResult;
                        } catch (innerError) {
                            return formatError(toRuntimeValue(innerError), wrapResponse);
                        }
                    }
                    if (options?.defaultValue !== undefined) {
                        return wrapResponse ? { success: true, data: options.defaultValue } : options.defaultValue;
                    }
                    return formatError(toRuntimeValue(error), wrapResponse);
                }
            };
        }
    };
});

// Global mocks for Electron
vi.mock('electron', () => ({
    app: {
        getPath: vi.fn((name: string) => {
            const testRoot = path.join(os.tmpdir(), 'tengra-tests');
            if (name === 'logs') {
                return path.join(testRoot, 'logs');
            }
            if (name === 'userData') {
                return path.join(testRoot, 'userData');
            }
            return testRoot;
        }),
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
    return originalModule;
});

