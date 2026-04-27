/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, it, vi } from 'vitest';

import { fetchModels, getSelectableProviderId, groupModels } from '@/features/models/utils/model-fetcher';

describe('groupModels', () => {
    it('maps copilot token aliases to copilot provider', () => {
        expect(getSelectableProviderId({
            provider: 'copilot_token',
            providerCategory: 'github_token'
        })).toBe('copilot');
    });

    it('prefers providerCategory for selectable provider IDs', () => {
        expect(getSelectableProviderId({
            provider: 'openai',
            providerCategory: 'codex'
        })).toBe('codex');
    });

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

    it('groups github_token providerCategory models under copilot', async () => {
        const mockGetAllModels = vi.fn().mockResolvedValue([
            {
                id: 'gpt-4o',
                name: 'GPT-4o',
                provider: 'copilot_token',
                providerCategory: 'github_token'
            }
        ]);

        const previousDescriptor = Object.getOwnPropertyDescriptor(window, 'electron');
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

        try {
            const models = await fetchModels(true);
            const grouped = groupModels(models);
            expect(grouped.copilot).toBeDefined();
            expect(grouped.copilot?.models).toHaveLength(1);
        } finally {
            if (previousDescriptor) {
                Object.defineProperty(window, 'electron', previousDescriptor);
            }
        }
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

    it('does not infer provider/category from owned_by when provider is missing', async () => {
        const mockGetAllModels = vi.fn().mockResolvedValue([
            {
                id: 'meta/llama-3.1-70b-instruct',
                name: 'Llama 3.1 70B',
                owned_by: 'nvidia'
            }
        ]);

        const previousDescriptor = Object.getOwnPropertyDescriptor(window, 'electron');
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

        try {
            const models = await fetchModels(true);
            expect(models[0]?.provider).toBe('custom');
            expect(models[0]?.providerCategory).toBe('custom');
        } finally {
            if (previousDescriptor) {
                Object.defineProperty(window, 'electron', previousDescriptor);
            }
        }
    });
});
