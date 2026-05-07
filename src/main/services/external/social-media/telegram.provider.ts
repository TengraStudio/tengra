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
import type { JsonValue } from '@shared/types/common';
import axios, { AxiosError } from 'axios';

import { SocialMediaMessage, SocialMediaProvider } from './social-media.types';

export interface TelegramConfig {
    enabled: boolean;
    token: string;
    allowedUserIds: string[];
}

interface TelegramApiResponse {
    ok: boolean;
    result: TelegramApiResult;
    description?: string;
}

interface TelegramApiResult {
    username?: string;
    update_id?: number;
    message?: TelegramMessagePayload;
    [key: string]: JsonValue | TelegramMessagePayload | undefined;
}

interface TelegramMessagePayload {
    from: { id: number; first_name: string; last_name?: string };
    text?: string;
    date: number;
}

interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessagePayload;
}

export class TelegramProvider extends SocialMediaProvider {
    private token: string = '';
    private polling: boolean = false;
    private lastUpdateId: number = 0;
    private pollTimeout: ReturnType<typeof setTimeout> | null = null;
    private onMessageReceived: (message: SocialMediaMessage) => Promise<void>;

    constructor(onMessageReceived: (message: SocialMediaMessage) => Promise<void>) {
        super();
        this.onMessageReceived = onMessageReceived;
    }

    /** @see SocialMediaProvider.initialize */
    async initialize(config: Record<string, unknown>): Promise<void> {
        this.token = config.token as string;
        if (!this.token) {
            throw new Error('Telegram token is missing');
        }

        try {
            const me = await this.apiRequest<{ username: string }>('getMe');
            appLogger.info('TelegramProvider', `IconRobot @${me.username} is connected.`);
            this.startPolling();
        } catch (error) {
            appLogger.error('TelegramProvider', 'Failed to initialize bot', error as Error);
            throw error;
        }
    }

    /** Make a typed request to the Telegram IconRobot API */
    private async apiRequest<T = TelegramApiResult>(method: string, data: Record<string, unknown> = {}): Promise<T> {
        const url = `https://api.telegram.org/bot${this.token}/${method}`;
        try {
            const response = await axios.post<TelegramApiResponse>(url, data, { timeout: 35_000 });
            if (response.data.ok) {
                return response.data.result as T;
            }
            throw new Error(`Telegram API error: ${response.data.description ?? 'unknown'}`);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const axiosErr = error as AxiosError<{ description?: string }>;
                if (axiosErr.response) {
                    throw new Error(`Telegram API failure (${axiosErr.response.status}): ${axiosErr.response.data?.description ?? 'unknown'}`);
                }
            }
            throw error;
        }
    }

    /** Start long-polling for updates */
    private startPolling(): void {
        if (this.polling) { return; }
        this.polling = true;
        void this.poll();
    }

    /** Poll for new messages from Telegram */
    private async poll(): Promise<void> {
        if (!this.polling) { return; }

        try {
            const updates = await this.apiRequest<TelegramUpdate[]>('getUpdates', {
                offset: this.lastUpdateId + 1,
                timeout: 30,
            });

            const MAX_UPDATES = 100;
            for (let i = 0; i < updates.length && i < MAX_UPDATES; i++) {
                const update = updates[i];
                this.lastUpdateId = update.update_id;
                if (update.message) {
                    await this.processMessage(update.message);
                }
            }
        } catch (error) {
            appLogger.error('TelegramProvider', 'Polling error', error as Error);
            // Wait before retry
            await new Promise<void>(resolve => {
                setTimeout(resolve, 5000);
            });
        }

        if (this.polling) {
            this.pollTimeout = setTimeout(() => { void this.poll(); }, 100);
        }
    }

    /** Process a Telegram message into a SocialMediaMessage */
    private async processMessage(msg: TelegramMessagePayload): Promise<void> {
        const userId = String(msg.from.id);
        const userName = msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : '');
        const text = msg.text ?? '';

        const reply = async (replyText: string) => {
            await this.sendMessage(userId, replyText);
        };

        await this.onMessageReceived({
            platform: 'telegram',
            userId,
            userName,
            content: text,
            timestamp: msg.date * 1000,
            reply,
        });
    }

    /** @see SocialMediaProvider.sendMessage */
    async sendMessage(userId: string, text: string): Promise<boolean> {
        try {
            await this.apiRequest('sendMessage', {
                chat_id: userId,
                text,
                parse_mode: 'Markdown',
            });
            return true;
        } catch (error) {
            appLogger.error('TelegramProvider', `Failed to send message to ${userId}`, error as Error);
            return false;
        }
    }

    /** @see SocialMediaProvider.stop */
    async stop(): Promise<void> {
        this.polling = false;
        if (this.pollTimeout) {
            clearTimeout(this.pollTimeout);
            this.pollTimeout = null;
        }
        appLogger.info('TelegramProvider', 'Stopped');
    }
}

