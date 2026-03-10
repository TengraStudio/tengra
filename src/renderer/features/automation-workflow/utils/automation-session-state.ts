import {
    AutomationSessionMessageMetadata,
    AutomationSessionMetadataExtras,
} from '@shared/types/automation-session';
import { WorkspaceState, WorkspaceStep } from '@shared/types/automation-workflow';
import { Message, ToolCall, ToolResult } from '@shared/types/chat';
import type { JsonObject, JsonValue } from '@shared/types/common';
import {
    SessionRecoverySnapshot,
    SessionState,
    SessionStatus,
} from '@shared/types/session-engine';

const ACTIVE_SESSION_STATUS_PRIORITY: Record<SessionStatus, number> = {
    streaming: 0,
    preparing: 1,
    waiting_for_input: 2,
    paused: 3,
    interrupted: 4,
    failed: 5,
    completed: 6,
    idle: 7,
};
const ACTIVE_WORKSPACE_STATUS_PRIORITY: Record<WorkspaceState['status'], number> = {
    running: 0,
    planning: 1,
    waiting_for_approval: 2,
    paused: 3,
    error: 4,
    failed: 5,
    completed: 6,
    idle: 7,
};

const WORKSPACE_STEP_STATUSES = new Set<WorkspaceStep['status']>([
    'pending',
    'running',
    'completed',
    'failed',
    'skipped',
    'awaiting_step_approval',
]);

const isJsonObject = (value: JsonValue | undefined): value is JsonObject => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isWorkspaceStep = (value: JsonValue | undefined): value is WorkspaceStep => {
    if (!isJsonObject(value)) {
        return false;
    }

    return (
        typeof value.id === 'string'
        && typeof value.text === 'string'
        && typeof value.status === 'string'
        && WORKSPACE_STEP_STATUSES.has(value.status as WorkspaceStep['status'])
    );
};

const toWorkspaceSteps = (value: JsonValue | undefined): WorkspaceState['plan'] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter(isWorkspaceStep);
};

const toStringArray = (value: JsonValue | undefined): string[] | undefined => {
    if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
        return undefined;
    }

    const items: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
        items.push(value[index] as string);
    }
    return items;
};

const isToolCall = (value: JsonValue | undefined): value is ToolCall => {
    if (!isJsonObject(value) || value.type !== 'function' || !isJsonObject(value.function)) {
        return false;
    }

    return (
        typeof value.function.name === 'string'
        && typeof value.function.arguments === 'string'
    );
};

const toToolCalls = (value: JsonValue | undefined): ToolCall[] | undefined => {
    if (!Array.isArray(value) || value.some(item => !isToolCall(item))) {
        return undefined;
    }

    const items: ToolCall[] = [];
    for (let index = 0; index < value.length; index += 1) {
        const item = value[index];
        if (isToolCall(item)) {
            items.push(item);
        }
    }
    return items;
};

const isToolResult = (value: JsonValue | undefined): value is ToolResult => {
    if (!isJsonObject(value)) {
        return false;
    }

    return typeof value.toolCallId === 'string' && typeof value.name === 'string';
};

const toToolResults = (
    value: JsonValue | undefined
): ToolResult[] | string | undefined => {
    if (typeof value === 'string') {
        return value;
    }

    if (!Array.isArray(value) || value.some(item => !isToolResult(item))) {
        return undefined;
    }

    const items: ToolResult[] = [];
    for (let index = 0; index < value.length; index += 1) {
        const item = value[index];
        if (isToolResult(item)) {
            items.push(item);
        }
    }
    return items;
};

const mapSessionStatusToWorkspaceStatus = (status: SessionStatus): WorkspaceState['status'] => {
    switch (status) {
        case 'preparing':
            return 'planning';
        case 'streaming':
            return 'running';
        case 'waiting_for_input':
            return 'waiting_for_approval';
        case 'paused':
            return 'paused';
        case 'failed':
            return 'failed';
        case 'completed':
            return 'completed';
        case 'interrupted':
            return 'error';
        case 'idle':
        default:
            return 'idle';
    }
};

const getAutomationExtras = (
    session: Pick<SessionState, 'metadata'> | Pick<SessionRecoverySnapshot, 'metadata'>
): AutomationSessionMetadataExtras | null => {
    if (!isJsonObject(session.metadata.extras)) {
        return null;
    }

    return session.metadata.extras as AutomationSessionMetadataExtras;
};

const toWorkspaceHistory = (
    messages: SessionState['messages']
): Message[] => {
    return messages.map(message => {
        const metadata = isJsonObject(message.metadata)
            ? (message.metadata as AutomationSessionMessageMetadata)
            : null;

        return {
            id: message.id,
            role: message.role === 'council' ? 'assistant' : message.role,
            content: message.content,
            timestamp: new Date(message.createdAt),
            reasoning: typeof metadata?.reasoning === 'string' ? metadata.reasoning : undefined,
            toolCalls: toToolCalls(metadata?.toolCalls),
            toolCallId:
                typeof metadata?.toolCallId === 'string' ? metadata.toolCallId : undefined,
            toolResults: toToolResults(metadata?.toolResults),
            provider: typeof metadata?.provider === 'string' ? metadata.provider : undefined,
            model: typeof metadata?.model === 'string' ? metadata.model : undefined,
            responseTime:
                typeof metadata?.responseTime === 'number'
                    ? metadata.responseTime
                    : undefined,
            sources: toStringArray(metadata?.sources),
            images: toStringArray(metadata?.images),
            metadata: metadata ?? undefined,
        };
    });
};

