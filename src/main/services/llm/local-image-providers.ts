import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { LinkedAccount } from '@main/services/data/database.service';
import { LLMService } from '@main/services/llm/llm.service';
import { QuotaModel, QuotaService } from '@main/services/proxy/quota.service';
import { AuthService } from '@main/services/security/auth.service';
import { SettingsService } from '@main/services/system/settings.service';
import { withRetry } from '@main/utils/retry.util';
import { getErrorMessage } from '@shared/utils/error.util';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';

import type {
    AntigravityAccount,
    AntigravityUpstreamQuotaResponse,
    ComfyWorkflowTemplate,
    ImageEditOptions,
    ImageGenerationOptions,
    ImageProvider,
} from './local-image.types';

interface ProviderDeps {
    settingsService: SettingsService;
    authService?: AuthService;
    llmService?: LLMService;
    quotaService?: QuotaService;
}

const RETRY_POLICY = {
    networkAttempts: 2,
    networkDelayMs: 300,
} as const;

const ERROR_CODES = {
    POLLINATIONS_FAILURE: 'LOCAL_IMAGE_POLLINATIONS_FAILURE',
} as const;

/** Routes image generation to the appropriate provider. */
export class LocalImageProviders {
    private readonly deps: ProviderDeps;
    private comfyWorkflowTemplates: ComfyWorkflowTemplate[] = [];

    constructor(deps: ProviderDeps) {
        this.deps = deps;
    }

    /** Update the ComfyUI workflow templates reference. */
    setWorkflowTemplates(templates: ComfyWorkflowTemplate[]): void {
        this.comfyWorkflowTemplates = templates;
    }

    /** Dispatch generation to the correct provider. */
    async generateWithProvider(provider: string, options: ImageGenerationOptions): Promise<string> {
        switch (provider) {
            case 'ollama':
                return this.generateWithOllama(options);
            case 'sd-webui':
                return this.generateWithSDWebUI(options);
            case 'comfyui':
                return this.generateWithComfyUI(options);
            case 'pollinations':
            case 'antigravity':
            default:
                return this.generateWithPollinations(options);
        }
    }

    /** Try to generate via Antigravity if an account with quota is available. */
    async tryGenerateWithAntigravity(options: ImageGenerationOptions): Promise<string | null> {
        try {
            const account = await this.getAntigravityAccountWithQuota();
            if (account) {
                appLogger.info('LocalImageProviders', `Using Antigravity account: ${account.email ?? account.id} (quota: ${account.quotaPercentage}%)`);
                return await this.generateWithAntigravity(options, account);
            }
            appLogger.info('LocalImageProviders', 'No Antigravity accounts with available quota');
        } catch (error) {
            appLogger.warn('LocalImageProviders', `Antigravity failed, falling back: ${getErrorMessage(error as Error)}`);
        }
        return null;
    }

