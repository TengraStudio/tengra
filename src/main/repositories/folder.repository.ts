import { IRepository } from '@main/core/repository.interface';
import { DatabaseService, Folder } from '@main/services/data/database.service';

/**
 * Repository for managing folders in the database.
 */
export class FolderRepository implements IRepository<Folder> {
    constructor(private db: DatabaseService) { }

    async findAll(): Promise<Folder[]> {
        return this.db.getFolders();
    }

    /**
     * Find folder by ID using optimized direct query
     * @param id - Folder ID to search for
     * @returns Folder if found, null otherwise
     */
    async findById(id: string): Promise<Folder | null> {
        // PERF-003-2: Use direct WHERE query instead of loading all folders
        return (await this.db.getFolder(id)) ?? null;
    }

    async create(item: Omit<Folder, 'id' | 'createdAt' | 'updatedAt'>): Promise<Folder> {
        return this.db.createFolder(item.name, item.color);
    }

    async update(id: string, item: Partial<Folder>): Promise<Folder> {
        await this.db.updateFolder(id, item);
        const folder = await this.findById(id);
        if (!folder) { throw new Error(`Folder not found after update: ${id}`); }
        return folder;
    }

    async delete(id: string): Promise<boolean> {
        await this.db.deleteFolder(id);
        return true;
    }
}
