/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { AiIntentClassification } from '@shared/types/ai-runtime';
import { JsonValue } from '@shared/types/common';
import type { Dispatch, SetStateAction } from 'react';
import {
    calculateToolCallSignature,
    composeDeterministicAnswer,
    getAiToolLoopBudget,
    isLowSignalProgressContent,
} from '@shared/utils/ai-runtime.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';

import { compactToolCallsForDisplay } from '@/features/chat/components/message/tool-call-display.util';
import { chatStream } from '@/lib/chat-stream';
import { generateId } from '@/lib/utils';
import { Chat, Message, ToolCall, ToolDefinition } from '@/types';
import { appLogger } from '@/utils/renderer-logger';
import { 
    getChatSnapshot,
    setChats,
    StreamingState,
    setStreamingState, 
    updateChatInStore, 
    updateMessageInStore 
} from '@/store/chat.store';

import {
    buildRepeatedToolMessages,
    buildStoredToolResults,
    getToolMessageContent,
    readToolResultImages,
    deduplicateMessages,
    shouldRecoverFromLowSignalFinalContent,
} from './ai-runtime-chat.util';
import {
    isExecutableToolCall,
    isMonotonousToolFamily,
    REPEATED_TOOL_RESULT_HINT,
    TOOL_LOOP_DIRECT_ANSWER_HINT,
    TOOL_LOOP_LOW_SIGNAL_CONTENT_THRESHOLD,
    TOOL_LOOP_RECENT_SIGNATURE_WINDOW,
} from './chat-runtime-policy.util';
import { processChatStream } from './process-stream';
import type { StreamStreamingState } from './process-stream';
import { executeBatchToolCalls } from './tool-batch-execution.util';
import { executeToolCall } from './tool-call-execution.util';
import {
    appendToolMessages,
    cacheToolContentsForSignature,
    createToolEvidenceState,
    getCachedToolContentsForSignature,
    rememberToolCalls,
} from './tool-evidence-store.util';
import { buildModelConversation, updateRecentToolSignatures } from './tool-loop.util';
import {
    evaluateLoopSafety,
    finalizeLoopForcefully,
    finalizeToolTurn,
    finalizeWithImages,
    handleMalformedToolCalls,
} from './tool-turn-management.util';
import { mergeToolCallHistory } from './utils';

interface BuildAssistantMessageOptions {
    id: string;
    content: string;
    provider: string;
    model: string;
    turnToolCalls: ToolCall[];
    reasonings: string[];
}

function buildAssistantMessage(options: BuildAssistantMessageOptions): Message {
    const { id, content, provider, model, turnToolCalls, reasonings } = options;
    return {
        id,
        role: 'assistant',
        content: content.trim(),
        timestamp: new Date(),
        provider,
        model,
        toolCalls: turnToolCalls.length > 0 ? [...turnToolCalls] : undefined,
        reasonings: reasonings.length > 0 ? [...reasonings] : undefined,
    };
}

function buildInFlightToolProgressMessage(
    toolCalls: ToolCall[],
    t: (key: string, options?: Record<string, unknown>) => string
): string {
    const uniqueNames = Array.from(
        new Set(
            toolCalls
                .map(call => call.function.name.trim())
                .filter(name => name.length > 0)
        )
    );
    if (uniqueNames.length === 0) {
        return '';
    }
    const translatedPrefix = t('tools.usingTool');
    const prefix = translatedPrefix && translatedPrefix !== 'tools.usingTool'
        ? translatedPrefix
        : 'Using tool';
    const listedNames = uniqueNames.slice(0, 2).map(name => `\`${name}\``).join(', ');
    const overflowCount = uniqueNames.length - 2;
    const overflowSuffix = overflowCount > 0 ? ` +${overflowCount}` : '';
    return `${prefix}: ${listedNames}${overflowSuffix}`;
}

function toCachedToolMessageContents(
    cachedContents: JsonValue[] | undefined
): string[] {
    if (!Array.isArray(cachedContents)) {
        return [];
    }
    return cachedContents.map(content =>
        typeof content === 'string' ? content : JSON.stringify(content)
    );
}

function readToolMessagePayload(message: Message): Record<string, JsonValue> {
    if (message.role !== 'tool' || typeof message.content !== 'string') {
        return {};
    }
    return safeJsonParse<Record<string, JsonValue>>(message.content, {});
}

