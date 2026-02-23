import { Project } from '@/types';

export type ProjectSystemSeverity = 'error' | 'warning' | 'info';
export type ProjectSystemSource = 'mount' | 'git' | 'task' | 'analysis' | 'terminal' | 'policy' | 'security' | 'toolchain';

export interface ProjectStartupPreflightIssue {
    id: string;
    source: ProjectSystemSource;
    severity: ProjectSystemSeverity;
    message: string;
    fixAction: string;
    blocking: boolean;
}

export interface ProjectRunbook {
    id: 'setup' | 'build' | 'test' | 'release';
    label: string;
    command: string;
    rollbackHint: string;
}

export interface ProjectRunbookExecutionResult {
    success: boolean;
    timeline: string[];
    output: string;
    rollbackHint: string;
}

export interface ProjectSecurityPosture {
    risk: 'low' | 'medium' | 'high';
    findings: string[];
    remediatedCount: number;
}

export interface ProjectStartupPreflightResult {
    canOpen: boolean;
    issues: ProjectStartupPreflightIssue[];
    openingMode: 'fast' | 'full';
    runbooks: ProjectRunbook[];
    maxConcurrentOperations: number;
    securityPosture: ProjectSecurityPosture;
}

interface ToolCheckDefinition {
    id: string;
    command: string;
    requiredWhen: (projectPath: string) => Promise<boolean>;
    missingMessage: string;
    fixAction: string;
}

class ProjectOperationsOrchestrator {
    private running = 0;
    private readonly queue: Array<() => void> = [];

