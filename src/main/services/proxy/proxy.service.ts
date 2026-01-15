import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

import { BaseService } from '@main/services/base.service'
import { DataService } from '@main/services/data/data.service'
import { ProxyEmbedStatus, ProxyProcessManager } from '@main/services/proxy/proxy-process.manager'
import { QuotaService } from '@main/services/proxy/quota.service'
import { SecurityService } from '@main/services/security/security.service'
import { SettingsService } from '@main/services/system/settings.service'
import { AuthenticationError } from '@main/utils/error.util'
import { LocalAuthServer } from '@main/utils/local-auth-server.util'
import { JsonObject, JsonValue } from '@shared/types'
import { ModelQuotaItem, QuotaResponse } from '@shared/types/quota'
import { getErrorMessage } from '@shared/utils/error.util'
import { net } from 'electron'

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

export class ProxyService extends BaseService {
  private currentPort: number = 8317

  constructor(
    public settingsService: SettingsService,
    private dataService: DataService,
    private securityService: SecurityService,
    private processManager: ProxyProcessManager,
    private quotaService: QuotaService
  ) {
    super('ProxyService')
  }

  override async initialize(): Promise<void> {
    await super.initialize()
    await this.ensureAuthStoreKey()
    await this.ensureProxyKey()
  }

  override async cleanup(): Promise<void> {
    try {
      await this.stopEmbeddedProxy()
      this.logInfo('Proxy service stopped')
    } catch (e) {
      this.logError('Failed to stop proxy during cleanup:', e as Error)
    }
  }

  async initiateGitHubAuth(appId: 'profile' | 'copilot' = 'profile'): Promise<DeviceCodeResponse> {
    return new Promise((resolve, reject) => {
      const client = GITHUB_CLIENTS[appId];
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
      request.on('error', (err) => reject(err));
      request.end();
    });
  }

