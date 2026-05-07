/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import type { SSHConnection } from '@main/services/workspace/ssh.service';
import { t } from '@main/utils/i18n.util';
import {
    SSHProfileTemplate,
    SSHProfileTestResult,
    SSHSearchHistoryEntry,
} from '@shared/types/ssh';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { Client } from 'ssh2';

interface SSHProfileManagerDependencies {
    storagePath: string;
    ensureInitialized: () => Promise<void>;
    encryptCredential: (value: string) => string;
    decryptCredential: (value: string) => string;
}

export class SSHProfileManager {
    constructor(private readonly deps: SSHProfileManagerDependencies) {}

    private get profilesPath(): string {
        return path.join(this.deps.storagePath, 'ssh-profiles.json');
    }

    private get searchHistoryPath(): string {
        return path.join(this.deps.storagePath, 'ssh-search-history.json');
    }

    private get profileTemplatesPath(): string {
        return path.join(this.deps.storagePath, 'ssh-profile-templates.json');
    }

    private async ensureOptionalStorageInitialized(): Promise<void> {
        await this.deps.ensureInitialized();

        try {
            await fs.promises.access(this.searchHistoryPath);
        } catch {
            await fs.promises.writeFile(this.searchHistoryPath, JSON.stringify([], null, 2));
        }

        try {
            await fs.promises.access(this.profileTemplatesPath);
        } catch {
            await fs.promises.writeFile(this.profileTemplatesPath, JSON.stringify([], null, 2));
        }
    }

    private async readProfileTemplates(): Promise<SSHProfileTemplate[]> {
        await this.ensureOptionalStorageInitialized();
        const content = await fs.promises.readFile(this.profileTemplatesPath, 'utf-8');
        return safeJsonParse<SSHProfileTemplate[]>(content, []);
    }

    private async writeProfileTemplates(templates: SSHProfileTemplate[]): Promise<void> {
        await fs.promises.writeFile(this.profileTemplatesPath, JSON.stringify(templates, null, 2));
    }

    private async readSearchHistory(): Promise<SSHSearchHistoryEntry[]> {
        await this.ensureOptionalStorageInitialized();
        const content = await fs.promises.readFile(this.searchHistoryPath, 'utf-8');
        return safeJsonParse<SSHSearchHistoryEntry[]>(content, []);
    }

    private async writeSearchHistory(entries: SSHSearchHistoryEntry[]): Promise<void> {
        await fs.promises.writeFile(this.searchHistoryPath, JSON.stringify(entries, null, 2));
    }

    async getSavedProfiles(): Promise<SSHConnection[]> {
        try {
            await this.deps.ensureInitialized();
            try {
                await fs.promises.access(this.profilesPath);
            } catch {
                return [];
            }
            const content = await fs.promises.readFile(this.profilesPath, 'utf-8');
            return safeJsonParse<SSHConnection[]>(content, []);
        } catch (error) {
            appLogger.error(
                'SSHProfileManager',
                `Failed to load SSH profiles: ${getErrorMessage(error as Error)}`
            );
            return [];
        }
    }

    async saveProfile(profile: SSHConnection): Promise<boolean> {
        try {
            await this.deps.ensureInitialized();
            const profiles = await this.getSavedProfiles();
            const safeProfile = { ...profile };

            if (safeProfile.password) {
                safeProfile.password = this.deps.encryptCredential(safeProfile.password);
            }
            if (safeProfile.passphrase) {
                safeProfile.passphrase = this.deps.encryptCredential(safeProfile.passphrase);
            }
            if (safeProfile.privateKey) {
                safeProfile.privateKey = this.deps.encryptCredential(safeProfile.privateKey);
            }

            const profileIndex = profiles.findIndex(existing => existing.id === safeProfile.id);
            if (profileIndex >= 0) {
                profiles[profileIndex] = safeProfile;
            } else {
                profiles.push(safeProfile);
            }

            await fs.promises.writeFile(this.profilesPath, JSON.stringify(profiles, null, 2));
            return true;
        } catch (error) {
            appLogger.error(
                'SSHProfileManager',
                `Failed to save SSH profile: ${getErrorMessage(error as Error)}`
            );
            return false;
        }
    }

