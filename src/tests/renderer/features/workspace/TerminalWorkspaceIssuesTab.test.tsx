/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TerminalWorkspaceIssuesTab } from '@/features/terminal/components/TerminalWorkspaceIssuesTab';

vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('@/utils/renderer-logger', () => ({
    appLogger: {
        error: vi.fn(),
    },
}));

describe('TerminalWorkspaceIssuesTab', () => {
    beforeEach(() => {
        window.electron = {
            workspace: {
                analyze: vi.fn().mockResolvedValue({
                    issues: [
                        {
                            severity: 'warning',
                            message: 'console.warn("warn")',
                            file: 'src/index.ts',
                            line: 1,
                            source: 'static-analysis',
                        },
                    ],
                    annotations: [
                        {
                            file: 'src/index.ts',
                            line: 2,
                            message: '// TODO: tighten validation',
                            type: 'todo',
                        },
                    ],
                    lspDiagnostics: [
                        {
                            severity: 'error',
                            message: 'Type error',
                            file: 'src/index.ts',
                            line: 3,
                            source: 'typescript',
                        },
                    ],
                }),
            },
        } as never;
    });

    it('renders terminal, annotation, and LSP sections from workspace analysis', async () => {
        render(
            <TerminalWorkspaceIssuesTab
                workspacePath="C:/repo"
                workspaceId="workspace-1"
            />
        );

        await waitFor(() => {
            expect(screen.getByText('frontend.terminal.workspaceIssuesLanguageServer (1)')).toBeInTheDocument();
        });

        expect(screen.getByText('frontend.terminal.workspaceIssuesTerminal (1)')).toBeInTheDocument();
        expect(screen.getByText('frontend.terminal.workspaceIssuesAnnotations (1)')).toBeInTheDocument();
        expect(screen.getByText('Type error')).toBeInTheDocument();
        expect(screen.getByText('// TODO: tighten validation')).toBeInTheDocument();
    });
});
