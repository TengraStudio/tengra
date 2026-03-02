import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Restore real fs and path (global setup mocks them)
vi.unmock('fs');
vi.unmock('path');

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { MarketplaceRatingsService } from '@main/mcp/marketplace-ratings';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

describe('MarketplaceRatingsService', () => {
    let service: MarketplaceRatingsService;
    let testDir: string;

    beforeEach(async () => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ratings-test-'));
        service = new MarketplaceRatingsService(testDir);
        await service.initialize();
    });

    afterEach(async () => {
        await service.cleanup();
        fs.rmSync(testDir, { recursive: true, force: true });
    });

    describe('ratePlugin', () => {
        it('should add a new rating', () => {
            const rating = service.ratePlugin('plugin-a', 'user1', 5, 'Excellent!');
            expect(rating.pluginId).toBe('plugin-a');
            expect(rating.rating).toBe(5);
            expect(rating.review).toBe('Excellent!');
            expect(rating.createdAt).toBeGreaterThan(0);
        });

        it('should update existing rating from same user', () => {
            service.ratePlugin('plugin-a', 'user1', 3);
            const updated = service.ratePlugin('plugin-a', 'user1', 5, 'Changed my mind');
            expect(updated.rating).toBe(5);
            expect(updated.review).toBe('Changed my mind');
        });

        it('should reject invalid ratings', () => {
            expect(() => service.ratePlugin('p', 'u', 0)).toThrow('Rating must be an integer between 1 and 5');
            expect(() => service.ratePlugin('p', 'u', 6)).toThrow('Rating must be an integer between 1 and 5');
            expect(() => service.ratePlugin('p', 'u', 2.5)).toThrow('Rating must be an integer between 1 and 5');
        });
    });

    describe('getPluginStats', () => {
        it('should return correct average and counts', () => {
            service.ratePlugin('plugin-a', 'u1', 5);
            service.ratePlugin('plugin-a', 'u2', 3);
            service.ratePlugin('plugin-a', 'u3', 4, 'Nice');

            const stats = service.getPluginStats('plugin-a');
            expect(stats.averageRating).toBe(4);
            expect(stats.totalRatings).toBe(3);
            expect(stats.reviewCount).toBe(1);
        });

        it('should return zeros for unknown plugin', () => {
            const stats = service.getPluginStats('nonexistent');
            expect(stats.averageRating).toBe(0);
            expect(stats.totalRatings).toBe(0);
            expect(stats.totalDownloads).toBe(0);
        });
    });

    describe('getPluginReviews', () => {
        it('should return paginated reviews', () => {
            service.ratePlugin('p1', 'u1', 5, 'Great');
            service.ratePlugin('p1', 'u2', 4, 'Good');
            service.ratePlugin('p1', 'u3', 3);

            const page1 = service.getPluginReviews('p1', 1, 1);
            expect(page1).toHaveLength(1);

            const page2 = service.getPluginReviews('p1', 2, 1);
            expect(page2).toHaveLength(1);
            expect(page2[0].review).not.toBe(page1[0].review);
        });
    });

    describe('getTopRatedPlugins', () => {
        it('should return plugins sorted by average rating', () => {
            service.ratePlugin('p1', 'u1', 5);
            service.ratePlugin('p2', 'u1', 3);
            service.ratePlugin('p3', 'u1', 4);

            const top = service.getTopRatedPlugins(2);
            expect(top).toHaveLength(2);
            expect(top[0].pluginId).toBe('p1');
            expect(top[1].pluginId).toBe('p3');
        });
    });

    describe('getMostDownloadedPlugins', () => {
        it('should return plugins sorted by downloads', () => {
            service.recordDownload('p1');
            service.recordDownload('p2');
            service.recordDownload('p2');
            service.recordDownload('p2');

            const top = service.getMostDownloadedPlugins(2);
            expect(top).toHaveLength(2);
            expect(top[0].pluginId).toBe('p2');
            expect(top[0].totalDownloads).toBe(3);
        });
    });

    describe('recordDownload', () => {
        it('should increment download count', () => {
            service.recordDownload('plugin-x');
            service.recordDownload('plugin-x');

            const stats = service.getPluginStats('plugin-x');
            expect(stats.totalDownloads).toBe(2);
            expect(stats.weeklyDownloads).toBe(2);
        });
    });

    describe('persistence', () => {
        it('should persist and reload data across instances', async () => {
            service.ratePlugin('p1', 'u1', 5, 'Amazing');
            service.recordDownload('p1');
            await service.cleanup();

            const dataFile = path.join(testDir, 'marketplace-ratings.json');
            expect(fs.existsSync(dataFile)).toBe(true);

            const raw = fs.readFileSync(dataFile, 'utf-8');
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            expect(parsed).toHaveProperty('ratings');
            expect(parsed).toHaveProperty('downloads');

            const newService = new MarketplaceRatingsService(testDir);
            await newService.initialize();

            const stats = newService.getPluginStats('p1');
            expect(stats.totalRatings).toBe(1);
            expect(stats.totalDownloads).toBe(1);
            expect(stats.averageRating).toBe(5);

            await newService.cleanup();
        });
    });
});
