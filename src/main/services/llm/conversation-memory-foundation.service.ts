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
import { AdvancedMemoryService } from '@main/services/llm/advanced-memory.service';
import { Message, ToolCall } from '@shared/types/chat';

const SERVICE_NAME = 'ConversationMemoryFoundationService';

interface ConversationMemoryInput {
    chatId?: string;
    workspaceId?: string;
    provider: string;
    model: string;
    messages: Message[];
    assistantContent: string;
    reasoning?: string;
    toolCalls?: ToolCall[];
}

interface ResolutionCandidate {
    signature: string;
    resolution: string;
}

export class ConversationMemoryFoundationService {
    static readonly serviceName = 'conversationMemoryFoundationService';
    static readonly dependencies = ['advancedMemory'] as const;
    constructor(private readonly advancedMemory: AdvancedMemoryService) {}

    async ingestConversationTurn(input: ConversationMemoryInput): Promise<void> {
        const lastUserMessage = [...input.messages].reverse().find(message => message.role === 'user');
        const userText = lastUserMessage ? this.normalizeMessageContent(lastUserMessage.content) : '';
        const assistantText = [input.assistantContent, input.reasoning ?? '']
            .filter(part => part.trim().length > 0)
            .join('\n\n')
            .trim();

        if (userText.trim().length > 0) {
            await this.advancedMemory.extractAndStageFromMessage(
                userText,
                this.buildSourceId(input.chatId, 'user'),
                input.workspaceId
            );
        }

        if (assistantText.trim().length > 0) {
            await this.advancedMemory.extractAndStageFromMessage(
                assistantText,
                this.buildSourceId(input.chatId, 'assistant'),
                input.workspaceId
            );
        }

        const resolutionCandidate = this.extractResolutionCandidate(userText, assistantText);
        if (!resolutionCandidate) {
            return;
        }

        const tags = this.buildResolutionTags(input, resolutionCandidate.signature);
        await this.advancedMemory.rememberExplicit(
            `Issue signature: ${resolutionCandidate.signature}\nResolution: ${resolutionCandidate.resolution}`,
            this.buildSourceId(input.chatId, 'resolution'),
            'technical',
            tags,
            input.workspaceId
        );
    }

    private normalizeMessageContent(content: Message['content']): string {
        if (typeof content === 'string') {
            return content;
        }
        return content
            .map(item => item.type === 'text' ? item.text : item.image_url.url)
            .join('\n')
            .trim();
    }

    private buildSourceId(chatId: string | undefined, role: 'user' | 'assistant' | 'resolution'): string {
        const chatSegment = chatId && chatId.trim().length > 0 ? chatId.trim() : 'adhoc';
        return `chat:${chatSegment}:${role}:${Date.now()}`;
    }

    private extractResolutionCandidate(userText: string, assistantText: string): ResolutionCandidate | null {
        const combined = `${userText}\n${assistantText}`;
        const hasErrorSignal = /\b(error|exception|traceback|stack|failed|failure|cannot|undefined|timeout|typeerror|referenceerror|enoent|eacces)\b/i.test(combined);
        if (!hasErrorSignal) {
            return null;
        }

        const hasResolutionSignal = /\b(fix|fixed|resolve|resolved|solution|workaround|root cause|retry|configure|install|upgrade|downgrade|çöz|coz|düzelt|duzelt)\b/i.test(assistantText);
        if (!hasResolutionSignal) {
            return null;
        }

        const signatureSource = userText.trim().length > 0 ? userText : combined;
        const signature = this.compact(signatureSource, 220);
        const resolution = this.compact(assistantText, 800);

        if (signature.length < 12 || resolution.length < 24) {
            return null;
        }

        return { signature, resolution };
    }

    private compact(value: string, maxLength: number): string {
        const normalized = value
            .replace(/\s+/g, ' ')
            .replace(/`{3}[\s\S]*?`{3}/g, '[code-block]')
            .trim();
        return normalized.length > maxLength
            ? `${normalized.slice(0, maxLength - 3)}...`
            : normalized;
    }

    private buildResolutionTags(input: ConversationMemoryInput, signature: string): string[] {
        const signatureTag = this.toSlug(signature);
        const baseTags = [
            'resolution',
            'error-fix',
            `provider:${this.toSlug(input.provider)}`,
            `model:${this.toSlug(input.model)}`
        ];
        if (signatureTag.length > 0) {
            baseTags.push(`issue:${signatureTag}`);
        }
        if ((input.toolCalls?.length ?? 0) > 0) {
            baseTags.push('tool-assisted');
        }
        return Array.from(new Set(baseTags));
    }

    private toSlug(value: string): string {
        return value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')
            .slice(0, 64);
    }

    runInBackground(input: ConversationMemoryInput): void {
        void this.ingestConversationTurn(input).catch(error => {
            appLogger.warn(
                SERVICE_NAME,
                `Conversation memory ingestion failed: ${error instanceof Error ? error.message : String(error)}`
            );
        });
    }
}

