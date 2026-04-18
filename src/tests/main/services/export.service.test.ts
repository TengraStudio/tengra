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
 * Unit tests for ExportService
 */
import { ExportService } from '@main/services/data/export.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Chat, Message } from '@/types/chat';

// Mock the logger
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// Mock electron
vi.mock('electron', () => ({
    dialog: {
        showSaveDialog: vi.fn()
    },
    BrowserWindow: class { }
}));

// Mock fs
vi.mock('fs', () => ({
    writeFileSync: vi.fn()
}));

let service: ExportService;
let mockChat: Chat;

beforeEach(() => {
    service = new ExportService();

    mockChat = {
        id: 'test-chat-1',
        title: 'Test Chat',
        model: 'gpt-4',
        messages: [
            {
                id: 'msg-1',
                role: 'user',
                content: 'Hello, how are you?',
                timestamp: new Date('2024-01-01T10:00:00Z')
            } as Message,
            {
                id: 'msg-2',
                role: 'assistant',
                content: 'I am doing well, thank you!',
                timestamp: new Date('2024-01-01T10:00:05Z')
            } as Message
        ],
        createdAt: new Date('2024-01-01T09:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:05Z')
    };
});

describe('ExportService - Basic Formats', () => {
    describe('markdown format', () => {
        it('should generate markdown with title', () => {
            const content = service.getExportContent(mockChat, { format: 'markdown' });
            expect(content).toContain('# Test Chat');
        });

        it('should include messages', () => {
            const content = service.getExportContent(mockChat, { format: 'markdown' });
            expect(content).toContain('Hello, how are you?');
            expect(content).toContain('I am doing well, thank you!');
        });

        it('should include metadata when enabled', () => {
            const content = service.getExportContent(mockChat, {
                format: 'markdown',
                includeMetadata: true
            });
            expect(content).toContain('**Model:** gpt-4');
            expect(content).toContain('**Messages:** 2');
        });

        it('should include timestamps when enabled', () => {
            const content = service.getExportContent(mockChat, {
                format: 'markdown',
                includeTimestamps: true
            });
            expect(content).toContain('2024');
        });

        it('should include role labels', () => {
            const content = service.getExportContent(mockChat, { format: 'markdown' });
            expect(content).toContain('## You');
            expect(content).toContain('## Assistant');
        });

        it('should include export footer', () => {
            const content = service.getExportContent(mockChat, { format: 'markdown' });
            expect(content).toContain('*Exported from Tengra');
        });
    });

    describe('txt format', () => {
        it('should generate plain text', () => {
            const content = service.getExportContent(mockChat, { format: 'txt' });
            expect(content).toContain('Test Chat');
            expect(content).not.toContain('<');
            expect(content).not.toContain('#');
        });

        it('should include role labels in uppercase', () => {
            const content = service.getExportContent(mockChat, { format: 'txt' });
            expect(content).toContain('[YOU]');
            expect(content).toContain('[ASSISTANT]');
        });

        it('should include separator lines', () => {
            const content = service.getExportContent(mockChat, { format: 'txt' });
            expect(content).toContain('═══');
            expect(content).toContain('───');
        });
    });
});

