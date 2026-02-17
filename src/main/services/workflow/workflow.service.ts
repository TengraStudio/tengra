import * as fs from 'fs/promises';
import * as path from 'path';

import { BaseService } from '@main/services/base.service';
import { LLMService } from '@main/services/llm/llm.service';
import { ProjectAgentService } from '@main/services/project/project-agent.service';
import { JsonValue } from '@shared/types/common';
import { Workflow, WorkflowExecutionResult } from '@shared/types/workflow.types';
import { WorkflowContext } from '@shared/types/workflow-context.types';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';

import { AgentWorkflowAction } from './actions/agent-workflow.action';
import { CommandActionHandler } from './actions/command.action';
import { LLMPromptAction } from './actions/llm-prompt.action';
import { ManualTriggerHandler } from './triggers/manual.trigger';
import { WorkflowRunner } from './workflow-runner';

export interface WorkflowServiceDependencies {
    llmService?: LLMService;
    projectAgentService?: ProjectAgentService;
}

export class WorkflowService extends BaseService {
    private workflows: Map<string, Workflow> = new Map();
    private workflowRunner: WorkflowRunner;
    private manualTriggerHandler: ManualTriggerHandler;
    private workflowsFilePath: string;
    private dependencies?: WorkflowServiceDependencies;

    constructor(dependencies?: WorkflowServiceDependencies) {
        super('WorkflowService');
        this.dependencies = dependencies;
        this.workflowRunner = new WorkflowRunner();
        this.manualTriggerHandler = new ManualTriggerHandler();
        this.workflowsFilePath = path.join(app.getPath('userData'), 'workflows.json');
    }

    async initialize(): Promise<void> {
        this.logInfo('Initializing WorkflowService...');

        // Register action handlers
        this.workflowRunner.registerActionHandler(new CommandActionHandler());

        // Register LLM and Agent action handlers if dependencies are provided
        if (this.dependencies?.llmService) {
            this.workflowRunner.registerActionHandler(new LLMPromptAction(this.dependencies.llmService));
            this.logInfo('Registered LLMPromptAction handler');
        }

        if (this.dependencies?.projectAgentService) {
            this.workflowRunner.registerActionHandler(new AgentWorkflowAction(this.dependencies.projectAgentService));
            this.logInfo('Registered AgentWorkflowAction handler');
        }

        // Register trigger handlers
        this.workflowRunner.registerTriggerHandler(this.manualTriggerHandler);

        // Load workflows from disk
        await this.loadWorkflows();

        // Register triggers for all enabled workflows
        this.registerWorkflowTriggers();

        this.logInfo('WorkflowService initialized successfully');
    }

    async cleanup(): Promise<void> {
        this.logInfo('Cleaning up WorkflowService...');
        await this.saveWorkflows();
    }

    private async loadWorkflows(): Promise<void> {
        try {
            const data = await fs.readFile(this.workflowsFilePath, 'utf-8');
            const workflowsArray: Workflow[] = JSON.parse(data);
            this.workflows = new Map(workflowsArray.map(w => [w.id, w]));
            this.logInfo(`Loaded ${this.workflows.size} workflows from disk`);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                this.logInfo('No workflows file found, starting with empty workflows');
            } else {
                this.logError('Failed to load workflows', error);
            }
        }
    }

    private async saveWorkflows(): Promise<void> {
        try {
            const workflowsArray = Array.from(this.workflows.values());
            await fs.writeFile(this.workflowsFilePath, JSON.stringify(workflowsArray, null, 2), 'utf-8');
            this.logInfo(`Saved ${workflowsArray.length} workflows to disk`);
        } catch (error) {
            this.logError('Failed to save workflows', error);
            throw error;
        }
    }

    private registerWorkflowTriggers(): void {
        for (const workflow of this.workflows.values()) {
            if (!workflow.enabled) {
                continue;
            }

            for (const trigger of workflow.triggers) {
                if (trigger.type === 'manual') {
                    this.manualTriggerHandler.register(trigger, () => {
                        void this.executeWorkflow(workflow.id);
                    });
                }
                // Additional trigger types can be registered here
            }
        }
    }

    public async createWorkflow(workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workflow> {
        const newWorkflow: Workflow = {
            ...workflow,
            id: uuidv4(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        this.workflows.set(newWorkflow.id, newWorkflow);
        await this.saveWorkflows();
        this.logInfo(`Created workflow: ${newWorkflow.name} (${newWorkflow.id})`);

        if (newWorkflow.enabled) {
            this.registerWorkflowTriggers();
        }

        return newWorkflow;
    }

    public async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow> {
        const workflow = this.workflows.get(id);
        if (!workflow) {
            throw new Error(`Workflow not found: ${id}`);
        }

        const updatedWorkflow: Workflow = {
            ...workflow,
            ...updates,
            id: workflow.id, // Prevent ID change
            createdAt: workflow.createdAt, // Prevent createdAt change
            updatedAt: Date.now(),
        };

        this.workflows.set(id, updatedWorkflow);
        await this.saveWorkflows();
        this.logInfo(`Updated workflow: ${updatedWorkflow.name} (${id})`);

        // Re-register triggers if enabled status changed
        this.registerWorkflowTriggers();

        return updatedWorkflow;
    }

    public async deleteWorkflow(id: string): Promise<void> {
        const workflow = this.workflows.get(id);
        if (!workflow) {
            throw new Error(`Workflow not found: ${id}`);
        }

        this.workflows.delete(id);
        await this.saveWorkflows();
        this.logInfo(`Deleted workflow: ${workflow.name} (${id})`);
    }

    public getWorkflow(id: string): Workflow | undefined {
        return this.workflows.get(id);
    }

    public getAllWorkflows(): Workflow[] {
        return Array.from(this.workflows.values());
    }

    public async executeWorkflow(
        id: string,
        context?: Partial<WorkflowContext>
    ): Promise<WorkflowExecutionResult> {
        const workflow = this.workflows.get(id);
        if (!workflow) {
            throw new Error(`Workflow not found: ${id}`);
        }

        if (!workflow.enabled) {
            throw new Error(`Workflow is disabled: ${id}`);
        }

        this.logInfo(`Executing workflow: ${workflow.name} (${id})`);
        const result = await this.workflowRunner.executeWorkflow(workflow, context);

        // Update last run info
        await this.updateWorkflow(id, {
            lastRunAt: result.endTime,
            lastRunStatus: result.status,
        });

        return result;
    }

    public triggerManualWorkflow(triggerId: string, context?: JsonValue): void {
        this.manualTriggerHandler.trigger(triggerId, context);
    }
}
