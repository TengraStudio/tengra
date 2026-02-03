/**
 * Prompt Templates Library Service
 * Manages reusable prompt templates with variable substitution
 */

import * as fs from 'fs';
import * as path from 'path';

import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import { DatabaseService } from '@main/services/data/database.service';
import { BUILTIN_TEMPLATES, PromptTemplate, renderTemplate as renderUtil } from '@main/utils/prompt-templates.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';

export class PromptTemplatesService extends BaseService {
    private templatesPath: string;
    private customTemplates: PromptTemplate[] = [];

    constructor(
        private dataService: DataService,
        private databaseService: DatabaseService
    ) {
        super('PromptTemplatesService');
        this.templatesPath = path.join(this.dataService.getPath('db'), 'prompt-templates.json');
        void this.initialize();
    }

    public async initialize() {
        await this.migrateLegacyData();
        await this.loadCustomTemplates();
    }

    /**
     * Get all templates (builtin + custom)
     */
    getAllTemplates(): PromptTemplate[] {
        return [...BUILTIN_TEMPLATES, ...this.customTemplates];
    }

    /**
     * Get templates by category
     */
    getByCategory(category: string): PromptTemplate[] {
        return this.getAllTemplates().filter(t => t.category === category);
    }

    /**
     * Get templates by tag
     */
    getByTag(tag: string): PromptTemplate[] {
        return this.getAllTemplates().filter(t => t.tags?.includes(tag));
    }

    /**
     * Search templates by name or description
     */
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
    getTemplate(id: string): PromptTemplate | undefined {
        return this.getAllTemplates().find(t => t.id === id);
    }

    /**
     * Create a new custom template
     */
    async createTemplate(template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<PromptTemplate> {
        const newTemplate: PromptTemplate = {
            ...template,
            id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
