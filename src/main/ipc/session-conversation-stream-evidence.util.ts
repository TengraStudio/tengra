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
        state.toolCalls = chunk.tool_calls;
    }
}
