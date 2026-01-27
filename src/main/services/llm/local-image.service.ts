import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { SettingsService } from '@main/services/system/settings.service';
import { getErrorMessage } from '@shared/utils/error.util';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface ImageGenerationOptions {
    prompt: string
    negativePrompt?: string
    width?: number
    height?: number
    steps?: number
    cfgScale?: number
    seed?: number
}

export type ImageProvider = 'ollama' | 'sd-webui' | 'comfyui' | 'pollinations'

export class LocalImageService {
    constructor(private settingsService: SettingsService) { }

    /**
     * Generate an image using a local or free provider
     */
    async generateImage(options: ImageGenerationOptions): Promise<string> {
        const settings = this.settingsService.getSettings();
        const provider = (settings.images?.provider ?? 'pollinations') as ImageProvider;

        appLogger.info('local-image.service', `Generating image with provider: ${provider}`);

        switch (provider) {
            case 'ollama':
                return this.generateWithOllama(options);
            case 'sd-webui':
                return this.generateWithSDWebUI(options);
            case 'comfyui':
                return this.generateWithComfyUI(options);
            case 'pollinations':
            default:
                return this.generateWithPollinations(options);
        }
    }

    private async generateWithPollinations(options: ImageGenerationOptions): Promise<string> {
        const { prompt, width = 1024, height = 1024, seed = Math.floor(Math.random() * 1000000) } = options;
        const model = 'flux'; // Default high quality model on Pollinations
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&model=${model}&nologo=true`;

        try {
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            return this.saveTempImage(response.data);
        } catch (error) {
            appLogger.error('local-image.service', 'Pollinations generation failed', error as Error);
            throw new Error(`Pollinations failure: ${getErrorMessage(error as Error)}`);
        }
    }

    private async generateWithOllama(options: ImageGenerationOptions): Promise<string> {
        const settings = this.settingsService.getSettings();
        const model = settings.images?.ollamaModel || 'stable-diffusion-v1-5';
        const baseUrl = settings.ollama.url || 'http://127.0.0.1:11434';

        try {
            // Ollama image generation is usually via a POST to /api/generate or /api/chat if it's a multimodal model
            // But for dedicated SD models in Ollama, it follows a specific schema
            await axios.post(`${baseUrl}/api/generate`, {
                model,
                prompt: options.prompt,
                stream: false
            });

            // This is a placeholder for Ollama's specific SD integration if/when finalized
            // Currently, standard Ollama is primarily LLM.
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
            const response = await axios.post(`${baseUrl}/sdapi/v1/txt2img`, {
                prompt: options.prompt,
                negative_prompt: options.negativePrompt ?? 'text, watermark, low quality',
                steps: options.steps ?? 20,
                cfg_scale: options.cfgScale ?? 7,
                width: options.width ?? 512,
                height: options.height ?? 512,
                seed: options.seed ?? -1
            });

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

    private async generateWithComfyUI(_options: ImageGenerationOptions): Promise<string> {
        // Implementation for ComfyUI API (WebSocket + HTTP)
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
