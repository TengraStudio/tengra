/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { registerWorkspaceIpc } from '@main/ipc/workspace';
import { AuditLogService } from '@main/services/analysis/audit-log.service';
import { DatabaseService } from '@main/services/data/database.service';
import { LogoService } from '@main/services/external/logo.service';
import { InlineSuggestionService } from '@main/services/llm/inline-suggestion.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { CodeIntelligenceService } from '@main/services/workspace/code-intelligence.service';
import { WorkspaceService } from '@main/services/workspace/workspace.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Electron ipcMain
const ipcMainHandlers = new Map<string, (...args: any[]) => Promise<any>>();
const showOpenDialogMock = vi.fn();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel, handler) => {
            ipcMainHandlers.set(channel, async (...args: any[]) => Promise.resolve(handler(...args)));
        }),
        removeHandler: vi.fn()
    },
    dialog: {
        showOpenDialog: (...args: never[]) => showOpenDialogMock(...args),
    },
}));

// Mock Services
let mockWorkspaceService: WorkspaceService;
let mockLogoService: LogoService;
let mockInlineSuggestionService: InlineSuggestionService;
let mockCodeIntelligenceService: CodeIntelligenceService;
let mockAuditLogService: AuditLogService;
let mockJobSchedulerService: JobSchedulerService;
let mockDatabaseService: DatabaseService;
let scheduledTasks: Map<string, () => Promise<void>>;

function createWorkspaceAnalysisResult() {
    return {
        type: 'typescript',
        frameworks: ['vite'],
        dependencies: {
            react: '^18.2.0',
        },
        devDependencies: {
            vitest: '^4.0.0',
        },
        stats: {
            fileCount: 3,
            totalSize: 1024,
            loc: 120,
            lastModified: 1_700_000_000_000,
        },
        languages: {
            TypeScript: 120,
        },
        files: ['src/index.ts'],
        todos: [],
        issues: [],
        annotations: [
            {
                file: 'src/index.ts',
                line: 2,
                message: '// TODO: tighten validation',
                type: 'todo',
            },
        ],
        lspDiagnostics: [
            {
                severity: 'error',
                message: 'Type error',
                file: 'src/index.ts',
                line: 3,
                source: 'typescript',
            },
        ],
        lspServers: [
            {
                languageId: 'typescript',
                serverId: 'typescript-language-server',
                status: 'running',
                bundled: true,
                fileCount: 1,
            },
        ],
    };
}

