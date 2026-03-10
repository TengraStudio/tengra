import { WORKSPACE_COMPAT_FILE_VALUES } from '@shared/constants';

import { Workspace } from '@/types';

export type WorkspaceSystemSeverity = 'error' | 'warning' | 'info';
export type WorkspaceSystemSource = 'mount' | 'git' | 'task' | 'analysis' | 'terminal' | 'policy' | 'security' | 'toolchain';

export interface WorkspaceStartupPreflightIssue {
    id: string;
    source: WorkspaceSystemSource;
    severity: WorkspaceSystemSeverity;
    message: string;
    fixAction: string;
    blocking: boolean;
}

export interface WorkspaceRunbook {
    id: 'setup' | 'build' | 'test' | 'release';
    label: string;
    command: string;
    rollbackHint: string;
}

export interface WorkspaceRunbookExecutionResult {
    success: boolean;
    timeline: string[];
    output: string;
    rollbackHint: string;
}

export interface WorkspaceSecurityPosture {
    risk: 'low' | 'medium' | 'high';
    findings: string[];
    remediatedCount: number;
}

export interface WorkspaceStartupPreflightResult {
    canOpen: boolean;
    issues: WorkspaceStartupPreflightIssue[];
    openingMode: 'fast' | 'full';
    runbooks: WorkspaceRunbook[];
    maxConcurrentOperations: number;
    securityPosture: WorkspaceSecurityPosture;
}

interface WorkspaceStartupPreflightOptions {
    includeNonBlockingChecks?: boolean;
}

interface ToolCheckDefinition {
    id: string;
    command: string;
    requiredWhen: (workspacePath: string) => Promise<boolean>;
    missingMessage: string;
    fixAction: string;
}

const PYTHON_WORKSPACE_FILES = [
    WORKSPACE_COMPAT_FILE_VALUES.REQUIREMENTS_TXT,
    WORKSPACE_COMPAT_FILE_VALUES.PY_SINGULAR_TOML
] as const;

class WorkspaceOperationsOrchestrator {
    private running = 0;
    private readonly queue: Array<() => void> = [];

    constructor(private readonly maxConcurrent: number) { }

    async enqueue<T>(operation: () => Promise<T>): Promise<T> {
        if (this.running < this.maxConcurrent) {
            this.running += 1;
            try {
                return await operation();
            } finally {
                this.running -= 1;
                this.runNext();
            }
        }

        return await new Promise<T>((resolve, reject) => {
            this.queue.push(() => {
                void this.enqueue(operation).then(resolve).catch(reject);
            });
        });
    }

    private runNext(): void {
        const next = this.queue.shift();
        if (next) {
            next();
        }
    }
}

const workspaceOperationsOrchestrator = new WorkspaceOperationsOrchestrator(2);

async function canRunTool(command: string, cwd: string): Promise<boolean> {
    try {
        const result = await window.electron.runCommand(command, ['--version'], cwd);
        return result.code === 0;
    } catch {
        return false;
    }
}

async function isToolRequiredForPath(workspacePath: string, fileName: string): Promise<boolean> {
    const result = await window.electron.files.exists(`${workspacePath}\\${fileName}`);
    return result.success && result.data;
}

async function hasPythonWorkspaceFiles(workspacePath: string): Promise<boolean> {
    const requiredFiles = await Promise.all(
        PYTHON_WORKSPACE_FILES.map(fileName => isToolRequiredForPath(workspacePath, fileName))
    );
    return requiredFiles.some(Boolean);
}

function getToolDefinitions(): ToolCheckDefinition[] {
    return [
        {
            id: 'node',
            command: 'node',
            requiredWhen: async (workspacePath: string) => isToolRequiredForPath(workspacePath, 'package.json'),
            missingMessage: 'Node.js is required for this workspace.',
            fixAction: 'Install Node.js and ensure "node --version" works in your terminal.',
        },
        {
            id: 'npm',
            command: 'npm',
            requiredWhen: async (workspacePath: string) => isToolRequiredForPath(workspacePath, 'package.json'),
            missingMessage: 'npm is required for this workspace.',
            fixAction: 'Install npm (usually with Node.js) and ensure "npm --version" works.',
        },
        {
            id: 'python',
            command: 'python',
            requiredWhen: hasPythonWorkspaceFiles,
            missingMessage: 'Python is required for this workspace.',
            fixAction: 'Install Python and ensure "python --version" works in your terminal.',
        },
        {
            id: 'go',
            command: 'go',
            requiredWhen: async (workspacePath: string) => isToolRequiredForPath(workspacePath, 'go.mod'),
            missingMessage: 'Go is required for this workspace.',
            fixAction: 'Install Go and ensure "go version" works in your terminal.',
        },
    ];
}

