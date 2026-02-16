import type { AgentTaskState } from './agent-state';
import { Message } from './chat';

export interface AgentProfile {
    id: string;
    name: string;
    role: string;
    persona: string;
    systemPrompt: string;
    skills: string[];
}

/** Status of a project step */
export type ProjectStepStatus =
    | 'pending'
    | 'running'
    | 'completed'
    | 'failed'
    | 'skipped'
    | 'awaiting_step_approval';

export interface ProjectStep {
    id: string;
    text: string;
    status: ProjectStepStatus;
    type?: 'task' | 'fork' | 'join';
    dependsOn?: string[];
    priority?: 'low' | 'normal' | 'high' | 'critical';
    parallelLane?: number;
    branchId?: string;
    groupId?: string;
    groupName?: string;
    timing?: {
        startedAt?: number;
        completedAt?: number;
        durationMs?: number;
    };
    /** Token usage for this step */
    tokens?: {
        prompt: number;
        completion: number;
    };
    /** Estimated cost before execution */
    estimatedCost?: CostEstimate;
    /** Actual cost after execution */
    actualCost?: CostEstimate;
    /** AGT-PLN-05: Confidence score for this step (0-100) */
    confidence?: StepConfidence;
    /** AGT-COL-01: Per-step model configuration */
    modelConfig?: StepModelConfig;
    /** AGT-COL-02: Detected task type for routing */
    taskType?: TaskType;
    /** AGT-HIL-01: Step requires explicit user approval before execution */
    requiresApproval?: boolean;
    /** AGT-HIL-03: Step can be skipped by the user */
    isSkippable?: boolean;
    /** AGT-HIL-04: This step is a manual intervention point (agent pauses) */
    isInterventionPoint?: boolean;
    /** AGT-HIL-05: User-attached comments/notes */
    comments?: StepComment[];
    /** AGT-TST-01: Test configuration for this step */
    testConfig?: StepTestConfig;
    /** AGT-TST-02: Test results after step execution */
    testResult?: TestRunResult;
}

/** AGT-HIL-05: A user comment attached to a step */
export interface StepComment {
    id: string;
    text: string;
    createdAt: number;
}

/** AGT-PLN-05: Confidence scoring for a step */
export interface StepConfidence {
    score: number; // 0-100
    factors: {
        complexity: number; // Lower is better (simpler steps are more confident)
        specificity: number; // Higher is better (specific steps are more confident)
        toolAvailability: number; // Higher is better (tools exist for this step)
        historicalSuccess: number; // Higher is better (similar steps succeeded before)
    };
    explanation?: string;
}

/** Cost estimate for a step or plan */
export interface CostEstimate {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd: number;
}

/** Full cost breakdown for a plan */
export interface PlanCostBreakdown {
    totalEstimatedCost: number;
    inputCost: number;
    outputCost: number;
    stepBreakdown: Array<{
        stepId: string;
        stepText: string;
        estimatedTokens: number;
        estimatedCostUsd: number;
    }>;
    modelId: string;
    provider: string;
}

export interface ProjectState {
    status:
    | 'idle'
    | 'planning'
    | 'waiting_for_approval'
    | 'running'
    | 'paused'
    | 'failed'
    | 'completed'
    | 'error';
    currentTask: string;
    taskId?: string;
    plan: ProjectStep[];
    history: Message[];
    lastError?: string;
    config?: AgentStartOptions;
    nodeId?: string;
    /** Aggregated token usage for entire plan */
    totalTokens?: {
        prompt: number;
        completion: number;
    };
    /** Plan execution timing */
    timing?: {
        startedAt?: number;
        completedAt?: number;
    };
    /** Estimated cost before plan execution (AGT-TOK-02) */
    estimatedPlanCost?: PlanCostBreakdown;
    /** Actual cost after plan execution */
    actualPlanCost?: PlanCostBreakdown;
}

export interface AgentStartOptions {
    task: string;
    nodeId?: string;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    model?: { provider: string; model: string };
    projectId?: string;
    agentProfileId?: string;
    attachments?: Array<{ name: string; path: string; size: number }>;
    systemMode?: 'fast' | 'thinking' | 'architect';
    /** AGT-TOK-04: Maximum budget in USD. Execution stops if exceeded. */
    budgetLimitUsd?: number;
    /** I18N-05: User's preferred locale for agent responses */
    locale?: string;
}

export interface OrchestratorState extends ProjectState {
    activeAgentId?: string;
    assignments: Record<string, string>; // stepId -> agentProfileId
}

export interface AgentTaskHistoryItem {
    id: string;
    description: string;
    provider: string;
    model: string;
    status:
    | 'idle'
    | 'planning'
    | 'waiting_for_approval'
    | 'running'
    | 'paused'
    | 'failed'
    | 'completed'
    | 'error';
    createdAt: number;
    updatedAt: number;
    latestCheckpointId?: string;
}

export type AgentCheckpointTrigger =
    | 'manual_snapshot'
    | 'auto_step_completion'
    | 'auto_state_sync'
    | 'pre_rollback'
    | 'rollback_resume'
    | 'resume_restore';

export interface AgentCheckpointSnapshotV1 {
    schemaVersion: 1;
    trigger: AgentCheckpointTrigger;
    createdAt: number;
    state: AgentTaskState;
}

export interface AgentCheckpointItem {
    id: string;
    taskId: string;
    stepIndex: number;
    trigger: AgentCheckpointTrigger;
    createdAt: number;
    state?: AgentTaskState;
}

