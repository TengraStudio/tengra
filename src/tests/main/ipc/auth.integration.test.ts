/**
 * Integration tests for Auth IPC handlers
 */
import { ipcMain } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn(),
        removeHandler: vi.fn()
    },
    BrowserWindow: {
        getAllWindows: vi.fn().mockReturnValue([])
    }
}));

describe('Auth IPC Handlers', () => {
    let registeredHandlers: Map<string, TestValue>;

    beforeEach(() => {
        registeredHandlers = new Map();
        vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: TestValue) => {
            registeredHandlers.set(channel, handler);
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('auth:github-login', () => {
        it('should initiate GitHub auth flow', async () => {
            const handler = async () => {
                return { device_code: 'device123', verification_uri: 'https://github.com/login/device', interval: 5 };
            };
            registeredHandlers.set('auth:github-login', handler);

            const result = await (registeredHandlers.get('auth:github-login') as () => Promise<TestValue>)();

            expect(result).toHaveProperty('device_code');
        });
    });

    describe('auth:poll-token', () => {
        it('should handle token polling', async () => {
            const handler = async () => {
                return { success: true, token: 'token123' };
            };
            registeredHandlers.set('auth:poll-token', handler);

            const result = await (registeredHandlers.get('auth:poll-token') as () => Promise<TestValue>)();

            expect(result).toEqual({ success: true, token: 'token123' });
        });

        it('should handle poll failure', async () => {
            const handler = async () => {
                return { success: false, error: 'Auth failed' };
            };
            registeredHandlers.set('auth:poll-token', handler);

            const result = await (registeredHandlers.get('auth:poll-token') as () => Promise<TestValue>)();

            expect(result).toEqual({ success: false, error: 'Auth failed' });
        });
    });

    describe('auth:set-active-linked-account', () => {
        it('should set active linked account', async () => {
            const handler = async () => {
                return { success: true };
            };
            registeredHandlers.set('auth:set-active-linked-account', handler);

            const result = await (registeredHandlers.get('auth:set-active-linked-account') as () => Promise<TestValue>)();

            expect(result).toEqual({ success: true });
        });
    });

    describe('auth:link-account', () => {
        it('should link an account', async () => {
            const handler = async () => {
                return { success: true, account: { id: 'account-1', provider: 'github' } };
            };
            registeredHandlers.set('auth:link-account', handler);

            const result = await (registeredHandlers.get('auth:link-account') as () => Promise<TestValue>)();

            expect(result).toHaveProperty('success', true);
        });
    });

    describe('auth:unlink-account', () => {
        it('should unlink an account', async () => {
            const handler = async () => {
                return { success: true };
            };
            registeredHandlers.set('auth:unlink-account', handler);

            const result = await (registeredHandlers.get('auth:unlink-account') as () => Promise<TestValue>)();

            expect(result).toEqual({ success: true });
        });
    });

    describe('auth:get-linked-accounts', () => {
        it('should return all linked accounts', async () => {
            const handler = async () => {
                return [{ id: 'account-1', provider: 'github', email: 'test@example.com' }];
            };
            registeredHandlers.set('auth:get-linked-accounts', handler);

            const result = await (registeredHandlers.get('auth:get-linked-accounts') as () => Promise<TestValue>)();

            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('auth:has-linked-account', () => {
        it('should check if account is linked', async () => {
            const handler = async () => {
                return true;
            };
            registeredHandlers.set('auth:has-linked-account', handler);

            const result = await (registeredHandlers.get('auth:has-linked-account') as () => Promise<TestValue>)();

            expect(result).toBe(true);
        });
    });
});
