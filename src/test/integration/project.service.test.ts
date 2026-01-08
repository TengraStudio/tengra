import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProjectService } from '../../main/services/project.service'
import { promises as fs } from 'fs'
import path from 'path'

// Mock fs promises
vi.mock('fs', async () => {
    return {
        promises: {
            readdir: vi.fn(),
            readFile: vi.fn(),
            stat: vi.fn()
        }
    }
})

describe('ProjectService Integration', () => {
    let projectService: ProjectService

    beforeEach(() => {
        vi.clearAllMocks()
        projectService = new ProjectService()
    })

    it('should analyze a Node.js project correctly', async () => {
        const rootPath = path.join('test', 'project')

        // Mock file system structure
        const mockFiles = [
            { name: 'package.json', isDirectory: () => false },
            { name: 'src', isDirectory: () => true },
            { name: 'README.md', isDirectory: () => false }
        ]
        const mockSrcFiles = [
            { name: 'index.ts', isDirectory: () => false },
            { name: 'App.tsx', isDirectory: () => false }
        ]

        // Mock fs.readdir
        vi.mocked(fs.readdir).mockImplementation(async (dirPath: any) => {
            if (dirPath === rootPath) return mockFiles as any
            if (dirPath === path.join(rootPath, 'src')) return mockSrcFiles as any
            return []
        })

        // Mock fs.readFile for package.json
        vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
            if (filePath.endsWith('package.json')) {
                return JSON.stringify({
                    dependencies: { 'react': '^18.0.0' },
                    devDependencies: { 'typescript': '^5.0.0' }
                })
            }
            return ''
        })

        // Mock fs.stat
        vi.mocked(fs.stat).mockResolvedValue({
            size: 100,
            mtimeMs: Date.now()
        } as any)

        const analysis = await projectService.analyzeProject(rootPath)

        expect(analysis.type).toBe('node')
        expect(analysis.frameworks).toContain('React')
        expect(analysis.frameworks).toContain('TypeScript')
        expect(analysis.dependencies).toHaveProperty('react')
        // The file count depends on recursion.
        // /test/project/package.json
        // /test/project/README.md
        // /test/project/src/index.ts
        // /test/project/src/App.tsx
        expect(analysis.stats.fileCount).toBe(4)
        expect(analysis.files).toHaveLength(4)
    })

    it('should detect Python project type', async () => {
        const rootPath = path.join('test', 'python-project')

        const mockFiles = [
            { name: 'main.py', isDirectory: () => false },
            { name: 'requirements.txt', isDirectory: () => false }
        ]

        vi.mocked(fs.readdir).mockResolvedValue(mockFiles as any)
        vi.mocked(fs.stat).mockResolvedValue({ size: 100, mtimeMs: 0 } as any)

        const analysis = await projectService.analyzeProject(rootPath)

        expect(analysis.type).toBe('python')
    })
})
