/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { UserBehaviorRecord } from '@shared/schemas/user-behavior.schema';
import { JsonObject } from '@shared/types/common';
import { SystemEvents } from '@shared/types/events';

/**
 * UserBehaviorService tracks local user interactions to provide personalized
 * defaults and recommendations within the application.
 * 
 * Part of FEAT-05: User behavior learning.
 */
export class UserBehaviorService extends BaseService {
    constructor(
        private database: DatabaseService,
        private eventBus: EventBusService
    ) {
        super('UserBehaviorService');
    }

    private unsubscribers: (() => void)[] = [];

    async initialize(): Promise<void> {
        this.logInfo('Initializing User Behavior Service...');

        // Listen to user interaction events
        this.unsubscribers.push(this.eventBus.on('user:feature-used', (payload) => void this.handleFeatureUsed(payload)));
        this.unsubscribers.push(this.eventBus.on('user:model-selected', (payload) => void this.handleModelSelected(payload)));
        this.unsubscribers.push(this.eventBus.on('user:chat-sent', (payload) => void this.handleChatSent(payload)));
        this.unsubscribers.push(this.eventBus.on('user:shortcut-used', (payload) => void this.handleShortcutUsed(payload)));

        this.logInfo('User Behavior Service initialized.');
    }

    async dispose(): Promise<void> {
        this.logInfo('Disposing User Behavior Service...');
        for (const unsubscribe of this.unsubscribers) {
            unsubscribe();
        }
        this.unsubscribers = [];
        this.logInfo('User Behavior Service disposed.');
    }

    /**
     * Handles feature usage tracking
     */
    private async handleFeatureUsed(payload: SystemEvents['user:feature-used']): Promise<void> {
        await this.database.userBehavior.trackInteraction(
            'feature_usage',
            payload.featureId,
            payload.metadata as JsonObject
        );
    }

    /**
     * Handles model selection tracking
     */
    private async handleModelSelected(payload: SystemEvents['user:model-selected']): Promise<void> {
        const key = `${payload.provider}:${payload.modelId}`;
        await this.database.userBehavior.trackInteraction('model_selection', key, {
            provider: payload.provider,
            modelId: payload.modelId
        });
    }

    /**
     * Handles chat sent tracking
     */
    private async handleChatSent(payload: SystemEvents['user:chat-sent']): Promise<void> {
        await this.database.userBehavior.trackInteraction('chat_activity', payload.modelId, {
            messageLength: payload.messageLength
        });
    }

    /**
     * Handles shortcut usage tracking
     */
    private async handleShortcutUsed(payload: SystemEvents['user:shortcut-used']): Promise<void> {
        await this.database.userBehavior.trackInteraction('shortcut_usage', payload.shortcut);
    }

    /**
     * Gets personalized model recommendations based on usage frequency.
     */
    async getModelRecommendations(limit: number = 3): Promise<string[]> {
        const interactions = await this.database.userBehavior.getTopInteractions('model_selection', limit);
        return interactions.map(record => record.eventKey);
    }

    /**
     * Gets frequently used features.
     */
    async getFrequentFeatures(limit: number = 5): Promise<string[]> {
        const interactions = await this.database.userBehavior.getTopInteractions('feature_usage', limit);
        return interactions.map(record => record.eventKey);
    }

    /**
     * Gets recent activity summary.
     */
    async getRecentActivity(limit: number = 10): Promise<UserBehaviorRecord[]> {
        return await this.database.userBehavior.getRecentInteractions(limit);
    }
}
