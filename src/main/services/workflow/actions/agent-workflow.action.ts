import { WorkspaceAgentService } from '@main/services/workspace/workspace-agent.service';
import { JsonValue } from '@shared/types/common';
import { WorkflowAction } from '@shared/types/workflow.types';
import { WorkflowContext } from '@shared/types/workflow-context.types';

import { IWorkflowActionHandler } from './action.interface';

/**
 * Action handler that executes an agent task as part of a workflow
 * Allows workflows to delegate complex tasks to autonomous agents
 */
export class AgentWorkflowAction implements IWorkflowActionHandler {
    type: string = 'agent_task';

    constructor(private workspaceAgentService: WorkspaceAgentService) { }

    async execute(action: WorkflowAction, context?: WorkflowContext): Promise<JsonValue> {
        const agentId = action.config['agentId'] as string | undefined;
        const task = action.config['task'];
        const priority = action.config['priority'] as 'low' | 'normal' | 'high' | 'critical' | undefined;
        const waitForCompletion = action.config['waitForCompletion'] !== false; // Default to true

        if (typeof task !== 'string') {
            throw new Error('AgentWorkflowAction requires a "task" string in config');
        }

        try {
            // Start the agent task
            await this.workspaceAgentService.start({
                task,
                agentProfileId: agentId,
                priority: priority || 'normal',
            });

            // Get the current task ID
            const taskId = this.workspaceAgentService.getCurrentTaskId();
            if (!taskId) {
                throw new Error('Failed to start agent task');
            }

            // If waitForCompletion is true (inline mode), wait for task to complete
            if (waitForCompletion && context?.executionMode === 'inline') {
                // Poll for task completion
                const maxWaitTime = 300000; // 5 minutes max
                const pollInterval = 1000; // Check every second
                const startTime = Date.now();

                while (Date.now() - startTime < maxWaitTime) {
                    const status = await this.workspaceAgentService.getStatus(taskId);

                    if (status.status === 'completed') {
                        return { taskId, status: 'completed' };
                    } else if (status.status === 'failed') {
                        throw new Error(`Agent task failed`);
                    }

                    // Wait before next poll
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                }

                throw new Error('Agent task timed out after 5 minutes');
            }

            // Async mode: return immediately with task ID
            return { taskId, status: 'started' };
        } catch (error) {
            throw new Error(`Agent task execution failed: ${error}`);
        }
    }
}
