import * as crypto from 'crypto'
import * as http from 'http'
import { AddressInfo } from 'net'

import { CatchError } from '@shared/types/common'
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

                    const url = new URL(req.url || '/', `http://127.0.0.1:${address.port}`)

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
                        const json = JSON.parse(data)
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
