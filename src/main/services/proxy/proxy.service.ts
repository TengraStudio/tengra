import crypto from 'crypto';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import { ProxyEmbedStatus, ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
import { validateInterval, validatePort, validateProvider, validateToken } from '@main/services/proxy/proxy-validation.util';
import { QuotaService } from '@main/services/proxy/quota.service';
import { AuthService } from '@main/services/security/auth.service';
import { SecurityService } from '@main/services/security/security.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { SettingsService } from '@main/services/system/settings.service';
import { LocalAuthServer } from '@main/utils/local-auth-server.util';
import { JsonObject, JsonValue } from '@shared/types/common';
import { ClaudeQuota, CodexUsage, CopilotQuota, ModelQuotaItem, QuotaInfo, QuotaResponse } from '@shared/types/quota';
import { AuthenticationError } from '@shared/utils/error.util';
import { AppErrorCode, getErrorMessage, ProxyServiceError } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { net } from 'electron';

/**
 * Check if file/directory exists using async fs.access
 */



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
  rateLimit?: {
    provider: string;
    limit: number;
    remaining: number;
    resetAt: number;
    queued: number;
  };
}

/**
 * Standardized error codes for ProxyService.
 * Maps to AppErrorCode values for consistency with the global error system.
 */
export const ProxyErrorCode = {
  NOT_INITIALIZED: AppErrorCode.PROXY_NOT_INITIALIZED,
  START_FAILED: AppErrorCode.PROXY_START_FAILED,
  STOP_FAILED: AppErrorCode.PROXY_STOP_FAILED,
  AUTH_FAILED: AppErrorCode.PROXY_AUTH_FAILED,
  REQUEST_FAILED: AppErrorCode.PROXY_REQUEST_FAILED,
  INVALID_CONFIG: AppErrorCode.PROXY_INVALID_CONFIG,
  CONNECTION_FAILED: AppErrorCode.PROXY_CONNECTION_FAILED,
  TIMEOUT: AppErrorCode.PROXY_TIMEOUT,
  PORT_IN_USE: AppErrorCode.PROXY_PORT_IN_USE,
  BINARY_NOT_FOUND: AppErrorCode.PROXY_BINARY_NOT_FOUND
} as const;

/**
 * Telemetry events emitted by ProxyService
 */
export enum ProxyTelemetryEvent {
  PROXY_STARTED = 'proxy_started',
  PROXY_STOPPED = 'proxy_stopped',
  REQUEST_SENT = 'proxy_request_sent',
  REQUEST_FAILED = 'proxy_request_failed',
  AUTH_INITIATED = 'proxy_auth_initiated',
  AUTH_COMPLETED = 'proxy_auth_completed',
  AUTH_FAILED = 'proxy_auth_failed',
  HEALTH_CHECK = 'proxy_health_check'
}

/**
 * Performance budgets in milliseconds for ProxyService operations
 */
export const PROXY_PERFORMANCE_BUDGETS = {
  START_MS: 10000,
  STOP_MS: 5000,
  REQUEST_MS: 30000,
  AUTH_MS: 30000,
  HEALTH_CHECK_MS: 5000,
  INITIALIZE_MS: 10000,
  CONFIG_GENERATION_MS: 2000,
  GET_MODELS_MS: 15000
} as const;

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

interface ProviderRateLimitConfig {
  windowMs: number;
  maxRequests: number;
  warningThreshold: number; // 0..1
  maxQueueSize: number;
  allowPremiumBypass: boolean;
}

interface ProviderRateLimitSnapshot {
  provider: string;
  limit: number;
  remaining: number;
  resetAt: number;
  queued: number;
  blocked: number;
  allowed: number;
  bypassed: number;
  warnings: number;
}

interface QueuedRateLimitRequest {
  id: string;
  priority: number;
  enqueuedAt: number;
  resolve: () => void;
  reject: (error: Error) => void;
}

interface RateLimitAcquireOptions {
  priority?: number;
  isPremiumBypass?: boolean;
}

export class ProxyService extends BaseService {
  private currentPort: number = 8317;
  private providerRateConfigs = new Map<string, ProviderRateLimitConfig>();
  private providerWindows = new Map<string, number[]>();
  private providerQueues = new Map<string, QueuedRateLimitRequest[]>();
  private providerQueueTimers = new Map<string, NodeJS.Timeout>();
  private providerStats = new Map<string, { blocked: number; allowed: number; bypassed: number; warnings: number }>();

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
    const start = performance.now();
    await super.initialize();

