/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { AuthService } from '@main/services/security/auth.service';
import axios from 'axios';
import { WebSocket } from 'ws';

import { ITerminalBackend, ITerminalProcess, TerminalCreateOptions } from './terminal-backend.interface';

/**
 * Terminal backend implementation that delegates PTY management to the native Rust proxy.
 * This eliminates the need for node-pty and other C++ native modules in Node.js.
 */
export class ProxyTerminalBackend implements ITerminalBackend {
    public readonly id = 'proxy-terminal';
    private readonly proxyUrl = 'http://127.0.0.1:8317';
    private readonly wsUrl = 'ws://127.0.0.1:8317';

    constructor(
        private readonly authService: AuthService,
        private readonly proxyService?: ProxyService
    ) {}

    public async isAvailable(): Promise<boolean> {
        // If we have the proxy service, we consider it available because we can start it on demand
        if (this.proxyService) {
            return true;
        }

        try {
            // Fallback health check for cases where proxyService isn't provided but proxy might be running
            const response = await axios.get(`${this.proxyUrl}/health`, { timeout: 200 });
            return response.status === 200;
        } catch {
            return false;
        }
    }

    public async create(options: TerminalCreateOptions): Promise<ITerminalProcess> {
        appLogger.info('ProxyTerminalBackend', `Requesting PTY from proxy: ${options.shell} in ${options.cwd}`);

        // Ensure proxy is running before attempting to create session
        if (this.proxyService) {
            const ready = await this.proxyService.ensureEmbeddedProxyReady();
            if (!ready) {
                throw new Error('Failed to start terminal proxy');
            }
        }

        const apiKey = await this.getProxyApiKey();

        // 1. Create session via REST API with explicit timeout
        const createResponse = await axios.post(`${this.proxyUrl}/v0/terminal`, {
            cwd: options.cwd,
            shell: options.shell,
            args: options.args,
            cols: options.cols,
            rows: options.rows
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000 // 10s timeout to avoid "stuck" terminals
        });

        const sessionId = createResponse.data.id;
        if (!sessionId) {
            throw new Error('Failed to create terminal session in proxy');
        }

        const wsUrl = `${this.wsUrl}/v0/terminal/ws/${sessionId}`;
        appLogger.info('ProxyTerminalBackend', `Connecting WebSocket to ${wsUrl} (Key: ${apiKey.slice(0, 8)}***)`);

        // 2. Connect WebSocket for data streaming
        const socket = new WebSocket(wsUrl, {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            },
            handshakeTimeout: 5000
        });

        socket.on('open', () => {
            appLogger.info('ProxyTerminalBackend', `WebSocket stream opened for session ${sessionId}`);
        });

        socket.on('message', (data) => {
            const dataStr = Buffer.isBuffer(data) ? data.toString('utf8') : data.toString();
            appLogger.debug('ProxyTerminalBackend', `Received ${dataStr.length} chars for session ${sessionId}`);
            options.onData(dataStr);
        });

        socket.on('close', (code, reason) => {
            appLogger.info('ProxyTerminalBackend', `WebSocket stream closed for session ${sessionId} (Code: ${code}, Reason: ${reason})`);
            options.onExit(0);
        });

        socket.on('error', (err) => {
            appLogger.error('ProxyTerminalBackend', `WebSocket error for session ${sessionId}: ${err.message}`, err);
        });

        // 3. Return process handle
        return {
            write: (data: string) => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(data);
                }
            },
            resize: (cols: number, rows: number) => {
                void (async () => {
                    try {
                        await axios.post(`${this.proxyUrl}/v0/terminal/${sessionId}/resize`, {
                            cols,
                            rows
                        }, {
                            headers: {
                                'Authorization': `Bearer ${apiKey}`,
                                'Content-Type': 'application/json'
                            },
                            timeout: 2000
                        });
                    } catch (err) {
                        appLogger.error('ProxyTerminalBackend', `Failed to resize terminal session ${sessionId}`, err);
                    }
                })();
            },
            kill: () => {
                socket.close();
                void (async () => {
                    try {
                        await axios.delete(`${this.proxyUrl}/v0/terminal/${sessionId}`, {
                            headers: {
                                'Authorization': `Bearer ${apiKey}`
                            },
                            timeout: 2000
                        });
                    } catch (err) {
                        appLogger.error('ProxyTerminalBackend', `Failed to delete terminal session ${sessionId}`, err);
                    }
                })();
            }
        };
    }

    private async getProxyApiKey(): Promise<string> {
        try {
            // Await the token to ensure AuthService is ready, but with a timeout
            const token = await Promise.race([
                this.authService.getActiveToken('proxy_key'),
                new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 3000))
            ]);
            
            if (token) {
                return token;
            }
        } catch (e) {
            appLogger.warn('ProxyTerminalBackend', 'Failed to retrieve proxy API key from AuthService');
        }
        
        appLogger.warn('ProxyTerminalBackend', 'No proxy_key found or timeout reached, using unified fallback');
        return 'proxypal-fallback'; // Fallback to default shared key if not set
    }
}

