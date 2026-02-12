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
    private sdCppRuntimePromise: Promise<{ binaryPath: string; modelPath: string }> | null = null;
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
            for (const file of files) {
                const filePath = path.join(tempDir, file);
                await fs.promises.unlink(filePath).catch(() => { });
            }
            this.logDebug(`Cleaned up ${files.length} stale temp files`);
        }
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

    /**
     * Generate an image using available providers
     * Priority: Antigravity (with quota) > Pollinations > Other local providers
     */
    async generateImage(options: ImageGenerationOptions): Promise<string> {
        const settings = this.settingsService.getSettings();
        const preferredProvider = (settings.images?.provider ?? 'antigravity') as ImageProvider;

        this.logInfo(`Generating image with preferred provider: ${preferredProvider}`);

        // Try Antigravity first if available
        if (this.authService && this.llmService && this.quotaService) {
            const result = await this.tryGenerateWithAntigravity(options);
            if (result) { return result; }
        }

        // Fallback to preferred provider or Pollinations
        this.logInfo(`Falling back to ${preferredProvider === 'antigravity' ? 'pollinations' : preferredProvider}`);
        try {
            return await this.generateWithProvider(preferredProvider, options);
        } catch (error) {
            if (preferredProvider === 'sd-cpp') {
                this.logWarn('SD-CPP generation failed, falling back to Pollinations', error as Error);
                this.trackSdCppMetric('sd-cpp-fallback-triggered', { error: getErrorMessage(error as Error) });
                return this.generateWithPollinations(options);
            }
            throw error;
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
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const response = await this.quotaService!.fetchAntigravityUpstreamForToken(account) as AntigravityUpstreamQuotaResponse;

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
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            return this.saveTempImage(Buffer.from(response.data));
        } catch (error) {
            this.logError('Pollinations generation failed', error as Error);
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

    private async generateWithComfyUI(_options: ImageGenerationOptions): Promise<string> {
        throw new Error('ComfyUI integration is coming soon.');
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

        if (this.sdCppRuntimePromise) {
            return 'installing';
        }

        const binExists = binaryPath ? await this.pathExists(binaryPath) : false;
        const modelExists = modelPath ? await this.pathExists(modelPath) : false;

        if (binExists && modelExists) {
            return 'ready';
        }

        if (binaryPath || modelPath) {
            return 'failed';
        }

        return 'notConfigured';
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
        const directCandidate = path.join(binDir, this.getDefaultSDCppBinaryName());
        if (await this.pathExists(directCandidate)) {
            return directCandidate;
        }

        const nestedCandidate = await this.findExecutableRecursively(binDir, this.getDefaultSDCppBinaryName());
        if (nestedCandidate) {
            return nestedCandidate;
        }

        await this.installSDCppBinary(binDir);

        if (await this.pathExists(directCandidate)) {
            return directCandidate;
        }

        const installedNested = await this.findExecutableRecursively(binDir, this.getDefaultSDCppBinaryName());
        if (installedNested) {
            return installedNested;
        }

        throw new Error('stable-diffusion.cpp was downloaded but executable could not be located.');
    }

    private getDefaultSDCppBinaryName(): string {
        if (process.platform === 'win32') {
            return 'sd.exe';
        }
        return 'sd';
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

    private async saveTempImage(buffer: Buffer): Promise<string> {
        const filePath = this.createTempOutputPath('png');
        fs.writeFileSync(filePath, buffer);
        return filePath;
    }
}
