import { Message } from './chat';

export interface ProjectState {
    status: 'idle' | 'running' | 'paused' | 'error';
    currentTask: string;
    plan: string[];
    history: Message[];
    lastError?: string;
}
