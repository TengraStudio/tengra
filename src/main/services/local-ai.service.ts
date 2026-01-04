import * as http from 'http'
import { ChildProcess, spawn } from 'child_process'
import { existsSync } from 'fs'
import * as fsPromises from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import { SettingsService } from './settings.service'

export interface LocalAIModel {
    id: string
    name: string
    size: number
    provider: 'ollama' | 'llama-cpp'
    loaded: boolean
}

export class LocalAIService {
    private ollamaHost: string = '127.0.0.1'
    private ollamaPort: number = 11434
    private llamaProcess: ChildProcess | null = null
    private llamaModelPath: string | null = null
    private llamaPort: number = 8080

    constructor(private settingsService: SettingsService) {
        const settings = this.settingsService.getSettings()
        if (settings.ollama?.url) {
            try {
                const url = new URL(settings.ollama.url)
                this.ollamaHost = url.hostname
                this.ollamaPort = parseInt(url.port) || 11434
            } catch { }
        }
    }

    // --- Ollama Ops ---

    async getOllamaModels(): Promise<any[]> {
        try {
            const res = await this.ollamaRequest('/api/tags')
            return res.models || []
        } catch { return [] }
    }

    async ollamaChat(model: string, messages: any[]): Promise<any> {
        return this.ollamaRequest('/api/chat', 'POST', {
            model,
            messages,
            stream: false,
            options: { num_ctx: 8192 }
        })
    }

    private ollamaRequest(path: string, method: string = 'GET', body?: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const req = http.request({
                hostname: this.ollamaHost,
                port: this.ollamaPort,
                path,
                method,
                headers: body ? { 'Content-Type': 'application/json' } : undefined
            }, (res) => {
                let d = ''
                res.on('data', chunk => d += chunk)
                res.on('end', () => resolve(JSON.parse(d || '{}')))
            })
            req.on('error', reject)
            if (body) req.write(JSON.stringify(body))
            req.end()
        })
    }

    // --- Llama.cpp Ops ---

    async startLlamaServer(modelPath: string): Promise<boolean> {
        if (this.llamaProcess) this.stopLlamaServer()
        const binPath = join(process.cwd(), 'llama-bin', 'llama-server.exe')
        if (!existsSync(binPath)) return false

        this.llamaProcess = spawn(binPath, ['-m', modelPath, '--port', this.llamaPort.toString()], {
            windowsHide: true,
            stdio: 'ignore'
        })
        this.llamaModelPath = modelPath
        return true
    }

    stopLlamaServer() {
        if (this.llamaProcess) {
            this.llamaProcess.kill()
            this.llamaProcess = null
            this.llamaModelPath = null
        }
    }

    async getLlamaStyles(): Promise<string[]> {
        const dir = join(app.getPath('userData'), 'models')
        if (!existsSync(dir)) return []
        const files = await fsPromises.readdir(dir)
        return files.filter(f => f.endsWith('.gguf'))
    }

    // --- Unified API ---

    async getAllModels(): Promise<LocalAIModel[]> {
        const ollama = await this.getOllamaModels()
        const llama = await this.getLlamaStyles()

        return [
            ...ollama.map(m => ({ id: m.name, name: m.name, size: m.size, provider: 'ollama' as const, loaded: true })),
            ...llama.map(f => ({ id: f, name: f, size: 0, provider: 'llama-cpp' as const, loaded: f === this.llamaModelPath }))
        ]
    }
}
