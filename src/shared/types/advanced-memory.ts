/**
 * Advanced Memory System Types
 *
 * A sophisticated memory architecture that surpasses ChatGPT/Claude memory by implementing:
 * - Staging buffer with validation gate
 * - Confidence scoring and importance calculation
 * - Memory decay and access tracking
 * - Contradiction detection and resolution
 * - Memory consolidation (merge similar facts)
 * - Context-aware recall
 * - Hierarchical knowledge graph relationships
 */

import { normalizeWorkspaceCompatCategory } from '@shared/constants';

import { JsonValue } from './common';

// ============================================================================
// MEMORY VERSIONING
// ============================================================================

export interface MemoryVersion {
    versionIndex: number;
    content: string;
    category: MemoryCategory;
    tags: string[];
    importance: number;
    timestamp: number;
    reason?: string;
}


// ============================================================================
// MEMORY STATUS & LIFECYCLE
// ============================================================================

/** Memory lifecycle states */
export type MemoryStatus =
    | 'pending'      // In staging buffer, awaiting validation
    | 'confirmed'    // User-confirmed or high-confidence auto-confirmed
    | 'archived'     // Low importance, kept but rarely surfaced
    | 'contradicted' // Superseded by newer information
    | 'merged';      // Consolidated into another memory

/** How the memory was created */
export type MemorySource =
    | 'user_explicit'    // User directly said "remember this"
    | 'user_implicit'    // Inferred from user message
    | 'system'           // System-generated (summaries, etc.)
    | 'conversation'     // Extracted from conversation context
    | 'tool_result';     // Learned from tool execution

/** Memory category for organization */
export const MEMORY_CATEGORY_VALUES = [
    'preference',
    'personal',
    'workspace',
    'technical',
    'workflow',
    'relationship',
    'fact',
    'instruction'
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORY_VALUES)[number];

const MEMORY_CATEGORY_SET = new Set<string>(MEMORY_CATEGORY_VALUES);

export function normalizeMemoryCategory(value?: string | null): MemoryCategory | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    const normalizedValue = value.trim().toLowerCase();
    if (!normalizedValue) {
        return undefined;
    }

    const legacyCategory = normalizeWorkspaceCompatCategory(normalizedValue);
    if (legacyCategory) {
        return legacyCategory;
    }

    return MEMORY_CATEGORY_SET.has(normalizedValue)
        ? normalizedValue as MemoryCategory
        : undefined;
}

export function coerceMemoryCategory(
    value?: string | null,
    fallback: MemoryCategory = 'fact'
): MemoryCategory {
    return normalizeMemoryCategory(value) ?? fallback;
}

export function createEmptyMemoryCategoryCounts(): Record<MemoryCategory, number> {
    return {
        preference: 0,
        personal: 0,
        workspace: 0,
        technical: 0,
        workflow: 0,
        relationship: 0,
        fact: 0,
        instruction: 0
    };
}

export function normalizeMemoryCategoryCounts(
    counts: Partial<Record<string, number>>
): Record<MemoryCategory, number> {
    const normalizedCounts = createEmptyMemoryCategoryCounts();

    for (const [rawCategory, value] of Object.entries(counts)) {
        const category = normalizeMemoryCategory(rawCategory);
        if (!category || typeof value !== 'number' || !Number.isFinite(value)) {
            continue;
        }

        normalizedCounts[category] += value;
    }

    return normalizedCounts;
}

// ============================================================================
// ADVANCED SEMANTIC FRAGMENT (Enhanced Facts)
// ============================================================================

export interface AdvancedSemanticFragment {
    id: string;
    content: string;
    embedding: number[];

    // Source tracking
    source: MemorySource;
    sourceId: string;           // Chat ID, message ID, etc.
    sourceContext?: string;     // Original context where learned

    // Classification
    category: MemoryCategory;
    tags: string[];

    // Confidence & Importance
    confidence: number;         // 0.0-1.0 - How sure are we this is accurate?
    importance: number;         // 0.0-1.0 - How important is this?
    initialImportance: number;  // Original importance before decay

    // Status & Lifecycle
    status: MemoryStatus;
    validatedAt?: number;       // When user confirmed (if applicable)
    validatedBy?: 'user' | 'auto' | 'system';

    // Access tracking (for importance boosting)
    accessCount: number;
    lastAccessedAt: number;

    // Relationships
    relatedMemoryIds: string[]; // Links to related memories
    contradictsIds: string[];   // IDs of memories this contradicts
    mergedIntoId?: string;      // If merged, which memory it became

    // Scope
    workspaceId?: string;
    contextTags?: string[];// Additional context for retrieval

