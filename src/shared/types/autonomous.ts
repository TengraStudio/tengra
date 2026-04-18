/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Universal Autonomous Core (UAC) Shared Types
 * 
 * This file defines the common interfaces for the autonomous agent system,
 * including task structure, node-based canvas types, and domain definitions.
 */

export type UACDomain = 'workspace' | 'system' | 'web' | 'automation';

export type UACStatus = 'idle' | 'scoping' | 'planning' | 'executing' | 'waiting_approval' | 'validating' | 'completed' | 'failed' | 'recovering';

export interface UACSuccessCriteria {
    id: string;
    description: string;
    type: 'file_exists' | 'command_exit_zero' | 'content_match' | 'lint_passed' | 'test_passed';
    params: Record<string, RuntimeValue>;
    status: 'pending' | 'checking' | 'passed' | 'failed';
    errorMessage?: string;
}

export type UACNodeType = 'trigger' | 'action' | 'condition' | 'verification' | 'human_in_loop';

export interface UACNodeBase {
    id: string;
    type: UACNodeType;
    label: string;
    status: 'pending' | 'running' | 'success' | 'failed' | 'warning';
    domain: UACDomain;
    position: { x: number; y: number };
}

export interface UACTriggerNode extends UACNodeBase {
    type: 'trigger';
    data: {
        triggerType: 'manual' | 'schedule' | 'event';
        config?: Record<string, RuntimeValue>;
    };
}

export interface UACActionNode extends UACNodeBase {
    type: 'action';
    data: {
        action: string;
        params?: Record<string, RuntimeValue>;
        progress?: number;
        output?: RuntimeValue;
        thought?: string;
    };
}

export interface UACConditionNode extends UACNodeBase {
    type: 'condition';
    data: {
        condition: string;
        observation?: string;
    };
}

export interface UACVerificationNode extends UACNodeBase {
    type: 'verification';
    data: {
        criteriaId: string;
        status?: 'passed' | 'failed';
        observation?: string;
    };
}

export interface UACHumanNode extends UACNodeBase {
    type: 'human_in_loop';
    data: {
        prompt: string;
        response?: string;
    };
}

export type UACNode = UACTriggerNode | UACActionNode | UACConditionNode | UACVerificationNode | UACHumanNode;

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
    workspaceId?: string; // Optional if global/system domain
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
        history: Record<string, RuntimeValue>[]; // Full raw message history
    };
}

export interface UACEvent {
    type: 'TASK_START' | 'TASK_UPDATE' | 'NODE_START' | 'NODE_COMPLETE' | 'VERIFICATION_START' | 'VERIFICATION_RESULT' | 'NEED_APPROVAL' | 'TASK_COMPLETE';
    payload: RuntimeValue;
    taskId: string;
    timestamp: string;
}
