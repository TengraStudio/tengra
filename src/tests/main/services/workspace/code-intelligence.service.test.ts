import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('fs', () => ({
    promises: {
        readFile: vi.fn(),
        stat: vi.fn(async () => ({ mtimeMs: 123 })),
        writeFile: vi.fn(async () => undefined),
    }
}));

vi.mock('electron', () => ({
    BrowserWindow: {
        getAllWindows: vi.fn(() => [])
    }
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('@main/services/workspace/code-intelligence/symbol-parser.util', () => ({
    parseFileSymbols: vi.fn(() => [])
}));

vi.mock('@main/services/workspace/code-intelligence/file-scanner.util', () => ({
    scanDirRecursively: vi.fn(async (_root: string, _files: string[]) => undefined),
    scanDirForTodos: vi.fn(async (_root: string, _todos: TestValue[]) => undefined)
}));

vi.mock('@main/services/workspace/code-intelligence/symbol-navigation.util', () => ({
    findSymbols: vi.fn(async () => []),
    searchFiles: vi.fn(async () => []),
    findDefinition: vi.fn(async () => null),
    findUsage: vi.fn(async () => []),
    findImplementations: vi.fn(async () => []),
    getSymbolRelationships: vi.fn(async () => [])
}));

vi.mock('@main/services/workspace/code-intelligence/documentation-generator.util', () => ({
    getFileOutline: vi.fn(async () => []),
    generateFileDocumentation: vi.fn(async () => ({
        success: true, filePath: 'f.ts', format: 'markdown', content: '# Doc', symbolCount: 1, generatedAt: ''
    })),
    generateWorkspaceDocumentation: vi.fn(async () => ({
        success: true, filePath: '/root', format: 'markdown', content: '# Workspace', symbolCount: 5, generatedAt: ''
    }))
}));

vi.mock('@main/services/workspace/code-intelligence/rename-symbol.util', () => ({
    renameSymbol: vi.fn(async () => ({
        success: true, applied: false, symbol: 'old', newSymbol: 'new',
        totalFiles: 1, totalOccurrences: 2, changes: [], updatedFiles: [], errors: []
    }))
}));

vi.mock('@main/services/workspace/code-intelligence/code-quality-scanner.util', () => ({
    analyzeCodeQuality: vi.fn(async () => ({
        rootPath: '/root', filesScanned: 10, totalLines: 500,
        functionSymbols: 20, classSymbols: 5, longLineCount: 2,
        todoLikeCount: 3, consoleUsageCount: 1, averageComplexity: 4.5,
        securityIssueCount: 0, topSecurityFindings: [],
        highestComplexityFiles: [], qualityScore: 85, generatedAt: ''
    }))
}));

vi.mock('@main/services/workspace/workspace-ignore.util', () => ({
    DEFAULT_WORKSPACE_SCAN_IGNORE_PATTERNS: [],
    getWorkspaceIgnoreMatcher: vi.fn(async (rootPath: string) => ({
        rootPath,
        patterns: [],
        ignoresAbsolute: () => false,
        ignoresRelative: () => false,
    })),
}));

import { promises as fs } from 'fs';

import { appLogger } from '@main/logging/logger';
import type { DatabaseService, SemanticFragment } from '@main/services/data/database.service';
import type { EmbeddingService } from '@main/services/llm/embedding.service';
import { CodeIntelligenceService } from '@main/services/workspace/code-intelligence.service';
import { analyzeCodeQuality } from '@main/services/workspace/code-intelligence/code-quality-scanner.util';
import {
    generateFileDocumentation,
    generateWorkspaceDocumentation,
    getFileOutline,
} from '@main/services/workspace/code-intelligence/documentation-generator.util';
import {
    scanDirForTodos,
    scanDirRecursively,
} from '@main/services/workspace/code-intelligence/file-scanner.util';
import { renameSymbol } from '@main/services/workspace/code-intelligence/rename-symbol.util';
import {
    findDefinition,
    findImplementations,
    findSymbols,
    findUsage,
    getSymbolRelationships,
    searchFiles,
} from '@main/services/workspace/code-intelligence/symbol-navigation.util';
import { parseFileSymbols } from '@main/services/workspace/code-intelligence/symbol-parser.util';
import type { CodeSymbol } from '@main/services/workspace/code-intelligence/types';
import { getWorkspaceIgnoreMatcher } from '@main/services/workspace/workspace-ignore.util';
import { WORKSPACE_COMPAT_SCHEMA_VALUES } from '@shared/constants';
import { BrowserWindow } from 'electron';

function createMockDb(): {
    [K in keyof DatabaseService]: ReturnType<typeof vi.fn>
} {
    return {
        searchCodeSymbols: vi.fn(async () => []),
        searchSemanticFragments: vi.fn(async () => []),
        getCodeSymbolsByWorkspacePath: vi.fn(async () => []),
        getWorkspace: vi.fn(async () => null),
        clearCodeSymbols: vi.fn(async () => undefined),
        clearSemanticFragments: vi.fn(async () => undefined),
        storeCodeSymbol: vi.fn(async () => undefined),
        storeSemanticFragment: vi.fn(async () => undefined),
        hasIndexedSymbols: vi.fn(async () => false),
        deleteCodeSymbolsForFile: vi.fn(async () => undefined),
        deleteSemanticFragmentsForFile: vi.fn(async () => undefined),
    } as never as { [K in keyof DatabaseService]: ReturnType<typeof vi.fn> };
}

function createMockEmbedding(): {
    [K in keyof EmbeddingService]: ReturnType<typeof vi.fn>
} {
    return {
        generateEmbedding: vi.fn(async () => [0.1, 0.2, 0.3]),
    } as never as { [K in keyof EmbeddingService]: ReturnType<typeof vi.fn> };
}

describe('CodeIntelligenceService', () => {
    let service: CodeIntelligenceService;
    let mockDb: ReturnType<typeof createMockDb>;
    let mockEmbedding: ReturnType<typeof createMockEmbedding>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockDb = createMockDb();
        mockEmbedding = createMockEmbedding();
        service = new CodeIntelligenceService(
            mockDb as never as DatabaseService,
            mockEmbedding as never as EmbeddingService
        );
    });

    describe('queryIndexedSymbols', () => {
        it('should combine symbol and fragment results', async () => {
            mockDb.searchCodeSymbols.mockResolvedValue([
                { id: '1', name: 'MyClass', path: '/src/a.ts', line: 10, kind: 'class', signature: '', docstring: '' }
            ]);
            mockDb.searchSemanticFragments.mockResolvedValue([
                { id: '2', content: 'some code fragment', sourceId: '/src/b.ts' } as SemanticFragment
            ]);

            const results = await service.queryIndexedSymbols('MyClass');

            expect(mockEmbedding.generateEmbedding).toHaveBeenCalledWith('MyClass');
            expect(results).toHaveLength(2);
            expect(results[0]).toEqual(expect.objectContaining({
                file: '/src/a.ts', line: 10, text: 'MyClass', type: 'symbol'
            }));
            expect(results[1]).toEqual(expect.objectContaining({
                file: '/src/b.ts', line: 1, type: 'content'
            }));
        });

        it('should return empty array when no matches found', async () => {
            const results = await service.queryIndexedSymbols('nonexistent');
            expect(results).toEqual([]);
        });
    });

    describe('getSymbolAnalytics', () => {
        it('should aggregate symbol statistics correctly', async () => {
            mockDb.getCodeSymbolsByWorkspacePath.mockResolvedValue([
                { name: 'foo', kind: 'function', path: '/src/a.ts' },
                { name: 'Bar', kind: 'class', path: '/src/a.ts' },
                { name: 'baz', kind: 'function', path: '/src/b.py' },
            ]);

            const analytics = await service.getSymbolAnalytics('/root');

            expect(analytics.totalSymbols).toBe(3);
            expect(analytics.uniqueFiles).toBe(2);
            expect(analytics.uniqueKinds).toBe(2);
            expect(analytics.byKind['function']).toBe(2);
            expect(analytics.byKind['class']).toBe(1);
            expect(analytics.byExtension['.ts']).toBe(2);
            expect(analytics.byExtension['.py']).toBe(1);
            expect(analytics.topFiles.length).toBeGreaterThan(0);
            expect(analytics.generatedAt).toBeTruthy();
        });

        it('should return zero analytics when no symbols exist', async () => {
            mockDb.getCodeSymbolsByWorkspacePath.mockResolvedValue([]);
            const analytics = await service.getSymbolAnalytics('/root');
            expect(analytics.totalSymbols).toBe(0);
            expect(analytics.uniqueFiles).toBe(0);
        });

        it('should return fallback analytics on database error', async () => {
            mockDb.getCodeSymbolsByWorkspacePath.mockRejectedValue(new Error('DB failure'));
            const analytics = await service.getSymbolAnalytics('/root');
            expect(analytics.totalSymbols).toBe(0);
            expect(analytics.uniqueFiles).toBe(0);
            expect(appLogger.error).toHaveBeenCalled();
        });

        it('should handle symbols with empty kind or path', async () => {
            mockDb.getCodeSymbolsByWorkspacePath.mockResolvedValue([
                { name: 'x', kind: '  ', path: '  ' },
            ]);
            const analytics = await service.getSymbolAnalytics('/root');
            expect(analytics.totalSymbols).toBe(1);
            expect(analytics.uniqueFiles).toBe(0);
        });
    });

    describe('derived workspace artifacts', () => {
        it('builds and caches a workspace dependency graph', async () => {
            mockDb.getCodeSymbolsByWorkspacePath.mockResolvedValue([
                { name: 'Foo', kind: 'class', path: '/root/src/a.ts', line: 1, signature: 'class Foo' },
                { name: 'bar', kind: 'function', path: '/root/src/b.ts', line: 4, signature: 'function bar()' },
            ]);
            vi.mocked(scanDirRecursively).mockImplementation(async (_root: string, files: string[]) => {
                files.push('/root/src/a.ts', '/root/src/b.ts');
            });
            vi.mocked(fs.readFile).mockImplementation(async (filePath: Parameters<typeof fs.readFile>[0]) => {
                const normalizedPath = typeof filePath === 'string' ? filePath : String(filePath);
                if (normalizedPath === '/root/src/a.ts') {
                    return "import './b';\nimport React from 'react';";
                }
                return 'export function bar() { return 1; }';
            });

            const graph = await service.getWorkspaceDependencyGraph('/root');
            const cachedGraph = await service.getWorkspaceDependencyGraph('/root');

            expect(graph.nodes).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        path: '/root/src/a.ts',
                        symbolCount: 1,
                    }),
                ])
            );
            expect(graph.edges).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        from: '/root/src/a.ts',
                        to: './b',
                        kind: 'package',
                    }),
                    expect.objectContaining({
                        from: '/root/src/a.ts',
                        to: 'react',
                        kind: 'package',
                    }),
                ])
            );
            expect(graph.externalDependencies).toEqual(['./b', 'react']);
            expect(cachedGraph).toEqual(graph);
            expect(vi.mocked(scanDirRecursively)).toHaveBeenCalledTimes(1);
        });

        it('builds a workspace code map from indexed symbols', async () => {
            mockDb.getCodeSymbolsByWorkspacePath.mockResolvedValue([
                { name: 'Foo', kind: 'class', path: '/root/src/a.ts', line: 1, signature: 'class Foo' },
                { name: 'useFoo', kind: 'function', path: '/root/src/a.ts', line: 12, signature: 'function useFoo()' },
                { name: 'Bar', kind: 'class', path: '/root/src/features/b.ts', line: 2, signature: 'class Bar' },
            ]);
            vi.mocked(scanDirRecursively).mockImplementation(async () => undefined);

            const codeMap = await service.getWorkspaceCodeMap('/root');

            expect(codeMap.totalFiles).toBe(2);
            expect(codeMap.totalSymbols).toBe(3);
            expect(codeMap.files).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        relativePath: 'src/a.ts',
                        symbolCount: 2,
                        topLevelSymbols: expect.arrayContaining([
                            expect.objectContaining({ name: 'Foo', line: 1 }),
                        ]),
                    }),
                ])
            );
            expect(codeMap.folders).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        path: 'src',
                        fileCount: 1,
                    }),
                    expect.objectContaining({
                        path: 'src/features',
                        fileCount: 1,
                    }),
                ])
            );
        });
    });

    describe('indexWorkspace', () => {
        it('should index all scanned files and cache the workspace as indexed', async () => {
            vi.mocked(scanDirRecursively).mockImplementation(async (_root: string, files: string[]) => {
                files.push('/root/a.ts', '/root/b.ts');
            });
            vi.mocked(fs.readFile).mockResolvedValue('const x = 1;');
            vi.mocked(parseFileSymbols).mockReturnValue([]);

            await service.indexWorkspace('/root', 'proj-1');

            expect(vi.mocked(scanDirRecursively)).toHaveBeenCalled();
            await service.indexWorkspace('/root', 'proj-1');
            expect(mockDb.clearCodeSymbols).not.toHaveBeenCalled();
        });

        it('should skip indexing when workspace indexing is disabled', async () => {
            mockDb.getWorkspace.mockResolvedValue({
                id: 'proj-disabled',
                path: '/root',
                advancedOptions: {
                    indexingEnabled: false,
                },
            });

            await service.indexWorkspace('/root', 'proj-disabled');

            expect(vi.mocked(scanDirRecursively)).not.toHaveBeenCalled();
            expect(mockDb.clearCodeSymbols).not.toHaveBeenCalled();
        });

        it('should skip indexing when already in progress', async () => {
            let resolveFile: (() => void) | undefined;
            const fileReadPromise = new Promise<string>(resolve => {
                resolveFile = () => resolve('code');
            });
            vi.mocked(scanDirRecursively).mockImplementation(async (_root: string, files: string[]) => {
                files.push('/root/a.ts');
            });
            vi.mocked(fs.readFile).mockReturnValue(fileReadPromise as Promise<string>);
            vi.mocked(parseFileSymbols).mockReturnValue([]);

            const promise1 = service.indexWorkspace('/root', 'proj-dup');
            // Yield to allow promise1 to start and register as in-progress
            await new Promise(r => setTimeout(r, 5));

            const promise2 = service.indexWorkspace('/root', 'proj-dup');

            resolveFile!();
            await Promise.all([promise1, promise2]);
            expect(appLogger.info).toHaveBeenCalledWith(
                'code-intelligence.service',
                expect.stringContaining('already in progress')
            );
        });

        it('should skip indexing when the workspace is already indexed (no force)', async () => {
            vi.mocked(scanDirRecursively).mockImplementation(async (_root: string, files: string[]) => {
                files.push('/root/a.ts');
            });
            vi.mocked(fs.readFile).mockResolvedValue('code');
            vi.mocked(parseFileSymbols).mockReturnValue([]);

            await service.indexWorkspace('/root', 'proj-cached');
            vi.clearAllMocks();

            await service.indexWorkspace('/root', 'proj-cached', false);
            expect(mockDb.clearCodeSymbols).not.toHaveBeenCalled();
        });

        it('should re-index when force=true even if already indexed', async () => {
            vi.mocked(scanDirRecursively).mockImplementation(async (_root: string, files: string[]) => {
                files.push('/root/a.ts');
            });
            vi.mocked(fs.readFile).mockResolvedValue('code');
            vi.mocked(parseFileSymbols).mockReturnValue([]);

            await service.indexWorkspace('/root', 'proj-force');
            vi.clearAllMocks();

            vi.mocked(scanDirRecursively).mockImplementation(async (_root: string, files: string[]) => {
                files.push('/root/a.ts');
            });
            vi.mocked(fs.readFile).mockResolvedValue('code');
            vi.mocked(parseFileSymbols).mockReturnValue([]);

            await service.indexWorkspace('/root', 'proj-force', true);
            expect(mockDb.clearCodeSymbols).toHaveBeenCalledWith('/root');
        });

        it('should skip if database already has indexed symbols (no force)', async () => {
            mockDb.hasIndexedSymbols.mockResolvedValue(true);
            await service.indexWorkspace('/root', 'proj-db-exists', false);
            expect(mockDb.clearCodeSymbols).not.toHaveBeenCalled();
        });

        it('should send progress events to browser windows', async () => {
            const mockSend = vi.fn();
            vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
                { webContents: { send: mockSend } } as never as BrowserWindow
            ]);
            vi.mocked(scanDirRecursively).mockImplementation(async (_root: string, files: string[]) => {
                files.push('/root/a.ts');
            });
            vi.mocked(fs.readFile).mockResolvedValue('const x = 1;');
            vi.mocked(parseFileSymbols).mockReturnValue([]);

            await service.indexWorkspace('/root', 'proj-progress');

            expect(mockSend).toHaveBeenCalledWith('code:indexing-progress', expect.objectContaining({
                workspaceId: 'proj-progress',
                status: 'Complete'
            }));
        });

        it('should handle indexing failure gracefully', async () => {
            vi.mocked(scanDirRecursively).mockRejectedValue(new Error('scan error'));
            const mockSend = vi.fn();
            vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
                { webContents: { send: mockSend } } as never as BrowserWindow
            ]);

            await service.indexWorkspace('/root', 'proj-fail');

            expect(appLogger.error).toHaveBeenCalledWith(
                'code-intelligence.service',
                expect.stringContaining('Indexing failed'),
                expect.any(Error)
            );
            expect(mockSend).toHaveBeenCalledWith('code:indexing-progress', expect.objectContaining({
                status: 'Failed'
            }));
        });

        it('should store symbols with embeddings during indexing', async () => {
            const symbols: CodeSymbol[] = [
                { file: '/root/a.ts', line: 5, name: 'myFunc', kind: 'function', signature: '(): void', docstring: 'Does stuff' }
            ];
            vi.mocked(scanDirRecursively).mockImplementation(async (_root: string, files: string[]) => {
                files.push('/root/a.ts');
            });
            vi.mocked(fs.readFile).mockResolvedValue('function myFunc() {}');
            vi.mocked(parseFileSymbols).mockReturnValue(symbols);

            await service.indexWorkspace('/root', 'proj-symbols');

            expect(mockEmbedding.generateEmbedding).toHaveBeenCalled();
            expect(mockDb.storeCodeSymbol).toHaveBeenCalledWith(expect.objectContaining({
                [WORKSPACE_COMPAT_SCHEMA_VALUES.PATH_COLUMN]: '/root',
                file_path: '/root/a.ts',
                name: 'myFunc',
                kind: 'function'
            }));
        });
    });

    describe('updateFileIndex', () => {
        it('should delete old data and re-index a single file', async () => {
            vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as never);
            vi.mocked(fs.readFile).mockResolvedValue('const x = 1;');
            vi.mocked(parseFileSymbols).mockReturnValue([]);

            await service.updateFileIndex('proj-1', '/root', '/root/a.ts');

            expect(mockDb.deleteCodeSymbolsForFile).toHaveBeenCalledWith('/root', '/root/a.ts');
            expect(mockDb.deleteSemanticFragmentsForFile).toHaveBeenCalledWith('/root', '/root/a.ts');
        });

        it('should chunk and index supported file types', async () => {
            vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as never);
            vi.mocked(fs.readFile).mockResolvedValue('line '.repeat(300));
            vi.mocked(parseFileSymbols).mockReturnValue([]);

            await service.updateFileIndex('proj-1', '/root', '/root/readme.md');

            expect(mockDb.storeSemanticFragment).toHaveBeenCalled();
        });

        it('should not chunk unsupported file extensions', async () => {
            vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as never);
            vi.mocked(fs.readFile).mockResolvedValue('binary data');
            vi.mocked(parseFileSymbols).mockReturnValue([]);

            await service.updateFileIndex('proj-1', '/root', '/root/image.png');

            expect(fs.readFile).not.toHaveBeenCalled();
            expect(mockDb.storeSemanticFragment).not.toHaveBeenCalled();
        });

        it('skips ignored file paths after clearing stale index data', async () => {
            vi.mocked(getWorkspaceIgnoreMatcher).mockResolvedValue({
                rootPath: '/root',
                patterns: ['generated/'],
                ignoresAbsolute: (candidatePath: string) => candidatePath.includes('/generated/'),
                ignoresRelative: (candidatePath: string) => candidatePath.includes('generated/'),
            });

            await service.updateFileIndex('proj-1', '/root', '/root/generated/file.ts');

            expect(mockDb.deleteCodeSymbolsForFile).toHaveBeenCalledWith('/root', '/root/generated/file.ts');
            expect(mockDb.deleteSemanticFragmentsForFile).toHaveBeenCalledWith('/root', '/root/generated/file.ts');
            expect(fs.readFile).not.toHaveBeenCalledWith('/root/generated/file.ts', 'utf-8');
        });

        it('should handle read errors gracefully', async () => {
            vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as never);
            vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
            await service.updateFileIndex('proj-1', '/root', '/root/missing.ts');
            expect(appLogger.error).toHaveBeenCalled();
        });

        it('skips deleted or non-file targets after clearing stale index data', async () => {
            vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));

            await service.updateFileIndex('proj-1', '/root', '/root/deleted.ts');

            expect(mockDb.deleteCodeSymbolsForFile).toHaveBeenCalledWith('/root', '/root/deleted.ts');
            expect(mockDb.deleteSemanticFragmentsForFile).toHaveBeenCalledWith('/root', '/root/deleted.ts');
            expect(fs.readFile).not.toHaveBeenCalled();
        });
    });

    describe('findSymbols', () => {
        it('should delegate to symbol-navigation util', async () => {
            vi.mocked(findSymbols).mockResolvedValue([
                { file: '/src/a.ts', line: 1, text: 'MyClass' }
            ]);
            const results = await service.findSymbols('/root', 'MyClass');
            expect(findSymbols).toHaveBeenCalledWith(mockDb, '/root', 'MyClass');
            expect(results).toHaveLength(1);
        });
    });

    describe('searchFiles', () => {
        it('should delegate to searchFiles util', async () => {
            vi.mocked(searchFiles).mockResolvedValue([]);
            const results = await service.searchFiles('/root', 'query', 'proj-1', false);
            expect(searchFiles).toHaveBeenCalledWith(mockDb, '/root', 'query', 'proj-1', false);
            expect(results).toEqual([]);
        });
    });

    describe('scanTodos', () => {
        it('should return todos from file scanner', async () => {
            vi.mocked(scanDirForTodos).mockImplementation(async (_root: string, todos: TestValue[]) => {
                (todos as Array<{ file: string; line: number; text: string }>).push(
                    { file: '/root/a.ts', line: 10, text: 'TODO: fix this' }
                );
            });
            const results = await service.scanTodos('/root');
            expect(results).toHaveLength(1);
            expect(results[0].text).toBe('TODO: fix this');
        });
    });

    describe('scanWorkspaceTodos', () => {
        it('should group todos by file with relative paths', async () => {
            vi.mocked(scanDirForTodos).mockImplementation(async (_root: string, todos: TestValue[]) => {
                const arr = todos as Array<{ file: string; line: number; text: string }>;
                arr.push(
                    { file: '/root/src/a.ts', line: 5, text: 'TODO: first' },
                    { file: '/root/src/a.ts', line: 12, text: 'TODO: second' },
                    { file: '/root/src/b.ts', line: 1, text: 'FIXME: bug' }
                );
            });

            const results = await service.scanWorkspaceTodos('/root');

            expect(results).toHaveLength(2);
            const fileA = results.find(r => r.path === '/root/src/a.ts');
            expect(fileA).toBeDefined();
            expect(fileA!.items).toHaveLength(2);
            expect(fileA!.relativePath).toBe('src/a.ts');
        });
    });

    describe('getFileOutline', () => {
        it('should delegate to documentation-generator util', async () => {
            vi.mocked(getFileOutline).mockResolvedValue([
                { file: '/src/a.ts', line: 1, text: 'class Foo' }
            ]);
            const results = await service.getFileOutline('/src/a.ts');
            expect(getFileOutline).toHaveBeenCalledWith('/src/a.ts');
            expect(results).toHaveLength(1);
        });
    });

    describe('findDefinition', () => {
        it('should return definition location when found', async () => {
            vi.mocked(findDefinition).mockResolvedValue({
                file: '/src/a.ts', line: 5, text: 'class MyClass'
            });
            const result = await service.findDefinition('/root', 'MyClass');
            expect(findDefinition).toHaveBeenCalledWith(mockDb, '/root', 'MyClass');
            expect(result).toEqual(expect.objectContaining({ file: '/src/a.ts', line: 5 }));
        });

        it('should return null when symbol not found', async () => {
            vi.mocked(findDefinition).mockResolvedValue(null);
            const result = await service.findDefinition('/root', 'Unknown');
            expect(result).toBeNull();
        });
    });

    describe('findUsage / findReferences', () => {
        it('should return usage locations', async () => {
            vi.mocked(findUsage).mockResolvedValue([
                { file: '/src/b.ts', line: 20, text: 'new MyClass()' }
            ]);
            const results = await service.findUsage('/root', 'MyClass');
            expect(findUsage).toHaveBeenCalledWith('/root', 'MyClass');
            expect(results).toHaveLength(1);
        });

        it('findReferences should delegate to findUsage', async () => {
            vi.mocked(findUsage).mockResolvedValue([
                { file: '/src/c.ts', line: 3, text: 'ref' }
            ]);
            const results = await service.findReferences('/root', 'Symbol');
            expect(findUsage).toHaveBeenCalledWith('/root', 'Symbol');
            expect(results).toHaveLength(1);
        });
    });

    describe('findImplementations', () => {
        it('should delegate to findImplementations util', async () => {
            vi.mocked(findImplementations).mockResolvedValue([]);
            const results = await service.findImplementations('/root', 'IMyInterface');
            expect(findImplementations).toHaveBeenCalledWith('/root', 'IMyInterface');
            expect(results).toEqual([]);
        });
    });

    describe('getSymbolRelationships', () => {
        it('should pass maxItems to the util', async () => {
            vi.mocked(getSymbolRelationships).mockResolvedValue([]);
            await service.getSymbolRelationships('/root', 'MyClass', 50);
            expect(getSymbolRelationships).toHaveBeenCalledWith(mockDb, '/root', 'MyClass', 50);
        });

        it('should default maxItems to 200', async () => {
            vi.mocked(getSymbolRelationships).mockResolvedValue([]);
            await service.getSymbolRelationships('/root', 'MyClass');
            expect(getSymbolRelationships).toHaveBeenCalledWith(mockDb, '/root', 'MyClass', 200);
        });
    });

    describe('renameSymbol', () => {
        it('should delegate to rename-symbol util', async () => {
            vi.mocked(renameSymbol).mockResolvedValue({
                success: true, applied: false, symbol: 'old', newSymbol: 'renamed',
                totalFiles: 2, totalOccurrences: 5, changes: [], updatedFiles: [], errors: []
            });
            const result = await service.renameSymbol('/root', 'old', 'renamed', false, 100);
            expect(renameSymbol).toHaveBeenCalledWith('/root', 'old', 'renamed', false, 100);
            expect(result.success).toBe(true);
            expect(result.totalOccurrences).toBe(5);
        });
    });

    describe('generateFileDocumentation', () => {
        it('should delegate to documentation-generator util', async () => {
            const result = await service.generateFileDocumentation('/src/a.ts', 'markdown');
            expect(generateFileDocumentation).toHaveBeenCalledWith('/src/a.ts', 'markdown');
            expect(result.success).toBe(true);
        });

        it('should default to markdown format', async () => {
            await service.generateFileDocumentation('/src/a.ts');
            expect(generateFileDocumentation).toHaveBeenCalledWith('/src/a.ts', 'markdown');
        });
    });

    describe('generateWorkspaceDocumentation', () => {
        it('should delegate to documentation-generator util', async () => {
            const result = await service.generateWorkspaceDocumentation('/root', 20);
            expect(generateWorkspaceDocumentation).toHaveBeenCalledWith('/root', 20);
            expect(result.success).toBe(true);
        });

        it('should default maxFiles to 30', async () => {
            await service.generateWorkspaceDocumentation('/root');
            expect(generateWorkspaceDocumentation).toHaveBeenCalledWith('/root', 30);
        });
    });

    describe('analyzeCodeQuality', () => {
        it('should delegate to code-quality-scanner util', async () => {
            const result = await service.analyzeCodeQuality('/root', 150);
            expect(analyzeCodeQuality).toHaveBeenCalledWith('/root', 150);
            expect(result.qualityScore).toBe(85);
        });

        it('should default maxFiles to 300', async () => {
            await service.analyzeCodeQuality('/root');
            expect(analyzeCodeQuality).toHaveBeenCalledWith('/root', 300);
        });
    });
});
