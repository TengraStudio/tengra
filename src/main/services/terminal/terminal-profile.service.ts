/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as fs from 'fs';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { getDataFilePath } from '@main/services/system/app-layout-paths.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';

export interface TerminalProfile {
    id: string;
    name: string;
    shell: string;
    args?: string[];
    env?: Record<string, string | undefined>;
    icon?: string;
    isDefault?: boolean;
}

export interface TerminalProfileValidationResult {
    valid: boolean;
    errors: string[];
}

export interface TerminalProfileImportResult {
    success: boolean;
    imported: number;
    skipped: number;
    errors: string[];
}

interface ExportedTerminalProfilePayload {
    version: 1;
    kind: 'terminal-profile';
    exportedAt: number;
    profile: TerminalProfile;
}

export class TerminalProfileService extends BaseService {
    private profiles: Map<string, TerminalProfile> = new Map();
    private persistencePath: string;

    constructor() {
        super('TerminalProfileService');
        try {
            this.persistencePath = getDataFilePath('terminal', 'profiles.json');
        } catch {
            this.persistencePath = '';
        }
    }

    async initialize(): Promise<void> {
        this.logInfo('Initializing TerminalProfileService...');
        await this.loadProfiles();
    }

    /** Clears in-memory terminal profiles. */
    async cleanup(): Promise<void> {
        this.profiles.clear();
        this.logInfo('Terminal profile service cleaned up');
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
        const validation = this.validateProfile(profile);
        if (!validation.valid) {
            throw new Error(`Invalid terminal profile: ${validation.errors.join('; ')}`);
        }
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

    validateProfile(profile: TerminalProfile): TerminalProfileValidationResult {
        const errors: string[] = [];

        if (!profile || typeof profile !== 'object') {
            return { valid: false, errors: ['Profile payload is required'] };
        }

        const id = profile.id?.trim();
        const name = profile.name?.trim();
        const shell = profile.shell?.trim();

        if (!id) {
            errors.push('Profile id is required');
        }
        if (!name) {
            errors.push('Profile name is required');
        }
        if (!shell) {
            errors.push('Shell path/command is required');
        }
        if (id && id.length > 128) {
            errors.push('Profile id is too long');
        }
        if (name && name.length > 128) {
            errors.push('Profile name is too long');
        }
        if (profile.args && !Array.isArray(profile.args)) {
            errors.push('Args must be an array');
        }
        if (profile.args?.some(arg => typeof arg !== 'string')) {
            errors.push('All args must be strings');
        }
        if (profile.env && typeof profile.env !== 'object') {
            errors.push('Env must be an object');
        }

        return { valid: errors.length === 0, errors };
    }

    getProfileTemplates(): TerminalProfile[] {
        const isWin = process.platform === 'win32';
        if (isWin) {
            return [
                {
                    id: 'tpl-powershell',
                    name: 'PowerShell (Admin-friendly)',
                    shell: 'powershell.exe',
                    args: ['-NoLogo', '-ExecutionPolicy', 'Bypass'],
                    icon: 'terminal',
                },
                {
                    id: 'tpl-cmd',
                    name: 'Command Prompt',
                    shell: 'cmd.exe',
                    icon: 'terminal',
                },
                {
                    id: 'tpl-dev-env',
                    name: 'Dev Shell (with env preset)',
                    shell: 'powershell.exe',
                    args: ['-NoLogo', '-ExecutionPolicy', 'Bypass'],
                    env: {
                        NODE_ENV: 'development',
                        FORCE_COLOR: '1',
                    },
                    icon: 'terminal',
                },
            ];
        }

        return [
            {
                id: 'tpl-bash-login',
                name: 'Bash (login shell)',
                shell: '/bin/bash',
                args: ['-l'],
                icon: 'terminal',
            },
            {
                id: 'tpl-zsh-login',
                name: 'Zsh (login shell)',
                shell: '/bin/zsh',
                args: ['-l'],
                icon: 'terminal',
            },
            {
                id: 'tpl-dev-env',
                name: 'Dev Shell (with env preset)',
                shell: '/bin/bash',
                args: ['-l'],
                env: {
                    NODE_ENV: 'development',
                    FORCE_COLOR: '1',
                },
                icon: 'terminal',
            },
        ];
    }

    exportProfiles(): string {
        return JSON.stringify({
            version: 1,
            exportedAt: Date.now(),
            profiles: this.getProfiles(),
        }, null, 2);
    }

    async importProfiles(payload: string, options?: { overwrite?: boolean }): Promise<TerminalProfileImportResult> {
        const errors: string[] = [];
        let imported = 0;
        let skipped = 0;
        const overwrite = options?.overwrite === true;

        const parsed = safeJsonParse<{
            profiles?: TerminalProfile[];
        }>(payload, {});

        const profiles = Array.isArray(parsed.profiles) ? parsed.profiles : [];
        for (const profile of profiles) {
            const validation = this.validateProfile(profile);
            if (!validation.valid) {
                errors.push(`${profile?.id ?? 'unknown'}: ${validation.errors.join(', ')}`);
                skipped += 1;
                continue;
            }

            if (!overwrite && this.profiles.has(profile.id)) {
                skipped += 1;
                continue;
            }

            this.profiles.set(profile.id, profile);
            imported += 1;
        }

        await this.saveProfilesToDisk();
        return {
            success: errors.length === 0,
            imported,
            skipped,
            errors,
        };
    }

    exportProfileShareCode(profileId: string): string | null {
        const profile = this.profiles.get(profileId);
        if (!profile) {
            return null;
        }

        const payload: ExportedTerminalProfilePayload = {
            version: 1,
            kind: 'terminal-profile',
            exportedAt: Date.now(),
            profile,
        };
        return `termprofile:${Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url')}`;
    }

    async importProfileShareCode(
        shareCode: string,
        options?: { overwrite?: boolean }
    ): Promise<{ success: boolean; imported: boolean; profileId?: string; error?: string }> {
        if (typeof shareCode !== 'string' || !shareCode.startsWith('termprofile:')) {
            return { success: false, imported: false, error: 'Invalid profile share code' };
        }
        const encoded = shareCode.slice('termprofile:'.length).trim();
        if (!encoded) {
            return { success: false, imported: false, error: 'Invalid profile share code' };
        }
        try {
            const decoded = Buffer.from(encoded, 'base64url').toString('utf-8');
            const parsed = safeJsonParse<ExportedTerminalProfilePayload | null>(decoded, null);
            if (parsed?.kind !== 'terminal-profile' || parsed.version !== 1 || !parsed.profile) {
                return { success: false, imported: false, error: 'Invalid profile payload' };
            }
            const validation = this.validateProfile(parsed.profile);
            if (!validation.valid) {
                return {
                    success: false,
                    imported: false,
                    error: `Invalid profile: ${validation.errors.join(', ')}`,
                };
            }
            if (!options?.overwrite && this.profiles.has(parsed.profile.id)) {
                return {
                    success: false,
                    imported: false,
                    profileId: parsed.profile.id,
                    error: `Profile ${parsed.profile.id} already exists`,
                };
            }
            this.profiles.set(parsed.profile.id, parsed.profile);
            await this.saveProfilesToDisk();
            return { success: true, imported: true, profileId: parsed.profile.id };
        } catch {
            return { success: false, imported: false, error: 'Invalid profile share code encoding' };
        }
    }

    /**
     * Load profiles from disk
     */
    private async loadProfiles(): Promise<void> {
        if (!this.persistencePath) {
            return;
        }

        try {
            try {
                await fs.promises.access(this.persistencePath, fs.constants.F_OK);
            } catch {
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
