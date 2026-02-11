/**
 * Agent Template Service
 * Handles agent task templates:
 * - AGT-TPL-01: Built-in templates (refactor, bug-fix, feature, docs)
 * - AGT-TPL-02: User-defined template creation
 * - AGT-TPL-03: Template variables (project name, file paths)
 * - AGT-TPL-04: Template sharing/export
 */

import { randomUUID } from 'crypto';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import {
    AgentTemplate,
    AgentTemplateCategory,
    AgentTemplateExport,
    AgentTemplateVariable,
} from '@shared/types/project-agent';

// ===== AGT-TPL-01: Built-in Templates =====

const BUILT_IN_TEMPLATES: AgentTemplate[] = [
    {
        id: 'template-refactor-code',
        name: 'Code Refactoring',
        description: 'Refactor code for improved maintainability, readability, and performance',
        category: 'refactor',
        taskTemplate: `Refactor the code in {{file_path}} with the following goals:
- Improve code readability and maintainability
- Apply {{refactoring_pattern}} patterns where appropriate
- Maintain existing functionality (no behavioral changes)
- Add or improve type annotations
- Optimize performance where possible without sacrificing clarity

Additional context: {{additional_context}}`,
        predefinedSteps: [
            'Analyze current code structure and identify refactoring opportunities',
            'Create a backup or ensure git commit before changes',
            'Apply refactoring patterns incrementally',
            'Verify functionality is preserved after each change',
            'Update any affected tests',
            'Document significant changes made',
        ],
        variables: [
            {
                name: 'file_path',
                type: 'file_path',
                description: 'Path to the file or directory to refactor',
                required: true,
                placeholder: 'src/components/MyComponent.tsx',
            },
            {
                name: 'refactoring_pattern',
                type: 'select',
                description: 'Primary refactoring pattern to apply',
                required: false,
                defaultValue: 'clean-code',
                options: ['clean-code', 'solid-principles', 'dry', 'extract-method', 'rename-symbols'],
            },
            {
                name: 'additional_context',
                type: 'string',
                description: 'Any additional context or specific requirements',
                required: false,
                placeholder: 'Focus on the authentication flow',
            },
        ],
        tags: ['refactor', 'clean-code', 'maintainability'],
        isBuiltIn: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    },
    {
        id: 'template-fix-bug',
        name: 'Bug Fix',
        description: 'Investigate and fix a bug in the codebase',
        category: 'bug-fix',
        taskTemplate: `Fix the following bug:

**Bug Description:** {{bug_description}}
**Reproduction Steps:** {{reproduction_steps}}
**Expected Behavior:** {{expected_behavior}}
**Actual Behavior:** {{actual_behavior}}

Location hint: {{location_hint}}`,
        predefinedSteps: [
            'Reproduce the bug to confirm the issue',
            'Identify the root cause through code analysis and debugging',
            'Develop a fix for the root cause',
            'Write or update tests to prevent regression',
            'Verify the fix resolves the issue',
            'Check for any side effects in related code',
        ],
        variables: [
            {
                name: 'bug_description',
                type: 'string',
                description: 'Brief description of the bug',
                required: true,
                placeholder: 'Login button does not respond on mobile devices',
            },
            {
                name: 'reproduction_steps',
                type: 'string',
                description: 'Steps to reproduce the bug',
                required: true,
                placeholder: '1. Open app on mobile 2. Click login button 3. Nothing happens',
            },
            {
                name: 'expected_behavior',
                type: 'string',
                description: 'What should happen',
                required: true,
                placeholder: 'Login form should appear',
            },
            {
                name: 'actual_behavior',
                type: 'string',
                description: 'What actually happens',
                required: true,
                placeholder: 'Button click is ignored',
            },
            {
                name: 'location_hint',
                type: 'string',
                description: 'Where the bug might be located',
                required: false,
                placeholder: 'src/components/LoginButton.tsx',
            },
        ],
        tags: ['bug', 'fix', 'debug'],
        isBuiltIn: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    },
    {
        id: 'template-new-feature',
        name: 'New Feature Implementation',
        description: 'Implement a new feature from scratch or extend existing functionality',
        category: 'feature',
        taskTemplate: `Implement the following feature:

**Feature Name:** {{feature_name}}
**Description:** {{feature_description}}
**Acceptance Criteria:**
{{acceptance_criteria}}

**Technical Constraints:**
{{technical_constraints}}

**Target Location:** {{target_location}}`,
        predefinedSteps: [
            'Analyze requirements and plan implementation approach',
            'Set up necessary file structure and scaffolding',
            'Implement core feature logic',
            'Add UI components if applicable',
            'Write unit and integration tests',
            'Update documentation and types',
            'Perform final review and cleanup',
        ],
        variables: [
            {
                name: 'feature_name',
                type: 'string',
                description: 'Name of the feature',
                required: true,
                placeholder: 'Dark Mode Toggle',
            },
            {
                name: 'feature_description',
                type: 'string',
                description: 'Detailed description of the feature',
                required: true,
                placeholder: 'Add ability for users to switch between light and dark themes',
            },
            {
                name: 'acceptance_criteria',
                type: 'string',
                description: 'List of acceptance criteria',
                required: true,
                placeholder: '- Toggle persists across sessions\n- Smooth transition animation\n- Respects system preference',
            },
            {
                name: 'technical_constraints',
                type: 'string',
                description: 'Any technical constraints or requirements',
                required: false,
                placeholder: 'Must use CSS variables, no external libraries',
            },
            {
                name: 'target_location',
                type: 'directory',
                description: 'Where to implement the feature',
                required: false,
                placeholder: 'src/features/theme',
            },
        ],
        tags: ['feature', 'implementation', 'new'],
        isBuiltIn: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    },
    {
        id: 'template-documentation',
        name: 'Documentation Generation',
        description: 'Generate or improve documentation for code, APIs, or features',
        category: 'documentation',
        taskTemplate: `Generate documentation for:

**Target:** {{target_path}}
**Documentation Type:** {{doc_type}}
**Audience:** {{audience}}

**Specific Areas to Cover:**
{{areas_to_cover}}

Output format: {{output_format}}`,
        predefinedSteps: [
            'Analyze the target code/API structure',
            'Identify key components and their purposes',
            'Write clear descriptions and usage examples',
            'Add parameter documentation and return types',
            'Include edge cases and common pitfalls',
            'Format and organize the documentation',
        ],
        variables: [
            {
                name: 'target_path',
                type: 'file_path',
                description: 'Path to the code to document',
                required: true,
                placeholder: 'src/services/auth.service.ts',
            },
            {
                name: 'doc_type',
                type: 'select',
                description: 'Type of documentation to generate',
                required: true,
                options: ['jsdoc', 'readme', 'api-reference', 'tutorial', 'architecture'],
                defaultValue: 'jsdoc',
            },
            {
                name: 'audience',
                type: 'select',
                description: 'Target audience for the documentation',
                required: true,
                options: ['developers', 'end-users', 'api-consumers', 'maintainers'],
                defaultValue: 'developers',
            },
            {
                name: 'areas_to_cover',
                type: 'string',
                description: 'Specific areas or functions to focus on',
                required: false,
                placeholder: 'Authentication flow, token refresh, error handling',
            },
            {
                name: 'output_format',
                type: 'select',
                description: 'Output format for documentation',
                required: false,
                options: ['markdown', 'jsdoc-comments', 'openapi', 'docusaurus'],
                defaultValue: 'markdown',
            },
        ],
        tags: ['documentation', 'docs', 'readme', 'api'],
        isBuiltIn: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    },
    {
        id: 'template-testing',
        name: 'Test Suite Creation',
        description: 'Create comprehensive tests for existing code',
        category: 'testing',
        taskTemplate: `Create tests for:

**Target:** {{target_path}}
**Test Type:** {{test_type}}
**Coverage Goal:** {{coverage_goal}}%

**Priority Areas:**
{{priority_areas}}

Use {{test_framework}} framework.`,
        predefinedSteps: [
            'Analyze the target code and identify testable units',
            'Set up test file structure and imports',
            'Write tests for happy path scenarios',
            'Add edge case and error handling tests',
            'Implement mocks and stubs where needed',
            'Verify test coverage meets goal',
            'Add integration tests for critical paths',
        ],
        variables: [
            {
                name: 'target_path',
                type: 'file_path',
                description: 'Path to the code to test',
                required: true,
                placeholder: 'src/services/payment.service.ts',
            },
            {
                name: 'test_type',
                type: 'select',
                description: 'Type of tests to write',
                required: true,
                options: ['unit', 'integration', 'e2e', 'mixed'],
                defaultValue: 'unit',
            },
            {
                name: 'coverage_goal',
                type: 'number',
                description: 'Target test coverage percentage',
                required: false,
                defaultValue: 80,
            },
            {
                name: 'priority_areas',
                type: 'string',
                description: 'Priority areas to focus testing on',
                required: false,
                placeholder: 'Error handling, edge cases, security',
            },
            {
                name: 'test_framework',
                type: 'select',
                description: 'Testing framework to use',
                required: false,
                options: ['vitest', 'jest', 'mocha', 'playwright'],
                defaultValue: 'vitest',
            },
        ],
        tags: ['testing', 'unit-test', 'integration-test', 'coverage'],
        isBuiltIn: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    },
    {
        id: 'template-security-audit',
        name: 'Security Audit',
        description: 'Perform a security audit and fix vulnerabilities',
        category: 'security',
        taskTemplate: `Perform a security audit on:

**Scope:** {{audit_scope}}
**Focus Areas:** {{focus_areas}}
**Severity Threshold:** {{severity_threshold}}

Additional context: {{additional_context}}`,
        predefinedSteps: [
            'Scan for common vulnerability patterns (OWASP Top 10)',
            'Check for hardcoded secrets and credentials',
            'Review authentication and authorization logic',
            'Analyze input validation and sanitization',
            'Check dependency vulnerabilities',
            'Document findings with severity ratings',
            'Implement fixes for critical/high severity issues',
        ],
        variables: [
            {
                name: 'audit_scope',
                type: 'directory',
                description: 'Directory or files to audit',
                required: true,
                placeholder: 'src/',
            },
            {
                name: 'focus_areas',
                type: 'select',
                description: 'Primary security focus areas',
                required: true,
                options: ['all', 'authentication', 'authorization', 'injection', 'data-exposure', 'dependencies'],
                defaultValue: 'all',
            },
            {
                name: 'severity_threshold',
                type: 'select',
                description: 'Minimum severity to report',
                required: false,
                options: ['critical', 'high', 'medium', 'low'],
                defaultValue: 'medium',
            },
            {
                name: 'additional_context',
                type: 'string',
                description: 'Any additional context about the codebase',
                required: false,
                placeholder: 'This is a public API handling user data',
            },
        ],
        tags: ['security', 'audit', 'vulnerability', 'owasp'],
        isBuiltIn: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    },
    {
        id: 'template-performance-optimization',
        name: 'Performance Optimization',
        description: 'Analyze and optimize code performance',
        category: 'performance',
        taskTemplate: `Optimize performance for:

**Target:** {{target_path}}
**Performance Issue:** {{performance_issue}}
**Optimization Goal:** {{optimization_goal}}
**Constraints:** {{constraints}}`,
        predefinedSteps: [
            'Profile current performance to establish baseline',
            'Identify performance bottlenecks',
            'Analyze algorithmic complexity',
            'Apply targeted optimizations',
            'Re-profile to measure improvement',
            'Ensure optimizations don\'t break functionality',
            'Document optimization changes',
        ],
        variables: [
            {
                name: 'target_path',
                type: 'file_path',
                description: 'Path to the code to optimize',
                required: true,
                placeholder: 'src/utils/dataProcessor.ts',
            },
            {
                name: 'performance_issue',
                type: 'string',
                description: 'Description of the performance issue',
                required: true,
                placeholder: 'Data processing takes 10+ seconds for large datasets',
            },
            {
                name: 'optimization_goal',
                type: 'string',
                description: 'Target performance improvement',
                required: true,
                placeholder: 'Reduce processing time to under 2 seconds',
            },
            {
                name: 'constraints',
                type: 'string',
                description: 'Any constraints on the optimization',
                required: false,
                placeholder: 'Cannot add external dependencies, must maintain memory usage',
            },
        ],
        tags: ['performance', 'optimization', 'speed', 'memory'],
        isBuiltIn: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    },
];

