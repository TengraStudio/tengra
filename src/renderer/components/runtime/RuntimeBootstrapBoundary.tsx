import { ReactNode, useEffect } from 'react';

import { ManagedRuntimeStatusPanel } from '@/components/runtime/ManagedRuntimeStatusPanel';
import {
    hasBlockingRuntimeIssue,
    loadRuntimeBootstrapStatus,
    repairManagedRuntime,
    useRuntimeBootstrapStore,
} from '@/store/runtime-bootstrap.store';

interface RuntimeBootstrapBoundaryProps {
    children: ReactNode;
}

export function RuntimeBootstrapBoundary({ children }: RuntimeBootstrapBoundaryProps) {
    const status = useRuntimeBootstrapStore(snapshot => snapshot.status);
    const isLoading = useRuntimeBootstrapStore(snapshot => snapshot.isLoading);
    const isRepairing = useRuntimeBootstrapStore(snapshot => snapshot.isRepairing);
    const error = useRuntimeBootstrapStore(snapshot => snapshot.error);

    useEffect(() => {
        if (status || isLoading) {
            return;
        }

        void loadRuntimeBootstrapStatus();
    }, [isLoading, status]);

    if (isLoading || hasBlockingRuntimeIssue(status)) {
        return (
            <ManagedRuntimeStatusPanel
                status={status}
                isLoading={isLoading}
                isRepairing={isRepairing}
                error={error}
                blockingOnly
                fullscreen
                onRefresh={() => {
                    void loadRuntimeBootstrapStatus(true);
                }}
                onRepair={() => {
                    void repairManagedRuntime();
                }}
            />
        );
    }

    return <>{children}</>;
}
