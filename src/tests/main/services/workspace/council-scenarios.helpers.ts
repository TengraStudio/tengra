/**
 * Shared helpers for council scenario tests.
 * Provides mock factories for AgentTaskState, ExecutionPlan, and persistence.
 */

import { AgentTaskState, ExecutionPlan } from '@shared/types/agent-state';
import { vi } from 'vitest';

/** Creates a minimal but fully-typed AgentTaskState for tests */
export function createMockTaskState(overrides: Partial<AgentTaskState> = {}): AgentTaskState {
    return {
        taskId: 'task-001',
        workspaceId: 'proj-001',
        description: 'Test council task',
        state: 'idle',
        currentStep: 0,
        totalSteps: 0,
        plan: null,
        messageHistory: [],
        eventHistory: [],
        currentProvider: {
            provider: 'openai',
            model: 'gpt-4',
            accountIndex: 0,
            status: 'active'
        },
        providerHistory: [],
        errors: [],
        recoveryAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: null,
        completedAt: null,
        metrics: {
            duration: 0,
            llmCalls: 0,
            toolCalls: 0,
            tokensUsed: 0,
            providersUsed: [],
            errorCount: 0,
            recoveryCount: 0,
            estimatedCost: 0
        },
        context: {
            workspacePath: '/test/workspace',
            workspaceName: 'test-workspace',
            workspace: { rootPath: '/test/workspace', hasGit: true, hasDependencies: true },
            constraints: { maxIterations: 50, maxDuration: 300000, maxToolCalls: 100, allowedTools: [] }
        },
        result: null,
        ...overrides
    };
}

/** Builds a simple 3-step execution plan */
export function createMockPlan(): ExecutionPlan {
    return {
        steps: [
            { index: 0, description: 'Analyze requirements', type: 'analysis', status: 'pending', toolsUsed: [] },
            { index: 1, description: 'Generate code', type: 'code_generation', status: 'pending', toolsUsed: [] },
            { index: 2, description: 'Run tests', type: 'testing', status: 'pending', toolsUsed: [] }
        ],
        estimatedDuration: 60000,
        requiredTools: ['file_read', 'file_write'],
        dependencies: []
    };
}

/** Builds a mock persistence service with vi.fn() stubs */
export function createMockPersistence(): Record<string, ReturnType<typeof vi.fn>> {
    return {
        updateTaskState: vi.fn().mockResolvedValue(undefined),
        saveCheckpoint: vi.fn().mockResolvedValue(undefined),
        loadTask: vi.fn(),
        loadCheckpoint: vi.fn(),
        createTask: vi.fn().mockResolvedValue(undefined),
        appendMessage: vi.fn().mockResolvedValue(undefined),
        saveEvent: vi.fn().mockResolvedValue(undefined),
        recordProviderAttempt: vi.fn().mockResolvedValue(undefined),
        recordError: vi.fn().mockResolvedValue(undefined),
        getCheckpoints: vi.fn().mockResolvedValue([]),
        getLatestCheckpoint: vi.fn().mockResolvedValue(null)
    };
}
