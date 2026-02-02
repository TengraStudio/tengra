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
}

export interface ProjectState {
    status: 'idle' | 'planning' | 'waiting_for_approval' | 'running' | 'paused' | 'failed' | 'completed' | 'error';
    currentTask: string;
    plan: ProjectStep[];
    history: Message[];
    lastError?: string;
    config?: AgentStartOptions;
    nodeId?: string;
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
