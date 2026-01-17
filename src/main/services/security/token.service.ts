import { appLogger } from '@main/logging/logger'
import { BaseService } from '@main/services/base.service'
import { AuthToken } from '@main/services/data/database.service'
import { CopilotService } from '@main/services/llm/copilot.service'
import { AuthService } from '@main/services/security/auth.service'
import { SettingsService } from '@main/services/system/settings.service'
import { getErrorMessage } from '@shared/utils/error.util'

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
        private processManager: import('@main/services/system/process-manager.service').ProcessManagerService,
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

        // Start the native service process
        void this.processManager.startService({
            name: 'token-service',
            executable: 'orbit-token-service'
        })

        // Listen for responses (if we were using the old EventEmitter method)
        // With HTTP-based services, this is handled in the sendRequest .then() callback
        this.processManager.on('token-service:ready', (port: number) => {
            appLogger.info('TokenService', `Token service ready on port ${port}`)
            // Trigger initial refresh only when service is ready
            this.refreshAllTokens().catch(err => {
                appLogger.error('TokenService', `Initial token refresh failed: ${getErrorMessage(err)}`)
            })
        })

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
        if (this.isGoogleProvider(token) || this.isCodexProvider(token) || this.isClaudeProvider(token)) {
            // Send to native service
            const clientId = this.getClientId(token)
            const clientSecret = this.getClientSecret(token)

            if (!clientId) { return }

            try {
                const response = await this.processManager.sendRequest<{ success: boolean; token?: { access_token?: string; refresh_token?: string; expires_at?: number }; error?: string }>('token-service', {
                    type: 'Refresh',
                    token,
                    client_id: clientId,
                    client_secret: clientSecret
                })

                if (response.success && response.token) {
                    // Save the refreshed token to database
                    await this.authService.updateToken(token.id, {
                        accessToken: response.token.access_token,
                        refreshToken: response.token.refresh_token,
                        expiresAt: response.token.expires_at
                    })
                    appLogger.info('TokenService', `Token refreshed and saved for ${token.provider}`)
                } else if (response.error) {
                    appLogger.warn('TokenService', `Token refresh failed for ${token.provider}: ${response.error}`)
                }
            } catch (error) {
                appLogger.error('TokenService', `Failed to refresh token for ${token.provider}: ${getErrorMessage(error as Error)}`)
            }
        } else if (this.isGithubProvider(token)) {
            await this.refreshGithubToken(token)
        }
    }

    private isGithubProvider(token: AuthToken): boolean {
        const p = token.provider.toLowerCase()
        return p === 'github' || p === 'copilot'
    }

    private async refreshGithubToken(token: AuthToken) {
        // Only refresh if we have a refresh token and it's expired or close to expiring (e.g. within 5 mins)
        // Or if we just want to force refresh on startup.
        // GitHub tokens expire in 8 hours usually.
        if (!token.refreshToken) { return }

        // Check expiry if possible, but for now we might just try to exchange if we suspect it's old
        // or rely on the fact that this method is called by the scheduler.

        try {
            const clientId = token.provider === 'copilot' ? '01ab8ac9400c4e429b23' : 'Ov23liBw1MLMHGdYxtUV'

            const response = await fetch('https://github.com/login/oauth/access_token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    client_id: clientId,
                    grant_type: 'refresh_token',
                    refresh_token: this.authService.decryptToken(token.refreshToken)
                })
            })

            if (!response.ok) {
                const text = await response.text()
                throw new Error(`GitHub API error: ${response.status} ${text}`)
            }

            const data = await response.json() as {
                access_token?: string,
                refresh_token?: string,
                expires_in?: number,
                refresh_token_expires_in?: number,
                error?: string
            }

            if (data.error) {
                throw new Error(`Refresh failed: ${data.error}`)
            }

            if (data.access_token) {
                await this.authService.updateToken(token.id, {
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token, // Rotation
                    expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined
                })

                appLogger.info('TokenService', `Refreshed token for ${token.provider}`)

                // If copilot, notify service
                if (token.provider === 'copilot') {
                    this.copilotService.setGithubToken(data.access_token)
                }
            }
        } catch (error) {
            appLogger.error('TokenService', `Failed to refresh GitHub token: ${getErrorMessage(error as Error)}`)
        }
    }

    private getClientId(token: AuthToken): string | undefined {
        if (this.isGoogleProvider(token)) { return '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com' }
        if (this.isCodexProvider(token)) { return 'app_EMoamEEZ73f0CkXaXp7hrann' }
        if (this.isClaudeProvider(token)) { return '9d1c250a-e61b-44d9-88ed-5944d1962f5e' }
        return undefined
    }

    private getClientSecret(token: AuthToken): string | undefined {
        if (this.isGoogleProvider(token)) { return process.env.ANTIGRAVITY_CLIENT_SECRET }
        return undefined
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



    // Copilot remains internal logic for now as it interacts with local Github state complexly
    // or we can move it later. Keeping it here for safety as it wasn't requested explicitly?
    // User asked for "process names like...". Copilot refresh logic is simple HTTP but also
    // session state. The native service doesn't have Copilot logic implemented yet.
    // I will keep Copilot logic here but methods are unused by refreshSingleToken.
    // Wait, Copilot is refreshed via refreshCopilotToken which is separate loop.
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
