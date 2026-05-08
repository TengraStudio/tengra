/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as path from 'path';

import { RuntimeBootstrapService } from '@main/services/system/runtime-bootstrap.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockTerminalLogEntry {
    name: string;
    isFile: () => boolean;
}

const runtimeMocks = vi.hoisted(() => ({
    existsSync: vi.fn((targetPath: string) => targetPath.endsWith('tengra-proxy.exe')),
    mkdirSync: vi.fn(),
    getPath: vi.fn().mockReturnValue('/mock/appData'),
    access: vi.fn(async (targetPath: string) => {
        if (targetPath.includes('llama-server')) {
            throw new Error('missing');
        }
    }),
    mkdir: vi.fn(async () => undefined),
    readFile: vi.fn(async () => ''),
    writeFile: vi.fn(async () => undefined),
    copyFile: vi.fn(async () => undefined),
    chmod: vi.fn(async () => undefined),
    rm: vi.fn(async () => undefined),
    readdir: vi.fn<() => Promise<MockTerminalLogEntry[]>>(async () => []),
    stat: vi.fn<(targetPath: string) => Promise<{ mtimeMs: number }>>(async () => ({ mtimeMs: Date.now() })),
    unlink: vi.fn(async () => undefined),
    fetch: vi.fn(),
}));

vi.mock('fs', () => ({
    existsSync: runtimeMocks.existsSync,
    mkdirSync: runtimeMocks.mkdirSync,
}));

vi.mock('fs/promises', () => ({
    access: runtimeMocks.access,
    mkdir: runtimeMocks.mkdir,
    readFile: runtimeMocks.readFile,
    writeFile: runtimeMocks.writeFile,
    copyFile: runtimeMocks.copyFile,
    chmod: runtimeMocks.chmod,
    rm: runtimeMocks.rm,
    readdir: runtimeMocks.readdir,
    stat: runtimeMocks.stat,
    unlink: runtimeMocks.unlink,
}));

vi.mock('electron', () => ({
    app: {
        getPath: runtimeMocks.getPath,
    },
}));

