import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

export interface AppSettings {
    ollama: {
        url: string
    }
    general: {
        language: 'tr' | 'en'
        theme: 'dark' | 'light'
    }
    github?: {
        username: string
        token: string
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
    }
}

const DEFAULT_SETTINGS: AppSettings = {
    ollama: {
        url: 'http://127.0.0.1:11434'
    },
    general: {
        language: 'tr',
        theme: 'dark'
    },
    github: {
        username: '',
        token: ''
    },
    openai: {
        apiKey: '',
        model: 'gpt-3.5-turbo'
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
    userAvatar: '👤',
    aiAvatar: '🤖'
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
                return { ...DEFAULT_SETTINGS, ...JSON.parse(data) }
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
