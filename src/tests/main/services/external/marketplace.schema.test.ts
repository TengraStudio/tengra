/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { marketplaceRegistrySchema } from '@shared/schemas/marketplace.schema';
import { describe, expect, it } from 'vitest';

describe('marketplaceRegistrySchema model size fields', () => {
    it('preserves totalSize when model metadata includes it', () => {
        const parsed = marketplaceRegistrySchema.parse({
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
            mcp: [],
            themes: [],
            personas: [],
            models: [{
                id: 'org/test-model',
                name: 'Test Model',
                description: 'Test model',
                author: 'Test',
                version: '1.0.0',
                downloadUrl: 'https://example.com/model.gguf',
                itemType: 'model',
                provider: 'huggingface',
                totalSize: '12.3 GB',
            }],
            prompts: [],
            languages: [],
            skills: [],
        });

        expect(parsed.models?.[0]?.totalSize).toBe('12.3 GB');
    });

    it('still accepts model entries without totalSize metadata', () => {
        const parsed = marketplaceRegistrySchema.parse({
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
            mcp: [],
            themes: [],
            personas: [],
            models: [{
                id: 'org/test-model-2',
                name: 'Test Model 2',
                description: 'Test model',
                author: 'Test',
                version: '1.0.0',
                downloadUrl: 'https://example.com/model-2.gguf',
                itemType: 'model',
                provider: 'huggingface',
            }],
            prompts: [],
            languages: [],
            skills: [],
        });

        expect(parsed.models?.[0]?.totalSize).toBeUndefined();
    });

    it('preserves runnable MCP plugin entrypoint metadata', () => {
        const parsed = marketplaceRegistrySchema.parse({
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
            mcp: [{
                id: 'tengra-weather',
                name: 'Tengra Weather',
                description: 'Weather plugin',
                author: 'Tengra Studio',
                version: '1.0.0',
                downloadUrl: 'https://example.com/tengra-weather.mcp.json',
                itemType: 'mcp',
                category: 'internet',
                command: 'node',
                args: [],
                entrypointUrl: 'https://example.com/server.mjs',
                entrypointFile: 'server.mjs',
                tools: [{
                    name: 'forecast',
                    description: 'Fetch a weather forecast.',
                }],
            }],
            themes: [],
            personas: [],
            models: [],
            prompts: [],
            languages: [],
            skills: [],
        });

        expect(parsed.mcp[0]?.entrypointUrl).toBe('https://example.com/server.mjs');
        expect(parsed.mcp[0]?.tools?.[0]?.name).toBe('forecast');
    });
});
