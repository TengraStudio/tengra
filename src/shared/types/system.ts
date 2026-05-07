/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export interface SystemUsage {
    cpu: number
    memory: {
        total: number
        used: number
        percent: number
    }
    battery?: {
        percent: number
        isCharging: boolean
    }
}

export interface SystemStats {
    cpu: number
    memory: {
        total: number
        used: number
        free: number
    }
    disk: DiskStats
    uptime: number
    platform: string
    distro?: string
}

export interface FileEntry {
    name: string
    path: string
    isDirectory: boolean
}

export interface ProcessInfo {
    pid: number
    name?: string
    cmd?: string
    command?: string
    cpu?: number
    memory?: number
    id?: string
    cwd?: string
    status?: string
    startTime?: number
}

export interface DiskStats {
    total: number
    free: number
    used: number
    percent: number
}

export interface SystemInfo {
    platform: string
    arch: string
    cpus: number
    totalMemory: number
    freeMemory: number
    uptime: number
    hostname: string
    release: string
    shell?: string
    homeDir?: string
    username?: string
    cwd?: string
    tempDir?: string
    [key: string]: string | number | undefined
}

export interface MetricData {
    name: string
    value: number
    unit: 'ms' | 'count' | 'bytes' | 'percent'
    timestamp: number
    tags?: Record<string, string>
}

export interface ProviderMetrics {
    requestCount: number
    successCount: number
    errorCount: number
    totalLatencyMs: number
    avgLatencyMs: number
    minLatencyMs: number
    maxLatencyMs: number
    lastRequestAt?: number
}

export interface ProcessMetric {
    type: 'main' | 'renderer' | 'utility' | 'gpu';
    pid: number;
    cpu: number;
    memory: number;
    name?: string;
}

export interface StartupMetrics {
    startTime: number;
    coreServicesReadyTime?: number;
    ipcReadyTime?: number;
    windowCreatedTime?: number;
    readyTime?: number;
    loadTime?: number;
    localImageReadyTime?: number;
    apiServerReadyTime?: number;
    deferredStartTime?: number;
    deferredServicesReadyTime?: number;
    totalTime?: number;
}

