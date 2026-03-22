import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock modules
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    }
}));


vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn()
    }
}));

// Import after mocks
import { registerKeyRotationIpc } from '@main/ipc/key-rotation';
import type { KeyRotationService } from '@main/services/security/key-rotation.service';

interface KeyRotationStatusPayload {
    provider: string;
    hasKey: boolean;
    currentKey: string | null;
}

interface KeyRotationStatusResponse {
    success: boolean;
    data: KeyRotationStatusPayload;
}

describe('Key Rotation IPC Handlers', () => {
    const ipcMainHandlers = new Map<string, CallableFunction>();
    let mockKeyRotationService: KeyRotationService;
    let mockEvent: IpcMainInvokeEvent;

    beforeEach(() => {
        vi.clearAllMocks();
        ipcMainHandlers.clear();

        // Capture IPC handlers
        vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: CallableFunction) => {
            ipcMainHandlers.set(channel, handler);
            return { channels: [channel] } as never as Electron.IpcMain;
        });

        // Mock key rotation service
        mockKeyRotationService = {
            getCurrentKey: vi.fn().mockReturnValue('sk-test123'),
            rotateKey: vi.fn().mockReturnValue(true),
            initializeProviderKeys: vi.fn()
        } as never as KeyRotationService;

        mockEvent = {} as IpcMainInvokeEvent;

        registerKeyRotationIpc(() => null, mockKeyRotationService);
    });

    describe('key-rotation:getCurrentKey', () => {
        it('should get current key for valid provider', async () => {
            const handler = ipcMainHandlers.get('key-rotation:getCurrentKey');
            expect(handler).toBeDefined();

            const result = await handler!(mockEvent, 'openai');

            expect(mockKeyRotationService.getCurrentKey).toHaveBeenCalledWith('openai');
            expect(result).toEqual({ success: true, data: 'sk-test123' });
        });

        it('should return null when no key available', async () => {
            const handler = ipcMainHandlers.get('key-rotation:getCurrentKey');
            vi.mocked(mockKeyRotationService.getCurrentKey).mockReturnValue(null);

            const result = await handler!(mockEvent, 'openai');

            expect(result).toEqual({ success: true, data: null });
        });

        it('should reject invalid provider names', async () => {
            const handler = ipcMainHandlers.get('key-rotation:getCurrentKey');

            const result = await handler!(mockEvent, '');
            expect(result).toEqual({ success: true, data: null });
        });

        it('should reject non-alphanumeric provider names', async () => {
            const handler = ipcMainHandlers.get('key-rotation:getCurrentKey');

            const result = await handler!(mockEvent, 'invalid@provider!');
            expect(result).toEqual({ success: true, data: null });
        });

        it('should accept provider names with hyphens and underscores', async () => {
            const handler = ipcMainHandlers.get('key-rotation:getCurrentKey');

            await handler!(mockEvent, 'provider-name_123');

            expect(mockKeyRotationService.getCurrentKey).toHaveBeenCalledWith('provider-name_123');
        });

        it('should reject provider names exceeding max length (64)', async () => {
            const handler = ipcMainHandlers.get('key-rotation:getCurrentKey');
            const longProvider = 'a'.repeat(100);

            const result = await handler!(mockEvent, longProvider);
            expect(result).toEqual({ success: true, data: null });
        });
    });

    describe('key-rotation:rotate', () => {
        it('should rotate key for valid provider', async () => {
            const handler = ipcMainHandlers.get('key-rotation:rotate');
            expect(handler).toBeDefined();

            vi.mocked(mockKeyRotationService.rotateKey).mockReturnValue(true);
            vi.mocked(mockKeyRotationService.getCurrentKey).mockReturnValue('sk-newkey456');

            const result = await handler!(mockEvent, 'openai');

            expect(mockKeyRotationService.rotateKey).toHaveBeenCalledWith('openai');
            expect(result).toEqual({
                success: true,
                data: { success: true, currentKey: 'sk-newkey456' }
            });
        });

        it('should return failure status when rotation fails', async () => {
            const handler = ipcMainHandlers.get('key-rotation:rotate');
            vi.mocked(mockKeyRotationService.rotateKey).mockReturnValue(false);
            vi.mocked(mockKeyRotationService.getCurrentKey).mockReturnValue(null);

            const result = await handler!(mockEvent, 'openai');

            expect(result).toEqual({
                success: true,
                data: { success: false, currentKey: null }
            });
        });

        it('should reject invalid provider names', async () => {
            const handler = ipcMainHandlers.get('key-rotation:rotate');

            const results = await Promise.all([
                handler!(mockEvent, ''),
                handler!(mockEvent, null),
                handler!(mockEvent, 123)
            ]);
            for (const res of results) {
                expect(res).toMatchObject({
                    success: false,
                    error: { message: expect.any(String) }
                });
            }
        });

        it('should reject provider names with special characters', async () => {
            const handler = ipcMainHandlers.get('key-rotation:rotate');

            const result = await handler!(mockEvent, 'provider@special!');
            expect(result).toMatchObject({
                success: false,
                error: { message: expect.any(String) }
            });
        });
    });

    describe('key-rotation:initialize', () => {
        it('should initialize provider keys with valid input', async () => {
            const handler = ipcMainHandlers.get('key-rotation:initialize');
            expect(handler).toBeDefined();

            const keys = 'sk-key1,sk-key2,sk-key3';
            vi.mocked(mockKeyRotationService.getCurrentKey).mockReturnValue('sk-key1');

            const result = await handler!(mockEvent, 'openai', keys);

            expect(mockKeyRotationService.initializeProviderKeys).toHaveBeenCalledWith('openai', keys);
            expect(result).toEqual({
                success: true,
                data: { success: true, currentKey: 'sk-key1' }
            });
        });

        it('should reject invalid provider names', async () => {
            const handler = ipcMainHandlers.get('key-rotation:initialize');

            const results = await Promise.all([
                handler!(mockEvent, '', 'sk-key1'),
                handler!(mockEvent, null, 'sk-key1')
            ]);
            for (const res of results) {
                expect(res).toMatchObject({
                    success: false,
                    error: { message: expect.any(String) }
                });
            }
        });

        it('should reject invalid keys string', async () => {
            const handler = ipcMainHandlers.get('key-rotation:initialize');

            const results = await Promise.all([
                handler!(mockEvent, 'openai', ''),
                handler!(mockEvent, 'openai', null),
                handler!(mockEvent, 'openai', 123)
            ]);
            for (const res of results) {
                expect(res).toMatchObject({
                    success: false,
                    error: { message: expect.any(String) }
                });
            }
        });

        it('should reject keys string exceeding max length (4096)', async () => {
            const handler = ipcMainHandlers.get('key-rotation:initialize');
            const longKeys = 'sk-' + 'a'.repeat(5000);

            const result = await handler!(mockEvent, 'openai', longKeys);
            expect(result).toMatchObject({
                success: false,
                error: { message: expect.any(String) }
            });
        });

        it('should accept single key', async () => {
            const handler = ipcMainHandlers.get('key-rotation:initialize');

            await handler!(mockEvent, 'openai', 'sk-single-key');

            expect(mockKeyRotationService.initializeProviderKeys).toHaveBeenCalledWith('openai', 'sk-single-key');
        });

        it('should accept multiple comma-separated keys', async () => {
            const handler = ipcMainHandlers.get('key-rotation:initialize');
            const keys = 'sk-key1,sk-key2,sk-key3,sk-key4';

            await handler!(mockEvent, 'openai', keys);

            expect(mockKeyRotationService.initializeProviderKeys).toHaveBeenCalledWith('openai', keys);
        });
    });

    describe('key-rotation:getStatus', () => {
        it('should get status for provider with key', async () => {
            const handler = ipcMainHandlers.get('key-rotation:getStatus');
            expect(handler).toBeDefined();

            vi.mocked(mockKeyRotationService.getCurrentKey).mockReturnValue('sk-test123456789');

            const result = await handler!(mockEvent, 'openai');

            expect(mockKeyRotationService.getCurrentKey).toHaveBeenCalledWith('openai');
            expect(result).toEqual({
                success: true,
                data: {
                    provider: 'openai',
                    hasKey: true,
                    currentKey: 'sk-test1...' // Masked to first 8 chars
                }
            });
        });

        it('should get status for provider without key', async () => {
            const handler = ipcMainHandlers.get('key-rotation:getStatus');
            vi.mocked(mockKeyRotationService.getCurrentKey).mockReturnValue(null);

            const result = await handler!(mockEvent, 'openai');

            expect(result).toEqual({
                success: true,
                data: {
                    provider: 'openai',
                    hasKey: false,
                    currentKey: null
                }
            });
        });

        it('should mask key for security (first 8 chars only)', async () => {
            const handler = ipcMainHandlers.get('key-rotation:getStatus');
            vi.mocked(mockKeyRotationService.getCurrentKey).mockReturnValue('sk-verylongkeythatshouldbemask');

            const result = await handler!(mockEvent, 'openai') as KeyRotationStatusResponse;

            expect(result.data.currentKey).toBe('sk-veryl...');
            expect(result.data.currentKey).not.toContain('verylongkeythatshouldbemask');
        });

        it('should return default value on error', async () => {
            const handler = ipcMainHandlers.get('key-rotation:getStatus');
            vi.mocked(mockKeyRotationService.getCurrentKey).mockImplementation(() => {
                throw new Error('Service error');
            });

            const result = await handler!(mockEvent, 'openai');

            expect(result).toEqual({
                success: true,
                data: {
                    provider: '',
                    hasKey: false,
                    currentKey: null
                }
            });
        });

        it('should reject invalid provider names', async () => {
            const handler = ipcMainHandlers.get('key-rotation:getStatus');

            const result = await handler!(mockEvent, '');

            expect(result).toEqual({
                success: true,
                data: {
                    provider: '',
                    hasKey: false,
                    currentKey: null
                }
            });
        });
    });
});
