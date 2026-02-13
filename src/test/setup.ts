import { vi } from 'vitest';

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

