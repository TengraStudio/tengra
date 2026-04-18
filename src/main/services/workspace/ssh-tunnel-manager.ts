/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { SSHPortForward, SSHTunnelPreset } from '@shared/types/ssh';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { Client } from 'ssh2';

type StoredTunnelPreset = SSHTunnelPreset;

export interface LocalForwardOptions {
    connectionId: string;
    conn: Client;
    localHost: string;
    localPort: number;
    remoteHost: string;
    remotePort: number;
}

export interface RemoteForwardOptions {
    connectionId: string;
    conn: Client;
    remoteHost: string;
    remotePort: number;
    localHost: string;
    localPort: number;
}

/**
 * SSH Tunnel Manager
 * Handles SSH port forwarding (local, remote, dynamic) and tunnel presets
 */
export class SSHTunnelManager extends EventEmitter {
    private storagePath: string;
    private initPromise: Promise<void> | null = null;
    private portForwards: Map<string, SSHPortForward> = new Map();
    private portForwardClosers: Map<string, () => void> = new Map();

    constructor(storagePath: string) {
        super();
        this.storagePath = storagePath;
    }

    private get tunnelPresetsPath(): string {
        return path.join(this.storagePath, 'ssh-tunnel-presets.json');
    }

    private async ensureInitialization(): Promise<void> {
        if (this.initPromise) {
            return this.initPromise;
        }
        this.initPromise = (async () => {
            try {
                await fs.promises.mkdir(this.storagePath, { recursive: true, mode: 0o700 });
                try {
                    await fs.promises.access(this.tunnelPresetsPath);
                } catch {
                    await fs.promises.writeFile(this.tunnelPresetsPath, JSON.stringify([], null, 2));
                }
            } catch (error) {
                appLogger.error(
                    'SSHTunnelManager',
                    `Initialization failed: ${getErrorMessage(error as Error)}`
                );
                this.initPromise = null;
                throw error;
            }
        })();
        return this.initPromise;
    }

    private async readTunnelPresets(): Promise<StoredTunnelPreset[]> {
        await this.ensureInitialization();
        const content = await fs.promises.readFile(this.tunnelPresetsPath, 'utf-8');
        return safeJsonParse<StoredTunnelPreset[]>(content, []);
    }

    private async writeTunnelPresets(presets: StoredTunnelPreset[]): Promise<void> {
        await fs.promises.writeFile(this.tunnelPresetsPath, JSON.stringify(presets, null, 2));
    }

    async createLocalForward(
        options: LocalForwardOptions
    ): Promise<{ success: boolean; forwardId?: string; error?: string }> {
        const { connectionId, conn, localHost, localPort, remoteHost, remotePort } = options;
        const forwardId = crypto.randomUUID();

        return new Promise(resolve => {
            const server = net.createServer((socket: net.Socket) => {
                conn.forwardOut(
                    socket.remoteAddress ?? '127.0.0.1',
                    socket.remotePort ?? 0,
                    remoteHost,
                    remotePort,
                    (err: Error | undefined, stream: NodeJS.ReadWriteStream) => {
                        if (err) {
                            socket.end();
                            return;
                        }
                        socket.pipe(stream).pipe(socket);
                    }
                );
            });

            server.listen(localPort, localHost, () => {
                const forward: SSHPortForward = {
                    id: forwardId,
                    connectionId,
                    type: 'local',
                    localHost,
                    localPort,
                    remoteHost,
                    remotePort,
                    active: true,
                };
                this.portForwards.set(forwardId, forward);
                this.portForwardClosers.set(forwardId, () => {
                    server.close();
                });
                this.emit('portForwardCreated', forward);
                resolve({ success: true, forwardId });
            });

            server.on('error', (err: Error) => {
                resolve({ success: false, error: err.message });
            });
        });
    }

    async createRemoteForward(
        options: RemoteForwardOptions
    ): Promise<{ success: boolean; forwardId?: string; error?: string }> {
        const { connectionId, conn, remoteHost, remotePort, localHost, localPort } = options;
        const forwardId = crypto.randomUUID();
        return new Promise(resolve => {
            conn.forwardIn(remoteHost, remotePort, (error?: Error) => {
                if (error) {
                    resolve({ success: false, error: error.message });
                    return;
                }

                const forward: SSHPortForward = {
                    id: forwardId,
                    connectionId,
                    type: 'remote',
                    localHost,
                    localPort,
                    remoteHost,
                    remotePort,
                    active: true
                };
                this.portForwards.set(forwardId, forward);
                this.portForwardClosers.set(forwardId, () => {
                    conn.unforwardIn(remoteHost, remotePort, () => { });
                });
                this.emit('portForwardCreated', forward);
                resolve({ success: true, forwardId });
            });
        });
    }

