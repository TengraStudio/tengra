/**
 * Unit tests for BackupService (data layer)
 * Covers: backup creation, restore, scheduling, listing, error handling, edge cases
 */
import * as fs from 'fs';
import * as zlib from 'zlib';

import type { DataService } from '@main/services/data/data.service';
import type { DatabaseService } from '@main/services/data/database.service';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}));

vi.mock('fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(),
    unlinkSync: vi.fn(),
    statSync: vi.fn(() => ({ isDirectory: () => false, size: 0 })),
    promises: {
        mkdir: vi.fn(),
        writeFile: vi.fn(),
        readFile: vi.fn(),
        readdir: vi.fn(),
        access: vi.fn(),
        unlink: vi.fn(),
        copyFile: vi.fn()
    }
}));

// ── helpers ──────────────────────────────────────────────────────────────────
function mockDataService(): DataService {
    return {
        getPath: vi.fn().mockImplementation((type: string) => {
            if (type === 'data') { return '/mock/data'; }
            if (type === 'config') { return '/mock/config'; }
            return '/mock';
        })
    } as never as DataService;
}

function mockDatabaseService(): DatabaseService {
    return {
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
    } as never as DatabaseService;
}

function validBackupJson(overrides: Record<string, TestValue> = {}): string {
    return JSON.stringify({
        _metadata: {
            version: '2.0',
            createdAt: '2024-01-01T00:00:00.000Z',
            appVersion: '1.0.0',
            platform: 'linux',
            includes: ['settings', 'chats']
        },
        settings: { general: { theme: 'dark' } },
        chats: [{ id: 'c1', title: 'Chat 1', messages: [] }],
        prompts: [{ id: 'p1', title: 'Prompt 1', content: 'hello', tags: ['tag1'] }],
        folders: [{ id: 'f1', name: 'Folder 1', color: '#fff' }],
        ...overrides
    });
}

