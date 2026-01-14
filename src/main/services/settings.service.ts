
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { appLogger } from '@main/logging/logger'
import { getErrorMessage } from '@shared/utils/error.util'

import { AppSettings } from '@shared/types/settings'

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

import { DataService } from '@main/services/data/data.service'
import { AuthService } from '@main/services/auth.service'
import { BaseService } from '@main/services/base.service'

export class SettingsService extends BaseService {
    private settingsPath: string
    private settings: AppSettings
    private saveInProgress: boolean = false
    private pendingSave: Partial<AppSettings> | null = null

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

        // We load settings in constructor to ensure they are available immediately
        // as many services depend on them during their own construction/init
        this.settings = this.loadSettings()
    }

    /**
     * Load settings from the settings file.
     *
     * @returns The loaded settings merged with defaults
     */
    private loadSettings(): AppSettings {
        appLogger.info('SettingsService', `loadSettings (authService=${!!this.authService})`);
        try {
            const exists = fs.existsSync(this.settingsPath);
            let loaded: Partial<AppSettings> = {};
            if (exists) {
                appLogger.info('SettingsService', `Found settings file at ${this.settingsPath}`);
                let data = fs.readFileSync(this.settingsPath, 'utf8')

                // Check for empty or whitespace-only file
                if (!data || !data.trim()) {
                    appLogger.warn('SettingsService', 'Settings file is empty, using defaults');
                    loaded = {}
                } else {
                    try {
                        loaded = JSON.parse(data) as Partial<AppSettings>;
                    } catch (parseError) {
                        appLogger.warn('SettingsService', 'JSON.parse failed, attempting recovery...');

                        // Smart recovery: find where valid JSON ends
                        // This handles cases where garbage was appended or write was interrupted
                        const recovered = this.attemptJsonRecovery(data)

                        if (recovered) {
                            loaded = recovered.data
                            appLogger.info('SettingsService', 'JSON recovery successful');

                            // Only backup and rewrite if we actually had to truncate something
                            if (recovered.wasModified) {
                                try {
                                    const backupPath = this.settingsPath + '.recovered.' + Date.now()
                                    fs.writeFileSync(backupPath, data, 'utf8')
                                    appLogger.info('SettingsService', `Backed up original to: ${backupPath}`)
                                    fs.writeFileSync(this.settingsPath, JSON.stringify(loaded, null, 2), 'utf8')
                                } catch (backupError) {
                                    appLogger.warn('SettingsService', `Failed to backup: ${getErrorMessage(backupError as Error)}`);
                                }
                            }
                        } else {
                            // True corruption - backup and use defaults
                            appLogger.error('SettingsService', 'JSON recovery failed, using defaults');
                            try {
                                const backupPath = this.settingsPath + '.corrupted.' + Date.now()
                                fs.writeFileSync(backupPath, data, 'utf8')
                                appLogger.info('SettingsService', `Backed up corrupted file to: ${backupPath}`)
                            } catch (e) {
                                // Ignore backup failures
                            }
                            loaded = {}
                        }
                    }
                }

                if (loaded.userAvatar) delete loaded.userAvatar;
                if (loaded.aiAvatar) delete loaded.aiAvatar;
            } else {
                appLogger.info('SettingsService', `settings.json NOT FOUND at ${this.settingsPath}`);
            }

            // Merge tokens from AuthService (always do this if authService is available)
            let authTokens: Record<string, string> = {}
            if (this.authService) {
                authTokens = this.authService.getAllTokens()
                appLogger.info('SettingsService', `Loaded auth tokens. Keys: ${Object.keys(authTokens)}`)
                if (authTokens['copilot_token']) {
                    appLogger.info('SettingsService', `Found copilot_token, length: ${authTokens['copilot_token'].length}`)
                }
                if (authTokens['github_token']) {
                    appLogger.info('SettingsService', `Found github_token, length: ${authTokens['github_token'].length}`)
                }
            }

            // Helper for fuzzy token lookup
            const findToken = (provider: string, fallbackKeys: string[] = []): string => {
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
            };

            const res: AppSettings = {
                ...DEFAULT_SETTINGS,
                ...loaded,
                ollama: { ...DEFAULT_SETTINGS.ollama, ...(loaded.ollama || {}) },
                autoUpdate: loaded.autoUpdate
                    ? { ...DEFAULT_SETTINGS.autoUpdate, ...loaded.autoUpdate }
                    : DEFAULT_SETTINGS.autoUpdate,
                general: { ...DEFAULT_SETTINGS.general, ...(loaded.general || {}) },
                github: {
                    ...DEFAULT_SETTINGS.github,
                    ...(loaded.github || {}),
                    token: findToken('github') || loaded.github?.token || ''
                },
                openai: loaded.openai
                    ? {
                        ...DEFAULT_SETTINGS.openai!,
                        ...loaded.openai,
                        apiKey: findToken('openai') || loaded.openai.apiKey || '',
                        model: loaded.openai.model || DEFAULT_SETTINGS.openai!.model
                    }
                    : DEFAULT_SETTINGS.openai!,
                anthropic: loaded.anthropic
                    ? {
                        ...DEFAULT_SETTINGS.anthropic!,
                        ...loaded.anthropic,
                        apiKey: findToken('anthropic') || loaded.anthropic.apiKey || '',
                        model: loaded.anthropic.model || DEFAULT_SETTINGS.anthropic!.model
                    }
                    : DEFAULT_SETTINGS.anthropic!,
                antigravity: loaded.antigravity
                    ? {
                        ...DEFAULT_SETTINGS.antigravity!,
                        ...loaded.antigravity,
                        connected: loaded.antigravity.connected ?? DEFAULT_SETTINGS.antigravity!.connected,
                        token: findToken('antigravity') || loaded.antigravity.token || ''
                    }
                    : DEFAULT_SETTINGS.antigravity!,
                copilot: loaded.copilot
                    ? {
                        ...DEFAULT_SETTINGS.copilot!,
                        ...loaded.copilot,
                        connected: loaded.copilot.connected ?? DEFAULT_SETTINGS.copilot!.connected,
                        token: findToken('copilot') || findToken('github') || loaded.copilot.token || ''
                    }
                    : DEFAULT_SETTINGS.copilot!,
                groq: loaded.groq
                    ? {
                        ...DEFAULT_SETTINGS.groq!,
                        ...loaded.groq,
                        apiKey: findToken('groq') || loaded.groq.apiKey || '',
                        model: loaded.groq.model || DEFAULT_SETTINGS.groq!.model
                    }
                    : DEFAULT_SETTINGS.groq!,
                proxy: {
                    ...DEFAULT_SETTINGS.proxy!,
                    ...(loaded.proxy || {}),
                    enabled: loaded.proxy?.enabled ?? DEFAULT_SETTINGS.proxy!.enabled,
                    url: loaded.proxy?.url || DEFAULT_SETTINGS.proxy!.url,
                    key: findToken('proxy') || loaded.proxy?.key || ''
                },
                window: loaded.window
            };

            if ((res.embeddings?.provider as any) === 'antigravity' || (res.embeddings?.provider as any) === 'gemini') {
                appLogger.info('SettingsService', 'Migrating deprecated embedding provider to Ollama');
                res.embeddings.provider = 'ollama';
                res.embeddings.model = 'all-minilm';
            }

            return res;
        } catch (error) {
            appLogger.error('SettingsService', `!!! loadSettings CRITICAL ERROR: ${getErrorMessage(error as Error)}`);
            return DEFAULT_SETTINGS;
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
        let cleanData = data.replace(/^\uFEFF/, '')

        // Find the start of JSON object
        const startIndex = cleanData.indexOf('{')
        if (startIndex < 0) return null

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

            if (inString) continue

            if (char === '{') depth++
            else if (char === '}') {
                depth--
                if (depth === 0) {
                    endIndex = i
                    break
                }
            }
        }

        if (endIndex < 0) return null

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

    saveSettings(newSettings: Partial<AppSettings>): AppSettings {
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
        const deepMerge = (target: Record<string, unknown>, source: Record<string, unknown>) => {
            if (!source) return target;
            const res = { ...target };
            for (const key of Object.keys(source)) {
                if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    res[key] = { ...((target[key] as any) || {}), ...source[key] };
                } else {
                    res[key] = source[key];
                }
            }
            return res;
        };

        const newKeys = Object.keys(newSettings);
        appLogger.info('SettingsService', `saveSettings: Called with ${newKeys.length} keys: ${newKeys.join(', ')}`);

        // TOKEN CONSERVATION:
        // When the renderer saves settings, it often has empty strings for tokens (secrets).
        // We must prevent these from overwriting the real tokens already in memory.
        if (this.authService) {
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

        this.settings = deepMerge(this.settings, newSettings) as AppSettings;

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
                    this.authService.saveToken(key, val);
                }
            }
        }

        try {
            // Create a copy to save that doesn't have the secrets
            const settingsToSave = JSON.parse(JSON.stringify(this.settings))

            // Strip secrets if AuthService is active
            if (this.authService) {
                if (settingsToSave.github) settingsToSave.github.token = ''
                if (settingsToSave.openai) settingsToSave.openai.apiKey = ''
                if (settingsToSave.anthropic) settingsToSave.anthropic.apiKey = ''

                if (settingsToSave.groq) settingsToSave.groq.apiKey = ''
                // Using undefined for optional properties
                if (settingsToSave.antigravity) settingsToSave.antigravity.token = undefined
                if (settingsToSave.copilot) settingsToSave.copilot.token = undefined
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

            fs.writeFileSync(tempPath, jsonString, 'utf8')
            fs.renameSync(tempPath, this.settingsPath)
        } catch (error) {
            appLogger.error('SettingsService', `Failed to save settings: ${getErrorMessage(error as Error)}`)
            // Try to remove temp file if it exists
            try {
                const tempPath = this.settingsPath + '.tmp'
                if (fs.existsSync(tempPath)) {
                    fs.unlinkSync(tempPath)
                }
            } catch (cleanupError) {
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
                    this.saveSettings(pending)
                })
            }
        }

        return this.settings
    }

    /**
     * Force reload settings from disk.
     * Useful after external modifications or suspected corruption.
     */
    reloadSettings(): AppSettings {
        this.settings = this.loadSettings()
        return this.settings
    }
}