export const isAutomationRecoverySnapshot = (
    snapshot: SessionRecoverySnapshot
): boolean => {
    return snapshot.mode === 'automation';
};

export const pickPrimaryAutomationSnapshot = (
    snapshots: SessionRecoverySnapshot[]
): SessionRecoverySnapshot | null => {
    const automationSnapshots = snapshots.filter(isAutomationRecoverySnapshot);
    if (automationSnapshots.length === 0) {
        return null;
    }

    return [...automationSnapshots].sort((left, right) => {
        const statusDelta =
            ACTIVE_SESSION_STATUS_PRIORITY[left.status] - ACTIVE_SESSION_STATUS_PRIORITY[right.status];
        if (statusDelta !== 0) {
            return statusDelta;
        }

        return right.updatedAt - left.updatedAt;
    })[0] ?? null;
};

export const toWorkspaceStateFromSession = (
    session: SessionState | null
): WorkspaceState | null => {
    if (session?.mode !== 'automation') {
        return null;
    }

    const extras = getAutomationExtras(session);
    const workflowStatus = extras?.workflowStatus;

    return {
        status:
            workflowStatus && workflowStatus !== 'interrupted'
                ? workflowStatus
                : mapSessionStatusToWorkspaceStatus(session.status),
        currentTask:
            typeof extras?.currentTask === 'string'
                ? extras.currentTask
                : session.metadata.title ?? '',
        taskId: session.metadata.taskId ?? session.id,
        nodeId:
            typeof extras?.currentNodeId === 'string' ? extras.currentNodeId : undefined,
        plan: toWorkspaceSteps(extras?.plan),
        history: toWorkspaceHistory(session.messages),
        lastError: session.lastError,
        config: {
            task:
                typeof extras?.currentTask === 'string'
                    ? extras.currentTask
                    : session.metadata.title ?? '',
            workspaceId: session.metadata.workspaceId,
            agentProfileId:
                typeof extras?.agentProfileId === 'string'
                    ? extras.agentProfileId
                    : undefined,
            systemMode:
                extras?.systemMode === 'fast'
                || extras?.systemMode === 'thinking'
                || extras?.systemMode === 'architect'
                    ? extras.systemMode
                    : undefined,
            model: {
                provider: session.model.provider,
                model: session.model.model,
            },
        },
        totalTokens: extras?.totalTokens,
        timing: extras?.timing,
        estimatedPlanCost: extras?.estimatedPlanCost,
        actualPlanCost: extras?.actualPlanCost,
        performanceMetrics: extras?.performanceMetrics,
    };
};

export const toWorkspaceStateFromSnapshot = (
    snapshot: SessionRecoverySnapshot | null
): WorkspaceState | null => {
    if (snapshot?.mode !== 'automation') {
        return null;
    }

    const extras = getAutomationExtras(snapshot);
    const workflowStatus = extras?.workflowStatus;

    return {
        status:
            workflowStatus && workflowStatus !== 'interrupted'
                ? workflowStatus
                : mapSessionStatusToWorkspaceStatus(snapshot.status),
        currentTask:
            typeof extras?.currentTask === 'string'
                ? extras.currentTask
                : snapshot.metadata.title ?? '',
        taskId: snapshot.metadata.taskId ?? snapshot.sessionId,
        nodeId:
            typeof extras?.currentNodeId === 'string' ? extras.currentNodeId : undefined,
        plan: toWorkspaceSteps(extras?.plan),
        history: [],
        config: {
            task:
                typeof extras?.currentTask === 'string'
                    ? extras.currentTask
                    : snapshot.metadata.title ?? '',
            workspaceId: snapshot.metadata.workspaceId,
            agentProfileId:
                typeof extras?.agentProfileId === 'string'
                    ? extras.agentProfileId
                    : undefined,
            systemMode:
                extras?.systemMode === 'fast'
                || extras?.systemMode === 'thinking'
                || extras?.systemMode === 'architect'
                    ? extras.systemMode
                    : undefined,
        },
        totalTokens: extras?.totalTokens,
        timing: extras?.timing,
        estimatedPlanCost: extras?.estimatedPlanCost,
        actualPlanCost: extras?.actualPlanCost,
        performanceMetrics: extras?.performanceMetrics,
    };
};

export const pickPrimaryAutomationState = (
    states: WorkspaceState[]
): WorkspaceState | null => {
    if (states.length === 0) {
        return null;
    }

    return [...states].sort((left, right) => {
        const statusDelta =
            ACTIVE_WORKSPACE_STATUS_PRIORITY[left.status]
            - ACTIVE_WORKSPACE_STATUS_PRIORITY[right.status];
        if (statusDelta !== 0) {
            return statusDelta;
        }

        const leftUpdatedAt = left.timing?.completedAt ?? left.timing?.startedAt ?? 0;
        const rightUpdatedAt = right.timing?.completedAt ?? right.timing?.startedAt ?? 0;
        return rightUpdatedAt - leftUpdatedAt;
    })[0] ?? null;
};

