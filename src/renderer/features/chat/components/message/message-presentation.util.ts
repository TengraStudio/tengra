import { AiPresentationMetadata } from '@shared/types/ai-runtime';
import {
    buildAiPresentationMetadata,
    inferAiIntentFromAssistantState,
} from '@shared/utils/ai-runtime.util';

import { Message } from '@/types';

export function readAiPresentationMetadata(
    message: Message,
    displayContent: string,
    streamingReasoning?: string,
    language?: string
): AiPresentationMetadata | null {
    const rawPresentation = message.metadata?.aiPresentation;
    if (rawPresentation && typeof rawPresentation === 'object' && !Array.isArray(rawPresentation)) {
        return rawPresentation as AiPresentationMetadata;
    }

    if (message.role !== 'assistant') {
        return null;
    }

    return buildAiPresentationMetadata({
        intent: inferAiIntentFromAssistantState({
            content: displayContent,
            toolCalls: message.toolCalls,
            toolResults: Array.isArray(message.toolResults) ? message.toolResults : undefined,
            sources: message.sources,
            images: message.images,
        }),
        content: displayContent,
        reasoning: streamingReasoning ?? message.reasoning,
        sources: message.sources,
        images: message.images,
        toolCalls: message.toolCalls,
        toolResults: Array.isArray(message.toolResults) ? message.toolResults : undefined,
        isStreaming: false,
        language,
    });
}
