/**
 * Export Service
 * Provides conversation export to multiple formats: Markdown, HTML, JSON, and PDF
 */

import { promises as fs } from 'fs';
import { join } from 'path';

import { appLogger } from '@main/logging/logger';
import { Chat, Message } from '@shared/types/chat';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { BrowserWindow, dialog } from 'electron';

export type ExportFormat = 'markdown' | 'html' | 'json' | 'txt';

export interface ExportOptions {
    format: ExportFormat;
    includeTimestamps?: boolean;
    includeMetadata?: boolean;
    includeSystemMessages?: boolean;
    includeToolCalls?: boolean;
    title?: string;
}

export interface ExportResult {
    success: boolean;
    path?: string;
    error?: string;
}

const DEFAULT_OPTIONS: Partial<ExportOptions> = {
    includeTimestamps: true,
    includeMetadata: true,
    includeSystemMessages: false,
    includeToolCalls: true
};

export class ExportService {
    private window: BrowserWindow | null = null;

    setWindow(window: BrowserWindow | null): void {
        this.window = window;
    }

    /**
     * Export a chat conversation to a file
     */
    async exportChat(chat: Chat, options: ExportOptions): Promise<ExportResult> {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        const title = (opts.title ?? chat.title) || 'Untitled Chat';

        appLogger.info('ExportService', `Exporting chat "${title}" as ${opts.format}`);

        try {
            // Generate content based on format
            const metadata = this.getFormatMetadata(opts.format);
            if (!metadata) {
                return { success: false, error: `Unknown format: ${opts.format}` };
            }
            const { fileExtension, filterName } = metadata;
            const content = this.getExportContent(chat, opts);

            const sanitizedTitle = this.sanitizeFilename(title);
            const { filePath, canceled } = await this.promptSaveFile(sanitizedTitle, fileExtension, filterName);

            if (canceled || !filePath) {
                return { success: false };
            }

            // Write file
            await fs.writeFile(filePath, content, 'utf-8');

            appLogger.info('ExportService', `Successfully exported to ${filePath}`);
            return { success: true, path: filePath };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            appLogger.error('ExportService', `Export failed: ${message}`);
            return { success: false, error: message };
        }
    }

    /**
     * Export chat to PDF using Electron's printToPDF
     */
    async exportToPDF(chat: Chat, options?: Partial<ExportOptions>): Promise<ExportResult> {
        if (!this.window) {
            return { success: false, error: 'No window available' };
        }

        const title = (options?.title ?? chat.title) || 'Untitled Chat';
        const sanitizedTitle = this.sanitizeFilename(title);

        try {
            const { filePath, canceled } = await this.promptSaveFile(sanitizedTitle, 'pdf', 'PDF Files');

            if (canceled || !filePath) {
                return { success: false };
            }

            const data = await this.window.webContents.printToPDF({
                printBackground: true,
                margins: { top: 0, bottom: 0, left: 0, right: 0 }
            });

            await fs.writeFile(filePath, data);

            appLogger.info('ExportService', `Successfully exported PDF to ${filePath}`);
            return { success: true, path: filePath };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            appLogger.error('ExportService', `PDF export failed: ${message}`);
            return { success: false, error: message };
        }
    }

    /**
     * Get export content without saving to file (for clipboard, etc.)
     */
    getExportContent(chat: Chat, options: ExportOptions): string {
        const opts = { ...DEFAULT_OPTIONS, ...options };

        switch (opts.format) {
            case 'markdown':
                return this.generateMarkdown(chat, opts);
            case 'html':
                return this.generateHTML(chat, opts);
            case 'json':
                return this.generateJSON(chat, opts);
            case 'txt':
                return this.generatePlainText(chat, opts);
            default:
                throw new Error(`Unknown format: ${opts.format}`);
        }
    }

    /**
     * Generate Markdown format
     */
    private generateMarkdown(chat: Chat, options: ExportOptions): string {
        const lines: string[] = [];
        const title = (options.title ?? chat.title) || 'Untitled Chat';

        lines.push(`# ${title}`, '')

        if (options.includeMetadata) {
            this.addMarkdownMetadata(lines, chat)
        }

        for (const msg of chat.messages) {
            if (msg.role === 'system' && !options.includeSystemMessages) { continue }
            this.addMarkdownMessage(lines, msg, options)
        }

        lines.push('---', `*Exported from Orbit on ${new Date().toLocaleString()}*`)
        return lines.join('\n')
    }

    private addMarkdownMetadata(lines: string[], chat: Chat): void {
        lines.push('---');
        lines.push(`**Model:** ${chat.model || 'Unknown'}`);
        lines.push(`**Created:** ${new Date(chat.createdAt).toLocaleString()}`)
        lines.push(`**Messages:** ${chat.messages.length}`)
        lines.push('---', '')
    }

