/**
 * Prompt Templates System
 * Reusable prompts with variable substitution
 */

import { JsonObject } from '@shared/types/common';

// SEC-015-3: Patterns that could indicate prompt injection attempts
const PROMPT_INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?)/i,
    /disregard\s+(all\s+)?(previous|above|prior)/i,
    /forget\s+(everything|all|what)/i,
    /new\s+instructions?:/i,
    /system\s*:\s*you\s+are/i,
    /\[INST\]/i,
    /\[\/INST\]/i,
    /<\|im_start\|>/i,
    /<\|im_end\|>/i,
    /```system/i,
    /\{\{.*\}\}/  // Nested template variables
];

/**
 * SEC-015-3: Escape user input to prevent prompt injection
 * @param input - Raw user input
 * @param strict - If true, also removes suspicious patterns
 * @returns Sanitized input
 */
export function escapePromptInput(input: string, strict: boolean = false): string {
    if (typeof input !== 'string') {
        return String(input);
    }

    let sanitized = input;

    // Escape template variable syntax to prevent injection of new variables
    sanitized = sanitized.replace(/\{\{/g, '{ {').replace(/\}\}/g, '} }');

    // In strict mode, check for and neutralize injection patterns
    if (strict) {
        for (const pattern of PROMPT_INJECTION_PATTERNS) {
            if (pattern.test(sanitized)) {
                // Replace suspicious content with a marker
                sanitized = sanitized.replace(pattern, '[FILTERED]');
            }
        }
    }

    return sanitized;
}

/**
 * SEC-015-3: Check if input contains potential prompt injection
 * @param input - User input to check
 * @returns Object with detection result and matched patterns
 */
export function detectPromptInjection(input: string): {
    detected: boolean;
    patterns: string[];
    riskLevel: 'low' | 'medium' | 'high';
} {
    if (typeof input !== 'string') {
        return { detected: false, patterns: [], riskLevel: 'low' };
    }

    const matchedPatterns: string[] = [];

    for (const pattern of PROMPT_INJECTION_PATTERNS) {
        if (pattern.test(input)) {
            matchedPatterns.push(pattern.source);
        }
    }

    const detected = matchedPatterns.length > 0;
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    if (matchedPatterns.length >= 3) {
        riskLevel = 'high';
    } else if (matchedPatterns.length >= 1) {
        riskLevel = 'medium';
    }

    return { detected, patterns: matchedPatterns, riskLevel };
}

export interface PromptTemplate {
    id: string
    name: string
    description?: string
    template: string
    variables: TemplateVariable[]
    category?: string
    tags?: string[]
    createdAt: number
    updatedAt: number
}

export interface TemplateVariable {
    name: string
    type: 'string' | 'number' | 'boolean' | 'select' | 'textarea'
    description?: string
    defaultValue?: string | number | boolean
    required?: boolean
    options?: string[] // For 'select' type
    placeholder?: string
}

export interface RenderResult {
    content: string
    missingVariables: string[]
    usedVariables: string[]
}

/**
 * Options for template rendering
 */
export interface RenderOptions {
    /** Enable strict escaping to filter suspicious patterns (default: false) */
    strictEscaping?: boolean;
    /** Skip escaping entirely - only use for trusted inputs (default: false) */
    skipEscaping?: boolean;
}

/**
 * Render a template with variables
 * SEC-015-3: User inputs are escaped by default to prevent prompt injection
 */
export function renderTemplate(
    template: string,
    variables: JsonObject,
    options: RenderOptions = {}
): RenderResult {
    const { strictEscaping = false, skipEscaping = false } = options;
    const missingVariables: string[] = [];
    const usedVariables: string[] = [];

    // Find all variable placeholders: {{variableName}} or {{variableName|default}}
    const varPattern = /\{\{(\w+)(?:\|([^}]*))?\}\}/g;

    const content = template.replace(varPattern, (match, varName: string, defaultValue) => {
        if (variables[varName] !== undefined) {
            usedVariables.push(varName);
            const rawValue = String(variables[varName]);
            // SEC-015-3: Escape user input unless explicitly skipped
            return skipEscaping ? rawValue : escapePromptInput(rawValue, strictEscaping);
        }

        if (defaultValue !== undefined) {
            return defaultValue as string;
        }

        missingVariables.push(varName);
        return match; // Keep placeholder if no value
    });

    return {
        content,
        missingVariables,
        usedVariables
    };
}

/**
 * Extract variables from a template string
 */
export function extractVariables(template: string): string[] {
    const varPattern = /\{\{(\w+)(?:\|[^}]*)?\}\}/g;
    const variables: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = varPattern.exec(template)) !== null) {
        if (!variables.includes(match[1])) {
            variables.push(match[1]);
        }
    }

    return variables;
}

/**
 * Validate a template
 */
export function validateTemplate(template: PromptTemplate): {
    valid: boolean
    errors: string[]
} {
    const errors: string[] = [];

    if (!template.id) { errors.push('Template ID is required'); }
    if (!template.name) { errors.push('Template name is required'); }
    if (!template.template) { errors.push('Template content is required'); }

    // Check that all declared variables exist in template
    const templateVars = extractVariables(template.template);
    for (const variable of template.variables) {
        if (!templateVars.includes(variable.name)) {
            errors.push(`Variable "${variable.name}" is declared but not used in template`);
        }
    }

    // Check that all template variables are declared
    for (const varName of templateVars) {
        if (!template.variables.find(v => v.name === varName)) {
            errors.push(`Variable "${varName}" is used but not declared`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

// Built-in templates
export const BUILTIN_TEMPLATES: PromptTemplate[] = [
    {
        id: 'code-review',
        name: 'Code Review',
        description: 'Review code for bugs, security issues, and improvements',
        template: `Review the following {{language}} code for:
