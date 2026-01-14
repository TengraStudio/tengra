/**
 * Unit tests for AuditLogService
 */
import * as fs from 'fs';

import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest';

// Mock electron
vi.mock('electron', () => ({
    app: {
        getPath: vi.fn().mockReturnValue('/mock/userData')
    }
}));

// Mock fs
vi.mock('fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    statSync: vi.fn(),
    renameSync: vi.fn(),
    readdirSync: vi.fn(),
    unlinkSync: vi.fn()
}));

import { AuditLogEntry,AuditLogService } from '@main/services/audit-log.service';

describe('AuditLogService', () => {
    let service: AuditLogService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(fs.statSync).mockReturnValue({ size: 100, mtimeMs: Date.now() } as any);
        vi.mocked(fs.readdirSync).mockReturnValue([]);
        service = new AuditLogService();
    });

    afterEach(() => {
        vi.resetModules();
    });

    describe('constructor', () => {
        it('should create log file if it does not exist', () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            new AuditLogService();

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('audit.log'),
                JSON.stringify([]),
                'utf8'
            );
        });

        it('should not create log file if it exists', () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue('[]');

            vi.clearAllMocks();
            new AuditLogService();

            // writeFileSync should only be called once in ensureLogFile if file doesn't exist
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });
    });

    describe('log', () => {
        it('should add entry with timestamp', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue('[]');

            await service.log({
                action: 'test_action',
                category: 'security',
                success: true
            });

            expect(fs.writeFileSync).toHaveBeenCalled();
            const writtenContent = vi.mocked(fs.writeFileSync).mock.calls.find(
                call => call[0].toString().includes('audit.log') && call[1] !== '[]'
            );

            if (writtenContent) {
                const logs = JSON.parse(writtenContent[1] as string);
                expect(logs).toHaveLength(1);
                expect(logs[0].action).toBe('test_action');
                expect(logs[0].category).toBe('security');
                expect(logs[0].timestamp).toBeDefined();
            }
        });

        it('should append to existing logs', async () => {
            const existingLogs: AuditLogEntry[] = [{
                timestamp: Date.now() - 1000,
                action: 'existing_action',
                category: 'settings',
                success: true
            }];

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingLogs));

            await service.log({
                action: 'new_action',
                category: 'security',
                success: true
            });

            // Get the last writeFileSync call
            const allCalls = vi.mocked(fs.writeFileSync).mock.calls;
            const writtenContent = allCalls[allCalls.length - 1];

            expect(writtenContent).toBeDefined();
            const logs = JSON.parse(writtenContent[1] as string);
            expect(logs).toHaveLength(2);
        });

        it('should include optional fields', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue('[]');

            await service.log({
                action: 'login_attempt',
                category: 'authentication',
                success: false,
                error: 'Invalid credentials',
                userId: 'user123',
                ipAddress: '192.168.1.1',
                details: { attemptNumber: 3 }
            });

            const writtenContent = vi.mocked(fs.writeFileSync).mock.calls.find(
                call => call[0].toString().includes('audit.log') && call[1] !== '[]'
            );

            if (writtenContent) {
                const logs = JSON.parse(writtenContent[1] as string);
                expect(logs[0].error).toBe('Invalid credentials');
                expect(logs[0].userId).toBe('user123');
                expect(logs[0].ipAddress).toBe('192.168.1.1');
                expect(logs[0].details.attemptNumber).toBe(3);
            }
        });

        it('should handle corrupted log file', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue('not valid json');

            await service.log({
                action: 'test_action',
                category: 'security',
                success: true
            });

            // Should create new array with just the new entry
            const allCalls = vi.mocked(fs.writeFileSync).mock.calls;
            const writtenContent = allCalls[allCalls.length - 1];

            expect(writtenContent).toBeDefined();
            const logs = JSON.parse(writtenContent[1] as string);
            expect(logs).toHaveLength(1);
        });
    });

    describe('getLogs', () => {
        const sampleLogs: AuditLogEntry[] = [
            { timestamp: 1000, action: 'action1', category: 'security', success: true },
            { timestamp: 2000, action: 'action2', category: 'settings', success: true },
            { timestamp: 3000, action: 'action3', category: 'security', success: false },
            { timestamp: 4000, action: 'action4', category: 'authentication', success: true }
        ];

        beforeEach(() => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(sampleLogs));
        });

        it('should return all logs when no filters', async () => {
            const logs = await service.getLogs();

            expect(logs).toHaveLength(4);
        });

        it('should filter by category', async () => {
            const logs = await service.getLogs({ category: 'security' });

            expect(logs).toHaveLength(2);
            expect(logs.every(l => l.category === 'security')).toBe(true);
        });

        it('should filter by date range', async () => {
            const logs = await service.getLogs({
                startDate: 1500,
                endDate: 3500
            });

            expect(logs).toHaveLength(2);
            expect(logs.every(l => l.timestamp >= 1500 && l.timestamp <= 3500)).toBe(true);
        });

        it('should limit results', async () => {
            const logs = await service.getLogs({ limit: 2 });

            expect(logs).toHaveLength(2);
        });

        it('should sort by timestamp descending', async () => {
            const logs = await service.getLogs();

            for (let i = 1; i < logs.length; i++) {
                expect(logs[i - 1].timestamp).toBeGreaterThanOrEqual(logs[i].timestamp);
            }
        });

        it('should return empty array if file does not exist', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const logs = await service.getLogs();

            expect(logs).toEqual([]);
        });

        it('should return empty array for invalid JSON', async () => {
            vi.mocked(fs.readFileSync).mockReturnValue('invalid json');

            const logs = await service.getLogs();

            expect(logs).toEqual([]);
        });

        it('should combine multiple filters', async () => {
            const logs = await service.getLogs({
                category: 'security',
                startDate: 2500,
                limit: 1
            });

            expect(logs).toHaveLength(1);
            expect(logs[0].category).toBe('security');
            expect(logs[0].timestamp).toBeGreaterThanOrEqual(2500);
        });
    });

    describe('clearLogs', () => {
        it('should clear all logs', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);

            await service.clearLogs();

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('audit.log'),
                JSON.stringify([]),
                'utf8'
            );
        });

        it('should handle non-existent file', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            await expect(service.clearLogs()).resolves.not.toThrow();
        });
    });
});
