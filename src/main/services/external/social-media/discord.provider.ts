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
import { Client, GatewayIntentBits, Message, Partials } from 'discord.js';

import { SocialMediaMessage, SocialMediaProvider } from './social-media.types';

export interface DiscordConfig {
    enabled: boolean;
    token: string;
    allowedUserIds: string[];
}

export class DiscordProvider extends SocialMediaProvider {
    private client: Client | null = null;
    private onMessageReceived: (message: SocialMediaMessage) => Promise<void>;

    constructor(onMessageReceived: (message: SocialMediaMessage) => Promise<void>) {
        super();
        this.onMessageReceived = onMessageReceived;
    }

    /** @see SocialMediaProvider.initialize */
    async initialize(config: Record<string, unknown>): Promise<void> {
        const token = config.token as string | undefined;
        if (!token) {
            throw new Error('Discord token is missing');
        }

        try {
            this.client = new Client({
                intents: [
                    GatewayIntentBits.Guilds,
                    GatewayIntentBits.GuildMessages,
                    GatewayIntentBits.DirectMessages,
                    GatewayIntentBits.MessageContent,
                ],
                partials: [Partials.Channel],
            });

            this.client.on('ready', () => {
                appLogger.info('DiscordProvider', `Logged in as ${this.client?.user?.tag ?? 'unknown'}`);
            });

            this.client.on('messageCreate', (msg: Message) => {
                if (msg.author.bot) { return; }
                void this.processMessage(msg);
            });

            await this.client.login(token);
        } catch (error) {
            appLogger.error('DiscordProvider', 'Failed to initialize bot', error as Error);
            throw error;
        }
    }

    /** Process a Discord message into a SocialMediaMessage */
    private async processMessage(msg: Message): Promise<void> {
        const userId = msg.author.id;
        const userName = msg.author.username;
        const text = msg.content ?? '';

        const reply = async (replyText: string) => {
            await msg.reply(replyText);
        };

        await this.onMessageReceived({
            platform: 'discord',
            userId,
            userName,
            content: text,
            timestamp: msg.createdTimestamp,
            reply,
        });
    }

    /** @see SocialMediaProvider.sendMessage */
    async sendMessage(userId: string, text: string): Promise<boolean> {
        if (!this.client) { return false; }
        try {
            const user = await this.client.users.fetch(userId);
            if (user) {
                await user.send(text);
                return true;
            }
            return false;
        } catch (error) {
            appLogger.error('DiscordProvider', `Failed to send DM to ${userId}`, error as Error);
            return false;
        }
    }

    /** @see SocialMediaProvider.stop */
    async stop(): Promise<void> {
        if (this.client) {
            await Promise.resolve(this.client.destroy());
            this.client = null;
        }
        appLogger.info('DiscordProvider', 'Stopped');
    }
}

