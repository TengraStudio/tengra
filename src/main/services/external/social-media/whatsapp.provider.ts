import { appLogger } from '@main/logging/logger';
import axios, { AxiosError } from 'axios';

import { SocialMediaMessage, SocialMediaProvider } from './social-media.types';

export interface WhatsAppConfig {
    enabled: boolean;
    mode: 'qr' | 'api';
    token?: string;
    botId?: string;
    allowedUserIds: string[];
}

/** WhatsApp Cloud API message response */
interface WhatsAppApiResponse {
    messaging_product: string;
    contacts?: Array<{ input: string; wa_id: string }>;
    messages?: Array<{ id: string }>;
    error?: { message: string; type: string; code: number };
}

/** WhatsApp incoming webhook message payload */
interface WhatsAppWebhookMessage {
    from: string;
    id: string;
    timestamp: string;
    text?: { body: string };
    type: string;
}

/** WhatsApp incoming webhook value */
interface WhatsAppWebhookValue {
    messaging_product: string;
    metadata: { display_phone_number: string; phone_number_id: string };
    contacts?: Array<{ profile: { name: string }; wa_id: string }>;
    messages?: WhatsAppWebhookMessage[];
}

/**
 * WhatsApp Business Cloud API provider.
 * Uses the Meta Graph API to send and receive messages.
 *
 * `mode: 'api'` → Uses WhatsApp Business API token + phone number ID (botId).
 * `mode: 'qr'` → Reserved for future WhatsApp Web bridge implementation.
 */
export class WhatsAppProvider extends SocialMediaProvider {
    private token: string = '';
    private phoneNumberId: string = '';
    private onMessageReceived: (message: SocialMediaMessage) => Promise<void>;

    private static readonly API_BASE = 'https://graph.facebook.com/v19.0';

    constructor(onMessageReceived: (message: SocialMediaMessage) => Promise<void>) {
        super();
        this.onMessageReceived = onMessageReceived;
    }

    /** @see SocialMediaProvider.initialize */
    async initialize(config: Record<string, unknown>): Promise<void> {
        const token = config.token as string | undefined;
        const botId = config.botId as string | undefined;
        const mode = config.mode as string | undefined;

        if (!token) {
            throw new Error('WhatsApp API token is missing');
        }
        if (!botId) {
            throw new Error('WhatsApp phone number ID (botId) is missing');
        }

        this.token = token;
        this.phoneNumberId = botId;

        if (mode === 'qr') {
            appLogger.warn('WhatsAppProvider', 'QR mode is not yet supported. Falling back to API mode.');
        }

        try {
            // Verify token by fetching phone number info
            const url = `${WhatsAppProvider.API_BASE}/${this.phoneNumberId}`;
            const response = await axios.get(url, {
                headers: { Authorization: `Bearer ${this.token}` },
                timeout: 10_000,
            });

            const phoneData = response.data as { display_phone_number?: string; verified_name?: string };
            const displayName = phoneData.verified_name ?? phoneData.display_phone_number ?? 'Unknown';

            appLogger.info('WhatsAppProvider', `Connected as: ${displayName}`);
        } catch (error) {
            appLogger.error('WhatsAppProvider', 'Failed to verify WhatsApp token', error as Error);
            throw error;
        }
    }

    /**
     * Process an incoming webhook payload from WhatsApp.
     * This is called by a webhook handler when Meta sends a message event.
     */
    async processWebhookPayload(value: WhatsAppWebhookValue): Promise<void> {
        const webhookMessages = value.messages;
        if (!webhookMessages) { return; }

        const contacts = value.contacts ?? [];
        const MAX_MESSAGES = 20;

        for (let i = 0; i < webhookMessages.length && i < MAX_MESSAGES; i++) {
            const msg = webhookMessages[i];
            if (msg.type !== 'text' || !msg.text?.body) { continue; }

            const contact = contacts.find(c => c.wa_id === msg.from);
            const userName = contact?.profile?.name ?? msg.from;

            const reply = async (replyText: string) => {
                await this.sendMessage(msg.from, replyText);
            };

            await this.onMessageReceived({
                platform: 'whatsapp',
                userId: msg.from,
                userName,
                content: msg.text.body,
                timestamp: parseInt(msg.timestamp, 10) * 1000,
                reply,
            });
        }
    }

    /** @see SocialMediaProvider.sendMessage */
    async sendMessage(userId: string, text: string): Promise<boolean> {
        try {
            const url = `${WhatsAppProvider.API_BASE}/${this.phoneNumberId}/messages`;
            const response = await axios.post<WhatsAppApiResponse>(
                url,
                {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: userId,
                    type: 'text',
                    text: { preview_url: false, body: text },
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.token}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: 15_000,
                }
            );

            if (response.data.error) {
                appLogger.error('WhatsAppProvider', `API error: ${response.data.error.message}`);
                return false;
            }

            return true;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const axiosErr = error as AxiosError<{ error?: { message?: string } }>;
                const apiMessage = axiosErr.response?.data?.error?.message ?? 'unknown';
                appLogger.error('WhatsAppProvider', `Failed to send message to ${userId}: ${apiMessage}`);
            } else {
                appLogger.error('WhatsAppProvider', `Failed to send message to ${userId}`, error as Error);
            }
            return false;
        }
    }

    /** @see SocialMediaProvider.stop */
    async stop(): Promise<void> {
        appLogger.info('WhatsAppProvider', 'Stopped');
    }
}
