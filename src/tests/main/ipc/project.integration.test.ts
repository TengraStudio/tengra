import { registerProjectIpc } from '@main/ipc/project';

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Electron ipcMain
const ipcMainHandlers = new Map<string, (...args: any[]) => any>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel, handler) => {
            ipcMainHandlers.set(channel, handler);
        }),
        removeHandler: vi.fn()
    }
}));

// Mock IPC Wrapper
vi.mock('@main/utils/ipc-wrapper.util', () => ({
    createIpcHandler: (_name: string, handler: (...args: any[]) => any) => async (event: unknown, ...args: any[]) => {
        try {
            const result = await handler(event, ...args);
            return { success: true, data: result };
        } catch (error: any) {
            return { success: false, error: error.message ?? 'Unknown Error' };
        }
    },
    createValidatedIpcHandler: (
        _name: string,
        handler: (...args: any[]) => any,
        options?: { argsSchema?: { parse: (args: unknown[]) => unknown[] }; defaultValue?: unknown }
    ) => async (event: unknown, ...args: unknown[]) => {
        try {
            const parsedArgs = options?.argsSchema ? options.argsSchema.parse(args) : args;
            const result = await handler(event, ...(parsedArgs as unknown[]));
            return { success: true, data: result };
        } catch (error: any) {
            if (options && Object.prototype.hasOwnProperty.call(options, 'defaultValue')) {
                return options.defaultValue;
            }
            return { success: false, error: error.message ?? 'Validation failed' };
        }
    },
    createSafeIpcHandler: (_name: string, handler: (...args: any[]) => any, defaultValue: unknown) => async (...args: any[]) => {
        try {
            return await handler(...args);
        } catch {
            return defaultValue;
        }
    },
}));


// Mock Services
// Mock Services
let mockProjectService: any;
let mockLogoService: any;
let mockCodeIntelligenceService: any;

describe('Project IPC Integration', () => {
    const mockEvent = { sender: { id: 1 } } as any;

    beforeEach(() => {

        ipcMainHandlers.clear();

        vi.clearAllMocks();

        mockProjectService = {
            analyzeProject: vi.fn(),
            analyzeDirectory: vi.fn(),
            watchProject: vi.fn(),
            stopWatch: vi.fn()
        };

        mockLogoService = {
            generateLogo: vi.fn(),
            analyzeProjectIdentity: vi.fn(),
            applyLogo: vi.fn(),
            getCompletion: vi.fn(),
            improveLogoPrompt: vi.fn()
        };

        mockCodeIntelligenceService = {
            indexProject: vi.fn().mockResolvedValue(undefined)
        };
    });

    it('should register project handlers', () => {
        registerProjectIpc(() => null, {
            projectService: mockProjectService,
            logoService: mockLogoService,
            codeIntelligenceService: mockCodeIntelligenceService,
            jobSchedulerService: {} as any,
            databaseService: {} as any
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
            codeIntelligenceService: mockCodeIntelligenceService,
            jobSchedulerService: {} as any,
            databaseService: {} as any
        });
        const handler = ipcMainHandlers.get('project:analyze');

        const mockResult = { files: [], symbols: [] };
        analyzeProjectMock.mockResolvedValue(mockResult);

        // handler(event, rootPath, projectId)
        const result = await handler?.(mockEvent, '/root', 'proj-1');

        expect(analyzeProjectMock).toHaveBeenCalledWith('/root');
        expect(mockCodeIntelligenceService.indexProject).toHaveBeenCalledWith('/root', 'proj-1');
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
            codeIntelligenceService: mockCodeIntelligenceService,
            jobSchedulerService: {} as any,
            databaseService: {} as any
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
            codeIntelligenceService: mockCodeIntelligenceService,
            jobSchedulerService: {} as any,
            databaseService: {} as any
        });
        const handler = ipcMainHandlers.get('project:analyze');

        analyzeProjectMock.mockRejectedValue(new Error('Analysis Failed'));

        const result = await handler?.(mockEvent, '/root', 'proj-1');

        expect(result).toEqual({
            success: false,
            error: 'Analysis Failed'
        });
    });
});
