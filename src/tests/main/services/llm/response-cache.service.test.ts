/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ResponseCacheService } from '@main/services/llm/response-cache.service';
import { OpenAIResponse } from '@main/types/llm.types';
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

function makeMessage(content: string, role: 'user' | 'assistant' | 'system' = 'user'): Message {
    return { id: `msg-${Date.now()}`, role, content, timestamp: new Date() };
}

function makeResponse(content: string): OpenAIResponse {
    return { content, role: 'assistant' };
}

describe('ResponseCacheService', () => {
    let service: ResponseCacheService;

    beforeEach(() => {
        service = new ResponseCacheService();
        vi.restoreAllMocks();
    });

    describe('get / set', () => {
        it('returns null for cache miss', async () => {
            const result = await service.get([makeMessage('hello')], 'gpt-4');
            expect(result).toBeNull();
        });

        it('returns cached response on cache hit', async () => {
            const messages = [makeMessage('hello')];
            const response = makeResponse('world');
            await service.set(messages, 'gpt-4', response);
            const result = await service.get(messages, 'gpt-4');
            expect(result).toEqual(response);
        });

        it('normalizes model names (case insensitive, trimmed)', async () => {
            const messages = [makeMessage('test')];
            const response = makeResponse('reply');
            await service.set(messages, '  GPT-4  ', response);
            const result = await service.get(messages, 'gpt-4');
            expect(result).toEqual(response);
        });

        it('returns null for expired entries', async () => {
            const messages = [makeMessage('hi')];
            const response = makeResponse('bye');

            const now = 1000000;
            const spy = vi.spyOn(Date, 'now');
            // set calls Date.now() twice: removeExpiredEntries + timestamp
            spy.mockReturnValue(now);
            await service.set(messages, 'gpt-4', response, 2000);

            // get calls Date.now() for removeExpiredEntries + ttl check
            spy.mockReturnValue(now + 5000);
            const result = await service.get(messages, 'gpt-4');
            expect(result).toBeNull();
        });

        it('uses options in cache key differentiation', async () => {
            const messages = [makeMessage('test')];
            const r1 = makeResponse('a');
            const r2 = makeResponse('b');
            await service.set(messages, 'gpt-4', r1, 3600000, { temperature: 0.5 });
            await service.set(messages, 'gpt-4', r2, 3600000, { temperature: 1.0 });

            const result1 = await service.get(messages, 'gpt-4', { temperature: 0.5 });
            const result2 = await service.get(messages, 'gpt-4', { temperature: 1.0 });
            expect(result1?.content).toBe('a');
            expect(result2?.content).toBe('b');
        });
    });

    describe('clampTtl', () => {
        it('clamps TTL below minimum to MIN_TTL_MS', async () => {
            const messages = [makeMessage('test')];
            const response = makeResponse('ok');
            await service.set(messages, 'gpt-4', response, 1);

            // Should still be cached (clamped to 1000ms minimum)
            const result = await service.get(messages, 'gpt-4');
            expect(result).toEqual(response);
        });

        it('clamps non-finite TTL to MAX_TTL_MS', async () => {
            const messages = [makeMessage('test')];
            const response = makeResponse('ok');
            await service.set(messages, 'gpt-4', response, Infinity);

            const result = await service.get(messages, 'gpt-4');
            expect(result).toEqual(response);
        });
    });

    describe('invalidateByModel', () => {
        it('removes entries for specific model', async () => {
            const m1 = [makeMessage('a')];
            const m2 = [makeMessage('b')];
            await service.set(m1, 'gpt-4', makeResponse('r1'));
            await service.set(m2, 'gpt-3.5', makeResponse('r2'));

            const result = service.invalidateByModel('gpt-4');
            expect(result.removed).toBe(1);
            expect(result.reason).toBe('model-change');

            expect(await service.get(m1, 'gpt-4')).toBeNull();
            expect(await service.get(m2, 'gpt-3.5')).not.toBeNull();
        });
    });

    describe('invalidateAll', () => {
        it('clears entire cache', async () => {
            await service.set([makeMessage('a')], 'gpt-4', makeResponse('r1'));
            await service.set([makeMessage('b')], 'gpt-4', makeResponse('r2'));

            const result = service.invalidateAll();
            expect(result.removed).toBe(2);
            expect(result.remaining).toBe(0);
        });
    });

    describe('setCacheNamespace', () => {
        it('invalidates cache on namespace change', async () => {
            await service.set([makeMessage('a')], 'gpt-4', makeResponse('r'));
            const result = service.setCacheNamespace('workspace-x');
            expect(result.removed).toBe(1);
            expect(result.reason).toBe('namespace-change');
        });

        it('does not invalidate when setting same namespace', () => {
            const result = service.setCacheNamespace('default');
            expect(result.removed).toBe(0);
        });
    });

    describe('invalidate', () => {
        it('delegates to invalidateByModel when model given', async () => {
            await service.set([makeMessage('a')], 'gpt-4', makeResponse('r'));
            const result = service.invalidate({ model: 'gpt-4' });
            expect(result.removed).toBe(1);
        });

        it('delegates to invalidateAll when no model', async () => {
            await service.set([makeMessage('a')], 'gpt-4', makeResponse('r'));
            const result = service.invalidate();
            expect(result.removed).toBe(1);
        });
    });

    describe('clear', () => {
        it('clears all entries', async () => {
            await service.set([makeMessage('a')], 'gpt-4', makeResponse('r'));
            service.clear();
            expect(service.getStats().size).toBe(0);
        });
    });

    describe('getStats', () => {
        it('returns correct statistics', async () => {
            await service.set([makeMessage('a')], 'gpt-4', makeResponse('r'));
            const stats = service.getStats();
            expect(stats.size).toBe(1);
            expect(stats.maxEntries).toBe(1000);
            expect(stats.namespace).toBe('default');
            expect(stats.keyVersion).toBe(2);
        });
    });

    describe('edge cases', () => {
        it('normalizes empty model to unknown-model', async () => {
            const messages = [makeMessage('test')];
            await service.set(messages, '  ', makeResponse('r'));
            const result = await service.get(messages, '');
            expect(result).not.toBeNull();
        });

        it('normalizes empty namespace to default', () => {
            const result = service.setCacheNamespace('  ');
            expect(result.removed).toBe(0); // stays as 'default'
        });
    });
});
