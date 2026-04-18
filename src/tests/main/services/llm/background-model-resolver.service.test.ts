/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { BackgroundModelResolver } from '@main/services/llm/background-model-resolver.service';
import { ModelProviderInfo } from '@main/services/llm/model-registry.service';
import { describe, expect, it, vi } from 'vitest';

function createResolver(options: {
    models?: ModelProviderInfo[];
    settings?: Record<string, unknown>;
    tokens?: Record<string, string | undefined>;
}) {
    const tokens = options.tokens ?? {};
    return new BackgroundModelResolver({
        authService: {
            getActiveToken: vi.fn(async (provider: string) => tokens[provider])
        } as never,
        settingsService: {
            getSettings: vi.fn(() => options.settings ?? {})
        } as never,
        getModels: vi.fn(async () => options.models ?? []),
    });
}

describe('BackgroundModelResolver', () => {
    it('prefers active OAuth models over OpenAI API-key defaults', async () => {
        const resolver = createResolver({
            settings: {
                copilot: { connected: true },
                openai: { apiKey: 'sk-test', model: 'gpt-4o-mini' },
            },
            tokens: { copilot: 'github-oauth-token' },
            models: [
                {
                    id: 'gpt-5 mini',
                    name: 'GPT-5 mini',
                    provider: 'copilot',
                    providerCategory: 'copilot',
                    capabilities: { text_generation: true },
                },
                {
                    id: 'gpt-4o-mini',
                    name: 'GPT-4o mini',
                    provider: 'openai',
                    providerCategory: 'openai',
                    capabilities: { text_generation: true },
                },
            ],
        });

        await expect(resolver.resolve()).resolves.toEqual({
            model: 'gpt-5 mini',
            provider: 'copilot',
            source: 'oauth',
        });
    });

    it('uses the smallest local model when no account credentials are available', async () => {
        const resolver = createResolver({
            models: [
                {
                    id: 'ollama/llama3.1:8b',
                    name: 'llama3.1:8b',
                    provider: 'ollama',
                    providerCategory: 'ollama',
                    parameters: '8B',
                    capabilities: { text_generation: true },
                },
                {
                    id: 'ollama/gemma3:1b',
                    name: 'gemma3:1b',
                    provider: 'ollama',
                    providerCategory: 'ollama',
                    parameters: '1B',
                    capabilities: { text_generation: true },
                },
            ],
        });

        await expect(resolver.resolve()).resolves.toEqual({
            model: 'gemma3:1b',
            provider: 'ollama',
            source: 'local',
        });
    });

    it('falls back to OpenAI only when an OpenAI API key exists', async () => {
        const resolver = createResolver({
            settings: {
                openai: { apiKey: 'sk-test', model: 'gpt-4o-mini' },
            },
        });

        await expect(resolver.resolve()).resolves.toEqual({
            model: 'gpt-4o-mini',
            provider: 'openai',
            source: 'api-key',
        });
    });
});
