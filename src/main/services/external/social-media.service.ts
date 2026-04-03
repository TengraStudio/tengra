import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { LLMService } from '@main/services/llm/llm.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { SettingsService } from '@main/services/system/settings.service';
import { Message } from '@shared/types/chat';
import { AppSettings } from '@shared/types/settings';

import { DiscordProvider } from './social-media/discord.provider';
import { SocialMediaMessage, SocialMediaProvider } from './social-media/social-media.types';
import { TelegramProvider } from './social-media/telegram.provider';
import { WhatsAppProvider } from './social-media/whatsapp.provider';

/** Maximum response length sent back to social platforms */
const MAX_REPLY_LENGTH = 1800;

/**
 * Service that manages social media bot providers (Discord, Telegram, WhatsApp)
 * and routes incoming messages through the LLM pipeline for AI-powered responses.
 */
export class SocialMediaService extends BaseService {
    private providers: Map<string, SocialMediaProvider> = new Map();

    constructor(
        private settingsService: SettingsService,
        private llmService?: LLMService,
        private eventBusService?: EventBusService
    ) {
        super('SocialMediaService');
    }

    /** Inject LLMService after construction (for circular dependency avoidance) */
    setLLMService(llmService: LLMService): void {
        this.llmService = llmService;
    }

    /** Inject EventBusService after construction */
    setEventBusService(eventBusService: EventBusService): void {
        this.eventBusService = eventBusService;
    }

    /** @see BaseService.initialize */
    async initialize(): Promise<void> {
        const settings = this.settingsService.getSettings();
        await this.syncProviders(settings);
        appLogger.info('SocialMediaService', 'Initialized');
    }

    /** Synchronize providers based on current settings */
    private async syncProviders(settings: AppSettings): Promise<void> {
        const remote = settings.remoteAccounts;
        if (!remote) { return; }

        // Discord
        if (remote.discord?.enabled && remote.discord.token) {
            await this.ensureProvider('discord', remote.discord);
        } else {
            await this.stopProvider('discord');
        }

        // Telegram
        if (remote.telegram?.enabled && remote.telegram.token) {
            await this.ensureProvider('telegram', remote.telegram);
        } else {
            await this.stopProvider('telegram');
        }

        // WhatsApp
        if (remote.whatsapp?.enabled && remote.whatsapp.token) {
            await this.ensureProvider('whatsapp', remote.whatsapp);
        } else {
            await this.stopProvider('whatsapp');
        }
    }

    /** Start a provider if not already running */
    private async ensureProvider(type: string, config: Record<string, unknown>): Promise<void> {
        if (this.providers.has(type)) {
            return;
        }

        try {
            appLogger.info('SocialMediaService', `Starting ${type} provider...`);

            let provider: SocialMediaProvider | undefined;

            if (type === 'telegram') {
                provider = new TelegramProvider(this.handleIncomingMessage.bind(this));
            } else if (type === 'discord') {
                provider = new DiscordProvider(this.handleIncomingMessage.bind(this));
            } else if (type === 'whatsapp') {
                provider = new WhatsAppProvider(this.handleIncomingMessage.bind(this));
            }

            if (provider) {
                await provider.initialize(config);
                this.providers.set(type, provider);
            }
        } catch (error) {
            appLogger.error('SocialMediaService', `Failed to start ${type} provider`, error as Error);
        }
    }

    /** Stop a running provider */
    private async stopProvider(type: string): Promise<void> {
        const provider = this.providers.get(type);
        if (provider) {
            await provider.stop();
            this.providers.delete(type);
            appLogger.info('SocialMediaService', `Stopped ${type} provider`);
        }
    }

    /** Handle an incoming message from any platform */
    async handleIncomingMessage(message: SocialMediaMessage): Promise<void> {
        // Whitelist check
        const settings = this.settingsService.getSettings();
        const remote = settings.remoteAccounts;

        if (!remote) { return; }

        const platformKey = message.platform as keyof typeof remote;
        const platformConfig = remote[platformKey] as { allowedUserIds: string[] } | undefined;
        if (!platformConfig?.allowedUserIds.includes(message.userId)) {
            appLogger.warn('SocialMediaService', `Unauthorized message from ${message.platform} user: ${message.userId}`);
            await message.reply('⛔ Unauthorized. Please add your ID to the Tengra whitelist.');
            return;
        }

        appLogger.info('SocialMediaService', `Message from ${message.platform} (${message.userName}): ${message.content}`);

        // Route through LLM if available
        if (this.llmService) {
            await this.routeToLLM(message);
        } else {
            await message.reply('🤖 Tengra AI is not currently available. Please try again later.');
        }
    }

