/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { LLMAltProvidersService } from '@main/services/llm/llm-alt-providers.service';
import type { ToolDefinition } from '@shared/types/chat';
import { describe, expect, it, vi } from 'vitest';

function createService(fetchImpl: ReturnType<typeof vi.fn>) {
    return new LLMAltProvidersService(
        {
            httpService: {
                fetch: fetchImpl,
            } as never,
            keyRotationService: {
                rotateKey: vi.fn(),
            } as never,
        },
        {
            openai: {
                execute: async (fn: () => Promise<unknown>) => fn(),
            } as never,
        } as never,
        {
            getAnthropicApiKey: vi.fn(),
            getGroqApiKey: vi.fn(),
            getNvidiaApiKey: vi.fn(),
            getOpenCodeApiKey: vi.fn().mockResolvedValue('opencode-test-key'),
        }
    );
}

describe('LLMAltProvidersService OpenCode responses path', () => {
    it('sends flattened tools to the OpenCode /responses endpoint for non-streaming calls', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                output: [{
                    type: 'message',
                    content: [{
                        type: 'output_text',
                        text: 'done',
                    }],
                }],
            }),
        });
        const service = createService(fetchMock);
        const fallback = vi.fn();
        const tools: ToolDefinition[] = [{
            type: 'function',
            function: {
                name: 'read_file',
                description: 'Read a file',
                parameters: {
                    type: 'object',
                    properties: {
                        path: { type: 'string' },
                    },
                    required: ['path'],
                },
            },
        }];

        const response = await service.chatOpenCode(
            [{ role: 'user', content: 'inspect the repo' }],
            'gpt-4o',
            tools,
            fallback as never
        );

        expect(response.content).toBe('done');
        expect(fallback).not.toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const [, request] = fetchMock.mock.calls[0] as [string, { body: string }];
        const parsed = JSON.parse(request.body);
        expect(parsed.tools).toEqual([{
            type: 'function',
            name: 'read_file',
            description: 'Read a file',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string' },
                },
            },
        }]);
        expect(parsed.tool_choice).toBe('auto');
    });

    it('uses the OpenCode /responses stream path for streaming calls and emits structured tool calls', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.output_item.added","item":{"id":"call_1","call_id":"call_1","type":"function_call","function":{"name":"read_file","arguments":"{\\"path\\":\\"README.md\\"}"}}}\n\n'));
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.output_item.done","item":{"id":"call_1","call_id":"call_1","type":"function_call","function":{"name":"read_file","arguments":"{\\"path\\":\\"README.md\\"}"}}}\n\n'));
                controller.close();
            },
        });
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            body: stream,
        });
        const service = createService(fetchMock);
        const fallback = vi.fn(async function* () {});
        const tools: ToolDefinition[] = [{
            type: 'function',
            function: {
                name: 'read_file',
                parameters: {
                    type: 'object',
                    properties: {
                        path: { type: 'string' },
                    },
                },
            },
        }];

        const chunks = [];
        for await (const chunk of service.chatOpenCodeStream(
            [{ role: 'user', content: 'inspect the repo' }],
            'gpt-4o',
            tools,
            undefined,
            fallback as never
        )) {
            chunks.push(chunk);
        }

        expect(fallback).not.toHaveBeenCalled();
        expect(chunks).toEqual([
            {
                type: 'tool_calls',
                tool_calls: [{
                    id: 'call_1',
                    type: 'function',
                    function: {
                        name: 'read_file',
                        arguments: '{"path":"README.md"}',
                    },
                }],
            },
        ]);
    });
});
