import { constants as fsConstants } from 'fs';
import * as fs from 'fs/promises';

import { BaseService } from '@main/services/base.service';
import {
    RuntimeBootstrapPlan,
    RuntimeHealthEntry,
    RuntimeHealthReport,
} from '@shared/types/runtime-manifest';

import { ExternalRuntimeDependencyService } from './external-runtime-dependency.service';

interface ExternalRuntimeDependencyProbe {
    assess: (componentId: string) => Promise<{
        detected: boolean;
        running: boolean;
        action: 'none' | 'install' | 'start';
        message: string;
        messageKey?: string;
        messageParams?: Record<string, string | number>;
    }>;
}

export class RuntimeHealthService extends BaseService {
    private static readonly MESSAGE_KEY = {
        UNSUPPORTED: 'images.runtimeHealth.unsupportedTarget',
        INSTALL_PATH_MISSING: 'images.runtimeHealth.installPathMissing',
        FILE_MISSING: 'images.runtimeHealth.fileMissing',
        NOT_EXECUTABLE: 'images.runtimeHealth.notExecutable',
        FILE_READY: 'images.runtimeHealth.fileReady',
    } as const;

    constructor(
        private readonly externalRuntimeDependencyService: ExternalRuntimeDependencyProbe = new ExternalRuntimeDependencyService()
    ) {
        super('RuntimeHealthService');
    }

    async assessPlan(plan: RuntimeBootstrapPlan): Promise<RuntimeHealthReport> {
        const entries = await Promise.all(plan.entries.map(entry => this.assessEntry(entry)));
        return {
            entries,
            summary: {
                ready: entries.filter(entry => entry.status === 'ready').length,
                missing: entries.filter(entry => entry.status === 'missing').length,
                invalid: entries.filter(entry => entry.status === 'not-executable').length,
                external: entries.filter(entry => entry.status === 'external').length,
                unsupported: entries.filter(entry => entry.status === 'unsupported').length,
            },
        };
    }

    private async assessEntry(entry: RuntimeBootstrapPlan['entries'][number]): Promise<RuntimeHealthEntry> {
        if (entry.status === 'external') {
            const assessment = await this.externalRuntimeDependencyService.assess(entry.componentId);
            return this.createEntry(entry, 'external', assessment.message, {
                detected: assessment.detected,
                running: assessment.running,
                action: assessment.action,
                messageKey: assessment.messageKey,
                messageParams: assessment.messageParams,
            });
        }
        if (entry.status === 'unsupported') {
            return this.createEntry(
                entry,
                'unsupported',
                'No compatible runtime target for this platform',
                { messageKey: RuntimeHealthService.MESSAGE_KEY.UNSUPPORTED }
            );
        }
        if (!entry.installPath) {
            return this.createEntry(
                entry,
                'missing',
                'No install path was resolved for this component',
                { messageKey: RuntimeHealthService.MESSAGE_KEY.INSTALL_PATH_MISSING }
            );
        }

        const fileExists = await this.pathExists(entry.installPath);
        if (!fileExists) {
            return this.createEntry(
                entry,
                'missing',
                'Runtime file is missing',
                { messageKey: RuntimeHealthService.MESSAGE_KEY.FILE_MISSING }
            );
        }

        const executable = await this.isExecutable(entry.installPath);
        if (!executable) {
            return this.createEntry(
                entry,
                'not-executable',
                'Runtime file is not executable',
                { messageKey: RuntimeHealthService.MESSAGE_KEY.NOT_EXECUTABLE }
            );
        }

        return this.createEntry(
            entry,
            'ready',
            'Runtime file is ready',
            { messageKey: RuntimeHealthService.MESSAGE_KEY.FILE_READY }
        );
    }

    private createEntry(
        entry: RuntimeBootstrapPlan['entries'][number],
        status: RuntimeHealthEntry['status'],
        message: string,
        overrides?: Partial<Pick<RuntimeHealthEntry, 'detected' | 'running' | 'action' | 'messageKey' | 'messageParams'>>
    ): RuntimeHealthEntry {
        return {
            componentId: entry.componentId,
            displayName: entry.displayName,
            status,
            source: entry.source,
            installPath: entry.installPath,
            installUrl: entry.installUrl,
            requirement: entry.requirement,
            message,
            messageKey: overrides?.messageKey,
            messageParams: overrides?.messageParams,
            detected: overrides?.detected,
            running: overrides?.running,
            action: overrides?.action,
        };
    }

    private async pathExists(targetPath: string): Promise<boolean> {
        try {
            await fs.access(targetPath, fsConstants.F_OK);
            return true;
        } catch {
            return false;
        }
    }

    private async isExecutable(targetPath: string): Promise<boolean> {
        if (process.platform === 'win32') {
            return this.pathExists(targetPath);
        }

        try {
            await fs.access(targetPath, fsConstants.X_OK);
            return true;
        } catch {
            return false;
        }
    }
}
