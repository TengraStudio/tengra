import { WorkflowService } from '@main/services/workflow/workflow.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { JsonValue } from '@shared/types/common';
import { Workflow } from '@shared/types/workflow.types';
import { ipcMain } from 'electron';
import { z } from 'zod';

const WorkflowSchema = z.object({
    id: z.string().optional(),
    name: z.string(),
    description: z.string().optional(),
    enabled: z.boolean(),
    triggers: z.array(z.object({
        id: z.string(),
        type: z.enum(['manual', 'app_start', 'interval', 'event']),
        config: z.record(z.string(), z.any())
    })),
    steps: z.array(z.object({
        id: z.string(),
        name: z.string(),
        action: z.object({
            id: z.string(),
            type: z.enum(['command', 'log', 'http_request', 'llm_prompt', 'delay']),
            config: z.record(z.string(), z.any())
        }),
        nextStepId: z.string().optional()
    })),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
    lastRunAt: z.number().optional(),
    lastRunStatus: z.enum(['success', 'failure']).optional()
});

export function registerWorkflowIpc(workflowService: WorkflowService): void {
    ipcMain.handle('workflow:getAll', createValidatedIpcHandler(
        'workflow:getAll',
        async () => {
            return workflowService.getAllWorkflows();
        }
    ));

    ipcMain.handle('workflow:get', createValidatedIpcHandler(
        'workflow:get',
        async (_event, id: string) => {
            return workflowService.getWorkflow(id);
        },
        { argsSchema: z.tuple([z.string()]) }
    ));

    ipcMain.handle('workflow:create', createValidatedIpcHandler(
        'workflow:create',
        async (_event, workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>) => {
            return await workflowService.createWorkflow(workflow);
        },
        { argsSchema: z.tuple([WorkflowSchema.omit({ id: true, createdAt: true, updatedAt: true })]) }
    ));

    ipcMain.handle('workflow:update', createValidatedIpcHandler(
        'workflow:update',
        async (_event, id: string, updates: Partial<Workflow>) => {
            return await workflowService.updateWorkflow(id, updates);
        },
        { argsSchema: z.tuple([z.string(), WorkflowSchema.partial()]) }
    ));

    ipcMain.handle('workflow:delete', createValidatedIpcHandler(
        'workflow:delete',
        async (_event, id: string) => {
            await workflowService.deleteWorkflow(id);
        },
        { argsSchema: z.tuple([z.string()]) }
    ));

    ipcMain.handle('workflow:execute', createValidatedIpcHandler(
        'workflow:execute',
        async (_event, id: string, context?: Record<string, unknown>) => {
            return await workflowService.executeWorkflow(id, context);
        },
        { argsSchema: z.tuple([z.string(), z.any().optional()]) }
    ));

    ipcMain.handle('workflow:triggerManual', createValidatedIpcHandler(
        'workflow:triggerManual',
        async (_event, triggerId: string, context?: Record<string, unknown>) => {
            workflowService.triggerManualWorkflow(triggerId, context as JsonValue);
        },
        { argsSchema: z.tuple([z.string(), z.any().optional()]) }
    ));
}
