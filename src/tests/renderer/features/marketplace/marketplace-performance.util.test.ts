/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { MarketplaceModel, MarketplaceRuntimeProfile } from '@shared/types/marketplace';
import { describe, expect, it } from 'vitest';

import { estimateMarketplaceModelPerformance } from '@/features/marketplace/utils/marketplace-performance.util';

const GB = 1024 * 1024 * 1024;

function createGpuProfile(): MarketplaceRuntimeProfile {
    return {
        system: {
            platform: 'darwin',
            arch: 'arm64',
            cpuCores: 8,
            cpuLoadPercent: 20,
            totalMemoryBytes: 32 * GB,
            freeMemoryBytes: 24 * GB,
            storageTotalBytes: 512 * GB,
            storageFreeBytes: 240 * GB,
            storageUsedBytes: 272 * GB,
            storageUsagePercent: 53,
        },
        gpu: {
            available: true,
            source: 'electron',
            name: 'Test GPU',
            backends: ['metal'],
            devices: [{
                index: 0,
                name: 'Test GPU',
                backend: 'metal',
                memoryBytes: 8 * GB,
                memoryUsedBytes: 0,
            }],
            vramBytes: 8 * GB,
            vramUsedBytes: 0,
            totalVramBytes: 8 * GB,
            totalVramUsedBytes: 0,
        },
        performance: {
            rssBytes: 0,
            heapUsedBytes: 0,
            processCount: 1,
            alertCount: 0,
        },
    };
}

describe('estimateMarketplaceModelPerformance', () => {
    it('uses submodel memory estimates instead of raw download size', () => {
        const model: MarketplaceModel = {
            id: 'tiny-2b',
            name: 'Tiny 2B',
            description: 'A small 2B model with a large archive size entry.',
            author: 'Test',
            version: '1.0.0',
            downloadUrl: 'https://example.com/tiny-2b',
            itemType: 'model',
            provider: 'huggingface',
            parameters: '2B',
            totalSize: '33 GB',
            pipelineTag: 'Q4_K_M',
            submodels: [
                {
                    id: 'tiny-2b-q4',
                    name: 'Q4_K_M',
                    size: '1.8 GB',
                    modelSize: '2B',
                    tensorType: 'Q4_K_M',
                    contextWindow: '4096',
                },
                {
                    id: 'tiny-2b-q8',
                    name: 'Q8_0',
                    size: '2.8 GB',
                    modelSize: '2B',
                    tensorType: 'Q8_0',
                    contextWindow: '4096',
                },
            ],
        };

        const performance = estimateMarketplaceModelPerformance(model, createGpuProfile());
        if (!performance) {
            throw new Error('Performance estimation failed');
        }

        expect(performance.backend).toBe('gpu');
        expect(performance.selectedVariant?.id).toBe('tiny-2b-q8');
        expect(performance.estimatedVramBytes).toBeLessThan(10 * GB);
        expect(performance.reasons.join(' ')).toContain('VRAM need');
        expect(performance.reasons.join(' ')).not.toContain('33.0 GB');
    });

    it('prefers the largest fitting variant instead of a tiny weird submodel', () => {
        const model: MarketplaceModel = {
            id: 'mid-6b',
            name: 'Mid 6B',
            description: 'A model with a misleading tiny adapter variant.',
            author: 'Test',
            version: '1.0.0',
            downloadUrl: 'https://example.com/mid-6b',
            itemType: 'model',
            provider: 'huggingface',
            parameters: '6B',
            totalSize: '6 GB',
            pipelineTag: 'Q4_K_M',
            submodels: [
                {
                    id: 'mid-6b-tiny',
                    name: 'Tiny adapter',
                    size: '256 MB',
                    modelSize: '250M',
                    tensorType: 'Q4_K_M',
                    contextWindow: '1024',
                },
                {
                    id: 'mid-6b-balanced',
                    name: 'Balanced',
                    size: '5.5 GB',
                    modelSize: '6B',
                    tensorType: 'Q4_K_M',
                    contextWindow: '4096',
                },
            ],
        };

        const performance = estimateMarketplaceModelPerformance(model, createGpuProfile());
        if (!performance) {
            throw new Error('Performance estimation failed');
        }

        expect(performance.selectedVariant?.id).toBe('mid-6b');
        expect(performance.reasons.join(' ')).not.toContain('Tiny adapter');
    });

    it('derives non-zero memory and disk estimates from parameter metadata', () => {
        const model: MarketplaceModel = {
            id: 'org/solid-7b-chat',
            name: 'Solid 7B Chat',
            description: 'Model with parameter metadata but missing explicit size fields.',
            author: 'Test',
            version: '1.0.0',
            downloadUrl: 'https://example.com/solid-7b-chat',
            itemType: 'model',
            provider: 'huggingface',
            parameters: '7B',
        };

        const performance = estimateMarketplaceModelPerformance(model, createGpuProfile());
        if (!performance) {
            throw new Error('Performance estimation failed');
        }

        expect(performance.confidence).toBe('high');
        expect(performance.estimatedMemoryBytes).toBeGreaterThan(GB);
        expect(performance.estimatedDiskBytes).toBeGreaterThan(GB);
        expect(performance.estimatedTokensPerSecond).toBeGreaterThan(0);
    });

    it('keeps unknown models in low-confidence range instead of saturating TPS', () => {
        const model: MarketplaceModel = {
            id: 'org/mystery-model-alpha',
            name: 'Mystery Model Alpha',
            description: 'No params, no size, no submodel metadata.',
            author: 'Test',
            version: '1.0.0',
            downloadUrl: 'https://example.com/mystery-model-alpha',
            itemType: 'model',
            provider: 'huggingface',
        };

        const performance = estimateMarketplaceModelPerformance(model, createGpuProfile());
        if (!performance) {
            throw new Error('Performance estimation failed');
        }

        expect(performance.confidence).toBe('low');
        expect(performance.fit).toBe('limited');
        expect(performance.estimatedTokensPerSecond).toBeLessThan(45);
        expect(performance.score).toBeLessThan(50);
    });

    it('classifies hybrid RAM+VRAM execution as workable when performance is acceptable', () => {
        const model: MarketplaceModel = {
            id: 'org/dual-fit-13b',
            name: 'Dual Fit 13B Instruct',
            description: 'Needs RAM spill but should still be usable.',
            author: 'Test',
            version: '1.0.0',
            downloadUrl: 'https://example.com/dual-fit-13b',
            itemType: 'model',
            provider: 'huggingface',
            parameters: '13B',
            totalSize: '10 GB',
            pipelineTag: 'Q4_K_M',
        };

        const performance = estimateMarketplaceModelPerformance(model, createGpuProfile());
        if (!performance) {
            throw new Error('Performance estimation failed');
        }

        expect(performance.memoryFits).toBe(true);
        expect(performance.vramFits).toBe(false);
        expect(performance.fit).toBe('workable');
    });

    it('keeps clearly oversized models blocked', () => {
        const model: MarketplaceModel = {
            id: 'org/oversized-70b',
            name: 'Oversized 70B',
            description: 'Known huge model that should not fit this machine.',
            author: 'Test',
            version: '1.0.0',
            downloadUrl: 'https://example.com/oversized-70b',
            itemType: 'model',
            provider: 'huggingface',
            parameters: '70B',
            totalSize: '45 GB',
            pipelineTag: 'Q5_K_M',
        };

        const performance = estimateMarketplaceModelPerformance(model, createGpuProfile());
        if (!performance) {
            throw new Error('Performance estimation failed');
        }

        expect(performance.memoryFits).toBe(false);
        expect(performance.fit).toBe('blocked');
    });
});
