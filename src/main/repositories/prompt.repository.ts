import { IRepository } from '@main/core/repository.interface';
import { DatabaseService, Prompt } from '@main/services/data/database.service';

/**
 * Repository for managing Prompts.
 * Decorates DatabaseService.
 */
export class PromptRepository implements IRepository<Prompt> {
    constructor(private db: DatabaseService) { }

    async findAll(): Promise<Prompt[]> {
        return this.db.getPrompts();
    }

    async findById(id: string): Promise<Prompt | null> {
        const prompts = await this.db.getPrompts();
        return prompts.find(p => p.id === id) ?? null;
    }

    async create(item: Prompt): Promise<Prompt> {
        return this.db.createPrompt(item.title, item.content, item.tags);
    }

    async update(id: string, item: Partial<Prompt>): Promise<Prompt> {
        await this.db.updatePrompt(id, item);
        const prompt = await this.findById(id);
        if (!prompt) { throw new Error(`Prompt not found after update: ${id}`); }
        return prompt;
    }

    async delete(id: string): Promise<boolean> {
        await this.db.deletePrompt(id);
        return true;
    }
}
