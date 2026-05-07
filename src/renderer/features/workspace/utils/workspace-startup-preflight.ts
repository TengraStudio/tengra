/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { WORKSPACE_COMPAT_FILE_VALUES } from '@shared/constants';

import { Workspace } from '@/types';

export type WorkspaceSystemSeverity = 'error' | 'warning' | 'info';
export type WorkspaceSystemSource = 'mount' | 'git' | 'task' | 'analysis' | 'terminal' | 'policy' | 'security' | 'toolchain';

export interface LocalizedText {
    key: string;
    params?: Record<string, string | number>;
    fallback?: string;
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

interface WorkspaceDirectorySnapshot {
    fileCount: number;
    openingMode: 'fast' | 'full';
}

interface WorkspaceTrackedFileSignals {
    hasPackageJson: boolean;
    hasLockFile: boolean;
    hasEnvFiles: boolean;
    hasConfiguredEnvFile: boolean;
    envFiles: string[];
    gitIgnoreContent: string | null;
}

const PYTHON_WORKSPACE_FILES = [
    WORKSPACE_COMPAT_FILE_VALUES.REQUIREMENTS_TXT,
    WORKSPACE_COMPAT_FILE_VALUES.PY_SINGULAR_TOML
] as const;
const WATCH_LIMIT_FILE_THRESHOLD = 20_000;
const SECRET_SCAN_FILE_LIMIT = 6;
const COMMAND_SNIPPET_LIMIT = 120;
const SECRET_PATTERNS = [
    /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[A-Za-z0-9/_+=.-]{8,}/i,
    /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bxox(?:b|a|p|r|s)-[A-Za-z0-9-]{10,}\b/,
] as const;
const DANGEROUS_COMMAND_PATTERNS = [
    {
        id: 'destructive-delete',
        regex: /\brm\s+-rf\b|\bdel\s+\/[a-z]*\b|\brmdir\s+\/s\b/i,
        fixAction: 'Review destructive delete commands before running workspace automation.',
    },
    {
        id: 'pipe-to-shell',
        regex: /\b(?:curl|wget)\b[^|]*\|\s*(?:bash|sh|zsh|pwsh|powershell)\b/i,
        fixAction: 'Download and inspect remote scripts before execution.',
    },
    {
        id: 'dangerous-permissions',
        regex: /\bchmod\s+777\b/i,
        fixAction: 'Avoid world-writable permissions in workspace automation.',
    },
    {
        id: 'encoded-shell',
        regex: /\bpowershell(?:\.exe)?\s+-enc(?:odedcommand)?\b/i,
        fixAction: 'Prefer plain-text reviewed scripts instead of encoded shell payloads.',
    },
] as const;

function normalizeWorkspacePath(value: string): string {
    return value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '').toLowerCase();
}

function getWorkspacePathSeparator(workspacePath: string): '/' | '\\' {
    return workspacePath.includes('\\') ? '\\' : '/';
}

function joinWorkspacePath(workspacePath: string, relativePath: string): string {
    const separator = getWorkspacePathSeparator(workspacePath);
    const trimmedRoot = workspacePath.replace(/[\\/]+$/, '');
    const normalizedRelativePath = relativePath
        .replace(/^[\\/]+/, '')
        .replace(/[\\/]+/g, separator);
    return `${trimmedRoot}${separator}${normalizedRelativePath}`;
}

function isAbsoluteWorkspacePath(targetPath: string): boolean {
    return /^[a-z]:[\\/]/i.test(targetPath) || targetPath.startsWith('/') || targetPath.startsWith('\\\\');
}

function resolveWorkspaceConfigPath(workspacePath: string, targetPath: string): string {
    const normalizedTargetPath = targetPath.replace(/[\\/]+/g, getWorkspacePathSeparator(workspacePath));
    if (isAbsoluteWorkspacePath(normalizedTargetPath)) {
        return normalizedTargetPath;
    }
    return joinWorkspacePath(workspacePath, normalizedTargetPath);
}

