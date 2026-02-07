import { Message } from './chat';

export interface AgentProfile {
    id: string;
    name: string;
    role: string;
    persona: string;
    systemPrompt: string;
    skills: string[];
}

export interface ProjectStep {
    id: string;
    text: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    /** Token usage for this step */
    tokens?: {
        prompt: number;
        completion: number;
    };
    /** Execution timing */
    timing?: {
        startedAt?: number;
        completedAt?: number;
        durationMs?: number;
    };
}

export interface ProjectState {
    status: 'idle' | 'planning' | 'waiting_for_approval' | 'running' | 'paused' | 'failed' | 'completed' | 'error';
    currentTask: string;
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
}

export interface AgentStartOptions {
    task: string;
    nodeId?: string;
    model?: { provider: string; model: string };
    projectId?: string;
    agentProfileId?: string;
    attachments?: Array<{ name: string; path: string; size: number }>;
    systemMode?: 'fast' | 'thinking' | 'architect';
}

export interface OrchestratorState extends ProjectState {
    activeAgentId?: string;
    assignments: Record<string, string>; // stepId -> agentProfileId
}
