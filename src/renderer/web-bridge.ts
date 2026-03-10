import type { ElectronAPI } from '@renderer/electron.d';
import type {
    CollaborationResponse,
    CollaborationSyncUpdate,
    JoinCollaborationRoom,
} from '@shared/schemas/collaboration.schema';
import type {
    InlineSuggestionResponse,
} from '@shared/schemas/inline-suggestions.schema';
import type { Workspace, WorkspaceAnalysis } from '@shared/types';
import type { AdvancedSemanticFragment, PendingMemory } from '@shared/types/advanced-memory';
import type { Chat, Folder, Message, ToolResult } from '@shared/types/chat';
import type { IpcValue } from '@shared/types/common';
import type { ClaudeQuota, CodexUsage } from '@shared/types/quota';
import type { AppSettings } from '@shared/types/settings';
import type { IpcRendererEvent } from 'electron';

import type {
    SSHConfig,
    SSHConnection,
    SSHDevContainer,
    SSHKnownHostEntry,
    SSHManagedKey,
    SSHPortForward,
    SSHProfileTemplate,
    SSHRemoteSearchResult,
    SSHSearchHistoryEntry,
    SSHSessionRecording,
    SSHSystemStats,
    SSHTransferTask,
    SSHTunnelPreset
} from '@/types/ssh';

