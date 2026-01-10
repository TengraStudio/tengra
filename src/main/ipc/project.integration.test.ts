import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IpcMainInvokeEvent } from 'electron';
import { registerProjectIpc } from './project';

// Mock Electron ipcMain
const ipcMainHandlers = new Map<string, Function>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel, handler) => {
            ipcMainHandlers.set(channel, handler);
        }),
        removeHandler: vi.fn()
    }
}));

// Mock IPC Wrapper
vi.mock('../utils/ipc-wrapper.util', () => ({
    createIpcHandler: (_name: string, handler: Function) => async (...args: any[]) => {
        try {
            const result = await handler(...args);
            return { success: true, data: result };
        } catch (error: any) {
            return { success: false, error: error.message || 'Unknown Error' };
        }
    }
}));

// Mock Services
const mockProjectService = {
    analyzeProject: vi.fn(),
    analyzeDirectory: vi.fn()
};

const mockLogoService = {
    generateLogo: vi.fn(),
    analyzeProjectIdentity: vi.fn(),
    applyLogo: vi.fn(),
    getCompletion: vi.fn()
};

const mockCodeIntelligenceService = {
    indexProject: vi.fn().mockResolvedValue(undefined)
};

describe('Project IPC Integration', () => {
    beforeEach(() => {
        ipcMainHandlers.clear();
        vi.clearAllMocks();
    });

    it('should register project handlers', () => {
        registerProjectIpc(mockProjectService as any, mockLogoService as any, mockCodeIntelligenceService as any);
        expect(ipcMainHandlers.has('project:analyze')).toBe(true);
        expect(ipcMainHandlers.has('project:generateLogo')).toBe(true);
        expect(ipcMainHandlers.has('project:analyzeIdentity')).toBe(true);
    });

    it('should handle project:analyze successfully', async () => {
        registerProjectIpc(mockProjectService as any, mockLogoService as any, mockCodeIntelligenceService as any);
        const handler = ipcMainHandlers.get('project:analyze');

        const mockResult = { files: [], symbols: [] };
        mockProjectService.analyzeProject.mockResolvedValue(mockResult);

        // handler(event, rootPath, projectId)
        const result = await handler?.({} as IpcMainInvokeEvent, '/root', 'proj-1');

        expect(mockProjectService.analyzeProject).toHaveBeenCalledWith('/root');
        expect(mockCodeIntelligenceService.indexProject).toHaveBeenCalledWith('/root', 'proj-1');
        expect(result).toMatchObject({
            success: true,
            data: mockResult
        });
    });

    it('should handle project:generateLogo', async () => {
        registerProjectIpc(mockProjectService as any, mockLogoService as any, mockCodeIntelligenceService as any);
        const handler = ipcMainHandlers.get('project:generateLogo');

        mockLogoService.generateLogo.mockResolvedValue('/path/to/logo.png');

        const result = await handler?.({} as IpcMainInvokeEvent, '/root', 'prompt', 'style');

        expect(mockLogoService.generateLogo).toHaveBeenCalledWith('/root', 'prompt', 'style');
        expect(result).toMatchObject({
            success: true,
            data: '/path/to/logo.png'
        });
    });

    it('should handle errors in project operations', async () => {
        registerProjectIpc(mockProjectService as any, mockLogoService as any, mockCodeIntelligenceService as any);
        const handler = ipcMainHandlers.get('project:analyze');

        mockProjectService.analyzeProject.mockRejectedValue(new Error('Analysis Failed'));

        const result = await handler?.({} as IpcMainInvokeEvent, '/root', 'proj-1');

        expect(result).toEqual({
            success: false,
            error: 'Analysis Failed'
        });
    });
});