async function checkRequiredTools(workspacePath: string): Promise<WorkspaceStartupPreflightIssue[]> {
    const definitions = getToolDefinitions();
    const issues: WorkspaceStartupPreflightIssue[] = [];
    const hasNvm = await isToolRequiredForPath(workspacePath, '.nvmrc');
    const hasPythonVersion = await isToolRequiredForPath(workspacePath, '.python-version');
    const hasToolVersions = await isToolRequiredForPath(workspacePath, '.tool-versions');
    for (const definition of definitions) {
        const required = await definition.requiredWhen(workspacePath);
        if (!required) {
            continue;
        }
        const installed = await canRunTool(definition.command, workspacePath);
        if (!installed) {
            issues.push({
                id: `tool-${definition.id}`,
                source: 'toolchain',
                severity: 'error',
                message: definition.missingMessage,
                fixAction: definition.fixAction,
                blocking: false,
            });
        }
    }
    if (await isToolRequiredForPath(workspacePath, 'package.json') && !hasNvm && !hasToolVersions) {
        issues.push({
            id: 'toolchain-node-unpinned',
            source: 'toolchain',
            severity: 'warning',
            message: 'Node runtime is not pinned for this workspace.',
            fixAction: 'Add .nvmrc or .tool-versions to lock the Node version per workspace.',
            blocking: false,
        });
    }
    if (
        await hasPythonWorkspaceFiles(workspacePath)
        && !hasPythonVersion
        && !hasToolVersions
    ) {
        issues.push({
            id: 'toolchain-python-unpinned',
            source: 'toolchain',
            severity: 'warning',
            message: 'Python runtime is not pinned for this workspace.',
            fixAction: 'Add .python-version or .tool-versions to avoid environment drift.',
            blocking: false,
        });
    }
    return issues;
}

function toRisk(findings: string[]): 'low' | 'medium' | 'high' {
    if (findings.length >= 3) {
        return 'high';
    }
    if (findings.length >= 1) {
        return 'medium';
    }
    return 'low';
}

async function deriveOpeningMode(workspacePath: string): Promise<'fast' | 'full'> {
    try {
        const analysis = await window.electron.workspace.analyzeDirectory(workspacePath);
        return analysis.stats.fileCount > 3000 ? 'fast' : 'full';
    } catch {
        return 'fast';
    }
}

async function buildRunbooks(workspacePath: string, workspace: Workspace): Promise<WorkspaceRunbook[]> {
    const runbooks: WorkspaceRunbook[] = [];
    const hasPackageJson = await isToolRequiredForPath(workspacePath, 'package.json');
    const setupCommand = hasPackageJson ? 'npm install' : '';
    if (setupCommand) {
        runbooks.push({
            id: 'setup',
            label: 'Setup',
            command: setupCommand,
            rollbackHint: 'Delete generated dependencies and lock updates if setup introduced regressions.',
        });
    }
    if (workspace.buildConfig?.buildCommand) {
        runbooks.push({ id: 'build', label: 'Build', command: workspace.buildConfig.buildCommand, rollbackHint: 'Revert build config or generated artifacts to the last known good commit.' });
    }
    if (workspace.buildConfig?.testCommand) {
        runbooks.push({ id: 'test', label: 'Test', command: workspace.buildConfig.testCommand, rollbackHint: 'Rollback recent source/config changes that introduced failing tests.' });
    }
    if (workspace.devServer?.command) {
        runbooks.push({ id: 'release', label: 'Release Prep', command: workspace.devServer.command, rollbackHint: 'Stop release workflow, restore previous deployment config, and rerun validation checks.' });
    }
    return runbooks;
}

async function collectSecurityPosture(workspacePath: string): Promise<WorkspaceSecurityPosture> {
    const findings: string[] = [];
    const hasEnv = await isToolRequiredForPath(workspacePath, '.env');
    const hasEnvLocal = await isToolRequiredForPath(workspacePath, '.env.local');
    const hasPackageJson = await isToolRequiredForPath(workspacePath, 'package.json');
    const hasLock = await isToolRequiredForPath(workspacePath, 'package-lock.json')
        || await isToolRequiredForPath(workspacePath, 'pnpm-lock.yaml')
        || await isToolRequiredForPath(workspacePath, 'yarn.lock');
    if (hasEnv || hasEnvLocal) {
        findings.push('Environment files detected. Ensure sensitive keys are excluded from VCS.');
    }
    if (hasPackageJson && !hasLock) {
        findings.push('Dependency lock file is missing; dependency supply chain risk is higher.');
    }
    return {
        risk: toRisk(findings),
        findings,
        remediatedCount: 0,
    };
}

