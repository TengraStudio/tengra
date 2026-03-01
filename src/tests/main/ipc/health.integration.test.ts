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

// Mock IPC wrapper
vi.mock('@main/utils/ipc-wrapper.util', () => ({
    createSafeIpcHandler: (_name: string, handler: (...args: unknown[]) => unknown, fallback: unknown) => async (...args: unknown[]) => {
        try {
            const result = await handler(...args);
            return result;
        } catch {
            return fallback;
        }
    },
}));

// Mock HealthCheckService
vi.mock('@main/services/system/health-check.service', () => ({
    HealthCheckService: vi.fn(),
}));

// Import the module under test AFTER mocks
import { registerHealthIpc } from '@main/ipc/health';

describe('Health IPC Integration', () => {
    let mockHealthCheckService: Record<string, ReturnType<typeof vi.fn>>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockIpcMainHandlers.clear();

        mockHealthCheckService = {
            getStatus: vi.fn(),
            checkNow: vi.fn(),
        };

        registerHealthIpc(mockHealthCheckService as unknown as Parameters<typeof registerHealthIpc>[0]);
    });

    it('should register expected handlers', () => {
        expect(mockIpcMainHandlers.has('health:status')).toBe(true);
        expect(mockIpcMainHandlers.has('health:check')).toBe(true);
        expect(mockIpcMainHandlers.has('health:getService')).toBe(true);
        expect(mockIpcMainHandlers.has('health:listServices')).toBe(true);
        expect(mockIpcMainHandlers.size).toBe(4);
    });

    describe('health:status', () => {
        it('should return overall health status', async () => {
            const mockStatus = {
                overall: 'healthy',
                services: [
                    { name: 'database', status: 'healthy', lastCheck: new Date() },
                    { name: 'llm', status: 'healthy', lastCheck: new Date() },
                ],
                timestamp: new Date(),
            };
            vi.mocked(mockHealthCheckService.getStatus).mockReturnValue(mockStatus);

            const handler = mockIpcMainHandlers.get('health:status');
            expect(handler).toBeDefined();

            const result = await handler!({});

            expect(mockHealthCheckService.getStatus).toHaveBeenCalled();
            expect(result).toEqual(mockStatus);
        });

        it('should return degraded status', async () => {
            const mockStatus = {
                overall: 'degraded',
                services: [
                    { name: 'database', status: 'healthy', lastCheck: new Date() },
                    { name: 'llm', status: 'degraded', lastCheck: new Date() },
                ],
                timestamp: new Date(),
            };
            vi.mocked(mockHealthCheckService.getStatus).mockReturnValue(mockStatus);

            const handler = mockIpcMainHandlers.get('health:status');
            const result = await handler!({});

            expect((result as Record<string, unknown>).overall).toBe('degraded');
        });

        it('should return unhealthy fallback on error', async () => {
            vi.mocked(mockHealthCheckService.getStatus).mockImplementation(() => {
                throw new Error('Health check failed');
            });

            const handler = mockIpcMainHandlers.get('health:status');
            const result = await handler!({});

            expect((result as Record<string, unknown>).overall).toBe('unhealthy');
            expect((result as Record<string, unknown>).services).toEqual([]);
        });
    });

    describe('health:check', () => {
        it('should check specific service immediately', async () => {
            const mockServiceStatus = { name: 'database', status: 'healthy', lastCheck: new Date() };
            vi.mocked(mockHealthCheckService.checkNow).mockResolvedValue(mockServiceStatus);

            const handler = mockIpcMainHandlers.get('health:check');
            expect(handler).toBeDefined();

            const result = await handler!({}, 'database');

            expect(mockHealthCheckService.checkNow).toHaveBeenCalledWith('database');
            expect(result).toEqual(mockServiceStatus);
        });

        it('should reject empty service name', async () => {
            const handler = mockIpcMainHandlers.get('health:check');

            const result1 = await handler!({}, '');
            expect(result1).toBe(null);

            const result2 = await handler!({}, '   ');
            expect(result2).toBe(null);
        });

        it('should reject non-string service name', async () => {
            const handler = mockIpcMainHandlers.get('health:check');

            const result1 = await handler!({}, 123);
            expect(result1).toBe(null);

            const result2 = await handler!({}, null);
            expect(result2).toBe(null);
        });

        it('should trim service name', async () => {
            const mockServiceStatus = { name: 'llm', status: 'healthy', lastCheck: new Date() };
            vi.mocked(mockHealthCheckService.checkNow).mockResolvedValue(mockServiceStatus);

            const handler = mockIpcMainHandlers.get('health:check');
            await handler!({}, '  llm  ');

            expect(mockHealthCheckService.checkNow).toHaveBeenCalledWith('llm');
        });

        it('should return null for nonexistent service', async () => {
            vi.mocked(mockHealthCheckService.checkNow).mockResolvedValue(null);

            const handler = mockIpcMainHandlers.get('health:check');
            const result = await handler!({}, 'nonexistent-service');

            expect(result).toBe(null);
        });
    });

    describe('health:getService', () => {
        it('should get status for specific service', async () => {
            const mockServices = [
                { name: 'database', status: 'healthy', lastCheck: new Date() },
                { name: 'llm', status: 'degraded', lastCheck: new Date() },
            ];
            vi.mocked(mockHealthCheckService.getStatus).mockReturnValue({
                overall: 'degraded',
                services: mockServices,
                timestamp: new Date(),
            });

            const handler = mockIpcMainHandlers.get('health:getService');
            expect(handler).toBeDefined();

            const result = await handler!({}, 'llm');

            expect(result).toEqual(mockServices[1]);
        });

        it('should return null for nonexistent service', async () => {
            vi.mocked(mockHealthCheckService.getStatus).mockReturnValue({
                overall: 'healthy',
                services: [{ name: 'database', status: 'healthy', lastCheck: new Date() }],
                timestamp: new Date(),
            });

            const handler = mockIpcMainHandlers.get('health:getService');
            const result = await handler!({}, 'nonexistent');

            expect(result).toBe(null);
        });

        it('should reject empty service name', async () => {
            const handler = mockIpcMainHandlers.get('health:getService');

            const result = await handler!({}, '');
            expect(result).toBe(null);
        });

        it('should reject non-string service name', async () => {
            const handler = mockIpcMainHandlers.get('health:getService');

            const result = await handler!({}, 123);
            expect(result).toBe(null);
        });

        it('should trim service name', async () => {
            const mockService = { name: 'cache', status: 'healthy', lastCheck: new Date() };
            vi.mocked(mockHealthCheckService.getStatus).mockReturnValue({
                overall: 'healthy',
                services: [mockService],
                timestamp: new Date(),
            });

            const handler = mockIpcMainHandlers.get('health:getService');
            const result = await handler!({}, '  cache  ');

            expect(result).toEqual(mockService);
        });
    });

    describe('health:listServices', () => {
        it('should list all service names', async () => {
            vi.mocked(mockHealthCheckService.getStatus).mockReturnValue({
                overall: 'healthy',
                services: [
                    { name: 'database', status: 'healthy', lastCheck: new Date() },
                    { name: 'llm', status: 'healthy', lastCheck: new Date() },
                    { name: 'cache', status: 'healthy', lastCheck: new Date() },
                ],
                timestamp: new Date(),
            });

            const handler = mockIpcMainHandlers.get('health:listServices');
            expect(handler).toBeDefined();

            const result = await handler!({});

            expect(result).toEqual(['database', 'llm', 'cache']);
        });

        it('should return empty array when no services', async () => {
            vi.mocked(mockHealthCheckService.getStatus).mockReturnValue({
                overall: 'healthy',
                services: [],
                timestamp: new Date(),
            });

            const handler = mockIpcMainHandlers.get('health:listServices');
            const result = await handler!({});

            expect(result).toEqual([]);
        });

        it('should return empty array on error', async () => {
            vi.mocked(mockHealthCheckService.getStatus).mockImplementation(() => {
                throw new Error('Failed to get status');
            });

            const handler = mockIpcMainHandlers.get('health:listServices');
            const result = await handler!({});

            expect(result).toEqual([]);
        });
    });
});
