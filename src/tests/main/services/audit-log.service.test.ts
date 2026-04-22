/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Unit tests for AuditLogService
 */
import * as fs from 'fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    mkdirSync: vi.fn(),
    promises: {
        readFile: vi.fn(),
        rename: vi.fn()
    },
    statSync: vi.fn(),
    renameSync: vi.fn(),
    readdirSync: vi.fn(),
    unlinkSync: vi.fn()
}));

import { AuditLogEntry, AuditLogService } from '@main/services/analysis/audit-log.service';
import { DatabaseService } from '@main/services/data/database.service';

// Create a mock DatabaseService 
const createMockDatabaseService = () => ({
    addAuditLog: vi.fn().mockResolvedValue(undefined),
    getAuditLogs: vi.fn().mockResolvedValue([]),
    clearAuditLogs: vi.fn().mockResolvedValue(undefined),
    pruneAuditLogsOlderThan: vi.fn().mockResolvedValue(0),
    pruneAuditLogsToMaxEntries: vi.fn().mockResolvedValue(undefined),
    countAuditLogs: vi.fn().mockResolvedValue(0),
} as never as DatabaseService);

describe('AuditLogService', () => {
    let service: AuditLogService;
    let mockDbService: DatabaseService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(fs.statSync).mockReturnValue({ size: 100, mtimeMs: Date.now() } as ReturnType<typeof fs.statSync>);
        vi.mocked(fs.readdirSync).mockReturnValue([]);
        mockDbService = createMockDatabaseService();
        service = new AuditLogService(mockDbService);
    });

    afterEach(() => {
        vi.resetModules();
    });

    describe('constructor', () => {
        it('should initialize without error when legacy log file does not exist', () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const testService = new AuditLogService(createMockDatabaseService());

            // Service should be created without error
            expect(testService).toBeDefined();
        });

        it('should initialize without error when legacy log file exists', () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue('[]');

            vi.clearAllMocks();
            const testService = new AuditLogService(createMockDatabaseService());

            // Service should be created without fs writes - uses database now
            expect(testService).toBeDefined();
        });
    });

    describe('log', () => {
        it('should add entry with timestamp', async () => {
            await service.log({
                action: 'test_action',
                category: 'security',
                success: true
            });

            expect(mockDbService.addAuditLog).toHaveBeenCalled();
            const logEntry = vi.mocked(mockDbService.addAuditLog).mock.calls[0]![0];

            expect(logEntry.action).toBe('test_action');
            expect(logEntry.category).toBe('security');
            expect(logEntry.timestamp).toBeDefined();
        });

        it('should append to existing logs (DB implementation just adds)', async () => {
            await service.log({
                action: 'new_action',
                category: 'security',
                success: true
            });

            expect(mockDbService.addAuditLog).toHaveBeenCalledTimes(1);
        });

        it('should include optional fields', async () => {
            await service.log({
                action: 'login_attempt',
                category: 'authentication',
                success: false,
                error: 'Invalid credentials',
                userId: 'user123',
                ipAddress: '127.0.0.1',
                details: { attemptNumber: 3 }
            });

            const logEntry = vi.mocked(mockDbService.addAuditLog).mock.calls[0]![0];
            expect(logEntry.error).toBe('Invalid credentials');
            expect(logEntry.userId).toBe('user123');
            expect(logEntry.ipAddress).toBe('127.0.0.1');
            // details is optional in interface, but we know it should be present here
            expect(logEntry.details?.attemptNumber).toBe(3);
        });

        it('should handle database errors gracefully', async () => {
            vi.mocked(mockDbService.addAuditLog).mockRejectedValueOnce(new Error('DB Error'));

            // Should not throw
            await service.log({
                action: 'test_action',
                category: 'security',
                success: true
            });

            expect(mockDbService.addAuditLog).toHaveBeenCalled();
        });
    });

    describe('getLogs', () => {
        const sampleLogs: AuditLogEntry[] = [
            { timestamp: 1000, action: 'action1', category: 'security', success: true },
            { timestamp: 2000, action: 'action2', category: 'settings', success: true }
        ];

        it('should delegate to databaseService.getAuditLogs', async () => {
            vi.mocked(mockDbService.getAuditLogs).mockResolvedValue(sampleLogs);

            const logs = await service.getLogs();

            expect(mockDbService.getAuditLogs).toHaveBeenCalledWith(undefined);
            expect(logs).toEqual(sampleLogs);
        });

        it('should pass options to databaseService', async () => {
            vi.mocked(mockDbService.getAuditLogs).mockResolvedValue([]);

            const options = {
                category: 'security' as const,
                limit: 10
            };

            await service.getLogs(options);

            expect(mockDbService.getAuditLogs).toHaveBeenCalledWith(options);
        });
    });

    describe('clearLogs', () => {
        it('should delegate to databaseService.clearAuditLogs', async () => {
            await service.clearLogs();
            expect(mockDbService.clearAuditLogs).toHaveBeenCalled();
        });
    });

    describe('initialize', () => {
        it('should migrate legacy logs when file exists', async () => {
            const legacyLogs = [
                { timestamp: 1000, action: 'test', category: 'security', success: true }
            ];
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(legacyLogs));
            vi.mocked(fs.promises.rename).mockResolvedValue(undefined);

            const testService = new AuditLogService(mockDbService);
            await testService.initialize();

            expect(mockDbService.addAuditLog).toHaveBeenCalledWith(legacyLogs[0]);
            expect(fs.promises.rename).toHaveBeenCalled();
        });

        it('should skip migration when legacy file does not exist', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const testService = new AuditLogService(mockDbService);
            await testService.initialize();

            expect(mockDbService.addAuditLog).not.toHaveBeenCalled();
            expect(fs.promises.rename).not.toHaveBeenCalled();
        });

        it('should handle migration errors gracefully', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.promises.readFile).mockRejectedValue(new Error('Read error'));
            vi.mocked(fs.promises.rename).mockResolvedValue(undefined);

            const testService = new AuditLogService(mockDbService);
            await testService.initialize();

            expect(fs.promises.rename).toHaveBeenCalledWith(
                expect.stringContaining('audit.log'),
                expect.stringContaining('.migrated_failed')
            );
        });
    });
});
