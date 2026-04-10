import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { RuntimeValue } from '@shared/types/common';
import { AntigravityCreditUsageMode, AppSettings } from '@shared/types/settings';
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
        fontFamily: 'system',
        typographyScale: 'balanced',

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
        inlineSuggestionsEnabled: true,
        inlineSuggestionsSource: 'custom',
        inlineSuggestionsProvider: 'openai',
        inlineSuggestionsModel: 'gpt-4o-mini',
        hiddenModels: [],
        dismissedRuntimeInstallPrompts: [],
        completedRuntimeInstalls: [],
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
        creditUsageModeByAccount: {},
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
    mcpTrustedPublishers: ['Model Context Protocol', 'Tengra', 'Brave', 'Notion', 'MongoDB'],
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
        zoomFactor: 1,
        startOnStartup: true,
        workAtBackground: true,
        lowPowerMode: true,
        autoHibernation: true,
    },
    terminal: {
        fontSize: 13,
        fontFamily: '"Cascadia Mono", "Cascadia Code", Consolas, "Courier New", ui-monospace, "SFMono-Regular", Menlo, Monaco, "Liberation Mono", "DejaVu Sans Mono", monospace',
        lineHeight: 1.4,
        letterSpacing: 0.2,
        cursorStyle: 'block',
        cursorBlink: true,
        scrollback: 10000,
    },
    ai: {
        preferredMemoryModels: [
            'llama3.2:1b',
            'llama3.2:3b',
            'phi3:mini',
            'gemma2:2b',
            'qwen2.5:0.5b',
            'qwen2.5:1.5b',
            'llama3.1:8b',
            'mistral:7b',
        ],
    },
    editor: {
        fontSize: 14,
        lineHeight: 1.6,
        minimap: true,
        wordWrap: 'off',
        lineNumbers: 'on',
        tabSize: 4,
        cursorBlinking: 'smooth',
        fontLigatures: true,
        formatOnPaste: true,
        formatOnType: true,
        smoothScrolling: true,
        folding: true,
        codeLens: true,
        inlayHints: true,
        renderWhitespace: 'selection',
        cursorSmoothCaretAnimation: 'on',
        wordBasedSuggestions: 'matchingDocuments',
        stickyScroll: true,
        bracketPairColorization: true,
        guidesIndentation: true,
        mouseWheelZoom: false,
        minimapRenderCharacters: false,

        additionalOptions: {},
    },
    remoteAccounts: {
        discord: {
            enabled: false,
            token: '',
            allowedUserIds: [],
        },
        telegram: {
            enabled: false,
            token: '',
            allowedUserIds: [],
        },
        whatsapp: {
            enabled: false,
            mode: 'qr',
            allowedUserIds: [],
        },
    },
};

const ANTIGRAVITY_CREDIT_USAGE_MODES: readonly AntigravityCreditUsageMode[] = ['auto', 'ask-every-time'];

function isAntigravityCreditUsageMode(value: RuntimeValue): value is AntigravityCreditUsageMode {
    return typeof value === 'string'
        && ANTIGRAVITY_CREDIT_USAGE_MODES.includes(value as AntigravityCreditUsageMode);
}