describe('Workspace IPC Integration', () => {
    const mockEvent = { sender: { id: 1 } } as never;

    beforeEach(() => {
        ipcMainHandlers.clear();
        vi.clearAllMocks();
        scheduledTasks = new Map<string, () => Promise<void>>();
        showOpenDialogMock.mockReset();
        showOpenDialogMock.mockResolvedValue({
            canceled: false,
            filePaths: ['C:\\workspace\\logo.png'],
        });

        mockWorkspaceService = {
            analyzeWorkspace: vi.fn(),
            analyzeWorkspaceSummary: vi.fn(),
            getFileDiagnostics: vi.fn(),
            getFileDefinition: vi.fn(),
            analyzeDirectory: vi.fn(),
            watchWorkspace: vi.fn(),
            stopWatch: vi.fn(),
            setActiveWorkspace: vi.fn(),
            clearActiveWorkspace: vi.fn(),
            getActiveWorkspace: vi.fn(),
            saveEnvVars: vi.fn(),
            getAuditContext: vi.fn((rootPath: string) => ({ rootPath, workspaceName: 'workspace' }))
        } as never as WorkspaceService;

        mockLogoService = {
            generateLogo: vi.fn(),
            analyzeWorkspaceIdentity: vi.fn(),
            applyLogo: vi.fn(),
            improveLogoPrompt: vi.fn()
        } as never as LogoService;

        mockInlineSuggestionService = {
            getCompletion: vi.fn(),
            getInlineSuggestion: vi.fn(),
            trackTelemetry: vi.fn(),
        } as never as InlineSuggestionService;

        mockCodeIntelligenceService = {
            indexWorkspace: vi.fn().mockResolvedValue(undefined),
            updateFileIndex: vi.fn().mockResolvedValue(undefined),
        } as never as CodeIntelligenceService;

        mockAuditLogService = {
            logFileSystemOperation: vi.fn().mockResolvedValue(undefined)
        } as never as AuditLogService;

        mockJobSchedulerService = {
            schedule: vi.fn((key: string, task: () => Promise<void>) => {
                scheduledTasks.set(key, task);
            }),
        } as never as JobSchedulerService;

        mockDatabaseService = {
            getWorkspaces: vi.fn().mockResolvedValue([]),
        } as never as DatabaseService;
    });

    it('should register workspace handlers', () => {
        registerWorkspaceIpc(() => null, {
            workspaceService: mockWorkspaceService,
            logoService: mockLogoService,
            inlineSuggestionService: mockInlineSuggestionService,
            codeIntelligenceService: mockCodeIntelligenceService,
            jobSchedulerService: mockJobSchedulerService,
            databaseService: mockDatabaseService,
            auditLogService: mockAuditLogService
        }, new Set<string>());
        expect(ipcMainHandlers.has('workspace:analyze')).toBe(true);
        expect(ipcMainHandlers.has('workspace:analyzeSummary')).toBe(true);
        expect(ipcMainHandlers.has('workspace:getFileDiagnostics')).toBe(true);
        expect(ipcMainHandlers.has('workspace:getFileDefinition')).toBe(true);
        expect(ipcMainHandlers.has('workspace:generateLogo')).toBe(true);
        expect(ipcMainHandlers.has('workspace:analyzeIdentity')).toBe(true);
    });

    it('should handle workspace:analyze successfully', async () => {
        const analyzeWorkspaceMock = vi.fn();
        mockWorkspaceService.analyzeWorkspace = analyzeWorkspaceMock;

        registerWorkspaceIpc(() => null, {
            workspaceService: mockWorkspaceService,
            logoService: mockLogoService,
            inlineSuggestionService: mockInlineSuggestionService,
            codeIntelligenceService: mockCodeIntelligenceService,
            jobSchedulerService: mockJobSchedulerService,
            databaseService: mockDatabaseService,
            auditLogService: mockAuditLogService
        }, new Set<string>());
        const handler = ipcMainHandlers.get('workspace:analyze');

        const mockResult = createWorkspaceAnalysisResult();
        analyzeWorkspaceMock.mockResolvedValue(mockResult);

        const result = await handler!(mockEvent, '/root', 'proj-1');

        expect(analyzeWorkspaceMock).toHaveBeenCalledWith('/root');
        expect(result).toMatchObject({
            success: true,
            data: mockResult
        });
    });

    it('should handle workspace:analyzeSummary successfully', async () => {
        const analyzeWorkspaceSummaryMock = vi.fn();
        mockWorkspaceService.analyzeWorkspaceSummary = analyzeWorkspaceSummaryMock;

        registerWorkspaceIpc(() => null, {
            workspaceService: mockWorkspaceService,
            logoService: mockLogoService,
            inlineSuggestionService: mockInlineSuggestionService,
            codeIntelligenceService: mockCodeIntelligenceService,
            jobSchedulerService: mockJobSchedulerService,
            databaseService: mockDatabaseService,
            auditLogService: mockAuditLogService
        }, new Set<string>());
        const handler = ipcMainHandlers.get('workspace:analyzeSummary');

        const mockResult = createWorkspaceAnalysisResult();
        analyzeWorkspaceSummaryMock.mockResolvedValue(mockResult);

        const result = await handler!(mockEvent, '/root', 'proj-1');

        expect(analyzeWorkspaceSummaryMock).toHaveBeenCalledWith('/root');
        expect(result).toMatchObject({
            success: true,
            data: mockResult
        });
    });

    it('should handle workspace:getFileDiagnostics successfully', async () => {
        const getFileDiagnosticsMock = vi.fn();
        mockWorkspaceService.getFileDiagnostics = getFileDiagnosticsMock;

        registerWorkspaceIpc(() => null, {
            workspaceService: mockWorkspaceService,
            logoService: mockLogoService,
            inlineSuggestionService: mockInlineSuggestionService,
            codeIntelligenceService: mockCodeIntelligenceService,
            jobSchedulerService: mockJobSchedulerService,
            databaseService: mockDatabaseService,
            auditLogService: mockAuditLogService
        }, new Set<string>());
        const handler = ipcMainHandlers.get('workspace:getFileDiagnostics');

        const diagnostics = [
            {
                severity: 'error',
                message: 'Type mismatch',
                file: 'src/index.tsx',
                line: 5,
                column: 7,
                source: 'typescript',
                code: 2322,
            },
        ];
        getFileDiagnosticsMock.mockResolvedValue(diagnostics);

        const result = await handler!(mockEvent, '/root', '/root/src/index.tsx', 'export const value: string = 1;');

        expect(getFileDiagnosticsMock).toHaveBeenCalledWith(
            '/root',
            '/root/src/index.tsx',
            'export const value: string = 1;'
        );
        expect(result).toMatchObject({
            success: true,
            data: diagnostics,
        });
    });

    it('should handle workspace:getFileDefinition successfully', async () => {
        const getFileDefinitionMock = vi.fn();
        mockWorkspaceService.getFileDefinition = getFileDefinitionMock;

        registerWorkspaceIpc(() => null, {
            workspaceService: mockWorkspaceService,
            logoService: mockLogoService,
            inlineSuggestionService: mockInlineSuggestionService,
            codeIntelligenceService: mockCodeIntelligenceService,
            jobSchedulerService: mockJobSchedulerService,
            databaseService: mockDatabaseService,
            auditLogService: mockAuditLogService
        }, new Set<string>());
        const handler = ipcMainHandlers.get('workspace:getFileDefinition');

        const locations = [
            {
                file: '/root/src/popover.tsx',
                line: 3,
                column: 1,
            },
        ];
        getFileDefinitionMock.mockResolvedValue(locations);

        const result = await handler!(
            mockEvent,
            '/root',
            '/root/src/index.tsx',
            'import { Popover } from "@/components/ui/popover";',
            { line: 1, column: 26 }
        );

        expect(getFileDefinitionMock).toHaveBeenCalledWith(
            '/root',
            '/root/src/index.tsx',
            'import { Popover } from "@/components/ui/popover";',
            1,
            26
        );
        expect(result).toMatchObject({
            success: true,
            data: locations,
        });
    });

    it('should handle workspace:generateLogo', async () => {
        const generateLogoMock = vi.fn();
        mockLogoService.generateLogo = generateLogoMock;

        registerWorkspaceIpc(() => null, {
            workspaceService: mockWorkspaceService,
            logoService: mockLogoService,
            inlineSuggestionService: mockInlineSuggestionService,
            codeIntelligenceService: mockCodeIntelligenceService,
            jobSchedulerService: mockJobSchedulerService,
            databaseService: mockDatabaseService,
            auditLogService: mockAuditLogService
        }, new Set<string>());
        const handler = ipcMainHandlers.get('workspace:generateLogo');

        generateLogoMock.mockResolvedValue('/path/to/logo.png');

        const result = await handler!(mockEvent, '/root', { prompt: 'prompt', style: 'style', model: 'dall-e-3', count: 1 });

        expect(generateLogoMock).toHaveBeenCalledWith('/root', 'prompt', 'style', 'dall-e-3', 1);
        expect(result).toMatchObject({
            success: true,
            data: '/path/to/logo.png'
        });
    });
    
    it('should reject workspace:uploadLogo for unsupported file extension', async () => {
        showOpenDialogMock.mockResolvedValue({
            canceled: false,
            filePaths: ['C:\\workspace\\logo.txt'],
        });

        registerWorkspaceIpc(() => null, {
            workspaceService: mockWorkspaceService,
            logoService: mockLogoService,
            inlineSuggestionService: mockInlineSuggestionService,
            codeIntelligenceService: mockCodeIntelligenceService,
            jobSchedulerService: mockJobSchedulerService,
            databaseService: mockDatabaseService,
            auditLogService: mockAuditLogService
        }, new Set<string>());
        const handler = ipcMainHandlers.get('workspace:uploadLogo');

        const result = await handler!(mockEvent, 'C:\\workspace');
        expect(result).toEqual({
            success: false,
            error: {
                message: 'Invalid logo file type selected',
                code: 'IPC_HANDLER_ERROR'
            }
        });
    });

    it('should handle errors in workspace operations', async () => {
        const analyzeWorkspaceMock = vi.fn();
        mockWorkspaceService.analyzeWorkspace = analyzeWorkspaceMock;

        registerWorkspaceIpc(() => null, {
            workspaceService: mockWorkspaceService,
            logoService: mockLogoService,
            inlineSuggestionService: mockInlineSuggestionService,
            codeIntelligenceService: mockCodeIntelligenceService,
            jobSchedulerService: mockJobSchedulerService,
            databaseService: mockDatabaseService,
            auditLogService: mockAuditLogService
        }, new Set<string>());
        const handler = ipcMainHandlers.get('workspace:analyze');

        analyzeWorkspaceMock.mockRejectedValue(new Error('Analysis Failed'));

        const result = await handler!(mockEvent, '/root', 'proj-1');

        expect(result).toEqual({
            success: false,
            error: {
                message: 'Analysis Failed',
                code: 'IPC_HANDLER_ERROR'
            }
        });
    });

    it('logs audit entry for env saves', async () => {
        vi.mocked(mockWorkspaceService.saveEnvVars).mockResolvedValue(undefined);
        registerWorkspaceIpc(() => null, {
            workspaceService: mockWorkspaceService,
            logoService: mockLogoService,
            inlineSuggestionService: mockInlineSuggestionService,
            codeIntelligenceService: mockCodeIntelligenceService,
            jobSchedulerService: mockJobSchedulerService,
            databaseService: mockDatabaseService,
            auditLogService: mockAuditLogService
        }, new Set<string>());
        const handler = ipcMainHandlers.get('workspace:saveEnv');

        const result = await handler!(mockEvent, '/root', { TOKEN: 'x' });
        expect(result).toMatchObject({
            success: true,
            data: { success: true }
        });
        expect(vi.mocked(mockAuditLogService!.logFileSystemOperation)).toHaveBeenCalledWith(
            'workspace.save-env',
            true,
            expect.objectContaining({ rootPath: '/root', variableCount: 1 })
        );
    });

    it('returns null-safe active workspace state for setActive and clearActive', async () => {
        vi.mocked(mockWorkspaceService.setActiveWorkspace).mockResolvedValue(undefined);
        vi.mocked(mockWorkspaceService.clearActiveWorkspace).mockResolvedValue(undefined);
        vi.mocked(mockWorkspaceService.getActiveWorkspace).mockReturnValue(undefined as never);

        registerWorkspaceIpc(() => null, {
            workspaceService: mockWorkspaceService,
            logoService: mockLogoService,
            inlineSuggestionService: mockInlineSuggestionService,
            codeIntelligenceService: mockCodeIntelligenceService,
            jobSchedulerService: mockJobSchedulerService,
            databaseService: mockDatabaseService,
            auditLogService: mockAuditLogService
        }, new Set<string>());

        const setActiveHandler = ipcMainHandlers.get('workspace:setActive');
        const clearActiveHandler = ipcMainHandlers.get('workspace:clearActive');

        await expect(setActiveHandler?.(mockEvent, '/root')).resolves.toMatchObject({
            success: true,
            data: { rootPath: null }
        });
        await expect(clearActiveHandler?.(mockEvent)).resolves.toMatchObject({
            success: true,
            data: { rootPath: null }
        });
    });

    it('batches auto-index updates per watched workspace root', async () => {
        let workspaceWatchCallback:
            | ((watchEvent: string, filePath: string) => void)
            | undefined;

        vi.mocked(mockWorkspaceService.watchWorkspace).mockImplementation(
            async (_rootPath: string, callback: (watchEvent: string, filePath: string) => void) => {
                workspaceWatchCallback = callback;
            }
        );
        vi.mocked(mockDatabaseService.getWorkspaces).mockResolvedValue([
            { id: 'workspace-1', path: '/root' },
        ] as never);

        registerWorkspaceIpc(() => null, {
            workspaceService: mockWorkspaceService,
            logoService: mockLogoService,
            inlineSuggestionService: mockInlineSuggestionService,
            codeIntelligenceService: mockCodeIntelligenceService,
            jobSchedulerService: mockJobSchedulerService,
            databaseService: mockDatabaseService,
            auditLogService: mockAuditLogService
        }, new Set<string>());

        const watchHandler = ipcMainHandlers.get('workspace:watch');
        await expect(watchHandler?.(mockEvent, '/root')).resolves.toMatchObject({
            success: true,
            data: { success: true }
        });

        workspaceWatchCallback?.('change', '/root/src/a.ts');
        workspaceWatchCallback?.('rename', '/root/src/b.ts');

        const scheduledTask = scheduledTasks.get('workspace:auto-index:/root');
        await scheduledTask?.();

        expect(vi.mocked(mockDatabaseService.getWorkspaces)).toHaveBeenCalledTimes(1);
    });

    it('skips auto-index updates for ignored workspace paths', async () => {
        let workspaceWatchCallback:
            | ((watchEvent: string, filePath: string) => void)
            | undefined;

        vi.mocked(mockWorkspaceService.watchWorkspace).mockImplementation(
            async (_rootPath: string, callback: (watchEvent: string, filePath: string) => void) => {
                workspaceWatchCallback = callback;
            }
        );
        vi.mocked(mockDatabaseService.getWorkspaces).mockResolvedValue([
            {
                id: 'workspace-1',
                path: '/root',
                advancedOptions: {
                    fileWatchIgnore: ['generated/'],
                },
            },
        ] as never);

        registerWorkspaceIpc(() => null, {
            workspaceService: mockWorkspaceService,
            logoService: mockLogoService,
            inlineSuggestionService: mockInlineSuggestionService,
            codeIntelligenceService: mockCodeIntelligenceService,
            jobSchedulerService: mockJobSchedulerService,
            databaseService: mockDatabaseService,
            auditLogService: mockAuditLogService
        }, new Set<string>());

        const watchHandler = ipcMainHandlers.get('workspace:watch');
        await expect(watchHandler?.(mockEvent, '/root')).resolves.toMatchObject({
            success: true,
            data: { success: true }
        });

        workspaceWatchCallback?.('change', '/root/generated/file.ts');
        const scheduledTask = scheduledTasks.get('workspace:auto-index:/root');
        await scheduledTask?.();

        expect(vi.mocked(mockCodeIntelligenceService.updateFileIndex)).not.toHaveBeenCalled();
    });

    it('batches workspace file-change events into a single renderer emission', async () => {
        vi.useFakeTimers();
        try {
            let workspaceWatchCallback:
                | ((watchEvent: string, filePath: string) => void)
                | undefined;
            const sendMock = vi.fn();
            const mockWindow = {
                isDestroyed: () => false,
                webContents: {
                    id: 1,
                    send: sendMock,
                },
            };

            vi.mocked(mockWorkspaceService.watchWorkspace).mockImplementation(
                async (_rootPath: string, callback: (watchEvent: string, filePath: string) => void) => {
                    workspaceWatchCallback = callback;
                }
            );

            registerWorkspaceIpc(() => mockWindow as never, {
                workspaceService: mockWorkspaceService,
                logoService: mockLogoService,
                inlineSuggestionService: mockInlineSuggestionService,
                codeIntelligenceService: mockCodeIntelligenceService,
                jobSchedulerService: mockJobSchedulerService,
                databaseService: mockDatabaseService,
                auditLogService: mockAuditLogService
            }, new Set<string>());

            const watchHandler = ipcMainHandlers.get('workspace:watch');
            await expect(watchHandler?.(mockEvent, '/root')).resolves.toMatchObject({
                success: true,
                data: { success: true }
            });

            workspaceWatchCallback?.('change', '/root/src/a.ts');
            workspaceWatchCallback?.('rename', '/root/src/b.ts');
            expect(sendMock).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(50);
            expect(sendMock).toHaveBeenCalledTimes(1);
            expect(sendMock).toHaveBeenCalledWith('workspace:file-change', [
                { event: 'change', path: '/root/src/a.ts', rootPath: '/root' },
                { event: 'rename', path: '/root/src/b.ts', rootPath: '/root' },
            ]);
        } finally {
            vi.useRealTimers();
        }
    });
});
