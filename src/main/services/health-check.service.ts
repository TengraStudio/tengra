/**
 * Health Check Service - monitors external dependencies
 */

import { EventEmitter } from 'events'

export interface HealthStatus {
    name: string
    status: 'healthy' | 'unhealthy' | 'unknown'
    latencyMs?: number
    lastChecked: Date
    error?: string
}

export interface HealthCheckResult {
    overall: 'healthy' | 'degraded' | 'unhealthy'
    services: HealthStatus[]
    timestamp: Date
}

type HealthCheckFn = () => Promise<boolean>

interface ServiceCheck {
    name: string
    check: HealthCheckFn
    intervalMs: number
    timeoutMs: number
    critical: boolean
}

export class HealthCheckService extends EventEmitter {
    private checks: Map<string, ServiceCheck> = new Map()
    private statuses: Map<string, HealthStatus> = new Map()
    private intervals: Map<string, NodeJS.Timeout> = new Map()
    private running = false

    constructor() {
        super()
    }

    /**
     * Register a health check
     */
    register(
        name: string,
        check: HealthCheckFn,
        options?: {
            intervalMs?: number
            timeoutMs?: number
            critical?: boolean
        }
    ) {
        const serviceCheck: ServiceCheck = {
            name,
            check,
            intervalMs: options?.intervalMs ?? 30000,
            timeoutMs: options?.timeoutMs ?? 5000,
            critical: options?.critical ?? false
        }

        this.checks.set(name, serviceCheck)
        this.statuses.set(name, {
            name,
            status: 'unknown',
            lastChecked: new Date()
        })
    }

    /**
     * Start all health checks
     */
    start() {
        if (this.running) return
        this.running = true

        for (const [name, check] of this.checks) {
            // Run immediately
            this.runCheck(name)

            // Schedule periodic checks
            const interval = setInterval(() => {
                this.runCheck(name)
            }, check.intervalMs)

            this.intervals.set(name, interval)
        }

        console.log(`[HealthCheck] Started monitoring ${this.checks.size} services`)
    }

    /**
     * Stop all health checks
     */
    stop() {
        this.running = false

        for (const interval of this.intervals.values()) {
            clearInterval(interval)
        }
        this.intervals.clear()

        console.log('[HealthCheck] Stopped monitoring')
    }

    /**
     * Run a specific check
     */
    private async runCheck(name: string) {
        const check = this.checks.get(name)
        if (!check) return

        const startTime = Date.now()

        try {
            const result = await Promise.race([
                check.check(),
                new Promise<boolean>((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), check.timeoutMs)
                )
            ])

            const latencyMs = Date.now() - startTime

            const status: HealthStatus = {
                name,
                status: result ? 'healthy' : 'unhealthy',
                latencyMs,
                lastChecked: new Date()
            }

            const previous = this.statuses.get(name)
            this.statuses.set(name, status)

            // Emit event if status changed
            if (previous?.status !== status.status) {
                this.emit('statusChange', status)
                console.log(`[HealthCheck] ${name}: ${previous?.status || 'unknown'} -> ${status.status}`)
            }
        } catch (error: any) {
            const status: HealthStatus = {
                name,
                status: 'unhealthy',
                latencyMs: Date.now() - startTime,
                lastChecked: new Date(),
                error: error.message || 'Unknown error'
            }

            const previous = this.statuses.get(name)
            this.statuses.set(name, status)

            if (previous?.status !== 'unhealthy') {
                this.emit('statusChange', status)
                console.warn(`[HealthCheck] ${name} failed:`, status.error)
            }
        }
    }

    /**
     * Get current health status
     */
    getStatus(): HealthCheckResult {
        const services = Array.from(this.statuses.values())

        const criticalServices = services.filter(s => {
            const check = this.checks.get(s.name)
            return check?.critical
        })

        const criticalUnhealthy = criticalServices.some(s => s.status === 'unhealthy')
        const anyUnhealthy = services.some(s => s.status === 'unhealthy')

        let overall: 'healthy' | 'degraded' | 'unhealthy'
        if (criticalUnhealthy) {
            overall = 'unhealthy'
        } else if (anyUnhealthy) {
            overall = 'degraded'
        } else {
            overall = 'healthy'
        }

        return {
            overall,
            services,
            timestamp: new Date()
        }
    }

    /**
     * Check a specific service immediately
     */
    async checkNow(name: string): Promise<HealthStatus | null> {
        await this.runCheck(name)
        return this.statuses.get(name) || null
    }
}

// Singleton instance
let instance: HealthCheckService | null = null

export function getHealthCheckService(): HealthCheckService {
    if (!instance) {
        instance = new HealthCheckService()
    }
    return instance
}
