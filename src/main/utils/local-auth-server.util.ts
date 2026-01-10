import { shell } from 'electron'
import http from 'http'
import crypto from 'crypto'
import axios from 'axios'
import { CatchError, JsonObject } from '../../shared/types/common'

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
    private static ANTIGRAVITY_CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com'
    private static ANTIGRAVITY_CLIENT_SECRET = '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'

    /**
     * Starts the Antigravity OAuth flow.
     */
    static async startAntigravityAuth(
        onSuccess: (data: AuthCallbackData) => void,
        onError: (err: CatchError) => void
    ): Promise<AuthResult> {
        console.log('[LocalAuthServer] Starting Antigravity Auth')
        const state = crypto.randomBytes(16).toString('hex')

        const server = http.createServer(async (req, res) => {
            try {
                const u = new URL(req.url || '', `http://localhost:51121`)
                if (u.pathname === '/oauth-callback') {
                    const code = u.searchParams.get('code')
                    const error = u.searchParams.get('error')

                    if (error) {
                        res.writeHead(400, { 'Content-Type': 'text/html' })
                        res.end('<h1>Login Failed</h1><p>' + error + '</p>')
                        server.close()
                        onError(new Error(error))
                        return
                    }

                    if (code) {
                        const port = 51121
                        const redirectUri = `http://localhost:${port}/oauth-callback`

                        try {
                            const payload: Record<string, string> = {
                                code,
                                client_id: this.ANTIGRAVITY_CLIENT_ID,
                                client_secret: this.ANTIGRAVITY_CLIENT_SECRET,
                                redirect_uri: redirectUri,
                                grant_type: 'authorization_code'
                            }

                            const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', payload)
                            const tokenData = tokenResponse.data

                            // Fetch user info for completeness
                            let userInfo: JsonObject = {}
                            try {
                                const userRes = await axios.get('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
                                    headers: { Authorization: `Bearer ${tokenData.access_token}` }
                                })
                                userInfo = userRes.data as JsonObject
                            } catch (e) {
                                console.warn('[LocalAuthServer] Failed to fetch user info', e)
                            }

                            const email = typeof userInfo.email === 'string' ? userInfo.email : undefined

                            onSuccess({
                                ...tokenData,
                                email,
                                type: 'antigravity'
                            })

                            res.writeHead(200, { 'Content-Type': 'text/html' })
                            res.end('<h1>Login Successful</h1><p>You can close this window and return to the application.</p><script>window.close()</script>')
                        } catch (exchangeError) {
                            onError(exchangeError as CatchError)
                            res.writeHead(500, { 'Content-Type': 'text/html' })
                            res.end('<h1>Token Exchange Failed</h1><p>Check logs for details.</p>')
                        } finally {
                            server.close()
                        }
                    }
                }
            } catch (e) {
                onError(e as CatchError)
                server.close()
            }
        })

        return new Promise((resolve) => {
            server.listen(51121, '127.0.0.1', () => {
                const port = 51121
                const redirectUri = `http://localhost:${port}/oauth-callback`
                const scope = [
                    "https://www.googleapis.com/auth/cloud-platform",
                    "https://www.googleapis.com/auth/userinfo.email",
                    "https://www.googleapis.com/auth/userinfo.profile"
                ].join(' ')

                const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&client_id=${this.ANTIGRAVITY_CLIENT_ID}&prompt=consent&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}&debug=secret_fix`
                console.log('[LocalAuthServer] Opening auth URL:', authUrl)
                shell.openExternal(authUrl)
                resolve({ url: authUrl, state })
            })
        })
    }
}