    async getProfileWithCredentials(id: string): Promise<SSHConnection | null> {
        const profiles = await this.getSavedProfiles();
        const profile = profiles.find(existing => existing.id === id);
        if (!profile) {
            return null;
        }

        const decrypted = { ...profile };
        if (decrypted.password) {
            decrypted.password = this.deps.decryptCredential(decrypted.password);
        }
        if (decrypted.passphrase) {
            decrypted.passphrase = this.deps.decryptCredential(decrypted.passphrase);
        }
        if (decrypted.privateKey) {
            decrypted.privateKey = this.deps.decryptCredential(decrypted.privateKey);
        }
        return decrypted;
    }

    async toggleFavorite(id: string): Promise<boolean> {
        const profiles = await this.getSavedProfiles();
        const index = profiles.findIndex(profile => profile.id === id);
        if (index === -1) {
            return false;
        }

        profiles[index].isFavorite = !profiles[index].isFavorite;
        await fs.promises.writeFile(this.profilesPath, JSON.stringify(profiles, null, 2));
        return true;
    }

    async getFavorites(): Promise<SSHConnection[]> {
        const profiles = await this.getSavedProfiles();
        return profiles.filter(profile => profile.isFavorite);
    }

    async getRecentConnections(limit: number = 10): Promise<SSHConnection[]> {
        const profiles = await this.getSavedProfiles();
        return profiles
            .filter(profile => profile.lastConnected)
            .sort((left, right) => (right.lastConnected ?? 0) - (left.lastConnected ?? 0))
            .slice(0, limit);
    }

    async setProfileTags(id: string, tags: string[]): Promise<boolean> {
        const profiles = await this.getSavedProfiles();
        const index = profiles.findIndex(profile => profile.id === id);
        if (index === -1) {
            return false;
        }

        profiles[index].tags = tags;
        await fs.promises.writeFile(this.profilesPath, JSON.stringify(profiles, null, 2));
        return true;
    }

    async searchProfiles(query: string): Promise<SSHConnection[]> {
        const profiles = await this.getSavedProfiles();
        const normalizedQuery = query.toLowerCase();

        return profiles.filter(
            profile =>
                profile.name.toLowerCase().includes(normalizedQuery) ||
                profile.host.toLowerCase().includes(normalizedQuery) ||
                profile.username.toLowerCase().includes(normalizedQuery) ||
                profile.tags?.some(tag => tag.toLowerCase().includes(normalizedQuery))
        );
    }

    async deleteProfile(id: string): Promise<boolean> {
        try {
            const profiles = await this.getSavedProfiles();
            const filtered = profiles.filter(profile => profile.id !== id);
            await fs.promises.writeFile(this.profilesPath, JSON.stringify(filtered, null, 2));
            return true;
        } catch (error) {
            appLogger.error(
                'SSHProfileManager',
                `Failed to delete SSH profile: ${getErrorMessage(error as Error)}`
            );
            return false;
        }
    }

    async updateConnectionHistory(connectionId: string): Promise<void> {
        try {
            const profiles = await this.getSavedProfiles();
            const profileIndex = profiles.findIndex(profile => profile.id === connectionId);
            if (profileIndex === -1) {
                return;
            }

            profiles[profileIndex].lastConnected = Date.now();
            profiles[profileIndex].connectionCount =
                (profiles[profileIndex].connectionCount ?? 0) + 1;
            await fs.promises.writeFile(this.profilesPath, JSON.stringify(profiles, null, 2));
        } catch {
            // Ignore history update failures to avoid breaking a successful connection.
        }
    }

    async recordSearchHistory(query: string, connectionId: string): Promise<void> {
        const history = await this.readSearchHistory();
        history.push({
            id: crypto.randomUUID(),
            query,
            createdAt: Date.now(),
            connectionId,
        });
        await this.writeSearchHistory(history.slice(-200));
    }

    async getSearchHistory(connectionId?: string): Promise<SSHSearchHistoryEntry[]> {
        const history = await this.readSearchHistory();
        return connectionId ? history.filter(entry => entry.connectionId === connectionId) : history;
    }

    async exportSearchHistory(): Promise<string> {
        const history = await this.readSearchHistory();
        return JSON.stringify(history, null, 2);
    }