function isSuccessfulToolMessage(message: Message): boolean {
    const payload = readToolMessagePayload(message);
    if (payload['success'] === false || typeof payload['error'] === 'string') {
        return false;
    }
    if (payload['_cached'] === true) {
        return false;
    }
    const details = payload['details'];
    if (details && typeof details === 'object' && !Array.isArray(details)) {
        const detailsRecord = details as Record<string, JsonValue>;
        if (detailsRecord['success'] === false || typeof detailsRecord['error'] === 'string') {
            return false;
        }
        if (detailsRecord['_cached'] === true || detailsRecord['retrySameCall'] === false) {
            return false;
        }
    }
    return Object.keys(payload).length > 0;
}

function hasSuccessfulToolEvidence(toolResults: Message[]): boolean {
    return toolResults.some(isSuccessfulToolMessage);
}

function buildInvalidToolResultMessage(
    toolCall: ToolCall,
    missingArgument: string
): Message {
    return {
        id: generateId(),
        role: 'tool',
        content: JSON.stringify({
            success: false,
            error: `Tool '${toolCall.function.name}' requires a valid '${missingArgument}' argument. Reuse prior evidence or infer the missing value before calling it again.`,
            errorType: 'invalid_args',
            tool: toolCall.function.name,
            details: {
                success: false,
                resultKind: 'tool_argument_validation',
                tool: toolCall.function.name,
                missingArgument,
                complete: false,
                retrySameCall: false,
            },
        }),
        toolCallId: toolCall.id,
        timestamp: new Date(),
    };
}

function findMissingRequiredArgument(toolCall: ToolCall, tools: ToolDefinition[]): string | null {
    const definition = tools.find(candidate => candidate.function.name === toolCall.function.name);
    const required = Array.isArray(definition?.function.parameters?.required)
        ? definition.function.parameters.required as string[]
        : [];
    if (required.length === 0) {
        return null;
    }

    const args = safeJsonParse<Record<string, JsonValue>>(toolCall.function.arguments, {});
    for (const key of required) {
        const value = args[key];
        if (typeof value === 'string' && value.trim().length > 0) {
            continue;
        }
        if (Array.isArray(value) && value.length > 0) {
            continue;
        }
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            continue;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            continue;
        }
        return key;
    }
    return null;
}


function buildDeterministicAnswerFromEvidence(
    intentClassification: AiIntentClassification,
    toolCalls: ToolCall[],
    toolMessages: Message[],
    language: string
): string | undefined {
    const storedToolResults = buildStoredToolResults(toolCalls, toolMessages);
    return composeDeterministicAnswer({
        intent: intentClassification,
        content: '',
        toolCalls,
        toolResults: storedToolResults,
        language,
    });
}

function updateInFlightToolProgress(params: {
    chatId: string;
    assistantId: string;
    toolCallsHistory: ToolCall[];
    toolEvidenceState: ReturnType<typeof createToolEvidenceState>;
}) {
    const { chatId, assistantId, toolCallsHistory, toolEvidenceState } = params;
    const stored = buildStoredToolResults(toolCallsHistory, toolEvidenceState.toolMessages);
    updateChatInStore(chatId, {
        messages: (getChatSnapshot().chats.find(c => c.id === chatId)?.messages || []).map((m: Message) => 
            m.id === assistantId ? { ...m, toolCalls: compactToolCallsForDisplay(toolCallsHistory) ?? m.toolCalls, toolResults: stored } : m
        ),
    });
}

function summarizeIteration(params: {
    toolEvidenceState: ReturnType<typeof createToolEvidenceState>;
    validExecutableToolCalls: ToolCall[];
    chatId: string;
    assistantId: string;
    toolCallsHistory: ToolCall[];
    activeWorkspacePath: string | undefined;
    t: (key: string, options?: Record<string, unknown>) => string;
}) {
    const { toolEvidenceState, validExecutableToolCalls, chatId, assistantId, toolCallsHistory, activeWorkspacePath, t } = params;
    rememberToolCalls(toolEvidenceState, validExecutableToolCalls);
    updateInFlightToolProgress({
        chatId, assistantId, toolCallsHistory, toolEvidenceState,
    });
    return executeBatchToolCalls({
        toolCalls: validExecutableToolCalls, workspacePath: activeWorkspacePath, t, chatId,
        accumulatedMessages: toolEvidenceState.toolMessages, executeToolCall: (tc, wp, tr, cid) => executeToolCall(tc, wp, tr, readToolResultImages, cid),
        onToolProgress: () => updateInFlightToolProgress({
            chatId, assistantId, toolCallsHistory, toolEvidenceState,
        }),
    });
}