    /** Route a social media message through the LLM pipeline */
    private async routeToLLM(message: SocialMediaMessage): Promise<void> {
        try {
            const settings = this.settingsService.getSettings();
            const model = settings.general?.defaultModel ?? settings.general?.lastModel ?? 'gpt-4o';
            const provider = settings.general?.lastProvider ?? 'antigravity';

            const messages: Message[] = [
                {
                    id: `system-remote-${Date.now()}`,
                    role: 'system',
                    content: `You are Tengra AI Assistant responding via ${message.platform}. Keep responses concise (under ${MAX_REPLY_LENGTH} characters) and use markdown sparingly (only bold and italic). The user's name is ${message.userName}.`,
                    timestamp: new Date(),
                },
                {
                    id: `user-remote-${Date.now()}`,
                    role: 'user',
                    content: message.content,
                    timestamp: new Date(message.timestamp),
                },
            ];

            const result = await this.llmService!.chat(messages, model, undefined, provider);
            const responseText = this.truncateResponse(result.content);

            await message.reply(responseText);

            appLogger.info('SocialMediaService', `Replied to ${message.platform} (${message.userName}) via ${provider}/${model}`);
        } catch (error) {
            appLogger.error('SocialMediaService', 'Failed to route message to LLM', error as Error);
            await message.reply('❌ An error occurred while processing your message. Please try again.');
        }
    }

    /** Truncate response to fit platform message limits */
    private truncateResponse(text: string): string {
        if (text.length <= MAX_REPLY_LENGTH) { return text; }
        return text.slice(0, MAX_REPLY_LENGTH - 3) + '...';
    }

    /**
     * Get notification-eligible user IDs for a given platform.
     * Returns the allowedUserIds for platforms with notifications enabled.
     */
    getNotificationTargets(platform: string): string[] {
        const settings = this.settingsService.getSettings();
        const remote = settings.remoteAccounts;
        if (!remote) { return []; }

        const platformKey = platform as keyof typeof remote;
        const config = remote[platformKey] as
            | { enabled: boolean; notifications?: boolean; allowedUserIds: string[] }
            | undefined;

        if (!config?.enabled || config.notifications === false) {
            return [];
        }

        return config.allowedUserIds ?? [];
    }

    /**
     * Send a notification message to a specific user on a specific platform.
     * Returns true if sent successfully.
     */
    async sendNotification(platform: string, userId: string, text: string): Promise<boolean> {
        const provider = this.providers.get(platform);
        if (!provider) {
            appLogger.warn('SocialMediaService', `No active provider for ${platform}, skipping notification`);
            return false;
        }

        return provider.sendMessage(userId, text);
    }

    /**
     * Broadcast a proactive notification to all enabled platforms and their whitelisted users.
     * Called by NotificationDispatcherService when tasks complete or cron jobs fire.
     */
    async broadcastNotification(text: string): Promise<void> {
        const platforms = ['discord', 'telegram'] as const;
        const MAX_PLATFORMS = 5;

        for (let p = 0; p < platforms.length && p < MAX_PLATFORMS; p++) {
            const targets = this.getNotificationTargets(platforms[p]);
            const MAX_TARGETS = 50;

            for (let t = 0; t < targets.length && t < MAX_TARGETS; t++) {
                const sent = await this.sendNotification(platforms[p], targets[t], text);
                if (!sent) {
                    appLogger.warn('SocialMediaService', `Failed to notify ${platforms[p]}:${targets[t]}`);
                }
            }
        }
    }

    /** Emit a task-completion notification via EventBus */
    emitTaskCompleted(taskId: string, summary: string): void {
        if (!this.eventBusService) { return; }

        this.eventBusService.emit('notification:task-completed', {
            taskId,
            summary,
            timestamp: Date.now(),
        });
    }

    /** @see BaseService.cleanup */
    async cleanup(): Promise<void> {
        for (const provider of this.providers.values()) {
            await provider.stop();
        }
        this.providers.clear();
    }
}
