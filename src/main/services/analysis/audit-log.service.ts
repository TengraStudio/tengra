/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { UtilityProcessService } from '@main/services/system/utility-process.service';
import { getBundledUtilityWorkerPath } from '@main/services/system/utility-worker-path.util';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { app } from 'electron';

/** Represents a single entry in the audit log. */
export interface AuditLogEntry {
    timestamp: number
    action: string
    category: 'security' | 'settings' | 'authentication' | 'data' | 'system'
    userId?: string | undefined
    details?: Record<string, RuntimeValue> | undefined
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
    private static readonly WORKER_FILE_NAME = 'audit-log.worker.cjs';
    private legacyLogPath: string;
    private lastIntegrityHash: string = '';
    private workerProcessId: string | null = null;
    private workerDisabled = false;
    private readonly maxAuditEntries = 20_000;
    private readonly maxAuditAgeMs = 180 * 24 * 60 * 60 * 1000;

    /** @param databaseService - Database service used to persist audit log entries. */
    constructor(
        private databaseService: DatabaseService,
        private readonly utilityProcessService?: UtilityProcessService
    ) {
        super('AuditLogService');
        const userDataPath = app.getPath('userData');
        this.legacyLogPath = path.join(userDataPath, 'audit.log');
    }

    /** Initializes the service by migrating any legacy file-based audit logs to the database. */
    public async initialize(): Promise<void> {
        await this.migrateLegacyData();
        await this.rotateLogs();
        await this.startWorkerIfAvailable();
    }

