/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { RuntimeManifestService } from '@main/services/system/runtime-manifest.service';
import { beforeEach, describe, expect, it } from 'vitest';

const VALID_MANIFEST = {
    schemaVersion: 1,
    releaseTag: 'runtime-v1.2.3',
    generatedAt: '2026-03-11T00:00:00.000Z',
    components: [
        {
            id: 'tengra-db-service',
            displayName: 'Tengra DB Service',
            version: '1.2.3',
            kind: 'service',
            source: 'managed',
            requirement: 'required',
            targets: [
                {
                    platform: 'win32',
                    arch: 'x64',
                    assetName: 'tengra-db-service-win32-x64.zip',
                    downloadUrl: 'https://example.com/tengra-db-service-win32-x64.zip',
                    archiveFormat: 'zip',
                    sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                    executableRelativePath: 'tengra-db-service.exe',
                    installSubdirectory: 'bin',
                },
                {
                    platform: 'darwin',
                    arch: 'arm64',
                    assetName: 'tengra-db-service-darwin-arm64.tar.gz',
                    downloadUrl: 'https://example.com/tengra-db-service-darwin-arm64.tar.gz',
                    archiveFormat: 'tar.gz',
                    sha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                    executableRelativePath: 'tengra-db-service',
                    installSubdirectory: 'bin',
                },
            ],
        },
        {
            id: 'ollama',
            displayName: 'Ollama',
            version: '0.6.0',
            kind: 'runtime',
            source: 'external',
            requirement: 'user-managed',
            installUrl: 'https://ollama.com/download',
            targets: [],
        },
    ],
};

describe('RuntimeManifestService', () => {
    let service: RuntimeManifestService;

    beforeEach(() => {
        service = new RuntimeManifestService();
    });

    it('parses a valid runtime manifest', () => {
        const manifest = service.parseManifest(VALID_MANIFEST);

        expect(manifest.releaseTag).toBe('runtime-v1.2.3');
        expect(manifest.components).toHaveLength(7);
        expect(manifest.components.map(component => component.id)).toEqual([
            'ollama',
            'sd-cpp',
            'ghostty',
            'alacritty',
            'warp',
            'kitty',
            'tengra-db-service',
        ]);
    });

    it('normalizes supported architecture aliases', () => {
        expect(service.normalizeArch('amd64')).toBe('x64');
        expect(service.normalizeArch('aarch64')).toBe('arm64');
        expect(service.normalizeArch('ia32')).toBeNull();
    });

    it('selects the matching target for an environment', () => {
        const manifest = service.parseManifest(VALID_MANIFEST);
        const component = manifest.components.find(entry => entry.id === 'tengra-db-service');
        const target = component ? service.selectTarget(component, {
            platform: 'darwin',
            arch: 'arm64',
        }) : null;

        expect(target?.assetName).toBe('tengra-db-service-darwin-arm64.tar.gz');
    });

    it('rejects unsafe executable paths', () => {
        const invalidManifest = {
            ...VALID_MANIFEST,
            components: [
                {
                    ...VALID_MANIFEST.components[0],
                    targets: [
                        {
                            ...VALID_MANIFEST.components[0].targets[0],
                            executableRelativePath: '../escape.exe',
                        },
                    ],
                },
            ],
        };

        expect(() => service.parseManifest(invalidManifest)).toThrow('safe relative path');
    });
});
