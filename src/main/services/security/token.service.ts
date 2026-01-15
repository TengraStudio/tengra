import { appLogger } from '@main/logging/logger'
import { BaseService } from '@main/services/base.service'
import { AuthToken } from '@main/services/data/database.service'
import { CopilotService } from '@main/services/llm/copilot.service'
import { AuthService } from '@main/services/security/auth.service'
import { SettingsService } from '@main/services/system/settings.service'
import { JsonObject } from '@shared/types/common'
import { getErrorMessage } from '@shared/utils/error.util'
import axios from 'axios'

// OAuth Client IDs and Secrets
// Client IDs are public, but secrets should be in environment variables
const ANTIGRAVITY_CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com'
const ANTIGRAVITY_CLIENT_SECRET = process.env.ANTIGRAVITY_CLIENT_SECRET // No fallback - required env var

const CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann' // OpenAI OAuth Client ID
const CODEX_TOKEN_URL = 'https://auth.openai.com/oauth/token'

const CLAUDE_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e' // Anthropic OAuth Client ID
const CLAUDE_TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token'

/**
 * Unified Token Refresh Service
 * 
 * This service manages token refresh for all providers:
 * - Google/Antigravity (OAuth2 refresh_token)
 * - Codex (OpenAI OAuth)
 * - Claude (Anthropic OAuth)
 * - GitHub (no refresh needed, tokens don't expire)
 * - Copilot (GitHub token -> Copilot session token)
 * 
 * Only refreshes tokens for providers that are actually logged in.
 */
export class TokenService extends BaseService {
    private readonly DEFAULT_REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
    private readonly DEFAULT_COPILOT_REFRESH_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes
    private legacyIntervals: NodeJS.Timeout[] = []

    constructor(
        private settingsService: SettingsService,
        private copilotService: CopilotService,
        private authService: AuthService,
        private jobScheduler?: import('@main/services/system/job-scheduler.service').JobSchedulerService
    ) {
        super('TokenService')
    }

    async cleanup() {
        this.stop()
    }

    /**
     * Start the token refresh service
     */
    start() {
        appLogger.info('TokenService', 'Starting unified token refresh service...')

        if (this.jobScheduler) {
            // Use JobScheduler for persistent, configurable intervals
            this.jobScheduler.registerRecurringJob(
                'token-refresh-oauth',
                async () => {
                    await this.refreshAllTokens()
                },
                () => {
                    const settings = this.settingsService.getSettings()
                    return settings.ai?.tokenRefreshInterval ?? this.DEFAULT_REFRESH_INTERVAL_MS
                }
            )

            this.jobScheduler.registerRecurringJob(
                'token-refresh-copilot',
                async () => {
                    await this.refreshCopilotToken()
                },
                () => {
                    const settings = this.settingsService.getSettings()
                    return settings.ai?.copilotRefreshInterval ?? this.DEFAULT_COPILOT_REFRESH_INTERVAL_MS
                }
            )

            appLogger.info('TokenService', 'Registered with JobScheduler for persistent scheduling')
        } else {
            // Fallback to simple setInterval (for backward compatibility)
            appLogger.warn('TokenService', 'No JobScheduler provided, using simple intervals')
            this.startLegacyIntervals()
        }

        // Initial check
        this.refreshAllTokens().catch(err => {
            appLogger.error('TokenService', `Initial token refresh failed: ${getErrorMessage(err)}`)
        })

        appLogger.info('TokenService', 'Token refresh service started successfully')
    }

    private startLegacyIntervals() {
        // Legacy interval-based refresh (not persisted across restarts)
        const oauthInterval = setInterval(() => {
            this.refreshAllTokens().catch(err => {
                appLogger.error('TokenService', `Periodic token refresh failed: ${getErrorMessage(err)}`)
            })
        }, this.DEFAULT_REFRESH_INTERVAL_MS)
        this.legacyIntervals.push(oauthInterval)

        const copilotInterval = setInterval(() => {
            this.refreshCopilotToken().catch(err => {
                appLogger.error('TokenService', `Copilot token refresh failed: ${getErrorMessage(err)}`)
            })
        }, this.DEFAULT_COPILOT_REFRESH_INTERVAL_MS)
        this.legacyIntervals.push(copilotInterval)
    }

