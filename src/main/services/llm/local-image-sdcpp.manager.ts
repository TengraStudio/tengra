import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { TelemetryService } from '@main/services/analysis/telemetry.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { SettingsService } from '@main/services/system/settings.service';
import { getErrorMessage } from '@shared/utils/error.util';
import axios from 'axios';
import { app } from 'electron';

import type { GitHubRelease, GitHubReleaseAsset, ImageGenerationOptions } from './local-image.types';

const SD_CPP_RELEASE_API = 'https://api.github.com/repos/leejet/stable-diffusion.cpp/releases/latest';
const DEFAULT_SDCPP_MODEL_URL =
    'https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors?download=true';

interface SdCppDeps {
    settingsService: SettingsService;
    eventBusService?: EventBusService;
    telemetryService?: TelemetryService;
}

/** Manages SD-CPP binary installation, runtime, and image generation. */
export class SdCppManager {
    private sdCppRuntimePromise: Promise<{ binaryPath: string; modelPath: string }> | null = null;
    private readonly deps: SdCppDeps;

    constructor(deps: SdCppDeps) {
        this.deps = deps;
    }

    /** Get the current status of the SD-CPP runtime. */
    async getStatus(): Promise<string> {
        const settings = this.deps.settingsService.getSettings();
        const binaryPath = settings.images?.sdCppBinaryPath;
        const modelPath = settings.images?.sdCppModelPath;

        let status = 'notConfigured';
        if (this.sdCppRuntimePromise) {
            status = 'installing';
            this.trackMetric('sd-cpp-status-checked', { status });
            return status;
        }

        const binExists = binaryPath ? await this.pathExists(binaryPath) : false;
        const modelExists = modelPath ? await this.pathExists(modelPath) : false;

        if (binExists && modelExists) {
            status = 'ready';
        } else if (binaryPath || modelPath) {
            status = 'failed';
        }
        this.trackMetric('sd-cpp-status-checked', { status });
        return status;
    }

    /** Ensure SD-CPP runtime is ready. Concurrent calls share the same promise. */
    async ensureReady(): Promise<{ binaryPath: string; modelPath: string }> {
        if (this.sdCppRuntimePromise) {
            return this.sdCppRuntimePromise;
        }

        this.sdCppRuntimePromise = this.ensureRuntime()
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

    /** Force reinstallation of SD-CPP runtime. */
    async reinstall(): Promise<void> {
        appLogger.info('SdCppManager', 'Triggering sd-cpp reinstallation/repair...');
        const baseDir = path.join(app.getPath('userData'), 'ai', 'sd-cpp');
        this.sdCppRuntimePromise = null;

        if (fs.existsSync(baseDir)) {
            try {
                const tempOldDir = `${baseDir}_old_${Date.now()}`;
                await fs.promises.rename(baseDir, tempOldDir);
                void fs.promises.rm(tempOldDir, { recursive: true, force: true }).catch(() => { });
            } catch (error) {
                appLogger.warn('SdCppManager', `Failed to rename old sd-cpp dir: ${getErrorMessage(error as Error)}`);
                await fs.promises.rm(baseDir, { recursive: true, force: true }).catch(() => { });
            }
        }
        await this.ensureReady();
    }

    /** Repair the SD-CPP runtime. */
    async repair(): Promise<void> {
        appLogger.info('SdCppManager', 'Starting manual repair of SD-CPP runtime');
        this.sdCppRuntimePromise = null;
        try {
            await this.ensureReady();
        } catch (error) {
            appLogger.error('SdCppManager', `Manual repair failed: ${getErrorMessage(error as Error)}`);
            throw error;
        }
    }

    /** Generate an image using the SD-CPP binary. */
    async generate(options: ImageGenerationOptions): Promise<string> {
        const runtime = await this.ensureReady();
        const extraArgs = this.parseCliArgs(
            this.deps.settingsService.getSettings().images?.sdCppExtraArgs?.trim() ||
            process.env.SD_CPP_EXTRA_ARGS?.trim()
        );
        const outputPath = this.createTempOutputPath('png');

        await this.ensurePathExists(runtime.modelPath, 'stable-diffusion.cpp model');
        await this.ensurePathExists(runtime.binaryPath, 'stable-diffusion.cpp binary');

        const args = this.buildArgs(runtime, options, outputPath, extraArgs);

        appLogger.info('SdCppManager', `Running stable-diffusion.cpp with binary "${runtime.binaryPath}"`);
        try {
            await this.runProcess(runtime.binaryPath, args);
            if (!fs.existsSync(outputPath)) {
                throw new Error('stable-diffusion.cpp finished but did not produce an output file.');
            }
            this.trackMetric('sd-cpp-generation-success', { prompt: options.prompt });
            return outputPath;
        } catch (error) {
            this.trackMetric('sd-cpp-generation-failure', { error: getErrorMessage(error as Error) });
            throw error;
        }
    }

    /** Track a telemetry metric. */
    trackMetric(name: string, properties?: Record<string, unknown>): void {
        if (this.deps.telemetryService) {
            this.deps.telemetryService.track(name, { provider: 'sd-cpp', ...properties });
        }
    }

    private buildArgs(
        runtime: { binaryPath: string; modelPath: string },
        options: ImageGenerationOptions,
        outputPath: string,
        extraArgs: string[]
    ): string[] {
        const args = [
            '-m', runtime.modelPath,
            '-p', options.prompt,
            '-o', outputPath,
            '-W', String(options.width ?? 1024),
            '-H', String(options.height ?? 1024),
            '--steps', String(options.steps ?? 24),
            '--cfg-scale', String(options.cfgScale ?? 7),
        ];
        if (options.negativePrompt) {
            args.push('--negative-prompt', options.negativePrompt);
        }
        if (typeof options.seed === 'number') {
            args.push('--seed', String(options.seed));
        }
        args.push(...extraArgs);
        return args;
    }

    private async ensureRuntime(): Promise<{ binaryPath: string; modelPath: string }> {
        this.emitStatus('installing');
        const settings = this.deps.settingsService.getSettings();
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
            binaryPath = await this.resolveOrInstallBinary(binDir);
        }
        if (!modelPath || !(await this.pathExists(modelPath))) {
            modelPath = (await this.findModelFile(modelDir)) || (await this.downloadDefaultModel(modelDir));
        }

        await this.persistPaths(binaryPath, modelPath);
        return { binaryPath, modelPath };
    }