export interface AgentTemplateDependencies {
    database: DatabaseService;
}

export class AgentTemplateService extends BaseService {
    private templates: Map<string, AgentTemplate> = new Map();

    constructor(private deps: AgentTemplateDependencies) {
        super('AgentTemplateService');
    }

    async initialize(): Promise<void> {
        appLogger.info('AgentTemplateService', 'Initializing templates...');

        // Load built-in templates
        for (const template of BUILT_IN_TEMPLATES) {
            this.templates.set(template.id, template);
        }

        // Load user templates from database
        await this.loadUserTemplates();

        appLogger.info('AgentTemplateService', `Loaded ${this.templates.size} templates`);
    }

    // ===== AGT-TPL-01: Get Built-in Templates =====

    getBuiltInTemplates(): AgentTemplate[] {
        return BUILT_IN_TEMPLATES;
    }

    // ===== AGT-TPL-02: User-defined Template Creation =====

    async createTemplate(template: Omit<AgentTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<AgentTemplate> {
        const now = Date.now();
        const newTemplate: AgentTemplate = {
            ...template,
            id: `template-user-${randomUUID()}`,
            isBuiltIn: false,
            createdAt: now,
            updatedAt: now,
        };

        this.templates.set(newTemplate.id, newTemplate);
        await this.saveTemplateToDb(newTemplate);

        appLogger.info('AgentTemplateService', `Created template: ${newTemplate.name}`);
        return newTemplate;
    }

    async updateTemplate(id: string, updates: Partial<AgentTemplate>): Promise<AgentTemplate | null> {
        const template = this.templates.get(id);
        if (!template) {
            return null;
        }

        // Cannot modify built-in templates
        if (template.isBuiltIn) {
            appLogger.warn('AgentTemplateService', `Cannot modify built-in template: ${id}`);
            return null;
        }

        const updatedTemplate: AgentTemplate = {
            ...template,
            ...updates,
            id: template.id, // Prevent ID change
            isBuiltIn: false, // Prevent becoming built-in
            updatedAt: Date.now(),
        };

        this.templates.set(id, updatedTemplate);
        await this.saveTemplateToDb(updatedTemplate);

        appLogger.info('AgentTemplateService', `Updated template: ${updatedTemplate.name}`);
        return updatedTemplate;
    }

    async deleteTemplate(id: string): Promise<boolean> {
        const template = this.templates.get(id);
        if (!template) {
            return false;
        }

        if (template.isBuiltIn) {
            appLogger.warn('AgentTemplateService', `Cannot delete built-in template: ${id}`);
            return false;
        }

        this.templates.delete(id);
        await this.deleteTemplateFromDb(id);

        appLogger.info('AgentTemplateService', `Deleted template: ${id}`);
        return true;
    }

    // ===== AGT-TPL-03: Template Variables =====

    /**
     * Apply variable substitutions to a template
     */
    applyVariables(
        template: AgentTemplate,
        values: Record<string, string | number | boolean>
    ): { task: string; steps: string[] } {
        let task = template.taskTemplate;
        const steps = [...(template.predefinedSteps ?? [])];

        // Validate required variables
        for (const variable of template.variables) {
            if (variable.required && !(variable.name in values)) {
                throw new Error(`Required variable missing: ${variable.name}`);
            }
        }

        // Apply substitutions
        for (const variable of template.variables) {
            const value = values[variable.name] ?? variable.defaultValue ?? '';
            const placeholder = `{{${variable.name}}}`;
            const replacement = String(value);

            task = task.split(placeholder).join(replacement);
            for (let i = 0; i < steps.length; i++) {
                steps[i] = steps[i].split(placeholder).join(replacement);
            }
        }

        return { task, steps };
    }

    /**
     * Validate variable values against their definitions
     */
    validateVariables(
        template: AgentTemplate,
        values: Record<string, string | number | boolean>
    ): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        for (const variable of template.variables) {
            const value = values[variable.name];

            // Check required
            if (variable.required && (value === undefined || value === '')) {
                errors.push(`${variable.name} is required`);
                continue;
            }

            if (value === undefined) {
                continue;
            }

            // Type validation
            switch (variable.type) {
                case 'number':
                    if (typeof value !== 'number' && isNaN(Number(value))) {
                        errors.push(`${variable.name} must be a number`);
                    }
                    break;
                case 'boolean':
                    if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
                        errors.push(`${variable.name} must be a boolean`);
                    }
                    break;
                case 'select':
                    if (variable.options && !variable.options.includes(String(value))) {
                        errors.push(`${variable.name} must be one of: ${variable.options.join(', ')}`);
                    }
                    break;
            }
        }

