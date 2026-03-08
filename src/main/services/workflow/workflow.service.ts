import * as fs from 'fs/promises';
import * as path from 'path';

import { BaseService } from '@main/services/base.service';
import { LLMService } from '@main/services/llm/llm.service';
import { WorkspaceAgentService } from '@main/services/workspace/workspace-agent.service';
import {
    CreateWorkflowInputSchema,
    formatZodErrors,
    UpdateWorkflowInputSchema,
    WorkflowContextInputSchema,
} from '@shared/schemas/workflow.schema';
import { JsonValue } from '@shared/types/common';
import { Workflow, WorkflowExecutionResult } from '@shared/types/workflow.types';
import { WorkflowContext } from '@shared/types/workflow-context.types';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';

import { AgentWorkflowAction } from './actions/agent-workflow.action';
import { CommandActionHandler } from './actions/command.action';
import { LLMPromptAction } from './actions/llm-prompt.action';
import { ManualTriggerHandler } from './triggers/manual.trigger';
import { WorkflowError, WorkflowErrorCode } from './workflow-error';
import { WorkflowRunner } from './workflow-runner';

export { WorkflowError, WorkflowErrorCode } from './workflow-error';

/**
 * Telemetry events for workflow monitoring dashboards (BACKLOG-0435)
 */
export enum WorkflowTelemetryEvent {
    WORKFLOW_CREATED = 'workflow_created',
    WORKFLOW_UPDATED = 'workflow_updated',
    WORKFLOW_DELETED = 'workflow_deleted',
    WORKFLOW_EXECUTED = 'workflow_executed',
    WORKFLOW_EXECUTION_FAILED = 'workflow_execution_failed',
    WORKFLOWS_LOADED = 'workflow_loaded_from_disk',
    WORKFLOWS_SAVED = 'workflow_saved_to_disk'
}

/**
 * Performance regression budgets in milliseconds (BACKLOG-0436)
 */
export const WORKFLOW_PERFORMANCE_BUDGETS = {
    CREATE_MS: 500,
    UPDATE_MS: 500,
    DELETE_MS: 500,
    EXECUTE_MS: 300000,
    LOAD_MS: 2000,
    SAVE_MS: 2000
} as const;

export interface WorkflowServiceDependencies {
    llmService?: LLMService;
    workspaceAgentService?: WorkspaceAgentService;
}

export class WorkflowService extends BaseService {
    private workflows: Map<string, Workflow> = new Map();
    private workflowRunner: WorkflowRunner;
    private manualTriggerHandler: ManualTriggerHandler;
    private workflowsFilePath: string;
    private dependencies?: WorkflowServiceDependencies;

    /** Validates that the given id is a non-empty string. */
    private validateId(id: unknown, methodName: string): void {
        if (!id || typeof id !== 'string' || id.trim().length === 0) {
            throw new Error(`${methodName}: id must be a non-empty string`);
        }
    }

    /** Logs a warning when an operation exceeds its performance budget. */
    private checkPerformanceBudget(operation: string, durationMs: number, budgetMs: number): void {
        if (durationMs > budgetMs) {
            this.logWarn(`Performance budget exceeded for ${operation}: ${durationMs.toFixed(2)}ms (budget: ${budgetMs}ms)`);
        }
    }

    /** Emits a telemetry event for workflow monitoring dashboards. */
    private emitTelemetry(event: WorkflowTelemetryEvent, properties?: Record<string, string | number | boolean>): void {
        this.logDebug(`Telemetry: ${event}`, properties as unknown as Record<string, JsonValue>);
    }

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