    private async resolveOrInstallBinary(binDir: string): Promise<string> {
        const candidates = this.getBinaryCandidates();

        for (const name of candidates) {
            const p = path.join(binDir, name);
            if (await this.pathExists(p)) { return p; }
        }
        for (const name of candidates) {
            const nested = await this.findExecutableRecursively(binDir, name);
            if (nested) { return nested; }
        }

        await this.installBinary(binDir);

        for (const name of candidates) {
            const p = path.join(binDir, name);
            if (await this.pathExists(p)) { return p; }
        }
        for (const name of candidates) {
            const nested = await this.findExecutableRecursively(binDir, name);
            if (nested) { return nested; }
        }

        throw new Error('stable-diffusion.cpp was downloaded but executable could not be located.');
    }

    private getBinaryCandidates(): string[] {
        if (process.platform === 'win32') {
            return ['sd.exe', 'sd-cli.exe', 'stable-diffusion.exe'];
        }
        return ['sd', 'sd-cli', 'stable-diffusion'];
    }

    private async installBinary(binDir: string): Promise<void> {
        appLogger.info('SdCppManager', 'Binary not found, starting automatic installation.');
        const release = await axios.get<GitHubRelease>(SD_CPP_RELEASE_API, {
            timeout: 15000,
            headers: { Accept: 'application/vnd.github+json' },
        });

        const selectedAsset = this.selectReleaseAsset(release.data.assets ?? []);
        if (!selectedAsset) {
            throw new Error('No compatible stable-diffusion.cpp release asset found for this platform.');
        }

        const downloadPath = path.join(binDir, selectedAsset.name);
        const expectedSha256 = await this.fetchChecksumForAsset(release.data, selectedAsset);
        await this.downloadToFile(selectedAsset.browser_download_url, downloadPath, expectedSha256);
        await this.extractIfNeeded(downloadPath, binDir);
    }

    private async fetchChecksumForAsset(release: GitHubRelease, asset: GitHubReleaseAsset): Promise<string | undefined> {
        try {
            const checksumAsset = release.assets?.find(a =>
                a.name === `${asset.name}.sha256` || a.name === `${asset.name}.sha256sum`
            );
            if (checksumAsset) {
                appLogger.info('SdCppManager', `Found checksum asset: ${checksumAsset.name}`);
                const checksumRes = await axios.get(checksumAsset.browser_download_url, { timeout: 10000 });
                const match = checksumRes.data.match(/[a-fA-F0-9]{64}/);
                if (match) {
                    appLogger.info('SdCppManager', `Will verify sha256: ${match[0]}`);
                    return match[0] as string;
                }
            }
        } catch (err) {
            appLogger.warn('SdCppManager', `Failed to fetch checksum: ${getErrorMessage(err as Error)}`);
        }
        return undefined;
    }

