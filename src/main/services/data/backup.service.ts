/**
 * Settings Backup Service
 * Backup and restore application settings and data
 */

import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { DataService } from '@main/services/data/data.service';
import { Chat, ChatMessage, DatabaseService } from '@main/services/data/database.service';
import { JsonObject, JsonValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';

export interface BackupMetadata {
    version: string
    createdAt: string
    appVersion: string
    platform: string
    includes: string[]
}

export interface BackupResult {
    success: boolean
    path?: string
    error?: string
    metadata?: BackupMetadata
}

export interface RestoreResult {
    success: boolean
    restored: string[]
    errors: string[]
}

export interface BackupData {
    settings?: JsonObject
    chats?: JsonObject[]
    prompts?: JsonObject[]
    folders?: JsonObject[]
    _metadata: BackupMetadata
    [key: string]: JsonValue | BackupMetadata | undefined
}

interface RestoreChatData {
    id: string
    title: string
    model?: string
    backend?: string
    messages?: ChatMessage[]
    createdAt?: string | number | Date
    updatedAt?: string | number | Date
    isPinned?: boolean
    isFavorite?: boolean
    folderId?: string
    projectId?: string
    isGenerating?: boolean
    metadata?: JsonObject
    [key: string]: JsonValue | ChatMessage[] | Date | undefined
}

export interface AutoBackupConfig {
    enabled: boolean
    intervalHours: number
    maxBackups: number
    lastBackup: string | null
}

const DEFAULT_AUTO_BACKUP_CONFIG: AutoBackupConfig = {
    enabled: false,
    intervalHours: 24,
    maxBackups: 10,
    lastBackup: null
};

export class BackupService {
    private backupDir: string;
    private autoBackupTimer: ReturnType<typeof setInterval> | null = null;
    private autoBackupConfig: AutoBackupConfig = { ...DEFAULT_AUTO_BACKUP_CONFIG };
    private configPath: string;

    constructor(
        private dataService: DataService,
        private databaseService: DatabaseService
    ) {
        this.backupDir = path.join(dataService.getPath('data'), 'backups');
        this.configPath = path.join(dataService.getPath('config'), 'backup-config.json');
        void this.ensureBackupDir();
        void this.loadAutoBackupConfig();
    }

    private async ensureBackupDir() {
        try {
            await fs.promises.mkdir(this.backupDir, { recursive: true });
        } catch (error) {
            appLogger.error('BackupService', 'Failed to ensure backup dir:', error as Error);
        }
    }

    /**
     * Create a backup of settings and data
     */
    async createBackup(options?: {
        includeChats?: boolean
        includeAuth?: boolean
        includeSettings?: boolean
        includePrompts?: boolean
    }): Promise<BackupResult> {
        const opts = {
            includeChats: true,
            includeAuth: false, // Don't include sensitive auth by default
            includeSettings: true,
            includePrompts: true,
            ...options
        };

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupName = `backup-${timestamp}`;
            const backupPath = path.join(this.backupDir, `${backupName}.json`);

            const backup: Partial<BackupData> = {};
            const includes: string[] = [];

            // Settings (Still read from file as it's the source of truth for settings)
            if (opts.includeSettings) {
                const settingsPath = path.join(this.dataService.getPath('config'), 'settings.json');
                try {
                    const settingsContent = await fs.promises.readFile(settingsPath, 'utf8');
                    backup.settings = safeJsonParse<JsonObject>(settingsContent, {});
                    includes.push('settings');
                } catch (e) {
                    appLogger.warn('BackupService', 'Could not read settings:', e as Error);
                }
            }

            // Chats (From DB)
            if (opts.includeChats) {
                try {
                    const chats = await this.databaseService.getAllChats();
                    const messages = await this.databaseService.getAllMessages();

                    // Reassemble chat objects with their messages
                    const fullChats = chats.map(chat => {
                        const chatMessages = messages.filter((m) => m.chatId === chat.id);
                        return {
                            ...chat,
                            messages: chatMessages
                        };
                    });

                    // Safely serialize chats for backup - convert non-JSON types
                    backup.chats = JSON.parse(JSON.stringify(fullChats)) as JsonObject[];
                    includes.push('chats');
                } catch (e) {
                    appLogger.error('BackupService', 'Failed to export chats from DB:', e as Error);
                }
            }

            // Prompts (From DB)
            if (opts.includePrompts) {
                try {
                    const prompts = await this.databaseService.getPrompts();
                    // Safely serialize prompts for backup - convert non-JSON types
                    backup.prompts = JSON.parse(JSON.stringify(prompts)) as JsonObject[];
                    includes.push('prompts');
                } catch (e) {
                    appLogger.error('BackupService', 'Failed to export prompts from DB:', e as Error);
                }
            }

            // Folders (From DB)
            try {
                const folders = await this.databaseService.getFolders();
                // Safely serialize folders for backup - convert non-JSON types
                backup.folders = JSON.parse(JSON.stringify(folders)) as JsonObject[];
                includes.push('folders');
            } catch (e) {
                appLogger.error('BackupService', 'Failed to export folders from DB:', e as Error);
            }

            // Metadata
            const metadata: BackupMetadata = {
                version: '2.0', // Bump version for DB-backed backups
                createdAt: new Date().toISOString(),
                appVersion: process.env.npm_package_version ?? '1.0.0',
                platform: process.platform,
                includes
            };

            backup._metadata = metadata;

            // Write backup
            await fs.promises.writeFile(backupPath, JSON.stringify(backup, null, 2));

            appLogger.info('BackupService', `Created backup at ${backupPath}`);

            return {
                success: true,
                path: backupPath,
                metadata
            };
        } catch (error) {
            const msg = getErrorMessage(error as Error);
            appLogger.error('BackupService', `Backup failed: ${msg}`);
            return {
                success: false,
                error: msg
            };
        }
    }

    /**
     * Restore from a backup file
     */
    async restoreBackup(backupPath: string, options?: {
        restoreChats?: boolean
        restoreSettings?: boolean
        restorePrompts?: boolean
        mergeChats?: boolean
    }): Promise<RestoreResult> {
        const opts = {
            restoreChats: true,
            restoreSettings: true,
            restorePrompts: true,
            mergeChats: false,
            ...options
        };

        const result: RestoreResult = { success: false, restored: [], errors: [] };

        try {
            const backupContent = await fs.promises.readFile(backupPath, 'utf8');
            const backup = safeJsonParse<Partial<BackupData>>(backupContent, {});

            if (!backup._metadata) {
                result.errors.push('Invalid backup file: missing metadata');
                return result;
            }

            appLogger.info('BackupService', `Restoring backup from ${backup._metadata.createdAt}`);

            // Restore components
            await this.handleRestoreSettings(backup as BackupData, opts, result);
            await this.handleRestoreChats(backup as BackupData, opts, result);
            await this.handleRestorePrompts(backup as BackupData, opts, result);
            await this.handleRestoreFolders(backup as BackupData, result);

            result.success = result.errors.length === 0;
            return result;
        } catch (error) {
            result.errors.push(getErrorMessage(error as Error));
            return result;
        }
    }

    private async handleRestoreSettings(backup: BackupData, opts: { restoreSettings: boolean }, result: RestoreResult): Promise<void> {
        if (!opts.restoreSettings || !backup.settings) { return; }
        try {
            const settingsPath = path.join(this.dataService.getPath('config'), 'settings.json');
            await fs.promises.writeFile(settingsPath, JSON.stringify(backup.settings, null, 2));
            result.restored.push('settings');
        } catch (e) {
            result.errors.push(`Settings: ${getErrorMessage(e as Error)}`);
        }
    }

    private async handleRestoreChats(backup: BackupData, opts: { restoreChats: boolean; mergeChats: boolean }, result: RestoreResult): Promise<void> {
        if (!opts.restoreChats || !backup.chats) { return; }
        try {
            // Type-safe conversion from JsonObject[] to RestoreChatData[]
            const chats: RestoreChatData[] = backup.chats.map(chatObj => ({
                id: String(chatObj.id),
                title: String(chatObj.title ?? 'Untitled Chat'),
                model: chatObj.model ? String(chatObj.model) : undefined,
                backend: chatObj.backend ? String(chatObj.backend) : undefined,
                messages: Array.isArray(chatObj.messages) ? chatObj.messages as ChatMessage[] : [],
                createdAt: chatObj.createdAt ? new Date(chatObj.createdAt as string) : new Date(),
                updatedAt: chatObj.updatedAt ? new Date(chatObj.updatedAt as string) : new Date(),
                isPinned: Boolean(chatObj.isPinned),
                isFavorite: Boolean(chatObj.isFavorite),
                folderId: chatObj.folderId ? String(chatObj.folderId) : undefined,
                projectId: chatObj.projectId ? String(chatObj.projectId) : undefined,
                isGenerating: Boolean(chatObj.isGenerating),
                metadata: (chatObj.metadata as JsonObject | null | undefined) || {}
            }));
            for (const chat of chats) {
                await this.restoreSingleChat(chat, opts.mergeChats);
            }
            result.restored.push(`chats (${chats.length} processed)`);
        } catch (e) {
            result.errors.push(`Chats: ${getErrorMessage(e as Error)}`);
        }
    }

    private async restoreSingleChat(chat: RestoreChatData, merge: boolean): Promise<void> {
        try {
            const chatId = String(chat.id);
            const existing = await this.databaseService.getChat(chatId);

            if (existing && !merge) {
                // Convert RestoreChatData to proper Chat update format
                const chatUpdate: Partial<Chat> = {
                    title: chat.title,
                    model: chat.model,
                    backend: chat.backend,
                    createdAt: typeof chat.createdAt === 'string' ? new Date(chat.createdAt) :
                        chat.createdAt instanceof Date ? chat.createdAt : new Date(),
                    updatedAt: typeof chat.updatedAt === 'string' ? new Date(chat.updatedAt) :
                        chat.updatedAt instanceof Date ? chat.updatedAt : new Date(),
                    isPinned: chat.isPinned,
                    isFavorite: chat.isFavorite,
                    folderId: chat.folderId,
                    projectId: chat.projectId,
                    isGenerating: chat.isGenerating,
                    metadata: chat.metadata
                };
                await this.databaseService.updateChat(chatId, chatUpdate);
            } else if (!existing) {
                // Map RestoreChatData to Chat
                const newChat: Chat = {
                    id: chat.id,
                    title: chat.title,
                    model: chat.model,
                    backend: chat.backend,
                    messages: [], // Messages are restored separately
                    isPinned: chat.isPinned,
                    isFavorite: chat.isFavorite,
                    folderId: chat.folderId,
                    projectId: chat.projectId,
                    isGenerating: chat.isGenerating,
                    metadata: chat.metadata,
                    createdAt: chat.createdAt ? new Date(String(chat.createdAt)) : new Date(),
                    updatedAt: chat.updatedAt ? new Date(String(chat.updatedAt)) : new Date()
                };
                await this.databaseService.createChat(newChat);
            }

            if (chat.messages && Array.isArray(chat.messages)) {
                await this.restoreChatMessages(chat.messages, chatId);
            }
        } catch (err) {
            appLogger.error('BackupService', `Failed to restore chat`, err as Error);
        }
    }

    private async restoreChatMessages(messages: ChatMessage[], chatId: string): Promise<void> {
        for (const msg of messages) {
            try {
                await this.databaseService.addMessage({ ...msg, chatId });
            } catch {
                // Ignore duplicate constraint errors
            }
        }
    }

    private async handleRestorePrompts(backup: BackupData, opts: { restorePrompts: boolean }, result: RestoreResult): Promise<void> {
        if (!opts.restorePrompts || !backup.prompts) { return; }
        try {
            const prompts = backup.prompts as JsonObject[];
            for (const prompt of prompts) {
                await this.restoreSinglePrompt(prompt);
            }
            result.restored.push('prompts');
        } catch (e) {
            result.errors.push(`Prompts: ${getErrorMessage(e as Error)}`);
        }
    }

    private async restoreSinglePrompt(prompt: JsonObject): Promise<void> {
        const promptId = String(prompt.id);
        const existing = await this.databaseService.getPrompt(promptId);
        if (existing) {
            await this.databaseService.updatePrompt(promptId, prompt);
        } else {
            // Falls back to creating with new ID if we can't force ID through service
            await this.databaseService.createPrompt(
                String(prompt.title ?? ''),
                String(prompt.content ?? ''),
                Array.isArray(prompt.tags) ? prompt.tags as string[] : []
            );
        }
    }

    private async handleRestoreFolders(backup: BackupData, result: RestoreResult): Promise<void> {
        if (!backup.folders) { return; }
        try {
            const folders = backup.folders as JsonObject[];
            for (const folder of folders) {
                const folderId = String(folder.id);
                const existing = await this.databaseService.getFolder(folderId);
                if (existing) {
                    await this.databaseService.updateFolder(folderId, folder);
                } else {
                    await this.databaseService.createFolder(String(folder.name ?? ''), String(folder.color ?? ''));
                }
            }
            result.restored.push('folders');
        } catch (e) {
            result.errors.push(`Folders: ${getErrorMessage(e as Error)}`);
        }
    }

    /**
     * List available backups
     */
    async listBackups(): Promise<Array<{ name: string; path: string; metadata?: BackupMetadata }>> {
        const backups: Array<{ name: string; path: string; metadata?: BackupMetadata }> = [];

        try {
            await fs.promises.access(this.backupDir);
        } catch {
            return backups;
        }

        try {
            const files = (await fs.promises.readdir(this.backupDir)).filter(f => f.endsWith('.json'));

            for (const file of files) {
                const filePath = path.join(this.backupDir, file);
                try {
                    const content = await fs.promises.readFile(filePath, 'utf8');
                    const json = safeJsonParse<Record<string, unknown>>(content, {});
                    backups.push({
                        name: file,
                        path: filePath,
                        metadata: json._metadata as BackupMetadata | undefined
                    });
                } catch {
                    backups.push({ name: file, path: filePath });
                }
            }

            return backups.sort((a, b) => {
                const aTime = a.metadata?.createdAt ?? '';
                const bTime = b.metadata?.createdAt ?? '';
                return bTime.localeCompare(aTime);
            });
        } catch (error) {
            appLogger.error('BackupService', 'Failed to list backups:', error as Error);
            return [];
        }
    }

    /**
     * Delete a backup
     */
    async deleteBackup(backupPath: string): Promise<boolean> {
        try {
            await fs.promises.unlink(backupPath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get backup directory path
     */
    getBackupDir(): string {
        return this.backupDir;
    }

    /**
     * Load auto-backup configuration from disk
     */
    private async loadAutoBackupConfig(): Promise<void> {
        try {
            try {
                await fs.promises.access(this.configPath);
            } catch {
                return;
            }

            const content = await fs.promises.readFile(this.configPath, 'utf8');
            const loaded = safeJsonParse<Partial<AutoBackupConfig>>(content, {});
            this.autoBackupConfig = { ...DEFAULT_AUTO_BACKUP_CONFIG, ...loaded };

            // Start auto-backup if enabled
            if (this.autoBackupConfig.enabled) {
                this.startAutoBackup();
            }
        } catch (error) {
            appLogger.error('BackupService', `Failed to load auto-backup config: ${getErrorMessage(error as Error)}`);
        }
    }

    /**
     * Save auto-backup configuration to disk
     */
    private async saveAutoBackupConfig(): Promise<void> {
        try {
            const configDir = path.dirname(this.configPath);
            await fs.promises.mkdir(configDir, { recursive: true });
            await fs.promises.writeFile(this.configPath, JSON.stringify(this.autoBackupConfig, null, 2));
        } catch (error) {
            appLogger.error('BackupService', `Failed to save auto-backup config: ${getErrorMessage(error as Error)}`);
        }
    }

    /**
     * Get auto-backup status
     */
    getAutoBackupStatus(): AutoBackupConfig {
        return { ...this.autoBackupConfig };
    }

    /**
     * Configure auto-backup settings
     */
    configureAutoBackup(config: {
        enabled: boolean
        intervalHours?: number
        maxBackups?: number
    }): void {
        const wasEnabled = this.autoBackupConfig.enabled;

        this.autoBackupConfig.enabled = config.enabled;
        if (config.intervalHours !== undefined) {
            this.autoBackupConfig.intervalHours = Math.max(1, config.intervalHours); // Minimum 1 hour
        }
        if (config.maxBackups !== undefined) {
            this.autoBackupConfig.maxBackups = Math.max(1, config.maxBackups); // Minimum 1 backup
        }

        this.saveAutoBackupConfig().catch(err => {
            appLogger.error('BackupService', 'Failed to save auto-backup config', err as Error);
        });

        // Handle timer based on enabled state change
        if (config.enabled && !wasEnabled) {
            this.startAutoBackup();
        } else if (!config.enabled && wasEnabled) {
            this.stopAutoBackup();
        } else if (config.enabled && config.intervalHours !== undefined) {
            // Restart with new interval
            this.stopAutoBackup();
            this.startAutoBackup();
        }
    }

    /**
     * Start automatic backup timer
     */
    private startAutoBackup(): void {
        if (this.autoBackupTimer) {
            return; // Already running
        }

        const intervalMs = this.autoBackupConfig.intervalHours * 60 * 60 * 1000;
        appLogger.info('BackupService', `Starting auto-backup every ${this.autoBackupConfig.intervalHours} hours`);

        // Check if we need to run a backup immediately (if last backup is too old)
        void this.checkAndRunBackup();

        this.autoBackupTimer = setInterval(() => {
            void this.checkAndRunBackup();
        }, intervalMs);
    }

    /**
     * Stop automatic backup timer
     */
    private stopAutoBackup(): void {
        if (this.autoBackupTimer) {
            clearInterval(this.autoBackupTimer);
            this.autoBackupTimer = null;
            appLogger.info('BackupService', 'Stopped auto-backup');
        }
    }

    /**
     * Check if a backup is needed and run it
     */
    private async checkAndRunBackup(): Promise<void> {
        const lastBackup = this.autoBackupConfig.lastBackup;
        const intervalMs = this.autoBackupConfig.intervalHours * 60 * 60 * 1000;

        if (lastBackup) {
            const lastBackupTime = new Date(lastBackup).getTime();
            const now = Date.now();
            if (now - lastBackupTime < intervalMs) {
                // Not time for a backup yet
                return;
            }
        }

        appLogger.info('BackupService', 'Running scheduled auto-backup');
        const result = await this.createBackup();

        if (result.success) {
            this.autoBackupConfig.lastBackup = new Date().toISOString();
            await this.saveAutoBackupConfig();

            // Clean up old backups
            await this.cleanupOldBackups();
        }
    }

    /**
     * Clean up old backups, keeping only the configured number of most recent backups
     */
    async cleanupOldBackups(): Promise<number> {
        const backups = await this.listBackups();
        const maxBackups = this.autoBackupConfig.maxBackups;

        if (backups.length <= maxBackups) {
            return 0;
        }

        // Backups are sorted by date (newest first), so delete from the end
        const toDelete = backups.slice(maxBackups);
        let deleted = 0;

        for (const backup of toDelete) {
            if (await this.deleteBackup(backup.path)) {
                deleted++;
                appLogger.info('BackupService', `Deleted old backup: ${backup.name}`);
            }
        }

        return deleted;
    }

    /**
     * Stop the service and clean up resources
     */
    dispose(): void {
        this.stopAutoBackup();
    }
}
