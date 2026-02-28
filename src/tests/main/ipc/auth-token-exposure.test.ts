/**
 * Security regression test: auth:poll-token must NEVER return access_token to the renderer.
 * AUD-2026-02-27-01
 */
import { type AuthIpcDependencies,registerAuthIpc } from '@main/ipc/auth';
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

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('@main/utils/ipc-batch.util', () => ({
    registerBatchableHandler: vi.fn()
}));

const FAKE_ACCESS_TOKEN = 'ghu_FAKE_ACCESS_TOKEN_12345';
const FAKE_REFRESH_TOKEN = 'ghr_FAKE_REFRESH_TOKEN_67890';

/** Recursively check that a value contains no token strings. */
function assertNoTokenLeak(value: unknown, path = 'root'): void {
    if (value === null || value === undefined) {
        return;
    }
    if (typeof value === 'string') {
        expect(value, `Token leaked at ${path}`).not.toBe(FAKE_ACCESS_TOKEN);
        expect(value, `Refresh token leaked at ${path}`).not.toBe(FAKE_REFRESH_TOKEN);
        return;
    }
    if (Array.isArray(value)) {
        for (const [i, item] of value.entries()) {
            assertNoTokenLeak(item, `${path}[${i}]`);
        }
        return;
    }
    if (typeof value === 'object') {
        for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
            assertNoTokenLeak(v, `${path}.${key}`);
        }
    }
}

describe('AUD-2026-02-27-01: auth:poll-token must not expose access_token', () => {
    let handlers: Map<string, (...args: unknown[]) => Promise<unknown>>;
    let deps: AuthIpcDependencies;

    beforeEach(() => {
        handlers = new Map();
        vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: unknown) => {
            handlers.set(channel, handler as (...args: unknown[]) => Promise<unknown>);
        });

        deps = {
            proxyService: {
                initiateGitHubAuth: vi.fn(),
                waitForGitHubToken: vi.fn().mockResolvedValue({
                    access_token: FAKE_ACCESS_TOKEN,
                    refresh_token: FAKE_REFRESH_TOKEN,
                    expires_in: 3600,
                    token_type: 'bearer',
                    scope: 'read:user user:email'
                }),
                fetchGitHubProfile: vi.fn().mockResolvedValue({
                    displayName: 'Test User',
                    avatarUrl: 'https://example.com/avatar.png',
                    email: 'test@example.com',
                    login: 'testuser'
                }),
                fetchGitHubEmails: vi.fn().mockResolvedValue('test@example.com')
            } as unknown as AuthIpcDependencies['proxyService'],
            copilotService: {
                setGithubToken: vi.fn()
            } as unknown as AuthIpcDependencies['copilotService'],
            authService: {
                linkAccount: vi.fn().mockResolvedValue({
                    id: 'acct-1',
                    provider: 'copilot',
                    email: 'test@example.com',
                    displayName: 'Test User',
                    avatarUrl: 'https://example.com/avatar.png',
                    isActive: true,
                    createdAt: Date.now()
                }),
                detectProvider: vi.fn().mockReturnValue('copilot')
            } as unknown as AuthIpcDependencies['authService'],
            auditLogService: {
                logAuthenticationEvent: vi.fn().mockResolvedValue(undefined)
            } as unknown as AuthIpcDependencies['auditLogService'],
            getMainWindow: vi.fn().mockReturnValue({
                webContents: { id: 1 },
                isDestroyed: vi.fn().mockReturnValue(false)
            }),
            eventBus: {
                on: vi.fn()
            } as unknown as AuthIpcDependencies['eventBus']
        };

        registerAuthIpc(deps);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should not contain access_token in successful poll response', async () => {
        const handler = handlers.get('auth:poll-token');
        expect(handler).toBeDefined();

        const fakeEvent = { sender: { id: 1 } };
        const result = await handler!(fakeEvent, 'device-code-123', 5, 'copilot');

        assertNoTokenLeak(result);

        const resultObj = result as Record<string, unknown>;
        expect(resultObj).toHaveProperty('success', true);
        expect(resultObj).toHaveProperty('account');
        expect(resultObj).not.toHaveProperty('access_token');
        expect(resultObj).not.toHaveProperty('token');
        expect(resultObj).not.toHaveProperty('accessToken');
        expect(resultObj).not.toHaveProperty('refreshToken');
        expect(resultObj).not.toHaveProperty('refresh_token');
    });

    it('should not contain access_token in profile poll response', async () => {
        const handler = handlers.get('auth:poll-token');

        vi.mocked(deps.authService.linkAccount as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: 'acct-2',
            provider: 'github',
            email: 'test@example.com',
            displayName: 'Test User',
            avatarUrl: 'https://example.com/avatar.png',
            isActive: true,
            createdAt: Date.now()
        });

        const fakeEvent = { sender: { id: 1 } };
        const result = await handler!(fakeEvent, 'device-code-456', 5, 'profile');

        assertNoTokenLeak(result);
    });

    it('should not contain access_token in error response', async () => {
        const handler = handlers.get('auth:poll-token');

        vi.mocked(deps.proxyService.waitForGitHubToken as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('authorization_pending')
        );

        const fakeEvent = { sender: { id: 1 } };
        const result = await handler!(fakeEvent, 'device-code-789', 5, 'copilot');

        assertNoTokenLeak(result);
        const resultObj = result as Record<string, unknown>;
        expect(resultObj).toHaveProperty('success', false);
        expect(resultObj).not.toHaveProperty('access_token');
        expect(resultObj).not.toHaveProperty('token');
    });

    it('should only contain allowed fields in the account object', async () => {
        const handler = handlers.get('auth:poll-token');
        const fakeEvent = { sender: { id: 1 } };
        const result = await handler!(fakeEvent, 'device-code-123', 5, 'copilot');

        const account = (result as { account?: Record<string, unknown> }).account;
        expect(account).toBeDefined();

        const ALLOWED_FIELDS = new Set([
            'id', 'provider', 'email', 'displayName', 'avatarUrl', 'isActive', 'createdAt'
        ]);
        for (const key of Object.keys(account!)) {
            expect(ALLOWED_FIELDS.has(key), `Unexpected field "${key}" in account response`).toBe(true);
        }
    });
});
