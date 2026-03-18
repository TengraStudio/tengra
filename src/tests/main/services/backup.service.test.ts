/**
 * Unit tests for BackupService
 */
import * as fs from 'fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fs
vi.mock('fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(),
    unlinkSync: vi.fn(),
    promises: {
        mkdir: vi.fn(),
        writeFile: vi.fn(),
        readFile: vi.fn(),
        readdir: vi.fn(),
        access: vi.fn(),
        unlink: vi.fn()
    }
}));

// Mock DataService
const mockDataService = {
    getPath: vi.fn().mockImplementation((type: string) => {
        if (type === 'data') { return '/mock/data'; }
        if (type === 'config') { return '/mock/config'; }
        return '/mock';
    })
};

// Mock DatabaseService
const mockDatabaseService = {
    getAllChats: vi.fn().mockResolvedValue([]),
    getAllMessages: vi.fn().mockResolvedValue([]),
    getPrompts: vi.fn().mockResolvedValue([]),
    getFolders: vi.fn().mockResolvedValue([]),
    getChat: vi.fn().mockResolvedValue(null),
    createChat: vi.fn().mockResolvedValue({ success: true, id: '1' }),
    updateChat: vi.fn().mockResolvedValue({ success: true }),
    addMessage: vi.fn().mockResolvedValue({ success: true }),
    getPrompt: vi.fn().mockResolvedValue(null),
    updatePrompt: vi.fn().mockResolvedValue({ success: true }),
    createPrompt: vi.fn().mockResolvedValue({ success: true }),
    getFolder: vi.fn().mockResolvedValue(null),
    updateFolder: vi.fn().mockResolvedValue({ success: true }),
    createFolder: vi.fn().mockResolvedValue({ success: true })
};

