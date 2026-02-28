import * as fs from 'fs/promises';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { BrowserWindow } from 'electron';

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

    async initialize(): Promise<void> {
        appLogger.info('ExportService', 'Initializing Export Service...');
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
