export interface ImageGenerationOptions {
    prompt: string
    negativePrompt?: string
    width?: number
    height?: number
    steps?: number
    cfgScale?: number
    seed?: number
    count?: number
}

export interface ImageEditOptions {
    sourceImage: string
    mode: 'img2img' | 'inpaint' | 'outpaint' | 'style-transfer'
    prompt: string
    negativePrompt?: string
    strength?: number
    width?: number
    height?: number
    maskImage?: string
}

export interface ImageGenerationRecord {
    id: string
    provider: ImageProvider
    prompt: string
    negativePrompt?: string
    width: number
    height: number
    steps: number
    cfgScale: number
    seed: number
    imagePath: string
    createdAt: number
    source?: 'generate' | 'edit' | 'schedule' | 'batch'
}

export type ImageSchedulePriority = 'low' | 'normal' | 'high'
export type ImageResourceProfile = 'balanced' | 'quality' | 'speed'

export interface ImageGenerationPreset {
    id: string
    name: string
    promptPrefix?: string
    width: number
    height: number
    steps: number
    cfgScale: number
    provider?: ImageProvider
    createdAt: number
    updatedAt: number
}

export interface ComfyWorkflowTemplate {
    id: string
    name: string
    description?: string
    workflow: Record<string, RuntimeValue>
    createdAt: number
    updatedAt: number
}

export interface ImageScheduleTask {
    id: string
    runAt: number
    options: ImageGenerationOptions
    priority: ImageSchedulePriority
    resourceProfile: ImageResourceProfile
    status: 'scheduled' | 'running' | 'completed' | 'failed' | 'canceled'
    createdAt: number
    updatedAt: number
    resultPath?: string
    error?: string
}

export interface ImageComparisonResult {
    ids: string[]
    comparedAt: number
    entries: Array<{
        id: string
        path: string
        width: number
        height: number
        steps: number
        cfgScale: number
        seed: number
        prompt: string
        fileSizeBytes: number
        bytesPerPixel: number
    }>
    summary: {
        averageFileSizeBytes: number
        averageBytesPerPixel: number
        largestFileId?: string
        smallestFileId?: string
    }
}

export type ImageProvider = 'antigravity' | 'ollama' | 'sd-webui' | 'comfyui' | 'sd-cpp'

export interface AntigravityAccount {
    id: string
    email?: string
    accessToken: string
    hasQuota: boolean
    quotaPercentage: number
}

export interface AntigravityUpstreamQuotaResponse {
    models: Record<string, import('@main/services/proxy/quota.service').QuotaModel>;
}

export interface GitHubReleaseAsset {
    name: string;
    browser_download_url: string;
}

export interface GitHubRelease {
    assets?: GitHubReleaseAsset[];
}

export interface LocalImageServiceDeps {
    settingsService: import('@main/services/system/settings.service').SettingsService;
    eventBusService?: import('@main/services/system/event-bus.service').EventBusService;
    authService?: import('@main/services/security/auth.service').AuthService;
    llmService?: import('@main/services/llm/llm.service').LLMService;
    quotaService?: import('@main/services/proxy/quota.service').QuotaService;
    telemetryService?: import('@main/services/analysis/telemetry.service').TelemetryService;
}

export interface GenerationQueueItem {
    id: string;
    options: ImageGenerationOptions;
    source: 'batch' | 'schedule';
    priority: ImageSchedulePriority;
    resourceProfile: ImageResourceProfile;
    enqueuedAt: number;
    resolve: (value: string) => void;
    reject: (error: Error) => void;
}
