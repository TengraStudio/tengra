/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Backup Scheduler Service
 * Manages scheduled automatic backups with configurable frequency and retention.
 */

import { BaseService } from '@main/services/base.service';
import { BackupService } from '@main/services/data/backup.service';

/** Supported backup frequency options. */
export type BackupFrequency = 'daily' | 'weekly' | 'manual-only';

/** Configuration for the backup scheduler. */
export interface BackupScheduleConfig {
    frequency: BackupFrequency;
    maxBackups: number;
    enabled: boolean;
    lastBackupTime: string | null;
}

const FREQUENCY_MS: Record<Exclude<BackupFrequency, 'manual-only'>, number> = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
};

const DEFAULT_CONFIG: BackupScheduleConfig = {
    frequency: 'manual-only',
    maxBackups: 5,
    enabled: false,
    lastBackupTime: null,
};

/**
 * Orchestrates scheduled backup creation and old backup cleanup.
 * Delegates actual backup operations to BackupService.
 */
export class BackupSchedulerService extends BaseService {
    private timer: ReturnType<typeof setInterval> | null = null;
    private config: BackupScheduleConfig = { ...DEFAULT_CONFIG };

    constructor(private readonly backupService: BackupService) {
        super('BackupSchedulerService');
    }

    /** Initializes the scheduler and starts the timer if enabled. */
    async initialize(): Promise<void> {
        this.logInfo('Initializing backup scheduler');
        const status = this.backupService.getAutoBackupStatus();
        this.config.enabled = status.enabled;
        this.config.lastBackupTime = status.lastBackup;
        this.startScheduler();
    }

    /** Stops the scheduler timer on cleanup. */
    async cleanup(): Promise<void> {
        this.stopScheduler();
        this.logInfo('Backup scheduler stopped');
    }

    /** Returns the current schedule configuration. */
    getConfig(): BackupScheduleConfig {
        return { ...this.config };
    }

    /** Updates the schedule configuration and restarts the timer. */
    setConfig(updates: Partial<BackupScheduleConfig>): BackupScheduleConfig {
        this.config = { ...this.config, ...updates };
        this.stopScheduler();
        this.startScheduler();
        this.logInfo('Backup schedule updated', {
            frequency: this.config.frequency,
            enabled: this.config.enabled,
        } as Record<string, string | boolean>);
        return { ...this.config };
    }

    /** Manually triggers a backup and cleanup of old backups. */
    async triggerBackup(): Promise<{ success: boolean; error?: string }> {
        this.logInfo('Manual backup triggered');
        try {
            const result = await this.backupService.createBackup();
            if (result.success) {
                this.config.lastBackupTime = new Date().toISOString();
                await this.cleanupOldBackups();
                this.logInfo('Backup completed successfully');
            }
            return { success: result.success, error: result.error };
        } catch (error) {
            this.logError('Backup failed', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    /** Removes backups exceeding the configured max count. */
    private async cleanupOldBackups(): Promise<void> {
        try {
            const backups = await this.backupService.listBackups();
            const sorted = [...backups].sort((a, b) => b.name.localeCompare(a.name));
            const toDelete = sorted.slice(this.config.maxBackups);
            for (let i = 0; i < toDelete.length; i++) {
                await this.backupService.deleteBackup(toDelete[i].path);
                this.logInfo(`Deleted old backup: ${toDelete[i].name}`);
            }
        } catch (error) {
            this.logError('Failed to cleanup old backups', error);
        }
    }

    /** Starts the interval timer if frequency is not manual-only. */
    private startScheduler(): void {
        if (!this.config.enabled || this.config.frequency === 'manual-only') {
            return;
        }
        const intervalMs = FREQUENCY_MS[this.config.frequency];
        this.timer = setInterval(() => {
            void this.triggerBackup();
        }, intervalMs);
        this.logInfo(`Scheduler started: ${this.config.frequency} (${intervalMs}ms)`);
    }

    /** Clears the active timer if any. */
    private stopScheduler(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}
