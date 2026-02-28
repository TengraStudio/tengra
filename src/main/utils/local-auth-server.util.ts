import * as crypto from 'crypto';
import * as http from 'http';
import { AddressInfo } from 'net';

import { appLogger } from '@main/logging/logger';
import { CatchError } from '@shared/types/common';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { net } from 'electron';
import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Represents the result of an initiated authentication flow.
 */
export interface AuthResult {
    /** The URL to open in the browser for authentication */
    url: string;
    /** The state string used for OAuth security */
    state: string;
}

/**
 * Represents the core token data returned from an OAuth provider.
 */
export interface AuthTokenData {
    /** The primary access token */
    access_token: string;
    /** Optional refresh token for obtaining new access tokens */
    refresh_token?: string;
    /** Number of seconds until the access token expires */
    expires_in: number;
    /** The type of token (usually 'Bearer') */
    token_type?: string;
    /** The scopes granted by the user */
    scope?: string;
}

/**
 * Represents the full callback data including user and project context.
 */
export interface AuthCallbackData extends AuthTokenData {
    /** User's email address if available from id_token or profile */
    email?: string;
    /** Provider-specific account type */
    type?: string;
    /** Associated project ID */
    project_id?: string;
}

interface ClaudeCallbackParams {
    code: string
    verifier: string
    redirectUri: string
    callbackState: string
    oauthState: string
    onSuccess: (data: AuthCallbackData) => Promise<void> | void
    onError: (err: CatchError) => void
    res: http.ServerResponse
}

/**
 * Utility class to handle local OAuth callbacks and token exchange.
 * Supports Antigravity (Google) and Claude (Anthropic) authentication flows.
 */
export class LocalAuthServer {
    /** Client ID for Antigravity (Google) OAuth */
    private static readonly CLIENT_ID = process.env['GOOGLE_CLIENT_ID'] ?? '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
    /** Antigravity (Google) Authorization endpoint */
    private static readonly AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
    /** Antigravity (Google) Token exchange endpoint */
    private static readonly TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
    /** Google JWKS endpoint for id_token signature verification */
    private static readonly GOOGLE_JWKS_URL = new URL('https://www.googleapis.com/oauth2/v3/certs');
    /** Google userinfo endpoint (fallback when JWT verification unavailable) */
    private static readonly GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';

    // Claude Constants
    /** Client ID for Claude (Anthropic) OAuth */
    private static readonly CLAUDE_CLIENT_ID = process.env['ANTIGRAVITY_CLAUDE_CLIENT_ID'] ?? '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
    /** Claude Authorization endpoint */
    private static readonly CLAUDE_AUTH_ENDPOINT = 'https://claude.ai/oauth/authorize';
    /** Claude Token exchange endpoint */
    private static readonly CLAUDE_TOKEN_ENDPOINT = 'https://api.anthropic.com/v1/oauth/token';
    /** Claude userinfo endpoint (fallback when id_token verification unavailable) */
    private static readonly CLAUDE_USERINFO_ENDPOINT = 'https://api.anthropic.com/v1/me';

    /**
     * Handles the callback from Antigravity (Google) OAuth.
     * Exchanges the authorization code for tokens.
     */
    private static async handleAntigravityCallback(
        code: string,
        verifier: string,
        redirectUri: string,
        onSuccess: (data: AuthCallbackData) => void,
        onError: (err: CatchError) => void
    ): Promise<void> {
        try {
            if (!verifier) { throw new Error('Code verifier missing'); }
            const tokenData = await LocalAuthServer.exchangeCodeForToken(code, verifier, redirectUri);
            onSuccess(tokenData);
        } catch (e) {
            onError(e as Error);
        }
    }

    /**
     * Handles the callback from Claude (Anthropic) OAuth.
     * Exchanges the authorization code for tokens and sends response to browser.
     */
    private static async handleClaudeCallback(params: ClaudeCallbackParams): Promise<void> {
        const { code, verifier, redirectUri, callbackState, oauthState, onSuccess, onError, res } = params;
        try {
            if (!verifier) { throw new Error('Code verifier missing'); }
            if (!callbackState || callbackState !== oauthState) {
                throw new Error('OAuth state validation failed');
            }

            const tokenData = await LocalAuthServer.exchangeCodeForClaudeToken(code, verifier, redirectUri, callbackState);

            await onSuccess(tokenData);

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Login Successful!</h1><p>You can close this window and return to Tengra.</p>');
        } catch (e) {
            const err = e as Error;
            appLogger.error('LocalAuthServer', `Claude Auth Failed: ${err.message}`, err);
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end(`<h1>Auth Failed</h1><p>Error exchanging token:</p><pre>${err.message}</pre>`);
            onError(err);
        }
    }


