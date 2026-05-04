/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { RuntimeBootstrapExecutionResult } from '@shared/types/system/runtime-manifest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    __resetRuntimeBootstrapStoreForTests,
    getRuntimeBootstrapSnapshot,
    hasBlockingRuntimeIssue,
    loadRuntimeBootstrapStatus,
    repairManagedRuntime,
} from '@/system/store/runtime-bootstrap.store';

const READY_STATUS: RuntimeBootstrapExecutionResult = {
    manifestVersion: 'runtime-v1',
    environment: {
        platform: 'win32',
        arch: 'x64',
    },
        entries: [
            {
            componentId: 'tengra-proxy',
            displayName: 'Embedded Proxy',
            version: '1.0.0',
            status: 'ready',
            requirement: 'required',
            source: 'managed',
            installPath: '/runtime/bin/tengra-proxy.exe',
        },
    ],
    summary: {
        ready: 1,
        installed: 0,
        installRequired: 0,
        failed: 0,
        external: 0,
        unsupported: 0,
        blockingFailures: 0,
    },
    health: {
        entries: [
            {
                componentId: 'tengra-proxy',
                displayName: 'Embedded Proxy',
                status: 'ready',
                source: 'managed',
                requirement: 'required',
                installPath: '/runtime/bin/tengra-proxy.exe',
                message: 'Runtime file is ready',
            },
        ],
        summary: {
            ready: 1,
            missing: 0,
            invalid: 0,
            external: 0,
            unsupported: 0,
        },
    },
};

const BLOCKING_STATUS: RuntimeBootstrapExecutionResult = {
    ...READY_STATUS,
    entries: [
        {
            componentId: 'tengra-db-service',
            displayName: 'DB Service',
            version: '1.0.0',
            status: 'install-required',
            requirement: 'required',
            source: 'managed',
            installPath: '/runtime/bin/tengra-db-service.exe',
            error: 'Managed runtime install required',
        },
    ],
    summary: {
        ready: 0,
        installed: 0,
        installRequired: 1,
        failed: 0,
        external: 0,
        unsupported: 0,
        blockingFailures: 1,
    },
    health: {
        entries: [
            {
                componentId: 'tengra-db-service',
                displayName: 'DB Service',
                status: 'missing',
                source: 'managed',
                requirement: 'required',
                installPath: '/runtime/bin/tengra-db-service.exe',
                message: 'Runtime file is missing',
            },
        ],
        summary: {
            ready: 0,
            missing: 1,
            invalid: 0,
            external: 0,
            unsupported: 0,
        },
    },
};

describe('runtime-bootstrap.store', () => {
    beforeEach(() => {
        __resetRuntimeBootstrapStoreForTests();
    });

    it('loads runtime status through the preload bridge', async () => {
        Object.defineProperty(window, 'electron', {
            value: {
                runtime: {
                    getStatus: vi.fn(async () => READY_STATUS),
                    refreshStatus: vi.fn(async () => READY_STATUS),
                    repair: vi.fn(async () => READY_STATUS),
                },
                log: {
                    error: vi.fn(),
                },
            },
            configurable: true,
        });

        await loadRuntimeBootstrapStatus();

        expect(getRuntimeBootstrapSnapshot().status).toEqual(READY_STATUS);
        expect(getRuntimeBootstrapSnapshot().isLoading).toBe(false);
    });

    it('updates store state after runtime repair', async () => {
        Object.defineProperty(window, 'electron', {
            value: {
                runtime: {
                    getStatus: vi.fn(async () => BLOCKING_STATUS),
                    refreshStatus: vi.fn(async () => BLOCKING_STATUS),
                    repair: vi.fn(async () => READY_STATUS),
                },
                log: {
                    error: vi.fn(),
                },
            },
            configurable: true,
        });

        await repairManagedRuntime();

        expect(getRuntimeBootstrapSnapshot().status).toEqual(READY_STATUS);
        expect(getRuntimeBootstrapSnapshot().isRepairing).toBe(false);
    });

    it('detects blocking managed runtime issues', () => {
        expect(hasBlockingRuntimeIssue(BLOCKING_STATUS)).toBe(true);
        expect(hasBlockingRuntimeIssue(READY_STATUS)).toBe(false);
    });
});
