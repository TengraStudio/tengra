/**
 * Comprehensive unit tests for ExportService
 * Covers: all export formats, options, edge cases, error handling,
 * exportChat flow, exportToPDF flow, and helper methods.
 */
import * as os from 'os';
import * as path from 'path';

import { ExportFormat, ExportOptions, ExportService } from '@main/services/data/export.service';
import { Chat, Message, ToolCall } from '@shared/types/chat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('electron', () => ({
    dialog: { showSaveDialog: vi.fn() },
    BrowserWindow: class {}
}));

vi.mock('fs', () => ({
    promises: { writeFile: vi.fn() }
}));

import { promises as fs } from 'fs';

import { dialog } from 'electron';

const mockShowSaveDialog = dialog.showSaveDialog as ReturnType<typeof vi.fn>;
const mockWriteFile = fs.writeFile as ReturnType<typeof vi.fn>;
const TEST_EXPORT_ROOT = path.join(os.tmpdir(), 'tengra-tests', 'exports');
const exportPath = (fileName: string): string => path.join(TEST_EXPORT_ROOT, fileName);

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMessage(overrides: Partial<Message> & Pick<Message, 'id' | 'role' | 'content'>): Message {
    return {
        timestamp: new Date('2024-01-15T12:00:00Z'),
        ...overrides
    } as Message;
}

function createChat(overrides: Partial<Chat> = {}): Chat {
    return {
        id: 'chat-1',
        title: 'Test Chat',
        model: 'gpt-4',
        messages: [
            createMessage({ id: 'msg-1', role: 'user', content: 'Hello!' }),
            createMessage({
                id: 'msg-2',
                role: 'assistant',
                content: 'Hi there!',
                timestamp: new Date('2024-01-15T12:00:05Z')
            })
        ],
        createdAt: new Date('2024-01-15T11:00:00Z'),
        updatedAt: new Date('2024-01-15T12:00:05Z'),
        ...overrides
    };
}