- Bugs and potential issues
- Security vulnerabilities (secrets, injection risks)
- Performance improvements
- Code style and best practices
- Type safety (no 'any' or 'unknown')
- Debugging artifacts (console.log)

{{focus}}

\`\`\`{{language}}
{{code}}
\`\`\`

Provide detailed feedback with specific line references where applicable.`,
        variables: [
            { name: 'language', type: 'string', defaultValue: 'typescript', placeholder: 'programming language' },
            { name: 'code', type: 'textarea', required: true, placeholder: 'Paste your code here' },
            { name: 'focus', type: 'textarea', placeholder: 'Any specific areas to focus on?' }
        ],
        category: 'development',
        tags: ['code', 'review', 'quality'],
        createdAt: Date.now(),
        updatedAt: Date.now()
    },
    {
        id: 'explain-code',
        name: 'Explain Code',
        description: 'Get a detailed explanation of code',
        template: `Explain the following {{language}} code in detail:

\`\`\`{{language}}
{{code}}
\`\`\`

Explain:
1. What the code does overall
2. How each major section works
3. Any important patterns or techniques used
4. Potential edge cases or limitations

Target explanation level: {{level|intermediate}}`,
        variables: [
            { name: 'language', type: 'string', defaultValue: 'typescript' },
            { name: 'code', type: 'textarea', required: true },
            { name: 'level', type: 'select', options: ['beginner', 'intermediate', 'advanced'], defaultValue: 'intermediate' }
        ],
        category: 'development',
        tags: ['code', 'explanation', 'learning'],
        createdAt: Date.now(),
        updatedAt: Date.now()
    },
    {
        id: 'write-tests',
        name: 'Write Unit Tests',
        description: 'Generate unit tests for code',
        template: `Write comprehensive unit tests for the following {{language}} code using {{framework}}:

\`\`\`{{language}}
{{code}}
\`\`\`

Requirements:
- Cover happy path and edge cases
- Include error handling tests
- Use descriptive test names
- Mock external dependencies/services if needed

{{additionalRequirements}}`,
        variables: [
            { name: 'language', type: 'string', defaultValue: 'typescript' },
            { name: 'framework', type: 'string', defaultValue: 'vitest', placeholder: 'testing framework' },
            { name: 'code', type: 'textarea', required: true },
            { name: 'additionalRequirements', type: 'textarea', placeholder: 'Any additional test requirements' }
        ],
        category: 'development',
        tags: ['testing', 'unit tests', 'quality'],
        createdAt: Date.now(),
        updatedAt: Date.now()
    },
    {
        id: 'refactor-code',
        name: 'Refactor Code',
        description: 'Suggest refactoring improvements',
        template: `Refactor the following {{language}} code with a focus on {{goal}}:

\`\`\`{{language}}
{{code}}
\`\`\`

Guidelines:
- Maintain functionality
- Improve {{goal}}
- Follow {{language}} best practices
- Apply "Boy Scout Rule" (fix adjacent warnings)
- Add comments explaining significant changes

Provide the refactored code with explanations for each change.`,
        variables: [
            { name: 'language', type: 'string', defaultValue: 'typescript' },
            { name: 'goal', type: 'select', options: ['readability', 'performance', 'maintainability', 'testability', 'all'], defaultValue: 'readability' },
            { name: 'code', type: 'textarea', required: true }
        ],
        category: 'development',
        tags: ['refactoring', 'improvement', 'code quality'],
        createdAt: Date.now(),
        updatedAt: Date.now()
    },
    {
        id: 'summarize',
        name: 'Summarize Text',
        description: 'Create a concise summary',
        template: `Summarize the following text in {{length}} format:

{{text}}

Output format: {{format|bullet points}}`,
        variables: [
            { name: 'text', type: 'textarea', required: true },
            { name: 'length', type: 'select', options: ['one sentence', 'one paragraph', '3 bullet points', '5 bullet points', 'detailed'], defaultValue: '3 bullet points' },
            { name: 'format', type: 'select', options: ['bullet points', 'paragraph', 'numbered list'], defaultValue: 'bullet points' }
        ],
        category: 'writing',
        tags: ['summary', 'text', 'condensing'],
        createdAt: Date.now(),
        updatedAt: Date.now()
    },
    {
        id: 'translate',
        name: 'Translate Text',
        description: 'Translate text between languages',
        template: `Translate the following text from {{source}} to {{target}}:

{{text}}

Preserve the original tone and style. If there are idioms or cultural references, provide equivalent expressions in the target language.`,
        variables: [
            { name: 'source', type: 'string', defaultValue: 'English', placeholder: 'source language' },
            { name: 'target', type: 'string', required: true, placeholder: 'target language' },
            { name: 'text', type: 'textarea', required: true }
        ],
        category: 'writing',
        tags: ['translation', 'languages'],
        createdAt: Date.now(),
        updatedAt: Date.now()
    }
];