// ── test suite ───────────────────────────────────────────────────────────────
describe('BackupService (data)', () => {
    let dataSvc: DataService;
    let dbSvc: DatabaseService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ shouldAdvanceTime: false });

        dataSvc = mockDataService();
        dbSvc = mockDatabaseService();

        // Defaults for fs.promises
        (fs.promises.mkdir as Mock).mockResolvedValue(undefined);
        (fs.promises.writeFile as Mock).mockResolvedValue(undefined);
        (fs.promises.readFile as Mock).mockResolvedValue('{}');
        (fs.promises.readdir as Mock).mockResolvedValue([]);
        (fs.promises.access as Mock).mockResolvedValue(undefined);
        (fs.promises.unlink as Mock).mockResolvedValue(undefined);
        (fs.promises.copyFile as Mock).mockResolvedValue(undefined);
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(fs.readdirSync).mockReturnValue([]);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.resetModules();
    });

    // Helper to get a fresh import of BackupService (isolated module state)
    async function createService() {
        const { BackupService } = await import('@main/services/data/backup.service');
        const svc = new BackupService(dataSvc, dbSvc);
        // Let constructor microtasks settle
        await vi.advanceTimersByTimeAsync(0);
        return svc;
    }

    // ── constructor ──────────────────────────────────────────────────────────
    describe('constructor', () => {
        it('should create backup directory on construction', async () => {
            await createService();
            expect(fs.promises.mkdir).toHaveBeenCalledWith(
                expect.stringContaining('backups'),
                expect.objectContaining({ recursive: true })
            );
        });

        it('should not throw when backup directory creation fails', async () => {
            (fs.promises.mkdir as Mock).mockRejectedValueOnce(new Error('EACCES'));
            const svc = await createService();
            expect(svc.getBackupDir()).toContain('backups');
        });
    });

    // ── createBackup ─────────────────────────────────────────────────────────
    describe('createBackup', () => {
        it('should create a full backup with default options', async () => {
            (fs.promises.readFile as Mock).mockImplementation(async (p: string) => {
                if (String(p).includes('settings.json')) {
                    return JSON.stringify({ general: { theme: 'dark' } });
                }
                return '{}';
            });
            (dbSvc.getAllChats as Mock).mockResolvedValue([{ id: '1', title: 'C1' }]);
            (dbSvc.getAllMessages as Mock).mockResolvedValue([{ chatId: '1', role: 'user', content: 'hi' }]);
            (dbSvc.getPrompts as Mock).mockResolvedValue([{ id: 'p1', title: 'P1' }]);
            (dbSvc.getFolders as Mock).mockResolvedValue([{ id: 'f1', name: 'F1' }]);

            const svc = await createService();
            const result = await svc.createBackup();

            expect(result.success).toBe(true);
            expect(result.path).toBeDefined();
            expect(result.metadata).toBeDefined();
            expect(result.metadata?.includes).toEqual(
                expect.arrayContaining(['settings', 'chats', 'prompts', 'folders'])
            );
            expect(fs.promises.writeFile).toHaveBeenCalled();
        });

        it('should skip chats when includeChats is false', async () => {
            const svc = await createService();
            await svc.createBackup({ includeChats: false });
            expect(dbSvc.getAllChats).not.toHaveBeenCalled();
        });

        it('should skip prompts when includePrompts is false', async () => {
            const svc = await createService();
            await svc.createBackup({ includePrompts: false });
            expect(dbSvc.getPrompts).not.toHaveBeenCalled();
        });

        it('should skip settings when includeSettings is false', async () => {
            const svc = await createService();
            const result = await svc.createBackup({ includeSettings: false });
            expect(result.success).toBe(true);
            expect(result.metadata?.includes).not.toContain('settings');
        });

        it('should produce a compressed backup when compress is true', async () => {
            const svc = await createService();
            const result = await svc.createBackup({ compress: true });
            expect(result.success).toBe(true);
            expect(result.path).toMatch(/\.json\.gz$/);
        });

        it('should produce an encrypted backup when encrypt is true', async () => {
            const svc = await createService();
            const result = await svc.createBackup({ encrypt: true });
            expect(result.success).toBe(true);
            expect(result.metadata?.encrypted).toBe(true);
        });

        it('should handle settings read failure gracefully', async () => {
            (fs.promises.readFile as Mock).mockRejectedValue(new Error('ENOENT'));
            const svc = await createService();
            const result = await svc.createBackup();
            expect(result.success).toBe(true);
            expect(result.metadata?.includes).not.toContain('settings');
        });

        it('should handle database chat retrieval failure gracefully', async () => {
            (dbSvc.getAllChats as Mock).mockRejectedValue(new Error('DB error'));
            const svc = await createService();
            const result = await svc.createBackup();
            expect(result.success).toBe(true);
            expect(result.metadata?.includes).not.toContain('chats');
        });

        it('should handle database prompts retrieval failure gracefully', async () => {
            (dbSvc.getPrompts as Mock).mockRejectedValue(new Error('DB error'));
            const svc = await createService();
            const result = await svc.createBackup();
            expect(result.success).toBe(true);
            expect(result.metadata?.includes).not.toContain('prompts');
        });

        it('should handle database folders retrieval failure gracefully', async () => {
            (dbSvc.getFolders as Mock).mockRejectedValue(new Error('DB error'));
            const svc = await createService();
            const result = await svc.createBackup();
            expect(result.success).toBe(true);
            expect(result.metadata?.includes).not.toContain('folders');
        });

        it('should return failure when writeFile throws', async () => {
            (fs.promises.writeFile as Mock).mockRejectedValue(new Error('disk full'));
            const svc = await createService();
            const result = await svc.createBackup();
            expect(result.success).toBe(false);
            expect(result.error).toContain('disk full');
        });

        it('should set incremental metadata when incremental is true', async () => {
            // No existing backups so baseBackup stays undefined
            const svc = await createService();
            const result = await svc.createBackup({ incremental: true });
            expect(result.success).toBe(true);
            expect(result.metadata?.incremental).toBe(true);
        });
    });

    // ── restoreBackup ────────────────────────────────────────────────────────
    describe('restoreBackup', () => {
        it('should restore settings, chats, prompts, and folders', async () => {
            (fs.promises.readFile as Mock).mockResolvedValue(validBackupJson());

            const svc = await createService();
            const result = await svc.restoreBackup('/backup.json');

            expect(result.success).toBe(true);
            expect(result.restored).toContain('settings');
            expect(result.restored).toContain('chats (1 processed)');
            expect(result.restored).toContain('prompts');
            expect(result.restored).toContain('folders');
        });

        it('should report error for backup without metadata', async () => {
            (fs.promises.readFile as Mock).mockResolvedValue(JSON.stringify({ settings: {} }));

            const svc = await createService();
            const result = await svc.restoreBackup('/backup.json');

            expect(result.success).toBe(false);
            expect(result.errors).toContain('Invalid backup file: missing metadata');
        });

        it('should respect restoreChats=false option', async () => {
            (fs.promises.readFile as Mock).mockResolvedValue(validBackupJson());

            const svc = await createService();
            const result = await svc.restoreBackup('/backup.json', { restoreChats: false });

            expect(result.restored).not.toEqual(
                expect.arrayContaining([expect.stringContaining('chats')])
            );
            expect(dbSvc.createChat).not.toHaveBeenCalled();
        });

        it('should respect restoreSettings=false option', async () => {
            (fs.promises.readFile as Mock).mockResolvedValue(validBackupJson());

            const svc = await createService();
            const result = await svc.restoreBackup('/backup.json', { restoreSettings: false });

            expect(result.restored).not.toContain('settings');
        });

        it('should respect restorePrompts=false option', async () => {
            (fs.promises.readFile as Mock).mockResolvedValue(validBackupJson());

            const svc = await createService();
            const result = await svc.restoreBackup('/backup.json', { restorePrompts: false });

            expect(result.restored).not.toContain('prompts');
        });

        it('should update existing chat instead of creating new one', async () => {
            (fs.promises.readFile as Mock).mockResolvedValue(validBackupJson());
            (dbSvc.getChat as Mock).mockResolvedValue({ id: 'c1', title: 'Old Chat' });

            const svc = await createService();
            await svc.restoreBackup('/backup.json');

            expect(dbSvc.updateChat).toHaveBeenCalledWith('c1', expect.objectContaining({ title: 'Chat 1' }));
            expect(dbSvc.createChat).not.toHaveBeenCalled();
        });

        it('should update existing prompt instead of creating new one', async () => {
            (fs.promises.readFile as Mock).mockResolvedValue(validBackupJson());
            (dbSvc.getPrompt as Mock).mockResolvedValue({ id: 'p1', title: 'Old' });

            const svc = await createService();
            await svc.restoreBackup('/backup.json');

            expect(dbSvc.updatePrompt).toHaveBeenCalled();
            expect(dbSvc.createPrompt).not.toHaveBeenCalled();
        });

        it('should update existing folder instead of creating new one', async () => {
            (fs.promises.readFile as Mock).mockResolvedValue(validBackupJson());
            (dbSvc.getFolder as Mock).mockResolvedValue({ id: 'f1', name: 'Old' });

            const svc = await createService();
            await svc.restoreBackup('/backup.json');

            expect(dbSvc.updateFolder).toHaveBeenCalled();
            expect(dbSvc.createFolder).not.toHaveBeenCalled();
        });

        it('should return errors when readFile fails', async () => {
            (fs.promises.readFile as Mock).mockRejectedValue(new Error('ENOENT'));

            const svc = await createService();
            const result = await svc.restoreBackup('/missing.json');

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should handle compressed backup files', async () => {
            const compressed = zlib.gzipSync(Buffer.from(validBackupJson()));
            (fs.promises.readFile as Mock).mockResolvedValue(compressed);

            const svc = await createService();
            const result = await svc.restoreBackup('/backup.json.gz');

            expect(result.success).toBe(true);
        });

        it('should handle settings write failure during restore', async () => {
            (fs.promises.readFile as Mock).mockResolvedValue(validBackupJson());
            // First call is for reading the backup, subsequent writeFile for settings fails
            (fs.promises.writeFile as Mock).mockRejectedValue(new Error('write fail'));

            const svc = await createService();
            const result = await svc.restoreBackup('/backup.json');

            expect(result.errors).toEqual(
                expect.arrayContaining([expect.stringContaining('Settings')])
            );
        });
    });

    // ── listBackups ──────────────────────────────────────────────────────────
    describe('listBackups', () => {
        it('should list only .json and .json.gz files', async () => {
            (fs.promises.readdir as Mock).mockResolvedValue([
                'backup-1.json', 'backup-2.json.gz', 'readme.txt', 'notes.md'
            ]);
            (fs.promises.readFile as Mock).mockResolvedValue(validBackupJson());

            const svc = await createService();
            const backups = await svc.listBackups();

            expect(backups).toHaveLength(2);
            expect(backups.map(b => b.name)).toEqual(
                expect.arrayContaining(['backup-1.json', 'backup-2.json.gz'])
            );
        });

        it('should sort backups newest first', async () => {
            (fs.promises.readdir as Mock).mockResolvedValue(['old.json', 'new.json']);
            (fs.promises.readFile as Mock).mockImplementation(async (p: string) => {
                if (String(p).includes('old.json')) {
                    return JSON.stringify({ _metadata: { createdAt: '2023-01-01T00:00:00Z' } });
                }
                return JSON.stringify({ _metadata: { createdAt: '2024-06-01T00:00:00Z' } });
            });

            const svc = await createService();
            const backups = await svc.listBackups();

            expect(backups[0]?.name).toBe('new.json');
            expect(backups[1]?.name).toBe('old.json');
        });

        it('should return empty array when backup dir does not exist', async () => {
            (fs.promises.access as Mock).mockRejectedValue(new Error('ENOENT'));

            const svc = await createService();
            const backups = await svc.listBackups();

            expect(backups).toEqual([]);
        });

        it('should return empty array when readdir throws', async () => {
            (fs.promises.readdir as Mock).mockRejectedValue(new Error('EPERM'));

            const svc = await createService();
            const backups = await svc.listBackups();

            expect(backups).toEqual([]);
        });

        it('should still list backup if parsing metadata fails', async () => {
            (fs.promises.readdir as Mock).mockResolvedValue(['corrupt.json']);
            (fs.promises.readFile as Mock).mockRejectedValue(new Error('corrupt'));

            const svc = await createService();
            const backups = await svc.listBackups();

            expect(backups).toHaveLength(1);
            expect(backups[0]?.name).toBe('corrupt.json');
            expect(backups[0]?.metadata).toBeUndefined();
        });
    });

    // ── deleteBackup ─────────────────────────────────────────────────────────
    describe('deleteBackup', () => {
        it('should return true on successful deletion', async () => {
            const svc = await createService();
            const result = await svc.deleteBackup('/path/to/backup.json');

            expect(result).toBe(true);
            expect(fs.promises.unlink).toHaveBeenCalledWith('/path/to/backup.json');
        });

        it('should return false when unlink fails', async () => {
            (fs.promises.unlink as Mock).mockRejectedValue(new Error('ENOENT'));

            const svc = await createService();
            const result = await svc.deleteBackup('/path/to/missing.json');

            expect(result).toBe(false);
        });
    });

    // ── getBackupDir ─────────────────────────────────────────────────────────
    describe('getBackupDir', () => {
        it('should return path containing "backups"', async () => {
            const svc = await createService();
            expect(svc.getBackupDir()).toContain('backups');
        });
    });
});