function isWorkspaceSubpath(workspacePath: string, candidatePath: string): boolean {
    const normalizedWorkspacePath = normalizeWorkspacePath(workspacePath);
    const normalizedCandidatePath = normalizeWorkspacePath(candidatePath);
    return (
        normalizedCandidatePath === normalizedWorkspacePath
        || normalizedCandidatePath.startsWith(`${normalizedWorkspacePath}/`)
    );
}

function truncateCommand(command: string): string {
    if (command.length <= COMMAND_SNIPPET_LIMIT) {
        return command;
    }
    return `${command.slice(0, COMMAND_SNIPPET_LIMIT - 3)}...`;
}

function hasGitIgnoreMatch(gitIgnoreContent: string | null, fileName: string): boolean {
    if (!gitIgnoreContent) {
        return false;
    }
    const baseName = fileName.replace(/\\/g, '/').split('/').pop() ?? fileName;
    const normalizedBaseName = baseName.toLowerCase();
    const lines = gitIgnoreContent
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));

    return lines.some(line => {
        const normalizedLine = line.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
        return (
            normalizedLine === '.env'
            || normalizedLine === '.env.*'
            || normalizedLine === normalizedBaseName
            || normalizedLine.endsWith(`/${normalizedBaseName}`)
        );
    });
}

async function readWorkspaceTextFile(filePath: string): Promise<string | null> {
    try {
        const response = await window.electron.files.readFile(filePath);
        return response.success && typeof response.content === 'string'
            ? response.content
            : null;
    } catch {
        return null;
    }
}

async function readWorkspaceRelativeFile(
    workspacePath: string,
    relativePath: string
): Promise<string | null> {
    return await readWorkspaceTextFile(joinWorkspacePath(workspacePath, relativePath));
}

async function getWorkspaceDirectorySnapshot(
    workspacePath: string
): Promise<WorkspaceDirectorySnapshot> {
    try {
        const analysis = await window.electron.workspace.analyzeDirectory(workspacePath);
        return {
            fileCount: analysis.stats.fileCount,
            openingMode: analysis.stats.fileCount > 3000 ? 'fast' : 'full',
        };
    } catch {
        return {
            fileCount: 0,
            openingMode: 'fast',
        };
    }
}

async function getWorkspaceTrackedFileSignals(
    workspacePath: string,
    workspace: Workspace
): Promise<WorkspaceTrackedFileSignals> {
    const configuredEnvFile = workspace.buildConfig?.envFile?.trim() || '';
    const envFiles = ['.env', '.env.local'];
    if (configuredEnvFile.length > 0) {
        envFiles.push(configuredEnvFile);
    }

    const [hasPackageJson, packageLock, pnpmLock, yarnLock, gitIgnoreContent, envFileFlags] = await Promise.all([
        isToolRequiredForPath(workspacePath, 'package.json'),
        isToolRequiredForPath(workspacePath, 'package-lock.json'),
        isToolRequiredForPath(workspacePath, 'pnpm-lock.yaml'),
        isToolRequiredForPath(workspacePath, 'yarn.lock'),
        readWorkspaceRelativeFile(workspacePath, '.gitignore'),
        Promise.all(envFiles.map(fileName => isToolRequiredForPath(workspacePath, fileName))),
    ]);

    return {
        hasPackageJson,
        hasLockFile: packageLock || pnpmLock || yarnLock,
        hasEnvFiles: envFileFlags.some(Boolean),
        hasConfiguredEnvFile: configuredEnvFile.length > 0 && Boolean(envFileFlags[envFiles.length - 1]),
        envFiles: envFiles.filter((_, index) => envFileFlags[index]),
        gitIgnoreContent,
    };
}