    // Listen for token refreshes (no longer syncs files, but logs it)
    this.eventBus.on('token:refreshed', (payload) => {
      this.logInfo(`Token refreshed for ${payload.provider}, available via Auth API`);
    });

    await this.ensureAuthStoreKey();
    await this.ensureProxyKey();
    this.initializeProviderRateLimits();

    const elapsed = performance.now() - start;
    if (elapsed > PROXY_PERFORMANCE_BUDGETS.INITIALIZE_MS) {
      this.logWarn(`initialize exceeded budget: ${elapsed.toFixed(1)}ms > ${PROXY_PERFORMANCE_BUDGETS.INITIALIZE_MS}ms`);
    }
  }

  override async cleanup(): Promise<void> {
    try {
      this.clearProviderQueueTimers();
      // Force stop proxy on app exit - kill all proxy processes including orphaned ones
      await this.processManager.stop(true);
      this.logInfo('Proxy service stopped (force killed all proxy processes)');
    } catch (e) {
      this.logError('Failed to stop proxy during cleanup:', e as Error);
    }
  }

  private initializeProviderRateLimits(): void {
    const defaults: Record<string, ProviderRateLimitConfig> = {
      github: { windowMs: 60_000, maxRequests: 60, warningThreshold: 0.85, maxQueueSize: 100, allowPremiumBypass: false },
      codex: { windowMs: 60_000, maxRequests: 80, warningThreshold: 0.85, maxQueueSize: 120, allowPremiumBypass: true },
      claude: { windowMs: 60_000, maxRequests: 70, warningThreshold: 0.85, maxQueueSize: 100, allowPremiumBypass: true },
      antigravity: { windowMs: 60_000, maxRequests: 80, warningThreshold: 0.85, maxQueueSize: 120, allowPremiumBypass: true },
      proxy: { windowMs: 60_000, maxRequests: 120, warningThreshold: 0.9, maxQueueSize: 200, allowPremiumBypass: true },
      default: { windowMs: 60_000, maxRequests: 60, warningThreshold: 0.85, maxQueueSize: 100, allowPremiumBypass: false }
    };

    for (const [provider, cfg] of Object.entries(defaults)) {
      this.providerRateConfigs.set(provider, cfg);
    }
  }

  private clearProviderQueueTimers(): void {
    for (const timer of this.providerQueueTimers.values()) {
      clearTimeout(timer);
    }
    this.providerQueueTimers.clear();
  }

  private getProviderConfig(provider: string): ProviderRateLimitConfig {
    if (this.providerRateConfigs.size === 0) {
      this.initializeProviderRateLimits();
    }
    const config = this.providerRateConfigs.get(provider) ?? this.providerRateConfigs.get('default');
    if (!config) {
      throw new Error('Default provider rate limit config not found');
    }
    return config;
  }

  private getProviderWindow(provider: string): number[] {
    if (!this.providerWindows.has(provider)) {
      this.providerWindows.set(provider, []);
    }
    const window = this.providerWindows.get(provider);
    if (!window) {
      throw new Error(`Provider window not found for ${provider}`);
    }
    return window;
  }

  private getProviderQueue(provider: string): QueuedRateLimitRequest[] {
    if (!this.providerQueues.has(provider)) {
      this.providerQueues.set(provider, []);
    }
    const queue = this.providerQueues.get(provider);
    if (!queue) {
      throw new Error(`Provider queue not found for ${provider}`);
    }
    return queue;
  }

  private getProviderStats(provider: string) {
    const existing = this.providerStats.get(provider);
    if (existing) { return existing; }
    const init = { blocked: 0, allowed: 0, bypassed: 0, warnings: 0 };
    this.providerStats.set(provider, init);
    return init;
  }

  private normalizeProviderForRateLimit(provider: string): string {
    const p = provider.trim().toLowerCase();
    if (!p) { return 'default'; }
    if (p.includes('github') || p.includes('copilot')) { return 'github'; }
    if (p.includes('anthropic') || p.includes('claude')) { return 'claude'; }
    if (p.includes('antigravity') || p.includes('google') || p.includes('gemini')) { return 'antigravity'; }
    if (p.includes('codex') || p.includes('openai')) { return 'codex'; }
    if (p.includes('proxy')) { return 'proxy'; }
    return p;
  }

  private compactWindow(provider: string, now = Date.now()): number[] {
    const cfg = this.getProviderConfig(provider);
    const windowStart = now - cfg.windowMs;
    const timestamps = this.getProviderWindow(provider);
    while (timestamps.length > 0 && timestamps[0] < windowStart) {
      timestamps.shift();
    }
    return timestamps;
  }

  private calculateResetAt(provider: string, now = Date.now()): number {
    const cfg = this.getProviderConfig(provider);
    const timestamps = this.compactWindow(provider, now);
    if (timestamps.length < cfg.maxRequests) {
      return now;
    }
    const oldest = timestamps[0] ?? now;
    return oldest + cfg.windowMs;
  }

  private buildSnapshot(provider: string): ProviderRateLimitSnapshot {
    const normalized = this.normalizeProviderForRateLimit(provider);
    const cfg = this.getProviderConfig(normalized);
    const now = Date.now();
    const timestamps = this.compactWindow(normalized, now);
    const remaining = Math.max(0, cfg.maxRequests - timestamps.length);
    const stats = this.getProviderStats(normalized);
    const queued = this.getProviderQueue(normalized).length;
    return {
      provider: normalized,
      limit: cfg.maxRequests,
      remaining,
      resetAt: this.calculateResetAt(normalized, now),
      queued,
      blocked: stats.blocked,
      allowed: stats.allowed,
      bypassed: stats.bypassed,
      warnings: stats.warnings
    };
  }

  private emitRateLimitWarning(provider: string, snapshot: ProviderRateLimitSnapshot): void {
    this.getProviderStats(provider).warnings += 1;
    this.eventBus.emitCustom('proxy:rate-limit-warning', {
      provider,
      limit: snapshot.limit,
      remaining: snapshot.remaining,
      queued: snapshot.queued,
      resetAt: snapshot.resetAt,
      timestamp: Date.now()
    });
  }

  private scheduleQueueDrain(provider: string): void {
    const existing = this.providerQueueTimers.get(provider);
    if (existing) {
      clearTimeout(existing);
    }

    const now = Date.now();
    const delay = Math.max(10, this.calculateResetAt(provider, now) - now);
    const timer = setTimeout(() => {
      this.providerQueueTimers.delete(provider);
      this.drainProviderQueue(provider);
    }, delay);

    this.providerQueueTimers.set(provider, timer);
  }

  private drainProviderQueue(provider: string): void {
    const normalized = this.normalizeProviderForRateLimit(provider);
    const cfg = this.getProviderConfig(normalized);
    const queue = this.getProviderQueue(normalized);
    const timestamps = this.compactWindow(normalized);

    queue.sort((a, b) => {
      if (a.priority === b.priority) {
        return a.enqueuedAt - b.enqueuedAt;
      }
      return b.priority - a.priority;
    });

    while (queue.length > 0 && timestamps.length < cfg.maxRequests) {
      const next = queue.shift();
      if (!next) { break; }
      timestamps.push(Date.now());
      this.getProviderStats(normalized).allowed += 1;
      next.resolve();
    }

    if (queue.length > 0) {
      this.scheduleQueueDrain(normalized);
    }
  }

  private async waitForRateLimit(providerRaw: string, options: RateLimitAcquireOptions = {}): Promise<ProviderRateLimitSnapshot> {
    const provider = this.normalizeProviderForRateLimit(providerRaw);
    const cfg = this.getProviderConfig(provider);
    const isPremiumBypass = options.isPremiumBypass === true;

    if (isPremiumBypass && cfg.allowPremiumBypass) {
      this.getProviderStats(provider).bypassed += 1;
      return this.buildSnapshot(provider);
    }

    const timestamps = this.compactWindow(provider);
    if (timestamps.length < cfg.maxRequests) {
      timestamps.push(Date.now());
      this.getProviderStats(provider).allowed += 1;
      const snapshot = this.buildSnapshot(provider);
      const usedRatio = snapshot.limit > 0 ? (snapshot.limit - snapshot.remaining) / snapshot.limit : 0;
      if (usedRatio >= cfg.warningThreshold) {
        this.emitRateLimitWarning(provider, snapshot);
      }
      return snapshot;
    }

    this.getProviderStats(provider).blocked += 1;
    const queue = this.getProviderQueue(provider);
    if (queue.length >= cfg.maxQueueSize) {
      throw new Error(`Rate limit queue full for provider ${provider}`);
    }

    await new Promise<void>((resolve, reject) => {
      const request: QueuedRateLimitRequest = {
        id: `${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        priority: options.priority ?? 0,
        enqueuedAt: Date.now(),
        resolve,
        reject
      };
      queue.push(request);
      this.scheduleQueueDrain(provider);
    });

    return this.buildSnapshot(provider);
  }

  getProviderRateLimitMetrics(): {
    generatedAt: number;
    providers: ProviderRateLimitSnapshot[];
  } {
    const providers = Array.from(this.providerRateConfigs.keys())
      .map((provider) => this.buildSnapshot(provider))
      .sort((a, b) => a.provider.localeCompare(b.provider));

    return {
      generatedAt: Date.now(),
      providers
    };
  }

  getProviderRateLimitConfig(): Record<string, ProviderRateLimitConfig> {
    const output: Record<string, ProviderRateLimitConfig> = {};
    for (const [provider, config] of this.providerRateConfigs.entries()) {
      output[provider] = { ...config };
    }
    return output;
  }

  setProviderRateLimitConfig(providerRaw: string, config: Partial<ProviderRateLimitConfig>): ProviderRateLimitConfig {
    const providerError = validateProvider(providerRaw);
    if (providerError) {
      throw new Error(`setProviderRateLimitConfig: ${providerError}`);
    }

    const provider = this.normalizeProviderForRateLimit(providerRaw);
    const current = this.getProviderConfig(provider);
    const merged: ProviderRateLimitConfig = {
      windowMs: Math.max(1_000, config.windowMs ?? current.windowMs),
      maxRequests: Math.max(1, config.maxRequests ?? current.maxRequests),
      warningThreshold: Math.min(0.99, Math.max(0.1, config.warningThreshold ?? current.warningThreshold)),
      maxQueueSize: Math.max(1, config.maxQueueSize ?? current.maxQueueSize),
      allowPremiumBypass: config.allowPremiumBypass ?? current.allowPremiumBypass
    };
    this.providerRateConfigs.set(provider, merged);
    return merged;
  }




  async initiateGitHubAuth(appId: 'profile' | 'copilot' = 'profile'): Promise<DeviceCodeResponse> {
    this.eventBus.emitCustom(ProxyTelemetryEvent.AUTH_INITIATED, { provider: 'github', appId });
    await this.waitForRateLimit('github', { priority: 2 });
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
          this.eventBus.emitCustom(ProxyTelemetryEvent.AUTH_COMPLETED, { provider: 'github', appId });
          resolve(result);
        });
      });
      request.on('error', (err) => {
        this.eventBus.emitCustom(ProxyTelemetryEvent.AUTH_FAILED, { provider: 'github', appId, error: err.message });
        reject(err);
      });
      request.end();
    });
  }

  async waitForGitHubToken(deviceCode: string, interval: number, appId: 'profile' | 'copilot' = 'profile'): Promise<TokenResponse> {
    const codeError = validateToken(deviceCode, 'Device code');
    if (codeError) {
      throw new Error(`waitForGitHubToken: ${codeError}`);
    }
    const intervalError = validateInterval(interval);
    if (intervalError) {
      throw new Error(`waitForGitHubToken: ${intervalError}`);
    }

    await this.waitForRateLimit('github', { priority: 3 });
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
          try {
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

          } catch (err) {
            this.logError('Antigravity login failed', err as Error);
          }
        })();
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


        this.logInfo('Claude OAuth login successful');
      },
      (err) => {
        this.logError('Claude Auth failed:', err as Error);
      }
    );
  }

  async getCodexAuthUrl(): Promise<ProxyRequestResponse> {
    const response = await this.makeRequest(
      '/v0/management/codex-auth-url?is_webui=true',
      await this.getProxyKey(),
      'GET',
      undefined,
      { provider: 'codex', priority: 5 }
    );
    this.logDebug('getCodexAuthUrl response:', response);
    return response;
  }



  async startEmbeddedProxy(options?: { port?: number }): Promise<ProxyEmbedStatus> {
    const start = performance.now();
    if (options?.port !== undefined) {
      const portError = validatePort(options.port);
      if (portError) {
        this.logError(`startEmbeddedProxy: ${portError}`);
        return { running: false, error: portError, errorCode: AppErrorCode.PROXY_INVALID_CONFIG };
      }
    }
    this.currentPort = options?.port ?? 8317;
    const status = await this.processManager.start(options);
    if (!status.running && status.error) {
      this.logError(`Proxy startup failed: [${status.errorCode ?? AppErrorCode.PROXY_START_FAILED}] ${status.error}`);
      return { ...status, errorCode: status.errorCode ?? AppErrorCode.PROXY_START_FAILED };
    }
    const elapsed = performance.now() - start;
    if (elapsed > PROXY_PERFORMANCE_BUDGETS.START_MS) {
      this.logWarn(`startEmbeddedProxy exceeded budget: ${elapsed.toFixed(1)}ms > ${PROXY_PERFORMANCE_BUDGETS.START_MS}ms`);
    }
    this.eventBus.emitCustom(ProxyTelemetryEvent.PROXY_STARTED, { port: this.currentPort, elapsedMs: elapsed });
    return status;
  }

  async stopEmbeddedProxy(): Promise<void> {
    const start = performance.now();
    try {
      await this.processManager.stop();
    } catch (e) {
      throw new ProxyServiceError(
        `Failed to stop proxy: ${getErrorMessage(e)}`,
        AppErrorCode.PROXY_STOP_FAILED,
        true
      );
    }
    const elapsed = performance.now() - start;
    if (elapsed > PROXY_PERFORMANCE_BUDGETS.STOP_MS) {
      this.logWarn(`stopEmbeddedProxy exceeded budget: ${elapsed.toFixed(1)}ms > ${PROXY_PERFORMANCE_BUDGETS.STOP_MS}ms`);
    }
    this.eventBus.emitCustom(ProxyTelemetryEvent.PROXY_STOPPED, { elapsedMs: elapsed });
  }

  getEmbeddedProxyStatus(): ProxyEmbedStatus {
    const status = this.processManager.getStatus();
    if (status.running && status.port) { this.currentPort = status.port; }
    this.eventBus.emitCustom(ProxyTelemetryEvent.HEALTH_CHECK, { running: status.running, port: status.port });
    return status;
  }

  async generateConfig(port?: number): Promise<void> {
    const start = performance.now();
    const effectivePort = port ?? this.currentPort;
    const portError = validatePort(effectivePort);
    if (portError) {
      throw new ProxyServiceError(
        `generateConfig: ${portError}`,
        AppErrorCode.PROXY_INVALID_CONFIG,
        false,
        { port: effectivePort }
      );
    }
    await this.processManager.generateConfig(effectivePort);
    const elapsed = performance.now() - start;
    if (elapsed > PROXY_PERFORMANCE_BUDGETS.CONFIG_GENERATION_MS) {
      this.logWarn(`generateConfig exceeded budget: ${elapsed.toFixed(1)}ms > ${PROXY_PERFORMANCE_BUDGETS.CONFIG_GENERATION_MS}ms`);
    }
  }

  async getQuota(): Promise<{ accounts: Array<QuotaResponse & { accountId?: string; email?: string }> } | null> {
    const quota = await this.quotaService.getQuota(this.currentPort, await this.getProxyKey());
    if (!quota) { return null; }
    return quota;
  }

  async getCodexUsage(): Promise<{ accounts: Array<{ usage: CodexUsage | { error: string }; accountId?: string; email?: string }> }> {
    return this.quotaService.getCodexUsage();
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
    const start = performance.now();
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
        antigravityError = 'Session expired. Please log in again.';
      }
    }

    const merged = this.mergeModels(proxyData, extra);
    const finalData = merged.map((m: ModelItem) => this.enrichModelWithQuota(m, quotas));

    const elapsed = performance.now() - start;
    if (elapsed > PROXY_PERFORMANCE_BUDGETS.GET_MODELS_MS) {
      this.logWarn(`getModels exceeded budget: ${elapsed.toFixed(1)}ms > ${PROXY_PERFORMANCE_BUDGETS.GET_MODELS_MS}ms`);
    }

    return { data: finalData, antigravityError };
  }

  private async getProxyModels(apiKey: string): Promise<ModelItem[]> {
    try {
      this.logInfo(`getProxyModels: Fetching from http://127.0.0.1:${this.currentPort}/v1/models`);
      const res = await this.makeRequest('/v1/models', apiKey, 'GET', undefined, { provider: 'proxy', priority: 1 });
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




  private makeRequest(
    path: string,
    apiKey?: string,
    method: 'GET' | 'POST' = 'GET',
    body?: unknown,
    rateLimit?: { provider: string; priority?: number; isPremiumBypass?: boolean }
  ): Promise<ProxyRequestResponse> {
    const requestStart = performance.now();
    return new Promise((resolve, reject) => {
      const run = async () => {
        const snapshot = rateLimit
          ? await this.waitForRateLimit(rateLimit.provider, {
            priority: rateLimit.priority,
            isPremiumBypass: rateLimit.isPremiumBypass
          })
          : undefined;

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

        if (snapshot) {
          request.setHeader('X-Proxy-RateLimit-Limit', String(snapshot.limit));
          request.setHeader('X-Proxy-RateLimit-Remaining', String(snapshot.remaining));
          request.setHeader('X-Proxy-RateLimit-Reset', String(snapshot.resetAt));
          request.setHeader('X-Proxy-RateLimit-Provider', snapshot.provider);
        }

        request.on('response', (res) => {
          let d = '';
          res.on('data', chunk => d += chunk);
          res.on('end', () => {
            const requestElapsed = performance.now() - requestStart;
            if (requestElapsed > PROXY_PERFORMANCE_BUDGETS.REQUEST_MS) {
              appLogger.warn('ProxyService', `makeRequest exceeded budget: ${requestElapsed.toFixed(1)}ms > ${PROXY_PERFORMANCE_BUDGETS.REQUEST_MS}ms (${method} ${path})`);
            }
            this.eventBus.emitCustom(ProxyTelemetryEvent.REQUEST_SENT, { method, path, elapsedMs: requestElapsed, statusCode: res.statusCode });
            const rateLimitInfo = snapshot ? {
              provider: snapshot.provider,
              limit: snapshot.limit,
              remaining: snapshot.remaining,
              resetAt: snapshot.resetAt,
              queued: snapshot.queued
            } : undefined;

            if (res.statusCode && res.statusCode >= 400) {
              resolve({ success: false, error: `HTTP ${res.statusCode}`, raw: d, rateLimit: rateLimitInfo });
              return;
            }
            const parsed = safeJsonParse<JsonValue>(d, null);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              const obj = parsed as JsonObject;
              if (rateLimitInfo) {
                obj.rateLimit = rateLimitInfo;
              }
              resolve(obj);
            } else {
              resolve({ success: false, error: 'Invalid JSON', raw: d, rateLimit: rateLimitInfo });
            }
          });
        });

        request.on('error', err => {
          this.eventBus.emitCustom(ProxyTelemetryEvent.REQUEST_FAILED, { method, path, error: err.message });
          const isConnectionError = 'code' in err && (
            (err as NodeJS.ErrnoException).code === 'ECONNREFUSED' ||
            (err as NodeJS.ErrnoException).code === 'ECONNRESET'
          );
          const code = isConnectionError
            ? AppErrorCode.PROXY_CONNECTION_FAILED
            : AppErrorCode.PROXY_REQUEST_FAILED;
          reject(new ProxyServiceError(
            err.message,
            code,
            isConnectionError,
            { path, method }
          ));
        });
        if (body) {
          request.write(JSON.stringify(body));
        }
        request.end();
      };

      void run().catch(reject);
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



  private async fetchAntigravityProjectID(accessToken: string): Promise<string | undefined> {
    await this.waitForRateLimit('antigravity', { priority: 2, isPremiumBypass: true });
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
    const tokenError = validateToken(accessToken, 'Access token');
    if (tokenError) {
      this.logError(`fetchGitHubProfile: ${tokenError}`);
      return {};
    }

    await this.waitForRateLimit('github', { priority: 2 });
    appLogger.info('ProxyService', 'Fetching GitHub user profile...');
    return new Promise((resolve) => {
      const request = net.request({
        method: 'GET',
        url: 'https://api.github.com/user'
      });

      request.setHeader('Authorization', `Bearer ${accessToken}`);
      request.setHeader('Accept', 'application/vnd.github+json');
      request.setHeader('User-Agent', 'Tengra-App/1.0.0');

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
    const tokenError = validateToken(accessToken, 'Access token');
    if (tokenError) {
      this.logError(`fetchGitHubEmails: ${tokenError}`);
      return undefined;
    }

    await this.waitForRateLimit('github', { priority: 2 });
    appLogger.info('ProxyService', 'Fetching GitHub user emails...');
    return new Promise((resolve) => {
      const request = net.request({
        method: 'GET',
        url: 'https://api.github.com/user/emails'
      });

      request.setHeader('Authorization', `Bearer ${accessToken}`);
      request.setHeader('Accept', 'application/vnd.github+json');
      request.setHeader('User-Agent', 'Tengra-App/1.0.0');

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
          resolve(primary.email);
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


