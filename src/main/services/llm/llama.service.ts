// LlamaService - Uses llama-server executable for fast CUDA inference
// Communicates via HTTP API (OpenAI-compatible)

import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { app } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import * as http from 'http'
import { DataService } from '../data/data.service'

interface LlamaConfig {
    gpuLayers?: number          // -1 = auto, 0 = CPU only
    contextSize?: number        // Default 8192
    batchSize?: number          // Default 512
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

export class LlamaService {
    private serverProcess: ChildProcess | null = null
    private modelsDir: string
    private binDir: string
    private currentModelPath: string | null = null
    private serverPort: number = 8080
    private serverHost: string = '127.0.0.1'
    private config: LlamaConfig = {
        gpuLayers: -1,
        contextSize: 8192,
        batchSize: 512,
        port: 8080,
        host: '127.0.0.1',
        backend: 'auto'
    }

    constructor(dataService?: DataService) {
        // Get paths
        try {
            if (dataService) {
                this.modelsDir = join(dataService.getPath('models'))
            } else {
                this.modelsDir = join(app.getPath('userData'), 'models')
            }

            if (!existsSync(this.modelsDir)) {
                mkdirSync(this.modelsDir, { recursive: true })
            }
        } catch (e) {
            this.modelsDir = './models'
        }

        // llama-server binary path
        this.binDir = join(__dirname, '../../vendor/llama-bin')

        // Fallback to project root if not in dist
        if (!existsSync(this.binDir)) {
            this.binDir = join(process.cwd(), 'vendor', 'llama-bin')
        }
    }

