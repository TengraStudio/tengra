import { ChatRepository } from '@main/services/data/repositories/chat.repository';
import { DatabaseAdapter, PreparedStatement, SqlValue } from '@shared/types/database';
import { beforeEach, describe, expect, it } from 'vitest';

interface ChatRow {
    id: string;
    title: string;
    is_Generating: number;
    backend?: string | null;
    model?: string | null;
    folder_id?: string | null;
    workspace_id?: string | null;
    is_pinned?: number;
    is_favorite?: number;
    metadata?: string;
    created_at: number;
    updated_at: number;
}

interface MessageRow {
    id: string;
    chat_id: string;
    role: string;
    content: string;
    timestamp: number;
    provider?: string | null;
    model?: string | null;
    metadata?: string;
}

class InMemoryAdapter implements DatabaseAdapter {
    constructor(
        private chats: ChatRow[],
        private messages: MessageRow[]
    ) {}

    prepare(sql: string): PreparedStatement {
        return {
            run: async (...params: SqlValue[]) => this.run(sql, params),
            all: async <T = TestValue>(...params: SqlValue[]) => this.all<T>(sql, params),
            get: async <T = TestValue>(...params: SqlValue[]) => this.get<T>(sql, params),
        };
    }

    async exec(): Promise<void> {
        return undefined;
    }

    async query<T = TestValue>(): Promise<{ rows: T[]; fields?: TestValue[] }> {
        return { rows: [] };
    }

    async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
        return fn(this);
    }

    private async run(sql: string, params: SqlValue[]): Promise<{ rowsAffected?: number }> {
        if (sql.startsWith('UPDATE chats SET')) {
            const chatId = String(params[params.length - 1]);
            const chat = this.chats.find(entry => entry.id === chatId);
            if (!chat) {
                return { rowsAffected: 0 };
            }
            const setClause = sql.slice(sql.indexOf('SET ') + 4, sql.indexOf(' WHERE'));
            const assignments = setClause.split(', ');
            for (let index = 0; index < assignments.length; index += 1) {
                const field = assignments[index].replace(' = ?', '');
                const value = params[index];
                if (field === 'is_Generating') {
                    chat.is_Generating = Number(value);
                } else if (field === 'updated_at') {
                    chat.updated_at = Number(value);
                } else if (field === 'title') {
                    chat.title = String(value);
                }
            }
            return { rowsAffected: 1 };
        }

        if (sql.startsWith('UPDATE messages SET')) {
            const messageId = String(params[params.length - 1]);
            const message = this.messages.find(entry => entry.id === messageId);
            if (!message) {
                return { rowsAffected: 0 };
            }
            const setClause = sql.slice(sql.indexOf('SET ') + 4, sql.indexOf(' WHERE'));
            const assignments = setClause.split(', ');
            for (let index = 0; index < assignments.length; index += 1) {
                const field = assignments[index].replace(' = ?', '');
                const value = params[index];
                if (field === 'metadata') {
                    message.metadata = String(value);
                } else if (field === 'content') {
                    message.content = String(value);
                }
            }
            return { rowsAffected: 1 };
        }

        if (sql.startsWith('DELETE FROM messages WHERE id = ?')) {
            const messageId = String(params[0]);
            this.messages = this.messages.filter(entry => entry.id !== messageId);
            return { rowsAffected: 1 };
        }

        throw new Error(`Unsupported SQL in test adapter: ${sql}`);
    }

    private async all<T>(sql: string, params: SqlValue[]): Promise<T[]> {
        if (sql.includes('FROM chats ORDER BY updated_at DESC')) {
            const limit = Number(params[0]);
            const offset = Number(params[1]);
            const rows = [...this.chats]
                .sort((left, right) => right.updated_at - left.updated_at)
                .slice(offset, offset + limit);
            return rows as T[];
        }

        if (sql.includes('FROM messages WHERE chat_id = ? ORDER BY timestamp ASC')) {
            const chatId = String(params[0]);
            const limit = Number(params[1]);
            const offset = Number(params[2]);
            const rows = this.messages
                .filter(entry => entry.chat_id === chatId)
                .sort((left, right) => left.timestamp - right.timestamp)
                .slice(offset, offset + limit);
            return rows as T[];
        }

        throw new Error(`Unsupported SQL in test adapter: ${sql}`);
    }

    private async get<T>(sql: string, params: SqlValue[]): Promise<T | undefined> {
        if (sql === 'SELECT metadata FROM messages WHERE id = ?') {
            const messageId = String(params[0]);
            const message = this.messages.find(entry => entry.id === messageId);
            return message ? ({ metadata: message.metadata ?? '{}' } as T) : undefined;
        }

        if (sql === 'SELECT * FROM chats WHERE id = ?') {
            const chatId = String(params[0]);
            return this.chats.find(entry => entry.id === chatId) as T | undefined;
        }

        throw new Error(`Unsupported SQL in test adapter: ${sql}`);
    }

    public getChats(): ChatRow[] {
        return this.chats;
    }

    public getMessagesState(): MessageRow[] {
        return this.messages;
    }
}

