import type { IpcContractVersionInfo } from '@shared/constants/ipc-contract';
import type {
    InlineSuggestionRequest,
    InlineSuggestionResponse,
    InlineSuggestionTelemetry,
} from '@shared/schemas/inline-suggestions.schema';
import type { IpcRendererEvent } from 'electron';

import {
    AgentDefinition,
    AppSettings,
    Chat,
    ClaudeQuota,
    CopilotQuota,
    EntityKnowledge,
    EpisodicMemory,
    FileSearchResult,
    Folder,
    IpcValue,
    Message,
    QuotaResponse,
    SemanticFragment,
    ServiceResponse,
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
    TodoFile,
    ToolDefinition,
    ToolResult,
    Workspace,
    WorkspaceAnalysis,
} from '@/shared/types';
import {
    AdvancedSemanticFragment,
    MemoryCategory,
    MemoryImportResult,
    MemorySearchAnalytics,
    MemorySearchHistoryEntry,
    MemoryStatistics,
    PendingMemory,
    RecallContext,
} from '@/shared/types/advanced-memory';
import type { MarketplaceSkill } from '@/shared/types/marketplace';
import type { RuntimeBootstrapExecutionResult } from '@/shared/types/runtime-manifest';
import type { ProxySkill, ProxySkillUpsertInput } from '@/shared/types/skill';
import {
    VoiceCommand,
    VoiceInfo,
    VoiceRecognitionResult,
    VoiceSettings,
    VoiceSynthesisOptions,
} from '@/shared/types/voice';

export interface FileEntry {
    name: string;
    isDirectory: boolean;
    size: number;
    mtime: number;
    path: string;
}

export interface ProcessInfo {
    pid: number;
    name?: string;
    cmd?: string;
    command?: string;
    cpu?: number;
    memory?: number;
    id?: string;
    cwd?: string;
    status?: string;
    startTime?: number;
}

export interface ModelDefinition {
    id: string;
    name: string;
    provider: string;
    providerCategory?: string;
    sourceProvider?: string;
    quotaInfo?: {
        remainingQuota?: number;
        totalQuota?: number;
        resetTime?: string;
        remainingFraction?: number;
    };
    percentage?: number;
    reset?: string;
    capabilities?: {
        image_generation?: boolean;
        text_generation?: boolean;
        embedding?: boolean;
    };
    [key: string]: IpcValue | undefined;
}

/**
 * Linked account info returned from auth service.
 */
export interface LinkedAccountInfo {
    id: string;
    provider: string;
    email?: string;
    displayName?: string;
    avatarUrl?: string;
    isActive: boolean;
    createdAt: number;
}

/**
 * Token data for linking accounts.
 */
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

/**
 * Main Electron API interface exposed to the renderer process.
 * Provides access to all IPC handlers and window controls.
 *
 * @example
 * ```typescript
 * // Get settings
 * const settings = await window.electron.getSettings()
 *
 * // Send a chat message
 * await window.electron.session.conversation.stream({ messages, model, tools, provider, options, chatId })
 * ```
 */
import type { ElectronApiIntegrationsDomain } from '@renderer/electron-api/electron-api-integrations';
import type { ElectronApiModelsMemoryDomain } from '@renderer/electron-api/electron-api-models-memory';
import type { ElectronApiWorkspaceSystemDomain } from '@renderer/electron-api/electron-api-workspace-system';


export interface ElectronAPI {
    invoke: <T = IpcValue>(channel: string, ...args: IpcValue[]) => Promise<T>;
    /**
     * Minimizes the application window.
     */
    minimize: () => void;

    /**
     * Maximizes or restores the application window.
     */
    maximize: () => void;

    /**
     * Closes the application window.
     */
    close: () => void;

    getZoomFactor: () => Promise<{ zoomFactor: number }>;
    getSettings: () => Promise<AppSettings | ServiceResponse<AppSettings>>;
    saveSettings: (settings: AppSettings) => Promise<AppSettings | ServiceResponse<AppSettings>>;

