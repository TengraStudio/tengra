import { ProcessMetric, ServiceResponse,StartupMetrics, SystemInfo } from '@shared/types';
import { JsonObject } from '@shared/types/common';

export interface ISecurityService {
    generatePassword(length: number, numbers: boolean, symbols: boolean): ServiceResponse<{ password: string }>;
    checkPasswordStrength(password: string): ServiceResponse<{ score: number; label: string }>;
    generateHash(text: string, algorithm?: 'md5' | 'sha256' | 'sha512'): ServiceResponse<{ hash: string }>;
    stripMetadata(path: string, outputPath: string): Promise<ServiceResponse>;
}

export interface ISystemService {
    setVolume(percent: number): Promise<ServiceResponse>;
    setBrightness(percent: number): Promise<ServiceResponse<{ brightness: number }>>;
    getDiskSpace(): Promise<ServiceResponse<{ output: string }>>;
    getProcessOnPort(port: number): Promise<ServiceResponse<{ output: string }>>;
    setWallpaper(imagePath: string): Promise<ServiceResponse>;
    mediaControl(action: string): Promise<ServiceResponse<{ action: string }>>;
    launchApp(appName: string): Promise<ServiceResponse>;
    getSystemInfo(): Promise<SystemInfo>;
    getProcessList(): Promise<ServiceResponse<{ output: string }>>;
}

export interface INetworkService {
    ping(host: string): Promise<ServiceResponse<{ output: string }>>;
    whois(domain: string): Promise<ServiceResponse<{ output: string }>>;
    scanPort(host: string, port: number, timeout?: number): Promise<ServiceResponse<{ port: number; status: string }>>;
    traceroute(host: string): Promise<ServiceResponse<{ output: string }>>;
    startWebSocketServer(port: number): ServiceResponse;
    getNetworkInterfaces(): Promise<ServiceResponse<JsonObject>>;
    getPublicIP(): Promise<ServiceResponse<{ ip: string }>>;
}
export interface IPerformanceService {
    getMemoryStats(): ServiceResponse<{
        main: NodeJS.MemoryUsage;
        timestamp: number;
    }>;
    detectLeak(): Promise<ServiceResponse<{ isPossibleLeak: boolean; trend: number[] }>>;
    triggerGC(): ServiceResponse<{ success: boolean }>;
    getProcessMetrics(): Promise<ServiceResponse<ProcessMetric[]>>;
    getStartupMetrics(): ServiceResponse<StartupMetrics>;
    recordStartupEvent(event: keyof StartupMetrics): void;
    getDashboard(): ServiceResponse<{
        memory: {
            latestRss: number;
            latestHeapUsed: number;
            sampleCount: number;
        };
        processes: ProcessMetric[];
        startup: StartupMetrics;
        alerts: Array<{ timestamp: number; level: 'info' | 'warn' | 'error'; message: string }>;
    }>;
}
