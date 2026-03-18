import { registerWorkspaceIpc } from '@main/ipc/workspace';
import { AuditLogService } from '@main/services/analysis/audit-log.service';
import { LogoService } from '@main/services/external/logo.service';
import { InlineSuggestionService } from '@main/services/llm/inline-suggestion.service';
import { CodeIntelligenceService } from '@main/services/workspace/code-intelligence.service';
import { WorkspaceService } from '@main/services/workspace/workspace.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Electron ipcMain
const ipcMainHandlers = new Map<string, (...args: TestValue[]) => Promise<TestValue>>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel, handler) => {
            ipcMainHandlers.set(channel, async (...args: TestValue[]) => Promise.resolve(handler(...args)));
        }),
        removeHandler: vi.fn()
    }
}));

// Mock IPC Wrapper

// Mock Services
// Mock Services
let mockWorkspaceService: WorkspaceService;
let mockLogoService: LogoService;
let mockInlineSuggestionService: InlineSuggestionService;
let mockCodeIntelligenceService: CodeIntelligenceService;
let mockAuditLogService: AuditLogService;

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
    };
}

describe('Workspace IPC Integration', () => {
    const mockEvent = { sender: { id: 1 } } as never;

    beforeEach(() => {

        ipcMainHandlers.clear();

        vi.clearAllMocks();

        mockWorkspaceService = {
            analyzeWorkspace: vi.fn(),
            analyzeWorkspaceSummary: vi.fn(),
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
        } as never as InlineSuggestionService;

        mockCodeIntelligenceService = {
            indexWorkspace: vi.fn().mockResolvedValue(undefined)
        } as never as CodeIntelligenceService;

        mockAuditLogService = {
            logFileSystemOperation: vi.fn().mockResolvedValue(undefined)
        } as never as AuditLogService;
    });

    it('should register workspace handlers', () => {
        registerWorkspaceIpc(() => null, {
            workspaceService: mockWorkspaceService,
            logoService: mockLogoService,
            inlineSuggestionService: mockInlineSuggestionService,
            codeIntelligenceService: mockCodeIntelligenceService,
            jobSchedulerService: {} as never,
            databaseService: {} as never,
            auditLogService: mockAuditLogService
        });
        expect(ipcMainHandlers.has('workspace:analyze')).toBe(true);
        expect(ipcMainHandlers.has('workspace:analyzeSummary')).toBe(true);
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
            jobSchedulerService: {} as never,
            databaseService: {} as never,
            auditLogService: mockAuditLogService
        });
        const handler = ipcMainHandlers.get('workspace:analyze');

        const mockResult = createWorkspaceAnalysisResult();
        analyzeWorkspaceMock.mockResolvedValue(mockResult);

        // handler(event, rootPath, workspaceId)
        const result = await handler!(mockEvent, '/root', 'proj-1');

        expect(analyzeWorkspaceMock).toHaveBeenCalledWith('/root');
        expect(vi.mocked(mockCodeIntelligenceService.indexWorkspace)).not.toHaveBeenCalled();
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
            jobSchedulerService: {} as never,
            databaseService: {} as never,
            auditLogService: mockAuditLogService
        });
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

    it('should handle workspace:generateLogo', async () => {
        const generateLogoMock = vi.fn();
        mockLogoService.generateLogo = generateLogoMock;

        registerWorkspaceIpc(() => null, {
            workspaceService: mockWorkspaceService,
            logoService: mockLogoService,
            inlineSuggestionService: mockInlineSuggestionService,
            codeIntelligenceService: mockCodeIntelligenceService,
            jobSchedulerService: {} as never,
            databaseService: {} as never,
            auditLogService: mockAuditLogService
        });
        const handler = ipcMainHandlers.get('workspace:generateLogo');

        generateLogoMock.mockResolvedValue('/path/to/logo.png');

        const result = await handler!(mockEvent, '/root', { prompt: 'prompt', style: 'style', model: 'dall-e-3', count: 1 });

        // Handler destructures the options object before calling logoService
        expect(generateLogoMock).toHaveBeenCalledWith('/root', 'prompt', 'style', 'dall-e-3', 1);
        expect(result).toMatchObject({
            success: true,
            data: '/path/to/logo.png'
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
            jobSchedulerService: {} as never,
            databaseService: {} as never,
            auditLogService: mockAuditLogService
        });
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
            jobSchedulerService: {} as never,
            databaseService: {} as never,
            auditLogService: mockAuditLogService
        });
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
            jobSchedulerService: {} as never,
            databaseService: {} as never,
            auditLogService: mockAuditLogService
        });

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
});

