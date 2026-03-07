import type {
    ModelDefinition,
    OrchestratorStateView,
} from '@renderer/electron.d';
import type {
    IpcContractVersionInfo,
} from '@shared/constants/ipc-contract';
import type {
    IpcRendererEvent,
} from 'electron';

import type {
    AgentDefinition,
    AgentStartOptions,
    Chat,
    Folder,
    IpcValue,
    Message,
    Project,
    ProjectState,
    ProjectStep,
    SSHConfig,
    SSHConnection,
    SSHDevContainer,
    SSHFile,
    SSHKnownHostEntry,
    SSHManagedKey,
    SSHPackageInfo,
    SSHPortForward,
    SSHProfileTemplate,
    SSHRemoteSearchResult,
    SSHSearchHistoryEntry,
    SSHSessionRecording,
    SSHSystemStats,
    SSHTransferTask,
    SSHTunnelPreset,
} from '@/shared/types';
import type {
    VoiceCommand,
    VoiceInfo,
    VoiceRecognitionResult,
    VoiceSettings,
    VoiceSynthesisOptions,
} from '@/shared/types/voice';

export interface ElectronApiIntegrationsDomain {
    db: {
        createChat: (chat: Chat) => Promise<{ success: boolean }>;
        updateChat: (id: string, updates: Partial<Chat>) => Promise<{ success: boolean }>;
        deleteChat: (id: string) => Promise<{ success: boolean }>;
        duplicateChat: (id: string) => Promise<Chat | null>;
        archiveChat: (id: string, isArchived: boolean) => Promise<{ success: boolean }>;
        getChat: (id: string) => Promise<Chat | null>;
        getAllChats: () => Promise<Chat[]>;
        searchChats: (query: string) => Promise<Chat[]>;
        addMessage: (message: Message) => Promise<{ success: boolean }>;
        deleteMessage: (id: string) => Promise<{ success: boolean }>;
        updateMessage: (id: string, updates: Partial<Message>) => Promise<{ success: boolean }>;
        deleteAllChats: () => Promise<{ success: boolean }>;
        deleteMessages: (chatId: string) => Promise<{ success: boolean }>;
        getMessages: (chatId: string) => Promise<Message[]>;
        getStats: () => Promise<{ chatCount: number; messageCount: number; dbSize: number }>;
        getDetailedStats: (period: string) => Promise<{
            chatCount: number;
            messageCount: number;
            dbSize: number;
            totalTokens: number;
            promptTokens: number;
            completionTokens: number;
            tokenTimeline: { timestamp: number; promptTokens: number; completionTokens: number }[];
            activity: number[];
        }>;
        getTimeStats: () => Promise<{
            totalOnlineTime: number;
            totalCodingTime: number;
            workspaceCodingTime: Record<string, number>;
        }>;
        getTokenStats: (period: 'daily' | 'weekly' | 'monthly') => Promise<{
            totalSent: number;
            totalReceived: number;
            totalCost: number;
            timeline: Array<{ timestamp: number; sent: number; received: number }>;
            byProvider: Record<string, { sent: number; received: number; cost: number }>;
            byModel: Record<string, { sent: number; received: number; cost: number }>;
        }>;
        addTokenUsage: (record: {
            messageId?: string;
            chatId: string;
            workspaceId?: string;
            provider: string;
            model: string;
            tokensSent: number;
            tokensReceived: number;
            costEstimate?: number;
        }) => Promise<{ success: boolean }>;
        getWorkspaces: () => Promise<Project[]>;
        getFolders: () => Promise<Folder[]>;
        createWorkspace: (
            name: string,
            path: string,
            description: string,
            mounts?: string
        ) => Promise<Project>;
        updateWorkspace: (id: string, updates: Partial<Project>) => Promise<void>;
        deleteWorkspace: (id: string, deleteFiles?: boolean) => Promise<void>;
        archiveWorkspace: (id: string, isArchived: boolean) => Promise<void>;
        bulkDeleteWorkspaces: (ids: string[], deleteFiles?: boolean) => Promise<void>;
        bulkArchiveWorkspaces: (ids: string[], isArchived: boolean) => Promise<void>;
        createFolder: (name: string, color?: string) => Promise<Folder>;
        deleteFolder: (id: string) => Promise<void>;
        updateFolder: (id: string, updates: Partial<Folder>) => Promise<void>;

        // Prompts
        createPrompt: (title: string, content: string, tags?: string[]) => Promise<{ id: string }>;
        deletePrompt: (id: string) => Promise<void>;
        updatePrompt: (id: string, updates: Record<string, IpcValue>) => Promise<void>;
        getPrompts: () => Promise<IpcValue[]>;
    };

