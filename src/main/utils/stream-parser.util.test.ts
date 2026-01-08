import { describe, it, expect } from 'vitest';
import { StreamParser } from './stream-parser.util';

describe('StreamParser', () => {
    it('should parse simple chunks', async () => {
        const mockStream = {
            body: [
                new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'),
                new TextEncoder().encode('data: {"choices":[{"delta":{"content":" World"}}]}\n\n'),
                new TextEncoder().encode('data: [DONE]\n\n')
            ]
        };

        const chunks = [];
        for await (const chunk of StreamParser.parseChatStream(mockStream)) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(2);
        expect(chunks[0].content).toBe('Hello');
        expect(chunks[1].content).toBe(' World');
    });

    it('should handle split lines', async () => {
        const mockStream = {
            body: [
                new TextEncoder().encode('data: {"choices":[{"delta":{"con'),
                new TextEncoder().encode('tent":"Split"}}]}\n\n')
            ]
        };

        const chunks = [];
        for await (const chunk of StreamParser.parseChatStream(mockStream)) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(1);
        expect(chunks[0].content).toBe('Split');
    });

    it('should pass through images', async () => {
        const mockStream = {
            body: [
                new TextEncoder().encode('data: {"choices":[{"delta":{"images":["img1"]}}]}\n\n')
            ]
        };

        const chunks = [];
        for await (const chunk of StreamParser.parseChatStream(mockStream)) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(1);
        expect(chunks[0].images).toEqual(['img1']);
    });
});
