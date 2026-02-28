import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock electron
const mockIpcMainHandlers = new Map<string, (...args: any[]) => any>();
vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
            mockIpcMainHandlers.set(channel, handler);
        }),
        removeHandler: vi.fn((channel: string) => {
            mockIpcMainHandlers.delete(channel);
        }),
    },
}));

// Mock logger
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

// Mock IPC wrapper
vi.mock('@main/utils/ipc-wrapper.util', () => ({
    createSafeIpcHandler: (_name: string, handler: (...args: any[]) => any, fallback: any) => async (...args: any[]) => {
        try {
            const result = await handler(...args);
            return result;
        } catch {
            return fallback;
        }
    },
}));

// Mock LocalImageService
vi.mock('@main/services/llm/local-image.service', () => ({
    LocalImageService: vi.fn(),
}));

// Import the module under test AFTER mocks
import { registerSdCppIpc } from '@main/ipc/sd-cpp';

describe('SD-CPP IPC Integration', () => {
    let mockLocalImageService: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockIpcMainHandlers.clear();

        mockLocalImageService = {
            getSDCppStatus: vi.fn(),
            repairSDCpp: vi.fn(),
        };

        registerSdCppIpc(mockLocalImageService);
    });

    it('should register expected handlers', () => {
        const requiredChannels = [
            'sd-cpp:getStatus',
            'sd-cpp:reinstall',
            'sd-cpp:getHistory',
            'sd-cpp:searchHistory',
            'sd-cpp:exportHistory',
            'sd-cpp:regenerate',
            'sd-cpp:getAnalytics',
            'sd-cpp:getPresetAnalytics',
            'sd-cpp:getScheduleAnalytics',
            'sd-cpp:listPresets',
            'sd-cpp:savePreset',
            'sd-cpp:deletePreset',
            'sd-cpp:exportPresetShare',
            'sd-cpp:importPresetShare',
            'sd-cpp:listWorkflowTemplates',
            'sd-cpp:saveWorkflowTemplate',
            'sd-cpp:deleteWorkflowTemplate',
            'sd-cpp:exportWorkflowTemplateShare',
            'sd-cpp:importWorkflowTemplateShare',
            'sd-cpp:schedule',
            'sd-cpp:listSchedules',
            'sd-cpp:cancelSchedule',
            'sd-cpp:compare',
            'sd-cpp:exportComparison',
            'sd-cpp:shareComparison',
            'sd-cpp:batchGenerate',
            'sd-cpp:getQueueStats',
            'sd-cpp:edit',
        ];
        requiredChannels.forEach(channel => {
            expect(mockIpcMainHandlers.has(channel)).toBe(true);
        });
        expect(mockIpcMainHandlers.size).toBe(requiredChannels.length);
    });

    describe('sd-cpp:getStatus', () => {
        it('should return status from service', async () => {
            vi.mocked(mockLocalImageService.getSDCppStatus).mockResolvedValue('ready');

            const handler = mockIpcMainHandlers.get('sd-cpp:getStatus');
            expect(handler).toBeDefined();

            const result = await handler!({});

            expect(mockLocalImageService.getSDCppStatus).toHaveBeenCalled();
            expect(result).toBe('ready');
        });

        it('should return different statuses', async () => {
            const handler = mockIpcMainHandlers.get('sd-cpp:getStatus');

            vi.mocked(mockLocalImageService.getSDCppStatus).mockResolvedValue('notConfigured');
            expect(await handler!({})).toBe('notConfigured');

            vi.mocked(mockLocalImageService.getSDCppStatus).mockResolvedValue('installing');
            expect(await handler!({})).toBe('installing');

            vi.mocked(mockLocalImageService.getSDCppStatus).mockResolvedValue('error');
            expect(await handler!({})).toBe('error');
        });

        it('should return notConfigured on service error', async () => {
            vi.mocked(mockLocalImageService.getSDCppStatus).mockRejectedValue(new Error('Service error'));

            const handler = mockIpcMainHandlers.get('sd-cpp:getStatus');
            const result = await handler!({});

            expect(result).toBe('notConfigured');
        });
    });

    describe('sd-cpp:reinstall', () => {
        it('should trigger repair', async () => {
            vi.mocked(mockLocalImageService.repairSDCpp).mockResolvedValue(undefined);

            const handler = mockIpcMainHandlers.get('sd-cpp:reinstall');
            expect(handler).toBeDefined();

            await handler!({});

            expect(mockLocalImageService.repairSDCpp).toHaveBeenCalled();
        });

        it('should handle repair errors gracefully', async () => {
            vi.mocked(mockLocalImageService.repairSDCpp).mockRejectedValue(new Error('Repair failed'));

            const handler = mockIpcMainHandlers.get('sd-cpp:reinstall');
            const result = await handler!({});

            // Safe handler returns void 0 as fallback
            expect(result).toBe(undefined);
        });

        it('should not throw on service failure', async () => {
            vi.mocked(mockLocalImageService.repairSDCpp).mockRejectedValue(new Error('Critical error'));

            const handler = mockIpcMainHandlers.get('sd-cpp:reinstall');

            // Should not throw
            await expect(handler!({})).resolves.toBe(undefined);
        });
    });
});
