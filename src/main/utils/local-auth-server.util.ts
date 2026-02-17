import * as crypto from 'crypto';
import * as http from 'http';
import { AddressInfo } from 'net';

import { appLogger } from '@main/logging/logger';
import { CatchError } from '@shared/types/common';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { net } from 'electron';

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

    // Claude Constants
    /** Client ID for Claude (Anthropic) OAuth */
    private static readonly CLAUDE_CLIENT_ID = process.env['ANTIGRAVITY_CLAUDE_CLIENT_ID'] ?? '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
    /** Claude Authorization endpoint */
    private static readonly CLAUDE_AUTH_ENDPOINT = 'https://claude.ai/oauth/authorize';
    /** Claude Token exchange endpoint */
    private static readonly CLAUDE_TOKEN_ENDPOINT = 'https://api.anthropic.com/v1/oauth/token';

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
            res.end('<h1>Login Successful!</h1><p>You can close this window and return to Tandem.</p>');
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
                            res.end('<h1>Auth Successful</h1><p>You can close this window and return to Tandem.</p><script>setTimeout(() => window.close(), 1000)</script>');

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
                response.on('end', () => {
                    if (response.statusCode && response.statusCode >= 400) {
                        const err = new Error(`Token exchange failed: ${response.statusCode} - ${data}`);
                        appLogger.error('LocalAuthServer', err.message);
                        reject(err);
                        return;
                    }
                    try {
                        const json = safeJsonParse<AuthCallbackData & { id_token?: string }>(data, {} as AuthCallbackData);
                        if (Object.keys(json).length === 0) { throw new Error('Malformed token response'); }

                        // Extract email from id_token if present (Google/Antigravity)
                        if (json.id_token) {
                            try {
                                const claims = LocalAuthServer.decodeJwt(json.id_token);
                                if (claims['email']) {
                                    json.email = String(claims['email']);
                                    appLogger.info('LocalAuthServer', `Captured email from id_token: ${json.email}`);
                                }
                            } catch {
                                appLogger.warn('LocalAuthServer', 'Failed to decode id_token JWT');
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
     * Decodes basic JWT payload without signature verification (we trust the HTTPS source).
     */
    private static decodeJwt(token: string): Record<string, unknown> {
        try {
            const parts = token.split('.');
            if (parts.length < 2) { return {}; }
            const payload = parts[1];
            if (!payload) { return {}; }
            const decoded = Buffer.from(payload, 'base64').toString('utf8');
            return JSON.parse(decoded) as Record<string, unknown>;
        } catch {
            return {};
        }
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
                response.on('end', () => {
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
     */
    private static extractEmailFromTokenData(json: AuthCallbackData & { account?: { email_address?: string }; id_token?: string }): string | undefined {
        // Handle Claude's nested email field
        if (json.account?.email_address) {
            appLogger.info('LocalAuthServer', `Captured email from Claude account info: ${json.account.email_address}`);
            return json.account.email_address;
        }

        // Fallback to id_token decoding (used by Codex/OpenAI and others)
        if (!json.email && json.id_token) {
            try {
                const claims = LocalAuthServer.decodeJwt(json.id_token);
                if (claims['email']) {
                    const email = String(claims['email']);
                    appLogger.info('LocalAuthServer', `Captured email from decoded id_token: ${email}`);
                    return email;
                }
            } catch {
                appLogger.warn('LocalAuthServer', 'Failed to decode id_token JWT in Claude flow');
            }
        }

        if (json.email) {
            appLogger.info('LocalAuthServer', `Captured email directly from response: ${json.email}`);
            return json.email;
        }

        return undefined;
    }
}

