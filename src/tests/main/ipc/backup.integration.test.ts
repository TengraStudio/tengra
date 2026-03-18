import { registerBackupIpc } from '@main/ipc/backup';
import { IpcMainInvokeEvent } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface IpcSuccessEnvelope<TData> {
    success: true;
    data: TData;
}

interface BackupRestoreResult {
    success: boolean;
}

// Mock Electron ipcMain
const ipcMainHandlers = new Map<string, (...args: TestValue[]) => Promise<TestValue>>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel, handler) => {
            ipcMainHandlers.set(channel, async (...args: TestValue[]) => Promise.resolve(handler(...args)));
        }),
        removeHandler: vi.fn()
    }
}));

// Mock IPC Wrapper

// Mock BackupService
const mockBackupService = {
    createBackup: vi.fn(),
    restoreBackup: vi.fn(),
    listBackups: vi.fn(),
    deleteBackup: vi.fn(),
    getBackupDir: vi.fn(),
    getAutoBackupStatus: vi.fn(),
    configureAutoBackup: vi.fn(),
    cleanupOldBackups: vi.fn()
};

describe('Backup IPC Integration', () => {
    beforeEach(() => {
        ipcMainHandlers.clear();
        vi.clearAllMocks();
    });

    const initIPC = () => {
        registerBackupIpc(() => null, mockBackupService as never);
    };

    it('should register expected handlers', () => {
        initIPC();
        expect(ipcMainHandlers.has('backup:create')).toBe(true);
        expect(ipcMainHandlers.has('backup:restore')).toBe(true);
        expect(ipcMainHandlers.has('backup:list')).toBe(true);
        expect(ipcMainHandlers.has('backup:delete')).toBe(true);
        expect(ipcMainHandlers.has('backup:getDir')).toBe(true);
        expect(ipcMainHandlers.has('backup:getAutoBackupStatus')).toBe(true);
        expect(ipcMainHandlers.has('backup:configureAutoBackup')).toBe(true);
        expect(ipcMainHandlers.has('backup:cleanup')).toBe(true);
    });

    describe('backup:create', () => {
        it('should create backup with default options', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('backup:create');

            mockBackupService.createBackup.mockResolvedValue({
                success: true,
                backupPath: '/backups/backup-2024.zip',
                size: 1024
            });

            const result = await handler!({} as IpcMainInvokeEvent);

            expect(mockBackupService.createBackup).toHaveBeenCalledWith(undefined);
            expect(result).toMatchObject({
                success: true,
                data: {
                    success: true,
                    backupPath: '/backups/backup-2024.zip'
                }
            });
        });

        it('should create backup with custom options', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('backup:create');

            mockBackupService.createBackup.mockResolvedValue({
                success: true,
                backupPath: '/backups/backup-2024.zip',
                size: 2048
            });

            const options = {
                includeChats: true,
                includeAuth: false,
                includeSettings: true,
                includePrompts: true
            };

            const result = await handler!({} as IpcMainInvokeEvent, options);

            expect(mockBackupService.createBackup).toHaveBeenCalledWith(options);
            expect(result).toMatchObject({
                success: true,
                data: {
                    success: true
                }
            });
        });
    });

    describe('backup:restore', () => {
        it('should restore backup with valid path', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('backup:restore');

            mockBackupService.restoreBackup.mockResolvedValue({
                success: true,
                restoredItems: ['chats', 'settings']
            });

            const result = await handler!({} as IpcMainInvokeEvent, '/backups/backup.zip');

            expect(mockBackupService.restoreBackup).toHaveBeenCalledWith('/backups/backup.zip', undefined);
            expect(result).toMatchObject({
                success: true,
                data: {
                    success: true
                }
            });
        });

        it('should restore backup with options', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('backup:restore');

            mockBackupService.restoreBackup.mockResolvedValue({
                success: true,
                restoredItems: ['chats']
            });

            const options = {
                restoreChats: true,
                restoreSettings: false,
                mergeChats: true
            };

            const result = await handler!(
                {} as IpcMainInvokeEvent,
                '/backups/backup.zip',
                options
            ) as IpcSuccessEnvelope<BackupRestoreResult>;

            expect(mockBackupService.restoreBackup).toHaveBeenCalledWith('/backups/backup.zip', options);
            expect(result.data.success).toBe(true);
        });

        it('should reject empty backup path', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('backup:restore');

            const result = await handler!({} as IpcMainInvokeEvent, '');

            expect(result).toMatchObject({
                success: false,
                error: { message: 'backupPath must be a non-empty string' }
            });
            expect(mockBackupService.restoreBackup).not.toHaveBeenCalled();
        });

        it('should reject invalid backup path type', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('backup:restore');

            const result = await handler!({} as IpcMainInvokeEvent, 123);

            expect(result).toMatchObject({
                success: false,
                error: { message: 'backupPath must be a non-empty string' }
            });
            expect(mockBackupService.restoreBackup).not.toHaveBeenCalled();
        });

        it('should reject whitespace-only backup path', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('backup:restore');

            const result = await handler!({} as IpcMainInvokeEvent, '   ');

            expect(result).toMatchObject({
                success: false,
                error: { message: 'backupPath must be a non-empty string' }
            });
            expect(mockBackupService.restoreBackup).not.toHaveBeenCalled();
        });
    });

    describe('backup:delete', () => {
        it('should delete backup with valid path', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('backup:delete');

            mockBackupService.deleteBackup.mockResolvedValue(true);

            const result = await handler!({} as IpcMainInvokeEvent, '/backups/old-backup.zip');

            expect(mockBackupService.deleteBackup).toHaveBeenCalledWith('/backups/old-backup.zip');
            expect(result).toEqual({ success: true, data: true });
        });

        it('should reject empty backup path', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('backup:delete');

            const result = await handler!({} as IpcMainInvokeEvent, '');

            expect(result).toMatchObject({
                success: false,
                error: { message: 'backupPath must be a non-empty string' }
            });
            expect(mockBackupService.deleteBackup).not.toHaveBeenCalled();
        });

        it('should reject invalid backup path type', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('backup:delete');

            const result = await handler!({} as IpcMainInvokeEvent, null);

            expect(result).toMatchObject({
                success: false,
                error: { message: 'backupPath must be a non-empty string' }
            });
            expect(mockBackupService.deleteBackup).not.toHaveBeenCalled();
        });
    });

    describe('backup:list', () => {
        it('should list all backups', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('backup:list');

            const backupList = [
                { name: 'backup-1.zip', path: '/backups/backup-1.zip', metadata: { createdAt: '2024-01-01' } },
                { name: 'backup-2.zip', path: '/backups/backup-2.zip', metadata: { createdAt: '2024-01-02' } }
            ];

            mockBackupService.listBackups.mockResolvedValue(backupList);

            const result = await handler!({} as IpcMainInvokeEvent);

            expect(mockBackupService.listBackups).toHaveBeenCalled();
            expect(result).toMatchObject({
                success: true,
                data: backupList
            });
        });

        it('should return empty array when no backups exist', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('backup:list');

            mockBackupService.listBackups.mockResolvedValue([]);

            const result = await handler!({} as IpcMainInvokeEvent);

            expect(result).toMatchObject({
                success: true,
                data: []
            });
        });
    });

    describe('backup:getDir', () => {
        it('should get backup directory', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('backup:getDir');

            mockBackupService.getBackupDir.mockReturnValue('/home/user/backups');

            const result = await handler!({} as IpcMainInvokeEvent);

            expect(mockBackupService.getBackupDir).toHaveBeenCalled();
            expect(result).toEqual({ success: true, data: '/home/user/backups' });
        });
    });

    describe('backup:getAutoBackupStatus', () => {
        it('should get auto-backup status', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('backup:getAutoBackupStatus');

            const status = {
                enabled: true,
                intervalHours: 24,
                maxBackups: 7,
                lastBackup: '2024-01-15T10:00:00Z'
            };

            mockBackupService.getAutoBackupStatus.mockResolvedValue(status);

            const result = await handler!({} as IpcMainInvokeEvent);

            expect(mockBackupService.getAutoBackupStatus).toHaveBeenCalled();
            expect(result).toMatchObject({
                success: true,
                data: status
            });
        });

        it('should handle disabled auto-backup', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('backup:getAutoBackupStatus');

            const status = {
                enabled: false,
                intervalHours: 24,
                maxBackups: 5,
                lastBackup: null
            };

            mockBackupService.getAutoBackupStatus.mockResolvedValue(status);

            const result = await handler!({} as IpcMainInvokeEvent);

            expect(result).toMatchObject({
                success: true,
                data: { enabled: false, lastBackup: null }
            });
        });
    });

    describe('backup:configureAutoBackup', () => {
        it('should configure auto-backup with full config', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('backup:configureAutoBackup');

            mockBackupService.configureAutoBackup.mockResolvedValue(undefined);

            const config = {
                enabled: true,
                intervalHours: 12,
                maxBackups: 10
            };

            const result = await handler!({} as IpcMainInvokeEvent, config);

            expect(mockBackupService.configureAutoBackup).toHaveBeenCalledWith(config);
            expect(result).toEqual({ success: true, data: undefined });
        });

        it('should configure auto-backup with minimal config', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('backup:configureAutoBackup');

            mockBackupService.configureAutoBackup.mockResolvedValue(undefined);

            const config = { enabled: false };

            const result = await handler!({} as IpcMainInvokeEvent, config);

            expect(mockBackupService.configureAutoBackup).toHaveBeenCalledWith(config);
            expect(result).toEqual({ success: true, data: undefined });
        });
    });

    describe('backup:cleanup', () => {
        it('should cleanup old backups and return count', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('backup:cleanup');

            mockBackupService.cleanupOldBackups.mockResolvedValue(3);

            const result = await handler!({} as IpcMainInvokeEvent);

            expect(mockBackupService.cleanupOldBackups).toHaveBeenCalled();
            expect(result).toEqual({ success: true, data: 3 });
        });

        it('should return zero when no backups cleaned up', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('backup:cleanup');

            mockBackupService.cleanupOldBackups.mockResolvedValue(0);

            const result = await handler!({} as IpcMainInvokeEvent);

            expect(result).toEqual({ success: true, data: 0 });
        });
    });
});

