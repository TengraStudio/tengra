import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { TelemetryService } from '@main/services/analysis/telemetry.service';
import { BaseService } from '@main/services/base.service';
import { LinkedAccount } from '@main/services/data/database.service';
import { LLMService } from '@main/services/llm/llm.service';
import { QuotaModel, QuotaService } from '@main/services/proxy/quota.service';
import { AuthService } from '@main/services/security/auth.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { SettingsService } from '@main/services/system/settings.service';
import { getErrorMessage } from '@shared/utils/error.util';
import axios from 'axios';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';

interface AntigravityUpstreamQuotaResponse {
    models: Record<string, QuotaModel>;
}

interface GitHubReleaseAsset {
    name: string;
    browser_download_url: string;
}

interface GitHubRelease {
    assets?: GitHubReleaseAsset[];
}

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
    workflow: Record<string, unknown>
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

export type ImageProvider = 'antigravity' | 'ollama' | 'sd-webui' | 'comfyui' | 'pollinations' | 'sd-cpp'

interface AntigravityAccount {
    id: string
    email?: string
    accessToken: string
    hasQuota: boolean
    quotaPercentage: number
}

export interface LocalImageServiceDeps {
    settingsService: SettingsService;
    eventBusService?: EventBusService;
    authService?: AuthService;
    llmService?: LLMService;
    quotaService?: QuotaService;
    telemetryService?: TelemetryService;
}

export class LocalImageService extends BaseService {
    private static readonly ERROR_CODES = {
        SDCPP_FALLBACK_TRIGGERED: 'LOCAL_IMAGE_SDCPP_FALLBACK_TRIGGERED',
        POLLINATIONS_FAILURE: 'LOCAL_IMAGE_POLLINATIONS_FAILURE',
    } as const;
    private static readonly PERFORMANCE_BUDGET = {
        statusCheckMs: 300,
        generationFallbackMs: 5000,
        queueDepthWarnThreshold: 25,
    } as const;
    private static readonly UI_MESSAGE_KEYS = {
        ready: 'serviceHealth.localImage.ready',
        empty: 'serviceHealth.localImage.empty',
        failure: 'serviceHealth.localImage.failure',
    } as const;
    private readonly RETRY_POLICY = {
        networkAttempts: 2,
        networkDelayMs: 300,
    } as const;
    private sdCppRuntimePromise: Promise<{ binaryPath: string; modelPath: string }> | null = null;
    private readonly storageRoot: string = path.join(app.getPath('userData'), 'ai', 'images');
    private readonly historyPath: string = path.join(this.storageRoot, 'generation-history.json');
    private readonly presetsPath: string = path.join(this.storageRoot, 'generation-presets.json');
    private readonly schedulePath: string = path.join(this.storageRoot, 'generation-schedule.json');
    private readonly workflowTemplatesPath: string = path.join(this.storageRoot, 'comfy-workflow-templates.json');
    private generationHistory: ImageGenerationRecord[] = [];
    private generationPresets: ImageGenerationPreset[] = [];
    private comfyWorkflowTemplates: ComfyWorkflowTemplate[] = [];
    private scheduleTasks: ImageScheduleTask[] = [];
    private scheduleTimers: Map<string, NodeJS.Timeout> = new Map();
    private generationQueue: Array<{
        id: string;
        options: ImageGenerationOptions;
        source: 'batch' | 'schedule';
        priority: ImageSchedulePriority;
        resourceProfile: ImageResourceProfile;
        enqueuedAt: number;
        resolve: (value: string) => void;
        reject: (error: Error) => void;
    }> = [];
    private queueRunning = false;
    private generationDurationsMs: number[] = [];
    private settingsService: SettingsService;
    private eventBusService?: EventBusService;
    private authService?: AuthService;
    private llmService?: LLMService;
    private quotaService?: QuotaService;
    private telemetryService?: TelemetryService;

    private static readonly SD_CPP_RELEASE_API =
        'https://api.github.com/repos/leejet/stable-diffusion.cpp/releases/latest';
    private static readonly DEFAULT_SDCPP_MODEL_URL =
        'https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors?download=true';

    constructor(deps: LocalImageServiceDeps) {
        super('LocalImageService');
        this.settingsService = deps.settingsService;
        this.eventBusService = deps.eventBusService;
        this.authService = deps.authService;
        this.llmService = deps.llmService;
        this.quotaService = deps.quotaService;
        this.telemetryService = deps.telemetryService;
    }

    /**
     * Initialize the service.
     * Triggers non-blocking SD-CPP readiness check if it's the preferred provider.
     */
    override async initialize(): Promise<void> {
        this.logInfo('Initializing LocalImageService');

        // Cleanup stale temp files
        void this.cleanupStaleTempFiles().catch(err => {
            this.logWarn('Failed to cleanup stale temp files', err);
        });
        await this.ensureImageStorageReady();
        await this.loadImageState();
        this.restoreScheduledTasks();

        const settings = this.settingsService.getSettings();
        const preferredProvider = settings.images?.provider;

        if (preferredProvider === 'sd-cpp') {
            this.logInfo('SD-CPP is the preferred provider, starting non-blocking readiness check...');
            void this.ensureSDCppReady().catch(err => {
                this.logError('Non-blocking SD-CPP readiness check failed', err);
            });
        }
    }

    private async cleanupStaleTempFiles(): Promise<void> {
        const tempDir = path.join(process.cwd(), 'temp', 'generated');
        if (await this.pathExists(tempDir)) {
            const files = await fs.promises.readdir(tempDir);
            const failedFiles: string[] = [];
            for (const file of files) {
                const filePath = path.join(tempDir, file);
                try {
                    await fs.promises.unlink(filePath);
                } catch (error) {
                    failedFiles.push(filePath);
                    this.logWarn(`Failed to remove stale temp file ${filePath}: ${getErrorMessage(error as Error)}`);
                }
            }
            if (failedFiles.length > 0) {
                throw new Error(`Failed to cleanup ${failedFiles.length} stale temp files`);
            }
            this.logDebug(`Cleaned up ${files.length} stale temp files`);
        }
    }

    private async ensureImageStorageReady(): Promise<void> {
        await fs.promises.mkdir(this.storageRoot, { recursive: true });
        if (!(await this.pathExists(this.historyPath))) {
            await fs.promises.writeFile(this.historyPath, JSON.stringify([], null, 2), 'utf-8');
        }
        if (!(await this.pathExists(this.presetsPath))) {
            await fs.promises.writeFile(this.presetsPath, JSON.stringify([], null, 2), 'utf-8');
        }
        if (!(await this.pathExists(this.schedulePath))) {
            await fs.promises.writeFile(this.schedulePath, JSON.stringify([], null, 2), 'utf-8');
        }
        if (!(await this.pathExists(this.workflowTemplatesPath))) {
            await fs.promises.writeFile(this.workflowTemplatesPath, JSON.stringify([], null, 2), 'utf-8');
        }
    }

    private async loadImageState(): Promise<void> {
        try {
            const [historyRaw, presetsRaw, scheduleRaw, workflowRaw] = await Promise.all([
                fs.promises.readFile(this.historyPath, 'utf-8'),
                fs.promises.readFile(this.presetsPath, 'utf-8'),
                fs.promises.readFile(this.schedulePath, 'utf-8'),
                fs.promises.readFile(this.workflowTemplatesPath, 'utf-8')
            ]);
            this.generationHistory = JSON.parse(historyRaw) as ImageGenerationRecord[];
            this.generationPresets = JSON.parse(presetsRaw) as ImageGenerationPreset[];
            this.scheduleTasks = this.normalizeScheduleTasks(JSON.parse(scheduleRaw) as ImageScheduleTask[]);
            this.comfyWorkflowTemplates = JSON.parse(workflowRaw) as ComfyWorkflowTemplate[];
        } catch (error) {
            this.logWarn('Failed to load image state, resetting to defaults', error as Error);
            this.generationHistory = [];
            this.generationPresets = [];
            this.scheduleTasks = [];
            this.comfyWorkflowTemplates = [];
        }
    }

    private async persistImageState(): Promise<void> {
        await fs.promises.mkdir(this.storageRoot, { recursive: true });
        await Promise.all([
            fs.promises.writeFile(this.historyPath, JSON.stringify(this.generationHistory.slice(-1000), null, 2), 'utf-8'),
            fs.promises.writeFile(this.presetsPath, JSON.stringify(this.generationPresets.slice(-300), null, 2), 'utf-8'),
            fs.promises.writeFile(this.schedulePath, JSON.stringify(this.scheduleTasks.slice(-500), null, 2), 'utf-8'),
            fs.promises.writeFile(
                this.workflowTemplatesPath,
                JSON.stringify(this.comfyWorkflowTemplates.slice(-120), null, 2),
                'utf-8'
            )
        ]);
    }

    private normalizeScheduleTasks(tasks: ImageScheduleTask[]): ImageScheduleTask[] {
        return tasks.map(task => ({
            ...task,
            priority: task.priority ?? 'normal',
            resourceProfile: task.resourceProfile ?? 'balanced'
        }));
    }

    private emitStatus(state: 'installing' | 'ready' | 'failed', error?: string): void {
        if (this.eventBusService) {
            this.eventBusService.emit('sd-cpp:status', { state, error });
        }
        this.logInfo(`sd-cpp status changed to: ${state}${error ? ` (${error})` : ''}`);
    }

    private emitProgress(downloaded: number, total: number, filename: string): void {
        if (this.eventBusService) {
            this.eventBusService.emit('sd-cpp:progress', { downloaded, total, filename });
        }
    }

