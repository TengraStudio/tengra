import { useEffect, useMemo, useState } from 'react';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import { IpcProvider } from '../lib/ipc-provider';

interface UseCollaborationOptions {
    type: 'chat' | 'project';
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
function createCollaborationDoc(_type: string, _id: string): Y.Doc {
    return new Y.Doc();
}

/**
 * useCollaboration
 *
 * Hook to manage a Yjs document and its IPC synchronization provider.
 */
export function useCollaboration({ type, id, enabled = true }: UseCollaborationOptions): CollaborationState {
    const doc = useMemo(() => createCollaborationDoc(type, id), [type, id]);
    const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
    const [error, setError] = useState<string | null>(null);
    const [awareness, setAwareness] = useState<Awareness | null>(null);

    useEffect(() => {
        if (!enabled) { return; }

        const p = new IpcProvider(type, id, doc);

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
    }, [doc, type, id, enabled]);

    return { doc, provider: null, awareness, status, error };
}
