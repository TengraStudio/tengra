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
    static readonly serviceName = 'runtimeManifestService';
    static readonly dependencies = [] as const;
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
                    sha256: '6aad48b69bb0699394f93c34fc700bf1b20130aeb7101e52fccf5d306b65ab92',
                    archiveFormat: 'raw',
                    installSubdirectory: 'bin'
                },
                {
                    platform: 'darwin',
                    arch: 'arm64',
                    downloadUrl: 'https://github.com/biomejs/biome/releases/download/%40biomejs/biome%402.4.14/biome-darwin-arm64',
                    assetName: 'biome-darwin-arm64',
                    executableRelativePath: 'biome',
                    sha256: '13895170d26b0a9818532b84f33e04a2980b46cbb7e86d43ecc606c6bd1b1e63',
                    archiveFormat: 'raw',
                    installSubdirectory: 'bin'
                },
                {
                    platform: 'darwin',
                    arch: 'x64',
                    downloadUrl: 'https://github.com/biomejs/biome/releases/download/%40biomejs/biome%402.4.14/biome-darwin-x64',
                    assetName: 'biome-darwin-x64',
                    executableRelativePath: 'biome',
                    sha256: 'dc835f90255a5c9c1734d3adb07ac142396187953545029e0aeab82177e466c6',
                    archiveFormat: 'raw',
                    installSubdirectory: 'bin'
                },
                {
                    platform: 'linux',
                    arch: 'x64',
                    downloadUrl: 'https://github.com/biomejs/biome/releases/download/%40biomejs/biome%402.4.14/biome-linux-x64',
                    assetName: 'biome-linux-x64',
                    executableRelativePath: 'biome',
                    sha256: '77b36a64b00589020e8e8c7ecb869f1721ed2b933dad186077490fb5cdc173cc',
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
                    sha256: 'f1e75b080ea1c83737d0ada30a1338ba87d7792ce1dadd67daade720b539f8f7',
                    archiveFormat: 'zip',
                    installSubdirectory: 'bin'
                },
                {
                    platform: 'darwin',
                    arch: 'arm64',
                    downloadUrl: 'https://github.com/astral-sh/ruff/releases/download/0.9.10/ruff-aarch64-apple-darwin.tar.gz',
                    assetName: 'ruff-aarch64-apple-darwin.tar.gz',
                    executableRelativePath: 'ruff',
                    sha256: '1fccbd53431eaa596f2322494edbdc444f99db651566188fa0a9820c26bbef77',
                    archiveFormat: 'tar.gz',
                    installSubdirectory: 'bin'
                },
                {
                    platform: 'darwin',
                    arch: 'x64',
                    downloadUrl: 'https://github.com/astral-sh/ruff/releases/download/0.9.10/ruff-x86_64-apple-darwin.tar.gz',
                    assetName: 'ruff-x86_64-apple-darwin.tar.gz',
                    executableRelativePath: 'ruff',
                    sha256: '1e5080489fdf483e7111bb1575f045ec13da2fdbfc6ac5fd58b5d55cf9cd7668',
                    archiveFormat: 'tar.gz',
                    installSubdirectory: 'bin'
                },
                {
                    platform: 'linux',
                    arch: 'x64',
                    downloadUrl: 'https://github.com/astral-sh/ruff/releases/download/0.9.10/ruff-x86_64-unknown-linux-gnu.tar.gz',
                    assetName: 'ruff-x86_64-unknown-linux-gnu.tar.gz',
                    executableRelativePath: 'ruff',
                    sha256: '1612de28c132b9605da220014177c5c9963f3ed3db203951f22968306f183f97',
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
                    sha256: 'bd42e3ebc8cb4ececb86941983baaf1dc221bbb04d838e94ce63b49cc91e02bb',
                    archiveFormat: 'zip',
                    installSubdirectory: 'bin'
                },
                {
                    platform: 'darwin',
                    arch: 'arm64',
                    downloadUrl: 'https://github.com/golangci/golangci-lint/releases/download/v2.12.2/golangci-lint-2.12.2-darwin-arm64.tar.gz',
                    assetName: 'golangci-lint-2.12.2-darwin-arm64.tar.gz',
                    executableRelativePath: 'golangci-lint-2.12.2-darwin-arm64/golangci-lint',
                    sha256: 'a9c54498731b3128f79e090be6110f3e5fffccc617b08142ed244d4126c73f29',
                    archiveFormat: 'tar.gz',
                    installSubdirectory: 'bin'
                },
                {
                    platform: 'linux',
                    arch: 'x64',
                    downloadUrl: 'https://github.com/golangci/golangci-lint/releases/download/v2.12.2/golangci-lint-2.12.2-linux-amd64.tar.gz',
                    assetName: 'golangci-lint-2.12.2-linux-amd64.tar.gz',
                    executableRelativePath: 'golangci-lint-2.12.2-linux-amd64/golangci-lint',
                    sha256: '8df580d2670fed8fa984aac0507099af8df275e665215f5c7a2ae3943893a553',
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
                    sha256: 'a9703da68a13ca5a4fab7dbcd4d3cc868fad52725fa819b1b9f8d92a7196bc84',
                    archiveFormat: 'zip',
                    installSubdirectory: 'bin'
                },
                {
                    platform: 'darwin',
                    arch: 'arm64',
                    downloadUrl: 'https://github.com/rust-lang/rust-analyzer/releases/download/2025-03-03/rust-analyzer-aarch64-apple-darwin.gz',
                    assetName: 'rust-analyzer-darwin-arm64.gz',
                    executableRelativePath: 'rust-analyzer',
                    sha256: 'f46723b97c974a658f763462f608d008a6278d99d615375dfd4c726de59ffb7c',
                    archiveFormat: 'gz',
                    installSubdirectory: 'bin'
                },
                {
                    platform: 'linux',
                    arch: 'x64',
                    downloadUrl: 'https://github.com/rust-lang/rust-analyzer/releases/download/2025-03-03/rust-analyzer-x86_64-unknown-linux-gnu.gz',
                    assetName: 'rust-analyzer-linux.gz',
                    executableRelativePath: 'rust-analyzer',
                    sha256: '6cf40211f9755c63ac2f8f5fbeb4370d124aae7b1b082d501669b83e607762be',
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