    private assertNonEmptyText(value: string, fieldName: string): void {
        if (typeof value !== 'string' || value.trim().length === 0) {
            throw new Error(`${fieldName} is required`);
        }
    }

    /**
     * Generate an image using available providers
     * Priority: Antigravity (with quota) > Pollinations > Other local providers
     */
    async generateImage(
        options: ImageGenerationOptions,
        source: 'generate' | 'edit' | 'schedule' | 'batch' = 'generate'
    ): Promise<string> {
        const startedAt = Date.now();
        const normalizedOptions = this.normalizeGenerationOptions(options);
        this.assertNonEmptyText(normalizedOptions.prompt, 'Prompt');
        const settings = this.settingsService.getSettings();
        const preferredProvider = (settings.images?.provider ?? 'antigravity') as ImageProvider;

        this.logInfo(`Generating image with preferred provider: ${preferredProvider}`);

        // Try Antigravity first if available
        let generatedPath: string | null = null;
        if (this.authService && this.llmService && this.quotaService) {
            const result = await this.tryGenerateWithAntigravity(normalizedOptions);
            if (result) {
                generatedPath = result;
            }
        }

        if (!generatedPath) {
            // Fallback to preferred provider or Pollinations
            this.logInfo(`Falling back to ${preferredProvider === 'antigravity' ? 'pollinations' : preferredProvider}`);
            try {
                generatedPath = await this.generateWithProvider(preferredProvider, normalizedOptions);
            } catch (error) {
                if (preferredProvider === 'sd-cpp') {
                    this.logWarn('SD-CPP generation failed, falling back to Pollinations', error as Error);
                    this.trackSdCppMetric('sd-cpp-fallback-triggered', {
                        errorCode: LocalImageService.ERROR_CODES.SDCPP_FALLBACK_TRIGGERED,
                        error: getErrorMessage(error as Error),
                    });
                    generatedPath = await this.generateWithPollinations(normalizedOptions);
                } else {
                    throw error;
                }
            }
        }

        await this.recordGeneration({
            provider: preferredProvider,
            options: normalizedOptions,
            imagePath: generatedPath,
            source
        });
        this.recordGenerationDuration(Date.now() - startedAt);
        return generatedPath;
    }

    private normalizeGenerationOptions(options: ImageGenerationOptions): ImageGenerationOptions {
        const width = options.width ?? 1024;
        const height = options.height ?? 1024;
        const maxPixels = this.getMaxPixelBudget();
        const currentPixels = width * height;
        if (currentPixels <= maxPixels) {
            return options;
        }

        const scale = Math.sqrt(maxPixels / currentPixels);
        const normalizedWidth = Math.max(256, Math.floor(width * scale / 64) * 64);
        const normalizedHeight = Math.max(256, Math.floor(height * scale / 64) * 64);
        this.trackSdCppMetric('image-resolution-normalized', {
            originalWidth: width,
            originalHeight: height,
            normalizedWidth,
            normalizedHeight
        });

        return {
            ...options,
            width: normalizedWidth,
            height: normalizedHeight
        };
    }

    private getMaxPixelBudget(): number {
        const imagesSettings = this.settingsService.getSettings().images as Record<string, unknown> | undefined;
        const configured = imagesSettings?.maxPixels;
        if (typeof configured === 'number' && Number.isFinite(configured) && configured > 100_000) {
            return configured;
        }
        return 2_359_296; // 1536x1536
    }

    private recordGenerationDuration(durationMs: number): void {
        if (!Number.isFinite(durationMs) || durationMs <= 0) {
            return;
        }
        this.generationDurationsMs.push(durationMs);
        if (this.generationDurationsMs.length > 100) {
            this.generationDurationsMs = this.generationDurationsMs.slice(-100);
        }
    }

    private async generateWithProvider(provider: string, options: ImageGenerationOptions): Promise<string> {
        switch (provider) {
            case 'ollama':
                return this.generateWithOllama(options);
            case 'sd-webui':
                return this.generateWithSDWebUI(options);
            case 'sd-cpp':
                return this.generateWithSDCpp(options);
            case 'comfyui':
                return this.generateWithComfyUI(options);
            case 'pollinations':
            case 'antigravity': // Antigravity failed, use pollinations
            default:
                return this.generateWithPollinations(options);
        }
    }

    private async recordGeneration(input: {
        provider: ImageProvider;
        options: ImageGenerationOptions;
        imagePath: string;
        source: 'generate' | 'edit' | 'schedule' | 'batch';
    }): Promise<void> {
        const record: ImageGenerationRecord = {
            id: uuidv4(),
            provider: input.provider,
            prompt: input.options.prompt,
            negativePrompt: input.options.negativePrompt,
            width: input.options.width ?? 1024,
            height: input.options.height ?? 1024,
            steps: input.options.steps ?? 24,
            cfgScale: input.options.cfgScale ?? 7,
            seed: typeof input.options.seed === 'number' ? input.options.seed : -1,
            imagePath: input.imagePath,
            source: input.source,
            createdAt: Date.now()
        };
        this.generationHistory.push(record);
        if (this.generationHistory.length > 1000) {
            this.generationHistory = this.generationHistory.slice(-1000);
        }
        await this.persistImageState();
    }

    /**
     * Find an Antigravity account with available quota for gemini-3-pro-image
     */
    private async getAntigravityAccountWithQuota(): Promise<AntigravityAccount | null> {
        if (!this.authService || !this.quotaService) {
            return null;
        }

        try {
            const allAccounts = await this.authService.getAllAccountsFull();
            const antigravityAccounts = allAccounts.filter(a =>
                a.provider.startsWith('antigravity') || a.provider.startsWith('google')
            );

            if (antigravityAccounts.length === 0) {
                this.logInfo('No Antigravity accounts found');
                return null;
            }

            this.logInfo(`Found ${antigravityAccounts.length} Antigravity account(s), checking quota...`);

            // Check quota for each account
            for (const account of antigravityAccounts) {
                const result = await this.checkAccountQuota(account);
                if (result) { return result; }
            }

            this.logWarn('No Antigravity accounts with sufficient quota');
            return null;
        } catch (error) {
            this.logError(`Failed to get Antigravity account: ${getErrorMessage(error as Error)}`);
            return null;
        }
    }

    private async checkAccountQuota(account: LinkedAccount): Promise<AntigravityAccount | null> {
        if (!account.accessToken) {
            this.logDebug(`Skipping account ${account.email ?? account.id}: no access token`);
            return null;
        }

        const quotaInfo = await this.fetchImageQuota(account);
        if (!quotaInfo) {
            return null;
        }

        // Calculate quota percentage
        const quotaPercentage = this.calculateQuotaPercentage(quotaInfo);

        // Return account if it has quota (>5%)
        if (quotaPercentage > 5) {
            this.logInfo(`Account ${account.email ?? account.id} has ${quotaPercentage}% quota remaining`);
            return {
                id: account.id,
                email: account.email,
                accessToken: account.accessToken,
                hasQuota: true,
                quotaPercentage
            };
        } else {
            this.logWarn(`Account ${account.email ?? account.id} quota too low: ${quotaPercentage}%`);
        }
        return null;
    }

    private async fetchImageQuota(account: LinkedAccount): Promise<{ remainingFraction?: number; remainingQuota?: number; totalQuota?: number } | null> {
        try {
            if (!this.quotaService) {
                throw new Error('QuotaService not available');
            }
            const response = await this.quotaService.fetchAntigravityUpstreamForToken(account) as AntigravityUpstreamQuotaResponse;

            if (!response?.models) {
                this.logDebug(`No quota data for account ${account.email ?? account.id}`);
                return null;
            }

            const models = response.models;
            const imageModel = this.extractImageModel(models);

            if (!imageModel) {
                this.logDebug(`Account ${account.email ?? account.id} doesn't have image model access`);
                return null;
            }

            return imageModel.quotaInfo ?? null;
        } catch (error) {
            this.logError(`Failed to check quota for ${account.email ?? account.id}: ${getErrorMessage(error as Error)}`);
            return null;
        }
    }

    private async tryGenerateWithAntigravity(options: ImageGenerationOptions): Promise<string | null> {
        try {
            const account = await this.getAntigravityAccountWithQuota();
            if (account) {
                this.logInfo(`Using Antigravity account: ${account.email ?? account.id} (quota: ${account.quotaPercentage}%)`);
                return await this.generateWithAntigravity(options, account);
            } else {
                this.logInfo('No Antigravity accounts with available quota');
            }
        } catch (error) {
            this.logWarn(`Antigravity failed, falling back: ${getErrorMessage(error as Error)}`);
        }
        return null;
    }

    private calculateQuotaPercentage(quotaInfo: { remainingFraction?: number; remainingQuota?: number; totalQuota?: number } | undefined): number {
        if (!quotaInfo) {
            return 100;
        }
        if (typeof quotaInfo.remainingFraction === 'number') {
            return Math.round(quotaInfo.remainingFraction * 100);
        }
        if (typeof quotaInfo.remainingQuota === 'number' && typeof quotaInfo.totalQuota === 'number' && quotaInfo.totalQuota > 0) {
            return Math.round((quotaInfo.remainingQuota / quotaInfo.totalQuota) * 100);
        }
        return 100;
    }

    private extractImageModel(models: Record<string, QuotaModel>): QuotaModel | null {
        if ('gemini-3-pro-image' in models) { return models['gemini-3-pro-image']; }
        if ('imagen-3.0-generate-001' in models) { return models['imagen-3.0-generate-001']; }
        return null;
    }

