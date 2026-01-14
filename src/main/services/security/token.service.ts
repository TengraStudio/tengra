import * as fs from 'fs'
import * as path from 'path'

import { DataService } from '@main/services/data/data.service'
import { CopilotService } from '@main/services/llm/copilot.service'
import { SecurityService } from '@main/services/security.service'
import { SettingsService } from '@main/services/settings.service'
import { JsonObject } from '@shared/types/common'
import { getErrorMessage } from '@shared/utils/error.util'
import axios from 'axios'
import { app } from 'electron'

// OAuth Client IDs and Secrets
// Client IDs are public, but secrets should be in environment variables
const ANTIGRAVITY_CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com'
const ANTIGRAVITY_CLIENT_SECRET = process.env.ANTIGRAVITY_CLIENT_SECRET || ''

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
export class TokenService {
    private readonly DEFAULT_REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
    private readonly DEFAULT_COPILOT_REFRESH_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes
    private legacyIntervals: NodeJS.Timeout[] = []

    constructor(
        private settingsService: SettingsService,
        private copilotService: CopilotService,
        private dataService: DataService,
        private securityService: SecurityService,
        private jobScheduler?: import('@main/services/job-scheduler.service').JobSchedulerService
    ) { }

    async cleanup() {
        this.stop()
    }

    /**
     * Start the token refresh service
     */
    start() {
        console.log('[TokenService] Starting unified token refresh service...')

        if (this.jobScheduler) {
            // Use JobScheduler for persistent, configurable intervals
            this.jobScheduler.registerRecurringJob(
                'token-refresh-oauth',
                async () => {
                    await this.refreshAllTokens()
                },
                () => {
                    const settings = this.settingsService.getSettings()
                    return settings.ai?.tokenRefreshInterval || this.DEFAULT_REFRESH_INTERVAL_MS
                }
            )

            this.jobScheduler.registerRecurringJob(
                'token-refresh-copilot',
                async () => {
                    await this.refreshCopilotToken()
                },
                () => {
                    const settings = this.settingsService.getSettings()
                    return settings.ai?.copilotRefreshInterval || this.DEFAULT_COPILOT_REFRESH_INTERVAL_MS
                }
            )

            console.log('[TokenService] Registered with JobScheduler for persistent scheduling')
        } else {
            // Fallback to simple setInterval (for backward compatibility)
            console.warn('[TokenService] No JobScheduler provided, using simple intervals')
            this.startLegacyIntervals()
        }

        // Initial check
        this.refreshAllTokens().catch(err => {
            console.error('[TokenService] Initial token refresh failed:', getErrorMessage(err))
        })

        console.log('[TokenService] Token refresh service started successfully')
    }

    private startLegacyIntervals() {
        // Legacy interval-based refresh (not persisted across restarts)
        const oauthInterval = setInterval(() => {
            this.refreshAllTokens().catch(err => {
                console.error('[TokenService] Periodic token refresh failed:', getErrorMessage(err))
            })
        }, this.DEFAULT_REFRESH_INTERVAL_MS)
        this.legacyIntervals.push(oauthInterval)

        const copilotInterval = setInterval(() => {
            this.refreshCopilotToken().catch(err => {
                console.error('[TokenService] Copilot token refresh failed:', getErrorMessage(err))
            })
        }, this.DEFAULT_COPILOT_REFRESH_INTERVAL_MS)
        this.legacyIntervals.push(copilotInterval)
    }

    /**
     * Stop the token refresh service
     */
    /**
     * Stop the token refresh service
     */
    stop() {
        // JobScheduler handles its own cleanup

        // Clear legacy intervals
        this.legacyIntervals.forEach(interval => clearInterval(interval))
        this.legacyIntervals = []

        console.log('[TokenService] Token refresh service stopped')
    }

