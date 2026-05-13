/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { BaseService } from '@main/services/base.service';
import { AuthService } from '@main/services/security/auth.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { NETWORK_DEFAULTS } from '@shared/constants/app-config';
import { JsonValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { WebSocket } from 'ws';

/**
 * UserCollaborationService
 * 
 * Handles real-time synchronization for collaborative features (group chats, multi-user workspace editing).
 * Connects to the Tengra C++ backend WebSocket endpoints.
 */
export class UserCollaborationService extends BaseService {
    static readonly serviceName = 'userCollaborationService';
    static readonly dependencies = ['authService', 'eventBus'] as const;
    private websockets: Map<string, WebSocket> = new Map();
    private readonly backendUrl = process.env['COLLABORATION_WS_URL'] ?? NETWORK_DEFAULTS.COLLABORATION_WS_URL;

    constructor(
        private authService: AuthService,
        private eventBus: EventBusService
    ) {
        super('UserCollaborationService');
    }

    /**
     * Join a collaborative room.
     * @param type - 'chat' or 'workspace'
     * @param id - The unique identifier for the chat or workspace
     */
    async joinRoom(type: 'chat' | 'workspace', id: string): Promise<void> {
        const roomId = `${type}:${id}`;
        if (this.websockets.has(roomId)) {
            const ws = this.websockets.get(roomId);
            if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) {
                this.logInfo(`Already joined or connecting to room: ${roomId}`);
                return;
            }
            this.websockets.delete(roomId);
        }

        try {
            // Get token for the native antigravity platform
            const token = await this.authService.getActiveToken('antigravity');
            if (!token) {
                throw new Error('error.collaboration.auth_required');
            }

            const url = `${this.backendUrl}/${type}/${id}`;
            const ws = new WebSocket(url, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            ws.on('open', () => {
                this.logInfo(`Successfully joined room: ${roomId}`);
                this.eventBus.emit('collaboration:joined', { roomId });
            });

            ws.on('message', (data) => {
                // Broadcast received updates to the renderer via event bus
                this.eventBus.emit('collaboration:sync', { roomId, data: data.toString() });
            });

            ws.on('error', (err) => {
                this.logError(`WebSocket error in room ${roomId}`, err);
                this.eventBus.emit('collaboration:error', { roomId, error: getErrorMessage(err) });
            });

            ws.on('close', (code, reason) => {
                this.logInfo(`Left room: ${roomId} (Code: ${code}, Reason: ${reason})`);
                this.websockets.delete(roomId);
                this.eventBus.emit('collaboration:left', { roomId });
            });

            this.websockets.set(roomId, ws);

        } catch (error) {
            this.logError(`Failed to join collaborative room ${roomId}`, error);
            throw error;
        }
    }

    /**
     * Send a synchronization update to the room.
     * @param roomId - The room identifier (e.g., 'workspace:123')
     * @param data - The update payload (JSON object or string)
     */
    async sendUpdate(roomId: string, data: JsonValue): Promise<void> {
        const ws = this.websockets.get(roomId);
        if (ws?.readyState !== WebSocket.OPEN) {
            throw new Error('error.collaboration.not_connected');
        }

        const message = typeof data === 'string' ? data : JSON.stringify(data);
        ws.send(message);
    }

    /**
     * Leave a collaborative room and close the connection.
     * @param roomId - The room identifier
     */
    async leaveRoom(roomId: string): Promise<void> {
        const ws = this.websockets.get(roomId);
        if (ws) {
            ws.close(); // 'close' event handler will clean up from the map
        }
    }

    /**
     * Cleanup all active connections on service shutdown.
     */
    override async cleanup(): Promise<void> {
        this.logInfo('Shutting down collaboration service, closing all rooms...');
        for (const [roomId, ws] of this.websockets.entries()) {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
            }
            this.websockets.delete(roomId);
        }
    }
}

