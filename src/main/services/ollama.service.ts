// Ollama service using Node http module with forced IPv4
import * as http from 'http'

interface Message {
    role: 'user' | 'assistant' | 'system' | 'tool'
    content: string
    images?: string[] // Base64 encoded images
    tool_calls?: any[]
    tool_call_id?: string
}

interface OllamaModel {
    name: string
    modified_at: string
    size: number
    digest: string
    details?: {
        format: string
        family: string
        parameter_size: string
        quantization_level: string
    }
}

interface LibraryModel {
    name: string
    description: string
    tags: string[]
}

export class OllamaService {
    private host: string = '127.0.0.1'
    private port: number = 11434
    private currentRequest: http.ClientRequest | null = null

    abort() {
        if (this.currentRequest) {
            this.currentRequest.destroy()
            this.currentRequest = null
            console.log('Ollama request aborted by user')
        }
    }

    setConnection(host: string, port: number) {
        this.host = host
        this.port = port
    }

    // IPv4-only HTTP request helper (Instance Method)
    private httpRequest(
        options: {
            method?: string
            path: string
            body?: string
            timeout?: number
        }
    ): Promise<{ ok: boolean; status: number; data: string }> {
        return new Promise((resolve, reject) => {
            const req = http.request({
                hostname: this.host,
                port: this.port,
                path: options.path,
                method: options.method || 'GET',
                headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
                family: 4 // Force IPv4
            }, (res) => {
                let data = ''
                res.on('data', chunk => data += chunk)
                res.on('end', () => {
                    resolve({
                        ok: res.statusCode! >= 200 && res.statusCode! < 300,
                        status: res.statusCode!,
                        data
                    })
                })
            })

            req.on('error', reject)
            req.setTimeout(options.timeout || 10000, () => {
                req.destroy()
                reject(new Error('Request timeout'))
            })

            if (options.body) {
                req.write(options.body)
            }
            req.end()
        })
    }