    /**
     * Stop the token refresh service
     */
    stop() {
        // JobScheduler handles its own cleanup

        // Clear legacy intervals
        this.legacyIntervals.forEach(interval => clearInterval(interval))
        this.legacyIntervals = []

        appLogger.info('TokenService', 'Token refresh service stopped')
    }

    private async refreshAllTokens() {
        const tokens = await this.authService.getAllFullTokens()

        for (const token of tokens) {
            await this.refreshSingleToken(token)
        }
    }

    private async refreshSingleToken(token: AuthToken) {
        if (this.isGoogleProvider(token)) {
            await this.refreshGoogleToken(token)
        } else if (this.isCodexProvider(token)) {
            await this.refreshCodexToken(token)
        } else if (this.isClaudeProvider(token)) {
            await this.refreshClaudeToken(token)
        }
    }

    private isGoogleProvider(token: AuthToken): boolean {
        const id = token.id.toLowerCase()
        const provider = (token.provider || id).toLowerCase()
        return provider.startsWith('google') || provider.startsWith('antigravity') || id.startsWith('google') || id.startsWith('antigravity')
    }

    private isCodexProvider(token: AuthToken): boolean {
        const id = token.id.toLowerCase()
        const provider = (token.provider || id).toLowerCase()
        return provider.startsWith('codex') || provider.startsWith('openai') || id.startsWith('codex') || id.startsWith('openai')
    }

    private isClaudeProvider(token: AuthToken): boolean {
        const id = token.id.toLowerCase()
        const provider = (token.provider || id).toLowerCase()
        return provider.startsWith('claude') || provider.startsWith('anthropic') || id.startsWith('claude') || id.startsWith('anthropic')
    }

    private async refreshGoogleToken(token: AuthToken): Promise<void> {
        try {
            const refreshToken = token.refreshToken
            if (!refreshToken) { return }

            const expiry = token.expiresAt ?? 0
            if (Date.now() < expiry - 5 * 60 * 1000) { return }

            if (!ANTIGRAVITY_CLIENT_SECRET) {
                appLogger.error('TokenService', 'ANTIGRAVITY_CLIENT_SECRET environment variable is not set')
                return
            }

            appLogger.info('TokenService', `Refreshing Google/Antigravity token for ${token.id}...`)
            await this.performGoogleRefresh(token, refreshToken)
        } catch (error: unknown) {
            this.handleRefreshError('Google', token.id, error)
        }
    }