    constructor(private readonly maxConcurrent: number) {}

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

const projectOperationsOrchestrator = new ProjectOperationsOrchestrator(2);

async function canRunTool(command: string, cwd: string): Promise<boolean> {
    try {
        const result = await window.electron.runCommand(command, ['--version'], cwd);
        return result.code === 0;
    } catch {
        return false;
    }
}

async function isToolRequiredForPath(projectPath: string, fileName: string): Promise<boolean> {
    return window.electron.files.exists(`${projectPath}\\${fileName}`);
}

function getToolDefinitions(): ToolCheckDefinition[] {
    return [
        {
            id: 'node',
            command: 'node',
            requiredWhen: async (projectPath: string) => isToolRequiredForPath(projectPath, 'package.json'),
            missingMessage: 'Node.js is required for this project.',
            fixAction: 'Install Node.js and ensure "node --version" works in your terminal.',
        },
        {
            id: 'npm',
            command: 'npm',
            requiredWhen: async (projectPath: string) => isToolRequiredForPath(projectPath, 'package.json'),
            missingMessage: 'npm is required for this project.',
            fixAction: 'Install npm (usually with Node.js) and ensure "npm --version" works.',
        },
        {
            id: 'python',
            command: 'python',
            requiredWhen: async (projectPath: string) =>
                (await isToolRequiredForPath(projectPath, 'requirements.txt'))
                || (await isToolRequiredForPath(projectPath, 'pyproject.toml')),
            missingMessage: 'Python is required for this project.',
            fixAction: 'Install Python and ensure "python --version" works in your terminal.',
        },
        {
            id: 'go',
            command: 'go',
            requiredWhen: async (projectPath: string) => isToolRequiredForPath(projectPath, 'go.mod'),
            missingMessage: 'Go is required for this project.',
            fixAction: 'Install Go and ensure "go version" works in your terminal.',
        },
    ];
}

async function checkRequiredTools(projectPath: string): Promise<ProjectStartupPreflightIssue[]> {
    const definitions = getToolDefinitions();
    const issues: ProjectStartupPreflightIssue[] = [];
    const hasNvm = await isToolRequiredForPath(projectPath, '.nvmrc');
    const hasPythonVersion = await isToolRequiredForPath(projectPath, '.python-version');
    const hasToolVersions = await isToolRequiredForPath(projectPath, '.tool-versions');
    for (const definition of definitions) {
        const required = await definition.requiredWhen(projectPath);
        if (!required) {
            continue;
        }
        const installed = await canRunTool(definition.command, projectPath);
        if (!installed) {
            issues.push({
                id: `tool-${definition.id}`,
                source: 'toolchain',
                severity: 'error',
                message: definition.missingMessage,
                fixAction: definition.fixAction,
                blocking: true,
            });
        }
    }
    if (await isToolRequiredForPath(projectPath, 'package.json') && !hasNvm && !hasToolVersions) {
        issues.push({
            id: 'toolchain-node-unpinned',
            source: 'toolchain',
            severity: 'warning',
            message: 'Node runtime is not pinned for this project.',
            fixAction: 'Add .nvmrc or .tool-versions to lock Node version per project.',
            blocking: false,
        });
    }
    if (
        ((await isToolRequiredForPath(projectPath, 'requirements.txt')) || (await isToolRequiredForPath(projectPath, 'pyproject.toml')))
        && !hasPythonVersion
        && !hasToolVersions
    ) {
        issues.push({
            id: 'toolchain-python-unpinned',
            source: 'toolchain',
            severity: 'warning',
            message: 'Python runtime is not pinned for this project.',
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

async function deriveOpeningMode(projectPath: string): Promise<'fast' | 'full'> {
    try {
        const analysis = await window.electron.project.analyzeDirectory(projectPath);
        return analysis.stats.fileCount > 3000 ? 'fast' : 'full';
    } catch {
        return 'fast';
    }
}

async function buildRunbooks(projectPath: string, project: Project): Promise<ProjectRunbook[]> {
    const runbooks: ProjectRunbook[] = [];
    const hasPackageJson = await isToolRequiredForPath(projectPath, 'package.json');
    const setupCommand = hasPackageJson ? 'npm install' : '';
    if (setupCommand) {
        runbooks.push({
            id: 'setup',
            label: 'Setup',
            command: setupCommand,
            rollbackHint: 'Delete generated dependencies and lock updates if setup introduced regressions.',
        });
    }
    if (project.buildConfig?.buildCommand) {
        runbooks.push({ id: 'build', label: 'Build', command: project.buildConfig.buildCommand, rollbackHint: 'Revert build config or generated artifacts to the last known good commit.' });
    }
    if (project.buildConfig?.testCommand) {
        runbooks.push({ id: 'test', label: 'Test', command: project.buildConfig.testCommand, rollbackHint: 'Rollback recent source/config changes that introduced failing tests.' });
    }
    if (project.devServer?.command) {
        runbooks.push({ id: 'release', label: 'Release Prep', command: project.devServer.command, rollbackHint: 'Stop release workflow, restore previous deployment config, and rerun validation checks.' });
    }
    return runbooks;
}

async function collectSecurityPosture(projectPath: string): Promise<ProjectSecurityPosture> {
    const findings: string[] = [];
    const hasEnv = await isToolRequiredForPath(projectPath, '.env');
    const hasEnvLocal = await isToolRequiredForPath(projectPath, '.env.local');
    const hasPackageJson = await isToolRequiredForPath(projectPath, 'package.json');
    const hasLock = await isToolRequiredForPath(projectPath, 'package-lock.json')
        || await isToolRequiredForPath(projectPath, 'pnpm-lock.yaml')
        || await isToolRequiredForPath(projectPath, 'yarn.lock');
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

export async function runProjectStartupPreflight(project: Project): Promise<ProjectStartupPreflightResult> {
    const issues: ProjectStartupPreflightIssue[] = [];
    const fallbackPosture: ProjectSecurityPosture = { risk: 'medium', findings: ['Security posture could not be fully evaluated.'], remediatedCount: 0 };
    if (!project.path) {
        issues.push({
            id: 'missing-path',
            source: 'mount',
            severity: 'error',
            message: 'Project path is missing.',
            fixAction: 'Update project settings and set a valid root path before opening.',
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

    const pathExists = await window.electron.files.exists(project.path);
    if (!pathExists) {
        issues.push({
            id: 'path-not-found',
            source: 'mount',
            severity: 'error',
            message: `Project path does not exist: ${project.path}`,
            fixAction: 'Reconnect the drive or update the project path in project settings.',
            blocking: true,
        });
    }
    if (project.mounts.length > 1 && project.mounts.some(mount => mount.name.trim() === '')) {
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
    let runbooks: ProjectRunbook[] = [];
    let securityPosture = fallbackPosture;
    if (pathExists) {
        openingMode = await deriveOpeningMode(project.path);
        runbooks = await buildRunbooks(project.path, project);
        securityPosture = await collectSecurityPosture(project.path);
        if (project.advancedOptions?.indexingEnabled === false) {
            issues.push({
                id: 'indexing-disabled',
                source: 'analysis',
                severity: 'warning',
                message: 'Background indexing is disabled.',
                fixAction: 'Enable indexing in project settings for workspace intelligence and navigation.',
                blocking: false,
            });
        }
        const gitRepository = await window.electron.git.isRepository(project.path);
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
            const branchInfo = await window.electron.git.getBranch(project.path);
            const status = await window.electron.git.getStatus(project.path);
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
        issues.push(...(await checkRequiredTools(project.path)));
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

export async function executeProjectRunbook(
    project: Project,
    runbook: ProjectRunbook
): Promise<ProjectRunbookExecutionResult> {
    const timeline = [`Queued ${runbook.label} runbook`];
    const { command, args } = splitCommand(runbook.command);
    if (!project.path || !command) {
        return {
            success: false,
            timeline: [...timeline, 'Failed before execution'],
            output: 'Invalid project path or runbook command.',
            rollbackHint: runbook.rollbackHint,
        };
    }
    return projectOperationsOrchestrator.enqueue(async () => {
        timeline.push(`Started command: ${runbook.command}`);
        const result = await window.electron.runCommand(command, args, project.path);
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
