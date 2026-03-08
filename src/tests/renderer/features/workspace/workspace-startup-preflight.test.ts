import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runWorkspaceStartupPreflight } from '@/features/workspace/utils/workspace-startup-preflight';
import { Workspace } from '@/types';
import { webElectronMock } from '@/web-bridge';

const baseWorkspace: Workspace = {
    id: 'workspace-1',
    title: 'Workspace',
    description: 'Workspace for preflight tests',
    path: 'C:\\workspace\\demo',
    mounts: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    chatIds: [],
    councilConfig: {
        enabled: false,
        members: [],
        consensusThreshold: 0.7,
    },
    status: 'active',
};

interface PreflightMockOptions {
    existingPaths: Set<string>;
    commandExitCodes?: Partial<Record<string, number>>;
}

function mountPreflightElectronMock(options: PreflightMockOptions) {
    const base = window.electron ?? webElectronMock;
    const exists = vi.fn(async (path: string) => options.existingPaths.has(path));
    const runCommand = vi.fn(async (command: string) => ({
        code: options.commandExitCodes?.[command] ?? 0,
        stdout: '',
        stderr: '',
    }));

    window.electron = {
        ...base,
        files: {
            ...base.files,
            exists,
        },
        runCommand,
        terminal: {
            ...base.terminal,
            getRuntimeHealth: vi.fn(async () => ({
                terminalAvailable: true,
                totalBackends: 2,
                availableBackends: 2,
                backends: [
                    { id: 'pwsh', name: 'PowerShell', available: true },
                    { id: 'cmd', name: 'Command Prompt', available: true },
                ],
            })),
        },
        workspace: {
            ...base.workspace,
            analyzeDirectory: vi.fn(async () => ({
                hasPackageJson: true,
                pkg: {},
                readme: null,
                stats: { fileCount: 50, totalSize: 0, loc: 0, lastModified: Date.now() },
            })),
        },
        git: {
            ...base.git,
            isRepository: vi.fn(async () => ({ success: true, isRepository: true })),
            getBranch: vi.fn(async () => ({ success: true, branch: 'feature/preflight' })),
            getStatus: vi.fn(async () => ({ success: true, changes: 0 })),
        },
    };

    return { exists, runCommand };
}

describe('workspace-startup-preflight runbook and issue filtering', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('generates setup/build/test/release runbooks when commands are configured', async () => {
        mountPreflightElectronMock({
            existingPaths: new Set([
                baseWorkspace.path,
                `${baseWorkspace.path}\\package.json`,
                `${baseWorkspace.path}\\.nvmrc`,
                `${baseWorkspace.path}\\package-lock.json`,
            ]),
        });

        const result = await runWorkspaceStartupPreflight({
            ...baseWorkspace,
            buildConfig: {
                buildCommand: 'npm run build',
                testCommand: 'npm run test',
            },
            devServer: {
                command: 'npm run dev',
            },
        });

        expect(result.runbooks.map(runbook => runbook.id)).toEqual(['setup', 'build', 'test', 'release']);
        expect(result.runbooks.map(runbook => runbook.command)).toEqual([
            'npm install',
            'npm run build',
            'npm run test',
            'npm run dev',
        ]);
    });

    it('only reports tool issues for required ecosystems', async () => {
        const { runCommand } = mountPreflightElectronMock({
            existingPaths: new Set([
                baseWorkspace.path,
                `${baseWorkspace.path}\\package.json`,
                `${baseWorkspace.path}\\package-lock.json`,
            ]),
            commandExitCodes: {
                node: 1,
                npm: 0,
                python: 1,
                go: 1,
            },
        });

        const result = await runWorkspaceStartupPreflight(baseWorkspace);
        const toolIssueIds = result.issues
            .map(issue => issue.id)
            .filter(issueId => issueId.startsWith('tool-'));

        expect(toolIssueIds).toEqual(['tool-node']);
        expect(result.canOpen).toBe(false);
        expect(runCommand).toHaveBeenCalledWith('node', ['--version'], baseWorkspace.path);
        expect(runCommand).toHaveBeenCalledWith('npm', ['--version'], baseWorkspace.path);
        expect(runCommand).not.toHaveBeenCalledWith('python', ['--version'], baseWorkspace.path);
        expect(runCommand).not.toHaveBeenCalledWith('go', ['--version'], baseWorkspace.path);
    });
});
