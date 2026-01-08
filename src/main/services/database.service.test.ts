import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DatabaseService } from './database.service'

// Mock DataService
const mockDataService = {
    getPath: vi.fn((type: string) => `/mock/path/${type}`)
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
})