const TOOL_CALL_FIXTURE: ToolCall = {
    id: 'tc-1',
    type: 'function',
    function: { name: 'web_search', arguments: '{"q":"vitest"}' }
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ExportService', () => {
    let service: ExportService;
    let chat: Chat;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ExportService();
        chat = createChat();
    });

    // ── getExportContent – Markdown ──────────────────────────────────────

    describe('getExportContent – markdown', () => {
        const opts: ExportOptions = { format: 'markdown' };

        it('should start with the chat title as h1', () => {
            const md = service.getExportContent(chat, opts);
            expect(md).toMatch(/^# Test Chat/);
        });

        it('should render role labels as h2 headings', () => {
            const md = service.getExportContent(chat, opts);
            expect(md).toContain('## You');
            expect(md).toContain('## Assistant');
        });

        it('should include message content', () => {
            const md = service.getExportContent(chat, opts);
            expect(md).toContain('Hello!');
            expect(md).toContain('Hi there!');
        });

        it('should include Tengra export footer', () => {
            const md = service.getExportContent(chat, opts);
            expect(md).toContain('*Exported from Tengra');
        });

        it('should include metadata by default', () => {
            const md = service.getExportContent(chat, opts);
            expect(md).toContain('**Model:** gpt-4');
            expect(md).toContain('**Messages:** 2');
        });

        it('should omit metadata when disabled', () => {
            const md = service.getExportContent(chat, { format: 'markdown', includeMetadata: false });
            expect(md).not.toContain('**Model:**');
        });

        it('should include timestamps by default', () => {
            const md = service.getExportContent(chat, opts);
            expect(md).toContain('2024');
        });

        it('should omit timestamps when disabled', () => {
            const md = service.getExportContent(chat, { format: 'markdown', includeTimestamps: false });
            // Role headings should appear without italic timestamps
            const lines = md.split('\n').filter(l => l.startsWith('## '));
            for (const line of lines) {
                expect(line).not.toContain('_(');
            }
        });

        it('should render tool calls section when message has toolCalls', () => {
            const chatWithTools = createChat({
                messages: [
                    createMessage({
                        id: 'msg-t',
                        role: 'assistant',
                        content: 'Searching…',
                        toolCalls: [TOOL_CALL_FIXTURE]
                    })
                ]
            });
            const md = service.getExportContent(chatWithTools, { format: 'markdown', includeToolCalls: true });
            expect(md).toContain('**Tool Calls:**');
            expect(md).toContain('`web_search`');
        });

        it('should omit tool calls when disabled', () => {
            const chatWithTools = createChat({
                messages: [
                    createMessage({
                        id: 'msg-t',
                        role: 'assistant',
                        content: 'Searching…',
                        toolCalls: [TOOL_CALL_FIXTURE]
                    })
                ]
            });
            const md = service.getExportContent(chatWithTools, { format: 'markdown', includeToolCalls: false });
            expect(md).not.toContain('**Tool Calls:**');
        });

        it('should render tool results when present as array', () => {
            const chatWithResults = createChat({
                messages: [
                    createMessage({
                        id: 'msg-tr',
                        role: 'assistant',
                        content: 'Result',
                        toolResults: [{ name: 'web_search', result: 'found data', toolCallId: 'tc-1' }]
                    })
                ]
            });
            const md = service.getExportContent(chatWithResults, { format: 'markdown', includeToolCalls: true });
            expect(md).toContain('**Tool Results:**');
            expect(md).toContain('`web_search`');
        });

        it('should render tool results when stored as JSON string', () => {
            const chatWithStringResults = createChat({
                messages: [
                    createMessage({
                        id: 'msg-trs',
                        role: 'assistant',
                        content: 'Result',
                        toolResults: JSON.stringify([{ name: 'calc', result: 42, toolCallId: 'tc-2' }])
                    })
                ]
            });
            const md = service.getExportContent(chatWithStringResults, { format: 'markdown', includeToolCalls: true });
            expect(md).toContain('**Tool Results:**');
            expect(md).toContain('`calc`');
        });
    });

    // ── getExportContent – HTML ──────────────────────────────────────────

    describe('getExportContent – html', () => {
        const opts: ExportOptions = { format: 'html' };

        it('should produce a full HTML document', () => {
            const html = service.getExportContent(chat, opts);
            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('</html>');
        });

        it('should set the document title', () => {
            const html = service.getExportContent(chat, opts);
            expect(html).toContain('<title>Test Chat</title>');
        });

        it('should render user and assistant message divs', () => {
            const html = service.getExportContent(chat, opts);
            expect(html).toContain('class="message user"');
            expect(html).toContain('class="message assistant"');
        });

        it('should contain CSS variables', () => {
            const html = service.getExportContent(chat, opts);
            expect(html).toContain('--bg-primary');
        });

        it('should escape HTML special characters in content', () => {
            const xssChat = createChat({
                messages: [
                    createMessage({ id: 'xss', role: 'user', content: '<img src=x onerror=alert(1)>' })
                ]
            });
            const html = service.getExportContent(xssChat, opts);
            expect(html).not.toContain('<img src=x');
            expect(html).toContain('&lt;img');
        });

        it('should escape HTML in title', () => {
            const badTitle = createChat({ title: 'Chat <script>' });
            const html = service.getExportContent(badTitle, opts);
            expect(html).toContain('&lt;script&gt;');
            expect(html).not.toContain('<script>');
        });

        it('should include metadata section when enabled', () => {
            const html = service.getExportContent(chat, { format: 'html', includeMetadata: true });
            expect(html).toContain('class="metadata"');
            expect(html).toContain('gpt-4');
        });

        it('should exclude metadata section when disabled', () => {
            const html = service.getExportContent(chat, { format: 'html', includeMetadata: false });
            expect(html).not.toContain('class="metadata"');
        });

        it('should include timestamp spans when enabled', () => {
            const html = service.getExportContent(chat, { format: 'html', includeTimestamps: true });
            expect(html).toContain('class="timestamp"');
        });

        it('should omit timestamp spans when disabled', () => {
            const html = service.getExportContent(chat, { format: 'html', includeTimestamps: false });
            expect(html).not.toContain('class="timestamp"');
        });

        it('should render tool calls in HTML when present', () => {
            const toolChat = createChat({
                messages: [
                    createMessage({
                        id: 'mt',
                        role: 'assistant',
                        content: 'Using tool',
                        toolCalls: [TOOL_CALL_FIXTURE]
                    })
                ]
            });
            const html = service.getExportContent(toolChat, { format: 'html', includeToolCalls: true });
            expect(html).toContain('class="tool-calls"');
            expect(html).toContain('web_search');
        });

        it('should omit tool calls div when disabled', () => {
            const toolChat = createChat({
                messages: [
                    createMessage({
                        id: 'mt',
                        role: 'assistant',
                        content: 'Using tool',
                        toolCalls: [TOOL_CALL_FIXTURE]
                    })
                ]
            });
            const html = service.getExportContent(toolChat, { format: 'html', includeToolCalls: false });
            expect(html).not.toContain('class="tool-calls"');
        });

        it('should include footer', () => {
            const html = service.getExportContent(chat, opts);
            expect(html).toContain('class="footer"');
            expect(html).toContain('Exported from Tengra');
        });
    });

    // ── getExportContent – JSON ──────────────────────────────────────────

    describe('getExportContent – json', () => {
        const opts: ExportOptions = { format: 'json' };

        it('should produce valid JSON', () => {
            const json = service.getExportContent(chat, opts);
            expect(() => JSON.parse(json)).not.toThrow();
        });

        it('should include top-level fields', () => {
            const data = JSON.parse(service.getExportContent(chat, opts)) as Record<string, TestValue>;
            expect(data['title']).toBe('Test Chat');
            expect(data['model']).toBe('gpt-4');
            expect(data['messageCount']).toBe(2);
            expect(data['exportedAt']).toBeDefined();
        });

        it('should include message role and content', () => {
            const data = JSON.parse(service.getExportContent(chat, opts)) as { messages: { role: string; content: string }[] };
            expect(data.messages[0]!.role).toBe('user');
            expect(data.messages[0]!.content).toBe('Hello!');
        });

        it('should include timestamps by default', () => {
            const data = JSON.parse(service.getExportContent(chat, opts)) as { messages: { timestamp?: TestValue }[] };
            expect(data.messages[0]!.timestamp).toBeDefined();
        });

        it('should omit timestamps when disabled', () => {
            const data = JSON.parse(
                service.getExportContent(chat, { format: 'json', includeTimestamps: false })
            ) as { messages: { timestamp?: TestValue }[] };
            expect(data.messages[0]!.timestamp).toBeUndefined();
        });

        it('should include provider/model when metadata enabled', () => {
            const chatWithProvider = createChat({
                messages: [
                    createMessage({ id: 'p1', role: 'user', content: 'Hi', provider: 'openai', model: 'gpt-4' })
                ]
            });
            const data = JSON.parse(
                service.getExportContent(chatWithProvider, { format: 'json', includeMetadata: true })
            ) as { messages: { provider?: string; model?: string }[] };
            expect(data.messages[0]!.provider).toBe('openai');
            expect(data.messages[0]!.model).toBe('gpt-4');
        });

        it('should omit provider/model when metadata disabled', () => {
            const chatWithProvider = createChat({
                messages: [
                    createMessage({ id: 'p1', role: 'user', content: 'Hi', provider: 'openai', model: 'gpt-4' })
                ]
            });
            const data = JSON.parse(
                service.getExportContent(chatWithProvider, { format: 'json', includeMetadata: false })
            ) as { messages: { provider?: string; model?: string }[] };
            expect(data.messages[0]!.provider).toBeUndefined();
        });

        it('should include toolCalls when enabled', () => {
            const toolChat = createChat({
                messages: [
                    createMessage({
                        id: 'tc',
                        role: 'assistant',
                        content: 'Using tool',
                        toolCalls: [TOOL_CALL_FIXTURE]
                    })
                ]
            });
            const data = JSON.parse(
                service.getExportContent(toolChat, { format: 'json', includeToolCalls: true })
            ) as { messages: { toolCalls?: TestValue[] }[] };
            expect(data.messages[0]!.toolCalls).toHaveLength(1);
        });

        it('should omit toolCalls when disabled', () => {
            const toolChat = createChat({
                messages: [
                    createMessage({
                        id: 'tc',
                        role: 'assistant',
                        content: 'Using tool',
                        toolCalls: [TOOL_CALL_FIXTURE]
                    })
                ]
            });
            const data = JSON.parse(
                service.getExportContent(toolChat, { format: 'json', includeToolCalls: false })
            ) as { messages: { toolCalls?: TestValue[] }[] };
            expect(data.messages[0]!.toolCalls).toBeUndefined();
        });

        it('should filter system messages by default', () => {
            const chatSys = createChat({
                messages: [
                    createMessage({ id: 's1', role: 'system', content: 'You are helpful' }),
                    createMessage({ id: 'u1', role: 'user', content: 'Hi' })
                ]
            });
            const data = JSON.parse(service.getExportContent(chatSys, opts)) as { messages: { role: string }[]; messageCount: number };
            expect(data.messageCount).toBe(1);
            expect(data.messages.every(m => m.role !== 'system')).toBe(true);
        });

        it('should include system messages when enabled', () => {
            const chatSys = createChat({
                messages: [
                    createMessage({ id: 's1', role: 'system', content: 'You are helpful' }),
                    createMessage({ id: 'u1', role: 'user', content: 'Hi' })
                ]
            });
            const data = JSON.parse(
                service.getExportContent(chatSys, { format: 'json', includeSystemMessages: true })
            ) as { messages: { role: string }[]; messageCount: number };
            expect(data.messageCount).toBe(2);
            expect(data.messages[0]!.role).toBe('system');
        });
    });

    // ── getExportContent – Plain text ────────────────────────────────────

    describe('getExportContent – txt', () => {
        const opts: ExportOptions = { format: 'txt' };

        it('should include the title in the header', () => {
            const txt = service.getExportContent(chat, opts);
            expect(txt).toContain('Test Chat');
        });

        it('should use box-drawing separator characters', () => {
            const txt = service.getExportContent(chat, opts);
            expect(txt).toContain('═══');
        });

        it('should render role labels in uppercase brackets', () => {
            const txt = service.getExportContent(chat, opts);
            expect(txt).toContain('[YOU]');
            expect(txt).toContain('[ASSISTANT]');
        });

        it('should include metadata section by default', () => {
            const txt = service.getExportContent(chat, opts);
            expect(txt).toContain('Model: gpt-4');
            expect(txt).toContain('Messages: 2');
        });

        it('should omit metadata when disabled', () => {
            const txt = service.getExportContent(chat, { format: 'txt', includeMetadata: false });
            expect(txt).not.toContain('Model:');
        });

        it('should include timestamps by default', () => {
            const txt = service.getExportContent(chat, opts);
            // Timestamp format varies by locale, but brackets should be present
            expect(txt).toMatch(/\[YOU\]\s*\[/);
        });

        it('should omit timestamps when disabled', () => {
            const txt = service.getExportContent(chat, { format: 'txt', includeTimestamps: false });
            const lines = txt.split('\n').filter(l => l.startsWith('[YOU]'));
            for (const line of lines) {
                expect(line).toBe('[YOU]');
            }
        });

        it('should exclude system messages by default', () => {
            const chatSys = createChat({
                messages: [
                    createMessage({ id: 's', role: 'system', content: 'System prompt' }),
                    ...chat.messages
                ]
            });
            const txt = service.getExportContent(chatSys, opts);
            expect(txt).not.toContain('[SYSTEM]');
            expect(txt).not.toContain('System prompt');
        });

        it('should include system messages when enabled', () => {
            const chatSys = createChat({
                messages: [
                    createMessage({ id: 's', role: 'system', content: 'System prompt' }),
                    ...chat.messages
                ]
            });
            const txt = service.getExportContent(chatSys, { format: 'txt', includeSystemMessages: true });
            expect(txt).toContain('[SYSTEM]');
            expect(txt).toContain('System prompt');
        });

        it('should contain no HTML tags', () => {
            const txt = service.getExportContent(chat, opts);
            expect(txt).not.toMatch(/<[a-z][^>]*>/i);
        });

        it('should include export footer', () => {
            const txt = service.getExportContent(chat, opts);
            expect(txt).toContain('Exported from Tengra');
        });
    });

    // ── Edge cases & shared logic ────────────────────────────────────────

    describe('edge cases', () => {
        it('should use "Untitled Chat" when title is empty', () => {
            const noTitle = createChat({ title: '' });
            const md = service.getExportContent(noTitle, { format: 'markdown' });
            expect(md).toContain('# Untitled Chat');
        });

        it('should use custom title over chat title', () => {
            const md = service.getExportContent(chat, { format: 'markdown', title: 'Override' });
            expect(md).toContain('# Override');
            expect(md).not.toContain('# Test Chat');
        });

        it('should handle empty messages array', () => {
            const empty = createChat({ messages: [] });
            const md = service.getExportContent(empty, { format: 'markdown' });
            expect(md).toContain('# Test Chat');
            expect(md).toContain('**Messages:** 0');
        });

        it('should handle array content (multipart messages)', () => {
            const multipart = createChat({
                messages: [
                    createMessage({
                        id: 'mp',
                        role: 'user',
                        content: [
                            { type: 'text', text: 'Part A' },
                            { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } },
                            { type: 'text', text: 'Part B' }
                        ]
                    })
                ]
            });
            const md = service.getExportContent(multipart, { format: 'markdown' });
            expect(md).toContain('Part A');
            expect(md).toContain('Part B');
            // Image content parts should be filtered out
            expect(md).not.toContain('data:image');
        });

        it('should return empty string for non-string non-array content', () => {
            const odd = createChat({
                messages: [
                    createMessage({ id: 'od', role: 'user', content: undefined as never as string })
                ]
            });
            // Should not throw
            const md = service.getExportContent(odd, { format: 'markdown' });
            expect(md).toBeDefined();
        });

        it('should throw on truly unknown format in getExportContent', () => {
            expect(() => {
                service.getExportContent(chat, { format: 'pdf' as ExportFormat });
            }).toThrow('Unknown format');
        });

        it('should handle model being empty string', () => {
            const noModel = createChat({ model: '' });
            const md = service.getExportContent(noModel, { format: 'markdown' });
            expect(md).toContain('**Model:**');
        });

        it('should handle unknown role gracefully', () => {
            const unknownRole = createChat({
                messages: [
                    createMessage({ id: 'ur', role: 'tool' as Message['role'], content: 'Tool result' })
                ]
            });
            const md = service.getExportContent(unknownRole, { format: 'markdown' });
            expect(md).toContain('## tool');
        });
    });
});

