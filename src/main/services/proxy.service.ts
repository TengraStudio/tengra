
import path from 'path'
import fs from 'fs'
import axios from 'axios'
import crypto from 'crypto'
import http from 'http'
import { spawn, ChildProcess } from 'child_process'
import { app, session, net } from 'electron'
import { SettingsService } from './settings.service'
import { appLogger } from '../logging/logger'

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

interface ProxyEmbedStatus {
  running: boolean
  pid?: number
  port?: number
  configPath?: string
  binaryPath?: string
  error?: string
}

const GITHUB_CLIENTS = {
  profile: { id: 'Ov23liBw1MLMHGdYxtUV', scope: 'read:user user:email' },
  copilot: { id: '01ab8ac9400c4e429b23', scope: 'read:user' }
}

const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

// Legacy OAuth Client (found in git history)
// Reverted per user request to use "old commit" credentials
const ANTIGRAVITY_CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com'
const ANTIGRAVITY_CLIENT_SECRET = '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'

export class ProxyService {
  private configPath: string
  private settingsService: SettingsService
  private child: ChildProcess | null = null
  private currentPort: number = 8317
  private stdoutBuffer = ''
  private stderrBuffer = ''

  constructor(settingsService: SettingsService) {
    this.settingsService = settingsService
    this.configPath = path.join(app.getPath('userData'), 'proxy-config.yaml')
    this.ensureAuthStoreKey()
    this.ensureProxyKey()
  }

  // --- Auth Flow Logic ---

  async requestGitHubDeviceCode(appId: 'profile' | 'copilot' = 'profile'): Promise<DeviceCodeResponse> {
    return new Promise((resolve, reject) => {
      const client = GITHUB_CLIENTS[appId] || GITHUB_CLIENTS.profile
      const request = net.request({ method: 'POST', url: GITHUB_DEVICE_CODE_URL });
      request.setHeader('Accept', 'application/json');
      request.setHeader('Content-Type', 'application/json');
      const body = JSON.stringify({ client_id: client.id, scope: client.scope });
      request.write(body);
      request.on('response', (response) => {
        let data = '';
        response.on('data', (chunk) => data += chunk);
        response.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
      });
      request.end();
    });
  }