    /** Generate using Pollinations API. */
    async generateWithPollinations(options: ImageGenerationOptions): Promise<string> {
        const { prompt, width = 1024, height = 1024, seed = Math.floor(Math.random() * 1000000) } = options;
        const model = 'flux';
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&model=${model}&nologo=true`;

        try {
            const response = await this.executeWithRetry(
                () => axios.get(url, { responseType: 'arraybuffer' }),
                RETRY_POLICY.networkAttempts
            );
            return this.saveTempImage(Buffer.from(response.data));
        } catch (error) {
            appLogger.error('LocalImageProviders', `Pollinations generation failed: ${getErrorMessage(error as Error)}`);
            throw new Error(
                `[${ERROR_CODES.POLLINATIONS_FAILURE}] Pollinations failure: ${getErrorMessage(error as Error)}`
            );
        }
    }

    /** Edit an image using the configured provider. */
    async editImage(options: ImageEditOptions): Promise<string> {
        const provider = (this.deps.settingsService.getSettings().images?.provider ?? 'antigravity') as ImageProvider;

        if (provider === 'sd-webui') {
            return this.editWithSDWebUI(options);
        }

        const modePrefix = options.mode === 'style-transfer'
            ? 'Style transfer'
            : options.mode === 'inpaint'
                ? 'Inpaint'
                : options.mode === 'outpaint'
                    ? 'Outpaint'
                    : 'Image to image';

        return this.generateWithProvider(provider, {
            prompt: `${modePrefix}: ${options.prompt}`,
            negativePrompt: options.negativePrompt,
            width: options.width,
            height: options.height,
            steps: 24,
            cfgScale: 7
        });
    }

    private async generateWithAntigravity(options: ImageGenerationOptions, account: AntigravityAccount): Promise<string> {
        if (!this.deps.llmService) {
            throw new Error('LLMService not available for Antigravity generation');
        }
        try {
            appLogger.info('LocalImageProviders', `Calling Antigravity image generation with account ${account.email ?? account.id}`);
            const response = await this.deps.llmService.chat(
                [{ role: 'user', content: options.prompt }],
                'antigravity-gemini-3-pro-image',
                [],
                'antigravity'
            );
            if (response.images && response.images.length > 0) {
                appLogger.info('LocalImageProviders', `Antigravity generated ${response.images.length} image(s)`);
                return response.images[0];
            }
            throw new Error('No images returned from Antigravity');
        } catch (error) {
            appLogger.error('LocalImageProviders', `Antigravity generation failed: ${getErrorMessage(error as Error)}`);
            throw error;
        }
    }

    private async generateWithOllama(options: ImageGenerationOptions): Promise<string> {
        const settings = this.deps.settingsService.getSettings();
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
            appLogger.error('LocalImageProviders', `Ollama generation failed: ${getErrorMessage(error as Error)}`);
            throw error;
        }
    }

    private async generateWithSDWebUI(options: ImageGenerationOptions): Promise<string> {
        const settings = this.deps.settingsService.getSettings();
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
            appLogger.error('LocalImageProviders', `SD-WebUI generation failed: ${getErrorMessage(error as Error)}`);
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
        const settings = this.deps.settingsService.getSettings();
        const baseUrl = settings.images?.comfyUIUrl ?? 'http://127.0.0.1:8188';
        const workflow = this.resolveComfyWorkflow(options);

        interface ComfyPromptResponse { prompt_id?: string; }
        const queued = await axios.post<ComfyPromptResponse>(`${baseUrl}/prompt`, { prompt: workflow });
        const promptId = queued.data.prompt_id;
        if (!promptId) {
            throw new Error('ComfyUI did not return prompt_id');
        }

        let imageRef: { filename: string; subfolder: string; type: string };
        try {
            imageRef = await this.waitForComfyImageViaWebSocket(baseUrl, promptId);
        } catch (error) {
            appLogger.warn('LocalImageProviders', `ComfyUI WebSocket tracking failed, falling back: ${getErrorMessage(error as Error)}`);
            imageRef = await this.waitForComfyImage(baseUrl, promptId);
        }

        const imageResponse = await axios.get<ArrayBuffer>(`${baseUrl}/view`, {
            params: { filename: imageRef.filename, subfolder: imageRef.subfolder, type: imageRef.type },
            responseType: 'arraybuffer'
        });
        return this.saveTempImage(Buffer.from(imageResponse.data));
    }

    private resolveComfyWorkflow(options: ImageGenerationOptions): Record<string, unknown> {
        const settingsImages = this.deps.settingsService.getSettings().images as Record<string, unknown> | undefined;
        const selectedTemplateId =
            typeof settingsImages?.comfyUIWorkflowTemplateId === 'string'
                ? settingsImages.comfyUIWorkflowTemplateId
                : undefined;
        const selectedTemplate = selectedTemplateId
            ? this.comfyWorkflowTemplates.find(t => t.id === selectedTemplateId)
            : undefined;

        if (selectedTemplate) {
            return this.applyComfyWorkflowPlaceholders(selectedTemplate.workflow, options);
        }

        if (typeof settingsImages?.comfyUIWorkflowJson === 'string' && settingsImages.comfyUIWorkflowJson.trim()) {
            try {
                const parsed = JSON.parse(settingsImages.comfyUIWorkflowJson) as Record<string, unknown>;
                return this.applyComfyWorkflowPlaceholders(parsed, options);
            } catch (error) {
                appLogger.warn('LocalImageProviders', `Invalid custom ComfyUI workflow JSON: ${getErrorMessage(error as Error)}`);
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
            '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'v1-5-pruned-emaonly.safetensors' } },
            '2': { class_type: 'CLIPTextEncode', inputs: { text: options.prompt, clip: ['1', 1] } },
            '3': { class_type: 'CLIPTextEncode', inputs: { text: options.negativePrompt ?? 'low quality, blurry, artifacts', clip: ['1', 1] } },
            '4': { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: Math.max(1, Math.min(options.count ?? 1, 4)) } },
            '5': { class_type: 'KSampler', inputs: { seed, steps, cfg, sampler_name: 'euler', scheduler: 'normal', denoise: 1, model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0] } },
            '6': { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
            '7': { class_type: 'SaveImage', inputs: { filename_prefix: 'tengra', images: ['6', 0] } }
        };
    }

    private async waitForComfyImage(
        baseUrl: string,
        promptId: string
    ): Promise<{ filename: string; subfolder: string; type: string }> {
        interface ComfyImageOutput { filename?: string; subfolder?: string; type?: string; }
        interface ComfyHistoryPayload { [key: string]: { outputs?: Record<string, { images?: ComfyImageOutput[] }> }; }

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
                    return { filename: image.filename, subfolder: image.subfolder ?? '', type: image.type ?? 'output' };
                }
            }
            await this.delay(1000);
        }
        throw new Error('Timed out waiting for ComfyUI result');
    }

    private async waitForComfyImageViaWebSocket(
        baseUrl: string,
        promptId: string
    ): Promise<{ filename: string; subfolder: string; type: string }> {
        interface ComfyWsOutputImage { filename?: string; subfolder?: string; type?: string; }
        interface ComfyWsPayload { type?: string; data?: { prompt_id?: string; output?: { images?: ComfyWsOutputImage[] } }; }

        const webSocketUrl = this.getComfyWebSocketUrl(baseUrl);
        const timeoutMs = 90_000;
        const socket = new WebSocket(webSocketUrl);

        return await new Promise((resolve, reject) => {
            let settled = false;
            const timeout = setTimeout(() => {
                if (settled) { return; }
                settled = true;
                socket.close();
                reject(new Error('Timed out waiting for ComfyUI WebSocket result'));
            }, timeoutMs);

            const resolveImage = (image: ComfyWsOutputImage): void => {
                if (settled || !image.filename) { return; }
                settled = true;
                clearTimeout(timeout);
                socket.close();
                resolve({ filename: image.filename, subfolder: image.subfolder ?? '', type: image.type ?? 'output' });
            };

            socket.on('error', (error: Error) => {
                if (settled) { return; }
                settled = true;
                clearTimeout(timeout);
                reject(error);
            });

            socket.on('message', (rawMessage: WebSocket.RawData) => {
                if (settled) { return; }
                const rawText = Buffer.isBuffer(rawMessage)
                    ? rawMessage.toString()
                    : Array.isArray(rawMessage)
                        ? Buffer.concat(rawMessage).toString()
                        : rawMessage.toString();
                let payload: ComfyWsPayload;
                try { payload = JSON.parse(rawText) as ComfyWsPayload; } catch { return; }
                if (payload.type !== 'executed') { return; }
                if (payload.data?.prompt_id !== promptId) { return; }
                const image = payload.data?.output?.images?.[0];
                if (!image?.filename) { return; }
                resolveImage(image);
            });
        });
    }

    private getComfyWebSocketUrl(baseUrl: string): string {
        const parsed = new URL(baseUrl);
        const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${parsed.host}/ws`;
    }

