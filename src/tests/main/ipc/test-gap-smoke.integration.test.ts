import { registerAdvancedMemoryIpc } from '@main/ipc/advanced-memory';
import { registerBrainIpcHandlers } from '@main/ipc/brain';
import { registerCodeIntelligenceIpc } from '@main/ipc/code-intelligence';
import { registerDialogIpc } from '@main/ipc/dialog';
import { registerExtensionIpc } from '@main/ipc/extension';
import { registerFileDiffIpc } from '@main/ipc/file-diff';
import { registerFilesIpc } from '@main/ipc/files';
import { registerGalleryIpc } from '@main/ipc/gallery';
import { registerGitIpc } from '@main/ipc/git';
import { registerIdeaGeneratorIpc } from '@main/ipc/idea-generator';
import { registerAllIpc } from '@main/ipc/index';
import { registerMcpIpc } from '@main/ipc/mcp';
import { registerProcessIpc } from '@main/ipc/process';
import { registerProjectAgentIpc } from '@main/ipc/project-agent';
import { registerProxyEmbedIpc } from '@main/ipc/proxy-embed';
import { ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Missing IPC TODO coverage (smoke)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('registers advanced memory handlers', () => {
        const svc = {
            getPendingMemories: vi.fn(() => []),
            confirmPendingMemory: vi.fn(),
            rejectPendingMemory: vi.fn(),
            rememberExplicit: vi.fn(),
            recall: vi.fn(),
            recallRelevantFacts: vi.fn(),
            getStatistics: vi.fn(),
            runDecayMaintenance: vi.fn(),
            extractAndStageFromMessage: vi.fn(),
            deleteMemory: vi.fn(),
            deleteMemories: vi.fn(),
            editMemory: vi.fn(),
            archiveMemory: vi.fn(),
            archiveMemories: vi.fn(),
            restoreMemory: vi.fn(),
            getMemory: vi.fn(),
        } as any;

        registerAdvancedMemoryIpc(svc);

        expect(ipcMain.handle).toHaveBeenCalled();
    });

    it('registers brain handlers', () => {
        registerBrainIpcHandlers({
            learnUserFact: vi.fn(),
            recallUserFacts: vi.fn(),
            getUserFactsByCategory: vi.fn(),
            getBrainContext: vi.fn(),
            extractUserFactsFromMessage: vi.fn(),
            forgetUserFact: vi.fn(),
            updateFactConfidence: vi.fn(),
            getBrainStats: vi.fn(),
        } as any);

        expect(ipcMain.handle).toHaveBeenCalledWith('brain:learn', expect.any(Function));
    });

    it('registers code intelligence handlers', () => {
        registerCodeIntelligenceIpc({
            scanProjectTodos: vi.fn(),
            findSymbols: vi.fn(),
            searchFiles: vi.fn(),
            indexProject: vi.fn(),
            queryIndexedSymbols: vi.fn(),
        } as any);

        expect(ipcMain.handle).toHaveBeenCalledWith('code:scanTodos', expect.any(Function));
    });

    it('registers dialog handlers', () => {
        registerDialogIpc(() => null);

        expect(ipcMain.handle).toHaveBeenCalledWith('dialog:selectDirectory', expect.any(Function));
        expect(ipcMain.handle).toHaveBeenCalledWith('dialog:saveFile', expect.any(Function));
    });

    it('registers extension handlers', () => {
        registerExtensionIpc({
            shouldShowWarning: vi.fn(() => false),
            dismissWarning: vi.fn(),
            isExtensionInstalled: vi.fn(() => false),
            setExtensionInstalled: vi.fn(),
        } as any);

        expect(ipcMain.handle).toHaveBeenCalledWith('extension:getStatus', expect.any(Function));
    });

    it('registers file diff handlers', () => {
        const tracker = {
            databaseService: {
                getFileDiffHistory: vi.fn(),
                getRecentFileDiffs: vi.fn(),
                getFileDiffsBySession: vi.fn(),
                getFileDiffsBySystem: vi.fn(),
                getFileDiff: vi.fn(),
                cleanupOldFileDiffs: vi.fn(),
            },
            revertFileChange: vi.fn(),
            getDiffStats: vi.fn(() => ({ additions: 0, deletions: 0, changes: 0 })),
        } as any;

        registerFileDiffIpc(() => null, tracker);

        expect(ipcMain.handle).toHaveBeenCalledWith('diff:getFileHistory', expect.any(Function));
    });

    it('registers files handlers', () => {
        registerFilesIpc(
            () => null,
            {
                updateAllowedRoots: vi.fn(),
                listDirectory: vi.fn(),
                readFile: vi.fn(),
                readImage: vi.fn(),
                writeFileWithTracking: vi.fn(),
                writeFile: vi.fn(),
                createDirectory: vi.fn(),
                deleteFile: vi.fn(),
                deleteDirectory: vi.fn(),
                searchInFiles: vi.fn(),
                scanDirectory: vi.fn(),
                getScanJobStatus: vi.fn(),
                getPathSuggestions: vi.fn(),
                movePath: vi.fn(),
                copyPath: vi.fn(),
                renamePath: vi.fn(),
            } as any,
            new Set<string>()
        );

        expect(ipcMain.handle).toHaveBeenCalledWith('files:selectDirectory', expect.any(Function));
    });

    it('registers gallery handlers', () => {
        registerGalleryIpc('/tmp/gallery');

        expect(ipcMain.handle).toHaveBeenCalledWith('gallery:list', expect.any(Function));
    });

    it('registers git handlers', () => {
        registerGitIpc({
            executeRaw: vi.fn(async () => ({ success: true, stdout: '' })),
            getStatus: vi.fn(async () => []),
            getHistory: vi.fn(),
            getDiff: vi.fn(),
            commit: vi.fn(),
            checkout: vi.fn(),
            createBranch: vi.fn(),
            merge: vi.fn(),
            pull: vi.fn(),
            push: vi.fn(),
            add: vi.fn(),
            reset: vi.fn(),
            stash: vi.fn(),
            listStashes: vi.fn(),
            applyStash: vi.fn(),
            dropStash: vi.fn(),
            getRemoteUrl: vi.fn(),
            setRemoteUrl: vi.fn(),
            getContributors: vi.fn(),
            getStats: vi.fn(),
        } as any);

        expect(ipcMain.handle).toHaveBeenCalledWith('git:isRepository', expect.any(Function));
    });

    it('registers idea generator handlers', () => {
        registerIdeaGeneratorIpc(
            {
                createSession: vi.fn(),
                getSession: vi.fn(),
                getSessions: vi.fn(),
                deleteSession: vi.fn(),
                startResearch: vi.fn(),
                generateIdeas: vi.fn(),
                generateMoreIdeas: vi.fn(),
                answerResearchQuestion: vi.fn(),
                approveIdea: vi.fn(),
                rejectIdea: vi.fn(),
                updateIdea: vi.fn(),
                deleteIdea: vi.fn(),
                archiveIdea: vi.fn(),
                unarchiveIdea: vi.fn(),
                getArchivedIdeas: vi.fn(),
                generateLogosForIdea: vi.fn(),
                selectLogoForIdea: vi.fn(),
                exportIdeaAsProject: vi.fn(),
                askResearchQuestion: vi.fn(),
            } as any,
            {
                on: vi.fn(),
            } as any
        );

        expect(ipcMain.handle).toHaveBeenCalledWith('ideas:createSession', expect.any(Function));
    });

    it('registers mcp handlers', () => {
        registerMcpIpc({
            listServices: vi.fn(() => []),
            dispatch: vi.fn(),
            toggleService: vi.fn(),
            installService: vi.fn(),
            uninstallService: vi.fn(),
        } as any);

        expect(ipcMain.handle).toHaveBeenCalledWith('mcp:list', expect.any(Function));
    });

    it('registers process handlers', () => {
        registerProcessIpc({
            spawn: vi.fn(),
            kill: vi.fn(),
            getRunningTasks: vi.fn(() => []),
            scanScripts: vi.fn(),
            resize: vi.fn(),
            write: vi.fn(),
            on: vi.fn(),
        } as any);

        expect(ipcMain.handle).toHaveBeenCalledWith('process:spawn', expect.any(Function));
    });

    it('registers project agent handlers', () => {
        registerProjectAgentIpc(
            {
                eventBus: { on: vi.fn() },
                getCurrentTaskId: vi.fn(() => null),
                start: vi.fn(),
                stop: vi.fn(),
                resetState: vi.fn(),
                generatePlan: vi.fn(),
                approvePlan: vi.fn(),
                getStatus: vi.fn(),
                retryStep: vi.fn(),
                approveStep: vi.fn(),
                skipStep: vi.fn(),
                editStep: vi.fn(),
                addStepComment: vi.fn(),
                insertInterventionPoint: vi.fn(),
                resumeFromCheckpoint: vi.fn(),
                getTaskHistory: vi.fn(),
                getCheckpoints: vi.fn(),
                rollbackCheckpoint: vi.fn(),
                getPlanVersions: vi.fn(),
                deleteTaskByNodeId: vi.fn(),
                createPullRequest: vi.fn(),
                getProfiles: vi.fn(),
                registerProfile: vi.fn(),
                deleteProfile: vi.fn(),
                getRoutingRules: vi.fn(() => []),
                setRoutingRules: vi.fn(),
                createVotingSession: vi.fn(),
                voteInSession: vi.fn(),
                closeVotingSession: vi.fn(),
                getVotingSession: vi.fn(),
                getTemplates: vi.fn(),
                getTemplatesByCategory: vi.fn(),
                getTemplate: vi.fn(),
                createTemplate: vi.fn(),
                updateTemplate: vi.fn(),
                deleteTemplate: vi.fn(),
                exportTemplates: vi.fn(),
                importTemplates: vi.fn(),
                getCanvasByProjectId: vi.fn(),
                saveCanvasSnapshot: vi.fn(),
                startTaskFromCanvasNode: vi.fn(),
                updateTaskNodePosition: vi.fn(),
                getTaskById: vi.fn(),
            } as any,
            () => null,
            {
                query: vi.fn(async () => ({ rows: [] })),
                run: vi.fn(),
            } as any
        );

        expect(ipcMain.handle).toHaveBeenCalledWith('project:start', expect.any(Function));
    });

    it('registers proxy embed handlers', () => {
        registerProxyEmbedIpc({
            startEmbeddedProxy: vi.fn(),
            stopEmbeddedProxy: vi.fn(),
            getEmbeddedProxyStatus: vi.fn(() => ({ running: false, port: undefined })),
        } as any);

        expect(ipcMain.handle).toHaveBeenCalledWith('proxy:embed:start', expect.any(Function));
    });

    it('exports registerAllIpc function from index', () => {
        expect(typeof registerAllIpc).toBe('function');
    });
});
