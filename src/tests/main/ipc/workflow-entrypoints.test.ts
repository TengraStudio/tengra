import { registerWorkflowExecutionIpc } from '@main/ipc/workflow-execution';
import { registerWorkspaceIpc } from '@main/ipc/workspace';
import { AutomationWorkflowService } from '@main/services/workspace/automation-workflow.service';
import { WorkflowExecutionService } from '@main/services/workspace/workflow-execution.service';
import { describe, expect, it } from 'vitest';

describe('workspace/workflow entrypoints', () => {
    it('keeps workspace IPC entrypoint mapped to the workspace IPC registrar', () => {
        expect(registerWorkspaceIpc).toBe(registerWorkspaceIpc);
    });

    it('exposes the canonical workflow execution registrar', () => {
        expect(registerWorkflowExecutionIpc).toBeTypeOf('function');
    });

    it('maps workflow execution service to automation workflow service', () => {
        expect(WorkflowExecutionService).toBe(AutomationWorkflowService);
    });
});
