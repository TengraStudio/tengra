import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import axios from 'axios'
import { SettingsService } from './settings.service'
import { CopilotService } from './llm/copilot.service'
import { DataService } from './data/data.service'
import { SecurityService } from './security.service'
import { JsonObject } from '../../shared/types/common'
import { getErrorMessage } from '../../shared/utils/error.util'

// OAuth Client IDs and Secrets
const ANTIGRAVITY_CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com'
const ANTIGRAVITY_CLIENT_SECRET = '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'

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
export class TokenRefreshService {
    private refreshInterval: NodeJS.Timeout | null = null
    private copilotRefreshInterval: NodeJS.Timeout | null = null
    private readonly REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
    private readonly COPILOT_REFRESH_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes (Copilot tokens last ~20 minutes)

    constructor(
        private settingsService: SettingsService,
        private copilotService: CopilotService,
        private dataService: DataService,
        private securityService: SecurityService
    ) {}

    /**
     * Start the token refresh service
     */
    start() {
        console.log('[TokenRefreshService] Starting unified token refresh service...')
        console.log('[TokenRefreshService] OAuth refresh interval: 5 minutes')
        console.log('[TokenRefreshService] Copilot session token refresh interval: 15 minutes')
        
        // Initial check
        this.refreshAllTokens().catch(err => {
            console.error('[TokenRefreshService] Initial token refresh failed:', getErrorMessage(err))
        })
        
        // Set up periodic refresh
        this.refreshInterval = setInterval(() => {
            this.refreshAllTokens().catch(err => {
                console.error('[TokenRefreshService] Periodic token refresh failed:', getErrorMessage(err))
            })
        }, this.REFRESH_INTERVAL_MS)
        
        // Set up Copilot token refresh (separate interval)
        this.copilotRefreshInterval = setInterval(() => {
            this.refreshCopilotToken().catch(err => {
                console.error('[TokenRefreshService] Copilot token refresh failed:', getErrorMessage(err))
            })
        }, this.COPILOT_REFRESH_INTERVAL_MS)
        
        console.log('[TokenRefreshService] Token refresh service started successfully')
    }

