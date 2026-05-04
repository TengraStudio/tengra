/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
    __resetWorkspacesPageHealthForTests,
    getWorkspacesPageHealthSnapshot,
    recordWorkspacesPageHealthEvent,
} from '@/features/workspace/store/workspaces-page-health.store';

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
