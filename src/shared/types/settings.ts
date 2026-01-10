import { JsonValue } from './common'

export type AppSettings = {
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
        highContrast?: boolean
        onboardingCompleted: boolean
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
        accessToken?: string // For web session auth
        email?: string
        model: string
    }
    claude?: {
        apiKey: string
        model: string
    }
    anthropic?: {
        apiKey: string
        model: string
    }

    groq?: {
        apiKey: string
        model: string
    }
    huggingface?: {
        apiKey: string
    }
    antigravity?: {
        connected: boolean
        token?: string
    }
    codex?: {
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
    speech?: {
        voiceURI?: string
        rate?: number
        audioInputDeviceId?: string
        audioOutputDeviceId?: string
    }
    personas?: {
        id: string
        name: string
        description: string
        prompt: string
    }[]
    window?: {
        width: number
        height: number
        x: number
        y: number
    }
    modelSettings?: Record<string, {
        systemPrompt?: string
        presetId?: string
    }>
    presets?: Array<{
        id: string
        name: string
        temperature: number
        topP: number
        frequencyPenalty: number
        presencePenalty: number
        maxTokens: number
    }>
    mcpDisabledServers?: string[]
    mcpUserServers?: MCPServerConfig[]
    mcpSecurityAllowedHosts?: string[]
    mcpReviewPolicy?: 'elevated' | 'trusted'
    mcpAutoExecuteSafe?: boolean
    [key: string]: JsonValue | undefined
}

export type MCPServerConfig = {
    name: string
    command: string
    args: string[]
    description?: string
    env?: Record<string, string>
    disabled?: boolean
    tools?: { name: string; description: string }[]
}

export type AccountQuotaInfo = {
    authExpired?: boolean
    files?: Array<{ provider: string; type?: string; name?: string }>
    [key: string]: JsonValue | undefined
}