describe('ExportService - Web & API Formats', () => {
    describe('html format', () => {
        it('should generate valid HTML structure', () => {
            const content = service.getExportContent(mockChat, { format: 'html' });
            expect(content).toContain('<!DOCTYPE html>');
            expect(content).toContain('<html lang="en">');
            expect(content).toContain('</html>');
        });

        it('should include title in HTML', () => {
            const content = service.getExportContent(mockChat, { format: 'html' });
            expect(content).toContain('<title>Test Chat</title>');
            expect(content).toContain('<h1>Test Chat</h1>');
        });

        it('should include styled messages', () => {
            const content = service.getExportContent(mockChat, { format: 'html' });
            expect(content).toContain('class="message user"');
            expect(content).toContain('class="message assistant"');
        });

        it('should include CSS styles', () => {
            const content = service.getExportContent(mockChat, { format: 'html' });
            expect(content).toContain('<style>');
            expect(content).toContain('.message');
            expect(content).toContain('</style>');
        });

        it('should escape HTML in content', () => {
            const chatWithHtml: Chat = {
                ...mockChat,
                messages: [{
                    id: 'msg-html',
                    role: 'user',
                    content: 'Test <script>alert("xss")</script>',
                    timestamp: new Date()
                } as Message]
            };
            const content = service.getExportContent(chatWithHtml, { format: 'html' });
            expect(content).not.toContain('<script>');
            expect(content).toContain('&lt;script&gt;');
        });
    });

    describe('json format', () => {
        it('should generate valid JSON', () => {
            const content = service.getExportContent(mockChat, { format: 'json' });
            expect(() => JSON.parse(content)).not.toThrow();
        });

        it('should include chat metadata', () => {
            const content = service.getExportContent(mockChat, { format: 'json' });
            const data = JSON.parse(content);
            expect(data.title).toBe('Test Chat');
            expect(data.model).toBe('gpt-4');
            expect(data.messageCount).toBe(2);
        });

        it('should include messages', () => {
            const content = service.getExportContent(mockChat, { format: 'json' });
            const data = JSON.parse(content);
            expect(data.messages).toHaveLength(2);
            expect(data.messages[0].role).toBe('user');
            expect(data.messages[1].role).toBe('assistant');
        });

        it('should include export timestamp', () => {
            const content = service.getExportContent(mockChat, { format: 'json' });
            const data = JSON.parse(content);
            expect(data.exportedAt).toBeDefined();
        });
    });
});

describe('ExportService - Specialized Content', () => {
    describe('system messages', () => {
        it('should exclude system messages by default', () => {
            const chatWithSystem: Chat = {
                ...mockChat,
                messages: [
                    { id: 'sys', role: 'system', content: 'System prompt', timestamp: new Date() } as Message,
                    ...mockChat.messages
                ]
            };
            const content = service.getExportContent(chatWithSystem, { format: 'markdown' });
            expect(content).not.toContain('System prompt');
        });

        it('should include system messages when enabled', () => {
            const chatWithSystem: Chat = {
                ...mockChat,
                messages: [
                    { id: 'sys', role: 'system', content: 'System prompt', timestamp: new Date() } as Message,
                    ...mockChat.messages
                ]
            };
            const content = service.getExportContent(chatWithSystem, {
                format: 'markdown',
                includeSystemMessages: true
            });
            expect(content).toContain('System prompt');
        });
    });

    describe('tool calls', () => {
        it('should include tool calls when enabled', () => {
            const chatWithTools: Chat = {
                ...mockChat,
                messages: [{
                    id: 'msg-tool',
                    role: 'assistant',
                    content: 'Let me search for that.',
                    timestamp: new Date(),
                    toolCalls: [{
                        id: 'call-1',
                        type: 'function',
                        function: {
                            name: 'search',
                            arguments: '{"query": "test"}'
                        }
                    }]
                } as Message]
            };
            const content = service.getExportContent(chatWithTools, {
                format: 'markdown',
                includeToolCalls: true
            });
            expect(content).toContain('Tool Calls');
            expect(content).toContain('search');
        });
    });

    describe('custom title', () => {
        it('should use custom title when provided', () => {
            const content = service.getExportContent(mockChat, {
                format: 'markdown',
                title: 'Custom Export Title'
            });
            expect(content).toContain('# Custom Export Title');
        });
    });

    describe('multipart content', () => {
        it('should handle array content', () => {
            const chatWithArrayContent: Chat = {
                ...mockChat,
                messages: [{
                    id: 'msg-array',
                    role: 'user',
                    content: [
                        { type: 'text', text: 'First part' },
                        { type: 'text', text: 'Second part' }
                    ],
                    timestamp: new Date()
                } as Message]
            };
            const content = service.getExportContent(chatWithArrayContent, { format: 'markdown' });
            expect(content).toContain('First part');
            expect(content).toContain('Second part');
        });
    });
});

