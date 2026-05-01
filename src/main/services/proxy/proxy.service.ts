/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import crypto from 'crypto';
import http, { ClientRequest } from 'http';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import { DatabaseService } from '@main/services/data/database.service';
import { ProxyEmbedStatus, ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
import { validateInterval, validateOAuthTimeoutMs, validatePort, validateToken } from '@main/services/proxy/proxy-validation.util';
import { AuthService } from '@main/services/security/auth.service';
import { SecurityService } from '@main/services/security/security.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { SettingsService } from '@main/services/system/settings.service';
import { getMainWindow } from '@main/startup/window';
import { JsonObject, JsonValue, RuntimeValue } from '@shared/types/common';
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
  GET_MODELS_MS: 5000
} as const;
const PROXY_REQUEST_TIMEOUT_MS = 15_000;
const PROXY_MODEL_REQUEST_TIMEOUT_MS = 4_000;
const PROXY_MODEL_CACHE_TTL_MS = 10_000;
const QUOTA_STREAM_RECONNECT_DELAY_MS = 3000;
const QUOTA_STREAM_CHANNEL = 'proxy:quota:updated';
const QUOTA_SNAPSHOT_TIMEOUT_MS = 5000;
const QUOTA_REFRESH_MIN_GAP_MS = 1500;

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
}

interface QuotaCollectors {
  quotaAccounts: Array<QuotaResponse & { accountId?: string; email?: string }>;
  copilotAccounts: Array<CopilotQuota & { accountId?: string; email?: string }>;
  codexAccounts: Array<{ usage: CodexUsage | { error: string }; accountId?: string; email?: string }>;
  claudeAccounts: ClaudeQuota[];
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

interface ProxyQuotaStreamAccount extends JsonObject {
  provider?: string;
  account_id?: string;
  email?: string;
  is_active?: boolean;
  success?: boolean;
  quota?: JsonValue;
  error?: string;
}

interface ProxyQuotaStreamSnapshot {
  timestamp_ms?: number;
  accounts?: ProxyQuotaStreamAccount[];
  error?: string;
}

interface ProxyQuotaBroadcastPayload {
  timestampMs: number;
  quotaData: { accounts: Array<QuotaResponse & { accountId?: string; email?: string }> } | null;
  copilotQuota: { accounts: Array<CopilotQuota & { accountId?: string; email?: string }> };
  codexUsage: { accounts: Array<{ usage: CodexUsage | { error: string }; accountId?: string; email?: string }> };
  claudeQuota: { accounts: Array<ClaudeQuota> };
  error?: string;
}

interface ProxyToolDispatchResponse {
  success: boolean;
  result?: JsonValue;
  error?: string;
}


export interface ProxyServiceOptions {
  settingsService: SettingsService;
  dataService: DataService;
  securityService: SecurityService;
  processManager: ProxyProcessManager;
  authService: AuthService;
  eventBus: EventBusService;
  databaseService: DatabaseService;
}

export class ProxyService extends BaseService {
  private currentPort: number = 8317;
  private operationLock: Promise<void> = Promise.resolve();
  private quotaStreamRequest: ClientRequest | null = null;
  private quotaStreamReconnectTimer: NodeJS.Timeout | null = null;
  private quotaStreamBuffer = '';
  private quotaStreamEnabled = false;
  private latestQuotaBroadcast: ProxyQuotaBroadcastPayload | null = null;
  private latestQuotaFingerprint = '';
  private quotaRefreshInFlight: Promise<void> | null = null;
  private quotaRefreshLastAttemptAt = 0;
  private proxyModelsCache: ModelItem[] = [];
  private proxyModelsCacheAt = 0;
  private proxyModelsInFlight: Promise<ModelItem[]> | null = null;

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

    const elapsed = performance.now() - start;
    if (elapsed > PROXY_PERFORMANCE_BUDGETS.INITIALIZE_MS) {
      this.logWarn(`initialize exceeded budget: ${elapsed.toFixed(1)}ms > ${PROXY_PERFORMANCE_BUDGETS.INITIALIZE_MS}ms`);
    }
  }

