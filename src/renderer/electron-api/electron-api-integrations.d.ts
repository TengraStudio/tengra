/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type {
    IpcContractVersionInfo,
} from '@shared/constants/ipc-contract';
import type {
    CollaborationResponse,
    CollaborationSyncUpdate,
    JoinCollaborationRoom,
} from '@shared/schemas/collaboration.schema';
import type { LocalePack } from '@shared/types/locale';
import type {
    InstallRequest,
    InstallResult,
    MarketplaceItem,
    MarketplaceRegistry,
    MarketplaceRuntimeProfile,
    MarketplaceSkill,
} from '@shared/types/marketplace';
import type { ProxySkill, ProxySkillUpsertInput } from '@shared/types/skill';
import type {
    IpcRendererEvent,
} from 'electron';

import type {
    ModelDefinition,
} from '@/electron.d';
import type {
    AgentDefinition,
    Chat,
    Folder,
    IpcValue,
    Message,
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
    Workspace,
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
        getWorkspaces: () => Promise<Workspace[]>;
        getFolders: () => Promise<Folder[]>;
        createWorkspace: (
            name: string,
            path: string,
            description: string,
            mounts?: WorkspaceMount[]
        ) => Promise<Workspace>;
        updateWorkspace: (id: string, updates: Partial<Workspace>) => Promise<Workspace | null>;
        deleteWorkspace: (id: string, deleteFiles?: boolean) => Promise<void>;
        archiveWorkspace: (id: string, isArchived: boolean) => Promise<void>;
        bulkDeleteWorkspaces: (ids: string[], deleteFiles?: boolean) => Promise<void>;
        bulkArchiveWorkspaces: (ids: string[], isArchived: boolean) => Promise<void>;
        createFolder: (name: string, color?: string) => Promise<Folder>;
        deleteFolder: (id: string) => Promise<void>;
        updateFolder: (id: string, updates: Partial<Folder>) => Promise<void>;
        onWorkspaceUpdated: (callback: (payload: { id?: string }) => void) => () => void;

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
        getDiscoverySnapshot: (options?: { refresh?: boolean }) => Promise<{
            terminalAvailable: boolean;
            shells: Array<{ id: string; name: string; path: string }>;
            backends: Array<{ id: string; name: string; available: boolean }>;
            refreshedAt: number;
        }>;
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
            metadata?: Record<string, RendererDataValue>;
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
            metadata?: Record<string, RendererDataValue>;
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
            metadata?: Record<string, RendererDataValue>;
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
            metadata?: Record<string, RendererDataValue>;
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
        copyPath: (
            connectionId: string,
            sourcePath: string,
            destinationPath: string
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

    proxyEmbed: {
        start: (options?: {
            port?: number;
            health?: boolean;
        }) => Promise<IpcValue>;
        stop: () => Promise<IpcValue>;
        status: () => Promise<IpcValue>;
    };

    marketplace: {
        fetch: () => Promise<MarketplaceRegistry>;
        getRuntimeProfile: () => Promise<MarketplaceRuntimeProfile>;
        getUpdateCount: () => Promise<number>;
        checkLiveUpdates: () => Promise<number>;
        install: (request: InstallRequest) => Promise<InstallResult>;
        fetchReadme: (extensionId: string, repository?: string) => Promise<string | null>;
        uninstall: (itemId: string, itemType: MarketplaceItem['itemType']) => Promise<{ success: boolean; error?: string; messageKey?: string }>;
    };
    locale: {
        getAll: () => Promise<LocalePack[]>;
    };

    // Screenshot
    log: {
        write: (
            level: 'debug' | 'info' | 'warn' | 'error',
            message: string,
            data?: IpcValue,
            context?: string
        ) => void;
        debug: (message: string, data?: IpcValue, context?: string) => void;
        info: (message: string, data?: IpcValue, context?: string) => void;
        warn: (message: string, data?: IpcValue, context?: string) => void;
        error: (message: string, data?: IpcValue, context?: string) => void;
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
    modelCollaboration: ElectronApiIntegrationsDomain['collaboration'];

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
    session: {
        conversation: import('@shared/types/session-conversation').SessionConversationApi;
        workspace: import('@shared/types/session-domain-apis').SessionWorkspaceApi;
        council: import('@shared/types/session-domain-apis').SessionCouncilApi;
        workspaceAgent: import('@shared/types/session-domain-apis').SessionWorkspaceAgentApi;
        getState: (sessionId: string) => Promise<import('@shared/types/session-engine').SessionState | null>;
        list: () => Promise<import('@shared/types/session-engine').SessionRecoverySnapshot[]>;
        listCapabilities: () => Promise<import('@shared/types/session-engine').SessionCapabilityDescriptor[]>;
        health: () => Promise<{ status: 'ready'; activeSessions: number }>;
        onEvent: (callback: (event: import('@shared/types/session-engine').SessionEventEnvelope) => void) => () => void;
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
        listSkills: () => Promise<ProxySkill[]>;
        saveSkill: (input: ProxySkillUpsertInput) => Promise<ProxySkill>;
        toggleSkill: (skillId: string, enabled: boolean) => Promise<ProxySkill>;
        deleteSkill: (skillId: string) => Promise<boolean>;
        listMarketplaceSkills: () => Promise<MarketplaceSkill[]>;
        installMarketplaceSkill: (skillId: string) => Promise<ProxySkill>;
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
        uninstall: (extensionId: string) => Promise<{ success: boolean; error?: string; messageKey?: string; messageParams?: Record<string, string | number> }>;
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
            state?: { global: Record<string, RendererDataValue>; workspace: Record<string, RendererDataValue> };
        }>;
        validate: (manifest: RendererDataValue) => Promise<{ valid: boolean; errors: string[] }>;
        getConfig: (extensionId: string) => Promise<{ success: boolean; config?: Record<string, IpcValue>; error?: string }>;
        updateConfig: (extensionId: string, config: Record<string, IpcValue>) => Promise<{ success: boolean; config?: Record<string, IpcValue>; error?: string }>;
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

    sharedPrompts: {
        list: (filter?: {
            query?: string;
            category?: string;
            tags?: string[];
            limit?: number;
            offset?: number;
        }) => Promise<Array<{
            id: string;
            title: string;
            content: string;
            category: string;
            tags: string[];
            author: string;
            createdAt: number;
            updatedAt: number;
        }>>;
        create: (input: {
            title: string;
            content: string;
            category?: string;
            tags?: string[];
            author?: string;
        }) => Promise<{
            id: string;
            title: string;
            content: string;
            category: string;
            tags: string[];
            author: string;
            createdAt: number;
            updatedAt: number;
        }>;
        update: (id: string, input: {
            title?: string;
            content?: string;
            category?: string;
            tags?: string[];
            author?: string;
        }) => Promise<{
            id: string;
            title: string;
            content: string;
            category: string;
            tags: string[];
            author: string;
            createdAt: number;
            updatedAt: number;
        } | undefined>;
        delete: (id: string) => Promise<boolean>;
        export: (filePath?: string) => Promise<{ success: boolean; path?: string; data?: string }>;
        import: (filePathOrJson: string, isFilePath?: boolean) => Promise<{ success: boolean; imported: number }>;
    };

    userCollaboration: {
        joinRoom: (params: JoinCollaborationRoom) => Promise<CollaborationResponse>;
        leaveRoom: (roomId: string) => Promise<CollaborationResponse>;
        sendUpdate: (params: CollaborationSyncUpdate) => Promise<CollaborationResponse>;
        onJoined: (callback: (payload: { roomId: string }) => void) => () => void;
        onLeft: (callback: (payload: { roomId: string }) => void) => () => void;
        onSyncUpdate: (callback: (payload: { roomId: string; data: string }) => void) => () => void;
        onError: (callback: (payload: { roomId: string; error: string }) => void) => () => void;
    };
    liveCollaboration: ElectronApiIntegrationsDomain['userCollaboration'];
}
