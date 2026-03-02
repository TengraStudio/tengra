import { BaseService } from '@main/services/base.service';
import type { AuthService } from '@main/services/security/auth.service';
import { CACHE_TTL, OPERATION_TIMEOUTS, RETRY_TIMEOUTS } from '@shared/constants/timeouts';
import type { Message, ToolDefinition } from '@shared/types/chat';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';

import {
    COPILOT_FALLBACK_VSCODE_VERSION,
    type CopilotNotificationService,
    type CopilotState
} from './copilot.types';
import { CopilotApiClient } from './copilot-api.client';
import { CopilotRateLimitManager } from './copilot-rate-limit.manager';
import { CopilotRequestBuilder } from './copilot-request.builder';
import { CopilotResponseParser } from './copilot-response.parser';
import { CopilotTokenManager } from './copilot-token.manager';

export type {
    CopilotAccountType,
    CopilotChatResponse,
    CopilotNotificationService,
    CopilotPayload,
    CopilotState,
    CopilotTokenResponse,
    CopilotTool,
    CopilotToolFunction,
    CopilotUsageData,
    DiagnosticOutputItem,
    DiagnosticResponse,
    DiagnosticResponseData,
    GatewayRequestOptions
} from './copilot.types';

export class CopilotService extends BaseService {
    private readonly state: CopilotState = {
        githubToken: null,
        copilotAuthToken: null,
        copilotSessionToken: null,
        tokenExpiresAt: 0,
        vsCodeVersion: COPILOT_FALLBACK_VSCODE_VERSION,
        accountType: 'individual',
        tokenPromise: null,
        rateLimitInterval: null,
        hasNotifiedExhaustion: false,
        hasNotifiedLowRemaining: false,
        remainingCalls: 5000,
        requestQueue: Promise.resolve(),
        pendingQueueSize: 0,
        modelsCache: null,
        modelsCacheExpiry: 0,
        lastApiCall: 0
    };

    private readonly tokenManager: CopilotTokenManager;
    private readonly rateLimitManager: CopilotRateLimitManager;
    private readonly requestBuilder: CopilotRequestBuilder;
    private readonly responseParser: CopilotResponseParser;
    private readonly apiClient: CopilotApiClient;

    constructor(
        private readonly authService?: AuthService,
        private readonly notificationService?: CopilotNotificationService
    ) {
        super('CopilotService');

        this.tokenManager = new CopilotTokenManager(this.state, this.authService);
        this.rateLimitManager = new CopilotRateLimitManager(this.state, this.authService, this.notificationService);
        this.requestBuilder = new CopilotRequestBuilder(this.state);
        this.responseParser = new CopilotResponseParser();
        this.apiClient = new CopilotApiClient({
            state: this.state,
            tokenManager: this.tokenManager,
            rateLimitManager: this.rateLimitManager,
            requestBuilder: this.requestBuilder,
            responseParser: this.responseParser,
            notificationService: this.notificationService
        });
    }

    async initialize(): Promise<void> {
        this.logInfo('Initializing Copilot service...');

        setTimeout(() => { void this.fetchVsCodeVersion(); }, RETRY_TIMEOUTS.VSCODE_FETCH_DELAY);
        setTimeout(() => { this.rateLimitManager.startMonitoring(); }, CACHE_TTL.RATE_LIMIT_MONITOR);

        this.logInfo('Copilot service initialized successfully');
    }

    async cleanup(): Promise<void> {
        this.logInfo('Cleaning up Copilot service...');

        this.rateLimitManager.stopMonitoring();
        this.state.tokenPromise = null;
        this.state.copilotAuthToken = null;
        this.state.copilotSessionToken = null;

        this.logInfo('Copilot service cleanup complete');
    }

    public async checkRateLimit(silent: boolean = false): Promise<void> {
        await this.rateLimitManager.checkRateLimit(silent);
    }

    public setGithubToken(token: string): void {
        this.state.githubToken = token;
        this.state.modelsCache = null;
        this.state.modelsCacheExpiry = 0;
        this.state.hasNotifiedLowRemaining = false;
    }

    public setCopilotToken(token: string): void {
        this.state.copilotAuthToken = token;
        this.state.copilotSessionToken = null;
        this.state.hasNotifiedExhaustion = false;
        this.state.hasNotifiedLowRemaining = false;
    }

    public isConfigured(): boolean {
        if (this.state.copilotAuthToken || this.state.copilotSessionToken) {
            return true;
        }

        if (!this.authService) {
            return false;
        }

        const token = this.authService.getActiveToken('copilot_token');
        if (token instanceof Promise) {
            return true;
        }

        return !!token;
    }

    public async ensureCopilotToken(): Promise<string> {
        return await this.tokenManager.ensureCopilotToken();
    }

    public getBaseUrl(): string {
        return this.apiClient.getBaseUrl();
    }

    async chat(messages: Message[], model: string = 'gpt-4o', tools?: ToolDefinition[]): Promise<Message | null> {
        return await this.apiClient.chat(messages, model, tools);
    }

    async streamChat(messages: Message[], model: string, tools?: ToolDefinition[]): Promise<ReadableStream<Uint8Array> | null> {
        return await this.apiClient.streamChat(messages, model, tools);
    }

    private async fetchVsCodeVersion(): Promise<void> {
        const controller = new AbortController();
        const timeout = setTimeout(() => { controller.abort(); }, OPERATION_TIMEOUTS.CONNECTIVITY_CHECK);

        try {
            const response = await fetch('https://raw.githubusercontent.com/microsoft/vscode/main/package.json', {
                signal: controller.signal
            });
            const packageJson = safeJsonParse<{ version: string }>(
                await response.text(),
                { version: COPILOT_FALLBACK_VSCODE_VERSION }
            );

            if (packageJson.version) {
                this.state.vsCodeVersion = packageJson.version;
            }
        } catch (error) {
            this.logWarn(
                `Failed to fetch latest VSCode version, using fallback: ${COPILOT_FALLBACK_VSCODE_VERSION} ${getErrorMessage(error)}`
            );
        } finally {
            clearTimeout(timeout);
        }
    }
}
