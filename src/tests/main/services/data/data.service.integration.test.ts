/**
 * DataService Integration Tests
 * Tests the full lifecycle: initialize → getPath → getAllPaths → cleanup
 */

import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    app: { getPath: vi.fn().mockReturnValue('/mock/userData') }
}));

vi.mock('fs/promises', () => ({
    mkdir: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
    rmdir: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

import type { DataType } from '@main/services/data/data.service';
import {
    DATA_SERVICE_PERFORMANCE_BUDGETS,
    DataService,
    DataServiceErrorCode,
    DataServiceTelemetryEvent} from '@main/services/data/data.service';

describe('DataService Integration', () => {
    let service: DataService;

    beforeEach(async () => {
        vi.clearAllMocks();
        service = new DataService();
        await service.initialize();
    });

    afterEach(async () => {
        await service.cleanup();
    });

    it('should complete full lifecycle: initialize → getPath → getAllPaths → cleanup', async () => {
        expect(service.isInitialized()).toBe(true);

        const dbPath = service.getPath('db');
        expect(typeof dbPath).toBe('string');
        expect(dbPath.length).toBeGreaterThan(0);

        const allPaths = service.getAllPaths();
        expect(typeof allPaths).toBe('object');
        expect(allPaths.db).toBe(dbPath);

        await service.cleanup();
        expect(service.isInitialized()).toBe(false);
    });

    it('should have valid error codes', () => {
        expect(DataServiceErrorCode.INITIALIZATION_FAILED).toBeDefined();
        expect(DataServiceErrorCode.PATH_TYPE_INVALID).toBeDefined();
        expect(DataServiceErrorCode.DIRECTORY_CREATE_FAILED).toBeDefined();
        expect(DataServiceErrorCode.PERMISSION_DENIED).toBeDefined();
    });

    it('should have valid telemetry events', () => {
        expect(DataServiceTelemetryEvent.INITIALIZE_START).toBeDefined();
        expect(DataServiceTelemetryEvent.INITIALIZE_COMPLETE).toBeDefined();
        expect(DataServiceTelemetryEvent.PATH_ACCESSED).toBeDefined();
    });

    it('should have valid performance budgets', () => {
        expect(DATA_SERVICE_PERFORMANCE_BUDGETS.INITIALIZE_MS).toBe(5000);
        expect(DATA_SERVICE_PERFORMANCE_BUDGETS.GET_PATH_MS).toBe(10);
    });

    it('should return paths for all valid data types', () => {
        const validTypes: DataType[] = ['auth', 'db', 'config', 'logs', 'models', 'gallery', 'galleryImages', 'galleryVideos', 'data'];
        for (const type of validTypes) {
            const p = service.getPath(type);
            expect(typeof p).toBe('string');
            expect(p.length).toBeGreaterThan(0);
        }
    });

    it('should return a base directory string', () => {
        const baseDir = service.getBaseDir();
        expect(typeof baseDir).toBe('string');
        expect(baseDir).toContain('userData');
    });

    it('should return a copy of paths from getAllPaths', () => {
        const paths1 = service.getAllPaths();
        const paths2 = service.getAllPaths();
        expect(paths1).toEqual(paths2);
        expect(paths1).not.toBe(paths2);
    });

    it('should throw on invalid data type after initialization', () => {
        expect(() => service.getPath('invalid' as DataType)).toThrow();
    });

    it('should be safe to call cleanup multiple times', async () => {
        await service.cleanup();
        await expect(service.cleanup()).resolves.toBeUndefined();
    });
});
