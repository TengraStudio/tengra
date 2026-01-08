
import path from 'path'
import fs from 'fs'
import axios from 'axios'
import crypto from 'crypto'
import { net } from 'electron'
import { app } from 'electron'
import { SettingsService } from '../settings.service'
import { DataService } from '../data/data.service'
import { SecurityService } from '../security.service'
import { ProxyProcessManager, ProxyEmbedStatus } from './proxy-process.manager'
import { QuotaService } from './quota.service'
import { LocalAuthServer } from '../../utils/local-auth-server.util'
import { AuthenticationError } from '../../utils/error.util'

/**
 * Response from GitHub Device Code Flow initiation.
 * 
 * @interface DeviceCodeResponse
 * @property {string} device_code - Verification code for the device
 * @property {string} user_code - Display code for the user to enter
 * @property {string} verification_uri - URL where user enters the code
 * @property {number} expires_in - Seconds until code expires
 * @property {number} interval - Polling interval in seconds
 */
export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

/**
 * Response containing access token from OAuth flow.
 * 
 * @interface TokenResponse
 * @property {string} access_token - The granted access token
 * @property {string} token_type - Token type (usually 'bearer')
 * @property {string} scope - Granted scopes
 * @property {string} [error] - Error code if failed
 * @property {string} [error_description] - Description of error
 */
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

// Legacy OAuth Client replaced by LocalAuthServer
const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

