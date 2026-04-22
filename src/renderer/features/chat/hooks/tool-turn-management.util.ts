/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { AiEvidenceRecord, AiIntentClassification } from '@shared/types/ai-runtime';
import { composeDeterministicAnswer, doesEvidenceSatisfyIntent, isLowSignalProgressContent } from '@shared/utils/ai-runtime.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';

import { Message } from '@/types';
import { appLogger } from '@/utils/renderer-logger';
import { 
    getChatSnapshot, 
    updateChatInStore 
} from '@/store/chat.store';

import {
    buildAssistantPresentationMetadata,
    buildStoredToolResults,
    getMessageStringContent,
    shouldPreserveToolLoopFallbackContent,
} from './ai-runtime-chat.util';
import {
    isMonotonousToolFamily,
} from './chat-runtime-policy.util';
import {
    persistAssistantMessage,
    persistToolExecutionMetadata,
    upsertMessageInChat,
} from './message-persistence.util';
import { buildModelConversation, hasAlternatingToolLoop } from './tool-loop.util';

export interface FinalizeTurnParams {
    assistantId: string;
    chatId: string;
    callMap: Map<string, NonNullable<Message['toolCalls']>[number]>;
    messages: Message[];
    provider: string;
    model: string;
    intentClassification: AiIntentClassification;
    language?: string;
    reasonings?: string[];
    content?: string;
    reasoning?: string;
    images?: string[];
    sources?: string[];
}

export interface StreamResultLike {
    finalContent: string;
    finalToolCalls: NonNullable<Message['toolCalls']>;
    finalReasoning?: string;
    reasonings?: string[];
}

export interface MalformedToolCallParams extends FinalizeTurnParams {
    result: StreamResultLike;
    t: (key: string, options?: Record<string, unknown>) => string;
}

export interface ImageFinalizeParams extends FinalizeTurnParams {
    result: StreamResultLike;
    images: string[];
    calls: NonNullable<Message['toolCalls']>;
    results: Message[];
}

export interface LoopSafetyParams {
    repeatedToolSignatureCount: number;
    executableToolCalls: NonNullable<Message['toolCalls']>;
    currentMessages: Message[];
    assistantMsg: Message;
    toolResults: Message[];
    noProgressToolTurnCount: number;
    recentToolSignatures: string[];
    executedToolTurnCount: number;
    noProgressThreshold: number;
    maxExecutedToolTurns: number;
    activeModel: string;
    selectedProvider: string;
    fullOptions: Record<string, RendererDataValue>;
    activeWorkspacePath: string | undefined;
    systemMode: 'thinking' | 'agent' | 'fast';
    chatId: string;
    workspaceId: string | undefined;
    intentClassification: AiIntentClassification;
    currentAssistantId: string;
    accumulatedToolCallMap: Map<string, NonNullable<Message['toolCalls']>[number]>;
    accumulatedToolMessages: Message[];
    evidenceRecords: AiEvidenceRecord[];
    t: (key: string, options?: Record<string, unknown>) => string;
    language?: string;
}

function isTurkishLanguage(language?: string): boolean {
    const normalized = (language ?? '').trim().toLowerCase();
    return normalized === 'tr' || normalized.startsWith('tr-');
}

function extractPathFromError(errorMessage: string): string | undefined {
    const quotedPathMatch = errorMessage.match(/['"`]([^'"`]+)['"`]/);
    if (quotedPathMatch?.[1]) {
        return quotedPathMatch[1];
    }
    const windowsPathMatch = errorMessage.match(/[A-Za-z]:\\[^\s'"`)]+/);
    return windowsPathMatch?.[0];
}

function readToolPayload(message: Message): Record<string, RendererDataValue> | null {
    if (message.role !== 'tool' || typeof message.content !== 'string') {
        return null;
    }
    const parsed = safeJsonParse<Record<string, RendererDataValue>>(message.content, {});
    return Object.keys(parsed).length > 0 ? parsed : null;
}

function readLatestToolError(toolMessages: Message[]): string | undefined {
    for (let index = toolMessages.length - 1; index >= 0; index -= 1) {
        const payload = readToolPayload(toolMessages[index]);
        if (!payload) {
            continue;
        }
        if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
            return payload.error;
        }
    }
    return undefined;
}

function readLatestEvidencePath(toolMessages: Message[]): string | undefined {
    for (let index = toolMessages.length - 1; index >= 0; index -= 1) {
        const payload = readToolPayload(toolMessages[index]);
        if (!payload) {
            continue;
        }
        if (typeof payload.path === 'string' && payload.path.trim().length > 0) {
            return payload.path;
        }
    }
    return undefined;
}

