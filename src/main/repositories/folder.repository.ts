import { IRepository } from '@main/core/repository.interface';
import { Folder, DatabaseService } from '@main/services/data/database.service';

/**
 * Repository for managing Folders.
 */
export class FolderRepository implements IRepository<Folder> {
    constructor(private db: DatabaseService) { }

    async findAll(): Promise<Folder[]> {
        return this.db.getFolders();
    }

    async findById(id: string): Promise<Folder | null> {
        const folders = await this.db.getFolders();
        return folders.find(f => f.id === id) || null;
    }

    async create(item: Folder): Promise<Folder> {
        return this.db.createFolder(item.name, item.color);
    }

    async update(id: string, item: Partial<Folder>): Promise<Folder> {
        const updated = await this.db.updateFolder(id, item);
        if (!updated) throw new Error(`Folder not found: ${id}`);
        return updated;
    }

    async delete(id: string): Promise<boolean> {
        await this.db.deleteFolder(id);
        return true;
    }
}
