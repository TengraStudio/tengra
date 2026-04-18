/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { z } from 'zod';

import {
    MEMORY_CATEGORY_VALUES,
    normalizeMemoryCategory,
    normalizeMemoryCategoryCounts
} from '../types/advanced-memory';

export const ServiceHealthUiStateSchema = z.enum(['ready', 'empty', 'failure']);
export const ServiceHealthStatusSchema = z.enum(['healthy', 'degraded']);

const CanonicalAdvancedMemoryCategorySchema = z.enum(MEMORY_CATEGORY_VALUES);

export const AdvancedMemoryCategorySchema = z.preprocess(
    value => typeof value === 'string' ? normalizeMemoryCategory(value) : value,
    CanonicalAdvancedMemoryCategorySchema
);

export const AdvancedMemoryStatusSchema = z.enum([
    'pending',
    'confirmed',
    'archived',
    'contradicted',
    'merged'
]);

export const AdvancedMemorySourceSchema = z.enum([
    'user_explicit',
    'user_implicit',
    'system',
    'conversation',
    'tool_result'
]);

export const AdvancedMemoryRecallContextSchema = z.object({
    query: z.string().trim().max(5000),
    workspaceId: z.string().trim().max(200).optional(),
    categories: z.array(AdvancedMemoryCategorySchema).max(16).optional(),
    tags: z.array(z.string().trim()).max(32).optional(),
    createdAfter: z.number().finite().optional(),
    createdBefore: z.number().finite().optional(),
    minConfidence: z.number().finite().min(0).max(1).optional(),
    minImportance: z.number().finite().min(0).max(1).optional(),
    includeArchived: z.boolean().optional(),
    includePending: z.boolean().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    diversityFactor: z.number().finite().min(0).max(1).optional()
});

export const AdvancedSemanticFragmentSchema = z.object({
    id: z.string().uuid(),
    content: z.string().min(1).max(50000),
    embedding: z.array(z.number()).optional(),
    source: AdvancedMemorySourceSchema,
    sourceId: z.string().max(256),
    sourceContext: z.string().max(10000).optional(),
    category: AdvancedMemoryCategorySchema,
    tags: z.array(z.string().trim().max(100)).max(32),
    confidence: z.number().min(0).max(1),
    importance: z.number().min(0).max(1),
    initialImportance: z.number().min(0).max(1),
    status: AdvancedMemoryStatusSchema,
    validatedAt: z.number().optional(),
    validatedBy: z.enum(['user', 'auto', 'system']).optional(),
    accessCount: z.number().int().nonnegative(),
    lastAccessedAt: z.number(),
    relatedMemoryIds: z.array(z.string().uuid()).max(50),
    contradictsIds: z.array(z.string().uuid()).max(20),
    mergedIntoId: z.string().uuid().optional(),
    workspaceId: z.string().max(200).optional(),
    createdAt: z.number(),
    updatedAt: z.number()
});

export const PendingMemorySchema = z.object({
    id: z.string().uuid(),
    content: z.string().min(1).max(50000),
    embedding: z.array(z.number()).optional(),
    source: AdvancedMemorySourceSchema,
    sourceId: z.string().max(256),
    sourceContext: z.string().max(10000),
    extractedAt: z.number(),
    suggestedCategory: AdvancedMemoryCategorySchema,
    suggestedTags: z.array(z.string().trim().max(100)).max(32),
    extractionConfidence: z.number().min(0).max(1),
    relevanceScore: z.number().min(0).max(1),
    noveltyScore: z.number().min(0).max(1),
    requiresUserValidation: z.boolean(),
    workspaceId: z.string().max(200).optional()
});

export const RecallResultSchema = z.object({
    memories: z.array(AdvancedSemanticFragmentSchema),
    totalMatches: z.number().int().nonnegative()
});

export const AdvancedMemoryImportPayloadSchema = z.object({
    memories: z.array(z.record(z.string(), z.unknown())).max(2000).optional(),
    pendingMemories: z.array(z.record(z.string(), z.unknown())).max(2000).optional(),
    replaceExisting: z.boolean().optional()
});

export const MemoryImportResultSchema = z.object({
    imported: z.number().int().nonnegative(),
    pendingImported: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    errors: z.array(z.string()).max(100)
});