interface ExecuteToolTurnLoopParams {
    initialMessages: Message[];
    chatId: string;
    assistantId: string;
    activeModel: string;
    selectedProvider: string;
    tools: ToolDefinition[];
    fullOptions: Record<string, RendererDataValue>;
    workspaceId: string | undefined;
    autoReadEnabled: boolean;
    handleSpeak: (id: string, content: string) => void;
    t: (key: string, options?: Record<string, unknown>) => string;
    language: string;
    activeWorkspacePath: string | undefined;
    systemMode: 'thinking' | 'agent' | 'fast';
    intentClassification: AiIntentClassification;
    confirmAntigravityCreditUsage?: (model: string, provider: string) => Promise<boolean>;
}

interface ModelTurnResult {
    finalContent: string;
    finalReasoning: string;
    finalToolCalls: ToolCall[];
    turnToolCalls: ToolCall[];
    turnDisplayContent: string;
    accumulatedContent: string;
}

async function performModelTurn(params: {
    currentMessages: Message[];
    activeModel: string;
    tools: ToolDefinition[];
    toolsAllowed: boolean;
    selectedProvider: string;
    workspaceId: string | undefined;
    systemMode: 'thinking' | 'agent' | 'fast';
    t: (key: string, options?: Record<string, unknown>) => string;
    autoReadEnabled: boolean;
    handleSpeak: (id: string, content: string) => void;
    intentClassification: AiIntentClassification;
    language: string;
    reasonings: string[];
    accumulatedContent: string;
    toolCallsHistory: ToolCall[];
    traceId: string;
    chatId: string;
    assistantId: string;
    activeWorkspacePath?: string;
    fullOptions: Record<string, RendererDataValue>;
    iteration: number;
}): Promise<ModelTurnResult> {
    const {
        currentMessages, activeModel, tools, toolsAllowed, selectedProvider,
        fullOptions, activeWorkspacePath, chatId, assistantId, workspaceId,
        systemMode, t, autoReadEnabled,
        handleSpeak, intentClassification, language, reasonings,
        accumulatedContent, toolCallsHistory, traceId, iteration,
    } = params;

    const stream = chatStream({
        messages: currentMessages,
        model: activeModel,
        tools: toolsAllowed ? tools : [],
        provider: selectedProvider,
        options: { ...fullOptions, workspaceRoot: activeWorkspacePath, systemMode },
        chatId,
        assistantId,
        workspaceId,
        systemMode,
    });
    const streamStartTime = performance.now();

    const result = await processChatStream({
        stream,
        chatId,
        assistantId,
        setStreamingStates: (updater: SetStateAction<Record<string, StreamStreamingState>>) => {
            if (typeof updater === 'function') {
                const snapshot = getChatSnapshot().streamingStates;
                const next = updater(snapshot);
                setStreamingState(chatId, next[chatId] as StreamingState);
            } else {
                setStreamingState(chatId, updater[chatId] as StreamingState);
            }
        },
        setChats: setChats as Dispatch<SetStateAction<Chat[]>>,
        streamStartTime,
        activeModel,
        selectedProvider,
        t,
        autoReadEnabled,
        handleSpeak,
        intentClassification,
        language,
        initialReasonings: [...reasonings],
        initialContent: accumulatedContent,
        initialToolCalls: [...toolCallsHistory],
    });

    const streamDuration = Math.round(performance.now() - streamStartTime);
    appLogger.info(
        'useChatGenerator',
        `[${traceId}] iteration=${iteration} stream-done durationMs=${streamDuration}, finalContentLen=${result.finalContent.length}, finalReasoningLen=${result.finalReasoning.length}, turnToolCalls=${result.finalToolCalls.length}`
    );

    const streamedContent = result.finalContent;
    let turnReasoning = result.finalReasoning.trim();

    if (turnReasoning.length === 0) {
        const thinkMatch = /<think>([\s\S]*?)<\/think>/i.exec(streamedContent);
        if (thinkMatch) {
            turnReasoning = thinkMatch[1].trim();
        }
    }

    if (turnReasoning.length > 0) {
        reasonings.push(turnReasoning);
    }

    const previousHistoryCount = toolCallsHistory.length;
    const updatedHistory = mergeToolCallHistory(toolCallsHistory, result.finalToolCalls);
    const turnToolCalls = updatedHistory.slice(previousHistoryCount);

    let turnDisplayContent = streamedContent.trim().length > 0 ? streamedContent : accumulatedContent;
    if (turnToolCalls.length > 0 && turnDisplayContent.trim().length === 0) {
        turnDisplayContent = buildInFlightToolProgressMessage(turnToolCalls, t);
        if (turnDisplayContent.trim().length > 0) {
            updateMessageInStore(chatId, assistantId, { content: turnDisplayContent });
            void window.electron.db.updateMessage(assistantId, { content: turnDisplayContent }).catch(err => {
                appLogger.error('useChatGenerator', 'Failed to persist in-flight tool progress', err as Error);
            });
        }
    }

    let nextAccumulated = accumulatedContent;
    if (streamedContent.trim().length > 0) {
        const normalized = streamedContent.trim();
        if (isLowSignalProgressContent(normalized) && !normalized.startsWith('<think>')) {
            appLogger.info('useChatGenerator', `[${traceId}] Wrapping low-signal content in <think> tags`);
            nextAccumulated = `<think>\n${normalized}\n</think>`;
            if (!reasonings.includes(normalized)) { reasonings.push(normalized); }
        } else {
            nextAccumulated = streamedContent;
        }
    }

    return {
        finalContent: streamedContent,
        finalReasoning: turnReasoning,
        finalToolCalls: updatedHistory,
        turnToolCalls,
        turnDisplayContent,
        accumulatedContent: nextAccumulated,
    };
}

