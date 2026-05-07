/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { EventBusService } from '@main/services/system/event-bus.service';

import { SocialMediaService } from './social-media.service';

/** Platforms that support proactive notifications */
type NotificationPlatform = 'discord' | 'telegram';

/**
 * Dispatches proactive notifications to social media platforms
 * when tasks complete, system events occur, or scheduled alerts fire.
 */
export class NotificationDispatcherService extends BaseService {
    private unsubscribeFns: Array<() => void> = [];

    constructor(
        private socialMediaService: SocialMediaService,
        private eventBusService: EventBusService
    ) {
        super('NotificationDispatcherService');
    }

    /** @see BaseService.initialize */
    async initialize(): Promise<void> {
        this.subscribeToTaskEvents();
        this.subscribeToCronEvents();
        this.subscribeToImageEvents();
        appLogger.info('NotificationDispatcherService', 'Initialized — listening for notification events');
    }

    /** Listen for task-completed events and broadcast to enabled platforms */
    private subscribeToTaskEvents(): void {
        const unsub = this.eventBusService.on('notification:task-completed', (payload) => {
            const { taskId, summary, platform, timestamp } = payload;

            const formattedMessage = `✅ *Task Completed*\n\n${summary}\n\n_ID: ${taskId} · ${new Date(timestamp).toLocaleTimeString()}_`;

            if (platform) {
                void this.sendToSinglePlatform(platform, formattedMessage);
            } else {
                void this.broadcastToAll(formattedMessage);
            }
        });

        this.unsubscribeFns.push(unsub);
    }

    /** Listen for cron-triggered events and send messages to configured platforms */
    private subscribeToCronEvents(): void {
        const unsub = this.eventBusService.on('notification:cron-triggered', (payload) => {
            const { cronId, label, message, timestamp } = payload;

            const formattedMessage = `⏰ *Scheduled: ${label}*\n\n${message}\n\n_Job: ${cronId} · ${new Date(timestamp).toLocaleTimeString()}_`;

            void this.broadcastToAll(formattedMessage);
        });

        this.unsubscribeFns.push(unsub);
    }

    /** Listen for image schedule completion/failure alerts */
    private subscribeToImageEvents(): void {
        const unsub = this.eventBusService.on('image:schedule-alert', (payload) => {
            const { taskId, status, prompt, error, timestamp } = payload;

            const statusEmoji = status === 'completed' ? '🖼️' : status === 'failed' ? '❌' : '🚫';
            const statusLabel = status === 'completed' ? 'Image Ready' : status === 'failed' ? 'Image Failed' : 'Image Cancelled';
            const errorLine = error ? `\n\n_Error: ${error}_` : '';

            const formattedMessage = `${statusEmoji} *${statusLabel}*\n\nPrompt: "${prompt}"${errorLine}\n\n_Task: ${taskId} · ${new Date(timestamp).toLocaleTimeString()}_`;

            void this.broadcastToAll(formattedMessage);
        });

        this.unsubscribeFns.push(unsub);
    }

    /** Send a notification to a specific platform's active users */
    private async sendToSinglePlatform(platform: NotificationPlatform, message: string): Promise<void> {
        const targets = this.socialMediaService.getNotificationTargets(platform);
        const MAX_TARGETS = 50;

        for (let i = 0; i < targets.length && i < MAX_TARGETS; i++) {
            const sent = await this.socialMediaService.sendNotification(platform, targets[i], message);
            if (!sent) {
                appLogger.warn('NotificationDispatcherService', `Failed to notify ${platform}:${targets[i]}`);
            }
        }
    }

    /** Broadcast to all enabled notification platforms */
    private async broadcastToAll(message: string): Promise<void> {
        const platforms: NotificationPlatform[] = ['discord', 'telegram'];
        const MAX_PLATFORMS = 5;

        for (let p = 0; p < platforms.length && p < MAX_PLATFORMS; p++) {
            await this.sendToSinglePlatform(platforms[p], message);
        }
    }

    /** @see BaseService.cleanup */
    async cleanup(): Promise<void> {
        for (const unsub of this.unsubscribeFns) {
            unsub();
        }
        this.unsubscribeFns = [];
        appLogger.info('NotificationDispatcherService', 'Cleaned up');
    }
}

