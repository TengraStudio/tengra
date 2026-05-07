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
    __resetSSHManagerHealthForTests,
    getSSHManagerHealthSnapshot,
    recordSSHManagerHealthEvent,
} from '@/store/ssh-manager-health.store';

describe('ssh-manager-health.store', () => {
    beforeEach(() => {
        __resetSSHManagerHealthForTests();
    });

    it('tracks successful connect events', () => {
        recordSSHManagerHealthEvent({
            channel: 'ssh.connect',
            status: 'success',
            durationMs: 120,
        });

        const snapshot = getSSHManagerHealthSnapshot();
        expect(snapshot.metrics.totalCalls).toBe(1);
        expect(snapshot.metrics.totalFailures).toBe(0);
        expect(snapshot.metrics.channels['ssh.connect'].calls).toBe(1);
        expect(snapshot.status).toBe('healthy');
    });

    it('tracks validation failures and switches to degraded', () => {
        recordSSHManagerHealthEvent({
            channel: 'ssh.testProfile',
            status: 'validation-failure',
            durationMs: 80,
            errorCode: 'SSH_MANAGER_VALIDATION_ERROR',
        });

        const snapshot = getSSHManagerHealthSnapshot();
        expect(snapshot.metrics.validationFailures).toBe(1);
        expect(snapshot.metrics.totalFailures).toBe(1);
        expect(snapshot.status).toBe('degraded');
        expect(snapshot.uiState).toBe('failure');
        expect(snapshot.metrics.lastErrorCode).toBe('SSH_MANAGER_VALIDATION_ERROR');
    });

    it('counts budget overruns', () => {
        recordSSHManagerHealthEvent({
            channel: 'ssh.connect',
            status: 'success',
            durationMs: 5000,
        });

        const snapshot = getSSHManagerHealthSnapshot();
        expect(snapshot.metrics.budgetExceeded).toBe(1);
        expect(snapshot.metrics.channels['ssh.connect'].budgetExceeded).toBe(1);
    });
});