    /**
     * Internal request handler for Antigravity OAuth callback server.
     */
    private static createAntigravityRequestHandler(
        server: http.Server,
        verifier: string,
        oauthState: string,
        onSuccess: (data: AuthCallbackData) => void,
        onError: (err: CatchError) => void
    ) {
        return (req: http.IncomingMessage, res: http.ServerResponse) => {
            void (async () => {
                try {
                    const address = server.address() as AddressInfo | null;
                    if (!address) { return; }

                    const url = new URL(req.url ?? '/', `http://127.0.0.1:${address.port}`);

                    if (url.pathname === '/callback') {
                        const code = url.searchParams.get('code');
                        const callbackState = url.searchParams.get('state');
                        const error = url.searchParams.get('error');

                        if (error) {
                            appLogger.error('LocalAuthServer', `Callback error: ${error}`);
                            res.writeHead(400, { 'Content-Type': 'text/html' });
                            res.end('<h1>Auth Failed</h1><p>Check the app for details.</p><script>window.close()</script>');
                            onError(new Error(error));
                            server.close();
                            return;
                        }

                        if (!callbackState || callbackState !== oauthState) {
                            appLogger.error('LocalAuthServer', 'OAuth state validation failed for Antigravity callback');
                            res.writeHead(400, { 'Content-Type': 'text/html' });
                            res.end('<h1>Auth Failed</h1><p>Invalid state parameter.</p><script>window.close()</script>');
                            onError(new Error('OAuth state validation failed'));
                            server.close();
                            return;
                        }

                        if (code) {
                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.end('<h1>Auth Successful</h1><p>You can close this window and return to Tengra.</p><script>setTimeout(() => window.close(), 1000)</script>');

                            await LocalAuthServer.handleAntigravityCallback(code, verifier, `http://127.0.0.1:${address.port}/callback`, onSuccess, onError);
                            server.close();
                        }
                    } else {
                        res.writeHead(404);
                        res.end();
                    }
                } catch (err) {
                    appLogger.error('LocalAuthServer', 'Server handler error', err as Error);
                }
            })();
        };
    }

    /**
     * Starts the Antigravity OAuth flow using PKCE.
     */
    static async startAntigravityAuth(
        onSuccess: (data: AuthCallbackData) => void,
        onError: (err: CatchError) => void
    ): Promise<AuthResult> {
        return new Promise((resolve, reject) => {
            // PKCE Variables (captured by closure)
            let verifier: string;
            let oauthState: string;

            const server = http.createServer();

            server.on('request', (req, res) => {
                const handler = LocalAuthServer.createAntigravityRequestHandler(server, verifier, oauthState, onSuccess, onError);
                handler(req, res);
            });

            server.listen(0, '127.0.0.1', () => {
                try {
                    const address = server.address() as AddressInfo;
                    const port = address.port;
                    const redirectUri = `http://127.0.0.1:${port}/callback`;
                    oauthState = crypto.randomBytes(16).toString('hex');

                    // PKCE Generation
                    verifier = LocalAuthServer.generateCodeVerifier();
                    const challenge = LocalAuthServer.generateCodeChallenge(verifier);

                    const authUrl = new URL(LocalAuthServer.AUTH_ENDPOINT);
                    authUrl.searchParams.append('client_id', LocalAuthServer.CLIENT_ID);
                    authUrl.searchParams.append('redirect_uri', redirectUri);
                    authUrl.searchParams.append('response_type', 'code');
                    authUrl.searchParams.append('scope', 'email profile openid https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/cclog https://www.googleapis.com/auth/experimentsandconfigs');
                    authUrl.searchParams.append('state', oauthState);
                    authUrl.searchParams.append('code_challenge', challenge);
                    authUrl.searchParams.append('code_challenge_method', 'S256');
                    authUrl.searchParams.append('access_type', 'offline'); // Get refresh token
                    authUrl.searchParams.append('prompt', 'consent');

                    resolve({ url: authUrl.toString(), state: oauthState });
                } catch (e) {
                    server.close();
                    reject(e);
                }
            });
        });
    }

