/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Health Check Service - monitors external dependencies
 */

import { EventEmitter } from 'events';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { OPERATION_TIMEOUTS } from '@shared/constants/timeouts';
import { getErrorMessage } from '@shared/utils/error.util';

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

export class HealthCheckService extends BaseService {
    private checks: Map<string, ServiceCheck> = new Map();
    private statuses: Map<string, HealthStatus> = new Map();
    private intervals: Map<string, NodeJS.Timeout> = new Map();
    private running = false;
    private events = new EventEmitter();

    constructor() {
        super('HealthCheckService');
    }

    override async cleanup(): Promise<void> {
        this.stop();
    }

    on(event: string, listener: (...args: RuntimeValue[]) => void) {
        this.events.on(event, listener);
        return this;
    }

    emit(event: string, ...args: RuntimeValue[]) {
        return this.events.emit(event, ...args);
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
        };

        this.checks.set(name, serviceCheck);
        this.statuses.set(name, {
            name,
            status: 'unknown',
            lastChecked: new Date()
        });
    }

    /**
     * Start all health checks
     */
    start() {
        if (this.running) { return; }
        this.running = true;

        for (const [name, check] of this.checks) {
            // Run immediately
            void this.runCheck(name);

            // Schedule periodic checks
            const interval = setInterval(() => {
                void this.runCheck(name);
            }, check.intervalMs);

            this.intervals.set(name, interval);
        }

        appLogger.info('health-check.service', `[HealthCheck] Started monitoring ${this.checks.size} services`);
    }

    /**
     * Stop all health checks
     */
    stop() {
        this.running = false;

        for (const interval of this.intervals.values()) {
            clearInterval(interval);
        }
        this.intervals.clear();

        appLogger.info('health-check.service', '[HealthCheck] Stopped monitoring');
    }

    private async runCheckWithTimeout(check: ServiceCheck): Promise<boolean> {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const timeoutPromise = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Timeout')), check.timeoutMs);
            if (timer?.unref) { timer.unref(); }
        });

        try {
            return await Promise.race([check.check(), timeoutPromise]);
        } finally {
            if (timer !== null) {
                clearTimeout(timer);
            }
        }
    }

    /**
     * Run a specific check
     */
    private async runCheck(name: string) {
        const check = this.checks.get(name);
        if (!check) { return; }

        const startTime = Date.now();

        try {
            const result = await this.runCheckWithTimeout(check);

            const latencyMs = Date.now() - startTime;

            const status: HealthStatus = {
                name,
                status: result ? 'healthy' : 'unhealthy',
                latencyMs,
                lastChecked: new Date()
            };

            const previous = this.statuses.get(name);
            this.statuses.set(name, status);

            // Emit event if status changed
            if (previous?.status !== status.status) {
                this.emit('statusChange', status);
                appLogger.info('health-check.service', `[HealthCheck] ${name}: ${previous?.status ?? 'unknown'} -> ${status.status}`);
            }
        } catch (error) {
            const status: HealthStatus = {
                name,
                status: 'unhealthy',
                latencyMs: Date.now() - startTime,
                lastChecked: new Date(),
                error: getErrorMessage(error)
            };

            const previous = this.statuses.get(name);
            this.statuses.set(name, status);

            if (previous?.status !== 'unhealthy') {
                this.emit('statusChange', status);
                appLogger.warn('HealthCheckService', `Check failed for ${name}: ${status.error}`);
            }
        }
    }

    /**
     * Get current health status
     */
    getStatus(): HealthCheckResult {
        const services = Array.from(this.statuses.values());

        const criticalServices = services.filter(s => {
            const check = this.checks.get(s.name);
            return check?.critical;
        });

        const criticalUnhealthy = criticalServices.some(s => s.status === 'unhealthy');
        const anyUnhealthy = services.some(s => s.status === 'unhealthy');

        let overall: 'healthy' | 'degraded' | 'unhealthy';
        if (criticalUnhealthy) {
            overall = 'unhealthy';
        } else if (anyUnhealthy) {
            overall = 'degraded';
        } else {
            overall = 'healthy';
        }

        return {
            overall,
            services,
            timestamp: new Date()
        };
    }

    /**
     * Check a specific service immediately
     */
    async checkNow(name: string): Promise<HealthStatus | null> {
        await this.runCheck(name);
        return this.statuses.get(name) ?? null;
    }

    /**
     * Registers default critical system checks.
     * @param components Dependencies needed for checks
     */
    registerCriticalChecks(components: {
        databaseService: { getDatabase: () => { prepare: (sql: string) => { get: () => Promise<RuntimeValue> } } };
        networkService: RuntimeValue;
    }) {
        const { databaseService } = components;

        // 1. Database Check
        this.register('database', async () => {
            try {
                const db = databaseService.getDatabase();
                const stmt = db.prepare('SELECT 1');
                await stmt.get();
                return true;
            } catch {
                return false;
            }
        }, { intervalMs: 60000, critical: true });

        // 2. Network Check (Ping Google DNS or similar high-availability host)
        this.register('internet', async () => {
            try {
                // Simple ping-like check using fetch to a reliable CDN/DNS
                // Using 1.1.1.1 (Cloudflare) or generic connectivity check
                const controller = new AbortController();
                const id = setTimeout(() => controller.abort(), OPERATION_TIMEOUTS.CONNECTIVITY_CHECK);
                const res = await fetch('https://1.1.1.1', { method: 'HEAD', signal: controller.signal });
                clearTimeout(id);
                return res.ok || res.status === 405; // 405 is fine for HEAD, means we reached it
            } catch {
                return false;
            }
        }, { intervalMs: 60000, critical: false }); // Not strictly critical for offline app usage

        // 3. Memory Check
        this.register('memory', async () => {
            const used = process.memoryUsage().heapUsed / 1024 / 1024;
            const limit = 4096; // 4GB arbitrary soft limit for warning
            return used < limit;
        }, { intervalMs: 30000, critical: false });
    }
}

// Singleton instance
let instance: HealthCheckService | null = null;

export function getHealthCheckService(): HealthCheckService {
    instance ??= new HealthCheckService();
    return instance;
}
