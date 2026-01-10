import path from 'path'
import fs from 'fs'

import crypto from 'crypto'
import { net, app } from 'electron'
import { SettingsService } from '../settings.service'
import { DataService } from '../data/data.service'
import { SecurityService } from '../security.service'
import { ProxyProcessManager, ProxyEmbedStatus } from './proxy-process.manager'
import { QuotaService } from './quota.service'
import { LocalAuthServer } from '../../utils/local-auth-server.util'
import { AuthenticationError } from '../../utils/error.util'
import { JsonObject, JsonValue } from '../../../shared/types'
import { ModelQuotaItem, QuotaResponse } from '../../../shared/types/quota'
import { getErrorMessage } from '../../../shared/utils/error.util'

export type QuotaInfo = {
  remainingQuota: number;
  totalQuota: number;
  remainingFraction: number;
  resetTime?: string;
}

export interface ModelItem {
  id: string;
  name?: string;
  provider: string;
  quota?: {
    percentage: number;
    reset: string;
  };
  quotaInfo?: QuotaInfo;
  [key: string]: JsonValue | undefined;
}

interface ProxyModelResponse {
  data: ModelItem[];
  antigravityError?: string;
  [key: string]: JsonValue | undefined;
}

type ProxyRequestResponse = JsonObject | { success: boolean; error?: string; raw?: JsonValue }