function collectCommandSecurityIssues(workspace: Workspace): WorkspaceStartupPreflightIssue[] {
    const commandEntries = [
        { id: 'build', label: 'build', command: workspace.buildConfig?.buildCommand?.trim() || '' },
        { id: 'test', label: 'test', command: workspace.buildConfig?.testCommand?.trim() || '' },
        { id: 'lint', label: 'lint', command: workspace.buildConfig?.lintCommand?.trim() || '' },
        { id: 'dev', label: 'dev server', command: workspace.devServer?.command?.trim() || '' },
    ].filter(entry => entry.command.length > 0);

    const issues: WorkspaceStartupPreflightIssue[] = [];
    for (const commandEntry of commandEntries) {
        for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
            if (!pattern.regex.test(commandEntry.command)) {
                continue;
            }
            issues.push({
                id: `security-command-${commandEntry.id}-${pattern.id}`,
                source: 'security',
                severity: 'warning',
                message: {
                    key: `workspace.issueBanner.dynamic.security.command.${commandEntry.id}.${pattern.id}`,
                    fallback: `The ${commandEntry.label} command contains a risky shell pattern: ${truncateCommand(commandEntry.command)}`,
                },
                fixAction: {
                    key: `workspace.issueBanner.dynamic.security.command.${commandEntry.id}.${pattern.id}.fix`,
                    fallback: pattern.fixAction,
                },
                blocking: false,
            });
            break;
        }
    }

    return issues;
}

function collectWritablePathIssues(workspace: Workspace): WorkspaceStartupPreflightIssue[] {
    if (!workspace.path) {
        return [];
    }

    const issues: WorkspaceStartupPreflightIssue[] = [];
    const outputDir = workspace.buildConfig?.outputDir?.trim() || '';
    const envFile = workspace.buildConfig?.envFile?.trim() || '';
    const writableTargets = [
        { id: 'output-dir', label: 'output directory', value: outputDir },
        { id: 'env-file', label: 'environment file', value: envFile },
    ].filter(target => target.value.length > 0);

    for (const target of writableTargets) {
        const resolvedPath = resolveWorkspaceConfigPath(workspace.path, target.value);
        if (isWorkspaceSubpath(workspace.path, resolvedPath)) {
            continue;
        }
        issues.push({
            id: `security-${target.id}-outside-root`,
            source: 'security',
            severity: 'warning',
            message: {
                key: `workspace.issueBanner.dynamic.security.${target.id}.outsideRoot`,
                fallback: `The configured ${target.label} resolves outside the workspace root: ${target.value}`,
            },
            fixAction: {
                key: `workspace.issueBanner.dynamic.security.${target.id}.outsideRoot.fix`,
                fallback: `Keep the ${target.label} inside the workspace root or disable the automated write target.`,
            },
            blocking: false,
        });
    }

    return issues;
}

function collectRemoteTrustFindings(workspace: Workspace): {
    issues: WorkspaceStartupPreflightIssue[];
    findings: LocalizedText[];
} {
    const sshMounts = workspace.mounts.filter(mount => mount.type === 'ssh');
    if (sshMounts.length === 0) {
        return { issues: [], findings: [] };
    }

    const findings: LocalizedText[] = [{
        key: 'workspace.issueBanner.dynamic.security.remoteMountsDetected',
        fallback: `This workspace includes ${sshMounts.length} SSH mount(s). Treat remote file operations as a higher trust boundary.`,
    }];
    const issues: WorkspaceStartupPreflightIssue[] = sshMounts.flatMap(mount => {
        if (mount.ssh?.authType !== 'password') {
            return [];
        }
        return [{
            id: `security-ssh-password-${mount.id}`,
            source: 'security' as const,
            severity: 'warning' as const,
            message: {
                key: `workspace.issueBanner.dynamic.security.sshPassword.${mount.id}`,
                fallback: `SSH mount "${mount.name}" uses password authentication. Remote trust is weaker without managed keys.`,
            },
            fixAction: {
                key: `workspace.issueBanner.dynamic.security.sshPassword.${mount.id}.fix`,
                fallback: 'Prefer SSH keys with passphrases for remote workspace mounts.',
            },
            blocking: false,
        }];
    });

    if (sshMounts.some(mount => mount.ssh?.authType === 'key' && !mount.ssh?.passphrase?.trim())) {
        findings.push({
            key: 'workspace.issueBanner.dynamic.security.unprotectedSshKey',
            fallback: 'At least one SSH mount uses an unprotected private key. Add a passphrase if possible.',
        });
    }

    return { issues, findings };
}

