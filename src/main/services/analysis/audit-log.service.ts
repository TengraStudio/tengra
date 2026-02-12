import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { app } from 'electron';

/** Represents a single entry in the audit log. */
export interface AuditLogEntry {
    timestamp: number
    action: string
    category: 'security' | 'settings' | 'authentication' | 'data' | 'system'
    userId?: string | undefined
    details?: Record<string, unknown> | undefined
    ipAddress?: string | undefined
    userAgent?: string | undefined
    success: boolean
    error?: string | undefined
}

/**
 * Service for recording and querying audit log entries.
 * Handles migration of legacy file-based logs to the database on initialization.
 */
export class AuditLogService extends BaseService {
    private legacyLogPath: string;

    /** @param databaseService - Database service used to persist audit log entries. */
    constructor(
        private databaseService: DatabaseService
    ) {
        super('AuditLogService');
        const userDataPath = app.getPath('userData');
        this.legacyLogPath = path.join(userDataPath, 'audit.log');
    }

    /** Initializes the service by migrating any legacy file-based audit logs to the database. */
    public async initialize(): Promise<void> {
        await this.migrateLegacyData();
    }

    private async migrateLegacyData(): Promise<void> {
        if (!fs.existsSync(this.legacyLogPath)) {
            return;
        }

        try {
            appLogger.info('AuditLogService', 'Migrating legacy audit logs to database...');
            const content = await fs.promises.readFile(this.legacyLogPath, 'utf8');
            const logs: AuditLogEntry[] = safeJsonParse<AuditLogEntry[]>(content, []);

            if (Array.isArray(logs) && logs.length > 0) {
                // Insert efficiently (could be batched but ensuring one by one for safety here since it's a one-time thing and audit logs can be sensitive/large)
                // Actually, let's limit migration to recent logs if it's huge, but given the 10MB limit it wasn't THAT huge.
                for (const log of logs) {
                    await this.databaseService.addAuditLog(log);
                }
            }

            // Rename legacy file to avoid re-migration
            await fs.promises.rename(this.legacyLogPath, this.legacyLogPath + '.migrated');
            appLogger.info('AuditLogService', 'Legacy audit logs migrated successfully');
        } catch (error) {
            appLogger.error('AuditLogService', `Failed to migrate legacy audit logs: ${getErrorMessage(error as Error)}`);
            // Rename anyway to prevent infinite retry loop if file is corrupted
            try {
                if (fs.existsSync(this.legacyLogPath)) {
                    await fs.promises.rename(this.legacyLogPath, this.legacyLogPath + '.migrated_failed');
                }
            } catch (e) {
                appLogger.error('AuditLogService', `Failed to rename corrupted audit log file: ${getErrorMessage(e as Error)}`);
            }
        }
    }

    /**
     * Logs a sensitive operation to the audit log.
     * @param entry - The audit log entry (timestamp is added automatically).
     */
    async log(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> {
        try {
            const fullEntry: AuditLogEntry = {
                ...entry,
                timestamp: Date.now()
            };

            await this.databaseService.addAuditLog(fullEntry);

            // Also log to console in development
            if (process.env.NODE_ENV === 'development') {
                this.logInfo('AuditLog', `${entry.category.toUpperCase()}: ${entry.action} - ${entry.success ? 'SUCCESS' : 'FAILED'}`);
            }
        } catch (error) {
            this.logError('AuditLog', `Failed to write audit log: ${getErrorMessage(error as Error)}`);
        }
    }

    /**
     * Retrieves audit log entries with optional filtering.
     * @param options - Optional filters for category, date range, and result limit.
     * @returns Array of matching audit log entries.
     */
    async getLogs(options?: {
        category?: AuditLogEntry['category']
        startDate?: number
        endDate?: number
        limit?: number
    }): Promise<AuditLogEntry[]> {
        return this.databaseService.getAuditLogs(options);
    }

    /**
     * Clears audit logs (use with caution)
     */
    async clearLogs(): Promise<void> {
        await this.databaseService.clearAuditLogs();
        this.logInfo('AuditLog', 'Audit logs cleared');
    }
}
