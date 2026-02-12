import { JsonValue } from '@shared/types/common';
import { IdeaProgress, ResearchProgress } from '@shared/types/ideas';
import { OrchestratorState, PlanCostBreakdown, ProjectState, ProjectStep, ProjectStepStatus } from '@shared/types/project-agent';

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
    // New events for Phase 5
    'db:ready': { timestamp: number }
    'db:error': { error: string }
    'proxy:ready': { port: number }
    'proxy:error': { error: string }
    'proxy:sync-start': { provider: string }
    'proxy:sync-end': { provider: string; success: boolean }
    'token:refreshed': { provider: string; accountId?: string }
    'token:error': { provider: string; error: string }
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
    // Project Agent
    'project:update': ProjectState
    'project:step-update': { index: number; status: ProjectStepStatus; message?: string; taskId?: string }
    'project:plan-proposed': { steps: Array<string | ProjectStep>; taskId?: string }
    'project:cost-estimated': { taskId: string; estimate: PlanCostBreakdown }
    'project:budget-exceeded': { taskId: string; budgetLimitUsd: number; currentCostUsd: number }
    'project:plan-revised': { action: 'add' | 'remove' | 'modify' | 'insert'; index?: number; stepText?: string; reason: string; taskId?: string }
    'orchestrator:update': OrchestratorState
    // sd-cpp runtime
    'sd-cpp:status': { state: 'installing' | 'ready' | 'failed'; error?: string }
    'sd-cpp:progress': { downloaded: number; total: number; filename: string }
}

export type SystemEventKey = keyof SystemEvents