    // Timestamps
    createdAt: number;
    updatedAt: number;
    expiresAt?: number;         // Optional TTL

    // Versioning
    history?: MemoryVersion[];

    // Extensibility
    metadata?: Record<string, JsonValue>;
}

// ============================================================================
// STAGING BUFFER
// ============================================================================

/** Memory in the staging buffer awaiting validation */
export interface PendingMemory {
    id: string;
    content: string;
    embedding: number[];

    // Extraction info
    source: MemorySource;
    sourceId: string;
    sourceContext: string;      // The message/context it was extracted from
    extractedAt: number;

    // Auto-classification
    suggestedCategory: MemoryCategory;
    suggestedTags: string[];

    // Confidence scoring
    extractionConfidence: number;   // How confident the extraction was
    relevanceScore: number;         // How relevant/useful is this?
    noveltyScore: number;           // Is this new info or repetition?

    // Validation
    requiresUserValidation: boolean;
    autoConfirmReason?: string;     // Why it was auto-confirmed (if applicable)

    // Contradiction check
    potentialContradictions: ContradictionCandidate[];

    // Similar existing memories (for consolidation)
    similarMemories: SimilarMemoryCandidate[];

    // Scope
    workspaceId?: string;
}

/** A candidate contradiction found during validation */
export interface ContradictionCandidate {
    existingMemoryId: string;
    existingContent: string;
    conflictType: 'direct' | 'partial' | 'temporal';  // Direct opposite, partial conflict, or outdated
    conflictExplanation: string;
    suggestedResolution: 'keep_new' | 'keep_old' | 'keep_both' | 'merge';
}

/** A similar existing memory found during validation */
export interface SimilarMemoryCandidate {
    memoryId: string;
    content: string;
    similarityScore: number;
    canMerge: boolean;
    mergeStrategy?: 'append' | 'replace' | 'generalize';
}

// ============================================================================
// MEMORY VALIDATION RESULT
// ============================================================================

export interface MemoryValidationResult {
    shouldStore: boolean;
    reason: string;

    // Adjusted values
    adjustedConfidence: number;
    adjustedImportance: number;
    adjustedCategory?: MemoryCategory;
    adjustedTags?: string[];

    // Actions to take
    contradictionsToResolve: Array<{
        existingId: string;
        action: 'archive' | 'delete' | 'update';
    }>;
    memoriesToMerge: Array<{
        existingId: string;
        mergedContent: string;
    }>;
}

// ============================================================================
// MEMORY DECAY & SCORING
// ============================================================================

export interface MemoryScoreFactors {
    baseImportance: number;     // Original importance
    recencyBoost: number;       // Boost for recent memories
    accessBoost: number;        // Boost for frequently accessed
    relevanceScore: number;     // Contextual relevance
    decayFactor: number;        // Time-based decay
    confidenceWeight: number;   // Weight by confidence
}

export interface DecayConfig {
    enabled: boolean;
    halfLifeDays: number;           // Importance halves every N days
    minImportance: number;          // Don't decay below this
    accessBoostFactor: number;      // How much each access boosts importance
    recencyBoostDays: number;       // Full boost within N days
    archiveThreshold: number;       // Auto-archive below this importance
}

// ============================================================================
// CONTEXT-AWARE RECALL
// ============================================================================

export interface RecallContext {
    query: string;

    // Scope filters
    workspaceId?: string;
    categories?: MemoryCategory[];
    tags?: string[];

    // Time filters
    createdAfter?: number;
    createdBefore?: number;

    // Relevance tuning
    minConfidence?: number;
    minImportance?: number;
    includeArchived?: boolean;
    includePending?: boolean;

    // Result tuning
    limit?: number;
    diversityFactor?: number;   // 0-1, higher = more diverse results
}

export interface RecallResult {
    memories: AdvancedSemanticFragment[];
    scores: Map<string, MemoryScoreFactors>;
    totalMatches: number;
    queryEmbedding: number[];
}

// ============================================================================
// KNOWLEDGE GRAPH RELATIONSHIPS
// ============================================================================

export type RelationshipType =
    | 'is_a'            // Category/type relationship
    | 'has'             // Ownership/attribute
    | 'prefers'         // Preference
    | 'works_on'        // Workspace involvement
    | 'related_to'      // General relation
    | 'contradicts'     // Conflicting info
    | 'supersedes'      // Newer version of
    | 'part_of';        // Component relationship

export interface MemoryRelationship {
    id: string;
    sourceMemoryId: string;
    targetMemoryId: string;
    relationshipType: RelationshipType;
    strength: number;           // 0.0-1.0
    bidirectional: boolean;
    createdAt: number;
    metadata?: Record<string, JsonValue>;
}

