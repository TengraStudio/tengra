import http from 'http'
import crypto from 'crypto'
import axios from 'axios'

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

export class LocalAuthServer {
    private static ANTIGRAVITY_CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com'
    private static ANTIGRAVITY_CLIENT_SECRET = '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'
    private static GEMINI_CLIENT_ID = '225646015720-1fl1ojosillaqi2vb76gdf9ct0nma6n5.apps.googleusercontent.com'
    private static GEMINI_CLIENT_SECRET = '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'

    /**
     * Starts the Antigravity OAuth flow.
     */
    static async startAntigravityAuth(
        onSuccess: (data: any) => void,
        onError: (err: any) => void
    ): Promise<AuthResult> {
        console.log('[LocalAuthServer] Starting Antigravity Auth')
        const state = crypto.randomBytes(16).toString('hex')

        const server = http.createServer(async (req, res) => {
            try {
                const url = new URL(req.url || '', `http://${req.headers.host}`)
                const code = url.searchParams.get('code')
                const error = url.searchParams.get('error')

                if (error) {
                    res.writeHead(400, { 'Content-Type': 'text/html' })
                    res.end('<h1>Login Failed</h1><p>' + error + '</p>')
                    server.close()
                    onError(new Error(error))
                    return
                }

                if (code) {
                    const port = (server.address() as any).port
                    const redirectUri = `http://localhost:${port}/oauth-callback`

                    try {
                        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
                            code,
                            client_id: this.ANTIGRAVITY_CLIENT_ID,
                            client_secret: this.ANTIGRAVITY_CLIENT_SECRET,
                            redirect_uri: redirectUri,
                            grant_type: 'authorization_code'
                        })

                        const tokenData = tokenResponse.data

                        // Fetch user info for completeness
                        let userInfo: any = {}
                        try {
                            const userRes = await axios.get('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
                                headers: { Authorization: `Bearer ${tokenData.access_token}` }
                            })
                            userInfo = userRes.data
                        } catch (e) {
                            console.warn('[LocalAuthServer] Failed to fetch user info', e)
                        }

                        onSuccess({
                            ...tokenData,
                            email: userInfo.email,
                            type: 'antigravity'
                        })

                        res.writeHead(200, { 'Content-Type': 'text/html' })
                        res.end('<h1>Login Successful</h1><p>You can close this window and return to the application.</p><script>window.close()</script>')
                    } catch (exchangeError: any) {
                        onError(exchangeError)
                        res.writeHead(500, { 'Content-Type': 'text/html' })
                        res.end('<h1>Token Exchange Failed</h1><p>Check logs for details.</p>')
                    } finally {
                        server.close()
                    }
                }
            } catch (e) {
                onError(e)
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
                    "https://www.googleapis.com/auth/userinfo.profile",
                    "https://www.googleapis.com/auth/cclog",
                    "https://www.googleapis.com/auth/experimentsandconfigs"
                ].join(' ')

                const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&client_id=${this.ANTIGRAVITY_CLIENT_ID}&prompt=consent&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}&debug=manual_fix_v2`
                resolve({ url: authUrl, state })
            })
        })
    }

    /**
     * Starts the Custom Gemini OAuth flow.
     */
    static async startGeminiAuth(
        onSuccess: (data: any) => void,
        onError: (err: any) => void
    ): Promise<AuthResult> {
        const REDIRECT_URI = 'http://localhost:8085/oauth2callback'
        const state = 'gem-custom-' + Date.now()

        const server = http.createServer(async (req, res) => {
            try {
                const u = new URL(req.url || '', `http://localhost:8085`)
                if (u.pathname === '/oauth2callback') {
                    const code = u.searchParams.get('code')
                    const error = u.searchParams.get('error')

                    if (error) {
                        res.end('Authentication failed. You can close this window.')
                        server.close()
                        onError(new Error(error))
                        return
                    }

                    if (code) {
                        res.end('Authentication successful! You can close this window now.')
                        try {
                            // Exchange code
                            const tokenRes = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
                                code,
                                client_id: this.GEMINI_CLIENT_ID,
                                client_secret: this.GEMINI_CLIENT_SECRET,
                                redirect_uri: REDIRECT_URI,
                                grant_type: 'authorization_code'
                            }), {
                                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                            })

                            const tokens = tokenRes.data
                            const userRes = await axios.get('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
                                headers: { Authorization: `Bearer ${tokens.access_token}` }
                            })

                            onSuccess({
                                ...tokens,
                                email: userRes.data.email,
                                project_id: 'gen-lang-client-0669911453', // Hardcoded from original
                                type: 'gemini'
                            })

                        } catch (err) {
                            onError(err)
                        } finally {
                            server.close()
                        }
                    }
                }
            } catch (e) {
                onError(e)
                res.statusCode = 500
                res.end('Internal Server Error')
                server.close()
            }
        })

        return new Promise((resolve) => {
            server.listen(8085, () => {
                const scope = [
                    'https://www.googleapis.com/auth/cloud-platform',
                    'https://www.googleapis.com/auth/generative-language',
                    'https://www.googleapis.com/auth/userinfo.email',
                    'https://www.googleapis.com/auth/userinfo.profile'
                ].join(' ')

                const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&client_id=${this.GEMINI_CLIENT_ID}&prompt=consent&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}`
                resolve({ url: authUrl, state })
            })

            // Timeout safety
            setTimeout(() => server.close(), 5 * 60 * 1000)
        })
    }
}
