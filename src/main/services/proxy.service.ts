
import path from 'path'
import fs from 'fs'
import axios from 'axios'
import crypto from 'crypto'
import http from 'http'
import { net } from 'electron'
import { app } from 'electron'
import { SettingsService } from './settings.service'
import { DataService } from './data.service'
import { SecurityService } from './security.service'
import { ProxyProcessManager, ProxyEmbedStatus } from './proxy-process.manager'
import { QuotaService } from './quota.service'

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

const GITHUB_CLIENTS = {
  profile: { id: 'Ov23liBw1MLMHGdYxtUV', scope: 'read:user user:email' },
  copilot: { id: '01ab8ac9400c4e429b23', scope: 'read:user' }
}

const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

// Legacy OAuth Client (found in git history)
const ANTIGRAVITY_CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com'
const ANTIGRAVITY_CLIENT_SECRET = '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'

export class ProxyService {
  private currentPort: number = 8317

  constructor(
    public settingsService: SettingsService,
    private dataService: DataService,
    private securityService: SecurityService,
    private processManager: ProxyProcessManager,
    private quotaService: QuotaService
  ) {
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
        const port = 51121
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

  async startEmbeddedProxy(options?: { port?: number }): Promise<ProxyEmbedStatus> {
    this.currentPort = options?.port || 8317
    return this.processManager.start(options)
  }

  async stopEmbeddedProxy() {
    return this.processManager.stop()
  }

  getEmbeddedProxyStatus(): ProxyEmbedStatus {
    const status = this.processManager.getStatus()
    if (status.running && status.port) this.currentPort = status.port
    return status
  }

  // --- Quota & Models ---

  async getQuota(): Promise<any> {
    return this.quotaService.getQuota(this.currentPort, this.getProxyKey())
  }

  async getCodexUsage(): Promise<any> {
    return this.quotaService.getCodexUsage()
  }

  async getLegacyQuota(): Promise<{ success: boolean; authExpired?: boolean; data?: any }> {
    return this.quotaService.getLegacyQuota()
  }

  async getCopilotQuota() {
    return this.quotaService.getCopilotQuota()
  }

  async getModels(): Promise<any> {
    const apiKey = this.getProxyKey()
    let baseRes: any = { data: [] }
    try {
      baseRes = await this.makeRequest('/v1/models', apiKey)
    } catch (err) {
      console.warn('[ProxyService] getModels: Primary proxy fetch failed, proceeding with extra sources.', err)
    }

    // Fetch separate quotas
    const [codexData, copilotData] = await Promise.all([
      this.quotaService.fetchCodexUsage(),
      this.quotaService.getCopilotQuota()
    ]);

    // Process Codex Quota
    let codexQuotaFn: any = undefined;
    if (codexData) {
      const usage = this.quotaService.extractCodexUsageFromWham(codexData);
      if (usage) {
        // Robust calculation: Use the most restrictive of daily/weekly percentages if available
        let fraction = 1.0;
        if (usage.dailyUsedPercent !== undefined || usage.weeklyUsedPercent !== undefined) {
          const dRemaining = usage.dailyUsedPercent !== undefined ? (100 - usage.dailyUsedPercent) / 100 : 1.0;
          const wRemaining = usage.weeklyUsedPercent !== undefined ? (100 - usage.weeklyUsedPercent) / 100 : 1.0;
          fraction = Math.max(0, Math.min(dRemaining, wRemaining));
        } else {
          const remaining = usage.remainingRequests ?? usage.remainingTokens ?? 0;
          const limit = usage.dailyLimit ?? usage.weeklyLimit ?? usage.totalRequests ?? 0;
          fraction = limit > 0 ? remaining / limit : 0;
        }

        codexQuotaFn = {
          remainingQuota: usage.remainingRequests ?? 0,
          totalQuota: usage.dailyLimit ?? usage.weeklyLimit ?? 0,
          remainingFraction: fraction,
          resetTime: usage.dailyResetAt || usage.weeklyResetAt || usage.resetAt
        };
      }
    }

    // Process Copilot Quota
    let copilotQuotaFn: any = undefined;
    if (copilotData && copilotData.success) {
      copilotQuotaFn = {
        remainingQuota: copilotData.remaining,
        totalQuota: copilotData.limit,
        remainingFraction: copilotData.percentage ? copilotData.percentage / 100 : 0,
        resetTime: undefined // Copilot usually resets monthly but exact date isn't always in this endpoint
      };
    }

    let extra: any[] = []
    let antigravityError: string | undefined

    try {
      [extra] = await Promise.all([
        this.quotaService.getAntigravityAvailableModels(),
      ]);
      console.log('[ProxyService] getModels: Fetched', extra.length, 'Antigravity models')
    } catch (e: any) {
      if (e.message === 'AUTH_EXPIRED') {
        antigravityError = 'Oturum süresi doldu. Lütfen tekrar giriş yapın (Token Refresh Başarısız).'
      }
    }

    const base = Array.isArray(baseRes?.data) ? baseRes.data.map((m: any) => ({
      ...m,
      provider: m.provider || (m.id.toLowerCase().includes('gemini-3') ? 'copilot' : 'antigravity')
    })) : []

    const merged = [...base]
    const ids = new Set(base.map((m: any) => m.id))

    // Add Antigravity Models
    for (const m of extra) {
      if (ids.has(m.id)) {
        merged.push({
          ...m,
          id: m.id + '-antigravity',
          name: (m.name || m.id) + ' (Antigravity)',
          provider: 'antigravity'
        })
      } else {
        merged.push(m)
      }
    }

    // Inject Quota Info & Normalize Structure
    const finalData = merged.map((m: any) => {
      const provider = (m.provider || 'custom').toLowerCase();
      let model = { ...m };

      // Inject Codex Quota
      if ((provider === 'codex' || provider === 'openai' || m.id.startsWith('gpt-')) && codexQuotaFn) {
        model.quotaInfo = codexQuotaFn;
      }

      // Inject Copilot Quota
      if (provider === 'copilot' && copilotQuotaFn) {
        model.quotaInfo = copilotQuotaFn;
      }

      if (!model.quota && model.quotaInfo) {
        const fraction = model.quotaInfo.remainingFraction ?? (model.quotaInfo.totalQuota > 0 ? model.quotaInfo.remainingQuota / model.quotaInfo.totalQuota : 0);
        const resetTime = model.quotaInfo.resetTime;

        let resetStr = '-';
        if (resetTime) {
          try {
            resetStr = new Date(resetTime).toLocaleString('tr-TR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          } catch { }
        }

        model.quota = {
          percentage: Math.round(fraction * 100),
          reset: resetStr
        };
      }
      if (!model.quota && typeof model.percentage === 'number') {
        model.quota = {
          percentage: model.percentage,
          reset: model.reset || '-'
        }
      }

      return model;
    });

    return {
      ...baseRes,
      data: finalData,
      antigravityError
    }
  }

  // --- Auth Utils ---

  private updateAuthFile(nameOrPrefix: string, data: any) {
    try {
      const dir = this.getAuthWorkDir()
      let fileName: string

      if (nameOrPrefix.endsWith('.json')) {
        fileName = nameOrPrefix
      } else {
        // Resolve prefix
        const files = fs.readdirSync(dir).filter(f => f.startsWith(nameOrPrefix + '-') && f.endsWith('.json'))
        if (files.length > 0) {
          fileName = files[0]
        } else {
          fileName = `${nameOrPrefix}.json`
        }
      }

      const filePath = path.join(dir, fileName)

      // 1. Encrypt and save to persistent store
      const contentString = JSON.stringify(data, null, 2)
      let persistedData = contentString
      if (this.securityService) {
        const encrypted = this.securityService.encryptSync(contentString)
        persistedData = JSON.stringify({ encryptedPayload: encrypted, version: 1 })
      }
      fs.writeFileSync(filePath, persistedData)

    } catch (e: any) {
      console.error('[ProxyService] Failed to update auth file:', nameOrPrefix, e)
    }
  }

  // --- Helpers ---

  getAuthWorkDir(): string {
    if (this.dataService) {
      return this.dataService.getPath('auth')
    }
    return path.join(app.getPath('userData'), 'auth')
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

      const request = net.request(options)
      request.setHeader('Authorization', `Bearer ${key}`)

      request.on('response', (res) => {
        let d = '';
        res.on('data', chunk => d += chunk);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            resolve({ success: false, error: `HTTP ${res.statusCode}`, raw: d })
            return
          }

          try {
            const json = JSON.parse(d);
            resolve(json);
          } catch (e) {
            resolve({ success: false, error: 'Invalid JSON', raw: d });
          }
        })
      })

      request.on('error', e => {
        reject(e)
      })

      request.end()
    })
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

  async customGeminiLogin(): Promise<{ url: string, state: string }> {
    return this._customGeminiLogin()
  }


  private async _customGeminiLogin(): Promise<{ url: string, state: string }> {
    const CLIENT_ID = '225646015720-1fl1ojosillaqi2vb76gdf9ct0nma6n5.apps.googleusercontent.com'
    const REDIRECT_URI = 'http://localhost:8085/oauth2callback'
    const SCOPES = [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/generative-language',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ].join(' ')

    const state = 'gem-custom-' + Date.now()
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&client_id=${CLIENT_ID}&prompt=consent&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(SCOPES)}&state=${state}`

    const server = http.createServer(async (req, res) => {
      try {
        const u = new URL(req.url || '', `http://localhost:8085`)
        if (u.pathname === '/oauth2callback') {
          const code = u.searchParams.get('code')
          const error = u.searchParams.get('error')

          if (error) {
            res.end('Authentication failed. You can close this window.')
            server.close()
            return
          }

          if (code) {
            res.end('Authentication successful! You can close this window now.')
            try {
              await this.exchangeGeminiCode(code, CLIENT_ID, REDIRECT_URI)
            } catch (err) {
              console.error('[ProxyService] Gemini token exchange failed:', err)
            } finally {
              server.close()
            }
          }
        }
      } catch (e) {
        console.error('[ProxyService] Error handling callback request:', e);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    })

    server.listen(8085, () => {
      console.log('[ProxyService] Custom Gemini Auth Server listening on 8085')
    })
    setTimeout(() => server.close(), 5 * 60 * 1000)
    return { url: authUrl, state }
  }

  private async exchangeGeminiCode(code: string, clientId: string, redirectUri: string) {
    const CLIENT_SECRET = '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'

    try {
      const tokenRes = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })

      const tokens = tokenRes.data
      const userRes = await axios.get('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      })

      const email = userRes.data.email
      const projectId = 'gen-lang-client-0669911453'

      const record = {
        token: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_type: tokens.token_type,
          expiry_date: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        },
        project_id: projectId,
        email: email,
        auto: true,
        checked: true
      }

      const fileName = `gemini-${email}-${projectId}.json`
      this.updateAuthFile(fileName, record)
      console.log('[ProxyService] Saved custom Gemini auth file:', fileName)

    } catch (err) {
      console.error('[ProxyService] Failed to exchange or save Gemini token', err)
      throw err
    }
  }

  async fetchGeminiModels(): Promise<any[]> {
    const settings = this.settingsService.getSettings()
    const apiKey = settings.gemini?.apiKey

    if (apiKey) {
      try {
        const res = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        return res.data.models.map((m: any) => ({
          id: m.name.split('/').pop(),
          name: m.displayName,
          provider: 'gemini',
          description: m.description,
          contextWindow: m.inputTokenLimit,
          outputLimit: m.outputTokenLimit
        }));
      } catch (error) {
        console.warn('[ProxyService] Failed to fetch Gemini models via API Key:', error);
      }
    }

    try {
      const dir = this.getAuthWorkDir();
      if (!fs.existsSync(dir)) return [];
      const files = fs.readdirSync(dir).filter(f => f.startsWith('gemini-') && f.endsWith('.json'));
      if (files.length === 0) return [];

      const latestFile = files.map(f => ({ name: f, time: fs.statSync(path.join(dir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time)[0].name;

      const authData = this.readAuthFile(path.join(dir, latestFile))
      if (!authData) return []

      let accessToken = authData.token?.access_token;
      const refreshToken = authData.token?.refresh_token;

      try {
        const res = await axios.get('https://generativelanguage.googleapis.com/v1beta/models', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        return res.data.models.map((m: any) => ({
          id: m.name.split('/').pop(),
          name: m.displayName,
          provider: 'gemini',
          description: m.description,
          contextWindow: m.inputTokenLimit,
          outputLimit: m.outputTokenLimit
        }));
      } catch (err: any) {
        if ((err.response?.status === 401 || err.response?.status === 403) && refreshToken) {
          console.log('[ProxyService] Access token expired/invalid, refreshing Gemini token...');
          const refreshed = await this.refreshGeminiToken(refreshToken);
          if (refreshed) {
            accessToken = refreshed;
            authData.token.access_token = refreshed;
            this.updateAuthFile(latestFile, authData);

            const resRetry = await axios.get('https://generativelanguage.googleapis.com/v1beta/models', {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            return resRetry.data.models.map((m: any) => ({
              id: m.name.split('/').pop(),
              name: m.displayName,
              provider: 'gemini',
              description: m.description,
              contextWindow: m.inputTokenLimit,
              outputLimit: m.outputTokenLimit
            }));
          }
        }
        throw err;
      }

    } catch (error) {
      return [];
    }
  }

  private async refreshGeminiToken(refreshToken: string): Promise<string | null> {
    try {
      const CLIENT_ID = '225646015720-1fl1ojosillaqi2vb76gdf9ct0nma6n5.apps.googleusercontent.com'
      const CLIENT_SECRET = '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'

      const res = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

      return res.data.access_token;
    } catch (e) {
      console.error('[ProxyService] Failed to refresh Gemini token', e);
      return null;
    }
  }

  private readAuthFile(filePath: string): any | null {
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      let json = JSON.parse(content)

      if (json.encryptedPayload && this.securityService) {
        const decrypted = this.securityService.decryptSync(json.encryptedPayload)
        json = JSON.parse(decrypted)
      }

      return json
    } catch (e) {
      console.warn('[ProxyService] Failed to read/decrypt auth file:', filePath, e)
      return null
    }
  }

}
