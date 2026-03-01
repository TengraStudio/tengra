import * as http from 'http';

import { LinkedAccount } from '@main/services/data/database.service';
import { AuthService } from '@main/services/security/auth.service';
import { AuthAPIService } from '@main/services/security/auth-api.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger');
vi.mock('@main/services/security/auth.service');

let service: AuthAPIService;
let mockAuthService: AuthService;

const makeAccount = (overrides: Partial<LinkedAccount> = {}): LinkedAccount => ({
    id: 'github-acc-1',
    provider: 'github',
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-456',
    sessionToken: undefined,
    email: 'user@example.com',
    displayName: 'Test User',
    avatarUrl: undefined,
    expiresAt: Date.now() + 3600000,
    scope: 'repo',
    isActive: true,
    metadata: {},
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
    ...overrides
});

/** Helper to make an HTTP request to the test server. */
function request(
    port: number,
    method: string,
    path: string,
    body?: string,
    headers?: Record<string, string>
): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
        const req = http.request(
            { hostname: '127.0.0.1', port, method, path, headers },
            (res) => {
                let data = '';
                res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
                res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body: data }));
            }
        );
        req.on('error', reject);
        if (body) { req.write(body); }
        req.end();
    });
}

beforeEach(() => {
    vi.clearAllMocks();

    mockAuthService = {
        getAllAccountsFull: vi.fn().mockResolvedValue([]),
        linkAccountWithId: vi.fn().mockResolvedValue(undefined),
        getActiveToken: vi.fn(),
        getActiveAccountFull: vi.fn(),
        getAccountsByProviderFull: vi.fn().mockResolvedValue([]),
    } as unknown as AuthService;

    service = new AuthAPIService(mockAuthService);
});

afterEach(async () => {
    await service.cleanup();
});

describe('AuthAPIService - Lifecycle', () => {
    it('should start server and assign a port on initialize', async () => {
        await service.initialize();
        const port = service.getPort();
        expect(port).toBeGreaterThan(0);
    });

    it('should stop server on cleanup', async () => {
        await service.initialize();
        const port = service.getPort();
        await service.cleanup();

        // Server should be closed, request should fail
        await expect(request(port, 'GET', '/api/auth/accounts')).rejects.toThrow();
    });

    it('should handle cleanup when server is not initialized', async () => {
        await expect(service.cleanup()).resolves.toBeUndefined();
    });
});

describe('AuthAPIService - API Key Auth', () => {
    it('should reject requests without API key when key is set', async () => {
        await service.initialize();
        service.setApiKey('secret-key');

        const res = await request(service.getPort(), 'GET', '/api/auth/accounts');

        expect(res.statusCode).toBe(401);
        expect(JSON.parse(res.body)).toEqual({ error: 'Unauthorized' });
    });

    it('should accept requests with correct API key', async () => {
        await service.initialize();
        service.setApiKey('secret-key');

        const res = await request(
            service.getPort(), 'GET', '/api/auth/accounts',
            undefined,
            { authorization: 'Bearer secret-key' }
        );

        expect(res.statusCode).toBe(200);
    });

    it('should allow requests when no API key is set', async () => {
        await service.initialize();

        const res = await request(service.getPort(), 'GET', '/api/auth/accounts');

        expect(res.statusCode).toBe(200);
    });
});

describe('AuthAPIService - GET /api/auth/accounts', () => {
    it('should return accounts from auth service', async () => {
        const account = makeAccount();
        vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([account]);

        await service.initialize();
        const res = await request(service.getPort(), 'GET', '/api/auth/accounts');

        expect(res.statusCode).toBe(200);
        const parsed = JSON.parse(res.body) as { accounts: Array<{ id: string; provider: string }> };
        expect(parsed.accounts).toHaveLength(1);
        expect(parsed.accounts[0]?.id).toBe('github-acc-1');
        expect(parsed.accounts[0]?.provider).toBe('github');
    });

    it('should cache accounts response', async () => {
        vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([makeAccount()]);

        await service.initialize();
        const port = service.getPort();

        await request(port, 'GET', '/api/auth/accounts');
        await request(port, 'GET', '/api/auth/accounts');

        // Should only call getAllAccountsFull once due to caching
        expect(mockAuthService.getAllAccountsFull).toHaveBeenCalledTimes(1);
    });

    it('should handle auth service errors gracefully', async () => {
        vi.mocked(mockAuthService.getAllAccountsFull).mockRejectedValue(new Error('DB error'));

        await service.initialize();
        const res = await request(service.getPort(), 'GET', '/api/auth/accounts');

        expect(res.statusCode).toBe(500);
    });
});

describe('AuthAPIService - POST /api/auth/accounts/:id', () => {
    it('should update an account with token data', async () => {
        await service.initialize();

        const body = JSON.stringify({
            access_token: 'new-token',
            refresh_token: 'new-refresh',
            provider: 'github',
            email: 'user@example.com'
        });

        const res = await request(
            service.getPort(), 'POST', '/api/auth/accounts/github-acc-1',
            body,
            { 'content-type': 'application/json' }
        );

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toEqual({ success: true });
        expect(mockAuthService.linkAccountWithId).toHaveBeenCalledWith(
            'github',
            'github-acc-1',
            expect.objectContaining({ accessToken: 'new-token' })
        );
    });

    it('should reject empty body', async () => {
        await service.initialize();

        const res = await request(
            service.getPort(), 'POST', '/api/auth/accounts/acc-1',
            '',
            { 'content-type': 'application/json' }
        );

        expect(res.statusCode).toBe(400);
    });
});

describe('AuthAPIService - CORS and routing', () => {
    it('should handle OPTIONS requests', async () => {
        await service.initialize();

        const res = await request(service.getPort(), 'OPTIONS', '/api/auth/accounts');

        expect(res.statusCode).toBe(200);
    });

    it('should return 404 for unknown routes', async () => {
        await service.initialize();

        const res = await request(service.getPort(), 'GET', '/api/unknown');

        expect(res.statusCode).toBe(404);
    });
});

describe('AuthAPIService - Provider Normalization', () => {
    it('should normalize anthropic to claude', async () => {
        await service.initialize();

        const account = makeAccount({ provider: 'anthropic', id: 'claude-acc' });
        vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([account]);

        const res = await request(service.getPort(), 'GET', '/api/auth/accounts');
        const parsed = JSON.parse(res.body) as { accounts: Array<{ provider: string }> };

        expect(parsed.accounts[0]?.provider).toBe('claude');
    });

    it('should normalize openai to codex', async () => {
        await service.initialize();

        const account = makeAccount({ provider: 'openai', id: 'openai-acc' });
        vi.mocked(mockAuthService.getAllAccountsFull).mockResolvedValue([account]);

        const res = await request(service.getPort(), 'GET', '/api/auth/accounts');
        const parsed = JSON.parse(res.body) as { accounts: Array<{ provider: string }> };

        expect(parsed.accounts[0]?.provider).toBe('codex');
    });
});
