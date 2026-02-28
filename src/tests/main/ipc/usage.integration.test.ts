import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock electron
const mockIpcMainHandlers = new Map<string, (...args: unknown[]) => unknown>();
vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
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

// Mock rate limiter
vi.mock('@main/utils/rate-limiter.util', () => ({
    withRateLimit: vi.fn(async (_key: string, fn: () => unknown) => await fn()),
}));

// Mock error util
vi.mock('@shared/utils/error.util', () => ({
    getErrorMessage: vi.fn((error: unknown) => error?.message || String(error)),
}));

// Mock services
vi.mock('@main/services/analysis/usage-tracking.service', () => ({
    UsageTrackingService: vi.fn(),
}));

vi.mock('@main/services/system/settings.service', () => ({
    SettingsService: vi.fn(),
}));

vi.mock('@main/services/proxy/proxy.service', () => ({
    ProxyService: vi.fn(),
}));

// Import the module under test AFTER mocks
import { registerUsageIpc } from '@main/ipc/usage';
import { appLogger } from '@main/logging/logger';
import { withRateLimit } from '@main/utils/rate-limiter.util';

describe('Usage IPC Integration', () => {
    let mockUsageTrackingService: Record<string, ReturnType<typeof vi.fn>>;
    let mockSettingsService: Record<string, ReturnType<typeof vi.fn>>;
    let mockProxyService: Record<string, ReturnType<typeof vi.fn>>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockIpcMainHandlers.clear();

        mockUsageTrackingService = {
            checkLimit: vi.fn(),
            getUsageCount: vi.fn(),
            recordUsage: vi.fn(),
        };

        mockSettingsService = {
            getSettings: vi.fn(),
        };

        mockProxyService = {
            getCopilotQuota: vi.fn(),
        };

        registerUsageIpc(mockUsageTrackingService, mockSettingsService, mockProxyService);
    });

    it('should register expected handlers', () => {
        expect(mockIpcMainHandlers.has('usage:checkLimit')).toBe(true);
        expect(mockIpcMainHandlers.has('usage:getUsageCount')).toBe(true);
        expect(mockIpcMainHandlers.has('usage:recordUsage')).toBe(true);
        expect(mockIpcMainHandlers.size).toBe(3);
    });

    describe('usage:checkLimit', () => {
        it('should check limit for non-copilot provider', async () => {
            const mockSettings = { apiKeys: {} };
            vi.mocked(mockSettingsService.getSettings).mockReturnValue(mockSettings);
            vi.mocked(mockUsageTrackingService.checkLimit).mockResolvedValue({ allowed: true, remaining: 100 });

            const handler = mockIpcMainHandlers.get('usage:checkLimit');
            expect(handler).toBeDefined();

            const result = await handler!({}, 'openai', 'gpt-4');

            expect(mockSettingsService.getSettings).toHaveBeenCalled();
            expect(mockUsageTrackingService.checkLimit).toHaveBeenCalledWith(
                mockSettings,
                'openai',
                'gpt-4',
                undefined
            );
            expect(result).toEqual({ allowed: true, remaining: 100 });
        });

        it('should check limit with copilot quota', async () => {
            const mockSettings = { apiKeys: {} };
            const mockCopilotQuota = {
                accounts: [{ remaining: 50, limit: 100 }],
            };

            vi.mocked(mockSettingsService.getSettings).mockReturnValue(mockSettings);
            vi.mocked(mockProxyService.getCopilotQuota).mockResolvedValue(mockCopilotQuota);
            vi.mocked(mockUsageTrackingService.checkLimit).mockResolvedValue({ allowed: true, remaining: 50 });

            const handler = mockIpcMainHandlers.get('usage:checkLimit');
            const result = await handler!({}, 'copilot', 'claude-sonnet');

            expect(mockProxyService.getCopilotQuota).toHaveBeenCalled();
            expect(mockUsageTrackingService.checkLimit).toHaveBeenCalledWith(
                mockSettings,
                'copilot',
                'claude-sonnet',
                { remaining: 50, limit: 100 }
            );
            expect(result).toEqual({ allowed: true, remaining: 50 });
        });

        it('should handle copilot quota fetch failure gracefully', async () => {
            const mockSettings = { apiKeys: {} };

            vi.mocked(mockSettingsService.getSettings).mockReturnValue(mockSettings);
            vi.mocked(mockProxyService.getCopilotQuota).mockRejectedValue(new Error('Quota fetch failed'));
            vi.mocked(mockUsageTrackingService.checkLimit).mockResolvedValue({ allowed: true, remaining: 0 });

            const handler = mockIpcMainHandlers.get('usage:checkLimit');
            await handler!({}, 'copilot', 'claude-sonnet');

            expect(appLogger.warn).toHaveBeenCalledWith(
                'UsageIPC',
                expect.stringContaining('Failed to get copilot quota')
            );
            expect(mockUsageTrackingService.checkLimit).toHaveBeenCalledWith(
                mockSettings,
                'copilot',
                'claude-sonnet',
                undefined
            );
        });

        it('should return limit exceeded status', async () => {
            const mockSettings = { apiKeys: {} };
            vi.mocked(mockSettingsService.getSettings).mockReturnValue(mockSettings);
            vi.mocked(mockUsageTrackingService.checkLimit).mockResolvedValue({ allowed: false, remaining: 0 });

            const handler = mockIpcMainHandlers.get('usage:checkLimit');
            const result = await handler!({}, 'anthropic', 'claude-3-opus');

            expect(result).toEqual({ allowed: false, remaining: 0 });
        });
    });

    describe('usage:getUsageCount', () => {
        it('should get usage count for hourly period', async () => {
            vi.mocked(mockUsageTrackingService.getUsageCount).mockResolvedValue(42);

            const handler = mockIpcMainHandlers.get('usage:getUsageCount');
            expect(handler).toBeDefined();

            const result = await handler!({}, 'hourly');

            expect(mockUsageTrackingService.getUsageCount).toHaveBeenCalledWith('hourly', undefined, undefined);
            expect(result).toBe(42);
        });

        it('should get usage count with provider filter', async () => {
            vi.mocked(mockUsageTrackingService.getUsageCount).mockResolvedValue(15);

            const handler = mockIpcMainHandlers.get('usage:getUsageCount');
            const result = await handler!({}, 'daily', 'openai');

            expect(mockUsageTrackingService.getUsageCount).toHaveBeenCalledWith('daily', 'openai', undefined);
            expect(result).toBe(15);
        });

        it('should get usage count with provider and model filter', async () => {
            vi.mocked(mockUsageTrackingService.getUsageCount).mockResolvedValue(7);

            const handler = mockIpcMainHandlers.get('usage:getUsageCount');
            const result = await handler!({}, 'weekly', 'anthropic', 'claude-3-sonnet');

            expect(mockUsageTrackingService.getUsageCount).toHaveBeenCalledWith('weekly', 'anthropic', 'claude-3-sonnet');
            expect(result).toBe(7);
        });

        it('should handle zero usage', async () => {
            vi.mocked(mockUsageTrackingService.getUsageCount).mockResolvedValue(0);

            const handler = mockIpcMainHandlers.get('usage:getUsageCount');
            const result = await handler!({}, 'hourly');

            expect(result).toBe(0);
        });

        it('should support all period types', async () => {
            const handler = mockIpcMainHandlers.get('usage:getUsageCount');
            vi.mocked(mockUsageTrackingService.getUsageCount).mockResolvedValue(1);

            await handler!({}, 'hourly');
            expect(mockUsageTrackingService.getUsageCount).toHaveBeenCalledWith('hourly', undefined, undefined);

            await handler!({}, 'daily');
            expect(mockUsageTrackingService.getUsageCount).toHaveBeenCalledWith('daily', undefined, undefined);

            await handler!({}, 'weekly');
            expect(mockUsageTrackingService.getUsageCount).toHaveBeenCalledWith('weekly', undefined, undefined);
        });
    });

    describe('usage:recordUsage', () => {
        it('should record usage with rate limiting', async () => {
            vi.mocked(mockUsageTrackingService.recordUsage).mockResolvedValue(undefined);

            const handler = mockIpcMainHandlers.get('usage:recordUsage');
            expect(handler).toBeDefined();

            const result = await handler!({}, 'openai', 'gpt-4');

            expect(withRateLimit).toHaveBeenCalledWith('db', expect.any(Function));
            expect(mockUsageTrackingService.recordUsage).toHaveBeenCalledWith('openai', 'gpt-4');
            expect(result).toEqual({ success: true });
        });

        it('should record usage for different providers', async () => {
            const handler = mockIpcMainHandlers.get('usage:recordUsage');
            vi.mocked(mockUsageTrackingService.recordUsage).mockResolvedValue(undefined);

            await handler!({}, 'anthropic', 'claude-3-opus');
            expect(mockUsageTrackingService.recordUsage).toHaveBeenCalledWith('anthropic', 'claude-3-opus');

            await handler!({}, 'google', 'gemini-pro');
            expect(mockUsageTrackingService.recordUsage).toHaveBeenCalledWith('google', 'gemini-pro');
        });

        it('should apply db rate limiting', async () => {
            const handler = mockIpcMainHandlers.get('usage:recordUsage');
            vi.mocked(mockUsageTrackingService.recordUsage).mockResolvedValue(undefined);

            await handler!({}, 'test-provider', 'test-model');

            expect(withRateLimit).toHaveBeenCalledWith('db', expect.any(Function));
        });

        it('should return success even if recording fails', async () => {
            vi.mocked(mockUsageTrackingService.recordUsage).mockRejectedValue(new Error('DB error'));

            const handler = mockIpcMainHandlers.get('usage:recordUsage');

            // Should throw since withRateLimit doesn't catch
            await expect(handler!({}, 'openai', 'gpt-4')).rejects.toThrow('DB error');
        });
    });
});