async function detectTrackedSymlinkIssue(
    workspacePath: string
): Promise<WorkspaceStartupPreflightIssue | null> {
    try {
        const result = await window.electron.runCommand('git', ['ls-files', '--stage'], workspacePath);
        if (result.code !== 0 || !result.stdout.includes('120000 ')) {
            return null;
        }
        return {
            id: 'mount-tracked-symlinks',
            source: 'mount',
            severity: 'warning',
            message: {
                key: 'workspace.issueBanner.dynamic.mount.trackedSymlinks',
                fallback: 'Tracked symbolic links were detected. File watching and path resolution may behave differently across machines.',
            },
            fixAction: {
                key: 'workspace.issueBanner.dynamic.mount.trackedSymlinks.fix',
                fallback: 'Verify symlink targets on this machine before editing or running workspace tasks.',
            },
            blocking: false,
        };
    } catch {
        return null;
    }
}

function collectWatchLimitIssue(
    workspace: Workspace,
    directorySnapshot: WorkspaceDirectorySnapshot
): WorkspaceStartupPreflightIssue | null {
    if (workspace.advancedOptions?.fileWatchEnabled === false) {
        return null;
    }
    if (directorySnapshot.fileCount < WATCH_LIMIT_FILE_THRESHOLD) {
        return null;
    }
    return {
        id: 'analysis-watch-limit-risk',
        source: 'analysis',
        severity: 'warning',
        message: {
            key: 'workspace.issueBanner.dynamic.analysis.watchLimitRisk',
            fallback: `This workspace has ${directorySnapshot.fileCount} files. File watching may hit platform limits or degrade responsiveness.`,
        },
        fixAction: {
            key: 'workspace.issueBanner.dynamic.analysis.watchLimitRisk.fix',
            fallback: 'Tighten ignore rules or disable file watching for oversized generated folders.',
        },
        blocking: false,
    };
}

function collectEnvExposureIssue(
    trackedFileSignals: WorkspaceTrackedFileSignals
): WorkspaceStartupPreflightIssue | null {
    const envFile = trackedFileSignals.envFiles.find(fileName => !hasGitIgnoreMatch(trackedFileSignals.gitIgnoreContent, fileName));
    if (!envFile) {
        return null;
    }
    return {
        id: 'security-env-file-unignored',
        source: 'security',
        severity: 'warning',
        message: {
            key: 'workspace.issueBanner.dynamic.security.envFileUnignored',
            fallback: `Environment file "${envFile}" exists but is not clearly protected by .gitignore.`,
        },
        fixAction: {
            key: 'workspace.issueBanner.dynamic.security.envFileUnignored.fix',
            fallback: 'Ignore environment files in git before running workspace automation or collaboration flows.',
        },
        blocking: false,
    };
}

async function collectSecretExposureFindings(
    workspacePath: string,
    trackedFileSignals: WorkspaceTrackedFileSignals
): Promise<LocalizedText[]> {
    const filesToScan = [
        ...trackedFileSignals.envFiles,
        '.npmrc',
        '.git-credentials',
        '.pypirc',
    ].slice(0, SECRET_SCAN_FILE_LIMIT);
    const findings: LocalizedText[] = [];

    for (const relativePath of filesToScan) {
        const content = await readWorkspaceRelativeFile(workspacePath, relativePath);
        if (!content) {
            continue;
        }
        if (!SECRET_PATTERNS.some(pattern => pattern.test(content))) {
            continue;
        }
        findings.push({
            key: `workspace.issueBanner.dynamic.security.secretExposure.${relativePath}`,
            fallback: `Potential secrets were detected in ${relativePath}. Review the file before syncing, indexing, or sharing this workspace.`,
        });
    }

    return findings;
}

export function resolveLocalizedText(
    translate: (key: string, options?: Record<string, string | number>) => string,
    text: LocalizedText
): string {
    const translated = translate(text.key, text.params);
    if (translated !== text.key) {
        return translated;
    }
    if (!text.fallback) {
        return translated;
    }
    if (!text.params) {
        return text.fallback;
    }
    return Object.entries(text.params).reduce((accumulator, [paramKey, paramValue]) => {
        return accumulator.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(paramValue));
    }, text.fallback);
}

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
    const result = await window.electron.files.exists(joinWorkspacePath(workspacePath, fileName));
    return result.success && result.data;
}

