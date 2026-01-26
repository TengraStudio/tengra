/**
 * Time Tracking Service
 * Tracks app online time, coding time, and per-project coding time
 */

import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { v4 as uuidv4 } from 'uuid';

export interface TimeTrackingRecord {
    id: string
    type: 'app_online' | 'coding' | 'project_coding'
    projectId?: string
    startTime: number
    endTime?: number
    durationMs: number
    createdAt: number
    updatedAt: number
}

export interface TimeTrackingStats {
    totalOnlineTime: number // in milliseconds
    totalCodingTime: number // in milliseconds
    projectCodingTime: Record<string, number> // projectId -> milliseconds
}

export class TimeTrackingService extends BaseService {
    private appStartTime: number | null = null;
    private codingStartTime: number | null = null;
    private projectStartTimes: Map<string, number> = new Map();
    private saveInterval: NodeJS.Timeout | null = null;
    private isTracking = false;

    constructor(
        private databaseService: DatabaseService
    ) {
        super('TimeTrackingService');
    }

    async initialize(): Promise<void> {
        // Load any incomplete sessions on startup
        await this.resumeTracking();

        // Start tracking app online time
        this.startAppTracking();

        // Save tracking data every 60 seconds
        this.saveInterval = setInterval(() => {
            this.saveCurrentTracking().catch(err => {
                this.logError('Failed to save current tracking', err);
            });
        }, 60000);
    }

    async cleanup(): Promise<void> {
        // Stop tracking and save final times
        await this.stopAppTracking();
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
            this.saveInterval = null;
        }
    }

    /**
     * Start tracking app online time
     */
    startAppTracking(): void {
        if (this.isTracking) { return; }
        this.isTracking = true;
        this.appStartTime = Date.now();
        this.logInfo('Started app tracking');
    }

    /**
     * Stop tracking app online time and save
     */
    async stopAppTracking(): Promise<void> {
        if (!this.isTracking || !this.appStartTime) { return; }
        const endTime = Date.now();
        const duration = endTime - this.appStartTime;

        await this.recordTime({
            type: 'app_online',
            startTime: this.appStartTime,
            endTime,
            durationMs: duration
        });

        this.appStartTime = null;
        this.isTracking = false;
        this.logInfo('Stopped app tracking');
    }

    /**
     * Start tracking coding time (when a project is active)
     */
    startCodingTracking(projectId?: string): void {
        if (projectId) {
            this.projectStartTimes.set(projectId, Date.now());
        } else {
            this.codingStartTime = Date.now();
        }
    }

    /**
     * Stop tracking coding time for a project
     */
    async stopCodingTracking(projectId?: string): Promise<void> {
        const now = Date.now();

        if (projectId) {
            const startTime = this.projectStartTimes.get(projectId);
            if (startTime) {
                const duration = now - startTime;
                await this.recordTime({
                    type: 'project_coding',
                    projectId,
                    startTime,
                    endTime: now,
                    durationMs: duration
                });
                this.projectStartTimes.delete(projectId);
            }
        } else {
            if (this.codingStartTime) {
                const duration = now - this.codingStartTime;
                await this.recordTime({
                    type: 'coding',
                    startTime: this.codingStartTime,
                    endTime: now,
                    durationMs: duration
                });
                this.codingStartTime = null;
            }
        }
    }

    /**
     * Record a time tracking entry
     */
    private async recordTime(record: Omit<TimeTrackingRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
        try {
            const db = this.databaseService.getDatabase();
            const id = uuidv4();
            const now = Date.now();

            await db.prepare(`
                INSERT INTO time_tracking (id, type, project_id, start_time, end_time, duration_ms, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                id,
                record.type,
                record.projectId ?? null,
                record.startTime,
                record.endTime ?? null,
                record.durationMs,
                now,
                now
            );
        } catch (error) {
            this.logError('Failed to record time', error);
        }
    }

    /**
     * Save current tracking state (called periodically)
     */
    private async saveCurrentTracking(): Promise<void> {
        // Save app online time if tracking
        if (this.isTracking && this.appStartTime) {
            // We don't want to save incomplete sessions here, just continue tracking
            // Complete sessions are saved when stopAppTracking is called
        }
    }

    /**
     * Resume tracking from incomplete sessions (on app startup)
     */
    private async resumeTracking(): Promise<void> {
        // On startup, we assume the app was closed, so we don't resume incomplete sessions
        // This is by design - we only track active sessions
    }

    /**
     * Get total statistics
     */
    async getTimeStats(): Promise<TimeTrackingStats> {
        try {
            const db = this.databaseService.getDatabase();

            // Get total app online time
            const appOnlineResult = await db.prepare(`
                SELECT COALESCE(SUM(duration_ms), 0) as total
                FROM time_tracking
                WHERE type = 'app_online'
            `).get() as { total: number };

            // Get total coding time
            const codingResult = await db.prepare(`
                SELECT COALESCE(SUM(duration_ms), 0) as total
                FROM time_tracking
                WHERE type = 'coding'
            `).get() as { total: number };

            // Get per-project coding time
            const projectResult = await db.prepare(`
                SELECT project_id, COALESCE(SUM(duration_ms), 0) as total
                FROM time_tracking
                WHERE type = 'project_coding' AND project_id IS NOT NULL
                GROUP BY project_id
            `).all() as Array<{ project_id: string; total: number }>;

            const projectCodingTime: Record<string, number> = {};
            for (const row of projectResult) {
                projectCodingTime[row.project_id] = row.total;
            }

            // Add current active tracking time
            const currentAppTime = this.isTracking && this.appStartTime
                ? Date.now() - this.appStartTime
                : 0;
            const currentCodingTime = this.codingStartTime
                ? Date.now() - this.codingStartTime
                : 0;

            // Add current project times
            for (const [projectId, startTime] of this.projectStartTimes.entries()) {
                const currentTime = Date.now() - startTime;
                projectCodingTime[projectId] = (projectCodingTime[projectId] ?? 0) + currentTime;
            }

            return {
                totalOnlineTime: appOnlineResult.total + currentAppTime,
                totalCodingTime: codingResult.total + currentCodingTime,
                projectCodingTime
            };
        } catch (error) {
            this.logError('Failed to get time stats', error);
            return {
                totalOnlineTime: 0,
                totalCodingTime: 0,
                projectCodingTime: {}
            };
        }
    }
}