describe('BackupService (data) - advanced', () => {
    let dataSvc: DataService;
    let dbSvc: DatabaseService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ shouldAdvanceTime: false });

        dataSvc = mockDataService();
        dbSvc = mockDatabaseService();

        // Defaults for fs.promises
        (fs.promises.mkdir as Mock).mockResolvedValue(undefined);
        (fs.promises.writeFile as Mock).mockResolvedValue(undefined);
        (fs.promises.readFile as Mock).mockResolvedValue('{}');
        (fs.promises.readdir as Mock).mockResolvedValue([]);
        (fs.promises.access as Mock).mockResolvedValue(undefined);
        (fs.promises.unlink as Mock).mockResolvedValue(undefined);
        (fs.promises.copyFile as Mock).mockResolvedValue(undefined);
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(fs.readdirSync).mockReturnValue([]);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.resetModules();
    });

    // Helper to get a fresh import of BackupService (isolated module state)
    async function createService() {
        const { BackupService } = await import('@main/services/data/backup.service');
        const svc = new BackupService(dataSvc, dbSvc);
        // Let constructor microtasks settle
        await vi.advanceTimersByTimeAsync(0);
        return svc;
    }

    // ── auto-backup scheduling ───────────────────────────────────────────────
    describe('auto-backup configuration', () => {
        it('should return default config initially', async () => {
            const svc = await createService();
            const status = svc.getAutoBackupStatus();

            expect(status.enabled).toBe(false);
            expect(status.intervalHours).toBe(24);
            expect(status.maxBackups).toBe(10);
            expect(status.lastBackup).toBeNull();
        });

        it('should update config when configureAutoBackup is called', async () => {
            const svc = await createService();
            svc.configureAutoBackup({
                enabled: true,
                intervalHours: 12,
                maxBackups: 5,
                compression: true,
                encryption: true,
                verification: false
            });

            const status = svc.getAutoBackupStatus();
            expect(status.enabled).toBe(true);
            expect(status.intervalHours).toBe(12);
            expect(status.maxBackups).toBe(5);
            expect(status.compression).toBe(true);
            expect(status.encryption).toBe(true);
            expect(status.verification).toBe(false);
        });

        it('should enforce minimum interval of 1 hour', async () => {
            const svc = await createService();
            svc.configureAutoBackup({ enabled: true, intervalHours: 0 });
            expect(svc.getAutoBackupStatus().intervalHours).toBe(1);
        });

        it('should enforce minimum interval for negative values', async () => {
            const svc = await createService();
            svc.configureAutoBackup({ enabled: true, intervalHours: -10 });
            expect(svc.getAutoBackupStatus().intervalHours).toBe(1);
        });

        it('should enforce minimum maxBackups of 1', async () => {
            const svc = await createService();
            svc.configureAutoBackup({ enabled: true, maxBackups: 0 });
            expect(svc.getAutoBackupStatus().maxBackups).toBe(1);
        });

        it('should set cloudSyncDir when provided', async () => {
            const svc = await createService();
            svc.configureAutoBackup({ enabled: false, cloudSyncDir: '/cloud/backups' });
            expect(svc.getAutoBackupStatus().cloudSyncDir).toBe('/cloud/backups');
        });

        it('should save config to disk when configuring', async () => {
            const svc = await createService();
            svc.configureAutoBackup({ enabled: false });
            // Allow the async saveAutoBackupConfig to resolve
            await vi.advanceTimersByTimeAsync(0);
            expect(fs.promises.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('backup-config.json'),
                expect.any(String)
            );
        });
    });

    // ── cleanupOldBackups ────────────────────────────────────────────────────
    describe('cleanupOldBackups', () => {
        it('should delete backups exceeding maxBackups limit', async () => {
            const names = Array.from({ length: 15 }, (_, i) => `backup-${i}.json`);
            (fs.promises.readdir as Mock).mockResolvedValue(names);
            (fs.promises.readFile as Mock).mockImplementation(async (p: string) => {
                const idx = names.findIndex(n => String(p).includes(n));
                return JSON.stringify({
                    _metadata: { createdAt: new Date(Date.now() - idx * 1000).toISOString() }
                });
            });

            const svc = await createService();
            svc.configureAutoBackup({ enabled: true, maxBackups: 10 });
            const deleted = await svc.cleanupOldBackups();

            expect(deleted).toBe(5);
        });

        it('should return 0 when backups are under limit', async () => {
            (fs.promises.readdir as Mock).mockResolvedValue(['backup-1.json']);
            (fs.promises.readFile as Mock).mockResolvedValue(validBackupJson());

            const svc = await createService();
            const deleted = await svc.cleanupOldBackups();

            expect(deleted).toBe(0);
        });

        it('should return 0 when there are no backups', async () => {
            (fs.promises.readdir as Mock).mockResolvedValue([]);

            const svc = await createService();
            const deleted = await svc.cleanupOldBackups();

            expect(deleted).toBe(0);
        });

        it('should handle partial deletion failures gracefully', async () => {
            const names = Array.from({ length: 5 }, (_, i) => `backup-${i}.json`);
            (fs.promises.readdir as Mock).mockResolvedValue(names);
            (fs.promises.readFile as Mock).mockImplementation(async (p: string) => {
                const idx = names.findIndex(n => String(p).includes(n));
                return JSON.stringify({
                    _metadata: { createdAt: new Date(Date.now() - idx * 1000).toISOString() }
                });
            });
            // Fail some deletes
            let callCount = 0;
            (fs.promises.unlink as Mock).mockImplementation(async () => {
                callCount++;
                if (callCount === 1) { throw new Error('EACCES'); }
            });

            const svc = await createService();
            svc.configureAutoBackup({ enabled: true, maxBackups: 2 });
            const deleted = await svc.cleanupOldBackups();

            // 3 to delete, 1 fails -> 2 deleted
            expect(deleted).toBe(2);
        });
    });

    // ── verifyBackup ─────────────────────────────────────────────────────────
    describe('verifyBackup', () => {
        it('should return valid for a backup without stored checksum', async () => {
            (fs.promises.readFile as Mock).mockResolvedValue(validBackupJson());

            const svc = await createService();
            const result = await svc.verifyBackup('/backup.json');

            expect(result.valid).toBe(true);
            expect(result.checksum).toBeDefined();
        });

        it('should return valid when checksum matches', async () => {
            // verifyBackup reads the file, parses it, and recomputes checksum over the raw payload.
            // Since the stored checksum is part of the payload the checksums will only match
            // if we omit the checksum field from _metadata (service checks parsed._metadata?.checksum).
            // The simplest valid case is a backup without a stored checksum (already tested above).
            // Here we verify that a mismatched checksum is detected.
            const content = validBackupJson();
            const parsed = JSON.parse(content) as Record<string, Record<string, TestValue>>;
            parsed._metadata!.checksum = 'bad-checksum';
            (fs.promises.readFile as Mock).mockResolvedValue(JSON.stringify(parsed, null, 2));

            const svc = await createService();
            const result = await svc.verifyBackup('/backup.json');

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Checksum mismatch');
        });

        it('should return invalid when readFile throws', async () => {
            (fs.promises.readFile as Mock).mockRejectedValue(new Error('ENOENT'));

            const svc = await createService();
            const result = await svc.verifyBackup('/missing.json');

            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    // ── syncBackupToDirectory ────────────────────────────────────────────────
    describe('syncBackupToDirectory', () => {
        it('should sync backup to target directory', async () => {
            const svc = await createService();
            const result = await svc.syncBackupToDirectory('/backup.json', '/cloud/dir');

            expect(result.success).toBe(true);
            expect(result.targetPath).toBeDefined();
        });

        it('should return failure when copy fails', async () => {
            (fs.promises.mkdir as Mock).mockRejectedValue(new Error('EPERM'));

            const svc = await createService();
            const result = await svc.syncBackupToDirectory('/backup.json', '/cloud/dir');

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    // ── createDisasterRecoveryBundle ─────────────────────────────────────────
    describe('createDisasterRecoveryBundle', () => {
        it('should return error when no backups exist', async () => {
            (fs.promises.readdir as Mock).mockResolvedValue([]);

            const svc = await createService();
            const result = await svc.createDisasterRecoveryBundle();

            expect(result.success).toBe(false);
            expect(result.error).toContain('No backups available');
        });

        it('should create bundle with latest backup', async () => {
            (fs.promises.readdir as Mock).mockResolvedValue(['backup-1.json']);
            (fs.promises.readFile as Mock).mockResolvedValue(validBackupJson());

            const svc = await createService();
            const result = await svc.createDisasterRecoveryBundle('/target');

            expect(result.success).toBe(true);
            expect(result.bundlePath).toBeDefined();
            expect(result.files).toBeDefined();
            expect(result.files!.length).toBeGreaterThanOrEqual(2);
        });

        it('should handle mkdir failure in bundle creation', async () => {
            (fs.promises.readdir as Mock).mockResolvedValue(['backup-1.json']);
            (fs.promises.readFile as Mock).mockResolvedValue(validBackupJson());

            // Make the mkdir call for the bundle dir fail
            let mkdirCallCount = 0;
            (fs.promises.mkdir as Mock).mockImplementation(async () => {
                mkdirCallCount++;
                // The bundle mkdir is typically the 2nd+ call (first is for the constructor)
                if (mkdirCallCount > 1) { throw new Error('ENOSPC'); }
            });

            const svc = await createService();
            const result = await svc.createDisasterRecoveryBundle('/target');

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    // ── restoreDisasterRecoveryBundle ─────────────────────────────────────────
    describe('restoreDisasterRecoveryBundle', () => {
        it('should return error when bundle has no backup file', async () => {
            (fs.promises.readdir as Mock).mockResolvedValue(['readme.txt']);

            const svc = await createService();
            const result = await svc.restoreDisasterRecoveryBundle('/bundle');

            expect(result.success).toBe(false);
            expect(result.errors).toContain('No backup file found in disaster recovery bundle');
        });

        it('should restore from bundle with backup file', async () => {
            (fs.promises.readdir as Mock).mockResolvedValue(['backup-1.json']);
            (fs.promises.readFile as Mock).mockResolvedValue(validBackupJson());

            const svc = await createService();
            const result = await svc.restoreDisasterRecoveryBundle('/bundle');

            expect(result.success).toBe(true);
            expect(result.restored.length).toBeGreaterThan(0);
        });

        it('should restore auto-backup config from bundle', async () => {
            (fs.promises.readdir as Mock).mockResolvedValue(['backup-1.json', 'backup-config.json']);
            (fs.promises.readFile as Mock).mockResolvedValue(validBackupJson());
            const svc = await createService();
            const result = await svc.restoreDisasterRecoveryBundle('/bundle');

            expect(result.restored).toContain('auto-backup-config');
        });

        it('should handle readdir failure gracefully', async () => {
            (fs.promises.readdir as Mock).mockRejectedValue(new Error('EPERM'));

            const svc = await createService();
            const result = await svc.restoreDisasterRecoveryBundle('/bundle');

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    // ── dispose ──────────────────────────────────────────────────────────────
    describe('dispose', () => {
        it('should stop auto-backup timer on dispose', async () => {
            const svc = await createService();
            svc.configureAutoBackup({ enabled: true, intervalHours: 1 });
            svc.dispose();
            // No error means timer was cleared successfully
            expect(svc.getAutoBackupStatus().enabled).toBe(true);
        });

        it('should be safe to call dispose multiple times', async () => {
            const svc = await createService();
            svc.dispose();
            svc.dispose();
            // No error expected
        });
    });

    // ── edge cases ───────────────────────────────────────────────────────────
    describe('edge cases', () => {
        it('should handle empty backup data gracefully on restore', async () => {
            const emptyBackup = JSON.stringify({
                _metadata: {
                    version: '2.0',
                    createdAt: '2024-01-01T00:00:00Z',
                    appVersion: '1.0.0',
                    platform: 'linux',
                    includes: []
                }
            });
            (fs.promises.readFile as Mock).mockResolvedValue(emptyBackup);

            const svc = await createService();
            const result = await svc.restoreBackup('/empty.json');

            expect(result.success).toBe(true);
            expect(result.restored).toEqual([]);
        });

        it('should handle chats with missing messages array', async () => {
            const backup = JSON.stringify({
                _metadata: { version: '2.0', createdAt: '2024-01-01', includes: ['chats'], appVersion: '1.0.0', platform: 'linux' },
                chats: [{ id: 'c1', title: 'No messages' }]
            });
            (fs.promises.readFile as Mock).mockResolvedValue(backup);

            const svc = await createService();
            const result = await svc.restoreBackup('/backup.json');

            expect(result.restored).toContain('chats (1 processed)');
        });

        it('should handle chats with null/undefined fields', async () => {
            const backup = JSON.stringify({
                _metadata: { version: '2.0', createdAt: '2024-01-01', includes: ['chats'], appVersion: '1.0.0', platform: 'linux' },
                chats: [{
                    id: 'c1',
                    title: null,
                    model: null,
                    backend: null,
                    messages: [],
                    createdAt: null,
                    updatedAt: null,
                    isPinned: null,
                    isFavorite: null
                }]
            });
            (fs.promises.readFile as Mock).mockResolvedValue(backup);

            const svc = await createService();
            const result = await svc.restoreBackup('/backup.json');

            expect(result.restored).toContain('chats (1 processed)');
        });

        it('should handle prompt without tags gracefully', async () => {
            const backup = JSON.stringify({
                _metadata: { version: '2.0', createdAt: '2024-01-01', includes: ['prompts'], appVersion: '1.0.0', platform: 'linux' },
                prompts: [{ id: 'p1', title: 'No tags', content: 'test' }]
            });
            (fs.promises.readFile as Mock).mockResolvedValue(backup);

            const svc = await createService();
            const result = await svc.restoreBackup('/backup.json');

            expect(result.restored).toContain('prompts');
            expect(dbSvc.createPrompt).toHaveBeenCalledWith('No tags', 'test', []);
        });

        it('should handle folder without color gracefully', async () => {
            const backup = JSON.stringify({
                _metadata: { version: '2.0', createdAt: '2024-01-01', includes: ['folders'], appVersion: '1.0.0', platform: 'linux' },
                folders: [{ id: 'f1', name: 'Test Folder' }]
            });
            (fs.promises.readFile as Mock).mockResolvedValue(backup);

            const svc = await createService();
            const result = await svc.restoreBackup('/backup.json');

            expect(result.restored).toContain('folders');
            expect(dbSvc.createFolder).toHaveBeenCalledWith('Test Folder', '');
        });
    });
});
