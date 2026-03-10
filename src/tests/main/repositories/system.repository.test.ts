import { SystemRepository } from '@main/services/data/repositories/system.repository';
import { DatabaseAdapter } from '@shared/types/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('SystemRepository', () => {
    const run = vi.fn();
    const all = vi.fn();
    const get = vi.fn();
    const prepare = vi.fn(() => ({ run, all, get }));
    const adapter: DatabaseAdapter = {
        prepare,
        exec: vi.fn(),
        query: vi.fn(),
        transaction: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('stores token usage without writing a UUID into the autoincrement id column', async () => {
        const repository = new SystemRepository(adapter);

        await repository.addTokenUsage({
            chatId: 'chat-1',
            workspaceId: 'workspace-1',
            messageId: 'message-1',
            provider: 'ollama',
            model: 'llama3.1:8b',
            tokensSent: 12,
            tokensReceived: 34,
            costEstimate: 0,
            timestamp: 1234567890,
        });

        expect(prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO token_usage(chat_id, workspace_path, message_id, provider, model, tokens_sent, tokens_received, cost_estimate, timestamp)'));
        expect(run).toHaveBeenCalledWith(
            'chat-1',
            'workspace-1',
            'message-1',
            'ollama',
            'llama3.1:8b',
            12,
            34,
            0,
            1234567890,
        );
    });
});