function buildErrorFallbackContent(toolMessages: Message[], language?: string): string | undefined {
    const errorMessage = readLatestToolError(toolMessages);
    if (!errorMessage) {
        return undefined;
    }
    const normalized = errorMessage.toLowerCase();
    const detectedPath = extractPathFromError(errorMessage);
    const isTurkish = isTurkishLanguage(language);

    if (normalized.includes('enoent') || normalized.includes('no such file or directory') || normalized.includes('not found')) {
        if (isTurkish) {
            return detectedPath
                ? `Istedigin kaynagi bulamadim: \`${detectedPath}\`.`
                : 'Istedigin kaynagi bulamadim.';
        }
        return detectedPath
            ? `I couldn't find the requested resource: \`${detectedPath}\`.`
            : 'I couldn\'t find the requested resource.';
    }

    if (normalized.includes('eacces') || normalized.includes('eperm') || normalized.includes('permission denied') || normalized.includes('not allowed')) {
        return isTurkish
            ? 'Bu islemi yaparken izin hatasi aldim.'
            : 'I hit a permission error while processing your request.';
    }

    return isTurkish
        ? `Araci calistirirken bir hata aldim: ${errorMessage}`
        : `I hit a tool error while processing your request: ${errorMessage}`;
}

function buildEvidenceFallbackContent(toolMessages: Message[], language?: string): string | undefined {
    const hasToolMessages = toolMessages.some(message => message.role === 'tool');
    if (!hasToolMessages) {
        return undefined;
    }
    const isTurkish = isTurkishLanguage(language);
    const evidencePath = readLatestEvidencePath(toolMessages);

    if (isTurkish) {
        return evidencePath
            ? `Toplanan kanitlar: \`${evidencePath}\` uzerindeki arac sonuclarini birlestirdim ve cevabi buna gore olusturdum.`
            : 'Toplanan kanitlar: Arac sonuclarini birlestirip en iyi cevabi olusturdum.';
    }

    return evidencePath
        ? `Based on the collected evidence: I analyzed \`${evidencePath}\` and synthesized the available tool results.`
        : 'Based on the collected evidence: I synthesized the available tool results.';
}

function isToolProgressContent(content: string): boolean {
    const normalized = content.trim().toLowerCase();
    if (normalized.length === 0) {
        return false;
    }
    if (normalized.startsWith('using tool:')) {
        return true;
    }
    if (normalized.startsWith('arac kullaniliyor:') || normalized.startsWith('arac kullaniyorum:')) {
        return true;
    }
    return normalized === 'tools.usingtool';
}

export async function finalizeToolTurn(params: FinalizeTurnParams): Promise<void> {
    await persistToolExecutionMetadata({
        chatId: params.chatId,
        assistantId: params.assistantId,
        toolCalls: Array.from(params.callMap.values()),
        toolMessages: params.messages,
        selectedProvider: params.provider,
        activeModel: params.model,
        intentClassification: params.intentClassification,
        language: params.language,
        reasonings: params.reasonings,
        content: params.content,
        reasoning: params.reasoning,
        images: params.images,
        sources: params.sources,
    });
}

export async function handleMalformedToolCalls(params: MalformedToolCallParams): Promise<void> {
    const assistantContent = getMessageStringContent(params.result.finalContent);
    if (assistantContent.length === 0) {
        throw new Error(params.t('chat.error'));
    }

    const updates = {
        content: assistantContent,
        reasoning: params.result.finalReasoning || undefined,
        metadata: buildAssistantPresentationMetadata({
            intent: params.intentClassification,
            content: assistantContent,
            reasoning: params.result.finalReasoning,
            language: params.language,
        }),
        reasonings: params.result.reasonings || (params.result.finalReasoning ? [params.result.finalReasoning] : undefined),
    };

    updateChatInStore(params.chatId, {
        isGenerating: false,
        messages: upsertMessageInChat(
            getChatSnapshot().chats.find(c => c.id === params.chatId)?.messages || [], 
            params.assistantId, 
            existing => ({
                id: params.assistantId,
                role: 'assistant',
                timestamp: existing?.timestamp ?? new Date(),
                provider: params.provider,
                model: params.model,
                ...existing,
                ...updates,
            })
        ),
    });

    await persistAssistantMessage(params.assistantId, params.chatId, updates);
    await finalizeToolTurn({
        ...params,
        content: assistantContent,
        reasoning: params.result.finalReasoning,
        reasonings: updates.reasonings,
    });
}

