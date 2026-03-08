import { promises as fs } from 'fs';

import { WorkspaceService } from '@main/services/workspace/workspace.service';
import { beforeEach,describe, expect, it, vi } from 'vitest';

// Mocking fs and path
vi.mock('fs', () => ({
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    promises: {
        readdir: vi.fn(),
        readFile: vi.fn(),
        stat: vi.fn(),
        writeFile: vi.fn()
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

describe('WorkspaceService', () => {
    let workspaceService: WorkspaceService;

    const mockDirent = (name: string, isDirectory: boolean) => ({
        name,
        isDirectory: () => isDirectory,
        isFile: () => !isDirectory
    });

    beforeEach(() => {
        vi.clearAllMocks();
        workspaceService = new WorkspaceService();
    });

    it('should analyze a workspace correctly', async () => {
        const mockDirPath = '/mock/workspace';

        // Mock readdir for scanFiles
        vi.mocked(fs.readdir).mockResolvedValue([
            mockDirent('src', true),
            mockDirent('package.json', false)
        ] as never);

        // Mock readdir for nested src
        vi.mocked(fs.readdir).mockResolvedValueOnce([
            mockDirent('src', true),
            mockDirent('package.json', false)
        ] as never).mockResolvedValueOnce([
            mockDirent('index.ts', false)
        ] as never);

        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
            dependencies: { 'react': '18.2.0' },
            devDependencies: { 'typescript': '5.0.0' }
        }));

        vi.mocked(fs.stat).mockResolvedValue({
            size: 1000,
            mtimeMs: Date.now(),
            isDirectory: () => false
        } as unknown as import('fs').Stats);

        const analysis = await workspaceService.analyzeWorkspace(mockDirPath);

        expect(analysis.type).toBe('node');
        expect(analysis.frameworks).toContain('React');
        expect(analysis.frameworks).toContain('TypeScript');
        expect(analysis.stats.fileCount).toBeGreaterThan(0);
    });

    it('should analyze a directory correctly', async () => {
        const mockDirPath = '/mock/workspace';

        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ name: 'test-pkg' }));
        vi.mocked(fs.readdir).mockResolvedValue([
            'file1.ts',
            'README.md'
        ] as never);
        vi.mocked(fs.stat).mockResolvedValue({
            size: 500,
            mtimeMs: Date.now(),
            isDirectory: () => false
        } as unknown as import('fs').Stats);

        const result = await workspaceService.analyzeDirectory(mockDirPath);

        expect(result.hasPackageJson).toBe(true);
        expect(result.pkg.name).toBe('test-pkg');
        expect(result.stats.fileCount).toBe(2);
    });

    it('should return safe defaults when directory listing fails', async () => {
        const mockDirPath = '/restricted/workspace';

        vi.mocked(fs.readFile).mockRejectedValue(new Error('EACCES'));
        vi.mocked(fs.readdir).mockRejectedValue(new Error('EACCES'));

        const result = await workspaceService.analyzeDirectory(mockDirPath);

        expect(result.hasPackageJson).toBe(false);
        expect(result.pkg).toEqual({});
        expect(result.readme).toBeNull();
        expect(result.stats.fileCount).toBe(0);
        expect(result.stats.totalSize).toBe(0);
    });

    it('should tolerate scan permission failures during workspace analysis', async () => {
        const mockDirPath = '/restricted/workspace';

        vi.mocked(fs.readdir).mockRejectedValue(new Error('EACCES'));

        const result = await workspaceService.analyzeWorkspace(mockDirPath);

        expect(result.type).toBe('unknown');
        expect(result.files).toEqual([]);
        expect(result.stats.fileCount).toBe(0);
    });

    it('throws when workspace root path input is invalid', async () => {
        await expect(workspaceService.analyzeWorkspace('')).rejects.toThrow('Invalid workspace root path');
    });

    it('applies incremental invalidation from changed path set', async () => {
        const mockDirPath = '/mock/workspace';

        vi.mocked(fs.readdir)
            .mockResolvedValueOnce([
                mockDirent('src', true),
                mockDirent('package.json', false)
            ] as never)
            .mockResolvedValueOnce([
                mockDirent('index.ts', false)
            ] as never);

        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
            dependencies: { react: '18.2.0' },
            devDependencies: {}
        }));

        vi.mocked(fs.stat).mockResolvedValue({
            size: 1000,
            mtimeMs: Date.now(),
            isDirectory: () => false,
            isFile: () => true
        } as unknown as import('fs').Stats);

        const initial = await workspaceService.analyzeWorkspace(mockDirPath);
        expect(initial.stats.fileCount).toBeGreaterThan(0);

        const trackChangedPath = (
            workspaceService as unknown as { trackChangedPath: (rootPath: string, changedPath: string) => void }
        ).trackChangedPath.bind(workspaceService);
        trackChangedPath(mockDirPath, '/mock/workspace/src/new-file.ts');
        const updated = await workspaceService.analyzeWorkspace(mockDirPath);

        expect(updated.stats.fileCount).toBe(initial.stats.fileCount + 1);
        expect(updated.files.some(file => file.includes('new-file.ts'))).toBe(true);
    });

    it('normalizes pagination bounds for file pages', async () => {
        const mockDirPath = '/mock/workspace';

        vi.mocked(fs.readdir).mockResolvedValueOnce([
            mockDirent('index.ts', false),
            mockDirent('util.ts', false),
            mockDirent('package.json', false)
        ] as never);

        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
            dependencies: {},
            devDependencies: {}
        }));

        vi.mocked(fs.stat).mockResolvedValue({
            size: 250,
            mtimeMs: Date.now(),
            isDirectory: () => false,
            isFile: () => true
        } as unknown as import('fs').Stats);

        await workspaceService.analyzeWorkspace(mockDirPath);
        const page = await workspaceService.getWorkspaceFilePage(mockDirPath, -10, 0);

        expect(page.offset).toBe(0);
        expect(page.limit).toBe(1);
        expect(page.files).toHaveLength(1);
        expect(page.total).toBeGreaterThanOrEqual(3);
    });

    it('parses env vars with comments, quotes, and embedded equals signs', async () => {
        vi.mocked(fs.readFile).mockResolvedValue([
            '# comment line',
            'PLAIN=value',
            '1INVALID=skip-me',
            'DOUBLE_QUOTED="quoted value"',
            "SINGLE_QUOTED='single value'",
            'WITH_EQUALS="a=b=c"',
            'EMPTY=',
            'INVALID_LINE'
        ].join('\n'));

        const vars = await workspaceService.getEnvVars('/mock/workspace');

        expect(vars).toEqual({
            PLAIN: 'value',
            DOUBLE_QUOTED: 'quoted value',
            SINGLE_QUOTED: 'single value',
            WITH_EQUALS: 'a=b=c',
            EMPTY: ''
        });
    });

    it('writes env vars to the workspace .env file', async () => {
        await workspaceService.saveEnvVars('/mock/workspace', {
            API_KEY: 'secret',
            NODE_ENV: 'development'
        });

        expect(fs.writeFile).toHaveBeenCalledWith(
            expect.stringMatching(/mock[\\/]+workspace[\\/]+\.env$/),
            'API_KEY=secret\nNODE_ENV=development',
            'utf-8'
        );
    });

    it('rejects env save payloads with invalid variable names', async () => {
        await expect(workspaceService.saveEnvVars('/mock/workspace', {
            'INVALID-NAME': 'x'
        })).rejects.toThrow('Invalid environment variable payload');
    });
});
