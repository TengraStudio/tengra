/**
 * Chat Export Service
 * Extends BaseService to provide chat export in multiple formats.
 * Wraps the existing ExportService with lifecycle management.
 */

import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { ExportFormat, ExportOptions,ExportService } from '@main/services/data/export.service';
import { Chat } from '@shared/types/chat';

/** Result of a chat export operation. */
export interface ChatExportResult {
    success: boolean;
    content?: string;
    error?: string;
    messageKey?: string;
    messageParams?: Record<string, string | number>;
    format: ExportFormat;
}

const CHAT_EXPORT_MESSAGE_KEY = {
    CHAT_NOT_FOUND: 'mainProcess.chatExportService.chatNotFound'
} as const;
const CHAT_EXPORT_ERROR_MESSAGE = {
    CHAT_NOT_FOUND: 'Chat not found'
} as const;

/**
 * Service for exporting chat conversations to markdown, HTML, JSON, or text.
 * Retrieves chat data from the database and delegates formatting to ExportService.
 */
export class ChatExportService extends BaseService {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly exportService: ExportService
    ) {
        super('ChatExportService');
    }

    /** Initializes the chat export service. */
    async initialize(): Promise<void> {
        this.logInfo('Chat export service initialized');
    }

    /**
     * Exports a chat by ID to the specified format.
     * @param chatId - The ID of the chat to export.
     * @param format - Target format (markdown, html, json, txt).
     * @param options - Additional export options.
     * @returns The exported content as a string.
     */
    async exportChat(
        chatId: string,
        format: ExportFormat,
        options?: Partial<ExportOptions>
    ): Promise<ChatExportResult> {
        this.logInfo(`Exporting chat ${chatId} as ${format}`);
        try {
            const chat = await this.loadChat(chatId);
            if (!chat) {
                return {
                    success: false,
                    error: CHAT_EXPORT_ERROR_MESSAGE.CHAT_NOT_FOUND,
                    messageKey: CHAT_EXPORT_MESSAGE_KEY.CHAT_NOT_FOUND,
                    format
                };
            }

            const exportOptions: ExportOptions = {
                format,
                includeTimestamps: true,
                includeMetadata: true,
                includeSystemMessages: false,
                includeToolCalls: true,
                ...options,
            };

            const content = this.exportService.getExportContent(chat, exportOptions);
            this.logInfo(`Export complete: ${content.length} characters`);
            return { success: true, content, format };
        } catch (error) {
            this.logError(`Export failed for chat ${chatId}`, error);
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: message, format };
        }
    }

    /**
     * Exports a chat to a file using the save dialog.
     * @param chatId - The ID of the chat to export.
     * @param format - Target format.
     */
    async exportChatToFile(
        chatId: string,
        format: ExportFormat
    ): Promise<{
        success: boolean;
        path?: string;
        error?: string;
        messageKey?: string;
        messageParams?: Record<string, string | number>;
    }> {
        this.logInfo(`Exporting chat ${chatId} to file as ${format}`);
        try {
            const chat = await this.loadChat(chatId);
            if (!chat) {
                return {
                    success: false,
                    error: CHAT_EXPORT_ERROR_MESSAGE.CHAT_NOT_FOUND,
                    messageKey: CHAT_EXPORT_MESSAGE_KEY.CHAT_NOT_FOUND
                };
            }
            return await this.exportService.exportChat(chat, { format });
        } catch (error) {
            this.logError(`File export failed for chat ${chatId}`, error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    /** Loads a chat with its messages from the database. */
    private async loadChat(chatId: string): Promise<Chat | null> {
        const chat = await this.databaseService.chats.getChat(chatId);
        if (!chat) {return null;}
        const messages = await this.databaseService.chats.getMessages(chatId);
        return { ...chat, messages } as RuntimeValue as Chat;
    }
}
