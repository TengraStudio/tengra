/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { RuntimeHealthService } from '@main/services/system/runtime-health.service';
import { RuntimeBootstrapPlan } from '@shared/types/runtime-manifest';
import { describe, expect, it, vi } from 'vitest';

const runtimeHealthMocks = vi.hoisted(() => ({
    access: vi.fn(async (targetPath: string) => {
        if (targetPath.includes('missing')) {
            throw new Error('missing');
        }
    }),
}));

vi.mock('fs/promises', () => ({
    access: runtimeHealthMocks.access,
}));

vi.mock('fs', () => ({
    constants: {
        F_OK: 0,
        X_OK: 1,
    },
}));

const PLAN: RuntimeBootstrapPlan = {
    manifestVersion: 'runtime-v3',
    environment: {
        platform: 'win32',
        arch: 'x64',
    },
    entries: [
        {
            componentId: 'db',
            displayName: 'DB',
            version: '1',
            status: 'ready',
            source: 'managed',
            requirement: 'required',
            reason: 'file-present',
            installPath: '/runtime/bin/db.exe',
        },
        {
            componentId: 'missing',
            displayName: 'Missing',
            version: '1',
            status: 'install',
            source: 'managed',
            requirement: 'required',
            reason: 'missing-file',
            installPath: '/runtime/bin/missing.exe',
        },
        {
            componentId: 'ollama',
            displayName: 'Ollama',
            version: '1',
            status: 'external',
            source: 'external',
            requirement: 'user-managed',
            reason: 'external-dependency',
            installUrl: 'https://ollama.com/download',
        },
    ],
    summary: {
        ready: 1,
        install: 1,
        external: 1,
        unsupported: 0,
    },
};

class StubExternalRuntimeDependencyService {
    async assess(componentId: string): Promise<{
        detected: boolean;
        running: boolean;
        action: 'none' | 'install' | 'start';
        message: string;
        messageKey?: string;
    }> {
        if (componentId === 'ollama') {
            return {
                detected: false,
                running: false,
                action: 'install',
                message: 'Ollama is not installed',
                messageKey: 'images.runtimeHealth.ollama.notInstalled',
            };
        }

        return {
            detected: true,
            running: true,
            action: 'none',
            message: 'Ready',
        };
    }
}

describe('RuntimeHealthService', () => {
    it('classifies ready, missing, and external components', async () => {
        const service = new RuntimeHealthService(
            new StubExternalRuntimeDependencyService()
        );
        const report = await service.assessPlan(PLAN);

        expect(report.summary).toEqual({
            ready: 1,
            missing: 1,
            invalid: 0,
            external: 1,
            unsupported: 0,
        });
        expect(report.entries[0]?.status).toBe('ready');
        expect(report.entries[1]?.status).toBe('missing');
        expect(report.entries[2]?.status).toBe('external');
        expect(report.entries[2]).toMatchObject({
            detected: false,
            action: 'install',
            message: 'Ollama is not installed',
            messageKey: 'images.runtimeHealth.ollama.notInstalled',
            source: 'external',
        });
    });
});
