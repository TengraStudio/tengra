/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as fs from 'fs/promises';

import { ipc } from '@main/core/ipc-decorators';
import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { serializeToIpc } from '@main/utils/ipc-serializer.util';
import { EXPORT_CHANNELS } from '@shared/constants/ipc-channels';
import { RuntimeValue } from '@shared/types/common';
import { BrowserWindow } from 'electron';

const MAX_CONTENT_SIZE = 50 * 1024 * 1024;
const MAX_PATH_LENGTH = 1024;

export interface ExportOptions {
    format: 'markdown' | 'pdf'
    includeThoughts?: boolean
    includeImages?: boolean
}

export class ExportService extends BaseService {
    private pdfExportQueue: Promise<void> = Promise.resolve();

    constructor() {
        super('ExportService');
    }

    private validateExportInput(content: RuntimeValue, filePath: RuntimeValue): { content: string; filePath: string } {
        if (typeof content !== 'string' || typeof filePath !== 'string') {
            throw new Error('Invalid export parameters: content and filePath must be strings');
        }

        if (content.length > MAX_CONTENT_SIZE) {
            throw new Error('Export content exceeds maximum allowed size (50MB)');
        }

        if (!filePath.trim() || filePath.length > MAX_PATH_LENGTH) {
            throw new Error('Invalid or too long file path');
        }

        return { content, filePath: filePath.trim() };
    }

    @ipc(EXPORT_CHANNELS.MARKDOWN)
    async exportToMarkdownIpc(contentRaw: RuntimeValue, filePathRaw: RuntimeValue): Promise<RuntimeValue> {
        const validated = this.validateExportInput(contentRaw, filePathRaw);
        const result = await this.exportToMarkdown(validated.content, validated.filePath);
        return serializeToIpc(result);
    }

    @ipc(EXPORT_CHANNELS.PDF)
    async exportToPDFIpc(htmlContentRaw: RuntimeValue, filePathRaw: RuntimeValue): Promise<RuntimeValue> {
        const validated = this.validateExportInput(htmlContentRaw, filePathRaw);
        const result = await this.exportToPDF(validated.content, validated.filePath);
        return serializeToIpc(result);
    }

    async initialize(): Promise<void> {
        appLogger.info('ExportService', 'Initializing Export Service...');
    }

    /** Drains the PDF export queue. */
    async cleanup(): Promise<void> {
        await this.pdfExportQueue;
        appLogger.info('ExportService', 'Export service cleaned up');
    }

    async exportToMarkdown(content: string, filePath: string): Promise<{ success: boolean; error?: string }> {
        try {
            await fs.writeFile(filePath, content, 'utf-8');
            return { success: true };
        } catch (error) {
            appLogger.error('ExportService', 'Failed to export to Markdown', error as Error);
            return { success: false, error: (error as Error).message };
        }
    }

    async exportToPDF(htmlContent: string, filePath: string): Promise<{ success: boolean; error?: string }> {
        return await new Promise(resolve => {
            this.pdfExportQueue = this.pdfExportQueue
                .then(async () => {
                    const result = await this.exportToPDFInternal(htmlContent, filePath);
                    resolve(result);
                })
                .catch(error => {
                    appLogger.error('ExportService', 'Failed to process PDF export queue', error as Error);
                    resolve({ success: false, error: (error as Error).message });
                });
        });
    }

    private async exportToPDFInternal(htmlContent: string, filePath: string): Promise<{ success: boolean; error?: string }> {
        let printWindow: BrowserWindow | null = null;
        try {
            printWindow = new BrowserWindow({
                show: false,
                webPreferences: {
                    sandbox: true,
                    contextIsolation: true,
                    nodeIntegration: false
                }
            });

            await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

            const pdfData = await printWindow.webContents.printToPDF({
                printBackground: true,
                pageSize: 'A4',
                margins: { top: 1, bottom: 1, left: 1, right: 1 } // inches? Electron uses inches or microns usually, verify docs if issues arise. 0 is none.
                // 1 might be too big if inches, usually it's inches. Let's try 0.5 or allow CSS to handle it mostly.
            });

            await fs.writeFile(filePath, pdfData);
            return { success: true };
        } catch (error) {
            appLogger.error('ExportService', 'Failed to export to PDF', error as Error);
            return { success: false, error: (error as Error).message };
        } finally {
            if (printWindow) {
                printWindow.close();
            }
        }
    }
}

