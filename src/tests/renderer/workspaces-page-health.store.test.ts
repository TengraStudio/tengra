import { beforeEach, describe, expect, it } from 'vitest';

import {
    __resetWorkspacesPageHealthForTests,
    getWorkspacesPageHealthSnapshot,
    recordWorkspacesPageHealthEvent,
} from '@/store/workspaces-page-health.store';

describe('workspaces-page-health.store', () => {
    beforeEach(() => {
        __resetWorkspacesPageHealthForTests();
    });

    it('records successful mount persistence', () => {
        recordWorkspacesPageHealthEvent({
            channel: 'workspace.persistMounts',
            status: 'success',
            durationMs: 120,
        });

        const snapshot = getWorkspacesPageHealthSnapshot();
        expect(snapshot.metrics.totalCalls).toBe(1);
        expect(snapshot.metrics.totalFailures).toBe(0);
        expect(snapshot.status).toBe('healthy');
    });

    it('tracks validation failures as degraded health', () => {
        recordWorkspacesPageHealthEvent({
            channel: 'workspace.addMount',
            status: 'validation-failure',
            errorCode: 'WORKSPACE_MOUNT_VALIDATION_ERROR',
        });

        const snapshot = getWorkspacesPageHealthSnapshot();
        expect(snapshot.metrics.validationFailures).toBe(1);
        expect(snapshot.metrics.lastErrorCode).toBe('WORKSPACE_MOUNT_VALIDATION_ERROR');
        expect(snapshot.status).toBe('degraded');
    });

    it('marks budget overrun for slow test connection path', () => {
        recordWorkspacesPageHealthEvent({
            channel: 'workspace.testConnection',
            status: 'success',
            durationMs: 3000,
        });

        const snapshot = getWorkspacesPageHealthSnapshot();
        expect(snapshot.metrics.budgetExceeded).toBe(1);
        expect(snapshot.metrics.channels['workspace.testConnection'].budgetExceeded).toBe(1);
        expect(snapshot.status).toBe('degraded');
    });
});
