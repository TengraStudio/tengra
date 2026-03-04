import { Message } from './chat';
import { JsonObject } from './common';

export type WorkspaceDashboardTab =
    | 'overview'
    | 'terminal'
    | 'files'
    | 'explorer'
    | 'tasks'
    | 'search'
    | 'code'
    | 'git'
    | 'env'
    | 'environment'
    | 'logs'
    | 'settings'
    | 'chat'
    | 'agent'
    | 'editor';

export type ProjectDashboardTab = WorkspaceDashboardTab;

export type WorkspaceMountType = 'local' | 'ssh';

export interface WorkspaceSshConfig {
    host: string;
    port?: number;
    username: string;
    authType?: 'password' | 'key';
    password?: string;
    privateKey?: string;
    passphrase?: string;
}

export interface WorkspaceMount {
    id: string;
    name: string;
    type: WorkspaceMountType;
    rootPath: string;
    ssh?: WorkspaceSshConfig;
}

export interface WorkspaceEntry {
    name: string;
    path: string;
    isDirectory: boolean;
    mountId: string;
    size?: number;
    lastModified?: Date;
    children?: WorkspaceEntry[];
    initialLine?: number;
}

export interface EditorTab {
    id: string;
    mountId: string;
    path: string;
    name: string;
    content: string;
    savedContent: string;
    isDirty: boolean;
    isPinned?: boolean;
    type: 'code' | 'image';
    initialLine?: number;
}

export interface ActivityEntry {
    id: string;
    timestamp: Date;
    title: string;
    detail?: string;
    type?: 'info' | 'error' | 'success' | 'plan' | 'action';
    agentId?: string;
    message: string;
}

export interface MountForm {
    type: 'local' | 'ssh';
    name: string;
    rootPath: string;
    host: string;
    port: string;
    username: string;
    authType: 'password' | 'key';
    password: string;
    privateKey: string;
    passphrase: string;
    saveProfile?: boolean;
}

export interface Workspace {
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
        autoStart?: boolean;        // Start on workspace open
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

export type Project = Workspace;

export interface WorkspaceCouncilMessage extends Message {
    votes?: Record<string, 'agree' | 'disagree' | 'neutral'>;
    consensusReached?: boolean;
}

export interface WorkspaceStats {
    fileCount: number;
    totalSize: number;
    loc: number; // approximate
    lastModified: number;
}

export interface WorkspaceIssue {
    type: 'error' | 'warning';
    message: string;
    file: string;
    line: number;
}

export interface WorkspaceAnalysis {
    type: 'node' | 'python' | 'rust' | 'go' | 'cpp' | 'java' | 'php' | 'csharp' | 'unknown' | string;
    frameworks: string[];
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    stats: WorkspaceStats;
    languages: Record<string, number>;
    files: string[];
    monorepo?: {
        type: 'npm' | 'yarn' | 'pnpm' | 'lerna' | 'turbo' | 'rush' | 'unknown';
        packages: string[];
    };
    todos: string[];
    issues?: WorkspaceIssue[];
}

export interface TodoItem {
    id: string;
    text: string;
    completed: boolean;
    line: number;
    filePath: string;
    relativePath: string;
}

export interface TodoFile {
    path: string;
    relativePath: string;
    items: TodoItem[];
}
