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
 * File Change Tracker Service
 * Tracks all AI-initiated file changes and generates diffs
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import { ipc } from '@main/core/ipc-decorators';
import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { FILES_CHANNELS } from '@shared/constants/ipc-channels';
import { JsonObject } from '@shared/types/common';
import { AISystemType, DiffStats, FileDiff } from '@shared/types/file-diff';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { createPatch } from 'diff';
import { v4 as uuidv4 } from 'uuid';

interface FileChangeContext {
    aiSystem: AISystemType
    chatSessionId?: string
    changeReason?: string
    metadata?: JsonObject
}

export class FileChangeTracker extends BaseService {
    private initialized = false;

    constructor(
        public databaseService: DatabaseService,
        private eventBusService: EventBusService
    ) {
        super('FileChangeTracker');
    }

    async initialize(): Promise<void> {
        if (this.initialized) { return; }

        appLogger.info(this.name, 'Initializing file change tracking...');
        await this.ensureDiffTable();
        this.initialized = true;
        appLogger.info(this.name, 'File change tracking initialized');
    }

    async cleanup(): Promise<void> {
        appLogger.info(this.name, 'Cleaning up file change tracker...');
        this.initialized = false;
    }

    /**
     * Track a file change by generating and storing a diff
     */
    async trackFileChange(
        filePath: string,
        beforeContent: string,
        afterContent: string,
        context: FileChangeContext
    ): Promise<FileDiff | null> {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            // Skip tracking if content is identical
            if (beforeContent === afterContent) {
                return null;
            }

            const diffContent = this.generateDiff(filePath, beforeContent, afterContent);
            const timestamp = Date.now();

            const fileDiff: FileDiff = {
                id: uuidv4(),
                chatSessionId: context.chatSessionId,
                aiSystem: context.aiSystem,
                filePath: path.resolve(filePath),
                beforeContent,
                afterContent,
                diffContent,
                timestamp,
                changeReason: context.changeReason,
                metadata: context.metadata as JsonObject
            };

            // Store in database
            await this.storeDiff(fileDiff);

            // Emit event for real-time updates
            this.eventBusService.emit('file-changed', {
                path: fileDiff.filePath,
                type: 'update'
            });

            appLogger.info(this.name, `Tracked file change: ${path.basename(filePath)} (${context.aiSystem})`);
            return fileDiff;

        } catch (error) {
            appLogger.error(this.name, 'Failed to track file change', error as Error);
            return null;
        }
    }

    /**
     * Generate diff statistics
     */
    getDiffStats(diffContent: string): DiffStats {
        const lines = diffContent.split('\n');
        let additions = 0;
        let deletions = 0;

        for (const line of lines) {
            if (line.startsWith('+') && !line.startsWith('+++')) {
                additions++;
            } else if (line.startsWith('-') && !line.startsWith('---')) {
                deletions++;
            }
        }

        return {
            additions,
            deletions,
            changes: additions + deletions
        };
    }

    /**
     * Get a specific file diff by ID (IPC)
     */
    @ipc(FILES_CHANNELS.GET_FILE_DIFF)
    async getFileDiffIpc(_diffId: string) {
        const row = await this.databaseService.getFileDiff(_diffId);
        if (!row) {
            return { success: false, error: 'Diff not found' };
        }
        const raw = typeof row.diff === 'string' ? row.diff : '';
        const parsed = raw ? safeJsonParse<FileDiff | null>(raw, null) : null;
        if (!parsed) {
            return { success: false, error: 'Invalid diff data' };
        }
        return { success: true, data: parsed };
    }

    /**
     * Revert a file to its previous state
     */
    @ipc(FILES_CHANNELS.REVERT_FILE_CHANGE)
    async revertFileChange(diffId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const row = await this.databaseService.getFileDiff(diffId);
            if (!row) {
                return { success: false, error: 'Diff not found' };
            }

            const raw = typeof row.diff === 'string' ? row.diff : '';
            const parsed = raw ? safeJsonParse<FileDiff | null>(raw, null) : null;
            if (!parsed || typeof parsed.filePath !== 'string') {
                return { success: false, error: 'Invalid diff payload' };
            }

            // If the file didn't exist before (AI created it), undo should delete it.
            const metadata = parsed.metadata as JsonObject | undefined;
            const existedBefore = metadata && typeof metadata['existedBefore'] === 'boolean'
                ? Boolean(metadata['existedBefore'])
                : true;

            if (!existedBefore) {
                try {
                    await fs.unlink(parsed.filePath);
                } catch {
                    // Ignore if already removed
                }
                appLogger.info(this.name, `Reverted file change by deleting created file: ${path.basename(String(parsed.filePath))}`);
                return { success: true };
            }

            // Otherwise write the previous content back to the file.
            if (typeof parsed.beforeContent === 'string') {
                await fs.writeFile(parsed.filePath, parsed.beforeContent, 'utf-8');
            }

            appLogger.info(this.name, `Reverted file change: ${path.basename(String(parsed.filePath))}`);
            return { success: true };

        } catch (error) {
            const errorMsg = getErrorMessage(error as Error);
            appLogger.error(this.name, 'Failed to revert file change', error as Error);
            return { success: false, error: errorMsg };
        }
    }

    // Private methods

    private generateDiff(filePath: string, beforeContent: string, afterContent: string): string {
        const fileName = path.basename(filePath);
        return createPatch(fileName, beforeContent, afterContent, 'before', 'after');
    }

    private async storeDiff(fileDiff: FileDiff): Promise<void> {
        await this.databaseService.storeFileDiff(fileDiff);
    }

    private async ensureDiffTable(): Promise<void> {
        try {
            await this.databaseService.ensureFileDiffTable();
        } catch (error) {
            appLogger.error(this.name, 'Failed to ensure diff table', error as Error);
            throw error;
        }
    }
}

