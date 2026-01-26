import { DatabaseService } from '@main/services/data/database.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { JsonObject, JsonValue } from '@shared/types';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';


type ImportResult = {
    success: boolean
    importedChats?: number
    importedMessages?: number
    message?: string
}

type AuthFileEntry = {
    name?: string
    provider?: string
    type?: string
}

type ImportedMessage = {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: number
}

// OpenAI API Types
interface OpenAIConversationItem {
    id: string
    title: string
    create_time: number
    update_time: number
    model?: string // Legacy api field
}

interface OpenAIConversationDetail {
    title: string
    create_time: number
    update_time: number
    mapping: Record<string, OpenAINode>
    model?: string
    model_slug?: string
    default_model_slug?: string
}

interface OpenAINode {
    id: string
    message?: OpenAIMessage | null
    parent?: string
    children: string[]
}

interface OpenAIMessage {
    id: string
    author: { role: string; name?: string; metadata?: JsonObject }
    create_time: number
    update_time?: number
    content: {
        content_type: string
        parts?: JsonValue[]
        text?: string
    }
    status?: string
    end_turn?: boolean
    weight?: number
    metadata?: JsonObject
    recipient?: string
}

interface OpenAIConversationListResponse {
    items: OpenAIConversationItem[]
    total: number
    limit: number
    offset: number
    has_missing_conversations: boolean
}

// Import JSON Format Types
interface ImportJsonChat {
    id: string
    title?: string
    model?: string
    backend?: string
    createdAt?: number
    updatedAt?: number
    messages: ImportJsonMessage[]
}

interface ImportJsonMessage {
    id?: string
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp?: number
    model?: string
    provider?: string
}

const OPENAI_HISTORY_LIMIT = 50;

export class HistoryImportService {
    constructor(
        private proxyService: ProxyService,
        private databaseService: DatabaseService
    ) { }

    async importChatHistory(provider: string): Promise<ImportResult> {
        const normalized = provider.toLowerCase();
        if (normalized === 'openai' || normalized === 'codex') {
            return this.importOpenAIHistory();
        }
        return {
            success: false,
            message: `${this.providerLabel(provider)} sohbet gecmisi icin resmi API bulunamadi.`
        };
    }

    private async importOpenAIHistory(): Promise<ImportResult> {
        const authData = await this.getOpenAIAuth();
        if ('success' in authData) { return authData; }

        let items: OpenAIConversationItem[] = [];
        try {
            items = await this.fetchOpenAIConversationList(authData.token, OPENAI_HISTORY_LIMIT);
        } catch (error) {
            return { success: false, message: `OpenAI sohbet listesi alinamadi: ${getErrorMessage(error as Error)}` };
        }

        if (items.length === 0) {
            return { success: false, message: 'OpenAI sohbet gecmisi bulunamadi.' };
        }

        const counts = await this.importOpenAIItems(authData.token, items);

        if (counts.importedChats === 0) {
            return { success: true, ...counts, message: 'Yeni OpenAI sohbeti bulunamadi.' };
        }

        return { success: true, ...counts };
    }

    private async getOpenAIAuth(): Promise<{ token: string } | ImportResult> {
        const authFile = await this.findAuthFile(['codex', 'openai']);
        if (!authFile?.name) {
            return { success: false, message: 'OpenAI hesabi bagli degil.' };
        }

        const authData = await this.proxyService.getAuthFileContent(authFile.name);
        const accessToken = this.pickToken(authData);
        if (!accessToken) {
            return { success: false, message: 'OpenAI token bulunamadi.' };
        }
        return { token: accessToken };
    }

    private async importOpenAIItems(token: string, items: OpenAIConversationItem[]) {
        let importedChats = 0;
        let importedMessages = 0;

        for (const item of items) {
            const chatRes = await this.importSingleOpenAIChat(token, item);
            if (chatRes) {
                importedChats++;
                importedMessages += chatRes.messages;
            }
        }
        return { importedChats, importedMessages };
    }

