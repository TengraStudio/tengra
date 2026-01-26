import { Message } from '@/types/chat';
import { JsonObject } from '@/types/common';
import { WorkspaceMount } from '@/types/workspace';

export interface Project {
    id: string;
    title: string;
    description: string;
    path: string;
    mounts: WorkspaceMount[];
    createdAt: number;
    updatedAt: number;
    chatIds: string[];
    councilConfig: {
        enabled: boolean;
        members: string[]; // Model IDs
        consensusThreshold: number; // 0-1 (e.g. 0.7 for 70% agreement)
    };
    status: 'active' | 'archived' | 'draft';
    logo?: string;
    metadata?: JsonObject;
    type?: string;
    // Build Configuration
    buildConfig?: {
        buildCommand?: string;      // e.g. "npm run build"
        testCommand?: string;       // e.g. "npm test"
        lintCommand?: string;       // e.g. "npm run lint"
        outputDir?: string;         // e.g. "dist"
        envFile?: string;           // e.g. ".env.local"
    };
    // Development Server
    devServer?: {
        command?: string;           // e.g. "npm run dev"
        port?: number;              // e.g. 3000
        autoStart?: boolean;        // Start on project open
    };
    // Advanced Options
    advancedOptions?: {
        fileWatchEnabled?: boolean;     // Enable file change detection
        fileWatchIgnore?: string[];     // Patterns to ignore (e.g. ["node_modules", ".git"])
        indexingEnabled?: boolean;      // Enable code indexing for AI
        indexingInterval?: number;      // Re-index interval in minutes
        autoSave?: boolean;             // Auto-save files
    };
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

export interface ProjectIssue {
    type: 'error' | 'warning'
    message: string
    file: string
    line: number
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
    todos: string[]
    issues?: ProjectIssue[]
}
