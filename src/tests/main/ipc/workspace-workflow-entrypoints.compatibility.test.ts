import { registerProjectIpc } from '@main/ipc/project';
import { registerProjectAgentIpc } from '@main/ipc/project-agent';
import { registerWorkspaceIpc } from '@main/ipc/workspace';
import { registerProjectAgentIpc as registerWorkspaceAgentIpc } from '@main/ipc/workspace-agent';
import { ProjectAgentService } from '@main/services/project/project-agent.service';
import { AutomationWorkflowService } from '@main/services/workspace/automation-workflow.service';
import { WorkspaceAgentService } from '@main/services/workspace/workspace-agent.service';
import { describe, expect, it } from 'vitest';

describe('workspace/workflow entrypoint compatibility shims', () => {
    it('keeps project IPC entrypoint mapped to the workspace IPC registrar', () => {
        expect(registerProjectIpc).toBe(registerWorkspaceIpc);
    });

    it('keeps project agent IPC entrypoint mapped to workspace-agent registrar', () => {
        expect(registerProjectAgentIpc).toBe(registerWorkspaceAgentIpc);
    });

    it('keeps project/workspace agent service aliases mapped to automation workflow service', () => {
        expect(ProjectAgentService).toBe(AutomationWorkflowService);
        expect(WorkspaceAgentService).toBe(AutomationWorkflowService);
    });
});
