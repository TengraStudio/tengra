/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as fsModule from 'fs';
import { promises as fs } from 'fs';

import type { LspService } from '@main/services/workspace/lsp.service';
import { WorkspaceService } from '@main/services/workspace/workspace.service';
import { clearWorkspaceIgnoreMatcherCache } from '@main/services/workspace/workspace-ignore.util';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocking fs and path
vi.mock('fs', () => ({
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    watch: vi.fn(),
    promises: {
        access: vi.fn(),
        readdir: vi.fn(),
        readFile: vi.fn(),
        stat: vi.fn(),
        writeFile: vi.fn()
    }
}));
vi.mock('path', async () => {
    const actual = await vi.importActual('path') as Record<string, TestValue>;
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

let workspaceService: WorkspaceService;

const mockDirent = (name: string, isDirectory: boolean) => ({
    name,
    isDirectory: () => isDirectory,
    isFile: () => !isDirectory
});

function initializeWorkspaceServiceTestState(): void {
    vi.resetAllMocks();
    clearWorkspaceIgnoreMatcherCache();
    workspaceService = new WorkspaceService();
    vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
    vi.mocked(fs.readFile).mockImplementation(async (filePath: Parameters<typeof fs.readFile>[0]) => {
        const normalizedPath = String(filePath).replace(/\\/g, '/');
        if (
            normalizedPath.endsWith('/.gitignore') ||
            normalizedPath.endsWith('/.git/info/exclude')
        ) {
            const missingFileError = new Error('ENOENT') as NodeJS.ErrnoException;
            missingFileError.code = 'ENOENT';
            throw missingFileError;
        }
        return '';
    });
    vi.mocked(fsModule.watch).mockReturnValue({
        close: vi.fn(),
        on: vi.fn(),
    } as never as import('fs').FSWatcher);
}

describe('WorkspaceService core behavior', () => {
    beforeEach(() => {
        initializeWorkspaceServiceTestState();
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
        } as never as import('fs').Stats);

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
        } as never as import('fs').Stats);

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
        await expect(workspaceService.analyzeWorkspace('')).rejects.toThrow('Workspace root path must be a non-empty string');
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
        } as never as import('fs').Stats);

        const initial = await workspaceService.analyzeWorkspace(mockDirPath);
        expect(initial.stats.fileCount).toBeGreaterThan(0);

        const trackChangedPath = (
            workspaceService as never as { trackChangedPath: (rootPath: string, changedPath: string) => void }
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
        } as never as import('fs').Stats);

        await workspaceService.analyzeWorkspace(mockDirPath);
        const page = await workspaceService.getWorkspaceFilePage(mockDirPath, -10, 0);

        expect(page.offset).toBe(0);
        expect(page.limit).toBe(1);
        expect(page.files).toHaveLength(1);
        expect(page.total).toBeGreaterThanOrEqual(3);
    });

    it('does not cap initial workspace scans by a 5000-file hard limit', async () => {
        const mockDirPath = '/mock/workspace';
        const rootEntries = Array.from({ length: 5001 }, (_, index) => mockDirent(`file-${index}.ts`, false));

        vi.mocked(fs.readdir).mockResolvedValue(rootEntries as never);
        vi.mocked(fs.stat).mockResolvedValue({
            size: 100,
            mtimeMs: Date.now(),
            isDirectory: () => false,
            isFile: () => true
        } as never as import('fs').Stats);

        const initial = await workspaceService.analyzeWorkspace(mockDirPath);
        expect(initial.stats.fileCount).toBe(5001);

        const fullPage = await workspaceService.getWorkspaceFilePage(mockDirPath, 0, 6000);
        expect(fullPage.total).toBe(5001);
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

    it('deduplicates concurrent summary analysis requests for the same workspace', async () => {
        vi.mocked(fs.readdir).mockResolvedValueOnce([
            mockDirent('src', true),
            mockDirent('package.json', false)
        ] as never).mockResolvedValueOnce([
            mockDirent('index.ts', false)
        ] as never);
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
            dependencies: { react: '18.2.0' },
            devDependencies: {}
        }));
        vi.mocked(fs.stat).mockResolvedValue({
            size: 100,
            mtimeMs: Date.now(),
            isDirectory: () => false,
            isFile: () => true
        } as never as import('fs').Stats);

        const [firstResult, secondResult] = await Promise.all([
            workspaceService.analyzeWorkspaceSummary('/mock/workspace'),
            workspaceService.analyzeWorkspaceSummary('/mock/workspace'),
        ]);

        expect(fs.readdir).toHaveBeenCalledTimes(2);
        expect(firstResult).toEqual(secondResult);
    });

    it('reuses an existing watcher for repeated watch requests on the same root', async () => {
        const onChange = vi.fn();

        await workspaceService.watchWorkspace('/mock/workspace', onChange);
        await workspaceService.watchWorkspace('/mock/workspace', onChange);

        expect(fsModule.watch).toHaveBeenCalledTimes(1);
    });
});

