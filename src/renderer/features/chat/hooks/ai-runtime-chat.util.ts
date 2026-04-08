import { AiIntentClassification } from '@shared/types/ai-runtime';
import { buildAiPresentationMetadata, isLowSignalProgressContent } from '@shared/utils/ai-runtime.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';

import { generateId } from '@/lib/utils';
import { Message, MessageContentPart, ToolCall, ToolResult } from '@/types';

const DIRECT_IMAGE_RESULT_KEYS = ['images', 'paths', 'files'] as const;

export function readToolResultImages(toolExecResult: unknown): string[] {
    const toolResult = toolExecResult as ToolResult;
    if (typeof toolResult.result === 'string') {
        return [toolResult.result];
    }
    if (!toolResult.result || Array.isArray(toolResult.result) || typeof toolResult.result !== 'object') {
        return [];
    }
    const resultObj = toolResult.result as Record<string, unknown>;
    for (const key of DIRECT_IMAGE_RESULT_KEYS) {
        const value = resultObj[key];
        if (!Array.isArray(value)) {
            continue;
        }
        return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    }
    return [];
}

export function getMessageStringContent(content: Message['content']): string {
    if (typeof content === 'string') {
        return content;
    }
    return (content as MessageContentPart[])
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join('\n')
        .trim();
}

export function buildStoredToolResults(
    toolCalls: Message['toolCalls'],
    toolMessages: Message[]
): ToolResult[] {
    if (!toolCalls || toolCalls.length === 0) {
        return [];
    }

    return toolCalls.map(toolCall => {
        const matchingToolMessage = toolMessages.find(message => message.toolCallId === toolCall.id);
        return {
            toolCallId: toolCall.id,
            name: toolCall.function.name,
            result: matchingToolMessage
                ? safeJsonParse(getMessageStringContent(matchingToolMessage.content), {})
                : {},
            success: true,
            isImage: toolCall.function.name === 'generate_image',
        };
    });
}

export function getToolMessageContent(message: Message): string {
    if (typeof message.content === 'string') {
        return message.content;
    }
    return JSON.stringify(message.content);
}

export function shouldPreserveToolLoopFallbackContent(
    assistantMessage: Message,
    assistantContent: string,
    threshold: number
): boolean {
    return assistantContent.length > threshold
        && (!assistantMessage.toolCalls || assistantMessage.toolCalls.length === 0);
}

export function shouldRecoverFromLowSignalFinalContent(
    assistantContent: string,
    accumulatedToolMessages: Message[]
): boolean {
    const trimmedContent = assistantContent.trim();
    return accumulatedToolMessages.length > 0
        && trimmedContent.length > 0
        && isLowSignalProgressContent(trimmedContent);
}

export function buildRepeatedToolMessages(
    toolCalls: NonNullable<Message['toolCalls']>,
    cachedContents: string[],
    repeatedToolResultHint: string
): Message[] {
    return toolCalls.map((toolCall, index) => {
        const cachedContent = cachedContents[index] ?? JSON.stringify({
            success: false,
            error: repeatedToolResultHint,
            tool: toolCall.function.name,
        });

        let repeatedContent = cachedContent;
        try {
            const parsed = JSON.parse(cachedContent) as unknown;
            if (Array.isArray(parsed)) {
                repeatedContent = JSON.stringify({
                    items: parsed,
                    _reused: true,
                    _reuseHint: repeatedToolResultHint,
                });
            } else if (parsed && typeof parsed === 'object') {
                repeatedContent = JSON.stringify({
                    ...(parsed as Record<string, unknown>),
                    _reused: true,
                    _reuseHint: repeatedToolResultHint,
                });
            } else {
                repeatedContent = JSON.stringify({
                    data: parsed,
                    _reused: true,
                    _reuseHint: repeatedToolResultHint,
                });
            }
        } catch {
            repeatedContent = JSON.stringify({
                data: cachedContent,
                _reused: true,
                _reuseHint: repeatedToolResultHint,
            });
        }

        return {
            id: generateId(),
            role: 'tool' as const,
            content: repeatedContent,
            toolCallId: toolCall.id,
            timestamp: new Date(),
        };
    });
}

export function buildAssistantPresentationMetadata(options: {
    intent: AiIntentClassification;
    content?: string;
    reasoning?: string;
    reasonings?: string[];
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
    images?: string[];
    sources?: string[];
    isStreaming?: boolean;
    language?: string;
    evidenceSnapshot?: import('@shared/types/ai-runtime').AiEvidenceStoreSnapshot;
}): Message['metadata'] {
    return {
        aiPresentation: buildAiPresentationMetadata({
            intent: options.intent,
            content: options.content ?? '',
            reasoning: options.reasoning,
            reasonings: options.reasonings,
            toolCalls: options.toolCalls,
            toolResults: options.toolResults,
            images: options.images,
            sources: options.sources,
            isStreaming: options.isStreaming,
            language: options.language,
            evidenceSnapshot: options.evidenceSnapshot,
        }),
    };
}

/**
 * Deduplicates messages by their unique ID.
 */
export function deduplicateMessages(messages: Message[]): Message[] {
    const seen = new Set<string>();
    return messages.filter(m => {
        if (!m.id) {
            return true;
        }
        if (seen.has(m.id)) {
            return false;
        }
        seen.add(m.id);
        return true;
    });
}
