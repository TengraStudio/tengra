import { SESSION_RUNTIME_EVENTS } from '@shared/constants/session-runtime-events';
import { JsonValue } from '@shared/types/common';
import { CouncilStepStatus,PlanCostBreakdown, WorkspaceStep } from '@shared/types/council';
import { IdeaProgress, ResearchProgress } from '@shared/types/ideas';

export interface ModelUpdateEvent {
    provider: string
    count: number
    timestamp: number
}

export interface AuthStatusEvent {
    provider: string
    isAuthenticated: boolean
    username?: string
}

export interface SystemEvents {
    'model:updated': ModelUpdateEvent
    'auth:changed': AuthStatusEvent
    'config:updated': { path: string; key: string; value: JsonValue }
    'process:started': { id: string; name: string }
    'process:exited': { id: string; code: number }
    'power:state-changed': { isLowPowerMode: boolean }
    // New events for Phase 5
    'db:ready': { timestamp: number }
    'db:error': { error: string }
    'proxy:ready': { port: number }
    'proxy:error': { error: string }
    'proxy:sync-start': { provider: string }
    'proxy:sync-end': { provider: string; success: boolean }
    'token:refreshed': { provider: string; accountId?: string }
    'token:error': { provider: string; error: string }
    'token:permanent_failure': { provider: string; accountId: string; error: string }
    'account:unlinked': { accountId: string; provider: string }
    'account:linked': { accountId: string; provider: string }
    'account:updated': { accountId: string; provider: string }
    'settings:changed': { settings: JsonValue }
    'system:error': { error: string; fatal?: boolean; stack?: string }
    // Ideas feature events
    'ideas:research-progress': ResearchProgress
    'ideas:idea-progress': IdeaProgress
    'idea:regenerated': { ideaId: string }
    'file-changed': { path: string; type: 'create' | 'update' | 'delete' }
    // Automation session runtime events
    [SESSION_RUNTIME_EVENTS.AUTOMATION_STEP_UPDATE]: {
        index: number;
        status: CouncilStepStatus;
        message?: string;
        taskId?: string;
    }
    [SESSION_RUNTIME_EVENTS.AUTOMATION_PLAN_PROPOSED]: {
        steps: Array<string | WorkspaceStep>;
        taskId?: string;
    }
    [SESSION_RUNTIME_EVENTS.AUTOMATION_COST_ESTIMATED]: {
        taskId: string;
        estimate: PlanCostBreakdown;
    }
    [SESSION_RUNTIME_EVENTS.AUTOMATION_BUDGET_EXCEEDED]: {
        taskId: string;
        budgetLimitUsd: number;
        currentCostUsd: number;
    }
    [SESSION_RUNTIME_EVENTS.AUTOMATION_PLAN_REVISED]: {
        action: 'add' | 'remove' | 'modify' | 'insert';
        index?: number;
        stepText?: string;
        reason: string;
        taskId?: string;
    }
    'sd-cpp:progress': { downloaded: number; total: number; filename: string }
    'sd-cpp:status': { state: 'installing' | 'ready' | 'failed'; error?: string }
    'image:schedule-alert': { taskId: string; status: 'completed' | 'failed' | 'canceled'; prompt: string; error?: string; timestamp: number }
    // Model Registry Cache & Telemetry
    'model-registry.cache.update.started': { provider?: string }
    'model-registry.cache.update.completed': { provider?: string; count: number }
    'model-registry.provider.fetch.failed': { provider: string; error: string }
    'telemetry:model-registry': { name: SystemEventKey;[key: string]: RuntimeValue; timestamp: number }
    'security:vulnerabilities-found': { critical: number; high: number; timestamp: number }
    // User behavior tracking events
    'user:feature-used': { featureId: string; metadata?: Record<string, RuntimeValue> }
    'user:model-selected': { provider: string; modelId: string }
    'user:chat-sent': { modelId: string; messageLength: number }
    'user:shortcut-used': { shortcut: string }
    // Collaboration events
    'collaboration:joined': { roomId: string }
    'collaboration:left': { roomId: string }
    'collaboration:sync': { roomId: string; data: string }
    'collaboration:error': { roomId: string; error: string }
}

export type SystemEventKey = keyof SystemEvents
