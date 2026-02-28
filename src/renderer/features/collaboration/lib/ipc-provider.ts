import { Observable } from 'lib0/observable';
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness';
import * as Y from 'yjs';

import { appLogger } from '@/utils/renderer-logger';

/**
 * IpcProvider
 */
export class IpcProvider extends Observable<string> {
    private doc: Y.Doc;
    public awareness: Awareness;
    private roomId: string;
    private type: 'chat' | 'project';
    private id: string;
    private unsubscribers: (() => void)[] = [];

    constructor(type: 'chat' | 'project', id: string, doc: Y.Doc) {
        super();
        this.type = type;
        this.id = id;
        this.roomId = `${type}:${id}`;
        this.doc = doc;
        this.awareness = new Awareness(doc);

        this.init().catch(error => appLogger.error('IpcProvider', 'Error initializing IpcProvider', error as Error));
    }

    private async init() {
        try {
            // 1. Join room
            await window.electron.userCollaboration.joinRoom({ type: this.type, id: this.id });

            // 2. Listen for remote sync / awareness updates
            this.unsubscribers.push(
                window.electron.userCollaboration.onSyncUpdate((payload) => {
                    if (payload.roomId !== this.roomId) { return; }

                    try {
                        const parsed = JSON.parse(payload.data);
                        if (parsed.type === 'aw') {
                            applyAwarenessUpdate(this.awareness, new Uint8Array(parsed.data), this);
                        } else {
                            const update = new Uint8Array(parsed);
                            Y.applyUpdate(this.doc, update, this);
                        }
                    } catch {
                        // Fallback: If it's not a tagged object, assume it's a raw Doc update
                        const update = new Uint8Array(JSON.parse(payload.data));
                        Y.applyUpdate(this.doc, update, this);
                    }
                })
            );

            // 3. Local Doc Updates
            this.doc.on('update', (update, origin) => {
                if (origin !== this) {
                    window.electron.userCollaboration.sendUpdate({
                        roomId: this.roomId,
                        data: JSON.stringify(Array.from(update))
                    });
                }
            });

            // 4. Local Awareness Updates
            this.awareness.on('update', ({ added, updated, removed }: { added: number[], updated: number[], removed: number[] }, origin: unknown) => {
                if (origin !== this) {
                    const changedClients = added.concat(updated).concat(removed);
                    const update = encodeAwarenessUpdate(this.awareness, changedClients);
                    window.electron.userCollaboration.sendUpdate({
                        roomId: this.roomId,
                        data: JSON.stringify({ type: 'aw', data: Array.from(update) })
                    });
                }
            });

            // 4. Handle errors
            this.unsubscribers.push(
                window.electron.userCollaboration.onError((payload) => {
                    if (payload.roomId === this.roomId) {
                        appLogger.error('IpcProvider', `Collaboration error in ${this.roomId}`, payload.error);
                        this.emit('error', [payload.error]);
                    }
                })
            );

            this.emit('status', [{ status: 'connected' }]);

        } catch (error) {
            appLogger.error('IpcProvider', 'Failed to initialize IpcProvider', error as Error);
            this.emit('status', [{ status: 'disconnected', error }]);
        }
    }

    /**
     * Terminate the connection and cleanup listeners.
     */
    destroy() {
        this.unsubscribers.forEach(unsub => unsub());
        window.electron.userCollaboration.leaveRoom(this.roomId);
        super.destroy();
    }
}