    terminal: {
        isAvailable: () => Promise<boolean>;
        getProfiles: () => Promise<Array<{
            id: string;
            name: string;
            shell: string;
            args?: string[];
            env?: Record<string, string | undefined>;
            icon?: string;
            isDefault?: boolean;
        }>>;
        saveProfile: (profile: {
            id: string;
            name: string;
            shell: string;
            args?: string[];
            env?: Record<string, string | undefined>;
            icon?: string;
            isDefault?: boolean;
        }) => Promise<void>;
        deleteProfile: (id: string) => Promise<void>;
        validateProfile: (profile: {
            id: string;
            name: string;
            shell: string;
            args?: string[];
            env?: Record<string, string | undefined>;
            icon?: string;
            isDefault?: boolean;
        }) => Promise<{ valid: boolean; errors: string[] }>;
        getProfileTemplates: () => Promise<Array<{
            id: string;
            name: string;
            shell: string;
            args?: string[];
            env?: Record<string, string | undefined>;
            icon?: string;
            isDefault?: boolean;
        }>>;
        exportProfiles: () => Promise<string>;
        exportProfileShareCode: (profileId: string) => Promise<string | null>;
        importProfiles: (
            payload: string,
            options?: { overwrite?: boolean }
        ) => Promise<{ success: boolean; imported: number; skipped: number; errors: string[] }>;
        importProfileShareCode: (
            shareCode: string,
            options?: { overwrite?: boolean }
        ) => Promise<{ success: boolean; imported: boolean; profileId?: string; error?: string }>;
        getShells: () => Promise<{ id: string; name: string; path: string }[]>;
        getBackends: () => Promise<Array<{ id: string; name: string; available: boolean }>>;
        getRuntimeHealth: () => Promise<{
            terminalAvailable: boolean;
            totalBackends: number;
            availableBackends: number;
            backends: Array<{ id: string; name: string; available: boolean }>;
        }>;
        create: (options: {
            id?: string;
            shell?: string;
            cwd?: string;
            cols?: number;
            rows?: number;
            backendId?: string;
            title?: string;
            metadata?: Record<string, unknown>;
        }) => Promise<string>;
        getDockerContainers: () => Promise<Array<{ id: string; name: string; status: string }>>;
        detach: (options: {
            sessionId: string;
            title?: string;
            shell?: string;
            cwd?: string;
        }) => Promise<boolean>;
        getCommandHistory: (
            query?: string,
            limit?: number
        ) => Promise<
            Array<{
                command: string;
                shell?: string;
                cwd?: string;
                timestamp: number;
                sessionId: string;
            }>
        >;
        getSuggestions: (options: {
            command: string;
            shell: string;
            cwd: string;
            historyLimit?: number;
        }) => Promise<string[]>;
        explainCommand: (options: { command: string; shell: string; cwd?: string }) => Promise<{
            explanation: string;
            breakdown: Array<{ part: string; description: string }>;
            warnings?: string[];
            relatedCommands?: string[];
        }>;
        explainError: (options: {
            errorOutput: string;
            command?: string;
            shell: string;
            cwd?: string;
        }) => Promise<{
            summary: string;
            cause: string;
            solution: string;
            steps?: string[];
        }>;
        fixError: (options: {
            errorOutput: string;
            command: string;
            shell: string;
            cwd?: string;
        }) => Promise<{
            suggestedCommand: string;
            explanation: string;
            confidence: 'high' | 'medium' | 'low';
            alternativeCommands?: string[];
        }>;
        clearCommandHistory: () => Promise<boolean>;
        close: (sessionId: string) => Promise<boolean>;
        write: (sessionId: string, data: string) => Promise<boolean>;
        resize: (sessionId: string, cols: number, rows: number) => Promise<boolean>;
        kill: (sessionId: string) => Promise<boolean>;
        getSessions: () => Promise<string[]>;
        restoreAllSnapshots: () => Promise<{ restored: number; failed: number; sessionIds: string[] }>;
        exportSession: (
            sessionId: string,
            options?: { includeScrollback?: boolean }
        ) => Promise<string | null>;
        importSession: (
            payload: string,
            options?: { overwrite?: boolean; sessionId?: string }
        ) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
        createSessionShareCode: (
            sessionId: string,
            options?: { includeScrollback?: boolean }
        ) => Promise<string | null>;
        importSessionShareCode: (
            shareCode: string,
            options?: { overwrite?: boolean; sessionId?: string }
        ) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
        getSnapshotSessions: () => Promise<Array<{
            id: string;
            shell: string;
            cwd: string;
            title?: string;
            cols: number;
            rows: number;
            timestamp: number;
            backendId: string;
            workspaceId?: string;
            metadata?: Record<string, unknown>;
        }>>;
        getSessionTemplates: () => Promise<Array<{
            id: string;
            name: string;
            shell: string;
            cwd: string;
            cols: number;
            rows: number;
            backendId: string;
            workspaceId?: string;
            metadata?: Record<string, unknown>;
            createdAt: number;
            updatedAt: number;
        }>>;
        saveSessionTemplate: (payload: {
            sessionId: string;
            templateId?: string;
            name?: string;
        }) => Promise<{
            id: string;
            name: string;
            shell: string;
            cwd: string;
            cols: number;
            rows: number;
            backendId: string;
            workspaceId?: string;
            metadata?: Record<string, unknown>;
            createdAt: number;
            updatedAt: number;
        } | null>;
        deleteSessionTemplate: (templateId: string) => Promise<boolean>;
        createFromSessionTemplate: (
            templateId: string,
            options?: { sessionId?: string; title?: string }
        ) => Promise<string | null>;
        restoreSnapshotSession: (snapshotId: string) => Promise<boolean>;
        searchScrollback: (
            sessionId: string,
            query: string,
            options?: { regex?: boolean; caseSensitive?: boolean; limit?: number }
        ) => Promise<Array<{ lineNumber: number; line: string }>>;
        exportScrollback: (
            sessionId: string,
            exportPath?: string
        ) => Promise<{ success: boolean; path?: string; content?: string; error?: string }>;
        getSessionAnalytics: (sessionId: string) => Promise<{
            sessionId: string;
            bytes: number;
            lineCount: number;
            commandCount: number;
            updatedAt: number;
        }>;
        getSearchAnalytics: () => Promise<{
            totalSearches: number;
            regexSearches: number;
            plainSearches: number;
            lastSearchAt: number;
        }>;
        getSearchSuggestions: (query?: string, limit?: number) => Promise<string[]>;
        exportSearchResults: (
            sessionId: string,
            query: string,
            options?: {
                regex?: boolean;
                caseSensitive?: boolean;
                limit?: number;
                exportPath?: string;
                format?: 'json' | 'txt';
            }
        ) => Promise<{ success: boolean; path?: string; content?: string; error?: string }>;
        addScrollbackMarker: (
            sessionId: string,
            label: string,
            lineNumber?: number
        ) => Promise<{ id: string; sessionId: string; label: string; lineNumber: number; createdAt: number } | null>;
        listScrollbackMarkers: (sessionId?: string) => Promise<Array<{
            id: string;
            sessionId: string;
            label: string;
            lineNumber: number;
            createdAt: number;
        }>>;
        deleteScrollbackMarker: (markerId: string) => Promise<boolean>;
        filterScrollback: (
            sessionId: string,
            options?: { query?: string; fromLine?: number; toLine?: number; caseSensitive?: boolean }
        ) => Promise<string[]>;
        setSessionTitle: (sessionId: string, title: string) => Promise<boolean>;
        onData: (callback: (data: { id: string; data: string }) => void) => () => void;
        onExit: (callback: (data: { id: string; code: number }) => void) => () => void;
        readBuffer: (sessionId: string) => Promise<string>;
        removeAllListeners: () => void;
    };