async function hasPythonWorkspaceFiles(workspacePath: string): Promise<boolean> {
    const requiredFiles = await Promise.all(
        PYTHON_WORKSPACE_FILES.map(fileName => isToolRequiredForPath(workspacePath, fileName))
    );
    return requiredFiles.some(Boolean);
}

async function canListWorkspaceRoot(workspacePath: string): Promise<boolean> {
    if (!workspacePath) {
        return false;
    }
    try {
        const response = await window.electron.files.listDirectory(workspacePath);
        return response.success;
    } catch {
        return false;
    }
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

async function collectSecurityPosture(
    workspacePath: string,
    workspace: Workspace
): Promise<WorkspaceSecurityPosture> {
    const findings: LocalizedText[] = [];
    const trackedFileSignals = await getWorkspaceTrackedFileSignals(workspacePath, workspace);
    if (trackedFileSignals.hasEnvFiles || trackedFileSignals.hasConfiguredEnvFile) {
        findings.push({ key: 'workspace.issueBanner.securityFindings.envFilesDetected' });
    }
    if (trackedFileSignals.hasPackageJson && !trackedFileSignals.hasLockFile) {
        findings.push({ key: 'workspace.issueBanner.securityFindings.lockFileMissing' });
    }
    if (trackedFileSignals.envFiles.every(fileName => hasGitIgnoreMatch(trackedFileSignals.gitIgnoreContent, fileName))) {
        findings.push({
            key: 'workspace.issueBanner.dynamic.security.envFilesProtected',
            fallback: 'Environment files are present and appear to be protected by .gitignore.',
        });
    }

    const remoteTrust = collectRemoteTrustFindings(workspace);
    findings.push(...remoteTrust.findings);
    findings.push(...(await collectSecretExposureFindings(workspacePath, trackedFileSignals)));

    return {
        risk: toRisk(findings),
        findings,
        remediatedCount: Number(trackedFileSignals.hasLockFile)
            + Number(trackedFileSignals.envFiles.every(fileName => hasGitIgnoreMatch(trackedFileSignals.gitIgnoreContent, fileName))),
    };
}

async function collectNonBlockingIssues(
    workspace: Workspace,
    directorySnapshot: WorkspaceDirectorySnapshot
): Promise<WorkspaceStartupPreflightIssue[]> {
    const issues: WorkspaceStartupPreflightIssue[] = [];
    const rootListable = await canListWorkspaceRoot(workspace.path);
    if (!rootListable) {
        issues.push({
            id: 'mount-permission-denied',
            source: 'mount',
            severity: 'error',
            message: { key: 'workspace.errors.explorer.permissionDenied' },
            fixAction: { key: 'workspace.errors.explorer.permissionDenied' },
            blocking: true,
        });
    }

    const trackedFileSignals = await getWorkspaceTrackedFileSignals(workspace.path, workspace);
    const envExposureIssue = collectEnvExposureIssue(trackedFileSignals);
    if (envExposureIssue) {
        issues.push(envExposureIssue);
    }

    const watchLimitIssue = collectWatchLimitIssue(workspace, directorySnapshot);
    if (watchLimitIssue) {
        issues.push(watchLimitIssue);
    }

    const symlinkIssue = await detectTrackedSymlinkIssue(workspace.path);
    if (symlinkIssue) {
        issues.push(symlinkIssue);
    }

    issues.push(...collectCommandSecurityIssues(workspace));
    issues.push(...collectWritablePathIssues(workspace));
    issues.push(...collectRemoteTrustFindings(workspace).issues);

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
    return issues;
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
        const directorySnapshot = await getWorkspaceDirectorySnapshot(workspace.path);
        openingMode = directorySnapshot.openingMode;
        runbooks = await buildRunbooks(workspace.path, workspace);
        securityPosture = await collectSecurityPosture(workspace.path, workspace);
        issues.push(...(await collectNonBlockingIssues(workspace, directorySnapshot)));
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

