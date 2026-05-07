/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
    language?: string,
    isStreaming?: boolean
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
        reasonings: message.reasonings,
        sources: message.sources,
        images: message.images,
        toolCalls: message.toolCalls,
        toolResults: Array.isArray(message.toolResults) ? message.toolResults : undefined,
        isStreaming: isStreaming ?? false,
        language,
    });
}