const RUNTIME_MANIFEST = {
    schemaVersion: 1,
    releaseTag: 'runtime-v2.0.0',
    generatedAt: '2026-03-11T00:00:00.000Z',
    components: [
        {
            id: 'tengra-proxy',
            displayName: 'Embedded Proxy',
            version: '2.0.0',
            kind: 'service',
            source: 'managed',
            requirement: 'required',
            targets: [
                {
                    platform: process.platform,
                    arch: process.arch,
                    assetName: `tengra-proxy-${process.platform}-${process.arch}${process.platform === 'win32' ? '.zip' : '.tar.gz'}`,
                    downloadUrl: `https://example.com/tengra-proxy-${process.platform}-${process.arch}${process.platform === 'win32' ? '.zip' : '.tar.gz'}`,
                    archiveFormat: process.platform === 'win32' ? 'zip' : 'tar.gz',
                    sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                    executableRelativePath: process.platform === 'win32' ? 'tengra-proxy.exe' : 'tengra-proxy',
                    installSubdirectory: 'bin',
                },
            ],
        },
        {
            id: 'llama-server',
            displayName: 'Llama Server',
            version: '2.0.0',
            kind: 'runtime',
            source: 'managed',
            requirement: 'required',
            targets: [
                {
                    platform: process.platform,
                    arch: process.arch,
                    assetName: `llama-server-${process.platform}-${process.arch}${process.platform === 'win32' ? '.zip' : '.tar.gz'}`,
                    downloadUrl: `https://example.com/llama-server-${process.platform}-${process.arch}${process.platform === 'win32' ? '.zip' : '.tar.gz'}`,
                    archiveFormat: process.platform === 'win32' ? 'zip' : 'tar.gz',
                    sha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                    executableRelativePath: process.platform === 'win32' ? 'llama-server.exe' : 'llama-server',
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
        {
            id: 'tengra-memory-service',
            displayName: 'Tengra Memory Service',
            version: '2.0.0',
            kind: 'service',
            source: 'managed',
            requirement: 'optional',
            targets: [
                {
                    platform: process.platform === 'win32' ? 'darwin' : 'win32',
                    arch: process.arch === 'x64' ? 'arm64' : 'x64',
                    assetName: 'tengra-memory-service-unsupported.tar.gz',
                    downloadUrl: 'https://example.com/tengra-memory-service-unsupported.tar.gz',
                    archiveFormat: 'tar.gz',
                    sha256: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
                    executableRelativePath: 'tengra-memory-service',
                    installSubdirectory: 'bin',
                },
            ],
        },
    ],
};

describe('RuntimeBootstrapService', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        runtimeMocks.existsSync.mockImplementation((targetPath: string) => targetPath.endsWith(process.platform === 'win32' ? 'tengra-proxy.exe' : 'tengra-proxy'));
        runtimeMocks.getPath.mockReturnValue('/mock/appData');
        runtimeMocks.access.mockImplementation(async (targetPath: string) => {
            if (targetPath.includes('llama-server')) {
                throw new Error('missing');
            }
        });
        runtimeMocks.readFile.mockResolvedValue('');
        runtimeMocks.readdir.mockResolvedValue([]);
        runtimeMocks.stat.mockResolvedValue({ mtimeMs: Date.now() });
        vi.stubGlobal('fetch', runtimeMocks.fetch);
    });

    it('cleans stale electron caches, legacy service artifacts, and old terminal logs on initialize', async () => {
        runtimeMocks.fetch.mockResolvedValueOnce({
            ok: true,
            text: async () => JSON.stringify(RUNTIME_MANIFEST),
        });
        runtimeMocks.readdir.mockResolvedValue([
            {
                name: 'old-session.log',
                isFile: () => true,
            },
            {
                name: 'recent-session.log',
                isFile: () => true,
            },
        ]);
        runtimeMocks.stat.mockImplementation(async (targetPath: string) => ({
            mtimeMs: targetPath.includes('old-session.log')
                ? Date.now() - 8 * 24 * 60 * 60 * 1000
                : Date.now(),
        }));

        const service = new RuntimeBootstrapService();
        await service.initialize();
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(runtimeMocks.rm).toHaveBeenCalledWith(path.join('/mock/appData', 'blob_storage'), {
            force: true,
            recursive: true,
        });
        expect(runtimeMocks.rm).not.toHaveBeenCalledWith(path.join('/mock/appData', 'Shared Dictionary'), {
            force: true,
            recursive: true,
        });
        expect(runtimeMocks.rm).not.toHaveBeenCalledWith(path.join('/mock/appData', 'DIPS'), {
            force: true,
            recursive: true,
        });
        expect(runtimeMocks.rm).not.toHaveBeenCalledWith(path.join('/mock/appData', 'DIPS-wal'), {
            force: true,
            recursive: true,
        });
        expect(runtimeMocks.rm).toHaveBeenCalledWith(path.join('/mock/appData', 'services', 'token-service.log'), {
            force: true,
            recursive: true,
        });
        expect(runtimeMocks.unlink).toHaveBeenCalledWith(path.join('/mock/appData', 'terminal-logs', 'old-session.log'));
        expect(runtimeMocks.unlink).not.toHaveBeenCalledWith(path.join('/mock/appData', 'terminal-logs', 'recent-session.log'));
    });

    it('builds a platform-aware runtime install plan', () => {
        const service = new RuntimeBootstrapService();
        const plan = service.buildInstallPlan(RUNTIME_MANIFEST, {
            platform: process.platform === 'win32' ? 'darwin' : 'win32',
            arch: process.arch === 'x64' ? 'arm64' : 'x64',
        });

        expect(plan.manifestVersion).toBe('runtime-v2.0.0');
        expect(plan.summary).toEqual({
            ready: 1,
            install: 5,
            unsupported: 1,
            external: 2,
        });

        const proxyEntry = plan.entries.find(entry => entry.componentId === 'tengra-proxy');
        const llamaEntry = plan.entries.find(entry => entry.componentId === 'llama-server');
        const ollamaEntry = plan.entries.find(entry => entry.componentId === 'ollama');
        const memoryEntry = plan.entries.find(entry => entry.componentId === 'tengra-memory-service');

        expect(proxyEntry).toMatchObject({
            componentId: 'tengra-proxy',
            status: 'ready',
            reason: 'file-present',
            installPath: path.join('/mock/appData', 'runtime', 'managed', 'bin', process.platform === 'win32' ? 'tengra-proxy.exe' : 'tengra-proxy'),
        });
        expect(llamaEntry).toMatchObject({
            componentId: 'llama-server',
            status: 'install',
            reason: 'missing-file',
            installPath: path.join('/mock/appData', 'runtime', 'managed', 'bin', process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'),
        });
        expect(ollamaEntry).toMatchObject({
            componentId: 'ollama',
            status: 'external',
            reason: 'external-dependency',
            installUrl: 'https://ollama.com/download',
        });
        expect(memoryEntry).toMatchObject({
            componentId: 'tengra-memory-service',
            status: 'unsupported',
            reason: 'unsupported-platform',
        });
    });

    it('scans managed runtime without installing missing required components', async () => {
        runtimeMocks.fetch.mockResolvedValueOnce({
            ok: true,
            text: async () => JSON.stringify(RUNTIME_MANIFEST),
        });

        const service = new RuntimeBootstrapService();
        const result = await service.scanManagedRuntime(
            'https://github.com/TengraStudio/tengra/releases/latest/download/runtime-manifest.json'
        );

        expect(result.summary).toMatchObject({
            ready: 1,
            installed: 0,
            installRequired: 5,
            failed: 0,
            external: 2,
            unsupported: 1,
            blockingFailures: 1,
        });
        const llamaEntry = result.entries.find(entry => entry.componentId === 'llama-server');
        expect(llamaEntry).toMatchObject({
            componentId: 'llama-server',
            status: 'install-required',
            error: 'Managed runtime install required',
        });
        expect(runtimeMocks.copyFile).not.toHaveBeenCalled();
    });

    it('downloads and installs missing raw managed components from the runtime manifest', async () => {
        runtimeMocks.fetch.mockResolvedValueOnce({
            ok: true,
            text: async () => JSON.stringify({
                schemaVersion: 1,
                releaseTag: 'runtime-v4.0.0',
                generatedAt: '2026-03-11T00:00:00.000Z',
                components: [
                    {
                        id: 'llama-server',
                        displayName: 'Llama Server',
                        version: '4.0.0',
                        kind: 'runtime',
                        source: 'managed',
                        requirement: 'required',
                        targets: [
                            {
                                platform: process.platform,
                                arch: process.arch,
                                assetName: `llama-server-${process.platform}-${process.arch}${process.platform === 'win32' ? '.exe' : ''}`,
                                downloadUrl: `https://github.com/TengraStudio/tengra/releases/download/v4/llama-server-${process.platform}-${process.arch}${process.platform === 'win32' ? '.exe' : ''}`,
                                archiveFormat: 'raw',
                                sha256: 'ee8a920cfb4f37eaac14068653ef293301fd7f3334c15552afc662491218f5db',
                                executableRelativePath: process.platform === 'win32' ? 'llama-server.exe' : 'llama-server',
                                installSubdirectory: 'bin',
                            },
                        ],
                    },
                ],
            }),
        });
        runtimeMocks.fetch.mockResolvedValueOnce({
            ok: true,
            headers: { get: () => '10' },
            arrayBuffer: async () => Uint8Array.from(Buffer.from('runtime-binary')).buffer,
        });

        runtimeMocks.existsSync.mockImplementation((targetPath: string) => !targetPath.includes('llama-server'));
        const service = new RuntimeBootstrapService();
        const result = await service.ensureManagedRuntime(
            'https://github.com/TengraStudio/tengra/releases/latest/download/runtime-manifest.json'
        );

        expect(result.summary.installed).toBe(1);
        expect(result.summary.installRequired).toBe(0);
        expect(result.summary.blockingFailures).toBe(0);
        const downloadedPath = path.join('/mock/appData', 'runtime', 'cache', 'downloads', `llama-server-${process.platform}-${process.arch}${process.platform === 'win32' ? '.exe' : ''}`);
        const targetPath = path.join('/mock/appData', 'runtime', 'managed', 'bin', process.platform === 'win32' ? 'llama-server.exe' : 'llama-server');
        expect(runtimeMocks.writeFile).toHaveBeenCalledWith(downloadedPath, expect.any(Buffer));
        expect(runtimeMocks.copyFile).toHaveBeenCalledWith(downloadedPath, targetPath);
    });

    it('falls back to the cached runtime manifest when network fetch fails', async () => {
        runtimeMocks.existsSync.mockImplementation((targetPath: string) =>
            targetPath.endsWith(process.platform === 'win32' ? 'tengra-proxy.exe' : 'tengra-proxy')
        );
        runtimeMocks.fetch.mockRejectedValueOnce(new Error('network down'));
        runtimeMocks.readFile.mockResolvedValue(
            JSON.stringify({
                schemaVersion: 1,
                releaseTag: 'runtime-v4.1.0',
                generatedAt: '2026-03-11T00:00:00.000Z',
                components: [
                    {
                        id: 'tengra-proxy',
                        displayName: 'Embedded Proxy',
                        version: '4.1.0',
                        kind: 'service',
                        source: 'managed',
                        requirement: 'required',
                        targets: [
                            {
                                platform: process.platform,
                                arch: process.arch,
                                assetName: `tengra-proxy-${process.platform}-${process.arch}${process.platform === 'win32' ? '.zip' : '.tar.gz'}`,
                                downloadUrl:
                                    `https://github.com/TengraStudio/tengra/releases/download/v4/tengra-proxy-${process.platform}-${process.arch}${process.platform === 'win32' ? '.zip' : '.tar.gz'}`,
                                archiveFormat: process.platform === 'win32' ? 'zip' : 'tar.gz',
                                sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                                executableRelativePath: process.platform === 'win32' ? 'tengra-proxy.exe' : 'tengra-proxy',
                                installSubdirectory: 'bin',
                            },
                        ],
                    },
                ],
            })
        );

        const service = new RuntimeBootstrapService();
        const result = await service.ensureManagedRuntime(
            'https://github.com/TengraStudio/tengra/releases/latest/download/runtime-manifest.json'
        );

        expect(result.manifestVersion).toBe('runtime-v4.1.0');
        expect(result.summary.ready).toBe(1);
        expect(result.summary.installRequired).toBe(0);
        expect(runtimeMocks.readFile).toHaveBeenCalledWith(
            path.join('/mock/appData', 'runtime', 'cache', 'manifests', 'runtime-manifest.json'),
            'utf8'
        );
    });

    it('uses an empty manifest when the default runtime manifest is unavailable and no cache exists', async () => {
        runtimeMocks.fetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
        });
        runtimeMocks.readFile.mockRejectedValueOnce(new Error('cache missing'));

        const service = new RuntimeBootstrapService();
        const result = await service.scanManagedRuntime();

        expect(result.manifestVersion).toBe('runtime-unavailable');
        expect(result.entries).toHaveLength(6);
        expect(result.summary).toEqual({
            ready: 0,
            installed: 0,
            installRequired: 4,
            failed: 0,
            external: 2,
            unsupported: 0,
            blockingFailures: 0,
        });
    });
});