async function handleTurnConclusion(params: {
    turnResult: ModelTurnResult;
    toolEvidenceState: ReturnType<typeof createToolEvidenceState>;
    params: ExecuteToolTurnLoopParams;
    currentMessages: Message[];
    lowSignalRecoveryCount: number;
    noProgressToolTurnCount: number;
    reasonings: string[];
    traceId: string;
    toolCallsHistory: ToolCall[];
}): Promise<{
    nextMessages?: Message[];
    shouldBreak: boolean;
    lowSignalRecoveryCount: number;
    noProgressToolTurnCount: number;
    wasSafetyBreak: boolean;
}> {
    const {
        turnResult, toolEvidenceState, params: loopParams, currentMessages, reasonings,
        traceId, toolCallsHistory,
    } = params;
    let { lowSignalRecoveryCount, noProgressToolTurnCount } = params;
    const { finalContent } = turnResult;
    const assistantContent = finalContent.trim();
    const {
        chatId, assistantId, selectedProvider, activeModel,
        intentClassification, language,
    } = loopParams;

    if (
        shouldRecoverFromLowSignalFinalContent(assistantContent, toolEvidenceState.toolMessages)
        && lowSignalRecoveryCount < 1
    ) {
        const deterministicFallback = buildDeterministicAnswerFromEvidence(
            intentClassification,
            toolCallsHistory,
            toolEvidenceState.toolMessages,
            language
        );
        const lastAssistantMessage: Message = {
            id: assistantId,
            role: 'assistant',
            content: assistantContent,
            timestamp: new Date(),
            provider: selectedProvider,
            model: activeModel,
        };
        noProgressToolTurnCount += 1;
        lowSignalRecoveryCount += 1;
        const nextMessages = [
            ...currentMessages,
            lastAssistantMessage,
            {
                id: generateId(),
                role: 'system' as const,
                content: deterministicFallback
                    ? `${TOOL_LOOP_DIRECT_ANSWER_HINT} Use the existing evidence to provide the final answer now.`
                    : `${TOOL_LOOP_DIRECT_ANSWER_HINT} Do not say that you are checking, waiting, or inspecting. Give the final answer now from the existing evidence.`,
                timestamp: new Date(),
            },
        ];
        return { nextMessages, shouldBreak: false, lowSignalRecoveryCount, noProgressToolTurnCount, wasSafetyBreak: false };
    }

    if (
        shouldRecoverFromLowSignalFinalContent(assistantContent, toolEvidenceState.toolMessages)
        && lowSignalRecoveryCount >= 1
    ) {
        appLogger.warn('useChatGenerator', `[${traceId}] Low-signal recovery limit reached, forcing finalize`);
        return { shouldBreak: true, lowSignalRecoveryCount, noProgressToolTurnCount, wasSafetyBreak: true };
    }

    await finalizeToolTurn({
        assistantId, chatId, callMap: toolEvidenceState.toolCallMap,
        messages: toolEvidenceState.toolMessages, provider: selectedProvider,
        model: activeModel, intentClassification, language, reasonings,
        content: finalContent,
        reasoning: turnResult.finalReasoning,
    });
    return { shouldBreak: true, lowSignalRecoveryCount, noProgressToolTurnCount, wasSafetyBreak: false };
}

