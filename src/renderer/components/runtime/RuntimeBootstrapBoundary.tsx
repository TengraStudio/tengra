/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