export const MemoryStatisticsSchema = z.object({
    total: z.number().int().nonnegative(),
    byStatus: z.record(AdvancedMemoryStatusSchema, z.number().int().nonnegative()),
    byCategory: z.record(z.string(), z.number().int().nonnegative()).transform(normalizeMemoryCategoryCounts),
    bySource: z.record(AdvancedMemorySourceSchema, z.number().int().nonnegative()),
    averageConfidence: z.number().min(0).max(1),
    averageImportance: z.number().min(0).max(1),
    pendingValidation: z.number().int().nonnegative(),
    contradictions: z.number().int().nonnegative(),
    recentlyAccessed: z.number().int().nonnegative(),
    recentlyCreated: z.number().int().nonnegative(),
    totalEmbeddingSize: z.number().int().nonnegative()
});

export const SharedMemoryNamespaceSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(200),
    workspaceIds: z.array(z.string()).max(100),
    accessControl: z.record(z.string(), z.array(z.string())).optional(),
    createdAt: z.number(),
    updatedAt: z.number()
});

export const SharedMemorySyncResultSchema = z.object({
    namespaceId: z.string().uuid(),
    synced: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    conflicts: z.array(z.any()), // Conflicts can be detailed later
    updatedAt: z.number()
});

export const AdvancedMemoryHealthSchema = z.object({
    status: ServiceHealthStatusSchema,
    uiState: ServiceHealthUiStateSchema,
    budgets: z.object({
        fastMs: z.number().int(),
        standardMs: z.number().int(),
        heavyMs: z.number().int()
    }),
    metrics: z.object({
        totalCalls: z.number().int(),
        totalFailures: z.number().int(),
        totalRetries: z.number().int(),
        validationFailures: z.number().int(),
        budgetExceededCount: z.number().int(),
        errorRate: z.number()
    }),
    memoryContext: z.object({
        cacheHits: z.number().int(),
        cacheMisses: z.number().int(),
        inflightReuseCount: z.number().int(),
        lookupCount: z.number().int(),
        lookupTimeoutCount: z.number().int(),
        lookupFailureCount: z.number().int(),
        lastLookupDurationMs: z.number(),
        averageLookupDurationMs: z.number(),
        cacheSize: z.number().int(),
        inflightSize: z.number().int()
    }).optional()
});

export const ContextRetrievalInputSchema = z.object({
    query: z.string().trim().max(5000),
    workspaceId: z.string().trim().max(200).optional(),
    limit: z.number().int().min(1).max(20).optional()
});

export const EmbeddingTextInputSchema = z.object({
    text: z.string().max(20000)
});

export const WorkspaceRootPathSchema = z.string().trim().min(1).max(4096);
export const WorkspaceActiveRootPathSchema = z.union([
    WorkspaceRootPathSchema,
    z.null(),
    z.undefined()
]).transform(val => val ?? null);
export const WorkspaceEnvKeySchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);
export const WorkspaceEnvVarsSchema = z.record(WorkspaceEnvKeySchema, z.string().max(20000));

/**
 * Agent Service Schemas
 */

export const AgentDefinitionSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(100),
    description: z.string().max(500),
    systemPrompt: z.string().min(1).max(50000),
    tools: z.array(z.string()).max(100),
    parentModel: z.string().max(100).optional(),
    color: z.string().max(50).optional()
});

export const AgentTemplateSchema = AgentDefinitionSchema.extend({
    category: z.string().max(50).optional()
});

export const AgentCreateOptionsSchema = z.object({
    cloneFromId: z.string().optional(),
    createWorkspace: z.boolean().optional()
});

export const AgentCreatePayloadSchema = z.object({
    agent: AgentDefinitionSchema.partial().optional(),
    options: AgentCreateOptionsSchema.optional()
});

export const AgentDeleteOptionsSchema = z.object({
    confirm: z.boolean().optional(),
    softDelete: z.boolean().optional(),
    backupBeforeDelete: z.boolean().optional()
});

export const AgentOperationResultSchema = z.object({
    success: z.boolean(),
    id: z.string().optional(),
    error: z.string().optional()
});

export const AgentCreateResultSchema = AgentOperationResultSchema.extend({
    workspacePath: z.string().optional()
});

