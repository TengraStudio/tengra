/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useEffect, useMemo, useState } from 'react';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import {
    type CollaborationRoomType,
    type CollaborationRoomTypeInput,
    normalizeCollaborationRoomType,
} from '@/features/collaboration/lib/collaboration-room-type';
import { IpcProvider } from '@/features/collaboration/lib/ipc-provider';

interface UseCollaborationOptions {
    type: CollaborationRoomTypeInput;
    id: string;
    enabled?: boolean;
}

interface CollaborationState {
    doc: Y.Doc;
    provider: IpcProvider | null;
    awareness: Awareness | null;
    status: 'connecting' | 'connected' | 'disconnected';
    error: string | null;
}

/**
 * Creates a fresh Y.Doc for a given collaboration target.
 */
function createCollaborationDoc(_type: CollaborationRoomType, _id: string): Y.Doc {
    return new Y.Doc();
}

/**
 * useCollaboration
 *
 * Hook to manage a Yjs document and its IPC synchronization provider.
 */
export function useCollaboration({ type, id, enabled = true }: UseCollaborationOptions): CollaborationState {
    const normalizedType = useMemo(() => normalizeCollaborationRoomType(type), [type]);
    const doc = useMemo(() => createCollaborationDoc(normalizedType, id), [normalizedType, id]);
    const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
    const [error, setError] = useState<string | null>(null);
    const [awareness, setAwareness] = useState<Awareness | null>(null);

    useEffect(() => {
        if (!enabled) { return; }

        const p = new IpcProvider(normalizedType, id, doc);

        const handleStatus = (evt: { status: 'connecting' | 'connected' | 'disconnected'; error?: Error }) => {
            setStatus(evt.status);
            setAwareness(p.awareness);
            if (evt.error) { setError(evt.error.message || String(evt.error)); }
        };

        const handleError = (msg: string) => { setError(msg); };

        p.on('status', handleStatus);
        p.on('error', handleError);

        return () => {
            p.off('status', handleStatus);
            p.off('error', handleError);
            p.destroy();
            setAwareness(null);
        };
    }, [doc, normalizedType, id, enabled]);

    return { doc, provider: null, awareness, status, error };
}