export async function runWorkspaceStartupPreflight(
    workspace: Workspace,
    options?: WorkspaceStartupPreflightOptions
): Promise<WorkspaceStartupPreflightResult> {
    const issues: WorkspaceStartupPreflightIssue[] = [];
    const fallbackPosture: WorkspaceSecurityPosture = { risk: 'medium', findings: ['Security posture could not be fully evaluated.'], remediatedCount: 0 };
    const includeNonBlockingChecks = options?.includeNonBlockingChecks ?? true;
    if (!workspace.path) {
        issues.push({
            id: 'missing-path',
            source: 'mount',
            severity: 'error',
            message: 'Workspace path is missing.',
            fixAction: 'Update workspace settings and set a valid root path before opening.',
            blocking: true,
        });
        return {
            canOpen: false,
            issues,
            openingMode: 'fast',
            runbooks: [],
            maxConcurrentOperations: 1,
            securityPosture: fallbackPosture,
        };
    }

    const pathExistsResult = await window.electron.files.exists(workspace.path);
    const pathExists = pathExistsResult.success && pathExistsResult.data;
    if (!pathExists) {
        issues.push({
            id: 'path-not-found',
            source: 'mount',
            severity: 'error',
            message: `Workspace path does not exist: ${workspace.path}`,
            fixAction: 'Reconnect the drive or update the workspace path in workspace settings.',
            blocking: true,
        });
    }
    if (workspace.mounts.length > 1 && workspace.mounts.some(mount => mount.name.trim() === '')) {
        issues.push({
            id: 'multi-root-label-missing',
            source: 'mount',
            severity: 'warning',
            message: 'One or more mounts are missing labels.',
            fixAction: 'Set a distinct name for each mount to keep multi-root explorer labels clear.',
            blocking: false,
        });
    }

    const terminalHealth = await window.electron.terminal.getRuntimeHealth();
    if (!terminalHealth.terminalAvailable) {
        issues.push({
            id: 'terminal-unavailable',
            source: 'terminal',
            severity: 'error',
            message: 'No terminal backend is available.',
            fixAction: 'Install or enable a terminal backend (PowerShell, cmd, or other supported shell).',
            blocking: true,
        });
    }

    let openingMode: 'fast' | 'full' = 'fast';
    let runbooks: WorkspaceRunbook[] = [];
    let securityPosture = fallbackPosture;
    if (pathExists && includeNonBlockingChecks) {
        openingMode = await deriveOpeningMode(workspace.path);
        runbooks = await buildRunbooks(workspace.path, workspace);
        securityPosture = await collectSecurityPosture(workspace.path);
        if (workspace.advancedOptions?.indexingEnabled === false) {
            issues.push({
                id: 'indexing-disabled',
                source: 'analysis',
                severity: 'warning',
                message: 'Background indexing is disabled.',
                fixAction: 'Enable indexing in workspace settings for workspace intelligence and navigation.',
                blocking: false,
            });
        }
        const gitRepository = await window.electron.git.isRepository(workspace.path);
        if (!gitRepository.success || !gitRepository.isRepository) {
            issues.push({
                id: 'git-repo-missing',
                source: 'git',
                severity: 'warning',
                message: 'This folder is not a Git repository.',
                fixAction: 'Run "git init" or clone the repository before opening workspace workflows.',
                blocking: false,
            });
        } else {
            const branchInfo = await window.electron.git.getBranch(workspace.path);
            const status = await window.electron.git.getStatus(workspace.path);
            if ((branchInfo.branch === 'main' || branchInfo.branch === 'master') && status.changes && status.changes > 0) {
                issues.push({
                    id: 'policy-main-dirty',
                    source: 'policy',
                    severity: 'warning',
                    message: `Policy warning: working tree is dirty on protected branch ${branchInfo.branch}.`,
                    fixAction: 'Commit to a feature branch, then merge through review.',
                    blocking: false,
                });
            }
        }
        issues.push(...(await checkRequiredTools(workspace.path)));
    }

    return {
        canOpen: issues.every(issue => !issue.blocking),
        issues,
        openingMode,
        runbooks,
        maxConcurrentOperations: terminalHealth.availableBackends > 1 ? 2 : 1,
        securityPosture,
    };
}

function splitCommand(commandLine: string): { command: string; args: string[] } {
    const parts = commandLine.trim().split(/\s+/);
    return {
        command: parts[0] ?? '',
        args: parts.slice(1),
    };
}

export async function executeWorkspaceRunbook(
    workspace: Workspace,
    runbook: WorkspaceRunbook
): Promise<WorkspaceRunbookExecutionResult> {
    const timeline = [`Queued ${runbook.label} runbook`];
    const { command, args } = splitCommand(runbook.command);
    if (!workspace.path || !command) {
        return {
            success: false,
            timeline: [...timeline, 'Failed before execution'],
            output: 'Invalid workspace path or runbook command.',
            rollbackHint: runbook.rollbackHint,
        };
    }
    return workspaceOperationsOrchestrator.enqueue(async () => {
        timeline.push(`Started command: ${runbook.command}`);
        const result = await window.electron.runCommand(command, args, workspace.path);
        const success = result.code === 0;
        timeline.push(success ? 'Completed successfully' : `Failed with code ${result.code}`);
        return {
            success,
            timeline,
            output: `${result.stdout}\n${result.stderr}`.trim(),
            rollbackHint: runbook.rollbackHint,
        };
    });
}