    /** Resets in-memory integrity hash chain. */
    async cleanup(): Promise<void> {
        this.lastIntegrityHash = '';
        this.workerDisabled = false;
        if (this.workerProcessId && this.utilityProcessService) {
            this.utilityProcessService.terminate(this.workerProcessId);
            this.workerProcessId = null;
        }
        this.logInfo('Audit log service cleaned up');
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
            const { fullEntry, nextHash } = await this.prepareAuditEntry(entry);
            await this.databaseService.addAuditLog(fullEntry);
            this.lastIntegrityHash = nextHash;

            // Also log to console in development
            if (process.env.NODE_ENV === 'development') {
                this.logDebug('AuditLog', `${entry.category.toUpperCase()}: ${entry.action} - ${entry.success ? 'SUCCESS' : 'FAILED'}`);
            }

            if (Math.random() < 0.02) {
                await this.rotateLogs();
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
        this.lastIntegrityHash = '';
    }

    async logAuthenticationEvent(action: string, success: boolean, details?: Record<string, RuntimeValue>): Promise<void> {
        await this.log({
            action,
            category: 'authentication',
            success,
            details
        });
    }

    async logApiKeyAccess(action: string, success: boolean, details?: Record<string, RuntimeValue>): Promise<void> {
        await this.log({
            action,
            category: 'security',
            success,
            details
        });
    }

    async logFileSystemOperation(action: string, success: boolean, details?: Record<string, RuntimeValue>): Promise<void> {
        await this.log({
            action,
            category: 'data',
            success,
            details
        });
    }

    async verifyIntegrity(sampleSize: number = 200): Promise<{ ok: boolean; checked: number; firstInvalidAt?: number }> {
        const logs = await this.databaseService.getAuditLogs({ limit: Math.max(1, sampleSize) });
        if (this.shouldUseWorker() && this.utilityProcessService && this.workerProcessId) {
            try {
                const response = await this.utilityProcessService.request(
                    this.workerProcessId,
                    'audit.verifyIntegrity',
                    {
                        logs,
                        sampleSize,
                    }
                );
                if (this.isIntegrityResult(response)) {
                    return response;
                }
            } catch (error) {
                this.disableWorker(
                    `Worker integrity verification failed, switching to local fallback: ${getErrorMessage(error as Error)}`
                );
            }
        }

        let previous = 'genesis';

        for (let i = logs.length - 1; i >= 0; i--) {
            const entry = logs[i];
            if (!entry) { continue; }
            const integrity = (entry.details as Record<string, RuntimeValue> | undefined)?.integrity as
                | { prevHash?: string; hash?: string }
                | undefined;
            if (!integrity?.hash || !integrity?.prevHash) {
                return { ok: false, checked: logs.length - i, firstInvalidAt: entry.timestamp };
            }

            const details = { ...((entry.details as Record<string, RuntimeValue>) ?? {}) };
            delete (details as Record<string, RuntimeValue>).integrity;
            const digest = createHash('sha256').update(JSON.stringify({
                action: entry.action,
                category: entry.category,
                success: entry.success,
                userId: entry.userId,
                details,
                prevHash: integrity.prevHash,
                timestamp: entry.timestamp
            })).digest('hex');

            if (integrity.hash !== digest || integrity.prevHash !== previous) {
                return { ok: false, checked: logs.length - i, firstInvalidAt: entry.timestamp };
            }
            previous = integrity.hash;
        }

        return { ok: true, checked: logs.length };
    }

    async rotateLogs(): Promise<{ prunedByAge: number; totalAfter: number }> {
        const cutoff = Date.now() - this.maxAuditAgeMs;
        const prunedByAge = await this.databaseService.pruneAuditLogsOlderThan(cutoff);
        await this.databaseService.pruneAuditLogsToMaxEntries(this.maxAuditEntries);
        const totalAfter = await this.databaseService.countAuditLogs();
        return { prunedByAge, totalAfter };
    }

    private async startWorkerIfAvailable(): Promise<void> {
        if (!this.utilityProcessService || this.workerProcessId || this.workerDisabled) {
            return;
        }

        try {
            this.workerProcessId = this.utilityProcessService.spawn({
                name: 'audit-log-worker',
                entryPoint: getBundledUtilityWorkerPath(AuditLogService.WORKER_FILE_NAME),
            });
        } catch (error) {
            this.workerProcessId = null;
            appLogger.warn(
                'AuditLogService',
                `Falling back to main-process audit hashing: ${getErrorMessage(error as Error)}`
            );
        }
    }

    private shouldUseWorker(): boolean {
        return Boolean(this.workerProcessId && this.utilityProcessService && !this.workerDisabled);
    }

    private disableWorker(reason: string): void {
        if (!this.workerDisabled) {
            appLogger.warn('AuditLogService', reason);
        }
        this.workerDisabled = true;
        if (this.workerProcessId && this.utilityProcessService) {
            this.utilityProcessService.terminate(this.workerProcessId);
        }
        this.workerProcessId = null;
    }

    private async prepareAuditEntry(
        entry: Omit<AuditLogEntry, 'timestamp'>
    ): Promise<{ fullEntry: AuditLogEntry; nextHash: string }> {
        if (this.shouldUseWorker() && this.utilityProcessService && this.workerProcessId) {
            try {
                const response = await this.utilityProcessService.request(
                    this.workerProcessId,
                    'audit.prepareEntry',
                    {
                        entry,
                        prevHash: this.lastIntegrityHash,
                    }
                );
                if (this.isPreparedAuditEntry(response)) {
                    return response;
                }
            } catch (error) {
                this.disableWorker(
                    `Worker entry preparation failed, switching to local fallback: ${getErrorMessage(error as Error)}`
                );
            }
        }

        const details = (entry.details ?? {}) as Record<string, RuntimeValue>;
        const prevHash = this.lastIntegrityHash || 'genesis';
        const timestamp = Date.now();
        const integrityInput = JSON.stringify({
            action: entry.action,
            category: entry.category,
            success: entry.success,
            userId: entry.userId,
            details,
            prevHash,
            timestamp
        });
        const nextHash = createHash('sha256').update(integrityInput).digest('hex');
        return {
            fullEntry: {
                ...entry,
                timestamp,
                details: {
                    ...details,
                    integrity: {
                        prevHash,
                        hash: nextHash
                    }
                }
            },
            nextHash,
        };
    }

    private isPreparedAuditEntry(
        value: RuntimeValue
    ): value is { fullEntry: AuditLogEntry; nextHash: string } {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return false;
        }
        return (
            'fullEntry' in value
            && typeof value.fullEntry === 'object'
            && value.fullEntry !== null
            && 'nextHash' in value
            && typeof value.nextHash === 'string'
        );
    }

    private isIntegrityResult(
        value: RuntimeValue
    ): value is { ok: boolean; checked: number; firstInvalidAt?: number } {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return false;
        }
        return (
            'ok' in value
            && typeof value.ok === 'boolean'
            && 'checked' in value
            && typeof value.checked === 'number'
        );
    }
}
