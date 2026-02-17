import { useMemo } from 'react';

import type { DbMarketplaceModel } from '@/electron';

type SortOption = 'pulls' | 'name' | 'updated' | 'tags';

/**
 * Parse pull count string to number for sorting
 * Handles formats like "1.2M", "500K", "10000"
 */
function parsePullCount(pulls: string | undefined): number {
    if (!pulls) {
        return 0;
    }
    const cleaned = pulls.replace(/[^0-9.KMB]/gi, '').toUpperCase();
    const num = parseFloat(cleaned);
    if (isNaN(num)) {
        return 0;
    }
    if (cleaned.includes('B')) {
        return num * 1_000_000_000;
    }
    if (cleaned.includes('M')) {
        return num * 1_000_000;
    }
    if (cleaned.includes('K')) {
        return num * 1_000;
    }
    return num;
}

/**
 * Normalize category for comparison
 */
function normalizeCategory(value: string): string {
    return value.trim().toLowerCase();
}

/**
 * Hook for filtering and sorting models
 */
export function useModelFiltering(
    models: DbMarketplaceModel[],
    selectedCategory: string | null,
    sortBy: SortOption
) {
    const categories = useMemo(() => {
        const cats = new Set<string>();
        if (Array.isArray(models)) {
            models.forEach(m => {
                if (Array.isArray(m.categories)) {
                    m.categories.forEach(c => cats.add(normalizeCategory(c)));
                }
            });
        }
        return Array.from(cats).sort();
    }, [models]);

    const filteredModels = useMemo(() => {
        if (!Array.isArray(models)) {
            return [];
        }
        let result = [...models];

        // Filter by category
        if (selectedCategory) {
            const selected = normalizeCategory(selectedCategory);
            result = result.filter(m => (m.categories || []).some(c => normalizeCategory(c) === selected));
        }

        // Sort
        result.sort((a, b) => {
            switch (sortBy) {
                case 'pulls':
                    return parsePullCount(b.pulls) - parsePullCount(a.pulls);
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'updated':
                    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
                case 'tags':
                    return (b.tagCount ?? 0) - (a.tagCount ?? 0);
                default:
                    return 0;
            }
        });

        return result;
    }, [models, selectedCategory, sortBy]);

    return {
        categories,
        filteredModels,
    };
}

/**
 * Hook for pagination logic
 */
export function usePagination(
    filteredModels: DbMarketplaceModel[],
    modelsPerPage: number,
    currentPage: number
) {
    const totalPages = Math.max(1, Math.ceil(filteredModels.length / modelsPerPage));
    const safePage = Math.min(currentPage, totalPages);

    const pagedModels = useMemo(() => {
        const start = (safePage - 1) * modelsPerPage;
        return filteredModels.slice(start, start + modelsPerPage);
    }, [filteredModels, safePage, modelsPerPage]);

    return {
        totalPages,
        safePage,
        pagedModels,
    };
}
