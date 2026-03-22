import { RuntimeBootstrapService } from '@main/services/system/runtime-bootstrap.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeMocks = vi.hoisted(() => ({
    existsSync: vi.fn((targetPath: string) => targetPath.endsWith('cliproxy-embed.exe')),
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
            id: 'cliproxy-embed',
            displayName: 'Embedded Proxy',
            version: '2.0.0',
            kind: 'service',
            source: 'managed',
            requirement: 'required',
            targets: [
                {
                    platform: 'win32',
                    arch: 'x64',
                    assetName: 'cliproxy-embed-win32-x64.zip',
                    downloadUrl: 'https://example.com/cliproxy-embed-win32-x64.zip',
                    archiveFormat: 'zip',
                    sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                    executableRelativePath: 'cliproxy-embed.exe',
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
                    platform: 'win32',
                    arch: 'x64',
                    assetName: 'llama-server-win32-x64.zip',
                    downloadUrl: 'https://example.com/llama-server-win32-x64.zip',
                    archiveFormat: 'zip',
                    sha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                    executableRelativePath: 'llama-server.exe',
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
                    platform: 'darwin',
                    arch: 'arm64',
                    assetName: 'tengra-memory-service-darwin-arm64.tar.gz',
                    downloadUrl: 'https://example.com/tengra-memory-service-darwin-arm64.tar.gz',
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
        runtimeMocks.existsSync.mockImplementation((targetPath: string) => targetPath.endsWith('cliproxy-embed.exe'));
        runtimeMocks.getPath.mockReturnValue('/mock/appData');
        runtimeMocks.access.mockImplementation(async (targetPath: string) => {
            if (targetPath.includes('llama-server')) {
                throw new Error('missing');
            }
        });
        runtimeMocks.readFile.mockResolvedValue('');
        vi.stubGlobal('fetch', runtimeMocks.fetch);
    });

    it('builds a platform-aware runtime install plan', () => {
        const service = new RuntimeBootstrapService();
        const plan = service.buildInstallPlan(RUNTIME_MANIFEST, {
            platform: 'win32',
            arch: 'x64',
        });

        expect(plan.manifestVersion).toBe('runtime-v2.0.0');
        expect(plan.summary).toEqual({
            ready: 1,
            install: 1,
            external: 6,
            unsupported: 1,
        });

        const cliproxyEntry = plan.entries.find(entry => entry.componentId === 'cliproxy-embed');
        const llamaEntry = plan.entries.find(entry => entry.componentId === 'llama-server');
        const ollamaEntry = plan.entries.find(entry => entry.componentId === 'ollama');
        const memoryEntry = plan.entries.find(entry => entry.componentId === 'tengra-memory-service');

        expect(cliproxyEntry).toMatchObject({
            componentId: 'cliproxy-embed',
            status: 'ready',
            reason: 'file-present',
            installPath: '/mock/appData/Tengra/runtime/bin/cliproxy-embed.exe',
        });
        expect(llamaEntry).toMatchObject({
            componentId: 'llama-server',
            status: 'install',
            reason: 'missing-file',
            installPath: '/mock/appData/Tengra/runtime/bin/llama-server.exe',
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
            installRequired: 1,
            failed: 0,
            external: 6,
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
                                platform: 'win32',
                                arch: 'x64',
                                assetName: 'llama-server-win32-x64.exe',
                                downloadUrl: 'https://github.com/TengraStudio/tengra/releases/download/v4/llama-server-win32-x64.exe',
                                archiveFormat: 'raw',
                                sha256: 'ee8a920cfb4f37eaac14068653ef293301fd7f3334c15552afc662491218f5db',
                                executableRelativePath: 'llama-server.exe',
                                installSubdirectory: 'bin',
                            },
                        ],
                    },
                ],
            }),
        });
        runtimeMocks.fetch.mockResolvedValueOnce({
            ok: true,
            arrayBuffer: async () => Uint8Array.from(Buffer.from('runtime-binary')).buffer,
        });

        const service = new RuntimeBootstrapService();
        const result = await service.ensureManagedRuntime(
            'https://github.com/TengraStudio/tengra/releases/latest/download/runtime-manifest.json'
        );

        expect(result.summary.installed).toBe(1);
        expect(result.summary.installRequired).toBe(0);
        expect(result.summary.blockingFailures).toBe(0);
        expect(runtimeMocks.writeFile).toHaveBeenCalledWith(
            '/mock/appData/Tengra/runtime/downloads/llama-server-win32-x64.exe',
            expect.any(Buffer)
        );
        expect(runtimeMocks.copyFile).toHaveBeenCalledWith(
            '/mock/appData/Tengra/runtime/downloads/llama-server-win32-x64.exe',
            '/mock/appData/Tengra/runtime/bin/llama-server.exe'
        );
    });

    it('falls back to the cached runtime manifest when network fetch fails', async () => {
        runtimeMocks.existsSync.mockImplementation((targetPath: string) =>
            targetPath.endsWith('cliproxy-embed.exe')
        );
        runtimeMocks.fetch.mockRejectedValueOnce(new Error('network down'));
        runtimeMocks.readFile.mockResolvedValue(
            JSON.stringify({
                schemaVersion: 1,
                releaseTag: 'runtime-v4.1.0',
                generatedAt: '2026-03-11T00:00:00.000Z',
                components: [
                    {
                        id: 'cliproxy-embed',
                        displayName: 'Embedded Proxy',
                        version: '4.1.0',
                        kind: 'service',
                        source: 'managed',
                        requirement: 'required',
                        targets: [
                            {
                                platform: 'win32',
                                arch: 'x64',
                                assetName: 'cliproxy-embed-win32-x64.zip',
                                downloadUrl:
                                    'https://github.com/TengraStudio/tengra/releases/download/v4/cliproxy-embed-win32-x64.zip',
                                archiveFormat: 'zip',
                                sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                                executableRelativePath: 'cliproxy-embed.exe',
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
            '/mock/appData/Tengra/runtime/manifests/runtime-manifest.json',
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
        expect(result.entries.every(entry => entry.status === 'external')).toBe(true);
        expect(result.summary).toEqual({
            ready: 0,
            installed: 0,
            installRequired: 0,
            failed: 0,
            external: 6,
            unsupported: 0,
            blockingFailures: 0,
        });
    });
});
