/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { StreamParser } from '@main/utils/stream-parser.util';
import { XmlToolParser } from '@main/utils/xml-tool-parser.util';
import { describe, expect, it, vi } from 'vitest';

describe('StreamParser', () => {
    it('should parse simple chunks', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
                controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":" World"}}]}\n\n'));
                controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                controller.close();
            }
        });
        const mockResponse = { body: stream } as never;

        const chunks = [];
        for await (const chunk of StreamParser.parseChatStream(mockResponse)) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(2);
        expect(chunks[0]?.content).toBe('Hello');
        expect(chunks[1]?.content).toBe(' World');
        expect(chunks.map(chunk => chunk.content ?? '').join('')).toBe('Hello World');
    });

    it('should handle split lines', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"con'));
                controller.enqueue(new TextEncoder().encode('tent":"Split"}}]}\n\n'));
                controller.close();
            }
        });
        const mockResponse = { body: stream } as never;

        const chunks = [];
        for await (const chunk of StreamParser.parseChatStream(mockResponse)) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(1);
        expect(chunks[0]?.content).toBe('Split');
    });

    it('should pass through images', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"images":["img1"]}}]}\n\n'));
                controller.close();
            }
        });
        const mockResponse = { body: stream } as never;

        const chunks = [];
        for await (const chunk of StreamParser.parseChatStream(mockResponse)) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(1);
        expect(chunks[0]?.images).toEqual(['img1']);
    });

    it('should preserve standalone space chunks', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"foo"}}]}\n\n'));
                controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":" "}}]}\n\n'));
                controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"bar"}}]}\n\n'));
                controller.close();
            }
        });
        const mockResponse = { body: stream } as never;

        const chunks = [];
        for await (const chunk of StreamParser.parseChatStream(mockResponse)) {
            chunks.push(chunk);
        }

        expect(chunks.map(chunk => chunk.content ?? '').join('')).toBe('foo bar');
    });

    it('should not trim plain text when parsing xml tool content', () => {
        const parsed = XmlToolParser.parse(' ');
        expect(parsed.cleanedText).toBe('');
    });

    it('should invoke xml parsing for normal content chunks', async () => {
        const parseSpy = vi.spyOn(XmlToolParser, 'parse');
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"x"}}]}\n\n'));
                controller.close();
            }
        });
        const mockResponse = { body: stream } as never;

        const chunks = [];
        for await (const chunk of StreamParser.parseChatStream(mockResponse)) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(1);
        expect(parseSpy).toHaveBeenCalled();
        expect(parseSpy.mock.calls.some(call => call[1] && (call[1] as { trim?: boolean }).trim === false)).toBe(true);
        parseSpy.mockRestore();
    });

    it('should assemble opencode tool calls from streamed argument deltas', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.output_item.added","item":{"id":"call_1","call_id":"call_1","name":"get_system_info"}}\n\n'));
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.function_call_arguments.delta","call_id":"call_1","name":"get_system_info","delta":"{\\"scope\\":\\""}\n\n'));
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.function_call_arguments.delta","call_id":"call_1","delta":"system\\"}"}\n\n'));
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.function_call_arguments.done","call_id":"call_1"}\n\n'));
                controller.close();
            }
        });
        const mockResponse = { body: stream } as never;

        const chunks = [];
        for await (const chunk of StreamParser.parseChatStream(mockResponse)) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(1);
        expect(chunks[0]?.type).toBe('tool_calls');
        expect(chunks[0]?.tool_calls?.[0]?.id).toBe('call_1');
        expect(chunks[0]?.tool_calls?.[0]?.function.name).toBe('get_system_info');
        expect(chunks[0]?.tool_calls?.[0]?.function.arguments).toBe('{"scope":"system"}');
    });

    it('should normalize OpenAI-style partial tool call deltas with missing fields', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"tool_calls":[{"index":0}]}}]}\n\n'));
                controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"run_command"}}]}}]}\n\n'));
                controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"command\\":\\"which node\\"}"}}]},"finish_reason":"tool_calls"}]}\n\n'));
                controller.close();
            }
        });
        const mockResponse = { body: stream } as never;

        const chunks = [];
        for await (const chunk of StreamParser.parseChatStream(mockResponse)) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(2);
        expect(chunks[0]?.type).toBe('tool_calls');
        expect(chunks[0]?.tool_calls?.[0]?.id).toBe('call_1');
        expect(chunks[0]?.tool_calls?.[0]?.function.name).toBe('run_command');
        expect(chunks[0]?.tool_calls?.[0]?.function.arguments).toBe('');
        expect(chunks[1]?.tool_calls?.[0]?.id).toBe('');
        expect(chunks[1]?.tool_calls?.[0]?.function.name).toBe('');
        expect(chunks[1]?.tool_calls?.[0]?.function.arguments).toBe('{"command":"which node"}');
    });

    it('should parse response.reasoning_text.delta events as reasoning chunks', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.reasoning_text.delta","delta":"thinking..."}\n\n'));
                controller.close();
            }
        });
        const mockResponse = { body: stream } as never;

        const chunks = [];
        for await (const chunk of StreamParser.parseChatStream(mockResponse)) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(1);
        expect(chunks[0]?.reasoning).toBe('thinking...');
    });

    it('should emit output text from response.output_text.done when no deltas were streamed', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.output_text.done","item_id":"msg_1","text":"Final text"}\n\n'));
                controller.close();
            }
        });
        const mockResponse = { body: stream } as never;

        const chunks = [];
        for await (const chunk of StreamParser.parseChatStream(mockResponse)) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(1);
        expect(chunks[0]?.content).toBe('Final text');
    });

    it('should avoid duplicating content when response.output_text.done follows streamed deltas', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.output_text.delta","item_id":"msg_2","delta":"Hello"}\n\n'));
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.output_text.done","item_id":"msg_2","text":"Hello"}\n\n'));
                controller.close();
            }
        });
        const mockResponse = { body: stream } as never;

        const chunks = [];
        for await (const chunk of StreamParser.parseChatStream(mockResponse)) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(1);
        expect(chunks[0]?.content).toBe('Hello');
    });

    it('should avoid duplicating content when response.output_text.done has no item id', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.output_text.delta","delta":"I\'ll use the Desktop folder by default."}\n\n'));
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.output_text.done","text":"I\'ll use the Desktop folder by default."}\n\n'));
                controller.close();
            }
        });
        const mockResponse = { body: stream } as never;

        const chunks = [];
        for await (const chunk of StreamParser.parseChatStream(mockResponse)) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(1);
        expect(chunks[0]?.content).toBe('I\'ll use the Desktop folder by default.');
    });

    it('should suppress duplicate text when response.output_item.done follows response.output_text.done', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.output_text.done","item_id":"msg_3","text":"Hello from done"}\n\n'));
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.output_item.done","item":{"id":"msg_3","type":"message","content":[{"type":"output_text","text":"Hello from done"}]}}\n\n'));
                controller.close();
            }
        });
        const mockResponse = { body: stream } as never;

        const chunks = [];
        for await (const chunk of StreamParser.parseChatStream(mockResponse)) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(1);
        expect(chunks[0]?.content).toBe('Hello from done');
    });

    it('should emit reasoning from summary_text items in response.output_item.done events', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.output_item.done","item":{"id":"msg_4","type":"message","content":[{"type":"summary_text","text":"Checking files first."}]}}\n\n'));
                controller.close();
            }
        });
        const mockResponse = { body: stream } as never;

        const chunks = [];
        for await (const chunk of StreamParser.parseChatStream(mockResponse)) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(1);
        expect(chunks[0]?.reasoning).toBe('Checking files first.');
    });

    it('should emit both content and reasoning from mixed response.output_item.done items', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.output_item.done","item":{"id":"msg_5","type":"message","content":[{"type":"summary_text","text":"Inspecting lint setup."},{"type":"output_text","text":"There are 3 lint errors."}]}}\n\n'));
                controller.close();
            }
        });
        const mockResponse = { body: stream } as never;

        const chunks = [];
        for await (const chunk of StreamParser.parseChatStream(mockResponse)) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(2);
        expect(chunks[0]?.content).toBe('There are 3 lint errors.');
        expect(chunks[1]?.reasoning).toBe('Inspecting lint setup.');
    });

    it('should parse response.reasoning_text.done events as reasoning chunks', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.reasoning_text.done","text":"final reasoning"}\n\n'));
                controller.close();
            }
        });
        const mockResponse = { body: stream } as never;

        const chunks = [];
        for await (const chunk of StreamParser.parseChatStream(mockResponse)) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(1);
        expect(chunks[0]?.reasoning).toBe('final reasoning');
    });

    it('should assemble mcp call arguments deltas into tool_calls', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.output_item.added","item":{"id":"mcp_1","call_id":"mcp_1","name":"web.search"}}\n\n'));
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.mcp_call_arguments.delta","call_id":"mcp_1","delta":"{\\"q\\":\\"ope"}\n\n'));
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.mcp_call_arguments.delta","call_id":"mcp_1","delta":"nai\\"}"}\n\n'));
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.mcp_call_arguments.done","call_id":"mcp_1"}\n\n'));
                controller.close();
            }
        });
        const mockResponse = { body: stream } as never;

        const chunks = [];
        for await (const chunk of StreamParser.parseChatStream(mockResponse)) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(1);
        expect(chunks[0]?.type).toBe('tool_calls');
        expect(chunks[0]?.tool_calls?.[0]?.id).toBe('mcp_1');
        expect(chunks[0]?.tool_calls?.[0]?.function.name).toBe('web.search');
        expect(chunks[0]?.tool_calls?.[0]?.function.arguments).toBe('{"q":"openai"}');
    });

    it('should finalize opencode function calls from response.output_item.done events', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.output_item.added","item":{"id":"tool-0","call_id":"tool-0","type":"function_call","function":{"name":"list_directory","arguments":"{\\"path\\":\\"C:/Users\\"}"}}}\n\n'));
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.output_item.done","item":{"id":"tool-0","call_id":"tool-0","type":"function_call","function":{"name":"list_directory","arguments":"{\\"path\\":\\"C:/Users\\"}"}}}\n\n'));
                controller.close();
            }
        });
        const mockResponse = { body: stream } as never;

        const chunks = [];
        for await (const chunk of StreamParser.parseChatStream(mockResponse)) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(1);
        expect(chunks[0]?.type).toBe('tool_calls');
        expect(chunks[0]?.tool_calls?.[0]?.id).toBe('tool-0');
        expect(chunks[0]?.tool_calls?.[0]?.function.name).toBe('list_directory');
        expect(chunks[0]?.tool_calls?.[0]?.function.arguments).toBe('{"path":"C:/Users"}');
    });

    it('should flush pending function_call deltas when response.completed arrives without done events', async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.output_item.added","item":{"id":"call_2","call_id":"call_2","name":"list_directory"}}\n\n'));
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.function_call_arguments.delta","call_id":"call_2","delta":"{\\"path\\":\\"C:/Users\\"}"}\n\n'));
                controller.enqueue(new TextEncoder().encode('data: {"type":"response.completed","response":{"id":"resp_1","status":"completed"}}\n\n'));
                controller.close();
            }
        });
        const mockResponse = { body: stream } as never;

        const chunks = [];
        for await (const chunk of StreamParser.parseChatStream(mockResponse)) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(1);
        expect(chunks[0]?.type).toBe('tool_calls');
        expect(chunks[0]?.tool_calls?.[0]?.id).toBe('call_2');
        expect(chunks[0]?.tool_calls?.[0]?.function.name).toBe('list_directory');
        expect(chunks[0]?.tool_calls?.[0]?.function.arguments).toBe('{"path":"C:/Users"}');
    });
});
