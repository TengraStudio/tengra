/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
