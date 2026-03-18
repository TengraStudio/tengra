/**
 * Comprehensive unit tests for AuditLogService
 */
import * as fs from 'fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getPath: vi.fn().mockReturnValue('/mock/userData') } }));

vi.mock('fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    promises: { readFile: vi.fn(), rename: vi.fn() },
    statSync: vi.fn(),
    renameSync: vi.fn(),
    readdirSync: vi.fn(),
    unlinkSync: vi.fn()
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

import { createHash } from 'crypto';

import { AuditLogEntry, AuditLogService } from '@main/services/analysis/audit-log.service';
import { DatabaseService } from '@main/services/data/database.service';

interface IntegrityBlock { prevHash: string; hash: string }

const createMockDatabaseService = (): DatabaseService => ({
    addAuditLog: vi.fn().mockResolvedValue(undefined),
    getAuditLogs: vi.fn().mockResolvedValue([]),
    clearAuditLogs: vi.fn().mockResolvedValue(undefined),
    pruneAuditLogsOlderThan: vi.fn().mockResolvedValue(0),
    pruneAuditLogsToMaxEntries: vi.fn().mockResolvedValue(undefined),
    countAuditLogs: vi.fn().mockResolvedValue(0)
} as never as DatabaseService);

/** Builds a valid audit entry with correct integrity hash for use in verifyIntegrity tests. */
function buildValidEntry(
    action: string, category: AuditLogEntry['category'], timestamp: number,
    prevHash: string, extra: Record<string, TestValue> = {}
): AuditLogEntry {
    const hash = createHash('sha256').update(JSON.stringify({
        action, category, success: true, userId: undefined,
        details: extra, prevHash, timestamp
    })).digest('hex');
    return {
        timestamp, action, category, success: true,
        details: { ...extra, integrity: { prevHash, hash } }
    };
}

function getIntegrity(entry: AuditLogEntry): IntegrityBlock {
    return (entry.details as Record<string, TestValue>)?.integrity as IntegrityBlock;
}

describe('AuditLogService', () => {
    let service: AuditLogService;
    let mockDbService: DatabaseService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(fs.promises.readFile).mockResolvedValue('[]');
        vi.mocked(fs.promises.rename).mockResolvedValue(undefined);
        mockDbService = createMockDatabaseService();
        service = new AuditLogService(mockDbService);
    });

    afterEach(() => { vi.restoreAllMocks(); });

    describe('constructor', () => {
        it('should create service with correct name and legacy path', () => {
            expect(service['name']).toBe('AuditLogService');
            expect(service['legacyLogPath']).toBe('/mock/userData/audit.log');
            expect(service['lastIntegrityHash']).toBe('');
        });
    });

    describe('initialize', () => {
        it('should skip migration when legacy file does not exist', async () => {
            await service.initialize();
            expect(mockDbService.addAuditLog).not.toHaveBeenCalled();
            expect(fs.promises.rename).not.toHaveBeenCalled();
        });

        it('should migrate legacy logs and rename file when it exists', async () => {
            const legacyLogs: AuditLogEntry[] = [
                { timestamp: 1000, action: 'login', category: 'authentication', success: true },
                { timestamp: 2000, action: 'export', category: 'data', success: false, error: 'disk full' }
            ];
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(legacyLogs));
            await service.initialize();
            expect(mockDbService.addAuditLog).toHaveBeenCalledTimes(2);
            expect(mockDbService.addAuditLog).toHaveBeenCalledWith(legacyLogs[0]);
            expect(mockDbService.addAuditLog).toHaveBeenCalledWith(legacyLogs[1]);
            expect(fs.promises.rename).toHaveBeenCalledWith(
                '/mock/userData/audit.log', '/mock/userData/audit.log.migrated'
            );
        });

        it('should handle empty and corrupted legacy files', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.promises.readFile).mockResolvedValue('not valid json{{{');
            await service.initialize();
            expect(mockDbService.addAuditLog).not.toHaveBeenCalled();
            expect(fs.promises.rename).toHaveBeenCalledWith(
                expect.stringContaining('audit.log'), expect.stringContaining('.migrated')
            );
        });

        it('should rename to .migrated_failed on read error', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.promises.readFile).mockRejectedValue(new Error('EACCES'));
            await service.initialize();
            expect(fs.promises.rename).toHaveBeenCalledWith(
                '/mock/userData/audit.log', '/mock/userData/audit.log.migrated_failed'
            );
        });

        it('should not throw when both read and rename fail', async () => {
            vi.mocked(fs.existsSync).mockReturnValueOnce(true).mockReturnValueOnce(true);
            vi.mocked(fs.promises.readFile).mockRejectedValue(new Error('EACCES'));
            vi.mocked(fs.promises.rename).mockRejectedValue(new Error('EPERM'));
            await expect(service.initialize()).resolves.not.toThrow();
        });

        it('should call rotateLogs during initialization', async () => {
            await service.initialize();
            expect(mockDbService.pruneAuditLogsOlderThan).toHaveBeenCalled();
            expect(mockDbService.pruneAuditLogsToMaxEntries).toHaveBeenCalled();
            expect(mockDbService.countAuditLogs).toHaveBeenCalled();
        });
    });

    describe('log', () => {
        it('should add a timestamp and persist via databaseService', async () => {
            const before = Date.now();
            await service.log({ action: 'key_access', category: 'security', success: true });
            const after = Date.now();
            expect(mockDbService.addAuditLog).toHaveBeenCalledTimes(1);
            const entry = vi.mocked(mockDbService.addAuditLog).mock.calls[0]![0];
            expect(entry.action).toBe('key_access');
            expect(entry.timestamp).toBeGreaterThanOrEqual(before);
            expect(entry.timestamp).toBeLessThanOrEqual(after);
        });

        it('should include optional fields in the persisted entry', async () => {
            await service.log({
                action: 'login', category: 'authentication', success: false,
                error: 'bad password', userId: 'user-42', ipAddress: '10.0.0.1',
                userAgent: 'TestAgent/1.0', details: { attempt: 3 }
            });
            const entry = vi.mocked(mockDbService.addAuditLog).mock.calls[0]![0];
            expect(entry.error).toBe('bad password');
            expect(entry.userId).toBe('user-42');
            expect(entry.ipAddress).toBe('10.0.0.1');
            expect(entry.userAgent).toBe('TestAgent/1.0');
        });

        it('should add integrity hash with genesis prevHash on first call', async () => {
            await service.log({ action: 'test', category: 'security', success: true });
            const entry = vi.mocked(mockDbService.addAuditLog).mock.calls[0]![0];
            const integrity = getIntegrity(entry);
            expect(integrity.prevHash).toBe('genesis');
            expect(integrity.hash).toHaveLength(64);
        });

        it('should chain integrity hashes across consecutive calls', async () => {
            await service.log({ action: 'first', category: 'security', success: true });
            await service.log({ action: 'second', category: 'data', success: true });
            const first = getIntegrity(vi.mocked(mockDbService.addAuditLog).mock.calls[0]![0]);
            const second = getIntegrity(vi.mocked(mockDbService.addAuditLog).mock.calls[1]![0]);
            expect(first.prevHash).toBe('genesis');
            expect(second.prevHash).toBe(first.hash);
        });

        it('should compute a correct sha256 integrity hash', async () => {
            await service.log({ action: 'verify', category: 'system', success: true, userId: 'u1', details: { foo: 'bar' } });
            const entry = vi.mocked(mockDbService.addAuditLog).mock.calls[0]![0];
            const integrity = getIntegrity(entry);
            const expected = createHash('sha256').update(JSON.stringify({
                action: 'verify', category: 'system', success: true, userId: 'u1',
                details: { foo: 'bar' }, prevHash: 'genesis', timestamp: entry.timestamp
            })).digest('hex');
            expect(integrity.hash).toBe(expected);
        });

        it('should merge user details with integrity and handle missing details', async () => {
            await service.log({ action: 't1', category: 'data', success: true, details: { key: 'val' } });
            const d1 = vi.mocked(mockDbService.addAuditLog).mock.calls[0]![0].details as Record<string, TestValue>;
            expect(d1.key).toBe('val');
            expect(d1.integrity).toBeDefined();

            await service.log({ action: 't2', category: 'settings', success: true });
            const d2 = vi.mocked(mockDbService.addAuditLog).mock.calls[1]![0].details as Record<string, TestValue>;
            expect(d2.integrity).toBeDefined();
        });

        it('should not throw on database error', async () => {
            vi.mocked(mockDbService.addAuditLog).mockRejectedValueOnce(new Error('DB fail'));
            await expect(service.log({ action: 'fail', category: 'security', success: true })).resolves.not.toThrow();
        });

        it('should trigger rotateLogs when random < 0.02', async () => {
            const spy = vi.spyOn(Math, 'random').mockReturnValue(0.01);
            await service.log({ action: 'r', category: 'system', success: true });
            expect(mockDbService.pruneAuditLogsOlderThan).toHaveBeenCalled();
            spy.mockRestore();
        });

        it('should not trigger rotateLogs when random >= 0.02', async () => {
            const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
            await service.log({ action: 'r', category: 'system', success: true });
            expect(mockDbService.pruneAuditLogsOlderThan).not.toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    describe('getLogs', () => {
        const sampleLogs: AuditLogEntry[] = [
            { timestamp: 1000, action: 'a1', category: 'security', success: true },
            { timestamp: 2000, action: 'a2', category: 'settings', success: false }
        ];

        it('should return logs from database service', async () => {
            vi.mocked(mockDbService.getAuditLogs).mockResolvedValue(sampleLogs);
            const result = await service.getLogs();
            expect(result).toEqual(sampleLogs);
            expect(mockDbService.getAuditLogs).toHaveBeenCalledWith(undefined);
        });

        it('should pass category, date range, limit, and combined filters', async () => {
            vi.mocked(mockDbService.getAuditLogs).mockResolvedValue([]);
            await service.getLogs({ category: 'authentication' });
            expect(mockDbService.getAuditLogs).toHaveBeenCalledWith({ category: 'authentication' });

            await service.getLogs({ startDate: 1000, endDate: 5000 });
            expect(mockDbService.getAuditLogs).toHaveBeenCalledWith({ startDate: 1000, endDate: 5000 });

            await service.getLogs({ limit: 50 });
            expect(mockDbService.getAuditLogs).toHaveBeenCalledWith({ limit: 50 });

            const opts = { category: 'data' as const, startDate: 100, endDate: 900, limit: 10 };
            await service.getLogs(opts);
            expect(mockDbService.getAuditLogs).toHaveBeenCalledWith(opts);
        });
    });

    describe('clearLogs', () => {
        it('should clear via databaseService and reset integrity hash', async () => {
            await service.log({ action: 'setup', category: 'security', success: true });
            expect(service['lastIntegrityHash']).not.toBe('');
            await service.clearLogs();
            expect(mockDbService.clearAuditLogs).toHaveBeenCalledTimes(1);
            expect(service['lastIntegrityHash']).toBe('');
        });

        it('should use genesis as prevHash for the first log after clear', async () => {
            await service.log({ action: 'before', category: 'security', success: true });
            await service.clearLogs();
            await service.log({ action: 'after', category: 'security', success: true });
            const calls = vi.mocked(mockDbService.addAuditLog).mock.calls;
            const integrity = getIntegrity(calls[calls.length - 1]![0]);
            expect(integrity.prevHash).toBe('genesis');
        });
    });

    describe('convenience methods', () => {
        it('logAuthenticationEvent should log with category "authentication"', async () => {
            await service.logAuthenticationEvent('login', true, { method: 'oauth' });
            const entry = vi.mocked(mockDbService.addAuditLog).mock.calls[0]![0];
            expect(entry.category).toBe('authentication');
            expect(entry.action).toBe('login');
            expect(entry.success).toBe(true);
        });

        it('logAuthenticationEvent should handle failures', async () => {
            await service.logAuthenticationEvent('login', false);
            expect(vi.mocked(mockDbService.addAuditLog).mock.calls[0]![0].success).toBe(false);
        });

        it('logApiKeyAccess should log with category "security"', async () => {
            await service.logApiKeyAccess('key_rotate', true, { provider: 'openai' });
            const entry = vi.mocked(mockDbService.addAuditLog).mock.calls[0]![0];
            expect(entry.category).toBe('security');
            expect(entry.action).toBe('key_rotate');
        });

        it('logFileSystemOperation should log with category "data"', async () => {
            await service.logFileSystemOperation('file_delete', true, { path: '/tmp/x' });
            const entry = vi.mocked(mockDbService.addAuditLog).mock.calls[0]![0];
            expect(entry.category).toBe('data');
            expect(entry.action).toBe('file_delete');
        });
    });

    describe('verifyIntegrity', () => {
        it('should return ok=true for empty log set', async () => {
            vi.mocked(mockDbService.getAuditLogs).mockResolvedValue([]);
            expect(await service.verifyIntegrity()).toEqual({ ok: true, checked: 0 });
        });

        it('should verify a single valid entry', async () => {
            const entry = buildValidEntry('test', 'security', 1000, 'genesis', { someKey: 'val' });
            vi.mocked(mockDbService.getAuditLogs).mockResolvedValue([entry]);
            expect(await service.verifyIntegrity()).toEqual({ ok: true, checked: 1 });
        });

        it('should detect entry with missing integrity data', async () => {
            const entry: AuditLogEntry = {
                timestamp: 1000, action: 'test', category: 'security',
                success: true, details: { noIntegrity: true }
            };
            vi.mocked(mockDbService.getAuditLogs).mockResolvedValue([entry]);
            const result = await service.verifyIntegrity();
            expect(result.ok).toBe(false);
            expect(result.firstInvalidAt).toBe(1000);
        });

        it('should detect tampered hash', async () => {
            const entry: AuditLogEntry = {
                timestamp: 1000, action: 'test', category: 'security', success: true,
                details: { integrity: { prevHash: 'genesis', hash: 'tampered' } }
            };
            vi.mocked(mockDbService.getAuditLogs).mockResolvedValue([entry]);
            expect((await service.verifyIntegrity()).ok).toBe(false);
        });

        it('should detect broken chain (wrong prevHash)', async () => {
            const entry1 = buildValidEntry('first', 'security', 1000, 'genesis');
            const hash1 = getIntegrity(entry1).hash;
            const wrongEntry2: AuditLogEntry = {
                timestamp: 2000, action: 'second', category: 'data', success: true,
                details: { integrity: { prevHash: 'wrong', hash: createHash('sha256').update('x').digest('hex') } }
            };
            vi.mocked(mockDbService.getAuditLogs).mockResolvedValue([wrongEntry2, entry1]);
            expect((await service.verifyIntegrity()).ok).toBe(false);
            // Also verify a valid chain passes
            const entry2 = buildValidEntry('second', 'data', 2000, hash1);
            vi.mocked(mockDbService.getAuditLogs).mockResolvedValue([entry2, entry1]);
            expect(await service.verifyIntegrity()).toEqual({ ok: true, checked: 2 });
        });

        it('should respect and clamp sampleSize parameter', async () => {
            vi.mocked(mockDbService.getAuditLogs).mockResolvedValue([]);
            await service.verifyIntegrity(50);
            expect(mockDbService.getAuditLogs).toHaveBeenCalledWith({ limit: 50 });
            await service.verifyIntegrity(0);
            expect(mockDbService.getAuditLogs).toHaveBeenCalledWith({ limit: 1 });
        });

        it('should skip undefined entries without failing', async () => {
            const logs = [undefined, undefined] as never as AuditLogEntry[];
            vi.mocked(mockDbService.getAuditLogs).mockResolvedValue(logs);
            expect((await service.verifyIntegrity()).ok).toBe(true);
        });
    });

    describe('rotateLogs', () => {
        it('should prune by age (180 days) and enforce max entries (20000)', async () => {
            vi.mocked(mockDbService.pruneAuditLogsOlderThan).mockResolvedValue(5);
            vi.mocked(mockDbService.countAuditLogs).mockResolvedValue(100);
            const now = Date.now();
            const result = await service.rotateLogs();
            const cutoff = vi.mocked(mockDbService.pruneAuditLogsOlderThan).mock.calls[0]![0];
            const maxAge = 180 * 24 * 60 * 60 * 1000;
            expect(cutoff).toBeGreaterThanOrEqual(now - maxAge - 100);
            expect(cutoff).toBeLessThanOrEqual(now - maxAge + 100);
            expect(mockDbService.pruneAuditLogsToMaxEntries).toHaveBeenCalledWith(20000);
            expect(result).toEqual({ prunedByAge: 5, totalAfter: 100 });
        });

        it('should return correct totals', async () => {
            vi.mocked(mockDbService.pruneAuditLogsOlderThan).mockResolvedValue(42);
            vi.mocked(mockDbService.countAuditLogs).mockResolvedValue(9958);
            expect(await service.rotateLogs()).toEqual({ prunedByAge: 42, totalAfter: 9958 });
        });
    });

    describe('edge cases', () => {
        it('should handle all valid category values', async () => {
            const categories = ['security', 'settings', 'authentication', 'data', 'system'] as const;
            for (const category of categories) {
                vi.mocked(mockDbService.addAuditLog).mockClear();
                await service.log({ action: `test_${category}`, category, success: true });
                expect(vi.mocked(mockDbService.addAuditLog).mock.calls[0]![0].category).toBe(category);
            }
        });

        it('should handle rapid successive log calls', async () => {
            const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
            const promises: Promise<void>[] = [];
            for (let i = 0; i < 20; i++) {
                promises.push(service.log({ action: `rapid_${i}`, category: 'system', success: true }));
            }
            await Promise.all(promises);
            expect(mockDbService.addAuditLog).toHaveBeenCalledTimes(20);
            spy.mockRestore();
        });

        it('should handle nested details and not modify original entry', async () => {
            await service.log({
                action: 'nested', category: 'data', success: true,
                details: { level1: { level2: { level3: 'deep' } }, array: [1, 2, 3] }
            });
            const details = vi.mocked(mockDbService.addAuditLog).mock.calls[0]![0].details as Record<string, TestValue>;
            expect(((details.level1 as Record<string, TestValue>).level2 as Record<string, TestValue>).level3).toBe('deep');

            const original = { action: 'immutable', category: 'security' as const, success: true, details: { key: 'value' } };
            const ref = original.details;
            await service.log(original);
            expect(ref).toEqual({ key: 'value' });
        });
    });
});
