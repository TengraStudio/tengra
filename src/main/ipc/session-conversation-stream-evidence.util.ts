import { AiEvidenceRecord } from '@shared/types/ai-runtime';
import { ToolCall } from '@shared/types/chat';

interface UsageLike {
    prompt_tokens: number;
    completion_tokens: number;
}

export interface SessionStreamEvidenceState {
    fullContent: string;
    fullReasoning: string;
    toolCalls: ToolCall[];
    totalPrompt: number;
    totalCompletion: number;
    evidenceRecords: AiEvidenceRecord[];
}

function buildFallbackToolCallId(toolCall: ToolCall): string {
    const functionName = typeof toolCall.function?.name === 'string' && toolCall.function.name.trim().length > 0
        ? toolCall.function.name.trim()
        : 'tool';
    const indexPart = typeof toolCall.index === 'number' ? toolCall.index : 0;
    return `${functionName}-${indexPart}`;
}

function normalizeToolCallIdentity(toolCall: ToolCall): ToolCall {
    const normalizedId = typeof toolCall.id === 'string' && toolCall.id.trim().length > 0
        ? toolCall.id
        : buildFallbackToolCallId(toolCall);
    return { ...toolCall, id: normalizedId };
}

function mergeSessionToolCalls(currentToolCalls: ToolCall[], incomingToolCalls: ToolCall[]): ToolCall[] {
    const mergedToolCalls = [...currentToolCalls];

    for (const rawIncomingToolCall of incomingToolCalls) {
        const incomingHasExplicitId = typeof rawIncomingToolCall.id === 'string' && rawIncomingToolCall.id.trim().length > 0;
        const incomingToolCall = normalizeToolCallIdentity(rawIncomingToolCall);
        const existingIndex = mergedToolCalls.findIndex(toolCall =>
            toolCall.id === incomingToolCall.id
            || (
                incomingToolCall.index !== undefined
                && toolCall.index !== undefined
                && toolCall.index === incomingToolCall.index
            )
        );

        if (existingIndex === -1) {
            mergedToolCalls.push(incomingToolCall);
            continue;
        }

        const existingToolCall = normalizeToolCallIdentity(mergedToolCalls[existingIndex]);
        mergedToolCalls[existingIndex] = {
            ...existingToolCall,
            ...incomingToolCall,
            id: incomingHasExplicitId ? incomingToolCall.id : existingToolCall.id,
            function: {
                ...existingToolCall.function,
                ...incomingToolCall.function,
                name: incomingToolCall.function.name || existingToolCall.function.name,
                arguments: (existingToolCall.function.arguments || '') + (incomingToolCall.function.arguments || ''),
            },
        };
    }

    return mergedToolCalls;
}

export function createSessionStreamEvidenceState(): SessionStreamEvidenceState {
    return {
        fullContent: '',
        fullReasoning: '',
        toolCalls: [],
        totalPrompt: 0,
        totalCompletion: 0,
        evidenceRecords: [],
    };
}

export function applySessionStreamChunk(
    state: SessionStreamEvidenceState,
    chunk: {
        content?: string;
        reasoning?: string;
        tool_calls?: ToolCall[];
        usage?: UsageLike;
    }
): void {
    if (chunk.usage) {
        state.totalPrompt = chunk.usage.prompt_tokens;
        state.totalCompletion = chunk.usage.completion_tokens;
    }
    if (chunk.content) {
        state.fullContent += chunk.content;
    }
    if (chunk.reasoning) {
        state.fullReasoning += chunk.reasoning;
    }
    if (Array.isArray(chunk.tool_calls)) {
        state.toolCalls = mergeSessionToolCalls(state.toolCalls, chunk.tool_calls);
    }
}
