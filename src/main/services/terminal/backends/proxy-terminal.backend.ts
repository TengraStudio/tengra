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

    constructor(private readonly authService: AuthService) {}

    public async isAvailable(): Promise<boolean> {
        try {
            // Simple health check to see if proxy is alive
            const response = await axios.get(`${this.proxyUrl}/health`, { timeout: 1000 });
            return response.status === 200;
        } catch {
            return false;
        }
    }

    public async create(options: TerminalCreateOptions): Promise<ITerminalProcess> {
        appLogger.info('ProxyTerminalBackend', `Requesting PTY from proxy: ${options.shell} in ${options.cwd}`);

        const apiKey = await this.getProxyApiKey();

        // 1. Create session via REST API
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
            }
        });

        const sessionId = createResponse.data.id;
        if (!sessionId) {
            throw new Error('Failed to create terminal session in proxy');
        }

        // 2. Connect WebSocket for data streaming
        const socket = new WebSocket(`${this.wsUrl}/v0/terminal/ws/${sessionId}`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        socket.on('message', (data) => {
            if (Buffer.isBuffer(data)) {
                options.onData(data.toString('utf8'));
            } else {
                options.onData(data.toString());
            }
        });

        socket.on('close', () => {
            options.onExit(0);
        });

        socket.on('error', (err) => {
            appLogger.error('ProxyTerminalBackend', `WebSocket error for session ${sessionId}`, err);
        });

        // 3. Return process handle
        return {
            write: (data: string) => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(data);
                }
            },
            resize: (cols: number, rows: number) => {
                // Currently, the proxy's terminal handler doesn't have a specific resize route,
                // but we can add it or send it as a control message if we extend the protocol.
                // For now, let's just log it. 
                // NOTE: The Rust session has a resize() method, we just need to expose it.
                appLogger.debug('ProxyTerminalBackend', `Resize requested: ${cols}x${rows} (not yet implemented in proxy WS)`);
            },
            kill: () => {
                socket.close();
                // Optionally call DELETE /v0/terminal/:id if we add that route
            }
        };
    }

    private async getProxyApiKey(): Promise<string> {
        const token = await this.authService.getActiveToken('proxy_key');
        return token || 'proxypal-local'; // Fallback to default insecure key if not set
    }
}
