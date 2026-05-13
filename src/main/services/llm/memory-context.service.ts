/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 */

import { AdvancedMemoryService } from '@main/services/llm/advanced-memory.service';
import { ConversationMemoryFoundationService } from '@main/services/llm/conversation-memory-foundation.service';
import { ChatMessage } from '@main/types/llm.types';
import { Message } from '@shared/types/chat';

export interface MemoryLookupOptions {
    timeoutMs: number;
    limit: number;
    minQueryLength?: number;
}

export interface MemoryContextStats {
    cacheHits: number;
    cacheMisses: number;
    inflightReuseCount: number;
    lookupCount: number;
    lookupTimeoutCount: number;
    lookupFailureCount: number;
    lastLookupDurationMs: number;
    averageLookupDurationMs: number;
    cacheSize: number;
    inflightSize: number;
}

interface ResolutionContextCacheEntry {
    value: string | null;
    expiresAt: number;
}

interface CachedContextResult {
    hit: boolean;
    value: string | undefined;
}

const DEFAULT_MIN_QUERY_LENGTH = 4;
const MAX_QUERY_LENGTH = 1200;
const CACHE_TTL_MS = 5 * 60 * 1000;
const MISS_CACHE_TTL_MS = 45 * 1000;
const MAX_CACHE_SIZE = 300;

export class MemoryContextService {
    static readonly serviceName = 'memoryContextService';
    static readonly dependencies = ['advancedMemoryService'] as const;
    private static cacheHits = 0;
    private static cacheMisses = 0;
    private static inflightReuseCount = 0;
    private static lookupCount = 0;
    private static lookupTimeoutCount = 0;
    private static lookupFailureCount = 0;
    private static totalLookupDurationMs = 0;
    private static lastLookupDurationMs = 0;
    private static latestCacheSize = 0;
    private static latestInflightSize = 0;

    private readonly conversationMemoryService?: ConversationMemoryFoundationService;
    private readonly resolutionCache = new Map<string, ResolutionContextCacheEntry>();
    private readonly inFlightLookups = new Map<string, Promise<string | undefined>>();

    constructor(private readonly advancedMemoryService?: AdvancedMemoryService) {
        this.conversationMemoryService = this.advancedMemoryService
            ? new ConversationMemoryFoundationService(this.advancedMemoryService)
            : undefined;
    }

    async getResolutionContext(query: string, options: MemoryLookupOptions): Promise<string | undefined> {
        if (!this.advancedMemoryService) {
            return undefined;
        }
        const startTime = Date.now();
        MemoryContextService.lookupCount += 1;

        const normalizedQuery = this.normalizeQuery(query);
        if (normalizedQuery.length < (options.minQueryLength ?? DEFAULT_MIN_QUERY_LENGTH)) {
            return undefined;
        }

        const cacheKey = this.buildCacheKey(normalizedQuery, options.limit);
        const cached = this.getCachedContext(cacheKey);
        if (cached.hit) {
            MemoryContextService.cacheHits += 1;
            this.recordLookupDuration(startTime);
            return cached.value;
        }
        MemoryContextService.cacheMisses += 1;

        const existingLookup = this.inFlightLookups.get(cacheKey);
        if (existingLookup) {
            MemoryContextService.inflightReuseCount += 1;
            try {
                const result = await this.raceWithTimeout(existingLookup, options.timeoutMs);
                this.recordLookupDuration(startTime);
                return result;
            } catch (error) {
                this.recordLookupError(error as Error);
                this.recordLookupDuration(startTime);
                return undefined;
            }
        }

        const lookupPromise = this.resolveContextFromMemory(normalizedQuery, options);
        this.inFlightLookups.set(cacheKey, lookupPromise);
        MemoryContextService.latestInflightSize = this.inFlightLookups.size;

        try {
            const context = await this.raceWithTimeout(lookupPromise, options.timeoutMs);
            this.setCachedContext(cacheKey, context);
            this.recordLookupDuration(startTime);
            return context;
        } catch (error) {
            this.recordLookupError(error as Error);
            this.recordLookupDuration(startTime);
            return undefined;
        } finally {
            this.inFlightLookups.delete(cacheKey);
            MemoryContextService.latestInflightSize = this.inFlightLookups.size;
        }
    }

    buildMemoryAwareSystemPrompt(basePrompt: string, memoryContext?: string): string {
        if (!memoryContext) {
            return basePrompt;
        }
        return `${basePrompt}\n\nRelevant prior resolutions:\n${memoryContext}\n\nUse these only when context matches.`;
    }

    prependMemoryMessage(messages: Message[], memoryContext?: string): Message[] {
        if (!memoryContext) {
            return messages;
        }

        const now = Date.now();
        const memoryMessage: Message = {
            id: `memory-context-${now}`,
            role: 'system',
            content: `Relevant prior resolutions:\n${memoryContext}\n\nUse only if context matches.`,
            timestamp: new Date(now)
        };
        return [memoryMessage, ...messages];
    }

    prependMemoryChatMessage(messages: ChatMessage[], memoryContext?: string): ChatMessage[] {
        if (!memoryContext) {
            return messages;
        }
        return [{
            role: 'system',
            content: `Relevant prior resolutions:\n${memoryContext}\n\nUse only if context matches.`
        }, ...messages];
    }