    /**
     * Generate image using Antigravity's gemini-3-pro-image model
     */
    private async generateWithAntigravity(options: ImageGenerationOptions, account: AntigravityAccount): Promise<string> {
        if (!this.llmService) {
            throw new Error('LLMService not available for Antigravity generation');
        }

        try {
            const { prompt } = options;
            this.logInfo(`Calling Antigravity image generation with account ${account.email ?? account.id}`);

            // Call Antigravity image generation via LLMService
            const response = await this.llmService.chat(
                [{
                    role: 'user',
                    content: prompt
                }],
                'antigravity-gemini-3-pro-image',
                [],
                'antigravity'
            );

            if (response.images && response.images.length > 0) {
                this.logInfo(`Antigravity generated ${response.images.length} image(s)`);
                return response.images[0];
            }

            throw new Error('No images returned from Antigravity');
        } catch (error) {
            this.logError(`Antigravity generation failed: ${getErrorMessage(error as Error)}`);
            throw error;
        }
    }

    private async generateWithPollinations(options: ImageGenerationOptions): Promise<string> {
        const { prompt, width = 1024, height = 1024, seed = Math.floor(Math.random() * 1000000) } = options;
        const model = 'flux';
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&model=${model}&nologo=true`;

        try {
            const response = await this.executeWithRetry(
                () => axios.get(url, { responseType: 'arraybuffer' }),
                this.RETRY_POLICY.networkAttempts
            );
            return this.saveTempImage(Buffer.from(response.data));
        } catch (error) {
            this.logError('Pollinations generation failed', error as Error);
            throw new Error(
                `[${LocalImageService.ERROR_CODES.POLLINATIONS_FAILURE}] Pollinations failure: ${getErrorMessage(error as Error)}`
            );
        }
    }

    private async executeWithRetry<T>(operation: () => Promise<T>, maxAttempts: number): Promise<T> {
        let lastError: Error | null = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
                return await operation();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < maxAttempts) {
                    await this.delay(this.RETRY_POLICY.networkDelayMs);
                }
            }
        }
        throw (lastError ?? new Error('Unknown retry failure'));
    }

    private async generateWithOllama(options: ImageGenerationOptions): Promise<string> {
        const settings = this.settingsService.getSettings();
        const model = settings.images?.ollamaModel ?? 'stable-diffusion-v1-5';
        const baseUrl = settings.ollama.url;

        try {
            await axios.post(`${baseUrl}/api/generate`, {
                model,
                prompt: options.prompt,
                stream: false
            });

            throw new Error('Ollama dedicated image generation is still in experimental community support. Please use SD-WebUI or Pollinations.');
        } catch (error) {
            this.logError('Ollama generation failed', error as Error);
            throw error;
        }
    }

    private async generateWithSDWebUI(options: ImageGenerationOptions): Promise<string> {
        const settings = this.settingsService.getSettings();
        const baseUrl = settings.images?.sdWebUIUrl ?? 'http://127.0.0.1:7860';

        try {
            const body = this.buildSDRequestBody(options);
            const response = await axios.post(`${baseUrl}/sdapi/v1/txt2img`, body);

            if (response.data.images && response.data.images.length > 0) {
                const base64Data = response.data.images[0];
                const buffer = Buffer.from(base64Data, 'base64');
                return this.saveTempImage(buffer);
            }
            throw new Error('No image returned from SD-WebUI');
        } catch (error) {
            this.logError('SD-WebUI generation failed', error as Error);
            throw error;
        }
    }

    private buildSDRequestBody(options: ImageGenerationOptions): Record<string, unknown> {
        return {
            prompt: options.prompt,
            negative_prompt: options.negativePrompt ?? 'text, watermark, low quality',
            steps: options.steps ?? 20,
            cfg_scale: options.cfgScale ?? 7,
            width: options.width ?? 512,
            height: options.height ?? 512,
            seed: options.seed ?? -1
        };
    }

    private async generateWithComfyUI(options: ImageGenerationOptions): Promise<string> {
        const settings = this.settingsService.getSettings();
        const baseUrl = settings.images?.comfyUIUrl ?? 'http://127.0.0.1:8188';
        const workflow = this.resolveComfyWorkflow(options);

        interface ComfyPromptResponse {
            prompt_id?: string;
        }

        const queued = await axios.post<ComfyPromptResponse>(`${baseUrl}/prompt`, {
            prompt: workflow
        });
        const promptId = queued.data.prompt_id;
        if (!promptId) {
            throw new Error('ComfyUI did not return prompt_id');
        }

        let imageRef: { filename: string; subfolder: string; type: string };
        try {
            imageRef = await this.waitForComfyImageViaWebSocket(baseUrl, promptId);
        } catch (error) {
            this.logWarn(`ComfyUI WebSocket tracking failed, falling back to history polling: ${getErrorMessage(error as Error)}`);
            imageRef = await this.waitForComfyImage(baseUrl, promptId);
        }
        const imageResponse = await axios.get<ArrayBuffer>(`${baseUrl}/view`, {
            params: {
                filename: imageRef.filename,
                subfolder: imageRef.subfolder,
                type: imageRef.type
            },
            responseType: 'arraybuffer'
        });

        return this.saveTempImage(Buffer.from(imageResponse.data));
    }

    private resolveComfyWorkflow(options: ImageGenerationOptions): Record<string, unknown> {
        const settingsImages = this.settingsService.getSettings().images as Record<string, unknown> | undefined;
        const selectedTemplateId =
            typeof settingsImages?.comfyUIWorkflowTemplateId === 'string'
                ? settingsImages.comfyUIWorkflowTemplateId
                : undefined;
        const selectedTemplate = selectedTemplateId
            ? this.comfyWorkflowTemplates.find(template => template.id === selectedTemplateId)
            : undefined;

        if (selectedTemplate) {
            return this.applyComfyWorkflowPlaceholders(selectedTemplate.workflow, options);
        }

        if (typeof settingsImages?.comfyUIWorkflowJson === 'string' && settingsImages.comfyUIWorkflowJson.trim()) {
            try {
                const parsed = JSON.parse(settingsImages.comfyUIWorkflowJson) as Record<string, unknown>;
                return this.applyComfyWorkflowPlaceholders(parsed, options);
            } catch (error) {
                this.logWarn(`Invalid custom ComfyUI workflow JSON, using default template: ${getErrorMessage(error as Error)}`);
            }
        }

        return this.buildComfyWorkflow(options);
    }

    private applyComfyWorkflowPlaceholders(
        workflow: Record<string, unknown>,
        options: ImageGenerationOptions
    ): Record<string, unknown> {
        const seed = typeof options.seed === 'number' ? options.seed : Math.floor(Math.random() * 1_000_000);
        const replacements: Record<string, string | number> = {
            prompt: options.prompt,
            negative_prompt: options.negativePrompt ?? 'low quality, blurry, artifacts',
            width: options.width ?? 1024,
            height: options.height ?? 1024,
            steps: options.steps ?? 24,
            cfg_scale: options.cfgScale ?? 7,
            seed,
            batch_size: Math.max(1, Math.min(options.count ?? 1, 8))
        };

        const clone = JSON.parse(JSON.stringify(workflow)) as Record<string, unknown>;
        return this.replaceWorkflowTokens(clone, replacements) as Record<string, unknown>;
    }

    private replaceWorkflowTokens(
        value: unknown,
        replacements: Record<string, string | number>
    ): unknown {
        if (typeof value === 'string') {
            const exact = value.match(/^{{([a-z_]+)}}$/);
            if (exact?.[1] && replacements[exact[1]] !== undefined) {
                return replacements[exact[1]];
            }
            let updated = value;
            Object.entries(replacements).forEach(([key, replacement]) => {
                updated = updated.split(`{{${key}}}`).join(String(replacement));
            });
            return updated;
        }
        if (Array.isArray(value)) {
            return value.map(item => this.replaceWorkflowTokens(item, replacements));
        }
        if (value && typeof value === 'object') {
            const objectValue = value as Record<string, unknown>;
            const next: Record<string, unknown> = {};
            Object.entries(objectValue).forEach(([key, nestedValue]) => {
                next[key] = this.replaceWorkflowTokens(nestedValue, replacements);
            });
            return next;
        }
        return value;
    }

    private buildComfyWorkflow(options: ImageGenerationOptions): Record<string, unknown> {
        const width = options.width ?? 1024;
        const height = options.height ?? 1024;
        const steps = options.steps ?? 24;
        const cfg = options.cfgScale ?? 7;
        const seed = typeof options.seed === 'number' ? options.seed : Math.floor(Math.random() * 1_000_000);
        return {
            '1': {
                class_type: 'CheckpointLoaderSimple',
                inputs: {
                    ckpt_name: 'v1-5-pruned-emaonly.safetensors'
                }
            },
            '2': {
                class_type: 'CLIPTextEncode',
                inputs: {
                    text: options.prompt,
                    clip: ['1', 1]
                }
            },
            '3': {
                class_type: 'CLIPTextEncode',
                inputs: {
                    text: options.negativePrompt ?? 'low quality, blurry, artifacts',
                    clip: ['1', 1]
                }
            },
            '4': {
                class_type: 'EmptyLatentImage',
                inputs: {
                    width,
                    height,
                    batch_size: Math.max(1, Math.min(options.count ?? 1, 4))
                }
            },
            '5': {
                class_type: 'KSampler',
                inputs: {
                    seed,
                    steps,
                    cfg,
                    sampler_name: 'euler',
                    scheduler: 'normal',
                    denoise: 1,
                    model: ['1', 0],
                    positive: ['2', 0],
                    negative: ['3', 0],
                    latent_image: ['4', 0]
                }
            },
            '6': {
                class_type: 'VAEDecode',
                inputs: {
                    samples: ['5', 0],
                    vae: ['1', 2]
                }
            },
            '7': {
                class_type: 'SaveImage',
                inputs: {
                    filename_prefix: 'tengra',
                    images: ['6', 0]
                }
            }
        };
    }

    private async waitForComfyImage(
        baseUrl: string,
        promptId: string
    ): Promise<{ filename: string; subfolder: string; type: string }> {
        interface ComfyImageOutput {
            filename?: string;
            subfolder?: string;
            type?: string;
        }
        interface ComfyHistoryPayload {
            [key: string]: {
                outputs?: Record<string, { images?: ComfyImageOutput[] }>;
            };
        }

        const maxAttempts = 60;
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            const response = await axios.get<ComfyHistoryPayload>(`${baseUrl}/history/${promptId}`);
            const history = response.data[promptId];
            if (!history?.outputs) {
                await this.delay(1000);
                continue;
            }

            const nodes = Object.values(history.outputs);
            for (const node of nodes) {
                const image = node.images?.[0];
                if (image?.filename) {
                    return {
                        filename: image.filename,
                        subfolder: image.subfolder ?? '',
                        type: image.type ?? 'output'
                    };
                }
            }

            await this.delay(1000);
        }

        throw new Error('Timed out waiting for ComfyUI result');
    }

    private getComfyWebSocketUrl(baseUrl: string): string {
        const parsed = new URL(baseUrl);
        const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${parsed.host}/ws`;
    }

