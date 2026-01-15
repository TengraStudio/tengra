
import * as fs from 'fs'
import * as path from 'path'

import { appLogger } from '@main/logging/logger'
import { AppSettings } from '@shared/types/settings'
import { getErrorMessage } from '@shared/utils/error.util'
import { app } from 'electron'

const DEFAULT_SETTINGS: AppSettings = {
    ollama: {
        url: 'http://127.0.0.1:11434',
        numCtx: 16384,
        orchestrationPolicy: 'auto'
    },
    embeddings: {
        provider: 'ollama',
        model: 'all-minilm'
    },
    autoUpdate: {
        enabled: true,
        checkOnStartup: true,
        downloadAutomatically: true,
        notifyOnly: false
    },
    general: {
        language: 'en',
        theme: 'graphite',
        resolution: '1280x800',
        fontSize: 14,
        onboardingCompleted: false,
        defaultModel: 'gpt-4o',
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
        hiddenModels: []
    },
    github: {
        username: '',
        token: ''
    },
    openai: {
        apiKey: '',
        model: 'gpt-4o'
    },
    anthropic: {
        apiKey: '',
        model: 'claude-3-opus-20240229'
    },

    groq: {
        apiKey: '',
        model: 'llama3-70b-8192'
    },
    antigravity: {
        connected: false
    },
    copilot: {
        connected: false
    },
    proxy: {
        enabled: false,
        url: 'http://localhost:8317/v1',
        key: 'proxypal-local'
    },
    mcpDisabledServers: [],
    mcpUserServers: [],
    mcpSecurityAllowedHosts: [],
    mcpReviewPolicy: 'elevated',
    mcpAutoExecuteSafe: true
}

import { BaseService } from '@main/services/base.service'
import { DataService } from '@main/services/data/data.service'
import { AuthService } from '@main/services/security/auth.service'

export class SettingsService extends BaseService {
    private settingsPath: string
    private settings: AppSettings
    private saveInProgress: boolean = false
    private pendingSave: Partial<AppSettings> | null = null
    private initialized: boolean = false

    constructor(
        dataService?: DataService,
        private authService?: AuthService
    ) {
        super('SettingsService')

        if (dataService) {
            this.settingsPath = path.join(dataService.getPath('config'), 'settings.json')
        } else {
            // Fallback for tests or simplified usage, though in main we pass it.
            this.settingsPath = path.join(app.getPath('userData'), 'settings.json')
        }

        // Initialize with defaults, actual loading happens in initialize()
        this.settings = { ...DEFAULT_SETTINGS }
    }

    /**
     * Initialize the service by loading settings from disk.
     * Must be called after construction before using getSettings().
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return
        }
        this.settings = await this.loadSettings()
        this.initialized = true
        appLogger.info('SettingsService', 'Initialized successfully')
    }

    /**
     * Load settings from the settings file.
     *
     * @returns The loaded settings merged with defaults
     */
    private async loadSettings(): Promise<AppSettings> {
        appLogger.info('SettingsService', `loadSettings (authService=${!!this.authService})`);

        // 1. Check if file exists
        try {
            await fs.promises.access(this.settingsPath)
        } catch {
            appLogger.info('SettingsService', `settings.json NOT FOUND at ${this.settingsPath}`);
            return this.initializeDefaults()
        }

        // 2. Read and Parse
        let loaded: Partial<AppSettings> = {};
        try {
            appLogger.info('SettingsService', `Found settings file at ${this.settingsPath}`);
            const data = await fs.promises.readFile(this.settingsPath, 'utf8')

            if (!data?.trim()) {
                appLogger.warn('SettingsService', 'Settings file is empty, using defaults');
                loaded = {}
            } else {
                loaded = await this.parseAndRecoverSettings(data);
            }

            // Cleanup deprecated fields
            if (loaded.userAvatar) { delete loaded.userAvatar; }
            if (loaded.aiAvatar) { delete loaded.aiAvatar; }

        } catch (error) {
            appLogger.error('SettingsService', `Failed to read/parse settings: ${getErrorMessage(error as Error)}`);
            // Proceed with defaults if read fails
            loaded = {};
        }

        return this.mergeWithDefaults(loaded);
    }