    /**
     * Resizes the window to a specific resolution.
     * @param resolution - Resolution string in format "WIDTHxHEIGHT" (e.g., "1920x1080")
     */
    resizeWindow: (resolution: string) => void;
    resetZoomFactor: () => Promise<{ zoomFactor: number }>;
    setZoomFactor: (zoomFactor: number) => Promise<{ zoomFactor: number }>;
    stepZoomFactor: (direction: -1 | 1) => Promise<{ zoomFactor: number }>;

    /**
     * Toggles compact mode for the window.
     * @param enabled - Whether to enable compact mode
     */
    toggleCompact: (enabled: boolean) => void;

    /**
     * Initiates GitHub OAuth login flow.
     * @param appId - Optional app identifier ('profile' or 'copilot')
     * @returns Promise resolving to OAuth device code information
     */
    githubLogin: (appId?: 'profile' | 'copilot') => Promise<{
        device_code: string;
        user_code: string;
        verification_uri: string;
        expires_in: number;
        interval: number;
    }>;

    /**
     * Polls for GitHub OAuth token after device code authentication.
     * @param deviceCode - Device code received from githubLogin
     * @param interval - Polling interval in seconds
     * @param appId - Optional app identifier ('profile' or 'copilot')
     * @returns Promise resolving to authentication result
     */
    pollToken: (
        deviceCode: string,
        interval: number,
        appId?: 'profile' | 'copilot'
    ) => Promise<{
        success: boolean;
        account?: LinkedAccountInfo;
        error?: string;
    }>;

    /**
     * Initiates Antigravity OAuth login flow.
     * @returns Promise resolving to OAuth URL and state
     */
    antigravityLogin: (accountId?: string) => Promise<{ url: string; state: string; accountId: string }>;
    claudeLogin: (accountId?: string) => Promise<{ url: string; state: string; accountId: string }>;
    claudeBrowserLogin: () => Promise<{ sessionKey?: string; status?: string; error?: string }>;
    anthropicLogin: (accountId?: string) => Promise<{ url: string; state: string; accountId: string }>;
    codexLogin: (accountId?: string) => Promise<{ url: string; state: string; accountId: string }>;
    cancelAuth: (provider: 'antigravity' | 'claude' | 'codex', state: string, accountId: string) => Promise<boolean>;
    getBrowserAuthStatus: (provider: string, state: string, accountId: string) => Promise<{
        status: string;
        error?: string;
        provider?: string;
        state?: string;
        accountId?: string;
        account_id?: string;
        account?: Record<string, IpcValue>;
    }>;
    verifyAuthBridge: (provider?: 'antigravity' | 'claude' | 'codex') => Promise<{
        status: string;
        provider: string;
        readiness?: IpcValue;
        callback?: IpcValue;
        error?: string;
    }>;

    saveClaudeSession: (
        sessionKey: string,
        accountId?: string
    ) => Promise<{ success: boolean; error?: string }>;
    triggerClaudeSessionCapture: () => Promise<{ success: boolean; error?: string }>;

    // --- Linked Accounts (New Multi-Account API) ---

    /**
     * Get all linked accounts, optionally filtered by provider.
     */
    getLinkedAccounts: (provider?: string) => Promise<LinkedAccountInfo[]>;

    /**
     * Get the active linked account for a provider.
     */
    getActiveLinkedAccount: (provider: string) => Promise<LinkedAccountInfo | null>;

    /**
     * Set which account should be active for a provider.
     */
    setActiveLinkedAccount: (
        provider: string,
        accountId: string
    ) => Promise<{ success: boolean; error?: string }>;

    /**
     * Link a new account for a provider.
     */
    linkAccount: (
        provider: string,
        tokenData: TokenData
    ) => Promise<{ success: boolean; account?: LinkedAccountInfo; error?: string }>;

    /**
     * Unlink (remove) a specific account.
     */
    unlinkAccount: (accountId: string) => Promise<{ success: boolean; error?: string }>;

    /**
     * Unlink all accounts for a provider.
     */
    unlinkProvider: (provider: string) => Promise<{ success: boolean; error?: string }>;

    /**
     * Check if a provider has any linked accounts.
     */
    hasLinkedAccount: (provider: string) => Promise<boolean>;

