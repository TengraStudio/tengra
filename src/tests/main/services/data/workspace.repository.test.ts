import { WorkspaceRepository } from '@main/services/data/repositories/workspace.repository';
import { DatabaseAdapter, PreparedStatement } from '@shared/types/database';
import { describe, expect, it, vi } from 'vitest';

function createAdapter(rowsAffected: number): DatabaseAdapter {
    const prepared: PreparedStatement = {
        run: vi.fn().mockResolvedValue({ rowsAffected }),
        all: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue(undefined),
    };

    const adapter: DatabaseAdapter = {
        prepare: vi.fn().mockReturnValue(prepared),
        exec: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockResolvedValue({ rows: [], fields: [] }),
        transaction: async <T>(): Promise<T> => {
            throw new Error('Transactions are not used in this test adapter.');
        },
    };

    return adapter;
}

describe('WorkspaceRepository', () => {
    it('throws when the insert does not persist a workspace row', async () => {
        const repository = new WorkspaceRepository(createAdapter(0));

        await expect(repository.createWorkspace('Demo', 'C:\\repos\\demo')).rejects.toThrow(
            'Workspace insert did not persist.'
        );
    });
});
