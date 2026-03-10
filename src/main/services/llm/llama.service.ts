// LlamaService - Uses llama-server executable for fast CUDA inference
// Communicates via HTTP API (OpenAI-compatible)

import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';

import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import { LocalImageService } from '@main/services/llm/local-image.service';
import { getManagedRuntimeBinDir, getManagedRuntimeModelsDir } from '@main/services/system/runtime-path.service';
import { OPERATION_TIMEOUTS } from '@shared/constants/timeouts';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';

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
    private serverProcess: ChildProcess | null = null;
    private modelsDir: string;
    private binDir: string;
    private currentModelPath: string | null = null;
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

    constructor(dataService?: DataService, private localImageService?: LocalImageService) {
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

    async loadModel(modelPath: string, config?: LlamaConfig): Promise<{ success: boolean; error?: string }> {
        try {
            if (this.localImageService) {
                // Keep llama-cpp and sd-cpp lifecycle aligned.
                await this.localImageService.ensureSDCppReady();
            }

            // Check if llama-server exists
            const serverPath = this.getServerPath();
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

            return this.startLlamaProcess(modelPath, serverPath);

        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    private async startLlamaProcess(modelPath: string, serverPath: string): Promise<{ success: boolean; error?: string }> {
        // Build command arguments
        const args = this.constructLlamaArgs(modelPath);

        // Start server
        const env = this.constructLlamaEnv();

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

        if (this.config.flashAttn ?? true) {
            args.push('--flash-attn');
        }

        if (this.config.continuousBatching ?? true) {
            args.push('--cont-batching');
        }

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
        } else if (this.config.backend === 'cuda') {
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

    async unloadModel(): Promise<void> {
        await this.stopServer();
    }

    async chat(
        message: string,
        systemPrompt?: string,
        onToken?: (token: string) => void
    ): Promise<{ success: boolean; response?: string; error?: string }> {
        if (!await this.isServerRunning()) {
            return { success: false, error: 'llama-server is not running' };
        }

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

    async resetSession(): Promise<void> {
        // llama-server doesn't have persistent sessions
    }

    getLoadedModel(): string | null {
        return this.currentModelPath;
    }

    getModelsDir(): string {
        return this.modelsDir;
    }

    getBinDir(): string {
        return this.binDir;
    }

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

    async downloadModel(url: string, filename: string, onProgress?: (downloadedSize: number, total: number) => void): Promise<{ success: boolean; path?: string; error?: string }> {
        const https = await import('https');
        const httpModule = await import('http');
        const { createWriteStream } = await import('fs');

        return new Promise((resolve) => {
            const outputPath = path.join(this.modelsDir, filename);
            const file = createWriteStream(outputPath);

            const protocol = url.startsWith('https') ? https : httpModule;

            const download = (downloadUrl: string) => {
                protocol.get(downloadUrl, (response: http.IncomingMessage) => {
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
                        resolve({ success: true, path: outputPath });
                    });

                    file.on('error', (err: Error) => {
                        file.close();
                        resolve({ success: false, error: err.message });
                    });
                }).on('error', (err: Error) => {
                    resolve({ success: false, error: err.message });
                });
            };

            download(url);
        });
    }

    async deleteModel(modelPath: string): Promise<{ success: boolean; error?: string }> {
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

    getConfig(): LlamaConfig {
        return { ...this.config };
    }

    setConfig(config: Partial<LlamaConfig>): void {
        this.config = { ...this.config, ...config };
    }

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

    isServerAvailable(): boolean {
        return fs.existsSync(this.getServerPath());
    }
}
