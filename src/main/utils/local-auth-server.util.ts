import * as crypto from 'crypto'
import * as http from 'http'
import { AddressInfo } from 'net'

import { appLogger } from '@main/logging/logger'
import { CatchError } from '@shared/types/common'
import { safeJsonParse } from '@shared/utils/sanitize.util'
import { net } from 'electron'

export interface AuthResult {
    url: string
    state: string
}

export interface AuthTokenData {
    access_token: string
    refresh_token?: string
    expires_in: number
    token_type?: string
    scope?: string
}

export interface AuthCallbackData extends AuthTokenData {
    email?: string
    type?: string
    project_id?: string
}

export class LocalAuthServer {
    private static readonly CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com'
    private static readonly AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
    private static readonly TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

    // Claude Constants
    private static readonly CLAUDE_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e'
    private static readonly CLAUDE_AUTH_ENDPOINT = 'https://claude.ai/oauth/authorize'
    private static readonly CLAUDE_TOKEN_ENDPOINT = 'https://console.anthropic.com/v1/oauth/token'


    /**
     * Starts the Antigravity OAuth flow using PKCE.
     */
    static async startAntigravityAuth(
        onSuccess: (data: AuthCallbackData) => void,
        onError: (err: CatchError) => void
    ): Promise<AuthResult> {
        return new Promise((resolve, reject) => {
            const server = http.createServer(async (req, res) => {
                try {
                    const address = server.address() as AddressInfo | null
                    if (!address) {
                        // Server is closed or closing
                        return
                    }

                    const url = new URL(req.url ?? '/', `http://127.0.0.1:${address.port}`)

                    if (url.pathname === '/callback') {
                        const code = url.searchParams.get('code')
                        const error = url.searchParams.get('error')

                        if (error) {
                            console.error('[LocalAuthServer] Callback error:', error)
                            res.writeHead(400, { 'Content-Type': 'text/html' })
                            res.end('<h1>Auth Failed</h1><p>Check the app for details.</p><script>window.close()</script>')
                            onError(new Error(error))
                            server.close()
                            return
                        }

                        if (code) {
                            res.writeHead(200, { 'Content-Type': 'text/html' })
                            res.end('<h1>Auth Successful</h1><p>You can close this window and return to Orbit.</p><script>setTimeout(() => window.close(), 1000)</script>')

                            try {
                                const redirectUri = `http://127.0.0.1:${address.port}/callback`
                                // Explicitly passing verifier from closure
                                if (!verifier) { throw new Error('Code verifier missing') }
                                const tokenData = await LocalAuthServer.exchangeCodeForToken(code, verifier, redirectUri)
                                onSuccess(tokenData)
                            } catch (e) {
                                onError(e as Error)
                            } finally {
                                server.close()
                            }
                        }
                    } else {
                        res.writeHead(404)
                        res.end()
                    }
                } catch (err) {
                    console.error('[LocalAuthServer] Server handler error:', err)
                }
            })

            // PKCE Variables (captured by closure)
            let verifier: string

            server.listen(0, '127.0.0.1', () => {
                try {
                    const address = server.address() as AddressInfo
                    const port = address.port
                    const redirectUri = `http://127.0.0.1:${port}/callback`
                    const state = crypto.randomBytes(16).toString('hex')

                    // PKCE Generation
                    verifier = LocalAuthServer.generateCodeVerifier()
                    const challenge = LocalAuthServer.generateCodeChallenge(verifier)

                    const authUrl = new URL(LocalAuthServer.AUTH_ENDPOINT)
                    authUrl.searchParams.append('client_id', LocalAuthServer.CLIENT_ID)
                    authUrl.searchParams.append('redirect_uri', redirectUri)
                    authUrl.searchParams.append('response_type', 'code')
                    authUrl.searchParams.append('scope', 'email profile openid https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/cclog https://www.googleapis.com/auth/experimentsandconfigs')
                    authUrl.searchParams.append('state', state)
                    authUrl.searchParams.append('code_challenge', challenge)
                    authUrl.searchParams.append('code_challenge_method', 'S256')
                    authUrl.searchParams.append('access_type', 'offline') // Get refresh token
                    authUrl.searchParams.append('prompt', 'consent')

                    resolve({ url: authUrl.toString(), state })
                } catch (e) {
                    server.close()
                    reject(e)
                }
            })
        })
    }

