
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { getErrorMessage } from '../../shared/utils/error.util'

import { AppSettings } from '../../shared/types/settings'

const DEFAULT_SETTINGS: AppSettings = {
    ollama: {
        url: 'http://127.0.0.1:11434',
        numCtx: 16384,
        orchestrationPolicy: 'auto'
    },
    embeddings: {
        provider: 'none',
        model: 'all-minilm' // fallback/legacy
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

import { DataService } from './data/data.service'
import { AuthService } from './auth.service'
import { BaseService } from './base.service'

export class SettingsService extends BaseService {
    private settingsPath: string
    private settings: AppSettings

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

    private loadSettings(): AppSettings {
        console.log(`[SettingsService] !!! loadSettings START !!! (authService=${!!this.authService})`);
        try {
            const exists = fs.existsSync(this.settingsPath);
            let loaded: any = {};
            if (exists) {
                console.log(`[SettingsService] !!! Found settings file at ${this.settingsPath}`);
                const data = fs.readFileSync(this.settingsPath, 'utf8')

                try {
                    loaded = JSON.parse(data);
                } catch (e) {
                    console.warn('[SettingsService] Initial JSON.parse FAILED, trying recovery...');
                    const lastBrace = data.lastIndexOf('}');
                    if (lastBrace !== -1) {
                        try {
                            loaded = JSON.parse(data.substring(0, lastBrace + 1));
                            console.log('[SettingsService] JSON recovery SUCCESSFUL!');
                        } catch (e2) {
                            console.error('[SettingsService] JSON recovery FAILED:', getErrorMessage(e2));
                        }
                    }
                }

                if (!loaded) {
                    throw new Error('Could not parse settings.json even after recovery attempt');
                }

                if (loaded.userAvatar) delete loaded.userAvatar;
                if (loaded.aiAvatar) delete loaded.aiAvatar;
            } else {
                console.log(`[SettingsService] !!! settings.json NOT FOUND at ${this.settingsPath}`);
            }

            // Merge tokens from AuthService (always do this if authService is available)
            let authTokens: Record<string, string> = {}
            if (this.authService) {
                authTokens = this.authService.getAllTokens()
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
                autoUpdate: { ...DEFAULT_SETTINGS.autoUpdate, ...(loaded.autoUpdate || {}) },
                general: { ...DEFAULT_SETTINGS.general, ...(loaded.general || {}) },
                github: {
                    ...DEFAULT_SETTINGS.github,
                    ...(loaded.github || {}),
                    token: findToken('github') || loaded.github?.token || ''
                },
                openai: {
                    ...DEFAULT_SETTINGS.openai,
                    ...(loaded.openai || {}),
                    apiKey: findToken('openai') || loaded.openai?.apiKey || ''
                },
                anthropic: {
                    ...DEFAULT_SETTINGS.anthropic,
                    ...(loaded.anthropic || {}),
                    apiKey: findToken('anthropic') || loaded.anthropic?.apiKey || ''
                },
                antigravity: {
                    ...DEFAULT_SETTINGS.antigravity,
                    ...(loaded.antigravity || {}),
                    token: findToken('antigravity') || loaded.antigravity?.token || ''
                },
                copilot: {
                    ...DEFAULT_SETTINGS.copilot,
                    ...(loaded.copilot || {}),
                    token: findToken('copilot') || findToken('github') || loaded.copilot?.token || ''
                },

                groq: {
                    ...DEFAULT_SETTINGS.groq,
                    ...(loaded.groq || {}),
                    apiKey: findToken('groq') || loaded.groq?.apiKey || ''
                },
                proxy: {
                    ...DEFAULT_SETTINGS.proxy,
                    ...(loaded.proxy || {}),
                    key: findToken('proxy') || loaded.proxy?.key || ''
                },
                window: { ...DEFAULT_SETTINGS.window, ...(loaded.window || {}) }
            };
            return res;
        } catch (error) {
            console.error('[SettingsService] !!! loadSettings CRITICAL ERROR:', getErrorMessage(error as Error));
            return DEFAULT_SETTINGS;
        }
    }

    getSettings(): AppSettings {
        return this.settings
    }

    getSettingsPath(): string {
        return this.settingsPath
    }

    saveSettings(newSettings: Partial<AppSettings>): AppSettings {
        const deepMerge = (target: Record<string, unknown>, source: Record<string, unknown>) => {
            if (!source) return target;
            const res = { ...target };
            for (const key of Object.keys(source)) {
                if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    res[key] = { ...(target[key] || {}), ...source[key] };
                } else {
                    res[key] = source[key];
                }
            }
            return res;
        };

        const newKeys = Object.keys(newSettings);
        console.log(`[SettingsService] saveSettings: Called with ${newKeys.length} keys: ${newKeys.join(', ')}`);

        // TOKEN CONSERVATION:
        // When the renderer saves settings, it often has empty strings for tokens (secrets).
        // We must prevent these from overwriting the real tokens already in memory.
        if (this.authService) {
            const preserveToken = (provider: keyof AppSettings, field: string = 'token') => {
                const newProv = newSettings[provider] as Record<string, unknown> | undefined;
                const oldProv = this.settings[provider] as Record<string, unknown> | undefined;
                if (newProv && oldProv && !newProv[field] && oldProv[field]) {
                    console.log(`[SettingsService] saveSettings: Conserving existing ${String(provider)} token.`);
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
            console.log(`[SettingsService] saveSettings: Processing secure storage.`);
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

            fs.writeFileSync(this.settingsPath, JSON.stringify(settingsToSave, null, 2))
        } catch (error) {
            console.error('Failed to save settings:', getErrorMessage(error as Error))
        }

        return this.settings
    }
}
