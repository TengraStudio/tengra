import { Message } from './chat'
import { WorkspaceMount } from './workspace'

export interface Project {
    id: string;
    title: string;
    description: string;
    path: string;
    mounts?: WorkspaceMount[];
    createdAt: Date;
    chatIds: string[];
    councilConfig: {
        enabled: boolean;
        members: string[]; // Model IDs
        consensusThreshold: number; // 0-1 (e.g. 0.7 for 70% agreement)
    };
    status: 'active' | 'archived' | 'draft';
    logo?: string;
    metadata?: Record<string, any>;
}

export interface CouncilMessage extends Message {
    votes?: Record<string, 'agree' | 'disagree' | 'neutral'>;
    consensusReached?: boolean;
}
