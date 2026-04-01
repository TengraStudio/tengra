import { StreamParser } from '@main/utils/stream-parser.util';
import { describe, expect, it } from 'vitest';

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
});
