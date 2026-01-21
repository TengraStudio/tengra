/**
 * Prompt Templates Library Service
 * Manages reusable prompt templates with variable substitution
 */

import * as fs from 'fs'
import * as path from 'path'

import { BaseService } from '@main/services/base.service'
import { DataService } from '@main/services/data/data.service'
import { DatabaseService } from '@main/services/data/database.service'
import { BUILTIN_TEMPLATES, PromptTemplate, renderTemplate as renderUtil } from '@main/utils/prompt-templates.util'
import { safeJsonParse } from '@shared/utils/sanitize.util'

export class PromptTemplatesService extends BaseService {
    private templatesPath: string
    private customTemplates: PromptTemplate[] = []

    constructor(
        private dataService: DataService,
        private databaseService: DatabaseService
    ) {
        super('PromptTemplatesService')
        this.templatesPath = path.join(this.dataService.getPath('db'), 'prompt-templates.json')
        void this.initialize()
    }

    public async initialize() {
        await this.migrateLegacyData()
        await this.loadCustomTemplates()
    }

    /**
     * Get all templates (builtin + custom)
     */
    getAllTemplates(): PromptTemplate[] {
        return [...BUILTIN_TEMPLATES, ...this.customTemplates]
    }

    /**
     * Get templates by category
     */
    getByCategory(category: string): PromptTemplate[] {
        return this.getAllTemplates().filter(t => t.category === category)
    }

    /**
     * Get templates by tag
     */
    getByTag(tag: string): PromptTemplate[] {
        return this.getAllTemplates().filter(t => t.tags?.includes(tag))
    }

    /**
     * Search templates by name or description
     */
    search(query: string): PromptTemplate[] {
        const lowerQuery = query.toLowerCase()
        return this.getAllTemplates().filter(t =>
            t.name.toLowerCase().includes(lowerQuery) ||
            t.description?.toLowerCase().includes(lowerQuery) ||
            t.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
        )
    }

    /**
     * Get a template by ID
     */
    getTemplate(id: string): PromptTemplate | undefined {
        return this.getAllTemplates().find(t => t.id === id)
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
        }

        await this.databaseService.addCustomTemplate(newTemplate)
        this.customTemplates.push(newTemplate)

        return newTemplate
    }

    /**
     * Update an existing custom template
     */
    async updateTemplate(id: string, updates: Partial<Omit<PromptTemplate, 'id' | 'createdAt'>>): Promise<PromptTemplate | null> {
        const index = this.customTemplates.findIndex(t => t.id === id)
        if (index === -1) {
            return null
        }

        const updatedTemplate = {
            ...this.customTemplates[index],
            ...updates,
            updatedAt: Date.now()
        }

        await this.databaseService.updateCustomTemplate(id, updatedTemplate)
        this.customTemplates[index] = updatedTemplate

        return updatedTemplate
    }

    /**
     * Delete a custom template
     */
    async deleteTemplate(id: string): Promise<boolean> {
        const index = this.customTemplates.findIndex(t => t.id === id)
        if (index === -1) {
            return false
        }

        await this.databaseService.deleteCustomTemplate(id)
        this.customTemplates.splice(index, 1)
        return true
    }

    /**
     * Render a template with variables
     */
    renderTemplate(templateId: string, variables: Record<string, string>): string | null {
        // Need to ensure custom templates are loaded in TemplateManager or just find it directly
        // TemplateManager logic was mainly "findById" which maps to our methods
        // But TemplateManager had its own internal state in the original code? 
        // Let's look at `templateManager.render`: it calls `findById`.
        // The `templateManager` instance in this class is just a helper but we are not populating it?
        // Original code: `this.templateManager = new TemplateManager()` then never added templates to it?
        // Wait, `templateManager` in `prompt-templates.util.ts` has methods like `getAllTemplates`.
        // The original service was keeping its own `customTemplates` array and using `templateManager` JUST for `render` method logic?
        // `templateManager.render` calls `this.findById` which looks at its internal array.
        // So `this.templateManager` in the original code was probably EMPTY of custom templates unless they were added?
        // Actually looking at original code:
        // `renderTemplate` calls `this.getTemplate(templateId)` from SERVICE, getting it from service's array.
        // Then calls `this.templateManager.render(templateId, variables)`.
        // BUT `templateManager.render` calls `this.findById` on itself // If `templateManager` is empty of custom templates, it won't find it if it's a custom one.
        // The original code might have been buggy or `TemplateManager` logic was:
        // `render` calls `findById`.
        // If `BUILTIN_TEMPLATES` are in `TemplateManager` (yes via `getAllTemplates` spreading `BUILTIN_TEMPLATES`), then builtins work.
        // But custom templates? `TemplateManager` has `customTemplates` array.
        // In original service, `this.customTemplates` was populated from disk.
        // But `this.templateManager` was NEW. It had EMPTY custom templates.
        // So `renderTemplate` for CUSTOM templates would FAIL in original code unless I missed where it syncs.
        // Ah, `renderTemplate` in original code:
        /*
        renderTemplate(templateId: string, variables: Record<string, string>): string | null {
            const template = this.getTemplate(templateId) // Finds in Service
            if (!template) { return null }
            const result = this.templateManager.render(templateId, variables)
            return result.content
        }
        */
        // If `templateManager` doesn't know about the custom template, `render` throws "Template not found".
        // So strict migration suggests I should fix this bug too if it exists.
        // Or maybe I should just use `renderTemplate` utility function directly instead of `TemplateManager` class instance.

        const template = this.getTemplate(templateId)
        if (!template) {
            return null
        }

        const result = renderUtil(template.template, variables)
        return result.content
    }

    /**
     * Get all categories
     */
    getCategories(): string[] {
        const categories = new Set<string>()
        this.getAllTemplates().forEach(t => {
            if (t.category) {
                categories.add(t.category)
            }
        })
        return Array.from(categories).sort()
    }

    /**
     * Get all tags
     */
    getTags(): string[] {
        const tags = new Set<string>()
        this.getAllTemplates().forEach(t => {
            t.tags?.forEach(tag => tags.add(tag))
        })
        return Array.from(tags).sort()
    }

    /**
     * Load custom templates from DB
     */
    private async loadCustomTemplates(): Promise<void> {
        try {
            this.customTemplates = await this.databaseService.getCustomTemplates()
        } catch (error) {
            this.logError('Failed to load custom templates', error)
            this.customTemplates = []
        }
    }

    /**
     * Migrate legacy JSON data to DB
     */
    private async migrateLegacyData(): Promise<void> {
        if (!fs.existsSync(this.templatesPath)) {
            return
        }

        try {
            this.logInfo('[PromptTemplatesService] Migrating legacy templates...')
            const content = await fs.promises.readFile(this.templatesPath, 'utf-8')
            const templates = safeJsonParse<PromptTemplate[]>(content, [])

            if (Array.isArray(templates)) {
                for (const template of templates) {
                    // Check if already exists to avoid duplicates (though ID should be unique)
                    const exists = await this.databaseService.getCustomTemplates()
                        .then(rows => rows.some(r => r.id === template.id))

                    if (!exists) {
                        await this.databaseService.addCustomTemplate(template)
                    }
                }
            }

            // Rename legacy file
            await fs.promises.rename(this.templatesPath, this.templatesPath + '.migrated')
            this.logInfo('[PromptTemplatesService] Migration completed.')
        } catch (error) {
            this.logError('Failed to migrate legacy templates', error)
        }
    }
}
