import { groupModels } from '@renderer/features/models/utils/model-fetcher';
import { describe, expect, it } from 'vitest';

describe('groupModels', () => {
    it('groups by providerCategory when present', () => {
        const grouped = groupModels([
            {
                id: 'qwen/qwen3-32b',
                name: 'Qwen 3 32B',
                provider: 'openai',
                providerCategory: 'nvidia'
            }
        ]);

        expect(grouped.nvidia).toBeDefined();
        expect(grouped.nvidia?.models[0]?.provider).toBe('openai');
    });

    it('falls back to provider when providerCategory is missing', () => {
        const grouped = groupModels([
            {
                id: 'gpt-4.1-mini',
                name: 'GPT-4.1 Mini',
                provider: 'openai'
            }
        ]);

        expect(grouped.openai).toBeDefined();
        expect(grouped.openai?.models[0]?.id).toBe('gpt-4.1-mini');
    });
});
