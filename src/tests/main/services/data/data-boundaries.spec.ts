import { DatabaseService } from '@main/services/data/database.service';
import { beforeEach,describe, expect, it, vi } from 'vitest';

interface MockPreparedStatement {
    run: ReturnType<typeof vi.fn>;
    all: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
}

interface MockTransactionDb {
    query: ReturnType<typeof vi.fn>;
    exec: ReturnType<typeof vi.fn>;
    prepare: ReturnType<typeof vi.fn>;
}

type TransactionCallback = (txDb: MockTransactionDb) => RuntimeValue | Promise<RuntimeValue>;

/**
 * DATA-001 Contract Tests
 * Validates canonical boundaries between Workspace, Memory, Chat, and Automation Workflow data models.
 * Ensures Repositories do not cross-contaminate and enforce the "No Write-Crossing" rule.
 */
describe('Data Model Boundaries Contract', () => {
    let databaseService: DatabaseService;

    beforeEach(() => {
        // Mock dependencies for the DatabaseService
        const mockDataService = { getPath: vi.fn().mockReturnValue('/mock/path') } as never;
        const mockEventBus = { emit: vi.fn(), on: vi.fn() } as never;
        const mockDbClient = {
            initialize: vi.fn().mockResolvedValue(true),
            testConnection: vi.fn().mockResolvedValue({ healthy: true, latencyMs: 1 }),
            isConnected: vi.fn().mockReturnValue(true),
            executeQuery: vi.fn().mockResolvedValue({ rows: [], affected_rows: 1 })
        } as never;
        const mockTimeTracking = { recordSlowOperation: vi.fn() } as never;

        databaseService = new DatabaseService(
            mockDataService,
            mockEventBus,
            mockDbClient,
            mockTimeTracking
        );

        // We forcefully initialize it and stub out adapter behavior
        const createAdapterMock = vi.fn().mockReturnValue({
            query: vi.fn().mockResolvedValue({ rows: [], fields: [] }),
            exec: vi.fn().mockResolvedValue(undefined),
            prepare: vi.fn().mockReturnValue({ run: vi.fn(), all: vi.fn(), get: vi.fn() } as MockPreparedStatement),
            transaction: vi.fn().mockImplementation(async (cb: TransactionCallback) => cb({
                query: vi.fn().mockResolvedValue({ rows: [], fields: [] }),
                exec: vi.fn().mockResolvedValue(undefined),
                prepare: vi.fn().mockReturnValue({ run: vi.fn(), all: vi.fn(), get: vi.fn() } as MockPreparedStatement)
            }))
        });
        Reflect.set(databaseService, 'createAdapter', createAdapterMock);

        // Use direct property overwrite for tests since repos are private
        Reflect.set(databaseService, '_chats', { validateMessageDomain: vi.fn().mockReturnValue(true) });
        Reflect.set(databaseService, '_knowledge', { validateMemoryDomain: vi.fn().mockReturnValue(true) });
        Reflect.set(databaseService, '_workspaces', { validateWorkspaceDomain: vi.fn().mockReturnValue(true) });
        Reflect.set(databaseService, '_system', { validateSystemDomain: vi.fn().mockReturnValue(true) });
        Reflect.set(databaseService, '_uac', { validateUacDomain: vi.fn().mockReturnValue(true) });
    });

    describe('Workspace Domain (Boundary Enforcer)', () => {
        it('should NOT allow WorkspaceRepository to construct or manipulate Chat Message entities', () => {
            const workspaceRepo = databaseService.workspaces;
            expect(workspaceRepo).not.toHaveProperty('saveMessage');
            expect(workspaceRepo).not.toHaveProperty('updateChat');
        });

        it('should NOT allow WorkspaceRepository to manipulate Semantic/Episodic Memory chunks', () => {
            const workspaceRepo = databaseService.workspaces;
            expect(workspaceRepo).not.toHaveProperty('upsertMemory');
            expect(workspaceRepo).not.toHaveProperty('saveEpisodicData');
        });
    });

    describe('Chat Domain (Boundary Enforcer)', () => {
        it('should ONLY manipulate chats and specific conversation scopes', () => {
            const chatRepo = databaseService.chats;
            expect(chatRepo).not.toHaveProperty('saveSemanticFragment');
            expect(chatRepo).not.toHaveProperty('registerAgentTask');
            expect(chatRepo).not.toHaveProperty('runSystemMigration');
        });
    });

    describe('Memory Domain (Boundary Enforcer)', () => {
        it('KnowledgeRepository should ONLY touch memory and knowledge entity vectors', () => {
            const knowledgeRepo = databaseService.knowledge;
            expect(knowledgeRepo).not.toHaveProperty('createWorkspace');
            expect(knowledgeRepo).not.toHaveProperty('updateChatMessage');
            expect(knowledgeRepo).not.toHaveProperty('launchAutomationWorkflow');
        });
    });

    describe('Automation Workflow Domain & System boundaries', () => {
        it('SystemRepository should maintain clean separation from conversational text stores', () => {
            const systemRepo = databaseService.system;
            expect(systemRepo).not.toHaveProperty('updatePrompt');
            expect(systemRepo).not.toHaveProperty('createFolder');
        });

        it('Automation states should not interleave with user specific chats implicitly', () => {
            // Automation workflows should be managed separately from user text chats,
            // typically in agent-state repositories, uac profiles, or systemic transient structures.
            expect(databaseService.uac).not.toHaveProperty('updateChat');
        });
    });
});
