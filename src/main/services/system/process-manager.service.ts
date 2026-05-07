/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ChildProcess, exec, spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as net from 'net';
import path from 'path';
import { promisify } from 'util';

import { LifecycleAware } from '@main/core/container';
import { appLogger, stringToLogLevel } from '@main/logging/logger';
import { OPERATION_TIMEOUTS } from '@shared/constants/timeouts';
import { getErrorMessage } from '@shared/utils/error.util';
import axios from 'axios';
import { app } from 'electron';

import { getManagedRuntimeBinaryPath } from './runtime-path.service';

const execAsync = promisify(exec);

interface ProcessOptions {
    name: string;
    executable: string;
    args?: string[];
    persistent?: boolean; // If true, process won't be killed on app exit
}

export class ProcessManagerService extends EventEmitter implements LifecycleAware {
    private processes: Map<string, ChildProcess> = new Map();
    private persistentServices: Set<string> = new Set();
    private servicePorts: Map<string, number> = new Map();

    constructor() {
        super();
    }

    async initialize(): Promise<void> {
        appLogger.info('ProcessManagerService', 'Initializing ProcessManagerService');
    }

    async cleanup(): Promise<void> {
        appLogger.info('ProcessManagerService', 'Cleaning up ProcessManagerService...');
        await this.killAll(false);
    }

    private getPortFileCandidates(name: string): string[] {
        const userDataPortFile = path.join(app.getPath('userData'), 'services', `${name}.port`);
        const legacyPortFiles = ['Tengra', 'tengra'].map(root => path.join(app.getPath('appData'), root, 'services', `${name}.port`));
        return [userDataPortFile, ...legacyPortFiles];
    }

    private parseListeningPort(text: string): number | null {
        const match = text.match(/(?:listening on|127\.0\.0\.1:|localhost:)(\d{2,5})/i);
        if (!match) {
            return null;
        }
        const port = parseInt(match[1], 10);
        return Number.isNaN(port) ? null : port;
    }

    private async discoverPortFromPid(pid: number): Promise<number | null> {
        try {
            const command = `netstat -ano -p tcp | findstr " ${pid}"`;
            const { stdout } = await execAsync(command, { windowsHide: true });
            const lines = stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
            for (const line of lines) {
                const columns = line.split(/\s+/);
                if (columns.length < 4) {
                    continue;
                }
                const localAddress = columns[1];
                const lastColon = localAddress.lastIndexOf(':');
                if (lastColon < 0) {
                    continue;
                }
                const rawPort = localAddress.slice(lastColon + 1);
                const port = parseInt(rawPort, 10);
                if (!Number.isNaN(port) && port > 0) {
                    return port;
                }
            }
        } catch {
            // Ignore and continue with other discovery methods.
        }
        return null;
    }

    async killProcessByName(name: string): Promise<void> {
        if (process.platform !== 'win32') {
            return;
        }

        try {
            appLogger.info('ProcessManager', `Ensuring no existing processes for ${name}`);
            const executable = name.endsWith('.exe') ? name : `${name}.exe`;
            await execAsync(`taskkill /F /IM ${executable} /T`, { windowsHide: true });
        } catch {
            // Process not found, which is fine
        }
    }