    private async editWithSDWebUI(options: ImageEditOptions): Promise<string> {
        const settings = this.deps.settingsService.getSettings();
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

    private async getAntigravityAccountWithQuota(): Promise<AntigravityAccount | null> {
        if (!this.deps.authService || !this.deps.quotaService) {
            return null;
        }
        try {
            const allAccounts = await this.deps.authService.getAllAccountsFull();
            const antigravityAccounts = allAccounts.filter(a =>
                a.provider.startsWith('antigravity') || a.provider.startsWith('google')
            );
            if (antigravityAccounts.length === 0) {
                appLogger.info('LocalImageProviders', 'No Antigravity accounts found');
                return null;
            }
            appLogger.info('LocalImageProviders', `Found ${antigravityAccounts.length} Antigravity account(s), checking quota...`);
            for (const account of antigravityAccounts) {
                const result = await this.checkAccountQuota(account);
                if (result) { return result; }
            }
            appLogger.warn('LocalImageProviders', 'No Antigravity accounts with sufficient quota');
            return null;
        } catch (error) {
            appLogger.error('LocalImageProviders', `Failed to get Antigravity account: ${getErrorMessage(error as Error)}`);
            return null;
        }
    }

    private async checkAccountQuota(account: LinkedAccount): Promise<AntigravityAccount | null> {
        if (!account.accessToken) {
            appLogger.debug('LocalImageProviders', `Skipping account ${account.email ?? account.id}: no access token`);
            return null;
        }
        const quotaInfo = await this.fetchImageQuota(account);
        if (!quotaInfo) { return null; }
        const quotaPercentage = this.calculateQuotaPercentage(quotaInfo);
        if (quotaPercentage > 5) {
            appLogger.info('LocalImageProviders', `Account ${account.email ?? account.id} has ${quotaPercentage}% quota remaining`);
            return { id: account.id, email: account.email, accessToken: account.accessToken, hasQuota: true, quotaPercentage };
        }
        appLogger.warn('LocalImageProviders', `Account ${account.email ?? account.id} quota too low: ${quotaPercentage}%`);
        return null;
    }

    private async fetchImageQuota(
        account: LinkedAccount
    ): Promise<{ remainingFraction?: number; remainingQuota?: number; totalQuota?: number } | null> {
        try {
            if (!this.deps.quotaService) {
                throw new Error('QuotaService not available');
            }
            const response = await this.deps.quotaService.fetchAntigravityUpstreamForToken(account) as AntigravityUpstreamQuotaResponse;
            if (!response?.models) {
                appLogger.debug('LocalImageProviders', `No quota data for account ${account.email ?? account.id}`);
                return null;
            }
            const imageModel = this.extractImageModel(response.models);
            if (!imageModel) {
                appLogger.debug('LocalImageProviders', `Account ${account.email ?? account.id} doesn't have image model access`);
                return null;
            }
            return imageModel.quotaInfo ?? null;
        } catch (error) {
            appLogger.error('LocalImageProviders', `Failed to check quota for ${account.email ?? account.id}: ${getErrorMessage(error as Error)}`);
            return null;
        }
    }

    private calculateQuotaPercentage(quotaInfo: { remainingFraction?: number; remainingQuota?: number; totalQuota?: number }): number {
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

    private async executeWithRetry<T>(operation: () => Promise<T>, maxAttempts: number): Promise<T> {
        return withRetry(operation, {
            maxRetries: maxAttempts - 1,
            baseDelayMs: RETRY_POLICY.networkDelayMs,
            maxDelayMs: RETRY_POLICY.networkDelayMs,
            jitterFactor: 0,
            shouldRetry: () => true,
        });
    }

    private saveTempImage(buffer: Buffer): string {
        const tempDir = path.join(process.cwd(), 'temp', 'generated');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const filePath = path.join(tempDir, `generated-${uuidv4()}.png`);
        fs.writeFileSync(filePath, buffer);
        return filePath;
    }

    private async delay(ms: number): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, ms));
    }
}
