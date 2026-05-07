/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { EXPORT_CHANNELS } from '@shared/constants/ipc-channels';
import { Chat } from '@shared/types';
import { IpcRenderer } from 'electron';

export interface ExportBridge {
    chat: (
        chat: Chat,
        options: {
            format: 'markdown' | 'html' | 'json' | 'txt';
            includeTimestamps?: boolean;
            includeMetadata?: boolean;
            includeSystemMessages?: boolean;
            includeToolCalls?: boolean;
            title?: string;
        }
    ) => Promise<{ success: boolean; path?: string; error?: string }>;
    chatToMarkdown: (
        chat: Chat,
        options?: { includeTimestamps?: boolean; includeMetadata?: boolean; title?: string }
    ) => Promise<{ success: boolean; path?: string; error?: string }>;
    chatToHTML: (
        chat: Chat,
        options?: { includeTimestamps?: boolean; includeMetadata?: boolean; title?: string }
    ) => Promise<{ success: boolean; path?: string; error?: string }>;
    chatToJSON: (
        chat: Chat,
        options?: { includeTimestamps?: boolean; includeMetadata?: boolean; title?: string }
    ) => Promise<{ success: boolean; path?: string; error?: string }>;
    chatToText: (
        chat: Chat,
        options?: { includeTimestamps?: boolean; includeMetadata?: boolean; title?: string }
    ) => Promise<{ success: boolean; path?: string; error?: string }>;
    chatToPDF: (
        chat: Chat,
        options?: { title?: string }
    ) => Promise<{ success: boolean; path?: string; error?: string }>;
    getContent: (
        chat: Chat,
        options: {
            format: 'markdown' | 'html' | 'json' | 'txt';
            includeTimestamps?: boolean;
            includeMetadata?: boolean;
            title?: string;
        }
    ) => Promise<{ success: boolean; content?: string; error?: string }>;

    // Legacy/Generic exports
    markdown: (content: string, filePath: string) => Promise<boolean>;
    pdf: (htmlContent: string, filePath: string) => Promise<boolean>;
}

export function createExportBridge(ipc: IpcRenderer): ExportBridge {
    return {
        chat: (chat, options) => ipc.invoke(EXPORT_CHANNELS.CHAT, chat, options),
        chatToMarkdown: (chat, options) =>
            ipc.invoke(EXPORT_CHANNELS.CHAT_TO_MARKDOWN, chat, options),
        chatToHTML: (chat, options) => ipc.invoke(EXPORT_CHANNELS.CHAT_TO_HTML, chat, options),
        chatToJSON: (chat, options) => ipc.invoke(EXPORT_CHANNELS.CHAT_TO_JSON, chat, options),
        chatToText: (chat, options) => ipc.invoke(EXPORT_CHANNELS.CHAT_TO_TEXT, chat, options),
        chatToPDF: (chat, options) => ipc.invoke(EXPORT_CHANNELS.CHAT_TO_PDF, chat, options),
        getContent: (chat, options) => ipc.invoke(EXPORT_CHANNELS.GET_CONTENT, chat, options),

        markdown: (content, filePath) => ipc.invoke(EXPORT_CHANNELS.MARKDOWN, content, filePath),
        pdf: (htmlContent, filePath) => ipc.invoke(EXPORT_CHANNELS.PDF, htmlContent, filePath),
    };
}