/**
 * Manages GitHub/Google authentication and local proxy process.
 * 
 * Acts as a facade for:
 * - OAuth flows (Device Code, Authorization Code)
 * - Proxy process management (via ProxyProcessManager)
 * - Quota fetching (via QuotaService)
 * - Authentication file management
 */
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

  /**
   * Initiates GitHub Device Code flow.
   * 
   * @param appId - 'profile' for user scopes, 'copilot' for copilot scopes
   * @returns Device code and verification URI
   */
  async initiateGitHubAuth(appId: 'profile' | 'copilot' = 'profile'): Promise<DeviceCodeResponse> {
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

  /**
   * Polls GitHub for access token after device code authorization.
   * 
   * @param deviceCode - Code returned from initiateGitHubAuth
   * @param interval - Polling interval in seconds
   * @param appId - 'profile' or 'copilot' targeting
   * @returns Access token string
   */
  async waitForGitHubToken(deviceCode: string, interval: number, appId: 'profile' | 'copilot' = 'profile'): Promise<string> {
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

  /**
   * spins up a local auth server to handle Antigravity OAuth callback.
   * 
   * @returns Auth URL and state parameter
   */
  async getAntigravityAuthUrl(): Promise<{ url: string, state: string }> {
    return LocalAuthServer.startAntigravityAuth(
      (data) => {
        const now = Date.now()
        const authData = {
          ...data,
          timestamp: now,
          expired: new Date(now + data.expires_in * 1000).toISOString()
        }

        const filename = data.email
          ? `antigravity-${data.email.replace(/[@.]/g, '_')}.json`
          : 'antigravity.json'

        this.updateAuthFile(filename, authData)
      },
      (err) => {
        console.error('[ProxyService] Antigravity Auth failed:', err)
        // In a real scenario we might want to emit this error to the UI
        if (err instanceof AuthenticationError) {
          console.error('[ProxyService] Auth Error Detail:', err.context)
        }
      }
    )
  }

  /**
   * Fetches auth URL for Gemini CLI.
   */
  async getGeminiAuthUrl() {
    return this.makeRequest('/v0/management/gemini-cli-auth-url?is_webui=true')
  }
  /**
   * Fetches auth URL for Claude (Legacy alias).
   * @deprecated Use getAnthropicAuthUrl instead
   */
  async getAnthropicAuthUrl() {
    return this.makeRequest('/v0/management/anthropic-auth-url?is_webui=true')
  }
  /**
   * Fetches auth URL for OpenAI Codex.
   */
  async getCodexAuthUrl() {
    return this.makeRequest('/v0/management/codex-auth-url?is_webui=true')
  }

  /**
   * Lists all authentication files in the work directory.
   */
  async getAuthFiles() {
    const dir = this.getAuthWorkDir();
    if (!fs.existsSync(dir)) return { files: [] };
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    return { files: files.map(f => ({ name: f, provider: f.split('-')[0] })) };
  }

  /**
   * Deletes a specific authentication file.
   * @param name - Filename to delete
   */
  async deleteAuthFile(name: string) {
    const filePath = path.join(this.getAuthWorkDir(), name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { success: true };
  }

  /**
   * Reads and returns the content of an auth file.
   * @param name - Filename to read
   */
  async getAuthFileContent(name: string): Promise<any | null> {
    const filePath = path.join(this.getAuthWorkDir(), name)
    if (!fs.existsSync(filePath)) return null
    return this.readAuthFile(filePath)
  }

  // --- Proxy Embed Lifecycle ---

  /**
   * Starts the embedded `cliproxy` binary.
   * @param options - Configuration options (port)
   * @returns Status of the spawned process
   */
  async startEmbeddedProxy(options?: { port?: number }): Promise<ProxyEmbedStatus> {
    this.currentPort = options?.port || 8317
    return this.processManager.start(options)
  }

  /**
   * Stops the embedded proxy process.
   */
  async stopEmbeddedProxy() {
    return this.processManager.stop()
  }

  /**
   * Checks if the embedded proxy is currently running.
   */
  getEmbeddedProxyStatus(): ProxyEmbedStatus {
    const status = this.processManager.getStatus()
    if (status.running && status.port) this.currentPort = status.port
    return status
  }

  async prepareAuthWorkDir() {
    return this.processManager.prepareTempAuthDir()
  }

  async generateConfig(port?: number) {
    return this.processManager.generateConfig(port || this.currentPort)
  }

  // --- Quota & Models ---

  /**
   * Fetches generic quota information.
   */
  async getQuota(): Promise<any> {
    return this.quotaService.getQuota(this.currentPort, this.getProxyKey())
  }

  /**
   * Fetches specific Codex usage statistics.
   */
  async getCodexUsage(): Promise<any> {
    return this.quotaService.getCodexUsage()
  }

  /**
   * Fetches legacy system quota.
   */
  async getLegacyQuota(): Promise<{ success: boolean; authExpired?: boolean; data?: any }> {
    return this.quotaService.getLegacyQuota()
  }

  /**
   * Fetches GitHub Copilot quota and seat information.
   */
  async getCopilotQuota() {
    return this.quotaService.getCopilotQuota()
  }

  /**
   * Aggregates model lists from all sources (Proxy, Antigravity, Copilot).
   * 
   * Also injects quota information into relevant models.
   * 
   * @returns Combined list of available models with metadata
   */
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

  /**
   * Updates or creates an authentication file.
   * 
   * Handles encryption if SecurityService is available.
   * 
   * @param nameOrPrefix - Filename or prefix to resolve
   * @param data - JSON serializable data to store
   */
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

  /**
   * Returns the directory path for storing auth files.
   * Uses DataService if available, otherwise defaults to userData/auth.
   */
  getAuthWorkDir(): string {
    if (this.dataService) {
      return this.dataService.getPath('auth')
    }
    return path.join(app.getPath('userData'), 'auth')
  }

  /**
   * Makes an authenticated HTTP request to the local proxy.
   * 
   * @param path - URL path (e.g. '/v1/models')
   * @param apiKey - Optional override for API key
   * @returns Parsed JSON response or error object
   */
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

  /**
   * Ensures a proxy API key exists in settings.
   * Generates a new one if missing.
   */
  private ensureProxyKey(): string {
    const settings = this.settingsService.getSettings()
    let key = settings.proxy?.key?.trim()
    if (!key) {
      key = crypto.randomBytes(32).toString('base64')
      this.settingsService.saveSettings({ proxy: { ...((settings.proxy as any) || {}), key } })
    }
    return key as string
  }

  /**
   * Retrieves the current proxy API key.
   */
  getProxyKey(): string { return this.ensureProxyKey() }

  /**
   * Ensures an encryption key for auth store exists.
   */
  private ensureAuthStoreKey(): string {
    const settings = this.settingsService.getSettings()
    let key = settings.proxy?.authStoreKey?.trim()
    if (!key) {
      key = crypto.randomBytes(32).toString('base64')
      this.settingsService.saveSettings({ proxy: { ...((settings.proxy as any) || {}), authStoreKey: key } })
    }
    return key as string
  }

  /**
   * Initiates a custom OAuth flow for Gemini (Google) authentication.
   * 
   * @returns Auth URL and state
   */
  async customGeminiLogin(): Promise<{ url: string, state: string }> {
    return this._customGeminiLogin()
  }


  private async _customGeminiLogin(): Promise<{ url: string, state: string }> {
    return LocalAuthServer.startGeminiAuth(
      (data) => {
        const record = {
          token: {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            token_type: data.token_type,
            expiry_date: new Date(Date.now() + data.expires_in * 1000).toISOString()
          },
          project_id: data.project_id,
          email: data.email,
          auto: true,
          checked: true
        }

        const fileName = `gemini-${data.email}-${data.project_id}.json`
        this.updateAuthFile(fileName, record)
        console.log('[ProxyService] Saved custom Gemini auth file:', fileName)
      },
      (err) => {
        console.error('[ProxyService] Gemini Auth failed:', err)
      }
    )
  }

  /**
   * Fetches available Gemini models.
   * 
   * Strategies:
   * 1. API Key (if configured in settings)
   * 2. OAuth Token (from saved auth files)
   *    - Handles automatic token refresh if expired
   * 
   * @returns Array of Gemini model definitions
   */
  async getGeminiModels(): Promise<any[]> {
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

  /**
   * Refreshes a Google OAuth access token using a refresh token.
   * 
   * @param refreshToken - The refresh token
   * @returns New access token or null if failed
   */
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

  /**
   * Reads and decrypts an authentication file.
   * 
   * @param filePath - Absolute path to the file
   * @returns Decrypted JSON content or null
   */
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