    agent: {
        getAll: () => Promise<AgentDefinition[]>;
        get: (id: string) => Promise<AgentDefinition | null>;
        create: (payload: {
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
        }) => Promise<{ success: boolean; id?: string; workspacePath?: string; error?: string }>;
        delete: (
            id: string,
            options?: { confirm?: boolean; softDelete?: boolean; backupBeforeDelete?: boolean }
        ) => Promise<{ success: boolean; archivedId?: string; recoveryToken?: string; error?: string }>;
        clone: (id: string, newName?: string) => Promise<{ success: boolean; id?: string; error?: string }>;
        exportAgent: (id: string) => Promise<string | null>;
        importAgent: (payload: string) => Promise<{ success: boolean; id?: string; workspacePath?: string; error?: string }>;
        getTemplatesLibrary: () => Promise<Array<{
            id?: string;
            name: string;
            description: string;
            systemPrompt: string;
            tools: string[];
            parentModel?: string;
            color?: string;
            category?: string;
        }>>;
        validateTemplate: (template: {
            name?: string;
            description?: string;
            systemPrompt?: string;
            tools?: string[];
            parentModel?: string;
            color?: string;
        }) => Promise<{ valid: boolean; errors: string[] }>;
        recover: (archiveId: string) => Promise<{ success: boolean; id?: string; error?: string }>;
    };

    modelRegistry: {
        getAllModels: () => Promise<ModelDefinition[]>;
        getRemoteModels: () => Promise<ModelDefinition[]>;
        getInstalledModels: () => Promise<ModelDefinition[]>;
    };

    // SSH
    ssh: {
        connect: (
            connection: SSHConnection
        ) => Promise<{ success: boolean; error?: string; id?: string; diagnostics?: { category: string; hint: string } }>;
        disconnect: (connectionId: string) => Promise<{ success: boolean }>;
        execute: (
            connectionId: string,
            command: string,
            options?: SSHExecOptions
        ) => Promise<{ stdout: string; stderr: string; code: number }>;
        upload: (
            connectionId: string,
            localPath: string,
            remotePath: string
        ) => Promise<{ success: boolean; error?: string }>;
        download: (
            connectionId: string,
            remotePath: string,
            localPath: string
        ) => Promise<{ success: boolean; error?: string }>;
        listDir: (
            connectionId: string,
            remotePath: string
        ) => Promise<{ success: boolean; files?: SSHFile[]; error?: string }>;
        readFile: (
            connectionId: string,
            remotePath: string
        ) => Promise<{ success: boolean; content?: string; error?: string }>;
        writeFile: (
            connectionId: string,
            remotePath: string,
            content: string
        ) => Promise<{ success: boolean; error?: string }>;
        deleteDir: (
            connectionId: string,
            path: string
        ) => Promise<{ success: boolean; error?: string }>;
        deleteFile: (
            connectionId: string,
            path: string
        ) => Promise<{ success: boolean; error?: string }>;
        mkdir: (
            connectionId: string,
            path: string
        ) => Promise<{ success: boolean; error?: string }>;
        rename: (
            connectionId: string,
            oldPath: string,
            newPath: string
        ) => Promise<{ success: boolean; error?: string }>;
        getConnections: () => Promise<SSHConnection[]>;
        isConnected: (connectionId: string) => Promise<boolean>;
        onStdout: (callback: (data: string | Uint8Array) => void) => void;
        onStderr: (callback: (data: string | Uint8Array) => void) => void;
        onConnected: (callback: (connectionId: string) => void) => void;
        onDisconnected: (callback: (connectionId: string) => void) => void;
        onUploadProgress: (
            callback: (progress: { transferred: number; total: number }) => void
        ) => void;
        onDownloadProgress: (
            callback: (progress: { transferred: number; total: number }) => void
        ) => void;
        removeAllListeners: () => void;
        onShellData: (callback: (data: { data: string }) => void) => void;
        shellStart: (connectionId: string) => Promise<{ success: boolean; error?: string }>;
        shellWrite: (
            connectionId: string,
            data: string
        ) => Promise<{ success: boolean; error?: string }>;
        getSystemStats: (connectionId: string) => Promise<SSHSystemStats>;
        getInstalledPackages: (
            connectionId: string,
            manager?: 'apt' | 'npm' | 'pip'
        ) => Promise<SSHPackageInfo[]>;
        getLogFiles: (connectionId: string) => Promise<string[]>;
        readLogFile: (connectionId: string, path: string, lines?: number) => Promise<string>;
        getProfiles: () => Promise<SSHConfig[]>;
        saveProfile: (profile: SSHConfig) => Promise<boolean>;
        deleteProfile: (id: string) => Promise<boolean>;
        createTunnel: (payload: {
            connectionId: string;
            type: 'local' | 'remote' | 'dynamic';
            localHost: string;
            localPort: number;
            remoteHost?: string;
            remotePort?: number;
        }) => Promise<{ success: boolean; forwardId?: string; error?: string }>;
        listTunnels: (connectionId?: string) => Promise<SSHPortForward[]>;
        closeTunnel: (forwardId: string) => Promise<boolean>;
        saveTunnelPreset: (preset: {
            name: string;
            type: 'local' | 'remote' | 'dynamic';
            localHost: string;
            localPort: number;
            remoteHost: string;
            remotePort: number;
        }) => Promise<SSHTunnelPreset>;
        listTunnelPresets: () => Promise<SSHTunnelPreset[]>;
        deleteTunnelPreset: (id: string) => Promise<boolean>;
        listManagedKeys: () => Promise<SSHManagedKey[]>;
        generateManagedKey: (payload: { name: string; passphrase?: string }) => Promise<{
            key: SSHManagedKey;
            privateKey: string;
            publicKey: string;
        }>;
        importManagedKey: (payload: {
            name: string;
            privateKey: string;
            passphrase?: string;
        }) => Promise<SSHManagedKey>;
        deleteManagedKey: (id: string) => Promise<boolean>;
        rotateManagedKey: (payload: { id: string; nextPassphrase?: string }) => Promise<SSHManagedKey | null>;
        backupManagedKey: (id: string) => Promise<{ filename: string; privateKey: string } | null>;
        listKnownHosts: () => Promise<SSHKnownHostEntry[]>;
        addKnownHost: (payload: SSHKnownHostEntry) => Promise<boolean>;
        removeKnownHost: (payload: { host: string; keyType?: string }) => Promise<boolean>;
        searchRemoteFiles: (payload: {
            connectionId: string;
            query: string;
            options?: { path?: string; contentSearch?: boolean; limit?: number };
        }) => Promise<SSHRemoteSearchResult[]>;
        getSearchHistory: (connectionId?: string) => Promise<SSHSearchHistoryEntry[]>;
        exportSearchHistory: () => Promise<string>;
        reconnect: (connectionId: string, retries?: number) => Promise<{ success: boolean; error?: string }>;
        acquireConnection: (connectionId: string) => Promise<{ success: boolean; error?: string }>;
        releaseConnection: (connectionId: string) => Promise<boolean>;
        getConnectionPoolStats: () => Promise<Array<{ connectionId: string; refs: number }>>;
        enqueueTransfer: (task: SSHTransferTask) => Promise<void>;
        getTransferQueue: () => Promise<SSHTransferTask[]>;
        runTransferBatch: (tasks: SSHTransferTask[], concurrency?: number) => Promise<boolean[]>;
        listRemoteContainers: (connectionId: string) => Promise<SSHDevContainer[]>;
        runRemoteContainer: (payload: {
            connectionId: string;
            image: string;
            name: string;
            ports?: Array<{ hostPort: number; containerPort: number }>;
        }) => Promise<{ success: boolean; id?: string; error?: string }>;
        stopRemoteContainer: (connectionId: string, containerId: string) => Promise<boolean>;
        saveProfileTemplate: (template: {
            name: string;
            port: number;
            username: string;
            tags?: string[];
        }) => Promise<SSHProfileTemplate>;
        listProfileTemplates: () => Promise<SSHProfileTemplate[]>;
        deleteProfileTemplate: (id: string) => Promise<boolean>;
        exportProfiles: (ids?: string[]) => Promise<string>;
        importProfiles: (payload: string) => Promise<number>;
        validateProfile: (profile: Partial<SSHConnection>) => Promise<{ valid: boolean; errors: string[] }>;
        testProfile: (profile: Partial<SSHConnection>) => Promise<{
            success: boolean;
            latencyMs: number;
            authMethod: 'password' | 'key';
            message: string;
            error?: string;
            errorCode?: string;
            uiState?: 'ready' | 'failure' | 'empty';
        }>;
        startSessionRecording: (connectionId: string) => Promise<SSHSessionRecording>;
        stopSessionRecording: (connectionId: string) => Promise<SSHSessionRecording | null>;
        getSessionRecording: (connectionId: string) => Promise<SSHSessionRecording | null>;
        searchSessionRecording: (connectionId: string, query: string) => Promise<string[]>;
        exportSessionRecording: (connectionId: string) => Promise<string>;
        listSessionRecordings: () => Promise<SSHSessionRecording[]>;
    };

