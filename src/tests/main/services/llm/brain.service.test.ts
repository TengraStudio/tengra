/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { BrainService } from '@main/services/llm/brain.service';
import { describe, expect, it, vi } from 'vitest';

const invokeIsUserFact = (service: BrainService, content: string): boolean => {
    const isUserFact = Reflect.get(service, 'isUserFact') as ((value: string) => boolean) | undefined;
    if (!isUserFact) {
        throw new Error('isUserFact is unavailable on BrainService instance');
    }
    return isUserFact.call(service, content);
};

describe('BrainService - multilingual fact extraction', () => {
    const createService = () => {
        const db = {
            storeSemanticFragment: vi.fn().mockResolvedValue(undefined),
            searchSemanticFragments: vi.fn().mockResolvedValue([]),
            searchSemanticFragmentsByText: vi.fn().mockResolvedValue([]),
            deleteSemanticFragment: vi.fn().mockResolvedValue(undefined),
            getSemanticFragmentsByIds: vi.fn().mockResolvedValue([])
        };
        const embedding = {
            generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3])
        };
        const llmService = {
            chat: vi.fn().mockResolvedValue({
                content: '[{"category":"preference","content":"Ben koyu temayı tercih ederim.","confidence":0.93}]'
            })
        };

        const service = new BrainService(
            db as never,
            embedding as never,
            llmService as never,
            {} as never,
            {
                resolve: vi.fn().mockResolvedValue({ model: 'claude-haiku-4.5', provider: 'copilot', source: 'oauth' })
            } as never
        );

        return { service, db, llmService };
    };

    it('accepts Turkish user facts in validation helper', () => {
        const { service } = createService();
        expect(invokeIsUserFact(service, 'Ben koyu tema kullanıyorum.')).toBe(true);
    });

    it('accepts Spanish user facts in validation helper', () => {
        const { service } = createService();
        expect(invokeIsUserFact(service, 'Yo uso Neovim y prefiero terminal.')).toBe(true);
    });

    it('rejects workspace-local statements in validation helper', () => {
        const { service } = createService();
        expect(invokeIsUserFact(service, 'Bu proje dosyasında bir hata var.')).toBe(false);
    });

    it('extracts and persists non-English facts from LLM output', async () => {
        const { service, db, llmService } = createService();

        const facts = await service.extractUserFactsFromMessage('Ben koyu temayı seviyorum.');

        expect(llmService.chat).toHaveBeenCalledTimes(1);
        expect(db.storeSemanticFragment).toHaveBeenCalledTimes(1);
        expect(facts).toHaveLength(1);
        expect(facts[0].content).toContain('koyu tema');
        expect(facts[0].category).toBe('preference');
    });
});

