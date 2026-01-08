import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DataService } from '../../services/data/data.service'
import { DatabaseService } from '../../services/data/database.service'
import { FolderRepository } from '../../repositories/folder.repository'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// Mock app logger to avoid console spam
vi.mock('../../logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}))

// Mock DataService to return temp DB connection string or let DatabaseService use its default logic?
// DatabaseService constructor takes `dbPath`. We can pass ':memory:' for SQLite.
// BUT `DatabaseService` constructor signature in `database.service.ts` is `constructor()`. 
// It calculates path internally using `app.getPath('userData')`.
// So we must mock electron getPath again.

const { mockGetPath } = vi.hoisted(() => ({ mockGetPath: vi.fn() }))
vi.mock('electron', () => ({
    app: { getPath: mockGetPath },
    ipcMain: { handle: vi.fn() }
}))

// Mock LanceDbService
const mockLanceDbService = {} as any

describe('Repository-DB Integration', () => {
    let dbService: DatabaseService
    let folderRepo: FolderRepository
    let tempDir: string
    let dataService: DataService

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-db-test-'))
        mockGetPath.mockReturnValue(tempDir)

        // DataService uses app.getPath internally, which is mocked
        dataService = new DataService()

        dbService = new DatabaseService(dataService, mockLanceDbService)

        // Ensure data/db exists because DatabaseService might assume it exists or DataService failed to create it due to mock timing
        const dbDir = path.join(tempDir, 'data', 'db')
        if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

        // Force re-init if needed, but new instance should create new DB file in tempDir
        folderRepo = new FolderRepository(dbService)
    })

    afterEach(() => {
        try { fs.rmSync(tempDir, { recursive: true, force: true }) } catch { }
    })

    it('should create and retrieve a folder', async () => {
        const folderData = {
            id: 'temp-id', // Repository interface requires ID, but implementation generates new one
            name: 'Test Folder',
            color: '#ff0000',
            icon: 'folder',
            createdAt: Date.now(),
            updatedAt: Date.now()
        }

        // Repository expects Folder object for create, but implementation usually takes item
        // FolderRepository.create calls db.createFolder(item.name, item.color)

        // We can't easily predict the ID because DatabaseService generates UUIDs!
        // So we should capture the result of create.
        const created = await folderRepo.create(folderData)

        const retrieved = await folderRepo.findById(created.id)
        expect(retrieved).toBeDefined()
        expect(retrieved?.name).toBe('Test Folder')
        expect(retrieved?.color).toBe('#ff0000')
    })

    it('should list all folders', async () => {
        await folderRepo.create({ id: '1', name: 'F1', color: 'red', createdAt: 0, updatedAt: 0 })
        await folderRepo.create({ id: '2', name: 'F2', color: 'blue', createdAt: 0, updatedAt: 0 })

        const list = await folderRepo.findAll()
        expect(list.length).toBeGreaterThanOrEqual(2)
        // Since we can't control IDs, we check if we can find by name
        expect(list.find(f => f.name === 'F1')).toBeDefined()
        expect(list.find(f => f.name === 'F2')).toBeDefined()
    })
})
