import { registerWorkspaceIpc } from '@main/ipc/workspace';
import { AuditLogService } from '@main/services/analysis/audit-log.service';
import { LogoService } from '@main/services/external/logo.service';
import { InlineSuggestionService } from '@main/services/llm/inline-suggestion.service';
import { CodeIntelligenceService } from '@main/services/workspace/code-intelligence.service';
import { WorkspaceService } from '@main/services/workspace/workspace.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Electron ipcMain
const ipcMainHandlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel, handler) => {
            ipcMainHandlers.set(channel, handler);
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

describe('Workspace IPC Integration', () => {
    const mockEvent = { sender: { id: 1 } } as never;

    beforeEach(() => {

        ipcMainHandlers.clear();

        vi.clearAllMocks();

        mockWorkspaceService = {
            analyzeWorkspace: vi.fn(),
            analyzeDirectory: vi.fn(),
            watchWorkspace: vi.fn(),
            stopWatch: vi.fn(),
            saveEnvVars: vi.fn(),
            getAuditContext: vi.fn((rootPath: string) => ({ rootPath, workspaceName: 'project' }))
        } as unknown as WorkspaceService;

        mockLogoService = {
            generateLogo: vi.fn(),
            analyzeWorkspaceIdentity: vi.fn(),
            applyLogo: vi.fn(),
            improveLogoPrompt: vi.fn()
        } as unknown as LogoService;

        mockInlineSuggestionService = {
            getCompletion: vi.fn(),
            getInlineSuggestion: vi.fn(),
        } as unknown as InlineSuggestionService;

        mockCodeIntelligenceService = {
            indexWorkspace: vi.fn().mockResolvedValue(undefined)
        } as unknown as CodeIntelligenceService;

        mockAuditLogService = {
            logFileSystemOperation: vi.fn().mockResolvedValue(undefined)
        } as unknown as AuditLogService;
    });

    it('should register project handlers', () => {
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
        expect(ipcMainHandlers.has('workspace:generateLogo')).toBe(true);
        expect(ipcMainHandlers.has('workspace:analyzeIdentity')).toBe(true);
    });

    it('should handle project:analyze successfully', async () => {
        const analyzeProjectMock = vi.fn();
        mockWorkspaceService.analyzeProject = analyzeProjectMock;

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

        const mockResult = { files: [], symbols: [] };
        analyzeProjectMock.mockResolvedValue(mockResult);

        // handler(event, rootPath, workspaceId)
        const result = await handler?.(mockEvent, '/root', 'proj-1');

        expect(analyzeProjectMock).toHaveBeenCalledWith('/root');
        expect(vi.mocked(mockCodeIntelligenceService.indexWorkspace)).toHaveBeenCalledWith('/root', 'proj-1');
        expect(result).toMatchObject({
            success: true,
            data: mockResult
        });
    });

    it('should handle project:generateLogo', async () => {
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

        const result = await handler?.(mockEvent, '/root', { prompt: 'prompt', style: 'style', model: 'dall-e-3', count: 1 });

        // Handler destructures the options object before calling logoService
        expect(generateLogoMock).toHaveBeenCalledWith('/root', 'prompt', 'style', 'dall-e-3', 1);
        expect(result).toMatchObject({
            success: true,
            data: '/path/to/logo.png'
        });
    });

    it('should handle errors in project operations', async () => {
        const analyzeProjectMock = vi.fn();
        mockWorkspaceService.analyzeProject = analyzeProjectMock;

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

        analyzeProjectMock.mockRejectedValue(new Error('Analysis Failed'));

        const result = await handler?.(mockEvent, '/root', 'proj-1');

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

        const result = await handler?.(mockEvent, '/root', { TOKEN: 'x' });
        expect(result).toMatchObject({
            success: true,
            data: { success: true }
        });
        expect(vi.mocked(mockAuditLogService!.logFileSystemOperation)).toHaveBeenCalledWith(
            'project.save-env',
            true,
            expect.objectContaining({ rootPath: '/root', variableCount: 1 })
        );
    });
});
