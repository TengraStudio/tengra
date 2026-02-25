/**
 * Settings Backup Service
 * Backup and restore application settings and data
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

import { appLogger } from '@main/logging/logger';
import { DataService } from '@main/services/data/data.service';
import { Chat, ChatMessage, DatabaseService } from '@main/services/data/database.service';
import { JsonObject, JsonValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';

/** Metadata embedded within a backup file describing its contents and origin. */
export interface BackupMetadata {
    version: string
    createdAt: string
    appVersion: string
    platform: string
    includes: string[]
    checksum?: string
    compressed?: boolean
    encrypted?: boolean
    incremental?: boolean
    baseBackup?: string
}

/** Result returned after creating a backup. */
export interface BackupResult {
    success: boolean
    path?: string
    error?: string
    metadata?: BackupMetadata
}

/** Result returned after restoring from a backup. */
export interface RestoreResult {
    success: boolean
    restored: string[]
    errors: string[]
}

export interface DisasterRecoveryBundleResult {
    success: boolean;
    bundlePath?: string;
    files?: string[];
    error?: string;
}

/** The full serialized backup payload including data sections and metadata. */
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

/** Configuration for the automatic backup scheduler. */
export interface AutoBackupConfig {
    enabled: boolean
    intervalHours: number
    maxBackups: number
    lastBackup: string | null
    compression: boolean
    encryption: boolean
    verification: boolean
    cloudSyncDir?: string
}

const DEFAULT_AUTO_BACKUP_CONFIG: AutoBackupConfig = {
    enabled: false,
    intervalHours: 24,
    maxBackups: 10,
    lastBackup: null,
    compression: false,
    encryption: false,
    verification: true,
    cloudSyncDir: undefined
};

/**
 * Service for creating, restoring, and managing application backups.
 * Supports manual and automatic scheduled backups of settings, chats, prompts, and folders.
 */
export class BackupService {
    private backupDir: string;
    private autoBackupTimer: ReturnType<typeof setInterval> | null = null;
    private autoBackupConfig: AutoBackupConfig = { ...DEFAULT_AUTO_BACKUP_CONFIG };
    private configPath: string;