    async killProcessOnPort(port: number): Promise<void> {
        if (process.platform !== 'win32') {
            return;
        }

        try {
            const { stdout } = await execAsync(`netstat -ano | findstr :${port}`, { windowsHide: true });
            if (!stdout) {return;}

            const lines = stdout.split(/\r?\n/).filter(line => line.includes('LISTENING'));
            
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                // PID is usually the last column in netstat -ano
                const pid = parts[parts.length - 1];
                if (pid && /^\d+$/.test(pid) && pid !== '0') {
                    appLogger.info('ProcessManager', `Targeting PID ${pid} listening on port ${port}`);
                    try {
                        await execAsync(`taskkill /F /PID ${pid} /T`, { windowsHide: true });
                    } catch (e) {
                        appLogger.warn('ProcessManager', `Failed to kill PID ${pid}: ${getErrorMessage(e)}`);
                    }
                }
            }
        } catch {
            // No process found on port
        }
    }

    private async isPortOpen(port: number): Promise<boolean> {
        return new Promise(resolve => {
            const socket = new net.Socket();
            socket.setTimeout(OPERATION_TIMEOUTS.PORT_CHECK_FAST); // Fast check
            socket.on('connect', () => {
                socket.destroy();
                resolve(true);
            });
            socket.on('timeout', () => {
                socket.destroy();
                resolve(false);
            });
            socket.on('error', () => {
                socket.destroy();
                resolve(false);
            });
            socket.connect(port, '127.0.0.1');
        });
    }

    private async discoverService(
        name: string,
        cleanupStale: boolean = true
    ): Promise<number | null> {
        const portFiles = this.getPortFileCandidates(name);
        for (const portFile of portFiles) {
            if (!fs.existsSync(portFile)) {
                continue;
            }

            try {
                const content = fs.readFileSync(portFile, 'utf8').trim();
                const port = parseInt(content);
                if (isNaN(port)) {
                    continue;
                }

                // Ping service to verify it's alive
                const alive = await this.isPortOpen(port);
                if (alive) {
                    return port;
                }

                // Dead port - cleanup stale file only if requested
                if (cleanupStale) {
                    appLogger.warn(
                        'ProcessManager',
                        `Cleaning up stale port file for ${name} at port ${port} (${portFile})`
                    );
                    try {
                        fs.unlinkSync(portFile);
                    } catch {
                        /* ignore */
                    }
                }
            } catch (e) {
                appLogger.debug(
                    'ProcessManager',
                    `Failed to read/verify port file for ${name} (${portFile}): ${getErrorMessage(e)}`
                );
            }
        }

        return null;
    }

    async startService(options: ProcessOptions): Promise<void> {
        // 1. Try discovery first (maybe it's already running independently)
        const discoveredPort = await this.discoverService(options.name);
        if (discoveredPort) {
            appLogger.info(
                'ProcessManager',
                `Discovered existing service ${options.name} on port ${discoveredPort}`
            );
            this.servicePorts.set(options.name, discoveredPort);
            if (options.persistent) {
                this.persistentServices.add(options.name);
            }
            return;
        }

        if (this.processes.has(options.name)) {
            appLogger.warn(
                'ProcessManager',
                `Service ${options.name} is already registered as a child process`
            );
            return;
        }

        const binPath = this.getBinaryPath(options.executable);
        appLogger.info('ProcessManager', `Starting service ${options.name} from ${binPath}`);

        if (!fs.existsSync(binPath)) {
            appLogger.error('ProcessManager', `Binary not found for ${options.name}: ${binPath}`);
            return;
        }

        try {
            const child = spawn(binPath, options.args ?? [], {
                stdio: ['ignore', 'pipe', 'pipe'], // Ignore stdin to prevent hanging
                windowsHide: true, // Clean taskbar
                detached: true, // Allow it to live beyond Tengra
            });

            child.unref(); // Electron won't wait for it to exit

            const markServiceReady = (port: number): void => {
                if (this.servicePorts.get(options.name) === port) {
                    return;
                }
                this.servicePorts.set(options.name, port);
                appLogger.info(
                    'ProcessManager',
                    `Service ${options.name} ready on port ${port}`
                );
                this.emit(`${options.name}:ready`, port);
            };

            child.stdout.on('data', (data: Buffer) => {
                const output = data.toString().trim();
                const lines = output.split(/\r?\n/);

                for (const line of lines) {
                    if (this.tryIngestJsonLog(line, options.name)) {
                        continue;
                    }

                    appLogger.debug('ProcessManager', `[${options.name}] stdout: ${line}`);
                    const parsedPort = this.parseListeningPort(line);
                    if (parsedPort) {
                        markServiceReady(parsedPort);
                    }
                }
            });

            child.stderr.on('data', (data: Buffer) => {
                const output = data.toString().trim();
                const lines = output.split(/\r?\n/);

                for (const line of lines) {
                    if (this.tryIngestJsonLog(line, options.name)) {
                        continue;
                    }

                    const lower = line.toLowerCase();
                    const looksLikeError = /\b(error|failed|fatal|panic|exception)\b/.test(lower);

                    if (looksLikeError) {
                        appLogger.error('ProcessManager', `[${options.name}] stderr: ${line}`);
                    } else {
                        appLogger.warn('ProcessManager', `[${options.name}] stderr: ${line}`);
                    }
                }
            });

            child.on('error', error => {
                appLogger.error(
                    'ProcessManager',
                    `[${options.name}] process error: ${getErrorMessage(error)}`
                );
                this.processes.delete(options.name);
                this.servicePorts.delete(options.name);
            });

            child.on('close', code => {
                const isPersistent = this.persistentServices.has(options.name);

                if (code !== 0 && code !== 1) {
                    appLogger.warn(
                        'ProcessManager',
                        `Service ${options.name} exited with code ${code}`
                    );
                } else {
                    appLogger.debug(
                        'ProcessManager',
                        `Service ${options.name} exited with code ${code}`
                    );
                }

                this.processes.delete(options.name);
                this.servicePorts.delete(options.name);
                // Don't delete from persistentServices yet if we want to restart

                if (isPersistent && code !== 0) {
                    appLogger.info(
                        'ProcessManager',
                        `Auto-restarting persistent service: ${options.name}`
                    );
                    setTimeout(() => {
                        this.startService(options).catch(err => {
                            appLogger.error(
                                'ProcessManager',
                                `Failed to auto-restart ${options.name}: ${getErrorMessage(err)}`
                            );
                        });
                    }, 2000); // Delay restart slightly
                } else {
                    this.persistentServices.delete(options.name);
                }
            });

            this.processes.set(options.name, child);
            if (options.persistent) {
                this.persistentServices.add(options.name);
            }

            return;
        } catch (error) {
            appLogger.error(
                'ProcessManager',
                `Failed to start ${options.name}: ${getErrorMessage(error)}`
            );
        }
    }

    stopService(name: string): void {
        const child = this.processes.get(name);
        if (child) {
            child.kill();
            this.processes.delete(name);
        }
        this.servicePorts.delete(name);
        this.persistentServices.delete(name);
    }

    killAll(force = false) {
        appLogger.info(
            'ProcessManager',
            `Stopping all ${force ? '' : 'non-persistent '}services for shutdown`
        );
        for (const [name, child] of this.processes) {
            if (!force && this.persistentServices.has(name)) {
                appLogger.info('ProcessManager', `Skipping persistent service: ${name}`);
                continue;
            }

            // Remove 'close' listener to prevent logs during intentional shutdown
            child.removeAllListeners('close');
            try {
                child.kill();
            } catch {
                /* ignore */
            }
        }

        // Only clear non-persistent
        const newMap = new Map<string, ChildProcess>();
        for (const [name, child] of this.processes) {
            if (this.persistentServices.has(name)) {
                newMap.set(name, child);
            }
        }
        this.processes = newMap;

        // We can clear ports though, as this instance is dying
        this.servicePorts.clear();
        // persistentServices set stays in memory until this class instance dies, which is fine
    }

    async sendRequest<T>(
        name: string,
        data: Record<string, RuntimeValue>,
        _timeoutMs = 10000,
        endpointOverride?: string
    ): Promise<T> {
        let port = this.servicePorts.get(name);

        if (!port) {
            port = (await this.discoverService(name)) ?? undefined;
            if (port) {
                this.servicePorts.set(name, port);
            }
        }

        if (!port) {
            throw new Error(`Service ${name} port not discovered. Is it started?`);
        }

        // Map service names to endpoints
        const endpointMap: Record<string, string> = {
            'memory-service': '/rpc',
        };

        const endpoint = endpointOverride ?? (endpointMap[name] || '/');
        const url = `http://127.0.0.1:${port}${endpoint}`;

        try {
            const response = await axios.post(url, data, {
                timeout: _timeoutMs,
            });
            return response.data as T;
        } catch (error) {
            // If connection refused/reset/timed out, clear the cached port
            if (
                axios.isAxiosError(error) &&
                (error.code === 'ECONNREFUSED' ||
                    error.code === 'ETIMEDOUT' ||
                    error.code === 'ECONNRESET')
            ) {
                appLogger.warn(
                    'ProcessManager',
                    `Connection to ${name} failed (${error.code}). Clearing cached port.`
                );
                this.servicePorts.delete(name);
            }

            appLogger.error(
                'ProcessManager',
                `HTTP request to ${name} failed: ${getErrorMessage(error)}`
            );
            throw error;
        }
    }

    getServicePort(name: string): number | undefined {
        return this.servicePorts.get(name);
    }

    async sendGetRequest<T>(name: string, endpoint: string): Promise<T> {
        let port = this.servicePorts.get(name);

        if (!port) {
            port = (await this.discoverService(name)) ?? undefined;
            if (port) {
                this.servicePorts.set(name, port);
            }
        }

        if (!port) {
            throw new Error(`Service ${name} port not discovered. Is it started?`);
        }

        const url = `http://127.0.0.1:${port}${endpoint}`;

        try {
            const response = await axios.get(url, {
                timeout: 10000, // Default 10s for GET
            });
            return response.data as T;
        } catch (error) {
            // If connection refused/reset/timed out, clear the cached port
            if (
                axios.isAxiosError(error) &&
                (error.code === 'ECONNREFUSED' ||
                    error.code === 'ETIMEDOUT' ||
                    error.code === 'ECONNRESET')
            ) {
                appLogger.warn(
                    'ProcessManager',
                    `Connection to ${name} failed (${error.code}). Clearing cached port.`
                );
                this.servicePorts.delete(name);
            }

            appLogger.error(
                'ProcessManager',
                `HTTP GET request to ${name} (${endpoint}) failed: ${getErrorMessage(error)}`
            );
            throw error;
        }
    }

    private getBinaryPath(executable: string): string {
        const binaryPath = getManagedRuntimeBinaryPath(executable);
        if (fs.existsSync(binaryPath)) {
            return binaryPath;
        }

        appLogger.warn(
            'ProcessManager',
            `Managed runtime binary not found for ${executable}: ${binaryPath}`
        );
        return binaryPath;
    }

    private tryIngestJsonLog(line: string, serviceName: string): boolean {
        const trimmed = line.trim();
        if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
            return false;
        }

        try {
            const payload = JSON.parse(trimmed);
            // Support both standard {message: ...} and tracing-subscriber {fields: {message: ...}}
            const message = payload.message || (payload.fields?.message);

            if (message) {
                // Clean up context name (Rust often includes module paths)
                let context = payload.context || payload.target || serviceName;
                if (context.includes('::')) {
                    context = context.split('::').pop() || context;
                }

                appLogger.ingest({
                    level: payload.level ? stringToLogLevel(payload.level) : undefined,
                    message: message,
                    context: context,
                    data: payload.data || payload.fields,
                    timestamp: payload.timestamp,
                });
                return true;
            }
        } catch {
            /* ignore and fallback */
        }
        return false;
    }
}

