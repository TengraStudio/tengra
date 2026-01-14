/**
 * Unit tests for BackupService
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';


// Mock fs
vi.mock('fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(),
    unlinkSync: vi.fn()
}));

// Mock DataService
const mockDataService = {
    getPath: vi.fn().mockImplementation((type: string) => {
        if (type === 'data') return '/mock/data';
        if (type === 'config') return '/mock/config';
        return '/mock';
    })
};

describe('BackupService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(fs.readdirSync).mockReturnValue([]);
    });

    afterEach(() => {
        vi.resetModules();
    });

    describe('constructor', () => {
        it('should create backup directory if it does not exist', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const { BackupService } = await import('@main/services/backup.service');
            new BackupService(mockDataService as any);

            expect(fs.mkdirSync).toHaveBeenCalledWith(
                expect.stringContaining('backups'),
                { recursive: true }
            );
        });

        it('should not create backup directory if it exists', async () => {
            vi.mocked(fs.existsSync).mockImplementation((p) => {
                return (p as string).includes('backups');
            });

            const { BackupService } = await import('@main/services/backup.service');
            new BackupService(mockDataService as any);

            // mkdirSync should not be called for backups dir (only for config dir potentially)
            const backupDirCalls = vi.mocked(fs.mkdirSync).mock.calls.filter(
                call => (call[0] as string).includes('backups')
            );
            expect(backupDirCalls.length).toBe(0);
        });
    });

    describe('createBackup', () => {
        it('should create a backup with default options', async () => {
            vi.mocked(fs.existsSync).mockImplementation((p) => {
                const pathStr = p as string;
                if (pathStr.includes('backups')) return true;
                if (pathStr.includes('settings.json')) return true;
                if (pathStr.includes('chats.json')) return true;
                return false;
            });
            vi.mocked(fs.readFileSync).mockImplementation((p) => {
                if ((p as string).includes('settings.json')) {
                    return JSON.stringify({ general: { theme: 'dark' } });
                }
                if ((p as string).includes('chats.json')) {
                    return JSON.stringify([{ id: '1', title: 'Test Chat' }]);
                }
                return '{}';
            });

            const { BackupService } = await import('@main/services/backup.service');
            const service = new BackupService(mockDataService as any);
            const result = await service.createBackup();

            expect(result.success).toBe(true);
            expect(result.path).toBeDefined();
            expect(result.metadata).toBeDefined();
            expect(result.metadata?.includes).toContain('settings');
            expect(result.metadata?.includes).toContain('chats');
            expect(fs.writeFileSync).toHaveBeenCalled();
        });

        it('should respect includeChats option', async () => {
            vi.mocked(fs.existsSync).mockImplementation((p) => {
                const pathStr = p as string;
                if (pathStr.includes('backups')) return true;
                if (pathStr.includes('settings.json')) return true;
                if (pathStr.includes('chats.json')) return true;
                return false;
            });
            vi.mocked(fs.readFileSync).mockImplementation((p) => {
                if ((p as string).includes('settings.json')) {
                    return JSON.stringify({ general: { theme: 'dark' } });
                }
                return '[]';
            });

            const { BackupService } = await import('@main/services/backup.service');
            const service = new BackupService(mockDataService as any);
            const result = await service.createBackup({ includeChats: false });

            expect(result.success).toBe(true);
            expect(result.metadata?.includes).not.toContain('chats');
        });

        it('should handle errors gracefully', async () => {
            vi.mocked(fs.existsSync).mockImplementation((p) => {
                return (p as string).includes('backups');
            });
            vi.mocked(fs.writeFileSync).mockImplementation(() => {
                throw new Error('Disk full');
            });

            const { BackupService } = await import('@main/services/backup.service');
            const service = new BackupService(mockDataService as any);
            const result = await service.createBackup();

            expect(result.success).toBe(false);
            expect(result.error).toContain('Disk full');
        });
    });

    describe('restoreBackup', () => {
        it('should restore from a valid backup', async () => {
            const backupContent = {
                settings: { general: { theme: 'light' } },
                chats: [{ id: '1', title: 'Restored Chat' }],
                _metadata: {
                    version: '1.0',
                    createdAt: new Date().toISOString(),
                    appVersion: '1.0.0',
                    platform: 'win32',
                    includes: ['settings', 'chats']
                }
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(backupContent));
            vi.mocked(fs.writeFileSync).mockImplementation(() => { }); // Allow writes to succeed

            const { BackupService } = await import('@main/services/backup.service');
            const service = new BackupService(mockDataService as any);
            const result = await service.restoreBackup('/mock/backup.json');

            expect(result.success).toBe(true);
            expect(result.restored).toContain('settings');
            expect(result.restored).toContain('chats');
        });

        it('should return error for missing backup file', async () => {
            vi.mocked(fs.existsSync).mockImplementation((p) => {
                if ((p as string).includes('backups')) return true;
                return false;
            });

            const { BackupService } = await import('@main/services/backup.service');
            const service = new BackupService(mockDataService as any);
            const result = await service.restoreBackup('/nonexistent/backup.json');

            expect(result.success).toBe(false);
            expect(result.errors).toContain('Backup file not found');
        });

        it('should return error for invalid backup (missing metadata)', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
                settings: { general: { theme: 'dark' } }
                // Missing _metadata
            }));

            const { BackupService } = await import('@main/services/backup.service');
            const service = new BackupService(mockDataService as any);
            const result = await service.restoreBackup('/mock/invalid-backup.json');

            expect(result.success).toBe(false);
            expect(result.errors[0]).toContain('missing metadata');
        });

        it('should merge chats when mergeChats option is true', async () => {
            const existingChats = [{ id: '1', title: 'Existing Chat' }];
            const backupChats = [
                { id: '1', title: 'Backup Chat 1' }, // Duplicate
                { id: '2', title: 'Backup Chat 2' }  // New
            ];
            const backupContent = {
                chats: backupChats,
                _metadata: {
                    version: '1.0',
                    createdAt: new Date().toISOString(),
                    appVersion: '1.0.0',
                    platform: 'win32',
                    includes: ['chats']
                }
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockImplementation((p) => {
                if ((p as string).includes('chats.json')) {
                    return JSON.stringify(existingChats);
                }
                return JSON.stringify(backupContent);
            });
            vi.mocked(fs.writeFileSync).mockImplementation(() => { }); // Allow writes to succeed

            const { BackupService } = await import('@main/services/backup.service');
            const service = new BackupService(mockDataService as any);
            const result = await service.restoreBackup('/mock/backup.json', { mergeChats: true });

            expect(result.success).toBe(true);
            expect(result.restored[0]).toContain('merged');
        });
    });

    describe('listBackups', () => {
        it('should list all backups sorted by date', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readdirSync).mockReturnValue([
                'backup-2024-01-01.json' as any,
                'backup-2024-01-02.json' as any
            ]);
            vi.mocked(fs.readFileSync).mockImplementation((p) => {
                if ((p as string).includes('2024-01-01')) {
                    return JSON.stringify({
                        _metadata: { createdAt: '2024-01-01T00:00:00.000Z' }
                    });
                }
                if ((p as string).includes('2024-01-02')) {
                    return JSON.stringify({
                        _metadata: { createdAt: '2024-01-02T00:00:00.000Z' }
                    });
                }
                return '{}';
            });

            const { BackupService } = await import('@main/services/backup.service');
            const service = new BackupService(mockDataService as any);
            const backups = service.listBackups();

            expect(backups).toHaveLength(2);
            // Sorted by date descending (newest first)
            expect(backups[0].name).toBe('backup-2024-01-02.json');
        });

        it('should return empty array if backup directory does not exist', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const { BackupService } = await import('@main/services/backup.service');
            const service = new BackupService(mockDataService as any);
            const backups = service.listBackups();

            expect(backups).toEqual([]);
        });
    });

    describe('deleteBackup', () => {
        it('should delete an existing backup', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);

            const { BackupService } = await import('@main/services/backup.service');
            const service = new BackupService(mockDataService as any);
            const result = service.deleteBackup('/mock/backup.json');

            expect(result).toBe(true);
            expect(fs.unlinkSync).toHaveBeenCalledWith('/mock/backup.json');
        });

        it('should return false for non-existent backup', async () => {
            vi.mocked(fs.existsSync).mockImplementation((p) => {
                if ((p as string).includes('backups')) return true;
                return false;
            });

            const { BackupService } = await import('@main/services/backup.service');
            const service = new BackupService(mockDataService as any);
            const result = service.deleteBackup('/nonexistent/backup.json');

            expect(result).toBe(false);
        });
    });

    describe('auto-backup configuration', () => {
        it('should return default auto-backup status', async () => {
            vi.mocked(fs.existsSync).mockImplementation((p) => {
                return (p as string).includes('backups');
            });

            const { BackupService } = await import('@main/services/backup.service');
            const service = new BackupService(mockDataService as any);
            const status = service.getAutoBackupStatus();

            expect(status.enabled).toBe(false);
            expect(status.intervalHours).toBe(24);
            expect(status.maxBackups).toBe(10);
            expect(status.lastBackup).toBeNull();
        });

        it('should configure auto-backup', async () => {
            vi.mocked(fs.existsSync).mockImplementation((p) => {
                return (p as string).includes('backups');
            });

            const { BackupService } = await import('@main/services/backup.service');
            const service = new BackupService(mockDataService as any);

            service.configureAutoBackup({
                enabled: true,
                intervalHours: 12,
                maxBackups: 5
            });

            const status = service.getAutoBackupStatus();
            expect(status.enabled).toBe(true);
            expect(status.intervalHours).toBe(12);
            expect(status.maxBackups).toBe(5);
            expect(fs.writeFileSync).toHaveBeenCalled();

            // Clean up
            service.dispose();
        });

        it('should enforce minimum values for interval and maxBackups', async () => {
            vi.mocked(fs.existsSync).mockImplementation((p) => {
                return (p as string).includes('backups');
            });

            const { BackupService } = await import('@main/services/backup.service');
            const service = new BackupService(mockDataService as any);

            service.configureAutoBackup({
                enabled: false,
                intervalHours: 0, // Below minimum
                maxBackups: 0     // Below minimum
            });

            const status = service.getAutoBackupStatus();
            expect(status.intervalHours).toBe(1); // Minimum 1 hour
            expect(status.maxBackups).toBe(1);    // Minimum 1 backup
        });
    });

    describe('cleanupOldBackups', () => {
        it('should delete old backups exceeding maxBackups', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readdirSync).mockReturnValue([
                'backup-1.json' as any,
                'backup-2.json' as any,
                'backup-3.json' as any,
                'backup-4.json' as any,
                'backup-5.json' as any
            ]);
            vi.mocked(fs.readFileSync).mockImplementation((p) => {
                const match = (p as string).match(/backup-(\d)/);
                if (match) {
                    return JSON.stringify({
                        _metadata: { createdAt: `2024-01-0${match[1]}T00:00:00.000Z` }
                    });
                }
                return '{}';
            });

            const { BackupService } = await import('@main/services/backup.service');
            const service = new BackupService(mockDataService as any);

            // Set maxBackups to 3
            service.configureAutoBackup({ enabled: false, maxBackups: 3 });

            const deleted = service.cleanupOldBackups();

            expect(deleted).toBe(2); // Should delete 2 oldest backups
        });

        it('should not delete if under maxBackups', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readdirSync).mockReturnValue([
                'backup-1.json' as any,
                'backup-2.json' as any
            ]);
            vi.mocked(fs.readFileSync).mockImplementation(() => {
                return JSON.stringify({
                    _metadata: { createdAt: new Date().toISOString() }
                });
            });

            const { BackupService } = await import('@main/services/backup.service');
            const service = new BackupService(mockDataService as any);

            const deleted = service.cleanupOldBackups();

            expect(deleted).toBe(0);
            expect(fs.unlinkSync).not.toHaveBeenCalled();
        });
    });

    describe('getBackupDir', () => {
        it('should return the backup directory path', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);

            const { BackupService } = await import('@main/services/backup.service');
            const service = new BackupService(mockDataService as any);
            const dir = service.getBackupDir();

            expect(dir).toContain('backups');
        });
    });
});
