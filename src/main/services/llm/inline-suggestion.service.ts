/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ipc } from '@main/core/ipc-decorators';
import { BaseService } from '@main/services/base.service';
import { AdvancedMemoryService } from '@main/services/llm/advanced-memory.service';
import { LLMService } from '@main/services/llm/llm.service';
import { MemoryContextService } from '@main/services/llm/memory-context.service';
import { AuthService } from '@main/services/security/auth.service';
import {
    InlineSuggestionRequest,
    InlineSuggestionResponse,
    InlineSuggestionTelemetry,
} from '@shared/schemas/inline-suggestions.schema';

interface InlineSuggestionRoute {
    model: string;
    provider?: string;
}

interface InlineSuggestionServiceDeps {
    llmService: LLMService;
    authService: AuthService;
    advancedMemoryService?: AdvancedMemoryService;
}

const INLINE_MEMORY_TIMEOUT_MS = 220;
const INLINE_MEMORY_MATCH_LIMIT = 2;
const INLINE_MEMORY_QUERY_MIN_LENGTH = 24;
const INLINE_MEMORY_QUERY_MAX_LENGTH = 800;

export class InlineSuggestionService extends BaseService {
    private static readonly KNOWN_CUSTOM_PROVIDERS = new Set([
        'openai',
        'anthropic',
        'claude',
        'groq',
        'nvidia',
        'ollama',
        'llama',
        'opencode',
        'codex',
        'antigravity',
        'google',
    ]);
    private readonly llmService: LLMService;
    private readonly authService: AuthService;
    private readonly memoryContext: MemoryContextService;
    private readonly telemetry = {
        request: 0,
        show: 0,
        accept: 0,
        reject: 0,
        cache_hit: 0,
        error: 0,
    } as Record<InlineSuggestionTelemetry['event'], number>;

    constructor(deps: InlineSuggestionServiceDeps) {
        super('InlineSuggestionService');
        this.llmService = deps.llmService;
        this.authService = deps.authService;
        this.memoryContext = new MemoryContextService(deps.advancedMemoryService);
    }

    private buildPrompt(request: InlineSuggestionRequest, memoryContext?: string): string {
        const suffixSection = request.suffix?.trim()
            ? `Code after cursor:\n${request.suffix}`
            : 'Code after cursor:\n<empty>';
        const tokenHint = request.maxTokens
            ? `Keep the completion under ${request.maxTokens} tokens.`
            : '';
        const memorySection = memoryContext
            ? `\nRelevant prior fixes or patterns:\n${memoryContext}\nUse only if it matches this code context.\n`
            : '';

        return `You are an expert code completion engine.
Continue the code at the cursor without explanation, markdown, or backticks.
Return only the text that should be inserted at the cursor.
Match the existing coding style, indentation, and language semantics.
${tokenHint}
${memorySection}

Language: ${request.language}
Cursor: line ${request.cursorLine}, column ${request.cursorColumn}

Code before cursor:
${request.prefix}

${suffixSection}`;
    }

    private resolveRoute(request: InlineSuggestionRequest): InlineSuggestionRoute {
        if (request.source === 'copilot') {
            return {
                model: request.model?.trim() || 'gpt-4o-copilot',
                provider: 'copilot',
            };
        }

        return {
            model: request.model?.trim() || 'gpt-4o-mini',
            provider: this.normalizeCustomProvider(request.provider),
        };
    }

    private normalizeCustomProvider(provider: string | undefined): string | undefined {
        const normalized = provider?.trim().toLowerCase();
        if (!normalized) {
            return undefined;
        }
        if (!InlineSuggestionService.KNOWN_CUSTOM_PROVIDERS.has(normalized)) {
            return undefined;
        }
        return normalized;
    }

    private recordTelemetry(event: InlineSuggestionTelemetry): void {
        this.telemetry[event.event] += 1;
        this.logDebug('Inline suggestion telemetry', {
            event: event.event,
            source: event.source,
            provider: event.provider,
            model: event.model,
            language: event.language,
            latencyMs: event.latencyMs,
            acceptedChars: event.acceptedChars,
            cacheKey: event.cacheKey,
            reason: event.reason,
            totals: { ...this.telemetry },
        });
    }

    private normalizeContent(content: string): string | null {
        const normalized = content
            .replace(/^```[a-zA-Z0-9_-]*\s*/u, '')
            .replace(/```$/u, '')
            .replace(/\r\n/g, '\n')
            .trim();

        if (!normalized) {
            return null;
        }

        return normalized;
    }

