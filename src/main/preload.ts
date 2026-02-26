import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Increase max listeners for ipcRenderer to handle multiple terminal/process streams
ipcRenderer.setMaxListeners(60);
import { McpMarketplaceServer } from '@main/services/mcp/mcp-marketplace.service';
import { type IpcContractVersionInfo, isIpcContractCompatible } from '@shared/constants/ipc-contract';
import {
    AgentDefinition,
    AgentStartOptions,
    AgentTemplate,
    AgentTemplateCategory,
    AgentTemplateExport,
    AppSettings,
    Chat,
    ChatRequest,
    ChatStreamRequest,
    CodexUsage,
    CopilotQuota,
    EntityKnowledge,
    EpisodicMemory,
    FileEntry,
    FileSearchResult,
    Folder,
    IpcValue,
    MCPServerConfig,
    Message,
    OllamaLibraryModel,
    ProcessInfo,
    Project,
    ProjectAnalysis,
    ProjectState,
    ProjectStep,
    Prompt,
    QuotaResponse,
    SemanticFragment,
    SSHConfig,
    SSHConnection,
    SSHDevContainer,
    SSHExecOptions,
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
    TodoItem,
    ToolCall,
    ToolDefinition,
    ToolResult,
} from '@shared/types';
import {
    AdvancedSemanticFragment,
    MemoryCategory,
    MemoryImportResult,
    MemorySearchAnalytics,
    MemorySearchHistoryEntry,
    MemoryStatistics,
    PendingMemory,
    RecallContext,
    SharedMemoryAnalytics,
    SharedMemoryNamespace,
    SharedMemorySyncRequest,
    SharedMemorySyncResult,
} from '@shared/types/advanced-memory';
import {
    AgentTeamworkAnalytics,
    ConsensusResult,
    DebateCitation,
    DebateReplay,
    DebateSession,
    DebateSide,
    ModelRoutingRule,
    OrchestratorState,
    VotingConfiguration,
    VotingSession,
    VotingTemplate
} from '@shared/types/project-agent';
import { isProjectState } from '@shared/utils/type-guards.util';

import { createAuthBridge } from './preload/domains/auth.preload';
import { createWindowControlsBridge } from './preload/domains/window-controls.preload';

interface ModelDefinition {
    id: string;
    name: string;
    provider: string;
    quotaInfo?: {
        remainingQuota?: number;
        totalQuota?: number;
        resetTime?: string;
        remainingFraction?: number;
    };
    percentage?: number;
    reset?: string;
    [key: string]: IpcValue | undefined;
}

// Marketplace model from database
interface DbMarketplaceModel {
    id: string;
    name: string;
    provider: 'ollama' | 'huggingface';
    pulls?: string;
    tagCount: number;
    lastUpdated?: string;
    categories: string[];
    shortDescription?: string;
    downloads?: number;
    likes?: number;
    author?: string;
    createdAt: number;
    updatedAt: number;
}

interface OllamaMarketplaceModelDetails {
    name: string;
    shortDescription: string;
    longDescriptionHtml: string;
    versions: Array<{
        version: string;
        size: string;
        maxContext: string;
        inputType: string;
        digest: string;
    }>;
}

interface HuggingFaceMarketplaceModelDetails {
    name: string;
    shortDescription: string;
    longDescriptionMarkdown: string;
}

type MarketplaceModelDetails = OllamaMarketplaceModelDetails | HuggingFaceMarketplaceModelDetails;

interface ProxyModelResponse {
    data: ModelDefinition[];
    antigravityError?: string;
    [key: string]: IpcValue | undefined;
}

interface LlamaModel {
    name: string;
    path: string;
    size: number;
}

export interface LinkedAccountInfo {
    id: string;
    provider: string;
    email?: string;
    displayName?: string;
    avatarUrl?: string;
    isActive: boolean;
    createdAt: number;
}

export interface TokenData {
    accessToken?: string;
    refreshToken?: string;
    sessionToken?: string;
    email?: string;
    displayName?: string;
    avatarUrl?: string;
    expiresAt?: number;
    scope?: string;
    metadata?: Record<string, IpcValue>;
}

export interface ElectronAPI {
    // Window controls
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    resizeWindow: (resolution: string) => void;
    toggleCompact: (enabled: boolean) => void;

    // Auth
    githubLogin: (appId?: 'profile' | 'copilot') => Promise<{
        device_code: string;
        user_code: string;
        verification_uri: string;
        expires_in: number;
        interval: number;
    }>;
    pollToken: (
        deviceCode: string,
        interval: number,
        appId?: 'profile' | 'copilot'
    ) => Promise<{ success: boolean; token?: string; error?: string }>;
    antigravityLogin: () => Promise<{ url: string; state: string }>;

    saveClaudeSession: (
        sessionKey: string,
        accountId?: string
    ) => Promise<{ success: boolean; error?: string }>;

    code: {
        scanTodos: (rootPath: string) => Promise<TodoItem[]>;
        findSymbols: (rootPath: string, query: string) => Promise<FileSearchResult[]>;
        findDefinition: (rootPath: string, symbol: string) => Promise<FileSearchResult | null>;
        findReferences: (rootPath: string, symbol: string) => Promise<FileSearchResult[]>;
        findImplementations: (rootPath: string, symbol: string) => Promise<FileSearchResult[]>;
        getSymbolRelationships: (
            rootPath: string,
            symbol: string,
            maxItems?: number
        ) => Promise<FileSearchResult[]>;
        getFileOutline: (filePath: string) => Promise<FileSearchResult[]>;
        previewRenameSymbol: (
            rootPath: string,
            symbol: string,
            newSymbol: string,
            maxFiles?: number
        ) => Promise<{
            success: boolean;
            applied: boolean;
            symbol: string;
            newSymbol: string;
            totalFiles: number;
            totalOccurrences: number;
            changes: Array<{
                file: string;
                replacements: Array<{ line: number; occurrences: number; before: string; after: string }>;
            }>;
            updatedFiles: string[];
            errors: Array<{ file: string; error: string }>;
        }>;
        applyRenameSymbol: (
            rootPath: string,
            symbol: string,
            newSymbol: string,
            maxFiles?: number
        ) => Promise<{
            success: boolean;
            applied: boolean;
            symbol: string;
            newSymbol: string;
            totalFiles: number;
            totalOccurrences: number;
            changes: Array<{
                file: string;
                replacements: Array<{ line: number; occurrences: number; before: string; after: string }>;
            }>;
            updatedFiles: string[];
            errors: Array<{ file: string; error: string }>;
        }>;
        generateFileDocumentation: (
            filePath: string,
            format?: 'markdown' | 'jsdoc-comments'
        ) => Promise<{
            success: boolean;
            filePath: string;
            format: 'markdown' | 'jsdoc-comments';
            classSymbols: number;
            longLineCount: number;
            todoLikeCount: number;
            consoleUsageCount: number;
            averageComplexity: number;
            securityIssueCount: number;
            topSecurityFindings: Array<{ file: string; line: number; rule: string; snippet: string }>;
            highestComplexityFiles: Array<{ file: string; complexity: number }>;
            qualityScore: number;
            generatedAt: string;
        }>;
        generateProjectDocumentation: (
            rootPath: string,
            maxFiles?: number
        ) => Promise<{
            success: boolean;
            filePath: string;
            format: 'markdown' | 'jsdoc-comments';
            content: string;
            symbolCount: number;
            generatedAt: string;
            error?: string;
        }>;
        analyzeQuality: (rootPath: string, maxFiles?: number) => Promise<{
            rootPath: string;
            filesScanned: number;
            totalLines: number;
            functionSymbols: number;
            classSymbols: number;
            longLineCount: number;
            todoLikeCount: number;
            consoleUsageCount: number;
            averageComplexity: number;
            securityIssueCount: number;
            topSecurityFindings: Array<{ file: string; line: number; rule: string; snippet: string }>;
            highestComplexityFiles: Array<{ file: string; complexity: number }>;
            qualityScore: number;
            generatedAt: string;
        }>;
        searchFiles: (
            rootPath: string,
            query: string,
            projectId?: string,
            isRegex?: boolean
        ) => Promise<FileSearchResult[]>;
        indexProject: (rootPath: string, projectId: string) => Promise<void>;
        queryIndexedSymbols: (
            query: string
        ) => Promise<{ name: string; path: string; line: number }[]>;
        getSymbolAnalytics: (rootPath: string) => Promise<{
            totalSymbols: number;
            uniqueFiles: number;
            uniqueKinds: number;
            byKind: Record<string, number>;
            byExtension: Record<string, number>;
            topFiles: Array<{ path: string; count: number }>;
            topSymbols: Array<{ name: string; count: number }>;
            generatedAt: string;
        }>;
    };

    // Proxy
    getProxyModels: () => Promise<ProxyModelResponse>;
    getQuota: () => Promise<{
        accounts: Array<QuotaResponse & { accountId?: string; email?: string }>;
    } | null>;
    getCopilotQuota: () => Promise<{
        accounts: Array<CopilotQuota & { accountId?: string; email?: string }>;
    }>;
    getCodexUsage: () => Promise<{
        accounts: Array<{ usage: CodexUsage; accountId?: string; email?: string }>;
    }>;
    getClaudeQuota: () => Promise<{ accounts: Array<import('@shared/types/quota').ClaudeQuota> }>;
    checkUsageLimit: (
        provider: string,
        model: string
    ) => Promise<{ allowed: boolean; reason?: string }>;
    getUsageCount: (
        period: 'hourly' | 'daily' | 'weekly',
        provider?: string,
        model?: string
    ) => Promise<number>;

    runCommand: (
        command: string,
        args: string[],
        cwd?: string
    ) => Promise<{ stdout: string; stderr: string; code: number }>;
    git: {
        getBranch: (cwd: string) => Promise<{ success: boolean; branch?: string; error?: string }>;
        getStatus: (cwd: string) => Promise<{
            success: boolean;
            isClean?: boolean;
            changes?: number;
            files?: Array<{ path: string; status: string }>;
            error?: string;
        }>;
        getLastCommit: (cwd: string) => Promise<{
            success: boolean;
            hash?: string;
            message?: string;
            author?: string;
            relativeTime?: string;
            date?: string;
            error?: string;
        }>;
        getRecentCommits: (
            cwd: string,
            count?: number
        ) => Promise<{
            success: boolean;
            commits?: Array<{ hash: string; message: string; author: string; date: string }>;
            error?: string;
        }>;
        getBranches: (
            cwd: string
        ) => Promise<{ success: boolean; branches?: string[]; error?: string }>;
        isRepository: (cwd: string) => Promise<{ success: boolean; isRepository?: boolean }>;
        getFileDiff: (
            cwd: string,
            filePath: string,
            staged?: boolean
        ) => Promise<{ original: string; modified: string; success: boolean; error?: string }>;
        getUnifiedDiff: (
            cwd: string,
            filePath: string,
            staged?: boolean
        ) => Promise<{ diff: string; success: boolean; error?: string }>;
        stageFile: (cwd: string, filePath: string) => Promise<{ success: boolean; error?: string }>;
        unstageFile: (
            cwd: string,
            filePath: string
        ) => Promise<{ success: boolean; error?: string }>;
        getDetailedStatus: (cwd: string) => Promise<{
            success: boolean;
            staged?: Array<{ path: string; status: string }>;
            unstaged?: Array<{ path: string; status: string }>;
            error?: string;
        }>;
        checkout: (cwd: string, branch: string) => Promise<{ success: boolean; error?: string }>;
        commit: (cwd: string, message: string) => Promise<{ success: boolean; error?: string }>;
        push: (
            cwd: string,
            remote?: string,
            branch?: string
        ) => Promise<{ success: boolean; error?: string; stdout?: string; stderr?: string }>;
        pull: (
            cwd: string
        ) => Promise<{ success: boolean; error?: string; stdout?: string; stderr?: string }>;
        getRemotes: (cwd: string) => Promise<{
            success: boolean;
            remotes?: Array<{ name: string; url: string; fetch: boolean; push: boolean }>;
            error?: string;
        }>;
        getTrackingInfo: (cwd: string) => Promise<{
            success: boolean;
            tracking?: string | null;
            ahead?: number;
            behind?: number;
        }>;
        getCommitStats: (
            cwd: string,
            days?: number
        ) => Promise<{ success: boolean; commitCounts?: Record<string, number>; error?: string }>;
        getDiffStats: (cwd: string) => Promise<{
            success: boolean;
            staged?: { added: number; deleted: number; files: number };
            unstaged?: { added: number; deleted: number; files: number };
            total?: { added: number; deleted: number; files: number };
            error?: string;
        }>;
    };

    // Ollama chat
    getModels: () => Promise<ModelDefinition[] | { antigravityError?: string }>;
    chat: (messages: Message[], model: string) => Promise<{ content: string; done: boolean }>;
    chatOpenAI: (request: ChatRequest) => Promise<{
        content: string;
        toolCalls?: ToolCall[];
        reasoning?: string;
        images?: string[];
        sources?: string[];
    }>;
    chatStream: (request: ChatStreamRequest) => Promise<{ success: boolean; queued?: boolean }>;
    abortChat: () => void;
    onStreamChunk: (
        callback: (chunk: { content?: string; toolCalls?: ToolCall[]; reasoning?: string }) => void
    ) => () => void;
    removeStreamChunkListener: () => void;

    // Ollama management
    isOllamaRunning: () => Promise<boolean>;
    startOllama: () => Promise<{ success: boolean; message: string }>;
    pullModel: (modelName: string) => Promise<{ success: boolean; error?: string }>;
    deleteOllamaModel: (modelName: string) => Promise<{ success: boolean; error?: string }>;
    getLibraryModels: () => Promise<OllamaLibraryModel[]>;
    onPullProgress: (
        callback: (progress: {
            status: string;
            digest?: string;
            total?: number;
            completed?: number;
            modelName?: string;
        }) => void
    ) => () => void;
    removePullProgressListener: () => void;

    // New health and GPU checks
    getOllamaHealthStatus: () => Promise<IpcValue>;
    forceOllamaHealthCheck: () => Promise<void>;
    checkCuda: () => Promise<{ hasCuda: boolean; detail?: string }>;
    onOllamaStatusChange: (callback: (status: 'ok' | 'error' | 'stopped') => void) => void;

    // OLLAMA-01: Model Health & Recommendations
    checkOllamaModelHealth: (modelName: string) => Promise<IpcValue>;
    checkAllOllamaModelsHealth: () => Promise<IpcValue[]>;
    getOllamaModelRecommendations: (category?: 'coding' | 'creative' | 'reasoning' | 'general' | 'multimodal') => Promise<IpcValue[]>;
    getRecommendedOllamaModelForTask: (task: string) => Promise<IpcValue | null>;

    // OLLAMA-02: Connection Handling
    getOllamaConnectionStatus: () => Promise<IpcValue>;
    testOllamaConnection: () => Promise<IpcValue>;
    reconnectOllama: () => Promise<boolean>;

    // OLLAMA-03: GPU Monitoring
    getOllamaGPUInfo: () => Promise<IpcValue>;
    startOllamaGPUMonitoring: (intervalMs?: number) => Promise<{ success: boolean; intervalMs: number }>;
    stopOllamaGPUMonitoring: () => Promise<{ success: boolean }>;
    setOllamaGPUAlertThresholds: (thresholds: { highMemoryPercent?: number; highTemperatureC?: number; lowMemoryMB?: number }) => Promise<{ success: boolean }>;
    getOllamaGPUAlertThresholds: () => Promise<{ highMemoryPercent: number; highTemperatureC: number; lowMemoryMB: number }>;
    onOllamaGPUAlert: (callback: (alert: IpcValue) => void) => () => void;
    onOllamaGPUStatus: (callback: (status: IpcValue) => void) => () => void;

    // Marketplace API (models from database)
    marketplace: {
        getModels: (provider?: 'ollama' | 'huggingface', limit?: number, offset?: number) => Promise<DbMarketplaceModel[]>;
        searchModels: (query: string, provider?: 'ollama' | 'huggingface', limit?: number) => Promise<DbMarketplaceModel[]>;
        getModelDetails: (modelName: string, provider?: 'ollama' | 'huggingface') => Promise<MarketplaceModelDetails | null>;
        getStatus: () => Promise<{ lastScrapeTime: number; isScraping: boolean }>;
    };