  async pollForGitHubToken(deviceCode: string, interval: number, appId: 'profile' | 'copilot' = 'profile'): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = GITHUB_CLIENTS[appId] || GITHUB_CLIENTS.profile
      const checkToken = () => {
        const request = net.request({ method: 'POST', url: GITHUB_ACCESS_TOKEN_URL });
        request.setHeader('Accept', 'application/json');
        request.setHeader('Content-Type', 'application/json');
        request.write(JSON.stringify({ client_id: client.id, device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }));
        request.on('response', (response) => {
          let data = '';
          response.on('data', (chunk) => data += chunk);
          response.on('end', () => {
            try {
              const json: TokenResponse = JSON.parse(data);
              if (json.access_token) resolve(json.access_token);
              else if (json.error === 'authorization_pending') setTimeout(checkToken, (interval + 1) * 1000);
              else reject(new Error(json.error_description || json.error));
            } catch (e) { reject(e); }
          });
        });
        request.end();
      };
      setTimeout(checkToken, interval * 1000);
    });
  }

  // --- Login URLs (New) ---

  async getAntigravityAuthUrl(): Promise<{ url: string, state: string }> {
    console.log('[ProxyService] Generating Auth URL with Client ID:', ANTIGRAVITY_CLIENT_ID)
    return new Promise((resolve, _reject) => {
      const state = crypto.randomBytes(16).toString('hex')
      const server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url || '', `http://${req.headers.host}`)
          const code = url.searchParams.get('code')
          const error = url.searchParams.get('error')

          if (error) {
            console.error('[ProxyService] Auth Server received error:', error)
            res.writeHead(400, { 'Content-Type': 'text/html' })
            res.end('<h1>Login Failed</h1><p>' + error + '</p>')
            server.close()
            return
          }

          if (code) {
            console.log('[ProxyService] Received auth code, exchanging for token...')
            const port = (server.address() as any).port
            const redirectUri = `http://localhost:${port}/oauth-callback`

            try {
              const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
                code,
                client_id: ANTIGRAVITY_CLIENT_ID,
                client_secret: ANTIGRAVITY_CLIENT_SECRET,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
              })

              const tokenData = tokenResponse.data

              // Construct auth file content
              const now = Date.now()
              const authData = {
                type: 'antigravity',
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires_in: tokenData.expires_in,
                timestamp: now,
                expired: new Date(now + tokenData.expires_in * 1000).toISOString(),
                ...tokenData // include other fields like scope, token_type
              }

              // Fetch email for filename
              try {
                const userInfo = await axios.get('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
                  headers: { Authorization: `Bearer ${tokenData.access_token}` }
                })
                if (userInfo.data.email) {
                  authData.email = userInfo.data.email
                  const filename = `antigravity-${userInfo.data.email.replace(/[@.]/g, '_')}.json`
                  this.updateAuthFile(filename, authData)
                } else {
                  this.updateAuthFile('antigravity.json', authData)
                }
              } catch (e: any) {
                console.warn('[ProxyService] Failed to fetch user info, saving as generic antigravity.json', e.message)
                this.updateAuthFile('antigravity.json', authData)
              }

              res.writeHead(200, { 'Content-Type': 'text/html' })
              res.end('<h1>Login Successful</h1><p>You can close this window and return to the application.</p><script>window.close()</script>')
            } catch (exchangeError: any) {
              console.error('[ProxyService] Token exchange failed:', exchangeError?.response?.data || exchangeError.message)
              res.writeHead(500, { 'Content-Type': 'text/html' })
              res.end('<h1>Token Exchange Failed</h1><p>Check application logs for details.</p>')
            } finally {
              server.close()
            }
          }
        } catch (e) {
          console.error('[ProxyService] Auth server error:', e)
          server.close()
        }
      })

      server.listen(51121, '127.0.0.1', () => {
        const port = 51121 // Fixed port as per antigravity.go
        const redirectUri = `http://localhost:${port}/oauth-callback`
        const scope = [
          "https://www.googleapis.com/auth/cloud-platform",
          "https://www.googleapis.com/auth/userinfo.email",
          "https://www.googleapis.com/auth/userinfo.profile",
          "https://www.googleapis.com/auth/cclog",
          "https://www.googleapis.com/auth/experimentsandconfigs"
        ].join(' ')

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&client_id=${ANTIGRAVITY_CLIENT_ID}&prompt=consent&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}&debug=manual_fix_v2`

        console.log('[ProxyService] Custom Antigravity Auth Server started on port', port)
        console.log('[ProxyService] Auth URL:', authUrl)
        resolve({ url: authUrl, state })
      })
    })
  }
  async getGeminiAuthUrl() {
    return this.makeRequest('/v0/management/gemini-cli-auth-url?is_webui=true')
  }
  async getAnthropicAuthUrl() {
    return this.makeRequest('/v0/management/anthropic-auth-url?is_webui=true')
  }
  async getClaudeAuthUrl() {
    return this.makeRequest('/v0/management/anthropic-auth-url?is_webui=true')
  }
  async getCodexAuthUrl() {
    return this.makeRequest('/v0/management/codex-auth-url?is_webui=true')
  }

  async getAuthFiles() {
    const dir = this.getAuthWorkDir();
    if (!fs.existsSync(dir)) return { files: [] };
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    return { files: files.map(f => ({ name: f, provider: f.split('-')[0] })) };
  }

  async deleteAuthFile(name: string) {
    const filePath = path.join(this.getAuthWorkDir(), name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { success: true };
  }

  // --- Proxy Embed Lifecycle ---

  private getBinaryPath(): string {
    const binName = process.platform === 'win32' ? 'cliproxy-embed.exe' : 'cliproxy-embed'

    // Try multiple possible locations
    const possiblePaths = [
      path.join(process.cwd(), 'external', 'cliproxyapi', binName),
      path.join(process.cwd(), 'proxy', 'cliproxy_embed', binName),
      path.join(__dirname, '..', '..', '..', 'external', 'cliproxyapi', binName),
      path.join(app.getAppPath(), 'external', 'cliproxyapi', binName)
    ]

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) return p
    }

    // Default to first option if none exist
    return possiblePaths[0]
  }

  private pickOpenAiAccessToken(authData: any): string | null {
    const candidates = [
      authData?.access_token,
      authData?.accessToken,
      authData?.AccessToken,
      authData?.token?.access_token,
      authData?.token?.accessToken,
      authData?.session?.access_token,
      authData?.session?.accessToken,
      authData?.auth?.access_token,
      authData?.auth?.accessToken
    ]

    for (const value of candidates) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim()
      }
    }
    return null
  }

  private async fetchCodexUsageFromWham(accessToken: string): Promise<any | null> {
    const endpoints = [
      'https://chatgpt.com/backend-api/wham/usage',
      'https://chat.openai.com/backend-api/wham/usage'
    ]



    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(endpoint, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json'
          },
          timeout: 10000
        })
        if (response?.data) {
          return response.data
        }
      } catch (e: any) {
        const status = e?.response?.status
        if (status === 401 || status === 403) {
          break
        }
        console.warn('[ProxyService] Codex usage endpoint failed:', endpoint, e?.message || e)
      }
    }

    return null
  }

  private extractCodexUsageFromWham(data: any): {
    totalRequests?: number
    totalTokens?: number
    remainingRequests?: number
    remainingTokens?: number
    resetAt?: string
    dailyUsage?: number
    dailyLimit?: number
    weeklyUsage?: number
    weeklyLimit?: number
    dailyUsedPercent?: number
    weeklyUsedPercent?: number
    dailyResetAt?: string
    weeklyResetAt?: string
  } | null {
    if (!data || typeof data !== 'object') return null

    const totalRequests = this.findNumberByKeys(data, [
      'total_requests',
      'totalRequests',
      'request_count',
      'requests_used',
      'requests'
    ])
    const totalTokens = this.findNumberByKeys(data, [
      'total_tokens',
      'totalTokens',
      'token_count',
      'tokens_used',
      'tokens'
    ])
    const remainingRequests = this.findNumberByKeys(data, [
      'remaining_requests',
      'remainingRequests',
      'requests_remaining'
    ])
    const remainingTokens = this.findNumberByKeys(data, [
      'remaining_tokens',
      'remainingTokens',
      'tokens_remaining'
    ])
    const dailyUsage = this.findNumberByKeys(data, [
      'daily_usage',
      'dailyUsage',
      'daily_used',
      'usage_daily',
      'requests_daily',
      'requests_today',
      'cap_usage',
      'usage'
    ])
    const dailyLimit = this.findNumberByKeys(data, [
      'daily_limit',
      'dailyLimit',
      'limit_daily',
      'daily_quota',
      'cap_limit',
      'limit'
    ])
    const weeklyUsage = this.findNumberByKeys(data, [
      'weekly_usage',
      'weeklyUsage',
      'weekly_used',
      'usage_weekly',
      'requests_weekly'
    ])
    const weeklyLimit = this.findNumberByKeys(data, [
      'weekly_limit',
      'weeklyLimit',
      'limit_weekly',
      'weekly_quota'
    ])
    const dailyUsedPercent = data?.rate_limit?.primary_window?.used_percent ??
      this.findNumberByKeys(data, ['rate_limit.primary_window.used_percent'])

    const weeklyUsedPercent = data?.rate_limit?.secondary_window?.used_percent ??
      this.findNumberByKeys(data, ['rate_limit.secondary_window.used_percent'])

    const dailyResetAt = this.normalizeResetAt(
      data?.rate_limit?.primary_window?.reset_at ??
      this.findNumberByKeys(data, ['rate_limit.primary_window.reset_at'])
    )
    const weeklyResetAt = this.normalizeResetAt(
      data?.rate_limit?.secondary_window?.reset_at ??
      this.findNumberByKeys(data, ['rate_limit.secondary_window.reset_at'])
    )
    const resetAt = this.normalizeResetAt(
      this.findStringByKeys(data, [
        'reset_at',
        'resetAt',
        'reset_time',
        'resetTime',
        'next_reset',
        'renew_at',
        'renewAt'
      ]) ?? this.findNumberByKeys(data, [
        'reset_at',
        'resetAt',
        'reset_time',
        'resetTime',
        'next_reset',
        'renew_at',
        'renewAt'
      ])
    )

    if (
      totalRequests === null &&
      totalTokens === null &&
      remainingRequests === null &&
      remainingTokens === null &&
      dailyUsage === null &&
      dailyLimit === null &&
      weeklyUsage === null &&
      weeklyLimit === null &&
      dailyUsedPercent === null &&
      weeklyUsedPercent === null &&
      !dailyResetAt &&
      !weeklyResetAt &&
      !resetAt
    ) {
      return null
    }

    return {
      ...(totalRequests !== null ? { totalRequests } : {}),
      ...(totalTokens !== null ? { totalTokens } : {}),
      ...(remainingRequests !== null ? { remainingRequests } : {}),
      ...(remainingTokens !== null ? { remainingTokens } : {}),
      ...(dailyUsage !== null ? { dailyUsage } : {}),
      ...(dailyLimit !== null ? { dailyLimit } : {}),
      ...(weeklyUsage !== null ? { weeklyUsage } : {}),
      ...(weeklyLimit !== null ? { weeklyLimit } : {}),
      ...(dailyUsedPercent !== null ? { dailyUsedPercent } : {}),
      ...(weeklyUsedPercent !== null ? { weeklyUsedPercent } : {}),
      ...(dailyResetAt ? { dailyResetAt } : {}),
      ...(weeklyResetAt ? { weeklyResetAt } : {}),
      ...(resetAt ? { resetAt } : {})
    }
  }

  private findStringByKeys(root: any, keys: string[]): string | null {
    const queue: Array<{ value: any; depth: number }> = [{ value: root, depth: 0 }]
    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) continue
      const { value, depth } = current
      if (!value || typeof value !== 'object') continue

      if (!Array.isArray(value)) {
        for (const key of keys) {
          if (Object.prototype.hasOwnProperty.call(value, key)) {
            const candidate = value[key]
            if (typeof candidate === 'string' && candidate.trim()) {
              return candidate.trim()
            }
          }
        }
      }

      if (depth >= 4) continue
      const children = Array.isArray(value) ? value : Object.values(value)
      for (const child of children) {
        if (child && typeof child === 'object') {
          queue.push({ value: child, depth: depth + 1 })
        }
      }
    }
    return null
  }

  private normalizeResetAt(value: any): string | null {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
    const numeric = this.toNumber(value)
    if (numeric === null) return null
    const ms = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric
    return new Date(ms).toISOString()
  }

  private toNumber(value: any): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) return null
      const parsed = Number(trimmed)
      if (!Number.isNaN(parsed)) return parsed
    }
    return null
  }

  async getCodexUsage(): Promise<any> {
    const result: any = { usageSource: 'none' }

    // 1. Fetch raw data using the robust fetchCodexUsage method (checks settings, auth files, cookies)
    const whamData = await this.fetchCodexUsage()

    if (whamData) {
      console.log('[ProxyService] getCodexUsage: Got data from fetchCodexUsage')

      // Extract structured usage data
      // Pass the whole object so recursive search can find keys anywhere
      const usage = this.extractCodexUsageFromWham(whamData)

      if (usage) {
        result.usage = usage
        result.usageSource = 'chatgpt'
      }

      // Try to extract plan type from various locations and CAPITALIZE it
      const rawPlan = whamData.plan_type ||
        whamData.rate_limit?.plan_type ||
        (usage as any)?.planType ||
        'free'

      result.planType = rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1)
      // UI expects planType inside usage object too
      if (result.usage) {
        result.usage.planType = result.planType
      }

      // Try to extract account ID
      result.accountId = whamData.account_id ||
        whamData.user_id ||
        'unknown'

      if (whamData.email) result.email = whamData.email
    } else {
      console.warn('[ProxyService] getCodexUsage: No data returned from fetchCodexUsage')
    }

    // fallback to management usage if needed (legacy proxy)
    try {
      const usageResponse = await this.makeRequest('/v0/management/usage')
      if (usageResponse?.usage) {
        const usage = this.extractCodexUsage(usageResponse.usage)
        if (usage) {
          // Merge if we already have some data, or set if we don't
          result.usage = result.usage ? { ...result.usage, ...usage } : usage
          if (result.usageSource === 'none') result.usageSource = 'proxy'
        }
      }
    } catch (e) {
      // ignore
    }

    return result
  }

  async startEmbeddedProxy(options?: { port?: number }): Promise<ProxyEmbedStatus> {
    if (this.child) {
      console.log('[ProxyService] Proxy already running')
      return this.getEmbeddedProxyStatus()
    }

    const binaryPath = this.getBinaryPath()
    console.log('[ProxyService] Binary path:', binaryPath)

    if (!fs.existsSync(binaryPath)) {
      console.error('[ProxyService] Binary not found at:', binaryPath)
      return { running: false, error: `Binary not found at ${binaryPath} ` }
    }

    this.currentPort = options?.port || 8317
    await this.generateConfig(this.currentPort)
    console.log('[ProxyService] Config generated, starting proxy on port', this.currentPort)

    this.child = spawn(binaryPath, ['-config', this.configPath], {
      cwd: path.dirname(binaryPath),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    })

    this.child.stdout?.on('data', d => this.stdoutBuffer = this.logProxyChunk(this.stdoutBuffer, d.toString(), 'info'))
    this.child.stderr?.on('data', d => this.stderrBuffer = this.logProxyChunk(this.stderrBuffer, d.toString(), 'error'))
    this.child.on('close', code => {
      this.child = null;
      appLogger.warn(`Proxy exited: ${code} `)
      console.log('[ProxyService] Proxy process exited with code:', code)
    })

    console.log('[ProxyService] Proxy started with PID:', this.child.pid)
    return this.getEmbeddedProxyStatus()
  }

  async stopEmbeddedProxy() { if (this.child) { this.child.kill(); this.child = null; } return this.getEmbeddedProxyStatus(); }

  getEmbeddedProxyStatus(): ProxyEmbedStatus { return { running: !!this.child, pid: this.child?.pid, port: this.currentPort } }

  private logProxyChunk(buffer: string, chunk: string, level: 'info' | 'error'): string {
    const lines = (buffer + chunk).split(/\r?\n/);
    const remainder = lines.pop() || '';
    for (const line of lines) if (line.trim()) appLogger[level](line.trim(), { source: 'proxy' });
    return remainder;
  }

  // --- Quota & Models ---

  async getQuota(): Promise<any> {
    console.log('[ProxyService] getQuota: starting sequence...')
    const settings = this.settingsService.getSettings()
    if (settings.proxy?.enabled === false) return null

    // 1. Try Antigravity (Direct Upstream)
    const antigravity = await this.fetchAntigravityQuota()
    if (antigravity && !antigravity.authExpired) return antigravity
    if (antigravity?.authExpired) return antigravity

    // 2. Try Legacy Fallback
    const legacy = await this.fetchLegacyQuota()
    if (legacy && legacy.success) return legacy

    // 3. Try Proxy /v1/quota
    const proxy = await this.fetchProxyQuota()
    if (proxy) return proxy

    // 4. Try Codex
    const codex = await this.fetchCodexQuota()
    if (codex && codex.success) return codex

    return null
  }

  // --- Split Quota Functions ---

  private async fetchAntigravityUpstream(): Promise<any | null> {
    try {
      const authData = await this.getAntigravityAuthData()
      if (!authData) return null

      // Check expiry
      if (this.isTokenExpired(authData)) {
        console.log('[ProxyService] AG Token expired, refreshing...')
        const newToken = await this.refreshAntigravityToken(authData.refresh_token)
        if (newToken) {
          authData.access_token = newToken.access_token
          authData.expires_in = newToken.expires_in || 3599
          authData.timestamp = Date.now()
          this.updateAuthFile('antigravity-' + (authData.email ? authData.email.replace(/[@.]/g, '_') + '.json' : 'json'), authData)
        } else {
          throw new Error('AUTH_EXPIRED')
        }
      }

      const upstreamUrl = 'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels'
      try {
        // Use empty body by default (proven to be more reliable/expected by current API)
        const response = await axios.post(upstreamUrl, {}, {
          headers: {
            'Authorization': `Bearer ${authData.access_token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'antigravity/1.104.0 darwin/arm64'
          },
          timeout: 8000
        })
        if (response.status === 200 && response.data) return response.data
      } catch (e: any) {
        console.warn('[ProxyService] Upstream fetch failed:', e.message)
        throw e
      }
    } catch (e) {
      console.warn('[ProxyService] Upstream fetch failed:', e)
      throw e // Propagate for specific handling if needed
    }
    return null
  }

  private async fetchAntigravityQuota(): Promise<any | null> {
    try {
      const data = await this.fetchAntigravityUpstream()
      if (data) {
        console.log('[ProxyService] AG Quota fetched successfully')
        return this.parseQuotaResponse(data)
      }
    } catch (e: any) {
      if (e.message === 'AUTH_EXPIRED') return { success: false, authExpired: true }
    }
    return null
  }

  private async getAntigravityAvailableModels(): Promise<any[]> {
    try {
      const data = await this.fetchAntigravityUpstream()
      if (data && data.models) {
        const models: any[] = []
        const nameMap: Record<string, string> = {
          "gemini-2.5-pro": "Gemini 2.5 Pro",
          "gemini-2.5-flash": "Gemini 2.5 Flash",
          "gemini-2.0-flash": "Gemini 2.0 Flash",
          "gemini-exp-1206": "Gemini Exp",
          "claude-sonnet-4-5": "Claude Sonnet 4.5",
          "claude-opus-4-5": "Claude Opus 4.5"
        }

        for (const [key, val] of Object.entries(data.models) as any) {
          try {
            // Filter noise
            if (key.startsWith('chat_') || key.startsWith('rev')) continue

            let percentage = 100
            let reset = '-'

            if (val.quotaInfo) {
              if (typeof val.quotaInfo.remainingFraction === 'number') {
                percentage = Math.round(val.quotaInfo.remainingFraction * 100)
              } else if (typeof val.quotaInfo.remainingQuota === 'number' && typeof val.quotaInfo.totalQuota === 'number' && val.quotaInfo.totalQuota > 0) {
                percentage = Math.round((val.quotaInfo.remainingQuota / val.quotaInfo.totalQuota) * 100)
              } else if (val.quotaInfo.resetTime) {
                // If we have a reset time but no fraction info, it typically means 0% (exhausted)
                // Observed in Gemini 3 Pro (High) etc.
                percentage = 0
              }

              if (val.quotaInfo.resetTime) {
                try {
                  reset = new Date(val.quotaInfo.resetTime).toLocaleString('tr-TR', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                } catch (dateError) {
                  console.warn(`[ProxyService] Invalid resetTime for model ${key}:`, val.quotaInfo.resetTime)
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
          } catch (itemError) {
            console.warn(`[ProxyService] Error parsing model ${key}:`, itemError)
          }
        }
        return models
      }
    } catch (e) {
      console.error('[ProxyService] getAntigravityAvailableModels failed:', e)
    }
    return []
  }

  private async fetchLegacyQuota(): Promise<any | null> {
    try {
      const legacy = await this.getLegacyQuota()
      if (legacy && legacy.success) return legacy
    } catch (e) { }
    return null
  }

  private async fetchProxyQuota(): Promise<any | null> {
    try {
      const apiKey = this.getProxyKey()
      return await this.makeRequest('/v1/quota', apiKey)
    } catch (e) { }
    return null
  }

  private async fetchCodexQuota(): Promise<any | null> {
    try {
      const codexData = await this.fetchCodexUsage()
      if (codexData) {
        return this.parseCodexUsageToQuota(codexData)
      }
    } catch (e) { }
    return null
  }

  private parseQuotaResponse(data: any): any {
    // Map Google API response (fetchAvailableModels) to our UI format
    if (!data.models) return null

    const models = []
    const nameMap: Record<string, string> = {
      "gemini-2.5-pro": "Gemini 2.5 Pro",
      "gemini-2.5-flash": "Gemini 2.5 Flash",
      "gemini-2.0-flash": "Gemini 2.0 Flash",
      "gemini-exp-1206": "Gemini Exp",
      "claude-sonnet-4-5": "Claude Sonnet 4.5",
      "claude-opus-4-5": "Claude Opus 4.5"
    }

    for (const [key, val] of Object.entries(data.models) as any) {
      try {
        if (key.startsWith('chat_') || key.startsWith('rev')) continue

        let percentage = 100
        let reset = '-'

        if (val.quotaInfo) {
          if (typeof val.quotaInfo.remainingFraction === 'number') {
            percentage = Math.round(val.quotaInfo.remainingFraction * 100)
          } else if (typeof val.quotaInfo.remainingQuota === 'number' && typeof val.quotaInfo.totalQuota === 'number' && val.quotaInfo.totalQuota > 0) {
            percentage = Math.round((val.quotaInfo.remainingQuota / val.quotaInfo.totalQuota) * 100)
          } else if (val.quotaInfo.resetTime) {
            percentage = 0
          }

          if (val.quotaInfo.resetTime) {
            try {
              reset = new Date(val.quotaInfo.resetTime).toLocaleString('tr-TR', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            } catch { }
          }
        }

        models.push({
          name: val.displayName || nameMap[key] || key,
          percentage,
          reset
        })
      } catch { }
    }

    return {
      status: models.length > 0 ? `${Math.round(models.reduce((sum: number, m: any) => sum + m.percentage, 0) / models.length)}%` : 'Available',
      next_reset: models.length > 0 ? models[0].reset : '-',
      models: models.sort((a: any, b: any) => a.name.localeCompare(b.name))
    }
  }

  private parseCodexUsageToQuota(data: any): any {
    return {
      success: true,
      usage: {
        dailyUsedPercent: data.rate_limit?.primary_window?.used_percent || 0,
        weeklyUsedPercent: data.rate_limit?.secondary_window?.used_percent || 0,
        dailyResetAt: data.rate_limit?.primary_window?.reset_at,
        weeklyResetAt: data.rate_limit?.secondary_window?.reset_at,
        planType: String(data.plan_type || 'Free').toLowerCase().includes('plus') ? 'Plus' : (data.plan_type ? data.plan_type.charAt(0).toUpperCase() + data.plan_type.slice(1) : 'Free')
      }
    }
  }

  async getCopilotQuota() {
    // GitHub Billing (Copilot) - via Premium Usage API
    const data = await this.fetchCopilotBilling()
    if (!data) return { success: false }

    // Parse data.usageItems array
    /*
     {
       "usageItems": [
         {
           "product": "Copilot",
           "netQuantity": 100, // Total requests?
           "netAmount": 4
         }
       ]
     }
    */
    // Parse copilot_internal structure for usage data
    const premium = data.quota_snapshots?.premium_interactions

    // If no premium data (e.g. Free user?), use defaults
    return {
      success: true,
      plan: data.copilot_plan || 'unknown',
      limit: premium?.entitlement || 0,
      remaining: premium?.remaining || 0,
      used: (premium?.entitlement || 0) - (premium?.remaining || 0),
      percentage: premium?.percent_remaining || (premium?.entitlement ? (premium.remaining / premium.entitlement * 100) : null)
    }
  }

  async getModels(): Promise<any> {
    const apiKey = this.getProxyKey()
    let baseRes: any = { data: [] }
    try {
      baseRes = await this.makeRequest('/v1/models', apiKey)
    } catch (err) {
      console.warn('[ProxyService] getModels: Primary proxy fetch failed, proceeding with extra sources.', err)
    }

    let extra: any[] = []
    let antigravityError: string | undefined

    try {
      extra = await this.getAntigravityAvailableModels()
    } catch (e: any) {
      if (e.message === 'AUTH_EXPIRED') {
        antigravityError = 'Oturum süresi doldu. Lütfen tekrar giriş yapın (Token Refresh Başarısız).'
      }
    }

    const base = Array.isArray(baseRes?.data) ? baseRes.data : []
    const merged = [...base]
    const ids = new Set(base.map((m: any) => m.id))
    for (const m of extra) { if (!ids.has(m.id)) merged.push(m) }

    return { ...baseRes, data: merged, antigravityError }
  }

  // Removed fetchGoogleInternalData - was calling internal API that requires project_id
  // Models are fetched via /v1/models endpoint instead



  async fetchCodexUsage(): Promise<any | null> {
    const settings = this.settingsService.getSettings()
    let token = (settings as any).openai?.accessToken || settings.openai?.apiKey

    // 2. Try to find token in cliproxy-auth-work (App Auth Files)
    if (!token || token === 'connected') {
      try {
        const authDir = this.getAuthWorkDir()
        if (fs.existsSync(authDir)) {
          const files = fs.readdirSync(authDir).filter(f => f.startsWith('codex-') && f.endsWith('.json'))
          if (files.length > 0) {
            // Use the most recent file or just the first one
            const authFile = path.join(authDir, files[0])
            const content = JSON.parse(fs.readFileSync(authFile, 'utf8'))
            // Use helper to robustly find token
            const fileToken = this.pickOpenAiAccessToken(content)
            if (fileToken) {
              token = fileToken
            }
          }
        }
      } catch (e: any) {
        console.warn('[ProxyService] Failed to read auth file:', e.message)
      }
    }

    // 3. Try to get token from Electron session (Cookies)
    if (!token || token === 'connected') {
      try {
        const cookies = await session.defaultSession.cookies.get({ url: 'https://chatgpt.com' })
        if (cookies.length > 0) {
          const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')
          const sessionRes = await axios.get('https://chatgpt.com/api/auth/session', {
            headers: {
              'Cookie': cookieHeader,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
            }
          })
          if (sessionRes.data?.accessToken) {
            token = sessionRes.data.accessToken
          } else {
            console.warn('[ProxyService] Could not retrieve access token from session endpoint.')
          }
        } else {
          console.warn('[ProxyService] No cookies found for chatgpt.com')
        }
      } catch (e: any) {
        console.warn('[ProxyService] Failed to get session token:', e.message)
      }
    }

    if (!token || token === 'connected') {
      return null
    }

    // Use robust multi-endpoint helper
    const data = await this.fetchCodexUsageFromWham(token)
    try {
      const debugPath = path.join(process.cwd(), 'debug-codex.json')
      fs.writeFileSync(debugPath, JSON.stringify(data, null, 2))
    } catch (e) {
      console.warn('[ProxyService] Failed to write debug log:', e)
    }
    return data
  }

  private async fetchCopilotBilling(): Promise<any | null> {
    const settings = this.settingsService.getSettings()
    // Switch to Copilot Token as verified via CLI (GitHub token failed with 404/Scopes)
    const token = (settings as any).copilot?.token
    if (!token) return null

    try {
      const response = await axios.get('https://api.github.com/copilot_internal/user', {
        headers: {
          'Authorization': `token ${token} `,
          'User-Agent': 'GithubCopilot/1.250.0'
        }
      })
      return response.data
    } catch (e: any) {
      // Silent warning
      return null
    }
  }

  // --- Antigravity Helpers ---

  private isTokenExpired(authData: any): boolean {
    if (!authData.timestamp || !authData.expires_in) return true
    const expiry = authData.timestamp + (authData.expires_in * 1000)
    // Buffer of 60 seconds
    return Date.now() > (expiry - 60000)
  }

  private async refreshAntigravityToken(refreshToken: string): Promise<any> {
    if (!refreshToken) return null
    try {
      const params = new URLSearchParams()
      params.append('client_id', ANTIGRAVITY_CLIENT_ID)
      params.append('client_secret', ANTIGRAVITY_CLIENT_SECRET)
      params.append('refresh_token', refreshToken)
      params.append('grant_type', 'refresh_token')

      const res = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })
      return res.data
    } catch (e: any) {
      console.error('[ProxyService] refreshAntigravityToken failed:', e.message)
      return null
    }
  }

  private updateAuthFile(nameOrPrefix: string, data: any) {
    try {
      const dir = this.getAuthWorkDir()
      let filePath: string

      if (nameOrPrefix.endsWith('.json')) {
        // It's a direct filename
        filePath = path.join(dir, nameOrPrefix)
      } else {
        // Legacy: It's a prefix, try to find existing file
        const files = fs.readdirSync(dir).filter(f => f.startsWith(nameOrPrefix + '-') && f.endsWith('.json'))
        if (files.length > 0) {
          filePath = path.join(dir, files[0])
        } else {
          // Fallback: create new generic file if treating as prefix
          filePath = path.join(dir, `${nameOrPrefix}.json`)
        }
      }

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
      console.log('[ProxyService] Auth file saved:', path.basename(filePath))
    } catch (e: any) {
      console.error('[ProxyService] Failed to update auth file:', e.message)
    }
  }

  // --- Quota Helpers ---

  async getLegacyQuota(): Promise<{ success: boolean; authExpired?: boolean; data?: any }> {
    console.log('[ProxyService] getLegacyQuota: checking auth status...')
    // Check if Antigravity auth exists
    const authData = await this.getAntigravityAuthData()
    if (!authData) {
      return { success: false } // Not logged in
    }
    // Auth exists but we don't have quota info from internal API anymore
    // Return minimal success response
    return { success: true, data: { authenticated: true } }
  }

  async getLegacyCodexUsage() {
    // Codex usage is fetched separately via fetchCodexUsage method
    return { success: false }
  }

  private extractCodexUsage(snapshot: any): any {
    if (!snapshot || typeof snapshot !== 'object') return null
    const apis = snapshot.apis || snapshot.APIs
    if (!apis || typeof apis !== 'object') return null

    let totalRequests = 0
    let totalTokens = 0

    // Simplified extraction logic
    for (const [apiKey, apiStats] of Object.entries(apis as Record<string, any>)) {
      const keyLower = apiKey.toLowerCase()
      const statsStr = JSON.stringify(apiStats).toLowerCase()
      if (keyLower.includes('codex') || statsStr.includes('codex')) {
        totalRequests += Number(apiStats?.total_requests || 0)
        totalTokens += Number(apiStats?.total_tokens || 0)
      }
    }

    return { totalRequests, totalTokens, success: true }
  }


  private findNumberByKeys(root: any, keys: string[]): number | null {
    // Recursive search
    const queue: Array<{ value: any; depth: number }> = [{ value: root, depth: 0 }]
    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) continue
      const { value, depth } = current
      if (!value || typeof value !== 'object') continue
      if (depth >= 4) continue

      for (const key of keys) {
        if (value[key] !== undefined && value[key] !== null) {
          const num = Number(value[key])
          if (!Number.isNaN(num)) return num
        }
      }

      const children = Array.isArray(value) ? value : Object.values(value)
      for (const child of children) {
        if (child && typeof child === 'object') {
          queue.push({ value: child, depth: depth + 1 })
        }
      }
    }
    return null
  }

  private async getAntigravityAuthData(): Promise<any | null> {
    const dir = this.getAuthWorkDir()
    try {
      if (!fs.existsSync(dir)) return null
      const files = fs.readdirSync(dir)

      // 1. Look for email-specific file first (antigravity-*.json)
      const specific = files.find(f => f.startsWith('antigravity-') && f.endsWith('.json'))
      if (specific) return JSON.parse(fs.readFileSync(path.join(dir, specific), 'utf8'))

      // 2. Fallback to generic antigravity.json
      const generic = files.find(f => f === 'antigravity.json')
      if (generic) return JSON.parse(fs.readFileSync(path.join(dir, generic), 'utf8'))

      console.warn('[ProxyService] getAntigravityAuthData: No Antigravity auth file found.')
      return null
    } catch { return null }
  }

  private makeRequest(path: string, apiKey?: string): Promise<any> {
    const key = apiKey || this.getProxyKey()
    return new Promise((resolve, reject) => {
      const options = {
        method: 'GET',
        protocol: 'http:' as 'http:',
        hostname: '127.0.0.1',
        port: this.currentPort,
        path
      }

      console.log(`[ProxyService] Making request to: http://127.0.0.1:${this.currentPort}${path}`)

      const request = net.request(options)
      request.setHeader('Authorization', `Bearer ${key}`)

      request.on('response', (res) => {
        let d = '';
        res.on('data', chunk => d += chunk);
        res.on('end', () => {
          console.log(`[ProxyService] Response from ${path}: Status ${res.statusCode}, Data length: ${d.length}`)

          if (res.statusCode && res.statusCode >= 400) {
            console.warn(`[ProxyService] HTTP Error ${res.statusCode} for ${path}: ${d.substring(0, 200)}`)
            resolve({ success: false, error: `HTTP ${res.statusCode}`, raw: d })
            return
          }

          try {
            const json = JSON.parse(d);
            resolve(json);
          } catch (e) {
            console.error(`[ProxyService] JSON Parse Error for ${path}:`, e, "Raw data:", d.substring(0, 100))
            resolve({ success: false, error: 'Invalid JSON', raw: d });
          }
        })
      })

      request.on('error', e => {
        console.error(`[ProxyService] Request Error to ${path}:`, e)
        reject(e)
      })

      request.end()
    })
  }

  // --- Helpers ---

  getAuthWorkDir(): string { return path.join(app.getPath('userData'), 'cliproxy-auth-work') }
  getConfigPath(): string { return this.configPath }

  prepareAuthWorkDir() {
    const dir = this.getAuthWorkDir()
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }

  async downloadAuthFile(name: string): Promise<any> {
    const filePath = path.join(this.getAuthWorkDir(), name)
    if (!fs.existsSync(filePath)) throw new Error('Auth file not found')
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  }

  private ensureProxyKey(): string {
    const settings = this.settingsService.getSettings()
    let key = settings.proxy?.key?.trim()
    if (!key) {
      key = crypto.randomBytes(32).toString('base64')
      this.settingsService.saveSettings({ proxy: { ...((settings.proxy as any) || {}), key } })
    }
    return key as string
  }

  getProxyKey(): string { return this.ensureProxyKey() }

  private ensureAuthStoreKey(): string {
    const settings = this.settingsService.getSettings()
    let key = settings.proxy?.authStoreKey?.trim()
    if (!key) {
      key = crypto.randomBytes(32).toString('base64')
      this.settingsService.saveSettings({ proxy: { ...((settings.proxy as any) || {}), authStoreKey: key } })
    }
    return key as string
  }

  async generateConfig(port: number = 8317) {
    const settings = this.settingsService.getSettings()
    const authDir = this.getAuthWorkDir().replace(/\\/g, '/')
    const proxyKey = this.getProxyKey()
    let config = `host: "127.0.0.1"\nport: ${port}\nauth-dir: "${authDir}"\napi-keys:\n  - "${proxyKey}"\nremote-management:\n  secret-key: "${proxyKey}"\ndebug: true\nlogging-to-file: false\n`
    if (settings.github?.token) config += `codex-api-key:\n  - api-key: "${settings.github.token}"\n    base-url: "https://api.githubcopilot.com"\n`
    if (settings.anthropic?.apiKey) config += `claude-api-key:\n  - api-key: "${settings.anthropic.apiKey}"\n`
    if (settings.gemini?.apiKey) config += `gemini-api-key:\n  - api-key: "${settings.gemini.apiKey}"\n`
    fs.writeFileSync(this.configPath, config)
  }
}