function processTurnToolCalls(params: {
    validExecutableToolCalls: ToolCall[];
    recentToolSignatures: string[];
    lastToolSignature: string;
    repeatedToolSignatureCount: number;
    traceId: string;
}): {
    toolSignature: string;
    lastToolSignature: string;
    repeatedToolSignatureCount: number;
    recentToolSignatures: string[];
} {
    const { validExecutableToolCalls, traceId } = params;
    let { lastToolSignature, repeatedToolSignatureCount, recentToolSignatures } = params;

    const toolSignature = calculateToolCallSignature(validExecutableToolCalls);
    if (toolSignature === lastToolSignature) {
        repeatedToolSignatureCount += 1;
    } else {
        repeatedToolSignatureCount = 1;
        lastToolSignature = toolSignature;
    }
    appLogger.info('useChatGenerator', `[${traceId}] Tool signature check: repeatedCount=${repeatedToolSignatureCount}, signature=${toolSignature || 'empty'}`);

    recentToolSignatures = updateRecentToolSignatures(
        recentToolSignatures,
        toolSignature,
        TOOL_LOOP_RECENT_SIGNATURE_WINDOW
    );

    return { toolSignature, lastToolSignature, repeatedToolSignatureCount, recentToolSignatures };
}

export async function executeToolTurnLoop(params: ExecuteToolTurnLoopParams): Promise<string> {
    const {
        initialMessages, chatId, assistantId, activeModel, selectedProvider,
        tools, fullOptions, workspaceId, t, language,
        activeWorkspacePath, systemMode, intentClassification,
        confirmAntigravityCreditUsage,
    } = params;
    const toolLoopBudget = getAiToolLoopBudget(intentClassification);

    let toolIterations = 0;
    let currentMessages: Message[] = initialMessages;
    const toolEvidenceState = createToolEvidenceState();
    let repeatedToolSignatureCount = 0;
    let lastToolSignature = '';
    let recentToolSignatures: string[] = [];
    let noProgressToolTurnCount = 0;
    let executedToolTurnCount = 0;
    let lowSignalRecoveryCount = 0;
    let malformedToolCallCount = 0;
    let wasSafetyBreak = false;
    let lastAssistantMessage: Message | null = null;
    let lastToolResults: Message[] = [];
    const cachedToolContentsByName = new Map<string, string[]>();
    const reasonings: string[] = [];
    let accumulatedContent = '';
    let toolCallsHistory: ToolCall[] = [];
    const seenToolFamilies = new Set<string>();
    let lastToolFamily = '';
    let consecutiveSameFamilyTurns = 0;
    const traceId = `${chatId.slice(0, 8)}:${assistantId.slice(0, 8)}`;

    while (toolIterations < toolLoopBudget.maxModelTurns) {
        if (currentMessages.length === 0) {
            break;
        }
        const toolsAllowed = executedToolTurnCount < toolLoopBudget.maxExecutedToolTurns;
        
        if (confirmAntigravityCreditUsage && !(await confirmAntigravityCreditUsage(activeModel, selectedProvider))) {
            wasSafetyBreak = true;
            break;
        }

        const turnResult = await performModelTurn({
            ...params, currentMessages, toolsAllowed, reasonings, accumulatedContent,
            toolCallsHistory, traceId, iteration: toolIterations + 1,
        });

        const { turnToolCalls, turnDisplayContent } = turnResult;
        toolCallsHistory = turnResult.finalToolCalls;
        accumulatedContent = turnResult.accumulatedContent;

        if (turnToolCalls.length === 0) {
            const conclusion = await handleTurnConclusion({
                turnResult, toolEvidenceState, params, currentMessages,
                lowSignalRecoveryCount, noProgressToolTurnCount, reasonings, traceId, toolCallsHistory,
            });
            lowSignalRecoveryCount = conclusion.lowSignalRecoveryCount;
            noProgressToolTurnCount = conclusion.noProgressToolTurnCount;
            if (conclusion.shouldBreak) {
                wasSafetyBreak = conclusion.wasSafetyBreak;
                break;
            }
            if (conclusion.nextMessages) {
                currentMessages = conclusion.nextMessages;
                toolIterations++;
                continue;
            }
        }

        const executableToolCalls = turnToolCalls.filter(isExecutableToolCall);
        if (executableToolCalls.length === 0) {
            await handleMalformedToolCalls({
                result: { ...turnResult, finalToolCalls: turnToolCalls },
                assistantId, chatId, provider: selectedProvider,
                model: activeModel, callMap: toolEvidenceState.toolCallMap,
                messages: toolEvidenceState.toolMessages, intentClassification, t, language, reasonings,
            });
            break;
        }

        const invalidToolResults = executableToolCalls
            .map(tc => {
                const missing = findMissingRequiredArgument(tc, tools);
                return missing ? buildInvalidToolResultMessage(tc, missing) : null;
            })
            .filter((m): m is Message => m !== null);
        const validExecutableToolCalls = executableToolCalls.filter(tc => !invalidToolResults.some(m => m.toolCallId === tc.id));

        if (invalidToolResults.length > 0) {
            appendToolMessages(toolEvidenceState, invalidToolResults);
            lastToolResults = invalidToolResults;
            noProgressToolTurnCount++;
            malformedToolCallCount += invalidToolResults.length;
            if (malformedToolCallCount >= 3) {
                wasSafetyBreak = true;
                break;
            }
            currentMessages = [
                ...buildModelConversation(currentMessages, lastAssistantMessage ?? buildAssistantMessage({
                    id: assistantId, content: turnDisplayContent, provider: selectedProvider,
                    model: activeModel, turnToolCalls, reasonings,
                }), invalidToolResults),
                { id: generateId(), role: 'system', content: 'Missing required arguments. Fix and retry.', timestamp: new Date() },
            ];
            toolIterations++;
            if (validExecutableToolCalls.length === 0) {
                continue;
            }
        }

        const sigInfo = processTurnToolCalls({
            validExecutableToolCalls, recentToolSignatures, lastToolSignature, repeatedToolSignatureCount, traceId,
        });
        ({ lastToolSignature, repeatedToolSignatureCount, recentToolSignatures } = sigInfo);
        const { toolSignature } = sigInfo;

        const assistantMsg = buildAssistantMessage({
            id: assistantId, content: turnDisplayContent, provider: selectedProvider,
            model: activeModel, turnToolCalls, reasonings,
        });
        lastAssistantMessage = assistantMsg;

        const cachedSignaturePayload = getCachedToolContentsForSignature(toolSignature);
        const cachedSignatureContents = toCachedToolMessageContents(
            Array.isArray(cachedSignaturePayload)
                ? cachedSignaturePayload as JsonValue[]
                : undefined
        );
        const isRepeatedSignature = repeatedToolSignatureCount >= 2 && cachedSignatureContents.length > 0;
        const isResolvePathRepeat = validExecutableToolCalls.length > 0
            && validExecutableToolCalls.every(toolCall => toolCall.function.name === 'resolve_path')
            && seenToolFamilies.has('resolve_path');

        if (isRepeatedSignature || isResolvePathRepeat) {
            const reusedContents = isResolvePathRepeat
                ? (cachedToolContentsByName.get('resolve_path') ?? cachedSignatureContents)
                : cachedSignatureContents;
            const repeatedToolResults = buildRepeatedToolMessages(
                validExecutableToolCalls,
                reusedContents,
                REPEATED_TOOL_RESULT_HINT
            );
            appendToolMessages(toolEvidenceState, repeatedToolResults);
            rememberToolCalls(toolEvidenceState, validExecutableToolCalls);
            lastToolResults = repeatedToolResults;
            updateInFlightToolProgress({
                chatId, assistantId, toolCallsHistory, toolEvidenceState,
            });

            const hasSuccessfulEvidence = hasSuccessfulToolEvidence(toolEvidenceState.toolMessages);
            if (hasSuccessfulEvidence || repeatedToolSignatureCount >= 3) {
                noProgressToolTurnCount += 1;
            }

            if (isLowSignalProgressContent(turnDisplayContent.trim()) && hasSuccessfulEvidence) {
                wasSafetyBreak = true;
                break;
            }

            const loopAction = evaluateLoopSafety({
                repeatedToolSignatureCount, executableToolCalls: validExecutableToolCalls,
                currentMessages, assistantMsg, toolResults: repeatedToolResults, noProgressToolTurnCount,
                recentToolSignatures, executedToolTurnCount, noProgressThreshold: toolLoopBudget.noProgressThreshold,
                maxExecutedToolTurns: toolLoopBudget.maxExecutedToolTurns, activeModel, selectedProvider,
                fullOptions, activeWorkspacePath, systemMode, chatId, workspaceId, intentClassification,
                currentAssistantId: assistantId, accumulatedToolCallMap: toolEvidenceState.toolCallMap,
                accumulatedToolMessages: toolEvidenceState.toolMessages, evidenceRecords: toolEvidenceState.evidenceRecords, t, language,
            }, { recentSignatureWindow: TOOL_LOOP_RECENT_SIGNATURE_WINDOW, directAnswerHint: TOOL_LOOP_DIRECT_ANSWER_HINT });
            if (loopAction.action === 'break') {
                wasSafetyBreak = true;
                break;
            }
            const finalAssistantMessage = buildAssistantMessage({
                id: assistantId, content: turnDisplayContent, provider: selectedProvider,
                model: activeModel, turnToolCalls, reasonings,
            });
            const visibleChats = getChatSnapshot().chats.find(c => c.id === chatId);
            if (visibleChats) {
                updateChatInStore(chatId, {
                    messages: deduplicateMessages([...visibleChats.messages, finalAssistantMessage])
                });
            }
            currentMessages = [
                ...buildModelConversation(currentMessages, assistantMsg, repeatedToolResults),
                {
                    id: generateId(),
                    role: 'system',
                    content: `${REPEATED_TOOL_RESULT_HINT} ${TOOL_LOOP_DIRECT_ANSWER_HINT}`,
                    timestamp: new Date(),
                },
            ];
            toolIterations++;
            continue;
        }

        if (!toolsAllowed) {
            const loopAction = evaluateLoopSafety({
                repeatedToolSignatureCount, executableToolCalls: validExecutableToolCalls,
                currentMessages, assistantMsg, toolResults: [], noProgressToolTurnCount,
                recentToolSignatures, executedToolTurnCount, noProgressThreshold: toolLoopBudget.noProgressThreshold,
                maxExecutedToolTurns: toolLoopBudget.maxExecutedToolTurns, activeModel, selectedProvider,
                fullOptions, activeWorkspacePath, systemMode, chatId, workspaceId, intentClassification,
                currentAssistantId: assistantId, accumulatedToolCallMap: toolEvidenceState.toolCallMap,
                accumulatedToolMessages: toolEvidenceState.toolMessages, evidenceRecords: toolEvidenceState.evidenceRecords, t, language,
            }, { recentSignatureWindow: TOOL_LOOP_RECENT_SIGNATURE_WINDOW, directAnswerHint: TOOL_LOOP_DIRECT_ANSWER_HINT });
            if (loopAction.action === 'break') {
                wasSafetyBreak = true;
                break;
            }
            currentMessages = loopAction.nextMessages;
            toolIterations++;
            continue;
        }

        const currentTurnFamilies = Array.from(new Set(validExecutableToolCalls.map(tc => tc.function.name)));
        const currentTurnFamily = currentTurnFamilies.length === 1 ? currentTurnFamilies[0] : '';
        consecutiveSameFamilyTurns = (currentTurnFamily === lastToolFamily && currentTurnFamily.length > 0) ? consecutiveSameFamilyTurns + 1 : (currentTurnFamily.length > 0 ? 1 : 0);
        lastToolFamily = currentTurnFamily;

        const isAgenticWorkflow = intentClassification.intent === 'agentic_workflow';
        const isRepeatedExactToolSignature = repeatedToolSignatureCount >= 2;
        const hasMonotonousToolFamily = isMonotonousToolFamily(recentToolSignatures, 3) || consecutiveSameFamilyTurns >= 3;
        if (noProgressToolTurnCount >= 2 && hasMonotonousToolFamily && (!isAgenticWorkflow || isRepeatedExactToolSignature)) {
            wasSafetyBreak = true;
            break;
        }

        const { toolResults, generatedImages } = await summarizeIteration({
            toolEvidenceState, validExecutableToolCalls, chatId, assistantId, 
            toolCallsHistory, activeWorkspacePath, t,
        });
        lastToolResults = toolResults;
        executedToolTurnCount++;
        cacheToolContentsForSignature(toolSignature, toolResults.map(tr => getToolMessageContent(tr)));
        for (let resultIndex = 0; resultIndex < validExecutableToolCalls.length; resultIndex += 1) {
            const call = validExecutableToolCalls[resultIndex];
            const message = toolResults[resultIndex];
            if (!message) {
                continue;
            }
            cachedToolContentsByName.set(call.function.name, [getToolMessageContent(message)]);
        }
        
        const contentLen = turnResult.finalContent.trim().length;
        const hasNewToolFamily = validExecutableToolCalls.some(tc => !seenToolFamilies.has(tc.function.name));
        const hasNewToolSignature = repeatedToolSignatureCount === 1;
        const currentTurnMadeProgress = contentLen > TOOL_LOOP_LOW_SIGNAL_CONTENT_THRESHOLD
            || (hasSuccessfulToolEvidence(toolResults) && (hasNewToolFamily || (isAgenticWorkflow && hasNewToolSignature)));
        for (const tc of validExecutableToolCalls) {
            seenToolFamilies.add(tc.function.name);
        }
        noProgressToolTurnCount = currentTurnMadeProgress ? 0 : noProgressToolTurnCount + 1;

        if (generatedImages.length > 0) {
            await finalizeWithImages({
                result: turnResult, assistantId, chatId, images: generatedImages, calls: executableToolCalls,
                results: toolResults, provider: selectedProvider, model: activeModel,
                callMap: toolEvidenceState.toolCallMap, messages: toolEvidenceState.toolMessages,
                intentClassification, language,
            });
            break;
        }

        const loopAction = evaluateLoopSafety({
            repeatedToolSignatureCount, executableToolCalls: validExecutableToolCalls,
            currentMessages, assistantMsg, toolResults, noProgressToolTurnCount,
            recentToolSignatures, executedToolTurnCount, noProgressThreshold: toolLoopBudget.noProgressThreshold,
            maxExecutedToolTurns: toolLoopBudget.maxExecutedToolTurns, activeModel, selectedProvider,
            fullOptions, activeWorkspacePath, systemMode, chatId, workspaceId, intentClassification,
            currentAssistantId: assistantId, accumulatedToolCallMap: toolEvidenceState.toolCallMap,
            accumulatedToolMessages: toolEvidenceState.toolMessages, evidenceRecords: toolEvidenceState.evidenceRecords, t, language,
        }, { recentSignatureWindow: TOOL_LOOP_RECENT_SIGNATURE_WINDOW, directAnswerHint: TOOL_LOOP_DIRECT_ANSWER_HINT });

        if (loopAction.action === 'break') {
            wasSafetyBreak = true;
            break;
        }
        currentMessages = loopAction.nextMessages;
        toolIterations++;
    }

    if (toolIterations >= toolLoopBudget.maxModelTurns || wasSafetyBreak) {
        await finalizeLoopForcefully({
            repeatedToolSignatureCount, executableToolCalls: [],
            assistantMsg: lastAssistantMessage ?? { id: '', role: 'assistant', content: '', timestamp: new Date() },
            toolResults: lastToolResults, noProgressToolTurnCount, recentToolSignatures, executedToolTurnCount,
            noProgressThreshold: toolLoopBudget.noProgressThreshold, maxExecutedToolTurns: toolLoopBudget.maxExecutedToolTurns,
            currentMessages, activeModel, selectedProvider, fullOptions, activeWorkspacePath, systemMode,
            intentClassification, chatId, workspaceId, currentAssistantId: assistantId,
            accumulatedToolCallMap: toolEvidenceState.toolCallMap, accumulatedToolMessages: toolEvidenceState.toolMessages,
            evidenceRecords: toolEvidenceState.evidenceRecords, t, language,
        }, { lowSignalContentThreshold: TOOL_LOOP_LOW_SIGNAL_CONTENT_THRESHOLD });
    }
    return assistantId;
}
