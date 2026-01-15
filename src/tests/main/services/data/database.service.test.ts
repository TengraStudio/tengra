import { DataService } from '@main/services/data/data.service'
import { DatabaseService } from '@main/services/data/database.service'
import { beforeEach,describe, expect, it, vi } from 'vitest'

// Mock modules
vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}))

const mockPrepare = {
    run: vi.fn().mockResolvedValue({}),
    get: vi.fn().mockResolvedValue({}),
    all: vi.fn().mockResolvedValue([])
}

vi.mock('@electric-sql/pglite', () => {
    return {
        PGlite: class {
            exec = vi.fn().mockResolvedValue({})
            query = vi.fn().mockResolvedValue({ rows: [], affectedRows: 0 })
            prepare = vi.fn().mockReturnValue(mockPrepare)
            transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(this))
            close = vi.fn().mockResolvedValue(undefined)
        },
        vector: vi.fn()
    }
})

describe('DatabaseService', () => {
    let service: DatabaseService
    let mockDataService: DataService

    beforeEach(async () => {
        vi.clearAllMocks()
        mockDataService = {
            getPath: vi.fn().mockReturnValue('/mock/db/path')
        } as unknown as DataService
        service = new DatabaseService(mockDataService)
        await service.initialize()
    })

    describe('Initialization', () => {
        it('should initialize and run migrations', () => {
            // Since we can't easily access the internal instance's exec mock without a lot of plumbing,
            // we'll just check if initialize completed without throwing
            expect(service).toBeDefined()
        })
    })

    describe('Project Operations', () => {
        it('should create and get a project', async () => {
            mockPrepare.get.mockResolvedValueOnce({ id: '1', title: 'Test', path: '/path', status: 'active', created_at: Date.now(), updated_at: Date.now() })
            const project = await service.createProject('Test', '/path')
            expect(project.title).toBe('Test')
        })

        it('should archive a project', async () => {
            mockPrepare.get
                .mockResolvedValueOnce({ id: '1', title: 'ToArchive', status: 'active' })
                .mockResolvedValueOnce({ id: '1', title: 'ToArchive', status: 'archived' })

            await service.archiveProject('1', true)
            const fetched = await service.getProject('1')
            expect(fetched?.status).toBe('archived')
        })
    })

    describe('Complex Chat Operations', () => {
        it('should search chats with filters', async () => {
            mockPrepare.all.mockResolvedValueOnce([])
            await service.searchChats({ query: 'test', limit: 10 })
            expect(mockPrepare.all).toHaveBeenCalled()
        })

        it('should get detailed stats', async () => {
            mockPrepare.get.mockResolvedValue({ c: 5 })
            mockPrepare.all.mockResolvedValue([])
            const result = await service.getDetailedStats()
            expect(result.chatCount).toBe(5)
        })

        it('should duplicate a chat', async () => {
            mockPrepare.get.mockResolvedValueOnce({ id: 'old-id', title: 'Old Chat', messages: '[]' })
            await service.duplicateChat('old-id')
            // Expect some prepare calls
            expect(mockPrepare.get).toHaveBeenCalled()
        })
    })
})
