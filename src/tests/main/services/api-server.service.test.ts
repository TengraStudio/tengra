/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as http from 'http';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('ws', () => {
    class MockWebSocketServer {
        on = vi.fn();
        close = vi.fn();
    }
    return { WebSocketServer: MockWebSocketServer };
});

import type { ApiServerOptions } from '@main/api/api-server.service';
import { ApiServerService } from '@main/api/api-server.service';

/**
 * Helper: make an HTTP request against the local API server.
 */
function request(
    port: number,
    path: string,
    options: { method?: string; headers?: Record<string, string> } = {}
): Promise<{ status: number; body: Record<string, TestValue> }> {
    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                hostname: '127.0.0.1',
                port,
                path,
                method: options.method ?? 'GET',
                headers: options.headers ?? {},
            },
            (res) => {
                let data = '';
                res.on('data', (chunk: Buffer) => {
                    data += chunk.toString();
                });
                res.on('end', () => {
                    try {
                        resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
                    } catch {
                        resolve({ status: res.statusCode ?? 0, body: { raw: data } });
                    }
                });
            }
        );
        req.on('error', reject);
        req.end();
    });
}

describe('ApiServerService – AUD-2026-02-27-02 hardening', () => {
    let service: ApiServerService;
    let port: number;
    let apiToken: string;

    const mockOptions: ApiServerOptions = {
        port: 0, // let OS pick a free port
        settingsService: {
            getSettings: vi.fn().mockReturnValue({ proxy: { enabled: false, url: '' } }),
        } as never as ApiServerOptions['settingsService'],
        proxyProcessManager: {
            getStatus: vi.fn().mockReturnValue({ running: false }),
        } as never as ApiServerOptions['proxyProcessManager'],
        toolExecutor: {
            getToolDefinitions: vi.fn().mockResolvedValue([]),
            execute: vi.fn().mockResolvedValue({ success: true }),
        } as never as ApiServerOptions['toolExecutor'],
        llmService: {} as ApiServerOptions['llmService'],
    };

    beforeEach(async () => {
        service = new ApiServerService(mockOptions);
        await service.initialize();
        port = service.getPort();
        apiToken = service.getApiToken();
    });

    afterEach(async () => {
        await service.cleanup();
    });

    // ───────────────────────────────────────────────────────────
    // 1. Query-string token is denied
    // ───────────────────────────────────────────────────────────

    describe('query-string token rejection', () => {
        it('should reject ?token= with 400', async () => {
            const res = await request(port, `/api/tools/list?token=${apiToken}`, {
                headers: { Authorization: `Bearer ${apiToken}` },
            });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Bad Request');
            expect((res.body.message as string)).toContain('tokenViaQueryStringIsNotAllowedUseAuthor');
        });

        it('should reject ?api_token= with 400', async () => {
            const res = await request(port, `/health?api_token=${apiToken}`);
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Bad Request');
        });

        it('should reject ?apiToken= with 400', async () => {
            const res = await request(port, `/api/models?apiToken=${apiToken}`, {
                headers: { Authorization: `Bearer ${apiToken}` },
            });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Bad Request');
        });

        it('should allow requests without query-string token', async () => {
            const res = await request(port, '/health');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
        });

        it('should allow harmless query params that are not token', async () => {
            const res = await request(port, '/health?foo=bar');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
        });
    });

    // ───────────────────────────────────────────────────────────
    // 2. /api/auth/token endpoint security
    // ───────────────────────────────────────────────────────────

    describe('/api/auth/token endpoint security', () => {
        it('should reject /api/auth/token without challenge header (401)', async () => {
            const res = await request(port, '/api/auth/token');
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Unauthorized');
            expect((res.body.message as string)).toContain('missingOrInvalidTokenChallenge');
        });

        it('should reject /api/auth/token with invalid challenge (401)', async () => {
            const res = await request(port, '/api/auth/token', {
                headers: { 'x-tengra-token-challenge': 'invalid-nonce-value' },
            });
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Unauthorized');
        });

        it('should grant token when valid challenge is presented', async () => {
            // Step 1: get a challenge
            const challengeRes = await request(port, '/api/auth/token/challenge');
            expect(challengeRes.status).toBe(200);
            expect(challengeRes.body.success).toBe(true);
            const challenge = challengeRes.body.challenge as string;
            expect(challenge).toBeTruthy();

            // Step 2: redeem challenge for a token
            const tokenRes = await request(port, '/api/auth/token', {
                headers: { 'x-tengra-token-challenge': challenge },
            });
            expect(tokenRes.status).toBe(200);
            expect(tokenRes.body.token).toBe(apiToken);
        });

        it('should reject challenge replay (one-time use)', async () => {
            const challengeRes = await request(port, '/api/auth/token/challenge');
            const challenge = challengeRes.body.challenge as string;

            // First use succeeds
            const firstUse = await request(port, '/api/auth/token', {
                headers: { 'x-tengra-token-challenge': challenge },
            });
            expect(firstUse.status).toBe(200);

            // Replay is rejected
            const replay = await request(port, '/api/auth/token', {
                headers: { 'x-tengra-token-challenge': challenge },
            });
            expect(replay.status).toBe(401);
        });
    });

    // ───────────────────────────────────────────────────────────
    // 3. Non-local request simulation via IconX-Forwarded-For
    // ───────────────────────────────────────────────────────────

    describe('local-only endpoint abuse attempts', () => {
        it('should reject /api/auth/token/challenge when IconX-Forwarded-For is set', async () => {
            const res = await request(port, '/api/auth/token/challenge', {
                headers: { 'x-forwarded-for': '203.0.113.50' },
            });
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Forbidden');
            expect((res.body.message as string)).toContain('localAccessRequired');
        });

        it('should reject /api/auth/token when IconX-Forwarded-For is set', async () => {
            const res = await request(port, '/api/auth/token', {
                headers: { 'x-forwarded-for': '203.0.113.50' },
            });
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Forbidden');
        });
    });

    // ───────────────────────────────────────────────────────────
    // 4. Auth header is required for private routes
    // ───────────────────────────────────────────────────────────

    describe('authentication enforcement', () => {
        it('should reject private route without token (401)', async () => {
            const res = await request(port, '/api/tools/list');
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Unauthorized');
        });

        it('should reject private route with wrong token (401)', async () => {
            const res = await request(port, '/api/tools/list', {
                headers: { Authorization: 'Bearer wrong-token' },
            });
            expect(res.status).toBe(401);
        });

        it('should accept private route with valid Bearer token', async () => {
            const res = await request(port, '/api/tools/list', {
                headers: { Authorization: `Bearer ${apiToken}` },
            });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});