    private addMarkdownMessage(lines: string[], msg: Message, options: ExportOptions): void {
        const roleLabel = this.getRoleLabel(msg.role)
        const timestamp = options.includeTimestamps ? ` _(${new Date(msg.timestamp).toLocaleString()})_` : ''

        lines.push(`## ${roleLabel}${timestamp}`, '', this.getMessageContent(msg), '')

        if (options.includeToolCalls) {
            this.addMarkdownToolInfo(lines, msg)
        }
    }

    private addMarkdownToolInfo(lines: string[], msg: Message): void {
        if (msg.toolCalls && msg.toolCalls.length > 0) {
            lines.push('**Tool Calls:**')
            msg.toolCalls.forEach(tool => {
                lines.push(`- \`${tool.function.name}\``)
                lines.push(`  Arguments: \`${tool.function.arguments}\``)
            })
            lines.push('')
        }

        if (msg.toolResults) {
            const results = typeof msg.toolResults === 'string' ? safeJsonParse<unknown[]>(msg.toolResults, []) : msg.toolResults
            if (Array.isArray(results) && results.length > 0) {
                lines.push('**Tool Results:**')
                results.forEach(result => {
                    const res = result as { name: string; result: unknown }
                    lines.push(`- \`${res.name}\`: ${JSON.stringify(res.result).substring(0, 200)}...`)
                })
                lines.push('')
            }
        }
    }

