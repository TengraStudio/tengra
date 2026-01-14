import { EventEmitter } from 'events'
import { getErrorMessage } from '@shared/utils/error.util'

export interface OllamaStatus {
    online: boolean
    lastCheck: Date
    version?: string
    modelsCount?: number
    error?: string
}

export class OllamaHealthService extends EventEmitter {
    private intervalId: NodeJS.Timeout | null = null
    private status: OllamaStatus = { online: false, lastCheck: new Date() }
    private baseUrl: string = 'http://127.0.0.1:11434'
    private checkInterval: number = 30000 // 30 seconds

    constructor(baseUrl?: string) {
        super()
        if (baseUrl) this.baseUrl = baseUrl
        console.log('[OllamaHealth] Service initialized')
    }

    getStatus(): OllamaStatus {
        return { ...this.status }
    }

    setBaseUrl(url: string) {
        this.baseUrl = url
        console.log('[OllamaHealth] Base URL updated:', url)
    }

    start() {
        if (this.intervalId) {
            console.log('[OllamaHealth] Already running')
            return
        }

        console.log('[OllamaHealth] Starting health checks...')

        // Initial check
        this.checkHealth()

        // Periodic checks
        this.intervalId = setInterval(() => {
            this.checkHealth()
        }, this.checkInterval)
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId)
            this.intervalId = null
            console.log('[OllamaHealth] Stopped health checks')
        }
    }

    async checkHealth(): Promise<OllamaStatus> {
        const wasOnline = this.status.online

        try {
            // Try to get Ollama version/tags
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 5000)

            const response = await fetch(`${this.baseUrl}/api/tags`, {
                signal: controller.signal
            })
            clearTimeout(timeoutId)

            if (response.ok) {
                const data = await response.json()
                const modelsCount = data.models?.length || 0

                this.status = {
                    online: true,
                    lastCheck: new Date(),
                    modelsCount,
                    version: 'connected'
                }

                // Emit event if status changed
                if (!wasOnline) {
                    console.log('[OllamaHealth] Server came online')
                    this.emit('online', this.status)
                    this.emit('statusChange', this.status)
                }
            } else {
                throw new Error(`HTTP ${response.status}`)
            }
        } catch (error) {
            const errorMsg = getErrorMessage(error as Error)
            this.status = {
                online: false,
                lastCheck: new Date(),
                error: errorMsg
            }

            // Emit event if status changed
            if (wasOnline) {
                console.log('[OllamaHealth] Server went offline:', errorMsg)
                this.emit('offline', this.status)
                this.emit('statusChange', this.status)
            }
        }

        return this.status
    }

    // Force an immediate check
    async forceCheck(): Promise<OllamaStatus> {
        return this.checkHealth()
    }
}

// Singleton instance
let instance: OllamaHealthService | null = null

export function getOllamaHealthService(baseUrl?: string): OllamaHealthService {
    if (!instance) {
        instance = new OllamaHealthService(baseUrl)
    } else if (baseUrl) {
        instance.setBaseUrl(baseUrl)
    }
    return instance
}
