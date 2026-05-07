/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
        const mockEventBus = { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as never;

        // Create an in-memory folder store for the mock
        const folderStore = new Map<string, TestValue>();

        const mockDatabaseClient = {
            initialize: vi.fn().mockResolvedValue(undefined),
            isConnected: vi.fn().mockReturnValue(true),
            executeQuery: vi.fn().mockImplementation(async (req) => {
                const sql = req.sql.toLowerCase();
                
                // Handle SELECT queries for folders
                if (sql.includes('select') && sql.includes('folders')) {
                    if (sql.includes('where') && sql.includes('id')) {
                        // findById query
                        const id = req.params?.[0];
                        const folder = folderStore.get(id);
                        return folder ? { rows: [folder], affected_rows: 1 } : { rows: [], affected_rows: 0 };
                    }
                    // findAll query
                    return { rows: Array.from(folderStore.values()), affected_rows: folderStore.size };
                }
                
                // Handle INSERT queries for folders
                if (sql.includes('insert') && sql.includes('folders')) {
                    const id = req.params?.[0] || 'mock-id-' + Date.now();
                    const name = req.params?.[1] || 'Unknown';
                    const color = req.params?.[2];
                    const now = Date.now();
                    const folder = { id, name, color, created_at: now, updated_at: now };
                    folderStore.set(id, folder);
                    return { rows: [folder], affected_rows: 1 };
                }
                
                // Handle UPDATE queries for folders
                if (sql.includes('update') && sql.includes('folders')) {
                    return { rows: [], affected_rows: 1 };
                }
                
                return { rows: [], affected_rows: 0 };
            })
        } as never;


        dbService = new DatabaseService(dataService, mockEventBus, mockDatabaseClient, () => null);

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

