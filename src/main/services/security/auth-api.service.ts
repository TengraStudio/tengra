import * as http from 'http'

import { appLogger } from '@main/logging/logger'
import { BaseService } from '@main/services/base.service'
import { AuthService } from '@main/services/security/auth.service'

/**
 * Auth API Service
 * 
 * Provides HTTP endpoints for the Go proxy to fetch auth tokens from the database
 * without needing to write temporary JSON files.
 */
export class AuthAPIService extends BaseService {
    private server: http.Server | null = null
    private port: number = 0
    private apiKey: string = ''

    constructor(
        private authService: AuthService
    ) {
        super('AuthAPIService')
    }

    override async initialize(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server = http.createServer(async (req, res) => {
                // CORS headers
                res.setHeader('Access-Control-Allow-Origin', '*')
                res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

                if (req.method === 'OPTIONS') {
                    res.writeHead(200)
                    res.end()
                    return
                }

                // Authentication check
                const authHeader = req.headers['authorization']
                if (this.apiKey && (!authHeader || authHeader !== `Bearer ${this.apiKey}`)) {
                    res.writeHead(401, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify({ error: 'Unauthorized' }))
                    return
                }

                if (req.url === '/api/auth/accounts' && req.method === 'GET') {
                    await this.handleGetAccounts(req, res)
                } else if (req.url?.startsWith('/api/auth/accounts/') && req.method === 'POST') {
                    await this.handleUpdateAccount(req, res)
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify({ error: 'Not found' }))
                }
            })

            this.server.on('error', (err) => {
                appLogger.error('AuthAPIService', `Server error: ${err.message}`)
                reject(err)
            })

            // Listen on random available port
            this.server.listen(0, '127.0.0.1', () => {
                const server = this.server
                if (!server) {
                    reject(new Error('Server not initialized'))
                    return
                }
                const address = server.address()
                if (address && typeof address === 'object') {
                    this.port = address.port
                    appLogger.info('AuthAPIService', `Auth API listening on port ${this.port}`)
                    resolve()
                } else {
                    reject(new Error('Failed to get server address'))
                }
            })
        })
    }

    override async cleanup(): Promise<void> {
        const server = this.server
        if (server) {
            return new Promise((resolve) => {
                server.close(() => {
                    appLogger.info('AuthAPIService', 'Auth API server stopped')
                    resolve()
                })
            })
        }
    }

    getPort(): number {
        return this.port
    }

    setApiKey(key: string): void {
        this.apiKey = key
    }

    private async handleGetAccounts(req: http.IncomingMessage, res: http.ServerResponse) {
        try {
            const accounts = await this.authService.getAllAccountsFull()

            // Transform to format expected by Go proxy
            const authData = accounts
                .map(acc => {
                    const normalizedProvider = this.normalizeProviderName(acc.provider)
                    // Go proxy expects 'claude' for model routing
                    const providerForGo = normalizedProvider === 'anthropic' ? 'claude' : normalizedProvider
                    const isClaudeProvider = providerForGo === 'claude'

                    return {
                        id: acc.id || `${acc.provider}.json`,
                        provider: providerForGo,
                        type: providerForGo,
                        email: acc.email,
                        label: acc.displayName || acc.email || acc.provider,
                        access_token: acc.accessToken,
                        // Let Rust token-service own Claude refresh; proxy sees only access token
                        refresh_token: isClaudeProvider ? undefined : acc.refreshToken,
                        session_token: acc.sessionToken,
                        expires_at: acc.expiresAt,
                        scope: acc.scope,
                        metadata: {
                            ...acc.metadata,
                            type: providerForGo,
                            auth_type: isClaudeProvider ? 'oauth' : (acc.metadata?.auth_type ?? 'oauth'),
                            email: acc.email
                        },
                        created_at: acc.createdAt,
                        updated_at: acc.updatedAt
                    }
                })

            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ accounts: authData }))
        } catch (error) {
            appLogger.error('AuthAPIService', `Failed to get accounts: ${error}`)
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Internal server error' }))
        }
    }

    private async handleUpdateAccount(req: http.IncomingMessage, res: http.ServerResponse) {
        try {
            const urlParts = req.url?.split('/') ?? []
            const accountId = urlParts[urlParts.length - 1]

            if (!accountId) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: 'Missing account ID' }))
                return
            }

            let body = ''
            for await (const chunk of req) {
                body += chunk
            }

            const data = JSON.parse(body)
            appLogger.info('AuthAPIService', `Received update for account ${accountId}`)

            // Map from Go proxy fields back to Orbit internal fields if needed
            // Currently updateToken accepts Partial<TokenData>
            await this.authService.updateToken(accountId, {
                accessToken: data.access_token ?? data.accessToken,
                refreshToken: data.refresh_token ?? data.refreshToken,
                sessionToken: data.session_token ?? data.sessionToken,
                expiresAt: data.expires_at ?? data.expiresAt,
                metadata: data.metadata
            })

            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: true }))
        } catch (error) {
            appLogger.error('AuthAPIService', `Failed to update account: ${error}`)
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Internal server error' }))
        }
    }

    private normalizeProviderName(provider: string): string {
        let p = provider.toLowerCase()

        // Strip emails (e.g. claude-user@gmail.com -> claude)
        if (p.includes('@')) {
            p = p.split('-')[0].split('_')[0]
        }

        // Strip common suffixes
        p = p.replace(/(_token|_key|_auth)$/, '')

        const mappings: Record<string, string> = {
            'github': 'github', 'github_token': 'github',
            'copilot': 'copilot', 'copilot_token': 'copilot',
            'antigravity': 'antigravity', 'antigravity_token': 'antigravity',
            'anthropic': 'claude', 'anthropic_key': 'claude', 'claude': 'claude',
            'openai': 'codex', 'openai_key': 'codex', 'codex': 'codex',
            'gemini': 'gemini', 'gemini_key': 'gemini'
        }

        return mappings[p] ?? p
    }
}
