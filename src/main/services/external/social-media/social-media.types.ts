export interface SocialMediaMessage {
    platform: 'discord' | 'telegram' | 'whatsapp';
    userId: string;
    userName: string;
    content: string;
    timestamp: number;
    reply: (text: string) => Promise<void>;
}

export abstract class SocialMediaProvider {
    abstract initialize(config: Record<string, unknown>): Promise<void>;
    abstract sendMessage(userId: string, text: string): Promise<boolean>;
    abstract stop(): Promise<void>;
}
