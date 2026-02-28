import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockIpcMainHandlers = new Map<string, (...args: unknown[]) => unknown>();

// Mock electron with inline factories
vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
            mockIpcMainHandlers.set(channel, handler);
        }),
        removeHandler: vi.fn((channel: string) => {
            mockIpcMainHandlers.delete(channel);
        }),
    },
    desktopCapturer: {
        getSources: vi.fn(),
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

// Mock rate limiter
vi.mock('@main/utils/rate-limiter.util', () => ({
    withRateLimit: vi.fn((_key: string, fn: () => unknown) => fn()),
}));

// Import module under test AFTER mocks
import { registerScreenshotIpc } from '@main/ipc/screenshot';

describe('Screenshot IPC Handlers', () => {
    let mockDesktopCapturer: Record<string, ReturnType<typeof vi.fn>>;
    let mockThumbnail: Record<string, ReturnType<typeof vi.fn>>;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockIpcMainHandlers.clear();
        
        // Get mocked electron after import
        const electron = await import('electron');
        mockDesktopCapturer = electron.desktopCapturer;
        
        // Create mock thumbnail
        mockThumbnail = {
            toDataURL: vi.fn(() => 'data:image/png;base64,iVBORw0KGgoAAAANS...'),
        };
        
        // Setup default mock behavior
        vi.mocked(mockDesktopCapturer.getSources).mockResolvedValue([
            {
                id: 'screen:0',
                name: 'Entire Screen',
                thumbnail: mockThumbnail,
            },
        ]);
        
        // Register handlers
        registerScreenshotIpc(() => null);
    });

    describe('screenshot:capture', () => {
        it('should capture screenshot and return data URL', async () => {
            const expectedDataURL = 'data:image/png;base64,abc123';
            vi.mocked(mockThumbnail.toDataURL).mockReturnValue(expectedDataURL);
            
            const handler = mockIpcMainHandlers.get('screenshot:capture');
            expect(handler).toBeDefined();
            
            const result = await handler!({});
            
            expect(vi.mocked(mockDesktopCapturer.getSources)).toHaveBeenCalledWith({
                types: ['screen'],
                thumbnailSize: { width: 1920, height: 1080 },
            });
            expect(vi.mocked(mockThumbnail.toDataURL)).toHaveBeenCalled();
            expect(result).toBe(expectedDataURL);
        });

        it('should use rate limiting', async () => {
            const electron = await import('@main/utils/rate-limiter.util');
            
            const handler = mockIpcMainHandlers.get('screenshot:capture');
            await handler!({});
            
            expect(vi.mocked(electron.withRateLimit)).toHaveBeenCalledWith('screenshot', expect.any(Function));
        });

        it('should return empty string when no screen sources', async () => {
            vi.mocked(mockDesktopCapturer.getSources).mockResolvedValue([]);
            
            const handler = mockIpcMainHandlers.get('screenshot:capture');
            const result = await handler!({});
            
            expect(result).toBe('');
        });

        it('should return empty string on capture error', async () => {
            mockDesktopCapturer.getSources.mockRejectedValue(new Error('Permission denied'));
            
            const handler = mockIpcMainHandlers.get('screenshot:capture');
            const result = await handler!({});
            
            expect(result).toBe('');
        });

        it('should use primary screen source', async () => {
            const screen1 = { id: 'screen:0', name: 'Primary', thumbnail: mockThumbnail };
            const screen2 = { id: 'screen:1', name: 'Secondary', thumbnail: { toDataURL: vi.fn() } };
            
            mockDesktopCapturer.getSources.mockResolvedValue([screen1, screen2]);
            
            const handler = mockIpcMainHandlers.get('screenshot:capture');
            await handler!({});
            
            expect(mockThumbnail.toDataURL).toHaveBeenCalled();
            expect(screen2.thumbnail.toDataURL).not.toHaveBeenCalled();
        });

        it('should handle thumbnail conversion error', async () => {
            mockThumbnail.toDataURL.mockImplementation(() => {
                throw new Error('Conversion failed');
            });
            
            const handler = mockIpcMainHandlers.get('screenshot:capture');
            const result = await handler!({});
            
            expect(result).toBe('');
        });

        it('should request 1920x1080 thumbnail size', async () => {
            const handler = mockIpcMainHandlers.get('screenshot:capture');
            await handler!({});
            
            expect(mockDesktopCapturer.getSources).toHaveBeenCalledWith(
                expect.objectContaining({
                    thumbnailSize: { width: 1920, height: 1080 },
                })
            );
        });

        it('should only request screen sources', async () => {
            const handler = mockIpcMainHandlers.get('screenshot:capture');
            await handler!({});
            
            expect(mockDesktopCapturer.getSources).toHaveBeenCalledWith(
                expect.objectContaining({
                    types: ['screen'],
                })
            );
        });
    });
});
