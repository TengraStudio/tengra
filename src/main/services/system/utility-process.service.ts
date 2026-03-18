import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { JsonValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { UtilityProcess, utilityProcess } from 'electron';

export interface UtilityProcessOptions {
    name: string;
    entryPoint: string;
    args?: string[];
    env?: Record<string, string>;
}

/**
 * Service to manage Electron's UtilityProcess workers.
 * These are more efficient than full BrowserWindow workers and isolated from the main process.
 */
export class UtilityProcessService extends BaseService {
    private processes: Map<string, UtilityProcess> = new Map();

    constructor() {
        super('UtilityProcessService');
    }

    async initialize(): Promise<void> {
        appLogger.info('UtilityProcessService', 'Utility process service initialized.');
    }

    /**
     * Spawns a new utility process for background work.
     */
    spawn(options: UtilityProcessOptions): string {
        try {
            const processId = `${options.name}-${Math.random().toString(36).substring(2, 9)}`;
            
            const child = utilityProcess.fork(options.entryPoint, options.args || [], {
                env: { ...process.env, ...options.env },
                execArgv: ['--no-warnings'],
                serviceName: options.name
            });

            child.on('spawn', () => {
                appLogger.info('UtilityProcessService', `Process ${options.name} (${processId}) spawned successfully.`);
            });

            child.on('exit', (code) => {
                appLogger.info('UtilityProcessService', `Process ${options.name} (${processId}) exited with code ${code}.`);
                this.processes.delete(processId);
            });

            child.on('error', (error) => {
                appLogger.error('UtilityProcessService', `Process ${options.name} (${processId}) encountered an error: ${getErrorMessage(error)}`);
            });

            this.processes.set(processId, child);
            return processId;
        } catch (error) {
            appLogger.error('UtilityProcessService', `Failed to spawn ${options.name}: ${getErrorMessage(error)}`);
            throw error;
        }
    }

    postMessage(processId: string, message: JsonValue): void {
        const child = this.processes.get(processId);
        if (child) {
            child.postMessage(message);
        } else {
            appLogger.warn('UtilityProcessService', `Cannot post message: Process ${processId} not found.`);
        }
    }

    onMessage(processId: string, callback: (message: JsonValue) => void): void {
        const child = this.processes.get(processId);
        if (child) {
            child.on('message', (message: JsonValue) => {
                callback(message);
            });
        }
    }

    terminate(processId: string): boolean {
        const child = this.processes.get(processId);
        if (child) {
            child.kill();
            this.processes.delete(processId);
            return true;
        }
        return false;
    }

    async dispose(): Promise<void> {
        appLogger.info('UtilityProcessService', 'Terminating all utility processes...');
        for (const [id, child] of this.processes.entries()) {
            child.kill();
            appLogger.debug('UtilityProcessService', `Terminated ${id}`);
        }
        this.processes.clear();
    }
}