    private async waitForComfyImageViaWebSocket(
        baseUrl: string,
        promptId: string
    ): Promise<{ filename: string; subfolder: string; type: string }> {
        interface ComfyWsOutputImage {
            filename?: string;
            subfolder?: string;
            type?: string;
        }
        interface ComfyWsOutput {
            images?: ComfyWsOutputImage[];
        }
        interface ComfyWsPayload {
            type?: string;
            data?: {
                prompt_id?: string;
                output?: ComfyWsOutput;
            };
        }

        const webSocketUrl = this.getComfyWebSocketUrl(baseUrl);
        const timeoutMs = 90_000;
        const socket = new WebSocket(webSocketUrl);

        return await new Promise((resolve, reject) => {
            let settled = false;
            const timeout = setTimeout(() => {
                if (settled) {
                    return;
                }
                settled = true;
                socket.close();
                reject(new Error('Timed out waiting for ComfyUI WebSocket result'));
            }, timeoutMs);

            const resolveImage = (image: ComfyWsOutputImage): void => {
                if (settled || !image.filename) {
                    return;
                }
                settled = true;
                clearTimeout(timeout);
                socket.close();
                resolve({
                    filename: image.filename,
                    subfolder: image.subfolder ?? '',
                    type: image.type ?? 'output'
                });
            };

            socket.on('error', (error: Error) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timeout);
                reject(error);
            });

            socket.on('message', (rawMessage: WebSocket.RawData) => {
                if (settled) {
                    return;
                }

                const rawText = Buffer.isBuffer(rawMessage)
                    ? rawMessage.toString()
                    : Array.isArray(rawMessage)
                        ? Buffer.concat(rawMessage).toString()
                        : rawMessage.toString();

                let payload: ComfyWsPayload;
                try {
                    payload = JSON.parse(rawText) as ComfyWsPayload;
                } catch {
                    return;
                }

                if (payload.type !== 'executed') {
                    return;
                }

                if (payload.data?.prompt_id !== promptId) {
                    return;
                }

                const image = payload.data?.output?.images?.[0];
                if (!image?.filename) {
                    return;
                }

                resolveImage(image);
            });
        });
    }

    private async generateWithSDCpp(options: ImageGenerationOptions): Promise<string> {
        const runtime = await this.ensureSDCppReady();
        const extraArgs = this.parseCliArgs(
            this.settingsService.getSettings().images?.sdCppExtraArgs?.trim() ||
            process.env.SD_CPP_EXTRA_ARGS?.trim()
        );
        const outputPath = this.createTempOutputPath('png');

        await this.ensurePathExists(runtime.modelPath, 'stable-diffusion.cpp model');
        await this.ensurePathExists(runtime.binaryPath, 'stable-diffusion.cpp binary');

        const args = [
            '-m',
            runtime.modelPath,
            '-p',
            options.prompt,
            '-o',
            outputPath,
            '-W',
            String(options.width ?? 1024),
            '-H',
            String(options.height ?? 1024),
            '--steps',
            String(options.steps ?? 24),
            '--cfg-scale',
            String(options.cfgScale ?? 7),
        ];

        if (options.negativePrompt) {
            args.push('--negative-prompt', options.negativePrompt);
        }
        if (typeof options.seed === 'number') {
            args.push('--seed', String(options.seed));
        }

        args.push(...extraArgs);

        this.logInfo(`Running stable-diffusion.cpp with binary "${runtime.binaryPath}"`);
        try {
            await this.runProcess(runtime.binaryPath, args);
            if (!fs.existsSync(outputPath)) {
                throw new Error('stable-diffusion.cpp finished but did not produce an output file.');
            }
            this.trackSdCppMetric('sd-cpp-generation-success', { prompt: options.prompt });
            return outputPath;
        } catch (error) {
            this.trackSdCppMetric('sd-cpp-generation-failure', { error: getErrorMessage(error as Error) });
            throw error;
        }
    }

    async editImage(options: ImageEditOptions): Promise<string> {
        this.assertNonEmptyText(options.prompt, 'Prompt');
        this.assertNonEmptyText(options.sourceImage, 'Source image');
        const settings = this.settingsService.getSettings();
        const provider = (settings.images?.provider ?? 'antigravity') as ImageProvider;

        let imagePath: string;
        if (provider === 'sd-webui') {
            imagePath = await this.editWithSDWebUI(options);
        } else {
            const modePrefix = options.mode === 'style-transfer'
                ? 'Style transfer'
                : options.mode === 'inpaint'
                    ? 'Inpaint'
                    : options.mode === 'outpaint'
                        ? 'Outpaint'
                        : 'Image to image';
            imagePath = await this.generateWithProvider(provider, {
                prompt: `${modePrefix}: ${options.prompt}`,
                negativePrompt: options.negativePrompt,
                width: options.width,
                height: options.height,
                steps: 24,
                cfgScale: 7
            });
        }

        await this.recordGeneration({
            provider,
            options: {
                prompt: options.prompt,
                negativePrompt: options.negativePrompt,
                width: options.width,
                height: options.height,
                steps: 24,
                cfgScale: 7
            },
            imagePath,
            source: 'edit'
        });

        return imagePath;
    }

    private async editWithSDWebUI(options: ImageEditOptions): Promise<string> {
        const settings = this.settingsService.getSettings();
        const baseUrl = settings.images?.sdWebUIUrl ?? 'http://127.0.0.1:7860';
        const initImage = await this.readImageAsBase64(options.sourceImage);
        const maskImage = options.maskImage ? await this.readImageAsBase64(options.maskImage) : undefined;

        const payload: Record<string, unknown> = {
            prompt: options.prompt,
            negative_prompt: options.negativePrompt ?? 'text, watermark, artifacts',
            init_images: [initImage],
            denoising_strength: options.strength ?? 0.55,
            steps: 24,
            cfg_scale: 7,
            width: options.width ?? 1024,
            height: options.height ?? 1024
        };

        if (maskImage && (options.mode === 'inpaint' || options.mode === 'outpaint')) {
            payload.mask = maskImage;
            payload.inpainting_fill = options.mode === 'outpaint' ? 1 : 0;
        }

        const response = await axios.post<{ images?: string[] }>(`${baseUrl}/sdapi/v1/img2img`, payload);
        const firstImage = response.data.images?.[0];
        if (!firstImage) {
            throw new Error('SD-WebUI edit did not return an image');
        }
        return this.saveTempImage(Buffer.from(firstImage, 'base64'));
    }

    private async readImageAsBase64(input: string): Promise<string> {
        if (input.startsWith('data:')) {
            const dataIndex = input.indexOf('base64,');
            if (dataIndex > -1) {
                return input.slice(dataIndex + 7);
            }
        }
        if (input.startsWith('http://') || input.startsWith('https://')) {
            const response = await axios.get<ArrayBuffer>(input, { responseType: 'arraybuffer' });
            return Buffer.from(response.data).toString('base64');
        }
        const normalized = input.replace(/^safe-file:\/+/i, '').replace(/^file:\/+/i, '');
        const localPath = process.platform === 'win32' && /^\/[A-Za-z]:/.test(normalized)
            ? normalized.slice(1)
            : normalized;
        const raw = await fs.promises.readFile(localPath);
        return raw.toString('base64');
    }

    getGenerationHistory(limit: number = 100): ImageGenerationRecord[] {
        const bounded = Math.max(1, Math.min(limit, 1000));
        return this.generationHistory.slice(-bounded).reverse();
    }

    searchGenerationHistory(query: string, limit: number = 100): ImageGenerationRecord[] {
        const trimmed = query.trim().toLowerCase();
        if (!trimmed) {
            return this.getGenerationHistory(limit);
        }
        const bounded = Math.max(1, Math.min(limit, 1000));
        return this.generationHistory
            .filter(entry => {
                return (
                    entry.prompt.toLowerCase().includes(trimmed) ||
                    (entry.negativePrompt ?? '').toLowerCase().includes(trimmed) ||
                    entry.provider.toLowerCase().includes(trimmed) ||
                    (entry.source ?? '').toLowerCase().includes(trimmed)
                );
            })
            .slice(-bounded)
            .reverse();
    }

    async regenerateFromHistory(id: string): Promise<string> {
        this.assertNonEmptyText(id, 'Generation history id');
        const entry = this.generationHistory.find(item => item.id === id);
        if (!entry) {
            throw new Error('Generation history entry not found');
        }
        return this.generateImage({
            prompt: entry.prompt,
            negativePrompt: entry.negativePrompt,
            width: entry.width,
            height: entry.height,
            steps: entry.steps,
            cfgScale: entry.cfgScale,
            seed: entry.seed
        });
    }

    async exportGenerationHistory(format: 'json' | 'csv' = 'json'): Promise<string> {
        if (format === 'json') {
            return JSON.stringify(this.generationHistory, null, 2);
        }
        const header = [
            'id',
            'provider',
            'prompt',
            'negativePrompt',
            'width',
            'height',
            'steps',
            'cfgScale',
            'seed',
            'imagePath',
            'source',
            'createdAt'
        ];
        const rows = this.generationHistory.map(entry => {
            const row = [
                entry.id,
                entry.provider,
                entry.prompt,
                entry.negativePrompt ?? '',
                String(entry.width),
                String(entry.height),
                String(entry.steps),
                String(entry.cfgScale),
                String(entry.seed),
                entry.imagePath,
                entry.source ?? '',
                String(entry.createdAt)
            ];
            return row.map(value => `"${value.replace(/"/g, '""')}"`).join(',');
        });
        return [header.join(','), ...rows].join('\n');
    }

    getImageAnalytics(): {
        totalGenerated: number;
        byProvider: Record<string, number>;
        averageSteps: number;
        bySource: Record<string, number>;
        averageDurationMs: number;
        editModeCounts: Record<string, number>;
    } {
        const byProvider: Record<string, number> = {};
        const bySource: Record<string, number> = {};
        const editModeCounts: Record<string, number> = {};
        let totalSteps = 0;
        this.generationHistory.forEach(entry => {
            byProvider[entry.provider] = (byProvider[entry.provider] ?? 0) + 1;
            bySource[entry.source ?? 'generate'] = (bySource[entry.source ?? 'generate'] ?? 0) + 1;
            const editMode = this.extractEditMode(entry.prompt);
            if (entry.source === 'edit' && editMode) {
                editModeCounts[editMode] = (editModeCounts[editMode] ?? 0) + 1;
            }
            totalSteps += entry.steps;
        });
        const averageDurationMs = this.generationDurationsMs.length > 0
            ? Math.round(this.generationDurationsMs.reduce((sum, value) => sum + value, 0) / this.generationDurationsMs.length)
            : 0;
        return {
            totalGenerated: this.generationHistory.length,
            byProvider,
            bySource,
            averageSteps: this.generationHistory.length > 0
                ? Math.round(totalSteps / this.generationHistory.length)
                : 0,
            averageDurationMs,
            editModeCounts
        };
    }

    private extractEditMode(prompt: string): string | null {
        const lower = prompt.toLowerCase();
        if (lower.startsWith('style transfer:')) {
            return 'style-transfer';
        }
        if (lower.startsWith('inpaint:')) {
            return 'inpaint';
        }
        if (lower.startsWith('outpaint:')) {
            return 'outpaint';
        }
        if (lower.startsWith('image to image:')) {
            return 'img2img';
        }
        return null;
    }

    listGenerationPresets(): ImageGenerationPreset[] {
        const defaults = this.getDefaultGenerationPresets();
        const merged = [...this.generationPresets];
        defaults.forEach(defaultPreset => {
            if (!merged.some(item => item.id === defaultPreset.id)) {
                merged.push(defaultPreset);
            }
        });
        return merged.sort((left, right) => right.updatedAt - left.updatedAt);
    }

    async saveGenerationPreset(input: Omit<ImageGenerationPreset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<ImageGenerationPreset> {
        this.assertNonEmptyText(input.name, 'Preset name');
        this.validateGenerationPreset(input);
        const now = Date.now();
        const existingIndex = input.id
            ? this.generationPresets.findIndex(preset => preset.id === input.id)
            : -1;
        const next: ImageGenerationPreset = {
            id: input.id ?? uuidv4(),
            name: input.name.trim(),
            promptPrefix: input.promptPrefix,
            width: input.width,
            height: input.height,
            steps: input.steps,
            cfgScale: input.cfgScale,
            provider: input.provider,
            createdAt: existingIndex >= 0 ? this.generationPresets[existingIndex].createdAt : now,
            updatedAt: now
        };
        if (existingIndex >= 0) {
            this.generationPresets[existingIndex] = next;
        } else {
            this.generationPresets.push(next);
        }
        await this.persistImageState();
        return next;
    }

    private validateGenerationPreset(input: {
        width: number;
        height: number;
        steps: number;
        cfgScale: number;
    }): void {
        if (!Number.isFinite(input.width) || input.width < 256 || input.width > 4096) {
            throw new Error('Preset width must be between 256 and 4096');
        }
        if (!Number.isFinite(input.height) || input.height < 256 || input.height > 4096) {
            throw new Error('Preset height must be between 256 and 4096');
        }
        if (!Number.isFinite(input.steps) || input.steps < 1 || input.steps > 120) {
            throw new Error('Preset steps must be between 1 and 120');
        }
        if (!Number.isFinite(input.cfgScale) || input.cfgScale < 1 || input.cfgScale > 30) {
            throw new Error('Preset cfgScale must be between 1 and 30');
        }
    }

    private getDefaultGenerationPresets(): ImageGenerationPreset[] {
        const now = Date.now();
        return [
            {
                id: 'style-cinematic',
                name: 'Style: Cinematic',
                promptPrefix: 'cinematic lighting, rich colors, dramatic composition',
                width: 1024,
                height: 1024,
                steps: 28,
                cfgScale: 7.5,
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'size-wide-hd',
                name: 'Size: Wide HD',
                width: 1536,
                height: 896,
                steps: 24,
                cfgScale: 7,
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'quality-draft-fast',
                name: 'Quality: Draft Fast',
                width: 896,
                height: 896,
                steps: 14,
                cfgScale: 6,
                createdAt: now,
                updatedAt: now
            }
        ];
    }

    exportGenerationPresetShareCode(id: string): string {
        this.assertNonEmptyText(id, 'Preset id');
        const preset = this.listGenerationPresets().find(item => item.id === id);
        if (!preset) {
            throw new Error('Preset not found');
        }
        const payload = {
            version: 1,
            exportedAt: Date.now(),
            preset
        };
        return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');
    }

    async importGenerationPresetShareCode(code: string): Promise<ImageGenerationPreset> {
        this.assertNonEmptyText(code, 'Preset share code');
        let parsed: {
            preset?: Omit<ImageGenerationPreset, 'id' | 'createdAt' | 'updatedAt'> & { name: string };
        };
        try {
            const decoded = Buffer.from(code, 'base64').toString('utf-8');
            parsed = JSON.parse(decoded) as {
                preset?: Omit<ImageGenerationPreset, 'id' | 'createdAt' | 'updatedAt'> & { name: string };
            };
        } catch (error) {
            throw new Error(`Invalid preset share code: ${getErrorMessage(error as Error)}`);
        }
        if (!parsed.preset) {
            throw new Error('Preset payload missing');
        }
        return this.saveGenerationPreset(parsed.preset);
    }

    getPresetAnalytics(): {
        totalPresets: number;
        providerCounts: Record<string, number>;
        customPresets: number;
    } {
        const presets = this.listGenerationPresets();
        const providerCounts: Record<string, number> = {};
        presets.forEach(preset => {
            const provider = preset.provider ?? 'all';
            providerCounts[provider] = (providerCounts[provider] ?? 0) + 1;
        });
        return {
            totalPresets: presets.length,
            providerCounts,
            customPresets: presets.filter(preset => !preset.id.startsWith('style-') && !preset.id.startsWith('size-') && !preset.id.startsWith('quality-')).length
        };
    }

    listComfyWorkflowTemplates(): ComfyWorkflowTemplate[] {
        return [...this.comfyWorkflowTemplates].sort((left, right) => right.updatedAt - left.updatedAt);
    }

    async saveComfyWorkflowTemplate(input: {
        id?: string;
        name: string;
        description?: string;
        workflow: Record<string, unknown>;
    }): Promise<ComfyWorkflowTemplate> {
        this.assertNonEmptyText(input.name, 'Workflow template name');
        if (!input.workflow || Object.keys(input.workflow).length === 0) {
            throw new Error('Workflow template must contain at least one node');
        }

        const now = Date.now();
        const existingIndex = input.id
            ? this.comfyWorkflowTemplates.findIndex(template => template.id === input.id)
            : -1;
        const template: ComfyWorkflowTemplate = {
            id: input.id ?? uuidv4(),
            name: input.name.trim(),
            description: input.description?.trim() || undefined,
            workflow: input.workflow,
            createdAt: existingIndex >= 0 ? this.comfyWorkflowTemplates[existingIndex].createdAt : now,
            updatedAt: now
        };

        if (existingIndex >= 0) {
            this.comfyWorkflowTemplates[existingIndex] = template;
        } else {
            this.comfyWorkflowTemplates.push(template);
        }
        await this.persistImageState();
        return template;
    }

    async deleteComfyWorkflowTemplate(id: string): Promise<boolean> {
        this.assertNonEmptyText(id, 'Workflow template id');
        const filtered = this.comfyWorkflowTemplates.filter(template => template.id !== id);
        if (filtered.length === this.comfyWorkflowTemplates.length) {
            return false;
        }
        this.comfyWorkflowTemplates = filtered;
        await this.persistImageState();
        return true;
    }

    exportComfyWorkflowTemplateShareCode(id: string): string {
        this.assertNonEmptyText(id, 'Workflow template id');
        const template = this.comfyWorkflowTemplates.find(item => item.id === id);
        if (!template) {
            throw new Error('Workflow template not found');
        }
        const payload = {
            version: 1,
            exportedAt: Date.now(),
            template
        };
        return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');
    }

    async importComfyWorkflowTemplateShareCode(code: string): Promise<ComfyWorkflowTemplate> {
        this.assertNonEmptyText(code, 'Workflow template share code');
        let parsed: {
            template?: {
                id?: string;
                name: string;
                description?: string;
                workflow: Record<string, unknown>;
            };
        };
        try {
            parsed = JSON.parse(Buffer.from(code, 'base64').toString('utf-8')) as {
                template?: {
                    id?: string;
                    name: string;
                    description?: string;
                    workflow: Record<string, unknown>;
                };
            };
        } catch (error) {
            throw new Error(`Invalid workflow template share code: ${getErrorMessage(error as Error)}`);
        }
        if (!parsed.template) {
            throw new Error('Workflow template payload missing');
        }
        return this.saveComfyWorkflowTemplate({
            name: parsed.template.name,
            description: parsed.template.description,
            workflow: parsed.template.workflow
        });
    }

    async deleteGenerationPreset(id: string): Promise<boolean> {
        this.assertNonEmptyText(id, 'Preset id');
        const filtered = this.generationPresets.filter(preset => preset.id !== id);
        if (filtered.length === this.generationPresets.length) {
            return false;
        }
        this.generationPresets = filtered;
        await this.persistImageState();
        return true;
    }

    applyPresetToOptions(options: ImageGenerationOptions, presetId?: string): ImageGenerationOptions {
        if (!presetId) {
            return options;
        }
        const preset = this.generationPresets.find(item => item.id === presetId);
        if (!preset) {
            return options;
        }
        return {
            ...options,
            prompt: preset.promptPrefix ? `${preset.promptPrefix} ${options.prompt}` : options.prompt,
            width: options.width ?? preset.width,
            height: options.height ?? preset.height,
            steps: options.steps ?? preset.steps,
            cfgScale: options.cfgScale ?? preset.cfgScale
        };
    }

    async scheduleGeneration(
        runAt: number,
        options: ImageGenerationOptions,
        scheduling?: { priority?: ImageSchedulePriority; resourceProfile?: ImageResourceProfile }
    ): Promise<ImageScheduleTask> {
        if (!Number.isFinite(runAt)) {
            throw new Error('runAt must be a finite timestamp');
        }
        this.assertNonEmptyText(options.prompt, 'Prompt');
        const task: ImageScheduleTask = {
            id: uuidv4(),
            runAt,
            options,
            priority: scheduling?.priority ?? 'normal',
            resourceProfile: scheduling?.resourceProfile ?? 'balanced',
            status: 'scheduled',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        this.scheduleTasks.push(task);
        await this.persistImageState();
        this.queueScheduledGeneration(task);
        return task;
    }

    listScheduledGenerations(): ImageScheduleTask[] {
        return [...this.scheduleTasks].sort((left, right) => left.runAt - right.runAt);
    }

    async cancelScheduledGeneration(id: string): Promise<boolean> {
        this.assertNonEmptyText(id, 'Schedule id');
        const task = this.scheduleTasks.find(item => item.id === id);
        if (!task) {
            return false;
        }
        task.status = 'canceled';
        task.updatedAt = Date.now();
        const timer = this.scheduleTimers.get(id);
        if (timer) {
            clearTimeout(timer);
            this.scheduleTimers.delete(id);
        }
        this.emitScheduleAlert(task.id, 'canceled', task.options.prompt);
        await this.persistImageState();
        return true;
    }

    private restoreScheduledTasks(): void {
        this.scheduleTasks
            .filter(task => task.status === 'scheduled')
            .forEach(task => this.queueScheduledGeneration(task));
    }

    private queueScheduledGeneration(task: ImageScheduleTask): void {
        const delayMs = Math.max(0, task.runAt - Date.now());
        const timer = setTimeout(() => {
            this.scheduleTimers.delete(task.id);
            task.status = 'running';
            task.updatedAt = Date.now();
            void this.enqueueGeneration(task.options, 'schedule', task.priority, task.resourceProfile)
                .then(async imagePath => {
                    task.status = 'completed';
                    task.resultPath = imagePath;
                    task.updatedAt = Date.now();
                    this.emitScheduleAlert(task.id, 'completed', task.options.prompt);
                    await this.persistImageState();
                })
                .catch(async error => {
                    task.status = 'failed';
                    task.error = getErrorMessage(error as Error);
                    task.updatedAt = Date.now();
                    this.emitScheduleAlert(task.id, 'failed', task.options.prompt, task.error);
                    await this.persistImageState();
                });
        }, delayMs);
        this.scheduleTimers.set(task.id, timer);
    }

    async runBatchGeneration(requests: ImageGenerationOptions[]): Promise<string[]> {
        for (const request of requests) {
            this.assertNonEmptyText(request.prompt, 'Prompt');
        }
        const jobs = requests.slice(0, 20).map(request => this.enqueueGeneration(request, 'batch', 'normal', 'balanced'));
        return Promise.all(jobs);
    }

    getQueueStats(): { queued: number; running: boolean; byPriority: Record<string, number> } {
        const byPriority: Record<string, number> = {};
        this.generationQueue.forEach(item => {
            byPriority[item.priority] = (byPriority[item.priority] ?? 0) + 1;
        });
        return {
            queued: this.generationQueue.length,
            running: this.queueRunning,
            byPriority
        };
    }

    private async enqueueGeneration(
        options: ImageGenerationOptions,
        source: 'batch' | 'schedule',
        priority: ImageSchedulePriority,
        resourceProfile: ImageResourceProfile
    ): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            this.generationQueue.push({
                id: uuidv4(),
                options,
                source,
                priority,
                resourceProfile,
                enqueuedAt: Date.now(),
                resolve,
                reject
            });
            if (!this.queueRunning) {
                void this.processGenerationQueue();
            }
        });
    }

    private async processGenerationQueue(): Promise<void> {
        this.queueRunning = true;
        while (this.generationQueue.length > 0) {
            this.generationQueue.sort((left, right) => {
                const weightDelta = this.getPriorityWeight(right.priority) - this.getPriorityWeight(left.priority);
                if (weightDelta !== 0) {
                    return weightDelta;
                }
                return left.enqueuedAt - right.enqueuedAt;
            });
            const next = this.generationQueue.shift();
            if (!next) {
                continue;
            }
            try {
                const effectiveOptions = this.applyResourceProfile(next.options, next.resourceProfile);
                const imagePath = await this.generateImage(effectiveOptions, next.source);
                next.resolve(imagePath);
            } catch (error) {
                next.reject(error as Error);
            }
        }
        this.queueRunning = false;
    }

    private getPriorityWeight(priority: ImageSchedulePriority): number {
        if (priority === 'high') {
            return 3;
        }
        if (priority === 'normal') {
            return 2;
        }
        return 1;
    }

    private applyResourceProfile(
        options: ImageGenerationOptions,
        resourceProfile: ImageResourceProfile
    ): ImageGenerationOptions {
        if (resourceProfile === 'speed') {
            return {
                ...options,
                steps: Math.max(8, Math.min(options.steps ?? 24, 18)),
                cfgScale: Math.max(5, Math.min(options.cfgScale ?? 7, 8))
            };
        }
        if (resourceProfile === 'quality') {
            return {
                ...options,
                steps: Math.min(60, Math.max(options.steps ?? 24, 32)),
                cfgScale: Math.min(14, Math.max(options.cfgScale ?? 7, 8))
            };
        }
        return options;
    }

    private emitScheduleAlert(taskId: string, status: 'completed' | 'failed' | 'canceled', prompt: string, error?: string): void {
        if (!this.eventBusService) {
            return;
        }
        this.eventBusService.emit('image:schedule-alert', {
            taskId,
            status,
            prompt,
            error,
            timestamp: Date.now()
        });
    }

    getScheduleAnalytics(): {
        total: number;
        byStatus: Record<string, number>;
        byPriority: Record<string, number>;
    } {
        const byStatus: Record<string, number> = {};
        const byPriority: Record<string, number> = {};
        this.scheduleTasks.forEach(task => {
            byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
            byPriority[task.priority] = (byPriority[task.priority] ?? 0) + 1;
        });
        return {
            total: this.scheduleTasks.length,
            byStatus,
            byPriority
        };
    }

    async compareGenerations(ids: string[]): Promise<ImageComparisonResult> {
        const uniqueIds = ids.map(id => id.trim()).filter(id => id.length > 0);
        if (uniqueIds.length < 2) {
            throw new Error('At least two history entries are required for comparison');
        }
        const records = uniqueIds
            .map(id => this.generationHistory.find(item => item.id === id))
            .filter((item): item is ImageGenerationRecord => Boolean(item));
        if (records.length < 2) {
            throw new Error('At least two history entries are required for comparison');
        }

        const entries = await Promise.all(records.map(async record => {
            const stats = await fs.promises.stat(record.imagePath);
            return {
                id: record.id,
                path: record.imagePath,
                width: record.width,
                height: record.height,
                steps: record.steps,
                cfgScale: record.cfgScale,
                seed: record.seed,
                prompt: record.prompt,
                fileSizeBytes: stats.size,
                bytesPerPixel: Number((stats.size / Math.max(1, record.width * record.height)).toFixed(4))
            };
        }));

        const sortedBySize = [...entries].sort((left, right) => left.fileSizeBytes - right.fileSizeBytes);
        const averageFileSizeBytes = Math.round(
            entries.reduce((sum, entry) => sum + entry.fileSizeBytes, 0) / entries.length
        );
        const averageBytesPerPixel = Number(
            (entries.reduce((sum, entry) => sum + entry.bytesPerPixel, 0) / entries.length).toFixed(4)
        );

        this.trackSdCppMetric('image-comparison-run', {
            comparedCount: entries.length,
            averageFileSizeBytes,
            averageBytesPerPixel
        });

        return {
            ids: records.map(record => record.id),
            comparedAt: Date.now(),
            entries,
            summary: {
                averageFileSizeBytes,
                averageBytesPerPixel,
                smallestFileId: sortedBySize[0]?.id,
                largestFileId: sortedBySize[sortedBySize.length - 1]?.id
            }
        };
    }

    async exportComparison(ids: string[], format: 'json' | 'csv' = 'json'): Promise<string> {
        const comparison = await this.compareGenerations(ids);
        if (format === 'json') {
            return JSON.stringify(comparison, null, 2);
        }
        const header = ['id', 'path', 'width', 'height', 'steps', 'cfgScale', 'seed', 'fileSizeBytes', 'bytesPerPixel', 'prompt'];
        const rows = comparison.entries.map(entry => {
            const cells = [
                entry.id,
                entry.path,
                String(entry.width),
                String(entry.height),
                String(entry.steps),
                String(entry.cfgScale),
                String(entry.seed),
                String(entry.fileSizeBytes),
                String(entry.bytesPerPixel),
                entry.prompt
            ];
            return cells.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',');
        });
        return [header.join(','), ...rows].join('\n');
    }

    async shareComparison(ids: string[]): Promise<string> {
        const comparison = await this.compareGenerations(ids);
        const payload = {
            version: 1,
            generatedAt: Date.now(),
            comparison
        };
        return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');
    }

    private trackSdCppMetric(name: string, properties?: Record<string, unknown>): void {
        if (this.telemetryService) {
            this.telemetryService.track(name, {
                provider: 'sd-cpp',
                ...properties
            });
        }
    }

    /**
     * Get the current status of the SD-CPP runtime
     */
    public async getSDCppStatus(): Promise<string> {
        const settings = this.settingsService.getSettings();
        const binaryPath = settings.images?.sdCppBinaryPath;
        const modelPath = settings.images?.sdCppModelPath;

        let status = 'notConfigured';
        if (this.sdCppRuntimePromise) {
            status = 'installing';
            this.trackSdCppMetric('sd-cpp-status-checked', { status });
            return status;
        }

        const binExists = binaryPath ? await this.pathExists(binaryPath) : false;
        const modelExists = modelPath ? await this.pathExists(modelPath) : false;

        if (binExists && modelExists) {
            status = 'ready';
        } else if (binaryPath || modelPath) {
            status = 'failed';
        }
        this.trackSdCppMetric('sd-cpp-status-checked', { status });
        return status;
    }

    public async getHealthMetrics(): Promise<{
        status: 'healthy' | 'degraded';
        uiState: 'ready' | 'empty' | 'failure';
        messageKey: string;
        performanceBudget: typeof LocalImageService.PERFORMANCE_BUDGET;
        provider: string;
        sdCppStatus: string;
        queueDepth: number;
        scheduledTaskCount: number;
        historyCount: number;
        averageGenerationDurationMs: number;
    }> {
        const status = await this.getSDCppStatus();
        const provider = this.settingsService.getSettings().images?.provider ?? 'antigravity';
        const uiState = status === 'failed' ? 'failure' : status === 'ready' ? 'ready' : 'empty';
        const averageGenerationDurationMs = this.generationDurationsMs.length > 0
            ? Math.round(this.generationDurationsMs.reduce((sum, value) => sum + value, 0) / this.generationDurationsMs.length)
            : 0;
        return {
            status: status === 'failed' ? 'degraded' : 'healthy',
            uiState,
            messageKey: LocalImageService.UI_MESSAGE_KEYS[uiState],
            performanceBudget: LocalImageService.PERFORMANCE_BUDGET,
            provider,
            sdCppStatus: status,
            queueDepth: this.generationQueue.length,
            scheduledTaskCount: this.scheduleTasks.length,
            historyCount: this.generationHistory.length,
            averageGenerationDurationMs,
        };
    }

    /**
     * Force a reinstallation / repair of the SD-CPP runtime
     */
    public async repairSDCpp(): Promise<void> {
        this.logInfo('Starting manual repair of SD-CPP runtime');
        this.sdCppRuntimePromise = null;
        try {
            await this.ensureSDCppReady();
        } catch (error) {
            this.logError('Manual repair failed', error as Error);
            throw error;
        }
    }

    /**
     * Ensures sd-cpp runtime (binary + model) is installed and configured.
     * Safe to call multiple times; concurrent calls share the same in-flight promise.
     */
    async ensureSDCppReady(): Promise<{ binaryPath: string; modelPath: string }> {
        if (this.sdCppRuntimePromise) {
            return this.sdCppRuntimePromise;
        }

        this.sdCppRuntimePromise = this.ensureSDCppRuntime()
            .catch(error => {
                this.sdCppRuntimePromise = null;
                this.emitStatus('failed', getErrorMessage(error as Error));
                throw error;
            })
            .then(runtime => {
                this.sdCppRuntimePromise = Promise.resolve(runtime);
                this.emitStatus('ready');
                return runtime;
            });

        return this.sdCppRuntimePromise;
    }

    /**
     * Trigger a full reinstallation of the sd-cpp runtime.
     * SDCPP-CORE-10
     */
    async reinstallSDCpp(): Promise<void> {
        this.logInfo('Triggering sd-cpp reinstallation/repair...');
        const baseDir = path.join(app.getPath('userData'), 'ai', 'sd-cpp');

        // Reset the promise so a new installation can start
        this.sdCppRuntimePromise = null;

        if (fs.existsSync(baseDir)) {
            try {
                // Use a temporary name to avoid issues with open files if any
                const tempOldDir = `${baseDir}_old_${Date.now()}`;
                await fs.promises.rename(baseDir, tempOldDir);
                void fs.promises.rm(tempOldDir, { recursive: true, force: true }).catch(() => { });
            } catch (error) {
                this.logWarn(`Failed to rename old sd-cpp dir for repair: ${getErrorMessage(error as Error)}`);
                // Fallback: try direct removal of contents
                await fs.promises.rm(baseDir, { recursive: true, force: true }).catch(() => { });
            }
        }

        await this.ensureSDCppReady();
    }

    private async ensureSDCppRuntime(): Promise<{ binaryPath: string; modelPath: string }> {
        this.emitStatus('installing');
        const settings = this.settingsService.getSettings();
        const baseDir = path.join(app.getPath('userData'), 'ai', 'sd-cpp');
        const binDir = path.join(baseDir, 'bin');
        const modelDir = path.join(baseDir, 'models');

        await fs.promises.mkdir(binDir, { recursive: true });
        await fs.promises.mkdir(modelDir, { recursive: true });

        const configuredBinary = settings.images?.sdCppBinaryPath?.trim() || process.env.SD_CPP_BINARY?.trim();
        const configuredModel = settings.images?.sdCppModelPath?.trim() || process.env.SD_CPP_MODEL?.trim();

        let binaryPath = configuredBinary ?? '';
        let modelPath = configuredModel ?? '';

        if (!binaryPath || !(await this.pathExists(binaryPath))) {
            binaryPath = await this.resolveOrInstallSDCppBinary(binDir);
        }

        if (!modelPath || !(await this.pathExists(modelPath))) {
            modelPath =
                (await this.findImageModelFile(modelDir)) || (await this.downloadDefaultSDCppModel(modelDir));
        }

        await this.persistSDCppPaths(binaryPath, modelPath);

        return { binaryPath, modelPath };
    }

    private async resolveOrInstallSDCppBinary(binDir: string): Promise<string> {
        const candidates = this.getSDCppBinaryCandidates();

        // 1. Try direct candidates
        for (const name of candidates) {
            const pathCandidate = path.join(binDir, name);
            if (await this.pathExists(pathCandidate)) {
                return pathCandidate;
            }
        }

        // 2. Try recursive search for candidates
        for (const name of candidates) {
            const nestedCandidate = await this.findExecutableRecursively(binDir, name);
            if (nestedCandidate) {
                return nestedCandidate;
            }
        }

        await this.installSDCppBinary(binDir);

        // 3. Check again after installation
        for (const name of candidates) {
            const pathCandidate = path.join(binDir, name);
            if (await this.pathExists(pathCandidate)) {
                return pathCandidate;
            }
        }

        for (const name of candidates) {
            const nestedCandidate = await this.findExecutableRecursively(binDir, name);
            if (nestedCandidate) {
                return nestedCandidate;
            }
        }

        throw new Error('stable-diffusion.cpp was downloaded but executable could not be located.');
    }

    private getSDCppBinaryCandidates(): string[] {
        if (process.platform === 'win32') {
            return ['sd.exe', 'sd-cli.exe', 'stable-diffusion.exe'];
        }
        return ['sd', 'sd-cli', 'stable-diffusion'];
    }

    private async installSDCppBinary(binDir: string): Promise<void> {
        this.logInfo('stable-diffusion.cpp binary not found, starting automatic installation.');

        const release = await axios.get<GitHubRelease>(LocalImageService.SD_CPP_RELEASE_API, {
            timeout: 15000,
            headers: { Accept: 'application/vnd.github+json' },
        });

        const selectedAsset = this.selectReleaseAsset(release.data.assets ?? []);
        if (!selectedAsset) {
            throw new Error('No compatible stable-diffusion.cpp release asset found for this platform.');
        }

        const downloadPath = path.join(binDir, selectedAsset.name);

        // Try to find a checksum for the asset (SDCPP-CORE-05)
        let expectedSha256: string | undefined;
        try {
            const checksumAsset = release.data.assets?.find(a =>
                a.name === `${selectedAsset.name}.sha256` ||
                a.name === `${selectedAsset.name}.sha256sum`
            );
            if (checksumAsset) {
                this.logInfo(`Found checksum asset: ${checksumAsset.name}, fetching...`);
                const checksumRes = await axios.get(checksumAsset.browser_download_url, { timeout: 10000 });
                // Extract the first 64 hex characters (sha256)
                const match = checksumRes.data.match(/[a-fA-F0-9]{64}/);
                if (match) {
                    expectedSha256 = match[0];
                    this.logInfo(`Will verify sha256: ${expectedSha256}`);
                }
            }
        } catch (err) {
            this.logWarn('Failed to fetch checksum, skipping verification', err as Error);
        }

        await this.downloadToFile(selectedAsset.browser_download_url, downloadPath, expectedSha256);
        await this.extractIfNeeded(downloadPath, binDir);
    }

    private selectReleaseAsset(assets: GitHubReleaseAsset[]): GitHubReleaseAsset | null {
        if (assets.length === 0) {
            return null;
        }

        const normalized = assets.map(asset => ({ ...asset, key: asset.name.toLowerCase() }));
        const platform = process.platform;
        const arch = process.arch;

        const platformTokens = platform === 'win32'
            ? ['win', 'windows', 'msvc']
            : platform === 'darwin'
                ? ['mac', 'darwin', 'osx', 'apple']
                : ['linux', 'ubuntu'];

        const archTokens = arch === 'arm64' ? ['arm64', 'aarch64'] : ['x64', 'amd64', 'x86_64'];

        // Prefer avx2 for x64 on Windows/Linux if available, or stay generic
        const avx2Tokens = ['avx2'];
        const avxTokens = ['avx'];

        const scoredAssets = normalized.map(asset => {
            let score = 0;
            const matchesPlatform = platformTokens.some(token => asset.key.includes(token));
            const matchesArch = archTokens.some(token => asset.key.includes(token));

            if (!matchesPlatform || !matchesArch) { return { ...asset, score: -1 }; }

            score += 100;

            // Prioritize archive formats
            if (asset.key.endsWith('.zip') || asset.key.endsWith('.tar.gz') || asset.key.endsWith('.tgz')) {
                score += 50;
            }

            // GPU support (CUDA) - only if we want to prioritize it, maybe check system later
            // For now, let's prefer AVX2 for CPU if no CUDA specified
            if (avx2Tokens.some(token => asset.key.includes(token))) { score += 20; }
            if (avxTokens.some(token => asset.key.includes(token))) { score += 10; }

            // Avoid debug or no-avx builds if possible
            if (asset.key.includes('debug')) { score -= 30; }
            if (asset.key.includes('no-avx')) { score -= 20; }

            return { ...asset, score };
        });

        const best = scoredAssets
            .filter(a => a.score > 0)
            .sort((a, b) => b.score - a.score)[0];

        return best || scoredAssets.find(a => a.score >= 0) || null;
    }

    private async downloadDefaultSDCppModel(modelDir: string): Promise<string> {
        const defaultModelPath = path.join(modelDir, 'v1-5-pruned-emaonly.safetensors');
        if (await this.pathExists(defaultModelPath)) {
            return defaultModelPath;
        }

        this.logInfo('No local sd-cpp model found. Downloading default image model automatically.');
        await this.downloadToFile(LocalImageService.DEFAULT_SDCPP_MODEL_URL, defaultModelPath);
        return defaultModelPath;
    }

    private async persistSDCppPaths(binaryPath: string, modelPath: string): Promise<void> {
        try {
            const current = this.settingsService.getSettings();
            await this.settingsService.saveSettings({
                images: {
                    ...(current.images ?? { provider: 'antigravity' }),
                    sdCppBinaryPath: binaryPath,
                    sdCppModelPath: modelPath,
                },
            });
        } catch (error) {
            this.logWarn(`Failed to persist sd-cpp paths: ${getErrorMessage(error as Error)}`);
        }
    }

    private async findImageModelFile(dir: string): Promise<string | null> {
        const models: string[] = [];
        await this.walkFiles(dir, filePath => {
            const lower = filePath.toLowerCase();
            if (lower.endsWith('.safetensors') || lower.endsWith('.ckpt') || lower.endsWith('.gguf')) {
                models.push(filePath);
            }
        });
        return models[0] ?? null;
    }

    private async findExecutableRecursively(dir: string, binaryName: string): Promise<string | null> {
        const matches: string[] = [];
        await this.walkFiles(dir, filePath => {
            if (path.basename(filePath).toLowerCase() === binaryName.toLowerCase()) {
                matches.push(filePath);
            }
        });
        return matches[0] ?? null;
    }

    private async walkFiles(dir: string, onFile: (filePath: string) => void): Promise<void> {
        if (!(await this.pathExists(dir))) {
            return;
        }

        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await this.walkFiles(fullPath, onFile);
            } else {
                onFile(fullPath);
            }
        }
    }

    private async pathExists(targetPath: string): Promise<boolean> {
        try {
            await fs.promises.access(targetPath, fs.constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }

    private async downloadToFile(url: string, outputPath: string, expectedSha256?: string): Promise<void> {
        const tempPath = `${outputPath}.tmp`;
        const response = await axios.get(url, {
            responseType: 'stream',
            timeout: 300000, // 5 minutes for large models
        });

        const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;
        const filename = path.basename(outputPath);

        await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

        const hash = expectedSha256 ? crypto.createHash('sha256') : null;

        await new Promise<void>((resolve, reject) => {
            const writer = fs.createWriteStream(tempPath);

            response.data.on('data', (chunk: Buffer) => {
                downloadedBytes += chunk.length;
                if (hash) { hash.update(chunk); }
                this.emitProgress(downloadedBytes, totalBytes, filename);
            });

            response.data.pipe(writer);

            writer.on('finish', () => {
                writer.close();
                resolve();
            });

            writer.on('error', (err: Error) => {
                writer.close();
                void fs.promises.unlink(tempPath).catch(() => { });
                reject(err);
            });
        });

        if (hash && expectedSha256) {
            const actualSha256 = hash.digest('hex');
            if (actualSha256 !== expectedSha256) {
                await fs.promises.unlink(tempPath).catch(() => { });
                throw new Error(`Checksum verification failed for ${filename}. Expected ${expectedSha256}, got ${actualSha256}`);
            }
            this.logInfo(`Checksum verified for ${filename}`);
        }

        await fs.promises.rename(tempPath, outputPath);
    }

    private async extractIfNeeded(downloadedPath: string, targetDir: string): Promise<void> {
        const lower = downloadedPath.toLowerCase();
        if (lower.endsWith('.zip')) {
            if (process.platform === 'win32') {
                await this.runProcess('powershell', [
                    '-NoProfile',
                    '-Command',
                    `Expand-Archive -Path "${downloadedPath.replace(/"/g, '""')}" -DestinationPath "${targetDir.replace(/"/g, '""')}" -Force`,
                ]);
            } else {
                await this.runProcess('unzip', ['-o', downloadedPath, '-d', targetDir]);
            }
            return;
        }

        if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
            await this.runProcess('tar', ['-xzf', downloadedPath, '-C', targetDir]);
        }
    }

    private createTempOutputPath(extension: string): string {
        const tempDir = path.join(process.cwd(), 'temp', 'generated');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        return path.join(tempDir, `generated-${uuidv4()}.${extension}`);
    }

    private parseCliArgs(rawArgs?: string): string[] {
        if (!rawArgs) {
            return [];
        }

        const matches = rawArgs.match(/"([^"]*)"|'([^']*)'|[^\s]+/g) ?? [];
        return matches.map(token => token.replace(/^['"]|['"]$/g, '')).filter(Boolean);
    }

    private async ensurePathExists(targetPath: string, label: string): Promise<void> {
        try {
            await fs.promises.access(targetPath, fs.constants.F_OK);
        } catch {
            throw new Error(`${label} not found: ${targetPath}`);
        }
    }

    private async runProcess(command: string, args: string[]): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            const child = spawn(command, args, {
                shell: false,
                windowsHide: true,
            });

            child.stdout.on('data', (chunk: Buffer) => {
                appLogger.debug('sd-cpp', chunk.toString());
            });

            child.stderr.on('data', (chunk: Buffer) => {
                appLogger.error('sd-cpp', chunk.toString());
            });

            child.on('error', (error: Error) => {
                this.logError(`Process failed: ${command}`, error);
                reject(error);
            });

            child.on('close', (code: number) => {
                if (code !== 0) {
                    reject(new Error(`Process ${command} exited with code ${code}`));
                } else {
                    resolve();
                }
            });
        });
    }

    private async delay(ms: number): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, ms));
    }

    private async saveTempImage(buffer: Buffer): Promise<string> {
        const filePath = this.createTempOutputPath('png');
        fs.writeFileSync(filePath, buffer);
        return filePath;
    }
}

