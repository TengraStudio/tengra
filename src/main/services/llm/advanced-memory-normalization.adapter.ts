import {
    AdvancedSemanticFragment,
    MemoryCategory,
    MemorySource,
    MemoryStatus,
    PendingMemory,
} from '@shared/types/advanced-memory';

interface NormalizationDependencies {
    generateId: () => string
    getNow?: () => number
}

const VALID_MEMORY_SOURCES: MemorySource[] = [
    'user_explicit',
    'user_implicit',
    'system',
    'conversation',
    'tool_result',
];

const VALID_MEMORY_CATEGORIES: MemoryCategory[] = [
    'preference',
    'personal',
    'project',
    'technical',
    'workflow',
    'relationship',
    'fact',
    'instruction',
];

const VALID_MEMORY_STATUSES: MemoryStatus[] = [
    'pending',
    'confirmed',
    'archived',
    'contradicted',
    'merged',
];

export class AdvancedMemoryNormalizationAdapter {
    private readonly getNow: () => number;

    constructor(private readonly deps: NormalizationDependencies) {
        this.getNow = deps.getNow ?? Date.now;
    }

    normalizeMemoryRecord(input: Partial<AdvancedSemanticFragment>): AdvancedSemanticFragment | null {
        const rawContent = typeof input.content === 'string'
            ? input.content
            : (typeof input.sourceContext === 'string' ? input.sourceContext : '');
        const content = rawContent.trim();
        if (!content) {
            return null;
        }

        const now = this.getNow();
        const id = typeof input.id === 'string' && input.id.trim()
            ? input.id.trim()
            : this.deps.generateId();
        const source = this.normalizeMemorySource(input.source);
        const category = this.normalizeMemoryCategory(input.category);
        const status = this.normalizeMemoryStatus(input.status);
        const tags = this.normalizeTags(input.tags);
        const embedding = this.normalizeEmbeddingVector(input.embedding);

        const confidence = this.normalizeUnitNumber(input.confidence, 0.7);
        const importance = this.normalizeUnitNumber(input.importance, 0.5);
        const initialImportance = this.normalizeUnitNumber(input.initialImportance, importance);

        return {
            id,
            content,
            embedding,
            source,
            sourceId: typeof input.sourceId === 'string' && input.sourceId.trim() ? input.sourceId.trim() : 'import',
            sourceContext: typeof input.sourceContext === 'string' ? input.sourceContext : undefined,
            category,
            tags,
            confidence,
            importance,
            initialImportance,
            status,
            validatedAt: typeof input.validatedAt === 'number' ? input.validatedAt : undefined,
            validatedBy: input.validatedBy === 'user' || input.validatedBy === 'auto' || input.validatedBy === 'system'
                ? input.validatedBy
                : undefined,
            accessCount: typeof input.accessCount === 'number' && input.accessCount > 0 ? Math.floor(input.accessCount) : 0,
            lastAccessedAt: typeof input.lastAccessedAt === 'number' ? input.lastAccessedAt : now,
            relatedMemoryIds: this.normalizeIds(input.relatedMemoryIds),
            contradictsIds: this.normalizeIds(input.contradictsIds),
            mergedIntoId: typeof input.mergedIntoId === 'string' ? input.mergedIntoId : undefined,
            workspaceId: typeof input.workspaceId === 'string' && input.workspaceId.trim() ? input.workspaceId.trim() : undefined,
            contextTags: this.normalizeTags(input.contextTags),
            createdAt: typeof input.createdAt === 'number' ? input.createdAt : now,
            updatedAt: typeof input.updatedAt === 'number' ? input.updatedAt : now,
            expiresAt: typeof input.expiresAt === 'number' ? input.expiresAt : undefined,
            metadata: input.metadata,
        };
    }

    normalizePendingMemoryRecord(input: Partial<PendingMemory>): PendingMemory | null {
        const rawContent = typeof input.content === 'string'
            ? input.content
            : (typeof input.sourceContext === 'string' ? input.sourceContext : '');
        const content = rawContent.trim();
        if (!content) {
            return null;
        }

        const now = this.getNow();
        const id = typeof input.id === 'string' && input.id.trim()
            ? input.id.trim()
            : this.deps.generateId();
        const source = this.normalizeMemorySource(input.source);
        const category = this.normalizeMemoryCategory(input.suggestedCategory);

        return {
            id,
            content,
            embedding: this.normalizeEmbeddingVector(input.embedding),
            source,
            sourceId: typeof input.sourceId === 'string' && input.sourceId.trim() ? input.sourceId.trim() : 'import',
            sourceContext: typeof input.sourceContext === 'string' ? input.sourceContext : content,
            extractedAt: typeof input.extractedAt === 'number' ? input.extractedAt : now,
            suggestedCategory: category,
            suggestedTags: this.normalizeTags(input.suggestedTags),
            extractionConfidence: this.normalizeUnitNumber(input.extractionConfidence, 0.7),
            relevanceScore: this.normalizeUnitNumber(input.relevanceScore, 0.6),
            noveltyScore: this.normalizeUnitNumber(input.noveltyScore, 0.6),
            requiresUserValidation: Boolean(input.requiresUserValidation),
            autoConfirmReason: typeof input.autoConfirmReason === 'string' ? input.autoConfirmReason : undefined,
            potentialContradictions: Array.isArray(input.potentialContradictions) ? input.potentialContradictions : [],
            similarMemories: Array.isArray(input.similarMemories) ? input.similarMemories : [],
            workspaceId: typeof input.workspaceId === 'string' && input.workspaceId.trim() ? input.workspaceId.trim() : undefined,
        };
    }

    private normalizeMemorySource(source?: MemorySource | string): MemorySource {
        if (typeof source === 'string' && VALID_MEMORY_SOURCES.includes(source as MemorySource)) {
            return source as MemorySource;
        }
        return 'system';
    }

    private normalizeMemoryCategory(category?: MemoryCategory | string): MemoryCategory {
        if (typeof category === 'string' && VALID_MEMORY_CATEGORIES.includes(category as MemoryCategory)) {
            return category as MemoryCategory;
        }
        return 'fact';
    }

    private normalizeMemoryStatus(status?: MemoryStatus | string): MemoryStatus {
        if (typeof status === 'string' && VALID_MEMORY_STATUSES.includes(status as MemoryStatus)) {
            return status as MemoryStatus;
        }
        return 'confirmed';
    }

    private normalizeTags(tags?: string[]): string[] {
        if (!tags) {
            return [];
        }
        return tags
            .map(tag => tag.trim())
            .filter(Boolean)
            .slice(0, 50);
    }

    private normalizeIds(ids?: string[]): string[] {
        if (!ids) {
            return [];
        }
        return ids
            .map(id => id.trim())
            .filter(Boolean)
            .slice(0, 100);
    }

    private normalizeEmbeddingVector(value?: number[]): number[] {
        if (!value) {
            return [];
        }
        return value
            .filter(entry => Number.isFinite(entry))
            .slice(0, 4096);
    }

    private normalizeUnitNumber(value: number | undefined, fallback: number): number {
        if (value === undefined || !Number.isFinite(value)) {
            return fallback;
        }
        return Math.max(0, Math.min(1, value));
    }
}
