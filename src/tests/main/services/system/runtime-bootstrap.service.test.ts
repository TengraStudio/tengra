import { RuntimeBootstrapService } from '@main/services/system/runtime-bootstrap.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeMocks = vi.hoisted(() => ({
    existsSync: vi.fn((targetPath: string) => targetPath.endsWith('cliproxy-embed.exe')),
    mkdirSync: vi.fn(),
    getPath: vi.fn().mockReturnValue('/mock/appData'),
}));

vi.mock('fs', () => ({
    existsSync: runtimeMocks.existsSync,
    mkdirSync: runtimeMocks.mkdirSync,
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
} as const;

describe('RuntimeBootstrapService', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        runtimeMocks.existsSync.mockImplementation((targetPath: string) => targetPath.endsWith('cliproxy-embed.exe'));
        runtimeMocks.getPath.mockReturnValue('/mock/appData');
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
            external: 1,
            unsupported: 1,
        });

        expect(plan.entries[0]).toMatchObject({
            componentId: 'cliproxy-embed',
            status: 'ready',
            reason: 'file-present',
            installPath: '/mock/appData/Tengra/runtime/bin/cliproxy-embed.exe',
        });
        expect(plan.entries[1]).toMatchObject({
            componentId: 'llama-server',
            status: 'install',
            reason: 'missing-file',
            installPath: '/mock/appData/Tengra/runtime/bin/llama-server.exe',
        });
        expect(plan.entries[2]).toMatchObject({
            componentId: 'ollama',
            status: 'external',
            reason: 'external-dependency',
            installUrl: 'https://ollama.com/download',
        });
        expect(plan.entries[3]).toMatchObject({
            componentId: 'tengra-memory-service',
            status: 'unsupported',
            reason: 'unsupported-platform',
        });
    });
});
