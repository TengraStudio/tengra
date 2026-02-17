import { promises as fs } from 'fs';

import { ProjectService } from '@main/services/project/project.service';
import { beforeEach,describe, expect, it, vi } from 'vitest';

// Mocking fs and path
vi.mock('fs', () => ({
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    promises: {
        readdir: vi.fn(),
        readFile: vi.fn(),
        stat: vi.fn()
    }
}));
vi.mock('path', async () => {
    const actual = await vi.importActual('path') as Record<string, unknown>;
    return {
        ...actual,
        join: vi.fn((...args: string[]) => args.join('/')),
        basename: vi.fn((p: string) => p.split('/').pop()),
        extname: vi.fn((p: string) => {
            const parts = p.split('.');
            return parts.length > 1 ? '.' + parts.pop() : '';
        })
    };
});

describe('ProjectService', () => {
    let projectService: ProjectService;

    const mockDirent = (name: string, isDirectory: boolean) => ({
        name,
        isDirectory: () => isDirectory,
        isFile: () => !isDirectory
    });

    beforeEach(() => {
        vi.clearAllMocks();
        projectService = new ProjectService();
    });

    it('should analyze a project correctly', async () => {
        const mockDirPath = '/mock/project';

        // Mock readdir for scanFiles
        vi.mocked(fs.readdir).mockResolvedValue([
            mockDirent('src', true),
            mockDirent('package.json', false)
        ] as any);

        // Mock readdir for nested src
        vi.mocked(fs.readdir).mockResolvedValueOnce([
            mockDirent('src', true),
            mockDirent('package.json', false)
        ] as any).mockResolvedValueOnce([
            mockDirent('index.ts', false)
        ] as any);

        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
            dependencies: { 'react': '18.2.0' },
            devDependencies: { 'typescript': '5.0.0' }
        }));

        vi.mocked(fs.stat).mockResolvedValue({
            size: 1000,
            mtimeMs: Date.now(),
            isDirectory: () => false
        } as unknown as import('fs').Stats);

        const analysis = await projectService.analyzeProject(mockDirPath);

        expect(analysis.type).toBe('node');
        expect(analysis.frameworks).toContain('React');
        expect(analysis.frameworks).toContain('TypeScript');
        expect(analysis.stats.fileCount).toBeGreaterThan(0);
    });

    it('should analyze a directory correctly', async () => {
        const mockDirPath = '/mock/project';

        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ name: 'test-pkg' }));
        vi.mocked(fs.readdir).mockResolvedValue([
            'file1.ts',
            'README.md'
        ] as any);
        vi.mocked(fs.stat).mockResolvedValue({
            size: 500,
            mtimeMs: Date.now(),
            isDirectory: () => false
        } as unknown as import('fs').Stats);

        const result = await projectService.analyzeDirectory(mockDirPath);

        expect(result.hasPackageJson).toBe(true);
        expect(result.pkg.name).toBe('test-pkg');
        expect(result.stats.fileCount).toBe(2);
    });

    it('should return safe defaults when directory listing fails', async () => {
        const mockDirPath = '/restricted/project';

        vi.mocked(fs.readFile).mockRejectedValue(new Error('EACCES'));
        vi.mocked(fs.readdir).mockRejectedValue(new Error('EACCES'));

        const result = await projectService.analyzeDirectory(mockDirPath);

        expect(result.hasPackageJson).toBe(false);
        expect(result.pkg).toEqual({});
        expect(result.readme).toBeNull();
        expect(result.stats.fileCount).toBe(0);
        expect(result.stats.totalSize).toBe(0);
    });

    it('should tolerate scan permission failures during project analysis', async () => {
        const mockDirPath = '/restricted/project';

        vi.mocked(fs.readdir).mockRejectedValue(new Error('EACCES'));

        const result = await projectService.analyzeProject(mockDirPath);

        expect(result.type).toBe('unknown');
        expect(result.files).toEqual([]);
        expect(result.stats.fileCount).toBe(0);
    });
});