    async saveProfileTemplate(
        template: Omit<SSHProfileTemplate, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<SSHProfileTemplate> {
        const templates = await this.readProfileTemplates();
        const now = Date.now();
        const created: SSHProfileTemplate = {
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
            ...template,
        };
        templates.push(created);
        await this.writeProfileTemplates(templates);
        return created;
    }

    async listProfileTemplates(): Promise<SSHProfileTemplate[]> {
        return this.readProfileTemplates();
    }

    async deleteProfileTemplate(id: string): Promise<boolean> {
        const templates = await this.readProfileTemplates();
        const filtered = templates.filter(template => template.id !== id);
        if (filtered.length === templates.length) {
            return false;
        }
        await this.writeProfileTemplates(filtered);
        return true;
    }

    async exportProfiles(ids?: string[]): Promise<string> {
        const profiles = await this.getSavedProfiles();
        const selected = ids && ids.length > 0
            ? profiles.filter(profile => ids.includes(profile.id))
            : profiles;

        return JSON.stringify(
            selected.map(profile => ({
                ...profile,
                password: undefined,
                privateKey: undefined,
            })),
            null,
            2
        );
    }

    async importProfiles(payload: string): Promise<number> {
        const profiles = safeJsonParse<SSHConnection[]>(payload, []);
        let savedCount = 0;

        for (const profile of profiles) {
            if (!profile.id || !profile.host || !profile.username) {
                continue;
            }

            const saved = await this.saveProfile(profile);
            if (saved) {
                savedCount += 1;
            }
        }

        return savedCount;
    }

    validateProfile(profile: Partial<SSHConnection>): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!profile.host?.trim()) {
            errors.push('Host is required');
        }
        if (!profile.username?.trim()) {
            errors.push('Username is required');
        }
        if (!profile.port || profile.port < 1 || profile.port > 65535) {
            errors.push('Port must be between 1 and 65535');
        }

        return { valid: errors.length === 0, errors };
    }

    async testProfile(profile: Partial<SSHConnection>): Promise<SSHProfileTestResult> {
        const validation = this.validateProfile(profile);
        if (!validation.valid) {
            return {
                success: false,
                latencyMs: 0,
                authMethod: profile.privateKey ? 'key' : 'password',
                message: t('auto.profileValidationFailed'),
                error: validation.errors.join('; '),
            };
        }

        const startedAt = Date.now();
        let privateKey: string | undefined;

        if (profile.privateKey) {
            if (profile.privateKey.includes('BEGIN')) {
                privateKey = profile.privateKey;
            } else {
                try {
                    privateKey = await fs.promises.readFile(profile.privateKey, 'utf-8');
                } catch (error) {
                    return {
                        success: false,
                        latencyMs: Date.now() - startedAt,
                        authMethod: 'key',
                        message: t('auto.privateKeyCouldNotBeLoaded'),
                        error: getErrorMessage(error as Error),
                    };
                }
            }
        }

        const password = profile.password ? this.deps.decryptCredential(profile.password) : undefined;
        const passphrase = profile.passphrase ? this.deps.decryptCredential(profile.passphrase) : undefined;

        return await new Promise<SSHProfileTestResult>(resolve => {
            const conn = new Client();
            const authMethod: 'password' | 'key' = privateKey ? 'key' : 'password';
            let settled = false;

            const finalize = (result: SSHProfileTestResult): void => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timeout);
                conn.removeAllListeners();
                try {
                    conn.end();
                } catch {
                    // Ignore connection teardown failures.
                }
                resolve(result);
            };

            const timeout = setTimeout(() => {
                finalize({
                    success: false,
                    latencyMs: Date.now() - startedAt,
                    authMethod,
                    message: t('auto.sshProfileTestTimedOut'),
                    error: 'Connection timed out',
                });
            }, 10000);

            conn
                .on('ready', () => {
                    conn.exec('echo tengra-ssh-test', (error, stream) => {
                        if (error) {
                            finalize({
                                success: false,
                                latencyMs: Date.now() - startedAt,
                                authMethod,
                                message: t('auto.connectedButCommandTestFailed'),
                                error: error.message,
                            });
                            return;
                        }

                        stream.on('close', () => {
                            finalize({
                                success: true,
                                latencyMs: Date.now() - startedAt,
                                authMethod,
                                message: t('auto.sshProfileTestPassed'),
                            });
                        });
                    });
                })
                .on('error', error => {
                    finalize({
                        success: false,
                        latencyMs: Date.now() - startedAt,
                        authMethod,
                        message: t('auto.sshProfileTestFailed'),
                        error: error.message,
                    });
                });

            try {
                conn.connect({
                    host: profile.host ?? '',
                    port: profile.port ?? 22,
                    username: profile.username ?? '',
                    password,
                    privateKey,
                    passphrase,
                    readyTimeout: 10000,
                });
            } catch (error) {
                finalize({
                    success: false,
                    latencyMs: Date.now() - startedAt,
                    authMethod,
                    message: t('auto.sshProfileTestFailed'),
                    error: getErrorMessage(error as Error),
                });
            }
        });
    }
}

