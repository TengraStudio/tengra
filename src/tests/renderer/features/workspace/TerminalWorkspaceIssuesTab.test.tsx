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
            expect(screen.getByText('terminal.workspaceIssuesLanguageServer (1)')).toBeInTheDocument();
        });

        expect(screen.getByText('terminal.workspaceIssuesTerminal (1)')).toBeInTheDocument();
        expect(screen.getByText('terminal.workspaceIssuesAnnotations (1)')).toBeInTheDocument();
        expect(screen.getByText('Type error')).toBeInTheDocument();
        expect(screen.getByText('// TODO: tighten validation')).toBeInTheDocument();
    });
});
