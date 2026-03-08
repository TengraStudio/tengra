

import { BaseService } from '@main/services/base.service';
import { AgentPersistenceService } from '@main/services/workspace/agent/agent-persistence.service';
import { agentStateReducer } from '@main/services/workspace/automation-workflow/agent-state-machine';
import { AgentEvent, AgentTaskState } from '@shared/types/agent-state';

/**
 * AgentExecutorService
 * 
 * Orchestrates the execution of agent tasks, managing state transitions
 * and ensuring persistence (checkpoints) at critical stages.
 */
export class AgentExecutorService extends BaseService {
    constructor(
        private persistenceService: AgentPersistenceService
    ) {
        super('AgentExecutorService');
    }

    async initialize(): Promise<void> {
        this.logInfo('AgentExecutorService initialized');
    }

    /**
     * Dispatch an event to the agent state machine and persist the result
     * @param currentState Current agent state
     * @param event Event to process
     * @returns New agent state
     */
    async dispatch(currentState: AgentTaskState, event: AgentEvent): Promise<AgentTaskState> {
        try {
            // 1. Calculate new state (pure reduction)
            const newState = agentStateReducer(currentState, event);

            // 2. Persist task state updates
            // We update the main task record for visibility/queries
            await this.persistenceService.updateTaskState(
                newState.taskId,
                { state: newState.state }
            );

            // 3. Auto-save checkpoint if step completed or state changed significantly
            // AGT-CP-03: Auto-save checkpoint after each step completion
            const stepChanged = newState.currentStep !== currentState.currentStep;
            const stateChanged = newState.state !== currentState.state;

            if (stepChanged || (stateChanged && ['planning', 'executing', 'waiting_user'].includes(newState.state))) {
                await this.persistenceService.saveCheckpoint(
                    newState.taskId,
                    newState.currentStep,
                    newState
                );
                this.logDebug(`Checkpoint saved for task ${newState.taskId} at step ${newState.currentStep}`);
            }

            return newState;
        } catch (error) {
            this.logError('Failed to dispatch event', error as Error);
            throw error;
        }
    }

    /**
     * Resume execution of a task
     * @param taskId Task ID to resume
     */
    async resumeTask(taskId: string): Promise<void> {
        const state = await this.persistenceService.loadTask(taskId);
        if (!state) {
            throw new Error(`Task ${taskId} not found`);
        }

        this.logInfo(`Resuming task ${taskId} from state ${state.state}`);
        // In a real implementation, this would trigger the execution loop
    }

    /**
     * Resume execution from a specific checkpoint
     * @param checkpointId Checkpoint ID to resume from
     * @returns Resumed AgentTaskState
     */
    async resumeFromCheckpoint(checkpointId: string): Promise<AgentTaskState> {
        const state = await this.persistenceService.loadCheckpoint(checkpointId);
        if (!state) {
            throw new Error(`Checkpoint ${checkpointId} not found`);
        }

        this.logInfo(`Resuming task ${state.taskId} from checkpoint ${checkpointId} (step ${state.currentStep})`);

        // Update the main task record to match the checkpoint
        await this.persistenceService.updateTaskState(state.taskId, state);

        // Log the resumption event
        // Note: We don't dispatch this event because we don't want to trigger another checkpoint save immediately
        // or alter the state we just loaded (other than potentially adding a resume event)

        return state;
    }
}
