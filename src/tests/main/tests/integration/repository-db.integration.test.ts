import * as fs from 'fs';
import * as path from 'path';

import { FolderRepository } from '@main/repositories/folder.repository';
import { DataService } from '@main/services/data/data.service';
import { DatabaseService } from '@main/services/data/database.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.unmock('fs');
vi.unmock('path');

// Mock app logger to avoid console spam
vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

// Mock DataService to return temp DB connection string or let DatabaseService use its default logic?
// DatabaseService constructor takes `dbPath`. We can pass ':memory:' for SQLite.
// BUT `DatabaseService` constructor signature in `database.service.ts` is `constructor()`. 
// It calculates path internally using `app.getPath('userData')`.
// So we must mock electron getPath again.

const { mockGetPath } = vi.hoisted(() => ({ mockGetPath: vi.fn() }));
vi.mock('electron', () => ({
    app: { getPath: mockGetPath },
    ipcMain: { handle: vi.fn() }
}));



describe('Repository-DB Integration', () => {
    let dbService: DatabaseService;
    let folderRepo: FolderRepository;
    let tempDir: string;
    let dataService: DataService;

    beforeEach(async () => {
        tempDir = path.resolve('./temp_integration_test');
        if (fs.existsSync(tempDir)) { fs.rmSync(tempDir, { recursive: true, force: true }); }
        fs.mkdirSync(tempDir, { recursive: true });

        // Setup internal dirs BEFORE DataService/DatabaseService
        const dbDir = path.join(tempDir, 'data', 'db');
        fs.mkdirSync(dbDir, { recursive: true });

        mockGetPath.mockReturnValue(tempDir);

        dataService = new DataService();
        const mockEventBus = { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as any;
        dbService = new DatabaseService(dataService, mockEventBus);
        await dbService.initialize();

        folderRepo = new FolderRepository(dbService);
    });

    afterEach(() => {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { }
    });

    it('should create and retrieve a folder', async () => {
        const folderData = {
            name: 'Test Folder',
            color: '#ff0000'
        };

        // Repository expects Folder object for create, but implementation usually takes item
        // FolderRepository.create calls db.createFolder(item.name, item.color)

        // We can't easily predict the ID because DatabaseService generates UUIDs!
        // So we should capture the result of create.
        const created = await folderRepo.create(folderData);

        const retrieved = await folderRepo.findById(created.id);
        expect(retrieved).toBeDefined();
        expect(retrieved?.name).toBe('Test Folder');
        expect(retrieved?.color).toBe('#ff0000');
    });

    it('should list all folders', async () => {
        await folderRepo.create({ name: 'F1', color: 'red' });
        await folderRepo.create({ name: 'F2', color: 'blue' });

        const list = await folderRepo.findAll();
        expect(list.length).toBeGreaterThanOrEqual(2);
        // Since we can't control IDs, we check if we can find by name
        expect(list.find(f => f.name === 'F1')).toBeDefined();
        expect(list.find(f => f.name === 'F2')).toBeDefined();
    });
});