  override async cleanup(): Promise<void> {
    try {
      this.stopQuotaStream();
      this.logInfo('Proxy service cleanup completed; background proxy remains available');
    } catch (e) {
      this.logError('Failed to clean proxy service during cleanup:', e as Error);
    }
  }

  private startQuotaStream(): void {
    if (this.quotaStreamEnabled) {
      return;
    }
    this.quotaStreamEnabled = true;
    this.connectQuotaStream();
  }

  private connectQuotaStream(): void {
    if (!this.quotaStreamEnabled || this.quotaStreamRequest) {
      return;
    }

    const proxyStatus = this.processManager.getStatus();
    if (!proxyStatus.running) {
      this.scheduleQuotaStreamReconnect();
      return;
    }

    const port = proxyStatus.port ?? this.currentPort;
    this.currentPort = port;

    void this.getRuntimeProxyApiKey()
      .then((apiKey) => {
        void this.refreshQuotaSnapshotOnce(apiKey);
        const request = http.request(
          {
            host: '127.0.0.1',
            method: 'GET',
            path: '/v0/management/quota/stream',
            port,
            headers: {
              Accept: 'text/event-stream',
              Authorization: `Bearer ${apiKey}`,
              Connection: 'keep-alive',
              'Cache-Control': 'no-cache',
            },
            timeout: PROXY_REQUEST_TIMEOUT_MS,
          },
          (response) => {
            if (response.statusCode !== 200) {
              this.logWarn(`Quota stream rejected with HTTP ${response.statusCode ?? 0}`);
              this.clearQuotaStreamRequest();
              response.resume();
              this.scheduleQuotaStreamReconnect();
              return;
            }

            response.setEncoding('utf8');
            response.on('data', (chunk: string) => {
              this.quotaStreamBuffer += chunk;
              this.flushQuotaSseBuffer();
            });
            response.on('end', () => {
              this.clearQuotaStreamRequest();
              this.scheduleQuotaStreamReconnect();
            });
            response.on('error', (error) => {
              this.logWarn(`Quota stream response error: ${error.message}`);
              this.clearQuotaStreamRequest();
              this.scheduleQuotaStreamReconnect();
            });
          }
        );

        request.on('timeout', () => {
          this.logWarn('Quota stream request timed out; reconnecting');
          request.destroy();
        });
        request.on('error', (error) => {
          if (error.message.includes('ECONNREFUSED')) {
            this.logDebug(`Quota stream not ready yet: ${error.message}`);
          } else {
            this.logWarn(`Quota stream request failed: ${error.message}`);
          }
          this.clearQuotaStreamRequest();
          this.scheduleQuotaStreamReconnect();
        });

        this.quotaStreamRequest = request;
        request.end();
      })
      .catch((error) => {
        this.logWarn(`Unable to start quota stream: ${getErrorMessage(error)}`);
        this.scheduleQuotaStreamReconnect();
      });
  }

