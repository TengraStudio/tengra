/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ipc } from '@main/core/ipc-decorators';
import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { PowerManagerService } from '@main/services/system/power-manager.service';
import { SettingsService } from '@main/services/system/settings.service';
import { IPerformanceService } from '@main/types/services';
import { getCacheAnalyticsSnapshot } from '@main/utils/cache.util';
import { serializeToIpc } from '@main/utils/ipc-serializer.util';
import { ProcessMetric, ServiceResponse, StartupMetrics } from '@shared/types';
import { RuntimeValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { app, IpcMainInvokeEvent } from 'electron';

export class PerformanceService extends BaseService implements IPerformanceService {
    private static readonly MEMORY_MONITOR_JOB_ID = 'performance:memory-monitor';
    private memoryHistory: number[] = [];
    private maxHistoryLength = 60; // 1 hour if sampled every minute
    private monitoringInterval: NodeJS.Timeout | null = null;
    private alerts: Array<{ timestamp: number; level: 'info' | 'warn' | 'error'; message: string }> = [];
    private readonly memoryPressureBytes = 800 * 1024 * 1024;
    private readonly eventBus: EventBusService;
    private readonly jobScheduler?: JobSchedulerService;
    private readonly powerManager: PowerManagerService;
    private startupMetrics: StartupMetrics = {
        startTime: Date.now()
    };

    constructor(
        powerManager?: PowerManagerService,
        eventBus?: EventBusService,
        jobScheduler?: JobSchedulerService
    ) {
        super('PerformanceService');
        this.eventBus = eventBus ?? new EventBusService();
        this.powerManager = powerManager ?? this.createFallbackPowerManager();
        this.jobScheduler = jobScheduler;
    }

    private createFallbackPowerManager(): PowerManagerService {
        const fallbackSettings = {
            getSettings: () => ({ window: {} }),
        } as SettingsService;
        return new PowerManagerService(fallbackSettings, this.eventBus);
    }

    /**
     * Initialize the PerformanceService
     */
    async initialize(): Promise<void> {
        appLogger.info(this.name, 'Initializing performance service...');
        this.startMemoryMonitoring();
        
        appLogger.info(this.name, `Performance monitoring started (${this.maxHistoryLength} sample history)`);
    }

    /**
     * Cleanup the PerformanceService
     */
    async cleanup(): Promise<void> {
        appLogger.info(this.name, 'Cleaning up performance service...');
        this.jobScheduler?.unregisterRecurringJob(PerformanceService.MEMORY_MONITOR_JOB_ID);
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        this.memoryHistory = [];
        
        appLogger.info(this.name, 'Performance service cleaned up');
    }

    /**
     * Start automatic memory monitoring
     */
    private startMemoryMonitoring(): void {
        if (this.jobScheduler) {
            this.jobScheduler.registerRecurringJob(
                PerformanceService.MEMORY_MONITOR_JOB_ID,
                async () => {
                    this.sampleMemoryUsage();
                },
                () => this.getMonitoringIntervalMs(),
                {
                    persistState: false,
                    runOnStart: false,
                }
            );
            return;
        }

        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        this.monitoringInterval = setInterval(() => {
            this.sampleMemoryUsage();
        }, this.getMonitoringIntervalMs());
    }

    private getMonitoringIntervalMs(): number {
        return this.powerManager.isLowPowerMode() ? 300000 : 60000;
    }

    private sampleMemoryUsage(): void {
        const stats = process.memoryUsage();
        this.memoryHistory.push(stats.heapUsed);

        if (this.memoryHistory.length > this.maxHistoryLength) {
            this.memoryHistory.shift();
        }

        if (this.memoryHistory.length >= 5) {
            const leak = this.detectLeakSync();
            if (leak.isPossibleLeak) {
                appLogger.warn(this.name, 'Possible memory leak detected');
                this.pushAlert('warn', 'Possible memory leak detected from heap trend');
            }
        }

        if (stats.rss > this.memoryPressureBytes) {
            this.pushAlert('warn', `Memory pressure detected (rss=${Math.round(stats.rss / 1024 / 1024)}MB)`);
            const gc = this.triggerGC();
            if (!gc.success) {
                this.pushAlert('info', 'GC hint skipped (global.gc unavailable)');
            }
        }
    }

    private pushAlert(level: 'info' | 'warn' | 'error', message: string): void {
        this.alerts.push({ timestamp: Date.now(), level, message });
        if (this.alerts.length > 200) {
            this.alerts.shift();
        }
    }

    /**
     * Synchronous leak detection for internal monitoring
     */
    private detectLeakSync(): { isPossibleLeak: boolean; trend: number[] } {
        if (this.memoryHistory.length < 5) {
            return { isPossibleLeak: false, trend: this.memoryHistory };
        }

        const lastSamples = this.memoryHistory.slice(-5);
        let strictlyIncreasing = true;
        for (let i = 1; i < lastSamples.length; i++) {
            if (lastSamples[i] <= lastSamples[i - 1]) {
                strictlyIncreasing = false;
                break;
            }
        }

        const first = lastSamples[0];
        const last = lastSamples[lastSamples.length - 1];
        const growth = ((last - first) / first) * 100;

        return {
            isPossibleLeak: strictlyIncreasing && growth > 10,
            trend: lastSamples
        };
    }

    @ipc('performance:get-memory-stats')
    getMemoryStatsIpc(_event: IpcMainInvokeEvent): ServiceResponse<{ main: NodeJS.MemoryUsage; timestamp: number }> {
        return this.getMemoryStats();
    }

    getMemoryStats(): ServiceResponse<{ main: NodeJS.MemoryUsage; timestamp: number }> {
        const stats = {
            main: process.memoryUsage(),
            timestamp: Date.now()
        };

        // Add heapUsed to history
        this.memoryHistory.push(stats.main.heapUsed);
        if (this.memoryHistory.length > this.maxHistoryLength) {
            this.memoryHistory.shift();
        }

        return { success: true, data: stats };
    }

    @ipc('performance:detect-leak')
    async detectLeakIpc(_event: IpcMainInvokeEvent): Promise<ServiceResponse<{ isPossibleLeak: boolean; trend: number[] }>> {
        return await this.detectLeak();
    }

    async detectLeak(): Promise<ServiceResponse<{ isPossibleLeak: boolean; trend: number[] }>> {
        if (this.memoryHistory.length < 5) {
            return {
                success: true,
                data: { isPossibleLeak: false, trend: this.memoryHistory }
            };
        }

        // Simple heuristic: check if the last 5 samples are strictly increasing
        const lastSamples = this.memoryHistory.slice(-5);
        let strictlyIncreasing = true;
        for (let i = 1; i < lastSamples.length; i++) {
            if (lastSamples[i] <= lastSamples[i - 1]) {
                strictlyIncreasing = false;
                break;
            }
        }

        // Also check growth percentage
        const first = lastSamples[0];
        const last = lastSamples[lastSamples.length - 1];
        const growth = ((last - first) / first) * 100;

        const isPossibleLeak = strictlyIncreasing && growth > 5;

        return {
            success: true,
            data: { isPossibleLeak, trend: lastSamples }
        };
    }

    @ipc('performance:trigger-gc')
    triggerGCIpc(_event: IpcMainInvokeEvent): ServiceResponse<{ success: boolean }> {
        return this.triggerGC();
    }

    triggerGC(): ServiceResponse<{ success: boolean }> {
        try {
            if (global.gc) {
                global.gc();
                this.pushAlert('info', 'Manual garbage collection triggered');
                return { success: true, data: { success: true } };
            }
            return {
                success: false,
                error: 'GC not exposed. Please run with --expose-gc'
            };
        } catch (e) {
            return { success: false, error: getErrorMessage(e) };
        }
    }

    @ipc('performance:get-process-metrics')
    async getProcessMetricsIpc(_event: IpcMainInvokeEvent): Promise<ServiceResponse<ProcessMetric[]>> {
        return await this.getProcessMetrics();
    }

    async getProcessMetrics(): Promise<ServiceResponse<ProcessMetric[]>> {
        try {
            const metrics = app.getAppMetrics();
            const processMetrics: ProcessMetric[] = metrics.map(m => ({
                type: m.type as 'main' | 'renderer' | 'utility' | 'gpu',
                pid: m.pid,
                cpu: m.cpu.percentCPUUsage,
                memory: m.memory.workingSetSize * 1024, // KB to Bytes
                name: m.name
            }));
            return { success: true, data: processMetrics };
        } catch (e) {
            return { success: false, error: getErrorMessage(e) };
        }
    }

    @ipc('performance:get-startup-metrics')
    getStartupMetricsIpc(_event: IpcMainInvokeEvent): ServiceResponse<StartupMetrics> {
        return this.getStartupMetrics();
    }

    getStartupMetrics(): ServiceResponse<StartupMetrics> {
        return { success: true, data: { ...this.startupMetrics } };
    }

    @ipc('metrics:get')
    async getAppMetricsIpc(): Promise<RuntimeValue> {
        const info = {
            cpu: process.getCPUUsage(),
            memory: await process.getProcessMemoryInfo(),
            uptime: process.uptime()
        };
        return serializeToIpc(info);
    }

    @ipc('metrics:record')
    async recordMetricIpc(_name: RuntimeValue, _value: RuntimeValue): Promise<RuntimeValue> {
        // Implementation placeholder for analytics
        return serializeToIpc({ success: true });
    }

    recordStartupEvent(event: keyof StartupMetrics): void {
        if (event === 'startTime') {return;} // Cannot override
        this.startupMetrics[event] = Date.now();
        
        if (this.startupMetrics.startTime && this.startupMetrics.readyTime && 
            this.startupMetrics.loadTime && !this.startupMetrics.totalTime) {
            this.startupMetrics.totalTime = this.startupMetrics.loadTime - this.startupMetrics.startTime;
            appLogger.info(this.name, `Startup complete in ${this.startupMetrics.totalTime}ms`);
        }
    }

    @ipc('performance:get-dashboard')
    getDashboardIpc(_event: IpcMainInvokeEvent): ServiceResponse<{
        memory: {
            latestRss: number;
            latestHeapUsed: number;
            sampleCount: number;
        };
        processes: ProcessMetric[];
        startup: StartupMetrics;
        alerts: Array<{ timestamp: number; level: 'info' | 'warn' | 'error'; message: string }>;
        caches?: Record<string, RuntimeValue>;
    }> {
        return this.getDashboard();
    }

    getDashboard(): ServiceResponse<{
        memory: {
            latestRss: number;
            latestHeapUsed: number;
            sampleCount: number;
        };
        processes: ProcessMetric[];
        startup: StartupMetrics;
        alerts: Array<{ timestamp: number; level: 'info' | 'warn' | 'error'; message: string }>;
        caches?: Record<string, RuntimeValue>;
    }> {
        const usage = process.memoryUsage();
        const metrics = app.getAppMetrics();
        const processes: ProcessMetric[] = metrics.map(m => ({
            type: m.type as 'main' | 'renderer' | 'utility' | 'gpu',
            pid: m.pid,
            cpu: m.cpu.percentCPUUsage,
            memory: m.memory.workingSetSize * 1024,
            name: m.name
        }));

        return {
            success: true,
            data: {
                memory: {
                    latestRss: usage.rss,
                    latestHeapUsed: usage.heapUsed,
                    sampleCount: this.memoryHistory.length
                },
                processes,
                startup: { ...this.startupMetrics },
                alerts: [...this.alerts],
                caches: getCacheAnalyticsSnapshot()
            }
        };
    }
}
