import { WORKSPACE_COMPAT_FILE_VALUES } from '@shared/constants';

import { Workspace } from '@/types';

export type WorkspaceSystemSeverity = 'error' | 'warning' | 'info';
export type WorkspaceSystemSource = 'mount' | 'git' | 'task' | 'analysis' | 'terminal' | 'policy' | 'security' | 'toolchain';

export interface LocalizedText {
    key: string;
    params?: Record<string, string | number>;
}

export interface WorkspaceStartupPreflightIssue {
    id: string;
    source: WorkspaceSystemSource;
    severity: WorkspaceSystemSeverity;
    message: LocalizedText;
    fixAction: LocalizedText;
    blocking: boolean;
}

export interface WorkspaceRunbook {
    id: 'setup' | 'build' | 'test' | 'release';
    label: LocalizedText;
    command: string;
    rollbackHint: LocalizedText;
}

export interface WorkspaceRunbookExecutionResult {
    success: boolean;
    timeline: LocalizedText[];
    output: string;
    rollbackHint: LocalizedText;
}

export interface WorkspaceSecurityPosture {
    risk: 'low' | 'medium' | 'high';
    findings: LocalizedText[];
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
    missingMessage: LocalizedText;
    fixAction: LocalizedText;
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
            missingMessage: { key: 'workspace.issueBanner.preflightIssues.toolchain.nodeMissing.message' },
            fixAction: { key: 'workspace.issueBanner.preflightIssues.toolchain.nodeMissing.fixAction' },
        },
        {
            id: 'npm',
            command: 'npm',
            requiredWhen: async (workspacePath: string) => isToolRequiredForPath(workspacePath, 'package.json'),
            missingMessage: { key: 'workspace.issueBanner.preflightIssues.toolchain.npmMissing.message' },
            fixAction: { key: 'workspace.issueBanner.preflightIssues.toolchain.npmMissing.fixAction' },
        },
        {
            id: 'python',
            command: 'python',
            requiredWhen: hasPythonWorkspaceFiles,
            missingMessage: { key: 'workspace.issueBanner.preflightIssues.toolchain.pythonMissing.message' },
            fixAction: { key: 'workspace.issueBanner.preflightIssues.toolchain.pythonMissing.fixAction' },
        },
        {
            id: 'go',
            command: 'go',
            requiredWhen: async (workspacePath: string) => isToolRequiredForPath(workspacePath, 'go.mod'),
            missingMessage: { key: 'workspace.issueBanner.preflightIssues.toolchain.goMissing.message' },
            fixAction: { key: 'workspace.issueBanner.preflightIssues.toolchain.goMissing.fixAction' },
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
            message: { key: 'workspace.issueBanner.preflightIssues.toolchain.nodeUnpinned.message' },
            fixAction: { key: 'workspace.issueBanner.preflightIssues.toolchain.nodeUnpinned.fixAction' },
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
            message: { key: 'workspace.issueBanner.preflightIssues.toolchain.pythonUnpinned.message' },
            fixAction: { key: 'workspace.issueBanner.preflightIssues.toolchain.pythonUnpinned.fixAction' },
            blocking: false,
        });
    }
    return issues;
}

function toRisk(findings: LocalizedText[]): 'low' | 'medium' | 'high' {
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
            label: { key: 'workspace.issueBanner.runbookLabels.setup' },
            command: setupCommand,
            rollbackHint: { key: 'workspace.issueBanner.runbookRollbackHints.setup' },
        });
    }
    if (workspace.buildConfig?.buildCommand) {
        runbooks.push({
            id: 'build',
            label: { key: 'workspace.issueBanner.runbookLabels.build' },
            command: workspace.buildConfig.buildCommand,
            rollbackHint: { key: 'workspace.issueBanner.runbookRollbackHints.build' }
        });
    }
    if (workspace.buildConfig?.testCommand) {
        runbooks.push({
            id: 'test',
            label: { key: 'workspace.issueBanner.runbookLabels.test' },
            command: workspace.buildConfig.testCommand,
            rollbackHint: { key: 'workspace.issueBanner.runbookRollbackHints.test' }
        });
    }
    if (workspace.devServer?.command) {
        runbooks.push({
            id: 'release',
            label: { key: 'workspace.issueBanner.runbookLabels.release' },
            command: workspace.devServer.command,
            rollbackHint: { key: 'workspace.issueBanner.runbookRollbackHints.release' }
        });
    }
    return runbooks;
}

