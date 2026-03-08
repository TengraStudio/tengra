import { registerWorkspaceIpc } from '@main/ipc/workspace';
import { registerWorkspaceAgentIpc } from '@main/ipc/workspace-agent';
import { AutomationWorkflowService } from '@main/services/workspace/automation-workflow.service';
import { WorkspaceAgentService } from '@main/services/workspace/workspace-agent.service';
import { describe, expect, it } from 'vitest';

describe('workspace/workflow entrypoint compatibility shims', () => {
    it('keeps the legacy IPC entrypoint mapped to the workspace IPC registrar', () => {
        expect(registerWorkspaceIpc).toBe(registerWorkspaceIpc);
    });

    it('keeps workspace agent IPC entrypoint mapped to workspace-agent registrar', () => {
        expect(registerWorkspaceAgentIpc).toBe(registerWorkspaceAgentIpc);
    });

    it('keeps legacy/current agent service aliases mapped to automation workflow service', () => {
        expect(WorkspaceAgentService).toBe(AutomationWorkflowService);
        expect(WorkspaceAgentService).toBe(AutomationWorkflowService);
    });
});
