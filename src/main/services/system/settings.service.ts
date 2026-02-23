import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { AppSettings } from '@shared/types/settings';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { app } from 'electron';

const DEFAULT_SETTINGS: AppSettings = {
    ollama: {
        url: 'http://127.0.0.1:11434',
        numCtx: 16384,
        orchestrationPolicy: 'auto',
    },
    embeddings: {
        provider: 'ollama',
        model: 'all-minilm',
    },
    autoUpdate: {
        enabled: true,
        checkOnStartup: true,
        downloadAutomatically: true,
        notifyOnly: false,
    },
    images: {
        provider: 'antigravity',
        ollamaModel: 'stable-diffusion-v1-5',
        sdWebUIUrl: 'http://127.0.0.1:7860',
        comfyUIUrl: 'http://127.0.0.1:8188',
        sdCppBinaryPath: '',
        sdCppModelPath: '',
        sdCppExtraArgs: '',
    },
    activeAccountId: 'default',
    general: {
        language: 'en',
        theme: 'graphite',
        resolution: '1280x800',
        fontSize: 14,
        onboardingCompleted: false,
        defaultModel: 'gpt-4o',
        defaultTerminalBackend: 'node-pty',
        lastModel: '',
        lastProvider: '',
        responseStyle: 'balanced',
        responseTone: 'neutral',
        responseFormat: 'auto',
        customInstructions: '',
        contextMessageLimit: 50,
        agentMode: 'adaptive',
        agentSoftDeadlineMs: 4000,
        agentHardDeadlineMs: 25000,
        agentRequireLocalForActions: true,
        agentAllowLateSuggestions: true,
        hiddenModels: [],
    },
    github: {
        username: '',
        token: '',
    },
    openai: {
        apiKey: '',
        model: 'gpt-4o',
    },
    anthropic: {
        apiKey: '',
        model: 'claude-3-opus-20240229',
    },

    groq: {
        apiKey: '',
        model: 'llama3-70b-8192',
    },
    nvidia: {
        apiKey: '',
        model: 'nvidia/llama3-chatqa-1.5-70b',
    },
    antigravity: {
        connected: false,
    },
    copilot: {
        connected: false,
    },
    proxy: {
        enabled: false,
        url: 'http://localhost:8317/v1',
        key: 'proxypal-local',
    },
    mcpDisabledServers: [],
    mcpUserServers: [],
    mcpSecurityAllowedHosts: [],
    mcpReviewPolicy: 'elevated',
    mcpAutoExecuteSafe: true,
    mcpActionPermissions: {},
    mcpPermissionRequests: [],
    mcpServerVersionHistory: {},
    mcpTrustedPublishers: ['Model Context Protocol', 'Tandem', 'Brave', 'Notion', 'MongoDB'],
    mcpRevokedSignatures: [],
    mcpSecurityScans: {},
    mcpExtensionReviews: {},
    mcpTelemetry: {
        enabled: true,
        anonymize: true,
        crashReporting: true,
        events: [],
        crashes: []
    },
    security: {
        session: {
            enabled: false,
            timeoutMinutes: 30,
            requireBiometricOnUnlock: false,
        },
    },
    window: {
        width: 1280,
        height: 800,
        x: 0,
        y: 0,
        startOnStartup: true,
        workAtBackground: true,
    },
    terminal: {
        fontSize: 13,
        fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", "SF Mono", Monaco, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace',
        lineHeight: 1.4,
        letterSpacing: 0.2,
        cursorStyle: 'block',
        cursorBlink: true,
        scrollback: 10000,
    },
};

import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import { LinkedAccount } from '@main/services/data/database.service';
import { AuthService } from '@main/services/security/auth.service';

export class SettingsService extends BaseService {
    private static readonly ERROR_CODES = {
        SAVE_FAILED: 'SETTINGS_SAVE_FAILED',
        SAVE_RETRY_EXHAUSTED: 'SETTINGS_SAVE_RETRY_EXHAUSTED',
    } as const;
    private static readonly PERFORMANCE_BUDGET = {
        loadSettingsMs: 400,
        saveSettingsMs: 600,
        saveRetryCount: 2,
    } as const;
    private static readonly UI_MESSAGE_KEYS = {
        ready: 'serviceHealth.settings.ready',
        empty: 'serviceHealth.settings.empty',
        failure: 'serviceHealth.settings.failure',
    } as const;
    private readonly SAVE_RETRY_POLICY = {
        maxAttempts: 2,
        delayMs: 100,
    } as const;
    private settingsPath: string;
    private settings: AppSettings;
    private saveInProgress: boolean = false;
    private pendingSave: Partial<AppSettings> | null = null;
    private initialized: boolean = false;
    private telemetry = {
        loadAttempts: 0,
        saveAttempts: 0,
        saveFailures: 0,
        lastLoadAt: 0,
        lastSaveAt: 0,
        recentEvents: [] as Array<{ name: string; timestamp: number }>,
    };

