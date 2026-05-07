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
import {
    calculateToolCallSignature,
    composeDeterministicAnswer,
    getAiToolLoopBudget,
    isLowSignalProgressContent,
} from '@shared/utils/ai-runtime.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import type { SetStateAction } from 'react';

import { compactToolCallsForDisplay } from '@/features/chat/components/message/tool-call-display.util';
import { chatStream } from '@/lib/chat-stream';
import { generateId } from '@/lib/utils';
import { 
    getChatSnapshot,
    setChats,
    setStreamingState, 
    StreamingState,
    updateChatInStore, 
    updateMessageInStore 
} from '@/store/chat.store';
import { Message, ToolCall, ToolDefinition } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import {
    buildRepeatedToolMessages,
    buildStoredToolResults,
    deduplicateMessages,
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
import type { StreamStreamingState } from './process-stream';
import { processChatStream } from './process-stream';
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
    const translatedPrefix = t('frontend.tools.usingTool');
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

function tryParseLooseJsonObject(content: string): Record<string, JsonValue> | null {
    const direct = safeJsonParse<Record<string, JsonValue>>(content, {});
    if (Object.keys(direct).length > 0) {
        return direct;
    }

    const normalized = content
        .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)(\s*:)/g, '$1"$2"$3')
        .replace(/,(\s*[}\]])/g, '$1');
    const parsed = safeJsonParse<Record<string, JsonValue>>(normalized, {});
    return Object.keys(parsed).length > 0 ? parsed : null;
}

function stripShellQuotes(value: string): string {
    const trimmed = value.trim();
    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"'))
        || (trimmed.startsWith('\'') && trimmed.endsWith('\''))
    ) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

function joinShellPath(cwd: string | undefined, target: string): string {
    const normalizedTarget = stripShellQuotes(target).trim();
    if (normalizedTarget.length === 0) {
        return normalizedTarget;
    }
    if (/^[A-Za-z]:[\\/]/.test(normalizedTarget) || normalizedTarget.startsWith('/')) {
        return normalizedTarget;
    }
    if (!cwd || cwd.trim().length === 0) {
        return normalizedTarget;
    }
    const normalizedCwd = cwd.replace(/[\\/]+$/, '');
    return `${normalizedCwd}/${normalizedTarget}`.replace(/\\/g, '/');
}

function splitShellCommands(command: string): string[] {
    return command
        .split(/\s*(?:&&|;)\s*/g)
        .map(part => part.trim())
        .filter(part => part.length > 0);
}

function tryBuildFilesystemWriteFromCommandBatch(commands: Array<{ command: string; cwd?: string }>): ToolCall | null {
    let targetPath: string | null = null;
    let content = '';
    let wrote = false;

    for (const entry of commands) {
        const parts = splitShellCommands(entry.command);
        for (const part of parts) {
            if (/^mkdir(?:\s+-p)?\s+/i.test(part) || /^touch\s+/i.test(part)) {
                continue;
            }

            const echoMatch = /^echo\s+([\s\S]+?)\s*(>>|>)\s*(.+)$/i.exec(part);
            if (echoMatch) {
                const nextPath = joinShellPath(entry.cwd, echoMatch[3]);
                if (nextPath.length === 0) {
                    return null;
                }
                if (targetPath && targetPath !== nextPath) {
                    return null;
                }
                targetPath = nextPath;

                const nextLine = `${stripShellQuotes(echoMatch[1])}\n`;
                if (echoMatch[2] === '>') {
                    content = nextLine;
                } else {
                    content += nextLine;
                }
                wrote = true;
                continue;
            }

            return null;
        }
    }

    if (!wrote || !targetPath) {
        return null;
    }

    return {
        id: `synthetic-tool-${generateId()}`,
        type: 'function',
        function: {
            name: 'mcp__filesystem__write',
            arguments: JSON.stringify({
                path: targetPath,
                content,
            }),
        },
    };
}

