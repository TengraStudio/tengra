/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    buildAssistantPresentationMetadata,
    buildStoredToolResults,
    readToolResultImages,
} from '@renderer/features/chat/hooks/ai-runtime-chat.util';
import { createModelToolList } from '@renderer/features/chat/hooks/chat-runtime-policy.util';
import { executeBatchToolCalls } from '@renderer/features/chat/hooks/tool-batch-execution.util';
import { executeToolCall } from '@renderer/features/chat/hooks/tool-call-execution.util';
import { buildModelConversation } from '@renderer/features/chat/hooks/tool-loop.util';
import { mergeToolCalls as mergeChatToolCalls } from '@renderer/features/chat/hooks/utils';
import { classifyAiIntent, getAiToolLoopBudget } from '@shared/utils/ai-runtime.util';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { chatStream } from '@/lib/chat-stream';
import { ChatError, Message } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import {
    categorizeConversationError,
    formatStreamErrorContent,
    patchAssistantMessage,
    toTextContent,
} from './session-conversation-stream.util';

export interface ConsumeConversationStreamOptions {
    assistantId: string;
    assistantTimestamp: Date;
    intentClassification: ReturnType<typeof classifyAiIntent>;
    language: string;
    model: string;
    provider: string;
    sessionId: string;
    setError: Dispatch<SetStateAction<ChatError | null>>;
    setIsStreaming: Dispatch<SetStateAction<boolean>>;
    setMessages: Dispatch<SetStateAction<Message[]>>;
    streamMessages: Message[];
    workspaceId?: string;
    abortedRef: MutableRefObject<boolean>;
}

type ToolCallList = NonNullable<Message['toolCalls']>;

interface AssistantStateSnapshot {
    completedReasonings: string[];
    pendingReasonings: string[];
    completedToolCalls: ToolCallList;
    pendingToolCalls: ToolCallList;
    toolMessages: Message[];
    images: string[];
    displayContent: string;
    isStreaming: boolean;
    assistantTimestamp?: Date;
}

interface TurnStreamState {
    content: string;
    reasonings: string[];
    toolCalls: ToolCallList;
    reasoningSegmentOpen: boolean;
}

function mergeReasoningSegments(segments: string[]): string[] {
    return segments
        .map(segment => (typeof segment === 'string' ? segment : ''))
        .filter(segment => segment.trim().length > 0);
}

function appendReasoningChunk(
    reasonings: string[],
    chunkReasoning: string,
    reasoningSegmentOpen: boolean
): { nextReasonings: string[]; nextReasoningSegmentOpen: boolean } {
    if (chunkReasoning.trim().length === 0) {
        return { nextReasonings: reasonings, nextReasoningSegmentOpen: reasoningSegmentOpen };
    }
    if (!reasoningSegmentOpen || reasonings.length === 0) {
        return {
            nextReasonings: [...reasonings, chunkReasoning],
            nextReasoningSegmentOpen: true,
        };
    }

    const nextReasonings = [...reasonings];
    const lastIndex = nextReasonings.length - 1;
    const previousValue = nextReasonings[lastIndex] ?? '';
    nextReasonings[lastIndex] = `${previousValue}${chunkReasoning}`;
    return {
        nextReasonings,
        nextReasoningSegmentOpen: true,
    };
}

function buildDisplayToolCalls(
    completedToolCalls: ToolCallList,
    pendingToolCalls: ToolCallList
): Message['toolCalls'] {
    return mergeChatToolCalls(completedToolCalls, pendingToolCalls, {
        allowIndexMatch: false,
    });
}

function buildAssistantMessageUpdates(
    intentClassification: ReturnType<typeof classifyAiIntent>,
    language: string,
    snapshot: AssistantStateSnapshot
): Partial<Message> {
    const allReasonings = mergeReasoningSegments([
        ...snapshot.completedReasonings,
        ...snapshot.pendingReasonings,
    ]);
    const displayToolCalls = buildDisplayToolCalls(
        snapshot.completedToolCalls,
        snapshot.pendingToolCalls
    );
    const toolResults = snapshot.completedToolCalls.length > 0
        ? buildStoredToolResults(snapshot.completedToolCalls, snapshot.toolMessages)
        : [];
    const latestReasoning = allReasonings.length > 0
        ? allReasonings[allReasonings.length - 1]
        : undefined;

    return {
        content: snapshot.displayContent,
        reasoning: latestReasoning,
        reasonings: allReasonings.length > 0 ? allReasonings : undefined,
        toolCalls: displayToolCalls,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
        images: snapshot.images.length > 0 ? [...snapshot.images] : undefined,
        metadata: buildAssistantPresentationMetadata({
            intent: intentClassification,
            content: snapshot.displayContent,
            reasoning: latestReasoning,
            reasonings: allReasonings,
            toolCalls: displayToolCalls,
            toolResults: toolResults.length > 0 ? toolResults : undefined,
            images: snapshot.images,
            isStreaming: snapshot.isStreaming,
            language,
        }),
        ...(snapshot.assistantTimestamp ? { timestamp: snapshot.assistantTimestamp } : {}),
    };
}