    /**
     * Stop the token refresh service
     */
    stop() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval)
            this.refreshInterval = null
        }
        if (this.copilotRefreshInterval) {
            clearInterval(this.copilotRefreshInterval)
            this.copilotRefreshInterval = null
        }
        console.log('[TokenRefreshService] Token refresh service stopped')
    }

    /**
     * Check which providers are logged in
     */
    private getLoggedInProviders(): {
        google: boolean
        codex: boolean
        claude: boolean
        copilot: boolean
    } {
        const settings = this.settingsService.getSettings()
        const authDir = this.getAuthDir()
        
        // Check Google/Antigravity
        let hasGoogle = false
        if (settings.antigravity?.connected && settings.antigravity?.token) {
            hasGoogle = true
        }
        if (!hasGoogle && fs.existsSync(authDir)) {
            try {
                const files = fs.readdirSync(authDir)
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
                const files = fs.readdirSync(authDir)
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
                const files = fs.readdirSync(authDir)
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
        const providers = this.getLoggedInProviders()
        
        const tasks: Promise<void>[] = []
        
        if (providers.google) {
            tasks.push(this.refreshGoogleToken().catch(err => {
                console.error('[TokenRefreshService] Google token refresh failed:', getErrorMessage(err))
            }))
        }
        
        if (providers.codex) {
            tasks.push(this.refreshCodexToken().catch(err => {
                console.error('[TokenRefreshService] Codex token refresh failed:', getErrorMessage(err))
            }))
        }
        
        if (providers.claude) {
            tasks.push(this.refreshClaudeToken().catch(err => {
                console.error('[TokenRefreshService] Claude token refresh failed:', getErrorMessage(err))
            }))
        }
        
        if (tasks.length > 0) {
            await Promise.all(tasks)
            console.log(`[TokenRefreshService] Token refresh completed for ${tasks.length} provider(s)`)
        }
    }

    /**
     * Refresh Google/Antigravity token
     */
    private async refreshGoogleToken(): Promise<void> {
        const authDir = this.getAuthDir()
        if (!fs.existsSync(authDir)) return
        
        const files = fs.readdirSync(authDir).filter(f => {
            const name = f.toLowerCase().replace(/\.(json|enc)$/, '')
            return name.startsWith('antigravity') || name.startsWith('google')
        })
        
        for (const file of files) {
            try {
                const filePath = path.join(authDir, file)
                const authData = this.readAuthFile(filePath)
                if (!authData) continue
                
                const refreshToken = typeof authData.refresh_token === 'string' ? authData.refresh_token : ''
                if (!refreshToken) continue
                
                const expiresIn = typeof authData.expires_in === 'number' ? authData.expires_in : 0
                const timestamp = typeof authData.timestamp === 'number' ? authData.timestamp : 0
                
                // Check if token is expired or will expire soon (within 5 minutes)
                const expiry = timestamp + (expiresIn * 1000)
                if (Date.now() < expiry - 5 * 60 * 1000) {
                    continue // Token still valid
                }
                
                console.log('[TokenRefreshService] Refreshing Google/Antigravity token...')
                
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
                this.saveAuthFile(filePath, updatedData)
                
                console.log('[TokenRefreshService] Google/Antigravity token refreshed successfully')
            } catch (error: any) {
                const errorMsg = getErrorMessage(error)
                const statusCode = error?.response?.status
                const errorCode = error?.response?.data?.error
                
                // Check if refresh token is invalid/expired (OAuth error codes)
                if (statusCode === 400 && (errorCode === 'invalid_grant' || errorCode === 'invalid_request')) {
                    console.warn(`[TokenRefreshService] Refresh token expired or invalid for ${file}. User needs to re-authenticate.`)
                    // Optionally: delete the expired token file to force re-authentication
                    // fs.unlinkSync(filePath).catch(() => {})
                }
                
                console.error(`[TokenRefreshService] Failed to refresh Google token from ${file}:`, errorMsg)
            }
        }
    }

    /**
     * Refresh Codex token
     */
    private async refreshCodexToken(): Promise<void> {
        const authDir = this.getAuthDir()
        if (!fs.existsSync(authDir)) return
        
        const files = fs.readdirSync(authDir).filter(f => {
            const name = f.toLowerCase().replace(/\.(json|enc)$/, '')
            return name.startsWith('codex') || name.startsWith('openai')
        })
        
        for (const file of files) {
            try {
                const filePath = path.join(authDir, file)
                const authData = this.readAuthFile(filePath)
                if (!authData) continue
                
                const refreshToken = typeof authData.refresh_token === 'string' ? authData.refresh_token : ''
                if (!refreshToken) continue
                
                const expire = typeof authData.expired === 'string' ? authData.expired : ''
                if (expire) {
                    const expiryDate = new Date(expire)
                    if (Date.now() < expiryDate.getTime() - 5 * 60 * 1000) {
                        continue // Token still valid
                    }
                }
                
                console.log('[TokenRefreshService] Refreshing Codex token...')
                
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
                this.saveAuthFile(filePath, updatedData)
                
                console.log('[TokenRefreshService] Codex token refreshed successfully')
            } catch (error: any) {
                const errorMsg = getErrorMessage(error)
                const statusCode = error?.response?.status
                const errorCode = error?.response?.data?.error
                
                // Check if refresh token is invalid/expired
                if (statusCode === 400 && (errorCode === 'invalid_grant' || errorCode === 'invalid_request')) {
                    console.warn(`[TokenRefreshService] Refresh token expired or invalid for ${file}. User needs to re-authenticate.`)
                }
                
                console.error(`[TokenRefreshService] Failed to refresh Codex token from ${file}:`, errorMsg)
            }
        }
    }

    /**
     * Refresh Claude token
     */
    private async refreshClaudeToken(): Promise<void> {
        const authDir = this.getAuthDir()
        if (!fs.existsSync(authDir)) return
        
        const files = fs.readdirSync(authDir).filter(f => {
            const name = f.toLowerCase().replace(/\.(json|enc)$/, '')
            return name.startsWith('claude') || name.startsWith('anthropic')
        })
        
        for (const file of files) {
            try {
                const filePath = path.join(authDir, file)
                const authData = this.readAuthFile(filePath)
                if (!authData) continue
                
                const refreshToken = typeof authData.refresh_token === 'string' ? authData.refresh_token : ''
                if (!refreshToken) continue
                
                const expire = typeof authData.expired === 'string' ? authData.expired : ''
                if (expire) {
                    const expiryDate = new Date(expire)
                    if (Date.now() < expiryDate.getTime() - 5 * 60 * 1000) {
                        continue // Token still valid
                    }
                }
                
                console.log('[TokenRefreshService] Refreshing Claude token...')
                
                // Claude OAuth refresh
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
                this.saveAuthFile(filePath, updatedData)
                
                console.log('[TokenRefreshService] Claude token refreshed successfully')
            } catch (error: any) {
                const errorMsg = getErrorMessage(error)
                const statusCode = error?.response?.status
                const errorCode = error?.response?.data?.error
                
                // Check if refresh token is invalid/expired
                if (statusCode === 400 && (errorCode === 'invalid_grant' || errorCode === 'invalid_request')) {
                    console.warn(`[TokenRefreshService] Refresh token expired or invalid for ${file}. User needs to re-authenticate.`)
                }
                
                console.error(`[TokenRefreshService] Failed to refresh Claude token from ${file}:`, errorMsg)
            }
        }
    }

    /**
     * Refresh Copilot session token (GitHub token -> Copilot session token)
     * Note: GitHub PATs cannot be refreshed - they must be manually regenerated.
     * This only refreshes the Copilot session token (which expires every ~20 minutes).
     */
    private async refreshCopilotToken(): Promise<void> {
        const providers = this.getLoggedInProviders()
        
        if (!providers.copilot) {
            return // Copilot not logged in, skip
        }
        
        try {
            console.log('[TokenRefreshService] Checking Copilot session token...')
            
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
                    const authData = this.readAuthFile(copilotTokenFile)
                    if (authData && typeof authData.token === 'string') {
                        copilotToken = authData.token
                    } else if (authData && typeof authData.access_token === 'string') {
                        copilotToken = authData.access_token
                    }
                }
            }
            
            if (copilotToken) {
                this.copilotService.setGithubToken(copilotToken)
                console.log('[TokenRefreshService] Copilot token loaded, session token will refresh on next use')
            } else {
                console.warn('[TokenRefreshService] No copilot_token found - user needs to re-login')
            }
        } catch (error) {
            console.error('[TokenRefreshService] Failed to refresh Copilot token:', getErrorMessage(error))
        }
    }

    /**
     * Read and decrypt auth file
     */
    private readAuthFile(filePath: string): JsonObject | null {
        try {
            const content = fs.readFileSync(filePath, 'utf8')
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
            console.error(`[TokenRefreshService] Failed to read auth file ${filePath}:`, getErrorMessage(error))
            return null
        }
    }

    /**
     * Save and encrypt auth file
     */
    private saveAuthFile(filePath: string, data: JsonObject): void {
        try {
            if (this.securityService) {
                // Encrypt the token data
                const encrypted = this.securityService.encryptSync(JSON.stringify(data))
                const wrapper = {
                    provider: path.basename(filePath, path.extname(filePath)),
                    token: encrypted,
                    updatedAt: Date.now()
                }
                fs.writeFileSync(filePath, JSON.stringify(wrapper, null, 2), 'utf8')
            } else {
                // Save as plain JSON (not recommended but fallback)
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
            }
        } catch (error) {
            console.error(`[TokenRefreshService] Failed to save auth file ${filePath}:`, getErrorMessage(error))
        }
    }

    private getAuthDir(): string {
        if (this.dataService) return this.dataService.getPath('auth')
        return path.join(app.getPath('userData'), 'auth')
    }
}
