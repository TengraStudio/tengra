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


vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn()
    }
}));

// Import after mocks
import { registerMigrationIpc } from '@main/ipc/migration';
import type { DatabaseService } from '@main/services/data/database.service';

describe('Migration IPC Handlers', () => {
    const ipcMainHandlers = new Map<string, CallableFunction>();
    let mockDatabaseService: DatabaseService;
    let mockEvent: IpcMainInvokeEvent;

    beforeEach(() => {
        vi.clearAllMocks();
        ipcMainHandlers.clear();

        // Capture IPC handlers
        vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: CallableFunction) => {
            ipcMainHandlers.set(channel, handler);
            return { channels: [channel] } as unknown as Electron.IpcMain;
        });

        // Mock database service
        mockDatabaseService = {
            getMigrationStatus: vi.fn().mockResolvedValue({
                currentVersion: 5,
                appliedMigrations: ['001', '002', '003', '004', '005'],
                pendingMigrations: []
            })
        } as unknown as DatabaseService;

        mockEvent = {} as IpcMainInvokeEvent;

        registerMigrationIpc(mockDatabaseService);
    });

    describe('migration:status', () => {
        it('should get migration status successfully', async () => {
            const handler = ipcMainHandlers.get('migration:status');
            expect(handler).toBeDefined();

            const result = await handler!(mockEvent);

            expect(mockDatabaseService.getMigrationStatus).toHaveBeenCalled();
            expect(result).toEqual({
                currentVersion: 5,
                appliedMigrations: ['001', '002', '003', '004', '005'],
                pendingMigrations: []
            });
        });

        it('should return null on service error', async () => {
            const handler = ipcMainHandlers.get('migration:status');
            vi.mocked(mockDatabaseService.getMigrationStatus).mockRejectedValue(new Error('Database error'));

            const result = await handler!(mockEvent);

            expect(result).toBeNull();
        });

        it('should handle status with pending migrations', async () => {
            const handler = ipcMainHandlers.get('migration:status');
            vi.mocked(mockDatabaseService.getMigrationStatus).mockResolvedValue({
                version: 3,
                lastMigration: 3
            });

            const result = await handler!(mockEvent);

            expect(result).toEqual({
                version: 3,
                lastMigration: 3
            });
        });

        it('should handle fresh database with no migrations', async () => {
            const handler = ipcMainHandlers.get('migration:status');
            vi.mocked(mockDatabaseService.getMigrationStatus).mockResolvedValue({
                version: 0,
                lastMigration: 0,
                appliedMigrations: [],
                pendingMigrations: ['001_init']
            } as never);

            const result = await handler!(mockEvent);

            expect(result.version).toBe(0);
            expect(result.appliedMigrations).toHaveLength(0);
            expect(result.pendingMigrations.length).toBeGreaterThan(0);
        });
    });
});
