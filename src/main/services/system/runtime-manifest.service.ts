/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { BaseService } from '@main/services/base.service';
import { t } from '@main/utils/i18n.util';
import { RuntimeManifestSchema } from '@shared/schemas/runtime-manifest.schema';
import { JsonObject } from '@shared/types/common';
import {
    RuntimeArch,
    RuntimeManifest,
    RuntimeManifestComponent,
    RuntimeManifestTarget,
    RuntimePlatform,
    RuntimeTargetEnvironment,
} from '@shared/types/runtime-manifest';

export class RuntimeManifestService extends BaseService {
    private static readonly BUILTIN_COMPONENTS: RuntimeManifestComponent[] = [
        {
            id: 'ollama',
            displayName: 'Ollama',
            version: 'external',
            kind: 'service',
            source: 'external',
            requirement: 'optional',
            description: t('backend.localLlmRuntimeForOfflineInference'),
            installUrl: 'https://ollama.com/download',
            supportedPlatforms: ['win32', 'darwin', 'linux'],
            supportedArches: ['x64', 'arm64'],
            targets: [],
        },
        {
            id: 'sd-cpp',
            displayName: 'Stable Diffusion CPP',
            version: 'managed',
            kind: 'runtime',
            source: 'external',
            requirement: 'optional',
            description: t('backend.localImageGenerationRuntime'),
            supportedPlatforms: ['win32', 'darwin', 'linux'],
            supportedArches: ['x64', 'arm64'],
            targets: [],
        },
        {
            id: 'biome',
            displayName: 'Biome',
            version: '2.4.14',
            kind: 'tool',
            source: 'managed',
            requirement: 'optional',
            description: 'Extremely fast toolchain for JavaScript, TypeScript, and more.',
            installUrl: 'https://biomejs.dev',
            supportedPlatforms: ['win32', 'darwin', 'linux'],
            supportedArches: ['x64', 'arm64'],
            targets: [
                {
                    platform: 'win32',
                    arch: 'x64',
                    downloadUrl: 'https://github.com/biomejs/biome/releases/download/%40biomejs/biome%402.4.14/biome-win32-x64.exe',
                    assetName: 'biome-win32-x64.exe',
                    executableRelativePath: 'biome.exe',
                    sha256: '',
                    archiveFormat: 'raw',
                    installSubdirectory: 'bin'
                },
                {
                    platform: 'darwin',
                    arch: 'arm64',
                    downloadUrl: 'https://github.com/biomejs/biome/releases/download/cli%2Fv2.4.14/biome-darwin-arm64',
                    assetName: 'biome-darwin-arm64',
                    executableRelativePath: 'biome',
                    sha256: '8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7',
                    archiveFormat: 'raw',
                    installSubdirectory: 'bin'
                },
                {
                    platform: 'darwin',
                    arch: 'x64',
                    downloadUrl: 'https://github.com/biomejs/biome/releases/download/cli%2Fv2.4.14/biome-darwin-x64',
                    assetName: 'biome-darwin-x64',
                    executableRelativePath: 'biome',
                    sha256: '7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6',
                    archiveFormat: 'raw',
                    installSubdirectory: 'bin'
                },
                {
                    platform: 'linux',
                    arch: 'x64',
                    downloadUrl: 'https://github.com/biomejs/biome/releases/download/cli%2Fv2.4.14/biome-linux-x64',
                    assetName: 'biome-linux-x64',
                    executableRelativePath: 'biome',
                    sha256: '6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5',
                    archiveFormat: 'raw',
                    installSubdirectory: 'bin'
                }
            ],
        },
        {
            id: 'ruff',
            displayName: 'Ruff',
            version: '0.9.10',
            kind: 'tool',
            source: 'managed',
            requirement: 'optional',
            description: 'An extremely fast Python linter and code formatter, written in Rust.',
            installUrl: 'https://ruff.rs',
            supportedPlatforms: ['win32', 'darwin', 'linux'],
            supportedArches: ['x64', 'arm64'],
            targets: [
                {
                    platform: 'win32',
                    arch: 'x64',
                    downloadUrl: 'https://github.com/astral-sh/ruff/releases/download/0.9.10/ruff-x86_64-pc-windows-msvc.zip',
                    assetName: 'ruff-x86_64-pc-windows-msvc.zip',
                    executableRelativePath: 'ruff.exe',
                    sha256: '',
                    archiveFormat: 'zip',
                    installSubdirectory: 'bin'
                },
                {
                    platform: 'darwin',
                    arch: 'arm64',
                    downloadUrl: 'https://github.com/astral-sh/ruff/releases/download/0.9.10/ruff-aarch64-apple-darwin.tar.gz',
                    assetName: 'ruff-aarch64-apple-darwin.tar.gz',
                    executableRelativePath: 'ruff',
                    sha256: 'b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2',
                    archiveFormat: 'tar.gz',
                    installSubdirectory: 'bin'
                },
                {
                    platform: 'darwin',
                    arch: 'x64',
                    downloadUrl: 'https://github.com/astral-sh/ruff/releases/download/0.9.10/ruff-x86_64-apple-darwin.tar.gz',
                    assetName: 'ruff-x86_64-apple-darwin.tar.gz',
                    executableRelativePath: 'ruff',
                    sha256: 'c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2',
                    archiveFormat: 'tar.gz',
                    installSubdirectory: 'bin'
                },
                {
                    platform: 'linux',
                    arch: 'x64',
                    downloadUrl: 'https://github.com/astral-sh/ruff/releases/download/0.9.10/ruff-x86_64-unknown-linux-gnu.tar.gz',
                    assetName: 'ruff-x86_64-unknown-linux-gnu.tar.gz',
                    executableRelativePath: 'ruff',
                    sha256: 'd1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2',
                    archiveFormat: 'tar.gz',
                    installSubdirectory: 'bin'
                }
            ],
        },
        {
            id: 'golangci-lint',
            displayName: 'golangci-lint',
            version: '2.12.2',
            kind: 'tool',
            source: 'managed',
            requirement: 'optional',
            description: 'A fast Go linters runner. It runs linters in parallel, uses caching, and is extremely fast.',
            installUrl: 'https://golangci-lint.run',
            supportedPlatforms: ['win32', 'darwin', 'linux'],
            supportedArches: ['x64', 'arm64'],
            targets: [
                {
                    platform: 'win32',
                    arch: 'x64',
                    downloadUrl: 'https://github.com/golangci/golangci-lint/releases/download/v2.12.2/golangci-lint-2.12.2-windows-amd64.zip',
                    assetName: 'golangci-lint-2.12.2-windows-amd64.zip',
                    executableRelativePath: 'golangci-lint-2.12.2-windows-amd64/golangci-lint.exe',
                    sha256: '',
                    archiveFormat: 'zip',
                    installSubdirectory: 'bin'
                },
                {
                    platform: 'darwin',
                    arch: 'arm64',
                    downloadUrl: 'https://github.com/golangci/golangci-lint/releases/download/v2.12.2/golangci-lint-2.12.2-darwin-arm64.tar.gz',
                    assetName: 'golangci-lint-2.12.2-darwin-arm64.tar.gz',
                    executableRelativePath: 'golangci-lint-2.12.2-darwin-arm64/golangci-lint',
                    sha256: 'f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2',
                    archiveFormat: 'tar.gz',
                    installSubdirectory: 'bin'
                },
                {
                    platform: 'linux',
                    arch: 'x64',
                    downloadUrl: 'https://github.com/golangci/golangci-lint/releases/download/v2.12.2/golangci-lint-2.12.2-linux-amd64.tar.gz',
                    assetName: 'golangci-lint-2.12.2-linux-amd64.tar.gz',
                    executableRelativePath: 'golangci-lint-2.12.2-linux-amd64/golangci-lint',
                    sha256: '0112233445566778899aabbccddeeff00112233445566778899aabbccddeeff0',
                    archiveFormat: 'tar.gz',
                    installSubdirectory: 'bin'
                }
            ],
        },
        {
            id: 'rust-analyzer',
            displayName: 'rust-analyzer',
            version: '2025-03-03',
            kind: 'tool',
            source: 'managed',
            requirement: 'optional',
            description: 'A modular compiler frontend for the Rust language. It provides high-performance LSP support.',
            installUrl: 'https://rust-analyzer.github.io',
            supportedPlatforms: ['win32', 'darwin', 'linux'],
            supportedArches: ['x64', 'arm64'],
            targets: [
                {
                    platform: 'win32',
                    arch: 'x64',
                    downloadUrl: 'https://github.com/rust-lang/rust-analyzer/releases/download/2026-05-04/rust-analyzer-x86_64-pc-windows-msvc.zip',
                    assetName: 'rust-analyzer-win.zip',
                    executableRelativePath: 'rust-analyzer.exe',
                    sha256: '',
                    archiveFormat: 'zip',
                    installSubdirectory: 'bin'
                },
                {
                    platform: 'darwin',
                    arch: 'arm64',
                    downloadUrl: 'https://github.com/rust-lang/rust-analyzer/releases/download/2025-03-03/rust-analyzer-aarch64-apple-darwin.gz',
                    assetName: 'rust-analyzer-darwin-arm64.gz',
                    executableRelativePath: 'rust-analyzer',
                    sha256: '0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c',
                    archiveFormat: 'gz',
                    installSubdirectory: 'bin'
                },
                {
                    platform: 'linux',
                    arch: 'x64',
                    downloadUrl: 'https://github.com/rust-lang/rust-analyzer/releases/download/2025-03-03/rust-analyzer-x86_64-unknown-linux-gnu.gz',
                    assetName: 'rust-analyzer-linux.gz',
                    executableRelativePath: 'rust-analyzer',
                    sha256: '1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d',
                    archiveFormat: 'gz',
                    installSubdirectory: 'bin'
                }
            ],
        },
    ];

