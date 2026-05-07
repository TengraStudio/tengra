/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { NativeMcpPlugin } from '@main/mcp/plugin-base';
import { describe, expect, it, vi } from 'vitest';

describe('NativeMcpPlugin', () => {
    it('preserves native proxy result under data for tool executor consumption', async () => {
        const proxyService = {
            makeRequest: vi.fn().mockResolvedValue({
                success: true,
                result: {
                    output: 'created app',
                    session_id: 'terminal-1',
                },
            }),
            getRuntimeProxyApiKey: vi.fn().mockResolvedValue('proxy-key'),
            getEmbeddedProxyStatus: vi.fn().mockReturnValue({ running: true }),
        };
        const plugin = new NativeMcpPlugin(
            proxyService as never,
            'terminal',
            'Terminal tools',
            [{ name: 'run_command', description: 'Run command' }]
        );

        const result = await plugin.dispatch('run_command', { command: 'echo ok' });

        expect(result).toEqual({
            success: true,
            data: {
                output: 'created app',
                session_id: 'terminal-1',
            },
            service: 'terminal',
            action: 'run_command',
        });
    });
});

