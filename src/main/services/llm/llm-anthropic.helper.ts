import { KeyRotationService } from '@main/services/security/key-rotation.service';
import { ChatMessage } from '@main/types/llm.types';
import { OpenAIResponse } from '@main/types/llm.types';
import { MessageNormalizer } from '@main/utils/message-normalizer.util';
import { Message } from '@shared/types/chat';
import { JsonObject } from '@shared/types/common';
import { ApiError, AuthenticationError, NetworkError } from '@shared/utils/error.util';

import { validateLLMContent } from './llm-openai.helper';

/**
 * Builds the Anthropic API request body.
 */
export function buildAnthropicBody(messages: Array<Message | ChatMessage>, model: string): Record<string, unknown> {
    const normalized = MessageNormalizer.normalizeAnthropicMessages(messages);
    const systemMessage = messages.find(m => m.role === 'system')?.content;

    const body: Record<string, unknown> = {
        model,
        messages: normalized,
        max_tokens: 4096
    };
    if (typeof systemMessage === 'string') { body.system = systemMessage; }
    return body;
}

/**
 * Processes the Anthropic API response.
 */
export async function handleAnthropicApiResponse(
    response: Response,
    keyRotationService: KeyRotationService
): Promise<OpenAIResponse> {
    const data = await response.json() as JsonObject;
    const error = data['error'] as JsonObject | undefined;
    if (error) {
        if (response.status === 401) { keyRotationService.rotateKey('anthropic'); }
        throw new ApiError(
            (error['message'] as string) || 'Anthropic API Error',
            'anthropic',
            response.status,
            false,
            { type: error['type'] ?? null }
        );
    }
    const content = data['content'] as Array<{ text: string }> | undefined;
    const validatedContent = validateLLMContent(content?.[0]?.text ?? '');
    return { content: validatedContent, role: 'assistant' };
}

/**
 * Wraps Anthropic errors in appropriate error types.
 */
export function handleAnthropicError(error: unknown): Error {
    if (error instanceof ApiError || error instanceof AuthenticationError) { return error; }
    return new NetworkError(error instanceof Error ? error.message : String(error), { provider: 'anthropic' });
}
