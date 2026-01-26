import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import { LinkedAccount } from '@main/services/data/database.service';
import { ProxyEmbedStatus, ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
import { QuotaService } from '@main/services/proxy/quota.service';
import { AuthService } from '@main/services/security/auth.service';
import { SecurityService } from '@main/services/security/security.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { SettingsService } from '@main/services/system/settings.service';
import { AuthenticationError } from '@main/utils/error.util';
import { LocalAuthServer } from '@main/utils/local-auth-server.util';
import { JsonObject, JsonValue } from '@shared/types';
import { ClaudeQuota, CopilotQuota, ModelQuotaItem, QuotaResponse } from '@shared/types/quota';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { net } from 'electron';

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

export type ProxyRequestResponse = JsonObject | {
  success: boolean;
  error?: string;
  raw?: JsonValue;
  sessionKey?: string;
}

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
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
}

const GITHUB_CLIENTS = {
  profile: { id: '01ab8ac9400c4e429b23', scope: 'read:user user:email repo' }, // Use Copilot ID for universal access
  copilot: { id: '01ab8ac9400c4e429b23', scope: 'read:user user:email' }
};

const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

export interface ProxyServiceOptions {
  settingsService: SettingsService;
  dataService: DataService;
  securityService: SecurityService;
  processManager: ProxyProcessManager;
  quotaService: QuotaService;
  authService: AuthService;
  eventBus: EventBusService;
}

export class ProxyService extends BaseService {
  private currentPort: number = 8317;

  constructor(private options: ProxyServiceOptions) {
    super('ProxyService');
  }

  get settingsService(): SettingsService { return this.options.settingsService; }
  get dataService(): DataService { return this.options.dataService; }
  get securityService(): SecurityService { return this.options.securityService; }
  get processManager(): ProxyProcessManager { return this.options.processManager; }
  get quotaService(): QuotaService { return this.options.quotaService; }
  get authService(): AuthService { return this.options.authService; }
  get eventBus(): EventBusService { return this.options.eventBus; }

  override async initialize(): Promise<void> {
    await super.initialize();

    // Listen for token refreshes (no longer syncs files, but logs it)
    this.eventBus.on('token:refreshed', (payload) => {
      this.logInfo(`Token refreshed for ${payload.provider}, available via Auth API`);
    });

    await this.ensureAuthStoreKey();
    await this.ensureProxyKey();
    await this.cleanupAuthDirectory();
    // No longer calling syncAuthFiles()
  }

  override async cleanup(): Promise<void> {
    try {
      await this.stopEmbeddedProxy();
      this.logInfo('Proxy service stopped');
    } catch (e) {
      this.logError('Failed to stop proxy during cleanup:', e as Error);
    }
  }

  /**
   * @deprecated Token synchronization now happens via AuthAPIService (HTTP)
   */
  async syncAuthFiles(): Promise<void> {
    // This is now a no-op to prevent writing sensitive data to disk
    return Promise.resolve();
  }

