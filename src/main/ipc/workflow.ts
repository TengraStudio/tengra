import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { WorkflowService } from '@main/services/workflow/workflow.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import {
    CreateWorkflowInputSchema,
    UpdateWorkflowInputSchema,
    WorkflowContextInputSchema,
} from '@shared/schemas/workflow.schema';
import { JsonValue } from '@shared/types/common';
import { Workflow } from '@shared/types/workflow.types';
import { BrowserWindow, ipcMain } from 'electron';
import { z } from 'zod';

export function registerWorkflowIpc(getMainWindow: () => BrowserWindow | null, workflowService: WorkflowService): void {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'workflow operation');

    ipcMain.handle('workflow:getAll', createValidatedIpcHandler(
        'workflow:getAll',
        async (event) => {
            validateSender(event);
            return workflowService.getAllWorkflows();
        }
    ));

    ipcMain.handle('workflow:get', createValidatedIpcHandler(
        'workflow:get',
        async (event, id: string) => {
            validateSender(event);
            return workflowService.getWorkflow(id);
        },
        { argsSchema: z.tuple([z.string()]) }
    ));

    ipcMain.handle('workflow:create', createValidatedIpcHandler(
        'workflow:create',
        async (event, workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>) => {
            validateSender(event);
            return await workflowService.createWorkflow(workflow);
        },
        { argsSchema: z.tuple([CreateWorkflowInputSchema]) }
    ));

    ipcMain.handle('workflow:update', createValidatedIpcHandler(
        'workflow:update',
        async (event, id: string, updates: Partial<Workflow>) => {
            validateSender(event);
            return await workflowService.updateWorkflow(id, updates);
        },
        { argsSchema: z.tuple([z.string(), UpdateWorkflowInputSchema]) }
    ));

    ipcMain.handle('workflow:delete', createValidatedIpcHandler(
        'workflow:delete',
        async (event, id: string) => {
            validateSender(event);
            await workflowService.deleteWorkflow(id);
        },
        { argsSchema: z.tuple([z.string()]) }
    ));

    ipcMain.handle('workflow:execute', createValidatedIpcHandler(
        'workflow:execute',
        async (event, id: string, context?: Record<string, unknown>) => {
            validateSender(event);
            return await workflowService.executeWorkflow(id, context);
        },
        { argsSchema: z.tuple([z.string(), WorkflowContextInputSchema]) }
    ));

    ipcMain.handle('workflow:triggerManual', createValidatedIpcHandler(
        'workflow:triggerManual',
        async (event, triggerId: string, context?: Record<string, unknown>) => {
            validateSender(event);
            workflowService.triggerManualWorkflow(triggerId, context as JsonValue);
        },
        { argsSchema: z.tuple([z.string(), z.record(z.string(), z.unknown()).optional()]) }
    ));
}
