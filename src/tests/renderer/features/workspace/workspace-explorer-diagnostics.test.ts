/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, it } from 'vitest';

import { buildWorkspaceExplorerDiagnosticsSnapshot } from '@/features/workspace/utils/workspace-explorer-diagnostics';
import type { WorkspaceAnalysis, WorkspaceMount } from '@/types';

describe('buildWorkspaceExplorerDiagnosticsSnapshot', () => {
    const mounts: WorkspaceMount[] = [
        {
            id: 'local-workspace',
            name: 'Local',
            type: 'local',
            rootPath: 'C:/repo',
        },
    ];

    it('aggregates issue counts into file and parent directory paths', () => {
        const analysis: WorkspaceAnalysis = {
            type: 'node',
            frameworks: [],
            dependencies: {},
            devDependencies: {},
            stats: {
                fileCount: 3,
                totalSize: 120,
                loc: 12,
                lastModified: 0,
            },
            languages: {},
            files: [],
            todos: [],
            issues: [
                {
                    severity: 'error',
                    message: 'ts issue',
                    file: 'src/app.ts',
                    line: 3,
                    source: 'typescript'
                },
                {
                    severity: 'warning',
                    message: 'test issue',
                    file: 'src/__tests__/app.test.ts',
                    line: 8,
                    source: 'vitest'
                },
                {
                    severity: 'warning',
                    message: 'lint issue',
                    file: 'scripts/build.js',
                    line: 4,
                    source: 'eslint'
                },
            ],
            lspDiagnostics: [
                {
                    severity: 'error',
                    message: 'lsp issue',
                    file: 'src/lsp.ts',
                    line: 2,
                    source: 'typescript'
                },
            ]
        };

        const snapshot = buildWorkspaceExplorerDiagnosticsSnapshot({
            analysis,
            mounts,
            sessions: [],
            workspaceRootPath: 'C:/repo',
        });

        expect(snapshot.mountSummary['local-workspace']).toEqual({
            typescript: 2,
            lint: 1,
            test: 1,
            agent: 0,
            total: 4,
        });
        expect(snapshot.byPath['C:/repo/src']).toMatchObject({
            typescript: 2,
            test: 1,
            total: 3,
        });
        expect(snapshot.byPath['C:/repo/src/app.ts']).toMatchObject({
            typescript: 1,
            total: 1,
        });
        expect(snapshot.byPath['C:/repo/src/lsp.ts']).toMatchObject({
            typescript: 1,
            total: 1,
        });
        expect(snapshot.byPath['C:/repo/scripts/build.js']).toMatchObject({
            lint: 1,
            total: 1,
        });
    });

    it('adds agent issues to the mount summary when sessions fail or run dangerously', () => {
        const snapshot = buildWorkspaceExplorerDiagnosticsSnapshot({
            analysis: null,
            mounts,
            workspaceRootPath: 'C:/repo',
            sessions: [
                {
                    id: 'session-failed',
                    workspaceId: 'workspace-1',
                    title: 'Failed',
                    status: 'failed',
                    updatedAt: 0,
                    createdAt: 0,
                    messageCount: 0,
                    modes: { ask: true, plan: false, agent: false, council: false },
                    strategy: 'balanced',
                    permissionPolicy: {
                        commandPolicy: 'blocked',
                        pathPolicy: 'workspace-root-only',
                        allowedCommands: [],
                        disallowedCommands: [],
                        allowedPaths: ['C:/repo'],
                    },
                    background: false,
                    archived: false,
                },
                {
                    id: 'session-dangerous',
                    workspaceId: 'workspace-1',
                    title: 'Dangerous',
                    status: 'active',
                    updatedAt: 0,
                    createdAt: 0,
                    messageCount: 0,
                    modes: { ask: false, plan: false, agent: true, council: false },
                    strategy: 'balanced',
                    permissionPolicy: {
                        commandPolicy: 'full-access',
                        pathPolicy: 'restricted-off-dangerous',
                        allowedCommands: ['npm'],
                        disallowedCommands: [],
                        allowedPaths: ['C:/repo'],
                    },
                    background: false,
                    archived: false,
                },
            ],
        });

        expect(snapshot.mountSummary['local-workspace']).toEqual({
            typescript: 0,
            lint: 0,
            test: 0,
            agent: 2,
            total: 2,
        });
    });
});
