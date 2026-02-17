import { JsonValue } from './common';

export type TriggerType = 'manual' | 'app_start' | 'interval' | 'event';
export type ActionType = 'command' | 'log' | 'http_request' | 'llm_prompt' | 'delay';

export interface WorkflowTrigger {
    id: string;
    type: TriggerType;
    config: Record<string, JsonValue>;
}

export interface WorkflowAction {
    id: string;
    type: ActionType;
    config: Record<string, JsonValue>;
}

export interface WorkflowStep {
    id: string;
    name: string;
    action: WorkflowAction;
    nextStepId?: string; // For linear workflows, or handling branching later
}

export interface Workflow {
    id: string;
    name: string;
    description?: string;
    enabled: boolean;
    triggers: WorkflowTrigger[];
    steps: WorkflowStep[];
    createdAt: number;
    updatedAt: number;
    lastRunAt?: number;
    lastRunStatus?: 'success' | 'failure';
}

export interface WorkflowExecutionResult {
    workflowId: string;
    status: 'success' | 'failure';
    startTime: number;
    endTime: number;
    logs: string[];
    error?: string;
}