    /**
     * Check which providers are logged in
     */
    private async getLoggedInProviders(): Promise<{
        google: boolean
        codex: boolean
        claude: boolean
        copilot: boolean
    }> {
        const settings = this.settingsService.getSettings()
        const authDir = this.getAuthDir()

        // Check Google/Antigravity
        let hasGoogle = false
        if (settings.antigravity?.connected && settings.antigravity?.token) {
            hasGoogle = true
        }
        if (!hasGoogle && fs.existsSync(authDir)) {
            try {
                const files = await fs.promises.readdir(authDir)
                hasGoogle = files.some(f => {
                    const name = f.toLowerCase().replace(/\.(json|enc)$/, '')
                    return name.startsWith('antigravity') || name.startsWith('google')
                })
            } catch (e) {
                // ignore
            }
        }

        // Check Codex
        let hasCodex = false
        if (settings.codex?.connected && settings.codex?.token) {
            hasCodex = true
        }
        if (!hasCodex && fs.existsSync(authDir)) {
            try {
                const files = await fs.promises.readdir(authDir)
                hasCodex = files.some(f => {
                    const name = f.toLowerCase().replace(/\.(json|enc)$/, '')
                    return name.startsWith('codex') || name.startsWith('openai')
                })
            } catch (e) {
                // ignore
            }
        }

        // Check Claude
        let hasClaude = false
        if (settings.claude?.apiKey && settings.claude.apiKey.length > 0) {
            hasClaude = true
        }
        if (!hasClaude && fs.existsSync(authDir)) {
            try {
                const files = await fs.promises.readdir(authDir)
                hasClaude = files.some(f => {
                    const name = f.toLowerCase().replace(/\.(json|enc)$/, '')
                    return name.startsWith('claude') || name.startsWith('anthropic')
                })
            } catch (e) {
                // ignore
            }
        }

        // Check Copilot - ONLY use copilot_token, no fallback to github_token
        const hasCopilot = this.copilotService.isConfigured() ||
            !!(settings.copilot?.connected && settings.copilot?.token && settings.copilot.token.length > 0)

        return { google: hasGoogle, codex: hasCodex, claude: hasClaude, copilot: hasCopilot }
    }

    /**
     * Refresh all OAuth tokens
     */
    private async refreshAllTokens() {
        const providers = await this.getLoggedInProviders()

        const tasks: Promise<void>[] = []

        if (providers.google) {
            tasks.push(this.refreshGoogleToken().catch(err => {
                console.error('[TokenService] Google token refresh failed:', getErrorMessage(err))
            }))
        }

        if (providers.codex) {
            tasks.push(this.refreshCodexToken().catch(err => {
                console.error('[TokenService] Codex token refresh failed:', getErrorMessage(err))
            }))
        }

        if (providers.claude) {
            tasks.push(this.refreshClaudeToken().catch(err => {
                console.error('[TokenService] Claude token refresh failed:', getErrorMessage(err))
            }))
        }

        if (tasks.length > 0) {
            await Promise.all(tasks)
            console.log(`[TokenService] Token refresh completed for ${tasks.length} provider(s)`)
        }
    }

