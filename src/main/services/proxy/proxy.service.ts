import crypto from 'crypto';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import { DatabaseService } from '@main/services/data/database.service';
import { ProxyEmbedStatus, ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
import { validateInterval, validateOAuthTimeoutMs, validatePort, validateProvider, validateToken } from '@main/services/proxy/proxy-validation.util';
import { QuotaService } from '@main/services/proxy/quota.service';
import { AuthService } from '@main/services/security/auth.service';
import { SecurityService } from '@main/services/security/security.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { SettingsService } from '@main/services/system/settings.service';
import { JsonObject, JsonValue } from '@shared/types/common';
import { ClaudeQuota, CodexUsage, CopilotQuota, ModelQuotaItem, QuotaInfo, QuotaResponse } from '@shared/types/quota';
import {
  ProxyMarketplaceSkillInstallInput,
  ProxySkill,
  ProxySkillItemResponse,
  ProxySkillListResponse,
  ProxySkillToggleInput,
  ProxySkillUpsertInput,
} from '@shared/types/skill';
import { AppErrorCode, getErrorMessage, ProxyServiceError, ValidationError } from '@shared/utils/error.util';
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

export type ProxyRequestResponse<T = JsonObject> = T | {
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
const PROXY_REQUEST_TIMEOUT_MS = 15_000;

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
  expires_at?: number;
  session_token?: string;
  copilot_plan?: string;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
}

type BrowserAuthProvider = 'antigravity' | 'claude' | 'codex' | 'ollama';
type OAuthTimeoutProvider = BrowserAuthProvider | 'default';

interface OAuthTimeoutConfig {
  default?: number;
  codex?: number;
  claude?: number;
  antigravity?: number;
  ollama?: number;
}

interface ProxyRequestExecutionOptions {
  timeoutMs: number;
  apiKey?: string;
  method?: 'GET' | 'POST' | 'DELETE';
  body?: RuntimeValue;
  rateLimit?: { provider: string; priority?: number; isPremiumBypass?: boolean };
}

interface BrowserAuthUrlResponse {
  url: string;
  state: string;
  accountId: string;
  account_id?: string;
}

interface BrowserAuthStatusResponse {
  status: string;
  error?: string;
  state?: string;
  provider?: string;
  accountId?: string;
  account_id?: string;
  account?: JsonValue;
}

interface BrowserAuthVerifyResponse {
  status: string;
  provider: string;
  readiness?: JsonValue;
  callback?: JsonValue;
  error?: string;
}

interface ProxyMarketplaceSkill {
  id: string;
  name: string;
  description: string;
  provider: string;
  content: string;
  version: string;
  enabled_by_default: boolean;
}


export interface ProxyServiceOptions {
  settingsService: SettingsService;
  dataService: DataService;
  securityService: SecurityService;
  processManager: ProxyProcessManager;
  quotaService: QuotaService;
  authService: AuthService;
  eventBus: EventBusService;
  databaseService: DatabaseService;
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
  private operationLock: Promise<void> = Promise.resolve();

  constructor(private options: ProxyServiceOptions) {
    super('ProxyService');
  }

  private getOAuthTimeoutMs(provider: OAuthTimeoutProvider): number {
    const settings = this.settingsService.getSettings();
    const config = settings.proxy?.oauthTimeoutMs as OAuthTimeoutConfig | undefined;
    const providerTimeout = provider === 'default' ? undefined : config?.[provider];
    const fallback = config?.default ?? PROXY_PERFORMANCE_BUDGETS.AUTH_MS;
    const resolved = providerTimeout ?? fallback;
    const validationError = validateOAuthTimeoutMs(resolved);
    if (validationError) {
      throw new ValidationError(`Invalid OAuth timeout for ${provider}: ${validationError}`);
    }
    return resolved;
  }

  get settingsService(): SettingsService { return this.options.settingsService; }
  get dataService(): DataService { return this.options.dataService; }
  get securityService(): SecurityService { return this.options.securityService; }
  get processManager(): ProxyProcessManager { return this.options.processManager; }
  get quotaService(): QuotaService { return this.options.quotaService; }
  get authService(): AuthService { return this.options.authService; }
  get eventBus(): EventBusService { return this.options.eventBus; }
  get databaseService(): DatabaseService { return this.options.databaseService; }

  override async initialize(): Promise<void> {
    const start = performance.now();
    await super.initialize();

    // Listen for token refreshes (no longer syncs files, but logs it)
    this.eventBus.on('token:refreshed', (payload) => {
      this.logDebug(`Token refreshed for ${payload.provider}, available via Auth API`);
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
      this.logInfo('Proxy service cleanup completed; background proxy remains available');
    } catch (e) {
      this.logError('Failed to clean proxy service during cleanup:', e as Error);
    }
  }

  private initializeProviderRateLimits(): void {
    const defaults: Record<string, ProviderRateLimitConfig> = {
      github: { windowMs: 60_000, maxRequests: 60, warningThreshold: 0.85, maxQueueSize: 100, allowPremiumBypass: false },
      codex: { windowMs: 60_000, maxRequests: 80, warningThreshold: 0.85, maxQueueSize: 120, allowPremiumBypass: true },
      claude: { windowMs: 60_000, maxRequests: 70, warningThreshold: 0.85, maxQueueSize: 100, allowPremiumBypass: true },
      antigravity: { windowMs: 60_000, maxRequests: 80, warningThreshold: 0.85, maxQueueSize: 120, allowPremiumBypass: true },
      ollama: { windowMs: 60_000, maxRequests: 90, warningThreshold: 0.9, maxQueueSize: 140, allowPremiumBypass: true },
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
      throw new ProxyServiceError('Default provider rate limit config not found', AppErrorCode.PROXY_INVALID_CONFIG, false);
    }
    return config;
  }

  private getProviderWindow(provider: string): number[] {
    if (!this.providerWindows.has(provider)) {
      this.providerWindows.set(provider, []);
    }
    const window = this.providerWindows.get(provider);
    if (!window) {
      throw new ProxyServiceError(`Provider window not found for ${provider}`, AppErrorCode.PROXY_NOT_INITIALIZED, false);
    }
    return window;
  }

  private getProviderQueue(provider: string): QueuedRateLimitRequest[] {
    if (!this.providerQueues.has(provider)) {
      this.providerQueues.set(provider, []);
    }
    const queue = this.providerQueues.get(provider);
    if (!queue) {
      throw new ProxyServiceError(`Provider queue not found for ${provider}`, AppErrorCode.PROXY_NOT_INITIALIZED, false);
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
    if (p.includes('ollama')) { return 'ollama'; }
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
      throw new ProxyServiceError(`Rate limit queue full for provider ${provider}`, AppErrorCode.RATE_LIMIT, false);
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

  /** Returns rate limit snapshots for all configured providers. @returns Object with generatedAt timestamp and provider snapshots */
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

  /** Returns rate limit configuration for all providers. @returns Map of provider name to config */
  getProviderRateLimitConfig(): Record<string, ProviderRateLimitConfig> {
    const output: Record<string, ProviderRateLimitConfig> = {};
    for (const [provider, config] of this.providerRateConfigs.entries()) {
      output[provider] = { ...config };
    }
    return output;
  }

  /**
   * Updates rate limit config for a provider.
   * @param providerRaw - Provider identifier
   * @param config - Partial config to merge
   * @returns Merged config
   * @throws ValidationError if provider is invalid
   */
  setProviderRateLimitConfig(providerRaw: string, config: Partial<ProviderRateLimitConfig>): ProviderRateLimitConfig {
    const providerError = validateProvider(providerRaw);
    if (providerError) {
      throw new ValidationError(`setProviderRateLimitConfig: ${providerError}`);
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




  /**
   * Initiates GitHub device code OAuth flow.
   * @param appId - OAuth app to use
   * @returns Device code response for user authorization
   */
  async initiateGitHubAuth(appId: 'profile' | 'copilot' = 'profile'): Promise<DeviceCodeResponse> {
    this.eventBus.emitCustom(ProxyTelemetryEvent.AUTH_INITIATED, { provider: 'github', appId });
    
    const response = await this.makeRequest<{
      device_code: string;
      user_code: string;
      verification_uri: string;
      expires_in: number;
      interval: number;
    }>(
      '/v0/auth/github/login',
      await this.getRuntimeProxyApiKey(),
      'GET',
      undefined,
      { provider: 'github', priority: 2 }
    );

    if (typeof response === 'object' && response !== null && 'error' in response && response.error) {
      this.eventBus.emitCustom(ProxyTelemetryEvent.AUTH_FAILED, { provider: 'github', appId, error: response.error as string });
      throw new Error(`GitHub auth initiation failed: ${response.error}`);
    }

    const githubResponse = response as {
        device_code: string;
        user_code: string;
        verification_uri: string;
        expires_in: number;
        interval: number;
    };
    
    return {
      device_code: githubResponse.device_code,
      user_code: githubResponse.user_code,
      verification_uri: githubResponse.verification_uri,
      expires_in: githubResponse.expires_in,
      interval: githubResponse.interval
    };
  }

  /**
   * Polls for GitHub OAuth token after device code authorization.
   * @param deviceCode - Device code from initiateGitHubAuth
   * @param interval - Poll interval in seconds
   * @param appId - OAuth app identifier
   * @returns Token response
   * @throws ValidationError if inputs invalid
   */
  async waitForGitHubToken(deviceCode: string, interval: number, appId: 'profile' | 'copilot' = 'profile'): Promise<TokenResponse> {
    const codeError = validateToken(deviceCode, 'Device code');
    if (codeError) {
      throw new ValidationError(`waitForGitHubToken: ${codeError}`);
    }
    const intervalError = validateInterval(interval);
    if (intervalError) {
      throw new ValidationError(`waitForGitHubToken: ${intervalError}`);
    }

    const checkToken = async (): Promise<TokenResponse> => {
      const response = await this.makeRequest<{
        success: boolean;
        access_token?: string;
        refresh_token?: string;
        refresh_token_expires_in?: number;
        token_type?: string;
        scope?: string;
        session_token?: string;
        expires_at?: number;
        copilot_plan?: string;
        error?: string;
      }>(
        `/v0/auth/github/poll?device_code=${encodeURIComponent(deviceCode)}&provider=${encodeURIComponent(appId)}`,
        await this.getRuntimeProxyApiKey(),
        'GET',
        undefined,
        { provider: 'github', priority: 3 }
      );

      if (typeof response === 'object' && response !== null && 'success' in response && response.success && 'access_token' in response) {
        return {
          access_token: response.access_token as string,
          token_type: typeof response.token_type === 'string' ? response.token_type : 'bearer',
          scope: typeof response.scope === 'string'
            ? response.scope
            : appId === 'copilot'
              ? 'read:user user:email'
              : 'read:user user:email repo',
          refresh_token: typeof response.refresh_token === 'string' ? response.refresh_token : undefined,
          refresh_token_expires_in: typeof response.refresh_token_expires_in === 'number' ? response.refresh_token_expires_in : undefined,
          session_token: typeof response.session_token === 'string' ? response.session_token : undefined,
          expires_at: typeof response.expires_at === 'number' ? response.expires_at : undefined,
          copilot_plan: typeof response.copilot_plan === 'string' ? response.copilot_plan : undefined
        };
      }

      // Rust returns error string if pending or real error
      const errorMsg = (typeof response === 'object' && response !== null && 'error' in response) ? response.error as string : undefined;
      const lowerError = errorMsg?.toLowerCase() || '';

      appLogger.debug('ProxyService', `waitForGitHubToken [${appId}]: checkToken received errorMsg="${errorMsg}"`);

      if (lowerError.includes('authorization_pending') || lowerError.includes('slow_down')) {
        appLogger.info('ProxyService', `waitForGitHubToken [${appId}]: ${lowerError}, retrying in ${interval + 1}s...`);
        // Wait and try again
        await new Promise(r => setTimeout(r, (interval + 1) * 1000));
        return checkToken();
      }

      appLogger.error('ProxyService', `waitForGitHubToken [${appId}]: Failed with error: ${errorMsg || 'Unknown error'}`);
      throw new Error(errorMsg || 'Authentication failed');
    };

    return checkToken();
  }

  /** Starts Antigravity Google OAuth flow. @returns Auth URL and state parameter */
  async getAntigravityAuthUrl(accountId?: string): Promise<{ url: string, state: string, accountId: string }> {
    return this.getBrowserAuthUrl('antigravity', accountId);
  }

  /** Starts Claude/Anthropic OAuth flow. @returns Auth URL and state parameter */
  async getAnthropicAuthUrl(accountId?: string): Promise<{ url: string; state: string; accountId: string }> {
    return this.getBrowserAuthUrl('claude', accountId);
  }

  /** Starts Codex OAuth flow locally and returns the browser URL. */
  async getCodexAuthUrl(accountId?: string): Promise<{ url: string; state: string; accountId: string }> {
    return this.getBrowserAuthUrl('codex', accountId);
  }

  /** Starts Ollama auth URL flow. @returns Auth URL and state parameter */
  async getOllamaAuthUrl(accountId?: string): Promise<{ url: string; state: string; accountId: string }> {
    return this.getBrowserAuthUrl('ollama', accountId);
  }

  /** Disconnects Ollama cloud identity for the current local Ollama key. */
  async ollamaSignout(accountId?: string): Promise<{ success: boolean; alreadySignedOut?: boolean; error?: string }> {
    try {
      const response = await this.makeRequestWithTimeout<{
        success?: boolean;
        already_signed_out?: boolean;
        alreadySignedOut?: boolean;
        error?: string;
      }>('/v0/management/ollama-signout', {
        timeoutMs: this.getOAuthTimeoutMs('ollama'),
        apiKey: await this.getRuntimeProxyApiKey(),
        method: 'POST',
        body: accountId ? { account_id: accountId } : {},
        rateLimit: { provider: 'ollama', priority: 2, isPremiumBypass: true }
      });

      if ('success' in response && response.success === true) {
        const alreadySignedOut = ('alreadySignedOut' in response && typeof response.alreadySignedOut === 'boolean')
          ? response.alreadySignedOut
          : ('already_signed_out' in response && typeof response.already_signed_out === 'boolean')
              ? response.already_signed_out
              : undefined;
        return { success: true, alreadySignedOut };
      }

      const errorMessage = 'error' in response && typeof response.error === 'string'
        ? response.error
        : 'Failed to sign out Ollama account';
      appLogger.warn('ProxyService', `ollamaSignout failed: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      appLogger.warn('ProxyService', `ollamaSignout request failed: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  async getBrowserAuthStatus(
    provider: BrowserAuthProvider,
    state: string,
    accountId: string
  ): Promise<BrowserAuthStatusResponse> {
    const params = new URLSearchParams({
      provider,
      state,
      account_id: accountId
    });

    const fallbackStatus = async (): Promise<BrowserAuthStatusResponse> => {
      if (provider === 'ollama') {
        return {
          status: 'wait',
          provider,
          state,
          accountId
        };
      }
      const account = await this.getLocalBrowserAuthAccount(provider, accountId);
      if (account) {
        return {
          status: 'ok',
          provider,
          state,
          accountId,
          account
        };
      }
      return {
        status: 'wait',
        provider,
        state,
        accountId
      };
    };

    try {
      const response = await this.makeRequestWithTimeout<BrowserAuthStatusResponse>(
        `/v0/management/get-auth-status?${params.toString()}`,
        {
          timeoutMs: this.getOAuthTimeoutMs(provider),
          apiKey: await this.getRuntimeProxyApiKey(),
          method: 'GET',
          rateLimit: { provider, priority: 2, isPremiumBypass: true }
        }
      );

      if ('status' in response && typeof response.status === 'string') {
        const normalized = this.normalizeBrowserAuthStatusResponse(response);
        if (response.status === 'wait') {
          return await fallbackStatus();
        }
        return normalized;
      }
    } catch (error) {
      appLogger.warn('ProxyService', `Browser auth status fallback for ${provider}: ${getErrorMessage(error)}`);
      return await fallbackStatus();
    }

    return await fallbackStatus();
  }

  private async getLocalBrowserAuthAccount(
    provider: BrowserAuthProvider,
    accountId: string
  ): Promise<JsonObject | null> {
    const providerAliases: Record<BrowserAuthProvider, string[]> = {
      codex: ['codex', 'openai'],
      claude: ['claude', 'anthropic'],
      antigravity: ['antigravity', 'google', 'gemini'],
      ollama: ['ollama']
    };
    const aliases = new Set(providerAliases[provider]);
    const account = (await this.databaseService.getLinkedAccounts())
      .find(candidate => candidate.id === accountId && aliases.has(candidate.provider.toLowerCase()));
    if (!account) {
      return null;
    }
    return {
      id: account.id,
      provider: account.provider,
      email: account.email ?? null,
      displayName: account.displayName ?? null,
      isActive: account.isActive
    };
  }

  private async getBrowserAuthUrl(
    provider: BrowserAuthProvider,
    accountId?: string
  ): Promise<BrowserAuthUrlResponse> {
    const route = provider === 'claude'
      ? 'anthropic-auth-url'
      : `${provider}-auth-url`;
    const params = new URLSearchParams();
    if (accountId) {
      params.set('account_id', accountId);
    }
    const requestPath = `/v0/management/${route}${params.size > 0 ? `?${params.toString()}` : ''}`;
    appLogger.debug('ProxyService', `getBrowserAuthUrl: requesting ${requestPath} on port ${this.currentPort}`);
    const response = await this.makeRequestWithTimeout<BrowserAuthUrlResponse>(requestPath, {
      timeoutMs: this.getOAuthTimeoutMs(provider),
      apiKey: await this.getRuntimeProxyApiKey(),
      method: 'GET',
      rateLimit: { provider, priority: 2, isPremiumBypass: true }
    });
    appLogger.debug('ProxyService', `getBrowserAuthUrl: response keys=${Object.keys(response).join(',')}, url=${'url' in response ? 'present' : 'missing'}, state=${'state' in response ? 'present' : 'missing'}`);

    const normalized = this.normalizeBrowserAuthUrlResponse(response);
    if (normalized) {
      this.eventBus.emitCustom(ProxyTelemetryEvent.AUTH_INITIATED, {
        provider,
        state: normalized.state,
        accountId: normalized.accountId
      });
      return normalized;
    }

    const errorMessage = 'error' in response && typeof response.error === 'string'
      ? response.error
      : `Failed to get ${provider} auth URL`;
    appLogger.error('ProxyService', `getBrowserAuthUrl: failed for ${provider}: ${errorMessage}`);
    this.eventBus.emitCustom(ProxyTelemetryEvent.AUTH_FAILED, { provider, error: errorMessage });
    throw new ProxyServiceError(errorMessage, AppErrorCode.PROXY_AUTH_FAILED, false, { provider });
  }

  async cancelBrowserAuth(
    provider: BrowserAuthProvider,
    state: string,
    accountId: string
  ): Promise<boolean> {
    const response = await this.makeRequest<{ success?: boolean; cancelled?: boolean; error?: string }>(
      '/v0/management/cancel-auth',
      await this.getRuntimeProxyApiKey(),
      'POST',
      {
        provider,
        state,
        account_id: accountId
      },
      { provider, priority: 2, isPremiumBypass: true }
    );

    if ('success' in response && response.success === true) {
      return 'cancelled' in response && response.cancelled === true;
    }
    return false;
  }

  async verifyAuthBridge(
    provider: BrowserAuthProvider = 'codex'
  ): Promise<BrowserAuthVerifyResponse> {
    const params = new URLSearchParams({ provider });
    const response = await this.makeRequestWithTimeout<BrowserAuthVerifyResponse>(
      `/api/auth/oauth/verify?${params.toString()}`,
      {
        timeoutMs: this.getOAuthTimeoutMs(provider),
        apiKey: await this.getRuntimeProxyApiKey(),
        method: 'GET',
        rateLimit: { provider, priority: 2, isPremiumBypass: true }
      }
    );
    if ('status' in response && typeof response.status === 'string') {
      return {
        status: response.status,
        provider: 'provider' in response && typeof response.provider === 'string' ? response.provider : provider,
        readiness: 'readiness' in response ? response.readiness : undefined,
        callback: 'callback' in response ? response.callback : undefined,
        error: 'error' in response && typeof response.error === 'string' ? response.error : undefined,
      };
    }
    return { status: 'failed', provider, error: 'Invalid auth verification response' };
  }

  private normalizeBrowserAuthUrlResponse(
    response: ProxyRequestResponse<BrowserAuthUrlResponse>
  ): BrowserAuthUrlResponse | null {
    if (!('url' in response) || typeof response.url !== 'string' || typeof response.state !== 'string') {
      return null;
    }
    const snakeCaseAccountId =
      'account_id' in response && typeof response.account_id === 'string'
        ? response.account_id
        : undefined;
    const camelCaseAccountId =
      'accountId' in response && typeof response.accountId === 'string'
        ? response.accountId
        : undefined;
    const accountId = camelCaseAccountId ?? snakeCaseAccountId;
    if (!accountId) {
      return null;
    }
    return {
      url: response.url,
      state: response.state,
      accountId
    };
  }

  private normalizeBrowserAuthStatusResponse(
    response: BrowserAuthStatusResponse
  ): BrowserAuthStatusResponse {
    const snakeCaseAccountId =
      'account_id' in response && typeof response.account_id === 'string'
        ? response.account_id
        : undefined;
    return {
      ...response,
      accountId: response.accountId ?? snakeCaseAccountId
    };
  }



  /**
   * Starts the embedded proxy process.
   * @param options - Optional port configuration
   * @returns Proxy status
   * @throws on invalid port
   */
  async startEmbeddedProxy(options?: { port?: number; persistent?: boolean }): Promise<ProxyEmbedStatus> {
    const previous = this.operationLock;
    const current = (async () => {
      try {
        await previous;
      } catch {
        // Suppress previous errors to allow this one to try
      }
      return this.startEmbeddedProxyInternal(options);
    })();
    this.operationLock = current.then(() => {}, () => {});
    return current;
  }

  private async startEmbeddedProxyInternal(options?: { port?: number; persistent?: boolean }): Promise<ProxyEmbedStatus> {
    const start = performance.now();
    if (options?.port !== undefined) {
      const portError = validatePort(options.port);
      if (portError) {
        this.logError(`startEmbeddedProxy: ${portError}`);
        return { running: false, error: portError, errorCode: AppErrorCode.PROXY_INVALID_CONFIG };
      }
    }
    this.currentPort = options?.port ?? 8317;
    const status = await this.processManager.start({
      ...options,
      persistent: options?.persistent ?? true
    });
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

  private async ensureEmbeddedProxyReady(): Promise<boolean> {
    const status = this.processManager.getStatus();
    if (status.running) {
      if (status.port) {
        this.currentPort = status.port;
      }
      return true;
    }

    const started = await this.startEmbeddedProxy({ port: this.currentPort });
    return started.running === true;
  }

  /** Stops the embedded proxy process. @throws ProxyServiceError on failure */
  async stopEmbeddedProxy(): Promise<void> {
    const previous = this.operationLock;
    const current = (async () => {
      try {
        await previous;
      } catch {
        // Ignore previous errors
      }
      return this.stopEmbeddedProxyInternal();
    })();
    this.operationLock = current.then(() => {}, () => {});
    return await current;
  }

  private async stopEmbeddedProxyInternal(): Promise<void> {
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

  /** Returns current embedded proxy running status. @returns Proxy embed status */
  getEmbeddedProxyStatus(): ProxyEmbedStatus {
    const status = this.processManager.getStatus();
    if (status.running && status.port) { this.currentPort = status.port; }
    this.eventBus.emitCustom(ProxyTelemetryEvent.HEALTH_CHECK, { running: status.running, port: status.port });
    return status;
  }

  /**
   * Prepares embedded proxy runtime bootstrap inputs.
   * Kept as generateConfig for backwards-compatible callers.
   * @param port - Port number
   * @throws ProxyServiceError on invalid port
   */
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

  /** Fetches quota information for all linked accounts. @returns Quota data or null */
  async getQuota(): Promise<{ accounts: Array<QuotaResponse & { accountId?: string; email?: string }> } | null> {
    const quota = await this.quotaService.getQuota(this.currentPort, await this.getRuntimeProxyApiKey());
    if (!quota) { return null; }
    return quota;
  }

  /** Fetches Codex usage data for linked accounts. */
  async getCodexUsage(): Promise<{ accounts: Array<{ usage: CodexUsage | { error: string }; accountId?: string; email?: string }> }> {
    return this.quotaService.getCodexUsage();
  }

  /** Fetches available Antigravity models. */
  async getAntigravityAvailableModels(): Promise<ModelQuotaItem[]> {
    return this.quotaService.getAntigravityAvailableModels();
  }

  /** Fetches legacy quota information. */
  async getLegacyQuota(): Promise<{ success: boolean; authExpired?: boolean; data?: JsonObject } & Partial<QuotaResponse>> {
    return this.quotaService.getLegacyQuota();
  }

  /** Fetches Copilot quota for linked accounts. */
  async getCopilotQuota(): Promise<{ accounts: Array<CopilotQuota & { accountId?: string; email?: string }> }> {
    return this.quotaService.getCopilotQuota();
  }

  /** Fetches Claude quota for linked accounts. */
  async getClaudeQuota(): Promise<{ accounts: Array<ClaudeQuota> }> {
    return this.quotaService.getClaudeQuota();
  }

  /** Fetches and merges model data from all providers. @returns Aggregated model response */
  async getModels(): Promise<ProxyModelResponse> {
    const start = performance.now();
    await this.ensureEmbeddedProxyReady();
    const apiKey = await this.getRuntimeProxyApiKey();
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

  /** Fetches the raw tengra-proxy catalog without main-process quota enrichment. */
  async getRawModelCatalog(): Promise<ProxyModelResponse> {
    await this.ensureEmbeddedProxyReady();
    const apiKey = await this.getRuntimeProxyApiKey();
    const data = await this.getProxyModels(apiKey);
    return { data };
  }

  async listSkills(): Promise<ProxySkill[]> {
    await this.ensureEmbeddedProxyReady();
    const response = await this.makeRequest<ProxySkillListResponse>(
      '/v0/skills',
      await this.getRuntimeProxyApiKey(),
      'GET',
      undefined,
      { provider: 'proxy', priority: 1, isPremiumBypass: true }
    );
    if (!('items' in response) || !Array.isArray(response.items)) {
      return [];
    }
    return response.items;
  }

  async saveSkill(input: ProxySkillUpsertInput): Promise<ProxySkill> {
    await this.ensureEmbeddedProxyReady();
    const response = await this.makeRequest<ProxySkillItemResponse>(
      '/v0/skills',
      await this.getRuntimeProxyApiKey(),
      'POST',
      input as unknown as RuntimeValue,
      { provider: 'proxy', priority: 2, isPremiumBypass: true }
    );
    if ('item' in response && response.item) {
      return response.item;
    }
    const errorText = 'error' in response && typeof response.error === 'string'
      ? response.error
      : 'Skill save failed';
    throw new ProxyServiceError(errorText, AppErrorCode.PROXY_REQUEST_FAILED, false);
  }

  async toggleSkill(skillId: string, input: ProxySkillToggleInput): Promise<ProxySkill> {
    await this.ensureEmbeddedProxyReady();
    const response = await this.makeRequest<ProxySkillItemResponse>(
      `/v0/skills/${encodeURIComponent(skillId)}/toggle`,
      await this.getRuntimeProxyApiKey(),
      'POST',
      input as unknown as RuntimeValue,
      { provider: 'proxy', priority: 2, isPremiumBypass: true }
    );
    if ('item' in response && response.item) {
      return response.item;
    }
    const errorText = 'error' in response && typeof response.error === 'string'
      ? response.error
      : 'Skill toggle failed';
    throw new ProxyServiceError(errorText, AppErrorCode.PROXY_REQUEST_FAILED, false);
  }

  async deleteSkill(skillId: string): Promise<boolean> {
    await this.ensureEmbeddedProxyReady();
    const response = await this.makeRequest<{ success?: boolean; error?: string }>(
      `/v0/skills/${encodeURIComponent(skillId)}`,
      await this.getRuntimeProxyApiKey(),
      'DELETE',
      undefined,
      { provider: 'proxy', priority: 2, isPremiumBypass: true }
    );
    return 'success' in response && response.success === true;
  }

  async listMarketplaceSkills(): Promise<ProxyMarketplaceSkill[]> {
    await this.ensureEmbeddedProxyReady();
    const response = await this.makeRequest<{ items?: ProxyMarketplaceSkill[] }>(
      '/v0/skills/marketplace',
      await this.getRuntimeProxyApiKey(),
      'GET',
      undefined,
      { provider: 'proxy', priority: 1, isPremiumBypass: true }
    );
    if (!('items' in response) || !Array.isArray(response.items)) {
      return [];
    }
    return response.items;
  }

  async installMarketplaceSkill(input: ProxyMarketplaceSkillInstallInput): Promise<ProxySkill> {
    await this.ensureEmbeddedProxyReady();
    const response = await this.makeRequest<ProxySkillItemResponse>(
      '/v0/skills/marketplace/install',
      await this.getRuntimeProxyApiKey(),
      'POST',
      input as unknown as RuntimeValue,
      { provider: 'proxy', priority: 2, isPremiumBypass: true }
    );
    if ('item' in response && response.item) {
      return response.item;
    }
    const errorText = 'error' in response && typeof response.error === 'string'
      ? response.error
      : 'Marketplace skill installation failed';
    throw new ProxyServiceError(errorText, AppErrorCode.PROXY_REQUEST_FAILED, false);
  }

  private async getProxyModels(apiKey: string): Promise<ModelItem[]> {
    try {
      this.logDebug(`getProxyModels: Fetching from http://127.0.0.1:${this.currentPort}/v1/models`);
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

    const usageObj = usage as Record<string, RuntimeValue>;
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

    const existingKeys = new Map<string, number>();
    merged.forEach((model, index) => {
      existingKeys.set(`${model.provider.toLowerCase()}:${model.id.toLowerCase()}`, index);
    });

    for (const m of extra) {
      const key = `antigravity:${m.id.toLowerCase()}`;
      const existingIndex = existingKeys.get(key);
      if (existingIndex !== undefined) {
        const existing = merged[existingIndex];
        merged[existingIndex] = {
          ...existing,
          ...m,
          provider: 'antigravity',
          id: existing.id,
          name: existing.name ?? m.name,
        };
        continue;
      }

      merged.push({ ...m, provider: 'antigravity' });
      existingKeys.set(key, merged.length - 1);
    }
    return merged.sort((left, right) => {
      const leftProvider = left.provider.toLowerCase();
      const rightProvider = right.provider.toLowerCase();
      const providerCmp = leftProvider.localeCompare(rightProvider);
      if (providerCmp !== 0) {
        return providerCmp;
      }
      return left.id.toLowerCase().localeCompare(right.id.toLowerCase());
    });
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
        resetStr = new Date(model.quotaInfo.resetTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        this.logDebug('Failed to format reset time:', e as Error);
      }
    }
    model.quota = { percentage: Math.round(fraction * 100), reset: resetStr };
  }




  private makeRequest<T = JsonObject>(
    path: string,
    apiKey?: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    body?: RuntimeValue,
    rateLimit?: { provider: string; priority?: number; isPremiumBypass?: boolean }
  ): Promise<ProxyRequestResponse<T>> {
    return this.makeRequestWithTimeout(path, {
      timeoutMs: PROXY_REQUEST_TIMEOUT_MS,
      apiKey,
      method,
      body,
      rateLimit
    });
  }

  private makeRequestWithTimeout<T = JsonObject>(
    path: string,
    options: ProxyRequestExecutionOptions
  ): Promise<ProxyRequestResponse<T>> {
    const method = options.method ?? 'GET';
    const timeoutMs = options.timeoutMs;
    const requestApiKey = options.apiKey;
    const requestBody = options.body;
    const requestStart = performance.now();
    return new Promise((resolve, reject) => {
      const run = async () => {
        const snapshot = options.rateLimit
          ? await this.waitForRateLimit(options.rateLimit.provider, {
            priority: options.rateLimit.priority,
            isPremiumBypass: options.rateLimit.isPremiumBypass
          })
          : undefined;

        const requestOptions = {
          method,
          protocol: 'http:' as const,
          hostname: '127.0.0.1',
          port: this.currentPort,
          path
        };

        const request = net.request(requestOptions);
        let settled = false;
        let timeoutHandle: ReturnType<typeof setTimeout> | null = setTimeout(() => {
          if (settled) {
            return;
          }
          settled = true;
          if ('abort' in request && typeof request.abort === 'function') {
            request.abort();
          }
          reject(new ProxyServiceError(
            `Proxy request timed out after ${timeoutMs}ms`,
            AppErrorCode.PROXY_TIMEOUT,
            true,
            { path, method }
          ));
        }, timeoutMs);
        const token = requestApiKey ?? this.settingsService.getSettings().proxy?.apiKey ?? this.settingsService.getSettings().proxy?.key;
        if (token) {
          request.setHeader('Authorization', `Bearer ${token}`);
        }
        if (requestBody) {
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
            if (settled) {
              return;
            }
            settled = true;
            if (timeoutHandle !== null) {
              clearTimeout(timeoutHandle);
              timeoutHandle = null;
            }
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

            const parsed = safeJsonParse<JsonObject | null>(d, null);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              if (rateLimitInfo) {
                parsed['rateLimit'] = rateLimitInfo;
              }
              if (res.statusCode && res.statusCode >= 400) {
                parsed['success'] = false;
                // If there's no error field but it's a 400+, set a default
                if (!parsed['error'] && !parsed['message']) {
                  parsed['error'] = `HTTP ${res.statusCode}`;
                }
              }
              resolve(parsed as unknown as ProxyRequestResponse<T>);
              return;
            }

            if (res.statusCode && res.statusCode >= 400) {
              // Not JSON, but still an error. Use the raw body as the error message if it exists.
              const errorText = d.trim() || `HTTP ${res.statusCode}`;
              resolve({ success: false, error: errorText, raw: d, rateLimit: rateLimitInfo });
              return;
            }
            resolve({ success: false, error: 'Invalid JSON', raw: d, rateLimit: rateLimitInfo });
          });
        });

        request.on('error', err => {
          if (settled) {
            return;
          }
          settled = true;
          if (timeoutHandle !== null) {
            clearTimeout(timeoutHandle);
            timeoutHandle = null;
          }
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
        if (requestBody) {
          request.write(JSON.stringify(requestBody));
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

  /** Returns the proxy API key, generating one if needed. @returns Proxy API key string */
  async getProxyKey(): Promise<string> { return await this.ensureProxyKey(); }

  private async getRuntimeProxyApiKey(): Promise<string> {
    const runtimeKey = this.settingsService.getSettings().proxy?.apiKey?.trim() ?? '';
    if (runtimeKey) {
      return runtimeKey;
    }
    return await this.getProxyKey();
  }

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



  /**
   * Fetches GitHub user profile using access token.
   * @param accessToken - GitHub OAuth token
   * @returns Profile with email, name, avatar, login
   */
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

  /**
   * Fetches primary verified email from GitHub.
   * @param accessToken - GitHub OAuth token
   * @returns Primary email or undefined
   */
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
