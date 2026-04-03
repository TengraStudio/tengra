import { AiEvidenceRecord, AiIntentClassification } from '@shared/types/ai-runtime';
import { composeDeterministicAnswer, doesEvidenceSatisfyIntent } from '@shared/utils/ai-runtime.util';

import { generateId } from '@/lib/utils';
import { Chat, Message } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import {
    buildAssistantPresentationMetadata,
    buildStoredToolResults,
    getMessageStringContent,
    shouldPreserveToolLoopFallbackContent,
} from './ai-runtime-chat.util';
import {
    persistAssistantMessage,
    persistToolExecutionMetadata,
    upsertMessageInChat,
} from './message-persistence.util';
import { StreamStreamingState } from './process-stream';
import { buildModelConversation, hasAlternatingToolLoop } from './tool-loop.util';

export interface FinalizeTurnParams {
    assistantId: string;
    chatId: string;
    callMap: Map<string, NonNullable<Message['toolCalls']>[number]>;
    messages: Message[];
    provider: string;
    model: string;
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
    intentClassification: AiIntentClassification;
    language?: string;
}

export interface StreamResultLike {
    finalContent: string;
    finalToolCalls: NonNullable<Message['toolCalls']>;
    finalReasoning?: string;
}

export interface MalformedToolCallParams extends FinalizeTurnParams {
    result: StreamResultLike;
    t: (key: string) => string;
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
    setStreamingStates: React.Dispatch<React.SetStateAction<Record<string, StreamStreamingState>>>;
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
    accumulatedToolCallMap: Map<string, NonNullable<Message['toolCalls']>[number]>;
    accumulatedToolMessages: Message[];
    evidenceRecords: AiEvidenceRecord[];
    t: (key: string) => string;
    language?: string;
}

export async function finalizeToolTurn(params: FinalizeTurnParams): Promise<void> {
    await persistToolExecutionMetadata({
        chatId: params.chatId,
        assistantId: params.assistantId,
        setChats: params.setChats,
        toolCalls: Array.from(params.callMap.values()),
        toolMessages: params.messages,
        selectedProvider: params.provider,
        activeModel: params.model,
        intentClassification: params.intentClassification,
        language: params.language,
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
    };

    params.setChats((prev: Chat[]) => prev.map(chat => (
        chat.id === params.chatId
            ? {
                ...chat,
                isGenerating: false,
                messages: upsertMessageInChat(chat.messages, params.assistantId, existing => ({
                    id: params.assistantId,
                    role: 'assistant',
                    timestamp: existing?.timestamp ?? new Date(),
                    provider: params.provider,
                    model: params.model,
                    ...existing,
                    ...updates,
                })),
            }
            : chat
    )));

    await persistAssistantMessage(params.assistantId, params.chatId, updates);
    await finalizeToolTurn(params);
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
            content,
            toolCalls: params.calls,
            toolResults: storedToolResults,
            images: params.images,
            language: params.language,
        }),
    };

    params.setChats((prev: Chat[]) => prev.map(chat => (
        chat.id === params.chatId
            ? {
                ...chat,
                isGenerating: false,
                messages: upsertMessageInChat(chat.messages, params.assistantId, existing => ({
                    id: params.assistantId,
                    role: 'assistant',
                    timestamp: existing?.timestamp ?? new Date(),
                    provider: params.provider,
                    model: params.model,
                    ...existing,
                    ...updates,
                })),
            }
            : chat
    )));

    await persistAssistantMessage(params.assistantId, params.chatId, updates);
}