    async createDynamicForward(
        connectionId: string,
        conn: Client,
        localHost: string,
        localPort: number
    ): Promise<{ success: boolean; forwardId?: string; error?: string }> {
        const forwardId = crypto.randomUUID();
        return new Promise(resolve => {
            const server = net.createServer((socket: net.Socket) => {
                socket.once('data', (chunk: Buffer) => {
                    if (chunk[0] !== 0x05) {
                        socket.end();
                        return;
                    }
                    socket.write(Buffer.from([0x05, 0x00]));
                    socket.once('data', (request: Buffer) => {
                        this.handleDynamicForwardRequest(conn, socket, request);
                    });
                });
            });

            server.listen(localPort, localHost, () => {
                const forward: SSHPortForward = {
                    id: forwardId,
                    connectionId,
                    type: 'dynamic',
                    localHost,
                    localPort,
                    remoteHost: '0.0.0.0',
                    remotePort: 0,
                    active: true
                };
                this.portForwards.set(forwardId, forward);
                this.portForwardClosers.set(forwardId, () => {
                    server.close();
                });
                this.emit('portForwardCreated', forward);
                resolve({ success: true, forwardId });
            });

            server.on('error', (err: Error) => {
                resolve({ success: false, error: err.message });
            });
        });
    }

    private handleDynamicForwardRequest(
        _conn: Client,
        socket: net.Socket,
        request: Buffer
    ): void {
        // SOCKS5 connect command
        const cmd = request[1];
        const hostType = request[2];

        if (cmd !== 0x01) {
            socket.write(Buffer.from([0x05, 0x07, 0x00, 0x01]));
            socket.end();
            return;
        }

        let targetHost: string;
        let targetPort: number;

        if (hostType === 0x01) {
            // IPv4
            targetHost = `${request[3]}.${request[4]}.${request[5]}.${request[6]}`;
            targetPort = request[7] << 8 | request[8];
        } else if (hostType === 0x03) {
            // Domain
            const len = request[3];
            targetHost = request.slice(4, 4 + len).toString();
            targetPort = request[4 + len] << 8 | request[5 + len];
        } else {
            socket.write(Buffer.from([0x05, 0x08, 0x00, 0x01]));
            socket.end();
            return;
        }

        const remote = net.connect(targetPort, targetHost, () => {
            socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
            remote.pipe(socket).pipe(remote);
        });

        remote.on('error', () => {
            socket.write(Buffer.from([0x05, 0x05, 0x00, 0x01]));
            socket.end();
        });
    }

    async saveTunnelPreset(preset: Omit<SSHTunnelPreset, 'id' | 'createdAt' | 'updatedAt'>): Promise<SSHTunnelPreset> {
        const presets = await this.readTunnelPresets();
        const now = Date.now();
        const newPreset: SSHTunnelPreset = {
            ...preset,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now
        };
        presets.push(newPreset);
        await this.writeTunnelPresets(presets);
        return newPreset;
    }

    async listTunnelPresets(): Promise<SSHTunnelPreset[]> {
        return this.readTunnelPresets();
    }

    async deleteTunnelPreset(id: string): Promise<boolean> {
        const presets = await this.readTunnelPresets();
        const filtered = presets.filter(p => p.id !== id);
        if (filtered.length === presets.length) {
            return false;
        }
        await this.writeTunnelPresets(filtered);
        return true;
    }

    getPortForward(forwardId: string): SSHPortForward | undefined {
        return this.portForwards.get(forwardId);
    }

    getAllPortForwards(): SSHPortForward[] {
        return Array.from(this.portForwards.values());
    }

    async closePortForward(forwardId: string): Promise<boolean> {
        const closer = this.portForwardClosers.get(forwardId);
        if (!closer) {
            return false;
        }
        closer();
        this.portForwards.delete(forwardId);
        this.portForwardClosers.delete(forwardId);
        return true;
    }

    async dispose(): Promise<void> {
        const forwardIds = Array.from(this.portForwards.keys());
        for (const forwardId of forwardIds) {
            await this.closePortForward(forwardId);
        }
        this.removeAllListeners();
    }
}