// Mock Electron API for Web/Standalone development
export const webElectronMock: ElectronAPI = {
    invoke: <T = IpcValue>(_channel: string, ..._args: IpcValue[]) => Promise.resolve({} as T),
    minimize: () => window.electron.log.warn('minimize'),

    maximize: () => window.electron.log.warn('maximize'),
    close: () => window.electron.log.warn('close'),

    resizeWindow: (res: string) => window.electron.log.warn('resize', res),
    toggleCompact: (enabled: boolean) => window.electron.log.warn('compact', enabled),

    githubLogin: async (_appId?: 'profile' | 'copilot') => ({
        device_code: '123',
        user_code: 'ABC',
        verification_uri: 'http://localhost',
        expires_in: 900,
        interval: 5,
    }),
    pollToken: async (_deviceCode: string, _interval: number, _appId?: 'profile' | 'copilot') => ({
        success: true,
        account: {
            id: 'mock-id',
            provider: _appId === 'copilot' ? 'copilot' : 'github',
            email: 'mock@example.com',
            displayName: 'Mock Account',
            avatarUrl: undefined,
            isActive: true,
            createdAt: Date.now(),
        },
    }),
    antigravityLogin: async () => ({ url: 'http://localhost', state: 'mock-state' }),

    claudeLogin: async () => ({ url: 'http://localhost', state: 'mock-state' }),
    claudeBrowserLogin: async () => ({ sessionKey: 'mock-key', status: 'success' }),
    anthropicLogin: async () => ({ url: 'http://localhost', state: 'mock-state' }),
    codexLogin: async () => ({ url: 'http://localhost', state: 'mock-state' }),

    saveClaudeSession: async () => ({ success: true }),
    triggerClaudeSessionCapture: async () => ({ success: true }),

    // Linked Accounts API (New Multi-Account System)
    getLinkedAccounts: async (_provider?: string) => [],
    getActiveLinkedAccount: async (_provider: string) => null,
    setActiveLinkedAccount: async (_provider: string, _accountId: string) => ({ success: true }),
    linkAccount: async (_provider: string, _tokenData: unknown) => ({ success: true }),
    unlinkAccount: async (_accountId: string) => ({ success: true }),
    unlinkProvider: async (_provider: string) => ({ success: true }),
    hasLinkedAccount: async (_provider: string) => false,
    getAccountsByProvider: async (_provider: string) => [],
    getAuthProviderHealth: async (_provider?: string) => [],
    getAuthProviderAnalytics: async () => [],
    getTokenAnalytics: async (_provider?: string) => ({
        totalAccounts: 0,
        withAccessToken: 0,
        withRefreshToken: 0,
        withSessionToken: 0,
        expiringWithin30m: 0,
        expired: 0,
        revoked: 0,
    }),
    exportCredentials: async (_options: { provider?: string; password: string; expiresInHours?: number }) => ({
        success: true,
        payload: '',
        checksum: '',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    }),
    importCredentials: async (_payload: string, _password: string) => ({
        success: true,
        imported: 0,
        skipped: 0,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    }),
    createMasterKeyBackup: async (_passphrase: string) => ({
        success: true,
        backup: '',
    }),
    restoreMasterKeyBackup: async (_backupPayload: string, _passphrase: string) => ({
        success: true,
    }),
    startAuthSession: async (_provider: string, _accountId?: string, _source?: string) => ({ sessionId: '00000000-0000-0000-0000-000000000000' }),
    touchAuthSession: async (_sessionId: string) => ({ success: true }),
    endAuthSession: async (_sessionId: string) => ({ success: true }),
    setAuthSessionLimit: async (_provider: string, _limit: number) => ({ limit: 5 }),
    getAuthSessionAnalytics: async (_provider?: string) => ({ totalActiveSessions: 0, byProvider: {} }),
    setAuthSessionTimeout: async (_timeoutMs: number) => ({ timeoutMs: _timeoutMs }),
    getAuthSessionTimeout: async () => ({ timeoutMs: 30 * 60 * 1000 }),

    code: {
        scanTodos: async (_rootPath: string) => [],
        findSymbols: async (_rootPath: string, _query: string) => [],
        findDefinition: async (_rootPath: string, _symbol: string) => null,
        findReferences: async (_rootPath: string, _symbol: string) => [],
        findImplementations: async (_rootPath: string, _symbol: string) => [],
        getSymbolRelationships: async (
            _rootPath: string,
            _symbol: string,
            _maxItems?: number
        ) => [],
        getFileOutline: async (_filePath: string) => [],
        previewRenameSymbol: async (
            _rootPath: string,
            _symbol: string,
            _newSymbol: string,
            _maxFiles?: number
        ) => ({
            success: true,
            applied: false,
            symbol: _symbol,
            newSymbol: _newSymbol,
            totalFiles: 0,
            totalOccurrences: 0,
            changes: [],
            updatedFiles: [],
            errors: [],
        }),
        applyRenameSymbol: async (
            _rootPath: string,
            _symbol: string,
            _newSymbol: string,
            _maxFiles?: number
        ) => ({
            success: true,
            applied: true,
            symbol: _symbol,
            newSymbol: _newSymbol,
            totalFiles: 0,
            totalOccurrences: 0,
            changes: [],
            updatedFiles: [],
            errors: [],
        }),
        generateFileDocumentation: async (
            _filePath: string,
            _format: 'markdown' | 'jsdoc-comments' = 'markdown'
        ) => ({
            success: true,
            filePath: _filePath,
            format: _format,
            content: '',
            symbolCount: 0,
            generatedAt: new Date().toISOString(),
        }),
        generateWorkspaceDocumentation: async (
            _rootPath: string,
            _maxFiles?: number
        ) => ({
            success: true,
            filePath: _rootPath,
            format: 'markdown' as const,
            content: '',
            symbolCount: 0,
            generatedAt: new Date().toISOString(),
        }),
        analyzeQuality: async (_rootPath: string, _maxFiles?: number) => ({
            rootPath: _rootPath,
            filesScanned: 0,
            totalLines: 0,
            functionSymbols: 0,
            classSymbols: 0,
            longLineCount: 0,
            todoLikeCount: 0,
            consoleUsageCount: 0,
            averageComplexity: 0,
            securityIssueCount: 0,
            topSecurityFindings: [],
            highestComplexityFiles: [],
            qualityScore: 0,
            generatedAt: new Date().toISOString(),
        }),
        searchFiles: async (
            _rootPath: string,
            _query: string,
            _workspaceId?: string,
            _isRegex?: boolean
        ) => [],
        indexWorkspace: async (_rootPath: string, _workspaceId: string) => { },
        queryIndexedSymbols: async (_query: string) => [],
        getSymbolAnalytics: async (_rootPath: string) => ({
            totalSymbols: 0,
            uniqueFiles: 0,
            uniqueKinds: 0,
            byKind: {},
            byExtension: {},
            topFiles: [],
            topSymbols: [],
            generatedAt: new Date().toISOString(),
        }),
    },

    workspace: {
        analyze: async (_rootPath: string, _workspaceId: string) =>
            ({}) as WorkspaceAnalysis,
        generateLogo: async (_path: string, _opts: { prompt: string; style: string; model: string; count: number }) => [],
        analyzeIdentity: async (_path: string) => ({ suggestedPrompts: [], colors: [] }),
        applyLogo: async (_path: string, _tempPath: string) => '',
        getCompletion: async (_text: string) => '',
        getInlineSuggestion: async (_request: unknown) => ({}) as InlineSuggestionResponse,
        trackInlineSuggestionTelemetry: async (_event: unknown) => ({ success: true }),
        improveLogoPrompt: async (_prompt: string) => '',
        uploadLogo: async (_path: string) => null,
        analyzeDirectory: async (_dirPath: string) => ({
            hasPackageJson: false, pkg: {}, readme: null, stats: { fileCount: 0, totalSize: 0 },
        }),
        watch: async (_rootPath: string) => true,
        unwatch: async (_rootPath: string) => true,
        onFileChange:
            (_callback: (event: string, path: string, rootPath: string) => void) => () => { },
        getEnv: async (_rootPath: string) => ({}) as Record<string, string>,
        saveEnv: async (_rootPath: string, _vars: Record<string, string>) => ({ success: true }),
    },

    process: {
        spawn: async (_command: string, _args: string[], _cwd: string) => 'mock-id',
        kill: async (_id: string) => true,
        list: async () => [],
        scanScripts: async (_rootPath: string) => ({}),
        resize: async (_id: string, _cols: number, _rows: number) => { },
        write: async (_id: string, _data: string) => { },
        onData: (_callback: (data: { id: string; data: string }) => void) => () => { },
        onExit: (_callback: (data: { id: string; code: number }) => void) => () => { },
        removeListeners: () => { },
    },

    files: {
        listDirectory: async (_path: string) => [],
        readFile: async (_path: string) => '',
        readImage: async (_path: string) => ({ success: true }),
        writeFile: async (_path: string, _content: string) => { },
        exists: async (_path: string) => true,
    },

    getProxyModels: async () => [],
    getQuota: async (_provider?: string) => ({
        accounts: [
            {
                status: 'ok',
                next_reset: new Date().toISOString(),
                models: [],
                accountId: 'mock-account',
                email: 'mock@example.com',
            },
        ],
    }),
    getClaudeQuota: async () => ({
        accounts: [
            {
                success: true,
                fiveHour: { utilization: 0, resetsAt: new Date().toISOString() },
                sevenDay: { utilization: 0, resetsAt: new Date().toISOString() },
                accountId: 'mock-claude',
                email: 'mock@claude.ai',
            } as ClaudeQuota,
        ],
    }),
    getCopilotQuota: async () => ({
        accounts: [
            {
                remaining: 100,
                limit: 100,
                chat_enabled: true,
                code_search_enabled: true,
                copilot_plan: 'business',
                accountId: 'mock-copilot',
                email: 'mock@github.com',
            },
        ],
    }),
    getCodexUsage: async () => ({
        accounts: [
            {
                usage: {
                    dailyUsage: 0,
                    weeklyUsage: 0,
                    dailyLimit: 100,
                    weeklyLimit: 500,
                    remainingRequests: 100,
                    remainingTokens: 100000,
                } as CodexUsage,
                accountId: 'mock-codex',
                email: 'mock@openai.com',
            } as { usage: CodexUsage; accountId: string; email: string },
        ],
    }),
    checkUsageLimit: async (_provider: string, _model: string) => ({ allowed: true }),
    getUsageCount: async (
        _period: 'hourly' | 'daily' | 'weekly',
        _provider?: string,
        _model?: string
    ) => 0,
    performance: {
        getMemoryStats: async () => ({ success: true, data: { main: {}, timestamp: Date.now() } }),
        detectLeak: async () => ({ success: true, data: { isPossibleLeak: false, trend: [] } }),
        triggerGC: async () => ({ success: true, data: { success: true } }),
        getDashboard: async () => ({
            success: true,
            data: {
                memory: { latestRss: 0, latestHeapUsed: 0, sampleCount: 0 },
                alerts: []
            }
        }),
    },

    getModels: async () => [],

    isOllamaRunning: async () => true,
    startOllama: async () => ({ success: true, message: 'Ollama is starting' }),
    pullModel: async (_modelName: string) => ({ success: true }),
    deleteOllamaModel: async (_modelName: string) => ({ success: true }),
    getLibraryModels: async () => [],
    onPullProgress: (
        _callback: (progress: {
            status: string;
            digest?: string;
            total?: number;
            completed?: number;
            modelName?: string;
        }) => void
    ) => () => { },
    removePullProgressListener: () => { },
    sdCpp: {
        getStatus: async () => 'ready',
        reinstall: async () => { },
        getHistory: async (_limit?: number) => [],
        regenerate: async (_historyId: string) => '',
        getAnalytics: async () => ({
            totalGenerated: 0,
            byProvider: {},
            averageSteps: 0,
            bySource: {},
            averageDurationMs: 0,
            editModeCounts: {},
        }),
        getPresetAnalytics: async () => ({ totalPresets: 0, providerCounts: {}, customPresets: 0 }),
        getScheduleAnalytics: async () => ({ total: 0, byStatus: {}, byPriority: {} }),
        listPresets: async () => [],
        savePreset: async (_preset: {
            id?: string;
            name: string;
            promptPrefix?: string;
            width: number;
            height: number;
            steps: number;
            cfgScale: number;
            provider?: 'antigravity' | 'ollama' | 'sd-webui' | 'comfyui' | 'pollinations' | 'sd-cpp';
        }) => ({}),
        deletePreset: async (_id: string) => true,
        exportPresetShare: async (_id: string) => '',
        importPresetShare: async (_code: string) => ({}),
        listWorkflowTemplates: async () => [],
        saveWorkflowTemplate: async (_payload: {
            id?: string;
            name: string;
            description?: string;
            workflow: Record<string, unknown>;
        }) => ({}),
        deleteWorkflowTemplate: async (_id: string) => true,
        exportWorkflowTemplateShare: async (_id: string) => '',
        importWorkflowTemplateShare: async (_code: string) => ({}),
        schedule: async (_payload: {
            runAt: number;
            priority?: 'low' | 'normal' | 'high';
            resourceProfile?: 'balanced' | 'quality' | 'speed';
            options: {
                prompt: string;
                negativePrompt?: string;
                width?: number;
                height?: number;
                steps?: number;
                cfgScale?: number;
                seed?: number;
                count?: number;
            };
        }) => ({}),
        listSchedules: async () => [],
        cancelSchedule: async (_id: string) => true,
        compare: async (_ids: string[]) => ({}),
        exportComparison: async (_payload: { ids: string[]; format?: 'json' | 'csv' }) => '',
        shareComparison: async (_ids: string[]) => '',
        batchGenerate: async (_requests: Array<{
            prompt: string;
            negativePrompt?: string;
            width?: number;
            height?: number;
            steps?: number;
            cfgScale?: number;
            seed?: number;
            count?: number;
        }>) => [],
        getQueueStats: async () => ({ queued: 0, running: false, byPriority: {} }),
        searchHistory: async (_query: string, _limit?: number) => [],
        exportHistory: async (_format?: 'json' | 'csv') => '[]',
        edit: async (_options: {
            sourceImage: string;
            mode: 'img2img' | 'inpaint' | 'outpaint' | 'style-transfer';
            prompt: string;
            negativePrompt?: string;
            strength?: number;
            width?: number;
            height?: number;
            maskImage?: string;
        }) => '',
    },
    clipboard: {
        writeText: async (text: string) => {
            await navigator.clipboard.writeText(text);
            return { success: true };
        },
        readText: async () => {
            const text = await navigator.clipboard.readText();
            return { success: true, text };
        },
    },

    getOllamaHealthStatus: async () => ({ status: 'ok' as const }),
    forceOllamaHealthCheck: async () => ({ status: 'ok' as const }),
    checkCuda: async () => ({ hasCuda: true }),
    onOllamaStatusChange: (_callback: (status: { status: string }) => void) => { },
    onAgentEvent: (_callback: (payload: unknown) => void) => () => { },
    onSdCppStatus: (_callback: (data: unknown) => void) => () => { },
    onSdCppProgress: (_callback: (data: unknown) => void) => () => { },
    modelDownloader: {
        start: async (_request: Record<string, unknown>) => ({}),
        pause: async (_downloadId: string) => ({}),
        resume: async (_downloadId: string) => ({}),
        cancel: async (_downloadId: string) => ({}),
    },

    llama: {
        loadModel: async (_modelPath: string, _config?: Record<string, IpcValue>) => ({
            success: true,
        }),
        unloadModel: async () => ({ success: true }),
        chat: async (_message: string, _systemPrompt?: string) => ({
            success: true,
            response: 'Mock response',
        }),
        resetSession: async () => ({ success: true }),
        getModels: async () => [],
        downloadModel: async (_url: string, _filename: string) => ({ success: true }),
        deleteModel: async (_modelPath: string) => ({ success: true }),
        getConfig: async () => ({}),
        setConfig: async (_config: Record<string, IpcValue>) => ({ success: true }),
        getGpuInfo: async () => ({ available: true }),
        getModelsDir: async () => '/mock/dir',
        onToken: (_callback: (token: string) => void) => { },
        removeTokenListener: () => { },
        onDownloadProgress: (
            _callback: (progress: { downloaded: number; total: number }) => void
        ) => { },
        removeDownloadProgressListener: () => { },
    },

    db: {
        createChat: async (_chat: Chat) => ({ success: true }),
        updateChat: async (_id: string, _updates: Partial<Chat>) => ({ success: true }),
        deleteChat: async (_id: string) => ({ success: true }),
        duplicateChat: async (_id: string) => null,
        archiveChat: async (_id: string, _isArchived: boolean) => ({ success: true }),
        getChat: async (_id: string) => null,
        getAllChats: async () => [],
        searchChats: async (_query: string) => [],
        addMessage: async (_message: Message) => ({ success: true }),
        deleteMessage: async (_id: string) => ({ success: true }),
        updateMessage: async (_id: string, _updates: Partial<Message>) => ({ success: true }),
        deleteAllChats: async () => ({ success: true }),
        deleteMessages: async (_chatId: string) => ({ success: true }),
        getMessages: async (_chatId: string) => [],
        getStats: async () => ({ chatCount: 0, messageCount: 0, dbSize: 0 }),
        getDetailedStats: async (_period: string) => ({
            chatCount: 0,
            messageCount: 0,
            dbSize: 0,
            totalTokens: 0,
            promptTokens: 0,
            completionTokens: 0,
            tokenTimeline: [],
            activity: [],
        }),
        getTimeStats: async () => ({
            totalOnlineTime: 0,
            totalCodingTime: 0,
            workspaceCodingTime: {},
        }),
        getTokenStats: async (_period: 'daily' | 'weekly' | 'monthly') => ({
            totalSent: 0,
            totalReceived: 0,
            totalCost: 0,
            timeline: [],
            byProvider: {},
            byModel: {},
        }),
        addTokenUsage: async (_record: {
            messageId?: string;
            chatId: string;
            workspaceId?: string;
            provider: string;
            model: string;
            tokensSent: number;
            tokensReceived: number;
            costEstimate?: number;
        }) => ({ success: true }),
        getWorkspaces: async () => [],
        getFolders: async () => [],
        createWorkspace: async (
            _name: string,
            _path: string,
            _description: string,
            _mounts?: string
        ) =>
            ({
                id: 'mock-workspace-id',
                title: _name,
                description: _description,
                path: _path,
                mounts: [],
                chatIds: [],
                councilConfig: { enabled: false, members: [], consensusThreshold: 0.7 },
                status: 'active',
                metadata: {},
                createdAt: Date.now(),
                updatedAt: Date.now(),
            }) as Workspace,
        updateWorkspace: async (_id: string, _updates: Partial<Workspace>) => { },
        deleteWorkspace: async (_id: string, _deleteFiles?: boolean) => { },
        archiveWorkspace: async (_id: string, _isArchived: boolean) => { },
        bulkDeleteWorkspaces: async (_ids: string[], _deleteFiles?: boolean) => { },
        bulkArchiveWorkspaces: async (_ids: string[], _isArchived: boolean) => { },
        onWorkspaceUpdated: (_callback: (payload: { id?: string }) => void) => () => { },
        createFolder: async (_name: string, _color?: string) =>
            ({
                id: '1',
                name: _name,
                color: _color ?? 'blue',
                createdAt: new Date(),
                updatedAt: new Date(),
            }) as Folder,
        deleteFolder: async (_id: string) => { },
        updateFolder: async (_id: string, _updates: Partial<Folder>) => { },

        createPrompt: async (_title: string, _content: string, _tags?: string[]) => ({ id: '1' }),
        deletePrompt: async (_id: string) => { },
        updatePrompt: async (_id: string, _updates: Record<string, IpcValue>) => { },
        getPrompts: async () => [],
    },

    agent: {
        getAll: async () => [],
        get: async (_id: string) => null,
        create: async (_payload: {
            agent: {
                id?: string;
                name: string;
                description?: string;
                systemPrompt: string;
                tools?: string[];
                parentModel?: string;
                color?: string;
            };
            options?: { cloneFromId?: string; createWorkspace?: boolean };
        }) => ({ success: true, id: 'mock-agent-id', workspacePath: '/mock/agent-workspace' }),
        delete: async (
            _id: string,
            _options?: { confirm?: boolean; softDelete?: boolean; backupBeforeDelete?: boolean }
        ) => ({ success: true, archivedId: 'mock-archive-id', recoveryToken: 'mock-recovery-token' }),
        clone: async (_id: string, _newName?: string) => ({ success: true, id: 'mock-agent-clone-id' }),
        exportAgent: async (_id: string) => JSON.stringify({ version: 1, exportedAt: Date.now(), agent: { id: _id } }),
        importAgent: async (_payload: string) => ({ success: true, id: 'mock-imported-agent-id', workspacePath: '/mock/imported-agent-workspace' }),
        getTemplatesLibrary: async () => [],
        validateTemplate: async (_template: {
            name?: string;
            description?: string;
            systemPrompt?: string;
            tools?: string[];
            parentModel?: string;
            color?: string;
        }) => ({ valid: true, errors: [] }),
        recover: async (_archiveId: string) => ({ success: true, id: 'mock-recovered-agent-id' }),
    },

    modelRegistry: {
        getAllModels: async () => [],
        getRemoteModels: async () => [],
        getInstalledModels: async () => [],
    },

    terminal: {
        isAvailable: async () => true,
        getProfiles: async () => [],
        saveProfile: async (_profile: {
            id: string;
            name: string;
            shell: string;
            args?: string[];
            env?: Record<string, string | undefined>;
            icon?: string;
            isDefault?: boolean;
        }) => { },
        deleteProfile: async (_id: string) => { },
        validateProfile: async (_profile: {
            id: string;
            name: string;
            shell: string;
            args?: string[];
            env?: Record<string, string | undefined>;
            icon?: string;
            isDefault?: boolean;
        }) => ({ valid: true, errors: [] }),
        getProfileTemplates: async () => [],
        exportProfiles: async () => JSON.stringify({ version: 1, exportedAt: Date.now(), profiles: [] }),
        exportProfileShareCode: async (_profileId: string) => 'termprofile:mock',
        importProfiles: async (_payload: string, _options?: { overwrite?: boolean }) => ({
            success: true,
            imported: 0,
            skipped: 0,
            errors: [],
        }),
        importProfileShareCode: async (_shareCode: string, _options?: { overwrite?: boolean }) => ({
            success: true,
            imported: true,
            profileId: 'mock-profile',
        }),
        getShells: async () => [],
        getBackends: async () => [],
        getRuntimeHealth: async () => ({
            terminalAvailable: true,
            totalBackends: 1,
            availableBackends: 1,
            backends: [],
        }),
        create: async (_options: {
            id?: string;
            shell?: string;
            cwd?: string;
            cols?: number;
            rows?: number;
            backendId?: string;
            title?: string;
        }) => 'mock-session-id',
        detach: async (_options: {
            sessionId: string;
            title?: string;
            shell?: string;
            cwd?: string;
        }) => true,
        getCommandHistory: async (_query?: string, _limit?: number) => [],
        getSuggestions: async (_options: {
            command: string;
            shell: string;
            cwd: string;
            historyLimit?: number;
        }) => [],
        explainCommand: async (_options: { command: string; shell: string; cwd?: string }) => ({
            explanation: 'Mock explanation of command',
            breakdown: [],
            warnings: [],
            relatedCommands: [],
        }),
        explainError: async (_options: {
            errorOutput: string;
            command?: string;
            shell: string;
            cwd?: string;
        }) => ({
            summary: 'Mock error summary',
            cause: 'Mock cause',
            solution: 'Mock solution',
            steps: [],
        }),
        fixError: async (_options: {
            errorOutput: string;
            command: string;
            shell: string;
            cwd?: string;
        }) => ({
            suggestedCommand: 'echo "mock fix"',
            explanation: 'Mock fix explanation',
            confidence: 'low' as const,
            alternativeCommands: [],
        }),
        getDockerContainers: async () => [],
        clearCommandHistory: async () => true,
        close: async (_sessionId: string) => true,
        write: async (_sessionId: string, _data: string) => true,
        resize: async (_sessionId: string, _cols: number, _rows: number) => true,
        kill: async (_sessionId: string) => true,
        onData: (_callback: (data: { id: string; data: string }) => void) => () => { },
        onExit: (_callback: (data: { id: string; code: number }) => void) => () => { },
        removeAllListeners: () => { },
        getSessions: async () => [],
        restoreAllSnapshots: async () => ({ restored: 0, failed: 0, sessionIds: [] }),
        exportSession: async (_sessionId: string, _options?: { includeScrollback?: boolean }) =>
            JSON.stringify({ version: 1, kind: 'terminal-session', exportedAt: Date.now() }),
        importSession: async (_payload: string, _options?: { overwrite?: boolean; sessionId?: string }) => ({
            success: true,
            sessionId: 'mock-session-id',
        }),
        createSessionShareCode: async (_sessionId: string, _options?: { includeScrollback?: boolean }) =>
            'termshare:mock',
        importSessionShareCode: async (
            _shareCode: string,
            _options?: { overwrite?: boolean; sessionId?: string }
        ) => ({
            success: true,
            sessionId: 'mock-session-id',
        }),
        getSnapshotSessions: async () => [],
        getSessionTemplates: async () => [],
        saveSessionTemplate: async (_payload: { sessionId: string; templateId?: string; name?: string }) => ({
            id: 'tpl-mock',
            name: 'Mock Template',
            shell: 'bash',
            cwd: '/',
            cols: 80,
            rows: 24,
            backendId: 'node-pty',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        }),
        deleteSessionTemplate: async (_templateId: string) => true,
        createFromSessionTemplate: async (_templateId: string, _options?: { sessionId?: string; title?: string }) =>
            'mock-session-id',
        restoreSnapshotSession: async (_snapshotId: string) => true,
        searchScrollback: async (
            _sessionId: string,
            _query: string,
            _options?: { regex?: boolean; caseSensitive?: boolean; limit?: number }
        ) => [],
        exportScrollback: async (_sessionId: string, _exportPath?: string) => ({ success: true }),
        getSessionAnalytics: async (_sessionId: string) => ({
            sessionId: _sessionId,
            bytes: 0,
            lineCount: 0,
            commandCount: 0,
            updatedAt: 0,
        }),
        getSearchAnalytics: async () => ({
            totalSearches: 0,
            regexSearches: 0,
            plainSearches: 0,
            lastSearchAt: 0,
        }),
        getSearchSuggestions: async (_query?: string, _limit?: number) => [],
        exportSearchResults: async (
            _sessionId: string,
            _query: string,
            _options?: {
                regex?: boolean;
                caseSensitive?: boolean;
                limit?: number;
                exportPath?: string;
                format?: 'json' | 'txt';
            }
        ) => ({ success: true, content: '' }),
        addScrollbackMarker: async (_sessionId: string, _label: string, _lineNumber?: number) => ({
            id: 'mock-marker-id',
            sessionId: _sessionId,
            label: _label,
            lineNumber: _lineNumber ?? 1,
            createdAt: Date.now(),
        }),
        listScrollbackMarkers: async (_sessionId?: string) => [],
        deleteScrollbackMarker: async (_markerId: string) => true,
        filterScrollback: async (
            _sessionId: string,
            _options?: { query?: string; fromLine?: number; toLine?: number; caseSensitive?: boolean }
        ) => [],
        setSessionTitle: async (_sessionId: string, _title: string) => true,
        readBuffer: async (_sessionId: string) => '',
    },

    ssh: {
        connect: async (_connection: SSHConnection) => ({ success: true, id: '1' }),
        disconnect: async (_connectionId: string) => ({ success: true }),
        execute: async (
            _connectionId: string,
            _command: string,
            _options?: Record<string, IpcValue>
        ) => ({ stdout: '', stderr: '', code: 0 }),
        upload: async (_connectionId: string, _localPath: string, _remotePath: string) => ({
            success: true,
        }),
        download: async (_connectionId: string, _remotePath: string, _localPath: string) => ({
            success: true,
        }),
        listDir: async (_connectionId: string, _remotePath: string) => ({
            success: true,
            files: [],
        }),
        readFile: async (_connectionId: string, _remotePath: string) => ({
            success: true,
            content: '',
        }),
        writeFile: async (_connectionId: string, _remotePath: string, _content: string) => ({
            success: true,
        }),
        deleteDir: async (_connectionId: string, _path: string) => ({ success: true }),
        deleteFile: async (_connectionId: string, _path: string) => ({ success: true }),
        mkdir: async (_connectionId: string, _path: string) => ({ success: true }),
        rename: async (_connectionId: string, _oldPath: string, _newPath: string) => ({
            success: true,
        }),
        getConnections: async () => [],
        isConnected: async (_connectionId: string) => true,
        onStdout: (_callback: (data: string | Uint8Array) => void) => { },
        onStderr: (_callback: (data: string | Uint8Array) => void) => { },
        onConnected: (_callback: (connectionId: string) => void) => { },
        onDisconnected: (_callback: (connectionId: string) => void) => { },
        onUploadProgress: (
            _callback: (progress: { transferred: number; total: number }) => void
        ) => { },
        onDownloadProgress: (
            _callback: (progress: { transferred: number; total: number }) => void
        ) => { },
        removeAllListeners: () => { },
        onShellData: (_callback: (data: { data: string }) => void) => { },
        shellStart: async (_connectionId: string) => ({ success: true }),
        shellWrite: async (_connectionId: string, _data: string) => ({ success: true }),
        getSystemStats: async (_connectionId: string) =>
            ({
                uptime: '',
                memory: { total: 0, used: 0, percent: 0 },
                cpu: 0,
                disk: '0%',
            }) as SSHSystemStats,
        getInstalledPackages: async (_connectionId: string, _manager?: 'apt' | 'npm' | 'pip') => [],
        getLogFiles: async (_connectionId: string) => [],
        readLogFile: async (_connectionId: string, _path: string, _lines?: number) => '',
        getProfiles: async () => [],
        saveProfile: async (_profile: SSHConfig) => true,
        deleteProfile: async (_id: string) => true,
        createTunnel: async (_payload: {
            connectionId: string;
            type: 'local' | 'remote' | 'dynamic';
            localHost: string;
            localPort: number;
            remoteHost?: string;
            remotePort?: number;
        }) => ({ success: true, forwardId: 'mock-forward-id' }),
        listTunnels: async (_connectionId?: string) => [] as SSHPortForward[],
        closeTunnel: async (_forwardId: string) => true,
        saveTunnelPreset: async (preset: {
            name: string;
            type: 'local' | 'remote' | 'dynamic';
            localHost: string;
            localPort: number;
            remoteHost: string;
            remotePort: number;
        }) =>
            ({
                ...preset,
                id: 'mock-preset-id',
                createdAt: Date.now(),
                updatedAt: Date.now()
            }) as SSHTunnelPreset,
        listTunnelPresets: async () => [] as SSHTunnelPreset[],
        deleteTunnelPreset: async (_id: string) => true,
        listManagedKeys: async () => [],
        generateManagedKey: async (_payload: { name: string; passphrase?: string }) => ({
            key: {
                id: 'mock-key',
                name: _payload.name,
                algorithm: 'ed25519',
                publicKey: '',
                fingerprint: '',
                hasPassphrase: Boolean(_payload.passphrase),
                createdAt: Date.now(),
                updatedAt: Date.now(),
                rotationCount: 0
            } as SSHManagedKey,
            privateKey: '',
            publicKey: ''
        }),
        importManagedKey: async (_payload: { name: string; privateKey: string; passphrase?: string }) => ({
            id: 'mock-key',
            name: _payload.name,
            algorithm: 'ed25519',
            publicKey: '',
            fingerprint: '',
            hasPassphrase: Boolean(_payload.passphrase),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            rotationCount: 0
        }),
        deleteManagedKey: async (_id: string) => true,
        rotateManagedKey: async (_payload: { id: string; nextPassphrase?: string }) => ({
            id: _payload.id,
            name: 'mock-key',
            algorithm: 'ed25519',
            publicKey: '',
            fingerprint: '',
            hasPassphrase: Boolean(_payload.nextPassphrase),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            rotationCount: 1
        }),
        backupManagedKey: async (_id: string) => ({ filename: 'mock.pem', privateKey: '' }),
        listKnownHosts: async () => [],
        addKnownHost: async (_payload: SSHKnownHostEntry) => true,
        removeKnownHost: async (_payload: { host: string; keyType?: string }) => true,
        searchRemoteFiles: async (_payload: {
            connectionId: string;
            query: string;
            options?: { path?: string; contentSearch?: boolean; limit?: number };
        }) => [] as SSHRemoteSearchResult[],
        getSearchHistory: async (_connectionId?: string) => [] as SSHSearchHistoryEntry[],
        exportSearchHistory: async () => '[]',
        reconnect: async (_connectionId: string, _retries?: number) => ({ success: true }),
        acquireConnection: async (_connectionId: string) => ({ success: true }),
        releaseConnection: async (_connectionId: string) => true,
        getConnectionPoolStats: async () => [],
        enqueueTransfer: async (_task: SSHTransferTask) => { },
        getTransferQueue: async () => [] as SSHTransferTask[],
        runTransferBatch: async (_tasks: SSHTransferTask[], _concurrency?: number) => [],
        listRemoteContainers: async (_connectionId: string) => [] as SSHDevContainer[],
        runRemoteContainer: async (_payload: {
            connectionId: string;
            image: string;
            name: string;
            ports?: Array<{ hostPort: number; containerPort: number }>;
        }) => ({ success: true, id: 'mock-container' }),
        stopRemoteContainer: async (_connectionId: string, _containerId: string) => true,
        saveProfileTemplate: async (template: {
            name: string;
            port: number;
            username: string;
            tags?: string[];
        }) =>
            ({
                ...template,
                id: 'mock-template',
                createdAt: Date.now(),
                updatedAt: Date.now()
            }) as SSHProfileTemplate,
        listProfileTemplates: async () => [] as SSHProfileTemplate[],
        deleteProfileTemplate: async (_id: string) => true,
        exportProfiles: async (_ids?: string[]) => '[]',
        importProfiles: async (_payload: string) => 0,
        validateProfile: async (_profile: Partial<SSHConnection>) => ({ valid: true, errors: [] }),
        testProfile: async (_profile: Partial<SSHConnection>) => ({
            success: true,
            latencyMs: 50,
            authMethod: (_profile.privateKey ? 'key' : 'password') as 'password' | 'key',
            message: 'Mock profile test passed'
        }),
        startSessionRecording: async (_connectionId: string) => ({
            id: 'mock-recording',
            connectionId: _connectionId,
            startedAt: Date.now(),
            chunks: []
        }),
        stopSessionRecording: async (_connectionId: string) =>
            ({
                id: 'mock-recording',
                connectionId: _connectionId,
                startedAt: Date.now() - 1000,
                endedAt: Date.now(),
                chunks: []
            }) as SSHSessionRecording,
        getSessionRecording: async (_connectionId: string) => null,
        searchSessionRecording: async (_connectionId: string, _query: string) => [],
        exportSessionRecording: async (_connectionId: string) => '',
        listSessionRecordings: async () => [] as SSHSessionRecording[],
    },

    git: {
        getBranch: async (_cwd: string) => ({ success: true, branch: 'main' }),
        getStatus: async (_cwd: string) => ({
            success: true,
            isClean: true,
            changes: 0,
            files: [],
        }),
        getLastCommit: async (_cwd: string) => ({
            success: true,
            hash: 'abc123',
            message: 'Initial commit',
            author: 'User',
            relativeTime: '2 hours ago',
            date: new Date().toISOString(),
        }),
        getRecentCommits: async (_cwd: string, _count?: number) => ({ success: true, commits: [] }),
        getBranches: async (_cwd: string) => ({ success: true, branches: ['main'] }),
        isRepository: async (_cwd: string) => ({ success: true, isRepository: true }),
        getFileDiff: async (_cwd: string, _filePath: string, _staged?: boolean) => ({
            success: true,
            original: '',
            modified: '',
        }),
        getUnifiedDiff: async (_cwd: string, _filePath: string, _staged?: boolean) => ({
            success: true,
            diff: '',
        }),
        stageFile: async (_cwd: string, _filePath: string) => ({ success: true }),
        unstageFile: async (_cwd: string, _filePath: string) => ({ success: true }),
        getDetailedStatus: async (_cwd: string) => ({
            success: true,
            stagedFiles: [],
            unstagedFiles: [],
            allFiles: [],
        }),
        checkout: async (_cwd: string, _branch: string) => ({ success: true }),
        commit: async (_cwd: string, _message: string) => ({ success: true }),
        push: async (_cwd: string, _remote?: string, _branch?: string) => ({
            success: true,
            stdout: '',
            stderr: '',
        }),
        pull: async (_cwd: string) => ({ success: true, stdout: '', stderr: '' }),
        getRemotes: async (_cwd: string) => ({ success: true, remotes: [] }),
        getTrackingInfo: async (_cwd: string) => ({
            success: true,
            tracking: null,
            ahead: 0,
            behind: 0,
        }),
        getCommitStats: async (_cwd: string, _days?: number) => ({
            success: true,
            commitCounts: {},
        }),
        getDiffStats: async (_cwd: string) => ({
            success: true,
            staged: { added: 0, deleted: 0, files: 0 },
            unstaged: { added: 0, deleted: 0, files: 0 },
            total: { added: 0, deleted: 0, files: 0 },
        }),
        getCommitDiff: async (_cwd: string, _hash: string) => ({ success: true, diff: '' }),
    },

    executeTools: async (
        _toolName: string,
        _args: Record<string, IpcValue>,
        _toolCallId?: string
    ) =>
        ({
            toolCallId: _toolCallId ?? 'mock',
            name: _toolName,
            success: true,
            result: null,
        }) as ToolResult,
    killTool: async (_toolCallId: string) => true,
    getToolDefinitions: async () => [],

    mcp: {
        list: async () => [],
        dispatch: async (
            _service: string,
            _action: string,
            _args?: Record<string, IpcValue>
        ) => ({}),
        toggle: async (_service: string, _enabled: boolean) => ({ success: true, isEnabled: true }),
        install: async (_config: Record<string, IpcValue>) => ({ success: true }),
        uninstall: async (_name: string) => ({ success: true }),
        getDebugMetrics: async () => [],
        listPermissionRequests: async () => [],
        setActionPermission: async (_service: string, _action: string, _policy: 'allow' | 'deny' | 'ask') => ({ success: true }),
        resolvePermissionRequest: async (_requestId: string, _decision: 'approved' | 'denied') => ({ success: true }),
        onResult: (_callback: (result: IpcValue) => void) => { },
        removeResultListener: () => { },
    },

    proxyEmbed: {
        start: async (_options?: Record<string, IpcValue>) => ({}),
        stop: async () => ({}),
        status: async () => ({}),
    },

    captureScreenshot: async () => ({ success: true }),
    captureCookies: async (_url: string, _timeoutMs?: number) => ({ success: true }),
    openExternal: (_url: string) => { },
    openTerminal: async (_command: string) => true,
    runCommand: async (_command: string, _args: string[], _cwd?: string) => ({
        stdout: '',
        stderr: '',
        code: 0,
    }),

    readPdf: async (_path: string) => ({ success: true, text: '' }),
    selectDirectory: async () => ({ success: true, path: '' }),
    listDirectory: async (_path: string) => ({ success: true, files: [] }),
    readFile: async (_path: string) => ({ success: true, content: '' }),
    writeFile: async (_path: string, _content: string) => ({ success: true }),
    createDirectory: async (_path: string) => ({ success: true }),
    deleteFile: async (_path: string) => ({ success: true }),
    deleteDirectory: async (_path: string) => ({ success: true }),
    renamePath: async (_oldPath: string, _newPath: string) => ({ success: true }),
    searchFiles: async (_rootPath: string, _pattern: string) => ({ success: true, matches: [] }),
    saveFile: async (_content: string, _filename: string) => ({ success: true, path: '' }),
    exportChatToPdf: async (_chatId: string, _title: string) => ({ success: true, path: '' }),
    // Export
    exportMarkdown: async (_content: string, _filePath: string) => ({ success: true }),
    exportPDF: async (_htmlContent: string, _filePath: string) => ({ success: true }),

    getSettings: async () => ({}) as AppSettings,
    saveSettings: async (_settings: AppSettings) => { },

    huggingface: {
        searchModels: async (_query: string, _limit: number, _page: number, _sort: string) => ({
            models: [],
            total: 0,
        }),
        getRecommendations: async (_limit?: number, _query?: string) => [],
        getFiles: async (_modelId: string) => [],
        getModelPreview: async (_modelId: string) => null,
        compareModels: async (_modelIds: string[]) => ({ previews: [], recommendation: {} }),
        validateCompatibility: async (
            _file: { path: string; size: number; oid?: string; quantization: string },
            _availableRamGB?: number,
            _availableVramGB?: number
        ) => ({ compatible: true, reasons: [], estimatedRamGB: 0, estimatedVramGB: 0 }),
        getWatchlist: async () => [],
        addToWatchlist: async (_modelId: string) => ({ success: true }),
        removeFromWatchlist: async (_modelId: string) => ({ success: true }),
        getCacheStats: async () => ({ size: 0, maxSize: 0, ttlMs: 0, oldestAgeMs: 0, watchlistSize: 0 }),
        clearCache: async () => ({ success: true, removed: 0 }),
        testDownloadedModel: async (_filePath: string) => ({ success: true, metadata: {} }),
        getConversionPresets: async () => [],
        getOptimizationSuggestions: async (_options: {
            sourcePath: string;
            outputPath: string;
            quantization: string;
            preset?: string;
            modelId?: string;
        }) => [],
        validateConversion: async (_options: {
            sourcePath: string;
            outputPath: string;
            quantization: string;
            preset?: string;
            modelId?: string;
        }) => ({ valid: true, errors: [] }),
        convertModel: async (_options: {
            sourcePath: string;
            outputPath: string;
            quantization: string;
            preset?: string;
            modelId?: string;
        }) => ({ success: true, warnings: [] }),
        onConversionProgress: (
            _callback: (progress: { stage: string; percent: number; message: string }) => void
        ) => () => { },
        getModelVersions: async (_modelId: string) => [],
        registerModelVersion: async (_modelId: string, _filePath: string, _notes?: string) => null,
        compareModelVersions: async (_modelId: string, _leftVersionId: string, _rightVersionId: string) => null,
        rollbackModelVersion: async (_modelId: string, _versionId: string, _targetPath: string) => ({ success: true }),
        pinModelVersion: async (_modelId: string, _versionId: string, _pinned: boolean) => ({ success: true }),
        getVersionNotifications: async (_modelId: string) => [],
        prepareFineTuneDataset: async (_inputPath: string, _outputPath: string) => ({ success: true, outputPath: _outputPath, records: 0 }),
        startFineTune: async (
            _modelId: string,
            _datasetPath: string,
            _outputPath: string,
            _options?: { epochs?: number; learningRate?: number }
        ) => null,
        listFineTuneJobs: async (_modelId?: string) => [],
        getFineTuneJob: async (_jobId: string) => null,
        cancelFineTuneJob: async (_jobId: string) => ({ success: true }),
        evaluateFineTuneJob: async (_jobId: string) => ({ success: true, metrics: {} }),
        exportFineTunedModel: async (_jobId: string, _exportPath: string) => ({ success: true }),
        onFineTuneProgress: (_callback: (job: unknown) => void) => () => { },
        downloadFile: async (
            _url: string,
            _outputPath: string,
            _expectedSize: number,
            _expectedSha256: string,
            _scheduleAtMs?: number
        ) => ({ success: true }),
        onDownloadProgress: (
            _callback: (progress: { filename: string; received: number; total: number }) => void
        ) => { },
        cancelDownload: () => { },
    },

    log: {
        write: (
            _level: 'debug' | 'info' | 'warn' | 'error',
            _message: string,
            _data?: IpcValue
        ) => { },
        debug: (_message: string, _data?: IpcValue) => { },
        info: (_message: string, _data?: IpcValue) => { },
        warn: (_message: string, _data?: IpcValue) => { },
        error: (_message: string, _data?: IpcValue) => { },
    },

    gallery: {
        list: async () => [],
        delete: async (_path: string) => true,
        open: async (_path: string) => true,
        reveal: async (_path: string) => true,
        batchDownload: async (_input: { filePaths: string[]; targetDirectory: string }) => ({
            success: true,
            copied: 0,
            skipped: 0,
            errors: [],
        }),
    },

    getUserDataPath: async () => '',
    update: {
        checkForUpdates: async () => { },
        downloadUpdate: async () => { },
        installUpdate: async () => { },
    },

    collaboration: {
        run: async (_request: {
            messages: Message[];
            models: Array<{ provider: string; model: string }>;
            strategy?: string;
        }) => ({
            response: 'Mock collaboration response',
            modelContributions: [],
            responses: [],
        }),
        getProviderStats: async () => [],
        getActiveTaskCount: async () => 0,
        setProviderConfig: async (
            _provider: string,
            _config: { concurrencyLimit?: number; rateLimit?: number }
        ) => { },
    },
    modelCollaboration: {
        run: async (_request: {
            messages: Message[];
            models: Array<{ provider: string; model: string }>;
            strategy?: string;
        }) => ({
            response: 'Mock collaboration response',
            modelContributions: [],
            responses: [],
        }),
        getProviderStats: async () => [],
        getActiveTaskCount: async () => 0,
        setProviderConfig: async (
            _provider: string,
            _config: { concurrencyLimit?: number; rateLimit?: number }
        ) => { },
    },

    audit: {
        getLogs: async (_startDate?: string, _endDate?: string, _category?: string) => [],
    },

    memory: {
        getAll: async () => ({ facts: [], episodes: [], entities: [] }),
        addFact: async (_content: string, _tags?: string[]) => ({ success: true, id: '1' }),
        deleteFact: async (_id: string) => ({ success: true }),
        deleteEntity: async (_id: string) => ({ success: true }),
        setEntityFact: async (
            _entityType: string,
            _entityName: string,
            _key: string,
            _value: string
        ) => ({ success: true, id: '1' }),
        search: async (_query: string) => ({ facts: [], episodes: [] }),
    },
    advancedMemory: {
        getPending: async () => ({ success: true, data: [] }),
        confirm: async (_id: string, _adjustments?: unknown) => ({
            success: true,
            data: undefined,
        }),
        reject: async (_id: string, _reason?: string) => ({ success: true }),
        confirmAll: async () => ({ success: true, confirmed: 0 }),
        rejectAll: async () => ({ success: true, rejected: 0 }),
        remember: async (_content: string, _options?: unknown) => ({
            success: true,
            data: undefined,
        }),
        recall: async (_context: unknown) => ({
            success: true,
            data: { memories: [], totalMatches: 0 },
        }),
        search: async (_query: string, _limit?: number) => ({ success: true, data: [] }),
        getSearchAnalytics: async () => ({
            success: true,
            data: {
                totalQueries: 0,
                semanticQueries: 0,
                textQueries: 0,
                hybridQueries: 0,
                averageResults: 0,
                topQueries: [],
            }
        }),
        getSearchHistory: async (_limit?: number) => ({
            success: true,
            data: []
        }),
        getSearchSuggestions: async (_prefix?: string, _limit?: number) => ({
            success: true,
            data: []
        }),
        export: async (_query?: string, _limit?: number) => ({
            success: true,
            data: {
                exportedAt: new Date().toISOString(),
                count: 0,
                memories: []
            }
        }),
        import: async (_payload: {
            memories?: Array<Partial<AdvancedSemanticFragment>>;
            pendingMemories?: Array<Partial<PendingMemory>>;
            replaceExisting?: boolean;
        }) => ({
            success: true,
            data: {
                imported: 0,
                pendingImported: 0,
                skipped: 0,
                errors: []
            }
        }),
        getStats: async () => ({ success: true, data: undefined }),
        runDecay: async () => ({ success: true }),
        extractFromMessage: async (_content: string, _sourceId: string, _workspaceId?: string) => ({
            success: true,
            data: [],
        }),
        delete: async (_id: string) => ({ success: true }),
        deleteMany: async (_ids: string[]) => ({ success: true, deleted: 0, failed: [] }),
        edit: async (_id: string, _updates: unknown) => ({ success: true, data: undefined }),
        archive: async (_id: string) => ({ success: true }),
        archiveMany: async (_ids: string[]) => ({ success: true, archived: 0, failed: [] }),
        restore: async (_id: string) => ({ success: true }),
        get: async (_id: string) => ({ success: true, data: undefined }),
        shareWithWorkspace: async (_id: string, _workspaceId: string) => ({ success: true }),
        createSharedNamespace: async (_payload: {
            id: string;
            name: string;
            workspaceIds: string[];
            accessControl?: Record<string, string[]>;
        }) => ({
            success: true,
            data: {
                ..._payload,
                accessControl: _payload.accessControl ?? {},
                createdAt: Date.now(),
                updatedAt: Date.now()
            }
        }),
        syncSharedNamespace: async (_request: {
            namespaceId: string;
            sourceWorkspaceId: string;
            targetWorkspaceIds?: string[];
            memoryIds?: string[];
            resolution?: 'keep_source' | 'keep_target' | 'merge_copy' | 'manual_review';
        }) => ({
            success: true,
            data: {
                namespaceId: _request.namespaceId,
                synced: 0,
                skipped: 0,
                conflicts: [],
                updatedAt: Date.now()
            }
        }),
        getSharedNamespaceAnalytics: async (_namespaceId: string) => ({
            success: true,
            data: {
                namespaceId: _namespaceId,
                totalMemories: 0,
                totalWorkspaces: 0,
                conflicts: 0,
                memoriesByWorkspace: {},
                updatedAt: Date.now()
            }
        }),
        searchAcrossWorkspaces: async (_payload: {
            namespaceId: string;
            query: string;
            workspaceId: string;
            limit?: number;
        }) => ({ success: true, data: [] }),
        getHistory: async (_id: string) => ({ success: true, data: [] }),
        rollback: async (_id: string, _versionIndex: number) => ({ success: true }),
        recategorize: async (_ids?: string[]) => ({ success: true }),
        getAllEntityKnowledge: async () => ({ success: true, data: [] }),
        getAllEpisodes: async () => ({ success: true, data: [] }),
        getAllAdvancedMemories: async () => ({ success: true, data: [] }),
        health: async () => ({
            success: true,
            data: {
                status: 'healthy' as const,
                uiState: 'ready' as const,
                budgets: { fastMs: 40, standardMs: 120, heavyMs: 250 },
                metrics: {}
            }
        }),
    },
    ideas: {
        createSession: async (config: unknown) => ({
            ...(config as Record<string, unknown>),
            id: '1',
            ideasGenerated: 0,
            status: 'active',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        }),
        getSession: async (_id: string) => null,
        getSessions: async () => [],
        cancelSession: async (_id: string) => ({ success: true }),
        generateMarketPreview: async (_categories: string[]) => ({ success: true, data: [] }),
        startResearch: async (_sessionId: string) => ({ success: true }),
        startGeneration: async (_sessionId: string) => ({ success: true }),
        enrichIdea: async (_ideaId: string) => ({ success: true }),
        getIdea: async (_id: string) => null,
        getIdeas: async (_sessionId?: string) => [],
        regenerateIdea: async (_ideaId: string) => ({ success: true, idea: undefined }),
        approveIdea: async (_ideaId: string, _workspacePath: string, _selectedName?: string) => ({
            success: true,
        }),
        rejectIdea: async (_ideaId: string) => ({ success: true }),
        canGenerateLogo: async () => false,
        generateLogo: async (
            _ideaId: string,
            _options: { prompt: string; style: string; model: string; count: number }
        ) => ({ success: true, logoPaths: [] }),
        queryResearch: async (_ideaId: string, _question: string) => ({
            success: true,
            answer: 'Mock research answer',
        }),
        // Deep research handlers
        deepResearch: async (_topic: string, _category: string) => ({ success: true }),
        validateIdea: async (_title: string, _description: string, _category: string) => ({
            success: true,
        }),
        clearResearchCache: async () => ({ success: true }),
        // Scoring handlers
        scoreIdea: async (_ideaId: string) => ({ success: true, score: 75 }),
        rankIdeas: async (_ideaIds: string[]) => ({ success: true, ranked: [] }),
        compareIdeas: async (_ideaId1: string, _ideaId2: string) => ({ success: true }),
        quickScore: async (_title: string, _description: string, _category: string) => ({
            success: true,
            score: 50,
        }),
        // Data management handlers
        deleteIdea: async (_ideaId: string) => ({ success: true }),
        deleteSession: async (_sessionId: string) => ({ success: true }),
        archiveIdea: async (_ideaId: string) => ({ success: true }),
        restoreIdea: async (_ideaId: string) => ({ success: true }),
        getArchivedIdeas: async (_sessionId?: string) => [],
        // Progress events
        onResearchProgress: () => () => { },
        onIdeaProgress: () => () => { },
        onDeepResearchProgress: () => () => { },
    },

    batch: {
        invoke: async (_requests: Array<{ channel: string; args: IpcValue[] }>) => ({
            results: [],
            timing: { startTime: Date.now(), endTime: Date.now(), totalMs: 0 },
        }),
        invokeSequential: async (_requests: Array<{ channel: string; args: IpcValue[] }>) => ({
            results: [],
            timing: { startTime: Date.now(), endTime: Date.now(), totalMs: 0 },
        }),
        getChannels: async () => [],
    },
    lazyServices: {
        getStatus: async () => ({
            registered: [],
            loaded: [],
            loading: [],
            totals: { registered: 0, loaded: 0, loading: 0 },
        }),
    },
    ipcContract: {
        getVersion: async () => ({ version: 1, minRendererVersion: 1, minMainVersion: 1 }),
        isCompatible: async () => true,
    },

    ipcRenderer: {
        on:
            (
                _channel: string,
                _listener: (event: IpcRendererEvent, ..._args: IpcValue[]) => void
            ) =>
                () => { },
        off: (
            _channel: string,
            _listener: (event: IpcRendererEvent, ..._args: IpcValue[]) => void
        ) => { },
        send: (_channel: string, ..._args: IpcValue[]) => { },
        invoke: async (_channel: string, ..._args: IpcValue[]) => ({}),
        removeAllListeners: (_channel: string) => { },
    },
    on:
        (_channel: string, _listener: (event: IpcRendererEvent, ..._args: IpcValue[]) => void) =>
            () => { },
    orchestrator: {
        start: async (_task: unknown, _workspaceId: unknown) => { },
        approve: async (_plan: unknown) => { },
        getState: async () => ({
            status: 'idle',
            currentTask: '',
            plan: [],
            history: [],
            assignments: {}
        }),
        stop: async () => { },
        onUpdate: (_callback: unknown) => () => { },
    },
    session: {
        conversation: {
            complete: async (_request: import('@shared/types').ChatRequest) => ({
                content: 'Mock response',
            }),
            stream: async (_request: import('@shared/types').ChatStreamRequest) => ({ success: true }),
            abort: (_chatId: string) => { },
            onStreamChunk: (
                _callback: (
                    chunk: import('@shared/types/session-conversation').SessionConversationStreamChunk
                ) => void
            ) => () => { },
            onGenerationStatus: (
                _callback: (
                    data: import('@shared/types/session-conversation').SessionConversationGenerationStatus
                ) => void
            ) => () => { },
        },
        automation: {
            start: async (_options: import('@shared/types/automation-workflow').AgentStartOptions) => ({
                taskId: '',
            }),
            generatePlan: async (_options: import('@shared/types/automation-workflow').AgentStartOptions) => ({
                taskId: '',
            }),
            approvePlan: async (
                _plan: string[] | import('@shared/types/automation-workflow').WorkspaceStep[],
                _taskId?: string
            ) => undefined,
            stop: async (_taskId?: string) => undefined,
            pauseTask: async (_taskId: string) => ({ success: true as const }),
            resumeTask: async (_taskId: string) => ({ success: true }),
            saveSnapshot: async (_taskId: string) => ({ success: true, checkpointId: '' }),
            approveCurrentPlan: async (_taskId: string) => ({ success: true }),
            rejectCurrentPlan: async (_taskId: string, _reason?: string) => ({ success: true }),
            resetState: async (_taskId?: string) => undefined,
            getStatus: async (_taskId?: string) => ({
                status: 'idle' as const,
                currentTask: '',
                plan: [],
                history: [],
            }),
            getTaskMessages: async (_taskId: string) => ({ success: true, messages: [] }),
            getTaskEvents: async (_taskId: string) => ({ success: true, events: [] }),
            getTaskTelemetry: async (_taskId: string) => ({ success: true, telemetry: [] }),
            getTaskHistory: async (_workspaceId?: string) => [],
            deleteTask: async (_taskId: string) => ({ success: true }),
            getAvailableModels: async () => ({ success: true, models: [] }),
            retryStep: async (_index: number, _taskId?: string) => undefined,
            selectModel: async (_payload: {
                taskId: string;
                provider: string;
                model: string;
            }) => ({ success: true }),
            approveStep: async (_taskId: string, _stepId: string) => undefined,
            skipStep: async (_taskId: string, _stepId: string) => undefined,
            editStep: async (_taskId: string, _stepId: string, _text: string) => undefined,
            addStepComment: async (_taskId: string, _stepId: string, _comment: string) => undefined,
            insertInterventionPoint: async (_taskId: string, _afterStepId: string) => undefined,
            getCheckpoints: async (_taskId: string) => [],
            resumeCheckpoint: async (_checkpointId: string) => undefined,
            rollbackCheckpoint: async (_checkpointId: string) => null,
            getPlanVersions: async (_taskId: string) => [],
            deleteTaskByNodeId: async (_nodeId: string) => false,
            createPullRequest: async (_taskId?: string) => null,
            getProfiles: async () => [],
            getRoutingRules: async () => [],
            setRoutingRules: async (_rules: import('@shared/types/automation-workflow').ModelRoutingRule[]) => ({
                success: true as const,
            }),
            getTemplates: async (_category?: import('@shared/types/automation-workflow').AgentTemplateCategory) => [],
            getTemplate: async (_id: string) => null,
            saveTemplate: async (template: import('@shared/types/automation-workflow').AgentTemplate) => ({
                success: true,
                template,
            }),
            deleteTemplate: async (_id: string) => ({ success: true }),
            exportTemplate: async (_id: string) => null,
            importTemplate: async (_exported: import('@shared/types/automation-workflow').AgentTemplateExport) => ({
                success: false,
                error: 'Not available in web bridge',
            }),
            applyTemplate: async (_payload: {
                templateId: string;
                values: Record<string, string | number | boolean>;
            }) => ({
                success: false,
                error: 'Not available in web bridge',
            }),
        },
        workspace: {
            saveCanvasNodes: async (
                _nodes: import('@shared/types/session-workspace').SessionCanvasNodeRecord[]
            ) => undefined,
            getCanvasNodes: async () => [],
            deleteCanvasNode: async (_id: string) => undefined,
            saveCanvasEdges: async (
                _edges: import('@shared/types/session-workspace').SessionCanvasEdgeRecord[]
            ) => undefined,
            getCanvasEdges: async () => [],
            deleteCanvasEdge: async (_id: string) => undefined,
        },
        council: {
            generatePlan: async (_taskId: string, _task: string) => ({ success: true }),
            getProposal: async (_taskId: string) => ({ success: true, plan: [] }),
            approveProposal: async (_taskId: string) => ({ success: true }),
            rejectProposal: async (_taskId: string, _reason?: string) => ({ success: true }),
            startExecution: async (_taskId: string) => ({ success: true }),
            pauseExecution: async (_taskId: string) => ({ success: true }),
            resumeExecution: async (_taskId: string) => ({ success: true }),
            getTimeline: async (_taskId: string) => ({ success: true, events: [] }),
            createVotingSession: async (_payload: {
                taskId: string;
                stepIndex: number;
                question: string;
                options: string[];
            }) => null,
            submitVote: async (_payload: {
                sessionId: string;
                modelId: string;
                provider: string;
                decision: string;
                confidence: number;
                reasoning?: string;
            }) => null,
            requestVotes: async (_payload: {
                sessionId: string;
                models: Array<{ provider: string; model: string }>;
            }) => null,
            resolveVoting: async (_sessionId: string) => null,
            getVotingSession: async (_sessionId: string) => null,
            listVotingSessions: async (_taskId?: string) => [],
            getVotingAnalytics: async (_taskId?: string) => ({
                totalSessions: 0,
                pendingSessions: 0,
                resolvedSessions: 0,
                deadlockedSessions: 0,
                averageVotesPerSession: 0,
                averageConfidence: 0,
                disagreementIndex: 0,
                updatedAt: Date.now(),
            }),
            getVotingConfiguration: async () => ({
                minimumVotes: 2,
                deadlockThreshold: 0.5,
                autoResolve: true,
                autoResolveTimeoutMs: 30000,
            }),
            updateVotingConfiguration: async (patch: Partial<import('@shared/types/automation-workflow').VotingConfiguration>) => ({
                minimumVotes: patch.minimumVotes ?? 2,
                deadlockThreshold: patch.deadlockThreshold ?? 0.5,
                autoResolve: patch.autoResolve ?? true,
                autoResolveTimeoutMs: patch.autoResolveTimeoutMs ?? 30000,
            }),
            listVotingTemplates: async () => [],
            buildConsensus: async (_outputs: Array<{ modelId: string; provider: string; output: string }>) => null,
            overrideVotingDecision: async (_payload: {
                sessionId: string;
                finalDecision: string;
                reason?: string;
            }) => null,
            createDebateSession: async (_payload: {
                taskId: string;
                stepIndex: number;
                topic: string;
            }) => null,
            submitDebateArgument: async (_payload: {
                sessionId: string;
                agentId: string;
                provider: string;
                side: import('@shared/types/automation-workflow').DebateSide;
                content: string;
                confidence: number;
                citations?: import('@shared/types/automation-workflow').DebateCitation[];
            }) => null,
            resolveDebateSession: async (_sessionId: string) => null,
            overrideDebateSession: async (_payload: {
                sessionId: string;
                moderatorId: string;
                decision: import('@shared/types/automation-workflow').DebateSide | 'balanced';
                reason?: string;
            }) => null,
            getDebateSession: async (_sessionId: string) => null,
            listDebateHistory: async (_taskId?: string) => [],
            getDebateReplay: async (_sessionId: string) => null,
            generateDebateSummary: async (_sessionId: string) => null,
            getTeamworkAnalytics: async () => null,
            sendMessage: async (_payload: {
                taskId: string;
                stageId: string;
                fromAgentId: string;
                toAgentId?: string;
                intent: import('@shared/types/automation-workflow').AgentCollaborationIntent;
                priority?: import('@shared/types/automation-workflow').AgentCollaborationPriority;
                payload: Record<string, string | number | boolean | null>;
                expiresAt?: number;
            }) => null,
            getMessages: async (_payload: {
                taskId: string;
                stageId?: string;
                agentId?: string;
                includeExpired?: boolean;
            }) => [],
            cleanupExpiredMessages: async (_taskId?: string) => ({ success: true, removed: 0 }),
            handleQuotaInterrupt: async (_payload: {
                taskId: string;
                stageId?: string;
                provider: string;
                model: string;
                reason?: string;
                autoSwitch?: boolean;
            }) => null,
            registerWorkerAvailability: async (_payload: {
                taskId: string;
                agentId: string;
                status: 'available' | 'busy' | 'offline';
                reason?: string;
                skills?: string[];
                contextReadiness?: number;
            }) => null,
            listAvailableWorkers: async (_payload: { taskId: string }) => [],
            scoreHelperCandidates: async (_payload: {
                taskId: string;
                stageId: string;
                requiredSkills: string[];
                blockedAgentIds?: string[];
                contextReadinessOverrides?: Record<string, number>;
            }) => [],
            generateHelperHandoff: async (_payload: {
                taskId: string;
                stageId: string;
                ownerAgentId: string;
                helperAgentId: string;
                stageGoal: string;
                acceptanceCriteria: string[];
                constraints: string[];
                contextNotes?: string;
            }) => null,
            reviewHelperMerge: async (_payload: {
                acceptanceCriteria: string[];
                constraints: string[];
                helperOutput: string;
                reviewerNotes?: string;
            }) => ({
                accepted: false,
                verdict: 'REVISE' as const,
                reasons: [],
                requiredFixes: [],
                reviewedAt: Date.now(),
            }),
            onQuotaInterrupt: (
                _callback: (payload: import('@shared/types/session-engine').SessionCouncilQuotaInterruptEvent) => void
            ) => () => { },
        },
        getState: async (_sessionId: string) => null,
        list: async () => [],
        listCapabilities: async () => [],
        health: async () => ({
            status: 'ready' as const,
            activeSessions: 0,
        }),
        onEvent: (_callback: (event: import('@shared/types/session-engine').SessionEventEnvelope) => void) => () => { },
    },
    metrics: {
        getProviderStats: async () => ({}),
        getSummary: async () => ({ totalRequests: 0, successRate: 0, avgLatencyMs: 0, providers: [] }),
        reset: async () => false,
    },
    usage: {
        checkLimit: async () => ({ allowed: true }),
        getUsageCount: async () => 0,
        recordUsage: async () => ({ success: true }),
    },
    voice: {
        getSettings: async () => ({
            enabled: false,
            wakeWord: 'tengra',
            customWakeWords: [],
            recognitionLanguage: 'en-US',
            synthesisVoice: '',
            speechRate: 1.0,
            speechPitch: 1.0,
            speechVolume: 0.8,
            audioFeedback: true,
            visualFeedback: true,
            accessibilityMode: false,
            shortcuts: [],
            customCommands: [],
            continuousListening: false,
            silenceTimeout: 1500,
        }),
        updateSettings: async (_settings: Partial<import('@shared/types/voice').VoiceSettings>) => ({
            success: true,
            settings: {
                enabled: false,
                wakeWord: 'tengra',
                customWakeWords: [],
                recognitionLanguage: 'en-US',
                synthesisVoice: '',
                speechRate: 1.0,
                speechPitch: 1.0,
                speechVolume: 0.8,
                audioFeedback: true,
                visualFeedback: true,
                accessibilityMode: false,
                shortcuts: [],
                customCommands: [],
                continuousListening: false,
                silenceTimeout: 1500,
            },
        }),
        getCommands: async () => [],
        addCommand: async (command: import('@shared/types/voice').VoiceCommand) => ({
            success: true,
            command,
        }),
        removeCommand: async (_commandId: string) => ({ success: true }),
        processTranscript: async (transcript: string) => ({
            success: true,
            result: {
                success: true,
                transcript,
                confidence: 1.0,
                isFinal: true,
                timestamp: Date.now(),
            },
            command: null,
        }),
        executeCommand: async (command: import('@shared/types/voice').VoiceCommand) => ({
            success: true,
            action: command.action.type,
        }),
        getVoices: async () => [],
        synthesize: async (_options: import('@shared/types/voice').VoiceSynthesisOptions) => ({
            success: true,
        }),
        health: async () => ({
            success: true,
            data: {
                status: 'healthy' as const,
                uiState: 'ready' as const,
                budgets: {
                    fastMs: 40,
                    standardMs: 120,
                    heavyMs: 220,
                },
                metrics: {
                    totalCalls: 0,
                    totalFailures: 0,
                    totalRetries: 0,
                    validationFailures: 0,
                    budgetExceededCount: 0,
                },
            },
        }),
    },
    extension: {
        getAll: async () => ({
            success: true,
            extensions: [],
        }),
        get: async (_extensionId: string) => ({
            success: false,
        }),
        install: async (_extensionPath: string) => ({
            success: false,
            error: 'Extension installation not available in web mode',
        }),
        uninstall: async (_extensionId: string) => ({
            success: false,
            error: 'Extension uninstallation not available in web mode',
        }),
        activate: async (_extensionId: string) => ({
            success: false,
            error: 'Extension activation not available in web mode',
        }),
        deactivate: async (_extensionId: string) => ({
            success: false,
            error: 'Extension deactivation not available in web mode',
        }),
        devStart: async (_options: import('@shared/types/extension').ExtensionDevOptions) => ({
            success: false,
            error: 'Extension development not available in web mode',
        }),
        devStop: async (_extensionId: string) => ({
            success: false,
            error: 'Extension development not available in web mode',
        }),
        devReload: async (_extensionId: string) => ({
            success: false,
            error: 'Extension development not available in web mode',
        }),
        test: async (_options: import('@shared/types/extension').ExtensionTestOptions) => ({
            success: false,
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0,
        }),
        publish: async (_options: import('@shared/types/extension').ExtensionPublishOptions) => ({
            success: false,
            extensionId: '',
            version: '',
        }),
        getProfile: async (_extensionId: string) => ({
            success: false,
        }),
        getState: async (_extensionId: string) => ({
            success: false,
        }),
        validate: async (_manifest: unknown) => ({
            valid: true,
            errors: [],
        }),
    },

    codeSandbox: {
        execute: async (_params: { language: string; code: string }) => ({
            success: false,
            stdout: '',
            stderr: 'Code sandbox not available in web mode',
            durationMs: 0,
        }),
    },

    promptTemplates: {
        getAll: async () => [],
        search: async (_query: string) => [],
        getCategories: async () => [],
        create: async (_payload: { name: string; description: string; template: string; category: string; variables: import('@shared/types/templates').TemplateVariable[]; tags: string[] }) =>
            ({ id: '', name: '', template: '', variables: [], createdAt: 0, updatedAt: 0 }) as import('@shared/types/templates').PromptTemplate,
        update: async (_id: string, _payload: { name: string; description: string; template: string; category: string; variables: import('@shared/types/templates').TemplateVariable[]; tags: string[] }) =>
            ({ id: '', name: '', template: '', variables: [], createdAt: 0, updatedAt: 0 }) as import('@shared/types/templates').PromptTemplate,
        delete: async (_id: string) => { /* noop */ },
    },

    sharedPrompts: {
        list: async (_filter?: {
            query?: string;
            category?: string;
            tags?: string[];
            limit?: number;
            offset?: number;
        }) => [],
        create: async (_input: {
            title: string;
            content: string;
            category?: string;
            tags?: string[];
            author?: string;
        }) => ({
            id: '',
            title: '',
            content: '',
            category: '',
            tags: [],
            author: '',
            createdAt: 0,
            updatedAt: 0,
        }),
        update: async (_id: string, _input: {
            title?: string;
            content?: string;
            category?: string;
            tags?: string[];
            author?: string;
        }) => undefined,
        delete: async (_id: string) => true,
        export: async (_filePath?: string) => ({ success: true, data: '[]' }),
        import: async (_filePathOrJson: string, _isFilePath?: boolean) => ({ success: true, imported: 0 }),
    },

    userCollaboration: {
        joinRoom: async (_params: JoinCollaborationRoom): Promise<CollaborationResponse> => ({ success: true }),
        leaveRoom: async (_roomId: string): Promise<CollaborationResponse> => ({ success: true }),
        sendUpdate: async (_params: CollaborationSyncUpdate): Promise<CollaborationResponse> => ({ success: true }),
        onSyncUpdate: (_callback: (payload: { roomId: string; data: string }) => void) => () => { /* noop */ },
        onError: (_callback: (payload: { roomId: string; error: string }) => void) => () => { /* noop */ },
    },
    liveCollaboration: {
        joinRoom: async (_params: JoinCollaborationRoom): Promise<CollaborationResponse> => ({ success: true }),
        leaveRoom: async (_roomId: string): Promise<CollaborationResponse> => ({ success: true }),
        sendUpdate: async (_params: CollaborationSyncUpdate): Promise<CollaborationResponse> => ({ success: true }),
        onSyncUpdate: (_callback: (payload: { roomId: string; data: string }) => void) => () => { /* noop */ },
        onError: (_callback: (payload: { roomId: string; error: string }) => void) => () => { /* noop */ },
    },
} as unknown as ElectronAPI;

if (typeof window !== 'undefined' && !window.electron) {
    window.electron = webElectronMock;
}

export default webElectronMock;