    /**
     * Internal request handler for Claude OAuth callback server.
     */
    private static createClaudeRequestHandler(
        server: http.Server,
        verifier: string,
        oauthState: string,
        onSuccess: (data: AuthCallbackData) => Promise<void> | void,
        onError: (err: CatchError) => void
    ) {
        return (req: http.IncomingMessage, res: http.ServerResponse) => {
            void (async () => {
                try {
                    const address = server.address() as AddressInfo | null;
                    if (!address) { return; }

                    const url = new URL(req.url ?? '/', `http://127.0.0.1:${address.port}`);

                    if (url.pathname === '/callback') {
                        const code = url.searchParams.get('code');
                        const callbackState = url.searchParams.get('state');
                        const error = url.searchParams.get('error');

                        if (error) {
                            appLogger.error('LocalAuthServer', `Claude Callback error: ${error}`);
                            res.writeHead(400, { 'Content-Type': 'text/html' });
                            res.end('<h1>Auth Failed</h1><p>Check the app.</p><script>window.close()</script>');
                            onError(new Error(error));
                            server.close();
                            return;
                        }

                        if (!callbackState || callbackState !== oauthState) {
                            appLogger.error('LocalAuthServer', 'OAuth state validation failed for Claude callback');
                            res.writeHead(400, { 'Content-Type': 'text/html' });
                            res.end('<h1>Auth Failed</h1><p>Invalid state parameter.</p><script>window.close()</script>');
                            onError(new Error('OAuth state validation failed'));
                            server.close();
                            return;
                        }

                        if (code) {
                            await LocalAuthServer.handleClaudeCallback({
                                code,
                                verifier,
                                redirectUri: `http://localhost:${address.port}/callback`,
                                callbackState,
                                oauthState,
                                onSuccess,
                                onError,
                                res
                            });
                            server.close();
                        }
                    } else {
                        res.writeHead(404);
                        res.end();
                    }
                } catch (err) {
                    appLogger.error('LocalAuthServer', 'Server handler error', err as Error);
                }
            })();
        };
    }

    /**
     * Starts the Claude OAuth flow using PKCE.
     */
    static async startClaudeAuth(
        onSuccess: (data: AuthCallbackData) => Promise<void> | void,
        onError: (err: CatchError) => void
    ): Promise<AuthResult> {
        return new Promise((resolve, reject) => {
            let verifier: string;
            let oauthState: string;

            const server = http.createServer();

            server.on('request', (req, res) => {
                const handler = LocalAuthServer.createClaudeRequestHandler(server, verifier, oauthState, onSuccess, onError);
                handler(req, res);
            });

            server.listen(0, '127.0.0.1', () => {
                try {
                    const address = server.address() as AddressInfo;
                    const port = address.port;
                    // Claude Code specifically requires http://localhost:PORT/callback
                    const redirectUri = `http://localhost:${port}/callback`;
                    oauthState = crypto.randomBytes(16).toString('hex');

                    verifier = LocalAuthServer.generateCodeVerifier();
                    const challenge = LocalAuthServer.generateCodeChallenge(verifier);

                    const authUrl = new URL(LocalAuthServer.CLAUDE_AUTH_ENDPOINT);
                    authUrl.searchParams.append('client_id', LocalAuthServer.CLAUDE_CLIENT_ID);
                    authUrl.searchParams.append('redirect_uri', redirectUri);
                    authUrl.searchParams.append('response_type', 'code');
                    authUrl.searchParams.append('scope', 'user:profile user:inference user:sessions:claude_code org:create_api_key user:mcp_servers');
                    authUrl.searchParams.append('state', oauthState);
                    authUrl.searchParams.append('code_challenge', challenge);
                    authUrl.searchParams.append('code_challenge_method', 'S256');

                    resolve({ url: authUrl.toString(), state: oauthState });
                } catch (e) {
                    server.close();
                    reject(e);
                }
            });
        });
    }

    /**
     * Generates a random PKCE code verifier.
     */
    private static generateCodeVerifier(): string {
        return LocalAuthServer.base64URLEncode(crypto.randomBytes(32));
    }

    /**
     * Generates a PKCE code challenge from a verifier.
     */
    private static generateCodeChallenge(verifier: string): string {
        return LocalAuthServer.base64URLEncode(crypto.createHash('sha256').update(verifier).digest());
    }

