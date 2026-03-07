import { DatabaseClientService } from '@main/services/data/database-client.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}));

/**
 * Build a DatabaseClientService instance for validation-only testing.
 * The service is not initialized (no HTTP backend needed).
 */
function createService(): DatabaseClientService {
    const mockEventBus = { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as unknown as EventBusService;
    const mockProcessManager = {
        startService: vi.fn(),
        getServicePort: vi.fn(),
        on: vi.fn(),
    } as unknown as ProcessManagerService;
    return new DatabaseClientService(mockEventBus, mockProcessManager);
}

describe('DatabaseClientService input validation', () => {
    const svc = createService();

    // ── ID-based methods ────────────────────────────────────────────

    describe('getChat', () => {
        it('rejects empty id', async () => {
            await expect(svc.getChat('')).rejects.toThrow('chatId must be a non-empty string');
        });
        it('rejects id with path traversal characters', async () => {
            await expect(svc.getChat('../admin')).rejects.toThrow('chatId contains invalid characters');
        });
    });

    describe('updateChat', () => {
        it('rejects empty id', async () => {
            await expect(svc.updateChat('', {})).rejects.toThrow('chatId must be a non-empty string');
        });
    });

    describe('deleteChat', () => {
        it('rejects empty id', async () => {
            await expect(svc.deleteChat('')).rejects.toThrow('chatId must be a non-empty string');
        });
    });

    describe('getMessages', () => {
        it('rejects empty chatId', async () => {
            await expect(svc.getMessages('')).rejects.toThrow('chatId must be a non-empty string');
        });
    });

    describe('updateMessage', () => {
        it('rejects empty id', async () => {
            await expect(svc.updateMessage('', {})).rejects.toThrow('messageId must be a non-empty string');
        });
    });

    describe('deleteMessage', () => {
        it('rejects empty id', async () => {
            await expect(svc.deleteMessage('')).rejects.toThrow('messageId must be a non-empty string');
        });
    });

    describe('getWorkspace', () => {
        it('rejects empty id', async () => {
            await expect(svc.getWorkspace('')).rejects.toThrow('workspaceId must be a non-empty string');
        });
        it('rejects id with slash', async () => {
            await expect(svc.getWorkspace('a/b')).rejects.toThrow('workspaceId contains invalid characters');
        });
    });

    describe('updateWorkspace', () => {
        it('rejects empty id', async () => {
            await expect(svc.updateWorkspace('', {})).rejects.toThrow('workspaceId must be a non-empty string');
        });
    });

    describe('deleteWorkspace', () => {
        it('rejects empty id', async () => {
            await expect(svc.deleteWorkspace('')).rejects.toThrow('workspaceId must be a non-empty string');
        });
    });

    describe('updateFolder', () => {
        it('rejects empty id', async () => {
            await expect(svc.updateFolder('', {})).rejects.toThrow('folderId must be a non-empty string');
        });
    });

    describe('deleteFolder', () => {
        it('rejects empty id', async () => {
            await expect(svc.deleteFolder('')).rejects.toThrow('folderId must be a non-empty string');
        });
    });

    describe('updatePrompt', () => {
        it('rejects empty id', async () => {
            await expect(svc.updatePrompt('', {})).rejects.toThrow('promptId must be a non-empty string');
        });
    });

    describe('deletePrompt', () => {
        it('rejects empty id', async () => {
            await expect(svc.deletePrompt('')).rejects.toThrow('promptId must be a non-empty string');
        });
    });

    // ── Create / request-body methods ───────────────────────────────

    describe('createChat', () => {
        it('rejects empty title', async () => {
            await expect(svc.createChat({ title: '' })).rejects.toThrow('title must be a non-empty string');
        });
        it('rejects non-string title', async () => {
            await expect(svc.createChat({ title: 123 as unknown as string })).rejects.toThrow('title must be a non-empty string');
        });
    });

    describe('addMessage', () => {
        it('rejects empty chat_id', async () => {
            await expect(svc.addMessage({ chat_id: '', role: 'user', content: 'hi' })).rejects.toThrow('chat_id must be a non-empty string');
        });
        it('rejects empty role', async () => {
            await expect(svc.addMessage({ chat_id: 'c1', role: '', content: 'hi' })).rejects.toThrow('role must be a non-empty string');
        });
    });

    describe('createWorkspace', () => {
        it('rejects empty title', async () => {
            await expect(svc.createWorkspace({ title: '', path: '/p' })).rejects.toThrow('title must be a non-empty string');
        });
        it('rejects empty path', async () => {
            await expect(svc.createWorkspace({ title: 'ok', path: '' })).rejects.toThrow('path must be a non-empty string');
        });
    });

    describe('createFolder', () => {
        it('rejects empty name', async () => {
            await expect(svc.createFolder({ name: '' })).rejects.toThrow('name must be a non-empty string');
        });
    });

    describe('createPrompt', () => {
        it('rejects empty title', async () => {
            await expect(svc.createPrompt({ title: '', content: 'c' })).rejects.toThrow('title must be a non-empty string');
        });
        it('rejects empty content', async () => {
            await expect(svc.createPrompt({ title: 't', content: '' })).rejects.toThrow('content must be a non-empty string');
        });
    });

    // ── Knowledge operations ────────────────────────────────────────

    describe('storeCodeSymbol', () => {
        it('rejects empty name', async () => {
            await expect(svc.storeCodeSymbol({
                workspace_path: '/p', file_path: '/f', name: '', line: 1, kind: 'function'
            })).rejects.toThrow('name must be a non-empty string');
        });
    });

    describe('searchCodeSymbols', () => {
        it('rejects non-array embedding', async () => {
            await expect(svc.searchCodeSymbols({ embedding: 'bad' as unknown as number[] }))
                .rejects.toThrow('embedding must be an array');
        });
    });

    describe('storeSemanticFragment', () => {
        it('rejects empty content', async () => {
            await expect(svc.storeSemanticFragment({
                content: '', embedding: [1], source: 's', source_id: 'sid'
            })).rejects.toThrow('content must be a non-empty string');
        });
        it('rejects non-array embedding', async () => {
            await expect(svc.storeSemanticFragment({
                content: 'c', embedding: null as unknown as number[], source: 's', source_id: 'sid'
            })).rejects.toThrow('embedding must be an array');
        });
    });

    describe('searchSemanticFragments', () => {
        it('rejects non-array embedding', async () => {
            await expect(svc.searchSemanticFragments({ embedding: 42 as unknown as number[] }))
                .rejects.toThrow('embedding must be an array');
        });
    });

    // ── Query / marketplace ─────────────────────────────────────────

    describe('executeQuery', () => {
        it('rejects empty sql', async () => {
            await expect(svc.executeQuery({ sql: '' })).rejects.toThrow('sql must be a non-empty string');
        });
        it('rejects non-string sql', async () => {
            await expect(svc.executeQuery({ sql: 123 as unknown as string })).rejects.toThrow('sql must be a non-empty string');
        });
        it('rejects non-array params', async () => {
            await expect(svc.executeQuery({ sql: 'SELECT 1', params: 'bad' as unknown as (string | number | boolean | null)[] }))
                .rejects.toThrow('params must be an array');
        });
    });

    describe('upsertMarketplaceModels', () => {
        it('rejects non-array models', async () => {
            await expect(svc.upsertMarketplaceModels({ models: 'bad' as unknown as [] }))
                .rejects.toThrow('models must be an array');
        });
    });

    describe('searchMarketplaceModels', () => {
        it('rejects empty query', async () => {
            await expect(svc.searchMarketplaceModels({ query: '' }))
                .rejects.toThrow('query must be a non-empty string');
        });
    });

    // B-0494: Connection pool metrics before initialization
    describe('connection pool metrics', () => {
        it('returns initial pool metrics', () => {
            const metrics = svc.getConnectionPoolMetrics();
            expect(metrics.maxSockets).toBe(10);
            expect(metrics.maxFreeSockets).toBe(5);
            expect(metrics.pendingRequests).toBe(0);
            expect(metrics.totalRequests).toBe(0);
            expect(metrics.errorRate).toBe(0);
        });
    });

    // B-0494: setPoolLimits validation
    describe('setPoolLimits', () => {
        it('clamps maxPendingRequests to at least 1', () => {
            svc.setPoolLimits({ maxPendingRequests: 0 });
            const metrics = svc.getConnectionPoolMetrics();
            expect(metrics.maxPendingRequests).toBeGreaterThanOrEqual(1);
        });

        it('accepts valid pool config', () => {
            svc.setPoolLimits({ maxSockets: 20, maxFreeSockets: 8, maxPendingRequests: 50 });
            const metrics = svc.getConnectionPoolMetrics();
            expect(metrics.maxSockets).toBe(20);
            expect(metrics.maxFreeSockets).toBe(8);
            expect(metrics.maxPendingRequests).toBe(50);
        });
    });

    // B-0494: isConnected returns false before initialization
    describe('isConnected', () => {
        it('returns false when not initialized', () => {
            expect(svc.isConnected()).toBe(false);
        });
    });

    // B-0493: Path traversal validation
    describe('path traversal prevention', () => {
        it('rejects backslash in chatId', async () => {
            await expect(svc.getChat('a\\b')).rejects.toThrow('contains invalid characters');
        });

        it('rejects space in workspaceId', async () => {
            await expect(svc.getWorkspace('a b')).rejects.toThrow('contains invalid characters');
        });
    });
});