    /**
     * @param dataService - Provides filesystem paths for backup storage.
     * @param databaseService - Database service for reading/writing application data.
     */
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
            await fs.promises.mkdir(this.backupDir, { recursive: true, mode: 0o700 });
        } catch (error) {
            appLogger.error('BackupService', 'Failed to ensure backup dir:', error as Error);
        }
    }

    /**
     * Create a backup of settings and data.
     * @param options - Controls which data sections to include in the backup.
     * @returns The backup result including the file path and metadata on success.
     */
    async createBackup(options?: {
        includeChats?: boolean
        includeAuth?: boolean
        includeSettings?: boolean
        includePrompts?: boolean
        incremental?: boolean
        compress?: boolean
        encrypt?: boolean
        verify?: boolean
        cloudSyncDir?: string
    }): Promise<BackupResult> {
        const opts = {
            includeChats: true,
            includeAuth: false, // Don't include sensitive auth by default
            includeSettings: true,
            includePrompts: true,
            incremental: false,
            compress: this.autoBackupConfig.compression,
            encrypt: this.autoBackupConfig.encryption,
            verify: this.autoBackupConfig.verification,
            cloudSyncDir: this.autoBackupConfig.cloudSyncDir,
            ...options
        };

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupName = `backup-${timestamp}`;
            const extension = opts.compress ? '.json.gz' : '.json';
            const backupPath = path.join(this.backupDir, `${backupName}${extension}`);

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

            const latestBackupPath = opts.incremental ? await this.getLatestBackupPath() : undefined;
            if (opts.incremental && latestBackupPath) {
                await this.applyIncrementalDiff(backup, latestBackupPath);
            }

            // Metadata
            const metadata: BackupMetadata = {
                version: '2.0', // Bump version for DB-backed backups
                createdAt: new Date().toISOString(),
                appVersion: process.env.npm_package_version ?? '1.0.0',
                platform: process.platform,
                includes,
                compressed: opts.compress,
                encrypted: opts.encrypt,
                incremental: opts.incremental,
                baseBackup: latestBackupPath ? path.basename(latestBackupPath) : undefined
            };

            backup._metadata = metadata;

            let serialized = Buffer.from(JSON.stringify(backup, null, 2), 'utf8');
            metadata.checksum = this.computeChecksum(serialized);

            if (opts.verify && metadata.checksum !== this.computeChecksum(serialized)) {
                throw new Error('Backup verification failed before write');
            }

            if (opts.compress) {
                serialized = Buffer.from(zlib.gzipSync(serialized));
            }

            if (opts.encrypt) {
                serialized = Buffer.from(this.encryptBuffer(serialized));
            }

            // Write backup
            await fs.promises.writeFile(backupPath, serialized);

            if (opts.cloudSyncDir) {
                await this.syncBackupToDirectory(backupPath, opts.cloudSyncDir);
            }

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
     * Restore from a backup file.
     * @param backupPath - Absolute path to the backup JSON file.
     * @param options - Controls which data sections to restore and merge behavior.
     * @returns The restore result listing restored sections and any errors.
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
            const backupContent = await this.readBackupPayload(backupPath);
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

    private computeChecksum(buffer: Buffer): string {
        return crypto.createHash('sha256').update(buffer).digest('hex');
    }

    private deriveEncryptionKey(): Buffer {
        const raw = process.env.BACKUP_ENCRYPTION_KEY ?? 'tengra-backup-default-key';
        return crypto.createHash('sha256').update(raw).digest();
    }

    private encryptBuffer(input: Buffer): Buffer {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.deriveEncryptionKey(), iv);
        const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
        const tag = cipher.getAuthTag();
        return Buffer.concat([Buffer.from('TBK1'), iv, tag, encrypted]);
    }

    private decryptBuffer(input: Buffer): Buffer {
        if (input.subarray(0, 4).toString('utf8') !== 'TBK1') {
            return input;
        }
        const iv = input.subarray(4, 16);
        const tag = input.subarray(16, 32);
        const payload = input.subarray(32);
        const decipher = crypto.createDecipheriv('aes-256-gcm', this.deriveEncryptionKey(), iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(payload), decipher.final()]);
    }

    private async readBackupPayload(backupPath: string): Promise<string> {
        let content = Buffer.from(await fs.promises.readFile(backupPath));
        content = Buffer.from(this.decryptBuffer(content));
        if (backupPath.endsWith('.gz') || content.subarray(0, 2).equals(Buffer.from([0x1f, 0x8b]))) {
            content = Buffer.from(zlib.gunzipSync(content));
        }
        return content.toString('utf8');
    }

    private async getLatestBackupPath(): Promise<string | undefined> {
        const backups = await this.listBackups();
        return backups[0]?.path;
    }

    private async applyIncrementalDiff(backup: Partial<BackupData>, baseBackupPath: string): Promise<void> {
        try {
            const baseContent = await this.readBackupPayload(baseBackupPath);
            const base = safeJsonParse<Partial<BackupData>>(baseContent, {});
            const compareSection = (key: 'settings' | 'chats' | 'prompts' | 'folders') => {
                if (!backup[key]) { return; }
                const next = JSON.stringify(backup[key]);
                const prev = JSON.stringify(base[key]);
                if (next === prev) {
                    delete backup[key];
                }
            };
            compareSection('settings');
            compareSection('chats');
            compareSection('prompts');
            compareSection('folders');
        } catch (error) {
            appLogger.warn('BackupService', `Incremental diff failed, falling back to full backup: ${getErrorMessage(error as Error)}`);
        }
    }

    async verifyBackup(backupPath: string): Promise<{ valid: boolean; checksum?: string; error?: string }> {
        try {
            const payload = await this.readBackupPayload(backupPath);
            const parsed = safeJsonParse<Partial<BackupData>>(payload, {});
            const checksum = this.computeChecksum(Buffer.from(payload, 'utf8'));
            if (parsed._metadata?.checksum && parsed._metadata.checksum !== checksum) {
                return { valid: false, checksum, error: 'Checksum mismatch' };
            }
            return { valid: true, checksum };
        } catch (error) {
            return { valid: false, error: getErrorMessage(error as Error) };
        }
    }

    async syncBackupToDirectory(backupPath: string, targetDir: string): Promise<{ success: boolean; targetPath?: string; error?: string }> {
        try {
            await fs.promises.mkdir(targetDir, { recursive: true });
            const targetPath = path.join(targetDir, path.basename(backupPath));
            await fs.promises.copyFile(backupPath, targetPath);
            return { success: true, targetPath };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
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
                metadata: (chatObj.metadata as JsonObject | null | undefined) ?? {}
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
                await this.updateExistingChat(chatId, chat);
            } else if (!existing) {
                await this.createNewChat(chat);
            }

            if (chat.messages && Array.isArray(chat.messages)) {
                await this.restoreChatMessages(chat.messages, chatId);
            }
        } catch (err) {
            appLogger.error('BackupService', `Failed to restore chat`, err as Error);
        }
    }

    private async updateExistingChat(chatId: string, chat: RestoreChatData): Promise<void> {
        const chatUpdate: Partial<Chat> = {
            title: chat.title,
            model: chat.model,
            backend: chat.backend,
            createdAt: this.parseRestoreDate(chat.createdAt),
            updatedAt: this.parseRestoreDate(chat.updatedAt),
            isPinned: chat.isPinned,
            isFavorite: chat.isFavorite,
            folderId: chat.folderId,
            projectId: chat.projectId,
            isGenerating: chat.isGenerating,
            metadata: chat.metadata
        };
        await this.databaseService.updateChat(chatId, chatUpdate);
    }

    private async createNewChat(chat: RestoreChatData): Promise<void> {
        const newChat: Chat = {
            id: chat.id,
            title: chat.title,
            model: chat.model,
            backend: chat.backend,
            messages: [],
            isPinned: chat.isPinned,
            isFavorite: chat.isFavorite,
            folderId: chat.folderId,
            projectId: chat.projectId,
            isGenerating: chat.isGenerating,
            metadata: chat.metadata,
            createdAt: this.parseRestoreDate(chat.createdAt),
            updatedAt: this.parseRestoreDate(chat.updatedAt)
        };
        await this.databaseService.createChat(newChat);
    }

    private parseRestoreDate(dateValue: string | number | Date | undefined): Date {
        if (!dateValue) {
            return new Date();
        }
        if (dateValue instanceof Date) {
            return dateValue;
        }
        return new Date(dateValue);
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
     * List available backups sorted by creation date (newest first).
     * @returns Array of backup entries with name, path, and optional metadata.
     */
    async listBackups(): Promise<Array<{ name: string; path: string; metadata?: BackupMetadata }>> {
        const backups: Array<{ name: string; path: string; metadata?: BackupMetadata }> = [];

        try {
            await fs.promises.access(this.backupDir);
        } catch {
            return backups;
        }

        try {
            const files = (await fs.promises.readdir(this.backupDir)).filter(f => f.endsWith('.json') || f.endsWith('.json.gz'));

            for (const file of files) {
                const filePath = path.join(this.backupDir, file);
                try {
                    const content = await this.readBackupPayload(filePath);
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
     * Delete a backup file.
     * @param backupPath - Absolute path to the backup file to delete.
     * @returns `true` if the file was successfully deleted.
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
     * Get the backup directory path.
     * @returns Absolute path to the directory where backups are stored.
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
            await fs.promises.mkdir(configDir, { recursive: true, mode: 0o700 });
            await fs.promises.writeFile(this.configPath, JSON.stringify(this.autoBackupConfig, null, 2));
        } catch (error) {
            appLogger.error('BackupService', `Failed to save auto-backup config: ${getErrorMessage(error as Error)}`);
        }
    }

    /**
     * Get the current auto-backup configuration.
     * @returns A copy of the auto-backup configuration.
     */
    getAutoBackupStatus(): AutoBackupConfig {
        return { ...this.autoBackupConfig };
    }

    /**
     * Configure auto-backup settings and start/stop the scheduler as needed.
     * @param config - The auto-backup configuration to apply.
     */
    configureAutoBackup(config: {
        enabled: boolean
        intervalHours?: number
        maxBackups?: number
        compression?: boolean
        encryption?: boolean
        verification?: boolean
        cloudSyncDir?: string
    }): void {
        const wasEnabled = this.autoBackupConfig.enabled;

        this.autoBackupConfig.enabled = config.enabled;
        if (config.intervalHours !== undefined) {
            this.autoBackupConfig.intervalHours = Math.max(1, config.intervalHours); // Minimum 1 hour
        }
        if (config.maxBackups !== undefined) {
            this.autoBackupConfig.maxBackups = Math.max(1, config.maxBackups); // Minimum 1 backup
        }
        if (config.compression !== undefined) {
            this.autoBackupConfig.compression = config.compression;
        }
        if (config.encryption !== undefined) {
            this.autoBackupConfig.encryption = config.encryption;
        }
        if (config.verification !== undefined) {
            this.autoBackupConfig.verification = config.verification;
        }
        if (config.cloudSyncDir !== undefined) {
            this.autoBackupConfig.cloudSyncDir = config.cloudSyncDir;
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
        const result = await this.createBackup({
            incremental: true,
            compress: this.autoBackupConfig.compression,
            encrypt: this.autoBackupConfig.encryption,
            verify: this.autoBackupConfig.verification,
            cloudSyncDir: this.autoBackupConfig.cloudSyncDir
        });

        if (result.success) {
            this.autoBackupConfig.lastBackup = new Date().toISOString();
            await this.saveAutoBackupConfig();

            // Clean up old backups
            await this.cleanupOldBackups();
        }
    }

    /**
     * Remove old backups exceeding the configured maximum count.
     * @returns The number of backups deleted.
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

    async createDisasterRecoveryBundle(targetDir?: string): Promise<DisasterRecoveryBundleResult> {
        try {
            const backups = await this.listBackups();
            const latest = backups[0];
            if (!latest) {
                return { success: false, error: 'No backups available to build disaster recovery bundle' };
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const baseDir = targetDir ?? path.join(this.dataService.getPath('data'), 'disaster-recovery');
            const bundlePath = path.join(baseDir, `dr-bundle-${timestamp}`);
            await fs.promises.mkdir(bundlePath, { recursive: true, mode: 0o700 });

            const files: string[] = [];
            const backupTarget = path.join(bundlePath, path.basename(latest.path));
            await fs.promises.copyFile(latest.path, backupTarget);
            files.push(backupTarget);

            try {
                await fs.promises.access(this.configPath);
                const configTarget = path.join(bundlePath, path.basename(this.configPath));
                await fs.promises.copyFile(this.configPath, configTarget);
                files.push(configTarget);
            } catch {
                // Optional config file
            }

            const manifest = {
                createdAt: new Date().toISOString(),
                latestBackup: path.basename(latest.path),
                backupMetadata: latest.metadata ?? null,
                autoBackupConfig: this.getAutoBackupStatus()
            };
            const manifestPath = path.join(bundlePath, 'recovery-manifest.json');
            await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
            files.push(manifestPath);

            return { success: true, bundlePath, files };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async restoreDisasterRecoveryBundle(bundlePath: string): Promise<RestoreResult> {
        const result: RestoreResult = { success: false, restored: [], errors: [] };
        try {
            const files = await fs.promises.readdir(bundlePath);
            const backupFile = files.find(f => f.endsWith('.json') || f.endsWith('.json.gz'));
            if (!backupFile) {
                result.errors.push('No backup file found in disaster recovery bundle');
                return result;
            }

            const restorePath = path.join(bundlePath, backupFile);
            const restoreResult = await this.restoreBackup(restorePath, {
                restoreChats: true,
                restoreSettings: true,
                restorePrompts: true,
                mergeChats: false
            });

            result.restored.push(...restoreResult.restored);
            result.errors.push(...restoreResult.errors);

            const configFile = files.find(f => f === path.basename(this.configPath));
            if (configFile) {
                try {
                    const src = path.join(bundlePath, configFile);
                    await fs.promises.copyFile(src, this.configPath);
                    result.restored.push('auto-backup-config');
                } catch (error) {
                    result.errors.push(`Auto backup config restore failed: ${getErrorMessage(error as Error)}`);
                }
            }

            result.success = result.errors.length === 0;
            return result;
        } catch (error) {
            result.errors.push(getErrorMessage(error as Error));
            return result;
        }
    }

    /** Stop the service and clean up resources (timers). */
    dispose(): void {
        this.stopAutoBackup();
    }
}