// ============================================================================
// MEMORY CONSOLIDATION
// ============================================================================

export interface ConsolidationResult {
    action: 'merged' | 'generalized' | 'linked' | 'none';
    resultingMemoryId?: string;
    affectedMemoryIds: string[];
    explanation: string;
}

export interface ConsolidationConfig {
    enabled: boolean;
    similarityThreshold: number;    // Min similarity to consider merging
    autoMergeThreshold: number;     // Auto-merge above this similarity
    maxMergeCount: number;          // Max memories to merge at once
    generalizeThreshold: number;    // When to create a generalized memory
}

// ============================================================================
// MEMORY STATISTICS
// ============================================================================

export interface MemoryStatistics {
    total: number;
    byStatus: Record<MemoryStatus, number>;
    byCategory: Record<MemoryCategory, number>;
    bySource: Record<MemorySource, number>;

    // Health metrics
    averageConfidence: number;
    averageImportance: number;
    pendingValidation: number;
    contradictions: number;

    // Activity
    recentlyAccessed: number;   // Last 24h
    recentlyCreated: number;    // Last 24h

    // Storage
    totalEmbeddingSize: number;
}

export interface MemorySearchAnalytics {
    totalQueries: number;
    semanticQueries: number;
    textQueries: number;
    hybridQueries: number;
    averageResults: number;
    lastQueryAt?: number;
    topQueries: Array<{ query: string; count: number }>;
}

export interface MemorySearchHistoryEntry {
    query: string;
    type: 'semantic' | 'text' | 'hybrid';
    resultCount: number;
    timestamp: number;
}

export interface MemoryImportResult {
    imported: number;
    pendingImported: number;
    skipped: number;
    errors: string[];
}

// ============================================================================
// AGENT-14: SHARED MEMORY NAMESPACE
// ============================================================================

export type SharedMemoryConflictResolution =
    | 'keep_source'
    | 'keep_target'
    | 'merge_copy'
    | 'manual_review';

export interface SharedMemoryNamespace {
    id: string;
    name: string;
    workspaceIds: string[];
    accessControl: Record<string, string[]>;
    createdAt: number;
    updatedAt: number;
}

export interface SharedMemorySyncRequest {
    namespaceId: string;
    sourceWorkspaceId: string;
    targetWorkspaceIds?: string[];
    memoryIds?: string[];
    resolution?: SharedMemoryConflictResolution;
}

export interface SharedMemoryMergeConflict {
    namespaceId: string;
    sourceWorkspaceId: string;
    targetWorkspaceId: string;
    sourceMemoryId: string;
    targetMemoryId: string;
    sourceContent: string;
    targetContent: string;
    resolution: SharedMemoryConflictResolution;
    detectedAt: number;
}

export interface SharedMemorySyncResult {
    namespaceId: string;
    synced: number;
    skipped: number;
    conflicts: SharedMemoryMergeConflict[];
    updatedAt: number;
}

export interface SharedMemoryAnalytics {
    namespaceId: string;
    totalMemories: number;
    totalWorkspaces: number;
    conflicts: number;
    memoriesByWorkspace: Record<string, number>;
    updatedAt: number;
}

// ============================================================================
// ADVANCED MEMORY SERVICE CONFIGURATION
// ============================================================================

export interface AdvancedMemoryConfig {
    // Validation gate
    autoConfirmThreshold: number;       // Auto-confirm above this confidence
    requireUserValidation: boolean;     // Always require user validation
    maxPendingMemories: number;         // Max staging buffer size

    // Decay
    decay: DecayConfig;

    // Consolidation
    consolidation: ConsolidationConfig;

    // Extraction
    extractionModel: string;            // Model for fact extraction
    minExtractionConfidence: number;    // Min confidence to stage

    // Recall
    defaultRecallLimit: number;
    minRecallConfidence: number;
    includeRelatedDepth: number;        // How deep to follow relationships
}

export const DEFAULT_MEMORY_CONFIG: AdvancedMemoryConfig = {
    autoConfirmThreshold: 0.85,
    requireUserValidation: false,
    maxPendingMemories: 50,

    decay: {
        enabled: true,
        halfLifeDays: 30,
        minImportance: 0.1,
        accessBoostFactor: 0.1,
        recencyBoostDays: 7,
        archiveThreshold: 0.15
    },

    consolidation: {
        enabled: true,
        similarityThreshold: 0.75,
        autoMergeThreshold: 0.92,
        maxMergeCount: 5,
        generalizeThreshold: 0.6
    },

    extractionModel: 'llama3.2:3b',
    minExtractionConfidence: 0.5,

    defaultRecallLimit: 10,
    minRecallConfidence: 0.3,
    includeRelatedDepth: 1
};
