import { AgentTemplateService } from '@main/services/project/agent/agent-template.service';
import {
    AgentTemplate,
    AgentTemplateCategory,
    AgentTemplateExport,
} from '@shared/types/project-agent';

interface ProjectAgentTemplateManagerDeps {
    templateService: AgentTemplateService;
}

export class ProjectAgentTemplateManager {
    constructor(private readonly deps: ProjectAgentTemplateManagerDeps) {}

    getTemplates(): AgentTemplate[] {
        return this.deps.templateService.getAllTemplates();
    }

    getTemplatesByCategory(category: AgentTemplateCategory): AgentTemplate[] {
        return this.deps.templateService.getTemplatesByCategory(category);
    }

    async saveTemplate(template: AgentTemplate): Promise<{ success: boolean; template: AgentTemplate }> {
        const existing = this.deps.templateService.getTemplate(template.id);
        const saved = existing
            ? await this.deps.templateService.updateTemplate(template.id, template) ?? template
            : await this.deps.templateService.createTemplate({
                name: template.name,
                description: template.description,
                category: template.category,
                systemPromptOverride: template.systemPromptOverride,
                taskTemplate: template.taskTemplate,
                predefinedSteps: template.predefinedSteps,
                variables: template.variables,
                modelRouting: template.modelRouting,
                tags: template.tags,
                isBuiltIn: false,
                authorId: template.authorId,
            });
        return { success: true, template: saved };
    }

    async deleteTemplate(id: string): Promise<boolean> {
        return await this.deps.templateService.deleteTemplate(id);
    }

    exportTemplate(id: string): AgentTemplateExport | null {
        return this.deps.templateService.exportTemplate(id);
    }

    async importTemplate(exported: AgentTemplateExport): Promise<AgentTemplate> {
        return await this.deps.templateService.importTemplate(exported);
    }

    applyTemplate(
        templateId: string,
        values: Record<string, string | number | boolean>
    ): { template: AgentTemplate; task: string; steps: string[] } {
        const template = this.deps.templateService.getTemplate(templateId);
        if (!template) {
            throw new Error('Template not found');
        }
        const validation = this.deps.templateService.validateVariables(template, values);
        if (!validation.valid) {
            throw new Error(validation.errors.join('; '));
        }
        const applied = this.deps.templateService.applyVariables(template, values);
        return { template, ...applied };
    }
}