    // Tools
    mcp: {
        list: () => Promise<{ name: string; status: string }[]>;
        dispatch: (
            service: string,
            action: string,
            args?: Record<string, IpcValue>
        ) => Promise<IpcValue>;
        toggle: (
            service: string,
            enabled: boolean
        ) => Promise<{ success: boolean; isEnabled: boolean }>;
        install: (
            config: Record<string, IpcValue>
        ) => Promise<{ success: boolean; error?: string }>;
        uninstall: (name: string) => Promise<{ success: boolean }>;
        getDebugMetrics: () => Promise<IpcValue[]>;
        listPermissionRequests: () => Promise<IpcValue[]>;
        setActionPermission: (
            service: string,
            action: string,
            policy: 'allow' | 'deny' | 'ask'
        ) => Promise<{ success: boolean; error?: string }>;
        resolvePermissionRequest: (
            requestId: string,
            decision: 'approved' | 'denied'
        ) => Promise<{ success: boolean; error?: string }>;
        onResult: (callback: (result: IpcValue) => void) => void;
        removeResultListener: () => void;
    };

    // MCP Marketplace
    mcpMarketplace: {
        list: () => Promise<{ success: boolean; servers?: IpcValue[]; error?: string }>;
        search: (
            query: string
        ) => Promise<{ success: boolean; servers?: IpcValue[]; error?: string }>;
        filter: (
            category: string
        ) => Promise<{ success: boolean; servers?: IpcValue[]; error?: string }>;
        categories: () => Promise<{ success: boolean; categories?: string[]; error?: string }>;
        install: (serverId: string) => Promise<{ success: boolean; error?: string }>;
        uninstall: (serverId: string) => Promise<{ success: boolean; error?: string }>;
        installed: () => Promise<{ success: boolean; servers?: IpcValue[]; error?: string }>;
        toggle: (
            serverId: string,
            enabled: boolean
        ) => Promise<{ success: boolean; error?: string }>;
        updateConfig: (
            serverId: string,
            patch: Record<string, IpcValue>
        ) => Promise<{ success: boolean; error?: string }>;
        versionHistory: (
            serverId: string
        ) => Promise<{ success: boolean; history?: string[]; error?: string }>;
        rollbackVersion: (
            serverId: string,
            targetVersion: string
        ) => Promise<{ success: boolean; error?: string }>;
        debug: () => Promise<{ success: boolean; metrics?: IpcValue; error?: string }>;
        refresh: () => Promise<{ success: boolean; error?: string }>;
        health: () => Promise<{
            success: boolean;
            data?: {
                status: 'healthy' | 'degraded';
                uiState: 'ready' | 'failure';
                budgets: { fastMs: number; standardMs: number; heavyMs: number };
                metrics: Record<string, IpcValue>;
            };
            error?: string;
            errorCode?: string;
            messageKey?: string;
            retryable?: boolean;
            uiState?: 'ready' | 'failure';
            fallbackUsed?: boolean;
        }>;
    };

