/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    normalizeAnthropicResponse,
    normalizeOllamaResponse,
    normalizeOpenAIResponse,
    normalizeStreamChunk,
} from '@main/utils/response-normalizer.util';
import { describe, expect, it } from 'vitest';

describe('response-normalizer.util', () => {
    it('normalizes OpenAI response', () => {
        const normalized = normalizeOpenAIResponse(
            {
                id: 'res-1',
                choices: [
                    {
                        message: { role: 'assistant', content: 'hello' },
                        finish_reason: 'stop',
                    },
                ],
                usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
            },
            'gpt-test'
        );

        expect(normalized.provider).toBe('openai');
        expect(normalized.content).toBe('hello');
        expect(normalized.usage?.totalTokens).toBe(3);
    });

    it('normalizes Anthropic response', () => {
        const normalized = normalizeAnthropicResponse(
            {
                id: 'msg-1',
                content: [{ type: 'text', text: 'anthropic text' }],
                usage: { input_tokens: 2, output_tokens: 5 },
            },
            'claude-test'
        );

        expect(normalized.provider).toBe('anthropic');
        expect(normalized.content).toBe('anthropic text');
        expect(normalized.usage?.totalTokens).toBe(7);
    });

    it('normalizes Ollama response', () => {
        const normalized = normalizeOllamaResponse(
            {
                response: 'ollama text',
                done: true,
                eval_count: 4,
                prompt_eval_count: 6,
            },
            'llama-test'
        );

        expect(normalized.provider).toBe('ollama');
        expect(normalized.content).toBe('ollama text');
        expect(normalized.usage?.totalTokens).toBe(10);
    });

    it('normalizes OpenAI stream chunk', () => {
        const chunk = normalizeStreamChunk(
            {
                choices: [{ delta: { content: 'a' }, finish_reason: null }],
            },
            'openai'
        );

        expect(chunk.content).toBe('a');
        expect(chunk.done).toBe(false);
    });
});
