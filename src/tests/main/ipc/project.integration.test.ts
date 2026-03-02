import { registerProjectIpc } from '@main/ipc/project';
import { AuditLogService } from '@main/services/analysis/audit-log.service';
import { LogoService } from '@main/services/external/logo.service';
import { InlineSuggestionService } from '@main/services/llm/inline-suggestion.service';
import { CodeIntelligenceService } from '@main/services/project/code-intelligence.service';
import { ProjectService } from '@main/services/project/project.service';
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
let mockProjectService: ProjectService;
let mockLogoService: LogoService;
let mockInlineSuggestionService: InlineSuggestionService;
let mockCodeIntelligenceService: CodeIntelligenceService;
let mockAuditLogService: AuditLogService;

describe('Project IPC Integration', () => {
    const mockEvent = { sender: { id: 1 } } as never;

    beforeEach(() => {

        ipcMainHandlers.clear();

        vi.clearAllMocks();

        mockProjectService = {
            analyzeProject: vi.fn(),
            analyzeDirectory: vi.fn(),
            watchProject: vi.fn(),
            stopWatch: vi.fn(),
            saveEnvVars: vi.fn(),
            getAuditContext: vi.fn((rootPath: string) => ({ rootPath, projectName: 'project' }))
        } as unknown as ProjectService;

        mockLogoService = {
            generateLogo: vi.fn(),
            analyzeProjectIdentity: vi.fn(),
            applyLogo: vi.fn(),
            improveLogoPrompt: vi.fn()
        } as unknown as LogoService;

        mockInlineSuggestionService = {
            getCompletion: vi.fn(),
            getInlineSuggestion: vi.fn(),
        } as unknown as InlineSuggestionService;

        mockCodeIntelligenceService = {
            indexProject: vi.fn().mockResolvedValue(undefined)
        } as unknown as CodeIntelligenceService;

        mockAuditLogService = {
            logFileSystemOperation: vi.fn().mockResolvedValue(undefined)
        } as unknown as AuditLogService;
    });

    it('should register project handlers', () => {
        registerProjectIpc(() => null, {
            projectService: mockProjectService,
            logoService: mockLogoService,
            inlineSuggestionService: mockInlineSuggestionService,
            codeIntelligenceService: mockCodeIntelligenceService,
            jobSchedulerService: {} as never,
            databaseService: {} as never,
            auditLogService: mockAuditLogService
        });
        expect(ipcMainHandlers.has('project:analyze')).toBe(true);
        expect(ipcMainHandlers.has('project:generateLogo')).toBe(true);
        expect(ipcMainHandlers.has('project:analyzeIdentity')).toBe(true);
    });

    it('should handle project:analyze successfully', async () => {
        const analyzeProjectMock = vi.fn();
        mockProjectService.analyzeProject = analyzeProjectMock;

        registerProjectIpc(() => null, {
            projectService: mockProjectService,
            logoService: mockLogoService,
            inlineSuggestionService: mockInlineSuggestionService,
            codeIntelligenceService: mockCodeIntelligenceService,
            jobSchedulerService: {} as never,
            databaseService: {} as never,
            auditLogService: mockAuditLogService
        });
        const handler = ipcMainHandlers.get('project:analyze');

        const mockResult = { files: [], symbols: [] };
        analyzeProjectMock.mockResolvedValue(mockResult);

        // handler(event, rootPath, projectId)
        const result = await handler?.(mockEvent, '/root', 'proj-1');

        expect(analyzeProjectMock).toHaveBeenCalledWith('/root');
        expect(vi.mocked(mockCodeIntelligenceService.indexProject)).toHaveBeenCalledWith('/root', 'proj-1');
        expect(result).toMatchObject({
            success: true,
            data: mockResult
        });
    });

    it('should handle project:generateLogo', async () => {
        const generateLogoMock = vi.fn();
        mockLogoService.generateLogo = generateLogoMock;

        registerProjectIpc(() => null, {
            projectService: mockProjectService,
            logoService: mockLogoService,
            inlineSuggestionService: mockInlineSuggestionService,
            codeIntelligenceService: mockCodeIntelligenceService,
            jobSchedulerService: {} as never,
            databaseService: {} as never,
            auditLogService: mockAuditLogService
        });
        const handler = ipcMainHandlers.get('project:generateLogo');

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
        mockProjectService.analyzeProject = analyzeProjectMock;

        registerProjectIpc(() => null, {
            projectService: mockProjectService,
            logoService: mockLogoService,
            inlineSuggestionService: mockInlineSuggestionService,
            codeIntelligenceService: mockCodeIntelligenceService,
            jobSchedulerService: {} as never,
            databaseService: {} as never,
            auditLogService: mockAuditLogService
        });
        const handler = ipcMainHandlers.get('project:analyze');

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
        vi.mocked(mockProjectService.saveEnvVars).mockResolvedValue(undefined);
        registerProjectIpc(() => null, {
            projectService: mockProjectService,
            logoService: mockLogoService,
            inlineSuggestionService: mockInlineSuggestionService,
            codeIntelligenceService: mockCodeIntelligenceService,
            jobSchedulerService: {} as never,
            databaseService: {} as never,
            auditLogService: mockAuditLogService
        });
        const handler = ipcMainHandlers.get('project:saveEnv');

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
