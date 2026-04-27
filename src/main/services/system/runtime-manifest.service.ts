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
            description: t('auto.localLlmRuntimeForOfflineInference'),
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
            description: t('auto.localImageGenerationRuntime'),
            supportedPlatforms: ['win32', 'darwin', 'linux'],
            supportedArches: ['x64', 'arm64'],
            targets: [],
        },
        {
            id: 'ghostty',
            displayName: 'Ghostty',
            version: 'external',
            kind: 'tool',
            source: 'external',
            requirement: 'optional',
            description: 'GPU-accelerated terminal emulator.',
            installUrl: 'https://ghostty.org/download',
            supportedPlatforms: ['darwin', 'linux', 'win32'],
            supportedArches: ['x64', 'arm64'],
            targets: [],
        },
        {
            id: 'alacritty',
            displayName: 'Alacritty',
            version: 'external',
            kind: 'tool',
            source: 'external',
            requirement: 'optional',
            description: 'Modern, cross-platform terminal emulator.',
            installUrl: 'https://alacritty.org',
            supportedPlatforms: ['win32', 'darwin', 'linux'],
            supportedArches: ['x64', 'arm64'],
            targets: [],
        },
        {
            id: 'warp',
            displayName: 'Warp',
            version: 'external',
            kind: 'tool',
            source: 'external',
            requirement: 'optional',
            description: t('auto.productivityfocusedTerminalExperience'),
            installUrl: 'https://www.warp.dev/download',
            supportedPlatforms: ['win32', 'darwin', 'linux'],
            supportedArches: ['x64', 'arm64'],
            targets: [],
        },
        {
            id: 'kitty',
            displayName: 'Kitty',
            version: 'external',
            kind: 'tool',
            source: 'external',
            requirement: 'optional',
            description: 'Fast GPU-based terminal emulator.',
            installUrl: 'https://sw.kovidgoyal.net/kitty/binary/',
            supportedPlatforms: ['win32', 'darwin', 'linux'],
            supportedArches: ['x64', 'arm64'],
            targets: [],
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