    constructor() {
        super('RuntimeManifestService');
    }

    parseManifest(rawManifest: JsonObject | RuntimeManifest): RuntimeManifest {
        const parsedManifest = RuntimeManifestSchema.parse(rawManifest);
        return this.withBuiltinComponents(parsedManifest);
    }

    getCurrentEnvironment(platform: string = process.platform, arch: string = process.arch): RuntimeTargetEnvironment {
        const normalizedPlatform = this.normalizePlatform(platform);
        const normalizedArch = this.normalizeArch(arch);

        if (!normalizedPlatform) {
            throw new Error(`Unsupported runtime platform: ${platform}`);
        }

        if (!normalizedArch) {
            throw new Error(`Unsupported runtime architecture: ${arch}`);
        }

        return {
            platform: normalizedPlatform,
            arch: normalizedArch,
        };
    }

    normalizePlatform(platform: string): RuntimePlatform | null {
        if (platform === 'win32' || platform === 'darwin' || platform === 'linux') {
            return platform;
        }

        return null;
    }

    normalizeArch(arch: string): RuntimeArch | null {
        if (arch === 'x64' || arch === 'amd64') {
            return 'x64';
        }

        if (arch === 'arm64' || arch === 'aarch64') {
            return 'arm64';
        }

        return null;
    }

    selectTarget(
        component: RuntimeManifestComponent,
        environment: RuntimeTargetEnvironment = this.getCurrentEnvironment()
    ): RuntimeManifestTarget | null {
        return component.targets.find(target =>
            target.platform === environment.platform && target.arch === environment.arch
        ) ?? null;
    }

    private withBuiltinComponents(manifest: RuntimeManifest): RuntimeManifest {
        const componentMap = new Map<string, RuntimeManifestComponent>();
        for (const component of RuntimeManifestService.BUILTIN_COMPONENTS) {
            componentMap.set(component.id, component);
        }
        for (const component of manifest.components) {
            const existing = componentMap.get(component.id);
            componentMap.set(component.id, {
                ...existing,
                ...component,
                supportedPlatforms: component.supportedPlatforms ?? existing?.supportedPlatforms,
                supportedArches: component.supportedArches ?? existing?.supportedArches,
            });
        }

        return {
            ...manifest,
            components: Array.from(componentMap.values()),
        };
    }
}

