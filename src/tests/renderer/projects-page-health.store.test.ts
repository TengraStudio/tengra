import { beforeEach, describe, expect, it } from 'vitest';

import {
    __resetProjectsPageHealthForTests,
    getProjectsPageHealthSnapshot,
    recordProjectsPageHealthEvent,
} from '@/store/projects-page-health.store';

describe('projects-page-health.store', () => {
    beforeEach(() => {
        __resetProjectsPageHealthForTests();
    });

    it('records successful mount persistence', () => {
        recordProjectsPageHealthEvent({
            channel: 'workspace.persistMounts',
            status: 'success',
            durationMs: 120,
        });

        const snapshot = getProjectsPageHealthSnapshot();
        expect(snapshot.metrics.totalCalls).toBe(1);
        expect(snapshot.metrics.totalFailures).toBe(0);
        expect(snapshot.status).toBe('healthy');
    });

    it('tracks validation failures as degraded health', () => {
        recordProjectsPageHealthEvent({
            channel: 'workspace.addMount',
            status: 'validation-failure',
            errorCode: 'WORKSPACE_MOUNT_VALIDATION_ERROR',
        });

        const snapshot = getProjectsPageHealthSnapshot();
        expect(snapshot.metrics.validationFailures).toBe(1);
        expect(snapshot.metrics.lastErrorCode).toBe('WORKSPACE_MOUNT_VALIDATION_ERROR');
        expect(snapshot.status).toBe('degraded');
    });

    it('marks budget overrun for slow test connection path', () => {
        recordProjectsPageHealthEvent({
            channel: 'workspace.testConnection',
            status: 'success',
            durationMs: 3000,
        });

        const snapshot = getProjectsPageHealthSnapshot();
        expect(snapshot.metrics.budgetExceeded).toBe(1);
        expect(snapshot.metrics.channels['workspace.testConnection'].budgetExceeded).toBe(1);
        expect(snapshot.status).toBe('degraded');
    });
});