export interface PlanVersionItem {
    id: string;
    taskId: string;
    versionNumber: number;
    reason: 'proposed' | 'approved' | 'rollback' | 'manual';
    plan: ProjectStep[];
    createdAt: number;
}

export interface RollbackCheckpointResult {
    success: boolean;
    taskId: string;
    resumedCheckpointId: string;
    preRollbackCheckpointId: string;
    planVersionId?: string;
}

// ===== AGT-COL: Multi-Model Collaboration Types =====

/** AGT-COL-01: Model configuration for a specific step */
export interface StepModelConfig {
    provider: string;
    model: string;
    /** Reason for using this model (e.g., "code generation", "research") */
    reason?: string;
}

/** AGT-COL-02: Task type for model routing */
export type TaskType =
    | 'code_generation'
    | 'code_review'
    | 'research'
    | 'documentation'
    | 'debugging'
    | 'testing'
    | 'refactoring'
    | 'planning'
    | 'general';

/** AGT-COL-02: Model routing rule for task types */
export interface ModelRoutingRule {
    taskType: TaskType;
    provider: string;
    model: string;
    priority: number; // Higher priority = preferred
}

/** AGT-COL-03: Vote for a decision */
export interface ModelVote {
    modelId: string;
    provider: string;
    decision: string;
    confidence: number; // 0-100
    reasoning?: string;
    timestamp: number;
}

/** AGT-COL-03: Voting session for critical decisions */
export interface VotingSession {
    id: string;
    taskId: string;
    stepIndex: number;
    question: string;
    options: string[];
    votes: ModelVote[];
    status: 'pending' | 'voting' | 'resolved' | 'deadlocked';
    finalDecision?: string;
    createdAt: number;
    resolvedAt?: number;
}

/** AGT-COL-04: Consensus result from multiple model outputs */
export interface ConsensusResult {
    agreed: boolean;
    mergedOutput?: string;
    conflictingPoints?: Array<{
        topic: string;
        outputs: Array<{ modelId: string; output: string }>;
    }>;
    resolutionMethod: 'unanimous' | 'majority' | 'arbitration' | 'manual';
}

// ===== AGT-TPL: Agent Template Types =====

/** AGT-TPL-01: Template category */
export type AgentTemplateCategory =
    | 'refactor'
    | 'bug-fix'
    | 'feature'
    | 'documentation'
    | 'testing'
    | 'security'
    | 'performance'
    | 'custom';

/** AGT-TPL-03: Template variable definition */
export interface AgentTemplateVariable {
    name: string;
    type: 'string' | 'file_path' | 'directory' | 'select' | 'boolean' | 'number';
    description: string;
    required: boolean;
    defaultValue?: string | number | boolean;
    options?: string[]; // For 'select' type
    placeholder?: string;
}

/** AGT-TPL-01/02: Agent task template */
export interface AgentTemplate {
    id: string;
    name: string;
    description: string;
    category: AgentTemplateCategory;
    /** System prompt override for this template */
    systemPromptOverride?: string;
    /** Pre-defined task description with variable placeholders */
    taskTemplate: string;
    /** Pre-defined plan steps (optional) */
    predefinedSteps?: string[];
    /** Variables that can be substituted */
    variables: AgentTemplateVariable[];
    /** Model routing overrides for this template */
    modelRouting?: ModelRoutingRule[];
    /** Tags for searchability */
    tags: string[];
    /** Is this a built-in template? */
    isBuiltIn: boolean;
    /** Author ID (for user-created templates) */
    authorId?: string;
    createdAt: number;
    updatedAt: number;
}

/** AGT-TPL-04: Template export format */
export interface AgentTemplateExport {
    version: 1;
    template: AgentTemplate;
    exportedAt: number;
    exportedBy?: string;
}

// ===== AGT-TST: Testing Integration Types =====

/** AGT-TST-01: Test run configuration */
export interface TestRunConfig {
    command: string;
    framework: 'vitest' | 'jest' | 'mocha' | 'playwright' | 'custom';
    timeout?: number;
    coverageEnabled?: boolean;
    coverageThreshold?: number;
    watch?: boolean;
    filter?: string;
}

/** AGT-TST-02: Individual test case result */
export interface TestCaseResult {
    name: string;
    suite: string;
    status: 'passed' | 'failed' | 'skipped' | 'pending';
    duration: number;
    error?: {
        message: string;
        stack?: string;
        expected?: string;
        actual?: string;
    };
}

/** AGT-TST-02: Test run result */
export interface TestRunResult {
    success: boolean;
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    startedAt: number;
    completedAt: number;
    tests: TestCaseResult[];
    coverage?: TestCoverageResult;
    output: string;
}

/** AGT-TST-04: Coverage result */
export interface TestCoverageResult {
    lines: { covered: number; total: number; percentage: number };
    branches: { covered: number; total: number; percentage: number };
    functions: { covered: number; total: number; percentage: number };
    statements: { covered: number; total: number; percentage: number };
    files: Array<{
        path: string;
        lines: number;
        branches: number;
        functions: number;
        statements: number;
    }>;
}

/** AGT-TST: Step test configuration */
export interface StepTestConfig {
    enabled: boolean;
    runAfterStep: boolean;
    failOnTestFailure: boolean;
    command?: string;
    filter?: string;
}
