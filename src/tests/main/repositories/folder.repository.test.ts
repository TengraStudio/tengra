
import { FolderRepository } from '@main/repositories/folder.repository';
import { Folder } from '@main/services/data/database.service';
import { beforeEach,describe, expect, it, vi } from 'vitest';

const mockDb = {
    getFolders: vi.fn(),
    createFolder: vi.fn(),
    updateFolder: vi.fn(),
    deleteFolder: vi.fn()
};

describe('FolderRepository', () => {
    let repo: FolderRepository;

    beforeEach(() => {
        repo = new FolderRepository(mockDb as any);
        vi.clearAllMocks();
    });

    it('should find all folders', async () => {
        const folders: Folder[] = [{ id: '1', name: 'Work', createdAt: 0, updatedAt: 0 }];
        mockDb.getFolders.mockResolvedValue(folders);

        const result = await repo.findAll();
        expect(result).toBe(folders);
        expect(mockDb.getFolders).toHaveBeenCalled();
    });

    it('should create folder with correct arguments', async () => {
        const folder: Folder = { id: '1', name: 'New Folder', createdAt: 0, updatedAt: 0 };
        mockDb.createFolder.mockResolvedValue(folder);

        const input: Folder = { id: 'temp', name: 'New Folder', color: '#fff', createdAt: 0, updatedAt: 0 };
        const result = await repo.create(input);

        expect(result).toBe(folder);
        // Expect decomposed arguments: name, color
        expect(mockDb.createFolder).toHaveBeenCalledWith('New Folder', '#fff');
    });

    it('should update folder and return result', async () => {
        const folder: Folder = { id: '1', name: 'Updated', createdAt: 0, updatedAt: 0 };
        mockDb.updateFolder.mockResolvedValue(folder);

        const result = await repo.update('1', { name: 'Updated' });
        expect(result).toBe(folder);
        expect(mockDb.updateFolder).toHaveBeenCalledWith('1', { name: 'Updated' });
    });

    it('should throw error if update returns null', async () => {
        mockDb.updateFolder.mockResolvedValue(null);
        await expect(repo.update('1', {})).rejects.toThrow('Folder not found: 1');
    });
});