    private async importSingleOpenAIChat(token: string, item: OpenAIConversationItem): Promise<{ messages: number } | null> {
        const conversationId = item.id;
        if (!conversationId) { return null; }

        const chatId = `openai:${conversationId}`;
        if (await this.databaseService.getChat(chatId)) { return null; }

        const detail = await this.fetchOpenAIConversationDetail(token, conversationId);
        if (!detail) { return null; }

        const messages = this.extractOpenAIMessages(detail);
        if (messages.length === 0) { return null; }

        await this.createOpenAIChat(chatId, item, detail, messages);
        return { messages: messages.length };
    }

    private async createOpenAIChat(id: string, item: OpenAIConversationItem, detail: OpenAIConversationDetail, messages: ImportedMessage[]) {
        const createdAt = new Date(this.toMillis(item.create_time));
        const updatedAt = new Date(this.toMillis(item.update_time));
        const model = detail.model ?? detail.model_slug ?? detail.default_model_slug ?? item.model ?? '';

        await this.databaseService.createChat({
            id,
            title: item.title || detail.title || 'OpenAI Chat',
            model,
            messages: [],
            backend: 'openai',
            createdAt,
            updatedAt
        });

        for (const message of messages) {
            await this.databaseService.addMessage({
                id: `openai:${message.id}`,
                chatId: id,
                role: message.role,
                content: message.content,
                timestamp: message.timestamp
            });
        }
    }

    private async findAuthFile(providers: string[]): Promise<AuthFileEntry | null> {
        const response = await this.proxyService.getAuthFiles();
        const files = response.files;
        if (!Array.isArray(files) || files.length === 0) { return null; }

        const targets = providers.map((p) => p.toLowerCase());
        for (const file of files) {
            const authFile = file as AuthFileEntry;
            const provider = String(authFile.provider ?? authFile.type ?? '').toLowerCase();
            if (!provider) { continue; }
            if (targets.includes(provider)) {
                return file as AuthFileEntry;
            }
        }

        return null;
    }

    private pickToken(authData: JsonObject | null): string | null {
        if (!authData) { return null; }
        const data = authData as JsonObject;
        const candidates = [
            data.access_token,
            data.accessToken,
            data.AccessToken
        ];
        for (const value of candidates) {
            if (typeof value === 'string' && value.trim()) {
                return value.trim();
            }
        }
        return null;
    }

    private async fetchOpenAIConversationList(token: string, limit: number): Promise<OpenAIConversationItem[]> {
        const url = new URL('https://chat.openai.com/backend-api/conversations');
        url.searchParams.set('offset', '0');
        url.searchParams.set('limit', String(limit));
        url.searchParams.set('order', 'updated');

        const response = await fetch(url.toString(), { headers: this.openAIHeaders(token) });
        if (!response.ok) {
            throw new Error(`status ${response.status}`);
        }
        const data = await response.json() as OpenAIConversationListResponse;
        return Array.isArray(data.items) ? data.items : [];
    }

    private async fetchOpenAIConversationDetail(token: string, conversationId: string): Promise<OpenAIConversationDetail | null> {
        const url = `https://chat.openai.com/backend-api/conversation/${conversationId}`;
        const response = await fetch(url, { headers: this.openAIHeaders(token) });
        if (!response.ok) {
            return null;
        }
        return response.json() as Promise<OpenAIConversationDetail>;
    }

    private openAIHeaders(token: string): HeadersInit {
        return {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
        };
    }

    private extractOpenAIMessages(detail: OpenAIConversationDetail): ImportedMessage[] {
        const mapping = detail.mapping;
        if (typeof mapping !== 'object') {
            return [];
        }

        const messages: ImportedMessage[] = [];
        for (const node of Object.values(mapping)) {
            const message = node.message;
            if (!message) { continue; }

            const role = message.author.role;
            if (role !== 'user' && role !== 'assistant' && role !== 'system') {
                continue;
            }

            const content = this.extractOpenAIContent(message);
            if (!content) { continue; }

            const id = message.id || node.id;
            if (!id) { continue; }

            messages.push({
                id,
                role: role as 'user' | 'assistant' | 'system',
                content,
                timestamp: this.toMillis(message.create_time)
            });
        }

        messages.sort((a, b) => a.timestamp - b.timestamp);
        return messages;
    }