function sanitizeAntigravityCreditUsageMap(
    value: RuntimeValue
): Record<string, AntigravityCreditUsageMode> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    const entries = Object.entries(value as Record<string, RuntimeValue>)
        .filter(([, mode]) => isAntigravityCreditUsageMode(mode))
        .map(([accountId, mode]) => [accountId, mode]);

    return Object.fromEntries(entries);
}

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

    /** Loads settings from disk and synchronizes tokens to the auth service. */
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

    /** Persists any pending settings to disk and cleans up resources. */
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

            const loadedRecord = loaded as Record<string, RuntimeValue>;
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
            const parsed = safeJsonParse<Partial<AppSettings>>(data, {});
            return this.normalizeLoadedSettings(parsed);
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

    private normalizeLoadedSettings(loaded: Partial<AppSettings>): Partial<AppSettings> {
        const loadedRecord = loaded as Record<string, RuntimeValue>;
        const wrappedData = loadedRecord.data;
        if (wrappedData && typeof wrappedData === 'object' && !Array.isArray(wrappedData)) {
            return wrappedData as Partial<AppSettings>;
        }

        const sanitized = { ...loadedRecord };
        delete sanitized.success;
        delete sanitized.data;
        delete sanitized.error;
        delete sanitized.message;
        return sanitized as Partial<AppSettings>;
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
            antigravity: this.mergeOAuthProviderState(authAccounts, 'antigravity', loaded.antigravity),
            copilot: this.mergeOAuthProviderState(authAccounts, 'copilot', loaded.copilot),
            groq: this.mergeProvider(authAccounts, 'groq', loaded.groq, 'apiKey'),
            nvidia: this.mergeProvider(authAccounts, 'nvidia', loaded.nvidia, 'apiKey'),
            remoteAccounts: this.mergeRemoteAccounts(authAccounts, loaded.remoteAccounts),
            proxy: this.mergeProxy(authAccounts, loaded.proxy),
            editor: {
                ...DEFAULT_SETTINGS.editor,
                ...(loaded.editor ?? {}),
            },
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
        const def = (DEFAULT_SETTINGS[provider] as Record<string, RuntimeValue> | undefined) ?? {};
        const loadedObj = (loaded ?? {}) as Record<string, RuntimeValue>;
        const tokenVal = loadedObj[keyField] as string | undefined;
        const authToken = this.findTokenInAuth(authAccounts, String(provider));
        const token = authToken !== '' ? authToken : (tokenVal ?? '');
        return {
            ...def,
            ...loadedObj,
            [keyField]: token,
        } as AppSettings[T];
    }

    private mergeOAuthProviderState<T extends 'antigravity' | 'copilot'>(
        authAccounts: LinkedAccount[],
        provider: T,
        loaded?: Partial<AppSettings[T]>
    ): AppSettings[T] {
        const def = (DEFAULT_SETTINGS[provider] as Record<string, RuntimeValue> | undefined) ?? {};
        const loadedObj = (loaded ?? {}) as Record<string, RuntimeValue>;
        const hasLinkedAccount = authAccounts.some(account =>
            this.normalizeProviderAlias(account.provider) === provider
        );

        return {
            ...def,
            ...loadedObj,
            connected: hasLinkedAccount || loadedObj.connected === true,
            token: typeof loadedObj.token === 'string' ? loadedObj.token : undefined,
            ...(provider === 'antigravity'
                ? {
                    creditUsageModeByAccount: sanitizeAntigravityCreditUsageMap(
                        loadedObj.creditUsageModeByAccount
                    )
                }
                : {}),
        } as AppSettings[T];
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
            apiKey: loaded?.apiKey,
            managementPassword: loaded?.managementPassword,
            port: loaded?.port,
            authStoreKey: loaded?.authStoreKey,
        };
    }

    private mergeRemoteAccounts(
        authAccounts: LinkedAccount[],
        loaded?: Partial<AppSettings['remoteAccounts']>
    ): AppSettings['remoteAccounts'] {
        const def = DEFAULT_SETTINGS.remoteAccounts!;
        const res: AppSettings['remoteAccounts'] = {
            discord: {
                ...def.discord!,
                ...(loaded?.discord ?? {}),
                token: this.findTokenInAuth(authAccounts, 'remote_discord') || (loaded?.discord?.token ?? ''),
            },
            telegram: {
                ...def.telegram!,
                ...(loaded?.telegram ?? {}),
                token: this.findTokenInAuth(authAccounts, 'remote_telegram') || (loaded?.telegram?.token ?? ''),
            },
            whatsapp: {
                ...def.whatsapp!,
                ...(loaded?.whatsapp ?? {}),
                token: this.findTokenInAuth(authAccounts, 'remote_whatsapp') || (loaded?.whatsapp?.token ?? ''),
            },
        };
        return res;
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
            const parsed = safeJsonParse<Partial<AppSettings>>(jsonCandidate, {});
            return { data: this.normalizeLoadedSettings(parsed), wasModified };
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

            if (escapeNext) {
                escapeNext = false;
                continue;
            }
            if (char === '\\' && inString) {
                escapeNext = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                continue;
            }
            if (inString) {
                continue;
            }

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

    /** Returns the current in-memory application settings. */
    getSettings(): AppSettings {
        return this.settings;
    }

    /** Returns the filesystem path to the settings.json file. */
    getSettingsPath(): string {
        return this.settingsPath;
    }

    /**
     * Merges and persists partial settings updates.
     * @param newSettings - Partial settings to merge into the current configuration.
     * @returns The updated {@link AppSettings} after the merge.
     * @throws {Error} If the payload is not a valid non-array object.
     */
    async saveSettings(newSettings: Partial<AppSettings>): Promise<AppSettings> {
        if (!newSettings || typeof newSettings !== 'object' || Array.isArray(newSettings)) {
            throw new Error('error.settings.invalid_payload');
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
            proxy_key: settings.proxy?.key,
            remote_discord: settings.remoteAccounts?.discord?.token,
            remote_telegram: settings.remoteAccounts?.telegram?.token,
            remote_whatsapp: settings.remoteAccounts?.whatsapp?.token,
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

        if (newSettings.remoteAccounts) {
            const { discord, telegram, whatsapp } = newSettings.remoteAccounts;
            const oRA = oldSettings.remoteAccounts;
            this.checkTokenMapping(mappings, 'remote_discord', discord?.token, oRA?.discord?.token);
            this.checkTokenMapping(mappings, 'remote_telegram', telegram?.token, oRA?.telegram?.token);
            this.checkTokenMapping(mappings, 'remote_whatsapp', whatsapp?.token, oRA?.whatsapp?.token);
        }
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

        if (settings.remoteAccounts) {
            if (settings.remoteAccounts.discord) {
                settings.remoteAccounts.discord.token = '';
            }
            if (settings.remoteAccounts.telegram) {
                settings.remoteAccounts.telegram.token = '';
            }
            if (settings.remoteAccounts.whatsapp) {
                settings.remoteAccounts.whatsapp.token = '';
            }
        }

        this.stripOtherSecrets(settings);
    }

    private stripOtherSecrets(settings: AppSettings): void {
        const antigravity = settings.antigravity as Record<string, RuntimeValue> | undefined;
        const copilot = settings.copilot as Record<string, RuntimeValue> | undefined;
        const proxy = settings.proxy as Record<string, RuntimeValue> | undefined;

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

    /**
     * Reloads settings from disk, discarding any in-memory changes.
     * @returns The freshly loaded {@link AppSettings}.
     */
    async reloadSettings(): Promise<AppSettings> {
        this.settings = await this.loadSettings();
        this.recordTelemetryEvent('settings.reload.success');
        return this.settings;
    }

    /** Returns service health metrics including load/save stats and recent telemetry events. */
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
            remote_discord: ['remote_discord'],
            remote_telegram: ['remote_telegram'],
            remote_whatsapp: ['remote_whatsapp'],
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

    private normalizeProviderAlias(provider: string): string {
        const normalized = provider.trim().toLowerCase().replace(/(_token|_key|_auth)$/, '');
        const mappings: Record<string, string> = {
            google: 'antigravity',
            gemini: 'antigravity',
            github: 'copilot',
        };
        return mappings[normalized] ?? normalized;
    }

    private deepMergeSettings(
        target: Record<string, RuntimeValue>,
        source: Record<string, RuntimeValue>
    ): Record<string, RuntimeValue> {
        const res = { ...target };
        for (const key of Object.keys(source)) {
            const sourceValue = source[key];
            if (
                sourceValue !== null &&
                typeof sourceValue === 'object' &&
                !Array.isArray(sourceValue)
            ) {
                const targetValue = (target[key] as Record<string, RuntimeValue> | undefined) ?? {};
                res[key] = { ...targetValue, ...sourceValue };
            } else {
                res[key] = sourceValue;
            }
        }
        return res;
    }

    private sanitizeWindowSettings(raw: RuntimeValue): AppSettings['window'] {
        const fallback = {
            width: DEFAULT_SETTINGS.window?.width ?? 1280,
            height: DEFAULT_SETTINGS.window?.height ?? 800,
            x: DEFAULT_SETTINGS.window?.x ?? 0,
            y: DEFAULT_SETTINGS.window?.y ?? 0,
            zoomFactor: DEFAULT_SETTINGS.window?.zoomFactor ?? 1,
            fullscreen: DEFAULT_SETTINGS.window?.fullscreen ?? false,
            startOnStartup: DEFAULT_SETTINGS.window?.startOnStartup ?? true,
            workAtBackground: DEFAULT_SETTINGS.window?.workAtBackground ?? true,
        };
        const record = raw && typeof raw === 'object' ? (raw as Record<string, RuntimeValue>) : {};
        const legacyBounds =
            record.bounds && typeof record.bounds === 'object'
                ? (record.bounds as Record<string, RuntimeValue>)
                : null;

        const resolveNumber = (
            value: RuntimeValue,
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

        const resolvePosition = (value: RuntimeValue, fallbackValue: number): number => {
            if (typeof value !== 'number' || !Number.isFinite(value)) {
                return fallbackValue;
            }
            return Math.floor(value);
        };

        const resolveZoomFactor = (value: RuntimeValue, fallbackValue: number): number => {
            if (typeof value !== 'number' || !Number.isFinite(value)) {
                return fallbackValue;
            }
            return Math.max(0.5, Math.min(2, Math.round(value * 100) / 100));
        };

        return {
            width,
            height,
            x: resolvePosition(record.x ?? legacyBounds?.x, fallback.x),
            y: resolvePosition(record.y ?? legacyBounds?.y, fallback.y),
            zoomFactor: resolveZoomFactor(record.zoomFactor, fallback.zoomFactor),
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
            const newProv = newSettings[provider] as Record<string, RuntimeValue> | undefined;
            const oldProv = this.settings[provider] as Record<string, RuntimeValue> | undefined;
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

        if (newSettings.remoteAccounts) {
            const { discord, telegram, whatsapp } = newSettings.remoteAccounts;
            const oRA = this.settings.remoteAccounts;
            if (discord && oRA?.discord && !discord.token && oRA.discord.token) {
                discord.token = oRA.discord.token;
            }
            if (telegram && oRA?.telegram && !telegram.token && oRA.telegram.token) {
                telegram.token = oRA.telegram.token;
            }
            if (whatsapp && oRA?.whatsapp && !whatsapp.token && oRA.whatsapp.token) {
                whatsapp.token = oRA.whatsapp.token;
            }
        }

        const newProxy = newSettings.proxy;
        const oldProxy = this.settings.proxy;
        if (newProxy && oldProxy) {
            newProxy.apiKey = newProxy.apiKey ?? oldProxy.apiKey;
            newProxy.managementPassword =
                newProxy.managementPassword ?? oldProxy.managementPassword;
            newProxy.authStoreKey = newProxy.authStoreKey ?? oldProxy.authStoreKey;
            newProxy.port = newProxy.port ?? oldProxy.port;
        }
    }
}