describe('ExportService - file operations', () => {
    let service: ExportService;
    let chat: Chat;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ExportService();
        chat = createChat();
    });

    // ── exportChat ───────────────────────────────────────────────────────

    describe('exportChat', () => {
        const mockWindow = {
            webContents: { printToPDF: vi.fn() }
        } as never as Electron.BrowserWindow;

        beforeEach(() => {
            service.setWindow(mockWindow);
        });

        it('should return success when file is saved', async () => {
            const filePath = exportPath('export.md');
            mockShowSaveDialog.mockResolvedValue({ filePath, canceled: false });
            mockWriteFile.mockResolvedValue(undefined);

            const result = await service.exportChat(chat, { format: 'markdown' });

            expect(result.success).toBe(true);
            expect(result.path).toBe(filePath);
            expect(mockWriteFile).toHaveBeenCalledWith(filePath, expect.any(String), 'utf-8');
        });

        it('should return success:false when dialog is canceled', async () => {
            mockShowSaveDialog.mockResolvedValue({ filePath: undefined, canceled: true });

            const result = await service.exportChat(chat, { format: 'markdown' });

            expect(result.success).toBe(false);
            expect(result.path).toBeUndefined();
            expect(mockWriteFile).not.toHaveBeenCalled();
        });

        it('should return error on write failure', async () => {
            mockShowSaveDialog.mockResolvedValue({ filePath: exportPath('fail.md'), canceled: false });
            mockWriteFile.mockRejectedValue(new Error('Permission denied'));

            const result = await service.exportChat(chat, { format: 'markdown' });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Permission denied');
        });

        it('should return error for unknown format before showing dialog', async () => {
            const result = await service.exportChat(chat, { format: 'xml' as ExportFormat });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unknown format');
            expect(mockShowSaveDialog).not.toHaveBeenCalled();
        });

        it('should throw when no window is set during promptSaveFile', async () => {
            service.setWindow(null);

            const result = await service.exportChat(chat, { format: 'markdown' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('No window available');
        });

        it('should use custom title in the export', async () => {
            mockShowSaveDialog.mockResolvedValue({ filePath: exportPath('custom.md'), canceled: false });
            mockWriteFile.mockResolvedValue(undefined);

            await service.exportChat(chat, { format: 'markdown', title: 'My Export' });

            const writtenContent = mockWriteFile.mock.calls[0]![1] as string;
            expect(writtenContent).toContain('# My Export');
        });

        it('should sanitize title for filename (strips special chars)', async () => {
            mockShowSaveDialog.mockResolvedValue({ filePath: exportPath('test.json'), canceled: false });
            mockWriteFile.mockResolvedValue(undefined);

            const specialChat = createChat({ title: 'Chat: "test" <file>' });
            await service.exportChat(specialChat, { format: 'json' });

            expect(mockShowSaveDialog).toHaveBeenCalled();
            const dialogOpts = mockShowSaveDialog.mock.calls[0]![1] as { defaultPath: string };
            // Extract just the filename from the full path (which may contain C:\)
            const filename = dialogOpts.defaultPath.split(/[\\/]/).pop() ?? '';
            expect(filename).not.toContain(':');
            expect(filename).not.toContain('"');
            expect(filename).not.toContain('<');
        });

        it('should handle non-Error thrown objects', async () => {
            mockShowSaveDialog.mockResolvedValue({ filePath: exportPath('fail.md'), canceled: false });
            mockWriteFile.mockRejectedValue('string error');

            const result = await service.exportChat(chat, { format: 'markdown' });

            expect(result.success).toBe(false);
            expect(result.error).toBe('string error');
        });

        it.each<[ExportFormat, string]>([
            ['markdown', 'md'],
            ['html', 'html'],
            ['json', 'json'],
            ['txt', 'txt']
        ])('should set correct file extension for %s format', async (format, ext) => {
            mockShowSaveDialog.mockResolvedValue({ filePath: exportPath(`file.${ext}`), canceled: false });
            mockWriteFile.mockResolvedValue(undefined);

            await service.exportChat(chat, { format });

            const dialogOpts = mockShowSaveDialog.mock.calls[0]![1] as {
                defaultPath: string;
                filters: { extensions: string[] }[];
            };
            expect(dialogOpts.defaultPath).toContain(`.${ext}`);
            expect(dialogOpts.filters[0]!.extensions).toContain(ext);
        });
    });

    // ── exportToPDF ──────────────────────────────────────────────────────

    describe('exportToPDF', () => {
        const mockPrintToPDF = vi.fn();
        const mockWindow = {
            webContents: { printToPDF: mockPrintToPDF }
        } as never as Electron.BrowserWindow;

        beforeEach(() => {
            service.setWindow(mockWindow);
        });

        it('should return error when no window is set', async () => {
            service.setWindow(null);
            const result = await service.exportToPDF(chat);
            expect(result.success).toBe(false);
            expect(result.error).toBe('No window available');
        });

        it('should return success:false when dialog is canceled', async () => {
            mockShowSaveDialog.mockResolvedValue({ filePath: undefined, canceled: true });

            const result = await service.exportToPDF(chat);
            expect(result.success).toBe(false);
        });

        it('should write PDF buffer to file on success', async () => {
            const pdfBuffer = Buffer.from('fake-pdf');
            const filePath = exportPath('chat.pdf');
            mockShowSaveDialog.mockResolvedValue({ filePath, canceled: false });
            mockPrintToPDF.mockResolvedValue(pdfBuffer);
            mockWriteFile.mockResolvedValue(undefined);

            const result = await service.exportToPDF(chat);

            expect(result.success).toBe(true);
            expect(result.path).toBe(filePath);
            expect(mockWriteFile).toHaveBeenCalledWith(filePath, pdfBuffer);
        });

        it('should use custom title from options', async () => {
            mockShowSaveDialog.mockResolvedValue({ filePath: exportPath('custom.pdf'), canceled: false });
            mockPrintToPDF.mockResolvedValue(Buffer.from('pdf'));
            mockWriteFile.mockResolvedValue(undefined);

            await service.exportToPDF(chat, { title: 'PDF Title' });

            const dialogOpts = mockShowSaveDialog.mock.calls[0]![1] as { defaultPath: string };
            expect(dialogOpts.defaultPath).toContain('PDF_Title');
        });

        it('should return error on printToPDF failure', async () => {
            mockShowSaveDialog.mockResolvedValue({ filePath: exportPath('fail.pdf'), canceled: false });
            mockPrintToPDF.mockRejectedValue(new Error('Print failed'));

            const result = await service.exportToPDF(chat);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Print failed');
        });

        it('should handle non-Error thrown objects in PDF export', async () => {
            mockShowSaveDialog.mockResolvedValue({ filePath: exportPath('fail.pdf'), canceled: false });
            mockPrintToPDF.mockRejectedValue('pdf error string');

            const result = await service.exportToPDF(chat);

            expect(result.success).toBe(false);
            expect(result.error).toBe('pdf error string');
        });

        it('should use "Untitled Chat" when no title given', async () => {
            const noTitle = createChat({ title: '' });
            mockShowSaveDialog.mockResolvedValue({ filePath: exportPath('untitled.pdf'), canceled: false });
            mockPrintToPDF.mockResolvedValue(Buffer.from('pdf'));
            mockWriteFile.mockResolvedValue(undefined);

            await service.exportToPDF(noTitle);

            const dialogOpts = mockShowSaveDialog.mock.calls[0]![1] as { defaultPath: string };
            expect(dialogOpts.defaultPath).toContain('Untitled_Chat');
        });
    });

    // ── Default options merging ──────────────────────────────────────────

    describe('default options', () => {
        it('should apply default includeTimestamps=true', () => {
            const md = service.getExportContent(chat, { format: 'markdown' });
            expect(md).toContain('_(');
        });

        it('should apply default includeMetadata=true', () => {
            const md = service.getExportContent(chat, { format: 'markdown' });
            expect(md).toContain('**Model:**');
        });

        it('should apply default includeSystemMessages=false', () => {
            const chatSys = createChat({
                messages: [
                    createMessage({ id: 's', role: 'system', content: 'Sys' }),
                    ...chat.messages
                ]
            });
            const md = service.getExportContent(chatSys, { format: 'markdown' });
            expect(md).not.toContain('Sys');
        });

        it('should apply default includeToolCalls=true', () => {
            const toolChat = createChat({
                messages: [
                    createMessage({
                        id: 'tc',
                        role: 'assistant',
                        content: 'Search',
                        toolCalls: [TOOL_CALL_FIXTURE]
                    })
                ]
            });
            const md = service.getExportContent(toolChat, { format: 'markdown' });
            expect(md).toContain('**Tool Calls:**');
        });
    });

    // ── Format consistency ───────────────────────────────────────────────

    describe('format consistency', () => {
        it.each<ExportFormat>(['markdown', 'html', 'json', 'txt'])(
            '%s format should contain message content',
            (format) => {
                const result = service.getExportContent(chat, { format });
                expect(result).toContain('Hello!');
                expect(result).toContain('Hi there!');
            }
        );

        it.each<ExportFormat>(['markdown', 'html', 'json', 'txt'])(
            '%s format should produce non-empty output for empty messages',
            (format) => {
                const empty = createChat({ messages: [] });
                const result = service.getExportContent(empty, { format });
                expect(result.length).toBeGreaterThan(0);
            }
        );
    });
});
