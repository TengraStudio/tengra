

import { appLogger } from '@main/logging/logger'
import { BaseService } from '@main/services/base.service'
import { LinkedAccount } from '@main/services/data/database.service'
import { CopilotService } from '@main/services/llm/copilot.service'
import { AuthService } from '@main/services/security/auth.service'
import { EventBusService } from '@main/services/system/event-bus.service'
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
    private readonly REFRESH_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes
    private legacyIntervals: NodeJS.Timeout[] = []
    private eventUnsubscribers: Array<() => void> = []

    constructor(
        private settingsService: SettingsService,
        private copilotService: CopilotService,
        private authService: AuthService,
        private eventBus: EventBusService,
        private system: {
            processManager: import('@main/services/system/process-manager.service').ProcessManagerService,
            jobScheduler?: import('@main/services/system/job-scheduler.service').JobSchedulerService
        }
    ) {
        super('TokenService')
    }

    override async cleanup(): Promise<void> {
        // JobScheduler handles its own cleanup

        // Clear legacy intervals
        this.legacyIntervals.forEach(interval => clearInterval(interval))
        this.legacyIntervals = []

        // Unsubscribe from events
        this.eventUnsubscribers.forEach(unsub => unsub())
        this.eventUnsubscribers = []

        appLogger.info('TokenService', 'Token refresh service stopped')
    }

    /**
     * Initialize the token refresh service
     */
    override async initialize(): Promise<void> {
        appLogger.info('TokenService', 'Starting unified token refresh service...')

        // Start the native service process (wait for it to be ensuringly ready)
        await this.system.processManager.startService({
            name: 'token-service',
            executable: 'orbit-token-service',
            persistent: true // Keep running in background
        })

        appLogger.info('TokenService', 'Token service connected')

        // 1. Sync any background refreshed tokens from service API FIRST
        // This MUST complete before we register tokens, to avoid overwriting
        // newer refresh tokens with stale ones from the database
        try {
            await this.syncFromService()
            appLogger.info('TokenService', 'Synced tokens from token service')
        } catch (err) {
            appLogger.error('TokenService', `Failed to sync from token service: ${getErrorMessage(err)}`)
        }

        // 2. Register all current tokens for monitoring (AFTER sync completes)
        this.refreshAllTokens().catch(err => {
            appLogger.error('TokenService', `Initial token registration failed: ${getErrorMessage(err)}`)
        })

        // Remove the event listener approach as we await startService now

        if (this.system.jobScheduler) {
            // Use JobScheduler for persistent, configurable intervals
            this.system.jobScheduler.registerRecurringJob(
                'token-refresh-oauth',
                async () => {
                    await this.refreshAllTokens()
                },
                () => {
                    const settings = this.settingsService.getSettings()
                    return settings.ai?.tokenRefreshInterval ?? this.DEFAULT_REFRESH_INTERVAL_MS
                }
            )

            this.system.jobScheduler.registerRecurringJob(
                'token-refresh-copilot',
                async () => {
                    await this.refreshCopilotToken()
                },
                () => {
                    const settings = this.settingsService.getSettings()
                    return settings.ai?.copilotRefreshInterval ?? this.DEFAULT_COPILOT_REFRESH_INTERVAL_MS
                }
            )

            // Periodically sync tokens FROM the token service back to the database
            // This ensures any background refreshes are persisted to the database
            this.system.jobScheduler.registerRecurringJob(
                'token-sync-from-service',
                async () => {
                    await this.syncFromService()
                },
                () => 2 * 60 * 1000 // Every 2 minutes
            )

            appLogger.info('TokenService', 'Registered with JobScheduler for persistent scheduling')
        } else {
            // Fallback to simple setInterval (for backward compatibility)
            appLogger.warn('TokenService', 'No JobScheduler provided, using simple intervals')
            this.startLegacyIntervals()
        }

        // Listen for account unlink events to stop refreshing deleted accounts
        const unsubscribe = this.eventBus.on('account:unlinked', ({ accountId }) => {
            this.unregisterToken(accountId).catch(err => {
                appLogger.error('TokenService', `Failed to unregister token: ${getErrorMessage(err)}`)
            })
        })
        this.eventUnsubscribers.push(unsubscribe)

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

        // Periodically sync tokens FROM the token service back to the database
        const syncInterval = setInterval(() => {
            this.syncFromService().catch(err => {
                appLogger.error('TokenService', `Token sync from service failed: ${getErrorMessage(err)}`)
            })
        }, 2 * 60 * 1000) // Every 2 minutes
        this.legacyIntervals.push(syncInterval)
    }

    // stop() renamed to cleanup() and moved up

    /**
     * Unregister a token from the native token-service (stop refreshing it)
     */
    async unregisterToken(accountId: string): Promise<void> {
        try {
            await this.system.processManager.sendRequest<{ success: boolean }>('token-service', {
                id: accountId
            }, 5000, '/unregister')
            appLogger.info('TokenService', `Unregistered token from refresh service: ${accountId}`)
        } catch (error) {
            appLogger.warn('TokenService', `Failed to unregister token ${accountId}: ${getErrorMessage(error)}`)
        }
    }

    async refreshAllTokens() {
        const accounts = await this.authService.getAllAccountsFull()

        for (const account of accounts) {
            // Trigger proactive check/refresh
            await this.refreshSingleToken(account, false)
        }
    }

    private async syncFromService() {
        try {
            interface ServiceToken {
                token: {
                    access_token?: string
                    refresh_token?: string
                    expires_at?: number
                }
                updated_at: number
            }

            const tokens = await this.system.processManager.sendGetRequest<Record<string, ServiceToken>>('token-service', '/sync')

            let updatedCount = 0
            for (const [id, data] of Object.entries(tokens)) {
                // Verify account still exists in Orbit database
                const exists = await this.authService.accountExists(id)
                if (!exists) {
                    appLogger.warn('TokenService', `Sync: Found monitored token for non-existent account ${id}. Requesting unregister...`)
                    // Fire and forget unregister
                    void this.unregisterToken(id).catch(err => {
                        appLogger.error('TokenService', `Sync: Failed to unregister zombie token ${id}: ${getErrorMessage(err)}`)
                    })
                    continue
                }

                if (data.token.access_token) {
                    await this.authService.updateToken(id, {
                        accessToken: data.token.access_token,
                        refreshToken: data.token.refresh_token,
                        expiresAt: data.token.expires_at
                    })
                    updatedCount++
                }
            }
            if (updatedCount > 0) {
                appLogger.info('TokenService', `Synced ${updatedCount} tokens from token service API`)
            }

        } catch (error) {
            appLogger.warn('TokenService', `Could not sync from token service: ${getErrorMessage(error)}`)
            // Start legacy intervals as fallback if service is down?
            // Actually, if sync fails, it might just mean service isn't ready. Process Manager handles restarts.
        }
    }

    /**
     * Ensures a token is fresh by refreshing it if it's expired or about to expire.
     * @param provider Provider alias or ID
     * @param force If true, forces a refresh regardless of expiry time
     */
    async ensureFreshToken(provider: string, force: boolean = false): Promise<void> {
        const account = await this.authService.getActiveAccountFull(provider)
        if (!account) { return }

        // Refresh if expired or expiring within threshold
        const isExpiring = account.expiresAt && (account.expiresAt - Date.now()) < this.REFRESH_THRESHOLD_MS

        if (!account.accessToken || isExpiring || force) {
            appLogger.info('TokenService', `Proactively refreshing token for ${provider} (expiring: ${isExpiring}, forced: ${force})`)
            await this.refreshSingleToken(account, force)
        }
    }

    async refreshSingleToken(account: LinkedAccount, force: boolean = false) {
        try {
            if (this.isNativeProvider(account)) {
                await this.refreshNativeToken(account, force)
            } else if (this.isGithubProvider(account)) {
                await this.refreshGithubToken(account)
            }
        } catch (error) {
            const errorMsg = getErrorMessage(error)
            appLogger.error('TokenService', `Failed to refresh token for ${account.provider}: ${errorMsg}`)
            this.eventBus.emit('token:error', { provider: account.provider, error: errorMsg })
        }
    }

    private isNativeProvider(account: LinkedAccount): boolean {
        return this.isGoogleProvider(account) || this.isCodexProvider(account) || this.isClaudeProvider(account);
    }



    private logGoogleTokenStatus(account: LinkedAccount, clientSecret: string | undefined) {
        if (!this.isGoogleProvider(account)) { return }
        if (clientSecret) {
            appLogger.info('TokenService', `Refreshing Google token for ${account.id} (Client Secret Present)`)
        } else {
            appLogger.warn('TokenService', `Refreshing Google token for ${account.id} (Client Secret MISSING) - Access Check: ${process.env.ANTIGRAVITY_CLIENT_SECRET ? 'Defined' : 'Undefined'}`)
        }
    }

    private logClaudeTokenStatus(account: LinkedAccount) {
        if (!this.isClaudeProvider(account)) { return }

        const rt = account.refreshToken ?? ''
        const prefix = rt.split(':')[0] ?? 'none'

        appLogger.info('TokenService', `Claude status - Access: ${!!account.accessToken}, Refresh: ${!!rt} (${prefix})`)

        if (rt.startsWith('v1:') || rt.startsWith('orbit:v1:')) {
            appLogger.warn('TokenService', 'Claude refresh token appears to be STILL ENCRYPTED!')
        }
    }

    private async refreshNativeToken(account: LinkedAccount, force: boolean) {
        const clientId = this.getClientId(account)
        const clientSecret = this.getClientSecret(account)

        if (this.shouldSkipRefresh(account, force)) {
            return
        }

        this.logGoogleTokenStatus(account, clientSecret)
        this.logClaudeTokenStatus(account)

        if (!clientId) { return }

        // Map to snake_case for native service
        const nativeToken = {
            id: account.id,
            provider: account.provider,
            access_token: account.accessToken,
            refresh_token: account.refreshToken,
            expires_at: account.expiresAt,
            scope: account.scope,
            email: account.email
        }

        // 1. If refreshing, use immediate /refresh endpoint
        if (force || (account.expiresAt && (account.expiresAt - Date.now() < this.REFRESH_THRESHOLD_MS))) {
            const refreshResponse = await this.system.processManager.sendRequest<{ success: boolean; token?: { access_token?: string; refresh_token?: string; expires_at?: number }; error?: string }>('token-service', {
                type: 'Refresh',
                token: nativeToken,
                client_id: clientId,
                client_secret: clientSecret
            })

            // Handle immediate response
            if (refreshResponse.success && refreshResponse.token) {
                await this.authService.updateToken(account.id, {
                    accessToken: refreshResponse.token.access_token,
                    refreshToken: refreshResponse.token.refresh_token,
                    expiresAt: refreshResponse.token.expires_at
                })
                appLogger.info('TokenService', `Token refreshed immediately for ${account.provider}`)
                this.eventBus.emit('token:refreshed', { provider: account.provider, accountId: account.id })
            }
        }

        void this.system.processManager.sendRequest('token-service', {
            token: nativeToken,
            client_id: clientId,
            client_secret: clientSecret
        }, 5000, '/monitor')
            .catch(err => appLogger.warn('TokenService', `Failed to register token for monitoring: ${getErrorMessage(err)}`))
    }

    private shouldSkipRefresh(account: LinkedAccount, force: boolean): boolean {
        if (force) { return false }

        if (account.expiresAt && account.accessToken) {
            const timeUntilExpiry = account.expiresAt - Date.now()
            if (timeUntilExpiry > this.REFRESH_THRESHOLD_MS) {
                return true
            }
            appLogger.info('TokenService', `Token for ${account.provider} is expiring in ${(timeUntilExpiry / 60000).toFixed(1)}m (Threshold: 30m), refreshing...`)
        }

        return false
    }

    private isGithubProvider(account: LinkedAccount): boolean {
        const p = account.provider.toLowerCase()
        return p === 'github' || p === 'copilot'
    }

    private async refreshGithubToken(account: LinkedAccount) {
        // Only refresh if we have a refresh token and it's expired or close to expiring (e.g. within 5 mins)
        // Or if we just want to force refresh on startup.
        // GitHub tokens expire in 8 hours usually.
        if (!account.refreshToken) { return }

        // Check expiry if possible, but for now we might just try to exchange if we suspect it's old
        // or rely on the fact that this method is called by the scheduler.

        try {
            const clientId = account.provider === 'copilot' ? '01ab8ac9400c4e429b23' : 'Ov23liBw1MLMHGdYxtUV'

            const response = await fetch('https://github.com/login/oauth/access_token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    client_id: clientId,
                    grant_type: 'refresh_token',
                    refresh_token: this.authService.decryptToken(account.refreshToken ?? '')
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
                await this.authService.updateToken(account.id, {
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token, // Rotation
                    expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined
                })

                appLogger.info('TokenService', `Refreshed token for ${account.provider}`)

                if (account.provider === 'copilot') {
                    this.copilotService.setGithubToken(data.access_token)
                }
                this.eventBus.emit('token:refreshed', { provider: account.provider, accountId: account.id })
            }
        } catch (error) {
            const errorMsg = getErrorMessage(error)
            appLogger.error('TokenService', `Failed to refresh GitHub token: ${errorMsg}`)
            this.eventBus.emit('token:error', { provider: account.provider, error: errorMsg })
        }
    }

    private getClientId(account: LinkedAccount): string | undefined {
        if (this.isGoogleProvider(account)) { return '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com' }
        if (this.isCodexProvider(account)) { return 'app_EMoamEEZ73f0CkXaXp7hrann' }
        if (this.isClaudeProvider(account)) { return '9d1c250a-e61b-44d9-88ed-5944d1962f5e' }
        return undefined
    }

    private getClientSecret(account: LinkedAccount): string | undefined {
        if (this.isGoogleProvider(account)) { return process.env.ANTIGRAVITY_CLIENT_SECRET }
        return undefined
    }

    private isGoogleProvider(account: LinkedAccount): boolean {
        const id = account.id.toLowerCase()
        const provider = (account.provider || id).toLowerCase()
        return provider.startsWith('google') || provider.startsWith('antigravity') || id.startsWith('google') || id.startsWith('antigravity')
    }

    private isCodexProvider(account: LinkedAccount): boolean {
        const id = account.id.toLowerCase()
        const provider = (account.provider || id).toLowerCase()
        return provider.startsWith('codex') || provider.startsWith('openai') || id.startsWith('codex') || id.startsWith('openai')
    }

    private isClaudeProvider(account: LinkedAccount): boolean {
        const id = account.id.toLowerCase()
        const provider = (account.provider || id).toLowerCase()
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
            const copilotToken = settings.copilot?.token ?? await this.authService.getActiveToken('copilot_token')

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