    // Streaming HTTP request for chat (Instance Method)
    private httpStreamRequest(
        options: {
            path: string
            body: string
            onData: (chunk: string) => void
            timeout?: number
        }
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const req = http.request({
                hostname: this.host,
                port: this.port,
                path: options.path,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                family: 4
            }, (res) => {
                res.on('data', chunk => options.onData(chunk.toString()))
                res.on('end', () => resolve())
                res.on('error', reject)
            })

            req.on('error', reject)
            req.setTimeout(options.timeout || 300000, () => {
                req.destroy()
                reject(new Error('Request timeout'))
            })

            this.currentRequest = req

            req.write(options.body)
            req.end()
        })
    }

    async getModels(): Promise<OllamaModel[]> {
        try {
            const response = await this.httpRequest({ path: '/api/tags', timeout: 5000 })
            const data = JSON.parse(response.data)
            return data.models || []
        } catch (error) {
            console.error('Failed to get models:', error)
            return []
        }
    }

    async chat(messages: Message[], model: string): Promise<any> {
        try {
            const response = await this.httpRequest({
                method: 'POST',
                path: '/api/chat',
                body: JSON.stringify({
                    model,
                    messages,
                    stream: false,
                    options: {
                        num_ctx: 4096,  // Reduced context for faster inference
                    },
                    keep_alive: '24h'  // Keep model loaded
                })
            })
            return JSON.parse(response.data)
        } catch (error) {
            console.error('Chat error:', error)
            throw error
        }
    }


    async chatStream(
        messages: Message[],
        model: string,
        tools?: any[],
        onChunk?: (chunk: string) => void
    ): Promise<any> {
        let fullResponse = ''
        let toolCalls: any[] = []

        try {
            await this.httpStreamRequest({
                path: '/api/chat',
                body: JSON.stringify({
                    model,
                    messages,
                    stream: true,
                    tools: tools && tools.length > 0 ? tools : undefined,
                    options: {
                        num_ctx: 4096,
                    },
                    keep_alive: '24h'
                }),
                onData: (chunk) => {
                    const lines = chunk.toString().split('\n').filter(Boolean)
                    for (const line of lines) {
                        try {
                            const data = JSON.parse(line)
                            if (data.message?.content) {
                                fullResponse += data.message.content
                                onChunk?.(data.message.content)
                            }
                            if (data.message?.tool_calls) {
                                toolCalls = data.message.tool_calls
                            }
                        } catch (e) {
                            // Ignore parse errors
                        }
                    }
                }
            })

            this.currentRequest = null

            return {
                content: fullResponse,
                tool_calls: toolCalls.length > 0 ? toolCalls : undefined
            }
        } catch (error) {
            this.currentRequest = null
            console.error('Stream chat error:', error)
            throw error
        }
    }

    async getEmbeddings(model: string, input: string): Promise<number[]> {
        try {
            const response = await this.httpRequest({
                method: 'POST',
                path: '/api/embed',
                body: JSON.stringify({
                    model,
                    input
                })
            })
            const data = JSON.parse(response.data)
            return data.embeddings?.[0] || []
        } catch (error) {
            console.error('Error generating embeddings with Ollama:', error)
            throw error
        }
    }

    async pullModel(
        modelName: string,
        onProgress?: (progress: { status: string; completed?: number; total?: number }) => void
    ): Promise<{ success: boolean; error?: string }> {
        try {
            await this.httpStreamRequest({
                path: '/api/pull',
                body: JSON.stringify({ name: modelName, stream: true }),
                timeout: 3600000,
                onData: (chunk) => {
                    const lines = chunk.split('\n').filter(Boolean)
                    for (const line of lines) {
                        try {
                            const data = JSON.parse(line)
                            onProgress?.({
                                status: data.status || 'downloading',
                                completed: data.completed,
                                total: data.total
                            })
                        } catch (e) {
                            // Ignore
                        }
                    }
                }
            })
            return { success: true }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }

    async deleteModel(modelName: string): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await this.httpRequest({
                method: 'DELETE',
                path: '/api/delete',
                body: JSON.stringify({ name: modelName })
            })

            if (response.ok) {
                return { success: true }
            } else {
                const data = JSON.parse(response.data)
                return { success: false, error: data.error || 'Failed to delete model' }
            }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }

    async getLibraryModels(): Promise<LibraryModel[]> {
        return [
            { name: 'llama2', description: 'Meta\'s Llama 2 model', tags: ['7b', '13b', '70b'] },
            { name: 'llama3', description: 'Meta\'s Llama 3 model', tags: ['8b', '70b'] },
            { name: 'llama3.1', description: 'Meta\'s Llama 3.1 model', tags: ['8b', '70b', '405b'] },
            { name: 'llama3.2', description: 'Meta\'s Llama 3.2 - multimodal', tags: ['1b', '3b', '11b', '90b'] },
            { name: 'mistral', description: 'Mistral 7B model', tags: ['7b'] },
            { name: 'mixtral', description: 'Mixtral MoE model', tags: ['8x7b', '8x22b'] },
            { name: 'codellama', description: 'Code generation model', tags: ['7b', '13b', '34b', '70b'] },
            { name: 'deepseek-r1', description: 'DeepSeek R1 reasoning model', tags: ['1.5b', '7b', '8b', '14b', '32b', '70b', '671b'] },
            { name: 'deepseek-coder', description: 'DeepSeek Coder', tags: ['1.3b', '6.7b', '33b'] },
            { name: 'phi3', description: 'Microsoft Phi-3', tags: ['mini', 'medium'] },
            { name: 'gemma', description: 'Google Gemma', tags: ['2b', '7b'] },
            { name: 'gemma2', description: 'Google Gemma 2', tags: ['2b', '9b', '27b'] },
            { name: 'qwen', description: 'Alibaba Qwen', tags: ['0.5b', '1.8b', '4b', '7b', '14b', '72b'] },
            { name: 'qwen2.5', description: 'Alibaba Qwen 2.5', tags: ['0.5b', '1.5b', '3b', '7b', '14b', '32b', '72b'] },
            { name: 'command-r', description: 'Cohere Command R', tags: ['35b'] },
            { name: 'starcoder2', description: 'StarCoder 2', tags: ['3b', '7b', '15b'] },
            { name: 'yi', description: 'Yi by 01.AI', tags: ['6b', '9b', '34b'] },
            { name: 'orca-mini', description: 'Orca Mini', tags: ['3b', '7b', '13b'] },
            { name: 'neural-chat', description: 'Intel Neural Chat', tags: ['7b'] },
            { name: 'vicuna', description: 'Vicuna', tags: ['7b', '13b', '33b'] }
        ]
    }

    async isAvailable(): Promise<boolean> {
        try {
            const response = await this.httpRequest({ path: '/api/tags', timeout: 3000 })
            return response.ok
        } catch {
            return false
        }
    }
}
