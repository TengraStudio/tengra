import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as net from 'net';
import path from 'path';

import { appLogger } from '@main/logging/logger';
import { getErrorMessage } from '@shared/utils/error.util';
import axios from 'axios';
import { app } from 'electron';

interface ProcessOptions {
    name: string
    executable: string
    args?: string[]
    persistent?: boolean // If true, process won't be killed on app exit
}

export class ProcessManagerService extends EventEmitter {
    private processes: Map<string, ChildProcess> = new Map();
    private persistentServices: Set<string> = new Set();
    private servicePorts: Map<string, number> = new Map();
    private isDev: boolean;

    constructor() {
        super();
        this.isDev = !app.isPackaged;
    }

    private getPortFilePath(name: string): string {
        const appData = process.env.APPDATA ?? path.join(process.env.HOME ?? '', 'Library', 'Application Support');
        return path.join(appData, 'Orbit', 'services', `${name}.port`);
    }

    private async isPortOpen(port: number): Promise<boolean> {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(200); // Fast check
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

    private async discoverService(name: string, cleanupStale: boolean = true): Promise<number | null> {
        const portFile = this.getPortFilePath(name);
        if (!fs.existsSync(portFile)) { return null; }

        try {
            const content = fs.readFileSync(portFile, 'utf8').trim();
            const port = parseInt(content);
            if (isNaN(port)) { return null; }

            // Ping service to verify it's alive
            const alive = await this.isPortOpen(port);
            if (alive) { return port; }

            // Dead port - cleanup stale file only if requested
            if (cleanupStale) {
                appLogger.warn('ProcessManager', `Cleaning up stale port file for ${name} at port ${port}`);
                try { fs.unlinkSync(portFile); } catch { /* ignore */ }
            }
        } catch (e) {
            appLogger.debug('ProcessManager', `Failed to read/verify port file for ${name}: ${getErrorMessage(e)}`);
        }
        return null;
    }

    async startService(options: ProcessOptions): Promise<void> {
        // 1. Try discovery first (maybe it's already running independently)
        const discoveredPort = await this.discoverService(options.name);
        if (discoveredPort) {
            appLogger.info('ProcessManager', `Discovered existing service ${options.name} on port ${discoveredPort}`);
            this.servicePorts.set(options.name, discoveredPort);
            if (options.persistent) {
                this.persistentServices.add(options.name);
            }
            return;
        }

        if (this.processes.has(options.name)) {
            appLogger.warn('ProcessManager', `Service ${options.name} is already registered as a child process`);
            return;
        }

        const binPath = this.getBinaryPath(options.executable);
        appLogger.info('ProcessManager', `Starting service ${options.name} from ${binPath}`);

        try {
            const child = spawn(binPath, options.args ?? [], {
                stdio: ['ignore', 'pipe', 'pipe'], // Ignore stdin to prevent hanging
                windowsHide: true, // Clean taskbar
                detached: true // Allow it to live beyond Orbit
            });

            child.unref(); // Electron won't wait for it to exit

            child.stdout.on('data', (data: Buffer) => {
                appLogger.debug('ProcessManager', `[${options.name}] stdout: ${data.toString()}`);
            });

            child.stderr.on('data', (data: Buffer) => {
                appLogger.error('ProcessManager', `[${options.name}] stderr: ${data.toString()}`);
            });

            child.on('close', (code) => {
                const isPersistent = this.persistentServices.has(options.name);

                if (code !== 0 && code !== 1) {
                    appLogger.warn('ProcessManager', `Service ${options.name} exited with code ${code}`);
                } else {
                    appLogger.debug('ProcessManager', `Service ${options.name} exited with code ${code}`);
                }

                this.processes.delete(options.name);
                this.servicePorts.delete(options.name);
                // Don't delete from persistentServices yet if we want to restart

                if (isPersistent && code !== 0) {
                    appLogger.info('ProcessManager', `Auto-restarting persistent service: ${options.name}`);
                    setTimeout(() => {
                        this.startService(options).catch(err => {
                            appLogger.error('ProcessManager', `Failed to auto-restart ${options.name}: ${getErrorMessage(err)}`);
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

            // Wait for port file to appear (polling)
            return new Promise((resolve) => {
                let attempts = 0;
                const maxAttempts = 50;
                const checkPort = setInterval(() => {
                    // Do NOT cleanup stale files during startup polling
                    const portPromise = this.discoverService(options.name, false);
                    portPromise.then(p => {
                        if (p) {
                            clearInterval(checkPort);
                            this.servicePorts.set(options.name, p);
                            appLogger.info('ProcessManager', `Service ${options.name} ready on port ${p}`);
                            this.emit(`${options.name}:ready`, p);
                            resolve();
                        }
                    }).catch(() => { });

                    attempts++;
                    if (attempts >= maxAttempts) {
                        clearInterval(checkPort);
                        appLogger.error('ProcessManager', `Timed out waiting for ${options.name} to report port`);
                        resolve();
                    }
                }, 100);
            });

        } catch (error) {
            appLogger.error('ProcessManager', `Failed to start ${options.name}: ${getErrorMessage(error)}`);
        }
    }

    stopService(name: string) {
        const child = this.processes.get(name);
        if (child) {
            child.kill();
            this.processes.delete(name);
        }
        this.servicePorts.delete(name);
        this.persistentServices.delete(name);
    }

    killAll() {
        appLogger.info('ProcessManager', 'Stopping all non-persistent services for shutdown');
        for (const [name, child] of this.processes) {
            if (this.persistentServices.has(name)) {
                appLogger.info('ProcessManager', `Skipping persistent service: ${name}`);
                continue;
            }

            // Remove 'close' listener to prevent logs during intentional shutdown
            child.removeAllListeners('close');
            try {
                child.kill();
            } catch { /* ignore */ }
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

    async sendRequest<T>(name: string, data: Record<string, unknown>, _timeoutMs = 10000, endpointOverride?: string): Promise<T> {
        let port = this.servicePorts.get(name);

        if (!port) {
            port = await this.discoverService(name) ?? undefined;
            if (port) {
                this.servicePorts.set(name, port);
            }
        }

        if (!port) {
            throw new Error(`Service ${name} port not discovered. Is it started?`);
        }

        // Map service names to endpoints
        const endpointMap: Record<string, string> = {
            'token-service': '/refresh',
            'quota-service': '/quota',
            'model-service': '/fetch',
            'memory-service': '/rpc'
        };

        const endpoint = endpointOverride ?? (endpointMap[name] || '/');
        const url = `http://127.0.0.1:${port}${endpoint}`;

        try {
            const response = await axios.post(url, data, {
                timeout: _timeoutMs
            });
            return response.data as T;
        } catch (error) {
            appLogger.error('ProcessManager', `HTTP request to ${name} failed: ${getErrorMessage(error)}`);
            throw error;
        }
    }

    async sendGetRequest<T>(name: string, endpoint: string): Promise<T> {
        let port = this.servicePorts.get(name);

        if (!port) {
            port = await this.discoverService(name) ?? undefined;
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
                timeout: 10000 // Default 10s for GET
            });
            return response.data as T;
        } catch (error) {
            appLogger.error('ProcessManager', `HTTP GET request to ${name} (${endpoint}) failed: ${getErrorMessage(error)}`);
            throw error;
        }
    }

    private getBinaryPath(executable: string): string {
        const binName = executable.endsWith('.exe') ? executable : `${executable}.exe`;
        if (this.isDev) {
            return path.join(process.cwd(), 'resources', 'bin', binName);
        } else {
            return path.join(process.resourcesPath, 'bin', binName);
        }
    }
}
