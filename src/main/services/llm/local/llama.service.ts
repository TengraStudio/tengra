/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

// LlamaService - Uses llama-server executable for fast CUDA inference
// Communicates via HTTP API (OpenAI-compatible)

import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';

import { ipc } from '@main/core/ipc-decorators';
import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import { LocalImageService } from '@main/services/llm/local/local-image.service';
import { RuntimeBootstrapService } from '@main/services/system/runtime-bootstrap.service';
import { getManagedRuntimeBinDir, getManagedRuntimeModelsDir } from '@main/services/system/runtime-path.service';
import { withOperationGuard } from '@main/utils/operation-wrapper.util';
import { SESSION_CONVERSATION_CHANNELS } from '@shared/constants/ipc-channels';
import { OPERATION_TIMEOUTS } from '@shared/constants/timeouts';
import { RuntimeValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { IpcMainInvokeEvent } from 'electron';

/** Maximum model path length */
const MAX_PATH_LENGTH = 4096;
/** Maximum message length (100KB) */
const MAX_MESSAGE_LENGTH = 100 * 1024;
/** Maximum system prompt length (50KB) */
const MAX_SYSTEM_PROMPT_LENGTH = 50 * 1024;

interface LlamaConfig {
    gpuLayers?: number          // -1 = auto, 0 = CPU only
    contextSize?: number        // Default 8192
    batchSize?: number          // Default 512
    ubatchSize?: number         // Physical micro-batch size
    parallel?: number           // Concurrent decoding slots
    threads?: number            // Decode threads
    threadsBatch?: number       // Prompt processing threads
    flashAttn?: boolean         // Enable flash attention
    continuousBatching?: boolean // Enable continuous batching
    mlock?: boolean             // Lock model in RAM
    mmap?: boolean              // Enable mmap (true by default)
    defragThold?: number        // KV defrag threshold
    metrics?: boolean           // Expose runtime metrics
    port?: number               // Server port, default 8080
    host?: string               // Server host, default 127.0.0.1
    backend?: 'auto' | 'cpu' | 'cuda' | 'vulkan' | 'metal'
}

interface ModelInfo {
    name: string
    path: string
    size: number
    loaded: boolean
}

export class LlamaService extends BaseService {
    private static readonly WINDOWS_DLL_NOT_FOUND = 0xC0000135;
    private serverProcess: ChildProcess | null = null;
    private modelsDir: string;
    private binDir: string;
    private currentModelPath: string | null = null;
    private lastServerExitCode: number | null = null;
    private runtimeBootstrapAttempted = false;
    private serverPort: number = 8080;
    private serverHost: string = '127.0.0.1';
    private config: LlamaConfig = {
        gpuLayers: -1,
        contextSize: 8192,
        batchSize: 512,
        flashAttn: true,
        continuousBatching: true,
        mlock: true,
        mmap: true,
        port: 8080,
        host: '127.0.0.1',
        backend: 'auto'
    };
    private activeDownloadAbortController: AbortController | null = null;

    private localImageService?: LocalImageService;

    constructor(
        dataService?: DataService,
        private runtimeBootstrapService?: RuntimeBootstrapService
    ) {
        super('LlamaService');
        // Get paths
        try {
            if (dataService) {
                this.modelsDir = path.join(dataService.getPath('models'));
            } else {
                this.modelsDir = getManagedRuntimeModelsDir();
            }

            fs.mkdirSync(this.modelsDir, { recursive: true });
        } catch (e) {
            this.logWarn(`Failed to setup models directory: ${getErrorMessage(e as Error)}`);
            this.modelsDir = getManagedRuntimeModelsDir();
        }

        this.binDir = getManagedRuntimeBinDir();
    }

    setLocalImageService(localImageService: LocalImageService): void {
        this.localImageService = localImageService;
    }

    override async initialize(): Promise<void> {
        // sd-cpp is now a core runtime component. Kick off startup installation/check
        // in background so app boot is not blocked by model downloads.
        if (this.localImageService) {
            void this.localImageService
                .ensureSDCppReady()
                .then(() => this.logInfo('sd-cpp runtime is ready'))
                .catch(error =>
                    this.logWarn(`sd-cpp startup check failed: ${getErrorMessage(error as Error)}`)
                );
        }
    }

    async cleanup(): Promise<void> {
        await this.stopServer();
        this.logInfo('Cleanup complete');
    }

    private getServerPath(): string {
        const binaryName = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server';
        return path.join(this.binDir, binaryName);
    }

    private hasCudaBackendLibrary(): boolean {
        return fs.existsSync(path.join(this.binDir, 'ggml-cuda.dll'));
    }

    private getBundledServerCandidates(binaryName: string): string[] {
        const candidates = [
            process.resourcesPath ? path.join(process.resourcesPath, 'bin', binaryName) : '',
            path.resolve(process.cwd(), 'resources', 'bin', binaryName),
            path.resolve(path.dirname(process.execPath), 'resources', 'bin', binaryName),
        ]
            .filter(candidate => candidate !== '');

        return [...new Set(candidates)];
    }

    private stageBundledServerBinary(serverPath: string): boolean {
        const binaryName = path.basename(serverPath);
        const candidates = this.getBundledServerCandidates(binaryName);

        for (const candidate of candidates) {
            try {
                if (!fs.existsSync(candidate)) {
                    continue;
                }
                fs.copyFileSync(candidate, serverPath);
                if (process.platform !== 'win32') {
                    fs.chmodSync(serverPath, 0o755);
                }
                this.logInfo(`Staged llama-server binary from: ${candidate}`);
                return true;
            } catch (error) {
                this.logWarn(`Failed to stage llama-server from ${candidate}: ${getErrorMessage(error as Error)}`);
            }
        }

        return false;
    }

    private async ensureManagedRuntimeReady(force: boolean = false): Promise<void> {
        if (!this.runtimeBootstrapService) {
            return;
        }
        if (this.runtimeBootstrapAttempted && !force) {
            return;
        }

        this.runtimeBootstrapAttempted = true;
        this.logInfo('Ensuring managed runtime components are installed');
        await this.runtimeBootstrapService.ensureManagedRuntime();
    }

    private async ensureServerBinaryAvailable(serverPath: string): Promise<void> {
        if (fs.existsSync(serverPath)) {
            return;
        }

        try {
            await this.ensureManagedRuntimeReady();
            if (fs.existsSync(serverPath)) {
                return;
            }
        } catch (error) {
            this.logWarn(`Managed runtime ensure failed before llama launch: ${getErrorMessage(error as Error)}`);
        }

        const staged = this.stageBundledServerBinary(serverPath);
        if (staged && fs.existsSync(serverPath)) {
            return;
        }
    }

    @ipc('llama:isServerRunning')
    async isServerRunning(): Promise<boolean> {
        return new Promise((resolve) => {
            const req = http.request({
                hostname: this.serverHost,
                port: this.serverPort,
                path: '/health',
                method: 'GET',
                timeout: 2000
            }, (res) => {
                resolve(res.statusCode === 200);
            });
            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
            req.end();
        });
    }

    @ipc('llama:start')
    @ipc('llama:loadModel')
    async loadModel(modelPathRaw: RuntimeValue, configRaw?: RuntimeValue): Promise<{ success: boolean; error?: string }> {
        const modelPath = this.validatePath(modelPathRaw);
        if (!modelPath) {
            throw new Error('Invalid model path');
        }
        const config = (configRaw && typeof configRaw === 'object') ? configRaw as LlamaConfig : {};
        
        try {
            if (this.localImageService) {
                // Keep llama-cpp and sd-cpp lifecycle aligned.
                await this.localImageService.ensureSDCppReady();
            }

            const serverPath = this.getServerPath();
            await this.ensureServerBinaryAvailable(serverPath);

            if (this.config.backend !== 'cpu' && !this.hasCudaBackendLibrary()) {
                this.logWarn('CUDA backend library (ggml-cuda.dll) is missing; llama-server will run on CPU backend');
            }

            // Check if llama-server exists
            if (!fs.existsSync(serverPath)) {
                return {
                    success: false,
                    error: `llama-server.exe not found: ${serverPath}`
                };
            }

            // Check if model exists
            if (!fs.existsSync(modelPath)) {
                return { success: false, error: `Model file not found: ${modelPath}` };
            }

            // Stop existing server
            await this.stopServer();

            // Merge config
            if (config) {
                this.config = { ...this.config, ...config };
            }
            this.serverPort = this.config.port ?? 8080;
            this.serverHost = this.config.host ?? '127.0.0.1';

            this.logInfo(`Starting llama-server with model: ${modelPath}`);
            this.logInfo(`GPU Layers: ${this.config.gpuLayers}, Context: ${this.config.contextSize}`);

            const startResult = await this.startLlamaProcess(modelPath, serverPath);
            if (startResult.success) {
                return startResult;
            }

            if (this.shouldRetryAfterRuntimeRepair(startResult.error)) {
                this.logWarn('llama-server failed due missing runtime dependency; retrying after managed runtime repair');
                try {
                    await this.ensureManagedRuntimeReady(true);
                } catch (error) {
                    this.logWarn(`Managed runtime repair retry failed: ${getErrorMessage(error as Error)}`);
                }
                return this.startLlamaProcess(modelPath, serverPath);
            }

            return startResult;

        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    private shouldRetryAfterRuntimeRepair(errorMessage?: string): boolean {
        if (!errorMessage) {
            return false;
        }
        const normalized = errorMessage.toLowerCase();
        return normalized.includes('0xc0000135')
            || normalized.includes('3221225781')
            || normalized.includes('dll not found');
    }

    private formatExitCodeHex(code: number): string {
        const unsignedCode = code >>> 0;
        return `0x${unsignedCode.toString(16).toUpperCase()}`;
    }

    private async startLlamaProcess(modelPath: string, serverPath: string): Promise<{ success: boolean; error?: string }> {
        // Build command arguments
        const args = this.constructLlamaArgs(modelPath);

        // Start server
        const env = this.constructLlamaEnv();

        this.lastServerExitCode = null;
        this.serverProcess = spawn(serverPath, args, {
            cwd: this.binDir,
            env,
            windowsHide: true
        });

        this.setupProcessListeners();

        // Wait for server to start
        return this.waitForServerStart(modelPath);
    }

    private constructLlamaArgs(modelPath: string): string[] {
        const args = [
            '--model', modelPath,
            '--port', this.serverPort.toString(),
            '--host', this.serverHost,
            '--ctx-size', (this.config.contextSize ?? 4096).toString(),
            '--batch-size', (this.config.batchSize ?? 512).toString(),
        ];

        const gpuLayers = this.config.backend === 'cpu' ? 0 : (this.config.gpuLayers ?? -1);
        args.push('--n-gpu-layers', gpuLayers.toString());

        if (this.config.ubatchSize !== undefined) {
            args.push('--ubatch-size', this.config.ubatchSize.toString());
        }

        if (this.config.parallel !== undefined) {
            args.push('--parallel', this.config.parallel.toString());
        }

        if (this.config.threads !== undefined) {
            args.push('--threads', this.config.threads.toString());
        }

        if (this.config.threadsBatch !== undefined) {
            args.push('--threads-batch', this.config.threadsBatch.toString());
        }

        if (this.config.defragThold !== undefined) {
            args.push('--defrag-thold', this.config.defragThold.toString());
        }

        // Newer llama-server builds expect an explicit value for --flash-attn.
        // Keep default behavior on auto by not forcing the flag unless disabled.
        if (this.config.flashAttn === false) {
            args.push('--flash-attn', 'off');
        }

        if (this.config.continuousBatching ?? true) {
            args.push('--cont-batching');
        }

        // Keep reasoning enabled so users can observe live thinking traces.
        args.push('--reasoning', 'on');

        if (this.config.mlock ?? true) {
            args.push('--mlock');
        }

        if ((this.config.mmap ?? true) === false) {
            args.push('--no-mmap');
        }

        if (this.config.metrics) {
            args.push('--metrics');
        }

        return args;
    }

    private constructLlamaEnv(): NodeJS.ProcessEnv {
        const env: Record<string, string> = { ...process.env as Record<string, string>, PATH: this.binDir + ';' + process.env.PATH };

        if (this.config.backend === 'vulkan') {
            env['GGML_VULKAN'] = '1';
        } else if (
            this.config.backend === 'cuda'
            || (this.config.backend === 'auto' && this.hasCudaBackendLibrary())
        ) {
            env['GGML_CUDA'] = '1';
        } else if (this.config.backend === 'metal') {
            env['GGML_METAL'] = '1';
        }

        return env;
    }

    private setupProcessListeners() {
        if (!this.serverProcess) { return; }

        this.serverProcess.stdout?.on('data', (data) => {
            this.logInfo(`llama-server: ${data.toString()}`);
        });

        this.serverProcess.stderr?.on('data', (data) => {
            this.logError(`llama-server: ${data.toString()}`);
        });

        this.serverProcess.on('exit', (code) => {
            this.logInfo(`llama-server exited with code ${code}`);
            this.lastServerExitCode = typeof code === 'number' ? code : null;
            this.serverProcess = null;
            this.currentModelPath = null;
        });
    }

    private async waitForServerStart(modelPath: string): Promise<{ success: boolean; error?: string }> {
        for (let i = 0; i < 60; i++) {
            await new Promise(r => setTimeout(r, OPERATION_TIMEOUTS.RETRY_DELAY));
            if (await this.isServerRunning()) {
                this.currentModelPath = modelPath;
                this.logInfo('llama-server started successfully');
                return { success: true };
            }
            if (!this.serverProcess && this.lastServerExitCode !== null) {
                const exitHex = this.formatExitCodeHex(this.lastServerExitCode);
                if ((this.lastServerExitCode >>> 0) === LlamaService.WINDOWS_DLL_NOT_FOUND) {
                    return {
                        success: false,
                        error: `llama-server exited with code ${this.lastServerExitCode} (${exitHex}) - required runtime DLLs are missing`
                    };
                }
                return {
                    success: false,
                    error: `llama-server exited with code ${this.lastServerExitCode} (${exitHex})`
                };
            }
        }

        // Server didn't start
        await this.stopServer();
        return { success: false, error: 'Failed to start llama-server (timeout)' };
    }

    async stopServer(): Promise<void> {
        const proc = this.serverProcess;
        if (!proc) { return; }

        proc.kill('SIGTERM');
        await new Promise(r => setTimeout(r, OPERATION_TIMEOUTS.PROCESS_KILL_GRACE));

        if (!proc.killed) {
            proc.kill('SIGKILL');
        }

        this.serverProcess = null;
        this.currentModelPath = null;
    }

    @ipc('llama:stop')
    @ipc('llama:unloadModel')
    async unloadModel(): Promise<{ success: boolean }> {
        await this.stopServer();
        return { success: true };
    }

    @ipc({ channel: 'llama:chat', withEvent: true })
    async chatIpc(
        event: IpcMainInvokeEvent,
        messageRaw: RuntimeValue,
        systemPromptRaw?: RuntimeValue
    ): Promise<{ success: boolean; response?: unknown; error?: string }> {
        return this.chat(messageRaw, systemPromptRaw, (token) => {
            event.sender.send(SESSION_CONVERSATION_CHANNELS.STREAM_CHUNK, { content: token, reasoning: '' });
        });
    }

    async chat(
        messageRaw: RuntimeValue,
        systemPromptRaw?: RuntimeValue,
        onToken?: (token: string) => void
    ): Promise<{ success: boolean; response?: unknown; error?: string }> {
        const message = this.validateMessage(messageRaw);
        if (!message) {
            return { success: false, response: { success: false } };
        }
        const systemPrompt = this.validateSystemPrompt(systemPromptRaw);

        if (!await this.isServerRunning()) {
            return { success: false, error: 'llama-server is not running' };
        }

        const response = await withOperationGuard('llama', async () =>
            this.internalChat(message, systemPrompt, onToken)
        );
        return { success: true, response };
    }

    private async internalChat(
        message: string,
        systemPrompt?: string,
        onToken?: (token: string) => void
    ): Promise<{ success: boolean; response?: string; error?: string }> {

        return new Promise((resolve) => {
            const messages = [];
            if (systemPrompt) {
                messages.push({ role: 'system', content: systemPrompt });
            }
            messages.push({ role: 'user', content: message });

            const postData = JSON.stringify({
                messages,
                stream: !!onToken,
                max_tokens: 4096
            });

            const req = http.request({
                hostname: this.serverHost,
                port: this.serverPort,
                path: '/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            }, (res) => {
                let data = '';
                let fullResponse = '';

                res.on('data', (chunk) => {
                    const str = chunk.toString();

                    if (onToken) {
                        // Handle SSE streaming
                        const lines = str.split('\n');
                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const jsonStr = line.slice(6).trim();
                                if (jsonStr === '[DONE]') { continue; }
                                const obj = safeJsonParse<{ choices?: Array<{ delta?: { content?: string } }> }>(jsonStr, {});
                                const content = obj.choices?.[0]?.delta?.content;
                                if (content) {
                                    fullResponse += content;
                                    onToken(content);
                                }
                            }
                        }
                    } else {
                        data += str;
                    }
                });

                res.on('end', () => {
                    if (onToken) {
                        resolve({ success: true, response: fullResponse });
                    } else {
                        const result = safeJsonParse<{ choices?: Array<{ message?: { content?: string } }> }>(data, {});
                        const content = result.choices?.[0]?.message?.content ?? '';
                        resolve({ success: true, response: content });
                    }
                });
            });

            req.on('error', (e) => {
                resolve({ success: false, error: e.message });
            });

            req.write(postData);
            req.end();
        });
    }

    async getEmbeddings(input: string): Promise<number[]> {
        if (!await this.isServerRunning()) {
            throw new Error('llama-server is not running');
        }

        return new Promise((resolve, reject) => {
            const postData = JSON.stringify({
                input,
                model: 'default'
            });

            const req = http.request({
                hostname: this.serverHost,
                port: this.serverPort,
                path: '/v1/embeddings',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk.toString());
                res.on('end', () => {
                    const json = safeJsonParse<{ data?: Array<{ embedding?: number[] }> }>(data, {});
                    const embedding = json.data?.[0]?.embedding;
                    if (embedding) {
                        resolve(embedding);
                    } else {
                        reject(new Error('Invalid embedding response from llama-server'));
                    }
                });
            });

            req.on('error', (e) => reject(e));
            req.write(postData);
            req.end();
        });
    }

    @ipc('llama:resetSession')
    async resetSession(): Promise<{ success: boolean }> {
        // llama-server doesn't have persistent sessions
        return { success: true };
    }

    @ipc('llama:status')
    async getLlamaStatus(): Promise<{ running: boolean; model: string | null }> {
        const running = await this.isServerRunning();
        const model = this.getLoadedModel();
        return { running, model };
    }

    getLoadedModel(): string | null {
        return this.currentModelPath;
    }

    @ipc('llama:getModelsDir')
    async getModelsDirIpc(): Promise<string> {
        try {
            return this.getModelsDir();
        } catch (e) {
            return '';
        }
    }

    getModelsDir(): string {
        return this.modelsDir;
    }

    @ipc('llama:setModelsDir')
    async setModelsDir(dirRaw: RuntimeValue): Promise<boolean> {
        const dir = this.validatePath(dirRaw);
        if (!dir) {
            throw new Error('Invalid directory path');
        }
        this.modelsDir = dir;
        await fs.promises.mkdir(this.modelsDir, { recursive: true });
        return true;
    }

    getBinDir(): string {
        return this.binDir;
    }

    @ipc('llama:getModels')
    async getModels(): Promise<ModelInfo[]> {
        const models: ModelInfo[] = [];
        try {
            if (!fs.existsSync(this.modelsDir)) {
                return models;
            }

            const files = await fs.promises.readdir(this.modelsDir);

            for (const file of files) {
                if (file.endsWith('.gguf')) {
                    const fullPath = path.join(this.modelsDir, file);
                    const stats = await fs.promises.stat(fullPath);
                    models.push({
                        name: file.replace('.gguf', ''),
                        path: fullPath,
                        size: stats.size,
                        loaded: this.currentModelPath === fullPath
                    });
                }
            }
        } catch (e) {
            this.logError(`Error reading models directory: ${getErrorMessage(e as Error)}`);
        }

        return models;
    }

    @ipc('llama:downloadModel')
    async downloadModel(urlRaw: RuntimeValue, filenameRaw: RuntimeValue, onProgress?: (downloadedSize: number, total: number) => void): Promise<{ success: boolean; path?: string; error?: string }> {
        const url = typeof urlRaw === 'string' ? urlRaw : '';
        const filename = typeof filenameRaw === 'string' ? filenameRaw : '';

        if (!url || !filename || !url.startsWith('http') || filename.length > 255) {
            throw new Error('Invalid URL or filename');
        }

        const https = await import('https');
        const httpModule = await import('http');
        const { createWriteStream } = await import('fs');

        return new Promise((resolve) => {
            const abortController = new AbortController();
            this.activeDownloadAbortController = abortController;
            const outputPath = path.join(this.modelsDir, filename);
            const file = createWriteStream(outputPath);

            const protocol = url.startsWith('https') ? https : httpModule;

            const download = (downloadUrl: string) => {
                const request = protocol.get(downloadUrl, (response: http.IncomingMessage) => {
                    if (response.statusCode === 302 || response.statusCode === 301) {
                        const redirectUrl = response.headers.location;
                        if (redirectUrl) {
                            file.close();
                            download(redirectUrl);
                            return;
                        }
                    }

                    const totalSize = parseInt(response.headers['content-length'] ?? '0', 10);
                    let downloadedSize = 0;

                    response.on('data', (chunk: Buffer) => {
                        downloadedSize += chunk.length;
                        onProgress?.(downloadedSize, totalSize);
                    });

                    response.pipe(file);

                    file.on('finish', () => {
                        file.close();
                        this.activeDownloadAbortController = null;
                        resolve({ success: true, path: outputPath });
                    });

                    file.on('error', (err: Error) => {
                        file.close();
                        this.activeDownloadAbortController = null;
                        resolve({ success: false, error: err.message });
                    });
                }).on('error', (err: Error) => {
                    this.activeDownloadAbortController = null;
                    resolve({ success: false, error: err.message });
                });

                abortController.signal.addEventListener('abort', () => {
                    request.destroy(new Error('Download aborted'));
                    file.close();
                    this.activeDownloadAbortController = null;
                    resolve({ success: false, error: 'Download aborted' });
                }, { once: true });
            };

            download(url);
        });
    }

    @ipc('llama:abortDownload')
    async abortDownload(modelIdRaw: RuntimeValue): Promise<boolean> {
        if (typeof modelIdRaw !== 'string') {
            throw new Error('Invalid model ID');
        }
        if (!this.activeDownloadAbortController) {
            return false;
        }
        this.activeDownloadAbortController.abort();
        return true;
    }

    @ipc('llama:deleteModel')
    async deleteModel(modelPathRaw: RuntimeValue): Promise<{ success: boolean; error?: string }> {
        const modelPath = this.validatePath(modelPathRaw);
        if (!modelPath) {
            throw new Error('Invalid model path');
        }
        try {
            if (this.currentModelPath === modelPath) {
                await this.stopServer();
            }
            if (fs.existsSync(modelPath)) {
                await fs.promises.unlink(modelPath);
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    @ipc('llama:getConfig')
    getConfig(): LlamaConfig {
        return { ...this.config };
    }

    @ipc('llama:setConfig')
    setConfig(configRaw: RuntimeValue): { success: boolean } {
        const config = (configRaw && typeof configRaw === 'object') ? configRaw as Partial<LlamaConfig> : {};
        try {
            this.config = { ...this.config, ...config };
            return { success: true };
        } catch (e) {
            return { success: false };
        }
    }

    @ipc('llama:getGpuInfo')
    async getGpuInfo(): Promise<{ available: boolean; backends: string[]; name?: string }> {
        const backends: string[] = [];
        let detectedName = 'Generic GPU';

        // Check CUDA
        const cudaDll = path.join(this.binDir, 'ggml-cuda.dll');
        if (fs.existsSync(cudaDll)) {
            backends.push('cuda');
            detectedName = 'NVIDIA CUDA';
        }

        // Check Vulkan
        const vulkanDll = path.join(this.binDir, 'ggml-vulkan.dll');
        if (fs.existsSync(vulkanDll)) {
            backends.push('vulkan');
            if (backends.length === 1) {
                detectedName = 'Vulkan';
            } else {
                detectedName += ' / Vulkan';
            }
        }

        // Check Metal (Apple only)
        if (process.platform === 'darwin') {
            backends.push('metal');
            detectedName = 'Apple Metal';
        }

        return {
            available: backends.length > 0,
            backends,
            name: backends.length > 0 ? detectedName : 'None'
        };
    }

    @ipc('llama:is-installed')
    isServerAvailable(): boolean {
        return fs.existsSync(this.getServerPath());
    }

    /**
     * Validates a path string
     */
    private validatePath(value: RuntimeValue, maxLength: number = MAX_PATH_LENGTH): string | null {
        if (typeof value !== 'string') {
            return null;
        }
        const trimmed = value.trim();
        if (!trimmed || trimmed.length > maxLength) {
            return null;
        }
        return trimmed;
    }

    /**
     * Validates a message string
     */
    private validateMessage(value: RuntimeValue): string | null {
        if (typeof value !== 'string') {
            return null;
        }
        if (value.length > MAX_MESSAGE_LENGTH) {
            return null;
        }
        return value;
    }

    /**
     * Validates an optional system prompt
     */
    private validateSystemPrompt(value: RuntimeValue): string | undefined {
        if (value === undefined || value === null) {
            return undefined;
        }
        if (typeof value !== 'string') {
            return undefined;
        }
        if (value.length > MAX_SYSTEM_PROMPT_LENGTH) {
            return value.slice(0, MAX_SYSTEM_PROMPT_LENGTH);
        }
        return value;
    }
}
