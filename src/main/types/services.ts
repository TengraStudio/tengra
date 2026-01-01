import { ServiceResponse } from '../../shared/types';

export interface ISecurityService {
    generatePassword(length: number, numbers: boolean, symbols: boolean): ServiceResponse<{ password: string }>;
    checkPasswordStrength(password: string): ServiceResponse<{ score: number; label: string }>;
    generateHash(text: string, algorithm?: 'md5' | 'sha256' | 'sha512'): ServiceResponse<{ hash: string }>;
    stripMetadata(path: string, outputPath: string): Promise<ServiceResponse>;
}

export interface ISystemService {
    setVolume(percent: number): Promise<ServiceResponse>;
    setBrightness(percent: number): Promise<ServiceResponse>;
    getDiskSpace(): Promise<ServiceResponse<{ output: string }>>;
    getProcessOnPort(port: number): Promise<ServiceResponse<{ output: string }>>;
    setWallpaper(imagePath: string): Promise<ServiceResponse>;
    mediaControl(action: string): Promise<ServiceResponse>;
    launchApp(appName: string): Promise<ServiceResponse>;
    getSystemInfo(): Promise<any>;
    getProcessList(): Promise<ServiceResponse<{ output: string }>>;
}

export interface INetworkService {
    ping(host: string): Promise<ServiceResponse<{ output: string }>>;
    whois(domain: string): Promise<ServiceResponse<{ output: string }>>;
    scanPort(host: string, port: number, timeout?: number): Promise<ServiceResponse<{ port: number; status: string }>>;
    traceroute(host: string): Promise<ServiceResponse<{ output: string }>>;
    startWebSocketServer(port: number): ServiceResponse;
    getNetworkInterfaces(): Promise<ServiceResponse<any>>;
    getPublicIP(): Promise<ServiceResponse<{ ip: string }>>;
}