    private async parseAndRecoverSettings(data: string): Promise<Partial<AppSettings>> {
        try {
            return JSON.parse(data) as Partial<AppSettings>;
        } catch (parseError) {
            appLogger.warn('SettingsService', 'JSON.parse failed, attempting recovery...');

            const recovered = this.attemptJsonRecovery(data)
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

    private async backupCorruptedSettings(originalData: string, type: 'recovered' | 'corrupted', recoveredData?: Partial<AppSettings>) {
        try {
            const backupPath = `${this.settingsPath}.${type}.${Date.now()}`
            await fs.promises.writeFile(backupPath, originalData, 'utf8')
            appLogger.info('SettingsService', `Backed up original/corrupted file to: ${backupPath}`)

            if (recoveredData) {
                await fs.promises.writeFile(this.settingsPath, JSON.stringify(recoveredData, null, 2), 'utf8')
            }
        } catch (e) {
            appLogger.warn('SettingsService', `Failed to backup ${type} settings: ${getErrorMessage(e as Error)}`);
        }
    }

    private async initializeDefaults(): Promise<AppSettings> {
        // Even if file missing, we might have tokens in memory if AuthService is active
        return this.mergeWithDefaults({});
    }

    private async mergeWithDefaults(loaded: Partial<AppSettings>): Promise<AppSettings> {
        // Merge tokens from AuthService (always do this if authService is available)
        let authTokens: Record<string, string> = {}
        if (this.authService) {
            authTokens = await this.authService.getAllTokens()
            appLogger.info('SettingsService', `Loaded auth tokens. Keys: ${Object.keys(authTokens)}`)
        }

        // Helper for fuzzy token lookup
        // Token finding logic extracted to findTokenInAuth
        const findToken = (provider: string, fallbackKeys: string[] = []): string => {
            return this.findTokenInAuth(authTokens, provider, fallbackKeys);
        };

        const def = DEFAULT_SETTINGS;

        // Safe accessors for defaults to avoid non-null assertions
        const defOpenAI = def.openai ?? { apiKey: '', model: 'gpt-4o' };
        const defAnthropic = def.anthropic ?? { apiKey: '', model: 'claude-3-opus-20240229' };
        const defAntigravity = def.antigravity ?? { connected: false };
        const defCopilot = def.copilot ?? { connected: false };
        const defGroq = def.groq ?? { apiKey: '', model: 'llama3-70b-8192' };
        const defProxy = def.proxy ?? { enabled: false, url: 'http://localhost:8317/v1', key: 'proxypal-local' };
        const defAutoUpdate = def.autoUpdate ?? { enabled: true, checkOnStartup: true, downloadAutomatically: true, notifyOnly: false };

        const res: AppSettings = {
            ...def,
            ...loaded,
            ollama: { ...def.ollama, ...(loaded.ollama || {}) },
            autoUpdate: loaded.autoUpdate
                ? { ...defAutoUpdate, ...loaded.autoUpdate }
                : defAutoUpdate,
            general: { ...def.general, ...(loaded.general || {}) },
            github: {
                ...def.github,
                ...(loaded.github || {}),
                token: findToken('github') || loaded.github?.token || ''
            },
            openai: loaded.openai
                ? {
                    ...defOpenAI,
                    ...loaded.openai,
                    apiKey: findToken('openai') || loaded.openai.apiKey || '',
                    model: loaded.openai.model || defOpenAI.model
                }
                : defOpenAI,
            anthropic: loaded.anthropic
                ? {
                    ...defAnthropic,
                    ...loaded.anthropic,
                    apiKey: findToken('anthropic') || loaded.anthropic.apiKey || '',
                    model: loaded.anthropic.model || defAnthropic.model
                }
                : defAnthropic,
            antigravity: loaded.antigravity
                ? {
                    ...defAntigravity,
                    ...loaded.antigravity,
                    connected: loaded.antigravity.connected ?? defAntigravity.connected,
                    token: findToken('antigravity') || loaded.antigravity.token || ''
                }
                : defAntigravity,
            copilot: loaded.copilot
                ? {
                    ...defCopilot,
                    ...loaded.copilot,
                    connected: loaded.copilot.connected ?? defCopilot.connected,
                    token: findToken('copilot') || findToken('github') || loaded.copilot.token || ''
                }
                : defCopilot,
            groq: loaded.groq
                ? {
                    ...defGroq,
                    ...loaded.groq,
                    apiKey: findToken('groq') || loaded.groq.apiKey || '',
                    model: loaded.groq.model || defGroq.model
                }
                : defGroq,
            proxy: {
                ...defProxy,
                ...(loaded.proxy || {}),
                enabled: loaded.proxy?.enabled ?? defProxy.enabled,
                url: loaded.proxy?.url || defProxy.url,
                key: findToken('proxy') || loaded.proxy?.key || ''
            },
            window: loaded.window
        };

        this.migrateDeprecatedSettings(res);

        return res;
    }

    private migrateDeprecatedSettings(settings: AppSettings): void {
        const embeddings = settings.embeddings as { provider: string; model?: string } | undefined;
        if (embeddings && (embeddings.provider === 'antigravity' || embeddings.provider === 'gemini')) {
            appLogger.info('SettingsService', 'Migrating deprecated embedding provider to Ollama');
            settings.embeddings.provider = 'ollama';
            settings.embeddings.model = 'all-minilm';
        }
    }

    /**
     * Attempt to recover valid JSON from potentially corrupted data.
     * Returns null if recovery is not possible.
     */
    private attemptJsonRecovery(data: string): { data: Partial<AppSettings>; wasModified: boolean } | null {
        // Strategy: Find where the root JSON object ends by tracking brace depth
        // This handles: trailing garbage, incomplete writes, BOM issues

        // Remove BOM if present
        const cleanData = data.replace(/^\uFEFF/, '')

        // Find the start of JSON object
        const startIndex = cleanData.indexOf('{')
        if (startIndex < 0) { return null }

        // Parse character by character to find valid JSON end
        let depth = 0
        let inString = false
        let escapeNext = false
        let endIndex = -1

        for (let i = startIndex; i < cleanData.length; i++) {
            const char = cleanData[i]

            if (escapeNext) {
                escapeNext = false
                continue
            }

            if (char === '\\' && inString) {
                escapeNext = true
                continue
            }

            if (char === '"' && !escapeNext) {
                inString = !inString
                continue
            }

            if (inString) { continue }

            if (char === '{') { depth++ }
            else if (char === '}') {
                depth--
                if (depth === 0) {
                    endIndex = i
                    break
                }
            }
        }

        if (endIndex < 0) { return null }

        const jsonCandidate = cleanData.substring(startIndex, endIndex + 1)
        const wasModified = endIndex < cleanData.length - 1 || startIndex > 0

        try {
            const parsed = JSON.parse(jsonCandidate) as Partial<AppSettings>
            return { data: parsed, wasModified }
        } catch {
            return null
        }
    }

    getSettings(): AppSettings {
        return this.settings
    }

    getSettingsPath(): string {
        return this.settingsPath
    }

    async saveSettings(newSettings: Partial<AppSettings>): Promise<AppSettings> {
        // Handle concurrent save attempts by queuing
        if (this.saveInProgress) {
            // Merge with pending save or create new pending
            this.pendingSave = this.pendingSave
                ? { ...this.pendingSave, ...newSettings }
                : newSettings
            appLogger.info('SettingsService', 'Save in progress, queuing update')
            return this.settings
        }

        this.saveInProgress = true
        // Deep merge logic extracted to deepMergeSettings
        // Using strict property initialization for settings updates

        const newKeys = Object.keys(newSettings);
        appLogger.info('SettingsService', `saveSettings: Called with ${newKeys.length} keys: ${newKeys.join(', ')}`);

        // TOKEN CONSERVATION:
        // When the renderer saves settings, it often has empty strings for tokens (secrets).
        // We must prevent these from overwriting the real tokens already in memory.
        if (this.authService) {
            this.preserveSensitiveTokens(newSettings);
        }

        this.settings = this.deepMergeSettings(this.settings, newSettings) as AppSettings;

        // Secure Storage Logic
        if (this.authService) {
            appLogger.info('SettingsService', 'saveSettings: Processing secure storage.');
            const tokens: Record<string, string | undefined> = {
                github_token: newSettings.github?.token,
                copilot_token: newSettings.copilot?.token,
                antigravity_token: newSettings.antigravity?.token,
                openai_key: newSettings.openai?.apiKey,
                anthropic_key: newSettings.anthropic?.apiKey,

                groq_key: newSettings.groq?.apiKey,
                proxy_key: (newSettings.proxy?.key && newSettings.proxy.key !== 'connected') ? newSettings.proxy.key : undefined
            };

            for (const [key, val] of Object.entries(tokens)) {
                if (val) {
                    void this.authService.saveToken(key, val);
                }
            }
        }

        try {
            // Create a copy to save that doesn't have the secrets
            const settingsToSave = JSON.parse(JSON.stringify(this.settings))

            // Strip secrets if AuthService is active
            if (this.authService) {
                if (settingsToSave.github) { settingsToSave.github.token = '' }
                if (settingsToSave.openai) { settingsToSave.openai.apiKey = '' }
                if (settingsToSave.anthropic) { settingsToSave.anthropic.apiKey = '' }

                if (settingsToSave.groq) { settingsToSave.groq.apiKey = '' }
                // Using undefined for optional properties
                if (settingsToSave.antigravity) { settingsToSave.antigravity.token = undefined }
                if (settingsToSave.copilot) { settingsToSave.copilot.token = undefined }
                if (settingsToSave.proxy && settingsToSave.proxy.key !== 'connected') {
                    settingsToSave.proxy.key = ''
                }
            }

            // Use atomic write: write to temp file first, then rename
            // This prevents corruption if the process crashes during write
            const tempPath = this.settingsPath + '.tmp'
            const jsonString = JSON.stringify(settingsToSave, null, 2)

            // Validate JSON before writing
            try {
                JSON.parse(jsonString) // Verify it's valid JSON
            } catch (parseError) {
                appLogger.error('SettingsService', `Generated invalid JSON, aborting save: ${getErrorMessage(parseError as Error)}`)
                throw new Error('Generated invalid JSON during save')
            }

            await fs.promises.writeFile(tempPath, jsonString, 'utf8')
            await fs.promises.rename(tempPath, this.settingsPath)
        } catch (error) {
            appLogger.error('SettingsService', `Failed to save settings: ${getErrorMessage(error as Error)}`)
            // Try to remove temp file if it exists
            try {
                const tempPath = this.settingsPath + '.tmp'
                await fs.promises.unlink(tempPath).catch(() => { })
            } catch {
                // Ignore cleanup errors
            }
        } finally {
            this.saveInProgress = false

            // Process any pending saves that accumulated while we were saving
            if (this.pendingSave) {
                const pending = this.pendingSave
                this.pendingSave = null
                // Use setImmediate to avoid stack overflow with rapid saves
                setImmediate(() => {
                    void this.saveSettings(pending)
                })
            }
        }

        return this.settings
    }

    /**
     * Force reload settings from disk.
     * Useful after external modifications or suspected corruption.
     */
    async reloadSettings(): Promise<AppSettings> {
        this.settings = await this.loadSettings()
        return this.settings
    }

    private findTokenInAuth(authTokens: Record<string, string>, provider: string, fallbackKeys: string[] = []): string {
        const providers: Record<string, string[]> = {
            github: ['proxy-auth-token', 'proxy_auth_token', 'github_token', 'github', 'github.token', 'github_token.json'],
            copilot: ['proxy-auth-token', 'proxy_auth_token', 'copilot_token', 'copilot', 'copilot.token', 'copilot_token.json'],
            antigravity: ['antigravity_token', 'antigravity']
        };

        const searchKeys = [...(providers[provider] || [provider + '_token', provider + '_key', provider]), ...fallbackKeys];

        for (const key of searchKeys) {
            if (authTokens[key]) {
                return authTokens[key];
            }
        }

        const fuzzyKey = Object.keys(authTokens).find(k => k.startsWith(provider + '-'));
        if (fuzzyKey) {
            return authTokens[fuzzyKey];
        }

        return '';
    }

    private deepMergeSettings(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
        if (!source) { return target; }
        const res = { ...target };
        for (const key of Object.keys(source)) {
            if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                res[key] = { ...((target[key] as any) || {}), ...source[key] };
            } else {
                res[key] = source[key];
            }
        }
        return res;
    }

    private preserveSensitiveTokens(newSettings: Partial<AppSettings>): void {
        const preserveToken = (provider: keyof AppSettings, field: string = 'token') => {
            const newProv = newSettings[provider] as Record<string, unknown> | undefined;
            const oldProv = this.settings[provider] as Record<string, unknown> | undefined;
            if (newProv && oldProv && !newProv[field] && oldProv[field]) {
                appLogger.info('SettingsService', `saveSettings: Conserving existing ${String(provider)} token.`);
                newProv[field] = oldProv[field];
            }
        };

        preserveToken('github');
        preserveToken('copilot');
        preserveToken('antigravity');
        preserveToken('openai', 'apiKey');
        preserveToken('anthropic', 'apiKey');
        preserveToken('groq', 'apiKey');
        preserveToken('proxy', 'key');
    }
}
