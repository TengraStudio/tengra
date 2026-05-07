/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Unit tests for ModelFallbackService
 */
import { ChatHandler, FallbackModelConfig, ModelFallbackService } from '@main/services/llm/model-fallback.service';
import { Message } from '@shared/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock logger
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

let service: ModelFallbackService;

beforeEach(() => {
    service = new ModelFallbackService();
});

describe('ModelFallbackService - Configuration', () => {
    describe('configure', () => {
        it('should configure fallback chain with models', () => {
            const models: FallbackModelConfig[] = [
                { provider: 'openai', model: 'gpt-4', priority: 1, enabled: true },
                { provider: 'anthropic', model: 'claude-3', priority: 2, enabled: true }
            ];

            service.configure({ models });

            const chain = service.getChain();
            expect(chain).toHaveLength(2);
            expect(chain[0]!.provider).toBe('openai');
            expect(chain[1]!.provider).toBe('anthropic');
        });

        it('should sort models by priority', () => {
            const models: FallbackModelConfig[] = [
                { provider: 'anthropic', model: 'claude-3', priority: 3, enabled: true },
                { provider: 'openai', model: 'gpt-4', priority: 1, enabled: true },
                { provider: 'groq', model: 'llama', priority: 2, enabled: true }
            ];

            service.configure({ models });

            const chain = service.getChain();
            expect(chain[0]!.priority).toBe(1);
            expect(chain[1]!.priority).toBe(2);
            expect(chain[2]!.priority).toBe(3);
        });
    });

    describe('addModel', () => {
        it('should add a new model to the chain', () => {
            service.addModel({ provider: 'openai', model: 'gpt-4', priority: 1, enabled: true });

            const chain = service.getChain();
            expect(chain).toHaveLength(1);
            expect(chain[0]!.provider).toBe('openai');
        });

        it('should update existing model if already present', () => {
            service.addModel({ provider: 'openai', model: 'gpt-4', priority: 1, enabled: true });
            service.addModel({ provider: 'openai', model: 'gpt-4', priority: 2, enabled: false });

            const chain = service.getChain();
            expect(chain).toHaveLength(1);
            expect(chain[0]!.priority).toBe(2);
            expect(chain[0]!.enabled).toBe(false);
        });
    });

    describe('removeModel', () => {
        it('should remove a model from the chain', () => {
            service.addModel({ provider: 'openai', model: 'gpt-4', priority: 1, enabled: true });
            service.addModel({ provider: 'anthropic', model: 'claude-3', priority: 2, enabled: true });

            const removed = service.removeModel('openai', 'gpt-4');

            expect(removed).toBe(true);
            expect(service.getChain()).toHaveLength(1);
        });

        it('should return false if model not found', () => {
            const removed = service.removeModel('nonexistent', 'model');
            expect(removed).toBe(false);
        });
    });
});

describe('ModelFallbackService - Execution Flow', () => {
    describe('executeWithFallback', () => {
        it('should return success on first attempt if handler succeeds', async () => {
            service.addModel({ provider: 'openai', model: 'gpt-4', priority: 1, enabled: true });

            const mockMessage: Message = { id: 'm1', role: 'assistant', content: 'Hello!', timestamp: new Date() };
            const chatHandler: ChatHandler = vi.fn().mockResolvedValue(mockMessage);

            const result = await service.executeWithFallback(
                [{ id: 'u1', role: 'user', content: 'Hi', timestamp: new Date() }],
                chatHandler
            );

            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockMessage);
            expect(result.finalProvider).toBe('openai');
            expect(result.attempts).toHaveLength(1);
        });

        it('should fallback to next model on failure', async () => {
            service.configure({
                models: [
                    { provider: 'openai', model: 'gpt-4', priority: 1, enabled: true, maxRetries: 1 },
                    { provider: 'anthropic', model: 'claude-3', priority: 2, enabled: true, maxRetries: 1 }
                ]
            });

            const mockMessage: Message = { id: 'm2', role: 'assistant', content: 'Hello from Claude!', timestamp: new Date() };
            const chatHandler: ChatHandler = vi.fn()
                .mockRejectedValueOnce(new Error('OpenAI failed'))
                .mockResolvedValueOnce(mockMessage);

            const result = await service.executeWithFallback(
                [{ id: 'u2', role: 'user', content: 'Hi', timestamp: new Date() }],
                chatHandler
            );

            expect(result.success).toBe(true);
            expect(result.finalProvider).toBe('anthropic');
            expect(result.attempts).toHaveLength(2);
        });

        it('should retry failed attempts within same model', async () => {
            service.configure({
                models: [
                    { provider: 'openai', model: 'gpt-4', priority: 1, enabled: true, maxRetries: 3, retryDelayMs: 10 }
                ]
            });

            const mockMessage: Message = { id: 'm3', role: 'assistant', content: 'Success on retry!', timestamp: new Date() };
            const chatHandler: ChatHandler = vi.fn()
                .mockRejectedValueOnce(new Error('Fail 1'))
                .mockRejectedValueOnce(new Error('Fail 2'))
                .mockResolvedValueOnce(mockMessage);

            const result = await service.executeWithFallback(
                [{ id: 'u4', role: 'user', content: 'Hi', timestamp: new Date() }],
                chatHandler
            );

            expect(result.success).toBe(true);
            expect(result.attempts).toHaveLength(3);
        });
    });
});

