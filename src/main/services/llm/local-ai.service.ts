import { ChildProcess, exec, spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

import { appLogger } from '@main/logging/logger'
import { SettingsService } from '@main/services/system/settings.service'

export interface LocalAIModel {
    id: string
    name: string
    size: number
    provider: 'ollama' | 'llama-cpp'
    loaded: boolean
}

export interface OllamaModel {
    name: string
    size: number
    digest: string
    modified_at: string
}

export interface OllamaChatMessage {
    role: 'user' | 'assistant' | 'system'
    content: string
}

export interface OllamaResponse {
    models?: OllamaModel[]
}

export interface OllamaChatResponse {
    message: OllamaChatMessage
}

export class LocalAIService {
    private llamaProcess: ChildProcess | null = null
    private llamaModelPath: string | null = null
    private llamaPort: number = 8080

    constructor(private settingsService: SettingsService) {
    }

    // --- Ollama Ops ---

    async maybeStartOllama() {
        if (process.platform !== 'win32') { return; }

        try {
            appLogger.info('local-ai.service', '[LocalAI] Attempting to auto-start Ollama headlessly...');
            const localAppData = process.env.LOCALAPPDATA || join(process.env.USERPROFILE ?? '', 'AppData', 'Local');
            const ollamaExePath = join(localAppData, 'Programs', 'Ollama', 'ollama.exe');

            if (existsSync(ollamaExePath)) {
                spawn(ollamaExePath, ['serve'], {
                    detached: true,
                    stdio: 'ignore',
                    windowsHide: true,
                    shell: false
                }).unref();
                appLogger.info('local-ai.service', '[LocalAI] Triggered headless ollama serve via binary');
            } else {
                // Fallback to system PATH
                spawn('ollama', ['serve'], {
                    detached: true,
                    stdio: 'ignore',
                    windowsHide: true,
                    shell: false
                }).unref();
                appLogger.info('local-ai.service', '[LocalAI] Triggered headless ollama serve via PATH');
            }
        } catch (_e) {
            console.error('[LocalAI] Critical failure during Ollama auto-start:', _e);
        }
    }

    async ollamaChat(model: string, messages: OllamaChatMessage[]): Promise<OllamaChatResponse> {
        const settings = this.settingsService.getSettings()
        const num_ctx = settings.ollama.numCtx ?? 4096

        return await this.ollamaRequest<OllamaChatResponse>('/api/chat', 'POST', {
            model,
            messages,
            stream: false,
            options: { num_ctx }
        })
    }

    private async ollamaRequest<T>(endpoint: string, method = 'GET', body?: object): Promise<T> {
        const url = `http://127.0.0.1:11434${endpoint}`
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined
        })
        if (!response.ok) { throw new Error(`HTTP ${response.status}`); }
        return await response.json() as T
    }

    // --- Llama.cpp Ops ---

    async startLlamaServer(modelPath: string): Promise<boolean> {
        if (this.llamaProcess) { this.stopLlamaServer() }
        const binPath = join(process.cwd(), 'vendor', 'llama-bin', 'llama-server.exe')
        if (!existsSync(binPath)) { return false }

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

    // --- Llama.cpp Ops ---

    async checkCudaSupport(): Promise<{ hasCuda: boolean; detail?: string }> {
        return new Promise((resolve) => {
            exec('nvidia-smi', (_error: Error | null, stdout: string) => {
                if (_error) {
                    resolve({ hasCuda: false, detail: 'nvidia-smi not found or failed' })
                } else {
                    resolve({ hasCuda: true, detail: stdout.split('\n')[0] })
                }
            })
        })
    }
}
