import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { app } from 'electron';

export interface TerminalProfile {
    id: string;
    name: string;
    shell: string;
    args?: string[];
    env?: Record<string, string | undefined>;
    icon?: string;
    isDefault?: boolean;
}

export class TerminalProfileService extends BaseService {
    private profiles: Map<string, TerminalProfile> = new Map();
    private persistencePath: string;

    constructor() {
        super('TerminalProfileService');
        try {
            this.persistencePath = path.join(app.getPath('userData'), 'terminal-profiles.json');
        } catch {
            this.persistencePath = '';
        }
    }

    async initialize(): Promise<void> {
        this.logInfo('Initializing TerminalProfileService...');
        await this.loadProfiles();
    }

    /**
     * Get all terminal profiles
     */
    getProfiles(): TerminalProfile[] {
        return Array.from(this.profiles.values());
    }

    /**
     * Get a profile by ID
     */
    getProfile(id: string): TerminalProfile | undefined {
        return this.profiles.get(id);
    }

    /**
     * Create or update a profile
     */
    async saveProfile(profile: TerminalProfile): Promise<void> {
        this.profiles.set(profile.id, profile);
        await this.saveProfilesToDisk();
    }

    /**
     * Delete a profile
     */
    async deleteProfile(id: string): Promise<void> {
        this.profiles.delete(id);
        await this.saveProfilesToDisk();
    }

    /**
     * Load profiles from disk
     */
    private async loadProfiles(): Promise<void> {
        if (!this.persistencePath) {
            return;
        }

        try {
            if (!fs.existsSync(this.persistencePath)) {
                await this.createDefaultProfiles();
                return;
            }

            const data = await fs.promises.readFile(this.persistencePath, 'utf-8');
            const loaded = safeJsonParse<TerminalProfile[]>(data, []);
            loaded.forEach(p => this.profiles.set(p.id, p));
        } catch (error) {
            appLogger.error('TerminalProfileService', 'Failed to load profiles', error as Error);
        }
    }

    /**
     * Create default profiles based on platform
     */
    private async createDefaultProfiles(): Promise<void> {
        const isWin = process.platform === 'win32';
        const defaults: TerminalProfile[] = [];

        if (isWin) {
            defaults.push({
                id: 'default-powershell',
                name: 'PowerShell',
                shell: 'powershell.exe',
                isDefault: true,
                icon: 'terminal'
            });
            defaults.push({
                id: 'default-cmd',
                name: 'Command Prompt',
                shell: 'cmd.exe',
                icon: 'terminal'
            });
        } else {
            defaults.push({
                id: 'default-bash',
                name: 'Bash',
                shell: '/bin/bash',
                args: ['-l'],
                isDefault: true,
                icon: 'terminal'
            });
        }

        defaults.forEach(p => this.profiles.set(p.id, p));
        await this.saveProfilesToDisk();
    }

    /**
     * Save profiles to disk
     */
    private async saveProfilesToDisk(): Promise<void> {
        if (!this.persistencePath) {
            return;
        }

        try {
            const data = JSON.stringify(Array.from(this.profiles.values()), null, 2);
            await fs.promises.writeFile(this.persistencePath, data, 'utf-8');
        } catch (error) {
            appLogger.error('TerminalProfileService', 'Failed to save profiles', error as Error);
        }
    }
}
