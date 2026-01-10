import { Message } from './chat'
import { WorkspaceMount } from './workspace'
import { JsonObject } from './common'

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
    metadata?: JsonObject;
}

export interface CouncilMessage extends Message {
    votes?: Record<string, 'agree' | 'disagree' | 'neutral'>;
    consensusReached?: boolean;
}

export interface ProjectStats {
    fileCount: number
    totalSize: number
    loc: number // approximate
    lastModified: number
}

export interface ProjectAnalysis {
    type: 'node' | 'python' | 'rust' | 'go' | 'cpp' | 'java' | 'php' | 'csharp' | 'unknown' | string
    frameworks: string[]
    dependencies: Record<string, string>
    devDependencies: Record<string, string>
    stats: ProjectStats
    languages: Record<string, number>
    files: string[]
    monorepo?: {
        type: 'npm' | 'yarn' | 'pnpm' | 'lerna' | 'turbo' | 'rush' | 'unknown';
        packages: string[];
    }
}
