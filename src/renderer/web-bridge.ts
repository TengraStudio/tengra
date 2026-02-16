import type { ElectronAPI } from '@renderer/electron.d';
import type { Chat, Folder, Message, ToolCall, ToolResult } from '@shared/types/chat';
import type { IpcValue } from '@shared/types/common';
import type { Project, ProjectAnalysis } from '@shared/types/project';
import type { ClaudeQuota, CodexUsage } from '@shared/types/quota';
import type { AppSettings } from '@shared/types/settings';
import type { IpcRendererEvent } from 'electron';

import type { SSHConfig, SSHConnection, SSHSystemStats } from '@/types/ssh';

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
        verification_uri: 'http://locahost',
        expires_in: 900,
        interval: 5,
    }),
    pollToken: async (_deviceCode: string, _interval: number, _appId?: 'profile' | 'copilot') => ({
        success: true,
        token: 'mock-token',
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
        generateProjectDocumentation: async (_rootPath: string, _maxFiles?: number) => ({
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
            _projectId?: string,
            _isRegex?: boolean
        ) => [],
        indexProject: async (_rootPath: string, _projectId: string) => { },
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

    project: {
        analyze: async (_rootPath: string, _projectId: string) =>
            ({
                name: 'Mock Project',
                path: _rootPath,
                type: 'unknown',
                files: [],
                dependencies: {},
                scripts: {},
                frameworks: [],
                devDependencies: {},
                languages: {},
                stats: { fileCount: 0, totalSize: 0, loc: 0, lastModified: Date.now() },
                todos: [],
            }) as ProjectAnalysis,
        generateLogo: async (
            _projectPath: string,
            _options: { prompt: string; style: string; model: string; count: number }
        ) => [],
        analyzeIdentity: async (_projectPath: string) => ({ suggestedPrompts: [], colors: [] }),
        applyLogo: async (_projectPath: string, _tempLogoPath: string) => '',
        getCompletion: async (_text: string) => '',
        improveLogoPrompt: async (_prompt: string) => '',
        uploadLogo: async (_projectPath: string) => null,
        analyzeDirectory: async (_dirPath: string) => ({
            hasPackageJson: false,
            pkg: {},
            readme: null,
            stats: { fileCount: 0, totalSize: 0, loc: 0, lastModified: Date.now() },
        }),
        watch: async (_rootPath: string) => true,
        unwatch: async (_rootPath: string) => true,
        onFileChange:
            (_callback: (event: string, path: string, rootPath: string) => void) => () => { },
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
    chat: async (_messages: Message[], _model: string) => ({ content: 'Mock response' }),
    chatOpenAI: async (_request: unknown) => ({ content: 'Mock response' }),
    chatStream: async (_request: unknown) => { },
    abortChat: () => { },
    onStreamChunk:
        (
            _callback: (chunk: {
                content?: string;
                toolCalls?: ToolCall[];
                reasoning?: string;
            }) => void
        ) =>
            () => { },
    removeStreamChunkListener: (
        _callback?: (chunk: {
            content?: string;
            toolCalls?: ToolCall[];
            reasoning?: string;
        }) => void
    ) => { },

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

    // Marketplace API stubs
    marketplace: {
        getModels: async (
            _provider?: 'ollama' | 'huggingface',
            _limit?: number,
            _offset?: number
        ) => [],
        searchModels: async (
            _query: string,
            _provider?: 'ollama' | 'huggingface',
            _limit?: number
        ) => [],
        getModelDetails: async (_modelName: string) => null,
        getStatus: async () => ({ lastScrapeTime: 0, isScraping: false }),
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
            projectCodingTime: {},
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
            projectId?: string;
            provider: string;
            model: string;
            tokensSent: number;
            tokensReceived: number;
            costEstimate?: number;
        }) => ({ success: true }),
        getProjects: async () => [],
        getFolders: async () => [],
        createProject: async (
            _name: string,
            _path: string,
            _description: string,
            _mounts?: string
        ) =>
            ({
                id: 'mock-project-id',
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
            }) as Project,
        updateProject: async (_id: string, _updates: Partial<Project>) => { },
        deleteProject: async (_id: string, _deleteFiles?: boolean) => { },
        archiveProject: async (_id: string, _isArchived: boolean) => { },
        bulkDeleteProjects: async (_ids: string[], _deleteFiles?: boolean) => { },
        bulkArchiveProjects: async (_ids: string[], _isArchived: boolean) => { },
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

    mcpMarketplace: {
        list: async () => ({ success: true, servers: [] }),
        search: async (_query: string) => ({ success: true, servers: [] }),
        filter: async (_category: string) => ({ success: true, servers: [] }),
        categories: async () => ({ success: true, categories: [] }),
        install: async (_serverId: string) => ({ success: true }),
        uninstall: async (_serverId: string) => ({ success: true }),
        installed: async () => ({ success: true, servers: [] }),
        toggle: async (_serverId: string, _enabled: boolean) => ({ success: true }),
        updateConfig: async (_serverId: string, _patch: Record<string, IpcValue>) => ({ success: true }),
        versionHistory: async (_serverId: string) => ({ success: true, history: [] }),
        rollbackVersion: async (_serverId: string, _targetVersion: string) => ({ success: true }),
        debug: async () => ({ success: true, metrics: {} }),
        refresh: async () => ({ success: true }),
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
        getStats: async () => ({ success: true, data: undefined }),
        runDecay: async () => ({ success: true }),
        extractFromMessage: async (_content: string, _sourceId: string, _projectId?: string) => ({
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
        approveIdea: async (_ideaId: string, _projectPath: string, _selectedName?: string) => ({
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
    projectAgent: {
        start: async (_options: unknown) => { },
        generatePlan: async (_options: unknown) => { },
        approvePlan: async (_plan: string[] | unknown[], _taskId?: string) => { },
        stop: async (_taskId?: string) => { },
        createPullRequest: async (_taskId?: string) => ({ success: false, error: 'Not available in web mode' }),
        resetState: async () => { },
        getStatus: async (_taskId?: string) => null,
        retryStep: async (_index: number, _taskId?: string) => { },
        // AGT-HIL: Human-in-the-Loop step actions
        approveStep: async (_taskId: string, _stepId: string) => { },
        skipStep: async (_taskId: string, _stepId: string) => { },
        editStep: async (_taskId: string, _stepId: string, _text: string) => { },
        addStepComment: async (_taskId: string, _stepId: string, _comment: string) => { },
        insertInterventionPoint: async (_taskId: string, _afterStepId: string) => { },
        getCheckpoints: async (_taskId: string) => [],
        rollbackCheckpoint: async (_checkpointId: string) => ({
            success: true,
            taskId: '',
            resumedCheckpointId: '',
            preRollbackCheckpointId: '',
        }),
        getPlanVersions: async (_taskId: string) => [],
        deleteTaskByNodeId: async (_nodeId: string) => true,
        getProfiles: async () => [],
        getRoutingRules: async () => [],
        setRoutingRules: async (_rules: unknown[]) => ({ success: true }),
        createVotingSession: async (_payload: {
            taskId: string;
            stepIndex: number;
            question: string;
            options: string[];
        }) => ({
            id: 'mock-voting-session',
            taskId: _payload.taskId,
            stepIndex: _payload.stepIndex,
            question: _payload.question,
            options: _payload.options,
            votes: [],
            status: 'pending' as const,
            createdAt: Date.now(),
        }),
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
        buildConsensus: async (_outputs: Array<{ modelId: string; provider: string; output: string }>) => ({
            agreed: false,
            resolutionMethod: 'manual' as const,
        }),
        getTemplates: async (_category?: unknown) => [],
        getTemplate: async (_id: string) => null,
        saveTemplate: async _template => ({ success: true, template: _template }),
        deleteTemplate: async (_id: string) => ({ success: true }),
        exportTemplate: async (_id: string) => null,
        importTemplate: async (_exported: unknown) => ({ success: false, error: 'Not available in web mode' }),
        applyTemplate: async (_payload: {
            templateId: string;
            values: Record<string, string | number | boolean>;
        }) => ({ success: false, error: 'Not available in web mode' }),
        onUpdate: (_callback: (state: unknown) => void) => () => { },
        // Canvas persistence stubs
        saveCanvasNodes: async (_nodes: unknown[]) => { },
        getCanvasNodes: async () => [],
        deleteCanvasNode: async (_id: string) => { },
        saveCanvasEdges: async (_edges: unknown[]) => { },
        getCanvasEdges: async () => [],
        deleteCanvasEdge: async (_id: string) => { },
    },
    extension: {
        shouldShowWarning: async () => false,
        dismissWarning: async () => ({ success: true }),
        getStatus: async () => ({ installed: false, shouldShowWarning: false }),
        setInstalled: async (_installed: boolean) => ({ success: true }),
    },
};

if (typeof window !== 'undefined' && !(window as unknown as Record<string, unknown>).electron) {
    (window as unknown as Record<string, unknown>).electron = webElectronMock;
}

export default webElectronMock;