  private prepareTokenData(account: LinkedAccount, provider: string): JsonObject {
    const tokenData: JsonObject = {
      access_token: this.authService.decryptToken(account.accessToken ?? ''),
      refresh_token: this.authService.decryptToken(account.refreshToken ?? ''),
      scope: account.scope,
      ...account.metadata
    };

    if (account.email) {
      tokenData.email = account.email;
    }

    if (provider === 'claude' || provider === 'anthropic') {
      tokenData.type = 'claude';
      if (account.expiresAt) {
        tokenData.expired = new Date(account.expiresAt).toISOString();
      }
    } else if (provider === 'antigravity') {
      tokenData.type = 'antigravity';
    }

    return tokenData;
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
        response.on('end', () => {
          const result = safeJsonParse<DeviceCodeResponse>(data, {
            device_code: '',
            user_code: '',
            verification_uri: '',
            expires_in: 0,
            interval: 0
          });
          resolve(result);
        });
      });
      request.on('error', (err) => reject(err));
      request.end();
    });
  }

  async waitForGitHubToken(deviceCode: string, interval: number, appId: 'profile' | 'copilot' = 'profile'): Promise<TokenResponse> {
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
            const json: TokenResponse = safeJsonParse<TokenResponse>(data, { error: 'Invalid response' } as TokenResponse);
            if (json.access_token) {
              resolve(json);
            } else if (json.error === 'authorization_pending') {
              setTimeout(checkToken, (interval + 1) * 1000);
            } else {
              reject(new Error(json.error_description ?? json.error));
            }
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
      (data) => {
        void (async () => {
          const now = Date.now();

          let projectId: string | undefined;
          try {
            projectId = await this.fetchAntigravityProjectID(data.access_token);
            if (projectId) {
              this.logInfo(`Discovered Antigravity project ID: ${projectId}`);
            }
          } catch (e) {
            this.logWarn('Failed to discover Antigravity project ID:', e as Error);
          }

          // Link account using individual fields
          await this.authService.linkAccount(prefix, {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: now + (data.expires_in * 1000),
            scope: data.scope,
            email: data.email,
            metadata: { ...data, project_id: projectId }
          });

          // Sync to file system so proxy picks it up immediately
          await this.syncAuthFiles();
        })().catch(err => this.logError('Antigravity login failed', err as Error));
      },
      (err) => {
        this.logError(`${prefix} Auth failed:`, err as Error);
        if (err instanceof AuthenticationError) {
          this.logError('Auth Error Detail:', err.context ?? {});
        }
      }
    );
  }

  async getAnthropicAuthUrl(): Promise<{ url: string; state: string }> {
    // Use TypeScript LocalAuthServer to avoid terminal spam from Go proxy's browser automation
    return this.startClaudeAuth();
  }

  private async startClaudeAuth(): Promise<{ url: string; state: string }> {
    return LocalAuthServer.startClaudeAuth(
      async (data) => {
        const now = Date.now();

        // Link account using individual fields
        await this.authService.linkAccount('claude', {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: data.expires_in ? now + (data.expires_in * 1000) : undefined,
          scope: data.scope,
          email: data.email,
          metadata: { ...data }
        });

        // Sync to file system so proxy picks it up immediately
        await this.syncAuthFiles();

        this.logInfo('Claude OAuth login successful');
      },
      (err) => {
        this.logError('Claude Auth failed:', err as Error);
      }
    );
  }

  async getCodexAuthUrl(): Promise<ProxyRequestResponse> {
    return this.makeRequest('/v0/management/codex-auth-url?is_webui=true', await this.getProxyKey());
  }

  async getAuthFiles(): Promise<{ files: { name: string, provider: string }[] }> {
    const dir = this.getAuthWorkDir();
    const exists = await fs.promises.access(dir).then(() => true).catch(() => false);
    const filesMap = new Map<string, { name: string, provider: string }>();

    if (exists) {
      const files = (await fs.promises.readdir(dir)).filter(f => f.endsWith('.json') || f.endsWith('.enc'));
      files.forEach(f => {
        const raw = f.replace(/\.(json|enc)$/, '');
        const provider = this.normalizeProviderName(raw);
        filesMap.set(provider, { name: f, provider });
      });
    }

    // Include tokens from Database - These take precedence and ensure uniqueness by provider
    const accounts = await this.authService.getAllAccountsFull();
    for (const account of accounts) {
      const normalized = this.normalizeProviderName(account.provider);
      // Always add database tokens with db: prefix
      filesMap.set(normalized, {
        name: `db:${normalized}`,
        provider: normalized
      });
    }

    return { files: Array.from(filesMap.values()) };
  }

  private normalizeProviderName(provider: string): string {
    let p = provider.toLowerCase();

    // Strip emails (e.g. claude-user@gmail.com -> claude)
    if (p.includes('@')) {
      p = p.split('-')[0].split('_')[0];
    }

    // Strip common suffixes
    p = p.replace(/(_token|_key|_auth)$/, '');

    const mappings: Record<string, string> = {
      'proxy': 'proxy_key', 'proxy_key': 'proxy_key',
      'github': 'github', 'github_token': 'github',
      'copilot': 'copilot', 'copilot_token': 'copilot',
      'antigravity': 'antigravity', 'antigravity_token': 'antigravity',
      'anthropic': 'claude', 'anthropic_key': 'claude', 'claude': 'claude',
      'openai': 'codex', 'openai_key': 'codex', 'codex': 'codex',
      'gemini': 'gemini', 'gemini_key': 'gemini'
    };

    return mappings[p] ?? p;
  }

  async deleteAuthFile(name: string): Promise<{ success: boolean }> {
    if (name.startsWith('db:')) {
      const provider = name.substring(3);
      await this.authService.unlinkAllForProvider(provider);
      return { success: true };
    }

    const filePath = path.join(this.getAuthWorkDir(), name);
    const exists = await fs.promises.access(filePath).then(() => true).catch(() => false);
    if (exists) {
      await fs.promises.unlink(filePath);
      return { success: true };
    }
    return { success: false };
  }

  async getAuthFileContent(name: string): Promise<JsonObject | null> {
    const filePath = path.join(this.getAuthWorkDir(), name);
    const exists = await fs.promises.access(filePath).then(() => true).catch(() => false);
    if (!exists) { return null; }
    return await this.readAuthFile(name);
  }

  async startEmbeddedProxy(options?: { port?: number }): Promise<ProxyEmbedStatus> {
    this.currentPort = options?.port ?? 8317;
    return this.processManager.start(options);
  }

  async stopEmbeddedProxy(): Promise<void> {
    await this.processManager.stop();
  }

  getEmbeddedProxyStatus(): ProxyEmbedStatus {
    const status = this.processManager.getStatus();
    if (status.running && status.port) { this.currentPort = status.port; }
    return status;
  }

  async generateConfig(port?: number): Promise<void> {
    return this.processManager.generateConfig(port ?? this.currentPort);
  }

  async getQuota(): Promise<{ accounts: Array<QuotaResponse & { accountId?: string; email?: string }> } | null> {
    const quota = await this.quotaService.getQuota(this.currentPort, await this.getProxyKey());
    if (!quota) { return null; }
    return quota;
  }

  async getCodexUsage(): Promise<Partial<QuotaResponse>> {
    const res = await this.quotaService.getCodexUsage();
    return { accounts: res.accounts } as Partial<QuotaResponse>;
  }

  async getAntigravityAvailableModels(): Promise<ModelQuotaItem[]> {
    return this.quotaService.getAntigravityAvailableModels();
  }

  async getLegacyQuota(): Promise<{ success: boolean; authExpired?: boolean; data?: JsonObject } & Partial<QuotaResponse>> {
    return this.quotaService.getLegacyQuota();
  }

  async getCopilotQuota(): Promise<{ accounts: Array<CopilotQuota & { accountId?: string; email?: string }> }> {
    return this.quotaService.getCopilotQuota();
  }

  async getClaudeQuota(): Promise<{ accounts: Array<ClaudeQuota> }> {
    return this.quotaService.getClaudeQuota();
  }

  async getModels(): Promise<ProxyModelResponse> {
    const apiKey = await this.getProxyKey();
    const proxyData = await this.getProxyModels(apiKey);

    const [codexData, copilotDataRaw, claudeDataRaw] = await Promise.all([
      this.quotaService.fetchCodexUsage(),
      this.getCopilotQuota(),
      this.getClaudeQuota()
    ]);

    // Use the first account's quota for normalization (legacy behavior)
    const copilotData = copilotDataRaw.accounts[0] ? { success: true, ...copilotDataRaw.accounts[0] } : null;
    const claudeData = claudeDataRaw.accounts[0] ?? null;

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
      const res = await this.makeRequest('/v1/models', apiKey);
      if ('data' in res && Array.isArray(res.data)) {
        return res.data as ModelItem[];
      }
    } catch (error) {
      this.logWarn(`getProxyModels: Primary proxy fetch failed. ${getErrorMessage(error)}`);
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

  private determineCodexFraction(usage: { dailyUsedPercent?: number; weeklyUsedPercent?: number }, remaining: number, limit: number): number {
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
        merged.push({ ...m, id: `${m.id}-antigravity`, name: `${m.name} (Antigravity)`, provider: 'antigravity' });
      } else {
        merged.push(m);
      }
    }
    return merged;
  }

  private enrichModelWithQuota(m: ModelItem, quotas: { codexQuotaFn?: QuotaInfo, copilotQuotaFn?: QuotaInfo, claudeQuotaFn?: QuotaInfo }): ModelItem {
    const provider = m.provider.toLowerCase();
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
      const dir = this.getAuthWorkDir();
      let fileName: string;

      if (nameOrPrefix.endsWith('.json')) {
        fileName = nameOrPrefix;
      } else {
        const files = (await fs.promises.readdir(dir)).filter(f => f.startsWith(nameOrPrefix + '-') && f.endsWith('.json'));
        fileName = files.length > 0 ? files[0] : `${nameOrPrefix}.json`;
      }

      const filePath = path.join(dir, fileName);
      const contentString = JSON.stringify(data, null, 2);
      const encrypted = this.securityService.encryptSync(contentString);
      const persistedData = JSON.stringify({ encryptedPayload: encrypted, version: 1 });
      await fs.promises.writeFile(filePath, persistedData);

    } catch (e) {
      this.logError(`Failed to update auth file ${nameOrPrefix}:`, e as Error);
    }
  }

  getAuthWorkDir(): string {
    return this.dataService.getPath('auth');
  }

  private async cleanupAuthDirectory() {
    try {
      const dir = this.getAuthWorkDir();
      const exists = await fs.promises.access(dir).then(() => true).catch(() => false);
      if (!exists) { return; }

      const files = await fs.promises.readdir(dir);
      const jsonFiles = files.filter(f => f.endsWith('.json') || f.endsWith('.json.enc'));

      if (jsonFiles.length > 0) {
        this.logInfo(`Cleaning up ${jsonFiles.length} legacy auth files...`);
        for (const file of jsonFiles) {
          await fs.promises.unlink(path.join(dir, file)).catch(() => { });
        }
      }
    } catch (e) {
      this.logError('Failed to cleanup auth directory:', e as Error);
    }
  }

  private makeRequest(path: string, apiKey?: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<ProxyRequestResponse> {
    return new Promise((resolve, reject) => {
      const options = {
        method,
        protocol: 'http:' as const,
        hostname: '127.0.0.1',
        port: this.currentPort,
        path
      };

      const request = net.request(options);
      const token = apiKey ?? this.settingsService.getSettings().proxy?.key;
      if (token) {
        request.setHeader('Authorization', `Bearer ${token}`);
      }
      if (body) {
        request.setHeader('Content-Type', 'application/json');
      }

      request.on('response', (res) => {
        let d = '';
        res.on('data', chunk => d += chunk);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            resolve({ success: false, error: `HTTP ${res.statusCode}`, raw: d });
            return;
          }
          const parsed = safeJsonParse<JsonValue>(d, null);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            resolve(parsed as JsonObject);
          } else {
            resolve({ success: false, error: 'Invalid JSON', raw: d });
          }
        });
      });

      request.on('error', err => reject(err));
      if (body) {
        request.write(JSON.stringify(body));
      }
      request.end();
    });
  }

  private async ensureProxyKey(): Promise<string> {
    const settings = this.settingsService.getSettings();
    let key = settings.proxy?.key.trim() ?? '';
    if (!key || key.length > 72) {
      key = crypto.randomBytes(32).toString('base64');
      const currentProxy = settings.proxy ?? { enabled: false, url: 'http://localhost:8317/v1' };
      await this.settingsService.saveSettings({ proxy: { ...currentProxy, key } });
    }
    return key;
  }

  async getProxyKey(): Promise<string> { return await this.ensureProxyKey(); }

  private async ensureAuthStoreKey(): Promise<string> {
    const settings = this.settingsService.getSettings();
    let key = settings.proxy?.authStoreKey?.trim() ?? '';
    if (!key || key.length > 72) {
      key = crypto.randomBytes(32).toString('base64');
      const currentProxy = settings.proxy ?? { enabled: false, url: 'http://localhost:8317/v1', key: '' };
      await this.settingsService.saveSettings({ proxy: { ...currentProxy, authStoreKey: key } });
    }
    return key;
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
      return safeJsonParse<JsonValue>(decrypted, null);
    }
    return safeJsonParse<JsonValue>(content, null);
  }

  private async fetchAntigravityProjectID(accessToken: string): Promise<string | undefined> {
    return new Promise((resolve) => {
      const body = JSON.stringify({
        metadata: {
          ideType: 'IDE_UNSPECIFIED',
          platform: 'PLATFORM_UNSPECIFIED',
          pluginType: 'GEMINI'
        }
      });

      const request = net.request({
        method: 'POST',
        url: 'https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist'
      });

      request.setHeader('Authorization', `Bearer ${accessToken}`);
      request.setHeader('Content-Type', 'application/json');
      request.setHeader('User-Agent', 'google-api-nodejs-client/9.15.1');
      request.setHeader('X-Goog-Api-Client', 'google-cloud-sdk vscode_cloudshelleditor/0.1');
      request.setHeader('Client-Metadata', '{"ideType":"IDE_UNSPECIFIED","platform":"PLATFORM_UNSPECIFIED","pluginType":"GEMINI"}');

      request.on('response', (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          if (response.statusCode >= 400) {
            resolve(undefined);
            return;
          }
          const json = safeJsonParse<{ cloudaicompanionProject?: { id?: string } | string }>(data, {});
          const project = json.cloudaicompanionProject;
          const projectID = typeof project === 'object' ? project.id : project;
          resolve(typeof projectID === 'string' ? projectID.trim() : undefined);
        });
      });

      request.on('error', () => resolve(undefined));
      request.write(body);
      request.end();
    });
  }

  async fetchGitHubProfile(accessToken: string): Promise<{ email?: string; displayName?: string; avatarUrl?: string; login?: string }> {
    appLogger.info('ProxyService', 'Fetching GitHub user profile...');
    return new Promise((resolve) => {
      const request = net.request({
        method: 'GET',
        url: 'https://api.github.com/user'
      });

      request.setHeader('Authorization', `Bearer ${accessToken}`);
      request.setHeader('Accept', 'application/vnd.github+json');
      request.setHeader('User-Agent', 'Orbit-App/1.0.0');

      request.on('response', (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          appLogger.debug('ProxyService', `GitHub /user response status: ${response.statusCode}`);
          if (response.statusCode >= 400) {
            appLogger.error('ProxyService', `GitHub profile fetch failed: ${response.statusCode} - ${data}`);
            resolve({});
            return;
          }
          const json = safeJsonParse<{ email?: string; name?: string; login?: string; avatar_url?: string }>(data, {});
          appLogger.debug('ProxyService', `GitHub profile data: ${JSON.stringify({ ...json, email: json.email ? '[PRESENT]' : '[MISSING]' })}`);

          resolve({
            email: json.email ?? undefined,
            displayName: json.name ?? json.login ?? undefined,
            avatarUrl: json.avatar_url ?? undefined,
            login: json.login ?? undefined
          });
        });
      });

      request.on('error', (err) => {
        appLogger.error('ProxyService', 'GitHub profile fetch network error', err);
        resolve({});
      });
      request.end();
    });
  }

  async fetchGitHubEmails(accessToken: string): Promise<string | undefined> {
    appLogger.info('ProxyService', 'Fetching GitHub user emails...');
    return new Promise((resolve) => {
      const request = net.request({
        method: 'GET',
        url: 'https://api.github.com/user/emails'
      });

      request.setHeader('Authorization', `Bearer ${accessToken}`);
      request.setHeader('Accept', 'application/vnd.github+json');
      request.setHeader('User-Agent', 'Orbit-App/1.0.0');

      request.on('response', (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          appLogger.debug('ProxyService', `GitHub /user/emails response status: ${response.statusCode}`);
          if (response.statusCode >= 400) {
            appLogger.error('ProxyService', `GitHub emails fetch failed: ${response.statusCode} - ${data}`);
            resolve(undefined);
            return;
          }
          const emails = safeJsonParse<Array<{ email: string; primary: boolean; verified: boolean }>>(data, []);
          appLogger.debug('ProxyService', `GitHub emails count: ${emails.length}`);
          const primary = emails.find(e => e.primary && e.verified) ?? emails.find(e => e.primary) ?? emails[0];
          resolve(primary?.email);
        });
      });

      request.on('error', (err) => {
        appLogger.error('ProxyService', 'GitHub emails fetch network error', err);
        resolve(undefined);
      });
      request.end();
    });
  }
}
