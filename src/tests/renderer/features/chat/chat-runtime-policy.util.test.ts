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
    createModelToolList,
    extractImageRequestCount,
    getMessageTextContent,
    isExecutableToolCall,
    isExplicitImageRequest,
    isImageOnlyModel,
    normalizeToolArgs,
} from '@renderer/features/chat/hooks/chat-runtime-policy.util';
import { describe, expect, it } from 'vitest';

import { Message, ToolDefinition } from '@/types';

describe('chat-runtime-policy.util', () => {
    it('reads text content from multipart messages', () => {
        const message = {
            id: 'm1',
            role: 'user',
            timestamp: new Date(),
            content: [
                { type: 'text', text: 'ilk satir' },
                { type: 'text', text: 'ikinci satir' },
            ],
        } as Message;

        expect(getMessageTextContent(message)).toBe('ilk satir\nikinci satir');
    });

    it('detects explicit image requests and requested count', () => {
        const message = {
            id: 'm2',
            role: 'user',
            timestamp: new Date(),
            content: 'Bana 3 tane logo görseli oluştur',
        } as Message;

        expect(isExplicitImageRequest(message)).toBe(true);
        expect(extractImageRequestCount(message)).toBe(3);
    });

    it('recognizes image-only models', () => {
        expect(isImageOnlyModel('gemini-2.5-flash-image-preview')).toBe(true);
        expect(isImageOnlyModel('gpt-5')).toBe(false);
    });

    it('filters excluded tools from the model tool list', () => {
        const toolDefinitions = [
            { type: 'function', function: { name: 'list_directory', description: 'List files' } },
            { type: 'function', function: { name: 'generate_image', description: 'Generate images' } },
            { type: 'function', function: { name: 'revise_plan', description: 'Revise plan' } },
        ] as ToolDefinition[];

        expect(createModelToolList(toolDefinitions).map(tool => tool.function.name)).toEqual([
            'list_directory',
        ]);
    });

    it('normalizes raw tool arguments and executable tool calls', () => {
        expect(normalizeToolArgs({ path: '%USERPROFILE%/Desktop' })).toEqual({
            path: '%USERPROFILE%/Desktop',
        });
        expect(normalizeToolArgs('invalid')).toEqual({});

        expect(isExecutableToolCall({
            id: 'tool-1',
            type: 'function',
            function: {
                name: 'list_directory',
                arguments: '{}',
            },
        })).toBe(true);

        expect(isExecutableToolCall({
            id: '',
            type: 'function',
            function: {
                name: 'list_directory',
                arguments: '{}',
            },
        })).toBe(false);
    });
});
