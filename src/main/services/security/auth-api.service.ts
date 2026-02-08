import * as http from 'http';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { AuthService } from '@main/services/security/auth.service';
import { JsonObject } from '@shared/types/common';
import { safeJsonParse } from '@shared/utils/sanitize.util';

/**
 * Auth API Service
 * 
 * Provides HTTP endpoints for the Go proxy to fetch auth tokens from the database
 * without needing to write temporary JSON files.
 */
export class AuthAPIService extends BaseService {
    private server: http.Server | null = null;
    private port: number = 0;
    private apiKey: string = '';

    constructor(
        private authService: AuthService
    ) {
        super('AuthAPIService');
    }

    override async initialize(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                void (async () => {
                    // CORS headers
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
                    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

                    if (req.method === 'OPTIONS') {
                        res.writeHead(200);
                        res.end();
                        return;
                    }

                    // Authentication check
                    const authHeader = req.headers['authorization'];
                    if (this.apiKey && (!authHeader || authHeader !== `Bearer ${this.apiKey}`)) {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Unauthorized' }));
                        return;
                    }

                    if (req.url === '/api/auth/accounts' && req.method === 'GET') {
                        await this.handleGetAccounts(req, res);
                    } else if (req.url?.startsWith('/api/auth/accounts/') && req.method === 'POST') {
                        await this.handleUpdateAccount(req, res);
                    } else {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Not found' }));
                    }
                })();
            });

            this.server.on('error', (err) => {
                appLogger.error('AuthAPIService', `Server error: ${err.message}`);
                reject(err);
            });

            // Listen on random available port
            this.server.listen(0, '127.0.0.1', () => {
                const server = this.server;
                if (!server) {
                    reject(new Error('Server not initialized'));
                    return;
                }
                const address = server.address();
                if (address && typeof address === 'object') {
                    this.port = address.port;
                    appLogger.info('AuthAPIService', `Auth API listening on port ${this.port}`);
                    resolve();
                } else {
                    reject(new Error('Failed to get server address'));
                }
            });
        });
    }

    override async cleanup(): Promise<void> {
        const server = this.server;
        if (server) {
            return new Promise((resolve) => {
                server.close(() => {
                    appLogger.info('AuthAPIService', 'Auth API server stopped');
                    resolve();
                });
            });
        }
    }

    getPort(): number {
        return this.port;
    }

    setApiKey(key: string): void {
        this.apiKey = key;
    }

    private async handleGetAccounts(_req: http.IncomingMessage, res: http.ServerResponse) {
        try {
            const accounts = await this.authService.getAllAccountsFull();
            // Transform to format expected by Go proxy
            const authData = accounts.map(acc => this.mapAccountToAuthData(acc));

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ accounts: authData }));
        } catch (error) {
            appLogger.error('AuthAPIService', `Failed to get accounts: ${error}`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }

    private async handleUpdateAccount(req: http.IncomingMessage, res: http.ServerResponse) {
        try {
            const accountId = this.extractAccountId(req);
            if (!accountId) {
                this.sendError(res, 400, 'Missing account ID');
                return;
            }

            const body = await this.readRequestBody(req);
            const data = safeJsonParse(body, {} as JsonObject);

            if (Object.keys(data).length === 0) {
                this.sendError(res, 400, 'Invalid JSON body');
                return;
            }

            const tokenData = this.mapToTokenData(data);
            const provider = this.normalizeProviderName(accountId.split('-')[0]);

            // linkAccount handles both updating existing accounts (by email) and creating new ones
            await this.authService.linkAccount(provider, {
                ...tokenData,
                // Ensure accessToken is present as it's required for linkAccount type
                accessToken: tokenData.accessToken ?? ''
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } catch (error) {
            appLogger.error('AuthAPIService', `Failed to update account: ${error}`);
            this.sendError(res, 500, 'Internal server error');
        }
    }

    private extractAccountId(req: http.IncomingMessage): string | undefined {
        const urlParts = req.url?.split('/') ?? [];
        return urlParts[urlParts.length - 1];
    }

    private async readRequestBody(req: http.IncomingMessage): Promise<string> {
        let body = '';
        for await (const chunk of req) {
            body += chunk;
        }
        return body;
    }

    private mapToTokenData(data: JsonObject) {
        const metadata = data.metadata as JsonObject | undefined;
        return {
            accessToken: this.getString(data, 'access_token', 'accessToken'),
            refreshToken: this.getString(data, 'refresh_token', 'refreshToken'),
            sessionToken: this.getString(data, 'session_token', 'sessionToken'),
            expiresAt: this.getNumber(data, 'expires_at', 'expiresAt'),
            email: this.getString(data, 'email') ?? this.getString(metadata, 'email'),
            displayName: this.getString(data, 'label', 'displayName') ?? this.getString(metadata, 'label', 'displayName'),
            avatarUrl: this.getString(data, 'avatar_url', 'avatarUrl') ?? this.getString(metadata, 'avatar_url', 'avatarUrl'),
            metadata
        };
    }

    private getString(obj: JsonObject | undefined, ...keys: string[]): string | undefined {
        if (!obj) { return undefined; }
        for (const key of keys) {
            if (typeof obj[key] === 'string') { return obj[key] as string; }
        }
        return undefined;
    }

    private getNumber(obj: JsonObject | undefined, ...keys: string[]): number | undefined {
        if (!obj) { return undefined; }
        for (const key of keys) {
            const val = obj[key];
            if (typeof val === 'number') { return val; }
            if (typeof val === 'string') {
                const parsed = Number(val);
                if (!isNaN(parsed)) { return parsed; }
            }
        }
        return undefined;
    }

    private sendError(res: http.ServerResponse, statusCode: number, message: string) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: message }));
    }

    private mapAccountToAuthData(acc: import('@main/services/data/database.service').LinkedAccount) {
        const normalizedProvider = this.normalizeProviderName(acc.provider);
        // Go proxy expects 'claude' for model routing
        const providerForGo = normalizedProvider === 'anthropic' ? 'claude' : normalizedProvider;
        const isClaudeProvider = providerForGo === 'claude';

        const metadata = this.prepareMetadata(acc.metadata, providerForGo, isClaudeProvider, acc.email);

        return {
            id: acc.id,
            provider: providerForGo,
            type: providerForGo,
            email: acc.email,
            label: acc.displayName ?? acc.email ?? acc.provider,
            access_token: acc.accessToken,
            refresh_token: isClaudeProvider ? undefined : acc.refreshToken,
            session_token: acc.sessionToken,
            expires_at: acc.expiresAt,
            scope: acc.scope,
            metadata,
            created_at: acc.createdAt,
            updated_at: acc.updatedAt
        };
    }

    private prepareMetadata(
        existingMetadata: JsonObject | undefined,
        providerForGo: string,
        isClaudeProvider: boolean,
        email?: string
    ): JsonObject {
        const baseMetadata: JsonObject = { ...(existingMetadata ?? {}) };

        if (isClaudeProvider) {
            // Let Rust token-service own Claude refresh; proxy sees only access token
            delete (baseMetadata as { refresh_token?: unknown }).refresh_token;
            delete (baseMetadata as { refreshToken?: unknown }).refreshToken;
        }

        return {
            ...baseMetadata,
            type: providerForGo,
            auth_type: isClaudeProvider ? 'oauth' : (existingMetadata?.auth_type ?? 'oauth'),
            email: email
        };
    }

    private normalizeProviderName(provider: string): string {
        let p = provider.toLowerCase();

        // Strip emails (e.g. claude-user@gmail.com -> claude)
        if (p.includes('@')) {
            p = p.split('-')[0].split('_')[0];
        }

        // Strip common suffixes
        p = p.replace(/(_token|_key|_auth)$/, '');

        const mappings: Record<string, string> = {
            'github': 'github', 'github_token': 'github',
            'copilot': 'copilot', 'copilot_token': 'copilot',
            'antigravity': 'antigravity', 'antigravity_token': 'antigravity',
            'anthropic': 'claude', 'anthropic_key': 'claude', 'claude': 'claude',
            'openai': 'codex', 'openai_key': 'codex', 'codex': 'codex',
            'gemini': 'gemini', 'gemini_key': 'gemini'
        };

        return mappings[p] ?? p;
    }
}