    /**
     * Get all linked accounts for a provider (alias for getLinkedAccounts).
     */
    getAccountsByProvider: (provider: string) => Promise<LinkedAccountInfo[]>;
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
    startAuthSession: (
        provider: string,
        accountId?: string,
        source?: string
    ) => Promise<{ sessionId: string }>;
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

    code: ElectronApiWorkspaceSystemDomain['code'];
    workspace: ElectronApiWorkspaceSystemDomain['workspace'];
    process: ElectronApiWorkspaceSystemDomain['process'];
    files: ElectronApiWorkspaceSystemDomain['files'];
    getProxyModels: () => Promise<{ id: string; object: string }[]>;
    getQuota: (provider?: string) => Promise<{
        accounts: Array<QuotaResponse & { accountId?: string; email?: string }>;
    } | null>;
    getCopilotQuota: () => Promise<{
        accounts: Array<CopilotQuota & { accountId?: string; email?: string }>;
    }>;
    getCodexUsage: () => Promise<{
        accounts: Array<{ usage: CodexUsage; accountId?: string; email?: string }>;
    }>;
    getClaudeQuota: () => Promise<{ accounts: Array<ClaudeQuota> }>;
    checkUsageLimit: (
        provider: string,
        model: string
    ) => Promise<{ allowed: boolean; reason?: string }>;
    getUsageCount: (
        period: 'hourly' | 'daily' | 'weekly',
        provider?: string,
        model?: string
    ) => Promise<number>;
    listSkills: () => Promise<ProxySkill[]>;
    saveSkill: (input: ProxySkillUpsertInput) => Promise<ProxySkill>;
    toggleSkill: (skillId: string, enabled: boolean) => Promise<ProxySkill>;
    deleteSkill: (skillId: string) => Promise<boolean>;
    listMarketplaceSkills: () => Promise<MarketplaceSkill[]>;
    installMarketplaceSkill: (skillId: string) => Promise<ProxySkill>;
    performance: ElectronApiWorkspaceSystemDomain['performance'];
    runCommand: (
        command: string,
        args: string[],
        cwd?: string
    ) => Promise<{ stdout: string; stderr: string; code: number }>;
    git: ElectronApiWorkspaceSystemDomain['git'];
    getModels: () => Promise<ModelDefinition[] | { antigravityError?: string }>;

    // Ollama management
    isOllamaRunning: () => Promise<boolean>;
    startOllama: () => Promise<{
      success: boolean;
      message: string;
      messageKey?: string;
      messageParams?: Record<string, string | number>;
    }>;
    pullModel: (modelName: string) => Promise<{ success: boolean; error?: string }>;
    deleteOllamaModel: (modelName: string) => Promise<{ success: boolean; error?: string }>;
    getLibraryModels: () => Promise<{ name: string; description: string; tags: string[] }[]>;
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

    // Health and GPU checks

    saveClaudeSession: (
        sessionKey: string,
        accountId?: string
    ) => Promise<{ success: boolean; error?: string }>;
    triggerClaudeSessionCapture: () => Promise<{ success: boolean; error?: string }>;

    // --- Linked Accounts (New Multi-Account API) ---

    /**
     * Get all linked accounts, optionally filtered by provider.
     */
    getLinkedAccounts: (provider?: string) => Promise<LinkedAccountInfo[]>;

    /**
     * Get the active linked account for a provider.
     */
    getActiveLinkedAccount: (provider: string) => Promise<LinkedAccountInfo | null>;

    /**
     * Set which account should be active for a provider.
     */
    setActiveLinkedAccount: (
        provider: string,
        accountId: string
    ) => Promise<{ success: boolean; error?: string }>;

    /**
     * Link a new account for a provider.
     */
    linkAccount: (
        provider: string,
        tokenData: TokenData
    ) => Promise<{ success: boolean; account?: LinkedAccountInfo; error?: string }>;

    /**
     * Unlink (remove) a specific account.
     */
    unlinkAccount: (accountId: string) => Promise<{ success: boolean; error?: string }>;

    /**
     * Unlink all accounts for a provider.
     */
    unlinkProvider: (provider: string) => Promise<{ success: boolean; error?: string }>;

    /**
     * Check if a provider has any linked accounts.
     */
    hasLinkedAccount: (provider: string) => Promise<boolean>;

