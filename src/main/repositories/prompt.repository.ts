/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
        return (await this.db.getPrompt(id)) ?? null;
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