function patchAssistantState(
    setMessages: Dispatch<SetStateAction<Message[]>>,
    assistantId: string,
    intentClassification: ReturnType<typeof classifyAiIntent>,
    language: string,
    snapshot: AssistantStateSnapshot
): void {
    const updates = buildAssistantMessageUpdates(intentClassification, language, snapshot);
    setMessages(previous => patchAssistantMessage(previous, assistantId, updates));
}

function createTurnStreamState(): TurnStreamState {
    return {
        content: '',
        reasonings: [],
        toolCalls: [],
        reasoningSegmentOpen: false,
    };
}

function createTurnAssistantMessage(
    assistantId: string,
    provider: string,
    model: string,
    turnState: TurnStreamState
): Message {
    const dedupedReasonings = mergeReasoningSegments(turnState.reasonings);
    return {
        id: `${assistantId}-turn-${Date.now()}`,
        role: 'assistant',
        content: turnState.content.trim(),
        timestamp: new Date(),
        provider,
        model,
        reasoning: dedupedReasonings.length > 0
            ? dedupedReasonings[dedupedReasonings.length - 1]
            : undefined,
        reasonings: dedupedReasonings.length > 0 ? dedupedReasonings : undefined,
        toolCalls: turnState.toolCalls.length > 0 ? [...turnState.toolCalls] : undefined,
    };
}