    /**
     * Generate HTML format
     */
    private generateHTML(chat: Chat, options: ExportOptions): string {
        const title = (options.title ?? chat.title) || 'Untitled Chat';
        const messages = chat.messages
            .filter(m => m.role !== 'system' || options.includeSystemMessages)
            .map(msg => this.generateHTMLMessage(msg, options))
            .join('\n');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHTML(title)}</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #1a1a1a;
            color: #e0e0e0;
            line-height: 1.6;
        }
        h1 { color: #fff; border-bottom: 2px solid #333; padding-bottom: 10px; }
        .metadata {
            background: #252525;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 0.9em;
            color: #999;
        }
        .message {
            margin: 20px 0;
            padding: 15px;
            border-radius: 12px;
        }
        .message.user {
            background: #2a2a3e;
            border-left: 4px solid #6366f1;
        }
        .message.assistant {
            background: #1e2e1e;
            border-left: 4px solid #22c55e;
        }
        .message.system {
            background: #2e2e1e;
            border-left: 4px solid #eab308;
            font-style: italic;
        }
        .role {
            font-weight: bold;
            margin-bottom: 8px;
            text-transform: capitalize;
        }
        .role.user { color: #818cf8; }
        .role.assistant { color: #4ade80; }
        .role.system { color: #facc15; }
        .timestamp {
            font-size: 0.75em;
            color: #666;
            margin-left: 10px;
        }
        .content { white-space: pre-wrap; word-wrap: break-word; }
        .tool-calls {
            background: #1a1a1a;
            padding: 10px;
            border-radius: 6px;
            margin-top: 10px;
            font-family: monospace;
            font-size: 0.85em;
        }
        code {
            background: #333;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Fira Code', 'Consolas', monospace;
        }
        pre {
            background: #0d0d0d;
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
        }
        .footer {
            margin-top: 40px;
            text-align: center;
            color: #666;
            font-size: 0.85em;
            border-top: 1px solid #333;
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <h1>${this.escapeHTML(title)}</h1>
    ${options.includeMetadata ? this.generateHTMLMetadata(chat) : ''}
    ${messages}
    <div class="footer">
        Exported from Orbit on ${new Date().toLocaleString()}
    </div>
</body>
</html>`;
    }

    private generateHTMLMetadata(chat: Chat): string {
        return `
    <div class="metadata">
        <strong>Model:</strong> ${this.escapeHTML(chat.model || 'Unknown')}<br>
        <strong>Created:</strong> ${new Date(chat.createdAt).toLocaleString()}<br>
        <strong>Messages:</strong> ${chat.messages.length}
    </div>`;
    }

    private generateHTMLMessage(msg: Message, options: ExportOptions): string {
        const timestamp = options.includeTimestamps
            ? `<span class="timestamp">${new Date(msg.timestamp).toLocaleString()}</span>`
            : '';

        const toolCalls = options.includeToolCalls && msg.toolCalls && msg.toolCalls.length > 0
            ? `<div class="tool-calls">
                <strong>Tool Calls:</strong><br>
                ${msg.toolCalls.map(t => `<code>${this.escapeHTML(t.function.name)}</code>: ${this.escapeHTML(t.function.arguments)}`).join('<br>')}
            </div>`
            : '';

        return `
    <div class="message ${msg.role}">
        <div class="role ${msg.role}">${this.getRoleLabel(msg.role)}${timestamp}</div>
        <div class="content">${this.escapeHTML(this.getMessageContent(msg))}</div>
        ${toolCalls}
    </div>`;
    }

    /**
     * Generate JSON format
     */
    private generateJSON(chat: Chat, options: ExportOptions): string {
        const filteredMessages = options.includeSystemMessages
            ? chat.messages
            : chat.messages.filter(m => m.role !== 'system');

        const exportData = {
            title: (options.title ?? chat.title) || 'Untitled Chat',
            model: chat.model,
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt,
            messageCount: filteredMessages.length,
            exportedAt: new Date().toISOString(),
            messages: filteredMessages.map(msg => {
                const base: Record<string, unknown> = {
                    role: msg.role,
                    content: this.getMessageContent(msg)
                };

                if (options.includeTimestamps) {
                    base.timestamp = msg.timestamp;
                }

                if (options.includeMetadata) {
                    base.provider = msg.provider;
                    base.model = msg.model;
                }

                if (options.includeToolCalls) {
                    if (msg.toolCalls) { base.toolCalls = msg.toolCalls; }
                    if (msg.toolResults) { base.toolResults = msg.toolResults; }
                }

                return base;
            })
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Generate plain text format
     */
    private generatePlainText(chat: Chat, options: ExportOptions): string {
        const lines: string[] = [];
        const title = (options.title ?? chat.title) || 'Untitled Chat';

        // Header
        lines.push(`═══════════════════════════════════════════════════════════════`);
        lines.push(`  ${title}`);
        lines.push(`═══════════════════════════════════════════════════════════════`);
        lines.push('');

        // Metadata
        if (options.includeMetadata) {
            lines.push(`Model: ${chat.model || 'Unknown'}`);
            lines.push(`Created: ${new Date(chat.createdAt).toLocaleString()}`);
            lines.push(`Messages: ${chat.messages.length}`);
            lines.push('');
            lines.push(`───────────────────────────────────────────────────────────────`);
            lines.push('');
        }

        // Messages
        for (const msg of chat.messages) {
            if (msg.role === 'system' && !options.includeSystemMessages) {
                continue;
            }

            const roleLabel = this.getRoleLabel(msg.role).toUpperCase();
            const timestamp = options.includeTimestamps
                ? ` [${new Date(msg.timestamp).toLocaleString()}]`
                : '';

            lines.push(`[${roleLabel}]${timestamp}`);
            lines.push(this.getMessageContent(msg));
            lines.push('');
        }

        // Footer
        lines.push(`───────────────────────────────────────────────────────────────`);
        lines.push(`Exported from Orbit on ${new Date().toLocaleString()}`);

        return lines.join('\n');
    }

    /**
     * Helper methods
     */
    private getRoleLabel(role: string): string {
        switch (role) {
            case 'user': return 'You';
            case 'assistant': return 'Assistant';
            case 'system': return 'System';
            default: return role;
        }
    }

    private getMessageContent(msg: Message): string {
        if (typeof msg.content === 'string') {
            return msg.content;
        }

        if (Array.isArray(msg.content)) {
            return msg.content
                .filter(part => part.type === 'text' && !!part.text)
                .map(part => part.text ?? '')
                .join('\n');
        }

        return '';
    }

    private escapeHTML(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    private getFormatMetadata(format: ExportFormat): { fileExtension: string, filterName: string } | null {
        switch (format) {
            case 'markdown': return { fileExtension: 'md', filterName: 'Markdown Files' };
            case 'html': return { fileExtension: 'html', filterName: 'HTML Files' };
            case 'json': return { fileExtension: 'json', filterName: 'JSON Files' };
            case 'txt': return { fileExtension: 'txt', filterName: 'Text Files' };
            default: return null;
        }
    }

    private async promptSaveFile(defaultTitle: string, extension: string, filterName: string): Promise<{ filePath: string | undefined, canceled: boolean }> {
        if (!this.window) {
            throw new Error('No window available');
        }
        const homeDir = process.env.USERPROFILE ?? process.env.HOME ?? '';
        return await dialog.showSaveDialog(this.window, {
            title: `Export Chat as ${filterName}`,
            defaultPath: join(homeDir, 'Documents', `${defaultTitle}.${extension}`),
            filters: [{ name: filterName, extensions: [extension] }]
        });
    }

    private sanitizeFilename(filename: string): string {
        return filename
            .replace(/[<>:"/\\|?*]/g, '-')
            .replace(/\s+/g, '_')
            .substring(0, 100);
    }
}

// Singleton instance
export const exportService = new ExportService();