export async function finalizeWithImages(params: ImageFinalizeParams): Promise<void> {
    const content = getMessageStringContent(params.result.finalContent);
    const storedToolResults = buildStoredToolResults(params.calls, params.results);
    const updates = {
        content: content.length > 0 ? content : '',
        images: params.images,
        toolCalls: params.calls,
        toolResults: storedToolResults,
        metadata: buildAssistantPresentationMetadata({
            intent: params.intentClassification,
            content: content,
            toolCalls: params.calls,
            toolResults: storedToolResults,
            images: params.images,
            language: params.language,
            reasonings: params.result.reasonings,
        }),
        reasonings: params.result.reasonings || (params.result.finalReasoning ? [params.result.finalReasoning] : undefined),
    };

    updateChatInStore(params.chatId, {
        isGenerating: false,
        messages: upsertMessageInChat(
            getChatSnapshot().chats.find(c => c.id === params.chatId)?.messages || [], 
            params.assistantId, 
            existing => ({
                id: params.assistantId,
                role: 'assistant',
                timestamp: existing?.timestamp ?? new Date(),
                provider: params.provider,
                model: params.model,
                ...existing,
                ...updates,
            })
        ),
    });

    await persistAssistantMessage(params.assistantId, params.chatId, updates);
}

export function evaluateLoopSafety(
    params: LoopSafetyParams,
    options: {
        recentSignatureWindow: number;
        directAnswerHint: string;
    }
): { action: 'break' | 'continue' | 'proceed'; nextMessages: Message[] } {
    const NON_SINGLE_REPEAT_BREAK_NO_PROGRESS_THRESHOLD = 3;
    const alternatingLoopDetected = hasAlternatingToolLoop(
        params.recentToolSignatures,
        options.recentSignatureWindow
    );
    const satisfaction = doesEvidenceSatisfyIntent(params.intentClassification.intent, params.evidenceRecords);
    const isSingleLookupIntent = params.intentClassification.intent === 'single_lookup';

    // Heuristic: If we already have solid filesystem evidence (list_directory, file_exists)
    // and the model is still asking for similar things without processing previous results,
    // we should forcefully guide it to a final answer or break.
    const hasFilesystemEvidence = params.evidenceRecords.some(r =>
        r.toolName === 'list_directory'
        || r.toolName === 'file_exists'
        || r.toolName === 'resolve_path'
    );

    if (
        isSingleLookupIntent
        && satisfaction === 'complete'
        && (params.noProgressToolTurnCount >= 1 || hasFilesystemEvidence)
    ) {
        // If we have filesystem evidence and the model is repeating a tool call signature, break immediately
        const isRepeatingSignatures = params.repeatedToolSignatureCount >= 1;

        if (isRepeatingSignatures) {
            appLogger.info(
                'useChatGenerator',
                `Forced loop break: evidence complete and recurring tool call signature detected. model=${params.activeModel}`
            );
            return { action: 'break', nextMessages: params.currentMessages };
        }

        if (params.noProgressToolTurnCount >= 1) {
            appLogger.info(
                'useChatGenerator',
                `Breaking tool loop early: evidence satisfaction complete, no-progress turn detected. intent=${params.intentClassification.intent}`
            );
            return { action: 'break', nextMessages: params.currentMessages };
        }
    }

    if (
        !isSingleLookupIntent
        && params.repeatedToolSignatureCount >= 2
        && params.noProgressToolTurnCount >= NON_SINGLE_REPEAT_BREAK_NO_PROGRESS_THRESHOLD
    ) {
        appLogger.info(
            'useChatGenerator',
            `Breaking tool loop after repeated non-progress signatures. intent=${params.intentClassification.intent}, repeated=${params.repeatedToolSignatureCount}`
        );
        return { action: 'break', nextMessages: params.currentMessages };
    }

    // Semantic: all recent signatures use the same tool family — break if it's coupled with no real progress
    const MONOTONOUS_FAMILY_WINDOW = 3;
    if (
        params.noProgressToolTurnCount >= NON_SINGLE_REPEAT_BREAK_NO_PROGRESS_THRESHOLD
        && isMonotonousToolFamily(params.recentToolSignatures, MONOTONOUS_FAMILY_WINDOW)
    ) {
        appLogger.info(
            'useChatGenerator',
            `Breaking tool loop: monotonous tool family detected without progress across ${MONOTONOUS_FAMILY_WINDOW} recent signatures. noProgress=${params.noProgressToolTurnCount}`
        );
        return { action: 'break', nextMessages: params.currentMessages };
    }

    // Hard absolute ceiling on executed tool turns to prevent unbounded loops
    const ABSOLUTE_SINGLE_LOOKUP_CAP = 6;
    const absoluteCap = isSingleLookupIntent ? ABSOLUTE_SINGLE_LOOKUP_CAP : Math.max(params.maxExecutedToolTurns, 24);
    if (params.executedToolTurnCount >= absoluteCap) {
        appLogger.warn(
            'useChatGenerator',
            `Breaking tool loop: absolute executed tool turn ceiling reached (${params.executedToolTurnCount}/${absoluteCap}). intent=${params.intentClassification.intent}`
        );
        return { action: 'break', nextMessages: params.currentMessages };
    }

    if (
        params.noProgressToolTurnCount >= params.noProgressThreshold ||
        (alternatingLoopDetected && params.noProgressToolTurnCount >= 3)
    ) {
        appLogger.warn('useChatGenerator', `Breaking tool loop: no-progress threshold reached (${params.noProgressToolTurnCount}). Evidence records: ${params.evidenceRecords.length}`);
        return { action: 'break', nextMessages: params.currentMessages };
    }

    const nextMessages = params.toolResults.length > 0
        ? buildModelConversation(params.currentMessages, params.assistantMsg, params.toolResults)
        : params.currentMessages;
    return { action: 'proceed', nextMessages };
}

