
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

export interface AppSettings {
    ollama: {
        url: string
        numCtx?: number
        orchestrationPolicy?: 'auto' | 'fifo' | 'parallel'
    }
    embeddings: {
        provider: 'ollama' | 'openai' | 'llama' | 'none'
        model?: string
    }
    autoUpdate?: {
        enabled: boolean
        checkOnStartup: boolean
        downloadAutomatically: boolean
        notifyOnly: boolean
    }
    crashReporting?: {
        enabled: boolean
    }
    general: {
        language: 'tr' | 'en'
        theme: string
        resolution: string
        fontSize: number
        fontFamily?: string
        defaultModel?: string
        lastModel?: string
        lastProvider?: string
        responseStyle?: 'concise' | 'balanced' | 'detailed'
        responseTone?: 'neutral' | 'friendly' | 'professional'
        responseFormat?: 'auto' | 'structured' | 'steps'
        customInstructions?: string
        contextMessageLimit?: number
        agentMode?: 'adaptive' | 'speed' | 'accuracy'
        agentSoftDeadlineMs?: number
        agentHardDeadlineMs?: number
        agentRequireLocalForActions?: boolean
        agentAllowLateSuggestions?: boolean
        favoriteModels?: string[]
        recentModels?: string[]
        hiddenModels?: string[]
    }
    github?: {
        username?: string
        token?: string
    }
    openai?: {
        apiKey: string
        model: string
    }
    anthropic?: {
        apiKey: string
        model: string
    }
    gemini?: {
        apiKey: string
        model: string
    }
    groq?: {
        apiKey: string
        model: string
    }
    antigravity?: {
        connected: boolean
        token?: string
    }
    copilot?: {
        connected: boolean
        token?: string
    }
    userAvatar?: string
    aiAvatar?: string
    proxy?: {
        enabled: boolean
        url: string
        key: string
        authStoreKey?: string
    }
    window?: {
        width: number
        height: number
        x: number
        y: number
    }
    mcpDisabledServers?: string[]
    mcpUserServers?: any[]
    mcpSecurityAllowedHosts?: string[]
    mcpReviewPolicy?: 'elevated' | 'trusted'
    mcpAutoExecuteSafe?: boolean
}

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
    gemini: {
        apiKey: '',
        model: 'gemini-1.5-pro'
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

import { DataService } from './data.service'
import { AuthService } from './auth.service'

export class SettingsService {
    private settingsPath: string
    private settings: AppSettings

    constructor(
        dataService?: DataService,
        private authService?: AuthService
    ) {
        if (dataService) {
            this.settingsPath = path.join(dataService.getPath('config'), 'settings.json')
        } else {
            // Fallback for tests or simplified usage, though in main we pass it.
            this.settingsPath = path.join(app.getPath('userData'), 'settings.json')
        }
        this.settings = this.loadSettings()
    }

    private loadSettings(): AppSettings {
        try {
            if (fs.existsSync(this.settingsPath)) {
                const data = fs.readFileSync(this.settingsPath, 'utf8')
                const loaded = JSON.parse(data)
                delete loaded.userAvatar
                delete loaded.aiAvatar

                // Merge tokens from AuthService
                let authTokens: Record<string, string> = {}
                if (this.authService) {
                    authTokens = this.authService.getAllTokens()
                }

                return {
                    ...DEFAULT_SETTINGS,
                    ...loaded,
                    ollama: { ...DEFAULT_SETTINGS.ollama, ...(loaded.ollama || {}) },
                    autoUpdate: { ...DEFAULT_SETTINGS.autoUpdate, ...(loaded.autoUpdate || {}) },
                    general: { ...DEFAULT_SETTINGS.general, ...(loaded.general || {}) },
                    github: {
                        ...DEFAULT_SETTINGS.github,
                        ...(loaded.github || {}),
                        token: authTokens['github_token'] || loaded.github?.token || ''
                    },
                    openai: {
                        ...DEFAULT_SETTINGS.openai,
                        ...(loaded.openai || {}),
                        apiKey: authTokens['openai_key'] || loaded.openai?.apiKey || ''
                    },
                    anthropic: {
                        ...DEFAULT_SETTINGS.anthropic,
                        ...(loaded.anthropic || {}),
                        apiKey: authTokens['anthropic_key'] || loaded.anthropic?.apiKey || ''
                    },
                    antigravity: {
                        ...DEFAULT_SETTINGS.antigravity,
                        ...(loaded.antigravity || {}),
                        token: authTokens['antigravity_token'] || loaded.antigravity?.token
                    },
                    copilot: {
                        ...DEFAULT_SETTINGS.copilot,
                        ...(loaded.copilot || {}),
                        token: authTokens['copilot_token'] || loaded.copilot?.token
                    },
                    gemini: {
                        ...DEFAULT_SETTINGS.gemini,
                        ...(loaded.gemini || {}),
                        apiKey: authTokens['gemini_key'] || loaded.gemini?.apiKey || ''
                    },
                    groq: {
                        ...DEFAULT_SETTINGS.groq,
                        ...(loaded.groq || {}),
                        apiKey: authTokens['groq_key'] || loaded.groq?.apiKey || ''
                    },
                    proxy: {
                        ...DEFAULT_SETTINGS.proxy,
                        ...(loaded.proxy || {}),
                        key: authTokens['proxy_key'] || loaded.proxy?.key || ''
                    },
                    window: { ...DEFAULT_SETTINGS.window, ...(loaded.window || {}) }
                }
            }
        } catch (error) {
            console.error('Failed to load settings:', error)
        }
        return DEFAULT_SETTINGS
    }

    getSettings(): AppSettings {
        return this.settings
    }

    getSettingsPath(): string {
        return this.settingsPath
    }

    saveSettings(newSettings: Partial<AppSettings>): AppSettings {
        this.settings = { ...this.settings, ...newSettings }

        // Deep merge logic (simplified for brevity, ensuring objects exist) (KEEP EXISTING MERGE LOGIC)
        if (newSettings.ollama) this.settings.ollama = { ...this.settings.ollama, ...newSettings.ollama }
        if (newSettings.autoUpdate) this.settings.autoUpdate = { ...this.settings.autoUpdate, ...newSettings.autoUpdate }
        if (newSettings.general) this.settings.general = { ...this.settings.general, ...newSettings.general }
        if (newSettings.github) this.settings.github = { ...this.settings.github, ...newSettings.github }
        if (newSettings.openai) this.settings.openai = { ...this.settings.openai, ...newSettings.openai }
        if (newSettings.anthropic) this.settings.anthropic = { ...this.settings.anthropic, ...newSettings.anthropic }
        if (newSettings.gemini) this.settings.gemini = { ...this.settings.gemini, ...newSettings.gemini }
        if (newSettings.groq) this.settings.groq = { ...this.settings.groq, ...newSettings.groq }
        if (newSettings.proxy) this.settings.proxy = { ...this.settings.proxy, ...newSettings.proxy }

        // Secure Storage Logic
        if (this.authService) {

            // GitHub
            if (this.settings.github?.token) {
                this.authService.saveToken('github_token', this.settings.github.token)
            }
            // OpenAI
            if (this.settings.openai?.apiKey) {
                this.authService.saveToken('openai_key', this.settings.openai.apiKey)
            }
            // Anthropic
            if (this.settings.anthropic?.apiKey) {
                this.authService.saveToken('anthropic_key', this.settings.anthropic.apiKey)
            }
            // Gemini
            if (this.settings.gemini?.apiKey) {
                this.authService.saveToken('gemini_key', this.settings.gemini.apiKey)
            }
            // Groq
            if (this.settings.groq?.apiKey) {
                this.authService.saveToken('groq_key', this.settings.groq.apiKey)
            }
            // Antigravity
            if (this.settings.antigravity?.token) {
                this.authService.saveToken('antigravity_token', this.settings.antigravity.token)
            }
            // Copilot
            if (this.settings.copilot?.token) {
                this.authService.saveToken('copilot_token', this.settings.copilot.token)
            }
            // Proxy Key
            if (this.settings.proxy?.key && this.settings.proxy.key !== 'connected') {
                this.authService.saveToken('proxy_key', this.settings.proxy.key)
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
                if (settingsToSave.gemini) settingsToSave.gemini.apiKey = ''
                if (settingsToSave.groq) settingsToSave.groq.apiKey = ''
                if (settingsToSave.antigravity) settingsToSave.antigravity.token = undefined
                if (settingsToSave.copilot) settingsToSave.copilot.token = undefined
                // Proxy key might be needed for non-auth purposes? It's usually 'connected' or a real key. 
                // If it's a real key, we saved it. If it's 'connected', we leave it.
                if (settingsToSave.proxy && settingsToSave.proxy.key !== 'connected') {
                    settingsToSave.proxy.key = ''
                }
            }

            fs.writeFileSync(this.settingsPath, JSON.stringify(settingsToSave, null, 2))
        } catch (error) {
            console.error('Failed to save settings:', error)
        }

        return this.settings
    }
}