    constructor(
        dataService?: DataService,
        private authService?: AuthService
    ) {
        super('SettingsService');

        if (dataService) {
            this.settingsPath = path.join(dataService.getPath('config'), 'settings.json');
        } else {
            this.settingsPath = path.join(app.getPath('userData'), 'settings.json');
        }

        this.settings = { ...DEFAULT_SETTINGS };
    }

    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }
        this.settings = await this.loadSettings();
        this.initialized = true;

        // Proactively sync tokens from settings to AuthService
        if (this.authService) {
            await this.syncAllTokensToAuth();
        }

        appLogger.info('SettingsService', 'Initialized successfully');
        this.recordTelemetryEvent('settings.initialize.success');
    }

    async cleanup(): Promise<void> {
        while (this.saveInProgress) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        if (this.pendingSave) {
            await this.saveSettings(this.pendingSave);
        }

        appLogger.info('SettingsService', 'Settings service cleanup complete');
    }

    private async loadSettings(): Promise<AppSettings> {
        this.telemetry.loadAttempts += 1;
        try {
            await fs.promises.access(this.settingsPath);
        } catch {
            const defaults = await this.initializeDefaults();
            this.telemetry.lastLoadAt = Date.now();
            this.recordTelemetryEvent('settings.load.defaults');
            return defaults;
        }

        let loaded: Partial<AppSettings> = {};
        try {
            const data = await fs.promises.readFile(this.settingsPath, 'utf8');

            if (!data.trim()) {
                loaded = {};
            } else {
                loaded = await this.parseAndRecoverSettings(data);
            }

            const loadedRecord = loaded as Record<string, unknown>;
            if (loadedRecord.userAvatar) {
                delete loadedRecord.userAvatar;
            }
            if (loadedRecord.aiAvatar) {
                delete loadedRecord.aiAvatar;
            }
        } catch (error) {
            appLogger.error(
                'SettingsService',
                `Failed to read/parse settings: ${getErrorMessage(error as Error)}`
            );
            loaded = {};
        }

        const merged = await this.mergeWithDefaults(loaded);
        this.telemetry.lastLoadAt = Date.now();
        this.recordTelemetryEvent('settings.load.success');
        return merged;
    }

    private async parseAndRecoverSettings(data: string): Promise<Partial<AppSettings>> {
        try {
            return safeJsonParse<Partial<AppSettings>>(data, {});
        } catch {
            appLogger.warn('SettingsService', 'JSON.parse failed, attempting recovery...');

            const recovered = this.attemptJsonRecovery(data);
            if (recovered) {
                appLogger.info('SettingsService', 'JSON recovery successful');
                if (recovered.wasModified) {
                    await this.backupCorruptedSettings(data, 'recovered', recovered.data);
                }
                return recovered.data;
            } else {
                appLogger.error('SettingsService', 'JSON recovery failed, using defaults');
                await this.backupCorruptedSettings(data, 'corrupted');
                return {};
            }
        }
    }

    private async backupCorruptedSettings(
        originalData: string,
        type: 'recovered' | 'corrupted',
        recoveredData?: Partial<AppSettings>
    ) {
        try {
            const backupPath = `${this.settingsPath}.${type}.${Date.now()}`;
            await fs.promises.writeFile(backupPath, originalData, 'utf8');
            appLogger.info(
                'SettingsService',
                `Backed up original/corrupted file to: ${backupPath}`
            );

            if (recoveredData) {
                await fs.promises.writeFile(
                    this.settingsPath,
                    JSON.stringify(recoveredData, null, 2),
                    'utf8'
                );
            }
        } catch (e) {
            appLogger.warn(
                'SettingsService',
                `Failed to backup ${type} settings: ${getErrorMessage(e as Error)}`
            );
        }
    }

    private async initializeDefaults(): Promise<AppSettings> {
        return this.mergeWithDefaults({});
    }

    private async mergeWithDefaults(loaded: Partial<AppSettings>): Promise<AppSettings> {
        let authAccounts: LinkedAccount[] = [];
        if (this.authService) {
            authAccounts = await this.authService.getAllAccountsFull();
        }

        const res: AppSettings = {
            ...DEFAULT_SETTINGS,
            ...loaded,
            ollama: { ...DEFAULT_SETTINGS.ollama, ...(loaded.ollama ?? {}) },
            images: {
                ...DEFAULT_SETTINGS.images,
                ...(loaded.images ?? {}),
                provider: loaded.images?.provider ?? DEFAULT_SETTINGS.images?.provider ?? 'antigravity',
            },
            autoUpdate: this.mergeAutoUpdate(loaded.autoUpdate),
            general: { ...DEFAULT_SETTINGS.general, ...(loaded.general ?? {}) },
            github: this.mergeProvider(authAccounts, 'github', loaded.github),
            openai: this.mergeProvider(authAccounts, 'openai', loaded.openai, 'apiKey'),
            anthropic: this.mergeProvider(authAccounts, 'anthropic', loaded.anthropic, 'apiKey'),
            antigravity: this.mergeProvider(authAccounts, 'antigravity', loaded.antigravity),
            copilot: this.mergeCopilot(authAccounts, loaded.copilot),
            groq: this.mergeProvider(authAccounts, 'groq', loaded.groq, 'apiKey'),
            nvidia: this.mergeProvider(authAccounts, 'nvidia', loaded.nvidia, 'apiKey'),
            proxy: this.mergeProxy(authAccounts, loaded.proxy),
            security: {
                ...DEFAULT_SETTINGS.security,
                ...(loaded.security ?? {}),
                session: {
                    ...DEFAULT_SETTINGS.security?.session,
                    ...((loaded.security as AppSettings['security'])?.session ?? {}),
                },
            },
            window: this.sanitizeWindowSettings(loaded.window),
        };

        this.migrateDeprecatedSettings(res);
        return res;
    }

    private mergeAutoUpdate(
        loaded?: Partial<AppSettings['autoUpdate']>
    ): AppSettings['autoUpdate'] {
        const def = DEFAULT_SETTINGS.autoUpdate ?? {
            enabled: true,
            checkOnStartup: true,
            downloadAutomatically: true,
            notifyOnly: false,
        };
        return {
            enabled: loaded?.enabled ?? def.enabled,
            checkOnStartup: loaded?.checkOnStartup ?? def.checkOnStartup,
            downloadAutomatically: loaded?.downloadAutomatically ?? def.downloadAutomatically,
            notifyOnly: loaded?.notifyOnly ?? def.notifyOnly,
        };
    }

    private mergeProvider<T extends keyof AppSettings>(
        authAccounts: LinkedAccount[],
        provider: T,
        loaded?: Partial<AppSettings[T]>,
        keyField: string = 'token'
    ): AppSettings[T] {
        const def = (DEFAULT_SETTINGS[provider] as Record<string, unknown> | undefined) ?? {};
        const loadedObj = (loaded ?? {}) as Record<string, unknown>;
        const tokenVal = loadedObj[keyField] as string | undefined;
        const authToken = this.findTokenInAuth(authAccounts, String(provider));
        const token = authToken !== '' ? authToken : (tokenVal ?? '');
        return {
            ...def,
            ...loadedObj,
            [keyField]: token,
        } as AppSettings[T];
    }

    private mergeCopilot(
        authAccounts: LinkedAccount[],
        loaded?: Partial<AppSettings['copilot']>
    ): AppSettings['copilot'] {
        const def = DEFAULT_SETTINGS.copilot;
        const token =
            this.findTokenInAuth(authAccounts, 'copilot') ||
            this.findTokenInAuth(authAccounts, 'github') ||
            (loaded?.token ?? '');

        return {
            connected: loaded?.connected ?? !!def?.connected,
            token,
        };
    }

    private mergeProxy(
        authAccounts: LinkedAccount[],
        loaded?: Partial<AppSettings['proxy']>
    ): AppSettings['proxy'] {
        const def = DEFAULT_SETTINGS.proxy ?? {
            enabled: false,
            url: 'http://localhost:8317/v1',
            key: '',
        };
        const token = this.findTokenInAuth(authAccounts, 'proxy') || (loaded?.key ?? '');
        return {
            enabled: loaded?.enabled ?? def.enabled,
            url: loaded?.url ?? def.url,
            key: token,
        };
    }

    private migrateDeprecatedSettings(settings: AppSettings): void {
        const embeddings = settings.embeddings as { provider: string; model?: string } | undefined;
        if (
            embeddings &&
            (embeddings.provider === 'antigravity' || embeddings.provider === 'gemini')
        ) {
            appLogger.info('SettingsService', 'Migrating deprecated embedding provider to Ollama');
            settings.embeddings.provider = 'ollama';
            settings.embeddings.model = 'all-minilm';
        }
    }

    private attemptJsonRecovery(
        data: string
    ): { data: Partial<AppSettings>; wasModified: boolean } | null {
        const cleanData = data.replace(/^\uFEFF/, '');
        const startIndex = cleanData.indexOf('{');
        if (startIndex < 0) {
            return null;
        }

        const endIndex = this.findJsonObjectEnd(cleanData, startIndex);
        if (endIndex < 0) {
            return null;
        }

        const jsonCandidate = cleanData.substring(startIndex, endIndex + 1);
        const wasModified = endIndex < cleanData.length - 1 || startIndex > 0;

        try {
            return { data: safeJsonParse<Partial<AppSettings>>(jsonCandidate, {}), wasModified };
        } catch {
            return null;
        }
    }

    private findJsonObjectEnd(cleanData: string, startIndex: number): number {
        let depth = 0;
        let inString = false;
        let escapeNext = false;

        for (let i = startIndex; i < cleanData.length; i++) {
            const char = cleanData[i];

            // Handle escapes first
            if (escapeNext) {
                escapeNext = false;
                continue;
            }
            if (char === '\\' && inString) {
                escapeNext = true;
                continue;
            }

            // Handle strings
            if (char === '"') {
                inString = !inString;
                continue;
            }
            if (inString) {
                continue;
            }

            // Handle nesting
            if (char === '{') {
                depth++;
            } else if (char === '}') {
                depth--;
                if (depth === 0) {
                    return i;
                }
            }
        }
        return -1;
    }

    getSettings(): AppSettings {
        return this.settings;
    }

    getSettingsPath(): string {
        return this.settingsPath;
    }

    async saveSettings(newSettings: Partial<AppSettings>): Promise<AppSettings> {
        if (!newSettings || typeof newSettings !== 'object' || Array.isArray(newSettings)) {
            throw new Error('Settings payload must be a non-array object');
        }

        if (this.saveInProgress) {
            this.pendingSave = { ...this.pendingSave, ...newSettings };
            return this.settings;
        }

        this.saveInProgress = true;
        this.telemetry.saveAttempts += 1;
        this.recordTelemetryEvent('settings.save.started');
        const currentSettings = { ...this.settings };

        if (this.authService) {
            this.preserveSensitiveTokens(newSettings);
        }

        this.settings = this.deepMergeSettings(this.settings, newSettings) as AppSettings;
        this.settings.window = this.sanitizeWindowSettings(this.settings.window);

        if (this.authService) {
            await this.syncTokensToAuth(newSettings, currentSettings);
        }

        const persisted = await this.persistSettingsToDisk();
        if (!persisted) {
            this.settings = currentSettings;
            this.telemetry.saveFailures += 1;
            this.recordTelemetryEvent('settings.save.failed');
        } else {
            this.telemetry.lastSaveAt = Date.now();
            this.recordTelemetryEvent('settings.save.success');
        }

        this.saveInProgress = false;
        this.processPendingSaves();

        return this.settings;
    }

    private async syncTokensToAuth(
        newSettings: Partial<AppSettings>,
        oldSettings: AppSettings
    ): Promise<void> {
        if (!this.authService) {
            return;
        }

        const mappings = this.getTokenMappings(newSettings, oldSettings);
        for (const [key, val] of Object.entries(mappings)) {
            if (val) {
                await this.authService.linkAccount(key, { accessToken: val });
            }
        }
    }

    /**
     * Proactively syncs all API keys/tokens from settings to AuthService.
     * This ensures that providers configured via settings.json are available
     * in the centralized account database.
     */
    private async syncAllTokensToAuth(): Promise<void> {
        if (!this.authService) {
            return;
        }

        const settings = this.getSettings();
        const providers: Record<string, string | undefined> = {
            openai_key: settings.openai?.apiKey,
            anthropic_key: settings.anthropic?.apiKey,
            groq_key: settings.groq?.apiKey,
            nvidia_key: settings.nvidia?.apiKey,
            antigravity_token: (settings.antigravity as Record<string, unknown> | undefined)
                ?.token as string | undefined,
            copilot_token: (settings.copilot as Record<string, unknown> | undefined)?.token as
                | string
                | undefined,
            proxy_key: settings.proxy?.key,
        };

        for (const [providerKey, token] of Object.entries(providers)) {
            await this.syncProviderToken(providerKey, token);
        }
    }

    private async syncProviderToken(providerKey: string, token: string | undefined): Promise<void> {
        if (!this.authService || !token || token.length <= 5 || token === 'connected') {
            return;
        }

        try {
            const existingAccounts = await this.authService.getAccountsByProviderFull(providerKey);
            const alreadyExists = existingAccounts.some(
                acc => acc.accessToken === token || acc.sessionToken === token
            );

            if (!alreadyExists) {
                appLogger.info(
                    'SettingsService',
                    `Syncing token for ${providerKey} to AuthService`
                );
                await this.authService.linkAccount(providerKey, { accessToken: token });
            }
        } catch (error) {
            appLogger.warn(
                'SettingsService',
                `Failed to sync token for ${providerKey}: ${getErrorMessage(error as Error)}`
            );
        }
    }

    private getTokenMappings(
        newSettings: Partial<AppSettings>,
        oldSettings: AppSettings
    ): Record<string, string | undefined> {
        const mappings: Record<string, string | undefined> = {};

        this.addCoreMappings(mappings, newSettings, oldSettings);
        this.addProviderMappings(mappings, newSettings, oldSettings);

        return mappings;
    }

    private addCoreMappings(
        mappings: Record<string, string | undefined>,
        newSettings: Partial<AppSettings>,
        oldSettings: AppSettings
    ): void {
        this.checkTokenMapping(
            mappings,
            'github_token',
            newSettings.github?.token,
            oldSettings.github?.token
        );
        this.checkTokenMapping(
            mappings,
            'copilot_token',
            newSettings.copilot?.token,
            oldSettings.copilot?.token
        );
        this.checkTokenMapping(
            mappings,
            'antigravity_token',
            newSettings.antigravity?.token,
            oldSettings.antigravity?.token
        );
    }

    private addProviderMappings(
        mappings: Record<string, string | undefined>,
        newSettings: Partial<AppSettings>,
        oldSettings: AppSettings
    ): void {
        const { openai, anthropic, groq, nvidia, proxy } = newSettings;
        const { openai: oO, anthropic: oA, groq: oG, nvidia: oN, proxy: oP } = oldSettings;

        this.checkTokenMapping(mappings, 'openai_key', openai?.apiKey, oO?.apiKey);
        this.checkTokenMapping(mappings, 'anthropic_key', anthropic?.apiKey, oA?.apiKey);
        this.checkTokenMapping(mappings, 'groq_key', groq?.apiKey, oG?.apiKey);
        this.checkTokenMapping(mappings, 'nvidia_key', nvidia?.apiKey, oN?.apiKey);
        this.checkTokenMapping(mappings, 'proxy_key', proxy?.key, oP?.key);
    }

    private checkTokenMapping(
        mappings: Record<string, string | undefined>,
        key: string,
        newVal: string | undefined,
        oldVal: string | undefined
    ): void {
        if (newVal && newVal !== oldVal && newVal !== 'connected') {
            mappings[key] = newVal;
        }
    }

    private async persistSettingsToDisk(): Promise<boolean> {
        const settingsToSave = this.prepareSettingsForSaving();
        const jsonString = JSON.stringify(settingsToSave, null, 2);

        const tempPath = this.settingsPath + '.tmp';
        for (let attempt = 1; attempt <= this.SAVE_RETRY_POLICY.maxAttempts; attempt += 1) {
            try {
                await fs.promises.writeFile(tempPath, jsonString, 'utf8');
                await fs.promises.rename(tempPath, this.settingsPath);
                return true;
            } catch (error) {
                appLogger.error(
                    'SettingsService',
                    `[${SettingsService.ERROR_CODES.SAVE_FAILED}] Failed to save settings (attempt ${attempt}/${this.SAVE_RETRY_POLICY.maxAttempts}): ${getErrorMessage(error as Error)}`
                );
                if (attempt < this.SAVE_RETRY_POLICY.maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, this.SAVE_RETRY_POLICY.delayMs));
                }
            }
        }
        appLogger.error('SettingsService', `[${SettingsService.ERROR_CODES.SAVE_RETRY_EXHAUSTED}] Settings save retries exhausted`);
        return false;
    }

    private prepareSettingsForSaving(): AppSettings {
        const settingsToSave = JSON.parse(JSON.stringify(this.settings));
        if (!this.authService) {
            return settingsToSave;
        }

        this.stripSecrets(settingsToSave);
        return settingsToSave;
    }

    private stripSecrets(settings: AppSettings): void {
        const { github, openai, anthropic, groq } = settings;
        if (github) {
            github.token = '';
        }
        if (openai) {
            openai.apiKey = '';
        }
        if (anthropic) {
            anthropic.apiKey = '';
        }
        if (groq) {
            groq.apiKey = '';
        }
        if (settings.nvidia) {
            settings.nvidia.apiKey = '';
        }

        this.stripOtherSecrets(settings);
    }

    private stripOtherSecrets(settings: AppSettings): void {
        const antigravity = settings.antigravity as Record<string, unknown> | undefined;
        const copilot = settings.copilot as Record<string, unknown> | undefined;
        const proxy = settings.proxy as Record<string, unknown> | undefined;

        if (antigravity) {
            antigravity.token = undefined;
        }
        if (copilot) {
            copilot.token = undefined;
        }
        if (proxy && proxy.key !== 'connected') {
            proxy.key = '';
        }
    }

    private processPendingSaves(): void {
        if (this.pendingSave) {
            const pending = this.pendingSave;
            this.pendingSave = null;
            setImmediate(() => {
                void this.saveSettings(pending);
            });
        }
    }

    async reloadSettings(): Promise<AppSettings> {
        this.settings = await this.loadSettings();
        this.recordTelemetryEvent('settings.reload.success');
        return this.settings;
    }

    getHealthMetrics(): {
        status: 'healthy' | 'degraded';
        uiState: 'ready' | 'empty' | 'failure';
        messageKey: string;
        performanceBudget: typeof SettingsService.PERFORMANCE_BUDGET;
        loadAttempts: number;
        saveAttempts: number;
        saveFailures: number;
        lastLoadAt: number;
        lastSaveAt: number;
        recentEvents: Array<{ name: string; timestamp: number }>;
    } {
        const uiState = this.telemetry.saveFailures > 0
            ? 'failure'
            : this.initialized
                ? 'ready'
                : 'empty';
        return {
            status: this.telemetry.saveFailures > 0 ? 'degraded' : 'healthy',
            uiState,
            messageKey: SettingsService.UI_MESSAGE_KEYS[uiState],
            performanceBudget: SettingsService.PERFORMANCE_BUDGET,
            loadAttempts: this.telemetry.loadAttempts,
            saveAttempts: this.telemetry.saveAttempts,
            saveFailures: this.telemetry.saveFailures,
            lastLoadAt: this.telemetry.lastLoadAt,
            lastSaveAt: this.telemetry.lastSaveAt,
            recentEvents: [...this.telemetry.recentEvents],
        };
    }

    private recordTelemetryEvent(name: string): void {
        this.telemetry.recentEvents.push({
            name,
            timestamp: Date.now(),
        });
        if (this.telemetry.recentEvents.length > 20) {
            this.telemetry.recentEvents.shift();
        }
    }

    private findTokenInAuth(
        authAccounts: LinkedAccount[],
        provider: string,
        fallbackKeys: string[] = []
    ): string {
        const providers: Record<string, string[]> = {
            github: [
                'proxy-auth-token',
                'proxy_auth_token',
                'github_token',
                'github',
                'github.token',
            ],
            copilot: [
                'proxy-auth-token',
                'proxy_auth_token',
                'copilot_token',
                'copilot',
                'copilot.token',
                'github_token',
            ],
            antigravity: ['antigravity_token', 'antigravity'],
            openai: ['openai_key', 'openai'],
            anthropic: ['anthropic_key', 'anthropic'],
            groq: ['groq_key', 'groq'],
            nvidia: ['nvidia_key', 'nvidia'],
            proxy: ['proxy_key', 'proxy'],
        };

        const searchProviders = [provider, ...(providers[provider] ?? []), ...fallbackKeys];

        for (const p of searchProviders) {
            const acc = authAccounts.find(a => a.provider === p);
            if (acc) {
                return acc.accessToken ?? acc.sessionToken ?? '';
            }
        }

        const fuzzyAcc = authAccounts.find(a => (a.provider as string).startsWith(provider + '-'));
        if (fuzzyAcc) {
            const accessTok = fuzzyAcc.accessToken as string | undefined;
            const sessionTok = fuzzyAcc.sessionToken as string | undefined;
            return accessTok ?? sessionTok ?? '';
        }

        return '';
    }

    private deepMergeSettings(
        target: Record<string, unknown>,
        source: Record<string, unknown>
    ): Record<string, unknown> {
        const res = { ...target };
        for (const key of Object.keys(source)) {
            const sourceValue = source[key];
            if (
                sourceValue !== null &&
                typeof sourceValue === 'object' &&
                !Array.isArray(sourceValue)
            ) {
                const targetValue = (target[key] as Record<string, unknown> | undefined) ?? {};
                res[key] = { ...targetValue, ...sourceValue };
            } else {
                res[key] = sourceValue;
            }
        }
        return res;
    }

    private sanitizeWindowSettings(raw: unknown): AppSettings['window'] {
        const fallback = {
            width: DEFAULT_SETTINGS.window?.width ?? 1280,
            height: DEFAULT_SETTINGS.window?.height ?? 800,
            x: DEFAULT_SETTINGS.window?.x ?? 0,
            y: DEFAULT_SETTINGS.window?.y ?? 0,
            fullscreen: DEFAULT_SETTINGS.window?.fullscreen ?? false,
            startOnStartup: DEFAULT_SETTINGS.window?.startOnStartup ?? true,
            workAtBackground: DEFAULT_SETTINGS.window?.workAtBackground ?? true,
        };
        const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
        const legacyBounds =
            record.bounds && typeof record.bounds === 'object'
                ? (record.bounds as Record<string, unknown>)
                : null;

        const resolveNumber = (
            value: unknown,
            defaultValue: number,
            min: number,
            max: number
        ): number => {
            if (typeof value !== 'number' || !Number.isFinite(value)) {
                return defaultValue;
            }
            return Math.max(min, Math.min(max, Math.floor(value)));
        };

        const width = resolveNumber(
            record.width ?? legacyBounds?.width,
            fallback.width,
            640,
            7680
        );
        const height = resolveNumber(
            record.height ?? legacyBounds?.height,
            fallback.height,
            480,
            4320
        );

        const resolvePosition = (value: unknown, fallbackValue: number): number => {
            if (typeof value !== 'number' || !Number.isFinite(value)) {
                return fallbackValue;
            }
            return Math.floor(value);
        };

        return {
            width,
            height,
            x: resolvePosition(record.x ?? legacyBounds?.x, fallback.x),
            y: resolvePosition(record.y ?? legacyBounds?.y, fallback.y),
            fullscreen:
                typeof record.fullscreen === 'boolean' ? record.fullscreen : fallback.fullscreen,
            startOnStartup:
                typeof record.startOnStartup === 'boolean'
                    ? record.startOnStartup
                    : fallback.startOnStartup,
            workAtBackground:
                typeof record.workAtBackground === 'boolean'
                    ? record.workAtBackground
                    : fallback.workAtBackground,
        };
    }

    private preserveSensitiveTokens(newSettings: Partial<AppSettings>): void {
        const preserveToken = (provider: keyof AppSettings, field: string = 'token') => {
            const newProv = newSettings[provider] as Record<string, unknown> | undefined;
            const oldProv = this.settings[provider] as Record<string, unknown> | undefined;
            if (newProv && oldProv && !newProv[field] && oldProv[field]) {
                newProv[field] = oldProv[field];
            }
        };

        preserveToken('github');
        preserveToken('copilot');
        preserveToken('antigravity');
        preserveToken('openai', 'apiKey');
        preserveToken('anthropic', 'apiKey');
        preserveToken('groq', 'apiKey');
        preserveToken('nvidia', 'apiKey');
        preserveToken('proxy', 'key');
    }
}