  private async refreshQuotaSnapshotOnce(apiKey: string, timeoutMs: number = PROXY_REQUEST_TIMEOUT_MS): Promise<void> {
    try {
      const response = await this.makeRequestWithTimeout<ProxyQuotaStreamSnapshot>('/v0/management/quota/snapshot', {
        timeoutMs,
        apiKey,
        method: 'GET'
      });
      const maybeSnapshot = response as ProxyQuotaStreamSnapshot;
      const payload = this.normalizeQuotaSnapshot(maybeSnapshot);
      this.latestQuotaBroadcast = payload;
      const fingerprint = this.buildQuotaFingerprint(payload);
      // Avoid UI flicker by not re-broadcasting identical snapshots.
      if (fingerprint && fingerprint === this.latestQuotaFingerprint) {
        return;
      }
      this.latestQuotaFingerprint = fingerprint;
      const mainWindow = getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(QUOTA_STREAM_CHANNEL, payload);
      }
      this.eventBus.emitCustom(QUOTA_STREAM_CHANNEL, payload as unknown as RuntimeValue);
    } catch (error) {
      const message = getErrorMessage(error);
      if (message.includes('ECONNREFUSED')) {
        this.logDebug(`Initial quota snapshot not ready yet: ${message}`);
      } else {
        this.logWarn(`Initial quota snapshot fetch failed: ${message}`);
      }
    }
  }

  public async triggerQuotaSnapshotRefresh(waitForCompletion: boolean): Promise<void> {
    const now = Date.now();
    if (this.quotaRefreshInFlight) {
      if (waitForCompletion) {
        await this.quotaRefreshInFlight;
      }
      return;
    }
    if (!waitForCompletion && now - this.quotaRefreshLastAttemptAt < QUOTA_REFRESH_MIN_GAP_MS) {
      return;
    }
    this.quotaRefreshLastAttemptAt = now;
    const refreshTask = (async () => {
      if (!await this.ensureEmbeddedProxyReady()) {
        return;
      }
      const apiKey = await this.getRuntimeProxyApiKey();
      await this.refreshQuotaSnapshotOnce(apiKey, QUOTA_SNAPSHOT_TIMEOUT_MS);
    })().finally(() => {
      this.quotaRefreshInFlight = null;
    });
    this.quotaRefreshInFlight = refreshTask;
    if (waitForCompletion) {
      await refreshTask;
    }
  }

  private flushQuotaSseBuffer(): void {
    let delimiterIndex = this.quotaStreamBuffer.indexOf('\n\n');
    while (delimiterIndex !== -1) {
      const block = this.quotaStreamBuffer.slice(0, delimiterIndex).trim();
      this.quotaStreamBuffer = this.quotaStreamBuffer.slice(delimiterIndex + 2);
      if (block.length > 0) {
        this.handleQuotaSseBlock(block);
      }
      delimiterIndex = this.quotaStreamBuffer.indexOf('\n\n');
    }
  }

  private handleQuotaSseBlock(block: string): void {
    const lines = block.split('\n');
    let eventName = 'message';
    let dataText = '';
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
        continue;
      }
      if (line.startsWith('data:')) {
        dataText += line.slice(5).trim();
      }
    }

    if (eventName !== 'snapshot' || dataText.length === 0) {
      return;
    }

    const parsed = safeJsonParse<ProxyQuotaStreamSnapshot>(dataText, {} as ProxyQuotaStreamSnapshot);
    const payload = this.normalizeQuotaSnapshot(parsed);
    this.latestQuotaBroadcast = payload;
    const fingerprint = this.buildQuotaFingerprint(payload);
    if (fingerprint && fingerprint === this.latestQuotaFingerprint) {
      return;
    }
    this.latestQuotaFingerprint = fingerprint;

    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(QUOTA_STREAM_CHANNEL, payload);
    }
    this.eventBus.emitCustom(QUOTA_STREAM_CHANNEL, payload as unknown as RuntimeValue);
  }

  private buildQuotaFingerprint(payload: ProxyQuotaBroadcastPayload): string {
    // Fingerprint excludes timestampMs to prevent identical snapshots from re-rendering the UI.
    try {
      return JSON.stringify({
        quotaData: payload.quotaData,
        copilotQuota: payload.copilotQuota,
        codexUsage: payload.codexUsage,
        claudeQuota: payload.claudeQuota,
        error: payload.error ?? null,
      }) ?? '';
    } catch {
      return '';
    }
  }

  private normalizeQuotaSnapshot(snapshot: ProxyQuotaStreamSnapshot): ProxyQuotaBroadcastPayload {
    const accounts = Array.isArray(snapshot.accounts) ? snapshot.accounts : [];

    const collectors: QuotaCollectors = {
      quotaAccounts: [],
      copilotAccounts: [],
      codexAccounts: [],
      claudeAccounts: [],
    };

    for (const account of accounts) {
      this.processAccountQuota(account, collectors);
    }

    return {
      timestampMs: typeof snapshot.timestamp_ms === 'number' ? snapshot.timestamp_ms : Date.now(),
      quotaData: collectors.quotaAccounts.length > 0 ? { accounts: collectors.quotaAccounts } : null,
      copilotQuota: { accounts: collectors.copilotAccounts },
      codexUsage: { accounts: collectors.codexAccounts },
      claudeQuota: { accounts: collectors.claudeAccounts },
      error: typeof snapshot.error === 'string' ? snapshot.error : undefined,
    };
  }

  private processAccountQuota(account: ProxyQuotaStreamAccount, collectors: QuotaCollectors): void {
    const provider = (account.provider ?? '').toLowerCase();
    // Since we flattened the QuotaResult into the account object in Rust,
    // the 'account' object now contains 'models', 'quota', 'success', etc.
    const quotaObject = account as Record<string, RuntimeValue>;

    if (provider === 'antigravity' || provider === 'google') {
      this.processAntigravityQuota(account, quotaObject, collectors.quotaAccounts);
    } else if (provider === 'copilot' || provider === 'github') {
      this.processCopilotQuota(account, quotaObject, collectors.copilotAccounts);
    } else if (provider === 'codex' || provider === 'openai') {
      this.processCodexQuota(account, quotaObject, collectors.codexAccounts);
    } else if (provider === 'claude' || provider === 'anthropic') {
      this.processClaudeQuota(account, quotaObject, collectors.claudeAccounts);
    }
  }

  private processAntigravityQuota(
    account: ProxyQuotaStreamAccount,
    quotaObject: Record<string, RuntimeValue> | null,
    target: Array<QuotaResponse & { accountId?: string; email?: string }>
  ): void {
    if (account.success !== true) {
      target.push({
        status: 'Error',
        next_reset: '-',
        models: [],
        success: false,
        authExpired: (account.error ?? '').toLowerCase().includes('401') || (account.error ?? '').toLowerCase().includes('unauthorized'),
        accountId: account.account_id,
        email: account.email,
        isActive: account.is_active,
        error: account.error,
      });
      return;
    }

    const provider = (account.provider ?? '').toLowerCase();
    const modelsRaw = (Array.isArray(quotaObject?.models) ? quotaObject.models : []) as RuntimeValue[];
    const models: ModelQuotaItem[] = modelsRaw.map((item) => {
      const modelObj = this.asObject(item);
      const remainingFraction = this.asNumber(modelObj?.remaining_fraction ?? modelObj?.remainingFraction) ?? 0;
      const remainingQuota = this.asNumber(modelObj?.remaining_quota ?? modelObj?.remainingQuota);
      const totalQuota = this.asNumber(modelObj?.total_quota ?? modelObj?.totalQuota);
      const resetTime = this.asString(modelObj?.reset_time ?? modelObj?.resetTime);
      const modelId = this.asString(modelObj?.id) ?? 'unknown-model';
      const modelName = this.asString(modelObj?.name ?? modelObj?.displayName) ?? modelId;

      return {
        id: modelId,
        name: modelName,
        object: 'model',
        owned_by: provider,
        provider,
        percentage: Math.round(Math.max(0, Math.min(1, remainingFraction)) * 100),
        reset: resetTime ?? '-',
        permission: [],
        quotaInfo: {
          remainingFraction,
          remainingQuota: remainingQuota ?? 0,
          totalQuota: totalQuota ?? 0,
          resetTime: resetTime ?? undefined,
        },
        metadata: modelObj?.metadata as JsonValue | undefined,
      };
    });

    const firstReset = models.find((model) => typeof model.quotaInfo?.resetTime === 'string')?.quotaInfo?.resetTime ?? '-';
    target.push({
      status: 'Success',
      next_reset: firstReset ?? '-',
      models,
      success: true,
      authExpired: false,
      accountId: account.account_id,
      email: account.email,
      isActive: account.is_active,
    });
  }

  private processCopilotQuota(
    account: ProxyQuotaStreamAccount,
    quotaObject: Record<string, RuntimeValue> | null,
    target: Array<CopilotQuota & { accountId?: string; email?: string }>
  ): void {
    if (account.success !== true) {
      target.push({
        remaining: 0,
        limit: 0,
        reset: undefined,
        accountId: account.account_id,
        email: account.email,
        error: account.error,
      });
      return;
    }

    const quotaInfo = this.asObject(quotaObject?.quota);
    const remaining = this.asNumber(quotaInfo?.remaining) ?? 0;
    const total = this.asNumber(quotaInfo?.total) ?? 0;
    const reset = this.asString(quotaInfo?.reset_at);
    const session_limits = this.asObject(quotaInfo?.session_limits);
    const session_usage = this.asObject(quotaInfo?.session_usage);

    target.push({
      remaining,
      limit: total,
      reset: reset ?? undefined,
      session_limits: session_limits as CopilotQuota['session_limits'],
      session_usage: session_usage as CopilotQuota['session_usage'],
      accountId: account.account_id,
      email: account.email,
    });
  }

  private processCodexQuota(
    account: ProxyQuotaStreamAccount,
    quotaObject: Record<string, RuntimeValue> | null,
    target: Array<{ usage: CodexUsage | { error: string }; accountId?: string; email?: string }>
  ): void {
    const accountId = account.account_id;
    const email = account.email;

    if (account.success !== true) {
      target.push({
        usage: { error: account.error ?? 'Quota stream fetch failed' },
        accountId,
        email,
      });
      return;
    }

    const quotaInfo = this.asObject(quotaObject?.quota);
    const remaining = this.asNumber(quotaInfo?.remaining);
    const total = this.asNumber(quotaInfo?.total);
    const resetAt = this.asString(quotaInfo?.reset_at);
    const fiveHourUsedPercent = this.asNumber(quotaInfo?.five_hour_used_percent);
    const weeklyUsedPercent = this.asNumber(quotaInfo?.weekly_used_percent);
    const fiveHourResetAt = this.asString(quotaInfo?.five_hour_reset_at);
    const weeklyResetAt = this.asString(quotaInfo?.weekly_reset_at);

    // If quota info is entirely missing, don't show an error, just return zeroed usage
    if (!quotaInfo) {
      target.push({
        usage: {
          remainingRequests: 0,
          totalRequests: 0,
          dailyUsedPercent: 0,
          weeklyUsedPercent: 0,
          resetAt: undefined,
        },
        accountId,
        email,
      });
      return;
    }

    const remainingPercent = (remaining !== null && total !== null && total > 0)
      ? Math.max(0, Math.min(100, (remaining / total) * 100))
      : (weeklyUsedPercent !== null || fiveHourUsedPercent !== null)
        ? Math.max(0, Math.min(100, 100 - (weeklyUsedPercent ?? fiveHourUsedPercent ?? 0)))
        : (total === 0 ? 0 : 100); // If total is explicitly 0, treat as exhausted. Otherwise default to 100% if no info.
    const usedPercent = Math.max(0, Math.min(100, 100 - remainingPercent));

    target.push({
      usage: {
        remainingRequests: remaining ?? undefined,
        totalRequests: total ?? undefined,
        dailyUsedPercent: fiveHourUsedPercent ?? usedPercent,
        weeklyUsedPercent: weeklyUsedPercent ?? usedPercent,
        dailyResetAt: fiveHourResetAt ?? resetAt ?? undefined,
        weeklyResetAt: weeklyResetAt ?? resetAt ?? undefined,
        resetAt: resetAt ?? undefined,
      },
      accountId,
      email,
    });
  }

  private processClaudeQuota(
    account: ProxyQuotaStreamAccount,
    quotaObject: Record<string, RuntimeValue> | null,
    target: ClaudeQuota[]
  ): void {
    const accountId = account.account_id;
    const email = account.email;

    if (account.success !== true) {
      target.push({
        success: false,
        error: account.error ?? 'Quota stream fetch failed',
        accountId,
        email,
        isActive: account.is_active,
      });
      return;
    }

    const quotaInfo = this.asObject(quotaObject?.quota);
    const remaining = this.asNumber(quotaInfo?.remaining) ?? 0;
    const total = this.asNumber(quotaInfo?.total) ?? 0;
    const utilization = total > 0 ? Math.max(0, Math.min(100, ((total - remaining) / total) * 100)) : 0;
    const resetAt = this.asString(quotaInfo?.reset_at) ?? '';

    target.push({
      success: true,
      fiveHour: resetAt ? { utilization, resetsAt: resetAt } : undefined,
      accountId,
      email,
      isActive: account.is_active,
    });
  }

  private asObject(value: RuntimeValue): Record<string, RuntimeValue> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, RuntimeValue>)
      : null;
  }

  private asString(value: RuntimeValue): string | null {
    return typeof value === 'string' ? value : null;
  }

  private asNumber(value: RuntimeValue): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private scheduleQuotaStreamReconnect(): void {
    if (!this.quotaStreamEnabled || this.quotaStreamReconnectTimer) {
      return;
    }
    this.quotaStreamReconnectTimer = setTimeout(() => {
      this.quotaStreamReconnectTimer = null;
      this.connectQuotaStream();
    }, QUOTA_STREAM_RECONNECT_DELAY_MS);
  }

  private clearQuotaStreamRequest(): void {
    this.quotaStreamBuffer = '';
    this.quotaStreamRequest = null;
  }

  private stopQuotaStream(): void {
    this.quotaStreamEnabled = false;
    if (this.quotaStreamReconnectTimer) {
      clearTimeout(this.quotaStreamReconnectTimer);
      this.quotaStreamReconnectTimer = null;
    }
    if (this.quotaStreamRequest) {
      try {
        this.quotaStreamRequest.destroy();
      } catch {
        // Ignore stream shutdown failures.
      }
      this.quotaStreamRequest = null;
    }
    this.quotaStreamBuffer = '';
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
      undefined
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
        undefined
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
        body: accountId ? { account_id: accountId } : {}
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
          method: 'GET'
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
      method: 'GET'
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
      }
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
        method: 'GET'
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
    this.startQuotaStream();
    this.eventBus.emitCustom(ProxyTelemetryEvent.PROXY_STARTED, { port: this.currentPort, elapsedMs: elapsed });
    return status;
  }

  private async ensureEmbeddedProxyReady(): Promise<boolean> {
    const status = this.processManager.getStatus();
    if (status.running) {
      if (status.port) {
        this.currentPort = status.port;
      }
      this.startQuotaStream();
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
    this.stopQuotaStream();
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
    if (this.latestQuotaBroadcast?.quotaData) {
      void this.triggerQuotaSnapshotRefresh(false);
      return this.latestQuotaBroadcast.quotaData;
    }
    await this.triggerQuotaSnapshotRefresh(true);
    return this.latestQuotaBroadcast?.quotaData ?? null;
  }

  /** Fetches Codex usage data for linked accounts. */
  async getCodexUsage(): Promise<{ accounts: Array<{ usage: CodexUsage | { error: string }; accountId?: string; email?: string }> }> {
    if (this.latestQuotaBroadcast?.codexUsage.accounts.length) {
      void this.triggerQuotaSnapshotRefresh(false);
      return this.latestQuotaBroadcast.codexUsage;
    }
    await this.triggerQuotaSnapshotRefresh(true);
    return this.latestQuotaBroadcast?.codexUsage ?? { accounts: [] };
  }

  /** Fetches available Antigravity models. */
  async getAntigravityAvailableModels(): Promise<ModelQuotaItem[]> {
    const quota = await this.getQuota();
    if (!quota?.accounts?.length) {
      return [];
    }
    const merged = new Map<string, ModelQuotaItem>();
    for (const account of quota.accounts) {
      for (const model of account.models ?? []) {
        const key = model.id.toLowerCase();
        const existing = merged.get(key);
        if (!existing || (existing.percentage ?? 0) < (model.percentage ?? 0)) {
          merged.set(key, model);
        }
      }
    }
    return [...merged.values()];
  }

  /** Fetches legacy quota information. */
  async getLegacyQuota(): Promise<{ success: boolean; authExpired?: boolean; data?: JsonObject } & Partial<QuotaResponse>> {
    const codex = await this.getCodexUsage();
    const first = codex.accounts[0];
    if (!first || 'error' in first.usage) {
      return { success: false };
    }
    return { success: true, usage: first.usage };
  }

  async saveClaudeSession(sessionKey: string, accountId?: string): Promise<{ success: boolean; error?: string }> {
    if (!sessionKey || sessionKey.trim().length === 0) {
      return { success: false, error: 'Session key must be a non-empty string' };
    }
    try {
      if (accountId && accountId.trim().length > 0) {
        await this.authService.updateToken(accountId, { sessionToken: sessionKey });
      } else {
        await this.authService.linkAccount('claude', { sessionToken: sessionKey });
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /** Fetches Copilot quota for linked accounts. */
  async getCopilotQuota(): Promise<{ accounts: Array<CopilotQuota & { accountId?: string; email?: string }> }> {
    if (this.latestQuotaBroadcast?.copilotQuota.accounts.length) {
      void this.triggerQuotaSnapshotRefresh(false);
      return this.latestQuotaBroadcast.copilotQuota;
    }
    await this.triggerQuotaSnapshotRefresh(true);
    return this.latestQuotaBroadcast?.copilotQuota ?? { accounts: [] };
  }

  /** Fetches Claude quota for linked accounts. */
  async getClaudeQuota(): Promise<{ accounts: Array<ClaudeQuota> }> {
    if (this.latestQuotaBroadcast?.claudeQuota.accounts.length) {
      void this.triggerQuotaSnapshotRefresh(false);
      return this.latestQuotaBroadcast.claudeQuota;
    }
    await this.triggerQuotaSnapshotRefresh(true);
    return this.latestQuotaBroadcast?.claudeQuota ?? { accounts: [] };
  }

  /** Fetches and merges model data from all providers. @returns Aggregated model response */
  async getModels(): Promise<ProxyModelResponse> {
    const start = performance.now();
    await this.ensureEmbeddedProxyReady();
    const apiKey = await this.getRuntimeProxyApiKey();
    const proxyData = await this.getProxyModels(apiKey);
    void this.triggerQuotaSnapshotRefresh(false);
    const codexDataRaw = this.latestQuotaBroadcast?.codexUsage ?? { accounts: [] };
    const copilotDataRaw = this.latestQuotaBroadcast?.copilotQuota ?? { accounts: [] };
    const claudeDataRaw = this.latestQuotaBroadcast?.claudeQuota ?? { accounts: [] };

    // Use the first account's quota for normalization (legacy behavior)
    const codexData = codexDataRaw.accounts[0] && !('error' in codexDataRaw.accounts[0].usage)
      ? codexDataRaw.accounts[0].usage
      : null;
    const copilotData = copilotDataRaw.accounts[0] ? { success: true, ...copilotDataRaw.accounts[0] } : null;
    const claudeData = claudeDataRaw.accounts[0] ?? null;

    const quotas = this.normalizeQuota(codexData, copilotData, claudeData);

    let extra: ModelQuotaItem[] = [];
    let antigravityError: string | undefined;

    try {
      extra = await this.getAntigravityAvailableModels();
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
      undefined
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
      input as unknown as RuntimeValue
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
      input as unknown as RuntimeValue
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
      undefined
    );
    return 'success' in response && response.success === true;
  }

  async listMarketplaceSkills(): Promise<ProxyMarketplaceSkill[]> {
    await this.ensureEmbeddedProxyReady();
    const response = await this.makeRequest<{ items?: ProxyMarketplaceSkill[] }>(
      '/v0/skills/marketplace',
      await this.getRuntimeProxyApiKey(),
      'GET',
      undefined
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
      input as unknown as RuntimeValue
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
    const cacheAgeMs = Date.now() - this.proxyModelsCacheAt;
    if (this.proxyModelsCache.length > 0 && cacheAgeMs < PROXY_MODEL_CACHE_TTL_MS) {
      this.logDebug(`getProxyModels: Returning cached catalog (${this.proxyModelsCache.length} models, age=${cacheAgeMs}ms)`);
      return this.proxyModelsCache;
    }

    if (this.proxyModelsInFlight) {
      this.logDebug('getProxyModels: Awaiting in-flight catalog request');
      return this.proxyModelsInFlight;
    }

    this.proxyModelsInFlight = this.fetchProxyModels(apiKey).finally(() => {
      this.proxyModelsInFlight = null;
    });

    return this.proxyModelsInFlight;
  }

  private async fetchProxyModels(apiKey: string): Promise<ModelItem[]> {
    try {
      this.logDebug(`getProxyModels: Fetching from http://127.0.0.1:${this.currentPort}/v1/models`);
      const res = await this.makeRequestWithTimeout('/v1/models', {
        timeoutMs: PROXY_MODEL_REQUEST_TIMEOUT_MS,
        apiKey,
        method: 'GET',
      });
      if ('data' in res && Array.isArray(res.data)) {
        this.proxyModelsCache = res.data as ModelItem[];
        this.proxyModelsCacheAt = Date.now();
        return this.proxyModelsCache;
      }
    } catch (error) {
      this.logWarn(`getProxyModels: Primary proxy fetch failed. ${getErrorMessage(error)}`);
    }
    return this.proxyModelsCache;
  }

  private normalizeQuota(
    codexData: CodexUsage | null,
    copilotData: { success: boolean; limit?: number; remaining?: number; percentage?: number | null } | null,
    claudeData: { success: boolean; fiveHour?: { utilization: number; resetsAt: string }; sevenDay?: { utilization: number; resetsAt: string } } | null
  ) {
    const codexQuotaFn = this.normalizeCodexQuota(codexData);
    const copilotQuotaFn = this.normalizeCopilotQuota(copilotData);
    const claudeQuotaFn = this.normalizeClaudeQuota(claudeData);

    return { codexQuotaFn, copilotQuotaFn, claudeQuotaFn };
  }

  private normalizeCodexQuota(codexData: CodexUsage | null): QuotaInfo | undefined {
    if (!codexData) { return undefined; }
    const usageObj = codexData as unknown as Record<string, RuntimeValue>;
    const remaining = (usageObj.remainingRequests as number) || (usageObj.remainingTokens as number) || 0;
    const limit = (usageObj.dailyLimit as number) || (usageObj.weeklyLimit as number) || (usageObj.totalRequests as number) || 0;
    const fraction = this.determineCodexFraction(codexData, remaining, limit);

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




  public makeRequest<T = JsonObject>(
    path: string,
    apiKey?: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    body?: RuntimeValue
  ): Promise<ProxyRequestResponse<T>> {
    return this.makeRequestWithTimeout(path, {
      timeoutMs: PROXY_REQUEST_TIMEOUT_MS,
      apiKey,
      method,
      body
    });
  }

  async dispatchTool(
    service: string,
    action: string,
    argumentsPayload: JsonObject
  ): Promise<ProxyToolDispatchResponse> {
    const response = await this.makeRequest<ProxyToolDispatchResponse>(
      '/v0/tools/dispatch',
      undefined,
      'POST',
      {
        service,
        action,
        arguments: argumentsPayload
      }
    );
    if (typeof response === 'object' && response !== null && 'success' in response) {
      return response as ProxyToolDispatchResponse;
    }
    return { success: false, error: 'Invalid proxy tool response' };
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
        const token = requestApiKey ?? await this.getRuntimeProxyApiKey();
        if (token) {
          request.setHeader('Authorization', `Bearer ${token}`);
        }
        if (requestBody) {
          request.setHeader('Content-Type', 'application/json');
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
            const parsed = safeJsonParse<JsonObject | null>(d, null);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
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
              resolve({ success: false, error: errorText, raw: d });
              return;
            }
            resolve({ success: false, error: 'Invalid JSON', raw: d });
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
    const activeToken = await this.authService.getActiveToken('proxy_key');
    if (activeToken && activeToken.trim().length > 0) {
      return activeToken.trim();
    }

    const existingAccountToken = (await this.authService.getAccountsByProviderFull('proxy_key'))
      .map(account => account.accessToken ?? account.sessionToken ?? account.refreshToken)
      .find(token => typeof token === 'string' && token.trim().length > 0);
    if (existingAccountToken) {
      return existingAccountToken.trim();
    }

    const legacyKey = this.settingsService.getSettings().proxy?.key?.trim() ?? '';
    if (legacyKey && legacyKey.length <= 72) {
      await this.authService.linkAccount('proxy_key', { accessToken: legacyKey });
      return legacyKey;
    }

    const key = crypto.randomBytes(32).toString('base64');
    await this.authService.linkAccount('proxy_key', { accessToken: key });
    return key;
  }

  /** Returns the proxy API key, generating one if needed. @returns Proxy API key string */
  async getProxyKey(): Promise<string> { return await this.ensureProxyKey(); }

    public async getRuntimeProxyApiKey(): Promise<string> {

    const runtimeKey = await this.authService.getActiveToken('proxy_key');
    if (runtimeKey && runtimeKey.trim().length > 0) {
      return runtimeKey.trim();
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
