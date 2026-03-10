import type {
    AgentPerformanceMetrics,
    AgentStartOptions,
    AutomationWorkflowState,
    AutomationWorkflowStep,
    PlanCostBreakdown,
} from './automation-workflow';
import type {
    ToolCall,
    ToolResult,
} from './chat';
import type { JsonObject } from './common';

export interface AutomationSessionMetadataExtras extends JsonObject {
    workflowStatus?: AutomationWorkflowState['status'] | 'interrupted';
    currentTask?: string | null;
    currentNodeId?: string | null;
    plan?: AutomationWorkflowStep[];
    totalTokens?: AutomationWorkflowState['totalTokens'];
    timing?: AutomationWorkflowState['timing'];
    estimatedPlanCost?: PlanCostBreakdown;
    actualPlanCost?: PlanCostBreakdown;
    performanceMetrics?: AgentPerformanceMetrics;
    systemMode?: AgentStartOptions['systemMode'] | null;
    agentProfileId?: string | null;
}

export interface AutomationSessionMessageMetadata extends JsonObject {
    reasoning?: string;
    toolCalls?: ToolCall[];
    toolCallId?: string | null;
    toolResults?: ToolResult[] | string | null;
    provider?: string | null;
    model?: string | null;
    responseTime?: number | null;
    sources?: string[];
    images?: string[];
}
