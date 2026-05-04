/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Shared Prompt Library Service
 * Manages shared prompts with CRUD, search, import/export.
 */

import * as fsPromises from 'fs/promises';

import { ipc } from '@main/core/ipc-decorators';
import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { v4 as uuidv4 } from 'uuid';

/** A shared prompt stored in the library. */
export interface SharedPrompt {
    id: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    author: string;
    createdAt: number;
    updatedAt: number;
}

/** Input for creating a new shared prompt. */
export interface SharedPromptInput {
    title: string;
    content: string;
    category?: string;
    tags?: string[];
    author?: string;
}

/** Filter options for listing shared prompts. */
export interface SharedPromptFilter {
    query?: string;
    category?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
}

/** Row shape returned from the shared_prompts table. */
interface SharedPromptRow {
    id: string;
    title: string;
    content: string;
    category: string;
    tags: string;
    author: string;
    created_at: number;
    updated_at: number;
}

const MAX_SEARCH_LIMIT = 500;

export class SharedPromptsService extends BaseService {
    private initPromise: Promise<void> | null = null;

    constructor(private readonly db: DatabaseService) {
        super('SharedPromptsService');
    }

    /** Initialize the service and ensure the database table exists. */
    override async initialize(): Promise<void> {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.logInfo('Initializing shared prompts service...');
        this.initPromise = this.ensureTable().catch((error: RuntimeValue) => {
            this.initPromise = null;
            throw error;
        });
        await this.initPromise;
    }

    private async ensureReady(): Promise<void> {
        await this.initialize();
    }