describe('ChatRepository recovery', () => {
    let adapter: InMemoryAdapter;
    let repository: ChatRepository;

    beforeEach(() => {
        adapter = new InMemoryAdapter([], []);
        repository = new ChatRepository(adapter);
    });

    it('clears stale generating flags and deletes empty assistant placeholders', async () => {
        adapter = new InMemoryAdapter(
            [{
                id: 'chat-1',
                title: 'Test',
                is_Generating: 1,
                created_at: 1,
                updated_at: 2,
            }],
            [{
                id: 'assistant-1',
                chat_id: 'chat-1',
                role: 'assistant',
                content: '',
                timestamp: 10,
                metadata: JSON.stringify({}),
            }]
        );
        repository = new ChatRepository(adapter);

        const result = await repository.recoverInterruptedChats();

        expect(result.recoveredChats).toBe(1);
        expect(result.deletedMessages).toBe(1);
        expect(adapter.getChats()[0]?.is_Generating).toBe(0);
        expect(adapter.getMessagesState()).toHaveLength(0);
    });

    it('marks interrupted variants and interrupted tool calls in message metadata', async () => {
        adapter = new InMemoryAdapter(
            [{
                id: 'chat-2',
                title: 'Tool chat',
                is_Generating: 1,
                created_at: 1,
                updated_at: 2,
            }],
            [{
                id: 'assistant-2',
                chat_id: 'chat-2',
                role: 'assistant',
                content: 'Primary answer',
                timestamp: 10,
                metadata: JSON.stringify({
                    variants: [
                        { id: 'variant-1', content: 'Primary answer', timestamp: new Date('2026-03-09T10:00:00.000Z').toISOString() },
                        { id: 'variant-2', content: '', timestamp: new Date('2026-03-09T10:00:01.000Z').toISOString() },
                    ],
                    toolCalls: [
                        {
                            id: 'tool-1',
                            type: 'function',
                            function: { name: 'search_web', arguments: '{}' },
                        },
                    ],
                }),
            }]
        );
        repository = new ChatRepository(adapter);

        const result = await repository.recoverInterruptedChats();
        const messages = await repository.getMessages('chat-2');
        const recovered = messages[0] as {
            variants?: Array<{ id: string; status?: string; error?: string }>;
            metadata?: { recovery?: { interruptedToolNames?: string[] } };
        };

        expect(result.interruptedVariants).toBe(1);
        expect(result.interruptedToolMessages).toBe(1);
        expect(recovered.variants?.[1]).toEqual(
            expect.objectContaining({
                id: 'variant-2',
                status: 'interrupted',
                error: 'interrupted',
            })
        );
        expect(recovered.metadata?.recovery?.interruptedToolNames).toEqual(['search_web']);
        expect(adapter.getChats()[0]?.is_Generating).toBe(0);
    });
});