    private async performGoogleRefresh(token: AuthToken, refreshToken: string) {
        const params = new URLSearchParams({
            client_id: ANTIGRAVITY_CLIENT_ID,
            client_secret: ANTIGRAVITY_CLIENT_SECRET ?? '',
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        })

        const response = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 10000
        })

        await this.authService.saveToken(token.id, {
            ...token,
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token ?? refreshToken,
            expiresAt: Date.now() + ((response.data.expires_in ?? 3600) * 1000),
            updatedAt: Date.now()
        })
        appLogger.info('TokenService', `Google/Antigravity token for ${token.id} refreshed successfully`)
    }

    private async refreshCodexToken(token: AuthToken): Promise<void> {
        try {
            const refreshToken = token.refreshToken
            if (!refreshToken) { return }

            const expiry = token.expiresAt ?? 0
            if (Date.now() < expiry - 5 * 60 * 1000) { return }

            appLogger.info('TokenService', `Refreshing Codex token for ${token.id}...`)
            await this.performCodexRefresh(token, refreshToken)
        } catch (error: unknown) {
            this.handleRefreshError('Codex', token.id, error)
        }
    }

    private async performCodexRefresh(token: AuthToken, refreshToken: string) {
        const params = new URLSearchParams({
            client_id: CODEX_CLIENT_ID,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            scope: 'openid profile email'
        })
        const response = await axios.post(CODEX_TOKEN_URL, params.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            timeout: 10000
        })

        await this.authService.saveToken(token.id, {
            ...token,
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token ?? refreshToken,
            idToken: response.data.id_token ?? token.idToken,
            expiresAt: Date.now() + ((response.data.expires_in ?? 3600) * 1000),
            updatedAt: Date.now()
        })
        appLogger.info('TokenService', `Codex token for ${token.id} refreshed successfully`)
    }

    private handleRefreshError(provider: string, id: string, error: unknown) {
        const errorMsg = getErrorMessage(error)
        const axiosError = error as { response?: { status: number; data?: JsonObject } }

        if (axiosError.response) {
            const statusCode = axiosError.response.status
            const data = axiosError.response.data
            const errorCode = data ? String(data.error ?? '') : ''

            if (statusCode === 400 && (errorCode === 'invalid_grant' || errorCode === 'invalid_request')) {
                appLogger.warn('TokenService', `Refresh token expired or invalid for ${id}. User needs to re-authenticate.`)
            }
        }

        appLogger.error('TokenService', `Failed to refresh ${provider} token for ${id}: ${errorMsg}`)
    }

    private async refreshClaudeToken(token: AuthToken): Promise<void> {
        try {
            await this.captureClaudeElectronSession(token)

            const refreshToken = token.refreshToken
            if (!refreshToken) {
                await this.checkClaudeSessionValidity(token)
                return
            }

            const expiry = token.expiresAt ?? 0
            if (Date.now() < expiry - 5 * 60 * 1000) { return }

            appLogger.info('TokenService', `Refreshing Claude OAuth token for ${token.id}...`)
            await this.performClaudeRefresh(token, refreshToken)
        } catch (error: unknown) {
            this.handleRefreshError('Claude', token.id, error)
        }
    }

    private async captureClaudeElectronSession(token: AuthToken) {
        try {
            const { session } = await import('electron')
            if (!session) { return }

            const cookies = await session.defaultSession.cookies.get({
                url: 'https://claude.ai',
                name: 'sessionKey'
            })

            if (cookies.length > 0 && cookies[0].value) {
                const sessionKey = cookies[0].value
                const existing = token.id.includes('claude') ? token : null
                if (existing && existing.sessionToken !== sessionKey) {
                    appLogger.info('TokenService', 'Captured new Claude sessionKey from Electron cookies')
                    await this.authService.saveToken(existing.id, { ...existing, sessionToken: sessionKey, updatedAt: Date.now() })
                }
            }
        } catch { /* ignore capture errors */ }
    }

    private async checkClaudeSessionValidity(token: AuthToken) {
        const sessionKey = token.sessionToken
        if (!sessionKey) { return }

        const isValid = await this.validateClaudeSessionKey(sessionKey)
        if (!isValid) {
            appLogger.warn('TokenService', `Claude session_key for ${token.id} expired. User needs to re-authenticate via browser.`)
        }
    }

    private async performClaudeRefresh(token: AuthToken, refreshToken: string) {
        const response = await axios.post(CLAUDE_TOKEN_URL, {
            client_id: CLAUDE_CLIENT_ID,
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 10000
        })

        await this.authService.saveToken(token.id, {
            ...token,
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token ?? refreshToken,
            expiresAt: Date.now() + ((response.data.expires_in ?? 3600) * 1000),
            email: response.data.account?.email_address ?? token.email,
            updatedAt: Date.now()
        })
        appLogger.info('TokenService', `Claude OAuth token for ${token.id} refreshed successfully`)
    }

    /**
     * Validate Claude session key by making a test request
     */
    private async validateClaudeSessionKey(sessionKey: string): Promise<boolean> {
        try {
            const response = await axios.get('https://claude.ai/api/organizations', {
                headers: {
                    'Cookie': `sessionKey=${sessionKey}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 5000
            })
            return response.status === 200
        } catch {
            return false
        }
    }

    /**
     * Refresh Copilot session token
     */
    private async refreshCopilotToken(): Promise<void> {
        try {
            appLogger.debug('TokenService', 'Checking Copilot session token...')

            const settings = this.settingsService.getSettings()
            const copilotToken = settings.copilot?.token ?? await this.authService.getToken('copilot_token')

            if (copilotToken) {
                this.copilotService.setGithubToken(copilotToken)
                appLogger.info('TokenService', 'Copilot token loaded, session token will refresh on next use')
            } else {
                appLogger.warn('TokenService', 'No copilot_token found - user needs to re-login')
            }
        } catch (error) {
            appLogger.error('TokenService', `Failed to refresh Copilot token: ${getErrorMessage(error)}`)
        }
    }
}
