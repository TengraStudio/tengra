/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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

        const { fetchModels } = await import('@/features/models/utils/model-fetcher');
        const [first, second] = await Promise.all([fetchModels(true), fetchModels(true)]);

        expect(mockGetAllModels).toHaveBeenCalledTimes(1);
        expect(first).toEqual(second);
        expect(first[0]?.provider).toBe('openai');
    });
});