describe('WorkspaceService diagnostics and LSP behavior', () => {
    beforeEach(() => {
        initializeWorkspaceServiceTestState();
    });

    it('weights language distribution by file size and recognizes special filenames', async () => {
        vi.mocked(fs.stat).mockImplementation(async (filePath: import('fs').PathLike) => {
            const normalizedPath = String(filePath);
            const sizeMap: Record<string, number> = {
                '/mock/workspace/src/app.ts': 400,
                '/mock/workspace/src/view.tsx': 600,
                '/mock/workspace/Dockerfile': 50,
                '/mock/workspace/include/app.h': 200,
                '/mock/workspace/docs/guide.md': 900,
                '/mock/workspace/logs/build.log': 700,
                '/mock/workspace/vendor/lib/helper.c': 800,
                '/mock/workspace/build/native/app.pdb': 5000,
                '/mock/workspace/native/project.vcxproj': 1200,
            };

            return {
                size: sizeMap[normalizedPath] ?? 1,
                mtimeMs: Date.now(),
                isDirectory: () => false,
                isFile: () => true,
            } as never as import('fs').Stats;
        });

        const languageMap = await (
            workspaceService as never as {
                calculateLanguages: (files: string[]) => Promise<Record<string, number>>;
            }
        ).calculateLanguages([
            '/mock/workspace/src/app.ts',
            '/mock/workspace/src/view.tsx',
            '/mock/workspace/Dockerfile',
            '/mock/workspace/include/app.h',
            '/mock/workspace/docs/guide.md',
            '/mock/workspace/logs/build.log',
            '/mock/workspace/vendor/lib/helper.c',
            '/mock/workspace/build/native/app.pdb',
            '/mock/workspace/native/project.vcxproj',
        ]);

        expect(languageMap.TypeScript).toBe(1000);
        expect(languageMap.Dockerfile).toBe(50);
        expect(languageMap['C/C++ Header']).toBe(200);
        expect(languageMap.Markdown).toBeUndefined();
        expect(languageMap.Log).toBeUndefined();
        expect(languageMap.C).toBeUndefined();
        expect(languageMap.PDB).toBeUndefined();
        expect(languageMap.VCXPROJ).toBeUndefined();
    });

    it('detects technologies from workspace config files and lockfiles', async () => {
        vi.mocked(fs.readdir)
            .mockResolvedValueOnce([
                mockDirent('package.json', false),
                mockDirent('playwright.config.ts', false),
                mockDirent('tailwind.config.ts', false),
                mockDirent('pnpm-lock.yaml', false),
                mockDirent('.github', true),
            ] as never)
            .mockResolvedValueOnce([
                mockDirent('workflows', true),
            ] as never)
            .mockResolvedValueOnce([
                mockDirent('ci.yml', false),
            ] as never);

        vi.mocked(fs.readFile).mockResolvedValue(
            JSON.stringify({
                dependencies: {},
                devDependencies: {},
                packageManager: 'pnpm@9.0.0',
            })
        );
        vi.mocked(fs.stat).mockResolvedValue({
            size: 128,
            mtimeMs: Date.now(),
            isDirectory: () => false,
            isFile: () => true,
        } as never as import('fs').Stats);

        const analysis = await workspaceService.analyzeWorkspace('/mock/workspace');

        expect(analysis.frameworks).toContain('Playwright');
        expect(analysis.frameworks).toContain('Tailwind CSS');
        expect(analysis.frameworks).toContain('pnpm');
        expect(analysis.frameworks).toContain('GitHub Actions');
    });

    it('does not create workspace issues or annotations from static heuristics and comments', async () => {
        vi.mocked(fs.readdir).mockResolvedValueOnce([
            mockDirent('src', true),
        ] as never).mockResolvedValueOnce([
            mockDirent('index.ts', false),
        ] as never);

        vi.mocked(fs.readFile).mockResolvedValue([
            'console.error("not a workspace issue");',
            '// TODO: tighten validation',
            'console.warn("not a warning issue");',
            '// FIXME: recover from failure',
        ].join('\n'));
        vi.mocked(fs.stat).mockResolvedValue({
            size: 64,
            mtimeMs: Date.now(),
            isDirectory: () => false,
            isFile: () => true,
        } as never as import('fs').Stats);

        const analysis = await workspaceService.analyzeWorkspace('/mock/workspace');

        expect(analysis.issues).toEqual([]);
        expect(analysis.annotations).toEqual([]);
    });

    it('skips files and directories declared in .gitignore during workspace analysis', async () => {
        vi.mocked(fs.readdir)
            .mockResolvedValueOnce([
                mockDirent('src', true),
                mockDirent('ignored', true),
                mockDirent('package.json', false),
            ] as never)
            .mockResolvedValueOnce([
                mockDirent('index.ts', false),
            ] as never)
            .mockResolvedValueOnce([
                mockDirent('secret.ts', false),
            ] as never);
        vi.mocked(fs.readFile).mockImplementation(async (filePath: Parameters<typeof fs.readFile>[0]) => {
            const normalizedPath = String(filePath).replace(/\\/g, '/');
            if (normalizedPath.endsWith('/.gitignore')) {
                return 'ignored/\n';
            }
            if (
                normalizedPath.endsWith('/.git/info/exclude')
            ) {
                const missingFileError = new Error('ENOENT') as NodeJS.ErrnoException;
                missingFileError.code = 'ENOENT';
                throw missingFileError;
            }
            return JSON.stringify({
                dependencies: {},
                devDependencies: {},
            });
        });
        vi.mocked(fs.stat).mockResolvedValue({
            size: 64,
            mtimeMs: Date.now(),
            isDirectory: () => false,
            isFile: () => true,
        } as never as import('fs').Stats);

        const analysis = await workspaceService.analyzeWorkspace('/mock/workspace');

        expect(analysis.files.some(file => file.includes('ignored'))).toBe(false);
        expect(analysis.stats.fileCount).toBe(2);
    });

    it('reports largest directories relative to the workspace root only', async () => {
        vi.mocked(fs.readdir)
            .mockResolvedValueOnce([
                mockDirent('src', true),
                mockDirent('package.json', false),
            ] as never)
            .mockResolvedValueOnce([
                mockDirent('feature', true),
                mockDirent('index.ts', false),
            ] as never)
            .mockResolvedValueOnce([
                mockDirent('panel.tsx', false),
            ] as never);
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
            dependencies: {},
            devDependencies: {},
        }));
        vi.mocked(fs.stat).mockImplementation(async (filePath: fsModule.PathLike) => {
            const normalizedPath = String(filePath).replace(/\\/g, '/');
            const size = normalizedPath.endsWith('/panel.tsx') ? 150 : 75;
            return {
                size,
                mtimeMs: Date.now(),
                isDirectory: () => false,
                isFile: () => true,
            } as never as import('fs').Stats;
        });

        const analysis = await workspaceService.analyzeWorkspace('/mock/workspace');

        expect(analysis.stats.largestDirectories).toEqual([
            {
                path: 'src',
                size: 225,
                fileCount: 2,
            },
            {
                path: 'src/feature',
                size: 150,
                fileCount: 1,
            },
        ]);
    });

    it('maps LSP diagnostics into workspace analysis results', async () => {
        const mockLspService = {
            startWorkspaceServers: vi.fn().mockResolvedValue(undefined),
            startServer: vi.fn().mockResolvedValue(undefined),
            primeWorkspaceDocuments: vi.fn().mockResolvedValue(undefined),
            getLanguageIdForFile: vi.fn().mockReturnValue('typescript'),
            getWorkspaceServerSupport: vi.fn().mockReturnValue([
                {
                    languageId: 'typescript',
                    serverId: 'typescript-language-server',
                    status: 'running',
                    bundled: true,
                    fileCount: 1,
                },
            ]),
            getDiagnostics: vi.fn().mockReturnValue([
                {
                    uri: 'file:///C:/mock/workspace/src/index.ts',
                    diagnostics: [
                        {
                            severity: 1,
                            message: 'Type error',
                            source: 'typescript',
                            range: {
                                start: { line: 1, character: 4 },
                                end: { line: 1, character: 10 },
                            },
                            code: 2322,
                        },
                    ],
                },
            ]),
        } as never as LspService;
        workspaceService = new WorkspaceService(mockLspService);

        vi.mocked(fs.readdir).mockResolvedValueOnce([
            mockDirent('src', true),
            mockDirent('package.json', false),
        ] as never).mockResolvedValueOnce([
            mockDirent('index.ts', false),
        ] as never);
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
            dependencies: {},
            devDependencies: { typescript: '5.0.0' },
        }));
        vi.mocked(fs.stat).mockResolvedValue({
            size: 64,
            mtimeMs: Date.now(),
            isDirectory: () => false,
            isFile: () => true,
        } as never as import('fs').Stats);

        const analysis = await workspaceService.analyzeWorkspace('/mock/workspace');

        expect(vi.mocked(mockLspService.startWorkspaceServers)).toHaveBeenCalledWith(
            'C:\\mock\\workspace',
            'C:\\mock\\workspace',
            expect.arrayContaining([
                expect.stringMatching(/index\.ts$/),
            ])
        );
        expect(analysis.lspDiagnostics).toEqual([
            {
                severity: 'error',
                message: 'Type error',
                file: 'src\\index.ts',
                line: 2,
                column: 5,
                source: 'typescript',
                code: 2322,
            },
        ]);
        expect(analysis.lspServers).toEqual([
            {
                languageId: 'typescript',
                serverId: 'typescript-language-server',
                status: 'running',
                bundled: true,
                fileCount: 1,
            },
        ]);
    });

    it('resolves file diagnostics through the nearest TypeScript project root', async () => {
        const mockLspService = {
            getLanguageIdForFile: vi.fn().mockReturnValue('typescript'),
            startServer: vi.fn().mockResolvedValue(undefined),
            openDocument: vi.fn().mockResolvedValue(undefined),
            getDiagnostics: vi.fn().mockReturnValue([
                {
                    uri: 'file:///C:/mock/workspace/packages/app/src/index.tsx',
                    diagnostics: [
                        {
                            severity: 1,
                            message: 'Type mismatch',
                            source: 'typescript',
                            range: {
                                start: { line: 4, character: 6 },
                                end: { line: 4, character: 12 },
                            },
                            code: 2322,
                        },
                    ],
                },
            ]),
        } as never as LspService;
        workspaceService = new WorkspaceService(mockLspService);
        vi.mocked(fs.access).mockImplementation(async (filePath: fsModule.PathLike) => {
            const normalizedPath = String(filePath).replace(/\\/g, '/');
            if (normalizedPath.endsWith('/packages/app/tsconfig.json')) {
                return undefined;
            }
            throw new Error('ENOENT');
        });

        const diagnostics = await workspaceService.getFileDiagnostics(
            '/mock/workspace',
            '/mock/workspace/packages/app/src/index.tsx',
            'export const value: string = 1;'
        );

        expect(vi.mocked(mockLspService.startServer)).toHaveBeenCalledWith(
            'C:\\mock\\workspace\\packages\\app',
            'C:\\mock\\workspace\\packages\\app',
            'typescript'
        );
        expect(vi.mocked(mockLspService.openDocument)).toHaveBeenCalledWith(
            'C:\\mock\\workspace\\packages\\app',
            'C:\\mock\\workspace\\packages\\app\\src\\index.tsx',
            'typescript',
            'export const value: string = 1;'
        );
        expect(diagnostics).toEqual([
            {
                severity: 'error',
                message: 'Type mismatch',
                file: 'packages\\app\\src\\index.tsx',
                line: 5,
                column: 7,
                source: 'typescript',
                code: 2322,
            },
        ]);
    });

    it('resolves file definitions through the nearest TypeScript project root', async () => {
        const mockLspService = {
            getLanguageIdForFile: vi.fn().mockReturnValue('typescript'),
            startServer: vi.fn().mockResolvedValue(undefined),
            openDocument: vi.fn().mockResolvedValue(undefined),
            getDefinition: vi.fn().mockResolvedValue([
                {
                    uri: 'file:///C:/mock/workspace/packages/app/src/components/Popover.tsx',
                    line: 12,
                    column: 1,
                },
            ]),
        } as never as LspService;
        workspaceService = new WorkspaceService(mockLspService);
        vi.mocked(fs.access).mockImplementation(async (filePath: fsModule.PathLike) => {
            const normalizedPath = String(filePath).replace(/\\/g, '/');
            if (normalizedPath.endsWith('/packages/app/tsconfig.json')) {
                return undefined;
            }
            throw new Error('ENOENT');
        });

        const definitions = await workspaceService.getFileDefinition(
            '/mock/workspace',
            '/mock/workspace/packages/app/src/index.tsx',
            'import { Popover } from "@/components/ui/popover";',
            1,
            26
        );

        expect(vi.mocked(mockLspService.startServer)).toHaveBeenCalledWith(
            'C:\\mock\\workspace\\packages\\app',
            'C:\\mock\\workspace\\packages\\app',
            'typescript'
        );
        expect(vi.mocked(mockLspService.getDefinition)).toHaveBeenCalledWith(
            'C:\\mock\\workspace\\packages\\app',
            'C:\\mock\\workspace\\packages\\app\\src\\index.tsx',
            'typescript',
            1,
            26
        );
        expect(definitions).toEqual([
            {
                file: 'C:\\mock\\workspace\\packages\\app\\src\\components\\Popover.tsx',
                line: 12,
                column: 1,
            },
        ]);
    });
});