    private selectReleaseAsset(assets: GitHubReleaseAsset[]): GitHubReleaseAsset | null {
        if (assets.length === 0) { return null; }

        const normalized = assets.map(asset => ({ ...asset, key: asset.name.toLowerCase() }));
        const platform = process.platform;
        const arch = process.arch;

        const platformTokens = platform === 'win32'
            ? ['win', 'windows', 'msvc']
            : platform === 'darwin'
                ? ['mac', 'darwin', 'osx', 'apple']
                : ['linux', 'ubuntu'];
        const archTokens = arch === 'arm64' ? ['arm64', 'aarch64'] : ['x64', 'amd64', 'x86_64'];
        const avx2Tokens = ['avx2'];
        const avxTokens = ['avx'];

        const scoredAssets = normalized.map(asset => {
            let score = 0;
            const matchesPlatform = platformTokens.some(t => asset.key.includes(t));
            const matchesArch = archTokens.some(t => asset.key.includes(t));
            if (!matchesPlatform || !matchesArch) { return { ...asset, score: -1 }; }
            score += 100;
            if (asset.key.endsWith('.zip') || asset.key.endsWith('.tar.gz') || asset.key.endsWith('.tgz')) { score += 50; }
            if (avx2Tokens.some(t => asset.key.includes(t))) { score += 20; }
            if (avxTokens.some(t => asset.key.includes(t))) { score += 10; }
            if (asset.key.includes('debug')) { score -= 30; }
            if (asset.key.includes('no-avx')) { score -= 20; }
            return { ...asset, score };
        });

        const best = scoredAssets.filter(a => a.score > 0).sort((a, b) => b.score - a.score)[0];
        return best || scoredAssets.find(a => a.score >= 0) || null;
    }

    private async downloadDefaultModel(modelDir: string): Promise<string> {
        const defaultModelPath = path.join(modelDir, 'v1-5-pruned-emaonly.safetensors');
        if (await this.pathExists(defaultModelPath)) { return defaultModelPath; }
        appLogger.info('SdCppManager', 'No local sd-cpp model found. Downloading default model.');
        await this.downloadToFile(DEFAULT_SDCPP_MODEL_URL, defaultModelPath);
        return defaultModelPath;
    }

    private async persistPaths(binaryPath: string, modelPath: string): Promise<void> {
        try {
            const current = this.deps.settingsService.getSettings();
            await this.deps.settingsService.saveSettings({
                images: { ...(current.images ?? { provider: 'antigravity' }), sdCppBinaryPath: binaryPath, sdCppModelPath: modelPath },
            });
        } catch (error) {
            appLogger.warn('SdCppManager', `Failed to persist sd-cpp paths: ${getErrorMessage(error as Error)}`);
        }
    }

    private async findModelFile(dir: string): Promise<string | null> {
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
        if (!(await this.pathExists(dir))) { return; }
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
        } catch { return false; }
    }

    private async downloadToFile(url: string, outputPath: string, expectedSha256?: string): Promise<void> {
        const tempPath = `${outputPath}.tmp`;
        const response = await axios.get(url, { responseType: 'stream', timeout: 300000 });
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
            writer.on('finish', () => { writer.close(); resolve(); });
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
            appLogger.info('SdCppManager', `Checksum verified for ${filename}`);
        }
        await fs.promises.rename(tempPath, outputPath);
    }

    private async extractIfNeeded(downloadedPath: string, targetDir: string): Promise<void> {
        const lower = downloadedPath.toLowerCase();
        if (lower.endsWith('.zip')) {
            if (process.platform === 'win32') {
                await this.runProcess('powershell', [
                    '-NoProfile', '-Command',
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
        return path.join(tempDir, `generated-${crypto.randomUUID()}.${extension}`);
    }

    private parseCliArgs(rawArgs?: string): string[] {
        if (!rawArgs) { return []; }
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
            const child = spawn(command, args, { shell: false, windowsHide: true });
            child.stdout.on('data', (chunk: Buffer) => { appLogger.debug('sd-cpp', chunk.toString()); });
            child.stderr.on('data', (chunk: Buffer) => { appLogger.error('sd-cpp', chunk.toString()); });
            child.on('error', (error: Error) => {
                appLogger.error('SdCppManager', `Process failed: ${command}: ${error.message}`);
                reject(error);
            });
            child.on('close', (code: number) => {
                if (code !== 0) { reject(new Error(`Process ${command} exited with code ${code}`)); }
                else { resolve(); }
            });
        });
    }

    private emitStatus(state: 'installing' | 'ready' | 'failed', error?: string): void {
        if (this.deps.eventBusService) {
            this.deps.eventBusService.emit('sd-cpp:status', { state, error });
        }
        appLogger.info('SdCppManager', `sd-cpp status changed to: ${state}${error ? ` (${error})` : ''}`);
    }

    private emitProgress(downloaded: number, total: number, filename: string): void {
        if (this.deps.eventBusService) {
            this.deps.eventBusService.emit('sd-cpp:progress', { downloaded, total, filename });
        }
    }
}