export function evaluateLoopSafety(
    params: LoopSafetyParams,
    options: {
        recentSignatureWindow: number;
        directAnswerHint: string;
    }
): { action: 'break' | 'continue' | 'proceed'; nextMessages: Message[] } {
    const alternatingLoopDetected = hasAlternatingToolLoop(
        params.recentToolSignatures,
        options.recentSignatureWindow
    );
    const toolBudgetExhausted = params.executedToolTurnCount >= params.maxExecutedToolTurns;
    const satisfaction = doesEvidenceSatisfyIntent(params.intentClassification.intent, params.evidenceRecords);

    if (satisfaction === 'complete' && params.noProgressToolTurnCount >= 1) {
        appLogger.info(
            'useChatGenerator',
            `Breaking tool loop early: evidence satisfaction complete, no-progress turn detected. intent=${params.intentClassification.intent}`
        );
        return { action: 'break', nextMessages: params.currentMessages };
    }

    if (
        params.noProgressToolTurnCount >= params.noProgressThreshold ||
        (alternatingLoopDetected && params.noProgressToolTurnCount >= 3)
    ) {
        // If we hit no-progress threshold but have evidence, just break and synthesize
        if (params.evidenceRecords.length > 0) {
            appLogger.warn('useChatGenerator', `Breaking tool loop: no-progress threshold reached with ${params.evidenceRecords.length} records.`);
            return { action: 'break', nextMessages: params.currentMessages };
        }

        return {
            action: 'continue',
            nextMessages: [
                ...buildModelConversation(params.currentMessages, params.assistantMsg, params.toolResults),
                {
                    id: generateId(),
                    role: 'system' as const,
                    content: toolBudgetExhausted
                        ? `${options.directAnswerHint} Do not request more tool calls.`
                        : `Do not repeat prior tool calls. ${options.directAnswerHint} Choose a different tool only if it will add new evidence.`,
                    timestamp: new Date(),
                },
            ],
        };
    }

    return { action: 'proceed', nextMessages: params.currentMessages };
}

export async function handleMaxIterationsReached(
    params: LoopSafetyParams,
    options: {
        lowSignalContentThreshold: number;
    }
): Promise<void> {
    appLogger.warn('useChatGenerator', 'Tool loop reached max iterations; stopping without forced finalization');

    const assistantContent = getMessageStringContent(params.assistantMsg.content);
    const fallbackContent = shouldPreserveToolLoopFallbackContent(
        params.assistantMsg,
        assistantContent,
        options.lowSignalContentThreshold
    )
        ? assistantContent
        : undefined;
    const toolCalls = Array.from(params.accumulatedToolCallMap.values());
    const toolResults = buildStoredToolResults(toolCalls, params.accumulatedToolMessages);
    const deterministicAnswer = composeDeterministicAnswer({
        intent: params.intentClassification,
        content: assistantContent,
        reasoning: params.assistantMsg.reasoning,
        toolCalls,
        toolResults,
        language: params.language,
    });
    const resolvedFallbackContent = fallbackContent
        ?? deterministicAnswer
        ?? params.t('chat.toolLoop.limitReachedPreserved');
    const metadata = buildAssistantPresentationMetadata({
        intent: params.intentClassification,
        content: resolvedFallbackContent,
        reasoning: params.assistantMsg.reasoning,
        toolCalls,
        toolResults,
        language: params.language,
    });

    params.setChats((prev: Chat[]) => prev.map(chat => (
        chat.id === params.chatId
            ? {
                ...chat,
                isGenerating: false,
                messages: upsertMessageInChat(chat.messages, params.currentAssistantId, existing => ({
                    id: params.currentAssistantId,
                    role: 'assistant',
                    timestamp: existing?.timestamp ?? new Date(),
                    provider: params.selectedProvider,
                    model: params.activeModel,
                    ...existing,
                    content: resolvedFallbackContent,
                    metadata,
                })),
            }
            : chat
    )));

    await persistAssistantMessage(params.currentAssistantId, params.chatId, {
        content: resolvedFallbackContent,
        metadata,
    });
    await finalizeToolTurn({
        assistantId: params.currentAssistantId,
        chatId: params.chatId,
        callMap: params.accumulatedToolCallMap,
        messages: params.accumulatedToolMessages,
        provider: params.selectedProvider,
        model: params.activeModel,
        setChats: params.setChats,
        intentClassification: params.intentClassification,
        language: params.language,
    });
}