    /**
     * Starts the Claude OAuth flow using PKCE.
     */
    static async startClaudeAuth(
        onSuccess: (data: AuthCallbackData) => Promise<void> | void,
        onError: (err: CatchError) => void
    ): Promise<AuthResult> {
        return new Promise((resolve, reject) => {
            let verifier: string
            let oauthState: string

            const server = http.createServer(async (req, res) => {
                try {
                    const address = server.address() as AddressInfo | null
                    if (!address) { return }

                    const url = new URL(req.url ?? '/', `http://127.0.0.1:${address.port}`)

                    if (url.pathname === '/callback') {
                        const code = url.searchParams.get('code')
                        const callbackState = url.searchParams.get('state')
                        const error = url.searchParams.get('error')

                        if (error) {
                            console.error('[LocalAuthServer] Claude Callback error:', error)
                            res.writeHead(400, { 'Content-Type': 'text/html' })
                            res.end('<h1>Auth Failed</h1><p>Check the app.</p><script>window.close()</script>')
                            onError(new Error(error))
                            server.close()
                            return
                        }

                        if (code) {
                            try {
                                const redirectUri = `http://localhost:${address.port}/callback`
                                if (!verifier) { throw new Error('Code verifier missing') }

                                // Use callback state if present, otherwise use the original state
                                const stateToUse = callbackState ?? oauthState

                                const tokenData = await LocalAuthServer.exchangeCodeForClaudeToken(code, verifier, redirectUri, stateToUse)

                                await onSuccess(tokenData)

                                res.writeHead(200, { 'Content-Type': 'text/html' })
                                res.end('<h1>Login Successful!</h1><p>You can close this window and return to Orbit.</p>')
                            } catch (e) {
                                const err = e as Error
                                console.error('[LocalAuthServer] Claude Auth Failed:', err)
                                res.writeHead(500, { 'Content-Type': 'text/html' })
                                res.end(`<h1>Auth Failed</h1><p>Error exchanging token:</p><pre>${err.message}</pre>`)
                                onError(err)
                            } finally {
                                server.close()
                            }
                        }
                    } else {
                        res.writeHead(404)
                        res.end()
                    }
                } catch (err) {
                    console.error('[LocalAuthServer] Server handler error:', err)
                }
            })

            server.listen(0, '127.0.0.1', () => {
                try {
                    const address = server.address() as AddressInfo
                    const port = address.port
                    // Claude Code specifically requires http://localhost:PORT/callback
                    const redirectUri = `http://localhost:${port}/callback`
                    oauthState = crypto.randomBytes(16).toString('hex')

                    verifier = LocalAuthServer.generateCodeVerifier()
                    const challenge = LocalAuthServer.generateCodeChallenge(verifier)

                    const authUrl = new URL(LocalAuthServer.CLAUDE_AUTH_ENDPOINT)
                    authUrl.searchParams.append('client_id', LocalAuthServer.CLAUDE_CLIENT_ID)
                    authUrl.searchParams.append('redirect_uri', redirectUri)
                    authUrl.searchParams.append('response_type', 'code')
                    authUrl.searchParams.append('scope', 'user:profile user:inference user:sessions:claude_code org:create_api_key')
                    authUrl.searchParams.append('state', oauthState)
                    authUrl.searchParams.append('code_challenge', challenge)
                    authUrl.searchParams.append('code_challenge_method', 'S256')

                    resolve({ url: authUrl.toString(), state: oauthState })
                } catch (e) {
                    server.close()
                    reject(e)
                }
            })
        })
    }

    private static generateCodeVerifier(): string {
        return LocalAuthServer.base64URLEncode(crypto.randomBytes(32))
    }

    private static generateCodeChallenge(verifier: string): string {
        return LocalAuthServer.base64URLEncode(crypto.createHash('sha256').update(verifier).digest())
    }

    private static base64URLEncode(buffer: Buffer | string): string {
        return (Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer))
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '')
    }

    private static async exchangeCodeForToken(code: string, verifier: string, redirectUri: string): Promise<AuthCallbackData> {
        const body = new URLSearchParams({
            client_id: LocalAuthServer.CLIENT_ID,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
            code_verifier: verifier
        })

        // If a secret is present in env, include it (just in case it's a web client ID)
        if (process.env.ANTIGRAVITY_CLIENT_SECRET) {
            body.append('client_secret', process.env.ANTIGRAVITY_CLIENT_SECRET)
        }

        return new Promise((resolve, reject) => {
            const request = net.request({
                method: 'POST',
                url: LocalAuthServer.TOKEN_ENDPOINT,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            })

            request.on('response', (response) => {
                let data = ''
                response.on('data', chunk => data += chunk)
                response.on('end', () => {
                    if (response.statusCode && response.statusCode >= 400) {
                        const err = new Error(`Token exchange failed: ${response.statusCode} - ${data}`)
                        console.error('[LocalAuthServer]', err.message)
                        reject(err)
                        return
                    }
                    try {
                        const json = safeJsonParse(data, null)
                        if (!json) { throw new Error('Malformed token response') }
                        resolve(json)
                    } catch (e) {
                        reject(e)
                    }
                })
            })

            request.on('error', (err) => reject(err))

            request.write(body.toString())
            request.end()
        })
    }

    private static async exchangeCodeForClaudeToken(code: string, verifier: string, redirectUri: string, state: string): Promise<AuthCallbackData> {
        // Match the Go proxy's token exchange format exactly
        const payload = {
            code: code,
            state: state,
            grant_type: 'authorization_code',
            client_id: LocalAuthServer.CLAUDE_CLIENT_ID,
            redirect_uri: redirectUri,
            code_verifier: verifier
        }
        const body = JSON.stringify(payload)

        appLogger.info('LocalAuthServer', `Token exchange to: ${LocalAuthServer.CLAUDE_TOKEN_ENDPOINT}`)
        appLogger.debug('LocalAuthServer', `Payload: ${JSON.stringify({ ...payload, code: '[REDACTED]', code_verifier: '[REDACTED]' })}`)

        return new Promise((resolve, reject) => {
            const request = net.request({
                method: 'POST',
                url: LocalAuthServer.CLAUDE_TOKEN_ENDPOINT
            })

            // Set headers using setHeader method (required for Electron net.request)
            request.setHeader('Content-Type', 'application/json')
            request.setHeader('Accept', 'application/json')
            request.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

            request.on('response', (response) => {
                let data = ''
                response.on('data', chunk => data += chunk)
                response.on('end', () => {
                    if (response.statusCode && response.statusCode >= 400) {
                        const err = new Error(`Claude token exchange failed: ${response.statusCode} - ${data}`)
                        console.error('[LocalAuthServer]', err.message)
                        reject(err)
                        return
                    }
                    try {
                        const json = safeJsonParse(data, null)
                        if (!json) { throw new Error('Malformed token response') }
                        appLogger.info('LocalAuthServer', 'Token exchange successful')
                        resolve(json)
                    } catch (e) {
                        reject(e)
                    }
                })
            })

            request.on('error', (err) => reject(err))

            request.write(body.toString())
            request.end()
        })
    }
}