export async function consumeConversationStream(
    options: ConsumeConversationStreamOptions
): Promise<void> {
    const {
        assistantId,
        assistantTimestamp,
        intentClassification,
        language,
        model,
        provider,
        sessionId,
        setError,
        setIsStreaming,
        setMessages,
        streamMessages,
        workspaceId,
        abortedRef,
    } = options;
    const getToolDefinitions = window.electron.getToolDefinitions;
    const allTools = typeof getToolDefinitions === 'function'
        ? await getToolDefinitions().catch(() => [])
        : [];
    const toolDefinitions = createModelToolList(allTools ?? []);
    const toolLoopBudget = getAiToolLoopBudget(intentClassification);
    const traceId = `${sessionId.slice(0, 8)}:${assistantId.slice(0, 8)}`;
    const identityTranslate = (key: string): string => key;
    let currentMessages = streamMessages;
    let displayContent = '';
    let completedReasonings: string[] = [];
    let completedToolCalls: ToolCallList = [];
    const toolMessages: Message[] = [];
    let generatedImages: string[] = [];
    let streamTurn = 0;
    let executedToolTurns = 0;
    let finalErrorMessage: string | null = null;

    appLogger.info(
        'sessionConversationStream',
        `[${traceId}] start provider=${provider} model=${model} messages=${streamMessages.length} tools=${toolDefinitions.length} workspaceId=${workspaceId ?? 'none'}`
    );
    try {
        while (!abortedRef.current && streamTurn < toolLoopBudget.maxModelTurns) {
            streamTurn += 1;
            const turnState = createTurnStreamState();
            const toolsAllowedThisTurn = executedToolTurns < toolLoopBudget.maxExecutedToolTurns;
            const stream = chatStream({
                messages: currentMessages,
                model,
                provider,
                tools: toolsAllowedThisTurn ? toolDefinitions : [],
                chatId: sessionId,
                assistantId,
                workspaceId,
                options: {},
            });
            const MAX_CHUNKS = 100000;
            let chunkCount = 0;

            appLogger.info(
                'sessionConversationStream',
                `[${traceId}] turn=${streamTurn} stream-start messages=${currentMessages.length} toolsAllowed=${String(toolsAllowedThisTurn)} completedToolTurns=${executedToolTurns}`
            );

            for await (const chunk of stream) {
                if (abortedRef.current || chunkCount >= MAX_CHUNKS) {
                    appLogger.warn(
                        'sessionConversationStream',
                        `[${traceId}] turn=${streamTurn} stream interrupted aborted=${String(abortedRef.current)} chunkLimit=${String(chunkCount >= MAX_CHUNKS)}`
                    );
                    break;
                }
                chunkCount += 1;

                if (chunk.type === 'content' && chunk.content) {
                    turnState.reasoningSegmentOpen = false;
                    turnState.content += chunk.content;
                    displayContent = turnState.content;
                    patchAssistantState(setMessages, assistantId, intentClassification, language, {
                        completedReasonings,
                        pendingReasonings: turnState.reasonings,
                        completedToolCalls,
                        pendingToolCalls: turnState.toolCalls,
                        toolMessages,
                        images: generatedImages,
                        displayContent,
                        isStreaming: true,
                    });
                    continue;
                }

                if (chunk.type === 'reasoning' && typeof chunk.reasoning === 'string') {
                    const nextReasoningState = appendReasoningChunk(
                        turnState.reasonings,
                        chunk.reasoning,
                        turnState.reasoningSegmentOpen
                    );
                    turnState.reasonings = nextReasoningState.nextReasonings;
                    turnState.reasoningSegmentOpen = nextReasoningState.nextReasoningSegmentOpen;
                    patchAssistantState(setMessages, assistantId, intentClassification, language, {
                        completedReasonings,
                        pendingReasonings: turnState.reasonings,
                        completedToolCalls,
                        pendingToolCalls: turnState.toolCalls,
                        toolMessages,
                        images: generatedImages,
                        displayContent,
                        isStreaming: true,
                    });
                    continue;
                }

                if (chunk.type === 'tool_calls' && Array.isArray(chunk.tool_calls)) {
                    turnState.reasoningSegmentOpen = false;
                    const thoughtIndex = Math.max(0, completedReasonings.length + turnState.reasonings.length - 1);
                    const incomingToolCalls = chunk.tool_calls.map(toolCall => ({
                        ...toolCall,
                        thoughtIndex,
                    }));
                    turnState.toolCalls = mergeChatToolCalls(
                        turnState.toolCalls,
                        incomingToolCalls,
                        {
                            fallbackIdPrefix: `${assistantId}-turn-${streamTurn}`,
                            allowIndexMatch: true,
                        }
                    ) ?? [];
                    patchAssistantState(setMessages, assistantId, intentClassification, language, {
                        completedReasonings,
                        pendingReasonings: turnState.reasonings,
                        completedToolCalls,
                        pendingToolCalls: turnState.toolCalls,
                        toolMessages,
                        images: generatedImages,
                        displayContent,
                        isStreaming: true,
                    });
                    continue;
                }

                if (chunk.type === 'error') {
                    finalErrorMessage = chunk.error ?? 'unknown';
                    displayContent = formatStreamErrorContent(displayContent, finalErrorMessage);
                    setError(categorizeConversationError(finalErrorMessage, model));
                    appLogger.error(
                        'sessionConversationStream',
                        `[${traceId}] turn=${streamTurn} chunk-error ${finalErrorMessage}`,
                        new Error(finalErrorMessage)
                    );
                    break;
                }

                turnState.reasoningSegmentOpen = false;
            }

            if (finalErrorMessage) {
                break;
            }

            completedReasonings = mergeReasoningSegments([
                ...completedReasonings,
                ...turnState.reasonings,
            ]);
            if (turnState.content.trim().length > 0) {
                displayContent = turnState.content;
            }

            appLogger.info(
                'sessionConversationStream',
                `[${traceId}] turn=${streamTurn} stream-end contentLen=${turnState.content.length} reasoningSegments=${turnState.reasonings.length} toolCalls=${turnState.toolCalls.length}`
            );

            if (turnState.toolCalls.length === 0) {
                patchAssistantState(setMessages, assistantId, intentClassification, language, {
                    completedReasonings,
                    pendingReasonings: [],
                    completedToolCalls,
                    pendingToolCalls: [],
                    toolMessages,
                    images: generatedImages,
                    displayContent,
                    isStreaming: true,
                });
                appLogger.info(
                    'sessionConversationStream',
                    `[${traceId}] turn=${streamTurn} finalized without further tool calls`
                );
                break;
            }

            if (!toolsAllowedThisTurn) {
                finalErrorMessage = 'Session tool loop budget exhausted before executing pending tool calls.';
                setError(categorizeConversationError(finalErrorMessage, model));
                appLogger.warn(
                    'sessionConversationStream',
                    `[${traceId}] turn=${streamTurn} tool budget exhausted pendingToolCalls=${turnState.toolCalls.length}`
                );
                break;
            }

            patchAssistantState(setMessages, assistantId, intentClassification, language, {
                completedReasonings,
                pendingReasonings: [],
                completedToolCalls,
                pendingToolCalls: turnState.toolCalls,
                toolMessages,
                images: generatedImages,
                displayContent,
                isStreaming: true,
            });

            appLogger.info(
                'sessionConversationStream',
                `[${traceId}] turn=${streamTurn} execute-tools start count=${turnState.toolCalls.length}`
            );
            const executionResult = await executeBatchToolCalls({
                toolCalls: turnState.toolCalls,
                workspacePath: undefined,
                t: identityTranslate,
                chatId: sessionId,
                accumulatedMessages: toolMessages,
                executeToolCall: (toolCall, activeWorkspacePath, translate, activeChatId) =>
                    executeToolCall(
                        toolCall,
                        activeWorkspacePath,
                        translate,
                        readToolResultImages,
                        activeChatId
                    ),
            });
            executedToolTurns += 1;
            if (executionResult.generatedImages.length > 0) {
                generatedImages = Array.from(new Set([
                    ...generatedImages,
                    ...executionResult.generatedImages,
                ]));
            }
            completedToolCalls = buildDisplayToolCalls(completedToolCalls, turnState.toolCalls) ?? [];
            patchAssistantState(setMessages, assistantId, intentClassification, language, {
                completedReasonings,
                pendingReasonings: [],
                completedToolCalls,
                pendingToolCalls: [],
                toolMessages,
                images: generatedImages,
                displayContent,
                isStreaming: true,
            });

            appLogger.info(
                'sessionConversationStream',
                `[${traceId}] turn=${streamTurn} execute-tools finish results=${executionResult.toolResults.length} images=${executionResult.generatedImages.length}`
            );

            if (abortedRef.current) {
                appLogger.warn(
                    'sessionConversationStream',
                    `[${traceId}] turn=${streamTurn} tool execution finished but abortedRef is true, stopping turn loop.`
                );
                break;
            }

            currentMessages = buildModelConversation(
                currentMessages,
                createTurnAssistantMessage(assistantId, provider, model, turnState),
                executionResult.toolResults
            );
        }
    } catch (streamError) {
        finalErrorMessage = streamError instanceof Error ? streamError.message : 'Stream failed';
        setError(categorizeConversationError(finalErrorMessage, model));
        displayContent = formatStreamErrorContent(displayContent, finalErrorMessage);
        appLogger.error(
            'sessionConversationStream',
            `[${traceId}] stream exception ${finalErrorMessage}`,
            streamError instanceof Error ? streamError : new Error(finalErrorMessage)
        );
    } finally {
        if (finalErrorMessage) {
            patchAssistantState(setMessages, assistantId, intentClassification, language, {
                completedReasonings,
                pendingReasonings: [],
                completedToolCalls,
                pendingToolCalls: [],
                toolMessages,
                images: generatedImages,
                displayContent,
                isStreaming: false,
                assistantTimestamp,
            });
        } else {
            setMessages(previous => {
                const assistantMessage = previous.find(message => message.id === assistantId);
                if (!assistantMessage) {
                    return previous;
                }
                const content = toTextContent(assistantMessage.content);
                return patchAssistantMessage(previous, assistantId, buildAssistantMessageUpdates(
                    intentClassification,
                    language,
                    {
                        completedReasonings,
                        pendingReasonings: [],
                        completedToolCalls,
                        pendingToolCalls: [],
                        toolMessages,
                        images: generatedImages,
                        displayContent: content,
                        isStreaming: false,
                        assistantTimestamp,
                    }
                ));
            });
        }
        setIsStreaming(false);
        appLogger.info(
            'sessionConversationStream',
            `[${traceId}] finalize turns=${streamTurn} executedToolTurns=${executedToolTurns} completedToolCalls=${completedToolCalls.length} toolMessages=${toolMessages.length} error=${finalErrorMessage ?? 'none'}`
        );
    }
}
