import { categorizeModel } from '@renderer/features/models/utils/model-categorization';
import { describe, expect, it } from 'vitest';

describe('categorizeModel', () => {
    it('maps nvidia_key provider hint to nvidia', () => {
        const categorized = categorizeModel('meta/llama-3.1-70b-instruct', 'nvidia_key');
        expect(categorized.provider).toBe('nvidia');
    });

    it('detects nvidia catalog namespace ids without explicit provider hint', () => {
        const categorized = categorizeModel('mistralai/mixtral-8x22b-instruct-v0.1');
        expect(categorized.provider).toBe('nvidia');
    });

    it('detects qwen namespace ids as nvidia catalog models without explicit provider hint', () => {
        const categorized = categorizeModel('qwen/qwen3-32b-gguf');
        expect(categorized.provider).toBe('nvidia');
    });

    it('keeps explicit nvidia-prefixed ids in nvidia provider', () => {
        const categorized = categorizeModel('nvidia/meta/llama-3.1-405b-instruct', 'openai');
        expect(categorized.provider).toBe('nvidia');
    });

    it('keeps normal OpenAI ids in openai provider', () => {
        const categorized = categorizeModel('gpt-4.1-mini', 'openai');
        expect(categorized.provider).toBe('openai');
    });
});
