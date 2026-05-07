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
import { JsonObject } from '@shared/types/common';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { app } from 'electron';
import { WebSocket, WebSocketServer } from 'ws';

export interface AgentMessage {
    id: string
    sessionId: string
    sender: string // 'planner' | 'executor' | 'system' | 'user'
    content: string
    timestamp: number
    type: 'text' | 'status' | 'code' | 'help'
    metadata?: JsonObject
}

export class CollaborationService {
    private wss: WebSocketServer | null = null;
    private clients: Map<string, WebSocket[]> = new Map(); // sessionId -> sockets
    private takeoverClient: WebSocket | null = null;
    private retryTimeout: ReturnType<typeof setTimeout> | null = null;
    private retryGeneration = 0;

    constructor() {
        // We'll bind to a specific port, e.g., 3001
        this.initializeServer(3001);
    }

    private initializeServer(port: number): void {
        try {
            const server = new WebSocketServer({ port });
            this.wss = server;
            this.attachServerErrorHandler(server, port);
            this.setupServerListeners(server);
            appLogger.info('collaboration.service', `[CollaborationService] WebSocket server started on port ${port}`);
        } catch (e) {
            this.handleServerError(port, e as Error & { code?: string });
        }
    }

    private attachServerErrorHandler(server: WebSocketServer, port: number): void {
        server.on('error', (error: Error & { code?: string }) => {
            if (this.wss === server) {
                this.handleServerError(port, error);
            }
        });
    }

    private handleServerError(port: number, error: Error & { code?: string }): void {
        if (error.code !== 'EADDRINUSE') {
            appLogger.error('collaboration.service', '[CollaborationService] WebSocket server error', error);
            return;
        }

        appLogger.warn('collaboration.service', `[CollaborationService] Port ${port} in use. Attempting takeover...`);
        this.requestTakeover(port);
    }

    private requestTakeover(port: number): void {
        if (this.takeoverClient !== null) {
            this.takeoverClient.terminate();
            this.takeoverClient = null;
        }

        const takeoverClient = new WebSocket(`ws://localhost:${port}`);
        this.takeoverClient = takeoverClient;

        takeoverClient.on('open', () => {
            if (this.takeoverClient !== takeoverClient) {
                return;
            }

            takeoverClient.send(JSON.stringify({ type: 'shutdown', reason: 'New instance taking over' }));
            takeoverClient.close();
            this.takeoverClient = null;
            this.scheduleRetry(port);
        });

        takeoverClient.on('error', connErr => {
            if (this.takeoverClient !== takeoverClient) {
                return;
            }
            this.takeoverClient = null;
            appLogger.error('collaboration.service', `[CollaborationService] Failed to connect to existing instance on port ${port}`, connErr as Error);
        });
    }

    private scheduleRetry(port: number): void {
        if (this.retryTimeout !== null) {
            clearTimeout(this.retryTimeout);
        }

        const retryGeneration = ++this.retryGeneration;
        this.retryTimeout = setTimeout(() => {
            if (retryGeneration !== this.retryGeneration) {
                return;
            }

            this.retryTimeout = null;

            const staleServer = this.wss;
            this.wss = null;
            staleServer?.close();

            this.initializeServer(port);
        }, 3000);
    }

    private setupServerListeners(server: WebSocketServer): void {
        server.on('connection', (ws) => {
            appLogger.info('collaboration.service', '[CollaborationService] New client connected');

            ws.on('message', (data) => {
                try {
                    const parsed = safeJsonParse<JsonObject>(data.toString(), {});

                    // Handle shutdown command from new instance
                    if (parsed.type === 'shutdown') {
                        appLogger.warn('collaboration.service', '[CollaborationService] Received shutdown signal from new instance. Quitting...');

                        // Close server immediately to free port
                        if (this.wss === server) {
                            this.wss = null;
                            server.close(() => {
                                appLogger.info('collaboration.service', '[CollaborationService] Server closed. Exiting app...');
                                app.exit(0);
                            });
                        }
                        return;
                    }

                    // Basic protocol: { type: 'join', sessionId: '...' }
                    if (parsed.type === 'join' && parsed.sessionId) {
                        this.addClient(parsed.sessionId as string, ws);
                    }

                    // Handle other incoming messages (e.g. user chat)
                    if (parsed.type === 'chat' && parsed.sessionId) {
                        this.broadcast(parsed.sessionId as string, {
                            id: Date.now().toString(),
                            sessionId: parsed.sessionId as string,
                            sender: 'user',
                            content: parsed.content as string,
                            timestamp: Date.now(),
                            type: 'text'
                        });
                    }
                } catch (e) {
                    appLogger.error('collaboration.service', '[CollaborationService] Failed to parse message', e as Error);
                }
            });

            ws.on('close', () => {
                this.removeClient(ws);
            });
        });
    }

    private addClient(sessionId: string, ws: WebSocket) {
        if (!this.clients.has(sessionId)) {
            this.clients.set(sessionId, []);
        }
        this.clients.get(sessionId)?.push(ws);
        appLogger.info('collaboration.service', `[CollaborationService] Client joined session ${sessionId}`);
    }

    private removeClient(ws: WebSocket) {
        for (const [sessionId, sockets] of this.clients.entries()) {
            const index = sockets.indexOf(ws);
            if (index !== -1) {
                sockets.splice(index, 1);
                if (sockets.length === 0) {
                    this.clients.delete(sessionId);
                }
                break;
            }
        }
    }

    public broadcast(sessionId: string, message: AgentMessage) {
        const sockets = this.clients.get(sessionId);
        if (!sockets) { return; }

        const payload = JSON.stringify(message);
        sockets.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(payload);
            }
        });
    }

    /**
     * Releases all held resources: pending retry timer, takeover client,
     * every tracked session socket, and the WebSocketServer itself.
     */
    public cleanup(): void {
        this.retryGeneration += 1;
        if (this.retryTimeout !== null) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }
        if (this.takeoverClient !== null) {
            this.takeoverClient.terminate();
            this.takeoverClient = null;
        }
        for (const sockets of this.clients.values()) {
            for (const ws of sockets) {
                ws.terminate();
            }
        }
        this.clients.clear();
        if (this.wss !== null) {
            const activeServer = this.wss;
            this.wss = null;
            activeServer.close();
        }
    }

    public dispose(): void {
        this.cleanup();
    }
}

