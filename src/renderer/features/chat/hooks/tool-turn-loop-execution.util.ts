import { AiIntentClassification } from '@shared/types/ai-runtime';
import { JsonValue } from '@shared/types/common';
import {
    buildAiEvidenceEntries,
    calculateToolCallSignature,
    composeDeterministicAnswer,
    createEvidenceRecord,
    getAiToolLoopBudget,
    isLowSignalProgressContent,
} from '@shared/utils/ai-runtime.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';

import { compactToolCallsForDisplay } from '@/features/chat/components/message/tool-call-display.util';
import { chatStream } from '@/lib/chat-stream';
import { generateId } from '@/lib/utils';
import { Chat, Message, ToolCall, ToolDefinition, ToolResult } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import {
    buildRepeatedToolMessages,
    buildStoredToolResults,
    getToolMessageContent,
    readToolResultImages,
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
import { processChatStream, StreamStreamingState } from './process-stream';
import { executeBatchToolCalls } from './tool-batch-execution.util';
import { executeToolCall } from './tool-call-execution.util';
import {
    appendEvidenceRecords,
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

function getMostRecentSuccessfulToolContentsByName(
    toolMessages: Message[],
    toolCallMap: Map<string, NonNullable<Message['toolCalls']>[number]>,
    toolName: string,
    count: number
): string[] | null {
    const resolveToolName = (message: Message): string | null => {
        if (message.toolCallId) {
            const mappedToolCall = toolCallMap.get(message.toolCallId);
            const mappedName = mappedToolCall?.function.name;
            if (typeof mappedName === 'string' && mappedName.trim().length > 0) {
                return mappedName;
            }
        }

        const payload = readToolMessagePayload(message);
        const directToolName = payload['tool'];
        if (typeof directToolName === 'string' && directToolName.trim().length > 0) {
            return directToolName;
        }
        const details = payload['details'];
        if (details && typeof details === 'object' && !Array.isArray(details)) {
            const detailsRecord = details as Record<string, JsonValue>;
            const nestedToolName = detailsRecord['tool'];
            if (typeof nestedToolName === 'string' && nestedToolName.trim().length > 0) {
                return nestedToolName;
            }
        }
        return null;
    };

    const matchingContents = toolMessages
        .slice()
        .reverse()
        .filter(message => isSuccessfulToolMessage(message) && resolveToolName(message) === toolName)
        .map(message => getToolMessageContent(message));
    if (matchingContents.length === 0) {
        return null;
    }
    return Array.from({ length: count }, (_, index) => matchingContents[index] ?? matchingContents[0]);
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
    setStreamingStates: React.Dispatch<React.SetStateAction<Record<string, StreamStreamingState>>>;
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
    activeWorkspacePath: string | undefined;
    systemMode: 'thinking' | 'agent' | 'fast';
    intentClassification: AiIntentClassification;
    confirmAntigravityCreditUsage?: (model: string, provider: string) => Promise<boolean>;
}

export async function executeToolTurnLoop(params: ExecuteToolTurnLoopParams): Promise<string> {
    const {
        initialMessages,
        chatId,
        assistantId,
        activeModel,
        selectedProvider,
        tools,
        fullOptions,
        workspaceId,
        autoReadEnabled,
        handleSpeak,
        t,
        language,
        setStreamingStates,
        setChats,
        activeWorkspacePath,
        systemMode,
        intentClassification,
        confirmAntigravityCreditUsage,
    } = params;
    const toolLoopBudget = getAiToolLoopBudget(intentClassification);

    const currentAssistantId = assistantId;
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
    const reasonings: string[] = [];
    let accumulatedContent = '';
    let toolCallsHistory: ToolCall[] = [];
    const toolFamilyCallCounts = new Map<string, number>();
    const seenToolFamilies = new Set<string>();
    let consecutiveSameFamilyTurns = 0;
    let lastToolFamily = '';
    const traceId = `${chatId.slice(0, 8)}:${currentAssistantId.slice(0, 8)}`;

    appLogger.info(
        'useChatGenerator',
        `[${traceId}] Tool loop started: chatId=${chatId}, model=${activeModel}, provider=${selectedProvider}, maxIterations=${toolLoopBudget.maxModelTurns}, initialMessages=${initialMessages.length}, intent=${intentClassification.intent}`
    );

    while (toolIterations < toolLoopBudget.maxModelTurns) {
        if (currentMessages.length === 0) {
            appLogger.warn('useChatGenerator', `[${traceId}] loop-break: no current messages before iteration=${toolIterations + 1}`);
            break;
        }
        const toolsAllowedThisTurn = executedToolTurnCount < toolLoopBudget.maxExecutedToolTurns;
        appLogger.info(
            'useChatGenerator',
            `[${traceId}] iteration=${toolIterations + 1} start currentMessages=${currentMessages.length}, reasonings=${reasonings.length}, historyToolCalls=${toolCallsHistory.length}, toolsAllowed=${String(toolsAllowedThisTurn)}`
        );

        if (confirmAntigravityCreditUsage) {
            const approved = await confirmAntigravityCreditUsage(activeModel, selectedProvider);
            if (!approved) {
                appLogger.info(
                    'useChatGenerator',
                    `[${traceId}] credit usage declined before iteration=${toolIterations + 1}`
                );
                wasSafetyBreak = true;
                break;
            }
        }

        const stream = chatStream({
            messages: currentMessages,
            model: activeModel,
            tools: toolsAllowedThisTurn ? tools : [],
            provider: selectedProvider,
            options: { ...fullOptions, workspaceRoot: activeWorkspacePath, systemMode },
            chatId,
            assistantId: currentAssistantId,
            workspaceId,
            systemMode,
        });
        const streamStartTime = performance.now();

        const result = await processChatStream({
            stream,
            chatId,
            assistantId: currentAssistantId,
            setStreamingStates,
            setChats,
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
            `[${traceId}] iteration=${toolIterations + 1} stream-done durationMs=${streamDuration}, finalContentLen=${result.finalContent.length}, finalReasoningLen=${result.finalReasoning.length}, turnToolCalls=${result.finalToolCalls.length}`
        );
        const streamedContent = result.finalContent;
        let turnReasoning = result.finalReasoning.trim();

        // If reasoning is empty (common for models that use tags like <think>), extract it from content
        if (turnReasoning.length === 0) {
            const thinkMatch = /<think>([\s\S]*?)<\/think>/i.exec(streamedContent);
            if (thinkMatch) {
                turnReasoning = thinkMatch[1].trim();
            }
        }

        if (turnReasoning.length > 0) {
            reasonings.push(turnReasoning);
        }
        const previousToolCallCount = toolCallsHistory.length;
        toolCallsHistory = mergeToolCallHistory(toolCallsHistory, result.finalToolCalls);
        const currentTurnToolCalls = toolCallsHistory.slice(previousToolCallCount);
        let turnDisplayContent = streamedContent.trim().length > 0 ? streamedContent : accumulatedContent;
        const shouldInjectProgressContent =
            currentTurnToolCalls.length > 0
            && turnDisplayContent.trim().length === 0;
        if (shouldInjectProgressContent) {
            turnDisplayContent = buildInFlightToolProgressMessage(currentTurnToolCalls, t);
            if (turnDisplayContent.trim().length > 0) {
                setChats(prev => prev.map(chat => {
                    if (chat.id !== chatId) {
                        return chat;
                    }
                    return {
                        ...chat,
                        messages: chat.messages.map(message => (
                            message.id === currentAssistantId
                                ? { ...message, content: turnDisplayContent }
                                : message
                        )),
                    };
                }));
                void window.electron.db.updateMessage(currentAssistantId, { content: turnDisplayContent }).catch(error => {
                    appLogger.error('useChatGenerator', 'Failed to persist in-flight tool progress content', error as Error);
                });
            }
        }
        const normalizedStreamedContent = streamedContent.trim();
        
        let updatedAccumulatedContent = accumulatedContent;
        if (normalizedStreamedContent.length > 0) {
            // If the model produced a low-signal filler text (common for Gemini/Antigravity provider)
            // before calling a tool, we wrap it in <think> tags. This hides it from the main UI
            // by pushing it to the reasoning accordion, and ensures the LLM retains it in history
            // so it doesn't get stuck in a repetition loop.
            if (isLowSignalProgressContent(normalizedStreamedContent) && !normalizedStreamedContent.startsWith('<think>')) {
                appLogger.info('useChatGenerator', `[${traceId}] Wrapping low-signal content in <think> tags to prevent repetition`);
                updatedAccumulatedContent = `<think>\n${normalizedStreamedContent}\n</think>`;
                if (!reasonings.includes(normalizedStreamedContent)) {
                    reasonings.push(normalizedStreamedContent);
                }
            } else {
                updatedAccumulatedContent = streamedContent;
            }
        }
        accumulatedContent = updatedAccumulatedContent;

        appLogger.info(
            'useChatGenerator',
            `[${traceId}] Tool loop iteration ${toolIterations + 1}: toolCalls=${currentTurnToolCalls.length}, contentLength=${streamedContent.length}`
        );

        if (currentTurnToolCalls.length === 0) {
            const assistantContent = streamedContent.trim();
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
                if (deterministicFallback) {
                    appLogger.warn(
                        'useChatGenerator',
                        `[${traceId}] Low-signal final content detected; deterministic evidence answer available, forcing finalize: chatId=${chatId}`
                    );
                    wasSafetyBreak = true;
                    break;
                }
                lastAssistantMessage = {
                    id: currentAssistantId,
                    role: 'assistant',
                    content: assistantContent,
                    timestamp: new Date(),
                    provider: selectedProvider,
                    model: activeModel,
                };
                noProgressToolTurnCount += 1;
                lowSignalRecoveryCount += 1;
                currentMessages = [
                    ...currentMessages,
                    lastAssistantMessage,
                    {
                        id: generateId(),
                        role: 'system' as const,
                        content: `${TOOL_LOOP_DIRECT_ANSWER_HINT} Do not say that you are checking, waiting, or inspecting. Give the final answer now from the existing evidence.`,
                        timestamp: new Date(),
                    },
                ];
                toolIterations++;
                appLogger.warn(
                    'useChatGenerator',
                    `[${traceId}] Recovered from low-signal final content using prior tool evidence: chatId=${chatId}, noProgressTurns=${noProgressToolTurnCount}`
                );
                continue;
            }
            if (
                shouldRecoverFromLowSignalFinalContent(assistantContent, toolEvidenceState.toolMessages)
                && lowSignalRecoveryCount >= 1
            ) {
                appLogger.warn(
                    'useChatGenerator',
                    `[${traceId}] Low-signal recovery limit reached, forcing finalize: chatId=${chatId}, recoveries=${lowSignalRecoveryCount}`
                );
                wasSafetyBreak = true;
                break;
            }
            await finalizeToolTurn({
                assistantId: currentAssistantId,
                chatId,
                callMap: toolEvidenceState.toolCallMap,
                messages: toolEvidenceState.toolMessages,
                provider: selectedProvider,
                model: activeModel,
                setChats,
                intentClassification,
                language,
                reasonings,
            });
            break;
        }

        const executableToolCalls = currentTurnToolCalls.filter(isExecutableToolCall);
        if (executableToolCalls.length === 0) {
            await handleMalformedToolCalls({
                result: {
                    ...result,
                    finalToolCalls: currentTurnToolCalls,
                },
                assistantId: currentAssistantId,
                chatId,
                setChats,
                provider: selectedProvider,
                model: activeModel,
                callMap: toolEvidenceState.toolCallMap,
                messages: toolEvidenceState.toolMessages,
                intentClassification,
                t,
                language,
                reasonings,
            });
            break;
        }

        const invalidToolResults = executableToolCalls
            .map(toolCall => {
                const missingArgument = findMissingRequiredArgument(toolCall, tools);
                return missingArgument ? buildInvalidToolResultMessage(toolCall, missingArgument) : null;
            })
            .filter((message): message is Message => message !== null);
        const validExecutableToolCalls = executableToolCalls.filter(toolCall =>
            !invalidToolResults.some(message => message.toolCallId === toolCall.id)
        );

        if (invalidToolResults.length > 0) {
            appendToolMessages(toolEvidenceState, invalidToolResults);
            lastToolResults = invalidToolResults;
            noProgressToolTurnCount += 1;
            malformedToolCallCount += invalidToolResults.length;
            repeatedToolSignatureCount += 1;
            appLogger.warn(
                'useChatGenerator',
                `Malformed tool calls detected: count=${invalidToolResults.length}, totalMalformed=${malformedToolCallCount}, noProgress=${noProgressToolTurnCount}`
            );
            if (malformedToolCallCount >= 3) {
                appLogger.warn(
                    'useChatGenerator',
                    `Malformed tool call threshold reached (${malformedToolCallCount}), forcing safety break`
                );
                wasSafetyBreak = true;
                break;
            }
            currentMessages = [
                ...buildModelConversation(currentMessages, lastAssistantMessage ?? {
                    id: currentAssistantId,
                    role: 'assistant',
                    content: turnDisplayContent,
                    timestamp: new Date(),
                    provider: selectedProvider,
                    model: activeModel,
                    toolCalls: currentTurnToolCalls,
                    reasonings: reasonings.length > 0 ? [...reasonings] : undefined,
                }, invalidToolResults),
                {
                    id: generateId(),
                    role: 'system' as const,
                    content: 'One or more tool calls were missing required arguments. Do not repeat them unchanged. Reuse prior evidence or supply all required fields before trying again.',
                    timestamp: new Date(),
                },
            ];
            toolIterations++;
            if (validExecutableToolCalls.length === 0) {
                continue;
            }
        }

        if (validExecutableToolCalls.every(toolCall => toolCall.function.name === 'resolve_path')) {
            const repeatedResolvePathContents = getMostRecentSuccessfulToolContentsByName(
                toolEvidenceState.toolMessages,
                toolEvidenceState.toolCallMap,
                'resolve_path',
                validExecutableToolCalls.length
            );
            if (repeatedResolvePathContents) {
                const assistantMsg = buildAssistantMessage({
                    id: currentAssistantId,
                    content: turnDisplayContent,
                    provider: selectedProvider,
                    model: activeModel,
                    turnToolCalls: currentTurnToolCalls,
                    reasonings,
                });
                lastAssistantMessage = assistantMsg;
                const repeatedToolResults = buildRepeatedToolMessages(
                    validExecutableToolCalls,
                    repeatedResolvePathContents,
                    'A path was already resolved earlier in this turn. Reuse that resolved path and continue with directory/file actions instead of calling resolve_path again.'
                );
                appendToolMessages(toolEvidenceState, repeatedToolResults);
                lastToolResults = repeatedToolResults;
                noProgressToolTurnCount += 1;
                currentMessages = [
                    ...buildModelConversation(currentMessages, assistantMsg, repeatedToolResults),
                    {
                        id: generateId(),
                        role: 'system' as const,
                        content: 'You already resolved the target path in this turn. Do not call resolve_path again unless the user explicitly asked for a different location. Continue with create_directory, write_file, or answer directly from the resolved path.',
                        timestamp: new Date(),
                    },
                ];
                toolIterations++;
                continue;
            }
        }

        const toolSignature = calculateToolCallSignature(validExecutableToolCalls);
        if (toolSignature === lastToolSignature) {
            repeatedToolSignatureCount += 1;
        } else {
            repeatedToolSignatureCount = 1;
            lastToolSignature = toolSignature;
        }
        appLogger.info(
            'useChatGenerator',
            `[${traceId}] Tool signature check: repeatedCount=${repeatedToolSignatureCount}, signature=${toolSignature || 'empty'}`
        );
        recentToolSignatures = updateRecentToolSignatures(
            recentToolSignatures,
            toolSignature,
            TOOL_LOOP_RECENT_SIGNATURE_WINDOW
        );

        const assistantMsg = buildAssistantMessage({
            id: currentAssistantId,
            content: turnDisplayContent,
            provider: selectedProvider,
            model: activeModel,
            turnToolCalls: currentTurnToolCalls,
            reasonings,
        });
        lastAssistantMessage = assistantMsg;

        if (!toolsAllowedThisTurn) {
            noProgressToolTurnCount += 1;
            currentMessages = [
                ...buildModelConversation(currentMessages, assistantMsg, []),
                {
                    id: generateId(),
                    role: 'system' as const,
                    content: `${TOOL_LOOP_DIRECT_ANSWER_HINT} The tool execution budget is exhausted for this request. Do not call more tools; analyze existing tool outputs (including failed commands) and continue with the best possible final answer.`,
                    timestamp: new Date(),
                },
            ];
            toolIterations++;
            appLogger.warn(
                'useChatGenerator',
                `[${traceId}] Tool budget exhausted; forcing model-only continuation: executedTurns=${executedToolTurnCount}, requestedCalls=${validExecutableToolCalls.length}`
            );
            continue;
        }

        const cachedRepeatedToolContents = getCachedToolContentsForSignature(toolSignature);
        if (repeatedToolSignatureCount >= 2 && Array.isArray(cachedRepeatedToolContents)) {
            rememberToolCalls(toolEvidenceState, validExecutableToolCalls);
            const repeatedToolResults = buildRepeatedToolMessages(
                validExecutableToolCalls,
                cachedRepeatedToolContents as string[],
                REPEATED_TOOL_RESULT_HINT
            );
            appendToolMessages(toolEvidenceState, repeatedToolResults);
            lastToolResults = repeatedToolResults;
            noProgressToolTurnCount += 1;
            currentMessages = [
                ...buildModelConversation(currentMessages, assistantMsg, repeatedToolResults),
                {
                    id: generateId(),
                    role: 'system' as const,
                    content: `${REPEATED_TOOL_RESULT_HINT} ${TOOL_LOOP_DIRECT_ANSWER_HINT} Choose a different tool only if it will produce genuinely new evidence.`,
                    timestamp: new Date(),
                },
            ];
            toolIterations++;
            appLogger.warn(
                'useChatGenerator',
                `[${traceId}] Blocked repeated tool execution: signature=${toolSignature}, repeatedCount=${repeatedToolSignatureCount}`
            );
            const deterministicFallback = buildDeterministicAnswerFromEvidence(
                intentClassification,
                toolCallsHistory,
                toolEvidenceState.toolMessages,
                language
            );
            if (deterministicFallback) {
                appLogger.warn(
                    'useChatGenerator',
                    `[${traceId}] Repeated signature detected with deterministic evidence answer available; forcing finalize: signature=${toolSignature}`
                );
                wasSafetyBreak = true;
                break;
            }

            // Safety check even when blocked
            const loopAction = evaluateLoopSafety({
                repeatedToolSignatureCount,
                executableToolCalls: validExecutableToolCalls,
                currentMessages,
                assistantMsg,
                toolResults: repeatedToolResults,
                noProgressToolTurnCount,
                recentToolSignatures,
                executedToolTurnCount,
                noProgressThreshold: toolLoopBudget.noProgressThreshold,
                maxExecutedToolTurns: toolLoopBudget.maxExecutedToolTurns,
                activeModel,
                selectedProvider,
                fullOptions,
                activeWorkspacePath,
                systemMode,
                chatId,
                workspaceId,
                intentClassification,
                currentAssistantId,
                setStreamingStates,
                setChats,
                accumulatedToolCallMap: toolEvidenceState.toolCallMap,
                accumulatedToolMessages: toolEvidenceState.toolMessages,
                evidenceRecords: toolEvidenceState.evidenceRecords,
                t,
                language,
            }, {
                recentSignatureWindow: TOOL_LOOP_RECENT_SIGNATURE_WINDOW,
                directAnswerHint: TOOL_LOOP_DIRECT_ANSWER_HINT,
            });

            if (loopAction.action === 'break') {
                wasSafetyBreak = true;
                break;
            }
            currentMessages = loopAction.nextMessages;
            continue;
        }

        for (const toolCall of validExecutableToolCalls) {
            const familyName = toolCall.function.name;
            toolFamilyCallCounts.set(familyName, (toolFamilyCallCounts.get(familyName) ?? 0) + 1);
        }

        // Track consecutive turns using the same tool family for hard ceiling
        const currentTurnFamilies = Array.from(new Set(validExecutableToolCalls.map(tc => tc.function.name)));
        const currentTurnFamily = currentTurnFamilies.length === 1 ? currentTurnFamilies[0] : '';
        if (currentTurnFamily.length > 0 && currentTurnFamily === lastToolFamily) {
            consecutiveSameFamilyTurns += 1;
        } else {
            consecutiveSameFamilyTurns = currentTurnFamily.length > 0 ? 1 : 0;
        }
        lastToolFamily = currentTurnFamily;

        // Hard ceiling: same tool family called 3+ consecutive turns OR monotonous signature pattern WITH NO PROGRESS
        const TOOL_FAMILY_MONOTONY_THRESHOLD = 3;
        const isMonotonous = isMonotonousToolFamily(recentToolSignatures, TOOL_FAMILY_MONOTONY_THRESHOLD);
        if (noProgressToolTurnCount >= 2 && (isMonotonous || consecutiveSameFamilyTurns >= TOOL_FAMILY_MONOTONY_THRESHOLD)) {
            const familyNames = currentTurnFamilies;
            appLogger.warn(
                'useChatGenerator',
                `[${traceId}] Semantic tool-family loop detected without progress: family=${familyNames.join(',')}, consecutiveSameFamily=${consecutiveSameFamilyTurns}, isMonotonous=${String(isMonotonous)}, noProgress=${noProgressToolTurnCount}`
            );
            const assistantMsgForFamily = buildAssistantMessage({
                id: currentAssistantId,
                content: turnDisplayContent,
                provider: selectedProvider,
                model: activeModel,
                turnToolCalls: currentTurnToolCalls,
                reasonings,
            });
            lastAssistantMessage = assistantMsgForFamily;
            const repeatedContents = validExecutableToolCalls.map(() => JSON.stringify({
                success: false,
                error: `Tool family '${familyNames[0]}' has been called repeatedly with different arguments. Reuse earlier results and move to the next step.`,
                _cached: true,
                _reused: true,
            }));
            const repeatedResults = buildRepeatedToolMessages(validExecutableToolCalls, repeatedContents, REPEATED_TOOL_RESULT_HINT);
            appendToolMessages(toolEvidenceState, repeatedResults);
            lastToolResults = repeatedResults;
            noProgressToolTurnCount += 1;
            wasSafetyBreak = true;
            break;
        }

        rememberToolCalls(toolEvidenceState, validExecutableToolCalls);
        const updateInFlightToolProgress = (): void => {
            const storedToolResults = buildStoredToolResults(toolCallsHistory, toolEvidenceState.toolMessages);
            setChats(prev => prev.map(chat => {
                if (chat.id !== chatId) {
                    return chat;
                }
                const messageIndex = chat.messages.findIndex(message => message.id === currentAssistantId);
                if (messageIndex < 0) {
                    return chat;
                }
                const nextMessages = [...chat.messages];
                const existingMessage = nextMessages[messageIndex];
                if (!existingMessage) {
                    return chat;
                }
                nextMessages[messageIndex] = {
                    ...existingMessage,
                    toolCalls: compactToolCallsForDisplay(toolCallsHistory) ?? existingMessage.toolCalls,
                    toolResults: storedToolResults,
                };
                return {
                    ...chat,
                    messages: nextMessages,
                };
            }));
        };
        updateInFlightToolProgress();
        const toolExecutionStart = performance.now();
        const { toolResults, generatedImages } = await executeBatchToolCalls({
            toolCalls: validExecutableToolCalls,
            workspacePath: activeWorkspacePath,
            t,
            chatId,
            accumulatedMessages: toolEvidenceState.toolMessages,
            executeToolCall: (toolCall, workspacePath, translate, activeChatId) =>
                executeToolCall(toolCall, workspacePath, translate, readToolResultImages, activeChatId),
            onToolProgress: () => {
                updateInFlightToolProgress();
            },
        });
        const toolExecutionDuration = Math.round(performance.now() - toolExecutionStart);
        lastToolResults = toolResults;
        executedToolTurnCount += 1;
        cacheToolContentsForSignature(
            toolSignature,
            toolResults.map(toolResult => getToolMessageContent(toolResult))
        );
        // Determine if this turn introduced genuinely NEW evidence.
        // A tool succeeding does NOT count as progress if it's the same family we've already used.
        const executedFamilies = new Set(validExecutableToolCalls.map(tc => tc.function.name));
        const hasNewFamilyEvidence = Array.from(executedFamilies).some(family => !seenToolFamilies.has(family));
        const normalizedFinalContent = result.finalContent.trim();
        const hasSubstantialContent = normalizedFinalContent.length > TOOL_LOOP_LOW_SIGNAL_CONTENT_THRESHOLD
            && !isLowSignalProgressContent(normalizedFinalContent);
        const currentTurnMadeProgress = hasSubstantialContent
            || (hasSuccessfulToolEvidence(toolResults) && hasNewFamilyEvidence);
        // Register all families we've seen
        for (const family of executedFamilies) {
            seenToolFamilies.add(family);
        }
        noProgressToolTurnCount = currentTurnMadeProgress
            ? 0
            : noProgressToolTurnCount + 1;
        appLogger.info(
            'useChatGenerator',
            `[${traceId}] Tool execution batch done: calls=${validExecutableToolCalls.length}, results=${toolResults.length}, images=${generatedImages.length}, noProgressTurns=${noProgressToolTurnCount}, durationMs=${toolExecutionDuration}`
        );

        const turnEvidenceEntries = buildAiEvidenceEntries({
            intent: intentClassification,
            content: result.finalContent,
            toolResults: toolResults.map(tr => {
                const call = tr.toolCallId ? toolEvidenceState.toolCallMap.get(tr.toolCallId) : undefined;
                let parsedResult: JsonValue = null;
                if (typeof tr.content === 'string') {
                    try {
                        parsedResult = JSON.parse(tr.content);
                    } catch {
                        parsedResult = tr.content;
                    }
                }
                
                const toolName = call?.function.name ?? 'unknown';
                const toolResult: ToolResult = {
                    toolCallId: tr.toolCallId ?? '',
                    name: toolName,
                    result: parsedResult,
                    success: typeof parsedResult === 'object' && parsedResult !== null && 'success' in parsedResult 
                        ? (parsedResult as Record<string, unknown>).success !== false 
                        : true,
                    error: typeof parsedResult === 'object' && parsedResult !== null && 'error' in parsedResult 
                        ? String((parsedResult as Record<string, unknown>).error) 
                        : undefined,
                };
                return toolResult;
            }),
            language,
        });
        const turnRecords = turnEvidenceEntries.map(entry => createEvidenceRecord(entry, 'turn', 'chat'));
        appendEvidenceRecords(toolEvidenceState, turnRecords);
        

        if (generatedImages.length > 0) {
            await finalizeWithImages({
                result,
                assistantId: currentAssistantId,
                chatId,
                images: generatedImages,
                calls: executableToolCalls,
                results: toolResults,
                provider: selectedProvider,
                model: activeModel,
                setChats,
                callMap: toolEvidenceState.toolCallMap,
                messages: toolEvidenceState.toolMessages,
                intentClassification,
                language,
            });
            break;
        }

        const loopAction = evaluateLoopSafety({
            repeatedToolSignatureCount,
            executableToolCalls: validExecutableToolCalls,
            currentMessages,
            assistantMsg,
            toolResults,
            noProgressToolTurnCount,
            recentToolSignatures,
            executedToolTurnCount,
            noProgressThreshold: toolLoopBudget.noProgressThreshold,
            maxExecutedToolTurns: toolLoopBudget.maxExecutedToolTurns,
            activeModel,
            selectedProvider,
            fullOptions,
            activeWorkspacePath,
            systemMode,
            chatId,
            workspaceId,
            intentClassification,
            currentAssistantId,
            setStreamingStates,
            setChats,
            accumulatedToolCallMap: toolEvidenceState.toolCallMap,
            accumulatedToolMessages: toolEvidenceState.toolMessages,
            evidenceRecords: toolEvidenceState.evidenceRecords,
            t,
            language,
        }, {
            recentSignatureWindow: TOOL_LOOP_RECENT_SIGNATURE_WINDOW,
            directAnswerHint: TOOL_LOOP_DIRECT_ANSWER_HINT,
        });

        if (loopAction.action === 'break') {
            wasSafetyBreak = true;
            break;
        }
        if (loopAction.action === 'continue') {
            currentMessages = loopAction.nextMessages;
            toolIterations++;
            continue;
        }

        currentMessages = buildModelConversation(currentMessages, assistantMsg, toolResults);
        toolIterations++;
    }

    if (toolIterations >= toolLoopBudget.maxModelTurns || wasSafetyBreak) {
        appLogger.warn(
            'useChatGenerator',
            `[${traceId}] Loop ended via safety path iterations=${toolIterations}, wasSafetyBreak=${String(wasSafetyBreak)}`
        );
        await finalizeLoopForcefully({
            repeatedToolSignatureCount,
            executableToolCalls: [],
            assistantMsg: lastAssistantMessage ?? { id: '', role: 'assistant', content: '', timestamp: new Date() },
            toolResults: lastToolResults,
            noProgressToolTurnCount,
            recentToolSignatures,
            executedToolTurnCount,
            noProgressThreshold: toolLoopBudget.noProgressThreshold,
            maxExecutedToolTurns: toolLoopBudget.maxExecutedToolTurns,
            currentMessages,
            activeModel,
            selectedProvider,
            fullOptions,
            activeWorkspacePath,
            systemMode,
            intentClassification,
            chatId,
            workspaceId,
            currentAssistantId,
            setStreamingStates,
            setChats,
            accumulatedToolCallMap: toolEvidenceState.toolCallMap,
            accumulatedToolMessages: toolEvidenceState.toolMessages,
            evidenceRecords: toolEvidenceState.evidenceRecords,
            t,
            language,
        }, {
            lowSignalContentThreshold: TOOL_LOOP_LOW_SIGNAL_CONTENT_THRESHOLD,
        });
    }
    appLogger.info(
        'useChatGenerator',
        `[${traceId}] Tool loop finished: chatId=${chatId}, iterations=${toolIterations}, executedToolTurns=${executedToolTurnCount}, noProgressTurns=${noProgressToolTurnCount}, malformedCalls=${malformedToolCallCount}`
    );
    return currentAssistantId;
}
