/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import path from 'path';

import { MarketplaceService } from '@main/services/external/marketplace.service';
import { SettingsService } from '@main/services/system/settings.service';
import { MarketplaceItem } from '@shared/types/marketplace';
import fs from 'fs-extra';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockedUserDataPath = 'C:\\Users\\agnes\\AppData\\Roaming\\Tengra';

vi.mock('electron', () => ({
    app: {
        getPath: vi.fn(() => mockedUserDataPath),
    },
}));

describe('MarketplaceService MCP installed-state mapping', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('reads installed MCP versions from configured user servers', () => {
        const settingsServiceMock: Pick<SettingsService, 'getSettings'> = {
            getSettings: vi.fn().mockReturnValue({
                mcpUserServers: [
                    { id: 'tengra.alpha', name: 'Alpha MCP', version: '1.2.3' },
                    { id: 'tengra.beta', name: 'Beta MCP' },
                ],
            }),
        };
        const service = new MarketplaceService({
            settingsService: settingsServiceMock as SettingsService
        });
        const readInstalledMcpVersionsFromSettings = Reflect.get(
            service,
            'readInstalledMcpVersionsFromSettings'
        ) as (() => Map<string, string>);
        const boundReadInstalledMcpVersionsFromSettings =
            readInstalledMcpVersionsFromSettings.bind(service) as () => Map<string, string>;

        const versions = boundReadInstalledMcpVersionsFromSettings();

        expect(versions.get('tengra.alpha')).toBe('1.2.3');
        expect(versions.get('alpha mcp')).toBe('1.2.3');
        expect(versions.get('tengra.beta')).toBe('0.0.0');
        expect(versions.get('beta mcp')).toBe('0.0.0');
    });

    it('annotates installed items with case-insensitive IDs', () => {
        const service = new MarketplaceService({});
        const annotateInstalledItems = Reflect.get(
            service,
            'annotateInstalledItems'
        ) as (<T extends MarketplaceItem>(items: T[], installedById: Map<string, string>) => T[]);
        const boundAnnotateInstalledItems =
            annotateInstalledItems.bind(service) as <T extends MarketplaceItem>(items: T[], installedById: Map<string, string>) => T[];
        const installedById = new Map<string, string>([['tengra.alpha', '2.0.0']]);
        const items: MarketplaceItem[] = [{
            id: 'TENGRA.ALPHA',
            name: 'Alpha',
            description: 'Alpha plugin',
            author: 'Tengra',
            version: '1.0.0',
            downloadUrl: 'https://example.com/alpha.json',
            itemType: 'mcp',
        }];

        const annotated = boundAnnotateInstalledItems(items, installedById);

        expect(annotated[0]?.installed).toBe(true);
        expect(annotated[0]?.installedVersion).toBe('2.0.0');
    });

    it('reads installed extension versions from extension package manifests', async () => {
        const service = new MarketplaceService({});
        const extensionDirectory = 'tengrastudio.job-finder';
        const extensionRoot = path.join(mockedUserDataPath, 'extensions');
        const packageJsonPath = path.join(extensionRoot, extensionDirectory, 'package.json');

        vi.spyOn(fs, 'readdir').mockResolvedValue([extensionDirectory] as never);
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        vi.spyOn(fs, 'pathExists').mockImplementation(candidatePath =>
            Promise.resolve(String(candidatePath) === packageJsonPath)
        );
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        vi.spyOn(fs, 'readJson').mockImplementation(candidatePath => {
            if (String(candidatePath) !== packageJsonPath) {
                return Promise.reject(new Error('Unexpected extension package lookup'));
            }
            return Promise.resolve({
                id: 'tengrastudio.job-finder',
                name: 'job-finder-plugin',
                version: '1.1.0',
                tengra: {
                    id: 'tengrastudio.job-finder',
                },
            });
        });

        const readInstalledExtensionVersions = Reflect.get(
            service,
            'readInstalledExtensionVersions'
        ) as (() => Promise<Map<string, string>>);
        const boundReadInstalledExtensionVersions =
            readInstalledExtensionVersions.bind(service) as () => Promise<Map<string, string>>;

        const versions = await boundReadInstalledExtensionVersions();

        expect(versions.get('tengrastudio.job-finder')).toBe('1.1.0');
        expect(versions.get('job-finder-plugin')).toBe('1.1.0');
        expect(versions.get('TENGRASTUDIO.JOB-FINDER'.toLowerCase())).toBe('1.1.0');
    });
});