export const AgentDeleteResultSchema = AgentOperationResultSchema.extend({
    archivedId: z.string().optional(),
    recoveryToken: z.string().optional()
});

export const AgentValidationResultSchema = z.object({
    valid: z.boolean(),
    errors: z.array(z.string()).max(100)
});

/**
 * Workspace Service Schemas
 */

export const WorkspaceStatsSchema = z.object({
    fileCount: z.number().int().nonnegative(),
    totalSize: z.number().int().nonnegative(),
    loc: z.number().int().nonnegative(),
    lastModified: z.number().int().nonnegative(),
    largestDirectories: z.array(z.object({
        path: z.string().max(4096),
        size: z.number().int().nonnegative(),
        fileCount: z.number().int().nonnegative(),
    })).max(20).optional(),
});

/**
 * Unique workspace identifier
 */
export const WorkspaceIdSchema = z.string().max(128).optional();

export const WorkspaceIssueSchema = z.object({
    severity: z.enum(['error', 'warning', 'info', 'hint']),
    message: z.string(),
    file: z.string(),
    line: z.number().int().nonnegative(),
    column: z.number().int().nonnegative().optional(),
    source: z.string(),
    code: z.union([z.string(), z.number().int()]).optional()
});

export const CodeAnnotationSchema = z.object({
    file: z.string(),
    line: z.number().int().positive(),
    message: z.string(),
    type: z.enum(['todo', 'fixme', 'warn', 'error'])
});

export const WorkspaceLspServerSupportSchema = z.object({
    languageId: z.string().max(100),
    serverId: z.string().max(200),
    status: z.enum(['running', 'available', 'unavailable']),
    bundled: z.boolean(),
    fileCount: z.number().int().nonnegative(),
});

export const WorkspaceAnalysisSchema = z.object({
    type: z.string().max(100),
    frameworks: z.array(z.string().max(100)).max(100),
    dependencies: z.record(z.string(), z.string()),
    devDependencies: z.record(z.string(), z.string()),
    stats: WorkspaceStatsSchema,
    languages: z.record(z.string(), z.number()).optional(),
    files: z.array(z.string().max(4096)).optional(),
    filesPage: z.object({
        offset: z.number().int().nonnegative(),
        limit: z.number().int().positive(),
        total: z.number().int().nonnegative(),
        hasMore: z.boolean()
    }).optional(),
    monorepo: z.object({
        type: z.enum(['npm', 'yarn', 'pnpm', 'lerna', 'turbo', 'rush', 'unknown']),
        packages: z.array(z.string().max(256)).max(1000)
    }).optional(),
    todos: z.array(z.string().max(500)).max(1000),
    issues: z.array(WorkspaceIssueSchema).max(1000).optional(),
    annotations: z.array(CodeAnnotationSchema).max(1000).optional(),
    lspDiagnostics: z.array(WorkspaceIssueSchema).max(5000).optional(),
    lspServers: z.array(WorkspaceLspServerSupportSchema).max(100).optional(),
});

export const WorkspaceFileDiagnosticsSchema = z.array(WorkspaceIssueSchema).max(2000);

export const WorkspaceDefinitionLocationSchema = z.object({
    file: z.string(),
    line: z.number().int().positive(),
    column: z.number().int().positive(),
});

export const WorkspaceDefinitionLocationsSchema = z.array(WorkspaceDefinitionLocationSchema).max(100);

/**
 * Results of a shallow directory analysis
 */
export const DirectoryAnalysisSchema = z.object({
    hasPackageJson: z.boolean(),
    pkg: z.record(z.string(), z.any()),
    readme: z.string().nullable(),
    stats: WorkspaceStatsSchema
});

/**
 * Options passed to the logo generation service
 */
export const GenerateLogoOptionsSchema = z.object({
    prompt: z.string().max(2000),
    style: z.string().max(100),
    model: z.string().max(256),
    count: z.number().int().positive().max(10)
});

export const WorkspaceIdentitySchema = z.object({
    suggestedPrompts: z.array(z.string().max(1000)).max(50),
    colors: z.array(z.string().max(64)).max(20)
});

export const WorkspaceActiveStateSchema = z.object({
    rootPath: WorkspaceActiveRootPathSchema,
});