    /**
     * Refresh Google/Antigravity token
     */
    private async refreshGoogleToken(): Promise<void> {
        const authDir = this.getAuthDir()
        if (!fs.existsSync(authDir)) { return }

        const files = (await fs.promises.readdir(authDir)).filter(f => {
            const name = f.toLowerCase().replace(/\.(json|enc)$/, '')
            return name.startsWith('antigravity') || name.startsWith('google')
        })

        for (const file of files) {
            try {
                const filePath = path.join(authDir, file)
                const authData = await this.readAuthFile(filePath)
                if (!authData) { continue }

                const refreshToken = typeof authData.refresh_token === 'string' ? authData.refresh_token : ''
                if (!refreshToken) { continue }

                const expiresIn = typeof authData.expires_in === 'number' ? authData.expires_in : 0
                const timestamp = typeof authData.timestamp === 'number' ? authData.timestamp : 0

                // Check if token is expired or will expire soon (within 5 minutes)
                const expiry = timestamp + (expiresIn * 1000)
                if (Date.now() < expiry - 5 * 60 * 1000) {
                    continue // Token still valid
                }

                console.log('[TokenService] Refreshing Google/Antigravity token...')

                const params = new URLSearchParams({
                    client_id: ANTIGRAVITY_CLIENT_ID,
                    client_secret: ANTIGRAVITY_CLIENT_SECRET,
                    refresh_token: refreshToken,
                    grant_type: 'refresh_token'
                })

                const response = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    timeout: 10000
                })

                const newAccessToken = response.data.access_token
                const newExpiresIn = response.data.expires_in || 3600
                const newRefreshToken = response.data.refresh_token || refreshToken

                // Update token data
                const updatedData: JsonObject = {
                    ...authData,
                    access_token: newAccessToken,
                    refresh_token: newRefreshToken,
                    expires_in: newExpiresIn,
                    timestamp: Date.now()
                }

                // Save updated token
                await this.saveAuthFile(filePath, updatedData)

                console.log('[TokenService] Google/Antigravity token refreshed successfully')
            } catch (error: unknown) {
                const errorMsg = getErrorMessage(error)
                const axiosError = error as { response?: { status?: number; data?: { error?: string } } }
                const statusCode = axiosError?.response?.status
                const errorCode = axiosError?.response?.data?.error

                // Check if refresh token is invalid/expired (OAuth error codes)
                if (statusCode === 400 && (errorCode === 'invalid_grant' || errorCode === 'invalid_request')) {
                    console.warn(`[TokenService] Refresh token expired or invalid for ${file}. User needs to re-authenticate.`)
                    // Optionally: delete the expired token file to force re-authentication
                    // fs.unlinkSync(filePath).catch(() => {})
                }

                console.error(`[TokenService] Failed to refresh Google token from ${file}:`, errorMsg)
            }
        }
    }

    /**
     * Refresh Codex token
     */
    private async refreshCodexToken(): Promise<void> {
        const authDir = this.getAuthDir()
        if (!fs.existsSync(authDir)) { return }

        const files = (await fs.promises.readdir(authDir)).filter(f => {
            const name = f.toLowerCase().replace(/\.(json|enc)$/, '')
            return name.startsWith('codex') || name.startsWith('openai')
        })

        for (const file of files) {
            try {
                const filePath = path.join(authDir, file)
                const authData = await this.readAuthFile(filePath)
                if (!authData) { continue }

                const refreshToken = typeof authData.refresh_token === 'string' ? authData.refresh_token : ''
                if (!refreshToken) { continue }

                const expire = typeof authData.expired === 'string' ? authData.expired : ''
                if (expire) {
                    const expiryDate = new Date(expire)
                    if (Date.now() < expiryDate.getTime() - 5 * 60 * 1000) {
                        continue // Token still valid
                    }
                }
                console.log('[TokenService] Refreshing Codex token...')

                // Codex uses OpenAI OAuth flow (form-encoded)
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

                const newAccessToken = response.data.access_token
                const newRefreshToken = response.data.refresh_token || refreshToken
                const newIdToken = response.data.id_token || authData.id_token
                const expiresIn = response.data.expires_in || 3600
                const expiryDate = new Date(Date.now() + expiresIn * 1000).toISOString()

                // Update token data
                const updatedData: JsonObject = {
                    ...authData,
                    access_token: newAccessToken,
                    refresh_token: newRefreshToken,
                    id_token: newIdToken,
                    expired: expiryDate,
                    last_refresh: new Date().toISOString()
                }

                // Save updated token
                await this.saveAuthFile(filePath, updatedData)
                console.log('[TokenService] Codex token refreshed successfully')
            } catch (error: unknown) {
                const errorMsg = getErrorMessage(error)
                const axiosError = error as { response?: { status?: number; data?: { error?: string } } }
                const statusCode = axiosError?.response?.status
                const errorCode = axiosError?.response?.data?.error

                // Check if refresh token is invalid/expired
                if (statusCode === 400 && (errorCode === 'invalid_grant' || errorCode === 'invalid_request')) {
                    console.warn(`[TokenService] Refresh token expired or invalid for ${file}. User needs to re-authenticate.`)
                }

                console.error(`[TokenService] Failed to refresh Codex token from ${file}:`, errorMsg)
            }
        }
    }

    /**
     * Refresh Claude token
     * 
     * Claude doesn't use traditional OAuth refresh tokens.
     * Instead, it uses session cookies from claude.ai.
     * We capture the sessionKey cookie from Electron's session.
     * 
     * For OAuth-based flow (if available), we attempt standard refresh.
     */
    private async refreshClaudeToken(): Promise<void> {
        const authDir = this.getAuthDir()

        // 1. First, try to capture sessionKey from Electron browser session
        try {
            const { session } = await import('electron')
            const cookies = await session.defaultSession.cookies.get({
                url: 'https://claude.ai',
                name: 'sessionKey'
            })

            if (cookies.length > 0 && cookies[0].value) {
                const sessionKey = cookies[0].value
                console.log('[TokenService] Captured Claude sessionKey from Electron cookies')

                // Save to auth file
                await this.updateClaudeAuthFile(authDir, {
                    session_key: sessionKey,
                    captured_at: Date.now()
                })
                return // Session key captured successfully
            }
        } catch (e) {
            console.debug('[TokenService] Could not capture Claude sessionKey from cookies:', getErrorMessage(e))
        }

        // 2. If we have a refresh_token in file, try OAuth refresh
        if (!fs.existsSync(authDir)) { return }

        const files = (await fs.promises.readdir(authDir)).filter(f => {
            const name = f.toLowerCase().replace(/\.(json|enc)$/, '')
            return name.startsWith('claude') || name.startsWith('anthropic')
        })

        for (const file of files) {
            try {
                const filePath = path.join(authDir, file)
                const authData = await this.readAuthFile(filePath)
                if (!authData) { continue }

                const refreshToken = typeof authData.refresh_token === 'string' ? authData.refresh_token : ''
                if (!refreshToken) {
                    // No refresh token - check if we have a valid session_key
                    const sessionKey = typeof authData.session_key === 'string' ? authData.session_key : ''
                    if (sessionKey) {
                        // Validate session key by making a test request
                        const isValid = await this.validateClaudeSessionKey(sessionKey)
                        if (isValid) {
                            console.log('[TokenService] Claude session_key is still valid')
                            continue
                        } else {
                            console.warn('[TokenService] Claude session_key expired. User needs to re-authenticate via browser.')
                        }
                    }
                    continue
                }

                const expire = typeof authData.expired === 'string' ? authData.expired : ''
                if (expire) {
                    const expiryDate = new Date(expire)
                    if (Date.now() < expiryDate.getTime() - 5 * 60 * 1000) {
                        continue // Token still valid
                    }
                }

                console.log('[TokenService] Refreshing Claude OAuth token...')

                // Claude OAuth refresh (standard flow)
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

                const newAccessToken = response.data.access_token
                const newRefreshToken = response.data.refresh_token || refreshToken
                const expiresIn = response.data.expires_in || 3600
                const expiryDate = new Date(Date.now() + expiresIn * 1000).toISOString()
                const email = response.data.account?.email_address || authData.email

                // Update token data
                const updatedData: JsonObject = {
                    ...authData,
                    access_token: newAccessToken,
                    refresh_token: newRefreshToken,
                    expired: expiryDate,
                    email: email,
                    last_refresh: new Date().toISOString()
                }

                // Save updated token
                await this.saveAuthFile(filePath, updatedData)
                console.log('[TokenService] Claude OAuth token refreshed successfully')
            } catch (error: unknown) {
                const errorMsg = getErrorMessage(error)
                const axiosError = error as { response?: { status?: number; data?: { error?: string } } }
                const statusCode = axiosError?.response?.status
                const errorCode = axiosError?.response?.data?.error

                // Check if refresh token is invalid/expired
                if (statusCode === 400 && (errorCode === 'invalid_grant' || errorCode === 'invalid_request')) {
                    console.warn(`[TokenService] Refresh token expired or invalid for ${file}. User needs to re-authenticate.`)
                }

                console.error(`[TokenService] Failed to refresh Claude token from ${file}:`, errorMsg)
            }
        }
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
     * Update Claude auth file with new data
     */
    private async updateClaudeAuthFile(authDir: string, updates: JsonObject): Promise<void> {
        if (!fs.existsSync(authDir)) {
            fs.mkdirSync(authDir, { recursive: true })
        }

        let targetFile = 'claude-session.json'
        let existingContent: JsonObject = {}

        const files = (await fs.promises.readdir(authDir)).filter(f => {
            const n = f.toLowerCase()
            return (n.startsWith('claude') || n.startsWith('anthropic')) && n.endsWith('.json')
        })

        if (files.length > 0) {
            targetFile = files[0]
            existingContent = await this.readAuthFile(path.join(authDir, targetFile)) || {}
        }

        const updatedContent: JsonObject = {
            ...existingContent,
            ...updates,
            provider: 'claude',
            updated_at: Date.now()
        }

        await this.saveAuthFile(path.join(authDir, targetFile), updatedContent)
    }

    /**
     * Refresh Copilot session token (GitHub token -> Copilot session token)
     * Note: GitHub PATs cannot be refreshed - they must be manually regenerated.
     * This only refreshes the Copilot session token (which expires every ~20 minutes).
     */
    private async refreshCopilotToken(): Promise<void> {
        const providers = await this.getLoggedInProviders()

        if (!providers.copilot) {
            return // Copilot not logged in, skip
        }

        try {
            console.log('[TokenService] Checking Copilot session token...')

            // The CopilotService handles token refresh internally via ensureCopilotToken()
            // We need to ensure the copilot token is loaded from AuthService if not in settings
            // ONLY use copilot_token, no fallback to github_token
            const settings = this.settingsService.getSettings()
            let copilotToken = settings.copilot?.token

            // If token not in settings, try to load from AuthService
            if (!copilotToken && this.dataService) {
                const authDir = this.getAuthDir()
                const copilotTokenFile = path.join(authDir, 'copilot_token.json')

                // ONLY use copilot_token, no fallback
                if (fs.existsSync(copilotTokenFile)) {
                    const authData = await this.readAuthFile(copilotTokenFile)
                    if (authData && typeof authData.token === 'string') {
                        copilotToken = authData.token
                    } else if (authData && typeof authData.access_token === 'string') {
                        copilotToken = authData.access_token
                    }
                }
            }

            if (copilotToken) {
                this.copilotService.setGithubToken(copilotToken)
                console.log('[TokenService] Copilot token loaded, session token will refresh on next use')
            } else {
                console.warn('[TokenService] No copilot_token found - user needs to re-login')
            }
        } catch (error) {
            console.error('[TokenService] Failed to refresh Copilot token:', getErrorMessage(error))
        }
    }

    /**
     * Read and decrypt auth file
     */
    private async readAuthFile(filePath: string): Promise<JsonObject | null> {
        try {
            const content = await fs.promises.readFile(filePath, 'utf8')
            let json: JsonObject

            try {
                json = JSON.parse(content)
            } catch {
                return null
            }

            // Handle encrypted format
            if (this.securityService && json.token && typeof json.token === 'string') {
                const decrypted = this.securityService.decryptSync(json.token)
                if (decrypted) {
                    try {
                        return JSON.parse(decrypted) as JsonObject
                    } catch {
                        return { access_token: decrypted } as JsonObject
                    }
                }
            }

            // Handle old encrypted format
            if (this.securityService && json.encryptedPayload && typeof json.encryptedPayload === 'string') {
                const decrypted = this.securityService.decryptSync(json.encryptedPayload)
                if (decrypted) {
                    return JSON.parse(decrypted) as JsonObject
                }
            }

            return json
        } catch (error) {
            console.error(`[TokenService] Failed to read auth file ${filePath}:`, getErrorMessage(error))
            return null
        }
    }

    /**
     * Save and encrypt auth file
     */
    private async saveAuthFile(filePath: string, data: JsonObject): Promise<void> {
        try {
            if (this.securityService) {
                // Encrypt the token data
                const encrypted = this.securityService.encryptSync(JSON.stringify(data))
                const wrapper = {
                    provider: path.basename(filePath, path.extname(filePath)),
                    token: encrypted,
                    updatedAt: Date.now()
                }
                await fs.promises.writeFile(filePath, JSON.stringify(wrapper, null, 2), 'utf8')
            } else {
                // Save as plain JSON (not recommended but fallback)
                await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
            }
        } catch (error) {
            console.error(`[TokenService] Failed to save auth file ${filePath}:`, getErrorMessage(error))
        }
    }

    private getAuthDir(): string {
        if (this.dataService) { return this.dataService.getPath('auth') }
        return path.join(app.getPath('userData'), 'auth')
    }
}
