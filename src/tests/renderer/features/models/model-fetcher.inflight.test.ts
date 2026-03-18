import { afterEach, describe, expect, it, vi } from 'vitest';

describe('fetchModels in-flight dedupe', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.resetModules();
    });

    it('reuses one getAllModels request for concurrent callers', async () => {
        const mockGetAllModels = vi.fn().mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 20));
            return [
                {
                    id: 'gpt-4o',
                    name: 'GPT-4o',
                    provider: 'openai'
                }
            ];
        });

        Object.defineProperty(window, 'electron', {
            configurable: true,
            value: {
                modelRegistry: {
                    getAllModels: mockGetAllModels
                },
                log: {
                    error: vi.fn()
                }
            }
        });

        const { fetchModels } = await import('@renderer/features/models/utils/model-fetcher');
        const [first, second] = await Promise.all([fetchModels(true), fetchModels(true)]);

        expect(mockGetAllModels).toHaveBeenCalledTimes(1);
        expect(first).toEqual(second);
        expect(first[0]?.provider).toBe('openai');
    });
});