    /** Ensure the shared_prompts table exists. */
    private async ensureTable(): Promise<void> {
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS shared_prompts (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT '',
                tags TEXT NOT NULL DEFAULT '[]',
                author TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `);
    }

    /** Create a new shared prompt. */
    @ipc('shared-prompts:create')
    async create(input: SharedPromptInput): Promise<SharedPrompt> {
        await this.ensureReady();
        const now = Date.now();
        const prompt: SharedPrompt = {
            id: uuidv4(),
            title: input.title,
            content: input.content,
            category: input.category ?? '',
            tags: input.tags ?? [],
            author: input.author ?? '',
            createdAt: now,
            updatedAt: now,
        };
        const stmt = await this.db.prepare(
            `INSERT INTO shared_prompts (id, title, content, category, tags, author, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
        );
        await stmt.run(prompt.id, prompt.title, prompt.content, prompt.category,
            JSON.stringify(prompt.tags), prompt.author, prompt.createdAt, prompt.updatedAt);
        this.logInfo(`Created shared prompt: ${prompt.id}`);
        return prompt;
    }

    /** Get a shared prompt by ID. */
    @ipc('shared-prompts:getById')
    async getById(id: string): Promise<SharedPrompt | undefined> {
        await this.ensureReady();
        const stmt = await this.db.prepare(
            `SELECT * FROM shared_prompts WHERE id = $1`
        );
        const row = await stmt.get<SharedPromptRow>(id);
        return row ? this.mapRow(row) : undefined;
    }

    /** List shared prompts with optional filtering. */
    @ipc('shared-prompts:list')
    async list(filter?: SharedPromptFilter): Promise<SharedPrompt[]> {
        await this.ensureReady();
        const conditions: string[] = [];
        const params: (string | number)[] = [];
        let paramIndex = 1;

        if (filter?.query) {
            conditions.push(`(title ILIKE $${paramIndex} OR content ILIKE $${paramIndex})`);
            params.push(`%${filter.query}%`);
            paramIndex++;
        }
        if (filter?.category) {
            conditions.push(`category = $${paramIndex}`);
            params.push(filter.category);
            paramIndex++;
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = Math.min(filter?.limit ?? 100, MAX_SEARCH_LIMIT);
        const offset = filter?.offset ?? 0;

        const sql = `SELECT * FROM shared_prompts ${where} ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}`;
        const result = await this.db.query<SharedPromptRow>(sql, params);
        const prompts = result.rows.map((row) => this.mapRow(row));

        if (filter?.tags && filter.tags.length > 0) {
            const filterTags = filter.tags;
            return prompts.filter((p) =>
                filterTags.some((tag) => p.tags.includes(tag))
            );
        }
        return prompts;
    }

    /** Update an existing shared prompt. */
    @ipc('shared-prompts:update')
    async update(payload: { id: string, input: Partial<SharedPromptInput> }): Promise<SharedPrompt | undefined> {
        const { id, input } = payload;
        await this.ensureReady();
        const existing = await this.getById(id);
        if (!existing) {return undefined;}

        const updated: SharedPrompt = {
            ...existing,
            title: input.title ?? existing.title,
            content: input.content ?? existing.content,
            category: input.category ?? existing.category,
            tags: input.tags ?? existing.tags,
            author: input.author ?? existing.author,
            updatedAt: Date.now(),
        };
        const stmt = await this.db.prepare(
            `UPDATE shared_prompts SET title=$1, content=$2, category=$3, tags=$4, author=$5, updated_at=$6 WHERE id=$7`
        );
        await stmt.run(updated.title, updated.content, updated.category,
            JSON.stringify(updated.tags), updated.author, updated.updatedAt, id);
        this.logInfo(`Updated shared prompt: ${id}`);
        return updated;
    }

    /** Delete a shared prompt by ID. */
    @ipc('shared-prompts:delete')
    async delete(id: string): Promise<boolean> {
        await this.ensureReady();
        const stmt = await this.db.prepare(`DELETE FROM shared_prompts WHERE id = $1`);
        const result = await stmt.run(id);
        const deleted = (result.rowsAffected ?? 0) > 0;
        if (deleted) {this.logInfo(`Deleted shared prompt: ${id}`);}
        return deleted;
    }

    /** Export all shared prompts as a JSON string. */
    @ipc('shared-prompts:exportToJson')
    async exportToJson(): Promise<string> {
        await this.ensureReady();
        const prompts = await this.list({ limit: MAX_SEARCH_LIMIT });
        return JSON.stringify(prompts, null, 2);
    }

    /** Import shared prompts from a JSON string. */
    @ipc('shared-prompts:importFromJson')
    async importFromJson(jsonString: string): Promise<number> {
        await this.ensureReady();
        let data: RuntimeValue;
        try {
            data = JSON.parse(jsonString);
        } catch {
            throw new Error('Invalid JSON format for shared prompts import');
        }
        if (!Array.isArray(data)) {
            throw new Error('Expected an array of shared prompts');
        }
        let imported = 0;
        for (const item of data) {
            const record = item as Record<string, RuntimeValue>;
            if (typeof record.title === 'string' && typeof record.content === 'string') {
                await this.create({
                    title: record.title,
                    content: record.content,
                    category: typeof record.category === 'string' ? record.category : '',
                    tags: Array.isArray(record.tags) ? record.tags as string[] : [],
                    author: typeof record.author === 'string' ? record.author : '',
                });
                imported++;
            }
        }
        this.logInfo(`Imported ${imported} shared prompts`);
        return imported;
    }

    /** Import shared prompts from a JSON file path. */
    @ipc('shared-prompts:importFromFile')
    async importFromFile(filePath: string): Promise<number> {
        const content = await fsPromises.readFile(filePath, 'utf-8');
        return this.importFromJson(content);
    }

    /** Export shared prompts to a JSON file. */
    @ipc('shared-prompts:exportToFile')
    async exportToFile(filePath: string): Promise<void> {
        const json = await this.exportToJson();
        await fsPromises.writeFile(filePath, json, 'utf-8');
        this.logInfo(`Exported shared prompts to: ${filePath}`);
    }

    /** Map a database row to a SharedPrompt object. */
    private mapRow(row: SharedPromptRow): SharedPrompt {
        let tags: string[] = [];
        try {
            tags = JSON.parse(row.tags) as string[];
        } catch {
            appLogger.warn('SharedPromptsService', `Failed to parse tags for prompt ${row.id}`);
        }
        return {
            id: row.id,
            title: row.title,
            content: row.content,
            category: row.category,
            tags,
            author: row.author,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    override async cleanup(): Promise<void> {
        this.initPromise = null;
        this.logInfo('Cleaning up shared prompts service');
    }
}
