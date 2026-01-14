/* eslint-disable complexity, max-depth, no-console */
import * as fs from 'fs'
import * as path from 'path'

import { appLogger } from '@main/logging/logger'
import { DataService } from '@main/services/data/data.service'
import { SecurityService } from '@main/services/security.service'
import { SettingsService } from '@main/services/settings.service'
import { JsonObject, JsonValue } from '@shared/types/common'
import { CodexUsage, ModelQuotaItem, QuotaInfo, QuotaResponse } from '@shared/types/quota'
import { getErrorMessage } from '@shared/utils/error.util'
import axios from 'axios'
import { app, net, session } from 'electron'

const ANTIGRAVITY_CLIENT_ID = process.env.ANTIGRAVITY_CLIENT_ID || ''
const ANTIGRAVITY_CLIENT_SECRET = process.env.ANTIGRAVITY_CLIENT_SECRET || ''

export class QuotaService {

    constructor(
        private settingsService: SettingsService,
        private dataService: DataService,
        private securityService: SecurityService
    ) { }

    private fetchWithNet(url: string, headers: Record<string, string>): Promise<any> {
        return new Promise((resolve, reject) => {
            try {
                const req = net.request({ url, method: 'GET' })
                for (const [k, v] of Object.entries(headers)) {
                    req.setHeader(k, v)
                }
                req.on('response', (response) => {
                    let body = ''
                    response.on('data', (chunk) => body += chunk.toString())
                    response.on('end', () => {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            try {
                                resolve(JSON.parse(body))
                            } catch (e) {
                                // If response is empty or not JSON, resolve null or reject
                                if (!body.trim()) { resolve(null) }
                                else { reject(new Error(`Failed to parse JSON: ${body.substring(0, 50)}`)) }
                            }
                        } else {
                            reject(new Error(`Request failed with status code ${response.statusCode}`))
                        }
                    })
                    response.on('error', (err) => reject(err))
                })
                req.on('error', (err) => reject(err))
                req.end()
            } catch (e) { reject(e) }
        })
    }

    private async makeRequest(path: string, port: number, apiKey: string): Promise<JsonObject | { success: boolean; error?: string; raw?: string }> {
        return new Promise((resolve, reject) => {
            const options = {
                method: 'GET', protocol: 'http:' as const, hostname: '127.0.0.1', port, path
            }
            const request = net.request(options)
            request.setHeader('Authorization', `Bearer ${apiKey}`)
            request.on('response', (res: any) => {
                let d = '';
                res.on('data', (chunk: Buffer) => { d += chunk.toString() });
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 400) {
                        resolve({ success: false, error: `HTTP ${res.statusCode}`, raw: d })
                        return
                    }
                    try {
                        resolve(JSON.parse(d) as JsonObject);
                    } catch {
                        resolve({ success: false, error: 'Invalid JSON', raw: d });
                    }
                })
            })
            request.on('error', (e: Error) => reject(e))
            request.end()
        })
    }

    async getQuota(_proxyPort: number, _proxyKey: string): Promise<QuotaResponse | null> {
        // 1. Try Antigravity (Direct Upstream) - official API
        try {
            const antigravity = await this.fetchAntigravityQuota()
            if (antigravity && !antigravity.authExpired) {
                return antigravity
            }
            if (antigravity?.authExpired) {
                // Auth expired
                return antigravity
            }
        } catch {
            // ignore
        }

        // 2. Try Legacy Fallback
        try {
            const legacy = await this.fetchLegacyQuota()
            if (legacy?.success) {
                return legacy
            }
        } catch {
            // ignore
        }

        // 3. Try Codex
        try {
            const codex = await this.fetchCodexQuota()
            if (codex?.success) {
                return codex
            }
        } catch {
            // ignore
        }

        return null
    }

    // --- Antigravity ---


    async fetchAntigravityUpstream(): Promise<JsonObject | null> {
        const authData = await this.getAntigravityAuthData()
        if (!authData) { return null }

        let accessToken = typeof authData.access_token === 'string' ? authData.access_token : ''
        const refreshToken = typeof authData.refresh_token === 'string' ? authData.refresh_token : ''
        const expiresIn = typeof authData.expires_in === 'number' ? authData.expires_in : 0
        const timestamp = typeof authData.timestamp === 'number' ? authData.timestamp : 0
        const email = typeof authData.email === 'string' ? authData.email : ''

        if (!accessToken) { return null }

        if (this.isTokenExpired({ timestamp, expires_in: expiresIn })) {
            if (!refreshToken) { throw new Error('AUTH_EXPIRED') }
            const newToken = await this.refreshAntigravityToken(refreshToken)
            if (newToken) {
                accessToken = newToken.access_token
                authData.access_token = newToken.access_token
                authData.expires_in = newToken.expires_in || 3599
                authData.timestamp = Date.now()
                this.updateAuthFile('antigravity-' + (email ? email.replace(/[@.]/g, '_') + '.json' : 'json'), authData)
            } else {
                throw new Error('AUTH_EXPIRED')
            }
        }

        const upstreamUrl = 'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels'
        const response = await axios.post(upstreamUrl, {}, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'User-Agent': 'antigravity/1.104.0 darwin/arm64'
            },
            timeout: 8000
        })
        if (response.status === 200 && response.data) { return response.data as JsonObject }
        return null
    }

    async fetchAntigravityQuota(): Promise<QuotaResponse | null> {
        try {
            const data = await this.fetchAntigravityUpstream()
            if (data) {
                return this.parseQuotaResponse(data as { models?: Record<string, { displayName?: string; quotaInfo?: QuotaInfo }> })
            }
        } catch (error) {
            if (error instanceof Error && error.message === 'AUTH_EXPIRED') {
                return { success: false, authExpired: true, status: 'Expired', next_reset: '-', models: [] }
            }
        }
        return null
    }


    async getAntigravityAvailableModels(): Promise<ModelQuotaItem[]> {
        try {
            const data = await this.fetchAntigravityUpstream() as { models?: Record<string, { displayName?: string; quotaInfo?: QuotaInfo }> } | null
            if (data?.models) {
                const models: ModelQuotaItem[] = []
                const nameMap: Record<string, string> = {
                    "gemini-2.5-pro": "Gemini 2.5 Pro",
                    "gemini-2.5-flash": "Gemini 2.5 Flash",
                    "gemini-2.0-flash": "Gemini 2.0 Flash"
                }

                for (const [key, val] of Object.entries(data.models)) {
                    if (key.startsWith('chat_') || key.startsWith('rev')) { continue }

                    let percentage = 100
                    let reset = '-'

                    if (val.quotaInfo) {
                        const q = val.quotaInfo;
                        if (typeof q.remainingFraction === 'number') {
                            percentage = Math.round(q.remainingFraction * 100)
                        } else if (typeof q.remainingQuota === 'number' && typeof q.totalQuota === 'number' && q.totalQuota > 0) {
                            percentage = Math.round((q.remainingQuota / q.totalQuota) * 100)
                        } else if (q.resetTime) {
                            percentage = 0
                        }

                        if (q.resetTime) {
                            try {
                                reset = new Date(q.resetTime).toLocaleString('tr-TR', {
                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                })
                            } catch {
                                // ignore
                            }
                        }
                    }

                    models.push({
                        id: key,
                        name: val.displayName || nameMap[key] || key,
                        object: 'model',
                        owned_by: 'antigravity',
                        provider: 'antigravity',
                        percentage,
                        reset,
                        permission: [],
                        quotaInfo: val.quotaInfo
                    })
                }
                return models
            }
        } catch {
            // ignore
        }
        return []
    }

    // --- Legacy ---

    async fetchLegacyQuota(): Promise<QuotaResponse | null> {
        try {
            const legacy = await this.getLegacyQuota()
            if (legacy && legacy.success) { return legacy as QuotaResponse }
        } catch {
            // ignore
        }
        return null
    }

    async getLegacyQuota(): Promise<{ success: boolean; authExpired?: boolean; data?: JsonObject } & Partial<QuotaResponse>> {
        const authData = await this.getAntigravityAuthData()
        if (!authData) { return { success: false, next_reset: '-', models: [], status: 'Error' } }
        return { success: true, data: { authenticated: true }, models: [], next_reset: '-', status: 'Authenticated' }
    }

    // --- Proxy ---

    async fetchProxyQuota(port: number, key: string): Promise<QuotaResponse | null> {
        try {
            const res = await this.makeRequest('/v1/quota', port, key)
            // Check if the response indicates an error (404, etc.)
            if (res && typeof res === 'object' && 'success' in res && res.success === false) {
                // Proxy doesn't have /v1/quota endpoint or returned error
                return null
            }
            // Only return if it looks like a valid QuotaResponse
            if (res && typeof res === 'object' && ('models' in res || 'status' in res)) {
                return res as unknown as QuotaResponse
            }
        } catch {
            // ignore
        }
        return null
    }

    // --- Codex ---

    async fetchCodexQuota(): Promise<QuotaResponse | null> {
        try {
            const codexData = await this.fetchCodexUsage()
            if (codexData) { return this.parseCodexUsageToQuota(codexData) }
        } catch {
            // ignore
        }
        return null
    }

    async getCodexUsage(): Promise<Partial<QuotaResponse>> {
        const result: Partial<QuotaResponse> & { usageSource: 'none' | 'chatgpt' } = { usageSource: 'none' }
        const whamData = await this.fetchCodexUsage()
        if (whamData) {
            const usage = this.extractCodexUsageFromWham(whamData)
            if (usage) {
                result.usage = usage
                result.usageSource = 'chatgpt'
            }

            const rawPlan = String(whamData.plan_type || (whamData.rate_limit as JsonObject)?.plan_type || usage?.planType || 'free')
            result.planType = rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1)
            if (result.usage) { (result.usage as CodexUsage).planType = result.planType }
            result.accountId = (whamData.account_id as string) || (whamData.user_id as string) || 'unknown'
            if (whamData.email) { result.email = whamData.email as string }
        }
        return result
    }

    async fetchCodexUsage(): Promise<JsonObject | null> {
        const settings = this.settingsService.getSettings()
        let token = settings.openai?.accessToken || settings.openai?.apiKey

        if (!token || token === 'connected') {
            try {
                const authDir = this.getAuthWorkDir()
                if (fs.existsSync(authDir)) {
                    const files = fs.readdirSync(authDir).filter(f => f.startsWith('codex-') && f.endsWith('.json'))
                    if (files.length > 0) {
                        const authFile = path.join(authDir, files[0])
                        const content = await this.readAuthFile(authFile)
                        const fileToken = content ? this.pickOpenAiAccessToken(content) : null
                        if (fileToken) { token = fileToken }
                    }
                }
            } catch {
                // ignore
            }
        }

        if (!token || token === 'connected') {
            try {
                const cookies = await session.defaultSession.cookies.get({ url: 'https://chatgpt.com' })
                if (cookies.length > 0) {
                    const cookieHeader = cookies.map((c: any) => `${c.name}=${c.value}`).join('; ')
                    const sessionRes = await axios.get('https://chatgpt.com/api/auth/session', {
                        headers: {
                            'Cookie': cookieHeader,
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        }
                    })
                    const sessionData = sessionRes.data as { accessToken?: string } | null
                    if (sessionData?.accessToken) { token = sessionData.accessToken }
                }
            } catch (error) {
                console.debug('[QuotaService] Failed to fetch ChatGPT session cookies:', getErrorMessage(error))
            }
        }

        if (!token || token === 'connected') { return null }

        const data = await this.fetchCodexUsageFromWham(token) as ({ email?: string } & JsonObject) | null
        if (data) {
            await this.updateAuthFile('codex-session.json', {
                accessToken: token,
                provider: 'codex',
                timestamp: Date.now(),
                email: data.email || settings.openai?.email
            })
        }
        return data
    }

    // --- Copilot ---

    // --- Claude/Anthropic ---

    async getClaudeQuota(): Promise<{ success: boolean; fiveHour?: { utilization: number; resetsAt: string }; sevenDay?: { utilization: number; resetsAt: string } }> {
        try {
            // Migration: Move manual txt key to JSON if exists
            try {
                const dir = this.getAuthWorkDir()
                const txtFile = path.join(dir, 'claude_session.txt')
                if (fs.existsSync(txtFile)) {
                    const key = (await fs.promises.readFile(txtFile, 'utf8')).trim()
                    if (key) { await this.updateClaudeAuth({ session_key: key }) }
                    await fs.promises.unlink(txtFile)
                }
            } catch (error) {
                appLogger.error('QuotaService', `Claude TXT migration failed: ${getErrorMessage(error as Error)}`)
            }

            // Capture from Electron if available (updates file)
            await this.captureElectronSessionKey()

            const authData = await this.getClaudeAuthData()

            if (!authData) {
                console.log('[DEBUG] getClaudeQuota: No authData')
                return { success: false }
            }

            let accessToken = ''
            if (typeof authData.access_token === 'string') { accessToken = authData.access_token }

            const sessionKey = typeof authData.session_key === 'string' ? authData.session_key :
                typeof authData.sessionKey === 'string' ? authData.sessionKey : null

            if (!accessToken && !sessionKey) {
                console.log('[DEBUG] getClaudeQuota: No access token or session key')
                return { success: false }
            }

            let orgId = typeof authData?.organization_id === 'string' ? authData.organization_id : null

            if (!orgId) {
                console.log('[DEBUG] getClaudeQuota: Fetching Org ID...')
                orgId = await this.fetchClaudeOrganizationId(accessToken, sessionKey)
                if (orgId) {
                    console.log('[DEBUG] getClaudeQuota: Found Org ID:', orgId)
                    this.updateClaudeAuth({ organization_id: orgId })
                } else {
                    console.log('[DEBUG] getClaudeQuota: Failed to fetch Org ID')
                }
            } else {
                console.log('[DEBUG] getClaudeQuota: Using cached Org ID:', orgId)
            }

            if (!orgId) { return { success: false } }

            console.log('[DEBUG] getClaudeQuota: Fetching usage...')
            const usage = await this.fetchClaudeUsage(accessToken, orgId, sessionKey)
            if (!usage) {
                console.log('[DEBUG] getClaudeQuota: Failed to fetch usage')
                return { success: false }
            }

            console.log('[DEBUG] getClaudeQuota: Usage fetched:', JSON.stringify(usage))

            return {
                success: true,
                fiveHour: usage.five_hour ? {
                    utilization: usage.five_hour.utilization,
                    resetsAt: usage.five_hour.resets_at
                } : undefined,
                sevenDay: usage.seven_day ? {
                    utilization: usage.seven_day.utilization,
                    resetsAt: usage.seven_day.resets_at
                } : undefined
            }
        } catch (error) {
            console.debug('[QuotaService] getClaudeQuota failed:', getErrorMessage(error))
            return { success: false }
        }
    }

    private async captureElectronSessionKey(): Promise<string | null> {
        // Try Electron cookies (auto-capture)
        try {
            const cookies = await session.defaultSession.cookies.get({ url: 'https://claude.ai', name: 'sessionKey' })
            if (cookies.length > 0) {
                const val = cookies[0].value
                await this.updateClaudeAuth({ session_key: val })
                return val
            }
        } catch (e) {
            console.debug('[QuotaService] Failed to fetch Claude session cookies:', getErrorMessage(e))
        }
        return null
    }

    private async updateClaudeAuth(updates: JsonObject) {
        try {
            const dir = this.getAuthWorkDir()
            if (!dir || !fs.existsSync(dir)) { return }

            // Logic to pick file
            let targetFile = 'claude-session.json'
            let existingContent: JsonObject = {}

            const files = (await fs.promises.readdir(dir)).filter(f => {
                const n = f.toLowerCase()
                return (n.startsWith('claude') || n.startsWith('anthropic')) && n.endsWith('.json')
            })

            // Let's find a file that has an access token
            let foundFile = '';
            for (const f of files) {
                const c = await this.readAuthFile(path.join(dir, f))
                if (c && (c.access_token || c.accessToken)) {
                    foundFile = f;
                    existingContent = c;
                    break;
                }
            }

            if (foundFile) {
                targetFile = foundFile;
            } else if (files.length > 0) {
                targetFile = files[0];
                existingContent = await this.readAuthFile(path.join(dir, targetFile)) || {}
            }

            // Update content by merging
            existingContent = { ...existingContent, ...updates, provider: 'claude' }

            await this.updateAuthFile(targetFile, existingContent)
        } catch (error) {
            appLogger.error('QuotaService', `updateClaudeAuth failed: ${getErrorMessage(error as Error)}`)
        }
    }

    private async fetchClaudeOrganizationId(accessToken: string, sessionKey: string | null): Promise<string | null> {
        // 1. Try to extract from JWT if possible
        if (accessToken) {
            try {
                const parts = accessToken.split('.')
                if (parts.length === 3) {
                    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
                    if (payload.org_id) { return payload.org_id }
                    if (payload.organization_id) { return payload.organization_id }
                    if (payload.org_uuid) { return payload.org_uuid }
                    if (payload.uuid) { return payload.uuid }
                }
            } catch (e) { }
        }

        // 2. Try API endpoints
        const endpoints = [
            'https://claude.ai/api/organizations',
            'https://console.anthropic.com/api/organizations',
            'https://api.anthropic.com/v1/organizations'
        ]

        for (const url of endpoints) {
            try {
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Anthropic-Version': '2023-06-01'
                }

                if (sessionKey) {
                    headers['Cookie'] = `sessionKey=${sessionKey}`
                } else if (accessToken) {
                    headers['Authorization'] = `Bearer ${accessToken}`
                } else {
                    continue
                }

                const data = await this.fetchWithNet(url, headers)
                if (Array.isArray(data) && data.length > 0) {
                    return data[0].uuid || data[0].id || null
                }
                if (data && typeof data === 'object') {
                    if (data.uuid) { return data.uuid; }
                    if (data.id) { return data.id; }
                }
            } catch (error) {
                console.log(`[DEBUG] fetchClaudeOrganizationId failed for ${url}:`, getErrorMessage(error))
            }
        }
        return null
    }

    private async fetchClaudeUsage(accessToken: string, orgId: string, sessionKey: string | null): Promise<{
        five_hour?: { utilization: number; resets_at: string };
        seven_day?: { utilization: number; resets_at: string };
    } | null> {
        const endpoints = [
            `https://claude.ai/api/organizations/${orgId}/usage`,
            `https://console.anthropic.com/api/organizations/${orgId}/usage`,
            `https://api.anthropic.com/v1/organizations/${orgId}/usage`
        ]

        for (const url of endpoints) {
            try {
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Anthropic-Version': '2023-06-01'
                }

                if (sessionKey) {
                    headers['Cookie'] = `sessionKey=${sessionKey}`
                } else {
                    headers['Authorization'] = `Bearer ${accessToken}`
                }

                const data = await this.fetchWithNet(url, headers)
                return data as {
                    five_hour?: { utilization: number; resets_at: string };
                    seven_day?: { utilization: number; resets_at: string };
                }
            } catch (error) {
                // ignore
            }
        }
        return null
    }

    private async getClaudeAuthData(): Promise<JsonObject | null> {
        try {
            const dir = this.getAuthWorkDir()
            if (dir && fs.existsSync(dir)) {
                const files = fs.readdirSync(dir)
                const claudeFiles = files.filter(f => {
                    const name = f.toLowerCase()
                    return (name.startsWith('claude') || name.startsWith('anthropic')) &&
                        (name.endsWith('.json') || name.endsWith('.enc'))
                })

                for (const file of claudeFiles) {
                    const content = await this.readAuthFile(path.join(dir, file))
                    if (content && (content.access_token || content.accessToken || content.session_key || content.sessionKey)) {
                        return content
                    }
                }
            }
            return null
        } catch (error) {
            console.debug('[QuotaService] getClaudeAuthData failed:', getErrorMessage(error))
            return null
        }
    }

    async getCopilotQuota(): Promise<{ success: boolean; plan?: string; limit?: number; remaining?: number; used?: number; percentage?: number | null }> {
        const rawData = await this.fetchCopilotBilling()
        if (!rawData) { return { success: false } }
        const data = rawData as { copilot_plan?: string; quota_snapshots?: { premium_interactions?: { entitlement: number; remaining: number; percent_remaining: number } } }
        const premium = data.quota_snapshots?.premium_interactions
        return {
            success: true,
            plan: data.copilot_plan || 'unknown',
            limit: premium?.entitlement || 0,
            remaining: premium?.remaining || 0,
            used: (premium?.entitlement || 0) - (premium?.remaining || 0),
            percentage: premium?.percent_remaining || (premium?.entitlement ? (premium.remaining / premium.entitlement * 100) : null)
        }
    }

    private async fetchCopilotBilling(): Promise<JsonObject | null> {
        const settings = this.settingsService.getSettings()
        let token = settings.copilot?.token

        // If no token in settings, check auth files
        if (!token || token === 'connected') {
            try {
                const authDir = this.getAuthWorkDir()
                if (fs.existsSync(authDir)) {
                    const files = fs.readdirSync(authDir).filter(f => {
                        const name = f.toLowerCase()
                        return (name.startsWith('copilot') || name.startsWith('github')) &&
                            (name.endsWith('.json') || name.endsWith('.enc'))
                    })

                    // Try copilot files first, then github files
                    const copilotFiles = files.filter(f => f.toLowerCase().startsWith('copilot'))
                    const githubFiles = files.filter(f => f.toLowerCase().startsWith('github'))

                    for (const file of [...copilotFiles, ...githubFiles]) {
                        const authFile = path.join(authDir, file)
                        const content = await this.readAuthFile(authFile)
                        if (content) {
                            // Try to extract token - could be in 'token' or 'access_token' field
                            const fileToken = typeof content.token === 'string' ? content.token :
                                typeof content.access_token === 'string' ? content.access_token :
                                    null
                            if (fileToken && fileToken !== 'connected') {
                                token = fileToken
                                break
                            }
                        }
                    }
                }
            } catch (e) {
                console.debug('[QuotaService] fetchCopilotBilling: Failed to check auth files:', getErrorMessage(e))
            }
        }

        if (!token || token === 'connected') { return null }

        try {
            const response = await axios.get('https://api.github.com/copilot_internal/user', {
                headers: { 'Authorization': `token ${token}`, 'User-Agent': 'GithubCopilot/1.250.0' }
            })
            return response.data as JsonObject
        } catch (error) {
            console.debug('[QuotaService] fetchCopilotBilling failed:', getErrorMessage(error))
            return null
        }
    }

    // --- Helpers ---


    extractCodexUsageFromWham(data: JsonValue): CodexUsage | null {
        if (!data || typeof data !== 'object') { return null }
        const d = data as JsonObject
        const rateLimit = this.asObject(d.rate_limit)
        const primaryWindow = rateLimit ? this.asObject(rateLimit.primary_window) : null
        const secondaryWindow = rateLimit ? this.asObject(rateLimit.secondary_window) : null

        const totalRequests = this.findNumberByKeys(d, ['total_requests', 'totalRequests', 'request_count', 'requests_used', 'requests'])
        const totalTokens = this.findNumberByKeys(d, ['total_tokens', 'totalTokens', 'token_count', 'tokens_used', 'tokens'])
        const remainingRequests = this.findNumberByKeys(d, ['remaining_requests', 'remainingRequests', 'requests_remaining'])
        const remainingTokens = this.findNumberByKeys(d, ['remaining_tokens', 'remainingTokens', 'tokens_remaining'])
        const dailyUsage = this.findNumberByKeys(d, ['daily_usage', 'dailyUsage', 'daily_used', 'usage_daily', 'requests_daily', 'requests_today', 'cap_usage', 'usage'])
        const dailyLimit = this.findNumberByKeys(d, ['daily_limit', 'dailyLimit', 'limit_daily', 'daily_quota', 'cap_limit', 'limit'])
        const weeklyUsage = this.findNumberByKeys(d, ['weekly_usage', 'weeklyUsage', 'weekly_used', 'usage_weekly', 'requests_weekly'])
        const weeklyLimit = this.findNumberByKeys(d, ['weekly_limit', 'weeklyLimit', 'limit_weekly', 'weekly_quota'])

        const dailyUsedPercent = this.toNumber(primaryWindow?.used_percent ?? null) ?? this.findNumberByKeys(d, ['rate_limit.primary_window.used_percent'])
        const weeklyUsedPercent = this.toNumber(secondaryWindow?.used_percent ?? null) ?? this.findNumberByKeys(d, ['rate_limit.secondary_window.used_percent'])

        const dailyResetAt = this.normalizeResetAt(primaryWindow?.reset_at ?? this.findNumberByKeys(d, ['rate_limit.primary_window.reset_at']))
        const weeklyResetAt = this.normalizeResetAt(secondaryWindow?.reset_at ?? this.findNumberByKeys(d, ['rate_limit.secondary_window.reset_at']))
        const resetAt = this.normalizeResetAt(
            this.findStringByKeys(d, ['reset_at', 'resetAt', 'reset_time', 'resetTime', 'next_reset', 'renew_at', 'renewAt']) ??
            this.findNumberByKeys(d, ['reset_at', 'resetAt', 'reset_time', 'resetTime', 'next_reset', 'renew_at', 'renewAt'])
        )

        const result: CodexUsage = {}
        if (totalRequests !== null) { result.totalRequests = totalRequests }
        if (totalTokens !== null) { result.totalTokens = totalTokens }
        if (remainingRequests !== null) { result.remainingRequests = remainingRequests }
        if (remainingTokens !== null) { result.remainingTokens = remainingTokens }
        if (dailyUsage !== null) { result.dailyUsage = dailyUsage }
        if (dailyLimit !== null) { result.dailyLimit = dailyLimit }
        if (weeklyUsage !== null) { result.weeklyUsage = weeklyUsage }
        if (weeklyLimit !== null) { result.weeklyLimit = weeklyLimit }
        if (dailyUsedPercent !== null) { result.dailyUsedPercent = dailyUsedPercent }
        if (weeklyUsedPercent !== null) { result.weeklyUsedPercent = weeklyUsedPercent }
        if (dailyResetAt) { result.dailyResetAt = dailyResetAt }
        if (weeklyResetAt) { result.weeklyResetAt = weeklyResetAt }
        if (resetAt) { result.resetAt = resetAt }

        return Object.keys(result).length > 0 ? result : null
    }

    private async fetchCodexUsageFromWham(accessToken: string): Promise<JsonObject | null> {
        const endpoints = ['https://chatgpt.com/backend-api/wham/usage', 'https://chat.openai.com/backend-api/wham/usage']
        for (const endpoint of endpoints) {
            try {
                const response = await axios.get(endpoint, {
                    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
                    timeout: 10000
                })
                if (response?.data && typeof response.data === 'object') { return response.data as JsonObject }
            } catch (e) {
                if (axios.isAxiosError(e) && (e.response?.status === 401 || e.response?.status === 403)) { break }
            }
        }
        return null
    }


    private parseQuotaResponse(data: { models?: Record<string, { displayName?: string; quotaInfo?: QuotaInfo }> }): QuotaResponse | null {
        if (!data.models) { return null }
        const models: ModelQuotaItem[] = []
        for (const [key, val] of Object.entries(data.models)) {
            try {
                if (key.startsWith('chat_') || key.startsWith('rev')) { continue }
                let percentage = 100
                let reset = '-'
                let quotaInfo: QuotaInfo | undefined

                if (val.quotaInfo) {
                    const q = val.quotaInfo;
                    if (typeof q.remainingFraction === 'number') {
                        percentage = Math.round(q.remainingFraction * 100)
                    } else if (typeof q.remainingQuota === 'number' && typeof q.totalQuota === 'number' && q.totalQuota > 0) {
                        percentage = Math.round((q.remainingQuota / q.totalQuota) * 100)
                    } else if (q.resetTime) {
                        percentage = 0
                    }

                    if (q.resetTime) {
                        try {
                            reset = new Date(q.resetTime).toLocaleString('tr-TR', {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })
                        } catch {
                            // ignore
                        }
                    }
                    quotaInfo = {
                        remainingQuota: q.remainingQuota,
                        totalQuota: q.totalQuota,
                        remainingFraction: q.remainingFraction ?? (percentage / 100),
                        resetTime: q.resetTime
                    }
                }

                models.push({
                    id: key,
                    name: val.displayName || key,
                    object: 'model',
                    owned_by: 'antigravity',
                    provider: 'antigravity',
                    percentage,
                    reset,
                    permission: [],
                    quotaInfo
                })
            } catch {
                // ignore
            }
        }

        return {
            status: models.length > 0 ? `${Math.round(models.reduce((sum, m) => sum + m.percentage, 0) / models.length)}%` : 'Available',
            next_reset: models.length > 0 ? models[0].reset : '-',
            models: models.sort((a, b) => a.name.localeCompare(b.name))
        }
    }

    private parseCodexUsageToQuota(data: JsonObject): QuotaResponse {
        const rateLimit = this.asObject(data.rate_limit)
        const primaryWindow = rateLimit ? this.asObject(rateLimit.primary_window) : null
        const secondaryWindow = rateLimit ? this.asObject(rateLimit.secondary_window) : null
        const planType = typeof data.plan_type === 'string' ? data.plan_type : ''
        return {
            success: true,
            status: 'ChatGPT Usage',
            next_reset: typeof primaryWindow?.reset_at === 'string' ? primaryWindow.reset_at : '-',
            models: [],
            usage: {
                dailyUsedPercent: this.toNumber(primaryWindow?.used_percent ?? null) || 0,
                weeklyUsedPercent: this.toNumber(secondaryWindow?.used_percent ?? null) || 0,
                dailyResetAt: typeof primaryWindow?.reset_at === 'string' ? primaryWindow.reset_at : undefined,
                weeklyResetAt: typeof secondaryWindow?.reset_at === 'string' ? secondaryWindow.reset_at : undefined,
                planType: String(planType || 'Free').toLowerCase().includes('plus') ? 'Plus' : (planType ? planType.charAt(0).toUpperCase() + planType.slice(1) : 'Free')
            }
        }
    }

    private async getAntigravityAuthData(): Promise<JsonObject | null> {
        try {
            const dir = this.getAuthWorkDir()
            if (dir && fs.existsSync(dir)) {
                const files = await fs.promises.readdir(dir)
                const findFile = (pattern: string | RegExp) => {
                    return files.find(f => {
                        const name = f.toLowerCase()
                        if (typeof pattern === 'string') {
                            return (name.startsWith(pattern.toLowerCase()) || name === pattern.toLowerCase()) &&
                                (name.endsWith('.json') || name.endsWith('.enc'))
                        }
                        return pattern.test(name)
                    })
                }

                const specific = findFile('antigravity-')
                if (specific) { return await this.readAuthFile(path.join(dir, specific)) }
                const tokenFile = findFile('antigravity_token')
                if (tokenFile) { return await this.readAuthFile(path.join(dir, tokenFile)) }
                const generic = findFile('antigravity')
                if (generic) { return await this.readAuthFile(path.join(dir, generic)) }

            }
            return null
        } catch (error) {
            console.debug('[QuotaService] getAntigravityAuthData failed:', getErrorMessage(error))
            return null
        }
    }

    private isTokenExpired(authData: { timestamp: number; expires_in: number }): boolean {
        if (!authData.timestamp || !authData.expires_in) { return true }
        const expiry = authData.timestamp + (authData.expires_in * 1000)
        return Date.now() > (expiry - 60000)
    }

    private async refreshAntigravityToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
        if (!refreshToken) { return null }
        try {
            const params = new URLSearchParams({
                client_id: ANTIGRAVITY_CLIENT_ID,
                client_secret: ANTIGRAVITY_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            })
            const res = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            })
            return res.data as { access_token: string; expires_in: number }
        } catch (error) {
            console.error('[QuotaService] refreshAntigravityToken failed:', getErrorMessage(error))
            return null
        }
    }

    private getAuthWorkDir(): string {
        return this.dataService ? this.dataService.getPath('auth') : path.join(app.getPath('userData'), 'auth')
    }

    private async readAuthFile(filePath: string): Promise<JsonObject | null> {
        try {
            const content = await fs.promises.readFile(filePath, 'utf8')
            let extracted: string = content;

            // Try to see if it's a JSON wrapper first
            try {
                const data = JSON.parse(content);
                const extractString = (obj: Record<string, unknown>): string | null => {
                    if (!obj) { return null; }
                    const candidates = ['token', 'encryptedPayload', 'ciphertext', 'data', 'access_token', 'accessToken'];
                    for (const c of candidates) {
                        if (typeof obj[c] === 'string' && obj[c]) { return obj[c] as string; }
                        if (typeof obj[c] === 'object' && obj[c] !== null) {
                            const nested = extractString(obj[c] as Record<string, unknown>);
                            if (nested) { return nested; }
                        }
                    }
                    return null;
                };
                const payload = extractString(data);
                if (payload) { extracted = payload; }
            } catch { /* Not JSON at top level */ }

            let decrypted: string | null = null;
            if (this.securityService && !extracted.trim().startsWith('{')) {
                decrypted = this.securityService.decryptSync(extracted);
                // Fallback to content if extraction was wrong and not JSON
                if (!decrypted && extracted !== content && !content.trim().startsWith('{')) {
                    decrypted = this.securityService.decryptSync(content);
                }
            }

            if (decrypted) {
                try {
                    const json = JSON.parse(decrypted);
                    return json && typeof json === 'object' && !Array.isArray(json) ? (json as JsonObject) : { access_token: decrypted.trim() } as JsonObject;
                } catch {
                    return { access_token: decrypted.trim() } as JsonObject
                }
            } else {
                // Final fallback: Maybe it's already plain text?
                const potential = extracted.trim();
                if (potential && !potential.startsWith('{')) {
                    return { access_token: potential } as JsonObject;
                }
            }
            return null
        } catch (error) {
            console.debug('[QuotaService] readAuthFile failed:', getErrorMessage(error))
            return null
        }
    }

    private async updateAuthFile(nameOrPrefix: string, data: JsonObject) {
        try {
            const dir = this.getAuthWorkDir()
            let fileName: string
            if (nameOrPrefix.endsWith('.json')) { fileName = nameOrPrefix }
            else {
                const files = (await fs.promises.readdir(dir)).filter(f => f.startsWith(nameOrPrefix + '-') && f.endsWith('.json'))
                fileName = files.length > 0 ? files[0] : `${nameOrPrefix}.json`
            }
            const filePath = path.join(dir, fileName)
            let persistedData = JSON.stringify(data, null, 2)
            if (this.securityService) {
                const encrypted = this.securityService.encryptSync(persistedData)
                persistedData = JSON.stringify({ encryptedPayload: encrypted, version: 1 })
            }
            await fs.promises.writeFile(filePath, persistedData)
        } catch (error) {
            appLogger.error('QuotaService', `updateAuthFile failed: ${getErrorMessage(error as Error)}`)
        }
    }

    private pickOpenAiAccessToken(authData: JsonObject): string | null {
        const ad = authData
        const candidates = [
            ad?.access_token, ad?.accessToken, ad?.AccessToken,
            (ad?.token as JsonObject)?.access_token, (ad?.token as JsonObject)?.accessToken,
            (ad?.session as JsonObject)?.access_token, (ad?.session as JsonObject)?.accessToken
        ]
        for (const value of candidates) { if (typeof value === 'string' && value.trim()) { return value.trim() } }
        return null
    }

    private findNumberByKeys(root: JsonValue, keys: string[]): number | null {
        const queue: Array<{ value: JsonValue; depth: number }> = [{ value: root, depth: 0 }]
        while (queue.length > 0) {
            const current = queue.shift()
            if (!current) { continue }
            const { value, depth } = current
            if (!value || typeof value !== 'object') { continue }
            if (depth >= 4) { continue }
            const v = value as JsonObject
            for (const key of keys) {
                const candidate = v[key]
                if (candidate !== undefined && candidate !== null) {
                    const num = Number(candidate)
                    if (!Number.isNaN(num)) { return num }
                }
            }
            const children = Array.isArray(value) ? value : Object.values(value)
            for (const child of children) {
                if (child && typeof child === 'object') { queue.push({ value: child, depth: depth + 1 }) }
            }
        }
        return null
    }

    private findStringByKeys(root: JsonValue, keys: string[]): string | null {
        const queue: Array<{ value: JsonValue; depth: number }> = [{ value: root, depth: 0 }]
        while (queue.length > 0) {
            const current = queue.shift()
            if (!current) { continue }
            const { value, depth } = current
            if (!value || typeof value !== 'object') { continue }
            if (!Array.isArray(value)) {
                const v = value as JsonObject
                for (const key of keys) {
                    const candidate = v[key]
                    if (typeof candidate === 'string' && candidate.trim()) { return candidate.trim() }
                }
            }
            if (depth >= 4) { continue }
            const children = Array.isArray(value) ? value : Object.values(value)
            for (const child of children) {
                if (child && typeof child === 'object') { queue.push({ value: child, depth: depth + 1 }) }
            }
        }
        return null
    }

    private normalizeResetAt(value: JsonValue): string | null {
        if (typeof value === 'string' && value.trim()) { return value.trim() }
        const numeric = this.toNumber(value)
        if (numeric === null) { return null }
        const ms = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric
        return new Date(ms).toISOString()
    }

    private toNumber(value: JsonValue): number | null {
        if (typeof value === 'number' && Number.isFinite(value)) { return value }
        if (typeof value === 'string') {
            const trimmed = value.trim()
            if (!trimmed) { return null }
            const parsed = Number(trimmed)
            if (!Number.isNaN(parsed)) { return parsed }
        }
        return null
    }

    private asObject(value: JsonValue | undefined): JsonObject | null {
        if (!value || typeof value !== 'object' || Array.isArray(value)) { return null }
        return value as JsonObject
    }

}
