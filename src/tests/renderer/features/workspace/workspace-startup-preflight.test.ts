/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
    commandStdout?: Partial<Record<string, string>>;
    listDirectorySuccess?: boolean;
    readFiles?: Partial<Record<string, string>>;
    fileCount?: number;
}

function mountPreflightElectronMock(options: PreflightMockOptions) {
    const base = window.electron ?? webElectronMock;
    const exists = vi.fn(async (path: string) => ({
        success: true,
        data: options.existingPaths.has(path),
    }));
    const runCommand = vi.fn(async (command: string) => ({
        code: options.commandExitCodes?.[command] ?? 0,
        stdout: options.commandStdout?.[command] ?? '',
        stderr: '',
    }));

    window.electron = {
        ...base,
        files: {
            ...base.files,
            exists,
            listDirectory: vi.fn(async () => ({
                success: options.listDirectorySuccess !== false,
                data: [],
            })),
            readFile: vi.fn(async (path: string) => ({
                success: typeof options.readFiles?.[path] === 'string',
                content: options.readFiles?.[path] ?? '',
            })),
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
                stats: {
                    fileCount: options.fileCount ?? 50,
                    totalSize: 0,
                    loc: 0,
                    lastModified: Date.now(),
                },
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
        expect(result.canOpen).toBe(true);
        expect(runCommand).toHaveBeenCalledWith('node', ['--version'], baseWorkspace.path);
        expect(runCommand).toHaveBeenCalledWith('npm', ['--version'], baseWorkspace.path);
        expect(runCommand).not.toHaveBeenCalledWith('python', ['--version'], baseWorkspace.path);
        expect(runCommand).not.toHaveBeenCalledWith('go', ['--version'], baseWorkspace.path);
    });

    it('skips non-blocking diagnostics during fast open preflight', async () => {
        const { runCommand } = mountPreflightElectronMock({
            existingPaths: new Set([
                baseWorkspace.path,
                `${baseWorkspace.path}\\package.json`,
            ]),
            commandExitCodes: {
                node: 1,
                npm: 1,
            },
        });

        const result = await runWorkspaceStartupPreflight(baseWorkspace, {
            includeNonBlockingChecks: false,
        });

        expect(result.canOpen).toBe(true);
        expect(result.issues).toEqual([]);
        expect(runCommand).not.toHaveBeenCalled();
    });

    it('blocks workspace open when the root cannot be listed', async () => {
        mountPreflightElectronMock({
            existingPaths: new Set([
                baseWorkspace.path,
                `${baseWorkspace.path}\\package.json`,
                `${baseWorkspace.path}\\package-lock.json`,
            ]),
            listDirectorySuccess: false,
        });

        const result = await runWorkspaceStartupPreflight(baseWorkspace);

        expect(result.canOpen).toBe(false);
        expect(result.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'mount-permission-denied',
                    blocking: true,
                    message: { key: 'workspace.errors.explorer.permissionDenied' },
                }),
            ])
        );
    });

    it('warns when environment files are not protected by gitignore', async () => {
        mountPreflightElectronMock({
            existingPaths: new Set([
                baseWorkspace.path,
                `${baseWorkspace.path}\\package.json`,
                `${baseWorkspace.path}\\package-lock.json`,
                `${baseWorkspace.path}\\.env`,
            ]),
            readFiles: {
                [`${baseWorkspace.path}\\.gitignore`]: 'node_modules/\ndist/\n',
            },
        });

        const result = await runWorkspaceStartupPreflight(baseWorkspace);

        expect(result.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'security-env-file-unignored',
                    source: 'security',
                }),
            ])
        );
    });

    it('adds remote trust warnings for ssh mounts using password auth', async () => {
        mountPreflightElectronMock({
            existingPaths: new Set([
                baseWorkspace.path,
                `${baseWorkspace.path}\\package.json`,
                `${baseWorkspace.path}\\package-lock.json`,
            ]),
        });

        const result = await runWorkspaceStartupPreflight({
            ...baseWorkspace,
            mounts: [
                {
                    id: 'ssh-1',
                    name: 'Prod',
                    type: 'ssh',
                    rootPath: '/srv/app',
                    ssh: {
                        host: 'prod.internal',
                        username: 'deploy',
                        authType: 'password',
                        password: 'secret',
                    },
                },
            ],
        });

        expect(result.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'security-ssh-password-ssh-1',
                    source: 'security',
                }),
            ])
        );
        expect(result.securityPosture.findings).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    key: 'workspace.issueBanner.dynamic.security.remoteMountsDetected',
                }),
            ])
        );
    });

    it('warns when workspace size approaches watch pressure limits', async () => {
        mountPreflightElectronMock({
            existingPaths: new Set([
                baseWorkspace.path,
                `${baseWorkspace.path}\\package.json`,
                `${baseWorkspace.path}\\package-lock.json`,
            ]),
            fileCount: 25_000,
        });

        const result = await runWorkspaceStartupPreflight(baseWorkspace);

        expect(result.openingMode).toBe('fast');
        expect(result.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'analysis-watch-limit-risk',
                    source: 'analysis',
                }),
            ])
        );
    });
});

