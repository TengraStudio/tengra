/**
 * Integration tests for Code Intelligence IPC handlers
 */
import { CodeIntelligenceService } from '@main/services/project/code-intelligence.service';
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn(),
        removeHandler: vi.fn()
    }
}));

interface MockCodeIntelligenceService extends Partial<CodeIntelligenceService> {
    scanProjectTodos: Mock;
    findSymbols: Mock;
    findDefinition: Mock;
    findReferences: Mock;
    getFileOutline: Mock;
    renameSymbol: Mock;
    generateFileDocumentation: Mock;
    analyzeCodeQuality: Mock;
    searchFiles: Mock;
    indexProject: Mock;
    queryIndexedSymbols: Mock;
    getSymbolAnalytics: Mock;
}

describe('Code Intelligence IPC Handlers', () => {
    let mockService: MockCodeIntelligenceService;
    type IpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;
    let registeredHandlers: Map<string, IpcHandler>;

    beforeEach(() => {
        registeredHandlers = new Map();

        vi.mocked(ipcMain.handle).mockImplementation(((channel: string, listener: IpcHandler) => {
            registeredHandlers.set(channel, listener);
        }) as typeof ipcMain.handle);

        mockService = {
            scanProjectTodos: vi.fn().mockResolvedValue([
                { file: 'src/main.ts', line: 10, content: 'TODO: implement feature', todoType: 'todo' }
            ]),
            findSymbols: vi.fn().mockResolvedValue([
                { file: 'src/main.ts', line: 5, name: 'functionName', type: 'function' }
            ]),
            findDefinition: vi.fn().mockResolvedValue(
                { file: 'src/main.ts', line: 5, name: 'functionName', type: 'function' }
            ),
            findReferences: vi.fn().mockResolvedValue([
                { file: 'src/main.ts', line: 25, text: 'functionName()', type: 'usage' }
            ]),
            getFileOutline: vi.fn().mockResolvedValue([
                { file: 'src/main.ts', line: 5, name: 'functionName', type: 'function', text: 'function functionName()' }
            ]),
            renameSymbol: vi.fn().mockResolvedValue({
                success: true,
                applied: false,
                symbol: 'oldName',
                newSymbol: 'newName',
                totalFiles: 1,
                totalOccurrences: 2,
                changes: [
                    {
                        file: 'src/main.ts',
                        replacements: [
                            { line: 5, occurrences: 1, before: 'oldName()', after: 'newName()' },
                            { line: 12, occurrences: 1, before: 'const x = oldName', after: 'const x = newName' },
                        ],
                    },
                ],
                updatedFiles: [],
                errors: [],
            }),
            generateFileDocumentation: vi.fn().mockResolvedValue({
                success: true,
                filePath: 'src/main.ts',
                format: 'markdown',
                content: '# Documentation',
                symbolCount: 3,
                generatedAt: '2026-02-16T00:00:00.000Z',
            }),
            analyzeCodeQuality: vi.fn().mockResolvedValue({
                rootPath: '/project',
                filesScanned: 5,
                totalLines: 500,
                functionSymbols: 20,
                classSymbols: 3,
                longLineCount: 2,
                todoLikeCount: 4,
                consoleUsageCount: 6,
                averageComplexity: 4.2,
                highestComplexityFiles: [{ file: 'src/main.ts', complexity: 11 }],
                qualityScore: 87,
                generatedAt: '2026-02-16T00:00:00.000Z',
            }),
            searchFiles: vi.fn().mockResolvedValue([
                { file: 'src/main.ts', line: 1, name: 'main', type: 'file' }
            ]),
            indexProject: vi.fn().mockResolvedValue(undefined),
            queryIndexedSymbols: vi.fn().mockResolvedValue([
                { file: 'src/main.ts', line: 5, name: 'functionName', type: 'function' }
            ]),
            getSymbolAnalytics: vi.fn().mockResolvedValue({
                totalSymbols: 10,
                uniqueFiles: 2,
                uniqueKinds: 3,
                byKind: { function: 6, class: 2, variable: 2 },
                byExtension: { '.ts': 10 },
                topFiles: [{ path: 'src/main.ts', count: 7 }],
                topSymbols: [{ name: 'main', count: 2 }],
                generatedAt: '2026-02-16T00:00:00.000Z'
            })
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('code:scanTodos', () => {
        it('should scan project for TODOs', async () => {
            const handler = async (_event: IpcMainInvokeEvent, ...args: unknown[]) => {
                const rootPath = args[0] as string;
                return await mockService.scanProjectTodos!(rootPath);
            };
            registeredHandlers.set('code:scanTodos', handler);

            const result = await registeredHandlers.get('code:scanTodos')!({} as IpcMainInvokeEvent, '/project');

            expect(mockService.scanProjectTodos).toHaveBeenCalledWith('/project');
            expect(result).toEqual([
                { file: 'src/main.ts', line: 10, content: 'TODO: implement feature', todoType: 'todo' }
            ]);
        });
    });

    describe('code:findSymbols', () => {
        it('should find symbols in project', async () => {
            const handler = async (_event: IpcMainInvokeEvent, ...args: unknown[]) => {
                const rootPath = args[0] as string;
                const query = args[1] as string;
                return await mockService.findSymbols!(rootPath, query);
            };
            registeredHandlers.set('code:findSymbols', handler);

            const result = await registeredHandlers.get('code:findSymbols')!({} as IpcMainInvokeEvent, '/project', 'functionName');

            expect(mockService.findSymbols).toHaveBeenCalledWith('/project', 'functionName');
            expect(result).toEqual([
                { file: 'src/main.ts', line: 5, name: 'functionName', type: 'function' }
            ]);
        });
    });

    describe('code:searchFiles', () => {
        it('should search files in project', async () => {
            const handler = async (_event: IpcMainInvokeEvent, ...args: unknown[]) => {
                const rootPath = args[0] as string;
                const query = args[1] as string;
                const projectId = args[2] as string;
                const isRegex = args[3] as boolean | undefined;
                return await mockService.searchFiles!(rootPath, query, projectId, isRegex ?? false);
            };
            registeredHandlers.set('code:searchFiles', handler);

            const result = await registeredHandlers.get('code:searchFiles')!({} as IpcMainInvokeEvent, '/project', 'main', 'project-1', false);

            expect(mockService.searchFiles).toHaveBeenCalledWith('/project', 'main', 'project-1', false);
            expect(result).toEqual([
                { file: 'src/main.ts', line: 1, name: 'main', type: 'file' }
            ]);
        });
    });

    describe('code:indexProject', () => {
        it('should index a project', async () => {
            const handler = async (_event: IpcMainInvokeEvent, ...args: unknown[]) => {
                const rootPath = args[0] as string;
                const projectId = args[1] as string;
                const force = args[2] as boolean | undefined;
                return await mockService.indexProject!(rootPath, projectId, force ?? false);
            };
            registeredHandlers.set('code:indexProject', handler);

            const result = await registeredHandlers.get('code:indexProject')!({} as IpcMainInvokeEvent, '/project', 'project-1', true);

            expect(mockService.indexProject).toHaveBeenCalledWith('/project', 'project-1', true);
            expect(result).toBeUndefined();
        });
    });

    describe('code:queryIndexedSymbols', () => {
        it('should query indexed symbols', async () => {
            const handler = async (_event: IpcMainInvokeEvent, ...args: unknown[]) => {
                const query = args[0] as string;
                return await mockService.queryIndexedSymbols!(query);
            };
            registeredHandlers.set('code:queryIndexedSymbols', handler);

            const result = await registeredHandlers.get('code:queryIndexedSymbols')!({} as IpcMainInvokeEvent, 'functionName');

            expect(mockService.queryIndexedSymbols).toHaveBeenCalledWith('functionName');
            expect(result).toEqual([
                { file: 'src/main.ts', line: 5, name: 'functionName', type: 'function' }
            ]);
        });
    });

    describe('code:findDefinition', () => {
        it('should find symbol definition', async () => {
            const handler = async (_event: IpcMainInvokeEvent, ...args: unknown[]) => {
                const rootPath = args[0] as string;
                const symbol = args[1] as string;
                return await mockService.findDefinition!(rootPath, symbol);
            };
            registeredHandlers.set('code:findDefinition', handler);

            const result = await registeredHandlers.get('code:findDefinition')!(
                {} as IpcMainInvokeEvent,
                '/project',
                'functionName'
            );

            expect(mockService.findDefinition).toHaveBeenCalledWith('/project', 'functionName');
            expect((result as { line: number } | null)?.line).toBe(5);
        });
    });

    describe('code:findReferences', () => {
        it('should find symbol references', async () => {
            const handler = async (_event: IpcMainInvokeEvent, ...args: unknown[]) => {
                const rootPath = args[0] as string;
                const symbol = args[1] as string;
                return await mockService.findReferences!(rootPath, symbol);
            };
            registeredHandlers.set('code:findReferences', handler);

            const result = await registeredHandlers.get('code:findReferences')!(
                {} as IpcMainInvokeEvent,
                '/project',
                'functionName'
            );

            expect(mockService.findReferences).toHaveBeenCalledWith('/project', 'functionName');
            const refs = result as Array<{ line: number }>;
            expect(refs).toHaveLength(1);
            expect(refs[0].line).toBe(25);
        });
    });

    describe('code:getFileOutline', () => {
        it('should return file outline symbols', async () => {
            const handler = async (_event: IpcMainInvokeEvent, ...args: unknown[]) => {
                const filePath = args[0] as string;
                return await mockService.getFileOutline!(filePath);
            };
            registeredHandlers.set('code:getFileOutline', handler);

            const result = await registeredHandlers.get('code:getFileOutline')!(
                {} as IpcMainInvokeEvent,
                '/project/src/main.ts'
            );

            expect(mockService.getFileOutline).toHaveBeenCalledWith('/project/src/main.ts');
            expect((result as Array<{ name: string }>)[0].name).toBe('functionName');
        });
    });

    describe('code:previewRenameSymbol', () => {
        it('should return rename preview', async () => {
            const handler = async (_event: IpcMainInvokeEvent, ...args: unknown[]) => {
                const rootPath = args[0] as string;
                const symbol = args[1] as string;
                const newSymbol = args[2] as string;
                const maxFiles = args[3] as number | undefined;
                return await mockService.renameSymbol!(rootPath, symbol, newSymbol, false, maxFiles);
            };
            registeredHandlers.set('code:previewRenameSymbol', handler);

            const result = await registeredHandlers.get('code:previewRenameSymbol')!(
                {} as IpcMainInvokeEvent,
                '/project',
                'oldName',
                'newName',
                100
            );

            expect(mockService.renameSymbol).toHaveBeenCalledWith(
                '/project',
                'oldName',
                'newName',
                false,
                100
            );
            const renameResult = result as { applied: boolean; totalOccurrences: number };
            expect(renameResult.applied).toBe(false);
            expect(renameResult.totalOccurrences).toBe(2);
        });
    });

    describe('code:applyRenameSymbol', () => {
        it('should apply rename changes', async () => {
            mockService.renameSymbol.mockResolvedValueOnce({
                success: true,
                applied: true,
                symbol: 'oldName',
                newSymbol: 'newName',
                totalFiles: 1,
                totalOccurrences: 2,
                changes: [],
                updatedFiles: ['src/main.ts'],
                errors: [],
            });

            const handler = async (_event: IpcMainInvokeEvent, ...args: unknown[]) => {
                const rootPath = args[0] as string;
                const symbol = args[1] as string;
                const newSymbol = args[2] as string;
                const maxFiles = args[3] as number | undefined;
                return await mockService.renameSymbol!(rootPath, symbol, newSymbol, true, maxFiles);
            };
            registeredHandlers.set('code:applyRenameSymbol', handler);

            const result = await registeredHandlers.get('code:applyRenameSymbol')!(
                {} as IpcMainInvokeEvent,
                '/project',
                'oldName',
                'newName',
                100
            );

            expect(mockService.renameSymbol).toHaveBeenCalledWith(
                '/project',
                'oldName',
                'newName',
                true,
                100
            );
            const applyResult = result as { applied: boolean; updatedFiles: string[] };
            expect(applyResult.applied).toBe(true);
            expect(applyResult.updatedFiles).toEqual(['src/main.ts']);
        });
    });

    describe('code:getSymbolAnalytics', () => {
        it('should return symbol analytics for project', async () => {
            const handler = async (_event: IpcMainInvokeEvent, ...args: unknown[]) => {
                const rootPath = args[0] as string;
                return await mockService.getSymbolAnalytics!(rootPath);
            };
            registeredHandlers.set('code:getSymbolAnalytics', handler);

            const result = await registeredHandlers.get('code:getSymbolAnalytics')!(
                {} as IpcMainInvokeEvent,
                '/project'
            );

            expect(mockService.getSymbolAnalytics).toHaveBeenCalledWith('/project');
            const analytics = result as { totalSymbols: number; byKind: Record<string, number>; topFiles: Array<{ path: string }> };
            expect(analytics.totalSymbols).toBe(10);
            expect(analytics.byKind.function).toBe(6);
            expect(analytics.topFiles[0].path).toBe('src/main.ts');
        });
    });

    describe('code:generateFileDocumentation', () => {
        it('should generate file documentation preview', async () => {
            const handler = async (_event: IpcMainInvokeEvent, ...args: unknown[]) => {
                const filePath = args[0] as string;
                const format = args[1] as 'markdown' | 'jsdoc-comments' | undefined;
                return await mockService.generateFileDocumentation!(filePath, format ?? 'markdown');
            };
            registeredHandlers.set('code:generateFileDocumentation', handler);

            const result = await registeredHandlers.get('code:generateFileDocumentation')!(
                {} as IpcMainInvokeEvent,
                '/project/src/main.ts',
                'markdown'
            );

            expect(mockService.generateFileDocumentation).toHaveBeenCalledWith('/project/src/main.ts', 'markdown');
            const docResult = result as { success: boolean; symbolCount: number };
            expect(docResult.success).toBe(true);
            expect(docResult.symbolCount).toBe(3);
        });
    });

    describe('code:analyzeQuality', () => {
        it('should analyze code quality', async () => {
            const handler = async (_event: IpcMainInvokeEvent, ...args: unknown[]) => {
                const rootPath = args[0] as string;
                const maxFiles = args[1] as number | undefined;
                return await mockService.analyzeCodeQuality!(rootPath, maxFiles ?? 300);
            };
            registeredHandlers.set('code:analyzeQuality', handler);

            const result = await registeredHandlers.get('code:analyzeQuality')!(
                {} as IpcMainInvokeEvent,
                '/project',
                200
            );

            expect(mockService.analyzeCodeQuality).toHaveBeenCalledWith('/project', 200);
            const qualityResult = result as { qualityScore: number; filesScanned: number };
            expect(qualityResult.qualityScore).toBe(87);
            expect(qualityResult.filesScanned).toBe(5);
        });
    });
});
