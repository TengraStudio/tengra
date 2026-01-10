import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DatabaseService } from './database.service'

// Mock better-sqlite3 with an in-memory implementation
const mockDb = {
    data: {} as Record<string, unknown[]>,
    exec: vi.fn((sql: string) => {
        // CREATE TABLE - extract table name
        const tableMatch = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)
        if (tableMatch) {
            mockDb.data[tableMatch[1]] = []
        }
    }),
    pragma: vi.fn(),
    prepare: vi.fn((sql: string) => ({
        run: vi.fn((...values: unknown[]) => {
            const insertMatch = sql.match(/INSERT INTO (\w+)/)
            const updateMatch = sql.match(/UPDATE (\w+)/)
            const deleteMatch = sql.match(/DELETE FROM (\w+)/)

            if (insertMatch) {
                const table = insertMatch[1]
                if (!mockDb.data[table]) mockDb.data[table] = []
                // For projects table, map values to object
                if (table === 'projects') {
                    mockDb.data[table].push({
                        id: values[0], title: values[1], description: values[2],
                        path: values[3], mounts: values[4], chat_ids: values[5],
                        council_config: values[6], status: values[7], logo: values[8],
                        metadata: values[9], created_at: values[10], updated_at: values[11]
                    })
                }
            } else if (updateMatch) {
                // Simple update simulation
                const table = updateMatch[1]
                const id = values[values.length - 1] // ID is last value
                const items = mockDb.data[table] || []
                const index = items.findIndex((p: unknown) => (p as Record<string, unknown>).id === id)
                if (index !== -1) {
                    const proj = items[index] as Record<string, unknown>
                    if (sql.includes('status')) {
                        proj.status = values[0]
                        proj.updated_at = values[1]
                    } else {
                        // Full update
                        Object.assign(proj, {
                            title: values[0], description: values[1], path: values[2],
                            mounts: values[3], chat_ids: values[4], council_config: values[5],
                            status: values[6], logo: values[7], metadata: values[8],
                            updated_at: values[9]
                        })
                    }
                }
            } else if (deleteMatch) {
                const table = deleteMatch[1]
                const id = values[0]
                mockDb.data[table] = (mockDb.data[table] || []).filter((p: unknown) => (p as Record<string, unknown>).id !== id)
            }
            return { changes: 1 }
        }),
        get: vi.fn((...values: unknown[]) => {
            const table = sql.match(/FROM (\w+)/)?.[1]
            if (sql.includes('COUNT')) return { count: (mockDb.data[table || ''] || []).length }
            const items = mockDb.data[table || ''] || []
            return items.find((p: unknown) => (p as Record<string, unknown>).id === values[0])
        }),
        all: vi.fn(() => {
            const table = sql.match(/FROM (\w+)/)?.[1]
            return mockDb.data[table || ''] || []
        })
    })),
    transaction: vi.fn((fn: (data: unknown[]) => void) => (data: unknown[]) => fn(data)),
    close: vi.fn()
}

vi.mock('better-sqlite3', () => ({
    default: vi.fn(() => mockDb)
}))

// Mock DataService
const mockDataService = {
    getPath: vi.fn((_type: string) => `/mock/path/${_type}`)
}

// Mock LanceDbService
const mockLanceDbService = {
    initialize: vi.fn(),
    search: vi.fn(),
    add: vi.fn()
}