    // llama.cpp
    llama: {
        loadModel: (
            modelPath: string,
            config?: Record<string, IpcValue>
        ) => Promise<{ success: boolean; error?: string }>;
        unloadModel: () => Promise<{ success: boolean }>;
        chat: (
            message: string,
            systemPrompt?: string
        ) => Promise<{ success: boolean; response?: string; error?: string }>;
        resetSession: () => Promise<{ success: boolean }>;
        getModels: () => Promise<LlamaModel[]>;
        downloadModel: (
            url: string,
            filename: string
        ) => Promise<{ success: boolean; path?: string; error?: string }>;
        deleteModel: (modelPath: string) => Promise<{ success: boolean; error?: string }>;
        getConfig: () => Promise<Record<string, IpcValue>>;
        setConfig: (config: Record<string, IpcValue>) => Promise<{ success: boolean }>;
        getGpuInfo: () => Promise<{ available: boolean; name?: string; vram?: number }>;
        getModelsDir: () => Promise<string>;
        onToken: (callback: (token: string) => void) => void;
        removeTokenListener: () => void;
        onDownloadProgress: (
            callback: (progress: { downloaded: number; total: number }) => void
        ) => void;
        removeDownloadProgressListener: () => void;
    };
    sdCpp: {
        getStatus: () => Promise<string>;
        reinstall: () => Promise<void>;
        getHistory: (limit?: number) => Promise<Array<{
            id: string;
            provider: string;
            prompt: string;
            negativePrompt?: string;
            width: number;
            height: number;
            steps: number;
            cfgScale: number;
            seed: number;
            imagePath: string;
            createdAt: number;
            source?: string;
        }>>;
        regenerate: (historyId: string) => Promise<string>;
        getAnalytics: () => Promise<{
            totalGenerated: number;
            byProvider: Record<string, number>;
            averageSteps: number;
        }>;
        listPresets: () => Promise<Array<{
            id: string;
            name: string;
            promptPrefix?: string;
            width: number;
            height: number;
            steps: number;
            cfgScale: number;
            provider?: string;
            createdAt: number;
            updatedAt: number;
        }>>;
        savePreset: (preset: {
            id?: string;
            name: string;
            promptPrefix?: string;
            width: number;
            height: number;
            steps: number;
            cfgScale: number;
            provider?: 'antigravity' | 'ollama' | 'sd-webui' | 'comfyui' | 'pollinations' | 'sd-cpp';
        }) => Promise<unknown>;
        deletePreset: (id: string) => Promise<boolean>;
        schedule: (payload: {
            runAt: number;
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
        }) => Promise<unknown>;
        listSchedules: () => Promise<unknown[]>;
        cancelSchedule: (id: string) => Promise<boolean>;
        compare: (ids: string[]) => Promise<unknown>;
        batchGenerate: (requests: Array<{
            prompt: string;
            negativePrompt?: string;
            width?: number;
            height?: number;
            steps?: number;
            cfgScale?: number;
            seed?: number;
            count?: number;
        }>) => Promise<string[]>;
        getQueueStats: () => Promise<{ queued: number; running: boolean }>;
        edit: (options: {
            sourceImage: string;
            mode: 'img2img' | 'inpaint' | 'outpaint' | 'style-transfer';
            prompt: string;
            negativePrompt?: string;
            strength?: number;
            width?: number;
            height?: number;
            maskImage?: string;
        }) => Promise<string>;
    };
    clipboard: {
        writeText: (text: string) => Promise<{ success: boolean }>;
        readText: () => Promise<{ success: boolean; text: string }>;
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
    modelDownloader: {
        start: (request: Record<string, unknown>) => Promise<unknown>;
        pause: (downloadId: string) => Promise<unknown>;
        resume: (downloadId: string) => Promise<unknown>;
        cancel: (downloadId: string) => Promise<unknown>;
    };

    // Database
    db: {
        createChat: (chat: Chat) => Promise<{ success: boolean }>;
        updateChat: (id: string, updates: Partial<Chat>) => Promise<{ success: boolean }>;
        deleteChat: (id: string) => Promise<{ success: boolean }>;
        duplicateChat: (id: string) => Promise<Chat>;
        archiveChat: (id: string, isArchived: boolean) => Promise<{ success: boolean }>;
        bulkDeleteChats: (ids: string[]) => Promise<{ success: boolean }>;
        bulkArchiveChats: (ids: string[], isArchived: boolean) => Promise<{ success: boolean }>;
        getChat: (id: string) => Promise<Chat | null>;
        getAllChats: () => Promise<Chat[]>;
        getPrompts: () => Promise<{ id: string; title: string; content: string; tags: string[] }[]>;
        createPrompt: (
            title: string,
            content: string,
            tags?: string[]
        ) => Promise<{ success: boolean }>;
        updatePrompt: (
            id: string,
            updates: Record<string, IpcValue>
        ) => Promise<{ success: boolean }>;
        deletePrompt: (id: string) => Promise<{ success: boolean }>;
        searchChats: (query: string) => Promise<Chat[]>;
        addMessage: (message: Message) => Promise<{ success: boolean }>;
        deleteMessage: (id: string) => Promise<{ success: boolean }>;
        updateMessage: (id: string, updates: Partial<Message>) => Promise<{ success: boolean }>;
        deleteAllChats: () => Promise<{ success: boolean }>;
        deleteChatsByTitle: (title: string) => Promise<number>;
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
            projectCodingTime: Record<string, number>;
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
            projectId?: string;
            provider: string;
            model: string;
            tokensSent: number;
            tokensReceived: number;
            costEstimate?: number;
        }) => Promise<{ success: boolean }>;
        getProjects: () => Promise<Project[]>;
        createProject: (
            name: string,
            path: string,
            description: string,
            mounts?: string
        ) => Promise<Project>;
        updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
        deleteProject: (id: string, deleteFiles?: boolean) => Promise<void>;
        archiveProject: (id: string, isArchived: boolean) => Promise<void>;
        createFolder: (name: string, color?: string) => Promise<Folder>;
        deleteFolder: (id: string) => Promise<void>;
        updateFolder: (id: string, updates: Partial<Folder>) => Promise<void>;
        getFolders: () => Promise<Folder[]>;
    };

    memory: {
        getAll: () => Promise<{
            facts: SemanticFragment[];
            episodes: EpisodicMemory[];
            entities: EntityKnowledge[];
        }>;
        addFact: (
            content: string,
            tags?: string[]
        ) => Promise<{ success: boolean; id?: string; error?: string }>;
        deleteFact: (id: string) => Promise<{ success: boolean; error?: string }>;
        deleteEntity: (id: string) => Promise<{ success: boolean; error?: string }>;
        setEntityFact: (
            entityType: string,
            entityName: string,
            key: string,
            value: string
        ) => Promise<{ success: boolean; id?: string; error?: string }>;
        search: (
            query: string
        ) => Promise<{ facts: SemanticFragment[]; episodes: EpisodicMemory[] }>;
    };

    /**
     * Advanced Memory System - Staging buffer, validation, context-aware recall
     */
    advancedMemory: {
        // Pending memories (staging buffer)
        getPending: () => Promise<{ success: boolean; data: PendingMemory[]; error?: string }>;
        confirm: (
            id: string,
            adjustments?: {
                content?: string;
                category?: MemoryCategory;
                tags?: string[];
                importance?: number;
            }
        ) => Promise<{ success: boolean; data?: AdvancedSemanticFragment; error?: string }>;
        reject: (id: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
        confirmAll: () => Promise<{ success: boolean; confirmed: number; error?: string }>;
        rejectAll: () => Promise<{ success: boolean; rejected: number; error?: string }>;

        // Explicit memory
        remember: (
            content: string,
            options?: { category?: MemoryCategory; tags?: string[]; projectId?: string }
        ) => Promise<{ success: boolean; data?: AdvancedSemanticFragment; error?: string }>;

        // Recall
        recall: (context: RecallContext) => Promise<{
            success: boolean;
            data: { memories: AdvancedSemanticFragment[]; totalMatches: number };
            error?: string;
        }>;
        search: (
            query: string,
            limit?: number
        ) => Promise<{ success: boolean; data: AdvancedSemanticFragment[]; error?: string }>;
        getSearchAnalytics: () => Promise<{ success: boolean; data: MemorySearchAnalytics; error?: string }>;
        getSearchHistory: (
            limit?: number
        ) => Promise<{ success: boolean; data: MemorySearchHistoryEntry[]; error?: string }>;
        getSearchSuggestions: (
            prefix?: string,
            limit?: number
        ) => Promise<{ success: boolean; data: string[]; error?: string }>;
        export: (
            query?: string,
            limit?: number
        ) => Promise<{
            success: boolean;
            data?: {
                exportedAt: string;
                query?: string;
                count: number;
                memories: AdvancedSemanticFragment[];
            };
            error?: string;
        }>;
        import: (payload: {
            memories?: Array<Partial<AdvancedSemanticFragment>>;
            pendingMemories?: Array<Partial<PendingMemory>>;
            replaceExisting?: boolean;
        }) => Promise<{ success: boolean; data?: MemoryImportResult; error?: string }>;

        // Stats & Maintenance
        getStats: () => Promise<{ success: boolean; data?: MemoryStatistics; error?: string }>;
        runDecay: () => Promise<{ success: boolean; error?: string }>;

        // Extraction
        extractFromMessage: (
            content: string,
            sourceId: string,
            projectId?: string
        ) => Promise<{ success: boolean; data: PendingMemory[]; error?: string }>;

        // Delete & Edit
        delete: (id: string) => Promise<{ success: boolean; error?: string }>;
        deleteMany: (
            ids: string[]
        ) => Promise<{ success: boolean; deleted: number; failed: string[]; error?: string }>;
        edit: (
            id: string,
            updates: {
                content?: string;
                category?: MemoryCategory;
                tags?: string[];
                importance?: number;
                projectId?: string | null;
                expiresAt?: number;
            }
        ) => Promise<{ success: boolean; data?: AdvancedSemanticFragment; error?: string }>;
        archive: (id: string) => Promise<{ success: boolean; error?: string }>;
        archiveMany: (
            ids: string[]
        ) => Promise<{ success: boolean; archived: number; failed: string[]; error?: string }>;
        restore: (id: string) => Promise<{ success: boolean; error?: string }>;
        get: (
            id: string
        ) => Promise<{ success: boolean; data?: AdvancedSemanticFragment; error?: string }>;
        shareWithProject: (
            memoryId: string,
            targetProjectId: string
        ) => Promise<{ success: boolean; data?: AdvancedSemanticFragment; error?: string }>;
        createSharedNamespace: (payload: {
            id: string;
            name: string;
            projectIds: string[];
            accessControl?: Record<string, string[]>;
        }) => Promise<{ success: boolean; data?: SharedMemoryNamespace; error?: string }>;
        syncSharedNamespace: (
            request: SharedMemorySyncRequest
        ) => Promise<{ success: boolean; data?: SharedMemorySyncResult; error?: string }>;
        getSharedNamespaceAnalytics: (
            namespaceId: string
        ) => Promise<{ success: boolean; data?: SharedMemoryAnalytics; error?: string }>;
        searchAcrossProjects: (payload: {
            namespaceId: string;
            query: string;
            projectId: string;
            limit?: number;
        }) => Promise<{ success: boolean; data: AdvancedSemanticFragment[]; error?: string }>;
        getHistory: (id: string) => Promise<{ success: boolean; data: import('@shared/types/advanced-memory').MemoryVersion[]; error?: string }>;
        rollback: (id: string, versionIndex: number) => Promise<{ success: boolean; data?: AdvancedSemanticFragment; error?: string }>;
        recategorize: (ids?: string[]) => Promise<{ success: boolean; error?: string }>;
        getAllEntityKnowledge: () => Promise<{ success: boolean; data: EntityKnowledge[]; error?: string }>;
        getAllEpisodes: () => Promise<{ success: boolean; data: EpisodicMemory[]; error?: string }>;
        getAllAdvancedMemories: () => Promise<{ success: boolean; data: AdvancedSemanticFragment[]; error?: string }>;
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

    codeSandbox: {
        languages: () => Promise<{
            languages: Array<'javascript' | 'typescript' | 'python' | 'shell'>;
            errorCode?: string;
            messageKey?: string;
            retryable?: boolean;
            uiState: 'ready' | 'empty' | 'failure';
            fallbackUsed?: boolean;
        }>;
        execute: (payload: {
            language: 'javascript' | 'typescript' | 'python' | 'shell';
            code: string;
            timeoutMs?: number;
            stdin?: string;
        }) => Promise<{
            success: boolean;
            stdout: string;
            stderr: string;
            result?: string;
            durationMs: number;
            language: 'javascript' | 'typescript' | 'python' | 'shell';
            errorCode?: string;
            messageKey?: string;
            retryable?: boolean;
            uiState: 'ready' | 'empty' | 'failure';
            fallbackUsed?: boolean;
        }>;
        health: () => Promise<{
            success: boolean;
            data?: {
                status: 'healthy' | 'degraded';
                uiState: 'ready' | 'failure';
                budgets: {
                    fastMs: number;
                    executeMs: number;
                };
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

    voice: {
        detectWakeWord: (payload: { transcript: string; wakeWord?: string }) => Promise<{
            activated: boolean;
            wakeWord: string;
            intent: 'none' | 'new_chat' | 'open_settings' | 'stop_speaking' | 'send_message' | 'search_workspace';
            commandText: string;
            confidence: number;
        }>;
        startSession: (payload?: { wakeWord?: string; locale?: string }) => Promise<{
            id: string;
            wakeWord: string;
            locale: string;
            state: 'listening' | 'speaking' | 'idle';
            turnCount: number;
            startedAt: number;
            updatedAt: number;
        }>;
        submitUtterance: (payload: {
            sessionId: string;
            transcript: string;
            assistantSpeaking?: boolean;
        }) => Promise<{
            session: {
                id: string;
                wakeWord: string;
                locale: string;
                state: 'listening' | 'speaking' | 'idle';
                turnCount: number;
                startedAt: number;
                updatedAt: number;
            };
            interruptAssistant: boolean;
            intent: 'none' | 'new_chat' | 'open_settings' | 'stop_speaking' | 'send_message' | 'search_workspace';
            commandText: string;
            responseMode: 'listen' | 'speak' | 'idle';
        }>;
        endSession: (sessionId: string) => Promise<{ success: true }>;
        createNote: (payload: { title?: string; transcript: string }) => Promise<{
            id: string;
            title: string;
            transcript: string;
            summary: string;
            keyPoints: string[];
            actionItems: string[];
            highlights: Array<{ timestampSec: number; text: string; speaker: string }>;
            speakers: string[];
            createdAt: number;
            updatedAt: number;
        }>;
        listNotes: () => Promise<{
            notes: Array<{
                id: string;
                title: string;
                transcript: string;
                summary: string;
                keyPoints: string[];
                actionItems: string[];
                highlights: Array<{ timestampSec: number; text: string; speaker: string }>;
                speakers: string[];
                createdAt: number;
                updatedAt: number;
            }>
        }>;
        getNote: (noteId: string) => Promise<{
            note: {
                id: string;
                title: string;
                transcript: string;
                summary: string;
                keyPoints: string[];
                actionItems: string[];
                highlights: Array<{ timestampSec: number; text: string; speaker: string }>;
                speakers: string[];
                createdAt: number;
                updatedAt: number;
            } | null
        }>;
        searchNotes: (payload: { query: string; limit?: number }) => Promise<{
            notes: Array<{
                id: string;
                title: string;
                transcript: string;
                summary: string;
                keyPoints: string[];
                actionItems: string[];
                highlights: Array<{ timestampSec: number; text: string; speaker: string }>;
                speakers: string[];
                createdAt: number;
                updatedAt: number;
            }>
        }>;
        deleteNote: (noteId: string) => Promise<{ deleted: boolean }>;
    };

    collaboration: {
        run: (request: {
            messages: Message[];
            models: Array<{ provider: string; model: string }>;
            strategy: 'consensus' | 'vote' | 'best-of-n' | 'chain-of-thought';
            options?: { temperature?: number; maxTokens?: number };
        }) => Promise<{
            responses: Array<{
                provider: string;
                model: string;
                content: string;
                latency: number;
                tokens?: number;
            }>;
            consensus?: string;
            votes?: Record<string, number>;
            bestResponse?: {
                provider: string;
                model: string;
                content: string;
            };
        }>;
        getProviderStats: (provider?: string) => Promise<
            | Record<
                string,
                {
                    activeTasks: number;
                    queuedTasks: number;
                    totalCompleted: number;
                    totalErrors: number;
                    averageLatency: number;
                }
            >
            | {
                activeTasks: number;
                queuedTasks: number;
                totalCompleted: number;
                totalErrors: number;
                averageLatency: number;
            }
            | null
        >;
        getActiveTaskCount: (provider: string) => Promise<number>;
        setProviderConfig: (
            provider: string,
            config: {
                maxConcurrent: number;
                priority: number;
                rateLimitPerMinute: number;
            }
        ) => Promise<{ success: boolean }>;
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
        onData: (callback: (data: { id: string; data: string }) => void) => void;
        onExit: (callback: (data: { id: string; code: number }) => void) => void;
        readBuffer: (sessionId: string) => Promise<string>;
        removeAllListeners: () => void;
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
    executeTools: (
        toolName: string,
        args: Record<string, IpcValue>,
        toolCallId?: string
    ) => Promise<ToolResult>;
    killTool: (toolCallId: string) => Promise<boolean>;
    getToolDefinitions: () => Promise<ToolDefinition[]>;

    // MCP
    mcp: {
        list: () => Promise<{ name: string; status: string; type: string }[]>;
        dispatch: (
            service: string,
            action: string,
            args?: Record<string, IpcValue>
        ) => Promise<Record<string, IpcValue>>;
        toggle: (
            service: string,
            enabled: boolean
        ) => Promise<{ success: boolean; isEnabled: boolean }>;
        install: (config: MCPServerConfig) => Promise<{ success: boolean; error?: string }>;
        uninstall: (name: string) => Promise<{ success: boolean }>;
        getDebugMetrics: () => Promise<Array<{
            key: string;
            count: number;
            errors: number;
            avgDurationMs: number;
            lastDurationMs: number;
            lastError?: string;
        }>>;
        listPermissionRequests: () => Promise<Array<{
            id: string;
            service: string;
            action: string;
            createdAt: number;
            argsPreview?: string;
            status: 'pending' | 'approved' | 'denied';
        }>>;
        setActionPermission: (
            service: string,
            action: string,
            policy: 'allow' | 'deny' | 'ask'
        ) => Promise<{ success: boolean; error?: string }>;
        resolvePermissionRequest: (
            requestId: string,
            decision: 'approved' | 'denied'
        ) => Promise<{ success: boolean; error?: string }>;
        onResult: (callback: (result: Record<string, IpcValue>) => void) => void;
        removeResultListener: () => void;
    };

    // MCP Marketplace
    mcpMarketplace: {
        list: () => Promise<{ success: boolean; servers?: McpMarketplaceServer[]; error?: string }>;
        search: (
            query: string
        ) => Promise<{ success: boolean; servers?: McpMarketplaceServer[]; error?: string }>;
        filter: (
            category: string
        ) => Promise<{ success: boolean; servers?: McpMarketplaceServer[]; error?: string }>;
        categories: () => Promise<{ success: boolean; categories?: string[]; error?: string }>;
        install: (serverId: string) => Promise<{ success: boolean; error?: string }>;
        uninstall: (serverId: string) => Promise<{ success: boolean; error?: string }>;
        installed: () => Promise<{ success: boolean; servers?: MCPServerConfig[]; error?: string }>;
        toggle: (
            serverId: string,
            enabled: boolean
        ) => Promise<{ success: boolean; error?: string }>;
        updateConfig: (
            serverId: string,
            patch: Partial<MCPServerConfig>
        ) => Promise<{ success: boolean; error?: string }>;
        versionHistory: (
            serverId: string
        ) => Promise<{ success: boolean; history?: string[]; error?: string }>;
        rollbackVersion: (
            serverId: string,
            targetVersion: string
        ) => Promise<{ success: boolean; error?: string }>;
        debug: () => Promise<{ success: boolean; metrics?: Record<string, IpcValue>; error?: string }>;
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
        }) => Promise<Record<string, IpcValue>>;
        stop: () => Promise<Record<string, IpcValue>>;
        status: () => Promise<Record<string, IpcValue>>;
    };

    // Screenshot
    captureScreenshot: () => Promise<{ success: boolean; image?: string; error?: string }>;
    captureCookies: (url: string, timeoutMs?: number) => Promise<{ success: boolean }>;

    // Shell / External
    openExternal: (url: string) => void;
    openTerminal: (command: string) => Promise<boolean>;

    // Files
    readPdf: (path: string) => Promise<{ success: boolean; text?: string; error?: string }>;
    selectDirectory: () => Promise<{ success: boolean; path?: string }>;
    selectFile: (options?: {
        title?: string;
        filters?: { name: string; extensions: string[] }[];
    }) => Promise<{ success: boolean; path?: string }>;
    listDirectory: (
        path: string
    ) => Promise<{ success: boolean; files?: FileEntry[]; error?: string }>;
    readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>;
    writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>;
    createDirectory: (path: string) => Promise<{ success: boolean; error?: string }>;
    deleteFile: (path: string) => Promise<{ success: boolean; error?: string }>;
    deleteDirectory: (path: string) => Promise<{ success: boolean; error?: string }>;
    renamePath: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
    searchFiles: (
        rootPath: string,
        pattern: string
    ) => Promise<{ success: boolean; matches?: string[]; error?: string }>;
    saveFile: (
        content: string,
        filename: string
    ) => Promise<{ success: boolean; path?: string; error?: string }>;
    exportChatToPdf: (
        chatId: string,
        title: string
    ) => Promise<{ success: boolean; path?: string; error?: string }>;

    // Export
    exportMarkdown: (
        content: string,
        filePath: string
    ) => Promise<{ success: boolean; error?: string }>;
    exportPDF: (
        htmlContent: string,
        filePath: string
    ) => Promise<{ success: boolean; error?: string }>;

    searchFilesStream: (
        rootPath: string,
        pattern: string,
        onResult: (path: string) => void,
        onComplete?: () => void
    ) => () => void;

    files: {
        listDirectory: (path: string) => Promise<FileEntry[]>;
        readFile: (path: string) => Promise<string>;
        readImage: (
            path: string
        ) => Promise<{ success: boolean; content?: string; error?: string }>;
        writeFile: (path: string, content: string) => Promise<void>;
        exists: (path: string) => Promise<boolean>;
    };

    project: {
        analyze: (rootPath: string, projectId: string) => Promise<ProjectAnalysis>;
        analyzeIdentity: (
            rootPath: string
        ) => Promise<{ suggestedPrompts: string[]; colors: string[] }>;
        generateLogo: (
            projectPath: string,
            options: { prompt: string; style: string; model: string; count: number }
        ) => Promise<string[]>;
        analyzeDirectory: (dirPath: string) => Promise<{
            hasPackageJson: boolean;
            pkg: Record<string, IpcValue>;
            readme: string | null;
            stats: { fileCount: number; totalSize: number };
        }>;
        applyLogo: (projectPath: string, tempLogoPath: string) => Promise<string>;
        getCompletion: (text: string) => Promise<string>;
        improveLogoPrompt: (prompt: string) => Promise<string>;
        uploadLogo: (projectPath: string) => Promise<string | null>;
        watch: (rootPath: string) => Promise<boolean>;
        unwatch: (rootPath: string) => Promise<boolean>;
        onFileChange: (
            callback: (event: string, path: string, rootPath: string) => void
        ) => () => void;
    };

    process: {
        spawn: (command: string, args: string[], cwd: string) => Promise<string>;
        kill: (id: string) => Promise<boolean>;
        list: () => Promise<ProcessInfo[]>;
        scanScripts: (rootPath: string) => Promise<Record<string, string>>;
        resize: (id: string, cols: number, rows: number) => Promise<void>;
        write: (id: string, data: string) => Promise<void>;
        onData: (callback: (data: { id: string; data: string }) => void) => void;
        onExit: (callback: (data: { id: string; code: number }) => void) => void;
        removeListeners: () => void;
    };

    // Settings
    getSettings: () => Promise<AppSettings>;
    saveSettings: (settings: AppSettings) => Promise<AppSettings>;

    huggingface: {
        searchModels: (
            query: string,
            limit: number,
            page: number,
            sort?: string
        ) => Promise<{ models: { id: string; downloads: number; likes: number }[]; total: number }>;
        getRecommendations: (
            limit?: number,
            query?: string
        ) => Promise<{ id: string; downloads: number; likes: number; category: string; recommendationScore: number }[]>;
        getFiles: (
            modelId: string
        ) => Promise<{ path: string; size: number; oid: string; quantization: string }[]>;
        getModelPreview: (modelId: string) => Promise<unknown>;
        compareModels: (modelIds: string[]) => Promise<unknown>;
        validateCompatibility: (
            file: { path: string; size: number; oid?: string; quantization: string },
            availableRamGB?: number,
            availableVramGB?: number
        ) => Promise<{
            compatible: boolean;
            reasons: string[];
            estimatedRamGB: number;
            estimatedVramGB: number;
        }>;
        getWatchlist: () => Promise<string[]>;
        addToWatchlist: (modelId: string) => Promise<{ success: boolean }>;
        removeFromWatchlist: (modelId: string) => Promise<{ success: boolean }>;
        getCacheStats: () => Promise<{
            size: number;
            maxSize: number;
            ttlMs: number;
            oldestAgeMs: number;
            watchlistSize: number;
        }>;
        clearCache: () => Promise<{ success: boolean; removed: number }>;
        testDownloadedModel: (filePath: string) => Promise<{
            success: boolean;
            error?: string;
            metadata?: { architecture?: string; contextLength?: number };
        }>;
        getConversionPresets: () => Promise<Array<{
            id: 'balanced' | 'quality' | 'speed' | 'tiny';
            quantization: 'F16' | 'Q8_0' | 'Q6_K' | 'Q5_K_M' | 'Q4_K_M';
            description: string;
        }>>;
        getOptimizationSuggestions: (options: {
            sourcePath: string;
            outputPath: string;
            quantization: string;
            preset?: string;
            modelId?: string;
        }) => Promise<string[]>;
        validateConversion: (options: {
            sourcePath: string;
            outputPath: string;
            quantization: string;
            preset?: string;
            modelId?: string;
        }) => Promise<{ valid: boolean; errors: string[] }>;
        convertModel: (options: {
            sourcePath: string;
            outputPath: string;
            quantization: string;
            preset?: string;
            modelId?: string;
        }) => Promise<{ success: boolean; error?: string; warnings?: string[] }>;
        onConversionProgress: (
            callback: (progress: { stage: string; percent: number; message: string }) => void
        ) => () => void;
        getModelVersions: (modelId: string) => Promise<Array<{
            versionId: string;
            modelId: string;
            path: string;
            createdAt: number;
            notes?: string;
            pinned?: boolean;
            metadata?: { architecture?: string; contextLength?: number };
        }>>;
        registerModelVersion: (modelId: string, filePath: string, notes?: string) => Promise<unknown>;
        compareModelVersions: (modelId: string, leftVersionId: string, rightVersionId: string) => Promise<unknown>;
        rollbackModelVersion: (modelId: string, versionId: string, targetPath: string) => Promise<{ success: boolean; error?: string }>;
        pinModelVersion: (modelId: string, versionId: string, pinned: boolean) => Promise<{ success: boolean }>;
        getVersionNotifications: (modelId: string) => Promise<string[]>;
        prepareFineTuneDataset: (inputPath: string, outputPath: string) => Promise<{
            success: boolean;
            outputPath: string;
            records: number;
            error?: string;
        }>;
        startFineTune: (
            modelId: string,
            datasetPath: string,
            outputPath: string,
            options?: { epochs?: number; learningRate?: number }
        ) => Promise<unknown>;
        listFineTuneJobs: (modelId?: string) => Promise<unknown[]>;
        getFineTuneJob: (jobId: string) => Promise<unknown>;
        cancelFineTuneJob: (jobId: string) => Promise<{ success: boolean }>;
        evaluateFineTuneJob: (jobId: string) => Promise<unknown>;
        exportFineTunedModel: (jobId: string, exportPath: string) => Promise<{ success: boolean; error?: string }>;
        onFineTuneProgress: (callback: (job: unknown) => void) => () => void;
        downloadFile: (
            url: string,
            outputPath: string,
            expectedSize: number,
            expectedSha256: string,
            scheduleAtMs?: number
        ) => Promise<{ success: boolean; error?: string }>;
        onDownloadProgress: (
            callback: (progress: { filename: string; received: number; total: number }) => void
        ) => void;
        cancelDownload: () => void;
    };

    log: {
        write: (
            level: 'debug' | 'info' | 'warn' | 'error',
            message: string,
            data?: Record<string, IpcValue>
        ) => void;
        debug: (message: string, data?: Record<string, IpcValue>) => void;
        info: (message: string, data?: Record<string, IpcValue>) => void;
        warn: (message: string, data?: Record<string, IpcValue>) => void;
        error: (message: string, data?: Record<string, IpcValue>) => void;
    };

    gallery: {
        list: () => Promise<{ name: string; path: string; url: string; mtime: number }[]>;
        delete: (path: string) => Promise<boolean>;
        open: (path: string) => Promise<boolean>;
        reveal: (path: string) => Promise<boolean>;
        batchDownload: (input: {
            filePaths: string[];
            targetDirectory: string;
        }) => Promise<{
            success: boolean;
            copied: number;
            skipped: number;
            errors: string[];
        }>;
    };

    onChatGenerationStatus: (
        callback: (data: { chatId?: string; isGenerating?: boolean }) => void
    ) => () => void;
    onAgentEvent: (callback: (payload: unknown) => void) => () => void;
    onSdCppStatus: (callback: (data: unknown) => void) => () => void;
    onSdCppProgress: (callback: (data: unknown) => void) => () => void;
    getUserDataPath: () => Promise<string>;

    update: {
        checkForUpdates: () => Promise<void>;
        downloadUpdate: () => Promise<void>;
        installUpdate: () => Promise<void>;
    };

    modelRegistry: {
        getAllModels: () => Promise<ModelDefinition[]>;
        getRemoteModels: () => Promise<ModelDefinition[]>;
        getInstalledModels: () => Promise<ModelDefinition[]>;
    };

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
        invoke: <T = IpcValue>(channel: string, ...args: IpcValue[]) => Promise<T>;
        removeAllListeners: (channel: string) => void;
    };

    // --- Linked Accounts (New Multi-Account API) ---
    getLinkedAccounts: (provider?: string) => Promise<LinkedAccountInfo[]>;
    getActiveLinkedAccount: (provider: string) => Promise<LinkedAccountInfo | null>;
    setActiveLinkedAccount: (
        provider: string,
        accountId: string
    ) => Promise<{ success: boolean; error?: string }>;
    linkAccount: (
        provider: string,
        tokenData: TokenData
    ) => Promise<{ success: boolean; account?: LinkedAccountInfo; error?: string }>;
    unlinkAccount: (accountId: string) => Promise<{ success: boolean; error?: string }>;
    unlinkProvider: (provider: string) => Promise<{ success: boolean; error?: string }>;
    hasLinkedAccount: (provider: string) => Promise<boolean>;
    getAccountsByProvider: (provider: string) => Promise<LinkedAccountInfo[]>;
    detectAuthProvider: (providerHint?: string, tokenData?: TokenData) => Promise<{ provider: string }>;
    getAuthProviderHealth: (provider?: string) => Promise<Array<{
        provider: string;
        checkedAt: number;
        totalAccounts: number;
        activeAccountId?: string;
        hasActiveToken: boolean;
        hasRefreshToken: boolean;
        expiringSoonCount: number;
        expiredCount: number;
        healthy: boolean;
    }>>;
    getAuthProviderAnalytics: () => Promise<Array<{
        provider: string;
        totalAccounts: number;
        activeAccounts: number;
        lastUpdatedAt?: number;
        oldestAccountAt?: number;
        withRefreshToken: number;
        withSessionToken: number;
    }>>;
    rotateTokenEncryption: (provider?: string) => Promise<{ rotated: number; failed: number }>;
    revokeAccountToken: (
        accountId: string,
        options?: { revokeAccess?: boolean; revokeRefresh?: boolean; revokeSession?: boolean }
    ) => Promise<{ success: boolean }>;
    getTokenAnalytics: (provider?: string) => Promise<{
        totalAccounts: number;
        withAccessToken: number;
        withRefreshToken: number;
        withSessionToken: number;
        expiringWithin30m: number;
        expired: number;
        revoked: number;
    }>;
    exportCredentials: (options: {
        provider?: string;
        password: string;
        expiresInHours?: number;
    }) => Promise<{ success: boolean; payload?: string; checksum?: string; expiresAt?: number; error?: string }>;
    importCredentials: (
        payload: string,
        password: string
    ) => Promise<{ success: boolean; imported?: number; skipped?: number; expiresAt?: number; error?: string }>;
    createMasterKeyBackup: (
        passphrase: string
    ) => Promise<{ success: boolean; backup?: string; error?: string }>;
    restoreMasterKeyBackup: (
        backupPayload: string,
        passphrase: string
    ) => Promise<{ success: boolean; error?: string }>;
    startAuthSession: (provider: string, accountId?: string, source?: string) => Promise<{ sessionId: string }>;
    touchAuthSession: (sessionId: string) => Promise<{ success: boolean }>;
    endAuthSession: (sessionId: string) => Promise<{ success: boolean }>;
    setAuthSessionLimit: (provider: string, limit: number) => Promise<{ limit: number }>;
    getAuthSessionAnalytics: (provider?: string) => Promise<{
        totalActiveSessions: number;
        byProvider: Record<string, number>;
        oldestSessionAt?: number;
    }>;
    setAuthSessionTimeout: (timeoutMs: number) => Promise<{ timeoutMs: number }>;
    getAuthSessionTimeout: () => Promise<{ timeoutMs: number }>;
    getProxyRateLimitMetrics: () => Promise<{
        generatedAt: number;
        providers: Array<{
            provider: string;
            limit: number;
            remaining: number;
            resetAt: number;
            queued: number;
            blocked: number;
            allowed: number;
            bypassed: number;
            warnings: number;
        }>;
    }>;
    getProxyRateLimitConfig: () => Promise<Record<string, {
        windowMs: number;
        maxRequests: number;
        warningThreshold: number;
        maxQueueSize: number;
        allowPremiumBypass: boolean;
    }>>;
    setProxyRateLimitConfig: (
        provider: string,
        config: {
            windowMs?: number;
            maxRequests?: number;
            warningThreshold?: number;
            maxQueueSize?: number;
            allowPremiumBypass?: boolean;
        }
    ) => Promise<{
        windowMs: number;
        maxRequests: number;
        warningThreshold: number;
        maxQueueSize: number;
        allowPremiumBypass: boolean;
    }>;
    performance: {
        getMemoryStats: () => Promise<IpcValue>;
        detectLeak: () => Promise<IpcValue>;
        triggerGC: () => Promise<IpcValue>;
        getDashboard: () => Promise<IpcValue>;
    };

    // IPC Batching for performance
    batch: {
        invoke: (requests: Array<{ channel: string; args: IpcValue[] }>) => Promise<{
            results: Array<{ channel: string; success: boolean; data?: IpcValue; error?: string }>;
            timing: { startTime: number; endTime: number; totalMs: number };
        }>;
        invokeSequential: (requests: Array<{ channel: string; args: IpcValue[] }>) => Promise<{
            results: Array<{ channel: string; success: boolean; data?: IpcValue; error?: string }>;
            timing: { startTime: number; endTime: number; totalMs: number };
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

    // Backup & Restore
    backup: {
        create: (options?: {
            includeChats?: boolean;
            includeAuth?: boolean;
            includeSettings?: boolean;
            includePrompts?: boolean;
            incremental?: boolean;
            compress?: boolean;
            encrypt?: boolean;
            verify?: boolean;
            cloudSyncDir?: string;
        }) => Promise<{
            success: boolean;
            path?: string;
            error?: string;
            metadata?: {
                version: string;
                createdAt: string;
                appVersion: string;
                platform: string;
                includes: string[];
                checksum?: string;
                compressed?: boolean;
                encrypted?: boolean;
                incremental?: boolean;
                baseBackup?: string;
            };
        }>;
        restore: (
            backupPath: string,
            options?: {
                restoreChats?: boolean;
                restoreSettings?: boolean;
                restorePrompts?: boolean;
                mergeChats?: boolean;
            }
        ) => Promise<{ success: boolean; restored: string[]; errors: string[] }>;
        list: () => Promise<
            Array<{
                name: string;
                path: string;
                metadata?: {
                    version: string;
                    createdAt: string;
                    appVersion: string;
                    platform: string;
                    includes: string[];
                };
            }>
        >;
        delete: (backupPath: string) => Promise<boolean>;
        getDir: () => Promise<string>;
        getAutoBackupStatus: () => Promise<{
            enabled: boolean;
            intervalHours: number;
            maxBackups: number;
            lastBackup: string | null;
            compression: boolean;
            encryption: boolean;
            verification: boolean;
            cloudSyncDir?: string;
        }>;
        configureAutoBackup: (config: {
            enabled: boolean;
            intervalHours?: number;
            maxBackups?: number;
            compression?: boolean;
            encryption?: boolean;
            verification?: boolean;
            cloudSyncDir?: string;
        }) => Promise<void>;
        cleanup: () => Promise<number>;
        verify: (
            backupPath: string
        ) => Promise<{ valid: boolean; checksum?: string; error?: string }>;
        syncToCloudDir: (
            backupPath: string,
            targetDir: string
        ) => Promise<{ success: boolean; targetPath?: string; error?: string }>;
        createDisasterRecoveryBundle: (
            targetDir?: string
        ) => Promise<{ success: boolean; bundlePath?: string; files?: string[]; error?: string }>;
        restoreDisasterRecoveryBundle: (
            bundlePath: string
        ) => Promise<{ success: boolean; restored: string[]; errors: string[] }>;
    };

    // Export chat to multiple formats
    export: {
        chat: (
            chat: Chat,
            options: {
                format: 'markdown' | 'html' | 'json' | 'txt';
                includeTimestamps?: boolean;
                includeMetadata?: boolean;
                includeSystemMessages?: boolean;
                includeToolCalls?: boolean;
                title?: string;
            }
        ) => Promise<{ success: boolean; path?: string; error?: string }>;
        chatToMarkdown: (
            chat: Chat,
            options?: { includeTimestamps?: boolean; includeMetadata?: boolean; title?: string }
        ) => Promise<{ success: boolean; path?: string; error?: string }>;
        chatToHTML: (
            chat: Chat,
            options?: { includeTimestamps?: boolean; includeMetadata?: boolean; title?: string }
        ) => Promise<{ success: boolean; path?: string; error?: string }>;
        chatToJSON: (
            chat: Chat,
            options?: { includeTimestamps?: boolean; includeMetadata?: boolean; title?: string }
        ) => Promise<{ success: boolean; path?: string; error?: string }>;
        chatToText: (
            chat: Chat,
            options?: { includeTimestamps?: boolean; includeMetadata?: boolean; title?: string }
        ) => Promise<{ success: boolean; path?: string; error?: string }>;
        chatToPDF: (
            chat: Chat,
            options?: { title?: string }
        ) => Promise<{ success: boolean; path?: string; error?: string }>;
        getContent: (
            chat: Chat,
            options: {
                format: 'markdown' | 'html' | 'json' | 'txt';
                includeTimestamps?: boolean;
                includeMetadata?: boolean;
                title?: string;
            }
        ) => Promise<{ success: boolean; content?: string; error?: string }>;
    };

    // Idea Generator
    ideas: {
        createSession: (config: {
            model: string;
            provider: string;
            categories: string[];
            maxIdeas: number;
        }) => Promise<IpcValue>;
        getSession: (id: string) => Promise<IpcValue>;
        getSessions: () => Promise<IpcValue[]>;
        cancelSession: (id: string) => Promise<{ success: boolean }>;
        generateMarketPreview: (
            categories: string[]
        ) => Promise<{ success: boolean; data?: IpcValue[] }>;
        startResearch: (sessionId: string) => Promise<{ success: boolean; data?: IpcValue }>;
        startGeneration: (sessionId: string) => Promise<{ success: boolean }>;
        enrichIdea: (ideaId: string) => Promise<{ success: boolean; data?: IpcValue }>;
        getIdea: (id: string) => Promise<IpcValue>;
        getIdeas: (sessionId?: string) => Promise<IpcValue[]>;
        regenerateIdea: (ideaId: string) => Promise<{ success: boolean; idea?: IpcValue }>;
        approveIdea: (
            ideaId: string,
            projectPath: string,
            selectedName?: string
        ) => Promise<{ success: boolean; project?: IpcValue }>;
        rejectIdea: (ideaId: string) => Promise<{ success: boolean }>;
        canGenerateLogo: () => Promise<boolean>;
        generateLogo: (
            ideaId: string,
            prompt: string
        ) => Promise<{ success: boolean; logoPath?: string }>;
        queryResearch: (
            ideaId: string,
            question: string
        ) => Promise<{ success: boolean; answer: string }>;
        // Deep research handlers
        deepResearch: (
            topic: string,
            category: string
        ) => Promise<{ success: boolean; report?: IpcValue }>;
        validateIdea: (
            title: string,
            description: string,
            category: string
        ) => Promise<{ success: boolean; validation?: IpcValue }>;
        clearResearchCache: () => Promise<{ success: boolean }>;
        // Scoring handlers
        scoreIdea: (ideaId: string) => Promise<{ success: boolean; score?: IpcValue }>;
        rankIdeas: (ideaIds: string[]) => Promise<{ success: boolean; ranked?: IpcValue[] }>;
        compareIdeas: (
            ideaId1: string,
            ideaId2: string
        ) => Promise<{ success: boolean; comparison?: IpcValue }>;
        quickScore: (
            title: string,
            description: string,
            category: string
        ) => Promise<{ success: boolean; score?: number }>;
        // Data management handlers
        deleteIdea: (ideaId: string) => Promise<{ success: boolean }>;
        deleteSession: (sessionId: string) => Promise<{ success: boolean }>;
        archiveIdea: (ideaId: string) => Promise<{ success: boolean }>;
        restoreIdea: (ideaId: string) => Promise<{ success: boolean }>;
        getArchivedIdeas: (sessionId?: string) => Promise<IpcValue[]>;
        // Progress events
        onResearchProgress: (callback: (progress: IpcValue) => void) => () => void;
        onIdeaProgress: (callback: (progress: IpcValue) => void) => () => void;
        onDeepResearchProgress: (callback: (progress: IpcValue) => void) => () => void;
    };

    projectAgent: {
        start: (options: AgentStartOptions) => Promise<{ taskId: string }>;
        generatePlan: (options: AgentStartOptions) => Promise<void>;
        approvePlan: (plan: string[] | ProjectStep[], taskId?: string) => Promise<void>;
        stop: (taskId?: string) => Promise<void>;
        pauseTask: (taskId: string) => Promise<{ success: boolean }>;
        resumeTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
        saveSnapshot: (
            taskId: string
        ) => Promise<{ success: boolean; checkpointId?: string }>;
        approveCurrentPlan: (
            taskId: string
        ) => Promise<{ success: boolean; error?: string }>;
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
            projectId?: string
        ) => Promise<import('@shared/types/project-agent').AgentTaskHistoryItem[]>;
        deleteTask: (
            taskId: string
        ) => Promise<{ success: boolean; error?: string }>;
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
        getRoutingRules: () => Promise<ModelRoutingRule[]>;
        setRoutingRules: (rules: ModelRoutingRule[]) => Promise<{ success: boolean }>;
        createVotingSession: (payload: {
            taskId: string;
            stepIndex: number;
            question: string;
            options: string[];
        }) => Promise<VotingSession>;
        submitVote: (payload: {
            sessionId: string;
            modelId: string;
            provider: string;
            decision: string;
            confidence: number;
            reasoning?: string;
        }) => Promise<VotingSession | null>;
        requestVotes: (payload: {
            sessionId: string;
            models: Array<{ provider: string; model: string }>;
        }) => Promise<VotingSession | null>;
        resolveVoting: (sessionId: string) => Promise<VotingSession | null>;
        getVotingSession: (sessionId: string) => Promise<VotingSession | null>;
        listVotingSessions: (taskId?: string) => Promise<VotingSession[]>;
        overrideVotingDecision: (payload: {
            sessionId: string;
            finalDecision: string;
            reason?: string;
        }) => Promise<VotingSession | null>;
        getVotingAnalytics: (taskId?: string) => Promise<import('@shared/types/project-agent').VotingAnalytics>;
        getVotingConfiguration: () => Promise<VotingConfiguration>;
        updateVotingConfiguration: (patch: Partial<VotingConfiguration>) => Promise<VotingConfiguration>;
        listVotingTemplates: () => Promise<VotingTemplate[]>;
        buildConsensus: (outputs: Array<{ modelId: string; provider: string; output: string }>) => Promise<ConsensusResult>;
        createDebateSession: (payload: {
            taskId: string;
            stepIndex: number;
            topic: string;
        }) => Promise<DebateSession | null>;
        submitDebateArgument: (payload: {
            sessionId: string;
            agentId: string;
            provider: string;
            side: DebateSide;
            content: string;
            confidence: number;
            citations?: DebateCitation[];
        }) => Promise<DebateSession | null>;
        resolveDebateSession: (sessionId: string) => Promise<DebateSession | null>;
        overrideDebateSession: (payload: {
            sessionId: string;
            moderatorId: string;
            decision: DebateSide | 'balanced';
            reason?: string;
        }) => Promise<DebateSession | null>;
        getDebateSession: (sessionId: string) => Promise<DebateSession | null>;
        listDebateHistory: (taskId?: string) => Promise<DebateSession[]>;
        getDebateReplay: (sessionId: string) => Promise<DebateReplay | null>;
        generateDebateSummary: (sessionId: string) => Promise<string | null>;
        getTeamworkAnalytics: () => Promise<AgentTeamworkAnalytics | null>;
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
        getTemplates: (category?: AgentTemplateCategory) => Promise<AgentTemplate[]>;
        getTemplate: (id: string) => Promise<AgentTemplate | null>;
        saveTemplate: (template: AgentTemplate) => Promise<{ success: boolean; template: AgentTemplate }>;
        deleteTemplate: (id: string) => Promise<{ success: boolean }>;
        exportTemplate: (id: string) => Promise<AgentTemplateExport | null>;
        importTemplate: (exported: AgentTemplateExport) => Promise<{ success: boolean; template?: AgentTemplate; error?: string }>;
        applyTemplate: (payload: {
            templateId: string;
            values: Record<string, string | number | boolean>;
        }) => Promise<{
            success: boolean;
            template?: AgentTemplate;
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
        start: (task: string, projectId?: string) => Promise<void>;
        approve: (plan: ProjectStep[]) => Promise<void>;
        getState: () => Promise<OrchestratorState>;
        stop: () => Promise<void>;
        onUpdate: (callback: (state: OrchestratorState) => void) => () => void;
    };

    // Extension API
    extension: {
        shouldShowWarning: () => Promise<boolean>;
        dismissWarning: () => Promise<{ success: boolean; error?: string }>;
        getStatus: () => Promise<{ installed: boolean; shouldShowWarning: boolean }>;
        setInstalled: (installed: boolean) => Promise<{ success: boolean; error?: string }>;
        // Extension SDK APIs (MKT-DEV-01)
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
        validate: (manifest: unknown) => Promise<{ valid: boolean; errors: string[] }>;
    };
}

function normalizeOrchestratorPlan(value: IpcValue): ProjectStep[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const normalizedPlan: ProjectStep[] = [];
    for (const planItem of value) {
        if (
            typeof planItem !== 'object' ||
            planItem === null ||
            Array.isArray(planItem)
        ) {
            continue;
        }
        const planRecord = planItem as Record<string, IpcValue>;
        if (
            typeof planRecord['id'] !== 'string' ||
            typeof planRecord['text'] !== 'string' ||
            typeof planRecord['status'] !== 'string'
        ) {
            continue;
        }
        normalizedPlan.push({
            id: planRecord['id'],
            text: planRecord['text'],
            status: planRecord['status'] as ProjectStep['status']
        });
    }
    return normalizedPlan;
}

function normalizeOrchestratorHistory(value: IpcValue): Message[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const normalizedHistory: Message[] = [];
    for (const historyItem of value) {
        if (
            typeof historyItem !== 'object' ||
            historyItem === null ||
            Array.isArray(historyItem)
        ) {
            continue;
        }
        const historyRecord = historyItem as Record<string, IpcValue>;
        if (typeof historyRecord['id'] !== 'string') {
            continue;
        }
        const rawRole = historyRecord['role'];
        const role: Message['role'] =
            rawRole === 'system' ||
                rawRole === 'user' ||
                rawRole === 'assistant' ||
                rawRole === 'tool'
                ? rawRole
                : 'assistant';
        const rawContent = historyRecord['content'];
        const content = typeof rawContent === 'string' ? rawContent : '';
        const rawTimestamp = historyRecord['timestamp'];
        const timestamp =
            typeof rawTimestamp === 'number' || typeof rawTimestamp === 'string'
                ? new Date(rawTimestamp)
                : new Date();
        normalizedHistory.push({
            id: historyRecord['id'],
            role,
            content,
            timestamp
        });
    }
    return normalizedHistory;
}

const api: ElectronAPI = {
    ...createWindowControlsBridge(ipcRenderer),
    ...createAuthBridge(ipcRenderer),

    // --- Linked Accounts (New Multi-Account API) ---
    getLinkedAccounts: provider => ipcRenderer.invoke('auth:get-linked-accounts', provider),
    getActiveLinkedAccount: provider =>
        ipcRenderer.invoke('auth:get-active-linked-account', provider),
    setActiveLinkedAccount: (provider, accountId) =>
        ipcRenderer.invoke('auth:set-active-linked-account', provider, accountId),
    linkAccount: (provider, tokenData) =>
        ipcRenderer.invoke('auth:link-account', provider, tokenData),
    unlinkAccount: accountId => ipcRenderer.invoke('auth:unlink-account', accountId),
    unlinkProvider: provider => ipcRenderer.invoke('auth:unlink-provider', provider),
    hasLinkedAccount: provider => ipcRenderer.invoke('auth:has-linked-account', provider),
    getAccountsByProvider: provider => ipcRenderer.invoke('auth:get-linked-accounts', provider),
    detectAuthProvider: (providerHint?: string, tokenData?: TokenData) =>
        ipcRenderer.invoke('auth:detect-provider', providerHint, tokenData),
    getAuthProviderHealth: (provider?: string) =>
        ipcRenderer.invoke('auth:get-provider-health', provider),
    getAuthProviderAnalytics: () => ipcRenderer.invoke('auth:get-provider-analytics'),
    rotateTokenEncryption: (provider?: string) =>
        ipcRenderer.invoke('auth:rotate-token-encryption', provider),
    revokeAccountToken: (
        accountId: string,
        options?: { revokeAccess?: boolean; revokeRefresh?: boolean; revokeSession?: boolean }
    ) => ipcRenderer.invoke('auth:revoke-account-token', accountId, options),
    getTokenAnalytics: (provider?: string) => ipcRenderer.invoke('auth:get-token-analytics', provider),
    exportCredentials: (options: {
        provider?: string;
        password: string;
        expiresInHours?: number;
    }) => ipcRenderer.invoke('auth:export-credentials', options),
    importCredentials: (payload: string, password: string) =>
        ipcRenderer.invoke('auth:import-credentials', { payload, password }),
    createMasterKeyBackup: (passphrase: string) =>
        ipcRenderer.invoke('auth:create-master-key-backup', passphrase),
    restoreMasterKeyBackup: (backupPayload: string, passphrase: string) =>
        ipcRenderer.invoke('auth:restore-master-key-backup', backupPayload, passphrase),
    startAuthSession: (provider: string, accountId?: string, source?: string) =>
        ipcRenderer.invoke('auth:start-session', provider, accountId, source),
    touchAuthSession: (sessionId: string) =>
        ipcRenderer.invoke('auth:touch-session', sessionId),
    endAuthSession: (sessionId: string) =>
        ipcRenderer.invoke('auth:end-session', sessionId),
    setAuthSessionLimit: (provider: string, limit: number) =>
        ipcRenderer.invoke('auth:set-session-limit', provider, limit),
    getAuthSessionAnalytics: (provider?: string) =>
        ipcRenderer.invoke('auth:get-session-analytics', provider),
    setAuthSessionTimeout: (timeoutMs: number) =>
        ipcRenderer.invoke('auth:set-session-timeout', timeoutMs),
    getAuthSessionTimeout: () =>
        ipcRenderer.invoke('auth:get-session-timeout'),

    code: {
        scanTodos: (rootPath: string) => ipcRenderer.invoke('code:scanTodos', rootPath),
        findSymbols: (rootPath: string, query: string) => ipcRenderer.invoke('code:findSymbols', rootPath, query),
        findDefinition: (rootPath: string, symbol: string) =>
            ipcRenderer.invoke('code:findDefinition', rootPath, symbol),
        findReferences: (rootPath: string, symbol: string) =>
            ipcRenderer.invoke('code:findReferences', rootPath, symbol),
        findImplementations: (rootPath: string, symbol: string) =>
            ipcRenderer.invoke('code:findImplementations', rootPath, symbol),
        getSymbolRelationships: (rootPath: string, symbol: string, maxItems?: number) =>
            ipcRenderer.invoke('code:getSymbolRelationships', rootPath, symbol, maxItems),
        getFileOutline: (filePath: string) => ipcRenderer.invoke('code:getFileOutline', filePath),
        previewRenameSymbol: (rootPath: string, symbol: string, newSymbol: string, maxFiles?: number) =>
            ipcRenderer.invoke('code:previewRenameSymbol', rootPath, symbol, newSymbol, maxFiles),
        applyRenameSymbol: (rootPath: string, symbol: string, newSymbol: string, maxFiles?: number) =>
            ipcRenderer.invoke('code:applyRenameSymbol', rootPath, symbol, newSymbol, maxFiles),
        generateFileDocumentation: (filePath: string, format?: string) =>
            ipcRenderer.invoke('code:generateFileDocumentation', filePath, format),
        generateProjectDocumentation: (rootPath: string, maxFiles?: number) =>
            ipcRenderer.invoke('code:generateProjectDocumentation', rootPath, maxFiles),
        analyzeQuality: (rootPath: string, maxFiles?: number) =>
            ipcRenderer.invoke('code:analyzeQuality', rootPath, maxFiles),
        searchFiles: (rootPath: string, query: string, projectId?: string, isRegex?: boolean) =>
            ipcRenderer.invoke('code:searchFiles', rootPath, query, projectId, isRegex),
        indexProject: (rootPath: string, projectId: string) =>
            ipcRenderer.invoke('code:indexProject', rootPath, projectId),
        queryIndexedSymbols: (query: string) => ipcRenderer.invoke('code:queryIndexedSymbols', query),
        getSymbolAnalytics: (rootPath: string) => ipcRenderer.invoke('code:getSymbolAnalytics', rootPath),
    },

    getProxyModels: () => ipcRenderer.invoke('proxy:getModels'),
    getQuota: () => ipcRenderer.invoke('proxy:getQuota'),
    getCopilotQuota: () => ipcRenderer.invoke('proxy:getCopilotQuota'),
    getCodexUsage: () => ipcRenderer.invoke('proxy:getCodexUsage'),
    getClaudeQuota: () => ipcRenderer.invoke('proxy:getClaudeQuota'),
    getProxyRateLimitMetrics: () => ipcRenderer.invoke('proxy:get-rate-limit-metrics'),
    getProxyRateLimitConfig: () => ipcRenderer.invoke('proxy:get-rate-limit-config'),
    setProxyRateLimitConfig: (
        provider: string,
        config: {
            windowMs?: number;
            maxRequests?: number;
            warningThreshold?: number;
            maxQueueSize?: number;
            allowPremiumBypass?: boolean;
        }
    ) => ipcRenderer.invoke('proxy:set-rate-limit-config', provider, config),
    performance: {
        getMemoryStats: () => ipcRenderer.invoke('performance:get-memory-stats'),
        detectLeak: () => ipcRenderer.invoke('performance:detect-leak'),
        triggerGC: () => ipcRenderer.invoke('performance:trigger-gc'),
        getDashboard: () => ipcRenderer.invoke('performance:get-dashboard')
    },
    checkUsageLimit: (provider: string, model: string) =>
        ipcRenderer.invoke('usage:checkLimit', provider, model),
    getUsageCount: (period: 'hourly' | 'daily' | 'weekly', provider?: string, model?: string) =>
        ipcRenderer.invoke('usage:getUsageCount', period, provider, model),

    getModels: () => ipcRenderer.invoke('ollama:getModels'),
    chat: (messages, model) => ipcRenderer.invoke('ollama:chat', messages, model),
    chatOpenAI: async request => {
        const res = await ipcRenderer.invoke('chat:openai', {
            messages: request.messages,
            model: request.model,
            tools: request.tools,
            provider: request.provider,
            projectId: request.projectId,
            systemMode: request.systemMode
        });
        if (res.success) {
            return res.data;
        }
        throw new Error(res.error?.message ?? 'Chat request failed');
    },
    chatStream: request =>
        ipcRenderer.invoke('chat:stream', {
            messages: request.messages,
            model: request.model,
            tools: request.tools,
            provider: request.provider,
            optionsJson: request.options,
            chatId: request.chatId,
            projectId: request.projectId,
            systemMode: request.systemMode
        }),
    abortChat: () => {
        void ipcRenderer.invoke('ollama:abort');
    },
    onStreamChunk: callback => {
        const listener = (
            _event: IpcRendererEvent,
            chunk: {
                content?: string;
                toolCalls?: ToolCall[];
                reasoning?: string;
                chatId?: string;
                done?: boolean;
            }
        ) => {
            callback(chunk);
        };
        ipcRenderer.on('ollama:streamChunk', listener);
        return () => {
            ipcRenderer.removeListener('ollama:streamChunk', listener);
        };
    },
    removeStreamChunkListener: () => {
        ipcRenderer.removeAllListeners('ollama:streamChunk');
    },

    isOllamaRunning: () => ipcRenderer.invoke('ollama:isRunning'),
    startOllama: () => ipcRenderer.invoke('ollama:start'),
    pullModel: modelName => ipcRenderer.invoke('ollama:pullModel', modelName),
    deleteOllamaModel: modelName => ipcRenderer.invoke('ollama:deleteModel', modelName),
    getLibraryModels: () => ipcRenderer.invoke('ollama:getLibraryModels'),
    onPullProgress: callback => {
        const listener = (
            _event: IpcRendererEvent,
            progress: {
                status: string;
                digest?: string;
                total?: number;
                completed?: number;
                modelName?: string;
            }
        ) => callback(progress);
        ipcRenderer.on('ollama:pullProgress', listener);
        return () => ipcRenderer.removeListener('ollama:pullProgress', listener);
    },
    removePullProgressListener: () => ipcRenderer.removeAllListeners('ollama:pullProgress'),

    getOllamaHealthStatus: () => ipcRenderer.invoke('ollama:healthStatus'),
    forceOllamaHealthCheck: () => ipcRenderer.invoke('ollama:forceHealthCheck'),
    checkCuda: () => ipcRenderer.invoke('ollama:checkCuda'),
    onOllamaStatusChange: callback =>
        ipcRenderer.on('ollama:statusChange', (_event, value) =>
            callback(value as 'ok' | 'error' | 'stopped')
        ),

    // OLLAMA-01: Model Health & Recommendations
    checkOllamaModelHealth: (modelName: string) => ipcRenderer.invoke('ollama:checkModelHealth', modelName),
    checkAllOllamaModelsHealth: () => ipcRenderer.invoke('ollama:checkAllModelsHealth'),
    getOllamaModelRecommendations: (category?: 'coding' | 'creative' | 'reasoning' | 'general' | 'multimodal') =>
        ipcRenderer.invoke('ollama:getModelRecommendations', category),
    getRecommendedOllamaModelForTask: (task: string) => ipcRenderer.invoke('ollama:getRecommendedModelForTask', task),

    // OLLAMA-02: Connection Handling
    getOllamaConnectionStatus: () => ipcRenderer.invoke('ollama:getConnectionStatus'),
    testOllamaConnection: () => ipcRenderer.invoke('ollama:testConnection'),
    reconnectOllama: () => ipcRenderer.invoke('ollama:reconnect'),

    // OLLAMA-03: GPU Monitoring
    getOllamaGPUInfo: () => ipcRenderer.invoke('ollama:getGPUInfo'),
    startOllamaGPUMonitoring: (intervalMs?: number) => ipcRenderer.invoke('ollama:startGPUMonitoring', intervalMs),
    stopOllamaGPUMonitoring: () => ipcRenderer.invoke('ollama:stopGPUMonitoring'),
    setOllamaGPUAlertThresholds: (thresholds: { highMemoryPercent?: number; highTemperatureC?: number; lowMemoryMB?: number }) =>
        ipcRenderer.invoke('ollama:setGPUAlertThresholds', thresholds),
    getOllamaGPUAlertThresholds: () => ipcRenderer.invoke('ollama:getGPUAlertThresholds'),
    onOllamaGPUAlert: (callback: (alert: IpcValue) => void) => {
        const listener = (_event: Electron.IpcRendererEvent, alert: IpcValue) => callback(alert);
        ipcRenderer.on('ollama:gpuAlert', listener);
        return () => ipcRenderer.removeListener('ollama:gpuAlert', listener);
    },
    onOllamaGPUStatus: (callback: (status: IpcValue) => void) => {
        const listener = (_event: Electron.IpcRendererEvent, status: IpcValue) => callback(status);
        ipcRenderer.on('ollama:gpuStatus', listener);
        return () => ipcRenderer.removeListener('ollama:gpuStatus', listener);
    },

    // Marketplace API (models from database)
    marketplace: {
        getModels: (provider?: 'ollama' | 'huggingface', limit?: number, offset?: number) =>
            ipcRenderer.invoke('marketplace:getModels', provider, limit, offset),
        searchModels: (query: string, provider?: 'ollama' | 'huggingface', limit?: number) =>
            ipcRenderer.invoke('marketplace:searchModels', query, provider, limit),
        getModelDetails: (modelName: string, provider: 'ollama' | 'huggingface' = 'ollama') =>
            ipcRenderer.invoke('marketplace:getModelDetails', modelName, provider),
        getStatus: () => ipcRenderer.invoke('marketplace:getStatus'),
    },

    llama: {
        loadModel: (modelPath, config) => ipcRenderer.invoke('llama:loadModel', modelPath, config),
        unloadModel: () => ipcRenderer.invoke('llama:unloadModel'),
        chat: (message, systemPrompt) => ipcRenderer.invoke('llama:chat', message, systemPrompt),
        resetSession: () => ipcRenderer.invoke('llama:resetSession'),
        getModels: () => ipcRenderer.invoke('llama:getModels'),
        downloadModel: (url, filename) => ipcRenderer.invoke('llama:downloadModel', url, filename),
        deleteModel: modelPath => ipcRenderer.invoke('llama:deleteModel', modelPath),
        getConfig: () => ipcRenderer.invoke('llama:getConfig'),
        setConfig: config => ipcRenderer.invoke('llama:setConfig', config),
        getGpuInfo: () => ipcRenderer.invoke('llama:getGpuInfo'),
        getModelsDir: () => ipcRenderer.invoke('llama:getModelsDir'),
        onToken: callback => {
            ipcRenderer.on('llama:token', (_event, token) => callback(token));
        },
        removeTokenListener: () => {
            ipcRenderer.removeAllListeners('llama:token');
        },
        onDownloadProgress: callback => {
            ipcRenderer.on('llama:downloadProgress', (_event, progress) => callback(progress));
        },
        removeDownloadProgressListener: () => {
            ipcRenderer.removeAllListeners('llama:downloadProgress');
        },
    },

    db: {
        createChat: chat => ipcRenderer.invoke('db:createChat', chat),
        updateChat: (id, updates) => ipcRenderer.invoke('db:updateChat', id, updates),
        deleteChat: id => ipcRenderer.invoke('db:deleteChat', id),
        duplicateChat: id => ipcRenderer.invoke('db:duplicateChat', id),
        archiveChat: (id, isArchived) => ipcRenderer.invoke('db:archiveChat', id, isArchived),
        bulkDeleteChats: ids => ipcRenderer.invoke('db:bulkDeleteChats', ids),
        bulkArchiveChats: (ids, isArchived) =>
            ipcRenderer.invoke('db:bulkArchiveChats', ids, isArchived),
        getChat: id => ipcRenderer.invoke('db:getChat', id),
        getAllChats: () => ipcRenderer.invoke('db:getAllChats'),
        searchChats: query => ipcRenderer.invoke('db:searchChats', query),
        addMessage: message => ipcRenderer.invoke('db:addMessage', message),
        deleteMessage: id => ipcRenderer.invoke('db:deleteMessage', id),
        updateMessage: (id, updates) => ipcRenderer.invoke('db:updateMessage', id, updates),
        deleteAllChats: () => ipcRenderer.invoke('db:deleteAllChats'),
        deleteChatsByTitle: title => ipcRenderer.invoke('db:deleteChatsByTitle', title),
        deleteMessages: chatId => ipcRenderer.invoke('db:deleteMessages', chatId),
        getMessages: chatId => ipcRenderer.invoke('db:getMessages', chatId),
        getStats: () => ipcRenderer.invoke('db:getStats'),
        getDetailedStats: period => ipcRenderer.invoke('db:getDetailedStats', period),
        getTimeStats: () => ipcRenderer.invoke('db:getTimeStats'),
        getTokenStats: (period: 'daily' | 'weekly' | 'monthly') =>
            ipcRenderer.invoke('db:getTokenStats', period),
        addTokenUsage: (record: {
            messageId?: string;
            chatId: string;
            projectId?: string;
            provider: string;
            model: string;
            tokensSent: number;
            tokensReceived: number;
            costEstimate?: number;
        }) => ipcRenderer.invoke('db:addTokenUsage', record),
        getProjects: () => ipcRenderer.invoke('db:getProjects'),
        createProject: (name, path, desc, mounts) =>
            ipcRenderer.invoke('db:createProject', name, path, desc, mounts),
        updateProject: (id, updates) => ipcRenderer.invoke('db:updateProject', id, updates),
        deleteProject: (id: string, deleteFiles?: boolean) =>
            ipcRenderer.invoke('db:deleteProject', id, deleteFiles),
        archiveProject: (id: string, isArchived: boolean) =>
            ipcRenderer.invoke('db:archiveProject', id, isArchived),
        getFolders: () => ipcRenderer.invoke('db:getFolders'),
        createFolder: (name: string, color?: string) =>
            ipcRenderer.invoke('db:createFolder', name, color),
        deleteFolder: (id: string) => ipcRenderer.invoke('db:deleteFolder', id),
        updateFolder: (id: string, updates: Partial<Folder>) =>
            ipcRenderer.invoke('db:updateFolder', id, updates),
        getPrompts: () => ipcRenderer.invoke('db:getPrompts'),
        createPrompt: (title: string, content: string, tags?: string[]) =>
            ipcRenderer.invoke('db:createPrompt', title, content, tags),
        updatePrompt: (id: string, updates: Partial<Prompt>) =>
            ipcRenderer.invoke('db:updatePrompt', id, updates),
        deletePrompt: (id: string) => ipcRenderer.invoke('db:deletePrompt', id),
    },
    memory: {
        getAll: () => ipcRenderer.invoke('memory:getAll'),
        addFact: (content: string, tags?: string[]) =>
            ipcRenderer.invoke('memory:addFact', content, tags),
        deleteFact: (id: string) => ipcRenderer.invoke('memory:deleteFact', id),
        deleteEntity: (id: string) => ipcRenderer.invoke('memory:deleteEntity', id),
        setEntityFact: (entityType: string, entityName: string, key: string, value: string) =>
            ipcRenderer.invoke('memory:setEntityFact', entityType, entityName, key, value),
        search: (query: string) => ipcRenderer.invoke('memory:search', query),
    },
    advancedMemory: {
        // Pending memories (staging buffer)
        getPending: () => ipcRenderer.invoke('advancedMemory:getPending'),
        confirm: (
            id: string,
            adjustments?: {
                content?: string;
                category?: MemoryCategory;
                tags?: string[];
                importance?: number;
            }
        ) => ipcRenderer.invoke('advancedMemory:confirm', id, adjustments),
        reject: (id: string, reason?: string) =>
            ipcRenderer.invoke('advancedMemory:reject', id, reason),
        confirmAll: () => ipcRenderer.invoke('advancedMemory:confirmAll'),
        rejectAll: () => ipcRenderer.invoke('advancedMemory:rejectAll'),

        // Explicit memory
        remember: (
            content: string,
            options?: { category?: MemoryCategory; tags?: string[]; projectId?: string }
        ) => ipcRenderer.invoke('advancedMemory:remember', content, options),

        // Recall
        recall: (context: RecallContext) => ipcRenderer.invoke('advancedMemory:recall', context),
        search: (query: string, limit?: number) =>
            ipcRenderer.invoke('advancedMemory:search', query, limit),
        getSearchAnalytics: () => ipcRenderer.invoke('advancedMemory:getSearchAnalytics'),
        getSearchHistory: (limit?: number) =>
            ipcRenderer.invoke('advancedMemory:getSearchHistory', limit),
        getSearchSuggestions: (prefix?: string, limit?: number) =>
            ipcRenderer.invoke('advancedMemory:getSearchSuggestions', prefix, limit),
        export: (query?: string, limit?: number) =>
            ipcRenderer.invoke('advancedMemory:export', query, limit),
        import: (payload: {
            memories?: Array<Partial<AdvancedSemanticFragment>>;
            pendingMemories?: Array<Partial<PendingMemory>>;
            replaceExisting?: boolean;
        }) => ipcRenderer.invoke('advancedMemory:import', payload),

        // Stats & Maintenance
        getStats: () => ipcRenderer.invoke('advancedMemory:getStats'),
        runDecay: () => ipcRenderer.invoke('advancedMemory:runDecay'),

        // Extraction
        extractFromMessage: (content: string, sourceId: string, projectId?: string) =>
            ipcRenderer.invoke('advancedMemory:extractFromMessage', content, sourceId, projectId),

        // Delete & Edit
        delete: (id: string) => ipcRenderer.invoke('advancedMemory:delete', id),
        deleteMany: (ids: string[]) => ipcRenderer.invoke('advancedMemory:deleteMany', ids),
        edit: (
            id: string,
            updates: {
                content?: string;
                category?: MemoryCategory;
                tags?: string[];
                importance?: number;
                projectId?: string | null;
            }
        ) => ipcRenderer.invoke('advancedMemory:edit', id, updates),
        archive: (id: string) => ipcRenderer.invoke('advancedMemory:archive', id),
        archiveMany: (ids: string[]) => ipcRenderer.invoke('advancedMemory:archiveMany', ids),
        restore: (id: string) => ipcRenderer.invoke('advancedMemory:restore', id),
        get: (id: string) => ipcRenderer.invoke('advancedMemory:get', id),
        shareWithProject: (memoryId: string, targetProjectId: string) =>
            ipcRenderer.invoke('advancedMemory:shareWithProject', memoryId, targetProjectId),
        createSharedNamespace: (payload: {
            id: string;
            name: string;
            projectIds: string[];
            accessControl?: Record<string, string[]>;
        }) => ipcRenderer.invoke('advancedMemory:createSharedNamespace', payload),
        syncSharedNamespace: (request: SharedMemorySyncRequest) =>
            ipcRenderer.invoke('advancedMemory:syncSharedNamespace', request),
        getSharedNamespaceAnalytics: (namespaceId: string) =>
            ipcRenderer.invoke('advancedMemory:getSharedNamespaceAnalytics', namespaceId),
        searchAcrossProjects: (payload: {
            namespaceId: string;
            query: string;
            projectId: string;
            limit?: number;
        }) => ipcRenderer.invoke('advancedMemory:searchAcrossProjects', payload),
        getHistory: (id: string) => ipcRenderer.invoke('advancedMemory:getHistory', id),
        rollback: (id: string, versionIndex: number) =>
            ipcRenderer.invoke('advancedMemory:rollback', id, versionIndex),
        recategorize: (ids?: string[]) => ipcRenderer.invoke('advancedMemory:recategorize', ids),
        // Visualization
        getAllEntityKnowledge: () => ipcRenderer.invoke('advancedMemory:getAllEntityKnowledge'),
        getAllEpisodes: () => ipcRenderer.invoke('advancedMemory:getAllEpisodes'),
        getAllAdvancedMemories: () => ipcRenderer.invoke('advancedMemory:getAllAdvancedMemories'),
        health: () => ipcRenderer.invoke('advancedMemory:health'),
    },
    codeSandbox: {
        languages: () => ipcRenderer.invoke('code-sandbox:languages'),
        execute: (payload: {
            language: 'javascript' | 'typescript' | 'python' | 'shell';
            code: string;
            timeoutMs?: number;
            stdin?: string;
        }) => ipcRenderer.invoke('code-sandbox:execute', payload),
        health: () => ipcRenderer.invoke('code-sandbox:health'),
    },
    voice: {
        detectWakeWord: (payload: { transcript: string; wakeWord?: string }) =>
            ipcRenderer.invoke('voice:wake-word-detect', payload),
        startSession: (payload?: { wakeWord?: string; locale?: string }) =>
            ipcRenderer.invoke('voice:session-start', payload ?? {}),
        submitUtterance: (payload: { sessionId: string; transcript: string; assistantSpeaking?: boolean }) =>
            ipcRenderer.invoke('voice:session-utterance', payload),
        endSession: (sessionId: string) => ipcRenderer.invoke('voice:session-end', sessionId),
        createNote: (payload: { title?: string; transcript: string }) =>
            ipcRenderer.invoke('voice:note-create', payload),
        listNotes: () => ipcRenderer.invoke('voice:note-list'),
        getNote: (noteId: string) => ipcRenderer.invoke('voice:note-get', noteId),
        searchNotes: (payload: { query: string; limit?: number }) =>
            ipcRenderer.invoke('voice:note-search', payload),
        deleteNote: (noteId: string) => ipcRenderer.invoke('voice:note-delete', noteId),
    },
    audit: {
        getLogs: (startDate?: string, endDate?: string, category?: string) =>
            ipcRenderer.invoke('audit:getLogs', startDate, endDate, category),
    },
    collaboration: {
        run: (request: {
            messages: Message[];
            models: Array<{ provider: string; model: string }>;
            strategy: 'consensus' | 'vote' | 'best-of-n' | 'chain-of-thought';
            options?: { temperature?: number; maxTokens?: number };
        }) => ipcRenderer.invoke('collaboration:run', request),
        getProviderStats: (provider?: string) =>
            ipcRenderer.invoke('collaboration:getProviderStats', provider),
        getActiveTaskCount: (provider: string) =>
            ipcRenderer.invoke('collaboration:getActiveTaskCount', provider),
        setProviderConfig: (
            provider: string,
            config: {
                maxConcurrent: number;
                priority: number;
                rateLimitPerMinute: number;
            }
        ) => ipcRenderer.invoke('collaboration:setProviderConfig', provider, config),
    },

    agent: {
        getAll: () => ipcRenderer.invoke('agent:get-all'),
        get: (id: string) => ipcRenderer.invoke('agent:get', id),
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
        }) => ipcRenderer.invoke('agent:create', payload),
        delete: (
            id: string,
            options?: { confirm?: boolean; softDelete?: boolean; backupBeforeDelete?: boolean }
        ) => ipcRenderer.invoke('agent:delete', id, options),
        clone: (id: string, newName?: string) => ipcRenderer.invoke('agent:clone', id, newName),
        exportAgent: (id: string) => ipcRenderer.invoke('agent:export', id),
        importAgent: (payload: string) => ipcRenderer.invoke('agent:import', payload),
        getTemplatesLibrary: () => ipcRenderer.invoke('agent:get-templates-library'),
        validateTemplate: (template: {
            name?: string;
            description?: string;
            systemPrompt?: string;
            tools?: string[];
            parentModel?: string;
            color?: string;
        }) => ipcRenderer.invoke('agent:validate-template', template),
        recover: (archiveId: string) => ipcRenderer.invoke('agent:recover', archiveId),
    },

    ssh: {
        connect: connection => ipcRenderer.invoke('ssh:connect', connection),
        disconnect: connectionId => ipcRenderer.invoke('ssh:disconnect', connectionId),
        execute: (connectionId, command, options) =>
            ipcRenderer.invoke('ssh:execute', connectionId, command, options),
        upload: (connectionId, local, remote) =>
            ipcRenderer.invoke('ssh:upload', { connectionId, local, remote }),
        download: (connectionId, remote, local) =>
            ipcRenderer.invoke('ssh:download', { connectionId, remote, local }),
        listDir: (connectionId, path) => ipcRenderer.invoke('ssh:listDir', { connectionId, path }),
        readFile: (connectionId, path) =>
            ipcRenderer.invoke('ssh:readFile', { connectionId, path }),
        writeFile: (connectionId, path, content) =>
            ipcRenderer.invoke('ssh:writeFile', { connectionId, path, content }),
        deleteDir: (connectionId, path) =>
            ipcRenderer.invoke('ssh:deleteDir', { connectionId, path }),
        deleteFile: (connectionId, path) =>
            ipcRenderer.invoke('ssh:deleteFile', { connectionId, path }),
        mkdir: (connectionId, path) => ipcRenderer.invoke('ssh:mkdir', { connectionId, path }),
        rename: (connectionId, oldPath, newPath) =>
            ipcRenderer.invoke('ssh:rename', { connectionId, oldPath, newPath }),
        getConnections: () => ipcRenderer.invoke('ssh:getConnections'),
        isConnected: connectionId => ipcRenderer.invoke('ssh:isConnected', connectionId),
        onStdout: callback =>
            ipcRenderer.on('ssh:stdout', (_event, data: string | Uint8Array) => callback(data)),
        onStderr: callback =>
            ipcRenderer.on('ssh:stderr', (_event, data: string | Uint8Array) => callback(data)),
        onConnected: callback => ipcRenderer.on('ssh:connected', (_event, id) => callback(id)),
        onDisconnected: callback =>
            ipcRenderer.on('ssh:disconnected', (_event, id) => callback(id)),
        onUploadProgress: callback =>
            ipcRenderer.on('ssh:uploadProgress', (_event, p) => callback(p)),
        onDownloadProgress: callback =>
            ipcRenderer.on('ssh:downloadProgress', (_event, p) => callback(p)),
        removeAllListeners: () => {
            ipcRenderer.removeAllListeners('ssh:stdout');
            ipcRenderer.removeAllListeners('ssh:stderr');
            ipcRenderer.removeAllListeners('ssh:connected');
            ipcRenderer.removeAllListeners('ssh:disconnected');
            ipcRenderer.removeAllListeners('ssh:uploadProgress');
            ipcRenderer.removeAllListeners('ssh:downloadProgress');
            ipcRenderer.removeAllListeners('ssh:shellData');
        },
        onShellData: callback =>
            ipcRenderer.on('ssh:shellData', (_event, data: { data: string }) => callback(data)),
        shellStart: connectionId => ipcRenderer.invoke('ssh:shellStart', connectionId),
        shellWrite: (connectionId, data) =>
            ipcRenderer.invoke('ssh:shellWrite', { connectionId, data }),
        getSystemStats: connectionId => ipcRenderer.invoke('ssh:getSystemStats', connectionId),
        getInstalledPackages: (connectionId, manager) =>
            ipcRenderer.invoke('ssh:getInstalledPackages', connectionId, manager),
        getLogFiles: connectionId => ipcRenderer.invoke('ssh:getLogFiles', connectionId),
        readLogFile: (connectionId, path, lines) =>
            ipcRenderer.invoke('ssh:readLogFile', { connectionId, path, lines }),
        getProfiles: () => ipcRenderer.invoke('ssh:getProfiles'),
        saveProfile: profile => ipcRenderer.invoke('ssh:saveProfile', profile),
        deleteProfile: id => ipcRenderer.invoke('ssh:deleteProfile', id),
        createTunnel: payload => ipcRenderer.invoke('ssh:createTunnel', payload),
        listTunnels: connectionId => ipcRenderer.invoke('ssh:listTunnels', connectionId),
        closeTunnel: forwardId => ipcRenderer.invoke('ssh:closeTunnel', forwardId),
        saveTunnelPreset: preset => ipcRenderer.invoke('ssh:saveTunnelPreset', preset),
        listTunnelPresets: () => ipcRenderer.invoke('ssh:listTunnelPresets'),
        deleteTunnelPreset: id => ipcRenderer.invoke('ssh:deleteTunnelPreset', id),
        listManagedKeys: () => ipcRenderer.invoke('ssh:listManagedKeys'),
        generateManagedKey: payload => ipcRenderer.invoke('ssh:generateManagedKey', payload),
        importManagedKey: payload => ipcRenderer.invoke('ssh:importManagedKey', payload),
        deleteManagedKey: id => ipcRenderer.invoke('ssh:deleteManagedKey', id),
        rotateManagedKey: payload => ipcRenderer.invoke('ssh:rotateManagedKey', payload),
        backupManagedKey: id => ipcRenderer.invoke('ssh:backupManagedKey', id),
        listKnownHosts: () => ipcRenderer.invoke('ssh:listKnownHosts'),
        addKnownHost: payload => ipcRenderer.invoke('ssh:addKnownHost', payload),
        removeKnownHost: payload => ipcRenderer.invoke('ssh:removeKnownHost', payload),
        searchRemoteFiles: payload => ipcRenderer.invoke('ssh:searchRemoteFiles', payload),
        getSearchHistory: connectionId => ipcRenderer.invoke('ssh:getSearchHistory', connectionId),
        exportSearchHistory: () => ipcRenderer.invoke('ssh:exportSearchHistory'),
        reconnect: (connectionId, retries) => ipcRenderer.invoke('ssh:reconnect', connectionId, retries),
        acquireConnection: connectionId => ipcRenderer.invoke('ssh:acquireConnection', connectionId),
        releaseConnection: connectionId => ipcRenderer.invoke('ssh:releaseConnection', connectionId),
        getConnectionPoolStats: () => ipcRenderer.invoke('ssh:getConnectionPoolStats'),
        enqueueTransfer: task => ipcRenderer.invoke('ssh:enqueueTransfer', task),
        getTransferQueue: () => ipcRenderer.invoke('ssh:getTransferQueue'),
        runTransferBatch: (tasks, concurrency) => ipcRenderer.invoke('ssh:runTransferBatch', tasks, concurrency),
        listRemoteContainers: connectionId => ipcRenderer.invoke('ssh:listRemoteContainers', connectionId),
        runRemoteContainer: payload => ipcRenderer.invoke('ssh:runRemoteContainer', payload),
        stopRemoteContainer: (connectionId, containerId) => ipcRenderer.invoke('ssh:stopRemoteContainer', connectionId, containerId),
        saveProfileTemplate: template => ipcRenderer.invoke('ssh:saveProfileTemplate', template),
        listProfileTemplates: () => ipcRenderer.invoke('ssh:listProfileTemplates'),
        deleteProfileTemplate: id => ipcRenderer.invoke('ssh:deleteProfileTemplate', id),
        exportProfiles: ids => ipcRenderer.invoke('ssh:exportProfiles', ids),
        importProfiles: payload => ipcRenderer.invoke('ssh:importProfiles', payload),
        validateProfile: profile => ipcRenderer.invoke('ssh:validateProfile', profile),
        testProfile: profile => ipcRenderer.invoke('ssh:testProfile', profile),
        startSessionRecording: connectionId => ipcRenderer.invoke('ssh:startSessionRecording', connectionId),
        stopSessionRecording: connectionId => ipcRenderer.invoke('ssh:stopSessionRecording', connectionId),
        getSessionRecording: connectionId => ipcRenderer.invoke('ssh:getSessionRecording', connectionId),
        searchSessionRecording: (connectionId, query) => ipcRenderer.invoke('ssh:searchSessionRecording', connectionId, query),
        exportSessionRecording: connectionId => ipcRenderer.invoke('ssh:exportSessionRecording', connectionId),
        listSessionRecordings: () => ipcRenderer.invoke('ssh:listSessionRecordings'),
    },

    executeTools: (toolName, args, toolCallId) =>
        ipcRenderer.invoke('tools:execute', toolName, args, toolCallId),
    killTool: toolCallId => ipcRenderer.invoke('tools:kill', toolCallId),
    getToolDefinitions: () => ipcRenderer.invoke('tools:getDefinitions'),

    mcp: {
        list: () => ipcRenderer.invoke('mcp:list'),
        dispatch: (service, action, args) =>
            ipcRenderer.invoke('mcp:dispatch', { service, action, args }),
        toggle: (service, enabled) => ipcRenderer.invoke('mcp:toggle', { service, enabled }),
        install: config => ipcRenderer.invoke('mcp:install', config),
        uninstall: name => ipcRenderer.invoke('mcp:uninstall', name),
        getDebugMetrics: () => ipcRenderer.invoke('mcp:debug-metrics'),
        listPermissionRequests: () => ipcRenderer.invoke('mcp:permissions:list-requests'),
        setActionPermission: (service, action, policy) =>
            ipcRenderer.invoke('mcp:permissions:set', service, action, policy),
        resolvePermissionRequest: (requestId, decision) =>
            ipcRenderer.invoke('mcp:permissions:resolve-request', requestId, decision),
        onResult: callback => ipcRenderer.on('mcp:result', (_event, result) => callback(result)),
        removeResultListener: () => ipcRenderer.removeAllListeners('mcp:result'),
    },

    mcpMarketplace: {
        list: () => ipcRenderer.invoke('mcp:marketplace:list'),
        search: query => ipcRenderer.invoke('mcp:marketplace:search', query),
        filter: category => ipcRenderer.invoke('mcp:marketplace:filter', category),
        categories: () => ipcRenderer.invoke('mcp:marketplace:categories'),
        install: serverId => ipcRenderer.invoke('mcp:marketplace:install', serverId),
        uninstall: serverId => ipcRenderer.invoke('mcp:marketplace:uninstall', serverId),
        installed: () => ipcRenderer.invoke('mcp:marketplace:installed'),
        toggle: (serverId, enabled) =>
            ipcRenderer.invoke('mcp:marketplace:toggle', serverId, enabled),
        updateConfig: (serverId, patch) =>
            ipcRenderer.invoke('mcp:marketplace:update-config', serverId, patch),
        versionHistory: serverId =>
            ipcRenderer.invoke('mcp:marketplace:version-history', serverId),
        rollbackVersion: (serverId, targetVersion) =>
            ipcRenderer.invoke('mcp:marketplace:rollback-version', serverId, targetVersion),
        debug: () => ipcRenderer.invoke('mcp:marketplace:debug'),
        refresh: () => ipcRenderer.invoke('mcp:marketplace:refresh'),
        health: () => ipcRenderer.invoke('mcp:marketplace:health'),
    },

    proxyEmbed: {
        start: options => ipcRenderer.invoke('proxy-embed:start', options),
        stop: () => ipcRenderer.invoke('proxy-embed:stop'),
        status: () => ipcRenderer.invoke('proxy-embed:status'),
    },

    captureScreenshot: () => ipcRenderer.invoke('screenshot:capture'),
    openExternal: url => {
        void ipcRenderer.invoke('shell:openExternal', url);
    },
    captureCookies: (url: string, timeoutMs?: number) =>
        ipcRenderer.invoke('window:captureCookies', url, timeoutMs),
    openTerminal: command => ipcRenderer.invoke('shell:openTerminal', command),
    runCommand: (command, args, cwd) => ipcRenderer.invoke('shell:runCommand', command, args, cwd),
    git: {
        getBranch: cwd => ipcRenderer.invoke('git:getBranch', cwd),
        getStatus: cwd => ipcRenderer.invoke('git:getStatus', cwd),
        getLastCommit: cwd => ipcRenderer.invoke('git:getLastCommit', cwd),
        getRecentCommits: (cwd, count) => ipcRenderer.invoke('git:getRecentCommits', cwd, count),
        getBranches: cwd => ipcRenderer.invoke('git:getBranches', cwd),
        isRepository: cwd => ipcRenderer.invoke('git:isRepository', cwd),
        getFileDiff: (cwd: string, filePath: string, staged?: boolean) =>
            ipcRenderer.invoke('git:getFileDiff', cwd, filePath, staged),
        getUnifiedDiff: (cwd: string, filePath: string, staged?: boolean) =>
            ipcRenderer.invoke('git:getUnifiedDiff', cwd, filePath, staged),
        stageFile: (cwd: string, filePath: string) =>
            ipcRenderer.invoke('git:stageFile', cwd, filePath),
        unstageFile: (cwd: string, filePath: string) =>
            ipcRenderer.invoke('git:unstageFile', cwd, filePath),
        getDetailedStatus: (cwd: string) => ipcRenderer.invoke('git:getDetailedStatus', cwd),
        checkout: (cwd: string, branch: string) => ipcRenderer.invoke('git:checkout', cwd, branch),
        commit: (cwd: string, message: string) => ipcRenderer.invoke('git:commit', cwd, message),
        push: (cwd: string, remote?: string, branch?: string) =>
            ipcRenderer.invoke('git:push', cwd, remote, branch),
        pull: (cwd: string) => ipcRenderer.invoke('git:pull', cwd),
        getRemotes: (cwd: string) => ipcRenderer.invoke('git:getRemotes', cwd),
        getTrackingInfo: (cwd: string) => ipcRenderer.invoke('git:getTrackingInfo', cwd),
        getCommitStats: (cwd: string, days?: number) =>
            ipcRenderer.invoke('git:getCommitStats', cwd, days),
        getDiffStats: (cwd: string) => ipcRenderer.invoke('git:getDiffStats', cwd),
    },

    readPdf: path => ipcRenderer.invoke('files:readPdf', path),
    selectDirectory: () => ipcRenderer.invoke('files:selectDirectory'),
    selectFile: (options?: { title?: string; filters?: { name: string; extensions: string[] }[] }) =>
        ipcRenderer.invoke('files:selectFile', options),

    listDirectory: path => ipcRenderer.invoke('files:listDirectory', path),
    readFile: path => ipcRenderer.invoke('files:readFile', path),
    writeFile: (
        path: string,
        content: string,
        context?: { aiSystem?: string; chatSessionId?: string; changeReason?: string }
    ) => ipcRenderer.invoke('files:writeFile', path, content, context),

    createDirectory: path => ipcRenderer.invoke('files:createDirectory', path),
    deleteFile: path => ipcRenderer.invoke('files:deleteFile', path),
    deleteDirectory: path => ipcRenderer.invoke('files:deleteDirectory', path),
    renamePath: (oldPath, newPath) => ipcRenderer.invoke('files:renamePath', oldPath, newPath),
    searchFiles: (rootPath, pattern) => ipcRenderer.invoke('files:searchFiles', rootPath, pattern),
    searchFilesStream: (
        rootPath: string,
        pattern: string,
        onResult: (path: string) => void,
        onComplete?: () => void
    ) => {
        const jobId = crypto.randomUUID();

        const resultListener = (_event: IpcRendererEvent, path: string) => onResult(path);
        const completeListener = () => {
            ipcRenderer.removeListener(`files:search-result:${jobId}`, resultListener);
            ipcRenderer.removeListener(`files:search-complete:${jobId}`, completeListener);
            if (onComplete) {
                onComplete();
            }
        };

        ipcRenderer.on(`files:search-result:${jobId}`, resultListener);
        ipcRenderer.on(`files:search-complete:${jobId}`, completeListener);

        void ipcRenderer.invoke('files:searchFilesStream', rootPath, pattern, jobId);

        return () => {
            // unsubscribe function
            ipcRenderer.removeListener(`files:search-result:${jobId}`, resultListener);
            ipcRenderer.removeListener(`files:search-complete:${jobId}`, completeListener);
        };
    },
    saveFile: (content: string, filename: string) =>
        ipcRenderer.invoke('dialog:saveFile', { content, filename }),
    exportChatToPdf: (chatId: string, title: string) =>
        ipcRenderer.invoke('files:exportChatToPdf', chatId, title) as Promise<{
            success: boolean;
            path?: string;
            error?: string;
        }>,

    // Export
    exportMarkdown: (content: string, filePath: string) =>
        ipcRenderer.invoke('export:markdown', content, filePath),
    exportPDF: (htmlContent: string, filePath: string) =>
        ipcRenderer.invoke('export:pdf', htmlContent, filePath),

    modelRegistry: {
        getAllModels: () => ipcRenderer.invoke('model-registry:getAllModels'),
        getRemoteModels: () => ipcRenderer.invoke('model-registry:getRemoteModels'),
        getInstalledModels: () => ipcRenderer.invoke('model-registry:getInstalledModels'),
    },

    files: {
        listDirectory: (path: string) =>
            ipcRenderer.invoke('files:listDirectory', path).then(r => r.data),
        readFile: (filePath: string) =>
            ipcRenderer.invoke('files:readFile', filePath).then(r => r.data),
        readImage: (filePath: string) =>
            ipcRenderer.invoke('files:readImage', filePath).then(r => r.data),
        writeFile: (
            filePath: string,
            content: string,
            context?: { aiSystem?: string; chatSessionId?: string; changeReason?: string }
        ) => ipcRenderer.invoke('files:writeFile', filePath, content, context).then(r => r.data),
        exists: (path: string) => ipcRenderer.invoke('files:exists', path).then(r => r.data),
    },

    getSettings: () => ipcRenderer.invoke('settings:get'),
    saveSettings: async settings => {
        const response = await ipcRenderer.invoke('settings:save', settings) as {
            success?: boolean;
            data?: AppSettings;
            error?: { message?: string } | string;
        };
        if (response?.success === false) {
            const errorMessage =
                typeof response.error === 'string'
                    ? response.error
                    : response.error?.message ?? 'Failed to save settings';
            throw new Error(errorMessage);
        }
        return response?.data ?? settings;
    },

    project: {
        analyze: async (rootPath: string, projectId: string) => {
            const res = await ipcRenderer.invoke('project:analyze', rootPath, projectId);
            if (res.success) {
                return res.data;
            }
            throw new Error(res.error?.message ?? 'Analysis failed');
        },
        analyzeIdentity: async (rootPath: string) => {
            const res = await ipcRenderer.invoke('project:analyzeIdentity', rootPath);
            if (res.success) {
                return res.data;
            }
            throw new Error(res.error?.message ?? 'Identity analysis failed');
        },
        generateLogo: async (
            projectPath: string,
            options: { prompt: string; style: string; model: string; count: number }
        ) => {
            const res = await ipcRenderer.invoke('project:generateLogo', projectPath, options);
            if (res.success) {
                return res.data;
            }
            throw new Error(res.error?.message ?? 'Logo generation failed');
        },
        analyzeDirectory: async (dirPath: string) => {
            const res = await ipcRenderer.invoke('project:analyzeDirectory', dirPath);
            if (res.success) {
                return res.data;
            }
            throw new Error(res.error?.message ?? 'Directory analysis failed');
        },
        applyLogo: async (projectPath: string, tempLogoPath: string) => {
            const res = await ipcRenderer.invoke('project:applyLogo', projectPath, tempLogoPath);
            if (res.success) {
                return res.data;
            }
            throw new Error(res.error?.message ?? 'Apply logo failed');
        },
        getCompletion: async (text: string) => {
            const res = await ipcRenderer.invoke('project:getCompletion', text);
            if (res.success) {
                return res.data;
            }
            throw new Error(res.error?.message ?? 'Completion failed');
        },
        improveLogoPrompt: async (prompt: string) => {
            const res = await ipcRenderer.invoke('project:improveLogoPrompt', prompt);
            if (res.success) {
                return res.data;
            }
            throw new Error(res.error?.message ?? 'Prompt improvement failed');
        },
        uploadLogo: async (projectPath: string) => {
            const res = await ipcRenderer.invoke('project:uploadLogo', projectPath);
            if (res.success) {
                return res.data;
            }
            return null;
        },
        watch: async (rootPath: string) => {
            const res = await ipcRenderer.invoke('project:watch', rootPath);
            return res.success;
        },
        unwatch: async (rootPath: string) => {
            const res = await ipcRenderer.invoke('project:unwatch', rootPath);
            return res.success;
        },
        onFileChange: (callback: (event: string, path: string, rootPath: string) => void) => {
            const listener = (
                _event: IpcRendererEvent,
                data: { event: string; path: string; rootPath: string }
            ) => callback(data.event, data.path, data.rootPath);
            ipcRenderer.on('project:file-change', listener);
            return () => ipcRenderer.removeListener('project:file-change', listener);
        },
    },

    process: {
        spawn: (command: string, args: string[], cwd: string) =>
            ipcRenderer.invoke('process:spawn', command, args, cwd),
        kill: (id: string) => ipcRenderer.invoke('process:kill', id),
        list: () => ipcRenderer.invoke('process:list'),
        scanScripts: (rootPath: string) => ipcRenderer.invoke('process:scan-scripts', rootPath),
        resize: (id: string, cols: number, rows: number) =>
            ipcRenderer.invoke('process:resize', id, cols, rows),
        write: (id: string, data: string) => ipcRenderer.invoke('process:write', id, data),
        onData: (callback: (data: { id: string; data: string }) => void) =>
            ipcRenderer.on('process:data', (_event, data) => callback(data)),
        onExit: (callback: (data: { id: string; code: number }) => void) =>
            ipcRenderer.on('process:exit', (_event, data) => callback(data)),
        removeListeners: () => {
            ipcRenderer.removeAllListeners('process:data');
            ipcRenderer.removeAllListeners('process:exit');
        },
    },

    huggingface: {
        searchModels: (query: string, limit: number, page: number, sort?: string) =>
            ipcRenderer.invoke('hf:search-models', query, limit, page, sort),
        getRecommendations: (limit?: number, query?: string) =>
            ipcRenderer.invoke('hf:get-recommendations', limit, query),
        getFiles: (modelId: string) => ipcRenderer.invoke('hf:get-files', modelId),
        getModelPreview: (modelId: string) => ipcRenderer.invoke('hf:get-model-preview', modelId),
        compareModels: (modelIds: string[]) => ipcRenderer.invoke('hf:compare-models', modelIds),
        validateCompatibility: (
            file: { path: string; size: number; oid?: string; quantization: string },
            availableRamGB?: number,
            availableVramGB?: number
        ) => ipcRenderer.invoke('hf:validate-compatibility', file, availableRamGB, availableVramGB),
        getWatchlist: () => ipcRenderer.invoke('hf:watchlist:get'),
        addToWatchlist: (modelId: string) => ipcRenderer.invoke('hf:watchlist:add', modelId),
        removeFromWatchlist: (modelId: string) => ipcRenderer.invoke('hf:watchlist:remove', modelId),
        getCacheStats: () => ipcRenderer.invoke('hf:cache-stats'),
        clearCache: () => ipcRenderer.invoke('hf:cache-clear'),
        testDownloadedModel: (filePath: string) => ipcRenderer.invoke('hf:test-downloaded-model', filePath),
        getConversionPresets: () => ipcRenderer.invoke('hf:get-conversion-presets'),
        getOptimizationSuggestions: (options: {
            sourcePath: string;
            outputPath: string;
            quantization: string;
            preset?: string;
            modelId?: string;
        }) => ipcRenderer.invoke('hf:get-optimization-suggestions', options),
        validateConversion: (options: {
            sourcePath: string;
            outputPath: string;
            quantization: string;
            preset?: string;
            modelId?: string;
        }) => ipcRenderer.invoke('hf:validate-conversion', options),
        convertModel: (options: {
            sourcePath: string;
            outputPath: string;
            quantization: string;
            preset?: string;
            modelId?: string;
        }) => ipcRenderer.invoke('hf:convert-model', options),
        onConversionProgress: callback => {
            const listener = (_event: IpcRendererEvent, progress: { stage: string; percent: number; message: string }) =>
                callback(progress);
            ipcRenderer.on('hf:conversion-progress', listener);
            return () => ipcRenderer.removeListener('hf:conversion-progress', listener);
        },
        getModelVersions: (modelId: string) => ipcRenderer.invoke('hf:versions:list', modelId),
        registerModelVersion: (modelId: string, filePath: string, notes?: string) =>
            ipcRenderer.invoke('hf:versions:register', modelId, filePath, notes),
        compareModelVersions: (modelId: string, leftVersionId: string, rightVersionId: string) =>
            ipcRenderer.invoke('hf:versions:compare', modelId, leftVersionId, rightVersionId),
        rollbackModelVersion: (modelId: string, versionId: string, targetPath: string) =>
            ipcRenderer.invoke('hf:versions:rollback', modelId, versionId, targetPath),
        pinModelVersion: (modelId: string, versionId: string, pinned: boolean) =>
            ipcRenderer.invoke('hf:versions:pin', modelId, versionId, pinned),
        getVersionNotifications: (modelId: string) =>
            ipcRenderer.invoke('hf:versions:notifications', modelId),
        prepareFineTuneDataset: (inputPath: string, outputPath: string) =>
            ipcRenderer.invoke('hf:finetune:prepare-dataset', inputPath, outputPath),
        startFineTune: (
            modelId: string,
            datasetPath: string,
            outputPath: string,
            options?: { epochs?: number; learningRate?: number }
        ) => ipcRenderer.invoke('hf:finetune:start', modelId, datasetPath, outputPath, options),
        listFineTuneJobs: (modelId?: string) =>
            ipcRenderer.invoke('hf:finetune:list', modelId),
        getFineTuneJob: (jobId: string) =>
            ipcRenderer.invoke('hf:finetune:get', jobId),
        cancelFineTuneJob: (jobId: string) =>
            ipcRenderer.invoke('hf:finetune:cancel', jobId),
        evaluateFineTuneJob: (jobId: string) =>
            ipcRenderer.invoke('hf:finetune:evaluate', jobId),
        exportFineTunedModel: (jobId: string, exportPath: string) =>
            ipcRenderer.invoke('hf:finetune:export', jobId, exportPath),
        onFineTuneProgress: callback => {
            const listener = (_event: IpcRendererEvent, job: unknown) => callback(job);
            ipcRenderer.on('hf:finetune-progress', listener);
            return () => ipcRenderer.removeListener('hf:finetune-progress', listener);
        },
        downloadFile: (
            url: string,
            outputPath: string,
            expectedSize: number,
            expectedSha256: string,
            scheduleAtMs?: number
        ) => ipcRenderer.invoke('hf:download-file', { url, outputPath, expectedSize, expectedSha256, scheduleAt: scheduleAtMs }),
        onDownloadProgress: callback =>
            ipcRenderer.on('hf:download-progress', (_event, progress) => callback(progress)),
        cancelDownload: () => {
            void ipcRenderer.invoke('hf:cancel-download');
        },
    },

    log: {
        write: (level, message, data) => ipcRenderer.send('log:write', { level, message, data }),
        debug: (message, data) => ipcRenderer.send('log:write', { level: 'debug', message, data }),
        info: (message, data) => ipcRenderer.send('log:write', { level: 'info', message, data }),
        warn: (message, data) => ipcRenderer.send('log:write', { level: 'warn', message, data }),
        error: (message, data) => ipcRenderer.send('log:write', { level: 'error', message, data }),
    },

    terminal: {
        isAvailable: () => ipcRenderer.invoke('terminal:isAvailable'),
        getProfiles: () => ipcRenderer.invoke('terminal:getProfiles'),
        saveProfile: profile => ipcRenderer.invoke('terminal:saveProfile', profile),
        deleteProfile: id => ipcRenderer.invoke('terminal:deleteProfile', id),
        validateProfile: profile => ipcRenderer.invoke('terminal:validateProfile', profile),
        getProfileTemplates: () => ipcRenderer.invoke('terminal:getProfileTemplates'),
        exportProfiles: () => ipcRenderer.invoke('terminal:exportProfiles'),
        exportProfileShareCode: profileId =>
            ipcRenderer.invoke('terminal:exportProfileShareCode', profileId),
        importProfiles: (payload, options) =>
            ipcRenderer.invoke('terminal:importProfiles', payload, options),
        importProfileShareCode: (shareCode, options) =>
            ipcRenderer.invoke('terminal:importProfileShareCode', shareCode, options),
        getShells: () => ipcRenderer.invoke('terminal:getShells'),
        getBackends: () => ipcRenderer.invoke('terminal:getBackends'),
        getRuntimeHealth: () => ipcRenderer.invoke('terminal:getRuntimeHealth'),
        getDockerContainers: () => ipcRenderer.invoke('terminal:getDockerContainers'),
        create: options => ipcRenderer.invoke('terminal:create', options),
        detach: options => ipcRenderer.invoke('window:openDetachedTerminal', options),
        getCommandHistory: (query, limit) =>
            ipcRenderer.invoke('terminal:getCommandHistory', query, limit),
        getSuggestions: (options: {
            command: string;
            shell: string;
            cwd: string;
            historyLimit?: number;
        }) => ipcRenderer.invoke('terminal:getSuggestions', options),
        explainCommand: (options: { command: string; shell: string; cwd?: string }) =>
            ipcRenderer.invoke('terminal:explainCommand', options),
        explainError: (options: {
            errorOutput: string;
            command?: string;
            shell: string;
            cwd?: string;
        }) => ipcRenderer.invoke('terminal:explainError', options),
        fixError: (options: {
            errorOutput: string;
            command: string;
            shell: string;
            cwd?: string;
        }) => ipcRenderer.invoke('terminal:fixError', options),
        clearCommandHistory: () => ipcRenderer.invoke('terminal:clearCommandHistory'),
        close: sessionId => ipcRenderer.invoke('terminal:close', sessionId),
        write: (sessionId, data) => ipcRenderer.invoke('terminal:write', sessionId, data),
        resize: (sessionId, cols, rows) =>
            ipcRenderer.invoke('terminal:resize', sessionId, cols, rows),
        kill: sessionId => ipcRenderer.invoke('terminal:kill', sessionId),
        getSessions: () => ipcRenderer.invoke('terminal:getSessions'),
        restoreAllSnapshots: () => ipcRenderer.invoke('terminal:restoreAllSnapshots'),
        exportSession: (sessionId, options) =>
            ipcRenderer.invoke('terminal:exportSession', sessionId, options),
        importSession: (payload, options) =>
            ipcRenderer.invoke('terminal:importSession', payload, options),
        createSessionShareCode: (sessionId, options) =>
            ipcRenderer.invoke('terminal:createSessionShareCode', sessionId, options),
        importSessionShareCode: (shareCode, options) =>
            ipcRenderer.invoke('terminal:importSessionShareCode', shareCode, options),
        getSnapshotSessions: () => ipcRenderer.invoke('terminal:getSnapshotSessions'),
        getSessionTemplates: () => ipcRenderer.invoke('terminal:getSessionTemplates'),
        saveSessionTemplate: payload => ipcRenderer.invoke('terminal:saveSessionTemplate', payload),
        deleteSessionTemplate: templateId =>
            ipcRenderer.invoke('terminal:deleteSessionTemplate', templateId),
        createFromSessionTemplate: (templateId, options) =>
            ipcRenderer.invoke('terminal:createFromSessionTemplate', templateId, options),
        restoreSnapshotSession: snapshotId =>
            ipcRenderer.invoke('terminal:restoreSnapshotSession', snapshotId),
        searchScrollback: (sessionId, query, options) =>
            ipcRenderer.invoke('terminal:searchScrollback', sessionId, query, options),
        exportScrollback: (sessionId, exportPath) =>
            ipcRenderer.invoke('terminal:exportScrollback', sessionId, exportPath),
        getSessionAnalytics: sessionId =>
            ipcRenderer.invoke('terminal:getSessionAnalytics', sessionId),
        getSearchAnalytics: () => ipcRenderer.invoke('terminal:getSearchAnalytics'),
        getSearchSuggestions: (query, limit) =>
            ipcRenderer.invoke('terminal:getSearchSuggestions', query, limit),
        exportSearchResults: (sessionId, query, options) =>
            ipcRenderer.invoke(
                'terminal:exportSearchResults',
                sessionId,
                query,
                options
            ),
        addScrollbackMarker: (sessionId, label, lineNumber) =>
            ipcRenderer.invoke('terminal:addScrollbackMarker', sessionId, label, lineNumber),
        listScrollbackMarkers: sessionId =>
            ipcRenderer.invoke('terminal:listScrollbackMarkers', sessionId),
        deleteScrollbackMarker: markerId =>
            ipcRenderer.invoke('terminal:deleteScrollbackMarker', markerId),
        filterScrollback: (sessionId, options) =>
            ipcRenderer.invoke('terminal:filterScrollback', sessionId, options),
        setSessionTitle: (sessionId, title) =>
            ipcRenderer.invoke('terminal:setSessionTitle', sessionId, title),
        onData: callback => {
            const listener = (_event: IpcRendererEvent, data: { id: string; data: string }) =>
                callback(data);
            ipcRenderer.on('terminal:data', listener);
            return () => ipcRenderer.removeListener('terminal:data', listener);
        },
        onExit: callback => {
            const listener = (_event: IpcRendererEvent, data: { id: string; code: number }) =>
                callback(data);
            ipcRenderer.on('terminal:exit', listener);
            return () => ipcRenderer.removeListener('terminal:exit', listener);
        },
        readBuffer: sessionId => ipcRenderer.invoke('terminal:readBuffer', sessionId),
        removeAllListeners: () => {
            ipcRenderer.removeAllListeners('terminal:data');
            ipcRenderer.removeAllListeners('terminal:exit');
        },
    },

    gallery: {
        list: () => ipcRenderer.invoke('gallery:list'),
        delete: path => ipcRenderer.invoke('gallery:delete', path),
        open: path => ipcRenderer.invoke('gallery:open', path),
        reveal: path => ipcRenderer.invoke('gallery:reveal', path),
        batchDownload: input => ipcRenderer.invoke('gallery:batch-download', input),
    },

    onChatGenerationStatus: callback => {
        const listener = (_event: IpcRendererEvent, data: { chatId?: string; isGenerating?: boolean }) => callback(data);
        ipcRenderer.on('chat:generation-status', listener);
        return () => ipcRenderer.removeListener('chat:generation-status', listener);
    },
    onAgentEvent: callback => {
        const listener = (_event: IpcRendererEvent, payload: unknown) => callback(payload);
        ipcRenderer.on('agent-event', listener);
        return () => ipcRenderer.removeListener('agent-event', listener);
    },
    onSdCppStatus: callback => {
        const listener = (_event: IpcRendererEvent, data: unknown) => callback(data);
        ipcRenderer.on('sd-cpp:status', listener);
        return () => ipcRenderer.removeListener('sd-cpp:status', listener);
    },
    onSdCppProgress: callback => {
        const listener = (_event: IpcRendererEvent, data: unknown) => callback(data);
        ipcRenderer.on('sd-cpp:progress', listener);
        return () => ipcRenderer.removeListener('sd-cpp:progress', listener);
    },

    getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),

    update: {
        checkForUpdates: () => ipcRenderer.invoke('update:check'),
        downloadUpdate: () => ipcRenderer.invoke('update:download'),
        installUpdate: () => ipcRenderer.invoke('update:install'),
    },

    ipcRenderer: {
        on: (channel: string, listener: (event: IpcRendererEvent, ...args: IpcValue[]) => void) => {
            ipcRenderer.on(channel, listener);
            return () => ipcRenderer.removeListener(channel, listener);
        },
        off: (channel: string, listener: (event: IpcRendererEvent, ...args: IpcValue[]) => void) =>
            ipcRenderer.removeListener(channel, listener),
        send: (channel: string, ...args: IpcValue[]) => ipcRenderer.send(channel, ...args),
        invoke: <T = IpcValue>(channel: string, ...args: IpcValue[]) =>
            ipcRenderer.invoke(channel, ...args) as Promise<T>,
        removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),
    },

    batch: {
        invoke: requests => ipcRenderer.invoke('batch:invoke', requests),
        invokeSequential: requests => ipcRenderer.invoke('batch:invokeSequential', requests),
        getChannels: () => ipcRenderer.invoke('batch:getChannels'),
    },
    lazyServices: {
        getStatus: () => ipcRenderer.invoke('lazy:get-status')
    },
    ipcContract: {
        getVersion: () => ipcRenderer.invoke('ipc:contract:get'),
        isCompatible: async () => {
            const contractInfo = await ipcRenderer.invoke('ipc:contract:get') as IpcContractVersionInfo;
            return isIpcContractCompatible(contractInfo);
        },
    },

    backup: {
        create: options => ipcRenderer.invoke('backup:create', options),
        restore: (backupPath, options) => ipcRenderer.invoke('backup:restore', backupPath, options),
        list: () => ipcRenderer.invoke('backup:list'),
        delete: backupPath => ipcRenderer.invoke('backup:delete', backupPath),
        getDir: () => ipcRenderer.invoke('backup:getDir'),
        getAutoBackupStatus: () => ipcRenderer.invoke('backup:getAutoBackupStatus'),
        configureAutoBackup: config => ipcRenderer.invoke('backup:configureAutoBackup', config),
        cleanup: () => ipcRenderer.invoke('backup:cleanup'),
        verify: backupPath => ipcRenderer.invoke('backup:verify', backupPath),
        syncToCloudDir: (backupPath, targetDir) =>
            ipcRenderer.invoke('backup:syncToCloudDir', backupPath, targetDir),
        createDisasterRecoveryBundle: targetDir =>
            ipcRenderer.invoke('backup:createDisasterRecoveryBundle', targetDir),
        restoreDisasterRecoveryBundle: bundlePath =>
            ipcRenderer.invoke('backup:restoreDisasterRecoveryBundle', bundlePath),
    },

    export: {
        chat: (chat, options) => ipcRenderer.invoke('export:chat', chat, options),
        chatToMarkdown: (chat, options) =>
            ipcRenderer.invoke('export:chatToMarkdown', chat, options),
        chatToHTML: (chat, options) => ipcRenderer.invoke('export:chatToHTML', chat, options),
        chatToJSON: (chat, options) => ipcRenderer.invoke('export:chatToJSON', chat, options),
        chatToText: (chat, options) => ipcRenderer.invoke('export:chatToText', chat, options),
        chatToPDF: (chat, options) => ipcRenderer.invoke('export:chatToPDF', chat, options),
        getContent: (chat, options) => ipcRenderer.invoke('export:getContent', chat, options),
    },

    ideas: {
        createSession: config => ipcRenderer.invoke('ideas:createSession', config),
        getSession: id => ipcRenderer.invoke('ideas:getSession', id),
        getSessions: () => ipcRenderer.invoke('ideas:getSessions'),
        cancelSession: id => ipcRenderer.invoke('ideas:cancelSession', id),
        generateMarketPreview: categories =>
            ipcRenderer.invoke('ideas:generateMarketPreview', categories),
        startResearch: sessionId => ipcRenderer.invoke('ideas:startResearch', sessionId),
        startGeneration: sessionId => ipcRenderer.invoke('ideas:startGeneration', sessionId),
        enrichIdea: ideaId => ipcRenderer.invoke('ideas:enrichIdea', ideaId),
        getIdea: id => ipcRenderer.invoke('ideas:getIdea', id),
        getIdeas: sessionId => ipcRenderer.invoke('ideas:getIdeas', sessionId),
        regenerateIdea: ideaId => ipcRenderer.invoke('ideas:regenerateIdea', ideaId),
        approveIdea: (ideaId, projectPath, selectedName) =>
            ipcRenderer.invoke('ideas:approveIdea', ideaId, projectPath, selectedName),
        rejectIdea: ideaId => ipcRenderer.invoke('ideas:rejectIdea', ideaId),
        canGenerateLogo: () => ipcRenderer.invoke('ideas:canGenerateLogo'),
        generateLogo: (ideaId, options) =>
            ipcRenderer.invoke('ideas:generateLogo', ideaId, options),
        queryResearch: (ideaId, question) =>
            ipcRenderer.invoke('ideas:queryResearch', ideaId, question),
        // Deep research handlers
        deepResearch: (topic: string, category: string) =>
            ipcRenderer.invoke('ideas:deepResearch', topic, category),
        validateIdea: (title: string, description: string, category: string) =>
            ipcRenderer.invoke('ideas:validateIdea', title, description, category),
        clearResearchCache: () => ipcRenderer.invoke('ideas:clearResearchCache'),
        // Scoring handlers
        scoreIdea: (ideaId: string) => ipcRenderer.invoke('ideas:scoreIdea', ideaId),
        rankIdeas: (ideaIds: string[]) => ipcRenderer.invoke('ideas:rankIdeas', ideaIds),
        compareIdeas: (ideaId1: string, ideaId2: string) =>
            ipcRenderer.invoke('ideas:compareIdeas', ideaId1, ideaId2),
        quickScore: (title: string, description: string, category: string) =>
            ipcRenderer.invoke('ideas:quickScore', title, description, category),
        // Data management handlers
        deleteIdea: (ideaId: string) => ipcRenderer.invoke('ideas:deleteIdea', ideaId),
        deleteSession: (sessionId: string) => ipcRenderer.invoke('ideas:deleteSession', sessionId),
        archiveIdea: (ideaId: string) => ipcRenderer.invoke('ideas:archiveIdea', ideaId),
        restoreIdea: (ideaId: string) => ipcRenderer.invoke('ideas:restoreIdea', ideaId),
        getArchivedIdeas: (sessionId?: string) =>
            ipcRenderer.invoke('ideas:getArchivedIdeas', sessionId),
        // Progress events
        onResearchProgress: callback => {
            const listener = (_event: IpcRendererEvent, progress: IpcValue) => callback(progress);
            ipcRenderer.on('ideas:research-progress', listener);
            return () => ipcRenderer.removeListener('ideas:research-progress', listener);
        },
        onIdeaProgress: callback => {
            const listener = (_event: IpcRendererEvent, progress: IpcValue) => callback(progress);
            ipcRenderer.on('ideas:idea-progress', listener);
            return () => ipcRenderer.removeListener('ideas:idea-progress', listener);
        },
        onDeepResearchProgress: callback => {
            const listener = (_event: IpcRendererEvent, progress: IpcValue) => callback(progress);
            return () => ipcRenderer.removeListener('ideas:deep-research-progress', listener);
        },
    },

    projectAgent: {
        start: options => ipcRenderer.invoke('project:start', options),
        generatePlan: options => ipcRenderer.invoke('project:plan', options),
        approvePlan: (plan, taskId) => ipcRenderer.invoke('project:approve', { plan, taskId }),
        stop: taskId => ipcRenderer.invoke('project:stop', { taskId }),
        pauseTask: taskId => ipcRenderer.invoke('project:pause-task', { taskId }),
        resumeTask: taskId => ipcRenderer.invoke('project:resume-task', { taskId }),
        saveSnapshot: taskId => ipcRenderer.invoke('project:save-snapshot', { taskId }),
        approveCurrentPlan: taskId => ipcRenderer.invoke('project:approve-current-plan', { taskId }),
        rejectCurrentPlan: (taskId, reason) =>
            ipcRenderer.invoke('project:reject-current-plan', { taskId, reason }),
        createPullRequest: taskId => ipcRenderer.invoke('project:create-pr', { taskId }),
        resetState: () => ipcRenderer.invoke('project:reset-state'),
        getStatus: taskId => ipcRenderer.invoke('project:get-status', { taskId }),
        getTaskMessages: taskId => ipcRenderer.invoke('project:get-messages', { taskId }),
        getTaskEvents: taskId => ipcRenderer.invoke('project:get-events', { taskId }),
        getTaskTelemetry: taskId => ipcRenderer.invoke('project:get-telemetry', { taskId }),
        getTaskHistory: projectId => ipcRenderer.invoke('project:get-task-history', { projectId }),
        deleteTask: taskId => ipcRenderer.invoke('project:delete-task', { taskId }),
        getAvailableModels: () => ipcRenderer.invoke('project:get-available-models'),
        retryStep: (index, taskId) => ipcRenderer.invoke('project:retry-step', { index, taskId }),
        selectModel: payload => ipcRenderer.invoke('project:select-model', payload),
        // AGT-HIL: Human-in-the-Loop step actions
        approveStep: (taskId: string, stepId: string) =>
            ipcRenderer.invoke('project:approve-step', { taskId, stepId }),
        skipStep: (taskId: string, stepId: string) =>
            ipcRenderer.invoke('project:skip-step', { taskId, stepId }),
        editStep: (taskId: string, stepId: string, text: string) =>
            ipcRenderer.invoke('project:edit-step', { taskId, stepId, text }),
        addStepComment: (taskId: string, stepId: string, comment: string) =>
            ipcRenderer.invoke('project:add-step-comment', { taskId, stepId, comment }),
        insertInterventionPoint: (taskId: string, afterStepId: string) =>
            ipcRenderer.invoke('project:insert-intervention', { taskId, afterStepId }),
        getCheckpoints: (taskId: string) => ipcRenderer.invoke('project:get-checkpoints', taskId),
        rollbackCheckpoint: (checkpointId: string) =>
            ipcRenderer.invoke('project:rollback-checkpoint', checkpointId),
        getPlanVersions: (taskId: string) =>
            ipcRenderer.invoke('project:get-plan-versions', taskId),
        deleteTaskByNodeId: (nodeId: string) =>
            ipcRenderer.invoke('project:delete-task-by-node', nodeId),
        getProfiles: () => ipcRenderer.invoke('project:get-profiles'),
        getRoutingRules: () => ipcRenderer.invoke('project:get-routing-rules'),
        setRoutingRules: rules => ipcRenderer.invoke('project:set-routing-rules', rules),
        createVotingSession: payload => ipcRenderer.invoke('project:create-voting-session', payload),
        submitVote: payload => ipcRenderer.invoke('project:submit-vote', payload),
        requestVotes: payload => ipcRenderer.invoke('project:request-votes', payload),
        resolveVoting: sessionId => ipcRenderer.invoke('project:resolve-voting', sessionId),
        getVotingSession: sessionId => ipcRenderer.invoke('project:get-voting-session', sessionId),
        listVotingSessions: taskId => ipcRenderer.invoke('project:list-voting-sessions', taskId),
        overrideVotingDecision: payload => ipcRenderer.invoke('project:override-voting', payload),
        getVotingAnalytics: taskId => ipcRenderer.invoke('project:get-voting-analytics', taskId),
        getVotingConfiguration: () => ipcRenderer.invoke('project:get-voting-config'),
        updateVotingConfiguration: patch => ipcRenderer.invoke('project:update-voting-config', patch),
        listVotingTemplates: () => ipcRenderer.invoke('project:list-voting-templates'),
        buildConsensus: outputs => ipcRenderer.invoke('project:build-consensus', outputs),
        createDebateSession: payload => ipcRenderer.invoke('project:create-debate-session', payload),
        submitDebateArgument: payload => ipcRenderer.invoke('project:submit-debate-argument', payload),
        resolveDebateSession: sessionId => ipcRenderer.invoke('project:resolve-debate-session', sessionId),
        overrideDebateSession: payload => ipcRenderer.invoke('project:override-debate-session', payload),
        getDebateSession: sessionId => ipcRenderer.invoke('project:get-debate-session', sessionId),
        listDebateHistory: taskId => ipcRenderer.invoke('project:list-debate-history', taskId),
        getDebateReplay: sessionId => ipcRenderer.invoke('project:get-debate-replay', sessionId),
        generateDebateSummary: sessionId => ipcRenderer.invoke('project:generate-debate-summary', sessionId),
        getTeamworkAnalytics: () => ipcRenderer.invoke('project:get-teamwork-analytics'),
        councilSendMessage: payload => ipcRenderer.invoke('project:council-send-message', payload),
        councilGetMessages: payload => ipcRenderer.invoke('project:council-get-messages', payload),
        councilCleanupExpiredMessages: taskId =>
            ipcRenderer.invoke('project:council-cleanup-expired-messages', { taskId }),
        councilHandleQuotaInterrupt: payload =>
            ipcRenderer.invoke('project:council-handle-quota-interrupt', payload),
        councilRegisterWorkerAvailability: payload =>
            ipcRenderer.invoke('project:council-register-worker-availability', payload),
        councilListAvailableWorkers: payload =>
            ipcRenderer.invoke('project:council-list-available-workers', payload),
        councilScoreHelperCandidates: payload =>
            ipcRenderer.invoke('project:council-score-helper-candidates', payload),
        councilGenerateHelperHandoff: payload =>
            ipcRenderer.invoke('project:council-generate-helper-handoff', payload),
        councilReviewHelperMerge: payload =>
            ipcRenderer.invoke('project:council-review-helper-merge', payload),
        // ===== MARCH1-IPC-001: Council Protocol =====
        council: {
            generatePlan: (taskId, task) => ipcRenderer.invoke('project:council-generate-plan', { taskId, task }),
            getProposal: taskId => ipcRenderer.invoke('project:council-get-proposal', { taskId }),
            approveProposal: taskId => ipcRenderer.invoke('project:council-approve-proposal', { taskId }),
            rejectProposal: (taskId, reason) => ipcRenderer.invoke('project:council-reject-proposal', { taskId, reason }),
            startExecution: taskId => ipcRenderer.invoke('project:council-start-execution', { taskId }),
            pauseExecution: taskId => ipcRenderer.invoke('project:council-pause-execution', { taskId }),
            resumeExecution: taskId => ipcRenderer.invoke('project:council-resume-execution', { taskId }),
            getTimeline: taskId => ipcRenderer.invoke('project:council-get-timeline', { taskId }),
        },
        // ============================================
        getTemplates: category => ipcRenderer.invoke('project:get-templates', category),
        getTemplate: id => ipcRenderer.invoke('project:get-template', id),
        saveTemplate: template => ipcRenderer.invoke('project:save-template', template),
        deleteTemplate: id => ipcRenderer.invoke('project:delete-template', id),
        exportTemplate: id => ipcRenderer.invoke('project:export-template', id),
        importTemplate: exported => ipcRenderer.invoke('project:import-template', exported),
        applyTemplate: payload => ipcRenderer.invoke('project:apply-template', payload),
        onUpdate: callback => {
            const listener = (_event: IpcRendererEvent, state: IpcValue) => {
                if (isProjectState(state)) {
                    callback(state);
                }
            };
            ipcRenderer.on('project:update', listener);
            return () => ipcRenderer.removeListener('project:update', listener);
        },
        onQuotaInterrupt: callback => {
            const listener = (_event: IpcRendererEvent, payload: unknown) => {
                if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
                    return;
                }
                const candidate = payload as Record<string, unknown>;
                if (
                    typeof candidate['success'] === 'boolean'
                    && typeof candidate['interruptId'] === 'string'
                    && typeof candidate['blockedByQuota'] === 'boolean'
                    && typeof candidate['switched'] === 'boolean'
                    && typeof candidate['message'] === 'string'
                    && Array.isArray(candidate['availableFallbacks'])
                ) {
                    callback({
                        success: candidate['success'],
                        interruptId: candidate['interruptId'],
                        checkpointId: typeof candidate['checkpointId'] === 'string'
                            ? candidate['checkpointId']
                            : undefined,
                        blockedByQuota: candidate['blockedByQuota'],
                        switched: candidate['switched'],
                        selectedFallback: (
                            typeof candidate['selectedFallback'] === 'object'
                            && candidate['selectedFallback'] !== null
                            && !Array.isArray(candidate['selectedFallback'])
                            && typeof (candidate['selectedFallback'] as Record<string, unknown>)['provider'] === 'string'
                            && typeof (candidate['selectedFallback'] as Record<string, unknown>)['model'] === 'string'
                        )
                            ? {
                                provider: (candidate['selectedFallback'] as Record<string, unknown>)['provider'] as string,
                                model: (candidate['selectedFallback'] as Record<string, unknown>)['model'] as string
                            }
                            : undefined,
                        availableFallbacks: (candidate['availableFallbacks'] as unknown[])
                            .map(item => {
                                if (
                                    typeof item === 'object'
                                    && item !== null
                                    && !Array.isArray(item)
                                    && typeof (item as Record<string, unknown>)['provider'] === 'string'
                                    && typeof (item as Record<string, unknown>)['model'] === 'string'
                                ) {
                                    return {
                                        provider: (item as Record<string, unknown>)['provider'] as string,
                                        model: (item as Record<string, unknown>)['model'] as string
                                    };
                                }
                                return null;
                            })
                            .filter((item): item is { provider: string; model: string } => item !== null),
                        message: candidate['message'],
                        v: candidate['v'] === 'v1' ? 'v1' : undefined,
                        dedupeKey: typeof candidate['dedupeKey'] === 'string'
                            ? candidate['dedupeKey']
                            : undefined,
                        emittedAt: typeof candidate['emittedAt'] === 'number'
                            ? candidate['emittedAt']
                            : undefined,
                    });
                }
            };
            ipcRenderer.on('project:quota-interrupt', listener);
            return () => ipcRenderer.removeListener('project:quota-interrupt', listener);
        },
        // Canvas persistence
        saveCanvasNodes: nodes => ipcRenderer.invoke('project:save-canvas-nodes', nodes),
        getCanvasNodes: () => ipcRenderer.invoke('project:get-canvas-nodes'),
        deleteCanvasNode: id => ipcRenderer.invoke('project:delete-canvas-node', id),
        saveCanvasEdges: edges => ipcRenderer.invoke('project:save-canvas-edges', edges),
        getCanvasEdges: () => ipcRenderer.invoke('project:get-canvas-edges'),
        deleteCanvasEdge: id => ipcRenderer.invoke('project:delete-canvas-edge', id),
        health: () => ipcRenderer.invoke('project:health'),
    },
    orchestrator: {
        start: (task: string, projectId?: string) =>
            ipcRenderer.invoke('orchestrator:start', task, projectId),
        approve: (plan: ProjectStep[]) => ipcRenderer.invoke('orchestrator:approve', plan),
        getState: () => ipcRenderer.invoke('orchestrator:get-state'),
        stop: () => ipcRenderer.invoke('orchestrator:stop'),
        onUpdate: callback => {
            const listener = (_event: IpcRendererEvent, state: IpcValue) => {
                if (typeof state === 'object' && state !== null && !Array.isArray(state)) {
                    const candidate = state as Record<string, IpcValue>;
                    const hasShape =
                        typeof candidate['status'] === 'string' &&
                        typeof candidate['currentTask'] === 'string' &&
                        Array.isArray(candidate['plan']) &&
                        Array.isArray(candidate['history']) &&
                        typeof candidate['assignments'] === 'object' &&
                        candidate['assignments'] !== null &&
                        !Array.isArray(candidate['assignments']);
                    if (hasShape) {
                        const nextState: OrchestratorState = {
                            status: candidate['status'] as OrchestratorState['status'],
                            currentTask: candidate['currentTask'] as string,
                            plan: normalizeOrchestratorPlan(candidate['plan']),
                            history: normalizeOrchestratorHistory(candidate['history']),
                            assignments: candidate['assignments'] as Record<string, string>,
                        };
                        callback(nextState);
                    }
                }
            };
            ipcRenderer.on('orchestrator:update', listener);
            return () => ipcRenderer.removeListener('orchestrator:update', listener);
        },
    },

    extension: {
        shouldShowWarning: () => ipcRenderer.invoke('extension:shouldShowWarning'),
        dismissWarning: () => ipcRenderer.invoke('extension:dismissWarning'),
        getStatus: () => ipcRenderer.invoke('extension:getStatus'),
        setInstalled: (installed: boolean) =>
            ipcRenderer.invoke('extension:setInstalled', installed),
        // Extension SDK APIs (MKT-DEV-01)
        getAll: () => ipcRenderer.invoke('extension:get-all'),
        get: (extensionId: string) => ipcRenderer.invoke('extension:get', extensionId),
        install: (extensionPath: string) => ipcRenderer.invoke('extension:install', extensionPath),
        uninstall: (extensionId: string) => ipcRenderer.invoke('extension:uninstall', extensionId),
        activate: (extensionId: string) => ipcRenderer.invoke('extension:activate', extensionId),
        deactivate: (extensionId: string) => ipcRenderer.invoke('extension:deactivate', extensionId),
        devStart: (options: unknown) => ipcRenderer.invoke('extension:dev-start', options),
        devStop: (extensionId: string) => ipcRenderer.invoke('extension:dev-stop', extensionId),
        devReload: (extensionId: string) => ipcRenderer.invoke('extension:dev-reload', extensionId),
        test: (options: unknown) => ipcRenderer.invoke('extension:test', options),
        publish: (options: unknown) => ipcRenderer.invoke('extension:publish', options),
        getProfile: (extensionId: string) => ipcRenderer.invoke('extension:get-profile', extensionId),
        validate: (manifest: unknown) => ipcRenderer.invoke('extension:validate', manifest),
    },
    sdCpp: {
        getStatus: () => ipcRenderer.invoke('sd-cpp:getStatus'),
        reinstall: () => ipcRenderer.invoke('sd-cpp:reinstall'),
        getHistory: limit => ipcRenderer.invoke('sd-cpp:getHistory', limit),
        regenerate: historyId => ipcRenderer.invoke('sd-cpp:regenerate', historyId),
        getAnalytics: () => ipcRenderer.invoke('sd-cpp:getAnalytics'),
        listPresets: () => ipcRenderer.invoke('sd-cpp:listPresets'),
        savePreset: preset => ipcRenderer.invoke('sd-cpp:savePreset', preset),
        deletePreset: id => ipcRenderer.invoke('sd-cpp:deletePreset', id),
        schedule: payload => ipcRenderer.invoke('sd-cpp:schedule', payload),
        listSchedules: () => ipcRenderer.invoke('sd-cpp:listSchedules'),
        cancelSchedule: id => ipcRenderer.invoke('sd-cpp:cancelSchedule', id),
        compare: ids => ipcRenderer.invoke('sd-cpp:compare', ids),
        batchGenerate: requests => ipcRenderer.invoke('sd-cpp:batchGenerate', requests),
        getQueueStats: () => ipcRenderer.invoke('sd-cpp:getQueueStats'),
        edit: options => ipcRenderer.invoke('sd-cpp:edit', options),
    },
    clipboard: {
        writeText: (text: string) => ipcRenderer.invoke('clipboard:writeText', text),
        readText: () => ipcRenderer.invoke('clipboard:readText'),
    },
    workflow: {
        getAll: () => ipcRenderer.invoke('workflow:getAll'),
        get: (id: string) => ipcRenderer.invoke('workflow:get', id),
        create: (workflow: Omit<import('@shared/types/workflow.types').Workflow, 'id' | 'createdAt' | 'updatedAt'>) =>
            ipcRenderer.invoke('workflow:create', workflow),
        update: (id: string, updates: Partial<import('@shared/types/workflow.types').Workflow>) =>
            ipcRenderer.invoke('workflow:update', id, updates),
        delete: (id: string) => ipcRenderer.invoke('workflow:delete', id),
        execute: (id: string, context?: Record<string, unknown>) =>
            ipcRenderer.invoke('workflow:execute', id, context),
        triggerManual: (triggerId: string, context?: Record<string, unknown>) =>
            ipcRenderer.invoke('workflow:triggerManual', triggerId, context),
    },
    modelDownloader: {
        start: request => ipcRenderer.invoke('model-downloader:start', request),
        pause: downloadId => ipcRenderer.invoke('model-downloader:pause', downloadId),
        resume: downloadId => ipcRenderer.invoke('model-downloader:resume', downloadId),
        cancel: downloadId => ipcRenderer.invoke('model-downloader:cancel', downloadId),
    },
};

contextBridge.exposeInMainWorld('electron', api);
