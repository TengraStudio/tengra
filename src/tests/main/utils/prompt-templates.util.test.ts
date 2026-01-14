
import { describe, it, expect } from 'vitest'
import { renderTemplate, extractVariables, validateTemplate, PromptTemplate } from '../../../main/utils/prompt-templates.util'

describe('Prompt Templates', () => {
    describe('renderTemplate', () => {
        it('should replace simple variables', () => {
            const result = renderTemplate('Hello {{name}}!', { name: 'World' })
            expect(result.content).toBe('Hello World!')
            expect(result.usedVariables).toContain('name')
            expect(result.missingVariables).toHaveLength(0)
        })

        it('should handle multiple variables', () => {
            const result = renderTemplate(
                '{{greeting}} {{name}}, welcome to {{place}}!',
                { greeting: 'Hello', name: 'Alice', place: 'Wonderland' }
            )
            expect(result.content).toBe('Hello Alice, welcome to Wonderland!')
            expect(result.usedVariables).toHaveLength(3)
        })

        it('should use default values', () => {
            const result = renderTemplate('Hello {{name|Guest}}!', {})
            expect(result.content).toBe('Hello Guest!')
            expect(result.missingVariables).toHaveLength(0)
        })

        it('should track missing variables', () => {
            const result = renderTemplate('Hello {{name}}!', {})
            expect(result.content).toBe('Hello {{name}}!')
            expect(result.missingVariables).toContain('name')
        })

        it('should handle mixed present and missing variables', () => {
            const result = renderTemplate(
                '{{greeting}} {{name}}!',
                { greeting: 'Hi' }
            )
            expect(result.content).toBe('Hi {{name}}!')
            expect(result.usedVariables).toContain('greeting')
            expect(result.missingVariables).toContain('name')
        })
    })

    describe('extractVariables', () => {
        it('should extract simple variables', () => {
            const vars = extractVariables('Hello {{name}}!')
            expect(vars).toEqual(['name'])
        })

        it('should extract multiple variables', () => {
            const vars = extractVariables('{{a}} and {{b}} and {{c}}')
            expect(vars).toEqual(['a', 'b', 'c'])
        })

        it('should extract variables with defaults', () => {
            const vars = extractVariables('Hello {{name|World}}!')
            expect(vars).toEqual(['name'])
        })

        it('should not duplicate variables', () => {
            const vars = extractVariables('{{name}} {{name}} {{name}}')
            expect(vars).toEqual(['name'])
        })

        it('should return empty array for no variables', () => {
            const vars = extractVariables('Hello World!')
            expect(vars).toEqual([])
        })
    })

    describe('validateTemplate', () => {
        it('should validate a correct template', () => {
            const template: PromptTemplate = {
                id: 'test',
                name: 'Test Template',
                template: 'Hello {{name}}!',
                variables: [{ name: 'name', type: 'string' }],
                createdAt: Date.now(),
                updatedAt: Date.now()
            }
            const result = validateTemplate(template)
            expect(result.valid).toBe(true)
            expect(result.errors).toHaveLength(0)
        })

        it('should catch unused declared variables', () => {
            const template: PromptTemplate = {
                id: 'test',
                name: 'Test Template',
                template: 'Hello World!',
                variables: [{ name: 'unused', type: 'string' }],
                createdAt: Date.now(),
                updatedAt: Date.now()
            }
            const result = validateTemplate(template)
            expect(result.valid).toBe(false)
            expect(result.errors.some(e => e.includes('unused'))).toBe(true)
        })

        it('should catch undeclared variables', () => {
            const template: PromptTemplate = {
                id: 'test',
                name: 'Test Template',
                template: 'Hello {{name}}!',
                variables: [],
                createdAt: Date.now(),
                updatedAt: Date.now()
            }
            const result = validateTemplate(template)
            expect(result.valid).toBe(false)
            expect(result.errors.some(e => e.includes('name'))).toBe(true)
        })

        it('should require essential fields', () => {
            const template = {
                id: '',
                name: '',
                template: '',
                variables: [],
                createdAt: Date.now(),
                updatedAt: Date.now()
            } as PromptTemplate
            const result = validateTemplate(template)
            expect(result.valid).toBe(false)
            expect(result.errors.length).toBeGreaterThan(0)
        })
    })
})
