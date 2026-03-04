import { registerExportIpc } from '@main/ipc/export';
import { IpcMainInvokeEvent } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Electron ipcMain
const ipcMainHandlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel, handler) => {
            ipcMainHandlers.set(channel, handler);
        }),
        removeHandler: vi.fn()
    }
}));

// Mock IPC Wrapper

// Mock logger
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn()
    }
}));

// Mock ExportService
const mockExportService = {
    exportToMarkdown: vi.fn(),
    exportToPDF: vi.fn()
};

describe('Export IPC Integration', () => {
    beforeEach(() => {
        ipcMainHandlers.clear();
        vi.clearAllMocks();
    });

    const initIPC = () => {
        registerExportIpc(() => null, mockExportService as never);
    };

    it('should register expected handlers', () => {
        initIPC();
        expect(ipcMainHandlers.has('export:markdown')).toBe(true);
        expect(ipcMainHandlers.has('export:pdf')).toBe(true);
    });

    describe('export:markdown', () => {
        it('should export markdown with valid content', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('export:markdown');

            mockExportService.exportToMarkdown.mockResolvedValue({
                success: true,
                filePath: '/exports/document.md'
            });

            const content = '# Hello World\n\nThis is markdown content.';
            const filePath = '/exports/document.md';

            const result = await handler?.({} as IpcMainInvokeEvent, content, filePath);

            expect(mockExportService.exportToMarkdown).toHaveBeenCalledWith(content, filePath);
            expect(result).toMatchObject({
                success: true,
                data: {
                    success: true,
                    filePath: '/exports/document.md'
                }
            });
        });

        it('should reject non-string content', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('export:markdown');

            const result = await handler?.({} as IpcMainInvokeEvent, 123, '/exports/document.md');

            expect(mockExportService.exportToMarkdown).not.toHaveBeenCalled();
            expect(result).toMatchObject({
                success: false,
                error: { message: 'Invalid export parameters', code: 'IPC_HANDLER_ERROR' }
            });
        });

        it('should reject non-string filePath', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('export:markdown');

            const content = '# Hello World';

            const result = await handler?.({} as IpcMainInvokeEvent, content, 123);

            expect(mockExportService.exportToMarkdown).not.toHaveBeenCalled();
            expect(result).toMatchObject({
                success: false,
                error: { message: 'Invalid export parameters', code: 'IPC_HANDLER_ERROR' }
            });
        });

        it('should reject oversized content', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('export:markdown');

            const MAX_CONTENT_SIZE = 50 * 1024 * 1024;
            const oversizedContent = 'a'.repeat(MAX_CONTENT_SIZE + 1);

            const result = await handler?.({} as IpcMainInvokeEvent, oversizedContent, '/exports/document.md');

            expect(mockExportService.exportToMarkdown).not.toHaveBeenCalled();
            expect(result).toMatchObject({
                success: false,
                error: { message: 'Invalid export parameters', code: 'IPC_HANDLER_ERROR' }
            });
        });

        it('should reject empty filePath', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('export:markdown');

            const content = '# Hello World';

            const result = await handler?.({} as IpcMainInvokeEvent, content, '');

            expect(mockExportService.exportToMarkdown).not.toHaveBeenCalled();
            expect(result).toMatchObject({
                success: false,
                error: { message: 'Invalid export parameters', code: 'IPC_HANDLER_ERROR' }
            });
        });

        it('should reject whitespace-only filePath', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('export:markdown');

            const content = '# Hello World';

            const result = await handler?.({} as IpcMainInvokeEvent, content, '   ');

            expect(mockExportService.exportToMarkdown).not.toHaveBeenCalled();
            expect(result).toMatchObject({
                success: false,
                error: { message: 'Invalid export parameters', code: 'IPC_HANDLER_ERROR' }
            });
        });

        it('should reject filePath exceeding max length', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('export:markdown');

            const MAX_PATH_LENGTH = 1024;
            const longPath = '/exports/' + 'a'.repeat(MAX_PATH_LENGTH);
            const content = '# Hello World';

            const result = await handler?.({} as IpcMainInvokeEvent, content, longPath);

            expect(mockExportService.exportToMarkdown).not.toHaveBeenCalled();
            expect(result).toMatchObject({
                success: false,
                error: { message: 'Invalid export parameters', code: 'IPC_HANDLER_ERROR' }
            });
        });

        it('should trim whitespace from filePath', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('export:markdown');

            mockExportService.exportToMarkdown.mockResolvedValue({
                success: true,
                filePath: '/exports/document.md'
            });

            const content = '# Hello World';
            const filePath = '  /exports/document.md  ';

            const result = await handler?.({} as IpcMainInvokeEvent, content, filePath);

            expect(mockExportService.exportToMarkdown).toHaveBeenCalledWith(content, '/exports/document.md');
            expect((result as Record<string, unknown>).success).toBe(true);
        });
    });

    describe('export:pdf', () => {
        it('should export PDF with valid content', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('export:pdf');

            mockExportService.exportToPDF.mockResolvedValue({
                success: true,
                filePath: '/exports/document.pdf'
            });

            const htmlContent = '<html><body><h1>Hello World</h1></body></html>';
            const filePath = '/exports/document.pdf';

            const result = await handler?.({} as IpcMainInvokeEvent, htmlContent, filePath);

            expect(mockExportService.exportToPDF).toHaveBeenCalledWith(htmlContent, filePath);
            expect(result).toMatchObject({
                success: true,
                data: {
                    success: true,
                    filePath: '/exports/document.pdf'
                }
            });
        });

        it('should reject non-string HTML content', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('export:pdf');

            const result = await handler?.({} as IpcMainInvokeEvent, { html: 'invalid' }, '/exports/document.pdf');

            expect(mockExportService.exportToPDF).not.toHaveBeenCalled();
            expect(result).toMatchObject({
                success: false,
                error: { message: 'Invalid export parameters', code: 'IPC_HANDLER_ERROR' }
            });
        });

        it('should reject non-string filePath', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('export:pdf');

            const htmlContent = '<html><body><h1>Test</h1></body></html>';

            const result = await handler?.({} as IpcMainInvokeEvent, htmlContent, null);

            expect(mockExportService.exportToPDF).not.toHaveBeenCalled();
            expect(result).toMatchObject({
                success: false,
                error: { message: 'Invalid export parameters', code: 'IPC_HANDLER_ERROR' }
            });
        });

        it('should reject oversized HTML content', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('export:pdf');

            const MAX_CONTENT_SIZE = 50 * 1024 * 1024;
            const oversizedContent = '<html><body>' + 'a'.repeat(MAX_CONTENT_SIZE) + '</body></html>';

            const result = await handler?.({} as IpcMainInvokeEvent, oversizedContent, '/exports/document.pdf');

            expect(mockExportService.exportToPDF).not.toHaveBeenCalled();
            expect(result).toMatchObject({
                success: false,
                error: { message: 'Invalid export parameters', code: 'IPC_HANDLER_ERROR' }
            });
        });

        it('should reject empty filePath', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('export:pdf');

            const htmlContent = '<html><body><h1>Test</h1></body></html>';

            const result = await handler?.({} as IpcMainInvokeEvent, htmlContent, '');

            expect(mockExportService.exportToPDF).not.toHaveBeenCalled();
            expect(result).toMatchObject({
                success: false,
                error: { message: 'Invalid export parameters', code: 'IPC_HANDLER_ERROR' }
            });
        });

        it('should reject filePath exceeding max length', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('export:pdf');

            const MAX_PATH_LENGTH = 1024;
            const longPath = '/exports/' + 'a'.repeat(MAX_PATH_LENGTH);
            const htmlContent = '<html><body><h1>Test</h1></body></html>';

            const result = await handler?.({} as IpcMainInvokeEvent, htmlContent, longPath);

            expect(mockExportService.exportToPDF).not.toHaveBeenCalled();
            expect(result).toMatchObject({
                success: false,
                error: { message: 'Invalid export parameters', code: 'IPC_HANDLER_ERROR' }
            });
        });

        it('should trim whitespace from filePath', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('export:pdf');

            mockExportService.exportToPDF.mockResolvedValue({
                success: true,
                filePath: '/exports/document.pdf'
            });

            const htmlContent = '<html><body><h1>Test</h1></body></html>';
            const filePath = '  /exports/document.pdf  ';

            const result = await handler?.({} as IpcMainInvokeEvent, htmlContent, filePath);

            expect(mockExportService.exportToPDF).toHaveBeenCalledWith(htmlContent, '/exports/document.pdf');
            expect((result as Record<string, unknown>).success).toBe(true);
        });

        it('should handle export service errors', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('export:pdf');

            mockExportService.exportToPDF.mockRejectedValue(new Error('PDF generation failed'));

            const htmlContent = '<html><body><h1>Test</h1></body></html>';
            const filePath = '/exports/document.pdf';

            const result = await handler?.({} as IpcMainInvokeEvent, htmlContent, filePath);

            expect(result).toMatchObject({
                success: false,
                error: { message: 'Internal server error', code: 'ERROR' }
            });
        });
    });
});