describe('ModelFallbackService - Resilience & Monitoring', () => {
    describe('circuit breaker', () => {
        it('should open circuit after threshold failures', async () => {
            service.configure({
                models: [
                    { provider: 'openai', model: 'gpt-4', priority: 1, enabled: true, maxRetries: 3 }
                ],
                circuitBreaker: { enabled: true, failureThreshold: 3, resetTimeoutMs: 60000 }
            });

            const chatHandler: ChatHandler = vi.fn().mockRejectedValue(new Error('Always fails'));
            await service.executeWithFallback([{ id: 'u4', role: 'user', content: 'Hi', timestamp: new Date() }], chatHandler);

            const stats = service.getStatistics();
            expect(stats.circuitBreakerStatus['openai:gpt-4']!.isOpen).toBe(true);
        });

        it('should reset circuit breaker on success', async () => {
            service.configure({
                models: [
                    { provider: 'openai', model: 'gpt-4', priority: 1, enabled: true, maxRetries: 1 }
                ],
                circuitBreaker: { enabled: true, failureThreshold: 3, resetTimeoutMs: 60000 }
            });

            const mockMessage: Message = { id: 'm-success', role: 'assistant', content: 'Success!', timestamp: new Date() };
            const chatHandler: ChatHandler = vi.fn()
                .mockRejectedValueOnce(new Error('Fail'))
                .mockResolvedValue(mockMessage);

            await service.executeWithFallback([{ id: 'u4', role: 'user', content: 'Hi', timestamp: new Date() }], chatHandler);
            await service.executeWithFallback([{ id: 'u4', role: 'user', content: 'Hi', timestamp: new Date() }], chatHandler);

            const stats = service.getStatistics();
            expect(stats.circuitBreakerStatus['openai:gpt-4']!.failures).toBe(0);
        });
    });

    describe('statistics and history', () => {
        it('should track attempt statistics', async () => {
            service.addModel({ provider: 'openai', model: 'gpt-4', priority: 1, enabled: true });
            const chatHandler = vi.fn().mockResolvedValue({ id: 'm', role: 'assistant', content: 'H', timestamp: new Date() });

            await service.executeWithFallback([{ id: 'u', role: 'user', content: 'H', timestamp: new Date() }], chatHandler);

            const stats = service.getStatistics();
            expect(stats.totalAttempts).toBe(1);
            expect(stats.byModel['openai:gpt-4']!.successes).toBe(1);
        });

        it('should maintain attempt history', async () => {
            service.addModel({ provider: 'openai', model: 'gpt-4', priority: 1, enabled: true });
            const chatHandler = vi.fn().mockResolvedValue({ id: 'm', role: 'assistant', content: 'H', timestamp: new Date() });

            await service.executeWithFallback([{ id: 'u', role: 'user', content: 'H', timestamp: new Date() }], chatHandler);

            const history = service.getAttemptHistory();
            expect(history).toHaveLength(1);
            expect(history[0]!.success).toBe(true);
        });
    });
});

