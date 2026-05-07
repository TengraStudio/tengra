/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ExtensionService } from '@main/services/extension/extension.service';
import { SettingsService } from '@main/services/system/settings.service';
import { RuntimeValue } from '@shared/types/common';
import { ExtensionContext, ExtensionManifest } from '@shared/types/extension';
import { createExtensionLogger, createExtensionState } from '@shared/utils/extension.util';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    app: {
        getPath: vi.fn(() => 'C:\\Users\\agnes\\AppData\\Roaming\\Tengra'),
    },
    ipcMain: {
        handle: vi.fn(),
        removeHandler: vi.fn(),
    },
}));

interface ExtensionServiceInternals {
    buildManifestFromPackageJson: (packageJson: Record<string, RuntimeValue>) => Partial<ExtensionManifest> | null;
    createSandboxRequire: (extensionId: string) => (moduleName: string) => RuntimeValue;
    createConfigAccessor: (extensionId: string) => ExtensionContext['configuration'];
    createCommandAccessor: (
        extensionId: string,
        context: ExtensionContext
    ) => {
        registerCommand(commandId: string, handler: (...args: RuntimeValue[]) => RuntimeValue | Promise<RuntimeValue>): { dispose: () => void };
        executeCommand<T extends RuntimeValue = RuntimeValue>(commandId: string, ...args: RuntimeValue[]): Promise<T>;
        listCommands(): string[];
    };
}

function getExtensionServiceInternals(service: ExtensionService): ExtensionServiceInternals {
    const buildManifestFromPackageJson = Reflect.get(service, 'buildManifestFromPackageJson');
    const createSandboxRequire = Reflect.get(service, 'createSandboxRequire');
    const createConfigAccessor = Reflect.get(service, 'createConfigAccessor');
    const createCommandAccessor = Reflect.get(service, 'createCommandAccessor');
    if (
        typeof buildManifestFromPackageJson !== 'function' ||
        typeof createSandboxRequire !== 'function' ||
        typeof createConfigAccessor !== 'function' ||
        typeof createCommandAccessor !== 'function'
    ) {
        throw new Error('ExtensionService internals are unavailable for tests');
    }
    return {
        buildManifestFromPackageJson:
            buildManifestFromPackageJson.bind(service) as ExtensionServiceInternals['buildManifestFromPackageJson'],
        createSandboxRequire: createSandboxRequire.bind(service) as ExtensionServiceInternals['createSandboxRequire'],
        createConfigAccessor: createConfigAccessor.bind(service) as ExtensionServiceInternals['createConfigAccessor'],
        createCommandAccessor: createCommandAccessor.bind(service) as ExtensionServiceInternals['createCommandAccessor'],
    };
}

