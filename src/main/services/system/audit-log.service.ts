/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ipc } from '@main/core/ipc-decorators';
import { BaseService } from '@main/services/base.service';

export interface AuditLogFilters {
    startDate?: string;
    endDate?: string;
    category?: string;
}

export interface AuditLogEntry {
    id: string;
    timestamp: string;
    category: string;
    action: string;
    success: boolean;
    details?: Record<string, unknown>;
}

export class AuditLogService extends BaseService {
    private readonly entries: AuditLogEntry[] = [];

    constructor() {
        super('AuditLogService');
    }

    @ipc('audit:get-logs')
    async getLogsIpc(_event: unknown, filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> {
        try {
            return await this.getLogs(filters);
        } catch (error) {
            return [];
        }
    }

    async getLogs(filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> {
        const startMs = filters.startDate ? Date.parse(filters.startDate) : Number.NEGATIVE_INFINITY;
        const endMs = filters.endDate ? Date.parse(filters.endDate) : Number.POSITIVE_INFINITY;

        return this.entries.filter(entry => {
            const timestampMs = Date.parse(entry.timestamp);
            if (Number.isFinite(startMs) && timestampMs < startMs) {
                return false;
            }
            if (Number.isFinite(endMs) && timestampMs > endMs) {
                return false;
            }
            if (filters.category && entry.category !== filters.category) {
                return false;
            }
            return true;
        });
    }

    logFileSystemOperation(action: string, success: boolean, details?: Record<string, unknown>): void {
        this.entries.unshift({
            id: `${Date.now()}-${this.entries.length}`,
            timestamp: new Date().toISOString(),
            category: 'filesystem',
            action,
            success,
            details
        });

        if (this.entries.length > 500) {
            this.entries.length = 500;
        }
    }
}
