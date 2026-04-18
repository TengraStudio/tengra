/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { NotificationDispatcherService } from '@main/services/external/notification-dispatcher.service';
import { SocialMediaService } from '@main/services/external/social-media.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { SystemEvents } from '@shared/types/events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}));

type EventKey = keyof Pick<SystemEvents, 'notification:task-completed' | 'notification:cron-triggered' | 'image:schedule-alert'>;
type TaskCompletedHandler = (payload: SystemEvents['notification:task-completed']) => void;
type CronTriggeredHandler = (payload: SystemEvents['notification:cron-triggered']) => void;
type ImageAlertHandler = (payload: SystemEvents['image:schedule-alert']) => void;

describe('NotificationDispatcherService', () => {
    let service: NotificationDispatcherService;
    let taskCompletedHandler: TaskCompletedHandler | undefined;
    let cronTriggeredHandler: CronTriggeredHandler | undefined;
    let imageAlertHandler: ImageAlertHandler | undefined;
    let mockSocialMediaService: {
        getNotificationTargets: ReturnType<typeof vi.fn>;
        sendNotification: ReturnType<typeof vi.fn>;
    };
    let mockEventBusService: {
        on: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        taskCompletedHandler = undefined;
        cronTriggeredHandler = undefined;
        imageAlertHandler = undefined;

        mockSocialMediaService = {
            getNotificationTargets: vi.fn((platform: string) => {
                if (platform === 'discord') {
                    return ['discord-user-1'];
                }
                if (platform === 'telegram') {
                    return ['telegram-user-1', 'telegram-user-2'];
                }
                return [];
            }),
            sendNotification: vi.fn().mockResolvedValue(true),
        };

        mockEventBusService = {
            on: vi.fn((event: EventKey, handler: TaskCompletedHandler | CronTriggeredHandler | ImageAlertHandler) => {
                if (event === 'notification:task-completed') {
                    taskCompletedHandler = handler as TaskCompletedHandler;
                } else if (event === 'notification:cron-triggered') {
                    cronTriggeredHandler = handler as CronTriggeredHandler;
                } else {
                    imageAlertHandler = handler as ImageAlertHandler;
                }
                return vi.fn();
            }),
        };

        service = new NotificationDispatcherService(
            mockSocialMediaService as never as SocialMediaService,
            mockEventBusService as never as EventBusService
        );
    });

    afterEach(async () => {
        await service.cleanup();
    });

    it('broadcasts finished task notifications to discord and telegram targets', async () => {
        await service.initialize();

        expect(cronTriggeredHandler).toBeDefined();
        expect(imageAlertHandler).toBeDefined();
        taskCompletedHandler?.({
            taskId: 'task-123',
            summary: 'Implementation finished',
            timestamp: Date.now(),
        });
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockSocialMediaService.sendNotification).toHaveBeenCalledWith(
            'discord',
            'discord-user-1',
            expect.stringContaining('Task Completed')
        );
        expect(mockSocialMediaService.sendNotification).toHaveBeenCalledWith(
            'telegram',
            'telegram-user-1',
            expect.stringContaining('Task Completed')
        );
        expect(mockSocialMediaService.sendNotification).toHaveBeenCalledWith(
            'telegram',
            'telegram-user-2',
            expect.stringContaining('Task Completed')
        );
    });

    it('dispatches to a single platform when payload specifies platform', async () => {
        await service.initialize();

        taskCompletedHandler?.({
            taskId: 'task-456',
            summary: 'Only telegram',
            platform: 'telegram',
            timestamp: Date.now(),
        });
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockSocialMediaService.sendNotification).toHaveBeenCalledTimes(2);
        expect(mockSocialMediaService.sendNotification).toHaveBeenNthCalledWith(
            1,
            'telegram',
            'telegram-user-1',
            expect.any(String)
        );
        expect(mockSocialMediaService.sendNotification).toHaveBeenNthCalledWith(
            2,
            'telegram',
            'telegram-user-2',
            expect.any(String)
        );
    });
});