    /**
     * Get all linked accounts for a provider (alias for getLinkedAccounts).
     */
    getAccountsByProvider: (provider: string) => Promise<LinkedAccountInfo[]>;
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
    startAuthSession: (
        provider: string,
        accountId?: string,
        source?: string
    ) => Promise<{ sessionId: string }>;
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

    code: ElectronApiWorkspaceSystemDomain['code'];
    workspace: ElectronApiWorkspaceSystemDomain['workspace'];
    process: ElectronApiWorkspaceSystemDomain['process'];
    files: ElectronApiWorkspaceSystemDomain['files'];
    getProxyModels: () => Promise<{ id: string; object: string }[]>;
    getQuota: (provider?: string) => Promise<{
        accounts: Array<QuotaResponse & { accountId?: string; email?: string }>;
    } | null>;
    getCopilotQuota: () => Promise<{
        accounts: Array<CopilotQuota & { accountId?: string; email?: string }>;
    }>;
    getCodexUsage: () => Promise<{
        accounts: Array<{ usage: CodexUsage; accountId?: string; email?: string }>;
    }>;
    getClaudeQuota: () => Promise<{ accounts: Array<ClaudeQuota> }>;
    checkUsageLimit: (
        provider: string,
        model: string
    ) => Promise<{ allowed: boolean; reason?: string }>;
    getUsageCount: (
        period: 'hourly' | 'daily' | 'weekly',
        provider?: string,
        model?: string
    ) => Promise<number>;
    listSkills: () => Promise<ProxySkill[]>;
    saveSkill: (input: ProxySkillUpsertInput) => Promise<ProxySkill>;
    toggleSkill: (skillId: string, enabled: boolean) => Promise<ProxySkill>;
    deleteSkill: (skillId: string) => Promise<boolean>;
    listMarketplaceSkills: () => Promise<MarketplaceSkill[]>;
    installMarketplaceSkill: (skillId: string) => Promise<ProxySkill>;
    performance: ElectronApiWorkspaceSystemDomain['performance'];
    runCommand: (
        command: string,
        args: string[],
        cwd?: string
    ) => Promise<{ stdout: string; stderr: string; code: number }>;
    git: ElectronApiWorkspaceSystemDomain['git'];
    getModels: () => Promise<ModelDefinition[] | { antigravityError?: string }>;

    // Ollama management
    isOllamaRunning: () => Promise<boolean>;
    startOllama: () => Promise<{
      success: boolean;
      message: string;
      messageKey?: string;
      messageParams?: Record<string, string | number>;
    }>;
    pullModel: (modelName: string) => Promise<{ success: boolean; error?: string }>;
    deleteOllamaModel: (modelName: string) => Promise<{ success: boolean; error?: string }>;
    getLibraryModels: () => Promise<{ name: string; description: string; tags: string[] }[]>;
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

    // Health and GPU checks
    getOllamaHealthStatus: () => Promise<{ status: 'ok' | 'error' }>;
    forceOllamaHealthCheck: () => Promise<{ status: 'ok' | 'error' }>;
    checkCuda: () => Promise<{ hasCuda: boolean; detail?: string }>;
    onOllamaStatusChange: (callback: (status: { status: string }) => void) => void;
    onAgentEvent: (callback: (payload: IpcValue) => void) => () => void;
    onSdCppStatus: (callback: (data: IpcValue) => void) => () => void;
    onSdCppProgress: (callback: (data: IpcValue) => void) => () => void;
    modelDownloader: ElectronApiModelsMemoryDomain['modelDownloader'];
    llama: ElectronApiModelsMemoryDomain['llama'];
    sdCpp: ElectronApiModelsMemoryDomain['sdCpp'];
    clipboard: ElectronApiWorkspaceSystemDomain['clipboard'];
    db: ElectronApiIntegrationsDomain['db'];
    terminal: ElectronApiIntegrationsDomain['terminal'];
    agent: ElectronApiIntegrationsDomain['agent'];
    modelRegistry: ElectronApiIntegrationsDomain['modelRegistry'];
    session: ElectronApiIntegrationsDomain['session'];
    ssh: ElectronApiIntegrationsDomain['ssh'];
    executeTools: (
        toolName: string,
        args: Record<string, IpcValue>,
        toolCallId?: string,
        workspaceAgentSessionId?: string
    ) => Promise<ToolResult>;
    killTool: (toolCallId: string) => Promise<boolean>;
    getToolDefinitions: () => Promise<ToolDefinition[]>;

