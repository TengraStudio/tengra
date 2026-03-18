import { ContextWindowService } from '@main/services/llm/context-window.service';
import { Message } from '@shared/types/chat';
import { beforeEach,describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

const MOCK_CONTEXT_WINDOW = 4096;
const MOCK_TOKENS_PER_MSG = 50;

vi.mock('@main/services/llm/token-estimation.service', () => {
    const mockEstimator = {
        estimateMessagesTokens: vi.fn((messages: Message[]) => ({
            estimatedTotalTokens: messages.length * MOCK_TOKENS_PER_MSG,
            inputTokens: messages.filter(m => m.role !== 'assistant').length * MOCK_TOKENS_PER_MSG,
            outputTokens: messages.filter(m => m.role === 'assistant').length * MOCK_TOKENS_PER_MSG,
        })),
        getContextWindowSize: vi.fn(() => MOCK_CONTEXT_WINDOW),
        estimateMessageTokens: vi.fn(() => MOCK_TOKENS_PER_MSG),
        estimateStringTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
        truncateToFitContextWindow: vi.fn((messages: Message[]) => messages.slice(-10)),
    };
    return {
        getTokenEstimationService: () => mockEstimator,
        TokenEstimationService: vi.fn(() => mockEstimator),
    };
});

function makeMsg(role: 'user' | 'assistant' | 'system', content: string, id?: string): Message {
    return { id: id ?? `msg-${Math.random().toString(36).slice(2)}`, role, content, timestamp: new Date() };
}

function makeManyMessages(count: number): Message[] {
    return Array.from({ length: count }, (_, i) =>
        makeMsg(i % 2 === 0 ? 'user' : 'assistant', `Message ${i}`, `msg-${i}`)
    );
}

describe('ContextWindowService', () => {
    let service: ContextWindowService;

    beforeEach(() => {
        vi.restoreAllMocks();
        service = new ContextWindowService();
    });

    describe('getContextWindowInfo', () => {
        it('returns correct info for messages that fit', () => {
            const messages = makeManyMessages(10); // 500 tokens
            const info = service.getContextWindowInfo(messages, 'gpt-4');
            expect(info.fits).toBe(true);
            expect(info.estimatedTokens).toBe(500);
            expect(info.remainingTokens).toBe(MOCK_CONTEXT_WINDOW - 500);
            expect(info.contextWindowSize).toBe(MOCK_CONTEXT_WINDOW);
            expect(info.model).toBe('gpt-4');
        });

        it('reports not fitting when exceeding context window', () => {
            const messages = makeManyMessages(100); // 5000 tokens > 4096
            const info = service.getContextWindowInfo(messages, 'gpt-4');
            expect(info.fits).toBe(false);
            expect(info.utilizationPercent).toBe(100); // capped at 100
        });

        it('accounts for reserved tokens', () => {
            const messages = makeManyMessages(10);
            const info = service.getContextWindowInfo(messages, 'gpt-4', 3600);
            expect(info.fits).toBe(false); // 500 + 3600 > 4096
        });
    });

    describe('needsTruncation', () => {
        it('returns false when messages fit', () => {
            expect(service.needsTruncation(makeManyMessages(5), 'gpt-4')).toBe(false);
        });

        it('returns true when messages exceed window', () => {
            expect(service.needsTruncation(makeManyMessages(100), 'gpt-4')).toBe(true);
        });
    });

    describe('truncateMessages', () => {
        it('truncates to fit context window using recent-first', () => {
            const messages = makeManyMessages(100);
            const result = service.truncateMessages(messages, 'gpt-4');
            expect(result.truncated.length).toBeLessThan(messages.length);
            expect(result.removedCount).toBeGreaterThan(0);
            expect(result.info).toBeDefined();
        });

        it('keeps system messages when keepSystemMessages is true', () => {
            const messages = [
                makeMsg('system', 'System prompt'),
                ...makeManyMessages(100),
            ];
            const result = service.truncateMessages(messages, 'gpt-4', {
                keepSystemMessages: true,
            });
            const systemMsgs = result.truncated.filter(m => m.role === 'system');
            expect(systemMsgs.length).toBeGreaterThanOrEqual(1);
        });

        it('keeps recent messages when keepRecentMessages set', () => {
            const messages = makeManyMessages(100);
            const result = service.truncateMessages(messages, 'gpt-4', {
                keepRecentMessages: 5,
            });
            const lastFiveOriginal = messages.slice(-5).map(m => m.id);
            const lastFiveResult = result.truncated.slice(-5).map(m => m.id);
            expect(lastFiveResult).toEqual(lastFiveOriginal);
        });

        it('handles empty messages array', () => {
            const result = service.truncateMessages([], 'gpt-4');
            expect(result.truncated).toEqual([]);
            expect(result.removedCount).toBe(0);
        });

        it('uses importance-based strategy fallback', () => {
            const messages = makeManyMessages(20);
            const result = service.truncateMessages(messages, 'gpt-4', {
                strategy: 'importance-based',
            });
            expect(result.truncated).toBeDefined();
        });
    });

    describe('compactMessages', () => {
        it('returns unmodified messages when they fit', () => {
            const messages = makeManyMessages(5);
            const result = service.compactMessages(messages, 'gpt-4');
            expect(result.compacted).toBe(false);
            expect(result.removedCount).toBe(0);
            expect(result.messages.length).toBe(5);
        });

        it('compacts messages that exceed context window', () => {
            const messages = makeManyMessages(100);
            const result = service.compactMessages(messages, 'gpt-4');
            expect(result.messages.length).toBeLessThan(100);
            expect(result.passes).toBeGreaterThanOrEqual(1);
            expect(result.info).toBeDefined();
        });
    });

    describe('getRecommendedTruncationSettings', () => {
        it('returns settings for low utilization', () => {
            const messages = makeManyMessages(5); // ~12%
            const settings = service.getRecommendedTruncationSettings(messages, 'gpt-4');
            expect(settings.keepSystemMessages).toBe(true);
            expect(settings.strategy).toBe('recent-first');
        });

        it('returns moderate settings for ~90% utilization', () => {
            // 4096 * 0.9 = ~3686 tokens -> 3686/50 = ~74 messages
            const messages = makeManyMessages(74);
            const settings = service.getRecommendedTruncationSettings(messages, 'gpt-4');
            expect(settings.keepRecentMessages).toBe(20);
        });

        it('returns aggressive settings for >95% utilization', () => {
            const messages = makeManyMessages(100); // exceeds window
            const settings = service.getRecommendedTruncationSettings(messages, 'gpt-4');
            expect(settings.keepRecentMessages).toBe(10);
        });
    });

    describe('edge cases', () => {
        it('handles messages with content arrays', () => {
            const msg: Message = {
                id: 'multi',
                role: 'user',
                content: [{ type: 'text', text: 'hello' }] as never as string,
                timestamp: new Date(),
            };
            const info = service.getContextWindowInfo([msg], 'gpt-4');
            expect(info).toBeDefined();
        });
    });
});