/**
 * Response from GitHub Device Code Flow initiation.
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

const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

/**
 * Manages GitHub/Google authentication and local proxy process.
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
        response.on('end', () => { try { resolve(JSON.parse(data)); } catch (error) { reject(error); } });
      });
      request.end();
    });
  }

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
            } catch (error) { reject(error); }
          });
        });
        request.end();
      };
      setTimeout(checkToken, interval * 1000);
    });
  }

  async getAntigravityAuthUrl(): Promise<{ url: string, state: string }> {
    return this.startGoogleAuth('antigravity')
  }



  private async startGoogleAuth(prefix: string): Promise<{ url: string, state: string }> {
    return LocalAuthServer.startAntigravityAuth(
      (data) => {
        const now = Date.now()
        const authData = {
          ...data,
          timestamp: now,
          expired: new Date(now + data.expires_in * 1000).toISOString()
        }

        const filename = data.email
          ? `${prefix}-${data.email.replace(/[@.]/g, '_')}.json`
          : `${prefix}.json`

        this.updateAuthFile(filename, authData)
      },
      (err) => {
        console.error(`[ProxyService] ${prefix} Auth failed:`, err)
        if (err instanceof AuthenticationError) {
          console.error('[ProxyService] Auth Error Detail:', err.context)
        }
      }
    )
  }

  async getAnthropicAuthUrl(): Promise<ProxyRequestResponse> {
    return this.makeRequest('/v0/management/anthropic-auth-url?is_webui=true')
  }

  async getCodexAuthUrl(): Promise<ProxyRequestResponse> {
    return this.makeRequest('/v0/management/codex-auth-url?is_webui=true')
  }

  async getAuthFiles(): Promise<{ files: { name: string, provider: string }[] }> {
    const dir = this.getAuthWorkDir();
    if (!fs.existsSync(dir)) return { files: [] };
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') || f.endsWith('.enc'));
    const res = {
      files: files.map(f => {
        let provider = f.replace(/\.(json|enc)$/, '').split('-')[0].split('_')[0]; // Handle github-token, github_token, etc.
        // Normalize common names
        if (provider === 'github' || provider === 'github_token') provider = 'github';
        if (provider === 'copilot' || provider === 'copilot_token') provider = 'copilot';
        if (provider === 'antigravity' || provider === 'antigravity_token') provider = 'antigravity';
        if (provider === 'gemini' || provider === 'gemini_key') provider = 'gemini';
        if (provider === 'openai' || provider === 'openai_key') provider = 'openai';
        if (provider === 'anthropic' || provider === 'anthropic_key') provider = 'anthropic';
        if (provider === 'proxy' || provider === 'proxy_key') provider = 'proxy';

        return { name: f, provider };
      })
    };
    console.log(`[ProxyService] getAuthFiles: Found ${files.length} files. Providers:`, res.files.map(f => f.provider));
    return res;
  }

  async deleteAuthFile(name: string): Promise<{ success: boolean }> {
    const filePath = path.join(this.getAuthWorkDir(), name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { success: true };
    }
    return { success: false };
  }

  async getAuthFileContent(name: string): Promise<JsonObject | null> {
    const filePath = path.join(this.getAuthWorkDir(), name)
    if (!fs.existsSync(filePath)) return null
    return this.readAuthFile(filePath)
  }

  // --- Proxy Embed Lifecycle ---

  async startEmbeddedProxy(options?: { port?: number }): Promise<ProxyEmbedStatus> {
    this.currentPort = options?.port || 8317
    return this.processManager.start(options)
  }

  async stopEmbeddedProxy(): Promise<void> {
    await this.processManager.stop()
  }

  getEmbeddedProxyStatus(): ProxyEmbedStatus {
    const status = this.processManager.getStatus()
    if (status.running && status.port) this.currentPort = status.port
    return status
  }

  async prepareAuthWorkDir(): Promise<void> {
    return this.processManager.prepareTempAuthDir()
  }

  async generateConfig(port?: number): Promise<void> {
    return this.processManager.generateConfig(port || this.currentPort)
  }

  // --- Quota & Models ---

  async getQuota(): Promise<QuotaResponse | null> {
    return this.quotaService.getQuota(this.currentPort, this.getProxyKey())
  }

  async getCodexUsage(): Promise<Partial<QuotaResponse>> {
    return this.quotaService.getCodexUsage()
  }

  async getAntigravityAvailableModels(): Promise<ModelQuotaItem[]> {
    return this.quotaService.getAntigravityAvailableModels()
  }

  async getLegacyQuota(): Promise<{ success: boolean; authExpired?: boolean; data?: JsonObject } & Partial<QuotaResponse>> {
    return this.quotaService.getLegacyQuota()
  }

  async getCopilotQuota(): Promise<{ success: boolean; plan?: string; limit?: number; remaining?: number; used?: number; percentage?: number | null }> {
    return this.quotaService.getCopilotQuota()
  }

  async getModels(): Promise<ProxyModelResponse> {
    const apiKey = this.getProxyKey()
    let baseRes: ProxyModelResponse = { data: [] }
    try {
      const res = await this.makeRequest('/v1/models', apiKey)
      if (res && 'data' in res && Array.isArray(res.data)) {
        baseRes = res as ProxyModelResponse;
      }
    } catch (error) {
      console.warn('[ProxyService] getModels: Primary proxy fetch failed.', getErrorMessage(error))
    }

    const [codexData, copilotData] = await Promise.all([
      this.quotaService.fetchCodexUsage(),
      this.quotaService.getCopilotQuota()
    ]);

    let codexQuotaFn: QuotaInfo | undefined = undefined;
    if (codexData) {
      const usage = this.quotaService.extractCodexUsageFromWham(codexData);
      if (usage) {
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

    let copilotQuotaFn: QuotaInfo | undefined = undefined;
    if (copilotData && copilotData.success) {
      copilotQuotaFn = {
        remainingQuota: copilotData.remaining || 0,
        totalQuota: copilotData.limit || 0,
        remainingFraction: copilotData.percentage ? copilotData.percentage / 100 : 0,
        resetTime: undefined
      };
    }

    let extra: ModelQuotaItem[] = []
    let antigravityError: string | undefined

    try {
      extra = await this.quotaService.getAntigravityAvailableModels();
    } catch (error) {
      if (getErrorMessage(error) === 'AUTH_EXPIRED') {
        antigravityError = 'Oturum süresi doldu. Lütfen tekrar giriş yapın.'
      }
    }

    const base = Array.isArray(baseRes?.data) ? baseRes.data.map((m: ModelItem) => {
      const id = m.id.toLowerCase();
      let provider = m.provider;

      if (!provider) {
        if (id.includes('gemini-3')) provider = 'copilot';
        else if (id.startsWith('gemini-') || id.includes('google') || m.id.startsWith('google/')) provider = 'gemini';
        else provider = 'antigravity';
      }

      return { ...m, provider };
    }) : []

    const merged = [...base]
    const ids = new Set(base.map((m: ModelItem) => m.id))



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

    const finalData = merged.map((m: ModelItem) => {
      const provider = (m.provider || 'custom').toLowerCase();
      const model = { ...m };

      // console.log(`[ProxyService] getModels: Processing model ${m.id} for provider ${provider}`);

      if ((provider === 'codex' || provider === 'openai' || m.id.startsWith('gpt-')) && codexQuotaFn) {
        model.quotaInfo = codexQuotaFn;
      }
      if (provider === 'copilot' && copilotQuotaFn) {
        model.quotaInfo = copilotQuotaFn;
      }

      if (!model.quota && model.quotaInfo) {
        const fraction = model.quotaInfo.remainingFraction;
        const resetTime = model.quotaInfo.resetTime;

        let resetStr = '-';
        if (resetTime) {
          try {
            resetStr = new Date(resetTime).toLocaleString('tr-TR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          } catch { /* Invalid date format */ }
        }

        model.quota = {
          percentage: Math.round(fraction * 100),
          reset: resetStr
        };
      }
      if (!model.quota && typeof model.percentage === 'number') {
        model.quota = {
          percentage: model.percentage as number,
          reset: (model.reset as string) || '-'
        }
      }

      return model;
    });

    console.log(`[ProxyService] getModels: Returning ${finalData.length} models. Providers: ${[...new Set(finalData.map(m => m.provider))].join(', ')}`);

    return {
      ...baseRes,
      data: finalData,
      antigravityError
    }
  }

  // --- Auth Management ---


  private updateAuthFile(nameOrPrefix: string, data: JsonObject) {
    try {
      const dir = this.getAuthWorkDir()
      let fileName: string

      if (nameOrPrefix.endsWith('.json')) {
        fileName = nameOrPrefix
      } else {
        const files = fs.readdirSync(dir).filter(f => f.startsWith(nameOrPrefix + '-') && f.endsWith('.json'))
        fileName = files.length > 0 ? files[0] : `${nameOrPrefix}.json`
      }

      const filePath = path.join(dir, fileName)
      const contentString = JSON.stringify(data, null, 2)
      let persistedData = contentString
      if (this.securityService) {
        const encrypted = this.securityService.encryptSync(contentString)
        persistedData = JSON.stringify({ encryptedPayload: encrypted, version: 1 })
      }
      fs.writeFileSync(filePath, persistedData)

    } catch (e) {
      console.error('[ProxyService] Failed to update auth file:', nameOrPrefix, getErrorMessage(e as Error))
    }
  }

  getAuthWorkDir(): string {
    if (this.dataService) return this.dataService.getPath('auth')
    return path.join(app.getPath('userData'), 'auth')
  }

  private makeRequest(path: string, apiKey?: string): Promise<ProxyRequestResponse> {
    const key = apiKey || this.getProxyKey()
    return new Promise((resolve, reject) => {
      const options = {
        method: 'GET',
        protocol: 'http:' as const,
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
            const parsed = JSON.parse(d) as JsonValue
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              resolve(parsed as JsonObject)
            } else {
              resolve({ success: false, error: 'Invalid JSON', raw: d })
            }
          } catch {
            resolve({ success: false, error: 'Invalid JSON', raw: d });
          }
        })
      })

      request.on('error', err => reject(err))
      request.end()
    })
  }

  private ensureProxyKey(): string {
    const settings = this.settingsService.getSettings()
    let key = settings.proxy?.key?.trim() || ''
    // bcrypt limitation: max 72 bytes. 50 chars base64 is safe (~37 bytes).
    if (!key || key.length > 72) {
      key = crypto.randomBytes(32).toString('base64')
      const currentProxy = settings.proxy || { enabled: false, url: 'http://localhost:8317/v1' }
      this.settingsService.saveSettings({ proxy: { ...currentProxy, key } })
    }
    return key
  }

  getProxyKey(): string { return this.ensureProxyKey() }

  private ensureAuthStoreKey(): string {
    const settings = this.settingsService.getSettings()
    let key = settings.proxy?.authStoreKey?.trim() || ''
    if (!key || key.length > 72) {
      key = crypto.randomBytes(32).toString('base64')
      const currentProxy = settings.proxy || { enabled: false, url: 'http://localhost:8317/v1', key: '' }
      this.settingsService.saveSettings({ proxy: { ...currentProxy, authStoreKey: key } })
    }
    return key
  }



  private readAuthFile(filePath: string): JsonObject | null {
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      let jsonValue = JSON.parse(content) as JsonValue
      if (jsonValue && typeof jsonValue === 'object' && !Array.isArray(jsonValue)) {
        const obj = jsonValue as JsonObject
        if (typeof obj.encryptedPayload === 'string' && this.securityService) {
          const decrypted = this.securityService.decryptSync(obj.encryptedPayload)
          if (!decrypted) {
            console.warn(`[ProxyService] Deleting corrupted auth file: ${path.basename(filePath)}`)
            try { fs.unlinkSync(filePath) } catch { /* ignore */ }
            return null
          }
          try { fs.writeFileSync('c:\\Users\\agnes\\Desktop\\projects\\orbit\\decrypted_token.txt', decrypted); } catch (e) { console.error('Failed to write debug token file', e) }
          jsonValue = JSON.parse(decrypted) as JsonValue
        }
      }
      return jsonValue && typeof jsonValue === 'object' && !Array.isArray(jsonValue) ? (jsonValue as JsonObject) : null
    } catch {
      return null
    }
  }
}
