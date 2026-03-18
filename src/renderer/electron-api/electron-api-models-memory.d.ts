import type {
    EntityKnowledge,
    EpisodicMemory,
    IdeaProgress,
    IdeaSession,
    IdeaSessionConfig,
    IpcValue,
    ResearchData,
    ResearchProgress,
    SemanticFragment,
    Workspace,
    WorkspaceIdea,
} from '@/shared/types';
import type {
    AdvancedSemanticFragment,
    MemoryCategory,
    MemoryImportResult,
    MemorySearchAnalytics,
    MemorySearchHistoryEntry,
    MemoryStatistics,
    PendingMemory,
    RecallContext,
} from '@/shared/types/advanced-memory';

export interface ElectronApiModelsMemoryDomain {
    modelDownloader: {
        start: (request: Record<string, RendererDataValue>) => Promise<RendererDataValue>;
        pause: (downloadId: string) => Promise<RendererDataValue>;
        resume: (downloadId: string) => Promise<RendererDataValue>;
        cancel: (downloadId: string) => Promise<RendererDataValue>;
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
        getModels: () => Promise<{ name: string; path: string; size: number }[]>;
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
            bySource?: Record<string, number>;
            averageDurationMs?: number;
            editModeCounts?: Record<string, number>;
        }>;
        getPresetAnalytics: () => Promise<{
            totalPresets: number;
            providerCounts: Record<string, number>;
            customPresets: number;
        }>;
        getScheduleAnalytics: () => Promise<{
            total: number;
            byStatus: Record<string, number>;
            byPriority: Record<string, number>;
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
            provider?: 'antigravity' | 'ollama' | 'sd-webui' | 'comfyui' | 'sd-cpp';
        }) => Promise<RendererDataValue>;
        deletePreset: (id: string) => Promise<boolean>;
        exportPresetShare: (id: string) => Promise<string>;
        importPresetShare: (code: string) => Promise<RendererDataValue>;
        listWorkflowTemplates: () => Promise<Array<{
            id: string;
            name: string;
            description?: string;
            workflow: Record<string, RendererDataValue>;
            createdAt: number;
            updatedAt: number;
        }>>;
        saveWorkflowTemplate: (payload: {
            id?: string;
            name: string;
            description?: string;
            workflow: Record<string, RendererDataValue>;
        }) => Promise<RendererDataValue>;
        deleteWorkflowTemplate: (id: string) => Promise<boolean>;
        exportWorkflowTemplateShare: (id: string) => Promise<string>;
        importWorkflowTemplateShare: (code: string) => Promise<RendererDataValue>;
        schedule: (payload: {
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
        }) => Promise<RendererDataValue>;
        listSchedules: () => Promise<RendererDataValue[]>;
        cancelSchedule: (id: string) => Promise<boolean>;
        compare: (ids: string[]) => Promise<RendererDataValue>;
        exportComparison: (payload: { ids: string[]; format?: 'json' | 'csv' }) => Promise<string>;
        shareComparison: (ids: string[]) => Promise<string>;
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
        getQueueStats: () => Promise<{ queued: number; running: boolean; byPriority?: Record<string, number> }>;
        searchHistory: (query: string, limit?: number) => Promise<Array<{
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
        exportHistory: (format?: 'json' | 'csv') => Promise<string>;
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
    huggingface: {
        searchModels: (
            query: string,
            limit: number,
            page: number,
            sort: string
        ) => Promise<{
            models: {
                id: string;
                name: string;
                author: string;
                description: string;
                downloads: number;
                likes: number;
                tags: string[];
                lastModified: string;
            }[];
            total: number;
        }>;
        getRecommendations: (
            limit?: number,
            query?: string
        ) => Promise<Array<{
            id: string;
            name: string;
            author: string;
            description: string;
            downloads: number;
            likes: number;
            tags: string[];
            lastModified: string;
            category: string;
            recommendationScore: number;
        }>>;
        getFiles: (
            modelId: string
        ) => Promise<{ path: string; size: number; oid: string; quantization: string }[]>;
        getModelPreview: (modelId: string) => Promise<RendererDataValue>;
        compareModels: (modelIds: string[]) => Promise<RendererDataValue>;
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
        registerModelVersion: (modelId: string, filePath: string, notes?: string) => Promise<RendererDataValue>;
        compareModelVersions: (modelId: string, leftVersionId: string, rightVersionId: string) => Promise<RendererDataValue>;
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
        ) => Promise<RendererDataValue>;
        listFineTuneJobs: (modelId?: string) => Promise<RendererDataValue[]>;
        getFineTuneJob: (jobId: string) => Promise<RendererDataValue>;
        cancelFineTuneJob: (jobId: string) => Promise<{ success: boolean }>;
        evaluateFineTuneJob: (jobId: string) => Promise<RendererDataValue>;
        exportFineTunedModel: (jobId: string, exportPath: string) => Promise<{ success: boolean; error?: string }>;
        onFineTuneProgress: (callback: (job: RendererDataValue) => void) => () => void;
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

    // Ideas feature
    ideas: {
        createSession: (config: IdeaSessionConfig) => Promise<IdeaSession>;
        getSession: (id: string) => Promise<IdeaSession | null>;
        getSessions: () => Promise<IdeaSession[]>;
        cancelSession: (id: string) => Promise<{ success: boolean }>;
        generateMarketPreview: (categories: IdeaCategory[]) => Promise<{
            success: boolean;
            data?: Array<{
                category: IdeaCategory;
                summary: string;
                keyTrends: string[];
                marketSize: string;
                competition: string;
            }>;
        }>;
        startResearch: (sessionId: string) => Promise<{ success: boolean; data?: ResearchData }>;
        startGeneration: (sessionId: string) => Promise<{ success: boolean }>;
        enrichIdea: (ideaId: string) => Promise<{ success: boolean; data?: WorkspaceIdea }>;
        getIdea: (id: string) => Promise<WorkspaceIdea | null>;
        getIdeas: (sessionId?: string) => Promise<WorkspaceIdea[]>;
        regenerateIdea: (ideaId: string) => Promise<{ success: boolean; idea?: WorkspaceIdea }>;
        approveIdea: (
            ideaId: string,
            workspacePath: string,
            selectedName?: string
        ) => Promise<{ success: boolean; workspace?: Workspace }>;
        rejectIdea: (ideaId: string) => Promise<{ success: boolean }>;
        canGenerateLogo: () => Promise<boolean>;
        generateLogo: (
            ideaId: string,
            options: { prompt: string; style: string; model: string; count: number }
        ) => Promise<{ success: boolean; logoPaths?: string[] }>;
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
        getArchivedIdeas: (sessionId?: string) => Promise<WorkspaceIdea[]>;
        // Progress events
        onResearchProgress: (callback: (progress: ResearchProgress) => void) => () => void;
        onIdeaProgress: (callback: (progress: IdeaProgress) => void) => () => void;
        onDeepResearchProgress: (
            callback: (progress: { stage: string; progress: number }) => void
        ) => () => void;
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
            options?: { category?: MemoryCategory; tags?: string[]; workspaceId?: string }
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
        getSearchAnalytics: () => Promise<{
            success: boolean;
            data: MemorySearchAnalytics;
            error?: string;
        }>;
        getSearchHistory: (
            limit?: number
        ) => Promise<{ success: boolean; data: MemorySearchHistoryEntry[]; error?: string }>;
        getSearchSuggestions: (
            prefix?: string,
            limit?: number
        ) => Promise<{ success: boolean; data: string[]; error?: string }>;
        export: (query?: string, limit?: number) => Promise<{
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
            workspaceId?: string
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
                workspaceId?: string | null;
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
        shareWithWorkspace: (
            memoryId: string,
            targetWorkspaceId: string
        ) => Promise<{ success: boolean; data?: AdvancedSemanticFragment; error?: string }>;
        createSharedNamespace: (payload: {
            id: string;
            name: string;
            workspaceIds: string[];
            accessControl?: Record<string, string[]>;
        }) => Promise<{
            success: boolean;
            data?: import('@shared/types/advanced-memory').SharedMemoryNamespace;
            error?: string;
        }>;
        syncSharedNamespace: (
            request: import('@shared/types/advanced-memory').SharedMemorySyncRequest
        ) => Promise<{
            success: boolean;
            data?: import('@shared/types/advanced-memory').SharedMemorySyncResult;
            error?: string;
        }>;
        getSharedNamespaceAnalytics: (namespaceId: string) => Promise<{
            success: boolean;
            data?: import('@shared/types/advanced-memory').SharedMemoryAnalytics;
            error?: string;
        }>;
        searchAcrossWorkspaces: (payload: {
            namespaceId: string;
            query: string;
            workspaceId: string;
            limit?: number;
        }) => Promise<{ success: boolean; data: AdvancedSemanticFragment[]; error?: string }>;
        getHistory: (
            id: string
        ) => Promise<{ success: boolean; data: import('@shared/types/advanced-memory').MemoryVersion[]; error?: string }>;
        rollback: (
            id: string,
            versionIndex: number
        ) => Promise<{ success: boolean; data?: AdvancedSemanticFragment; error?: string }>;
        recategorize: (ids?: string[]) => Promise<{ success: boolean; error?: string }>;

        // Visualization
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

    // IPC Batching API
}
