import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DatabaseService } from '../../../main/services/data/database.service'

// Mock DataService
const mockDataService = {
    getPath: vi.fn((type: string) => `/mock/path/${type}`)
}

// Mock Database State
const dbState = {
    data: {} as Record<string, any[]>
}

// Mock PGlite
const mockPGliteInstance = {
    waitReady: Promise.resolve(),
    query: vi.fn(async (sql: string, params: any[] = []) => {
        const normalizedSql = sql.toLowerCase()

        // Handle COUNT(*)
        if (normalizedSql.includes('count(*)')) {
            const tableMatch = sql.match(/FROM (\w+)/i)
            const table = tableMatch ? tableMatch[1] : ''
            return { rows: [{ c: (dbState.data[table] || []).length }] }
        }

        // Handle SELECT * FROM table
        if (normalizedSql.includes('select * from')) {
            const tableMatch = sql.match(/FROM (\w+)/i)
            const table = tableMatch ? tableMatch[1] : ''
            let rows = [...(dbState.data[table] || [])]

            // Basic WHERE id = ?
            if (normalizedSql.includes('where id =')) {
                const id = params[0]
                rows = rows.filter(r => r.id === id)
            }

            return { rows }
        }

        // Handle INSERT
        if (normalizedSql.includes('insert into')) {
            const tableMatch = sql.match(/INSERT INTO (\w+)/i)
            const table = tableMatch ? tableMatch[1] : ''
            if (!dbState.data[table]) dbState.data[table] = []

            // Extract column names if possible or just assume order
            // This is a bit complex for a mock, but we can do a simple version
            // For this project, we know the schemas.
            let row: any = {}
            if (table === 'folders') {
                row = { id: params[0], name: params[1], color: params[2], created_at: params[3], updated_at: params[4] }
            } else if (table === 'prompts') {
                row = { id: params[0], title: params[1], content: params[2], tags: params[3], created_at: params[4], updated_at: params[5] }
            } else if (table === 'projects') {
                row = { id: params[0], title: params[1], description: params[2], path: params[3], mounts: params[4], chat_ids: params[5], council_config: params[6], status: params[7], metadata: params[8], created_at: params[9], updated_at: params[10] }
            }
            dbState.data[table].push(row)
            return { rows: [], affectedRows: 1 }
        }

        // Handle UPDATE
        if (normalizedSql.includes('update')) {
            const tableMatch = sql.match(/UPDATE (\w+)/i)
            const table = tableMatch ? tableMatch[1] : ''
            const id = params[params.length - 1]
            const items = dbState.data[table] || []
            const index = items.findIndex(r => r.id === id)
            if (index !== -1) {
                // Determine parameter index for each field
                const fieldsMatch = normalizedSql.match(/set (.*) where/i)
                if (fieldsMatch) {
                    const fields = fieldsMatch[1].split(',').map(f => f.trim().split('=')[0].trim())
                    fields.forEach((field, i) => {
                        if (field === 'name') items[index].name = params[i]
                        if (field === 'color') items[index].color = params[i]
                        if (field === 'title') items[index].title = params[i]
                        if (field === 'status') items[index].status = params[i]
                    })
                }
            }
            return { rows: [], affectedRows: 1 }
        }

        // Handle DELETE
        if (normalizedSql.includes('delete from')) {
            const tableMatch = sql.match(/DELETE FROM (\w+)/i)
            const table = tableMatch ? tableMatch[1] : ''
            const id = params[0]
            dbState.data[table] = (dbState.data[table] || []).filter(r => r.id !== id)
            return { rows: [], affectedRows: 1 }
        }

        return { rows: [] }
    }),
    transaction: vi.fn(async (callback) => {
        return callback(mockPGliteInstance)
    }),
    exec: vi.fn(async (sql: string) => {
        // Handle table creation
        const tableMatch = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/i)
        if (tableMatch) {
            const table = tableMatch[1]
            if (!dbState.data[table]) dbState.data[table] = []
        }
    })
}

vi.mock('@electric-sql/pglite', () => ({
    PGlite: function () {
        return mockPGliteInstance
    }
}))

vi.mock('@electric-sql/pglite/vector', () => ({
    vector: {}
}))

describe('DatabaseService', () => {
    let service: DatabaseService

    beforeEach(async () => {
        vi.clearAllMocks()
        dbState.data = {}
        service = new DatabaseService(mockDataService as any)
        // Wait for constructor init
        await service.initialize()
    })

    describe('constructor', () => {
        it('should initialize successfully', () => {
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
            const updated = await service.getFolder(created.id)
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
            const updated = await service.getPrompt(created.id)
            expect(updated?.title).toBe('Updated Title')
        })
    })

    describe('Project operations', () => {
        it('should create a new project', async () => {
            const result = await service.createProject(
                'Test Project',
                '/path/to/project',
                'A test project'
            )
            expect(result).toBeDefined()
            expect(result.title).toBe('Test Project')
        })

        it('should get all projects', async () => {
            await service.createProject('Project 1', '/path1')
            await service.createProject('Project 2', '/path2')
            const projects = await service.getProjects()
            expect(projects.length).toBe(2)
        })

        it('should update a project', async () => {
            const created = await service.createProject('Original', '/path')
            await service.updateProject(created.id, { title: 'Updated Title' })
            const fetched = await service.getProject(created.id)
            expect(fetched?.title).toBe('Updated Title')
        })

        it('should archive a project', async () => {
            const created = await service.createProject('ToArchive', '/path')
            await service.archiveProject(created.id, true)
            const fetched = await service.getProject(created.id)
            expect(fetched?.status).toBe('archived')
        })
    })
})
