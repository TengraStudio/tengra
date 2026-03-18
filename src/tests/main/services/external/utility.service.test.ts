import { UtilityService } from '@main/services/external/utility.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('electron', () => ({
    app: { getPath: vi.fn().mockReturnValue('/tmp') },
}));

interface MockDb {
    storeMemory: ReturnType<typeof vi.fn>;
    recallMemory: ReturnType<typeof vi.fn>;
}

interface MockSecurity {
    encryptSync: ReturnType<typeof vi.fn>;
    decryptSync: ReturnType<typeof vi.fn>;
}

function createMockDeps() {
    const db: MockDb = {
        storeMemory: vi.fn(),
        recallMemory: vi.fn(),
    };
    const security: MockSecurity = {
        encryptSync: vi.fn((v: string) => `encrypted:${v}`),
        decryptSync: vi.fn((v: string) => v.replace('encrypted:', '')),
    };
    return { db, security };
}

describe('UtilityService', () => {
    let service: UtilityService;
    let mocks: ReturnType<typeof createMockDeps>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        mocks = createMockDeps();
        service = new UtilityService(
            mocks.db as never as ConstructorParameters<typeof UtilityService>[0],
            mocks.security as never as ConstructorParameters<typeof UtilityService>[1],
        );
    });

    afterEach(async () => {
        await service.cleanup();
        vi.useRealTimers();
        vi.resetAllMocks();
    });

    describe('scheduleReminder', () => {
        it('should schedule a reminder and return success with id', () => {
            const callback = vi.fn();
            const result = service.scheduleReminder('test', 5000, callback);

            expect(result.success).toBe(true);
            expect(result.data?.id).toBeDefined();
            expect(callback).not.toHaveBeenCalled();
        });

        it('should trigger callback after delay', () => {
            const callback = vi.fn();
            service.scheduleReminder('hello', 3000, callback);

            vi.advanceTimersByTime(3000);
            expect(callback).toHaveBeenCalledWith('hello');
        });

        it('should not trigger callback before delay', () => {
            const callback = vi.fn();
            service.scheduleReminder('hello', 5000, callback);

            vi.advanceTimersByTime(4999);
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('cancelReminder', () => {
        it('should cancel an existing reminder', () => {
            const callback = vi.fn();
            const { data } = service.scheduleReminder('test', 5000, callback);
            const result = service.cancelReminder(data!.id);

            expect(result.success).toBe(true);
            vi.advanceTimersByTime(10000);
            expect(callback).not.toHaveBeenCalled();
        });

        it('should return error for non-existent reminder', () => {
            const result = service.cancelReminder('nonexistent-id');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Reminder not found');
        });
    });

    describe('toggleGhostMode', () => {
        it('should return enabled message when true', () => {
            const result = service.toggleGhostMode(true);
            expect(result.success).toBe(true);
            expect(result.message).toContain('enabled');
        });

        it('should return disabled message when false', () => {
            const result = service.toggleGhostMode(false);
            expect(result.success).toBe(true);
            expect(result.message).toContain('disabled');
        });
    });

    describe('storeMemory', () => {
        it('should encrypt and store memory', async () => {
            mocks.db.storeMemory.mockResolvedValue(undefined);
            const result = await service.storeMemory('key1', 'secret-value');

            expect(result.success).toBe(true);
            expect(mocks.security.encryptSync).toHaveBeenCalledWith('secret-value');
            expect(mocks.db.storeMemory).toHaveBeenCalledWith('key1', 'encrypted:secret-value');
        });

        it('should return error when encryption fails', async () => {
            mocks.security.encryptSync.mockImplementation(() => {
                throw new Error('encryption failed');
            });

            const result = await service.storeMemory('key1', 'value');
            expect(result.success).toBe(false);
            expect(result.error).toBe('encryption failed');
        });

        it('should return error when db store fails', async () => {
            mocks.db.storeMemory.mockRejectedValue(new Error('db error'));

            const result = await service.storeMemory('key1', 'value');
            expect(result.success).toBe(false);
            expect(result.error).toBe('db error');
        });
    });

    describe('recallMemory', () => {
        it('should recall and decrypt memory', async () => {
            mocks.db.recallMemory.mockResolvedValue({ content: 'encrypted:hello' });
            const result = await service.recallMemory('key1');

            expect(result.success).toBe(true);
            expect(result.data).toBe('hello');
            expect(mocks.security.decryptSync).toHaveBeenCalledWith('encrypted:hello');
        });

        it('should return null data when memory not found', async () => {
            mocks.db.recallMemory.mockResolvedValue(null);
            const result = await service.recallMemory('missing-key');

            expect(result.success).toBe(true);
            expect(result.data).toBeNull();
        });

        it('should return null data when content is empty', async () => {
            mocks.db.recallMemory.mockResolvedValue({ content: '' });
            const result = await service.recallMemory('empty-key');

            expect(result.success).toBe(true);
            expect(result.data).toBeNull();
        });

        it('should return error when decryption fails', async () => {
            mocks.db.recallMemory.mockResolvedValue({ content: 'corrupted' });
            mocks.security.decryptSync.mockImplementation(() => {
                throw new Error('decrypt failed');
            });

            const result = await service.recallMemory('key1');
            expect(result.success).toBe(false);
            expect(result.error).toBe('decrypt failed');
        });
    });

    describe('deprecated methods', () => {
        it('loadPlugin should return disabled error', async () => {
            const result = await service.loadPlugin();
            expect(result.success).toBe(false);
            expect(result.error).toContain('disabled');
        });

        it('indexDocument should return deprecated error', async () => {
            const result = await service.indexDocument();
            expect(result.success).toBe(false);
            expect(result.error).toContain('Deprecated');
        });

        it('searchDocuments should return deprecated error', async () => {
            const result = await service.searchDocuments();
            expect(result.success).toBe(false);
            expect(result.error).toContain('Deprecated');
        });

        it('scanCodebase should return deprecated error', async () => {
            const result = await service.scanCodebase();
            expect(result.success).toBe(false);
            expect(result.error).toContain('Deprecated');
        });
    });

    describe('startMonitor', () => {
        it('should return success message', () => {
            const result = service.startMonitor('https://example.com', 120);
            expect(result.success).toBe(true);
            expect(result.message).toContain('https://example.com');
        });

        it('should replace existing monitor for same URL', () => {
            service.startMonitor('https://example.com', 60);
            const result = service.startMonitor('https://example.com', 120);
            expect(result.success).toBe(true);
        });
    });

    describe('cleanup', () => {
        it('should clear all monitors and reminders', async () => {
            const callback = vi.fn();
            service.startMonitor('https://example.com', 60);
            service.scheduleReminder('test', 5000, callback);

            await service.cleanup();

            vi.advanceTimersByTime(60000);
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('checkVirusTotal', () => {
        it('should return error when no API key provided', async () => {
            const result = await service.checkVirusTotal('abc123');
            expect(result.success).toBe(false);
            expect(result.error).toContain('API key required');
        });
    });

    describe('lookupShodan', () => {
        it('should return error when no API key provided', async () => {
            const result = await service.lookupShodan('1.2.3.4');
            expect(result.success).toBe(false);
            expect(result.error).toContain('API key required');
        });
    });
});
