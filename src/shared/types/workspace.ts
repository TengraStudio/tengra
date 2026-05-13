/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Message } from './chat';
import { JsonObject, JsonValue } from './common';

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
    | 'settings'
    | 'chat'
    | 'file_history'
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
    isGitIgnored?: boolean;
    gitStatus?: string;
    gitRawStatus?: string;
    size?: number;
    lastModified?: Date;
    children?: WorkspaceEntry[];
    initialLine?: number;
}

export interface WorkspaceEntryRow {
    id: string;
    key: string;
    mountId: string;
    name: string;
    path: string;
    icon: string;
    isDirectory: boolean;
    isExpanded: boolean;
    isUnknown: boolean; // Entry hidden by diagnostics/ignore (no row in VirtualizedTable)
    depth: number;      // 0 = top-level mount row
    isTarget?: boolean; // Path shown in breadcrumb

    // Virtualization range: indices in the `displayRows` array (flat list)
    firstDisplayIndex: number;
    lastDisplayIndex: number;

    // Computed counts for display
    visibleFiles: number;
    visibleDirs: number;
    visibleBytes: number;
    totalChildren: number; // Including hidden files (used for expand count)
    totalVisibleChildren: number; // Only non-hidden children
}

export interface WorkspaceMountRow extends Omit<WorkspaceEntryRow, 'isDirectory' | 'isExpanded'> {
    isDirectory: true;
    isExpanded: boolean;
}

export interface WorkspaceExplorerProps {
    workspaceId: string;
    workspacePath: string;
    mounts: WorkspaceMount[];
    refreshSignal: number;
    activeFilePath?: string;
    onOpenFile: (...args: Array<{ mountId: string; path: string; name: string; isDirectory: boolean; initialLine?: number }>) => void;
    onRemoveMount: (mountId: string) => void;
    selectedEntries?: WorkspaceEntry[] | null;
    lastSelectedEntry?: WorkspaceEntry | null;
    onSelectedEntriesChange?: (entries: WorkspaceEntry[]) => void;
    onLastSelectedEntryChange?: (entry: WorkspaceEntry | null) => void;
    onEnsureMount?: (mount: WorkspaceMount) => Promise<boolean> | boolean;
    onContextAction?: (action: { type: string; entry: WorkspaceEntry }) => void;
    onSubmitInlineAction?: (action: { type: string; entry: WorkspaceEntry; draftName: string }) => Promise<boolean>;
    onCancelInlineAction?: () => void;
    onSubmitBulkAction?: (type: string, entries: WorkspaceEntry[], draftValue: string) => Promise<boolean>;
    onRequestBulkDelete?: (entries: WorkspaceEntry[]) => void;
    onAddMount?: () => void;
    variant?: 'panel' | 'embedded';
    language?: string;
}

export interface WorkspaceExplorerRow {
    id: string;
    key: string;
    mountId: string;
    name: string;
    path: string;
    icon: string;
    isDirectory: boolean;
    isExpanded: boolean;
    isUnknown: boolean; // Entry hidden by diagnostics/ignore (no row in VirtualizedTable)
    depth: number;      // 0 = top-level mount row
    isTarget?: boolean; // Path shown in breadcrumb

    // Virtualization range: indices in the `displayRows` array (flat list)
    firstDisplayIndex: number;
    lastDisplayIndex: number;

    // Computed counts for display
    visibleFiles: number;
    visibleDirs: number;
    visibleBytes: number;
    totalChildren: number; // Including hidden files (used for expand count)
    totalVisibleChildren: number; // Only non-hidden children
}

export interface ExplorerRowProps {
    row: WorkspaceEntryRow | WorkspaceMountRow;
    workspaceId: string;
    isRenaming: boolean;
    inlineDraftName: string | null;
    lastClickTime: number | null;
    rowRefs: React.RefObject<HTMLDivElement[]>;
    rowElements: HTMLDivElement[];
    expandedRows: Set<string>;
    displayRows: (WorkspaceEntryRow | WorkspaceMountRow)[];
    selectedRows: Set<string>;
    mouseOverRef: React.RefObject<HTMLDivElement>;
    highlightedIndex: number | null;
    onEntryContextMenu: (e: React.MouseEvent, mountId: string, path: string) => void;
    setRowRef: (index: number, ref: HTMLDivElement | null) => void;
    onInlineDraftNameChange: (value: string) => void;
    onInlineSubmit: (value: string) => Promise<void>;
    onInlineCancel: () => void;
}