    // MCP
    mcp: ElectronApiIntegrationsDomain['mcp'];
    marketplace: ElectronApiIntegrationsDomain['marketplace'];
    locale: ElectronApiIntegrationsDomain['locale'];
    proxyEmbed: ElectronApiIntegrationsDomain['proxyEmbed'];
    captureScreenshot: () => Promise<{ success: boolean; image?: string; error?: string }>;

    // Shell / External
    openExternal: (url: string) => void;
    captureCookies: (url: string, timeoutMs?: number) => Promise<{ success: boolean }>;
    openTerminal: (command: string) => Promise<boolean>;

    // Files
    readPdf: (path: string) => Promise<{ success: boolean; text?: string; error?: string }>;
    selectDirectory: () => Promise<{ success: boolean; path?: string }>;
    listDirectory: (
        path: string
    ) => Promise<{ success: boolean; files?: FileEntry[]; error?: string }>;
    readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>;
    writeFile: (
        path: string,
        content: string,
        context?: { aiSystem?: string; chatSessionId?: string; changeReason?: string }
    ) => Promise<{ success: boolean; error?: string }>;


    createDirectory: (path: string) => Promise<{ success: boolean; error?: string }>;
    deleteFile: (path: string) => Promise<{ success: boolean; error?: string }>;
    deleteDirectory: (path: string) => Promise<{ success: boolean; error?: string }>;
    copyPath: (
        sourcePath: string,
        destinationPath: string
    ) => Promise<{ success: boolean; error?: string }>;
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

    huggingface: ElectronApiModelsMemoryDomain['huggingface'];
    log: ElectronApiIntegrationsDomain['log'];
    gallery: ElectronApiModelsMemoryDomain['gallery'];
    getUserDataPath: () => Promise<string>;

    update: ElectronApiIntegrationsDomain['update'];
    collaboration: ElectronApiIntegrationsDomain['collaboration'];
    modelCollaboration: ElectronApiIntegrationsDomain['modelCollaboration'];
    audit: ElectronApiIntegrationsDomain['audit'];
    memory: ElectronApiModelsMemoryDomain['memory'];
    advancedMemory: ElectronApiModelsMemoryDomain['advancedMemory'];
    batch: ElectronApiIntegrationsDomain['batch'];
    lazyServices: ElectronApiIntegrationsDomain['lazyServices'];
    ipcContract: ElectronApiIntegrationsDomain['ipcContract'];
    ipcRenderer: ElectronApiIntegrationsDomain['ipcRenderer'];
    on: (
        channel: string,
        listener: (event: IpcRendererEvent, ...args: IpcValue[]) => void
    ) => () => void;

    metrics: ElectronApiIntegrationsDomain['metrics'];
    usage: ElectronApiIntegrationsDomain['usage'];
    voice: ElectronApiIntegrationsDomain['voice'];
    extension: ElectronApiIntegrationsDomain['extension'];
    codeSandbox: ElectronApiIntegrationsDomain['codeSandbox'];
    promptTemplates: ElectronApiIntegrationsDomain['promptTemplates'];
    sharedPrompts: ElectronApiIntegrationsDomain['sharedPrompts'];
    runtime: {
        getStatus: () => Promise<RuntimeBootstrapExecutionResult | null>;
        refreshStatus: () => Promise<RuntimeBootstrapExecutionResult | null>;
        repair: (manifestUrl?: string) => Promise<RuntimeBootstrapExecutionResult | null>;
        runComponentAction: (componentId: string) => Promise<{ success: boolean; message: string }>;
    };
    userCollaboration: ElectronApiIntegrationsDomain['userCollaboration'];
    liveCollaboration: ElectronApiIntegrationsDomain['liveCollaboration'];
}

declare global {
    interface Window {
        electron: ElectronAPI;
        TengraSpeak: (text: string) => void;
    }
}