export async function finalizeLoopForcefully(
    params: LoopSafetyParams,
    options: {
        lowSignalContentThreshold: number;
    }
): Promise<void> {
    appLogger.warn('useChatGenerator', 'Tool loop reached forced termination state (budget exhaust or safety break).');

    const assistantContent = getMessageStringContent(params.assistantMsg.content);
    const normalizedAssistantContent = assistantContent.trim();
    const hasProgressOnlyContent = isToolProgressContent(normalizedAssistantContent);
    const hasMeaningfulAssistantContent = normalizedAssistantContent.length > 0
        && !isLowSignalProgressContent(normalizedAssistantContent);
    const fallbackContent = shouldPreserveToolLoopFallbackContent(
        params.assistantMsg,
        assistantContent,
        options.lowSignalContentThreshold
    )
        ? assistantContent
        : undefined;
    const toolErrorFallbackContent = buildErrorFallbackContent(
        params.accumulatedToolMessages,
        params.language
    );
    const evidenceFallbackContent = buildEvidenceFallbackContent(
        params.accumulatedToolMessages,
        params.language
    );

    const toolCalls = Array.from(params.accumulatedToolCallMap.values());
    const storedToolResults = buildStoredToolResults(toolCalls, params.accumulatedToolMessages);
    const deterministicFallbackContent = composeDeterministicAnswer({
        intent: params.intentClassification,
        content: '',
        reasoning: params.assistantMsg.reasoning,
        reasonings: params.assistantMsg.reasonings,
        toolCalls,
        toolResults: storedToolResults,
        language: params.language,
    });
    const hasSuccessfulToolResult = storedToolResults.some(result => result.success === true);
    const primaryDeterministicFallbackContent = hasSuccessfulToolResult
        ? deterministicFallbackContent
        : undefined;
    const secondaryDeterministicFallbackContent = hasSuccessfulToolResult
        ? undefined
        : deterministicFallbackContent;
    const resolvedFallbackContent = fallbackContent
        ?? (hasMeaningfulAssistantContent && !hasProgressOnlyContent ? normalizedAssistantContent : undefined)
        ?? primaryDeterministicFallbackContent
        ?? toolErrorFallbackContent
        ?? secondaryDeterministicFallbackContent
        ?? evidenceFallbackContent
        ?? params.t('chat.toolLoop.limitReachedPreserved');

    const assistantReasonings = params.assistantMsg.reasonings || (params.assistantMsg.reasoning ? [params.assistantMsg.reasoning] : undefined);
    const metadata = buildAssistantPresentationMetadata({
        intent: params.intentClassification,
        content: resolvedFallbackContent,
        reasoning: params.assistantMsg.reasoning,
        reasonings: assistantReasonings,
        toolCalls,
        toolResults: storedToolResults,
        language: params.language,
    });

    const updates = {
        content: resolvedFallbackContent,
        reasonings: assistantReasonings,
        metadata,
    };

    updateChatInStore(params.chatId, {
        isGenerating: false,
        messages: upsertMessageInChat(
            getChatSnapshot().chats.find(c => c.id === params.chatId)?.messages || [], 
            params.currentAssistantId, 
            existing => ({
                id: params.currentAssistantId,
                role: 'assistant',
                timestamp: existing?.timestamp ?? new Date(),
                provider: params.selectedProvider,
                model: params.activeModel,
                ...existing,
                ...updates,
            })
        ),
    });

    await persistAssistantMessage(params.currentAssistantId, params.chatId, updates);
    await finalizeToolTurn({
        assistantId: params.currentAssistantId,
        chatId: params.chatId,
        callMap: params.accumulatedToolCallMap,
        messages: params.accumulatedToolMessages,
        provider: params.selectedProvider,
        model: params.activeModel,
        intentClassification: params.intentClassification,
        language: params.language,
        reasonings: assistantReasonings,
        content: resolvedFallbackContent,
        reasoning: params.assistantMsg.reasoning,
    });
}
