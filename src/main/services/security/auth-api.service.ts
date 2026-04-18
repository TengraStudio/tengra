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

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { AuthService } from '@main/services/security/auth.service';
import { JsonObject, JsonValue } from '@shared/types/common';
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
    private accountsCache: { expiresAt: number; payload: string } | null = null;
    private readonly accountsCacheTtlMs = 1500;
    private accountsInFlight: Promise<string> | null = null;
    private readonly updateInFlightByAccount = new Map<string, Promise<void>>();
    private static readonly SENSITIVE_METADATA_KEYS = new Set([
        'access_token',
        'accesstoken',
        'refresh_token',
        'refreshtoken',
        'session_token',
        'sessiontoken',
        'id_token',
        'idtoken',
        'authorization',
        'code',
        'token',
    ]);

    constructor(private authService: AuthService) {
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
                    } else if (
                        req.url?.startsWith('/api/auth/accounts/') &&
                        req.method === 'POST'
                    ) {
                        await this.handleUpdateAccount(req, res);
                    } else {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Not found' }));
                    }
                })();
            });

            this.server.on('error', err => {
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
            return new Promise(resolve => {
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
            const payload = await this.getAccountsPayloadCached();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(payload);
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

            const existingAccount = await this.getExistingAccount(accountId);
            if (!existingAccount) {
                this.sendError(res, 404, 'Account not found');
                return;
            }

            const tokenData = this.mapToTokenData(data);
            const provider = this.resolveProviderForAccountUpdate(existingAccount, data);

            await this.runAccountUpdateExclusive(accountId, async () => {
                await this.authService.linkAccountWithId(provider, accountId, {
                    ...tokenData,
                    accessToken: tokenData.accessToken ?? '',
                });
            });
            this.accountsCache = null;

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } catch (error) {
            appLogger.error('AuthAPIService', `Failed to update account: ${error}`);
            this.sendError(res, 500, 'Internal server error');
        }
    }

    private resolveProviderForAccountUpdate(
        existingAccount: import('@main/services/data/database.service').LinkedAccount,
        data: JsonObject
    ): string {
        const providerHint = this.getString(data, 'provider', 'type');
        if (providerHint) {
            return this.normalizeProviderName(providerHint);
        }

        if (existingAccount.provider) {
            return this.normalizeProviderName(existingAccount.provider);
        }

        return 'unknown';
    }

    private async getExistingAccount(
        accountId: string
    ): Promise<import('@main/services/data/database.service').LinkedAccount | undefined> {
        const allAccounts = await this.authService.getAllAccountsFull();
        return allAccounts.find(account => account.id === accountId);
    }

    private async getAccountsPayloadCached(): Promise<string> {
        const now = Date.now();
        if (this.accountsCache && this.accountsCache.expiresAt > now) {
            return this.accountsCache.payload;
        }

        if (this.accountsInFlight) {
            return this.accountsInFlight;
        }

        this.accountsInFlight = (async () => {
            const accounts = await this.authService.getAllAccountsFull();
            const authData = accounts.map(acc => this.mapAccountToAuthData(acc));
            const payload = JSON.stringify({ accounts: authData });
            this.accountsCache = {
                expiresAt: Date.now() + this.accountsCacheTtlMs,
                payload
            };
            return payload;
        })();

        try {
            return await this.accountsInFlight;
        } finally {
            this.accountsInFlight = null;
        }
    }

    private async runAccountUpdateExclusive(accountId: string, fn: () => Promise<void>): Promise<void> {
        const prev = this.updateInFlightByAccount.get(accountId) ?? Promise.resolve();
        const next = prev.catch(() => undefined).then(fn);
        this.updateInFlightByAccount.set(accountId, next);
        try {
            await next;
        } finally {
            if (this.updateInFlightByAccount.get(accountId) === next) {
                this.updateInFlightByAccount.delete(accountId);
            }
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
            displayName:
                this.getString(data, 'label', 'displayName') ??
                this.getString(metadata, 'label', 'displayName'),
            avatarUrl:
                this.getString(data, 'avatar_url', 'avatarUrl') ??
                this.getString(metadata, 'avatar_url', 'avatarUrl'),
            metadata,
        };
    }

    private getString(obj: JsonObject | undefined, ...keys: string[]): string | undefined {
        if (!obj) {
            return undefined;
        }
        for (const key of keys) {
            if (typeof obj[key] === 'string') {
                return obj[key] as string;
            }
        }
        return undefined;
    }

    private getNumber(obj: JsonObject | undefined, ...keys: string[]): number | undefined {
        if (!obj) {
            return undefined;
        }
        for (const key of keys) {
            const val = obj[key];
            if (typeof val === 'number') {
                return val;
            }
            if (typeof val === 'string') {
                const parsed = Number(val);
                if (!isNaN(parsed)) {
                    return parsed;
                }
            }
        }
        return undefined;
    }

    private sendError(res: http.ServerResponse, statusCode: number, message: string) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: message }));
    }

    private mapAccountToAuthData(
        acc: import('@main/services/data/database.service').LinkedAccount
    ) {
        const normalizedProvider = this.normalizeProviderName(acc.provider);
        // Go proxy expects 'claude' for model routing
        const providerForGo = normalizedProvider === 'anthropic' ? 'claude' : normalizedProvider;
        const isClaudeProvider = providerForGo === 'claude';
        const isCodexProvider = providerForGo === 'codex';

        const metadata = this.prepareMetadata(
            acc.metadata,
            providerForGo,
            isClaudeProvider,
            isCodexProvider,
            acc.email
        );

        return {
            id: acc.id,
            provider: providerForGo,
            type: providerForGo,
            email: acc.email,
            label: acc.displayName ?? acc.email ?? acc.provider,
            access_token: acc.accessToken,
            refresh_token: isClaudeProvider || isCodexProvider ? undefined : acc.refreshToken,
            session_token: acc.sessionToken,
            expires_at: acc.expiresAt,
            scope: acc.scope,
            metadata,
            created_at: acc.createdAt,
            updated_at: acc.updatedAt,
        };
    }

    private prepareMetadata(
        existingMetadata: JsonObject | undefined,
        providerForGo: string,
        isClaudeProvider: boolean,
        isCodexProvider: boolean,
        email?: string
    ): JsonObject {
        const baseMetadata = this.stripSensitiveMetadata(existingMetadata);

        if (isClaudeProvider || isCodexProvider) {
            // tengra-proxy owns Claude/Codex refresh; this bridge only exposes access tokens
            delete (baseMetadata as { refresh_token?: RuntimeValue }).refresh_token;
            delete (baseMetadata as { refreshToken?: RuntimeValue }).refreshToken;
        }

        return {
            ...baseMetadata,
            type: providerForGo,
            auth_type: isClaudeProvider ? 'oauth' : (existingMetadata?.auth_type ?? 'oauth'),
            email: email,
        };
    }

    private stripSensitiveMetadata(metadata: JsonObject | undefined): JsonObject {
        if (!metadata) {
            return {};
        }

        const sanitized = this.stripSensitiveMetadataValue(metadata);
        if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) {
            return {};
        }

        return sanitized;
    }

    private stripSensitiveMetadataValue(value: JsonValue): JsonValue | undefined {
        if (Array.isArray(value)) {
            const sanitizedArray = value
                .map(entry => this.stripSensitiveMetadataValue(entry))
                .filter((entry): entry is JsonValue => entry !== undefined);
            return sanitizedArray;
        }

        if (!value || typeof value !== 'object') {
            return value;
        }

        const sanitizedEntries: Array<[string, JsonValue]> = [];
        for (const [key, entry] of Object.entries(value)) {
            if (AuthAPIService.SENSITIVE_METADATA_KEYS.has(key.toLowerCase())) {
                continue;
            }

            const sanitizedEntry = this.stripSensitiveMetadataValue(entry as JsonValue);
            if (sanitizedEntry !== undefined) {
                sanitizedEntries.push([key, sanitizedEntry]);
            }
        }

        return Object.fromEntries(sanitizedEntries);
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
            github: 'github',
            github_token: 'github',
            copilot: 'copilot',
            copilot_token: 'copilot',
            antigravity: 'antigravity',
            antigravity_token: 'antigravity',
            google: 'antigravity',
            google_token: 'antigravity',
            anthropic: 'claude',
            anthropic_key: 'claude',
            claude: 'claude',
            openai: 'codex',
            openai_key: 'codex',
            codex: 'codex',
            gemini: 'gemini',
            gemini_key: 'gemini',
        };

        return mappings[p] ?? p;
    }
}
