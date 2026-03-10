import * as fs from 'fs';
import * as path from 'path';

import { BaseService } from '@main/services/base.service';
import {
    getManagedRuntimeBinDir,
    getManagedRuntimeModelsDir,
    getManagedRuntimeTempDir,
} from '@main/services/system/runtime-path.service';
import {
    RuntimeBootstrapPlan,
    RuntimeBootstrapPlanEntry,
    RuntimeInstallSubdirectory,
    RuntimeManifest,
    RuntimeManifestTarget,
    RuntimeTargetEnvironment,
} from '@shared/types/runtime-manifest';

import { RuntimeManifestService } from './runtime-manifest.service';

export class RuntimeBootstrapService extends BaseService {
    constructor(
        private readonly runtimeManifestService: RuntimeManifestService = new RuntimeManifestService()
    ) {
        super('RuntimeBootstrapService');
    }

    buildInstallPlan(
        rawManifest: RuntimeManifest | unknown,
        environment: RuntimeTargetEnvironment = this.runtimeManifestService.getCurrentEnvironment()
    ): RuntimeBootstrapPlan {
        const manifest = this.runtimeManifestService.parseManifest(rawManifest);
        const entries = manifest.components.map(component => this.buildPlanEntry(component, environment));

        return {
            manifestVersion: manifest.releaseTag,
            environment,
            entries,
            summary: {
                ready: entries.filter(entry => entry.status === 'ready').length,
                install: entries.filter(entry => entry.status === 'install').length,
                external: entries.filter(entry => entry.status === 'external').length,
                unsupported: entries.filter(entry => entry.status === 'unsupported').length,
            },
        };
    }

    private buildPlanEntry(
        component: RuntimeManifest['components'][number],
        environment: RuntimeTargetEnvironment
    ): RuntimeBootstrapPlanEntry {
        if (component.source === 'external') {
            return {
                componentId: component.id,
                displayName: component.displayName,
                version: component.version,
                status: 'external',
                source: component.source,
                requirement: component.requirement,
                reason: 'external-dependency',
                installUrl: component.installUrl,
            };
        }

        const target = this.runtimeManifestService.selectTarget(component, environment);
        if (!target) {
            return {
                componentId: component.id,
                displayName: component.displayName,
                version: component.version,
                status: 'unsupported',
                source: component.source,
                requirement: component.requirement,
                reason: 'unsupported-platform',
            };
        }

        const installPath = this.resolveInstallPath(target);
        const fileExists = fs.existsSync(installPath);

        return {
            componentId: component.id,
            displayName: component.displayName,
            version: component.version,
            status: fileExists ? 'ready' : 'install',
            source: component.source,
            requirement: component.requirement,
            reason: fileExists ? 'file-present' : 'missing-file',
            installPath,
            target,
        };
    }

    private resolveInstallPath(target: RuntimeManifestTarget): string {
        return path.join(this.resolveInstallRoot(target.installSubdirectory), target.executableRelativePath);
    }

    private resolveInstallRoot(subdirectory: RuntimeInstallSubdirectory): string {
        switch (subdirectory) {
            case 'bin':
                return getManagedRuntimeBinDir();
            case 'models':
                return getManagedRuntimeModelsDir();
            case 'temp':
                return getManagedRuntimeTempDir();
        }
    }
}