    private getServerPath(): string {
        return join(this.binDir, 'llama-server.exe')
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
                resolve(res.statusCode === 200)
            })
            req.on('error', () => resolve(false))
            req.on('timeout', () => {
                req.destroy()
                resolve(false)
            })
            req.end()
        })
    }

    async loadModel(modelPath: string, config?: LlamaConfig): Promise<{ success: boolean; error?: string }> {
        try {
            // Check if llama-server exists
            const serverPath = this.getServerPath()
            if (!existsSync(serverPath)) {
                return {
                    success: false,
                    error: `llama-server.exe bulunamadı: ${serverPath}`
                }
            }

            // Check if model exists
            if (!existsSync(modelPath)) {
                return { success: false, error: `Model dosyası bulunamadı: ${modelPath}` }
            }

            // Stop existing server
            await this.stopServer()

            // Merge config
            if (config) {
                this.config = { ...this.config, ...config }
            }
            this.serverPort = this.config.port || 8080
            this.serverHost = this.config.host || '127.0.0.1'

            console.log(`Starting llama-server with model: ${modelPath}`)
            console.log(`GPU Layers: ${this.config.gpuLayers}, Context: ${this.config.contextSize}`)

            // Build command arguments
            const args = [
                '--model', modelPath,
                '--host', this.serverHost,
                '--port', this.serverPort.toString(),
                '--ctx-size', (this.config.contextSize || 8192).toString(),
                '--batch-size', (this.config.batchSize || 512).toString(),
                '--flash-attn',  // Enable flash attention
                '--cont-batching',  // Continuous batching
                '--mlock',  // Lock memory
            ]

            // Add GPU layers if specified
            if (this.config.gpuLayers !== undefined && this.config.gpuLayers >= 0) {
                args.push('--gpu-layers', this.config.gpuLayers.toString())
            } else {
                args.push('--gpu-layers', '999')  // All layers on GPU
            }

            // Start server
            const env: Record<string, string> = { ...process.env, PATH: this.binDir + ';' + process.env.PATH }

            // Backend specific environment variables
            if (this.config.backend === 'vulkan') {
                env['GGML_VULKAN'] = '1'
            } else if (this.config.backend === 'cuda') {
                env['GGML_CUDA'] = '1'
            } else if (this.config.backend === 'metal') {
                env['GGML_METAL'] = '1'
            } else if (this.config.backend === 'cpu') {
                args.push('--gpu-layers', '0')
            }

            this.serverProcess = spawn(serverPath, args, {
                cwd: this.binDir,
                env,
                windowsHide: true
            })

            this.serverProcess.stdout?.on('data', (data) => {
                console.log('llama-server:', data.toString())
            })

            this.serverProcess.stderr?.on('data', (data) => {
                console.error('llama-server:', data.toString())
            })

            this.serverProcess.on('exit', (code) => {
                console.log(`llama-server exited with code ${code}`)
                this.serverProcess = null
                this.currentModelPath = null
            })

            // Wait for server to start
            for (let i = 0; i < 60; i++) {  // Wait up to 60 seconds
                await new Promise(r => setTimeout(r, 1000))
                if (await this.isServerRunning()) {
                    this.currentModelPath = modelPath
                    console.log('llama-server started successfully')
                    return { success: true }
                }
            }

            // Server didn't start
            await this.stopServer()
            return { success: false, error: 'llama-server başlatılamadı (timeout)' }

        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }

    async stopServer(): Promise<void> {
        if (this.serverProcess) {
            this.serverProcess.kill('SIGTERM')
            await new Promise(r => setTimeout(r, 1000))
            if (this.serverProcess && !this.serverProcess.killed) {
                this.serverProcess.kill('SIGKILL')
            }
            this.serverProcess = null
            this.currentModelPath = null
        }
    }

    async unloadModel(): Promise<void> {
        await this.stopServer()
    }

    async chat(
        message: string,
        systemPrompt?: string,
        onToken?: (token: string) => void
    ): Promise<{ success: boolean; response?: string; error?: string }> {
        if (!await this.isServerRunning()) {
            return { success: false, error: 'llama-server çalışmıyor' }
        }

        return new Promise((resolve) => {
            const messages = []
            if (systemPrompt) {
                messages.push({ role: 'system', content: systemPrompt })
            }
            messages.push({ role: 'user', content: message })

            const postData = JSON.stringify({
                messages,
                stream: !!onToken,
                max_tokens: 4096
            })

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
                let data = ''
                let fullResponse = ''

                res.on('data', (chunk) => {
                    const str = chunk.toString()

                    if (onToken) {
                        // Handle SSE streaming
                        const lines = str.split('\n')
                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const jsonStr = line.slice(6).trim()
                                if (jsonStr === '[DONE]') continue
                                try {
                                    const obj = JSON.parse(jsonStr)
                                    const content = obj.choices?.[0]?.delta?.content
                                    if (content) {
                                        fullResponse += content
                                        onToken(content)
                                    }
                                } catch (e) { }
                            }
                        }
                    } else {
                        data += str
                    }
                })

                res.on('end', () => {
                    if (onToken) {
                        resolve({ success: true, response: fullResponse })
                    } else {
                        try {
                            const result = JSON.parse(data)
                            const content = result.choices?.[0]?.message?.content || ''
                            resolve({ success: true, response: content })
                        } catch (e) {
                            resolve({ success: false, error: 'Invalid response' })
                        }
                    }
                })
            })

            req.on('error', (e) => {
                resolve({ success: false, error: e.message })
            })

            req.write(postData)
            req.end()
        })
    }

    async getEmbeddings(input: string): Promise<number[]> {
        if (!await this.isServerRunning()) {
            throw new Error('llama-server çalışmıyor')
        }

        return new Promise((resolve, reject) => {
            const postData = JSON.stringify({
                input,
                model: 'default'
            })

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
                let data = ''
                res.on('data', chunk => data += chunk.toString())
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data)
                        resolve(json.data[0].embedding)
                    } catch (e) {
                        reject(new Error('Failed to parse llama-server embeddings response'))
                    }
                })
            })

            req.on('error', (e) => reject(e))
            req.write(postData)
            req.end()
        })
    }

    async resetSession(): Promise<void> {
        // llama-server doesn't have persistent sessions
    }

    getLoadedModel(): string | null {
        return this.currentModelPath
    }

    getModelsDir(): string {
        return this.modelsDir
    }

    getBinDir(): string {
        return this.binDir
    }

    async getModels(): Promise<ModelInfo[]> {
        const models: ModelInfo[] = []
        try {
            const fs = await import('fs/promises')
            if (!existsSync(this.modelsDir)) return models

            const files = await fs.readdir(this.modelsDir)

            for (const file of files) {
                if (file.endsWith('.gguf')) {
                    const fullPath = join(this.modelsDir, file)
                    const stats = await fs.stat(fullPath)
                    models.push({
                        name: file.replace('.gguf', ''),
                        path: fullPath,
                        size: stats.size,
                        loaded: this.currentModelPath === fullPath
                    })
                }
            }
        } catch (e) {
            console.error('Error reading models directory:', e)
        }

        return models
    }

    async downloadModel(
        url: string,
        filename: string,
        onProgress?: (downloaded: number, total: number) => void
    ): Promise<{ success: boolean; path?: string; error?: string }> {
        const https = await import('https')
        const httpModule = await import('http')
        const { createWriteStream } = await import('fs')

        return new Promise((resolve) => {
            const outputPath = join(this.modelsDir, filename)
            const file = createWriteStream(outputPath)

            const protocol = url.startsWith('https') ? https : httpModule

            const download = (downloadUrl: string) => {
                protocol.get(downloadUrl, (response: any) => {
                    if (response.statusCode === 302 || response.statusCode === 301) {
                        const redirectUrl = response.headers.location
                        if (redirectUrl) {
                            file.close()
                            download(redirectUrl)
                            return
                        }
                    }

                    const totalSize = parseInt(response.headers['content-length'] || '0', 10)
                    let downloaded = 0

                    response.on('data', (chunk: Buffer) => {
                        downloaded += chunk.length
                        onProgress?.(downloaded, totalSize)
                    })

                    response.pipe(file)

                    file.on('finish', () => {
                        file.close()
                        resolve({ success: true, path: outputPath })
                    })

                    file.on('error', (err: Error) => {
                        file.close()
                        resolve({ success: false, error: err.message })
                    })
                }).on('error', (err: Error) => {
                    resolve({ success: false, error: err.message })
                })
            }

            download(url)
        })
    }

    async deleteModel(modelPath: string): Promise<{ success: boolean; error?: string }> {
        const fs = await import('fs/promises')

        try {
            if (this.currentModelPath === modelPath) {
                await this.stopServer()
            }
            if (existsSync(modelPath)) {
                await fs.unlink(modelPath)
            }
            return { success: true }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }

    getConfig(): LlamaConfig {
        return { ...this.config }
    }

    setConfig(config: Partial<LlamaConfig>): void {
        this.config = { ...this.config, ...config }
    }

    async getGpuInfo(): Promise<{ available: boolean; backends: string[]; name?: string }> {
        const backends: string[] = []
        let detectedName = 'Generic GPU'

        // Check CUDA
        const cudaDll = join(this.binDir, 'ggml-cuda.dll')
        if (existsSync(cudaDll)) {
            backends.push('cuda')
            detectedName = 'NVIDIA CUDA'
        }

        // Check Vulkan
        const vulkanDll = join(this.binDir, 'ggml-vulkan.dll')
        if (existsSync(vulkanDll)) {
            backends.push('vulkan')
            if (backends.length === 1) detectedName = 'Vulkan'
            else detectedName += ' / Vulkan'
        }

        // Check Metal (Apple only)
        if (process.platform === 'darwin') {
            backends.push('metal')
            detectedName = 'Apple Metal'
        }

        return {
            available: backends.length > 0,
            backends,
            name: backends.length > 0 ? detectedName : 'None'
        }
    }

    isServerAvailable(): boolean {
        return existsSync(this.getServerPath())
    }
}