    private extractOpenAIContent(message: OpenAIMessage): string {
        const content = message.content;
        if (typeof content !== 'object') { return ''; }

        if (Array.isArray(content.parts)) {
            const parts = content.parts.filter((part): part is string => typeof part === 'string' && part.trim() !== '');
            if (parts.length > 0) {
                return parts.join('\n');
            }
        }

        if (typeof content.text === 'string') {
            return content.text;
        }

        // Try fallback if content itself is a string string (legacy?)
        if (typeof content === 'string') { return content; }

        return '';
    }

    private toMillis(value?: number): number {
        if (!value || Number.isNaN(value)) {
            return Date.now();
        }
        if (value < 1_000_000_000_000) {
            return Math.round(value * 1000);
        }
        return Math.round(value);
    }

    private providerLabel(provider: string): string {
        const key = provider.toLowerCase();
        if (key === 'openai') { return 'OpenAI'; }
        if (key === 'claude') { return 'Claude'; }
        if (key === 'gemini') { return 'Gemini'; }
        if (key === 'antigravity') { return 'Antigravity'; }
        if (key === 'github') { return 'GitHub'; }
        return provider;
    }

    async importFromJson(jsonContent: string): Promise<ImportResult> {
        try {
            const data = safeJsonParse<ImportJsonChat | ImportJsonChat[] | { chats: ImportJsonChat[] }>(jsonContent, []);
            const chatsToImport = this.parseImportJson(data);

            if (chatsToImport.length === 0) {
                return { success: false, message: 'Gecersiz JSON formati veya bos veri.' };
            }

            let importedChats = 0;
            let importedMessages = 0;

            for (const chat of chatsToImport) {
                const result = await this.importSingleJsonChat(chat);
                importedChats += result.chatImported ? 1 : 0;
                importedMessages += result.messagesImported;
            }

            return { success: true, importedChats, importedMessages };
        } catch (error) {
            return { success: false, message: `JSON isleme hatasi: ${getErrorMessage(error as Error)}` };
        }
    }

    private parseImportJson(data: ImportJsonChat | ImportJsonChat[] | { chats: ImportJsonChat[] }): ImportJsonChat[] {
        if (Array.isArray(data)) { return data; }
        if ('chats' in data && Array.isArray(data.chats)) { return data.chats; }
        if ('id' in data && 'messages' in data) { return [data as ImportJsonChat]; }
        return [];
    }

    private async importSingleJsonChat(chat: ImportJsonChat): Promise<{ chatImported: boolean; messagesImported: number }> {
        if (!chat.id || !Array.isArray(chat.messages)) { return { chatImported: false, messagesImported: 0 }; }

        const chatImported = await this.ensureChatExists(chat);

        let messagesImported = 0;
        for (const msg of chat.messages) {
            const success = await this.importSingleJsonMessage(chat.id, msg);
            if (success) { messagesImported++; }
        }

        return { chatImported, messagesImported };
    }

    private async ensureChatExists(chat: ImportJsonChat): Promise<boolean> {
        const existing = await this.databaseService.getChat(chat.id);
        if (existing) { return false; }

        await this.databaseService.createChat({
            id: chat.id,
            title: chat.title ?? 'Imported Chat',
            model: chat.model ?? 'unknown',
            messages: [],
            backend: chat.backend ?? 'import',
            createdAt: new Date(chat.createdAt ?? Date.now()),
            updatedAt: new Date(chat.updatedAt ?? Date.now())
        });
        return true;
    }

    private async importSingleJsonMessage(chatId: string, msg: ImportJsonMessage): Promise<boolean> {
        try {
            await this.databaseService.addMessage({
                id: msg.id ?? Math.random().toString(36).substring(7),
                chatId,
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp ?? Date.now(),
                model: msg.model,
                provider: msg.provider
            });
            return true;
        } catch {
            return false;
        }
    }
}
