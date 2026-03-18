import { BaseService } from '@main/services/base.service';
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
    constructor() {
        super('RuntimeManifestService');
    }

    parseManifest(rawManifest: JsonObject | RuntimeManifest): RuntimeManifest {
        return RuntimeManifestSchema.parse(rawManifest);
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
}