function tryBuildToolCallFromRawText(content: string): ToolCall | null {
    const trimmed = content.trim();
    if (trimmed.length === 0 || !trimmed.startsWith('{') || !trimmed.endsWith('}')) {
        return null;
    }

    const payload = tryParseLooseJsonObject(trimmed);
    if (!payload) {
        return null;
    }

    const explicitName = typeof payload['name'] === 'string' ? payload['name'].trim() : '';
    const explicitParams = payload['parameters'];
    if (explicitName.length > 0 && explicitParams && typeof explicitParams === 'object' && !Array.isArray(explicitParams)) {
        return {
            id: `synthetic-tool-${generateId()}`,
            type: 'function',
            function: {
                name: explicitName,
                arguments: JSON.stringify(explicitParams),
            },
        };
    }

    const rootTool = typeof payload['tool'] === 'string' ? payload['tool'].trim() : '';
    const rootArgs = payload['args'];
    if (rootTool.length > 0 && rootArgs && typeof rootArgs === 'object' && !Array.isArray(rootArgs)) {
        return {
            id: `synthetic-tool-${generateId()}`,
            type: 'function',
            function: {
                name: rootTool,
                arguments: JSON.stringify(rootArgs),
            },
        };
    }

    if ((payload['type'] === 'query' || payload['type'] === 'tool') && payload['body'] && typeof payload['body'] === 'object' && !Array.isArray(payload['body'])) {
        const body = payload['body'] as Record<string, JsonValue>;
        const queryCandidate = typeof body['name'] === 'string'
            ? body['name']
            : (Array.isArray(body['value']) && typeof body['value'][0] === 'string' ? body['value'][0] : '');
        if (queryCandidate.trim().length > 0) {
            return {
                id: `synthetic-tool-${generateId()}`,
                type: 'function',
                function: {
                    name: 'mcp__web__search',
                    arguments: JSON.stringify({ query: queryCandidate.trim() }),
                },
            };
        }
    }

    const commandEnvelope = payload['commands'];
    const commandScope = commandEnvelope && typeof commandEnvelope === 'object' && !Array.isArray(commandEnvelope)
        ? commandEnvelope as Record<string, JsonValue>
        : payload;
    const commandList = Array.isArray(commandEnvelope)
        ? commandEnvelope.filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
        : [];

    const commandValue = commandScope['command'] ?? commandScope['cmd'];
    const argsValue = payload['args'];
    if (!commandValue && !argsValue && commandList.length === 0) { return null; }

    let command = '';
    if (typeof commandValue === 'string') {
        command = commandValue.trim();
    } else if (Array.isArray(commandValue)) {
        const joined = commandValue
            .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
            .join(' ')
            .trim();
        command = joined;
    }
    if (!command && Array.isArray(argsValue)) {
        command = argsValue
            .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
            .join(' ')
            .trim();
    }
    if (!command && commandList.length > 0) {
        command = commandList.join(' && ');
    }
    if (!command) {
        return null;
    }

    const cwd = typeof commandScope['cwd'] === 'string' ? commandScope['cwd'] : undefined;
    const fileWriteToolCall = tryBuildFilesystemWriteFromCommandBatch([{ command, cwd }]);
    if (fileWriteToolCall) {
        return fileWriteToolCall;
    }
    return {
        id: `synthetic-tool-${generateId()}`,
        type: 'function',
        function: {
            name: 'mcp__terminal__run_command',
            arguments: JSON.stringify({
                command,
                ...(cwd ? { cwd } : {}),
            }),
        },
    };
}

function extractBalancedJsonObjects(content: string): Array<{ raw: string; start: number; end: number }> {
    const matches: Array<{ raw: string; start: number; end: number }> = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escaped = false;

    for (let index = 0; index < content.length; index += 1) {
        const char = content[index];

        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === '\\') {
            escaped = true;
            continue;
        }
        if (char === '"') {
            inString = !inString;
            continue;
        }
        if (inString) {
            continue;
        }
        if (char === '{') {
            if (depth === 0) {
                start = index;
            }
            depth += 1;
            continue;
        }
        if (char === '}') {
            if (depth === 0) {
                continue;
            }
            depth -= 1;
            if (depth === 0 && start >= 0) {
                matches.push({
                    raw: content.slice(start, index + 1),
                    start,
                    end: index + 1,
                });
                start = -1;
            }
        }
    }

    return matches;
}