        if (this.dependencies?.workspaceAgentService) {
            this.workflowRunner.registerActionHandler(new AgentWorkflowAction(this.dependencies.workspaceAgentService));
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
        const start = performance.now();
        try {
            const data = await fs.readFile(this.workflowsFilePath, 'utf-8');
            const workflowsArray: Workflow[] = JSON.parse(data);
            this.workflows = new Map(workflowsArray.map(w => [w.id, w]));
            this.logInfo(`Loaded ${this.workflows.size} workflows from disk`);
            this.emitTelemetry(WorkflowTelemetryEvent.WORKFLOWS_LOADED, { count: this.workflows.size });
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                this.logInfo('No workflows file found, starting with empty workflows');
            } else {
                this.logError('Failed to load workflows', error);
            }
        } finally {
            this.checkPerformanceBudget('load', performance.now() - start, WORKFLOW_PERFORMANCE_BUDGETS.LOAD_MS);
        }
    }

    private async saveWorkflows(): Promise<void> {
        const start = performance.now();
        try {
            const workflowsArray = Array.from(this.workflows.values());
            await fs.writeFile(this.workflowsFilePath, JSON.stringify(workflowsArray, null, 2), 'utf-8');
            this.logInfo(`Saved ${workflowsArray.length} workflows to disk`);
            this.emitTelemetry(WorkflowTelemetryEvent.WORKFLOWS_SAVED, { count: workflowsArray.length });
        } catch (error) {
            this.logError('Failed to save workflows', error);
            throw new WorkflowError(
                WorkflowErrorCode.SAVE_FAILED,
                `Failed to save workflows: ${error instanceof Error ? error.message : String(error)}`
            );
        } finally {
            this.checkPerformanceBudget('save', performance.now() - start, WORKFLOW_PERFORMANCE_BUDGETS.SAVE_MS);
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
        const start = performance.now();
        const parsed = CreateWorkflowInputSchema.safeParse(workflow);
        if (!parsed.success) {
            const message = formatZodErrors(parsed.error);
            throw new WorkflowError(WorkflowErrorCode.INVALID_INPUT, `createWorkflow: ${message}`);
        }

        const newWorkflow: Workflow = {
            ...workflow,
            id: uuidv4(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        this.workflows.set(newWorkflow.id, newWorkflow);
        await this.saveWorkflows();
        this.logInfo(`Created workflow: ${newWorkflow.name} (${newWorkflow.id})`);
        this.emitTelemetry(WorkflowTelemetryEvent.WORKFLOW_CREATED, { workflowId: newWorkflow.id });
        this.checkPerformanceBudget('create', performance.now() - start, WORKFLOW_PERFORMANCE_BUDGETS.CREATE_MS);

        if (newWorkflow.enabled) {
            this.registerWorkflowTriggers();
        }

        return newWorkflow;
    }

    public async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow> {
        const start = performance.now();
        this.validateId(id, 'updateWorkflow');

        const parsed = UpdateWorkflowInputSchema.safeParse(updates);
        if (!parsed.success) {
            const message = formatZodErrors(parsed.error);
            throw new WorkflowError(WorkflowErrorCode.INVALID_INPUT, `updateWorkflow: ${message}`);
        }

        const workflow = this.workflows.get(id);
        if (!workflow) {
            throw new WorkflowError(WorkflowErrorCode.NOT_FOUND, `Workflow not found: ${id}`);
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
        this.emitTelemetry(WorkflowTelemetryEvent.WORKFLOW_UPDATED, { workflowId: id });
        this.checkPerformanceBudget('update', performance.now() - start, WORKFLOW_PERFORMANCE_BUDGETS.UPDATE_MS);

        // Re-register triggers if enabled status changed
        this.registerWorkflowTriggers();

        return updatedWorkflow;
    }

    public async deleteWorkflow(id: string): Promise<void> {
        const start = performance.now();
        this.validateId(id, 'deleteWorkflow');

        const workflow = this.workflows.get(id);
        if (!workflow) {
            throw new WorkflowError(WorkflowErrorCode.NOT_FOUND, `Workflow not found: ${id}`);
        }

        this.workflows.delete(id);
        await this.saveWorkflows();
        this.logInfo(`Deleted workflow: ${workflow.name} (${id})`);
        this.emitTelemetry(WorkflowTelemetryEvent.WORKFLOW_DELETED, { workflowId: id });
        this.checkPerformanceBudget('delete', performance.now() - start, WORKFLOW_PERFORMANCE_BUDGETS.DELETE_MS);
    }

    public getWorkflow(id: string): Workflow | undefined {
        if (!id || typeof id !== 'string' || id.trim().length === 0) {
            return undefined;
        }
        return this.workflows.get(id);
    }

    public getAllWorkflows(): Workflow[] {
        return Array.from(this.workflows.values());
    }

    /**
     * Get health status for workflow monitoring dashboards
     */
    getHealth(): { totalWorkflows: number; enabledWorkflows: number; workflowIds: string[] } {
        const workflows = Array.from(this.workflows.values());
        return {
            totalWorkflows: workflows.length,
            enabledWorkflows: workflows.filter(w => w.enabled).length,
            workflowIds: workflows.map(w => w.id)
        };
    }

    public async executeWorkflow(
        id: string,
        context?: Partial<WorkflowContext>
    ): Promise<WorkflowExecutionResult> {
        const start = performance.now();
        this.validateId(id, 'executeWorkflow');

        if (context !== undefined) {
            const parsed = WorkflowContextInputSchema.safeParse(context);
            if (!parsed.success) {
                const message = formatZodErrors(parsed.error);
                throw new WorkflowError(WorkflowErrorCode.INVALID_INPUT, `executeWorkflow: ${message}`);
            }
        }

        const workflow = this.workflows.get(id);
        if (!workflow) {
            throw new WorkflowError(WorkflowErrorCode.NOT_FOUND, `Workflow not found: ${id}`);
        }

        if (!workflow.enabled) {
            throw new WorkflowError(WorkflowErrorCode.DISABLED, `Workflow is disabled: ${id}`);
        }

        this.logInfo(`Executing workflow: ${workflow.name} (${id})`);
        const result = await this.workflowRunner.executeWorkflow(workflow, context);

        const telemetryEvent = result.status === 'success'
            ? WorkflowTelemetryEvent.WORKFLOW_EXECUTED
            : WorkflowTelemetryEvent.WORKFLOW_EXECUTION_FAILED;
        this.emitTelemetry(telemetryEvent, { workflowId: id, status: result.status });
        this.checkPerformanceBudget('execute', performance.now() - start, WORKFLOW_PERFORMANCE_BUDGETS.EXECUTE_MS);

        // Update last run info
        await this.updateWorkflow(id, {
            lastRunAt: result.endTime,
            lastRunStatus: result.status,
        });

        return result;
    }

    public triggerManualWorkflow(triggerId: string, context?: JsonValue): void {
        this.validateId(triggerId, 'triggerManualWorkflow');
        this.manualTriggerHandler.trigger(triggerId, context);
    }
}
