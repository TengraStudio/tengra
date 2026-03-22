import { Message } from './chat';
import { JsonObject } from './common';

export type WorkspaceDashboardTab =
    | 'overview'
    | 'terminal'
    | 'files'
    | 'explorer'
    | 'tasks'
    | 'search'
    | 'git'
    | 'env'
    | 'environment'
    | 'logs'
    | 'settings'
    | 'chat'
    | 'editor';

export interface WorkspaceFilesPageMeta {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
}

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

export interface WorkspaceDefinitionLocation {
    file: string;
    line: number;
    column: number;
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
        layoutProfile?: {
            sidebarCollapsed?: boolean;
            terminalVisible?: boolean;
            terminalHeight?: number;
            panel?: 'chat' | 'terminal' | 'files' | 'explorer' | 'search' | 'git' | 'logs' | 'settings' | 'none';
        };
    };
    // Editor Settings
    editor?: {
        fontSize?: number;
        lineHeight?: number;
        minimap?: boolean;
        wordWrap?: 'on' | 'off' | 'wordWrapColumn' | 'bounded';
        lineNumbers?: 'on' | 'off' | 'relative' | 'interval';
        tabSize?: number;
        cursorBlinking?: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid';
        fontLigatures?: boolean;
        formatOnPaste?: boolean;
        smoothScrolling?: boolean;
        folding?: boolean;
        codeLens?: boolean;
        inlayHints?: boolean;
        additionalOptions?: Record<string, unknown>;
    };
}

export interface WorkspaceCouncilMessage extends Message {
    votes?: Record<string, 'agree' | 'disagree' | 'neutral'>;
    consensusReached?: boolean;
}

export interface WorkspaceStats {
    fileCount: number;
    totalSize: number;
    loc: number; // approximate
    lastModified: number;
    largestDirectories?: Array<{
        path: string;
        size: number;
        fileCount: number;
    }>;
}

export interface CodeAnnotation {
    file: string;
    line: number;
    message: string;
    type: 'todo' | 'fixme' | 'warn' | 'error';
}

export interface WorkspaceIssue {
    file: string;
    line: number;
    column?: number;
    message: string;
    severity: 'error' | 'warning' | 'info' | 'hint';
    source: string;
    code?: string | number;
}

export interface WorkspaceLspServerSupport {
    languageId: string;
    serverId: string;
    status: 'running' | 'available' | 'unavailable';
    bundled: boolean;
    fileCount: number;
}

export interface WorkspaceAnalysis {
    type: 'node' | 'python' | 'rust' | 'go' | 'cpp' | 'java' | 'php' | 'csharp' | 'unknown' | string;
    frameworks: string[];
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    stats: WorkspaceStats;
    languages: Record<string, number>;
    files: string[];
    filesPage?: WorkspaceFilesPageMeta;
    monorepo?: {
        type: 'npm' | 'yarn' | 'pnpm' | 'lerna' | 'turbo' | 'rush' | 'unknown';
        packages: string[];
    };
    todos: string[];
    issues?: WorkspaceIssue[];
    annotations?: CodeAnnotation[];
    lspDiagnostics?: WorkspaceIssue[];
    lspServers?: WorkspaceLspServerSupport[];
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
