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

vi.mock('@main/utils/ipc-wrapper.util', () => ({
    createIpcHandler: vi.fn((_name, handler) => handler),
    createSafeIpcHandler: vi.fn((_name, handler, defaultValue) => {
        return async (...args: unknown[]) => {
            try {
                return await handler(...args);
            } catch {
                return defaultValue;
            }
        };
    })
}));

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn()
    }
}));

// Import after mocks
import { registerKeyRotationIpc } from '@main/ipc/key-rotation';
import type { KeyRotationService } from '@main/services/security/key-rotation.service';

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
            return { channels: [channel] } as unknown as Electron.IpcMain;
        });

        // Mock key rotation service
        mockKeyRotationService = {
            getCurrentKey: vi.fn().mockReturnValue('sk-test123'),
            rotateKey: vi.fn().mockReturnValue(true),
            initializeProviderKeys: vi.fn()
        } as unknown as KeyRotationService;

        mockEvent = {} as IpcMainInvokeEvent;

        registerKeyRotationIpc(mockKeyRotationService);
    });

    describe('key-rotation:getCurrentKey', () => {
        it('should get current key for valid provider', async () => {
            const handler = ipcMainHandlers.get('key-rotation:getCurrentKey');
            expect(handler).toBeDefined();

            const result = await handler!(mockEvent, 'openai');

            expect(mockKeyRotationService.getCurrentKey).toHaveBeenCalledWith('openai');
            expect(result).toBe('sk-test123');
        });

        it('should return null when no key available', async () => {
            const handler = ipcMainHandlers.get('key-rotation:getCurrentKey');
            vi.mocked(mockKeyRotationService.getCurrentKey).mockReturnValue(null);

            const result = await handler!(mockEvent, 'openai');

            expect(result).toBeNull();
        });

        it('should reject invalid provider names', async () => {
            const handler = ipcMainHandlers.get('key-rotation:getCurrentKey');

            const result = await handler!(mockEvent, '');
            expect(result).toBeNull();
        });

        it('should reject non-alphanumeric provider names', async () => {
            const handler = ipcMainHandlers.get('key-rotation:getCurrentKey');

            const result = await handler!(mockEvent, 'invalid@provider!');
            expect(result).toBeNull();
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
            expect(result).toBeNull();
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
            expect(result).toEqual({ success: true, currentKey: 'sk-newkey456' });
        });

        it('should return failure status when rotation fails', async () => {
            const handler = ipcMainHandlers.get('key-rotation:rotate');
            vi.mocked(mockKeyRotationService.rotateKey).mockReturnValue(false);
            vi.mocked(mockKeyRotationService.getCurrentKey).mockReturnValue(null);

            const result = await handler!(mockEvent, 'openai');

            expect(result).toEqual({ success: false, currentKey: null });
        });

        it('should reject invalid provider names', async () => {
            const handler = ipcMainHandlers.get('key-rotation:rotate');

            await expect(handler!(mockEvent, '')).rejects.toThrow('Invalid provider name');
            await expect(handler!(mockEvent, null)).rejects.toThrow('Invalid provider name');
            await expect(handler!(mockEvent, 123)).rejects.toThrow('Invalid provider name');
        });

        it('should reject provider names with special characters', async () => {
            const handler = ipcMainHandlers.get('key-rotation:rotate');

            await expect(handler!(mockEvent, 'provider@special!')).rejects.toThrow('Invalid provider name');
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
            expect(result).toEqual({ success: true, currentKey: 'sk-key1' });
        });

        it('should reject invalid provider names', async () => {
            const handler = ipcMainHandlers.get('key-rotation:initialize');

            await expect(handler!(mockEvent, '', 'sk-key1')).rejects.toThrow('Invalid provider name or keys');
            await expect(handler!(mockEvent, null, 'sk-key1')).rejects.toThrow('Invalid provider name or keys');
        });

        it('should reject invalid keys string', async () => {
            const handler = ipcMainHandlers.get('key-rotation:initialize');

            await expect(handler!(mockEvent, 'openai', '')).rejects.toThrow('Invalid provider name or keys');
            await expect(handler!(mockEvent, 'openai', null)).rejects.toThrow('Invalid provider name or keys');
            await expect(handler!(mockEvent, 'openai', 123)).rejects.toThrow('Invalid provider name or keys');
        });

        it('should reject keys string exceeding max length (4096)', async () => {
            const handler = ipcMainHandlers.get('key-rotation:initialize');
            const longKeys = 'sk-' + 'a'.repeat(5000);

            await expect(handler!(mockEvent, 'openai', longKeys)).rejects.toThrow('Invalid provider name or keys');
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
                provider: 'openai',
                hasKey: true,
                currentKey: 'sk-test1...' // Masked to first 8 chars
            });
        });

        it('should get status for provider without key', async () => {
            const handler = ipcMainHandlers.get('key-rotation:getStatus');
            vi.mocked(mockKeyRotationService.getCurrentKey).mockReturnValue(null);

            const result = await handler!(mockEvent, 'openai');

            expect(result).toEqual({
                provider: 'openai',
                hasKey: false,
                currentKey: null
            });
        });

        it('should mask key for security (first 8 chars only)', async () => {
            const handler = ipcMainHandlers.get('key-rotation:getStatus');
            vi.mocked(mockKeyRotationService.getCurrentKey).mockReturnValue('sk-verylongkeythatshouldbemask');

            const result = await handler!(mockEvent, 'openai');

            expect(result.currentKey).toBe('sk-veryl...');
            expect(result.currentKey).not.toContain('verylongkeythatshouldbemask');
        });

        it('should return default value on error', async () => {
            const handler = ipcMainHandlers.get('key-rotation:getStatus');
            vi.mocked(mockKeyRotationService.getCurrentKey).mockImplementation(() => {
                throw new Error('Service error');
            });

            const result = await handler!(mockEvent, 'openai');

            expect(result).toEqual({
                provider: '',
                hasKey: false,
                currentKey: null
            });
        });

        it('should reject invalid provider names', async () => {
            const handler = ipcMainHandlers.get('key-rotation:getStatus');

            const result = await handler!(mockEvent, '');

            expect(result).toEqual({
                provider: '',
                hasKey: false,
                currentKey: null
            });
        });
    });
});
