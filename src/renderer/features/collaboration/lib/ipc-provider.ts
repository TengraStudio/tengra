/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Observable } from 'lib0/observable';
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness';
import * as Y from 'yjs';

import {
    type CollaborationRoomType,
    type CollaborationRoomTypeInput,
    normalizeCollaborationRoomType,
} from '@/features/collaboration/lib/collaboration-room-type';
import { appLogger } from '@/utils/renderer-logger';

type UnsafeValue = ReturnType<typeof JSON.parse>;

/**
 * IpcProvider
 */
export class IpcProvider extends Observable<string> {
    private doc: Y.Doc;
    public awareness: Awareness;
    private roomId: string;
    private type: CollaborationRoomType;
    private id: string;
    private unsubscribers: (() => void)[] = [];
    private isConnected = false;

    constructor(type: CollaborationRoomTypeInput, id: string, doc: Y.Doc) {
        super();
        this.type = normalizeCollaborationRoomType(type);
        this.id = id;
        this.roomId = `${this.type}:${id}`;
        this.doc = doc;
        this.awareness = new Awareness(doc);

        this.init().catch(error => appLogger.error('IpcProvider', 'Error initializing IpcProvider', error as Error));
    }

    private async init() {
        try {
            (this as UnsafeValue).emit('status', [{ status: 'connecting' }]);

            // 1. Join room
            await window.electron.liveCollaboration.joinRoom({ type: this.type, id: this.id });

            // 2. Listen for connection lifecycle / remote sync / awareness updates
            this.unsubscribers.push(
                window.electron.liveCollaboration.onJoined((payload) => {
                    if (payload.roomId !== this.roomId) {
                        return;
                    }
                    this.isConnected = true;
                    (this as UnsafeValue).emit('status', [{ status: 'connected' }]);
                })
            );

            this.unsubscribers.push(
                window.electron.liveCollaboration.onLeft((payload) => {
                    if (payload.roomId !== this.roomId) {
                        return;
                    }
                    this.isConnected = false;
                    (this as UnsafeValue).emit('status', [{ status: 'disconnected' }]);
                })
            );

            this.unsubscribers.push(
                window.electron.liveCollaboration.onSyncUpdate((payload) => {
                    if (payload.roomId !== this.roomId) { return; }

                    try {
                        let parsed: UnsafeValue;
                        if (typeof payload.data === 'string') {
                            parsed = JSON.parse(payload.data);
                        } else {
                            // If it's already a Uint8Array (or Buffer), it's a raw Doc update
                            Y.applyUpdate(this.doc, payload.data, this);
                            return;
                        }

                        if (parsed && typeof parsed === 'object') {
                            const p = parsed as Record<string, UnsafeValue>;
                            if (p.type === 'aw' && Array.isArray(p.data)) {
                                applyAwarenessUpdate(this.awareness, new Uint8Array(p.data as number[]), this);
                            } else if (p.type === 'update' && Array.isArray(p.data)) {
                                Y.applyUpdate(this.doc, new Uint8Array(p.data as number[]), this);
                            } else if (Array.isArray(parsed)) {
                                // Raw array of bytes (old format)
                                Y.applyUpdate(this.doc, new Uint8Array(parsed as number[]), this);
                            } else {
                                // Fallback for object-based updates (e.g. { '0': 1, '1': 2 })
                                Y.applyUpdate(this.doc, new Uint8Array(Object.values(p) as number[]), this);
                            }
                        }
                    } catch (err) {
                        appLogger.error('IpcProvider', `Failed to apply sync update in ${this.roomId}`, err as Error);
                    }
                })
            );

            // 3. Local Doc Updates
            this.doc.on('update', (update: Uint8Array, origin: UnsafeValue) => {
                if (origin !== this && this.isConnected) {
                    void window.electron.liveCollaboration.sendUpdate({
                        roomId: this.roomId,
                        data: JSON.stringify(Array.from(update))
                    });
                }
            });

            // 4. Local Awareness Updates
            this.awareness.on('update', ({ added, updated, removed }: { added: number[], updated: number[], removed: number[] }, origin: UnsafeValue) => {
                if (origin !== this && this.isConnected) {
                    const changedClients = added.concat(updated).concat(removed);
                    const update = encodeAwarenessUpdate(this.awareness, changedClients);
                    void window.electron.liveCollaboration.sendUpdate({
                        roomId: this.roomId,
                        data: JSON.stringify({ type: 'aw', data: Array.from(update) })
                    });
                }
            });

            // 4. Handle errors
            this.unsubscribers.push(
                window.electron.liveCollaboration.onError((payload) => {
                    if (payload.roomId === this.roomId) {
                        this.isConnected = false;
                        const errorMsg = typeof payload.error === 'string' ? payload.error : JSON.stringify(payload.error);
                        appLogger.error('IpcProvider', `Collaboration error in ${this.roomId}`, errorMsg);
                        (this as UnsafeValue).emit('status', [{ status: 'disconnected', error: new Error(errorMsg) }]);
                        // Emit error as a string instead of an array (which can cause confusion in consumers)
                        (this as UnsafeValue).emit('common.error', [errorMsg]);
                    }
                })
            );

        } catch (error) {
            this.isConnected = false;
            appLogger.error('IpcProvider', 'Failed to initialize IpcProvider', error as Error);
            (this as UnsafeValue).emit('status', [{ status: 'disconnected', error }]);
        }
    }

    /**
     * Terminate the connection and cleanup listeners.
     */
    destroy() {
        this.isConnected = false;
        this.unsubscribers.forEach(unsub => unsub());
        void window.electron.liveCollaboration.leaveRoom(this.roomId);
        super.destroy();
    }
}