    captureConversation(input: {
        chatId?: string;
        workspaceId?: string;
        provider: string;
        model: string;
        messages: Message[];
        assistantContent: string;
    }): void {
        if (!this.conversationMemoryService) {
            return;
        }
        const assistantContent = input.assistantContent.trim();
        if (!assistantContent || input.messages.length === 0) {
            return;
        }
        this.conversationMemoryService.runInBackground({
            chatId: input.chatId,
            workspaceId: input.workspaceId,
            provider: input.provider,
            model: input.model,
            messages: input.messages,
            assistantContent
        });
    }

    rememberInsight(input: {
        content: string;
        sourceId: string;
        category: 'fact' | 'technical' | 'workflow' | 'preference';
        tags?: string[];
        workspaceId?: string;
    }): void {
        if (!this.advancedMemoryService) {
            return;
        }

        const normalizedContent = input.content.trim();
        if (!normalizedContent) {
            return;
        }

        void this.advancedMemoryService.rememberExplicit(
            normalizedContent,
            input.sourceId,
            input.category,
            input.tags ?? [],
            input.workspaceId
        ).then(() => {
            this.invalidateResolutionCache();
        }).catch(() => undefined);
    }

    private async resolveContextFromMemory(
        normalizedQuery: string,
        options: MemoryLookupOptions
    ): Promise<string | undefined> {
        try {
            if (!this.advancedMemoryService) {
                return undefined;
            }
            const matches = await this.advancedMemoryService.findResolutionMemories(normalizedQuery, options.limit);
            if (matches.length === 0) {
                return undefined;
            }
            return matches.map((memory, index) => `${index + 1}. ${memory.content}`).join('\n');
        } catch {
            throw new Error('memory-resolution-lookup-failed');
        }
    }

    private normalizeQuery(query: string): string {
        const normalized = query
            .replace(/\s+/g, ' ')
            .trim();
        return normalized.length > MAX_QUERY_LENGTH
            ? normalized.slice(normalized.length - MAX_QUERY_LENGTH)
            : normalized;
    }

    private buildCacheKey(query: string, limit: number): string {
        return `${limit}:${query.toLowerCase()}`;
    }

    private getCachedContext(cacheKey: string): CachedContextResult {
        const entry = this.resolutionCache.get(cacheKey);
        if (!entry) {
            return { hit: false, value: undefined };
        }
        if (entry.expiresAt <= Date.now()) {
            this.resolutionCache.delete(cacheKey);
            return { hit: false, value: undefined };
        }
        return { hit: true, value: entry.value ?? undefined };
    }

    private setCachedContext(cacheKey: string, value: string | undefined): void {
        const ttl = value ? CACHE_TTL_MS : MISS_CACHE_TTL_MS;
        this.resolutionCache.set(cacheKey, {
            value: value ?? null,
            expiresAt: Date.now() + ttl
        });
        this.evictCacheOverflow();
        MemoryContextService.latestCacheSize = this.resolutionCache.size;
    }

    private evictCacheOverflow(): void {
        if (this.resolutionCache.size <= MAX_CACHE_SIZE) {
            return;
        }
        const overflow = this.resolutionCache.size - MAX_CACHE_SIZE;
        const keysToDelete = Array.from(this.resolutionCache.keys()).slice(0, overflow);
        for (const key of keysToDelete) {
            this.resolutionCache.delete(key);
        }
    }

    private invalidateResolutionCache(): void {
        this.resolutionCache.clear();
        MemoryContextService.latestCacheSize = 0;
    }

    private async raceWithTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const timeoutPromise = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Request timed out')), timeoutMs);
            if (timer?.unref) {
                timer.unref();
            }
        });

        try {
            return await Promise.race([operation, timeoutPromise]);
        } finally {
            if (timer !== null) {
                clearTimeout(timer);
            }
        }
    }

    private recordLookupDuration(startTime: number): void {
        const elapsed = Math.max(0, Date.now() - startTime);
        MemoryContextService.lastLookupDurationMs = elapsed;
        MemoryContextService.totalLookupDurationMs += elapsed;
    }

    private recordLookupError(error: Error | string | { message?: string }): void {
        if (error instanceof Error && error.message === 'Request timed out') {
            MemoryContextService.lookupTimeoutCount += 1;
            return;
        }
        MemoryContextService.lookupFailureCount += 1;
    }

    static getStats(): MemoryContextStats {
        const avgDuration = this.lookupCount > 0
            ? this.totalLookupDurationMs / this.lookupCount
            : 0;
        return {
            cacheHits: this.cacheHits,
            cacheMisses: this.cacheMisses,
            inflightReuseCount: this.inflightReuseCount,
            lookupCount: this.lookupCount,
            lookupTimeoutCount: this.lookupTimeoutCount,
            lookupFailureCount: this.lookupFailureCount,
            lastLookupDurationMs: this.lastLookupDurationMs,
            averageLookupDurationMs: Number(avgDuration.toFixed(2)),
            cacheSize: this.latestCacheSize,
            inflightSize: this.latestInflightSize,
        };
    }

    static resetStatsForTests(): void {
        this.cacheHits = 0;
        this.cacheMisses = 0;
        this.inflightReuseCount = 0;
        this.lookupCount = 0;
        this.lookupTimeoutCount = 0;
        this.lookupFailureCount = 0;
        this.totalLookupDurationMs = 0;
        this.lastLookupDurationMs = 0;
        this.latestCacheSize = 0;
        this.latestInflightSize = 0;
    }
}