describe('DatabaseService', () => {
    let service: DatabaseService

    beforeEach(() => {
        vi.clearAllMocks()
        // Reset in-memory data
        mockDb.data = {}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        service = new DatabaseService(mockDataService as any, mockLanceDbService as any)
    })

    describe('constructor', () => {
        it('should initialize with correct paths', () => {
            expect(mockDataService.getPath).toHaveBeenCalled()
            expect(service).toBeDefined()
        })
    })

    describe('Folder operations', () => {
        it('should create a new folder', async () => {
            const result = await service.createFolder('Test Folder', '#ff0000')
            expect(result).toBeDefined()
            expect(result.name).toBe('Test Folder')
            expect(result.color).toBe('#ff0000')
            expect(result.id).toBeTruthy()
        })

        it('should get all folders', async () => {
            await service.createFolder('Folder 1')
            await service.createFolder('Folder 2')
            const folders = await service.getFolders()
            expect(folders.length).toBe(2)
        })

        it('should update a folder', async () => {
            const created = await service.createFolder('Original')
            await service.updateFolder(created.id, { name: 'Updated', color: '#00ff00' })
            const folders = await service.getFolders()
            const updated = folders.find(f => f.id === created.id)
            expect(updated?.name).toBe('Updated')
            expect(updated?.color).toBe('#00ff00')
        })

        it('should delete a folder', async () => {
            const created = await service.createFolder('ToDelete')
            await service.deleteFolder(created.id)
            const folders = await service.getFolders()
            expect(folders.find(f => f.id === created.id)).toBeUndefined()
        })
    })

    describe('Prompt operations', () => {
        it('should create a new prompt', async () => {
            const result = await service.createPrompt('Test Prompt', 'This is content', ['tag1', 'tag2'])
            expect(result).toBeDefined()
            expect(result.title).toBe('Test Prompt')
            expect(result.content).toBe('This is content')
            expect(result.tags).toContain('tag1')
        })

        it('should get all prompts', async () => {
            await service.createPrompt('Prompt 1', 'Content 1')
            await service.createPrompt('Prompt 2', 'Content 2')
            const prompts = await service.getPrompts()
            expect(prompts.length).toBe(2)
        })

        it('should update a prompt', async () => {
            const created = await service.createPrompt('Original', 'Content')
            await service.updatePrompt(created.id, { title: 'Updated Title' })
            const prompts = await service.getPrompts()
            const updated = prompts.find(p => p.id === created.id)
            expect(updated?.title).toBe('Updated Title')
        })

        it('should delete a prompt', async () => {
            const created = await service.createPrompt('ToDelete', 'Content')
            await service.deletePrompt(created.id)
            const prompts = await service.getPrompts()
            expect(prompts.find(p => p.id === created.id)).toBeUndefined()
        })
    })

    describe('Project operations (SQLite)', () => {
        it('should create a new project with all fields', async () => {
            const result = await service.createProject(
                'Test Project',
                '/path/to/project',
                'A test project',
                JSON.stringify([{ id: 'mount-1', name: 'Local', type: 'local', rootPath: '/path' }])
            )
            expect(result).toBeDefined()
            expect(result.title).toBe('Test Project')
            expect(result.path).toBe('/path/to/project')
            expect(result.description).toBe('A test project')
            expect(result.status).toBe('active')
            expect(result.chatIds).toEqual([])
            expect(result.councilConfig).toEqual({
                enabled: false,
                members: [],
                consensusThreshold: 0.7
            })
            expect(result.mounts).toHaveLength(1)
        })

        it('should get all projects', async () => {
            await service.createProject('Project 1', '/path1', 'Desc 1')
            await service.createProject('Project 2', '/path2', 'Desc 2')
            const projects = await service.getProjects()
            expect(projects.length).toBe(2)
        })

        it('should get a single project by ID', async () => {
            const created = await service.createProject('Single Project', '/path', 'desc')
            const found = await service.getProject(created.id)
            expect(found).toBeDefined()
            expect(found?.id).toBe(created.id)
            expect(found?.title).toBe('Single Project')
        })

        it('should update a project', async () => {
            const created = await service.createProject('Original', '/path', 'desc')
            const updated = await service.updateProject(created.id, {
                title: 'Updated Title',
                description: 'New description'
            })
            expect(updated?.title).toBe('Updated Title')
            expect(updated?.description).toBe('New description')

            const fetched = await service.getProject(created.id)
            expect(fetched?.title).toBe('Updated Title')
        })

        it('should delete a project', async () => {
            const created = await service.createProject('ToDelete', '/path', 'desc')
            await service.deleteProject(created.id)
            const projects = await service.getProjects()
            expect(projects.find(p => p.id === created.id)).toBeUndefined()
        })

        it('should archive a project', async () => {
            const created = await service.createProject('ToArchive', '/path', 'desc')
            await service.archiveProject(created.id, true)
            const fetched = await service.getProject(created.id)
            expect(fetched?.status).toBe('archived')
        })

        it('should unarchive a project', async () => {
            const created = await service.createProject('ToUnarchive', '/path', 'desc')
            await service.archiveProject(created.id, true)
            await service.archiveProject(created.id, false)
            const fetched = await service.getProject(created.id)
            expect(fetched?.status).toBe('active')
        })

        it('should handle council config correctly', async () => {
            const councilConfig = {
                enabled: true,
                members: ['model-1', 'model-2'],
                consensusThreshold: 0.8
            }
            const result = await service.createProject(
                'Council Project',
                '/path',
                'desc',
                undefined,
                JSON.stringify(councilConfig)
            )
            expect(result.councilConfig).toEqual(councilConfig)

            const fetched = await service.getProject(result.id)
            expect(fetched?.councilConfig).toEqual(councilConfig)
        })
    })
})