    private async withSelectedCopilotAccount<T>(
        accountId: string | undefined,
        task: () => Promise<T>
    ): Promise<T> {
        if (!accountId) {
            return task();
        }

        const previousAccount = await this.authService.getActiveAccount('copilot');
        if (previousAccount?.id === accountId) {
            return task();
        }

        await this.authService.setActiveAccount('copilot', accountId);

        try {
            return await task();
        } finally {
            if (previousAccount?.id) {
                await this.authService.setActiveAccount('copilot', previousAccount.id);
            }
        }
    }

    @ipc('workspace:getInlineSuggestion')
    async getInlineSuggestion(
        request: InlineSuggestionRequest
    ): Promise<InlineSuggestionResponse> {
        const trimmedPrefix = request.prefix.trim();
        if (!trimmedPrefix) {
            return {
                suggestion: null,
                source: request.source,
                model: request.model,
                provider: request.provider,
            };
        }

        let copilotAccountId = request.accountId;
        if (request.source === 'copilot') {
            const copilotAccounts = await this.authService.getAccountsByProvider('copilot');
            if (copilotAccounts.length === 0) {
                return {
                    suggestion: null,
                    source: request.source,
                    model: request.model,
                    provider: 'copilot',
                };
            }

            const activeCopilotAccount = await this.authService.getActiveAccount('copilot');
            copilotAccountId =
                copilotAccountId || activeCopilotAccount?.id || copilotAccounts[0]?.id;
        }

        const memoryContext = await this.getMemoryContext(request);
        const prompt = this.buildPrompt(request, memoryContext);
        const route = this.resolveRoute(request);
        try {
            const response = await this.withSelectedCopilotAccount(copilotAccountId, async () =>
                this.llmService.chat(
                    [{ role: 'user', content: prompt }],
                    route.model,
                    [],
                    route.provider,
                    { temperature: 0.15 }
                )
            );

            return {
                suggestion: this.normalizeContent(response.content),
                source: request.source,
                model: route.model,
                provider: route.provider,
            };
        } catch (error) {
            if (request.source === 'custom' && route.provider) {
                this.logWarn(
                    `Inline suggestion failed for provider ${route.provider}, retrying with auto provider`
                );
                const fallbackResponse = await this.llmService.chat(
                    [{ role: 'user', content: prompt }],
                    route.model,
                    [],
                    undefined,
                    { temperature: 0.15 }
                );
                return {
                    suggestion: this.normalizeContent(fallbackResponse.content),
                    source: request.source,
                    model: route.model,
                    provider: undefined,
                };
            }

            throw error;
        }
    }

    @ipc('workspace:getCompletion')
    async getCompletion(text: string): Promise<string> {
        const lines = text.split(/\r?\n/u);
        const lastLine = lines.at(-1) ?? '';
        const response = await this.getInlineSuggestion({
            prefix: text,
            language: 'plaintext',
            cursorLine: lines.length,
            cursorColumn: lastLine.length + 1,
            source: 'custom',
            model: 'gpt-4o-mini',
        });
        return response.suggestion ?? '';
    }

    @ipc('workspace:trackInlineSuggestionTelemetry')
    async trackTelemetry(event: InlineSuggestionTelemetry): Promise<{ success: boolean }> {
        this.recordTelemetry(event);
        return { success: true };
    }

    private async getMemoryContext(request: InlineSuggestionRequest): Promise<string | undefined> {
        const query = this.buildMemoryQuery(request);
        return this.memoryContext.getResolutionContext(query, {
            timeoutMs: INLINE_MEMORY_TIMEOUT_MS,
            limit: INLINE_MEMORY_MATCH_LIMIT,
            minQueryLength: INLINE_MEMORY_QUERY_MIN_LENGTH
        });
    }

    private buildMemoryQuery(request: InlineSuggestionRequest): string {
        const prefixTail = request.prefix.slice(-640);
        const suffixHead = request.suffix?.slice(0, 160) ?? '';
        const combined = `${request.language}\n${prefixTail}\n${suffixHead}`.trim();
        return combined.length > INLINE_MEMORY_QUERY_MAX_LENGTH
            ? combined.slice(combined.length - INLINE_MEMORY_QUERY_MAX_LENGTH)
            : combined;
    }

}