async function collectSecurityPosture(workspacePath: string): Promise<WorkspaceSecurityPosture> {
    const findings: LocalizedText[] = [];
    const hasEnv = await isToolRequiredForPath(workspacePath, '.env');
    const hasEnvLocal = await isToolRequiredForPath(workspacePath, '.env.local');
    const hasPackageJson = await isToolRequiredForPath(workspacePath, 'package.json');
    const hasLock = await isToolRequiredForPath(workspacePath, 'package-lock.json')
        || await isToolRequiredForPath(workspacePath, 'pnpm-lock.yaml')
        || await isToolRequiredForPath(workspacePath, 'yarn.lock');
    if (hasEnv || hasEnvLocal) {
        findings.push({ key: 'workspace.issueBanner.securityFindings.envFilesDetected' });
    }
    if (hasPackageJson && !hasLock) {
        findings.push({ key: 'workspace.issueBanner.securityFindings.lockFileMissing' });
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
    const fallbackPosture: WorkspaceSecurityPosture = {
        risk: 'medium',
        findings: [{ key: 'workspace.issueBanner.securityFindings.evaluationUnavailable' }],
        remediatedCount: 0
    };
    const includeNonBlockingChecks = options?.includeNonBlockingChecks ?? true;
    if (!workspace.path) {
        issues.push({
            id: 'missing-path',
            source: 'mount',
            severity: 'error',
            message: { key: 'workspace.issueBanner.preflightIssues.mount.missingPath.message' },
            fixAction: { key: 'workspace.issueBanner.preflightIssues.mount.missingPath.fixAction' },
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
            message: {
                key: 'workspace.issueBanner.preflightIssues.mount.pathNotFound.message',
                params: { path: workspace.path }
            },
            fixAction: { key: 'workspace.issueBanner.preflightIssues.mount.pathNotFound.fixAction' },
            blocking: true,
        });
    }
    if (workspace.mounts.length > 1 && workspace.mounts.some(mount => mount.name.trim() === '')) {
        issues.push({
            id: 'multi-root-label-missing',
            source: 'mount',
            severity: 'warning',
            message: { key: 'workspace.issueBanner.preflightIssues.mount.multiRootLabelMissing.message' },
            fixAction: { key: 'workspace.issueBanner.preflightIssues.mount.multiRootLabelMissing.fixAction' },
            blocking: false,
        });
    }

    const terminalHealth = await window.electron.terminal.getRuntimeHealth();
    if (!terminalHealth.terminalAvailable) {
        issues.push({
            id: 'terminal-unavailable',
            source: 'terminal',
            severity: 'error',
            message: { key: 'workspace.issueBanner.preflightIssues.terminal.unavailable.message' },
            fixAction: { key: 'workspace.issueBanner.preflightIssues.terminal.unavailable.fixAction' },
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
                message: { key: 'workspace.issueBanner.preflightIssues.analysis.indexingDisabled.message' },
                fixAction: { key: 'workspace.issueBanner.preflightIssues.analysis.indexingDisabled.fixAction' },
                blocking: false,
            });
        }
        const gitRepository = await window.electron.git.isRepository(workspace.path);
        if (!gitRepository.success || !gitRepository.isRepository) {
            issues.push({
                id: 'git-repo-missing',
                source: 'git',
                severity: 'warning',
                message: { key: 'workspace.issueBanner.preflightIssues.git.repositoryMissing.message' },
                fixAction: { key: 'workspace.issueBanner.preflightIssues.git.repositoryMissing.fixAction' },
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
                    message: {
                        key: 'workspace.issueBanner.preflightIssues.policy.mainDirty.message',
                        params: { branch: branchInfo.branch }
                    },
                    fixAction: { key: 'workspace.issueBanner.preflightIssues.policy.mainDirty.fixAction' },
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
    const timeline: LocalizedText[] = [{
        key: 'workspace.issueBanner.runbookTimelineMessages.queued'
    }];
    const { command, args } = splitCommand(runbook.command);
    if (!workspace.path || !command) {
        return {
            success: false,
            timeline: [
                ...timeline,
                { key: 'workspace.issueBanner.runbookTimelineMessages.failedBeforeExecution' },
                { key: 'workspace.issueBanner.runbookTimelineMessages.invalidPathOrCommand' }
            ],
            output: '',
            rollbackHint: runbook.rollbackHint,
        };
    }
    return workspaceOperationsOrchestrator.enqueue(async () => {
        timeline.push({
            key: 'workspace.issueBanner.runbookTimelineMessages.startedCommand',
            params: { command: runbook.command }
        });
        const result = await window.electron.runCommand(command, args, workspace.path);
        const success = result.code === 0;
        timeline.push(success
            ? { key: 'workspace.issueBanner.runbookTimelineMessages.completedSuccessfully' }
            : {
                key: 'workspace.issueBanner.runbookTimelineMessages.failedWithCode',
                params: { code: result.code }
            }
        );
        return {
            success,
            timeline,
            output: `${result.stdout}\n${result.stderr}`.trim(),
            rollbackHint: runbook.rollbackHint,
        };
    });
}
