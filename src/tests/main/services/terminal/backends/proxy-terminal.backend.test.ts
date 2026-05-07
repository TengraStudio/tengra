/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { AuthService } from '@main/services/security/auth.service';
import { ProxyTerminalBackend } from '@main/services/terminal/backends/proxy-terminal.backend';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';

vi.mock('axios');

const mockOn = vi.fn();
const mockSend = vi.fn();
const mockClose = vi.fn();

vi.mock('ws', () => {
    return {
        WebSocket: class {
            static OPEN = 1;
            on = mockOn;
            send = mockSend;
            close = mockClose;
            readyState = 1;
        }
    };
});

describe('ProxyTerminalBackend', () => {
    let backend: ProxyTerminalBackend;
    let mockAuthService: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAuthService = {
            getActiveToken: vi.fn().mockResolvedValue('test-api-key'),
        };
        backend = new ProxyTerminalBackend(mockAuthService as AuthService);
    });

    describe('isAvailable', () => {
        it('should return true if proxy health check succeeds', async () => {
            (axios.get as any).mockResolvedValue({ status: 200 });
            const available = await backend.isAvailable();
            expect(available).toBe(true);
            expect(axios.get).toHaveBeenCalledWith('http://127.0.0.1:8317/health', expect.any(Object));
        });

        it('should return false if proxy health check fails', async () => {
            (axios.get as any).mockRejectedValue(new Error('Network error'));
            const available = await backend.isAvailable();
            expect(available).toBe(false);
        });
    });

    describe('create', () => {
        it('should create a terminal session and connect via WebSocket', async () => {
            const sessionId = 'session-123';
            (axios.post as any).mockResolvedValue({
                data: { id: sessionId }
            });

            const onData = vi.fn();
            const onExit = vi.fn();

            const process = await backend.create({
                id: 'terminal-1',
                shell: 'bash',
                args: [],
                cwd: '/tmp',
                onData,
                onExit,
                cols: 80,
                rows: 24,
                env: {}
            });

            expect(axios.post).toHaveBeenCalledWith(
                'http://127.0.0.1:8317/v0/terminal',
                expect.objectContaining({ shell: 'bash', cwd: '/tmp' }),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test-api-key'
                    })
                })
            );

            expect(process).toBeDefined();
            expect(mockOn).toHaveBeenCalledWith('message', expect.any(Function));
            expect(mockOn).toHaveBeenCalledWith('close', expect.any(Function));
        });

        it('should throw error if session creation fails', async () => {
            (axios.post as any).mockResolvedValue({ data: {} }); // No ID

            await expect(backend.create({
                id: 'terminal-2',
                shell: 'bash',
                args: [],
                cwd: '/tmp',
                onData: vi.fn(),
                onExit: vi.fn(),
                cols: 80,
                rows: 24,
                env: {}
            })).rejects.toThrow('Failed to create terminal session in proxy');
        });

        it('should send data through WebSocket', async () => {
            const sessionId = 'session-123';
            (axios.post as any).mockResolvedValue({ data: { id: sessionId } });
            
            const process = await backend.create({
                id: 'terminal-3',
                shell: 'bash',
                args: [],
                cwd: '/tmp',
                onData: vi.fn(),
                onExit: vi.fn(),
                cols: 80,
                rows: 24,
                env: {}
            });

            process.write('ls -la\n');
            expect(mockSend).toHaveBeenCalledWith('ls -la\n');
        });

        it('should close WebSocket on kill', async () => {
            const sessionId = 'session-123';
            (axios.post as any).mockResolvedValue({ data: { id: sessionId } });
            
            const process = await backend.create({
                id: 'terminal-4',
                shell: 'bash',
                args: [],
                cwd: '/tmp',
                onData: vi.fn(),
                onExit: vi.fn(),
                cols: 80,
                rows: 24,
                env: {}
            });

            process.kill();
            expect(mockClose).toHaveBeenCalled();
        });
    });
});