function extractSyntheticToolCallsFromText(content: string): { toolCalls: ToolCall[]; cleanedContent: string } {
    const candidates = extractBalancedJsonObjects(content);
    if (candidates.length === 0) {
        return { toolCalls: [], cleanedContent: content };
    }

    const accepted: Array<{ toolCall: ToolCall; start: number; end: number }> = [];
    for (const candidate of candidates) {
        const toolCall = tryBuildToolCallFromRawText(candidate.raw);
        if (!toolCall) {
            continue;
        }
        accepted.push({ toolCall, start: candidate.start, end: candidate.end });
    }

    if (accepted.length === 0) {
        return { toolCalls: [], cleanedContent: content };
    }

    const mergedFilesystemWrite = tryBuildFilesystemWriteFromCommandBatch(
        accepted
            .filter(({ toolCall }) => toolCall.function.name === 'mcp__terminal__run_command')
            .map(({ toolCall }) => {
                const args = tryParseLooseJsonObject(toolCall.function.arguments);
                return {
                    command: typeof args?.['command'] === 'string' ? args.command : '',
                    cwd: typeof args?.['cwd'] === 'string' ? args.cwd : undefined,
                };
            })
            .filter(entry => entry.command.length > 0)
    );
    const toolCalls = mergedFilesystemWrite
        ? [
            mergedFilesystemWrite,
            ...accepted
                .filter(({ toolCall }) => toolCall.function.name !== 'mcp__terminal__run_command')
                .map(item => item.toolCall),
        ]
        : accepted.map(item => item.toolCall);

    let cleaned = '';
    let cursor = 0;
    for (const acceptedCandidate of accepted) {
        cleaned += content.slice(cursor, acceptedCandidate.start);
        cursor = acceptedCandidate.end;
    }
    cleaned += content.slice(cursor);

    return {
        toolCalls,
        cleanedContent: cleaned.replace(/\s{2,}/g, ' ').trim(),
    };
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
    onStreamingUpdate?: (update: Partial<Message>) => void;
}) {
    const { chatId, assistantId, toolCallsHistory, toolEvidenceState, onStreamingUpdate } = params;
    const stored = buildStoredToolResults(toolCallsHistory, toolEvidenceState.toolMessages);
    const updatedMsgPart = { toolCalls: compactToolCallsForDisplay(toolCallsHistory) ?? [], toolResults: stored };

    if (onStreamingUpdate) {
        onStreamingUpdate(updatedMsgPart);
    }

    updateChatInStore(chatId, {
        messages: (getChatSnapshot().chats.find(c => c.id === chatId)?.messages || []).map((m: Message) =>
            m.id === assistantId ? { ...m, ...updatedMsgPart } : m
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
    onStreamingUpdate?: (update: Partial<Message>) => void;
}) {
    const { toolEvidenceState, validExecutableToolCalls, chatId, assistantId, toolCallsHistory, activeWorkspacePath, t, onStreamingUpdate } = params;
    rememberToolCalls(toolEvidenceState, validExecutableToolCalls);
    updateInFlightToolProgress({
        chatId, assistantId, toolCallsHistory, toolEvidenceState, onStreamingUpdate
    });
    return executeBatchToolCalls({
        toolCalls: validExecutableToolCalls, workspacePath: activeWorkspacePath, t, chatId,
        accumulatedMessages: toolEvidenceState.toolMessages, executeToolCall: (tc, wp, tr, cid) => executeToolCall(tc, wp, tr, readToolResultImages, cid),
        onToolProgress: () => updateInFlightToolProgress({
            chatId, assistantId, toolCallsHistory, toolEvidenceState, onStreamingUpdate
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
    onStreamingUpdate?: (update: Partial<Message>) => void;
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
    onStreamingUpdate?: (update: Partial<Message>) => void;
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
        onMessageUpdate: params.onStreamingUpdate,
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

    const syntheticExtraction = result.finalToolCalls.length === 0
        ? extractSyntheticToolCallsFromText(streamedContent)
        : { toolCalls: [], cleanedContent: streamedContent };
    const mergedTurnToolCalls = syntheticExtraction.toolCalls.length > 0
        ? [...result.finalToolCalls, ...syntheticExtraction.toolCalls]
        : result.finalToolCalls;

    const previousHistoryCount = toolCallsHistory.length;
    const updatedHistory = mergeToolCallHistory(toolCallsHistory, mergedTurnToolCalls);
    const turnToolCalls = updatedHistory.slice(previousHistoryCount);

    let turnDisplayContent = syntheticExtraction.cleanedContent.trim().length > 0
        ? syntheticExtraction.cleanedContent
        : (streamedContent.trim().length > 0 ? streamedContent : accumulatedContent);
    if (syntheticExtraction.toolCalls.length > 0) {
        if (turnDisplayContent === streamedContent) {
            turnDisplayContent = '';
        }
        appLogger.info(
            'useChatGenerator',
            `[${traceId}] Converted raw payloads into synthetic tool calls: ${syntheticExtraction.toolCalls.map(toolCall => toolCall.function.name).join(', ')}`
        );
    }
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
        shouldRecoverFromLowSignalFinalContent(assistantContent, toolEvidenceState.toolMessages, turnResult.finalReasoning)
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
        shouldRecoverFromLowSignalFinalContent(assistantContent, toolEvidenceState.toolMessages, turnResult.finalReasoning)
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
        onMessageUpdate: loopParams.onStreamingUpdate,
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

interface ProcessInvalidToolArgumentsParams {
    executableToolCalls: ToolCall[];
    tools: ToolDefinition[];
    toolEvidenceState: ReturnType<typeof createToolEvidenceState>;
    assistantId: string;
    chatId: string;
    selectedProvider: string;
    activeModel: string;
    turnDisplayContent: string;
    turnToolCalls: ToolCall[];
    reasonings: string[];
    noProgressToolTurnCount: number;
    malformedToolCallCount: number;
    currentMessages: Message[];
    lastAssistantMessage: Message | null;
    onStreamingUpdate?: (update: Partial<Message>) => void;
}

function processInvalidToolArguments(params: ProcessInvalidToolArgumentsParams) {
    const {
        executableToolCalls, tools, toolEvidenceState,
        assistantId, chatId, selectedProvider, activeModel,
        turnDisplayContent, turnToolCalls, reasonings,
        noProgressToolTurnCount: initialNoProgressCount,
        malformedToolCallCount: initialMalformedCount,
        currentMessages: initialMessages,
        lastAssistantMessage
    } = params;

    let noProgressToolTurnCount = initialNoProgressCount;
    let malformedToolCallCount = initialMalformedCount;
    let currentMessages = initialMessages;
    let wasSafetyBreak = false;
    let shouldContinue = false;

    const invalidToolResults = executableToolCalls
        .map(tc => {
            const missing = findMissingRequiredArgument(tc, tools);
            return missing ? buildInvalidToolResultMessage(tc, missing) : null;
        })
        .filter((m): m is Message => m !== null);

    const validExecutableToolCalls = executableToolCalls.filter(tc => !invalidToolResults.some(m => m.toolCallId === tc.id));

    if (invalidToolResults.length > 0) {
        appendToolMessages(toolEvidenceState, invalidToolResults);
        noProgressToolTurnCount++;
        malformedToolCallCount += invalidToolResults.length;

        if (malformedToolCallCount >= 3) {
            wasSafetyBreak = true;
        } else {
            currentMessages = [
                ...buildModelConversation(initialMessages, lastAssistantMessage ?? buildAssistantMessage({
                    id: assistantId, content: turnDisplayContent, provider: selectedProvider,
                    model: activeModel, turnToolCalls, reasonings,
                }), invalidToolResults),
                { id: generateId(), role: 'system', content: 'Missing required arguments. Fix and retry.', timestamp: new Date() },
            ];

            if (validExecutableToolCalls.length === 0) {
                shouldContinue = true;
            }
        }
    }

    return {
        validExecutableToolCalls,
        noProgressToolTurnCount,
        malformedToolCallCount,
        currentMessages,
        wasSafetyBreak,
        shouldContinue
    };
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
    const modelContext = { assistantId, chatId, selectedProvider, activeModel, intentClassification, t, language, reasonings, assistantId_str: assistantId };

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
            onStreamingUpdate: params.onStreamingUpdate,
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
                onMessageUpdate: params.onStreamingUpdate,
            });
            break;
        }

        const validationResult = processInvalidToolArguments({
            executableToolCalls, tools, toolEvidenceState,
            assistantId, chatId, selectedProvider, activeModel,
            turnDisplayContent, turnToolCalls, reasonings,
            noProgressToolTurnCount, malformedToolCallCount,
            currentMessages, lastAssistantMessage,
            onStreamingUpdate: params.onStreamingUpdate,
        });

        ({ noProgressToolTurnCount, malformedToolCallCount, currentMessages, wasSafetyBreak } = validationResult);
        const { validExecutableToolCalls } = validationResult;

        if (validationResult.shouldContinue) {
            toolIterations++;
            continue;
        }

        if (wasSafetyBreak) {
            break;
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
                chatId, assistantId, toolCallsHistory, toolEvidenceState, onStreamingUpdate: params.onStreamingUpdate
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
            params.onStreamingUpdate?.({
                content: finalAssistantMessage.content,
                reasonings: finalAssistantMessage.reasonings,
                toolCalls: finalAssistantMessage.toolCalls,
            });
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
            toolCallsHistory, activeWorkspacePath, t, onStreamingUpdate: params.onStreamingUpdate
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
                intentClassification, language, onMessageUpdate: params.onStreamingUpdate,
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
            evidenceRecords: toolEvidenceState.evidenceRecords, t, language, onMessageUpdate: params.onStreamingUpdate,
        }, { lowSignalContentThreshold: TOOL_LOOP_LOW_SIGNAL_CONTENT_THRESHOLD });
    }
    return assistantId;
}

