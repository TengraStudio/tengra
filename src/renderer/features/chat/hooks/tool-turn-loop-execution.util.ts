import { AiIntentClassification } from '@shared/types/ai-runtime';
import { JsonValue } from '@shared/types/common';
import {
    buildAiEvidenceEntries,
    calculateToolCallSignature,
    createEvidenceRecord,
    getAiToolLoopBudget,
} from '@shared/utils/ai-runtime.util';

import { chatStream } from '@/lib/chat-stream';
import { generateId } from '@/lib/utils';
import { Chat, Message, ToolDefinition, ToolResult } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import {
    buildRepeatedToolMessages,
    getToolMessageContent,
    readToolResultImages,
    shouldRecoverFromLowSignalFinalContent,
} from './ai-runtime-chat.util';
import {
    isExecutableToolCall,
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
    finalizeToolTurn,
    finalizeWithImages,
    handleMalformedToolCalls,
    handleMaxIterationsReached,
} from './tool-turn-management.util';

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
    let lastAssistantMessage: Message | null = null;
    let lastToolResults: Message[] = [];
    appLogger.info(
        'useChatGenerator',
        `Tool loop started: chatId=${chatId}, model=${activeModel}, provider=${selectedProvider}, maxIterations=${toolLoopBudget.maxModelTurns}, initialMessages=${initialMessages.length}, intent=${intentClassification.intent}`
    );

    while (toolIterations < toolLoopBudget.maxModelTurns) {
        if (currentMessages.length === 0) {
            break;
        }
        const toolsAllowedThisTurn = executedToolTurnCount < toolLoopBudget.maxExecutedToolTurns;

        const stream = chatStream({
            messages: currentMessages,
            model: activeModel,
            tools: toolsAllowedThisTurn ? tools : [],
            provider: selectedProvider,
            options: { ...fullOptions, workspaceRoot: activeWorkspacePath, systemMode },
            chatId,
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
        });
        appLogger.info(
            'useChatGenerator',
            `Tool loop iteration ${toolIterations + 1}: toolCalls=${result.finalToolCalls.length}, contentLength=${result.finalContent.length}`
        );

        if (result.finalToolCalls.length === 0) {
            const assistantContent = result.finalContent.trim();
            if (shouldRecoverFromLowSignalFinalContent(assistantContent, toolEvidenceState.toolMessages)) {
                lastAssistantMessage = {
                    id: currentAssistantId,
                    role: 'assistant',
                    content: assistantContent,
                    timestamp: new Date(),
                    provider: selectedProvider,
                    model: activeModel,
                };
                noProgressToolTurnCount += 1;
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
                    `Recovered from low-signal final content using prior tool evidence: chatId=${chatId}, noProgressTurns=${noProgressToolTurnCount}`
                );
                continue;
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
            });
            break;
        }

        const executableToolCalls = result.finalToolCalls.filter(isExecutableToolCall);
        if (executableToolCalls.length === 0) {
            await handleMalformedToolCalls({
                result,
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
            });
            break;
        }

        const toolSignature = calculateToolCallSignature(executableToolCalls);
        if (toolSignature === lastToolSignature) {
            repeatedToolSignatureCount += 1;
        } else {
            repeatedToolSignatureCount = 1;
            lastToolSignature = toolSignature;
        }
        appLogger.info(
            'useChatGenerator',
            `Tool signature check: repeatedCount=${repeatedToolSignatureCount}, signature=${toolSignature || 'empty'}`
        );
        recentToolSignatures = updateRecentToolSignatures(
            recentToolSignatures,
            toolSignature,
            TOOL_LOOP_RECENT_SIGNATURE_WINDOW
        );

        const assistantMsg: Message = {
            id: currentAssistantId,
            role: 'assistant',
            content: result.finalContent.trim(),
            timestamp: new Date(),
            provider: selectedProvider,
            model: activeModel,
            toolCalls: executableToolCalls,
        };
        lastAssistantMessage = assistantMsg;

        if (!toolsAllowedThisTurn) {
            noProgressToolTurnCount += 1;
            currentMessages = [
                ...buildModelConversation(currentMessages, assistantMsg, []),
                {
                    id: generateId(),
                    role: 'system' as const,
                    content: `${TOOL_LOOP_DIRECT_ANSWER_HINT} The tool execution budget for this turn is exhausted.`,
                    timestamp: new Date(),
                },
            ];
            toolIterations++;
            appLogger.warn(
                'useChatGenerator',
                `Blocked tool execution after budget exhaustion: executedTurns=${executedToolTurnCount}, requestedCalls=${executableToolCalls.length}`
            );
            continue;
        }

        const cachedRepeatedToolContents = getCachedToolContentsForSignature(toolSignature);
        if (repeatedToolSignatureCount >= 2 && Array.isArray(cachedRepeatedToolContents)) {
            rememberToolCalls(toolEvidenceState, executableToolCalls);
            const repeatedToolResults = buildRepeatedToolMessages(
                executableToolCalls,
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
                `Blocked repeated tool execution: signature=${toolSignature}, repeatedCount=${repeatedToolSignatureCount}`
            );
            continue;
        }

        rememberToolCalls(toolEvidenceState, executableToolCalls);
        const { toolResults, generatedImages } = await executeBatchToolCalls(
            executableToolCalls,
            activeWorkspacePath,
            t,
            chatId,
            toolEvidenceState.toolMessages,
            (toolCall, workspacePath, translate, activeChatId) =>
                executeToolCall(toolCall, workspacePath, translate, readToolResultImages, activeChatId)
        );
        lastToolResults = toolResults;
        executedToolTurnCount += 1;
        cacheToolContentsForSignature(
            toolSignature,
            toolResults.map(toolResult => getToolMessageContent(toolResult))
        );
        const currentTurnMadeProgress = result.finalContent.trim().length > TOOL_LOOP_LOW_SIGNAL_CONTENT_THRESHOLD
            || toolResults.length > 0;
        noProgressToolTurnCount = currentTurnMadeProgress
            ? 0
            : noProgressToolTurnCount + 1;
        appLogger.info(
            'useChatGenerator',
            `Tool execution batch done: calls=${executableToolCalls.length}, results=${toolResults.length}, images=${generatedImages.length}, noProgressTurns=${noProgressToolTurnCount}`
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
            executableToolCalls,
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

    if (toolIterations >= toolLoopBudget.maxModelTurns) {
        await handleMaxIterationsReached({
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
    appLogger.info('useChatGenerator', `Tool loop finished: chatId=${chatId}, iterations=${toolIterations}`);
    return currentAssistantId;
}
