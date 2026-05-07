/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { PluginChannel } from '@main/mcp/plugin-channel';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

describe('PluginChannel', () => {
    let channel: PluginChannel;

    beforeEach(() => {
        channel = new PluginChannel({
            maxMessageSize: 1024,
            maxQueueDepth: 5,
            messageTimeoutMs: 500,
        });
    });

    describe('send and subscribe', () => {
        it('should deliver messages to subscribed plugins', () => {
            const handler = vi.fn();
            channel.subscribe('pluginB', 'data:update', handler);

            const sent = channel.send({ from: 'pluginA', to: 'pluginB', type: 'data:update', payload: { key: 'value' } });

            expect(sent).toBe(true);
            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler.mock.calls[0][0]).toMatchObject({
                from: 'pluginA',
                to: 'pluginB',
                type: 'data:update',
                payload: { key: 'value' },
            });
        });

        it('should queue messages for the target plugin', () => {
            channel.send({ from: 'pluginA', to: 'pluginB', type: 'notify', payload: { n: 1 } });
            channel.send({ from: 'pluginA', to: 'pluginB', type: 'notify', payload: { n: 2 } });

            const queued = channel.drainQueue('pluginB');
            expect(queued).toHaveLength(2);
            expect(queued[0].payload).toEqual({ n: 1 });
            expect(queued[1].payload).toEqual({ n: 2 });
        });

        it('should not deliver to unsubscribed plugins', () => {
            const handler = vi.fn();
            channel.subscribe('pluginB', 'data:update', handler);
            channel.unsubscribe('pluginB', 'data:update');

            channel.send({ from: 'pluginA', to: 'pluginB', type: 'data:update', payload: {} });
            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('queue depth limit', () => {
        it('should drop oldest messages when queue is full', () => {
            for (let i = 0; i < 7; i++) {
                channel.send({ from: 'A', to: 'B', type: 'test', payload: { i } });
            }

            expect(channel.getQueueDepth('B')).toBe(5);
            const messages = channel.drainQueue('B');
            expect((messages[0].payload as Record<string, TestValue>).i).toBe(2);
        });

        it('should report correct queue depth', () => {
            expect(channel.getQueueDepth('IconX')).toBe(0);
            channel.send({ from: 'A', to: 'IconX', type: 'ping', payload: {} });
            expect(channel.getQueueDepth('IconX')).toBe(1);
        });
    });

    describe('message size limit', () => {
        it('should reject messages exceeding max size', () => {
            const largePayload: Record<string, TestValue> = { data: 'x'.repeat(2000) };
            const sent = channel.send({ from: 'A', to: 'B', type: 'big', payload: largePayload });
            expect(sent).toBe(false);
        });
    });

    describe('request/response', () => {
        it('should correlate request and response via correlationId', async () => {
            channel.subscribe('pluginB', 'query', (msg) => {
                channel.respond(msg.correlationId, {
                    from: 'pluginB',
                    to: 'pluginA',
                    type: 'query:response',
                    payload: { answer: 42 },
                });
            });

            const response = await channel.request({
                from: 'pluginA',
                to: 'pluginB',
                type: 'query',
                payload: { question: 'meaning' },
            });

            expect(response.payload).toEqual({ answer: 42 });
            expect(response.correlationId).toBeDefined();
        });

        it('should timeout if no response received', async () => {
            await expect(
                channel.request({ from: 'A', to: 'B', type: 'slow', payload: {} })
            ).rejects.toThrow('timed out');
        });
    });

    describe('capabilities', () => {
        it('should advertise and query plugin capabilities', () => {
            channel.advertiseCapabilities('pluginA', ['data:query', 'data:update']);
            channel.advertiseCapabilities('pluginB', ['data:query', 'file:read']);

            const dataQueryPlugins = channel.getCapablePlugins('data:query');
            expect(dataQueryPlugins).toContain('pluginA');
            expect(dataQueryPlugins).toContain('pluginB');

            const fileReadPlugins = channel.getCapablePlugins('file:read');
            expect(fileReadPlugins).toEqual(['pluginB']);
        });

        it('should return empty array for unknown capability', () => {
            expect(channel.getCapablePlugins('unknown:type')).toEqual([]);
        });
    });

    describe('clear', () => {
        it('should remove all subscriptions, queues, and capabilities', () => {
            channel.subscribe('A', 'test', vi.fn());
            channel.send({ from: 'IconX', to: 'A', type: 'test', payload: {} });
            channel.advertiseCapabilities('A', ['test']);

            channel.clear();

            expect(channel.getQueueDepth('A')).toBe(0);
            expect(channel.getCapablePlugins('test')).toEqual([]);
        });
    });
});