    proxyEmbed: {
        start: (options?: {
            configPath?: string;
            port?: number;
            health?: boolean;
        }) => Promise<IpcValue>;
        stop: () => Promise<IpcValue>;
        status: () => Promise<IpcValue>;
    };

    // Screenshot
    log: {
        write: (
            level: 'debug' | 'info' | 'warn' | 'error',
            message: string,
            data?: IpcValue
        ) => void;
        debug: (message: string, data?: IpcValue) => void;
        info: (message: string, data?: IpcValue) => void;
        warn: (message: string, data?: IpcValue) => void;
        error: (message: string, data?: IpcValue) => void;
    };

    update: {
        checkForUpdates: () => Promise<void>;
        downloadUpdate: () => Promise<void>;
        installUpdate: () => Promise<void>;
    };

    collaboration: {
        run: (request: {
            messages: Message[];
            models: Array<{ provider: string; model: string }>;
            strategy?: 'consensus' | 'voting' | 'best-of-n' | 'chain-of-thought';
        }) => Promise<{
            response?: string;
            responses: Array<{
                provider: string;
                model: string;
                content: string;
                latency: number;
            }>;
            consensus?: string;
            bestResponse?: {
                provider: string;
                model: string;
                content: string;
            };
            modelContributions?: Array<{ model: string; response: string }>;
        }>;
        getProviderStats: () => Promise<
            Array<{ provider: string; requestCount: number; avgLatency: number }>
        >;
        getActiveTaskCount: () => Promise<number>;
        setProviderConfig: (
            provider: string,
            config: { concurrencyLimit?: number; rateLimit?: number }
        ) => Promise<void>;
    };

    audit: {
        getLogs: (
            startDate?: string,
            endDate?: string,
            category?: string
        ) => Promise<
            Array<{
                timestamp: number;
                action: string;
                category: string;
                details?: Record<string, IpcValue>;
                success: boolean;
                error?: string;
            }>
        >;
    };

    batch: {
        invoke: (requests: Array<{ channel: string; args: IpcValue[] }>) => Promise<{
            results: Array<{
                channel: string;
                success: boolean;
                data?: IpcValue;
                error?: string;
            }>;
            timing: {
                startTime: number;
                endTime: number;
                totalMs: number;
            };
        }>;
        invokeSequential: (requests: Array<{ channel: string; args: IpcValue[] }>) => Promise<{
            results: Array<{
                channel: string;
                success: boolean;
                data?: IpcValue;
                error?: string;
            }>;
            timing: {
                startTime: number;
                endTime: number;
                totalMs: number;
            };
        }>;
        getChannels: () => Promise<string[]>;
    };
    lazyServices: {
        getStatus: () => Promise<{
            registered: string[];
            loaded: string[];
            loading: string[];
            totals: {
                registered: number;
                loaded: number;
                loading: number;
            };
        }>;
    };
    ipcContract: {
        getVersion: () => Promise<IpcContractVersionInfo>;
        isCompatible: () => Promise<boolean>;
    };

