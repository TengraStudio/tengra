import { describe, expect, it } from 'vitest';

import {
    CATEGORIES,
    CATEGORY_METADATA,
    getCategoryMeta,
    INCOMPATIBILITY_RULES,
} from '@/features/ideas/utils/categories';

describe('ideas/utils/categories', () => {
    describe('CATEGORIES', () => {
        it('should contain all expected categories', () => {
            expect(CATEGORIES).toContain('website');
            expect(CATEGORIES).toContain('mobile-app');
            expect(CATEGORIES).toContain('game');
            expect(CATEGORIES).toContain('cli-tool');
            expect(CATEGORIES).toContain('desktop');
            expect(CATEGORIES).toContain('other');
            expect(CATEGORIES).toHaveLength(6);
        });
    });

    describe('CATEGORY_METADATA', () => {
        it('should have metadata for every category', () => {
            for (const cat of CATEGORIES) {
                const meta = CATEGORY_METADATA[cat];
                expect(meta).toBeDefined();
                expect(meta.id).toBe(cat);
                expect(meta.label).toBeTruthy();
                expect(meta.icon).toBeDefined();
                expect(meta.color).toBeTruthy();
                expect(meta.bgColor).toBeTruthy();
            }
        });
    });

    describe('getCategoryMeta', () => {
        it('should return correct metadata for website', () => {
            const meta = getCategoryMeta('website');
            expect(meta.id).toBe('website');
            expect(meta.label).toBe('Website');
        });

        it('should return correct metadata for game', () => {
            const meta = getCategoryMeta('game');
            expect(meta.id).toBe('game');
            expect(meta.label).toBe('Game');
        });
    });

    describe('INCOMPATIBILITY_RULES', () => {
        it('should mark game and cli-tool as incompatible', () => {
            expect(INCOMPATIBILITY_RULES['game']).toContain('cli-tool');
            expect(INCOMPATIBILITY_RULES['cli-tool']).toContain('game');
        });

        it('should mark game and website as incompatible', () => {
            expect(INCOMPATIBILITY_RULES['game']).toContain('website');
            expect(INCOMPATIBILITY_RULES['website']).toContain('game');
        });

        it('should mark cli-tool and mobile-app as incompatible', () => {
            expect(INCOMPATIBILITY_RULES['cli-tool']).toContain('mobile-app');
            expect(INCOMPATIBILITY_RULES['mobile-app']).toContain('cli-tool');
        });
    });
});
