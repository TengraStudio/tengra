import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock modules
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    }
}));


vi.mock('@main/utils/rate-limiter.util', () => ({
    withRateLimit: vi.fn(async (_key, fn) => await fn())
}));

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn()
    }
}));

// Import after mocks
import { registerHFModelIpc } from '@main/ipc/huggingface';
import type { HuggingFaceService } from '@main/services/llm/huggingface.service';
import type { LLMService } from '@main/services/llm/llm.service';

describe('HuggingFace IPC Handlers', () => {
    const ipcMainHandlers = new Map<string, CallableFunction>();
    let mockLLMService: LLMService;
    let mockHFService: HuggingFaceService;
    let mockEvent: IpcMainInvokeEvent;

    beforeEach(() => {
        vi.clearAllMocks();
        ipcMainHandlers.clear();

        // Capture IPC handlers
        vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: CallableFunction) => {
            ipcMainHandlers.set(channel, handler);
            return { channels: [channel] } as never as Electron.IpcMain;
        });

        // Mock services
        mockLLMService = {
            searchHFModels: vi.fn().mockResolvedValue({ models: [], total: 0 })
        } as never as LLMService;

        mockHFService = {
            getModelFiles: vi.fn().mockResolvedValue([]),
            downloadFile: vi.fn().mockResolvedValue({ success: true }),
            cancelPendingDownloads: vi.fn().mockResolvedValue(2),
            getRecommendations: vi.fn().mockResolvedValue([]),
            getModelPreview: vi.fn().mockResolvedValue(null),
            compareModels: vi.fn().mockResolvedValue({ previews: [], recommendation: {} }),
            validateModelCompatibility: vi.fn().mockResolvedValue({ compatible: true, reasons: [], estimatedRamGB: 4, estimatedVramGB: 2 }),
            getWatchlist: vi.fn().mockResolvedValue([]),
            addToWatchlist: vi.fn().mockResolvedValue(true),
            removeFromWatchlist: vi.fn().mockResolvedValue(true),
            getCacheStats: vi.fn().mockResolvedValue({ size: 0, maxSize: 200, ttlMs: 600000, oldestAgeMs: 0, watchlistSize: 0 }),
            clearCache: vi.fn().mockResolvedValue({ success: true, removed: 1 }),
            testDownloadedModel: vi.fn().mockResolvedValue({ success: true, metadata: {} })
        } as never as HuggingFaceService;

        mockEvent = {
            sender: {
                send: vi.fn()
            }
        } as never as IpcMainInvokeEvent;

        registerHFModelIpc(mockLLMService, mockHFService);
    });

    describe('hf:search-models', () => {
        it('should search models with valid parameters', async () => {
            const handler = ipcMainHandlers.get('hf:search-models');
            expect(handler).toBeDefined();

            vi.mocked(mockLLMService.searchHFModels).mockResolvedValue({
                models: [{ id: 'model1', name: 'Test Model', description: 'Test', author: 'test', downloads: 100, likes: 10, tags: [], lastModified: '2024-01-01' }],
                total: 1
            });

            const result = await handler!(mockEvent, 'llama', 10, 0, 'downloads');

            expect(mockLLMService.searchHFModels).toHaveBeenCalledWith('llama', 10, 0, 'downloads');
            expect(result).toEqual({ models: [{ id: 'model1', name: 'Test Model', description: 'Test', author: 'test', downloads: 100, likes: 10, tags: [], lastModified: '2024-01-01' }], total: 1 });
        });

        it('should use default values for invalid limit', async () => {
            const handler = ipcMainHandlers.get('hf:search-models');
            await handler!(mockEvent, 'test', 'invalid', 0, 'downloads');

            expect(mockLLMService.searchHFModels).toHaveBeenCalledWith('test', 10, 0, 'downloads');
        });

        it('should clamp limit to MAX_LIMIT (100)', async () => {
            const handler = ipcMainHandlers.get('hf:search-models');
            await handler!(mockEvent, 'test', 500, 0, 'downloads');

            expect(mockLLMService.searchHFModels).toHaveBeenCalledWith('test', 100, 0, 'downloads');
        });

        it('should validate sort option', async () => {
            const handler = ipcMainHandlers.get('hf:search-models');
            await handler!(mockEvent, 'test', 10, 0, 'invalid-sort');

            expect(mockLLMService.searchHFModels).toHaveBeenCalledWith('test', 10, 0, 'downloads');
        });

        it('should accept valid sort options', async () => {
            const handler = ipcMainHandlers.get('hf:search-models');

            for (const sort of ['downloads', 'likes', 'trending', 'lastModified']) {
                await handler!(mockEvent, 'test', 10, 0, sort);
                expect(mockLLMService.searchHFModels).toHaveBeenCalledWith('test', 10, 0, sort);
            }
        });

        it('should return default value on error', async () => {
            const handler = ipcMainHandlers.get('hf:search-models');
            vi.mocked(mockLLMService.searchHFModels).mockRejectedValue(new Error('Network error'));

            const result = await handler!(mockEvent, 'test', 10, 0, 'downloads');

            expect(result).toEqual({ models: [], total: 0 });
        });

        it('should trim and truncate query strings', async () => {
            const handler = ipcMainHandlers.get('hf:search-models');
            const longQuery = 'a'.repeat(300);
            await handler!(mockEvent, `  ${longQuery}  `, 10, 0, 'downloads');

            const calls = vi.mocked(mockLLMService.searchHFModels).mock.calls;
            expect(calls[0][0]).toHaveLength(256); // MAX_QUERY_LENGTH
        });
    });

    describe('hf:get-files', () => {
        it('should get model files with valid model ID', async () => {
            const handler = ipcMainHandlers.get('hf:get-files');
            expect(handler).toBeDefined();

            vi.mocked(mockHFService.getModelFiles).mockResolvedValue([
                { path: 'model.gguf', size: 1024, oid: undefined, quantization: 'Q4' }
            ]);

            const result = await handler!(mockEvent, 'meta-llama/Llama-2-7b');

            expect(mockHFService.getModelFiles).toHaveBeenCalledWith('meta-llama/Llama-2-7b');
            expect(result).toEqual([{ path: 'model.gguf', size: 1024, oid: undefined, quantization: 'Q4' }]);
        });

        it('should reject model IDs with dangerous characters', async () => {
            const handler = ipcMainHandlers.get('hf:get-files');

            const result = await handler!(mockEvent, 'model<script>alert(1)</script>');

            expect(result).toEqual([]);
        });

        it('should reject non-string model IDs', async () => {
            const handler = ipcMainHandlers.get('hf:get-files');

            const result = await handler!(mockEvent, 123);

            expect(result).toEqual([]);
        });

        it('should reject empty model IDs', async () => {
            const handler = ipcMainHandlers.get('hf:get-files');

            const result = await handler!(mockEvent, '   ');

            expect(result).toEqual([]);
        });

        it('should reject model IDs exceeding max length', async () => {
            const handler = ipcMainHandlers.get('hf:get-files');
            const longId = 'a'.repeat(300);

            const result = await handler!(mockEvent, longId);

            expect(result).toEqual([]);
        });
    });

    describe('hf:download-file', () => {
        it('should download file with valid parameters', async () => {
            const handler = ipcMainHandlers.get('hf:download-file');
            expect(handler).toBeDefined();

            const url = 'https://huggingface.co/meta-llama/Llama-2-7b/resolve/main/model.gguf';
            const outputPath = '/path/to/model.gguf';

            await handler!(mockEvent, {
                url,
                outputPath,
                expectedSize: 1024000,
                expectedSha256: 'abc123'.padEnd(64, '0')
            });


            expect(mockHFService.downloadFile).toHaveBeenCalled();
            const args = vi.mocked(mockHFService.downloadFile).mock.calls[0];
            expect(args[0]).toBe(url);
            expect(args[1]).toBe(outputPath);
            expect(args[2]?.expectedSize).toBe(1024000);
            expect(args[2]?.expectedSha256).toBe('abc123'.padEnd(64, '0'));
            expect(typeof args[2]?.onProgress).toBe('function');
        });

        it('should reject non-https URLs', async () => {
            const handler = ipcMainHandlers.get('hf:download-file');

            await expect(
                handler!(mockEvent, { url: 'http://huggingface.co/model.gguf', outputPath: '/path/out', expectedSize: 0, expectedSha256: '' })
            ).rejects.toThrow('Invalid URL or output path');

        });

        it('should reject non-huggingface URLs', async () => {
            const handler = ipcMainHandlers.get('hf:download-file');

            await expect(
                handler!(mockEvent, { url: 'https://evil.com/model.gguf', outputPath: '/path/out', expectedSize: 0, expectedSha256: '' })
            ).rejects.toThrow('Invalid URL or output path');

        });

        it('should reject invalid output paths', async () => {
            const handler = ipcMainHandlers.get('hf:download-file');
            const url = 'https://huggingface.co/model.gguf';

            await expect(
                handler!(mockEvent, { url, outputPath: '', expectedSize: 0, expectedSha256: '' })
            ).rejects.toThrow('Invalid URL or output path');

        });

        it('should validate SHA256 format', async () => {
            const handler = ipcMainHandlers.get('hf:download-file');
            const url = 'https://huggingface.co/model.gguf';
            const outputPath = '/path/to/model.gguf';

            // Invalid SHA256 (not 64 hex chars)
            await handler!(mockEvent, { url, outputPath, expectedSize: 1024, expectedSha256: 'invalid-sha' });


            const args = vi.mocked(mockHFService.downloadFile).mock.calls[0];
            expect(args[2]?.expectedSha256).toBe(''); // Should be empty string due to validation
        });

        it('should send progress events during download', async () => {
            const handler = ipcMainHandlers.get('hf:download-file');
            const url = 'https://huggingface.co/model.gguf';
            const outputPath = '/path/to/model.gguf';

            vi.mocked(mockHFService.downloadFile).mockImplementation(async (_url: string, _path: string, options: { onProgress?: (received: number, total: number) => void }) => {
                if (options.onProgress) {
                    options.onProgress(512, 1024);
                }
                return { success: true };
            });

            await handler!(mockEvent, { url, outputPath, expectedSize: 1024, expectedSha256: '' });


            expect(mockEvent.sender.send).toHaveBeenCalledWith('hf:download-progress', {
                filename: outputPath,
                received: 512,
                total: 1024
            });
        });
    });

    describe('hf:cancel-download', () => {
        it('should return cancelled status', async () => {
            const handler = ipcMainHandlers.get('hf:cancel-download');
            expect(handler).toBeDefined();

            const result = await handler!(mockEvent);

            expect(result).toEqual({ cancelled: true, pendingCancelled: 2 });
        });

        it('should handle cancellation placeholder', async () => {
            const handler = ipcMainHandlers.get('hf:cancel-download');

            // Current implementation is a placeholder that always succeeds
            const result = await handler!(mockEvent);

            expect(result).toHaveProperty('cancelled');
        });
    });

    describe('hf:test-downloaded-model', () => {
        it('should invoke file test endpoint', async () => {
            const handler = ipcMainHandlers.get('hf:test-downloaded-model');
            expect(handler).toBeDefined();

            vi.mocked(mockHFService.testDownloadedModel).mockResolvedValue({
                success: true,
                metadata: { architecture: 'llama', contextLength: 4096 }
            });

            const result = await handler!(mockEvent, 'C:/models/test.gguf');
            expect(result).toEqual({
                success: true,
                metadata: { architecture: 'llama', contextLength: 4096 }
            });
        });
    });
});
