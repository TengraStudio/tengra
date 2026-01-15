/* eslint-disable complexity, max-depth, no-console */
import { AuthService } from '@main/services/security/auth.service'
import { SettingsService } from '@main/services/system/settings.service'
import { JsonObject, JsonValue } from '@shared/types/common'
import { CodexUsage, ModelQuotaItem, QuotaInfo, QuotaResponse } from '@shared/types/quota'
import { getErrorMessage } from '@shared/utils/error.util'
import axios from 'axios'
import { net, session } from 'electron'

export class QuotaService {

    constructor(
        private settingsService: SettingsService,
        private authService: AuthService
    ) { }

    private fetchWithNet(url: string, headers: Record<string, string>): Promise<JsonValue | null> {
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
                            } catch {
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
            request.on('response', (res) => {
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
        let authToken = await this.authService.getAuthToken('antigravity')
        if (!authToken) {
            // Fallback to google
            authToken = await this.authService.getAuthToken('google')
        }

        if (!authToken) { return null }

        const accessToken = authToken.accessToken

        if (!accessToken) { return null }

        // Token expiry check could be handled here or rely on upstream failure
        // For simplicity, if we have access token, we try. If it fails with 401, we might need refresh via TokenService?
        // TokenService runs in background to keep tokens fresh.
        // But if we need to force refresh:
        // QuotaService shouldn't be responsible for refreshing generally if TokenService exists.
        // However, the original code had expiry check logic.
        // We will assume TokenService keeps it fresh.

        const upstreamUrl = 'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels'
        try {
            const response = await axios.post(upstreamUrl, {}, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'antigravity/1.104.0 darwin/arm64'
                },
                timeout: 8000
            })
            if (response.status === 200 && response.data) { return response.data as JsonObject }
        } catch {
            // If 401, maybe trigger refresh?
        }
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
                        name: val.displayName ?? nameMap[key] ?? key,
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
        const token = await this.authService.getToken('antigravity')
        if (!token) { return { success: false, next_reset: '-', models: [], status: 'Error' } }
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

            const rawPlan = String(whamData.plan_type ?? (whamData.rate_limit as JsonObject)?.plan_type ?? usage?.planType ?? 'free')
            result.planType = rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1)
            if (result.usage) { (result.usage as CodexUsage).planType = result.planType }
            result.accountId = (whamData.account_id as string) ?? (whamData.user_id as string) ?? 'unknown'
            if (whamData.email) { result.email = whamData.email as string }
        }
        return result
    }

    async fetchCodexUsage(): Promise<JsonObject | null> {
        const settings = this.settingsService.getSettings()
        let token = settings.openai?.accessToken ?? settings.openai?.apiKey

        if (!token || token === 'connected') {
            try {
                const dbToken = await this.authService.getToken('codex')
                if (dbToken) { token = dbToken }
            } catch {
                // ignore
            }
        }

        if (!token || token === 'connected') {
            try {
                const cookies = await session.defaultSession.cookies.get({ url: 'https://chatgpt.com' })
                if (cookies.length > 0) {
                    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
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

        return data
    }

    // --- Copilot ---

    // --- Claude/Anthropic ---

    async getClaudeQuota(): Promise<{ success: boolean; fiveHour?: { utilization: number; resetsAt: string }; sevenDay?: { utilization: number; resetsAt: string } }> {
        try {
            const authData = await this.authService.getAuthToken('claude')
            if (!authData) { return { success: false } }

            const accessToken = authData.accessToken
            const sessionKey = authData.sessionToken

            if (!accessToken && !sessionKey) { return { success: false } }

            const orgId = await this.fetchClaudeOrganizationId(accessToken ?? '', sessionKey ?? null)
            if (!orgId) { return { success: false } }

            const usage = await this.fetchClaudeUsage(accessToken ?? '', orgId, sessionKey ?? null)
            if (!usage) { return { success: false } }

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

    private async fetchClaudeOrganizationId(accessToken: string, sessionKey: string | null): Promise<string | null> {
        if (accessToken) {
            try {
                const parts = accessToken.split('.')
                if (parts.length === 3) {
                    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
                    return payload.org_id || payload.organization_id || payload.org_uuid || payload.uuid || null
                }
            } catch { /* ignore */ }
        }

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

                if (sessionKey) { headers['Cookie'] = `sessionKey=${sessionKey}` }
                else if (accessToken) { headers['Authorization'] = `Bearer ${accessToken}` }
                else { continue }

                const data = await this.fetchWithNet(url, headers)
                if (Array.isArray(data) && data.length > 0) {
                    const first = data[0] as JsonObject
                    return (first.uuid as string) ?? (first.id as string) ?? null
                }
            } catch { /* ignore */ }
        }
        return null
    }

    private async fetchClaudeUsage(accessToken: string, orgId: string, sessionKey: string | null): Promise<{ five_hour?: { utilization: number; resets_at: string }; seven_day?: { utilization: number; resets_at: string } } | null> {
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
                if (sessionKey) { headers['Cookie'] = `sessionKey=${sessionKey}` }
                else { headers['Authorization'] = `Bearer ${accessToken}` }

                const data = await this.fetchWithNet(url, headers)
                return data as { five_hour?: { utilization: number; resets_at: string }; seven_day?: { utilization: number; resets_at: string } }
            } catch { /* ignore */ }
        }
        return null
    }

    async getCopilotQuota(): Promise<{ success: boolean; plan?: string; limit?: number; remaining?: number; used?: number; percentage?: number | null }> {
        const rawData = await this.fetchCopilotBilling()
        if (!rawData) { return { success: false } }
        const data = rawData as { copilot_plan?: string; quota_snapshots?: { premium_interactions?: { entitlement: number; remaining: number; percent_remaining: number } } }
        const premium = data.quota_snapshots?.premium_interactions
        return {
            success: true,
            plan: data.copilot_plan ?? 'unknown',
            limit: premium?.entitlement ?? 0,
            remaining: premium?.remaining ?? 0,
            used: (premium?.entitlement ?? 0) - (premium?.remaining ?? 0),
            percentage: premium?.percent_remaining ?? (premium?.entitlement ? (premium.remaining / premium.entitlement * 100) : null)
        }
    }

    private async fetchCopilotBilling(): Promise<JsonObject | null> {
        const settings = this.settingsService.getSettings()
        let token = settings.copilot?.token

        // If no token in settings, check auth files
        if (!token || token === 'connected') {
            try {
                const dbToken = await this.authService.getToken('copilot')
                if (dbToken) { token = dbToken }
            } catch {
                // ignore
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
            next_reset: primaryWindow?.reset_at ? String(primaryWindow.reset_at) : '-',
            models: [],
            usage: {
                dailyUsedPercent: this.toNumber(primaryWindow?.used_percent ?? null) ?? 0,
                weeklyUsedPercent: this.toNumber(secondaryWindow?.used_percent ?? null) ?? 0,
                dailyResetAt: primaryWindow?.reset_at ? String(primaryWindow.reset_at) : undefined,
                weeklyResetAt: secondaryWindow?.reset_at ? String(secondaryWindow.reset_at) : undefined,
                planType: String(planType || 'Free').toLowerCase().includes('plus') ? 'Plus' : (planType ? planType.charAt(0).toUpperCase() + planType.slice(1) : 'Free')
            }
        }
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
