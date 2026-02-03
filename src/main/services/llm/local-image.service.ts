import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { LinkedAccount } from '@main/services/data/database.service';
import { LLMService } from '@main/services/llm/llm.service';
import { QuotaModel, QuotaService } from '@main/services/proxy/quota.service';
import { AuthService } from '@main/services/security/auth.service';
import { SettingsService } from '@main/services/system/settings.service';
import { getErrorMessage } from '@shared/utils/error.util';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

interface AntigravityUpstreamQuotaResponse {
    models: Record<string, QuotaModel>;
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

export type ImageProvider = 'antigravity' | 'ollama' | 'sd-webui' | 'comfyui' | 'pollinations'

interface AntigravityAccount {
    id: string
    email?: string
    accessToken: string
    hasQuota: boolean
    quotaPercentage: number
}

export class LocalImageService {
    constructor(
        private settingsService: SettingsService,
        private authService?: AuthService,
        private llmService?: LLMService,
        private quotaService?: QuotaService
    ) { }

    /**
     * Generate an image using available providers
     * Priority: Antigravity (with quota) > Pollinations > Other local providers
     */
    async generateImage(options: ImageGenerationOptions): Promise<string> {
        const settings = this.settingsService.getSettings();
        const preferredProvider = (settings.images?.provider ?? 'antigravity') as ImageProvider;

        appLogger.info('local-image.service', `Generating image with preferred provider: ${preferredProvider}`);

        // Try Antigravity first if available
        if (this.authService && this.llmService && this.quotaService) {
            const result = await this.tryGenerateWithAntigravity(options);
            if (result) { return result; }
        }

        // Fallback to preferred provider or Pollinations
        appLogger.info('local-image.service', `Falling back to ${preferredProvider === 'antigravity' ? 'pollinations' : preferredProvider}`);
        return this.generateWithProvider(preferredProvider, options);
    }

    private async generateWithProvider(provider: string, options: ImageGenerationOptions): Promise<string> {
        switch (provider) {
            case 'ollama':
                return this.generateWithOllama(options);
            case 'sd-webui':
                return this.generateWithSDWebUI(options);
            case 'comfyui':
                return this.generateWithComfyUI(options);
            case 'pollinations':
            case 'antigravity': // Antigravity failed, use pollinations
            default:
                return this.generateWithPollinations(options);
        }
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
                appLogger.info('local-image.service', 'No Antigravity accounts found');
                return null;
            }

            appLogger.info('local-image.service', `Found ${antigravityAccounts.length} Antigravity account(s), checking quota...`);

            // Check quota for each account
            for (const account of antigravityAccounts) {
                const result = await this.checkAccountQuota(account);
                if (result) { return result; }
            }

            appLogger.warn('local-image.service', 'No Antigravity accounts with sufficient quota');
            return null;
        } catch (error) {
            appLogger.error('local-image.service', `Failed to get Antigravity account: ${getErrorMessage(error as Error)}`);
            return null;
        }
    }

    private async checkAccountQuota(account: LinkedAccount): Promise<AntigravityAccount | null> {
        if (!account.accessToken) {
            appLogger.debug('local-image.service', `Skipping account ${account.email ?? account.id}: no access token`);
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
            appLogger.info('local-image.service', `Account ${account.email ?? account.id} has ${quotaPercentage}% quota remaining`);
            return {
                id: account.id,
                email: account.email,
                accessToken: account.accessToken,
                hasQuota: true,
                quotaPercentage
            };
        } else {
            appLogger.warn('local-image.service', `Account ${account.email ?? account.id} quota too low: ${quotaPercentage}%`);
        }
        return null;
    }

    private async fetchImageQuota(account: LinkedAccount): Promise<{ remainingFraction?: number; remainingQuota?: number; totalQuota?: number } | null> {
        try {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const response = await this.quotaService!.fetchAntigravityUpstreamForToken(account) as AntigravityUpstreamQuotaResponse;

            if (!response?.models) {
                appLogger.debug('local-image.service', `No quota data for account ${account.email ?? account.id}`);
                return null;
            }

            const models = response.models;
            const imageModel = this.extractImageModel(models);

            if (!imageModel) {
                appLogger.debug('local-image.service', `Account ${account.email ?? account.id} doesn't have image model access`);
                return null;
            }

            return imageModel.quotaInfo ?? null;
        } catch (error) {
            appLogger.error('local-image.service', `Failed to check quota for ${account.email ?? account.id}: ${getErrorMessage(error as Error)}`);
            return null;
        }
    }

    private async tryGenerateWithAntigravity(options: ImageGenerationOptions): Promise<string | null> {
        try {
            const account = await this.getAntigravityAccountWithQuota();
            if (account) {
                appLogger.info('local-image.service', `Using Antigravity account: ${account.email ?? account.id} (quota: ${account.quotaPercentage}%)`);
                return await this.generateWithAntigravity(options, account);
            } else {
                appLogger.info('local-image.service', 'No Antigravity accounts with available quota');
            }
        } catch (error) {
            appLogger.warn('local-image.service', `Antigravity failed, falling back: ${getErrorMessage(error as Error)}`);
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
            appLogger.info('local-image.service', `Calling Antigravity image generation with account ${account.email ?? account.id}`);

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
                appLogger.info('local-image.service', `Antigravity generated ${response.images.length} image(s)`);
                return response.images[0];
            }

            throw new Error('No images returned from Antigravity');
        } catch (error) {
            appLogger.error('local-image.service', `Antigravity generation failed: ${getErrorMessage(error as Error)}`);
            throw error;
        }
    }

    private async generateWithPollinations(options: ImageGenerationOptions): Promise<string> {
        const { prompt, width = 1024, height = 1024, seed = Math.floor(Math.random() * 1000000) } = options;
        const model = 'flux';
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&model=${model}&nologo=true`;

        try {
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            return this.saveTempImage(Buffer.from(response.data));
        } catch (error) {
            appLogger.error('local-image.service', 'Pollinations generation failed', error as Error);
            throw new Error(`Pollinations failure: ${getErrorMessage(error as Error)}`);
        }
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
            appLogger.error('local-image.service', 'Ollama generation failed', error as Error);
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
            appLogger.error('local-image.service', 'SD-WebUI generation failed', error as Error);
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

    private async generateWithComfyUI(_options: ImageGenerationOptions): Promise<string> {
        throw new Error('ComfyUI integration is coming soon.');
    }

    private async saveTempImage(buffer: Buffer): Promise<string> {
        const tempDir = path.join(process.cwd(), 'temp', 'generated');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const fileName = `generated-${uuidv4()}.png`;
        const filePath = path.join(tempDir, fileName);
        fs.writeFileSync(filePath, buffer);
        return filePath;
    }
}