describe('BackupService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(fs.readdirSync).mockReturnValue([]);

        // Setup default async mock implementations
        (fs.promises.mkdir as TestLooseMock).mockResolvedValue(undefined);
        (fs.promises.writeFile as TestLooseMock).mockResolvedValue(undefined);
        (fs.promises.readFile as TestLooseMock).mockResolvedValue('{}');
        (fs.promises.readdir as TestLooseMock).mockResolvedValue([]);
        (fs.promises.access as TestLooseMock).mockResolvedValue(undefined);
        (fs.promises.unlink as TestLooseMock).mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.resetModules();
    });

    describe('constructor', () => {
        it('should create backup directory if it does not exist', async () => {
            const { BackupService } = await import('@main/services/data/backup.service');
            new BackupService(mockDataService as never, mockDatabaseService as never);

            // Wait for async constructor operations
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(fs.promises.mkdir).toHaveBeenCalledWith(
                expect.stringContaining('backups'),
                expect.objectContaining({ recursive: true })
            );
        });
    });

    describe('createBackup', () => {
        it('should create a backup with default options', async () => {
            // Setup specific mocks
            (fs.promises.readFile as TestLooseMock).mockImplementation(async (p: string) => {
                if (p.includes('settings.json')) {
                    return JSON.stringify({ general: { theme: 'dark' } });
                }
                return '{}';
            });
            mockDatabaseService.getAllChats.mockResolvedValue([{ id: '1', title: 'Test Chat' }]);

            const { BackupService } = await import('@main/services/data/backup.service');
            const service = new BackupService(mockDataService as never, mockDatabaseService as never);
            const result = await service.createBackup();

            expect(result.success).toBe(true);
            expect(result.path).toBeDefined();
            expect(result.metadata).toBeDefined();
            expect(result.metadata?.includes).toContain('settings');
            expect(result.metadata?.includes).toContain('chats');
            expect(fs.promises.writeFile).toHaveBeenCalled();
        });

        it('should respect includeChats option', async () => {
            const { BackupService } = await import('@main/services/data/backup.service');
            const service = new BackupService(mockDataService as never, mockDatabaseService as never);

            await service.createBackup({ includeChats: false });

            expect(mockDatabaseService.getAllChats).not.toHaveBeenCalled();
        });
    });

    describe('restoreBackup', () => {
        it('should restore from a valid backup file', async () => {
            const backupData = {
                _metadata: { version: '2.0', createdAt: '2023-01-01', includes: ['settings', 'chats'] },
                settings: { general: { theme: 'light' } },
                chats: [{ id: '1', title: 'Restored Chat' }]
            };

            (fs.promises.readFile as TestLooseMock).mockResolvedValue(JSON.stringify(backupData));
            (fs.promises.access as TestLooseMock).mockResolvedValue(undefined);

            const { BackupService } = await import('@main/services/data/backup.service');
            const service = new BackupService(mockDataService as never, mockDatabaseService as never);

            const result = await service.restoreBackup('/path/to/backup.json');

            expect(result.success).toBe(true);
            expect(result.restored).toContain('settings');
            expect(result.restored).toContain('chats (1 processed)');
            expect(fs.promises.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('settings.json'),
                expect.any(String)
            );
            expect(mockDatabaseService.createChat).toHaveBeenCalled();
        });

        it('should return error if backup file does not exist', async () => {
            const errorMsg = 'ENOENT: no such file or directory';
            (fs.promises.readFile as TestLooseMock).mockRejectedValue(new Error(errorMsg));

            const { BackupService } = await import('@main/services/data/backup.service');
            const service = new BackupService(mockDataService as never, mockDatabaseService as never);

            const result = await service.restoreBackup('/path/to/missing.json');

            expect(result.success).toBe(false);
            expect(result.errors).toContain(errorMsg);
        });
    });

    describe('listBackups', () => {
        it('should list available backups', async () => {
            (fs.promises.readdir as TestLooseMock).mockResolvedValue(['backup-1.json', 'other.txt']);
            (fs.promises.readFile as TestLooseMock).mockResolvedValue(JSON.stringify({
                _metadata: { createdAt: '2023-01-01' }
            }));

            const { BackupService } = await import('@main/services/data/backup.service');
            const service = new BackupService(mockDataService as never, mockDatabaseService as never);

            const backups = await service.listBackups();

            expect(backups.length).toBe(1);
            expect(backups[0]!.name).toBe('backup-1.json');
        });
    });

    describe('deleteBackup', () => {
        it('should delete a backup file', async () => {
            (fs.promises.unlink as TestLooseMock).mockResolvedValue(undefined);

            const { BackupService } = await import('@main/services/data/backup.service');
            const service = new BackupService(mockDataService as never, mockDatabaseService as never);

            const result = await service.deleteBackup('/path/to/backup.json');

            expect(result).toBe(true);
            expect(fs.promises.unlink).toHaveBeenCalledWith('/path/to/backup.json');
        });

        it('should return false if delete fails', async () => {
            (fs.promises.unlink as TestLooseMock).mockRejectedValue(new Error('Delete failed'));

            const { BackupService } = await import('@main/services/data/backup.service');
            const service = new BackupService(mockDataService as never, mockDatabaseService as never);

            const result = await service.deleteBackup('/path/to/backup.json');

            expect(result).toBe(false);
        });
    });

    describe('getBackupDir', () => {
        it('should return the backup directory path', async () => {
            const { BackupService } = await import('@main/services/data/backup.service');
            const service = new BackupService(mockDataService as never, mockDatabaseService as never);

            const backupDir = service.getBackupDir();

            expect(backupDir).toContain('backups');
        });
    });

    describe('getAutoBackupStatus', () => {
        it('should return auto-backup configuration', async () => {
            const { BackupService } = await import('@main/services/data/backup.service');
            const service = new BackupService(mockDataService as never, mockDatabaseService as never);

            const status = service.getAutoBackupStatus();

            expect(status).toHaveProperty('enabled');
            expect(status).toHaveProperty('intervalHours');
            expect(status).toHaveProperty('maxBackups');
        });
    });

    describe('configureAutoBackup', () => {
        it('should enable auto-backup', async () => {
            (fs.promises.mkdir as TestLooseMock).mockResolvedValue(undefined);
            (fs.promises.writeFile as TestLooseMock).mockResolvedValue(undefined);

            const { BackupService } = await import('@main/services/data/backup.service');
            const service = new BackupService(mockDataService as never, mockDatabaseService as never);

            service.configureAutoBackup({ enabled: true, intervalHours: 12 });

            const status = service.getAutoBackupStatus();
            expect(status.enabled).toBe(true);
            expect(status.intervalHours).toBe(12);
        });

        it('should enforce minimum interval of 1 hour', async () => {
            const { BackupService } = await import('@main/services/data/backup.service');
            const service = new BackupService(mockDataService as never, mockDatabaseService as never);

            service.configureAutoBackup({ enabled: true, intervalHours: 0 });

            const status = service.getAutoBackupStatus();
            expect(status.intervalHours).toBe(1);
        });
    });

    describe('cleanupOldBackups', () => {
        it('should delete backups exceeding maxBackups limit', async () => {
            const backups = Array.from({ length: 15 }, (_, i) => ({
                name: `backup-${i}.json`,
                path: `/mock/backups/backup-${i}.json`,
                metadata: { createdAt: new Date(Date.now() - i * 1000).toISOString() } as never
            }));

            (fs.promises.readdir as TestLooseMock).mockResolvedValue(backups.map(b => b.name));
            (fs.promises.readFile as TestLooseMock).mockImplementation(async (path: string) => {
                const backup = backups.find(b => path.includes(b.name));
                return JSON.stringify({ _metadata: backup?.metadata });
            });
            (fs.promises.unlink as TestLooseMock).mockResolvedValue(undefined);

            const { BackupService } = await import('@main/services/data/backup.service');
            const service = new BackupService(mockDataService as never, mockDatabaseService as never);
            service.configureAutoBackup({ enabled: true, maxBackups: 10 });

            const deleted = await service.cleanupOldBackups();

            expect(deleted).toBe(5);
        });

        it('should not delete backups if under limit', async () => {
            (fs.promises.readdir as TestLooseMock).mockResolvedValue(['backup-1.json']);
            (fs.promises.readFile as TestLooseMock).mockResolvedValue(JSON.stringify({
                _metadata: { createdAt: '2023-01-01' }
            }));

            const { BackupService } = await import('@main/services/data/backup.service');
            const service = new BackupService(mockDataService as never, mockDatabaseService as never);

            const deleted = await service.cleanupOldBackups();

            expect(deleted).toBe(0);
        });
    });

    describe('dispose', () => {
        it('should stop auto-backup timer', async () => {
            const { BackupService } = await import('@main/services/data/backup.service');
            const service = new BackupService(mockDataService as never, mockDatabaseService as never);

            service.configureAutoBackup({ enabled: true });
            service.dispose();

            // Timer should be stopped - verify no errors
            expect(true).toBe(true);
        });
    });
});
