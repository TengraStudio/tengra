/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { registerModelRegistryIpc } from '@main/ipc/model-registry';
import { IpcMainInvokeEvent } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ipcMainHandlers = new Map<string, (...args: TestValue[]) => Promise<TestValue>>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: TestValue[]) => TestValue | Promise<TestValue>) => {
            ipcMainHandlers.set(channel, async (...args: TestValue[]) => Promise.resolve(handler(...args)));
        }),
        setMaxListeners: vi.fn()
    }
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));


describe('Model Registry IPC Integration', () => {
    const mockModelProviders = [
        { id: 'openai', name: 'OpenAI', models: ['gpt-4', 'gpt-3.5-turbo'], isInstalled: true },
        { id: 'anthropic', name: 'Anthropic', models: ['claude-3'], isInstalled: false }
    ];

    const mockRemoteModels = [
        { id: 'openai', name: 'OpenAI', models: ['gpt-4', 'gpt-3.5-turbo'], isInstalled: true },
        { id: 'anthropic', name: 'Anthropic', models: ['claude-3'], isInstalled: false }
    ];

    const mockInstalledModels = [
        { id: 'openai', name: 'OpenAI', models: ['gpt-4', 'gpt-3.5-turbo'], isInstalled: true }
    ];

    const mockModelRegistryService = {
        getAllModels: vi.fn().mockResolvedValue(mockModelProviders),
        getRemoteModels: vi.fn().mockResolvedValue(mockRemoteModels),
        getInstalledModels: vi.fn().mockResolvedValue(mockInstalledModels)
    };

    beforeEach(() => {
        ipcMainHandlers.clear();
        vi.clearAllMocks();
    });

    describe('model registry handlers', () => {
        beforeEach(() => {
            registerModelRegistryIpc(mockModelRegistryService as never);
        });

        it('registers all model registry IPC handlers', () => {
            expect(ipcMainHandlers.has('model-registry:get-all')).toBe(true);
            expect(ipcMainHandlers.has('model-registry:getAllModels')).toBe(true);
            expect(ipcMainHandlers.has('model-registry:get-remote')).toBe(true);
            expect(ipcMainHandlers.has('model-registry:get-installed')).toBe(true);
        });

        it('retrieves all models using the preferred hyphenated channel', async () => {
            const handler = ipcMainHandlers.get('model-registry:get-all')!;
            const result = await handler({} as IpcMainInvokeEvent);

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(2);
            expect(result).toEqual(mockModelProviders);
            expect(mockModelRegistryService.getAllModels).toHaveBeenCalledTimes(1);
        });

        it('retrieves all models using the camelCase alias', async () => {
            const handler = ipcMainHandlers.get('model-registry:getAllModels')!;
            const result = await handler({} as IpcMainInvokeEvent);

            expect(Array.isArray(result)).toBe(true);
            expect(result).toEqual(mockModelProviders);
            expect(mockModelRegistryService.getAllModels).toHaveBeenCalledTimes(1);
        });

        it('retrieves remote models', async () => {
            const handler = ipcMainHandlers.get('model-registry:get-remote')!;
            const result = await handler({} as IpcMainInvokeEvent);

            expect(Array.isArray(result)).toBe(true);
            expect(result).toEqual(mockRemoteModels);
            expect(mockModelRegistryService.getRemoteModels).toHaveBeenCalledTimes(1);
        });

        it('retrieves installed models', async () => {
            const handler = ipcMainHandlers.get('model-registry:get-installed')!;
            const result = await handler({} as IpcMainInvokeEvent);

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect((result as Record<string, TestValue>[])[0].isInstalled).toBe(true);
            expect(mockModelRegistryService.getInstalledModels).toHaveBeenCalledTimes(1);
        });

        it('returns empty array on get-all error (safe handler)', async () => {
            mockModelRegistryService.getAllModels.mockRejectedValue(new Error('Network error'));

            const handler = ipcMainHandlers.get('model-registry:get-all')!;
            const result = await handler({} as IpcMainInvokeEvent);

            expect(result).toEqual([]);
            expect(mockModelRegistryService.getAllModels).toHaveBeenCalledTimes(1);
        });

        it('returns empty array on get-remote error (safe handler)', async () => {
            mockModelRegistryService.getRemoteModels.mockRejectedValue(new Error('Network error'));

            const handler = ipcMainHandlers.get('model-registry:get-remote')!;
            const result = await handler({} as IpcMainInvokeEvent);

            expect(result).toEqual([]);
            expect(mockModelRegistryService.getRemoteModels).toHaveBeenCalledTimes(1);
        });

        it('returns empty array on get-installed error (safe handler)', async () => {
            mockModelRegistryService.getInstalledModels.mockRejectedValue(new Error('Service error'));

            const handler = ipcMainHandlers.get('model-registry:get-installed')!;
            const result = await handler({} as IpcMainInvokeEvent);

            expect(result).toEqual([]);
            expect(mockModelRegistryService.getInstalledModels).toHaveBeenCalledTimes(1);
        });
    });

});

