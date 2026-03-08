import { AdvancedMemoryNormalizationAdapter } from '@main/services/llm/advanced-memory-normalization.adapter';
import {
    WORKSPACE_COMPAT_ALIAS_VALUES,
    WORKSPACE_COMPAT_TARGET_VALUES
} from '@shared/constants';
import {
    MemoryCategorySchema,
    StatisticsSchema
} from '@shared/schemas/advanced-memory.schema';
import {
    AdvancedMemoryCategorySchema,
    MemoryStatisticsSchema
} from '@shared/schemas/service-hardening.schema';
import { describe, expect, it } from 'vitest';

const baseStatistics = {
    total: 3,
    byStatus: {
        pending: 0,
        confirmed: 3,
        archived: 0,
        contradicted: 0,
        merged: 0
    },
    bySource: {
        user_explicit: 0,
        user_implicit: 0,
        system: 3,
        conversation: 0,
        tool_result: 0
    },
    averageConfidence: 0.8,
    averageImportance: 0.6,
    pendingValidation: 0,
    contradictions: 0,
    recentlyAccessed: 0,
    recentlyCreated: 0,
    totalEmbeddingSize: 0
};

describe('advanced memory workspace compatibility', () => {
    it('normalizes legacy workspace aliases through shared schemas', () => {
        expect(MemoryCategorySchema.parse(WORKSPACE_COMPAT_ALIAS_VALUES.SINGULAR)).toBe(WORKSPACE_COMPAT_TARGET_VALUES.WORKSPACE);
        expect(AdvancedMemoryCategorySchema.parse(WORKSPACE_COMPAT_ALIAS_VALUES.SINGULAR)).toBe(WORKSPACE_COMPAT_TARGET_VALUES.WORKSPACE);
    });

    it('normalizes imported legacy workspace aliases to the canonical category', () => {
        const adapter = new AdvancedMemoryNormalizationAdapter({
            generateId: () => 'generated-memory-id',
            getNow: () => 123
        });

        const memory = adapter.normalizeMemoryRecord({
            id: 'memory-1',
            content: 'Legacy workspace memory',
            source: 'system',
            sourceId: 'source-1',
            category: WORKSPACE_COMPAT_ALIAS_VALUES.SINGULAR
        });
        const pending = adapter.normalizePendingMemoryRecord({
            id: 'pending-1',
            content: 'Legacy pending memory',
            source: 'system',
            sourceId: 'source-2',
            sourceContext: 'Legacy pending memory',
            suggestedCategory: WORKSPACE_COMPAT_ALIAS_VALUES.SINGULAR
        });

        expect(memory?.category).toBe(WORKSPACE_COMPAT_TARGET_VALUES.WORKSPACE);
        expect(pending?.suggestedCategory).toBe(WORKSPACE_COMPAT_TARGET_VALUES.WORKSPACE);
    });

    it('merges legacy workspace-alias statistics into canonical counts', () => {
        const sharedStatistics = StatisticsSchema.parse({
            ...baseStatistics,
            byCategory: {
                [WORKSPACE_COMPAT_ALIAS_VALUES.SINGULAR]: 2,
                [WORKSPACE_COMPAT_TARGET_VALUES.WORKSPACE]: 1,
                fact: 4
            }
        });
        const hardenedStatistics = MemoryStatisticsSchema.parse({
            ...baseStatistics,
            byCategory: {
                [WORKSPACE_COMPAT_ALIAS_VALUES.SINGULAR]: 2,
                [WORKSPACE_COMPAT_TARGET_VALUES.WORKSPACE]: 1,
                fact: 4
            }
        });

        expect(sharedStatistics.byCategory.workspace).toBe(3);
        expect(sharedStatistics.byCategory.fact).toBe(4);
        expect(hardenedStatistics.byCategory.workspace).toBe(3);
        expect(hardenedStatistics.byCategory.fact).toBe(4);
    });
});
