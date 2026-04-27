/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { exec } from 'child_process';
import * as fs from 'fs';
import { promisify } from 'util';

import { BaseService } from '@main/services/base.service';
import { getManagedRuntimeBinaryPath } from '@main/services/system/runtime-path.service';

const execAsync = promisify(exec);

export class BackgroundServiceService extends BaseService {
    constructor() {
        super('BackgroundServiceService');
    }

    /**
     * Registers all background sidecars as OS-level background tasks (Login Tasks).
     * This ensures they run even when the main UI is closed to handle token refreshes.
     */
    async registerAll(): Promise<void> {
        if (process.platform !== 'win32') {
            // Currently only Windows Task Scheduler implementation is required for login persistence
            return;
        }

        try {
            await this.registerWindowsTask('tengra-proxy', ['--proxy', '8317']);
            await this.registerWindowsTask('tengra-db-service', []);
            this.logInfo('Background services successfully registered as login tasks.');
        } catch (error) {
            this.logError('Failed to register background services', error);
        }
    }

    private async registerWindowsTask(serviceId: string, args: string[]): Promise<void> {
        const binPath = getManagedRuntimeBinaryPath(serviceId);
        
        if (!fs.existsSync(binPath)) {
            this.logDebug(`Skipping registration for ${serviceId}: Binary not found at ${binPath}`);
            return;
        }

        const taskName = `Tengra_${serviceId}`;
        const argsString = args.join(' ');
        
        // Use schtasks to create a task that runs on logon for the current user
        // /rl highest is used to ensure it has proper permissions if needed, 
        // though /sc onlogon usually runs in user context.
        const command = `schtasks /create /tn "${taskName}" /tr "'${binPath}' ${argsString}" /sc onlogon /rl highest /f`;

        try {
            await execAsync(command);
            this.logDebug(`Registered Windows task: ${taskName}`);
        } catch (error) {
            // If it fails due to permissions, try without /rl highest
            try {
                const fallbackCommand = `schtasks /create /tn "${taskName}" /tr "'${binPath}' ${argsString}" /sc onlogon /f`;
                await execAsync(fallbackCommand);
                this.logDebug(`Registered Windows task (fallback): ${taskName}`);
            } catch (fallbackError) {
                throw new Error(`Task Scheduler Error: ${error instanceof Error ? error.message : 'Unknown'}`);
            }
        }
    }

    /**
     * Removes background task registrations.
     */
    async unregisterAll(): Promise<void> {
        if (process.platform !== 'win32') {return;}

        const services = ['tengra-proxy', 'tengra-db-service'];
        for (const id of services) {
            try {
                await execAsync(`schtasks /delete /tn "Tengra_${id}" /f`);
            } catch {
                // Ignore errors if task doesn't exist
            }
        }
    }
}
