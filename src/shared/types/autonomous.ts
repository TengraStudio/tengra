/**
 * Universal Autonomous Core (UAC) Shared Types
 * 
 * This file defines the common interfaces for the autonomous agent system,
 * including task structure, node-based canvas types, and domain definitions.
 */

export type UACDomain = 'project' | 'system' | 'web' | 'automation';

export type UACStatus = 'idle' | 'scoping' | 'planning' | 'executing' | 'waiting_approval' | 'validating' | 'completed' | 'failed' | 'recovering';

export interface UACSuccessCriteria {
    id: string;
    description: string;
    type: 'file_exists' | 'command_exit_zero' | 'content_match' | 'lint_passed' | 'test_passed';
    params: Record<string, unknown>;
    status: 'pending' | 'checking' | 'passed' | 'failed';
    errorMessage?: string;
}

export interface UACNode {
    id: string;
    type: 'trigger' | 'action' | 'condition' | 'verification' | 'human_in_loop';
    label: string;
    status: 'pending' | 'running' | 'success' | 'failed' | 'warning';
    domain: UACDomain;
    data: {
        thought?: string;
        action?: string;
        observation?: string;
        progress?: number;
        output?: unknown;
    };
    position: { x: number; y: number };
}

export interface UACEdge {
    id: string;
    source: string;
    target: string;
    type: 'default' | 'verification_fail' | 'data_flow';
    status: 'inactive' | 'active' | 'success' | 'error';
    label?: string;
}

export interface UACTask {
    id: string;
    projectId?: string; // Optional if global/system domain
    domain: UACDomain;
    description: string;
    status: UACStatus;
    nodes: UACNode[];
    edges: UACEdge[];
    criteria: UACSuccessCriteria[];
    metrics: {
        startTime: string;
        endTime?: string;
        tokenCount: number;
        cost: number;
        stepCount: number;
    };
    context: {
        allowedTools: string[];
        maxSteps: number;
        history: Record<string, unknown>[]; // Full raw message history
    };
}

export interface UACEvent {
    type: 'TASK_START' | 'TASK_UPDATE' | 'NODE_START' | 'NODE_COMPLETE' | 'VERIFICATION_START' | 'VERIFICATION_RESULT' | 'NEED_APPROVAL' | 'TASK_COMPLETE';
    payload: unknown;
    taskId: string;
    timestamp: string;
}
