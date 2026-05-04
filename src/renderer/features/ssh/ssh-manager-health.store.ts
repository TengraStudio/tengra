/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

type SSHManagerHealthStatus = 'success' | 'failure' | 'validation-failure';
type SSHManagerHealthChannel =
    | 'ssh.loadConnections'
    | 'ssh.connect'
    | 'ssh.testProfile'
    | 'ssh.deleteProfile';

interface SSHManagerHealthEvent {
    channel: SSHManagerHealthChannel;
    status: SSHManagerHealthStatus;
    durationMs?: number;
    errorCode?: string;
}

interface SSHManagerHealthMetrics {
    totalCalls: number;
    totalFailures: number;
    validationFailures: number;
    budgetExceeded: number;
    lastErrorCode?: string;
    channels: Record<SSHManagerHealthChannel, {
        calls: number;
        failures: number;
        budgetExceeded: number;
    }>;
}

interface SSHManagerHealthSnapshot {
    status: 'healthy' | 'degraded' | 'error';
    uiState: 'ready' | 'loading' | 'failure';
    metrics: SSHManagerHealthMetrics;
}

const createInitialMetrics = (): SSHManagerHealthMetrics => ({
    totalCalls: 0,
    totalFailures: 0,
    validationFailures: 0,
    budgetExceeded: 0,
    channels: {
        'ssh.loadConnections': { calls: 0, failures: 0, budgetExceeded: 0 },
        'ssh.connect': { calls: 0, failures: 0, budgetExceeded: 0 },
        'ssh.testProfile': { calls: 0, failures: 0, budgetExceeded: 0 },
        'ssh.deleteProfile': { calls: 0, failures: 0, budgetExceeded: 0 },
    },
});

let state: SSHManagerHealthSnapshot = {
    status: 'healthy',
    uiState: 'ready',
    metrics: createInitialMetrics(),
};

export function recordSSHManagerHealthEvent(event: SSHManagerHealthEvent): void {
    state.metrics.totalCalls++;
    
    const channelMetrics = state.metrics.channels[event.channel];
    if (channelMetrics) {
        channelMetrics.calls++;
    }

    if (event.status !== 'success') {
        state.metrics.totalFailures++;
        state.status = 'degraded';
        state.uiState = 'failure';
        state.metrics.lastErrorCode = event.errorCode;
        
        if (channelMetrics) {
            channelMetrics.failures++;
        }

        if (event.status === 'validation-failure') {
            state.metrics.validationFailures++;
        }
    }

    // Budget check (e.g., connect shouldn't take > 1s)
    if (event.durationMs && event.durationMs > 1000) {
        state.metrics.budgetExceeded++;
        if (channelMetrics) {
            channelMetrics.budgetExceeded++;
        }
    }
}

export function getSSHManagerHealthSnapshot(): SSHManagerHealthSnapshot {
    return state;
}

export function __resetSSHManagerHealthForTests(): void {
    state = {
        status: 'healthy',
        uiState: 'ready',
        metrics: createInitialMetrics(),
    };
}