    /**
     * Encodes a buffer or string as a Base64-URL string (safe for URLs).
     */
    private static base64URLEncode(buffer: Buffer | string): string {
        return (Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer))
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    /**
     * Exchanges an authorization code for tokens (Standard/Antigravity flow).
     */
    private static async exchangeCodeForToken(code: string, verifier: string, redirectUri: string): Promise<AuthCallbackData> {
        const body = new URLSearchParams({
            client_id: LocalAuthServer.CLIENT_ID,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
            code_verifier: verifier
        });

        if (process.env.ANTIGRAVITY_CLIENT_SECRET) {
            body.append('client_secret', process.env.ANTIGRAVITY_CLIENT_SECRET);
        }

        return new Promise((resolve, reject) => {
            const request = net.request({
                method: 'POST',
                url: LocalAuthServer.TOKEN_ENDPOINT,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            request.on('response', (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', async () => {
                    if (response.statusCode && response.statusCode >= 400) {
                        const err = new Error(`Token exchange failed: ${response.statusCode} - ${data}`);
                        appLogger.error('LocalAuthServer', err.message);
                        reject(err);
                        return;
                    }
                    try {
                        const json = safeJsonParse<AuthCallbackData & { id_token?: string }>(data, {} as AuthCallbackData);
                        if (Object.keys(json).length === 0) { throw new Error('Malformed token response'); }

                        // Extract email from id_token if signature verification succeeds
                        if (json.id_token) {
                            try {
                                const claims = await LocalAuthServer.verifyGoogleIdToken(json.id_token);
                                if (claims['email']) {
                                    json.email = String(claims['email']);
                                    appLogger.info('LocalAuthServer', `Captured verified email from id_token: ${json.email}`);
                                }
                            } catch (verifyErr) {
                                appLogger.warn('LocalAuthServer', `id_token signature verification failed, will use userinfo fallback: ${verifyErr instanceof Error ? verifyErr.message : 'unknown'}`);
                            }
                        }

                        // Fallback to userinfo endpoint if email not obtained from verified id_token
                        if (!json.email && json.access_token) {
                            const email = await LocalAuthServer.fetchGoogleUserInfo(json.access_token);
                            if (email) {
                                json.email = email;
                                appLogger.info('LocalAuthServer', `Captured email from userinfo endpoint: ${email}`);
                            }
                        }

                        resolve(json);
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            request.on('error', (err) => reject(err));
            request.write(body.toString());
            request.end();
        });
    }

    /**
     * Verifies and decodes a Google id_token using JWKS, validating signature, issuer, and audience.
     * Throws on verification failure — caller must handle the error and use userinfo fallback.
     */
    private static async verifyGoogleIdToken(token: string): Promise<Record<string, unknown>> {
        const jwks = createRemoteJWKSet(LocalAuthServer.GOOGLE_JWKS_URL);
        const { payload } = await jwtVerify(token, jwks, {
            issuer: ['https://accounts.google.com', 'accounts.google.com'],
            audience: LocalAuthServer.CLIENT_ID,
        });
        return payload as Record<string, unknown>;
    }

    /**
     * Fetches user email from the Google userinfo endpoint using the access token.
     * Used as fallback when id_token signature verification fails.
     */
    private static async fetchGoogleUserInfo(accessToken: string): Promise<string | undefined> {
        return new Promise((resolve) => {
            const request = net.request({
                method: 'GET',
                url: LocalAuthServer.GOOGLE_USERINFO_ENDPOINT,
            });
            request.setHeader('Authorization', `Bearer ${accessToken}`);

            request.on('response', (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    if (response.statusCode && response.statusCode >= 400) {
                        appLogger.warn('LocalAuthServer', `Userinfo request failed: ${response.statusCode}`);
                        resolve(undefined);
                        return;
                    }
                    try {
                        const userInfo = safeJsonParse<{ email?: string }>(data, {});
                        resolve(userInfo.email ? String(userInfo.email) : undefined);
                    } catch {
                        resolve(undefined);
                    }
                });
            });
            request.on('error', () => resolve(undefined));
            request.end();
        });
    }

    /**
     * Exchanges an authorization code for tokens (Claude flow).
     */
    private static async exchangeCodeForClaudeToken(code: string, verifier: string, redirectUri: string, state: string): Promise<AuthCallbackData> {
        // Match the Go proxy's token exchange format exactly
        const payload = {
            code: code,
            state: state,
            grant_type: 'authorization_code',
            client_id: LocalAuthServer.CLAUDE_CLIENT_ID,
            redirect_uri: redirectUri,
            code_verifier: verifier
        };
        const body = JSON.stringify(payload);

        appLogger.info('LocalAuthServer', `Token exchange to: ${LocalAuthServer.CLAUDE_TOKEN_ENDPOINT}`);
        appLogger.debug('LocalAuthServer', `Payload: ${JSON.stringify({ ...payload, code: '[REDACTED]', code_verifier: '[REDACTED]' })}`);

        return new Promise((resolve, reject) => {
            const request = net.request({
                method: 'POST',
                url: LocalAuthServer.CLAUDE_TOKEN_ENDPOINT
            });

            // Set headers using setHeader method (required for Electron net.request)
            request.setHeader('Content-Type', 'application/json');
            request.setHeader('Accept', 'application/json');
            request.setHeader('User-Agent', 'Mozilla/5.0 (Node.js) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0');
            request.setHeader('x-anthropic-billing-header', 'cc_version=2.1.19; cc_entrypoint=unknown');
            request.setHeader('x-anthropic-additional-protection', 'true');

            request.on('response', (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', async () => {
                    if (response.statusCode && response.statusCode >= 400) {
                        const err = new Error(`Claude token exchange failed: ${response.statusCode} - ${data}`);
                        appLogger.error('LocalAuthServer', err.message);
                        reject(err);
                        return;
                    }
                    try {
                        const json = safeJsonParse<AuthCallbackData & { account?: { email_address?: string }; id_token?: string }>(data, {} as AuthCallbackData);
                        if (Object.keys(json).length === 0) { throw new Error('Malformed token response'); }
                        appLogger.info('LocalAuthServer', 'Token exchange successful');

                        json.email = LocalAuthServer.extractEmailFromTokenData(json);

                        // Fallback to Claude userinfo endpoint if email not obtained
                        if (!json.email && json.access_token) {
                            const email = await LocalAuthServer.fetchClaudeUserInfo(json.access_token);
                            if (email) {
                                json.email = email;
                                appLogger.info('LocalAuthServer', `Captured email from Claude userinfo endpoint: ${email}`);
                            }
                        }

                        resolve(json);
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            request.on('error', (err) => reject(err));

            request.write(body.toString());
            request.end();
        });
    }

    /**
     * Extract user email from token response data (multiple provider support).
     * Prefers verified sources (account info, direct response) over unverified JWT claims.
     */
    private static extractEmailFromTokenData(json: AuthCallbackData & { account?: { email_address?: string }; id_token?: string }): string | undefined {
        // Handle Claude's nested email field (trusted: comes from token response body)
        if (json.account?.email_address) {
            appLogger.info('LocalAuthServer', `Captured email from Claude account info: ${json.account.email_address}`);
            return json.account.email_address;
        }

        if (json.email) {
            appLogger.info('LocalAuthServer', `Captured email directly from response: ${json.email}`);
            return json.email;
        }

        // Do NOT fall back to decoding unsigned id_token claims (AUDIT-OAUTH-001).
        // The caller should use fetchClaudeUserInfo() with the access_token instead.
        if (json.id_token) {
            appLogger.warn('LocalAuthServer', 'id_token present but unsigned JWT decode is disallowed; will use userinfo fallback');
        }

        return undefined;
    }

    /**
     * Fetches user email from the Claude/Anthropic userinfo endpoint using the access token.
     * Used as fallback when email is not available from the token response body.
     */
    private static async fetchClaudeUserInfo(accessToken: string): Promise<string | undefined> {
        return new Promise((resolve) => {
            const request = net.request({
                method: 'GET',
                url: LocalAuthServer.CLAUDE_USERINFO_ENDPOINT,
            });
            request.setHeader('Authorization', `Bearer ${accessToken}`);
            request.setHeader('Accept', 'application/json');

            request.on('response', (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    if (response.statusCode && response.statusCode >= 400) {
                        appLogger.warn('LocalAuthServer', `Claude userinfo request failed: ${response.statusCode}`);
                        resolve(undefined);
                        return;
                    }
                    try {
                        const userInfo = safeJsonParse<{ email?: string; email_address?: string }>(data, {});
                        const email = userInfo.email ?? userInfo.email_address;
                        resolve(email ? String(email) : undefined);
                    } catch {
                        resolve(undefined);
                    }
                });
            });
            request.on('error', () => resolve(undefined));
            request.end();
        });
    }
}


