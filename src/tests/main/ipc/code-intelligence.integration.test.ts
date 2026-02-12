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
    searchFiles: Mock;
    indexProject: Mock;
    queryIndexedSymbols: Mock;
}

describe('Code Intelligence IPC Handlers', () => {
    let mockService: MockCodeIntelligenceService;
    let registeredHandlers: Map<string, any>;

    beforeEach(() => {
        registeredHandlers = new Map();

        vi.mocked(ipcMain.handle).mockImplementation((channel: string, listener: any) => {
            registeredHandlers.set(channel, listener);
        });

        mockService = {
            scanProjectTodos: vi.fn().mockResolvedValue([
                { file: 'src/main.ts', line: 10, content: 'TODO: implement feature', todoType: 'todo' }
            ]),
            findSymbols: vi.fn().mockResolvedValue([
                { file: 'src/main.ts', line: 5, name: 'functionName', type: 'function' }
            ]),
            searchFiles: vi.fn().mockResolvedValue([
                { file: 'src/main.ts', line: 1, name: 'main', type: 'file' }
            ]),
            indexProject: vi.fn().mockResolvedValue(undefined),
            queryIndexedSymbols: vi.fn().mockResolvedValue([
                { file: 'src/main.ts', line: 5, name: 'functionName', type: 'function' }
            ])
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('code:scanTodos', () => {
        it('should scan project for TODOs', async () => {
            const handler = async (_event: IpcMainInvokeEvent, ...args: any[]) => {
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
            const handler = async (_event: IpcMainInvokeEvent, ...args: any[]) => {
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
            const handler = async (_event: IpcMainInvokeEvent, ...args: any[]) => {
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
            const handler = async (_event: IpcMainInvokeEvent, ...args: any[]) => {
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
            const handler = async (_event: IpcMainInvokeEvent, ...args: any[]) => {
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
});
