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
 * Prompt Templates Library Service
 * Manages reusable prompt templates with variable substitution
 */

import * as fs from 'fs';
import * as path from 'path';

import { ipc } from '@main/core/ipc-decorators';
import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import { DatabaseService } from '@main/services/data/database.service';
import { serializeToIpc } from '@main/utils/ipc-serializer.util';
import { BUILTIN_TEMPLATES, PromptTemplate, renderTemplate as renderUtil } from '@main/utils/prompt-templates.util';
import { RuntimeValue } from '@shared/types/common';
import { safeJsonParse } from '@shared/utils/sanitize.util';

type UnsafeValue = ReturnType<typeof JSON.parse>;

export class PromptTemplatesService extends BaseService {
    private templatesPath: string;
    private customTemplates: PromptTemplate[] = [];

    constructor(
        private dataService: DataService,
        private databaseService: DatabaseService
    ) {
        super('PromptTemplatesService');
        this.templatesPath = path.join(this.dataService.getPath('db'), 'prompt-templates.json');
    }

    public async initialize() {
        await this.migrateLegacyData();
        await this.loadCustomTemplates();
    }

    /** Clears in-memory custom templates. */
    async cleanup(): Promise<void> {
        this.customTemplates = [];
        this.logInfo('Prompt templates service cleaned up');
    }

    /**
     * Get all templates (builtin + custom)
     */
    @ipc('prompt-templates:getAll')
    getAllTemplatesIpc(): RuntimeValue {
        return serializeToIpc(this.getAllTemplates());
    }

    getAllTemplates(): PromptTemplate[] {
        return [...BUILTIN_TEMPLATES, ...this.customTemplates];
    }

    /**
     * Get templates by category
     */
    @ipc('prompt-templates:getByCategory')
    getByCategoryIpc(category: RuntimeValue): RuntimeValue {
        if (typeof category !== 'string') {return serializeToIpc([]);}
        return serializeToIpc(this.getByCategory(category));
    }

    getByCategory(category: string): PromptTemplate[] {
        return this.getAllTemplates().filter(t => t.category === category);
    }

    /**
     * Get templates by tag
     */
    @ipc('prompt-templates:getByTag')
    getByTagIpc(tag: RuntimeValue): RuntimeValue {
        if (typeof tag !== 'string') {return serializeToIpc([]);}
        return serializeToIpc(this.getByTag(tag));
    }

    getByTag(tag: string): PromptTemplate[] {
        return this.getAllTemplates().filter(t => t.tags?.includes(tag));
    }

    /**
     * Search templates by name or description
     */
    @ipc('prompt-templates:search')
    searchIpc(query: RuntimeValue): RuntimeValue {
        if (typeof query !== 'string') {return serializeToIpc([]);}
        return serializeToIpc(this.search(query));
    }

    search(query: string): PromptTemplate[] {
        const lowerQuery = query.toLowerCase();
        return this.getAllTemplates().filter(t =>
            t.name.toLowerCase().includes(lowerQuery) ||
            (t.description?.toLowerCase().includes(lowerQuery) ?? false) ||
            (t.tags?.some(tag => tag.toLowerCase().includes(lowerQuery)) ?? false)
        );
    }

    /**
     * Get a template by ID
     */
    @ipc('prompt-templates:get')
    async getTemplateIpc(id: RuntimeValue): Promise<RuntimeValue> {
        if (typeof id !== 'string') {return serializeToIpc(null);}
        return serializeToIpc(this.getTemplate(id) ?? null);
    }

    getTemplate(id: string): PromptTemplate | undefined {
        return this.getAllTemplates().find(t => t.id === id);
    }

    /**
     * Create a new custom template
     */
    @ipc('prompt-templates:create')
    async createTemplateIpc(template: UnsafeValue): Promise<RuntimeValue> {
        return serializeToIpc(await this.createTemplate(template));
    }

