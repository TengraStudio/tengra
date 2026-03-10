import { SessionRecoverySnapshot } from '@shared/types/session-engine';
import { useEffect, useSyncExternalStore } from 'react';

import {
    ensureSessionRecoverySnapshots,
    getSessionRecoverySnapshotList,
    subscribeSessionRuntime,
} from '@/store/session-runtime.store';

export function useSessionRecoverySnapshots(): SessionRecoverySnapshot[] {
    const snapshots = useSyncExternalStore(
        subscribeSessionRuntime,
        getSessionRecoverySnapshotList,
        () => []
    );

    useEffect(() => {
        void ensureSessionRecoverySnapshots();
    }, []);

    return snapshots;
}
