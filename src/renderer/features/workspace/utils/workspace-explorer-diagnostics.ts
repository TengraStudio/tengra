import type { WorkspaceAgentSessionSummary } from '@shared/types/workspace-agent-session';

import type { WorkspaceAnalysis, WorkspaceMount } from '@/types';

export interface WorkspaceExplorerDiagnosticCounts {
    typescript: number;
    lint: number;
    test: number;
    agent: number;
    total: number;
}

export interface WorkspaceExplorerDiagnosticsSnapshot {
    mountSummary: Record<string, WorkspaceExplorerDiagnosticCounts>;
    byPath: Record<string, WorkspaceExplorerDiagnosticCounts>;
}

type DiagnosticCategory = keyof Omit<WorkspaceExplorerDiagnosticCounts, 'total'>;

const TEST_FILE_PATTERN = /(^|\/)(tests?|__tests__)\//i;
const TEST_FILE_NAME_PATTERN = /\.(test|spec)\.[^./]+$/i;
const TYPESCRIPT_FILE_PATTERN = /\.(cts|mts|ts|tsx)$/i;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[a-z]:[\\/]/i;

function createEmptyCounts(): WorkspaceExplorerDiagnosticCounts {
    return {
        typescript: 0,
        lint: 0,
        test: 0,
        agent: 0,
        total: 0,
    };
}

export function normalizeWorkspaceExplorerDiagnosticPath(value: string): string {
    return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

function trimLeadingSeparators(value: string): string {
    return value.replace(/^[\\/]+/, '');
}

function isAbsoluteLikePath(value: string): boolean {
    return value.startsWith('/') || WINDOWS_ABSOLUTE_PATH_PATTERN.test(value);
}

function resolveIssuePath(rootPath: string, issuePath: string): string {
    if (isAbsoluteLikePath(issuePath)) {
        return normalizeWorkspaceExplorerDiagnosticPath(issuePath);
    }

    const normalizedRoot = normalizeWorkspaceExplorerDiagnosticPath(rootPath);
    const relativePath = trimLeadingSeparators(issuePath);
    return relativePath.length > 0
        ? `${normalizedRoot}/${relativePath}`
        : normalizedRoot;
}

function isTestFilePath(filePath: string): boolean {
    const normalizedPath = normalizeWorkspaceExplorerDiagnosticPath(filePath);
    return TEST_FILE_PATTERN.test(normalizedPath) || TEST_FILE_NAME_PATTERN.test(normalizedPath);
}

function isTypeScriptFilePath(filePath: string): boolean {
    return TYPESCRIPT_FILE_PATTERN.test(filePath);
}

function toDiagnosticCategory(filePath: string): DiagnosticCategory {
    if (isTestFilePath(filePath)) {
        return 'test';
    }
    if (isTypeScriptFilePath(filePath)) {
        return 'typescript';
    }
    return 'lint';
}

function withIncrementedCount(
    current: WorkspaceExplorerDiagnosticCounts | undefined,
    category: DiagnosticCategory,
    amount = 1
): WorkspaceExplorerDiagnosticCounts {
    const base = current ?? createEmptyCounts();
    return {
        ...base,
        [category]: base[category] + amount,
        total: base.total + amount,
    };
}

function accumulatePathDiagnostics(
    target: Record<string, WorkspaceExplorerDiagnosticCounts>,
    mountRootPath: string,
    filePath: string,
    category: DiagnosticCategory
): void {
    const normalizedRoot = normalizeWorkspaceExplorerDiagnosticPath(mountRootPath);
    const normalizedFilePath = normalizeWorkspaceExplorerDiagnosticPath(filePath);
    const relativePath = trimLeadingSeparators(
        normalizedFilePath.slice(normalizedRoot.length)
    );
    const segments = relativePath.split('/').filter(Boolean);

    if (segments.length === 0) {
        return;
    }

    let currentPath = normalizedRoot;
    for (const segment of segments) {
        currentPath = `${currentPath}/${segment}`;
        target[currentPath] = withIncrementedCount(target[currentPath], category);
    }
}

function isAgentIssueSession(session: WorkspaceAgentSessionSummary): boolean {
    return (
        session.status === 'failed' ||
        session.permissionPolicy.commandPolicy === 'full-access' ||
        session.permissionPolicy.pathPolicy === 'restricted-off-dangerous'
    );
}

function resolveWorkspaceRootMount(
    mounts: WorkspaceMount[],
    workspaceRootPath: string
): WorkspaceMount | null {
    const normalizedRootPath = normalizeWorkspaceExplorerDiagnosticPath(workspaceRootPath);
    const exactMatch = mounts.find(
        mount =>
            mount.type === 'local' &&
            normalizeWorkspaceExplorerDiagnosticPath(mount.rootPath) === normalizedRootPath
    );
    if (exactMatch) {
        return exactMatch;
    }

    return mounts.find(mount => mount.type === 'local') ?? null;
}

export function buildWorkspaceExplorerDiagnosticsSnapshot(args: {
    analysis: WorkspaceAnalysis | null;
    mounts: WorkspaceMount[];
    sessions: WorkspaceAgentSessionSummary[];
    workspaceRootPath: string;
}): WorkspaceExplorerDiagnosticsSnapshot {
    const snapshot: WorkspaceExplorerDiagnosticsSnapshot = {
        mountSummary: {},
        byPath: {},
    };
    const rootMount = resolveWorkspaceRootMount(args.mounts, args.workspaceRootPath);
    if (!rootMount) {
        return snapshot;
    }

    const diagnostics = [
        ...(args.analysis?.issues ?? []),
        ...(args.analysis?.lspDiagnostics ?? []),
    ];

    for (const issue of diagnostics) {
        const absolutePath = resolveIssuePath(rootMount.rootPath, issue.file);
        const category = toDiagnosticCategory(absolutePath);
        snapshot.mountSummary[rootMount.id] = withIncrementedCount(
            snapshot.mountSummary[rootMount.id],
            category
        );
        accumulatePathDiagnostics(snapshot.byPath, rootMount.rootPath, absolutePath, category);
    }

    const agentIssueCount = args.sessions.filter(isAgentIssueSession).length;
    if (agentIssueCount > 0) {
        snapshot.mountSummary[rootMount.id] = withIncrementedCount(
            snapshot.mountSummary[rootMount.id],
            'agent',
            agentIssueCount
        );
    }

    return snapshot;
}
