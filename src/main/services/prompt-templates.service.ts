/**
 * Prompt Templates Library Service
 * Manages reusable prompt templates with variable substitution
 */

import * as fs from 'fs'
import * as path from 'path'
import { DataService } from './data/data.service'
import { PromptTemplate, TemplateManager, BUILTIN_TEMPLATES } from '../utils/prompt-templates.util'
import { BaseService } from './base.service'

export class PromptTemplatesService extends BaseService {
    private templatesPath: string
    private templateManager: TemplateManager
    private customTemplates: PromptTemplate[] = []

    constructor(private dataService: DataService) {
        super('PromptTemplatesService')
        this.templatesPath = path.join(this.dataService.getPath('db'), 'prompt-templates.json')
        this.templateManager = new TemplateManager()
        this.loadCustomTemplates()
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
    createTemplate(template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>): PromptTemplate {
        const newTemplate: PromptTemplate = {
            ...template,
            id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }

        this.customTemplates.push(newTemplate)
        this.saveCustomTemplates()

        return newTemplate
    }

    /**
     * Update an existing custom template
     */
    updateTemplate(id: string, updates: Partial<Omit<PromptTemplate, 'id' | 'createdAt'>>): PromptTemplate | null {
        const index = this.customTemplates.findIndex(t => t.id === id)
        if (index === -1) {
            return null
        }

        this.customTemplates[index] = {
            ...this.customTemplates[index],
            ...updates,
            updatedAt: Date.now()
        }

        this.saveCustomTemplates()
        return this.customTemplates[index]
    }

    /**
     * Delete a custom template
     */
    deleteTemplate(id: string): boolean {
        const index = this.customTemplates.findIndex(t => t.id === id)
        if (index === -1) {
            return false
        }

        this.customTemplates.splice(index, 1)
        this.saveCustomTemplates()
        return true
    }

    /**
     * Render a template with variables
     */
    renderTemplate(templateId: string, variables: Record<string, string>): string | null {
        const template = this.getTemplate(templateId)
        if (!template) {
            return null
        }

        const result = this.templateManager.render(templateId, variables)
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
     * Load custom templates from disk
     */
    private loadCustomTemplates(): void {
        try {
            if (fs.existsSync(this.templatesPath)) {
                const content = fs.readFileSync(this.templatesPath, 'utf-8')
                this.customTemplates = JSON.parse(content) as PromptTemplate[]
            }
        } catch (error) {
            this.logError('Failed to load custom templates', error)
            this.customTemplates = []
        }
    }

    /**
     * Save custom templates to disk
     */
    private saveCustomTemplates(): void {
        try {
            const dir = path.dirname(this.templatesPath)
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true })
            }
            fs.writeFileSync(this.templatesPath, JSON.stringify(this.customTemplates, null, 2))
        } catch (error) {
            this.logError('Failed to save custom templates', error)
        }
    }
}