  async waitForGitHubToken(deviceCode: string, interval: number, appId: 'profile' | 'copilot' = 'profile'): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = GITHUB_CLIENTS[appId];
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
              if (json.access_token) {
                resolve(json.access_token);
              } else if (json.error === 'authorization_pending') {
                setTimeout(checkToken, (interval + 1) * 1000);
              } else {
                reject(new Error(json.error_description ?? json.error));
              }
            } catch (error) { reject(error); }
          });
        });
        request.on('error', (err) => reject(err));
        request.end();
      };
      setTimeout(checkToken, interval * 1000);
    });
  }

  async getAntigravityAuthUrl(): Promise<{ url: string, state: string }> {
    return this.startGoogleAuth('antigravity');
  }

  private async startGoogleAuth(prefix: string): Promise<{ url: string, state: string }> {
    return LocalAuthServer.startAntigravityAuth(
      async (data) => {
        const now = Date.now()
        const authData = {
          ...data,
          timestamp: now,
          expired: new Date(now + data.expires_in * 1000).toISOString()
        }

        const filename = data.email
          ? `${prefix}-${data.email.replace(/[@.]/g, '_')}.json`
          : `${prefix}.json`

        await this.updateAuthFile(filename, authData)
      },
      (err) => {
        this.logError(`${prefix} Auth failed:`, err as Error)
        if (err instanceof AuthenticationError) {
          this.logError('Auth Error Detail:', err.context ?? {});
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
    const exists = await fs.promises.access(dir).then(() => true).catch(() => false);
    if (!exists) { return { files: [] }; }
    const files = (await fs.promises.readdir(dir)).filter(f => f.endsWith('.json') || f.endsWith('.enc'));
    return {
      files: files.map(f => {
        let provider = f.replace(/\.(json|enc)$/, '').split('-')[0].split('_')[0];
        if (provider === 'github' || provider === 'github_token') { provider = 'github'; }
        if (provider === 'copilot' || provider === 'copilot_token') { provider = 'copilot'; }
        if (provider === 'antigravity' || provider === 'antigravity_token') { provider = 'antigravity'; }
        if (provider === 'gemini' || provider === 'gemini_key') { provider = 'gemini'; }
        if (provider === 'openai' || provider === 'openai_key') { provider = 'openai'; }
        if (provider === 'anthropic' || provider === 'anthropic_key') { provider = 'anthropic'; }
        if (provider === 'proxy' || provider === 'proxy_key') { provider = 'proxy'; }

        return { name: f, provider };
      })
    };
  }

  async deleteAuthFile(name: string): Promise<{ success: boolean }> {
    const filePath = path.join(this.getAuthWorkDir(), name);
    const exists = await fs.promises.access(filePath).then(() => true).catch(() => false);
    if (exists) {
      await fs.promises.unlink(filePath);
      return { success: true };
    }
    return { success: false };
  }

  async getAuthFileContent(name: string): Promise<JsonObject | null> {
    const filePath = path.join(this.getAuthWorkDir(), name)
    const exists = await fs.promises.access(filePath).then(() => true).catch(() => false);
    if (!exists) { return null }
    return await this.readAuthFile(name)
  }

  async startEmbeddedProxy(options?: { port?: number }): Promise<ProxyEmbedStatus> {
    this.currentPort = options?.port ?? 8317
    return this.processManager.start(options)
  }

  async stopEmbeddedProxy(): Promise<void> {
    await this.processManager.stop()
  }

  getEmbeddedProxyStatus(): ProxyEmbedStatus {
    const status = this.processManager.getStatus()
    if (status.running && status.port) { this.currentPort = status.port }
    return status
  }

  async prepareAuthWorkDir(): Promise<void> {
    return this.processManager.prepareTempAuthDir()
  }

  async generateConfig(port?: number): Promise<void> {
    return this.processManager.generateConfig(port ?? this.currentPort)
  }

  async getQuota(): Promise<QuotaResponse | null> {
    return this.quotaService.getQuota(this.currentPort, await this.getProxyKey())
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

  async getClaudeQuota(): Promise<{ success: boolean; fiveHour?: { utilization: number; resetsAt: string }; sevenDay?: { utilization: number; resetsAt: string } }> {
    return this.quotaService.getClaudeQuota()
  }

  async getModels(): Promise<ProxyModelResponse> {
    const apiKey = await this.getProxyKey();
    const proxyData = await this.getProxyModels(apiKey);

    const [codexData, copilotData, claudeData] = await Promise.all([
      this.quotaService.fetchCodexUsage(),
      this.quotaService.getCopilotQuota(),
      this.quotaService.getClaudeQuota()
    ]);

    const quotas = this.normalizeQuota(codexData, copilotData, claudeData);

    let extra: ModelQuotaItem[] = [];
    let antigravityError: string | undefined;

    try {
      extra = await this.quotaService.getAntigravityAvailableModels();
    } catch (error) {
      if (getErrorMessage(error) === 'AUTH_EXPIRED') {
        antigravityError = 'Oturum süresi doldu. Lütfen tekrar giriş yapın.';
      }
    }

    const merged = this.mergeModels(proxyData, extra);
    const finalData = merged.map((m: ModelItem) => this.enrichModelWithQuota(m, quotas));

    return { data: finalData, antigravityError };
  }

  private async getProxyModels(apiKey: string): Promise<ModelItem[]> {
    try {
      this.logInfo(`getProxyModels: Fetching from http://127.0.0.1:${this.currentPort}/v1/models`);
      const res = await this.makeRequest('/v1/models', apiKey)
      if (res && 'data' in res && Array.isArray(res.data)) {
        return res.data as ModelItem[];
      }
    } catch (error) {
      this.logWarn(`getProxyModels: Primary proxy fetch failed. ${getErrorMessage(error)}`)
    }
    return [];
  }

  private normalizeQuota(
    codexData: JsonObject | null,
    copilotData: { success: boolean; limit?: number; remaining?: number; percentage?: number | null } | null,
    claudeData: { success: boolean; fiveHour?: { utilization: number; resetsAt: string }; sevenDay?: { utilization: number; resetsAt: string } } | null
  ) {
    const codexQuotaFn = this.normalizeCodexQuota(codexData);
    const copilotQuotaFn = this.normalizeCopilotQuota(copilotData);
    const claudeQuotaFn = this.normalizeClaudeQuota(claudeData);

    return { codexQuotaFn, copilotQuotaFn, claudeQuotaFn };
  }

  private normalizeCodexQuota(codexData: JsonObject | null): QuotaInfo | undefined {
    if (!codexData) { return undefined; }
    const usage = this.quotaService.extractCodexUsageFromWham(codexData);
    if (!usage) { return undefined; }

    const usageObj = usage as Record<string, unknown>;
    const remaining = (usageObj.remainingRequests as number) || (usageObj.remainingTokens as number) || 0;
    const limit = (usageObj.dailyLimit as number) || (usageObj.weeklyLimit as number) || (usageObj.totalRequests as number) || 0;
    const fraction = this.determineCodexFraction(usage, remaining, limit);

    return this.assembleQuotaFn(remaining, limit, fraction, usageObj as JsonObject);
  }

  private determineCodexFraction(usage: any, remaining: number, limit: number): number {
    if (usage.dailyUsedPercent !== undefined || usage.weeklyUsedPercent !== undefined) {
      return this.calculateFractionFromPercent(usage.dailyUsedPercent, usage.weeklyUsedPercent);
    }
    return limit > 0 ? remaining / limit : 0;
  }

  private assembleQuotaFn(remaining: number, limit: number, fraction: number, usage: JsonObject): QuotaInfo {
    return {
      remainingQuota: remaining,
      totalQuota: limit,
      remainingFraction: fraction,
      resetTime: (usage.dailyResetAt as string) || (usage.weeklyResetAt as string) || (usage.resetAt as string)
    };
  }

  private calculateFractionFromPercent(daily?: number, weekly?: number): number {
    const dRemaining = daily !== undefined ? (100 - daily) / 100 : 1.0;
    const wRemaining = weekly !== undefined ? (100 - weekly) / 100 : 1.0;
    return Math.max(0, Math.min(dRemaining, wRemaining));
  }

  private normalizeCopilotQuota(copilotData: { success: boolean; limit?: number; remaining?: number; percentage?: number | null } | null): QuotaInfo | undefined {
    if (!copilotData?.success) { return undefined; }
    return {
      remainingQuota: copilotData.remaining ?? 0,
      totalQuota: copilotData.limit ?? 0,
      remainingFraction: copilotData.percentage ? copilotData.percentage / 100 : 0,
      resetTime: undefined
    };
  }

  private normalizeClaudeQuota(claudeData: { success: boolean; fiveHour?: { utilization: number; resetsAt: string }; sevenDay?: { utilization: number; resetsAt: string } } | null): QuotaInfo | undefined {
    if (!claudeData?.success) { return undefined; }
    const fiveHour = claudeData.fiveHour;
    const sevenDay = claudeData.sevenDay;
    const utilization = fiveHour?.utilization ?? sevenDay?.utilization ?? 0;
    return {
      remainingQuota: Math.round(100 - utilization),
      totalQuota: 100,
      remainingFraction: (100 - utilization) / 100,
      resetTime: fiveHour?.resetsAt ?? sevenDay?.resetsAt
    };
  }

  private mergeModels(base: ModelItem[], extra: ModelQuotaItem[]): ModelItem[] {
    const merged: ModelItem[] = base.map(m => {
      let provider = m.provider;
      if (!provider) {
        const idValue = m.id.toLowerCase();
        if (idValue.includes('claude') || idValue.includes('anthropic')) { provider = 'anthropic'; }
        else if (idValue.includes('gemini-3')) { provider = 'copilot'; }
        else if (idValue.startsWith('gemini-') || idValue.includes('google')) { provider = 'gemini'; }
        else { provider = 'antigravity'; }
      }
      return { ...m, provider };
    });

    const ids = new Set(merged.map(m => m.id));
    for (const m of extra) {
      if (ids.has(m.id)) {
        merged.push({ ...m, id: m.id + '-antigravity', name: (m.name ?? m.id) + ' (Antigravity)', provider: 'antigravity' });
      } else {
        merged.push(m);
      }
    }
    return merged;
  }

  private enrichModelWithQuota(m: ModelItem, quotas: { codexQuotaFn?: QuotaInfo, copilotQuotaFn?: QuotaInfo, claudeQuotaFn?: QuotaInfo }): ModelItem {
    const provider = (m.provider ?? 'custom').toLowerCase();
    const model = { ...m };

    this.applyQuotaInfo(model, provider, quotas);

    if (!model.quota && model.quotaInfo) {
      this.calculateQuotaFromInfo(model);
    }

    if (!model.quota && typeof model.percentage === 'number') {
      model.quota = { percentage: model.percentage, reset: (model.reset as string) || '-' };
    }

    return model;
  }

  private applyQuotaInfo(model: ModelItem, provider: string, quotas: { codexQuotaFn?: QuotaInfo, copilotQuotaFn?: QuotaInfo, claudeQuotaFn?: QuotaInfo }) {
    const { codexQuotaFn, copilotQuotaFn, claudeQuotaFn } = quotas;
    const id = model.id.toLowerCase();

    if (this.isCodexModel(id, provider) && codexQuotaFn) {
      model.quotaInfo = codexQuotaFn;
    } else if (provider === 'copilot' && copilotQuotaFn) {
      model.quotaInfo = copilotQuotaFn;
    } else if (this.isClaudeModel(id, provider) && claudeQuotaFn) {
      model.quotaInfo = claudeQuotaFn;
    }
  }

  private isCodexModel(id: string, provider: string): boolean {
    return provider === 'codex' || provider === 'openai' || id.startsWith('gpt-');
  }

  private isClaudeModel(id: string, provider: string): boolean {
    return provider === 'anthropic' || provider === 'claude' || id.startsWith('claude-');
  }

  private calculateQuotaFromInfo(model: ModelItem) {
    if (!model.quotaInfo) {
      return;
    }
    const fraction = model.quotaInfo.remainingFraction;
    let resetStr = '-';
    if (model.quotaInfo.resetTime) {
      try {
        resetStr = new Date(model.quotaInfo.resetTime).toLocaleString('tr-TR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        this.logDebug('Failed to format reset time:', e as Error);
      }
    }
    model.quota = { percentage: Math.round(fraction * 100), reset: resetStr };
  }

  private async updateAuthFile(nameOrPrefix: string, data: JsonObject) {
    try {
      const dir = this.getAuthWorkDir()
      let fileName: string

      if (nameOrPrefix.endsWith('.json')) {
        fileName = nameOrPrefix
      } else {
        const files = (await fs.promises.readdir(dir)).filter(f => f.startsWith(nameOrPrefix + '-') && f.endsWith('.json'))
        fileName = files.length > 0 ? files[0] : `${nameOrPrefix}.json`
      }

      const filePath = path.join(dir, fileName)
      const contentString = JSON.stringify(data, null, 2)
      const encrypted = this.securityService.encryptSync(contentString)
      const persistedData = JSON.stringify({ encryptedPayload: encrypted, version: 1 })
      await fs.promises.writeFile(filePath, persistedData)

    } catch (e) {
      this.logError(`Failed to update auth file ${nameOrPrefix}:`, e as Error)
    }
  }

  getAuthWorkDir(): string {
    return this.dataService.getPath('auth')
  }

  private makeRequest(path: string, apiKey?: string): Promise<ProxyRequestResponse> {
    return new Promise((resolve, reject) => {
      const options = {
        method: 'GET',
        protocol: 'http:' as const,
        hostname: '127.0.0.1',
        port: this.currentPort,
        path
      }

      const request = net.request(options)
      if (apiKey) {
        request.setHeader('Authorization', `Bearer ${apiKey}`)
      }

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

  private async ensureProxyKey(): Promise<string> {
    const settings = this.settingsService.getSettings()
    let key = settings.proxy?.key?.trim() || ''
    if (!key || key.length > 72) {
      key = crypto.randomBytes(32).toString('base64')
      const currentProxy = settings.proxy ?? { enabled: false, url: 'http://localhost:8317/v1' }
      await this.settingsService.saveSettings({ proxy: { ...currentProxy, key } })
    }
    return key
  }

  async getProxyKey(): Promise<string> { return await this.ensureProxyKey() }

  private async ensureAuthStoreKey(): Promise<string> {
    const settings = this.settingsService.getSettings()
    let key = settings.proxy?.authStoreKey?.trim() || ''
    if (!key || key.length > 72) {
      key = crypto.randomBytes(32).toString('base64')
      const currentProxy = settings.proxy ?? { enabled: false, url: 'http://localhost:8317/v1', key: '' }
      await this.settingsService.saveSettings({ proxy: { ...currentProxy, authStoreKey: key } })
    }
    return key
  }

  async readAuthFile(fileName: string): Promise<JsonObject | null> {
    const filePath = path.join(this.getAuthWorkDir(), fileName);
    try {
      const exists = await fs.promises.access(filePath).then(() => true).catch(() => false);
      if (!exists) { return null; }
      const content = await fs.promises.readFile(filePath, 'utf8');
      return this.parseAuthContent(content, fileName);
    } catch (error) {
      this.logError(`Failed to read auth file ${fileName}:`, error as Error);
      return null;
    }
  }

  private parseAuthContent(content: string, fileName: string): JsonObject | null {
    if (!content) { return null; }
    try {
      const jsonValue = this.getInitialJson(content, fileName);
      if (!jsonValue || typeof jsonValue !== 'object' || Array.isArray(jsonValue)) {
        return null;
      }
      return jsonValue as JsonObject;
    } catch (e) {
      this.logDebug('Parse failed:', e as Error);
      return null;
    }
  }

  private getInitialJson(content: string, fileName: string): JsonValue | null {
    if (fileName.endsWith('.enc')) {
      const decrypted = this.securityService.decryptSync(content);
      if (!decrypted) { return null; }
      return JSON.parse(decrypted);
    }
    return JSON.parse(content);
  }
}