        return { valid: errors.length === 0, errors };
    }

    // ===== AGT-TPL-04: Template Export/Import =====

    /**
     * Export a template
     */
    exportTemplate(id: string): AgentTemplateExport | null {
        const template = this.templates.get(id);
        if (!template) {
            return null;
        }

        // Create a copy without built-in flag for export
        const exportedTemplate: AgentTemplate = {
            ...template,
            isBuiltIn: false,
            id: `template-imported-${randomUUID()}`, // Generate new ID for import
        };

        return {
            version: 1,
            template: exportedTemplate,
            exportedAt: Date.now(),
        };
    }

    /**
     * Import a template
     */
    async importTemplate(exported: AgentTemplateExport): Promise<AgentTemplate> {
        if (exported.version !== 1) {
            throw new Error(`Unsupported export version: ${exported.version}`);
        }

        const now = Date.now();
        const importedTemplate: AgentTemplate = {
            ...exported.template,
            id: `template-imported-${randomUUID()}`,
            isBuiltIn: false,
            createdAt: now,
            updatedAt: now,
        };

        this.templates.set(importedTemplate.id, importedTemplate);
        await this.saveTemplateToDb(importedTemplate);

        appLogger.info('AgentTemplateService', `Imported template: ${importedTemplate.name}`);
        return importedTemplate;
    }

    // ===== Query Methods =====

    getTemplate(id: string): AgentTemplate | null {
        return this.templates.get(id) ?? null;
    }

    getAllTemplates(): AgentTemplate[] {
        return Array.from(this.templates.values());
    }

    getTemplatesByCategory(category: AgentTemplateCategory): AgentTemplate[] {
        return Array.from(this.templates.values()).filter(t => t.category === category);
    }

    searchTemplates(query: string): AgentTemplate[] {
        const lowerQuery = query.toLowerCase();
        return Array.from(this.templates.values()).filter(t =>
            t.name.toLowerCase().includes(lowerQuery) ||
            t.description.toLowerCase().includes(lowerQuery) ||
            t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    }

    // ===== Database Operations =====

    private async loadUserTemplates(): Promise<void> {
        try {
            const templates = await this.deps.database.getAgentTemplates();
            for (const template of templates) {
                this.templates.set(template.id, template);
            }
            appLogger.info('AgentTemplateService', `Loaded ${templates.length} user templates from database`);
        } catch (error) {
            appLogger.error('AgentTemplateService', 'Failed to load user templates', error as Error);
        }
    }

    private async saveTemplateToDb(template: AgentTemplate): Promise<void> {
        try {
            await this.deps.database.saveAgentTemplate(template);
        } catch (error) {
            appLogger.error('AgentTemplateService', 'Failed to save template to database', error as Error);
        }
    }

    private async deleteTemplateFromDb(id: string): Promise<void> {
        try {
            await this.deps.database.deleteAgentTemplate(id);
        } catch (error) {
            appLogger.error('AgentTemplateService', 'Failed to delete template from database', error as Error);
        }
    }
}

// Singleton instance
let instance: AgentTemplateService | null = null;

export function getAgentTemplateService(deps: AgentTemplateDependencies): AgentTemplateService {
    instance ??= new AgentTemplateService(deps);
    return instance;
}
