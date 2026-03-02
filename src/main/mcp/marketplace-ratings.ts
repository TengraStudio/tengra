import * as fs from 'fs';
import * as path from 'path';

import { BaseService } from '@main/services/base.service';

/** A single user rating for a plugin. */
export interface PluginRating {
    pluginId: string;
    userId: string;
    rating: number;
    review?: string;
    createdAt: number;
    updatedAt: number;
}

/** Aggregated statistics for a plugin. */
export interface PluginStats {
    pluginId: string;
    averageRating: number;
    totalRatings: number;
    totalDownloads: number;
    weeklyDownloads: number;
    reviewCount: number;
}

/** Internal download tracking record. */
interface DownloadRecord {
    pluginId: string;
    timestamp: number;
}

/** Shape of the persisted JSON data file. */
interface RatingsData {
    ratings: PluginRating[];
    downloads: DownloadRecord[];
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * MarketplaceRatingsService manages plugin ratings, reviews, and download statistics.
 * Data is persisted as a local JSON file.
 */
export class MarketplaceRatingsService extends BaseService {
    private ratings: PluginRating[] = [];
    private downloads: DownloadRecord[] = [];
    private readonly filePath: string;

    /**
     * @param dataDir - Directory path where the ratings JSON file will be stored.
     */
    constructor(dataDir: string) {
        super('MarketplaceRatingsService');
        this.filePath = path.join(dataDir, 'marketplace-ratings.json');
    }

    /** Load persisted ratings data from disk. */
    async initialize(): Promise<void> {
        this.logInfo('Initializing marketplace ratings...');
        this.loadFromDisk();
    }

    /** Save current state to disk on shutdown. */
    async cleanup(): Promise<void> {
        this.logInfo('Saving marketplace ratings...');
        this.saveToDisk();
    }

    /**
     * Submit or update a rating for a plugin.
     * @param pluginId - The plugin to rate.
     * @param userId - The user submitting the rating.
     * @param rating - Numeric rating (1–5).
     * @param review - Optional review text.
     * @returns The created or updated PluginRating.
     */
    ratePlugin(pluginId: string, userId: string, rating: number, review?: string): PluginRating {
        if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
            throw new Error('Rating must be an integer between 1 and 5');
        }

        const existing = this.ratings.find(r => r.pluginId === pluginId && r.userId === userId);
        const now = Date.now();

        if (existing) {
            existing.rating = rating;
            existing.review = review;
            existing.updatedAt = now;
            this.saveToDisk();
            return existing;
        }

        const newRating: PluginRating = { pluginId, userId, rating, review, createdAt: now, updatedAt: now };
        this.ratings.push(newRating);
        this.saveToDisk();
        return newRating;
    }

    /**
     * Get aggregated statistics for a plugin.
     * @param pluginId - The plugin ID.
     * @returns PluginStats for the given plugin.
     */
    getPluginStats(pluginId: string): PluginStats {
        const pluginRatings = this.ratings.filter(r => r.pluginId === pluginId);
        const pluginDownloads = this.downloads.filter(d => d.pluginId === pluginId);
        const weekAgo = Date.now() - SEVEN_DAYS_MS;

        const sum = pluginRatings.reduce((acc, r) => acc + r.rating, 0);
        const avg = pluginRatings.length > 0 ? sum / pluginRatings.length : 0;

        return {
            pluginId,
            averageRating: Math.round(avg * 100) / 100,
            totalRatings: pluginRatings.length,
            totalDownloads: pluginDownloads.length,
            weeklyDownloads: pluginDownloads.filter(d => d.timestamp >= weekAgo).length,
            reviewCount: pluginRatings.filter(r => r.review !== undefined && r.review.length > 0).length,
        };
    }

    /**
     * Get paginated reviews for a plugin.
     * @param pluginId - The plugin ID.
     * @param page - Page number (1-based).
     * @param limit - Number of results per page.
     * @returns Array of PluginRating entries that have reviews.
     */
    getPluginReviews(pluginId: string, page: number, limit: number): PluginRating[] {
        const reviews = this.ratings
            .filter(r => r.pluginId === pluginId && r.review !== undefined && r.review.length > 0)
            .sort((a, b) => b.createdAt - a.createdAt);

        const start = (page - 1) * limit;
        return reviews.slice(start, start + limit);
    }

    /**
     * Get the top-rated plugins ordered by average rating.
     * @param limit - Maximum number of plugins to return.
     * @returns Array of PluginStats sorted by average rating descending.
     */
    getTopRatedPlugins(limit: number): PluginStats[] {
        const pluginIds = this.getUniquePluginIds();
        return pluginIds
            .map(id => this.getPluginStats(id))
            .filter(s => s.totalRatings > 0)
            .sort((a, b) => b.averageRating - a.averageRating)
            .slice(0, limit);
    }

    /**
     * Get the most downloaded plugins ordered by total downloads.
     * @param limit - Maximum number of plugins to return.
     * @returns Array of PluginStats sorted by total downloads descending.
     */
    getMostDownloadedPlugins(limit: number): PluginStats[] {
        const pluginIds = this.getUniquePluginIds();
        return pluginIds
            .map(id => this.getPluginStats(id))
            .sort((a, b) => b.totalDownloads - a.totalDownloads)
            .slice(0, limit);
    }

    /**
     * Record a download event for a plugin.
     * @param pluginId - The downloaded plugin's ID.
     */
    recordDownload(pluginId: string): void {
        this.downloads.push({ pluginId, timestamp: Date.now() });
        this.saveToDisk();
    }

    /** Collect unique plugin IDs from ratings and downloads. */
    private getUniquePluginIds(): string[] {
        const ids = new Set<string>();
        for (const r of this.ratings) {ids.add(r.pluginId);}
        for (const d of this.downloads) {ids.add(d.pluginId);}
        return [...ids];
    }

    /** Load data from the JSON file on disk. */
    private loadFromDisk(): void {
        try {
            if (fs.existsSync(this.filePath)) {
                const raw = fs.readFileSync(this.filePath, 'utf-8');
                const data = JSON.parse(raw) as RatingsData;
                this.ratings = data.ratings ?? [];
                this.downloads = data.downloads ?? [];
                this.logInfo(`Loaded ${this.ratings.length} ratings, ${this.downloads.length} downloads`);
            }
        } catch (err) {
            this.logError('Failed to load ratings data', err);
            this.ratings = [];
            this.downloads = [];
        }
    }

    /** Persist current data to the JSON file on disk. */
    private saveToDisk(): void {
        try {
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const data: RatingsData = { ratings: this.ratings, downloads: this.downloads };
            fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
        } catch (err) {
            this.logError('Failed to save ratings data', err);
        }
    }
}