/**
 * Template Manager class
 */
export class TemplateManager {
    private customTemplates: PromptTemplate[] = [];

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
     * Find template by ID
     */
    findById(id: string): PromptTemplate | undefined {
        return this.getAllTemplates().find(t => t.id === id);
    }

    /**
     * Add a custom template
     */
    addTemplate(template: Omit<PromptTemplate, 'createdAt' | 'updatedAt'>): PromptTemplate {
        const newTemplate: PromptTemplate = {
            ...template,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        const validation = validateTemplate(newTemplate);
        if (!validation.valid) {
            throw new Error(`Invalid template: ${validation.errors.join(', ')}`);
        }

        this.customTemplates.push(newTemplate);
        return newTemplate;
    }

    /**
     * Update a custom template
     */
    updateTemplate(id: string, updates: Partial<PromptTemplate>): PromptTemplate | null {
        const index = this.customTemplates.findIndex(t => t.id === id);
        if (index === -1) { return null; }

        this.customTemplates[index] = {
            ...this.customTemplates[index],
            ...updates,
            updatedAt: Date.now()
        };

        return this.customTemplates[index];
    }

    /**
     * Delete a custom template
     */
    deleteTemplate(id: string): boolean {
        const index = this.customTemplates.findIndex(t => t.id === id);
        if (index === -1) { return false; }

        this.customTemplates.splice(index, 1);
        return true;
    }

    /**
     * Render a template by ID
     * SEC-015-3: User inputs are escaped by default
     */
    render(templateId: string, variables: JsonObject, options?: RenderOptions): RenderResult {
        const template = this.findById(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }

        return renderTemplate(template.template, variables, options);
    }

    /**
     * Get all categories
     */
    getCategories(): string[] {
        const categories = new Set<string>();
        for (const template of this.getAllTemplates()) {
            if (template.category) {
                categories.add(template.category);
            }
        }
        return Array.from(categories);
    }
}

// Singleton
export const templateManager = new TemplateManager();
