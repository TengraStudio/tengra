import { BrainService } from '@main/services/llm/brain.service';
import { describe, expect, it, vi } from 'vitest';

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
            db as any,
            embedding as any,
            llmService as any,
            {} as any
        );

        return { service, db, llmService };
    };

    it('accepts Turkish user facts in validation helper', () => {
        const { service } = createService();
        expect((service as any).isUserFact('Ben koyu tema kullanıyorum.')).toBe(true);
    });

    it('accepts Spanish user facts in validation helper', () => {
        const { service } = createService();
        expect((service as any).isUserFact('Yo uso Neovim y prefiero terminal.')).toBe(true);
    });

    it('rejects workspace-local statements in validation helper', () => {
        const { service } = createService();
        expect((service as any).isUserFact('Bu proje dosyasında bir hata var.')).toBe(false);
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

