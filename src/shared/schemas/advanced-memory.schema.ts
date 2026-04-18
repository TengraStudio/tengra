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
    MemorySource,
    MemoryStatus,
    normalizeMemoryCategory,
    normalizeMemoryCategoryCounts,
    SharedMemoryConflictResolution} from '../types/advanced-memory';

const CanonicalMemoryCategorySchema = z.enum(MEMORY_CATEGORY_VALUES);

export const MemoryCategorySchema = z.preprocess(
    value => typeof value === 'string' ? normalizeMemoryCategory(value) : value,
    CanonicalMemoryCategorySchema
);

export const MemoryStatusSchema = z.enum([
    'pending',
    'confirmed',
    'archived',
    'contradicted',
    'merged'
] as [MemoryStatus, ...MemoryStatus[]]);

export const MemorySourceSchema = z.enum([
    'user_explicit',
    'user_implicit',
    'system',
    'conversation',
    'tool_result'
] as [MemorySource, ...MemorySource[]]);

export const MemoryVersionSchema = z.object({
    versionIndex: z.number(),
    content: z.string(),
    category: MemoryCategorySchema,
    tags: z.array(z.string()),
    importance: z.number(),
    timestamp: z.number(),
    reason: z.string().optional(),
});

export const AdvancedSemanticFragmentSchema = z.object({
    id: z.string(),
    content: z.string(),
    embedding: z.array(z.number()),
    source: MemorySourceSchema,
    sourceId: z.string(),
    sourceContext: z.string().optional(),
    category: MemoryCategorySchema,
    tags: z.array(z.string()),
    confidence: z.number(),
    importance: z.number(),
    initialImportance: z.number(),
    status: MemoryStatusSchema,
    validatedAt: z.number().optional(),
    validatedBy: z.enum(['user', 'auto', 'system']).optional(),
    accessCount: z.number(),
    lastAccessedAt: z.number(),
    relatedMemoryIds: z.array(z.string()),
    contradictsIds: z.array(z.string()),
    mergedIntoId: z.string().optional(),
    workspaceId: z.string().optional(),
    contextTags: z.array(z.string()).optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
    expiresAt: z.number().optional(),
    history: z.array(MemoryVersionSchema).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
});

export const ContradictionCandidateSchema = z.object({
    existingMemoryId: z.string(),
    existingContent: z.string(),
    conflictType: z.enum(['direct', 'partial', 'temporal']),
    conflictExplanation: z.string(),
    suggestedResolution: z.enum(['keep_new', 'keep_old', 'keep_both', 'merge']),
});

export const SimilarMemoryCandidateSchema = z.object({
    memoryId: z.string(),
    content: z.string(),
    similarityScore: z.number(),
    canMerge: z.boolean(),
    mergeStrategy: z.enum(['append', 'replace', 'generalize']).optional(),
});

export const PendingMemorySchema = z.object({
    id: z.string(),
    content: z.string(),
    embedding: z.array(z.number()),
    source: MemorySourceSchema,
    sourceId: z.string(),
    sourceContext: z.string(),
    extractedAt: z.number(),
    suggestedCategory: MemoryCategorySchema,
    suggestedTags: z.array(z.string()),
    extractionConfidence: z.number(),
    relevanceScore: z.number(),
    noveltyScore: z.number(),
    requiresUserValidation: z.boolean(),
    autoConfirmReason: z.string().optional(),
    potentialContradictions: z.array(ContradictionCandidateSchema),
    similarMemories: z.array(SimilarMemoryCandidateSchema),
    workspaceId: z.string().optional(),
});

export const RecallContextSchema = z.object({
    query: z.string(),
    workspaceId: z.string().optional(),
    categories: z.array(MemoryCategorySchema).optional(),
    tags: z.array(z.string()).optional(),
    createdAfter: z.number().optional(),
    createdBefore: z.number().optional(),
    minConfidence: z.number().optional(),
    minImportance: z.number().optional(),
    includeArchived: z.boolean().optional(),
    includePending: z.boolean().optional(),
    limit: z.number().optional(),
    diversityFactor: z.number().optional(),
});

export const SharedMemorySyncRequestSchema = z.object({
    namespaceId: z.string(),
    sourceWorkspaceId: z.string(),
    targetWorkspaceIds: z.array(z.string()).optional(),
    memoryIds: z.array(z.string()).optional(),
    resolution: z.enum(['keep_source', 'keep_target', 'merge_copy', 'manual_review'] as [SharedMemoryConflictResolution, ...SharedMemoryConflictResolution[]]).optional(),
});

export const AdvancedMemoryResponseEnvelopeSchema = z.object({
    success: z.boolean(),
    data: z.unknown().optional(),
    error: z.string().optional(),
    errorCode: z.string().optional(),
    messageKey: z.string().optional(),
    retryable: z.boolean().optional(),
    uiState: z.union([z.enum(['ready', 'empty', 'failure']), z.string()]).optional(),
    fallbackUsed: z.boolean().optional(),
});

export const MemoryActionResponseSchema = AdvancedMemoryResponseEnvelopeSchema.extend({
    data: AdvancedSemanticFragmentSchema.optional(),
});

export const MemoryListResponseSchema = AdvancedMemoryResponseEnvelopeSchema.extend({
    data: z.array(AdvancedSemanticFragmentSchema),
});

export const PendingMemoryListResponseSchema = AdvancedMemoryResponseEnvelopeSchema.extend({
    data: z.array(PendingMemorySchema),
});

export const RecallResponseSchema = AdvancedMemoryResponseEnvelopeSchema.extend({
    data: z.object({
        memories: z.array(AdvancedSemanticFragmentSchema),
        totalMatches: z.number(),
    }),
});

export const ImportResultSchema = z.object({
    imported: z.number(),
    pendingImported: z.number(),
    skipped: z.number(),
    errors: z.array(z.string()),
});

export const ImportResponseSchema = AdvancedMemoryResponseEnvelopeSchema.extend({
    data: ImportResultSchema,
});

export const StatisticsSchema = z.object({
    total: z.number(),
    byStatus: z.record(z.string(), z.number()),
    byCategory: z.record(z.string(), z.number()).transform(normalizeMemoryCategoryCounts),
    bySource: z.record(z.string(), z.number()),
    averageConfidence: z.number(),
    averageImportance: z.number(),
    pendingValidation: z.number(),
    contradictions: z.number(),
    recentlyAccessed: z.number(),
    recentlyCreated: z.number(),
    totalEmbeddingSize: z.number(),
});

export const StatisticsResponseSchema = AdvancedMemoryResponseEnvelopeSchema.extend({
    data: StatisticsSchema,
});

