
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

export interface AppSettings {
    ollama: {
        url: string
        numCtx?: number
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
    }
    gemini?: {
        apiKey: string
    }
    groq?: {
        apiKey: string
    }
    userAvatar?: string
    aiAvatar?: string
    proxy?: {
        enabled: boolean
        url: string
        key: string
        authStoreKey: string
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
    userAvatar?: string
    aiAvatar?: string
}

const DEFAULT_SETTINGS: AppSettings = {
    ollama: {
        url: 'http://127.0.0.1:11434',
        numCtx: 16384
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
    antigravity: {
        connected: false
    },
    copilot: {
        connected: false
    },
    gemini: {
        apiKey: '',
        model: 'gemini-1.5-pro'
    },
    groq: {
        apiKey: '',
        model: 'llama3-70b-8192'
    },
    anthropic: {
        apiKey: ''
    },
    gemini: {
        apiKey: ''
    },
    groq: {
        apiKey: ''
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

export class SettingsService {
    private settingsPath: string
    private settings: AppSettings

    constructor() {
        this.settingsPath = path.join(app.getPath('userData'), 'settings.json')
        this.settings = this.loadSettings()
    }

    private loadSettings(): AppSettings {
        try {
            if (fs.existsSync(this.settingsPath)) {
                const data = fs.readFileSync(this.settingsPath, 'utf8')
                const loaded = JSON.parse(data)
                delete loaded.userAvatar
                delete loaded.aiAvatar
                return {
                    ...DEFAULT_SETTINGS,
                    ...loaded,
                    ollama: { ...DEFAULT_SETTINGS.ollama, ...(loaded.ollama || {}) },
                    general: { ...DEFAULT_SETTINGS.general, ...(loaded.general || {}) },
                    github: { ...DEFAULT_SETTINGS.github, ...(loaded.github || {}) },
                    openai: { ...DEFAULT_SETTINGS.openai, ...(loaded.openai || {}) },
                    anthropic: { ...DEFAULT_SETTINGS.anthropic, ...(loaded.anthropic || {}) },
                    antigravity: { ...DEFAULT_SETTINGS.antigravity, ...(loaded.antigravity || {}) },
                    copilot: { ...DEFAULT_SETTINGS.copilot, ...(loaded.copilot || {}) },
                    gemini: { ...DEFAULT_SETTINGS.gemini, ...(loaded.gemini || {}) },
                    groq: { ...DEFAULT_SETTINGS.groq, ...(loaded.groq || {}) },
                    proxy: { ...DEFAULT_SETTINGS.proxy, ...(loaded.proxy || {}) },
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

    saveSettings(newSettings: Partial<AppSettings>): AppSettings {
        this.settings = { ...this.settings, ...newSettings }

        // Deep merge for nested objects if needed, but for now simple spread is okay 
        // if we send full objects or handle partial deeper. 
        // Actually, let's do a basic deep merge for 2nd level keys manually for safety
        if (newSettings.ollama) {
            this.settings.ollama = { ...this.settings.ollama, ...newSettings.ollama }
        }
        if (newSettings.general) {
            this.settings.general = { ...this.settings.general, ...newSettings.general }
        }
        if (newSettings.github) {
            this.settings.github = { ...this.settings.github, ...newSettings.github }
        }
        if (newSettings.openai) {
            this.settings.openai = { ...this.settings.openai, ...newSettings.openai }
        }
        if (newSettings.anthropic) {
            this.settings.anthropic = { ...this.settings.anthropic, ...newSettings.anthropic }
        }
        if (newSettings.gemini) {
            this.settings.gemini = { ...this.settings.gemini, ...newSettings.gemini }
        }
        if (newSettings.groq) {
            this.settings.groq = { ...this.settings.groq, ...newSettings.groq }
        }
        if (newSettings.proxy) {
            this.settings.proxy = { ...this.settings.proxy, ...newSettings.proxy }
        }

        try {
            fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2))
        } catch (error) {
            console.error('Failed to save settings:', error)
        }

        return this.settings
    }
}