    // Explicit ipcRenderer exposure for flexible components
    ipcRenderer: {
        on: (
            channel: string,
            listener: (event: IpcRendererEvent, ...args: IpcValue[]) => void
        ) => () => void;
        off: (
            channel: string,
            listener: (event: IpcRendererEvent, ...args: IpcValue[]) => void
        ) => void;
        send: (channel: string, ...args: IpcValue[]) => void;
        invoke: (channel: string, ...args: IpcValue[]) => Promise<IpcValue>;
        removeAllListeners: (channel: string) => void;
    };
    // Backward compatibility for components using window.electron.on
    projectAgent: {
        start: (options: AgentStartOptions) => Promise<{ taskId: string }>;
        generatePlan: (options: AgentStartOptions) => Promise<void>;
        approvePlan: (plan: string[] | ProjectStep[], taskId?: string) => Promise<void>;
        stop: (taskId?: string) => Promise<void>;
        pauseTask: (taskId: string) => Promise<{ success: boolean }>;
        resumeTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
        saveSnapshot: (taskId: string) => Promise<{ success: boolean; checkpointId?: string }>;
        approveCurrentPlan: (taskId: string) => Promise<{ success: boolean; error?: string }>;
        rejectCurrentPlan: (
            taskId: string,
            reason?: string
        ) => Promise<{ success: boolean; error?: string }>;
        createPullRequest: (
            taskId?: string
        ) => Promise<{ success: boolean; url?: string; error?: string }>;
        resetState: () => Promise<void>;
        getStatus: (taskId?: string) => Promise<ProjectState>;
        getTaskMessages: (
            taskId: string
        ) => Promise<{ success: boolean; messages?: Message[] }>;
        getTaskEvents: (
            taskId: string
        ) => Promise<{ success: boolean; events?: import('@shared/types/agent-state').AgentEventRecord[] }>;
        getTaskTelemetry: (
            taskId: string
        ) => Promise<{ success: boolean; telemetry?: import('@shared/types/agent-state').TaskMetrics[] }>;
        getTaskHistory: (
            workspaceId?: string
        ) => Promise<import('@shared/types/project-agent').AgentTaskHistoryItem[]>;
        deleteTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
        getAvailableModels: () => Promise<{
            success: boolean;
            models: Array<{ id: string; name: string; provider: string }>;
        }>;
        retryStep: (index: number, taskId?: string) => Promise<void>;
        selectModel: (payload: {
            taskId: string;
            provider: string;
            model: string;
        }) => Promise<{ success: boolean; error?: string }>;
        // AGT-HIL: Human-in-the-Loop step actions
        approveStep: (taskId: string, stepId: string) => Promise<void>;
        skipStep: (taskId: string, stepId: string) => Promise<void>;
        editStep: (taskId: string, stepId: string, text: string) => Promise<void>;
        addStepComment: (taskId: string, stepId: string, comment: string) => Promise<void>;
        insertInterventionPoint: (taskId: string, afterStepId: string) => Promise<void>;
        getCheckpoints: (
            taskId: string
        ) => Promise<Array<{ id: string; stepIndex: number; trigger: string; createdAt: number }>>;
        rollbackCheckpoint: (checkpointId: string) => Promise<{
            success: boolean;
            taskId: string;
            resumedCheckpointId: string;
            preRollbackCheckpointId: string;
            planVersionId?: string;
        }>;
        getPlanVersions: (taskId: string) => Promise<
            Array<{
                id: string;
                taskId: string;
                versionNumber: number;
                reason: string;
                plan: ProjectStep[];
                createdAt: number;
            }>
        >;
        deleteTaskByNodeId: (nodeId: string) => Promise<boolean>;
        getProfiles: () => Promise<import('@shared/types/project-agent').AgentProfile[]>;
        getRoutingRules: () => Promise<import('@shared/types/project-agent').ModelRoutingRule[]>;
        setRoutingRules: (
            rules: import('@shared/types/project-agent').ModelRoutingRule[]
        ) => Promise<{ success: boolean }>;
        createVotingSession: (payload: {
            taskId: string;
            stepIndex: number;
            question: string;
            options: string[];
        }) => Promise<import('@shared/types/project-agent').VotingSession>;
        submitVote: (payload: {
            sessionId: string;
            modelId: string;
            provider: string;
            decision: string;
            confidence: number;
            reasoning?: string;
        }) => Promise<import('@shared/types/project-agent').VotingSession | null>;
        requestVotes: (payload: {
            sessionId: string;
            models: Array<{ provider: string; model: string }>;
        }) => Promise<import('@shared/types/project-agent').VotingSession | null>;
        resolveVoting: (
            sessionId: string
        ) => Promise<import('@shared/types/project-agent').VotingSession | null>;
        getVotingSession: (
            sessionId: string
        ) => Promise<import('@shared/types/project-agent').VotingSession | null>;
        listVotingSessions: (
            taskId?: string
        ) => Promise<import('@shared/types/project-agent').VotingSession[]>;
        overrideVotingDecision: (payload: {
            sessionId: string;
            finalDecision: string;
            reason?: string;
        }) => Promise<import('@shared/types/project-agent').VotingSession | null>;
        getVotingAnalytics: (
            taskId?: string
        ) => Promise<import('@shared/types/project-agent').VotingAnalytics>;
        getVotingConfiguration: () => Promise<import('@shared/types/project-agent').VotingConfiguration>;
        updateVotingConfiguration: (
            patch: Partial<import('@shared/types/project-agent').VotingConfiguration>
        ) => Promise<import('@shared/types/project-agent').VotingConfiguration>;
        listVotingTemplates: () => Promise<import('@shared/types/project-agent').VotingTemplate[]>;
        buildConsensus: (
            outputs: Array<{ modelId: string; provider: string; output: string }>
        ) => Promise<import('@shared/types/project-agent').ConsensusResult>;
        createDebateSession: (payload: {
            taskId: string;
            stepIndex: number;
            topic: string;
        }) => Promise<import('@shared/types/project-agent').DebateSession | null>;
        submitDebateArgument: (payload: {
            sessionId: string;
            agentId: string;
            provider: string;
            side: import('@shared/types/project-agent').DebateSide;
            content: string;
            confidence: number;
            citations?: import('@shared/types/project-agent').DebateCitation[];
        }) => Promise<import('@shared/types/project-agent').DebateSession | null>;
        resolveDebateSession: (
            sessionId: string
        ) => Promise<import('@shared/types/project-agent').DebateSession | null>;
        overrideDebateSession: (payload: {
            sessionId: string;
            moderatorId: string;
            decision: import('@shared/types/project-agent').DebateSide | 'balanced';
            reason?: string;
        }) => Promise<import('@shared/types/project-agent').DebateSession | null>;
        getDebateSession: (
            sessionId: string
        ) => Promise<import('@shared/types/project-agent').DebateSession | null>;
        listDebateHistory: (
            taskId?: string
        ) => Promise<import('@shared/types/project-agent').DebateSession[]>;
        getDebateReplay: (
            sessionId: string
        ) => Promise<import('@shared/types/project-agent').DebateReplay | null>;
        generateDebateSummary: (sessionId: string) => Promise<string | null>;
        getTeamworkAnalytics: () => Promise<import('@shared/types/project-agent').AgentTeamworkAnalytics | null>;
        councilSendMessage: (payload: {
            taskId: string;
            stageId: string;
            fromAgentId: string;
            toAgentId?: string;
            intent: import('@shared/types/project-agent').AgentCollaborationIntent;
            priority?: import('@shared/types/project-agent').AgentCollaborationPriority;
            payload: Record<string, string | number | boolean | null>;
            expiresAt?: number;
        }) => Promise<import('@shared/types/project-agent').AgentCollaborationMessage | null>;
        councilGetMessages: (payload: {
            taskId: string;
            stageId?: string;
            agentId?: string;
            includeExpired?: boolean;
        }) => Promise<import('@shared/types/project-agent').AgentCollaborationMessage[]>;
        councilCleanupExpiredMessages: (taskId?: string) => Promise<{ success: boolean; removed: number }>;
        councilHandleQuotaInterrupt: (payload: {
            taskId: string;
            stageId?: string;
            provider: string;
            model: string;
            reason?: string;
            autoSwitch?: boolean;
        }) => Promise<{
            success: boolean;
            interruptId: string;
            checkpointId?: string;
            blockedByQuota: boolean;
            switched: boolean;
            selectedFallback?: { provider: string; model: string };
            availableFallbacks: Array<{ provider: string; model: string }>;
            message: string;
        } | null>;
        councilRegisterWorkerAvailability: (payload: {
            taskId: string;
            agentId: string;
            status: 'available' | 'busy' | 'offline';
            reason?: string;
            skills?: string[];
            contextReadiness?: number;
        }) => Promise<import('@shared/types/project-agent').WorkerAvailabilityRecord | null>;
        councilListAvailableWorkers: (payload: {
            taskId: string;
        }) => Promise<import('@shared/types/project-agent').WorkerAvailabilityRecord[]>;
        councilScoreHelperCandidates: (payload: {
            taskId: string;
            stageId: string;
            requiredSkills: string[];
            blockedAgentIds?: string[];
            contextReadinessOverrides?: Record<string, number>;
        }) => Promise<import('@shared/types/project-agent').HelperCandidateScore[]>;
        councilGenerateHelperHandoff: (payload: {
            taskId: string;
            stageId: string;
            ownerAgentId: string;
            helperAgentId: string;
            stageGoal: string;
            acceptanceCriteria: string[];
            constraints: string[];
            contextNotes?: string;
        }) => Promise<import('@shared/types/project-agent').HelperHandoffPackage | null>;
        councilReviewHelperMerge: (payload: {
            acceptanceCriteria: string[];
            constraints: string[];
            helperOutput: string;
            reviewerNotes?: string;
        }) => Promise<import('@shared/types/project-agent').HelperMergeGateDecision>;
        getTemplates: (
            category?: import('@shared/types/project-agent').AgentTemplateCategory
        ) => Promise<import('@shared/types/project-agent').AgentTemplate[]>;
        getTemplate: (
            id: string
        ) => Promise<import('@shared/types/project-agent').AgentTemplate | null>;
        saveTemplate: (
            template: import('@shared/types/project-agent').AgentTemplate
        ) => Promise<{
            success: boolean;
            template: import('@shared/types/project-agent').AgentTemplate;
        }>;
        deleteTemplate: (id: string) => Promise<{ success: boolean }>;
        exportTemplate: (
            id: string
        ) => Promise<import('@shared/types/project-agent').AgentTemplateExport | null>;
        importTemplate: (
            exported: import('@shared/types/project-agent').AgentTemplateExport
        ) => Promise<{
            success: boolean;
            template?: import('@shared/types/project-agent').AgentTemplate;
            error?: string;
        }>;
        applyTemplate: (payload: {
            templateId: string;
            values: Record<string, string | number | boolean>;
        }) => Promise<{
            success: boolean;
            template?: import('@shared/types/project-agent').AgentTemplate;
            task?: string;
            steps?: string[];
            error?: string;
        }>;
        onUpdate: (callback: (state: ProjectState) => void) => () => void;
        onQuotaInterrupt: (callback: (payload: {
            success: boolean;
            interruptId: string;
            checkpointId?: string;
            blockedByQuota: boolean;
            switched: boolean;
            selectedFallback?: { provider: string; model: string };
            availableFallbacks: Array<{ provider: string; model: string }>;
            message: string;
            v?: 'v1';
            dedupeKey?: string;
            emittedAt?: number;
        }) => void) => () => void;
        // ===== MARCH1-IPC-001: Council Protocol =====
        council: {
            generatePlan: (taskId: string, task: string) => Promise<{ success: boolean; error?: string }>;
            getProposal: (taskId: string) => Promise<{ success: boolean; plan?: ProjectStep[]; error?: string }>;
            approveProposal: (taskId: string) => Promise<{ success: boolean; error?: string }>;
            rejectProposal: (taskId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
            startExecution: (taskId: string) => Promise<{ success: boolean; error?: string }>;
            pauseExecution: (taskId: string) => Promise<{ success: boolean; error?: string }>;
            resumeExecution: (taskId: string) => Promise<{ success: boolean; error?: string }>;
            getTimeline: (taskId: string) => Promise<{ success: boolean; events?: Array<Record<string, unknown>>; error?: string }>;
        };
        // ============================================
        // Canvas persistence
        saveCanvasNodes: (
            nodes: Array<{
                id: string;
                type: string;
                position: { x: number; y: number };
                data: Record<string, IpcValue>;
            }>
        ) => Promise<void>;
        getCanvasNodes: () => Promise<
            Array<{
                id: string;
                type: string;
                position: { x: number; y: number };
                data: Record<string, IpcValue>;
            }>
        >;
        deleteCanvasNode: (id: string) => Promise<void>;
        saveCanvasEdges: (
            edges: Array<{
                id: string;
                source: string;
                target: string;
                sourceHandle?: string;
                targetHandle?: string;
            }>
        ) => Promise<void>;
        getCanvasEdges: () => Promise<
            Array<{
                id: string;
                source: string;
                target: string;
                sourceHandle?: string;
                targetHandle?: string;
            }>
        >;
        deleteCanvasEdge: (id: string) => Promise<void>;
        health: () => Promise<{
            success: boolean;
            data?: {
                status: 'healthy' | 'degraded';
                uiState: 'ready' | 'failure';
                budgets: { fastMs: number; standardMs: number; heavyMs: number };
                metrics: Record<string, IpcValue>;
            };
            error?: string;
            errorCode?: string;
            messageKey?: string;
            retryable?: boolean;
            uiState?: 'ready' | 'failure';
            fallbackUsed?: boolean;
        }>;
    };
    orchestrator: {
        start: (task: string, workspaceId?: string) => Promise<void>;
        approve: (plan: ProjectStep[]) => Promise<void>;
        getState: () => Promise<OrchestratorStateView>;
        stop: () => Promise<void>;
        onUpdate: (callback: (state: OrchestratorStateView) => void) => () => void;
    };

    metrics: {
        getProviderStats: (provider?: string) => Promise<Record<string, {
            totalRequests: number;
            successCount: number;
            errorCount: number;
            avgLatencyMs: number;
        }>>;
        getSummary: () => Promise<{
            totalRequests: number;
            successRate: number;
            avgLatencyMs: number;
            providers: string[];
        }>;
        reset: () => Promise<boolean>;
    };

    usage: {
        checkLimit: (provider: string, model: string) => Promise<{ allowed: boolean; reason?: string }>;
        getUsageCount: (period: 'hourly' | 'daily' | 'weekly', provider?: string, model?: string) => Promise<number>;
        recordUsage: (provider: string, model: string) => Promise<{ success: boolean }>;
    };

    workflow: {
        getAll: () => Promise<import('@shared/types/workflow.types').Workflow[]>;
        get: (id: string) => Promise<import('@shared/types/workflow.types').Workflow | null>;
        create: (workflow: Omit<import('@shared/types/workflow.types').Workflow, 'id' | 'createdAt' | 'updatedAt'>) => Promise<import('@shared/types/workflow.types').Workflow>;
        update: (id: string, updates: Partial<import('@shared/types/workflow.types').Workflow>) => Promise<import('@shared/types/workflow.types').Workflow>;
        delete: (id: string) => Promise<void>;
        execute: (id: string, context?: Record<string, unknown>) => Promise<import('@shared/types/workflow.types').WorkflowExecutionResult>;
        triggerManual: (triggerId: string, context?: Record<string, unknown>) => Promise<void>;
    };

    voice: {
        getSettings: () => Promise<VoiceSettings>;
        updateSettings: (settings: Partial<VoiceSettings>) => Promise<{ success: boolean; settings: VoiceSettings }>;
        getCommands: () => Promise<VoiceCommand[]>;
        addCommand: (command: VoiceCommand) => Promise<{ success: boolean; command: VoiceCommand }>;
        removeCommand: (commandId: string) => Promise<{ success: boolean }>;
        processTranscript: (transcript: string) => Promise<{
            success: boolean;
            result: VoiceRecognitionResult;
            command: VoiceCommand | null;
        }>;
        executeCommand: (command: VoiceCommand) => Promise<{ success: boolean; action: string }>;
        getVoices: () => Promise<VoiceInfo[]>;
        synthesize: (options: VoiceSynthesisOptions) => Promise<{ success: boolean }>;
        health: () => Promise<{
            success: boolean;
            data?: {
                status: 'healthy' | 'degraded';
                uiState: 'ready' | 'failure';
                budgets: { fastMs: number; standardMs: number; heavyMs: number };
                metrics: Record<string, IpcValue>;
            };
            error?: string;
            errorCode?: string;
            messageKey?: string;
            retryable?: boolean;
        }>;
    };

    extension: {
        getAll: () => Promise<{
            success: boolean;
            extensions: Array<{
                manifest: import('@shared/types/extension').ExtensionManifest;
                status: import('@shared/types/extension').ExtensionStatus;
            }>;
        }>;
        get: (extensionId: string) => Promise<{
            success: boolean;
            extension?: {
                manifest: import('@shared/types/extension').ExtensionManifest;
                status: import('@shared/types/extension').ExtensionStatus;
            };
        }>;
        install: (extensionPath: string) => Promise<{ success: boolean; extensionId?: string; error?: string }>;
        uninstall: (extensionId: string) => Promise<{ success: boolean; error?: string }>;
        activate: (extensionId: string) => Promise<{ success: boolean; error?: string }>;
        deactivate: (extensionId: string) => Promise<{ success: boolean; error?: string }>;
        devStart: (options: import('@shared/types/extension').ExtensionDevOptions) => Promise<{ success: boolean; error?: string }>;
        devStop: (extensionId: string) => Promise<{ success: boolean; error?: string }>;
        devReload: (extensionId: string) => Promise<{ success: boolean; error?: string }>;
        test: (options: import('@shared/types/extension').ExtensionTestOptions) => Promise<import('@shared/types/extension').ExtensionTestResult>;
        publish: (options: import('@shared/types/extension').ExtensionPublishOptions) => Promise<import('@shared/types/extension').ExtensionPublishResult>;
        getProfile: (extensionId: string) => Promise<{
            success: boolean;
            profile?: import('@shared/types/extension').ExtensionProfileData;
        }>;
        getState: (extensionId: string) => Promise<{
            success: boolean;
            state?: { global: Record<string, unknown>; workspace: Record<string, unknown> };
        }>;
        validate: (manifest: unknown) => Promise<{ valid: boolean; errors: string[] }>;
    };

    codeSandbox: {
        execute: (params: {
            language: string;
            code: string;
        }) => Promise<{
            success: boolean;
            stdout: string;
            stderr: string;
            durationMs: number;
        }>;
    };

    promptTemplates: {
        getAll: () => Promise<import('@shared/types/templates').PromptTemplate[]>;
        search: (query: string) => Promise<import('@shared/types/templates').PromptTemplate[]>;
        getCategories: () => Promise<string[]>;
        create: (payload: {
            name: string;
            description: string;
            template: string;
            category: string;
            variables: import('@shared/types/templates').TemplateVariable[];
            tags: string[];
        }) => Promise<import('@shared/types/templates').PromptTemplate>;
        update: (id: string, payload: {
            name: string;
            description: string;
            template: string;
            category: string;
            variables: import('@shared/types/templates').TemplateVariable[];
            tags: string[];
        }) => Promise<import('@shared/types/templates').PromptTemplate>;
        delete: (id: string) => Promise<void>;
    };

    userCollaboration: {
        joinRoom: (params: { type: string; id: string }) => Promise<void>;
        leaveRoom: (roomId: string) => Promise<void>;
        sendUpdate: (params: { roomId: string; data: string }) => Promise<void>;
        onSyncUpdate: (callback: (payload: { roomId: string; data: string }) => void) => () => void;
        onError: (callback: (payload: { roomId: string; error: string }) => void) => () => void;
    };
}