export interface ExplorerDisplayRow {
    id: string;
    row: WorkspaceEntryRow | WorkspaceMountRow;
    childrenCount: number;
    displayIndex: number;
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
    isLoaded?: boolean;
    type: 'code' | 'image' | 'diff';
    initialLine?: number;
    readOnly?: boolean;
    gitStatus?: string;
    gitRawStatus?: string;
    originalContent?: string;
    diffId?: string;
    diff?: { oldValue: string; newValue: string };
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
    rules?: string;
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
    // AI Configuration
    intelligence?: {
        defaultModelId?: string;    // Default model for this workspace
        discussModelId?: string;    // Model for council discussions
        systemPrompt?: string;      // Workspace-specific system prompt override
        temperature?: number;       // AI temperature setting
    };
    // Source Control
    git?: {
        commitPrefix?: string;      // e.g. "[FEAT]"
        branchPrefix?: string;      // e.g. "feature/"
        autoFetch?: boolean;        // Automatically fetch from remote
    };
    // Advanced Options
    advancedOptions?: {
        fileWatchEnabled?: boolean;     // Enable file change detection
        fileWatchIgnore?: string[];     // Patterns to ignore (e.g. ["node_modules", ".git"])
        indexingEnabled?: boolean;      // Enable code indexing for AI
        indexingInterval?: number;      // Re-index interval in minutes
        indexingMaxFileSize?: number;   // Max file size to index in bytes
        indexingExclude?: string[];     // Specific patterns to exclude from indexing
        maxConcurrency?: number;        // Max parallel indexing tasks
        autoSave?: boolean;             // Auto-save files
        layoutProfile?: {
            sidebarCollapsed?: boolean;
            terminalVisible?: boolean;
            terminalHeight?: number;
            panel?: 'chat' | 'terminal' | 'files' | 'explorer' | 'search' | 'git' | 'settings' | 'none';
        };
    };
    // Editor Settings
    editor?: {
        fontSize?: number;
        fontFamily?: string;
        fontWeight?: string;
        letterSpacing?: number;
        lineHeight?: number;
        minimap?: boolean;
        minimapSide?: 'left' | 'right';
        minimapRenderCharacters?: boolean;
        wordWrap?: 'on' | 'off' | 'wordWrapColumn' | 'bounded';
        lineNumbers?: 'on' | 'off' | 'relative' | 'interval';
        tabSize?: number;
        cursorBlinking?: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid';
        cursorStyle?: 'block' | 'line' | 'underline' | 'line-thin' | 'block-outline' | 'underline-thin';
        cursorWidth?: number;
        fontLigatures?: boolean;
        formatOnPaste?: boolean;
        formatOnType?: boolean;
        smoothScrolling?: boolean;
        folding?: boolean;
        showFoldingControls?: 'always' | 'mouseover';
        codeLens?: boolean;
        inlayHints?: boolean;
        renderWhitespace?: 'none' | 'boundary' | 'selection' | 'trailing' | 'all';
        renderLineHighlight?: 'none' | 'gutter' | 'line' | 'all';
        renderControlCharacters?: boolean;
        roundedSelection?: boolean;
        scrollBeyondLastLine?: boolean;
        cursorSmoothCaretAnimation?: 'on' | 'off' | 'explicit';
        wordBasedSuggestions?: 'off' | 'currentDocument' | 'matchingDocuments' | 'allDocuments';
        acceptSuggestionOnEnter?: 'on' | 'off' | 'smart';
        suggestFontSize?: number;
        suggestLineHeight?: number;
        stickyScroll?: boolean;
        bracketPairColorization?: boolean;
        guidesIndentation?: boolean;
        mouseWheelZoom?: boolean;
        multiCursorModifier?: 'ctrlCmd' | 'alt';
        occurrenceHighlight?: boolean;
        selectionHighlight?: boolean;
        renderFinalNewline?: 'on' | 'off' | 'dimmed';
        additionalOptions?: Record<string, JsonValue>;
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
    topFilesByLoc?: Array<{
        path: string;
        loc: number;
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

export type WorkspaceDiagnosticsSourceStatus = 'ok' | 'failed' | 'skipped';

export interface WorkspaceDiagnosticsSourceResult {
    source: string;
    status: WorkspaceDiagnosticsSourceStatus;
    issueCount?: number;
    message?: string;
}

export interface WorkspaceDiagnosticsStatus {
    partial: boolean;
    generatedAt: number;
    sources: WorkspaceDiagnosticsSourceResult[];
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
    lspDiagnostics?: WorkspaceIssue[];
    lspServers?: WorkspaceLspServerSupport[];
    diagnosticsStatus?: WorkspaceDiagnosticsStatus;
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

