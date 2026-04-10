import { ToolCall } from '@shared/types/chat';

function buildToolCallSignature(toolCall: ToolCall): string {
    const toolName = toolCall.function.name.trim();
    const toolArgs = toolCall.function.arguments.trim();
    return `${toolName}:${toolArgs}`;
}

export function compactToolCallsForDisplay(toolCalls?: ToolCall[]): ToolCall[] | undefined {
    if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
        return undefined;
    }

    const compacted: ToolCall[] = [];
    const signatureIndex = new Map<string, number>();
    for (const toolCall of toolCalls) {
        const signature = buildToolCallSignature(toolCall);
        const existingIndex = signatureIndex.get(signature);
        if (typeof existingIndex === 'number') {
            compacted[existingIndex] = toolCall;
            continue;
        }
        signatureIndex.set(signature, compacted.length);
        compacted.push(toolCall);
    }

    return compacted.length > 0 ? compacted : undefined;
}