describe('ExtensionService manifest normalization', () => {
    let service: ExtensionService;

    beforeEach(() => {
        const settingsServiceMock: Pick<SettingsService, 'getSettings' | 'saveSettings'> = {
            getSettings: vi.fn().mockReturnValue({}),
            saveSettings: vi.fn().mockResolvedValue(undefined),
        };
        service = new ExtensionService(settingsServiceMock as SettingsService);
    });

    it('merges missing tengra manifest fields from package.json', () => {
        const packageJson = {
            name: 'job-finder-plugin',
            version: '1.0.0',
            description: 'Job Search and CV Analysis Plugin for Tengra',
            main: './dist/extension.js',
            license: 'MIT',
            author: {
                name: 'TengraStudio',
            },
            tengra: {
                id: 'tengrastudio.job-finder',
                ui: 'src/ui/JobFinderView.tsx',
                activationEvents: [{ type: 'onStartup' }],
            },
        };

        const internals = getExtensionServiceInternals(service);
        const manifest = internals.buildManifestFromPackageJson(packageJson);

        expect(manifest).not.toBeNull();
        expect(manifest).toMatchObject({
            id: 'tengrastudio.job-finder',
            name: 'job-finder-plugin',
            version: '1.0.0',
            description: 'Job Search and CV Analysis Plugin for Tengra',
            main: './dist/extension.js',
            license: 'MIT',
            author: { name: 'TengraStudio' },
            category: 'other',
            keywords: [],
        });
    });

    it('supports marketplace payloads that carry manifest under "manifest"', () => {
        const packageJson = {
            id: 'tengrastudio.job-finder',
            name: 'Job Finder',
            version: '1.0.0',
            description: 'AI-powered Job Search and CV Analysis plugin for Tengra',
            main: './dist/extension.js',
            license: 'MIT',
            author: 'TengraStudio',
            manifest: {
                id: 'tengrastudio.job-finder',
                ui: 'src/ui/JobFinderView.tsx',
            },
        };

        const internals = getExtensionServiceInternals(service);
        const manifest = internals.buildManifestFromPackageJson(packageJson);

        expect(manifest).not.toBeNull();
        expect(manifest).toMatchObject({
            id: 'tengrastudio.job-finder',
            name: 'Job Finder',
            version: '1.0.0',
            description: 'AI-powered Job Search and CV Analysis plugin for Tengra',
            main: './dist/extension.js',
            license: 'MIT',
            author: { name: 'TengraStudio' },
        });
    });

    it('provides a controlled logger require bridge in sandboxed modules', () => {
        const internals = getExtensionServiceInternals(service);
        const sandboxRequire = internals.createSandboxRequire('tengrastudio.job-finder');

        const resolvedLoggerModule = sandboxRequire('@main/logging/logger') as {
            appLogger?: {
                info: (...args: RuntimeValue[]) => void;
            };
        };

        expect(typeof resolvedLoggerModule).toBe('object');
        expect(typeof resolvedLoggerModule.appLogger?.info).toBe('function');
        expect(() => sandboxRequire('fs')).toThrow('Unsupported extension module import');
    });

    it('creates a command bridge for extensions via context.commands', async () => {
        const context: ExtensionContext = {
            extensionId: 'tengrastudio.job-finder-test',
            extensionPath: 'C:\\temp\\job-finder',
            globalState: createExtensionState('job-finder-global'),
            workspaceState: createExtensionState('job-finder-workspace'),
            subscriptions: [],
            logger: createExtensionLogger('tengrastudio.job-finder-test'),
            configuration: {
                get<T>(_section: string, defaultValue?: T): T | undefined {
                    return defaultValue;
                },
                async update(_section: string, _value: RuntimeValue): Promise<void> {
                    return;
                },
                has(_section: string): boolean {
                    return false;
                },
                onDidChange: () => ({ dispose: () => undefined }),
            },
        };
        const internals = getExtensionServiceInternals(service);
        const commands = internals.createCommandAccessor('tengrastudio.job-finder-test', context);
        const disposable = commands.registerCommand('job-finder.search', async () => ({ success: true }));
        expect(commands.listCommands()).toEqual(['job-finder.search']);
        await expect(commands.executeCommand('job-finder.search')).resolves.toEqual({ success: true });
        expect(context.subscriptions).toHaveLength(1);

        disposable.dispose();
        expect(commands.listCommands()).toHaveLength(0);
        await expect(commands.executeCommand('job-finder.search')).rejects.toThrow('Extension command not found');
    });

    it('reads extension configuration from service state and supports listener disposal', () => {
        const internals = getExtensionServiceInternals(service);
        const extensionId = 'tengrastudio.job-finder-test';
        const state = Reflect.get(service, 'state') as {
            extensionConfigs: Map<string, Record<string, RuntimeValue>>;
            configListeners: Map<string, Set<(event: { affectsConfiguration: (section: string) => boolean }) => void>>;
        };

        state.extensionConfigs.set(extensionId, {
            'jobFinder.region': 'eu-central',
            'jobFinder.maxResults': 25,
        });

        const configAccessor = internals.createConfigAccessor(extensionId);
        expect(configAccessor.get('jobFinder.region')).toBe('eu-central');
        expect(configAccessor.get('jobFinder.maxResults')).toBe(25);
        expect(configAccessor.get('jobFinder.missing', 'fallback')).toBe('fallback');
        expect(configAccessor.has('jobFinder.region')).toBe(true);
        expect(configAccessor.has('jobFinder.missing')).toBe(false);

        const listener = vi.fn();
        const disposable = configAccessor.onDidChange(listener);
        expect(state.configListeners.get(extensionId)?.size).toBe(1);
        disposable.dispose();
        expect(state.configListeners.get(extensionId)).toBeUndefined();
    });
});