    async createTemplate(template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<PromptTemplate> {
        const newTemplate: PromptTemplate = {
            ...template,
            id: `custom-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        await this.databaseService.addCustomTemplate(newTemplate);
        this.customTemplates.push(newTemplate);

        return newTemplate;
    }

    /**
     * Update an existing custom template
     */
    @ipc('prompt-templates:update')
    async updateTemplateIpc(id: RuntimeValue, updates: UnsafeValue): Promise<RuntimeValue> {
        if (typeof id !== 'string') {throw new Error('Invalid template ID');}
        const result = await this.updateTemplate(id, updates);
        if (!result) {
            throw new Error(`Template not found: ${id}`);
        }
        return serializeToIpc(result);
    }

    async updateTemplate(id: string, updates: Partial<Omit<PromptTemplate, 'id' | 'createdAt'>>): Promise<PromptTemplate | null> {
        const index = this.customTemplates.findIndex(t => t.id === id);
        if (index === -1) {
            return null;
        }

        const updatedTemplate = {
            ...this.customTemplates[index],
            ...updates,
            updatedAt: Date.now()
        };

        await this.databaseService.updateCustomTemplate(id, updatedTemplate);
        this.customTemplates[index] = updatedTemplate;

        return updatedTemplate;
    }

    /**
     * Delete a custom template
     */
    @ipc('prompt-templates:delete')
    async deleteTemplateIpc(id: RuntimeValue): Promise<RuntimeValue> {
        if (typeof id !== 'string') {throw new Error('Invalid template ID');}
        const success = await this.deleteTemplate(id);
        if (!success) {
            throw new Error(`Template not found: ${id}`);
        }
        return serializeToIpc({ success: true });
    }

    async deleteTemplate(id: string): Promise<boolean> {
        const index = this.customTemplates.findIndex(t => t.id === id);
        if (index === -1) {
            return false;
        }

        await this.databaseService.deleteCustomTemplate(id);
        this.customTemplates.splice(index, 1);
        return true;
    }

    /**
     * Render a template with variables
     */
    @ipc('prompt-templates:render')
    async renderTemplateIpc(id: RuntimeValue, variables: UnsafeValue): Promise<RuntimeValue> {
        if (typeof id !== 'string' || !variables || typeof variables !== 'object') {
            return serializeToIpc('');
        }
        const result = await this.renderTemplate(id, variables);
        return serializeToIpc(result ?? '');
    }

    renderTemplate(templateId: string, variables: Record<string, string>): string | null {
        const template = this.getTemplate(templateId);
        if (!template) {
            return null;
        }

        const result = renderUtil(template.template, variables);
        return result.content;
    }

    /**
     * Get all categories
     */
    @ipc('prompt-templates:getCategories')
    getCategoriesIpc(): RuntimeValue {
        return serializeToIpc(this.getCategories());
    }

    getCategories(): string[] {
        const categories = new Set<string>();
        this.getAllTemplates().forEach(t => {
            if (t.category) {
                categories.add(t.category);
            }
        });
        return Array.from(categories).sort();
    }

    /**
     * Get all tags
     */
    @ipc('prompt-templates:getTags')
    getTagsIpc(): RuntimeValue {
        return serializeToIpc(this.getTags());
    }

    getTags(): string[] {
        const tags = new Set<string>();
        this.getAllTemplates().forEach(t => {
            t.tags?.forEach(tag => tags.add(tag));
        });
        return Array.from(tags).sort();
    }

    /**
     * Load custom templates from DB
     */
    private async loadCustomTemplates(): Promise<void> {
        try {
            this.customTemplates = await this.databaseService.getCustomTemplates();
        } catch (error) {
            this.logError('Failed to load custom templates', error);
            this.customTemplates = [];
        }
    }

    /**
     * Migrate legacy JSON data to DB
     */
    private async migrateLegacyData(): Promise<void> {
        if (!fs.existsSync(this.templatesPath)) {
            return;
        }

        try {
            this.logInfo('[PromptTemplatesService] Migrating legacy templates...');
            const content = await fs.promises.readFile(this.templatesPath, 'utf-8');
            const templates = safeJsonParse<PromptTemplate[]>(content, []);

            if (Array.isArray(templates)) {
                for (const template of templates) {
                    // Check if already exists to avoid duplicates (though ID should be unique)
                    const exists = await this.databaseService.getCustomTemplates()
                        .then(rows => rows.some(r => r.id === template.id));

                    if (!exists) {
                        await this.databaseService.addCustomTemplate(template);
                    }
                }
            }

            // Rename legacy file
            await fs.promises.rename(this.templatesPath, this.templatesPath + '.migrated');
            this.logInfo('[PromptTemplatesService] Migration completed.');
        } catch (error) {
            this.logError('Failed to migrate legacy templates', error);
        }
    }
}
