import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceEditor, WorkspaceEditorProps } from '@/features/workspace/components/workspace/WorkspaceEditor';
import type { WorkspaceSnippet } from '@/features/workspace/utils/snippet-manager';
import { EditorTab } from '@/types';

const {
    mockLoadWorkspaceSnippets,
    mockLoadReviewRuleConfig,
    mockFilterWorkspaceSnippets,
} = vi.hoisted(() => ({
    mockLoadWorkspaceSnippets: vi.fn((): WorkspaceSnippet[] => []),
    mockLoadReviewRuleConfig: vi.fn(() => ({
        detectConsoleLog: false,
        detectAnyType: false,
        detectUnsafeEval: false,
    })),
    mockFilterWorkspaceSnippets: vi.fn((snippets: WorkspaceSnippet[]) => snippets),
}));

vi.mock('@/components/ui/CodeEditor', () => ({
    CodeEditor: ({
        value,
        onChange,
    }: {
        value: string;
        language: string;
        onChange: (value?: string) => void;
        readonly: boolean;
    }) => (
        <textarea
            data-testid="code-editor-input"
            value={value}
            onChange={event => onChange(event.target.value)}
        />
    ),
}));

vi.mock('@/features/workspace/utils/dev-ai-assistant', () => ({
    loadReviewRuleConfig: mockLoadReviewRuleConfig,
    runBugDetectionAnalysis: vi.fn(() => ({ classification: 'safe', confidenceScore: 0, fixSuggestions: [], regressionSuggestions: [] })),
    runCodeReviewAnalysis: vi.fn(async () => ({ reviewComments: [] })),
    runPerformanceSuggestionAnalysis: vi.fn(() => ({ profilingNotes: [], databaseNotes: [], bundleNotes: [], cachingNotes: [], lazyLoadingNotes: [], performanceBudgets: [], buildTimeNotes: [], runtimeMonitoringNotes: [] })),
    saveReviewRuleConfig: vi.fn(),
}));

vi.mock('@/features/workspace/utils/snippet-manager', () => ({
    createShareCode: vi.fn(() => ''),
    filterWorkspaceSnippets: mockFilterWorkspaceSnippets,
    loadWorkspaceSnippets: mockLoadWorkspaceSnippets,
    filterSnippets: mockFilterWorkspaceSnippets,
    parseShareCode: vi.fn(() => null),
    saveWorkspaceSnippets: vi.fn(),
    createWorkspaceShareCode: vi.fn(() => ''),
    parseWorkspaceShareCode: vi.fn(() => null),
}));

vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/lib/utils', () => ({
    cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/utils/language-map', () => ({
    getLanguageFromExtension: () => 'typescript',
}));

function createMockTab(overrides?: Partial<EditorTab>): EditorTab {
    return {
        id: 'tab-1',
        mountId: 'mount-1',
        path: 'C:\\workspace\\file.ts',
        name: 'file.ts',
        content: 'const x = 1;',
        savedContent: 'const x = 1;',
        isDirty: false,
        type: 'code',
        ...overrides,
    };
}

function createMockProps(overrides?: Partial<WorkspaceEditorProps>): WorkspaceEditorProps {
    return {
        activeTab: createMockTab(),
        updateTabContent: vi.fn(),
        workspaceKey: 'test-workspace',
        workspacePath: 'C:\\workspace',
        emptyState: <div data-testid="empty-state">empty</div>,
        ...overrides,
    };
}

/** Helper to find the scratchpad textarea */
function getScratchTextarea(): HTMLTextAreaElement {
    const textareas = screen.getAllByRole('textbox');
    const found = textareas.find(
        el => el.tagName === 'TEXTAREA' && el.classList.contains('min-h-[70px]')
    ) as HTMLTextAreaElement | undefined;
    if (!found) {
        throw new Error('Scratchpad textarea not found');
    }
    return found;
}

async function clickAndFlush(label: string): Promise<void> {
    await act(async () => {
        fireEvent.click(screen.getByText(label));
        await Promise.resolve();
    });
}

describe('WorkspaceEditor – scratchpad command & file-save', () => {
    let mockRunCommand: ReturnType<typeof vi.fn>;
    let mockWriteFile: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();

        mockRunCommand = vi.fn().mockResolvedValue({ stdout: 'ok', stderr: '' });
        mockWriteFile = vi.fn().mockResolvedValue(undefined);

        Object.defineProperty(window, 'electron', {
            value: {
                clipboard: {
                    writeText: vi.fn().mockResolvedValue(undefined),
                    readText: vi.fn().mockResolvedValue({ success: false, text: '' }),
                },
                runCommand: mockRunCommand,
                files: { writeFile: mockWriteFile },
                code: { previewRenameSymbol: vi.fn().mockResolvedValue({ updatedFiles: [], totalFiles: 0, totalOccurrences: 0 }) },
            },
            configurable: true,
            writable: true,
        });
    });

    // ── Scratchpad command execution ──────────────────────────────

    describe('scratchpad command execution', () => {
        it('parses command and arguments from scratchpad text and executes', async () => {
            render(<WorkspaceEditor {...createMockProps()} />);

            fireEvent.change(getScratchTextarea(), { target: { value: 'npm run build' } });
            await clickAndFlush('workspaceDashboard.editor.runScratch');

            await vi.waitFor(() => {
                expect(mockRunCommand).toHaveBeenCalledWith('npm', ['run', 'build'], 'C:\\workspace');
            });
        });

        it('displays stdout and stderr in test output panel', async () => {
            mockRunCommand.mockResolvedValueOnce({ stdout: 'build success', stderr: 'warn: deprecated' });

            render(<WorkspaceEditor {...createMockProps()} />);

            fireEvent.change(getScratchTextarea(), { target: { value: 'npm run build' } });
            await clickAndFlush('workspaceDashboard.editor.runScratch');

            await vi.waitFor(() => {
                expect(screen.getByText(/build success/)).toBeInTheDocument();
                expect(screen.getByText(/warn: deprecated/)).toBeInTheDocument();
            });
        });

        it('handles single-word commands without arguments', async () => {
            render(<WorkspaceEditor {...createMockProps()} />);

            fireEvent.change(getScratchTextarea(), { target: { value: 'ls' } });
            await clickAndFlush('workspaceDashboard.editor.runScratch');

            await vi.waitFor(() => {
                expect(mockRunCommand).toHaveBeenCalledWith('ls', [], 'C:\\workspace');
            });
        });

        it('does not execute when scratchpad content is empty', async () => {
            render(<WorkspaceEditor {...createMockProps()} />);

            await clickAndFlush('workspaceDashboard.editor.runScratch');

            // Give a tick for any async call to resolve
            await vi.waitFor(() => {
                expect(mockRunCommand).not.toHaveBeenCalled();
            });
        });

        it('does not execute when scratchpad content is only whitespace', async () => {
            render(<WorkspaceEditor {...createMockProps()} />);

            fireEvent.change(getScratchTextarea(), { target: { value: '   \n  ' } });
            await clickAndFlush('workspaceDashboard.editor.runScratch');

            await vi.waitFor(() => {
                expect(mockRunCommand).not.toHaveBeenCalled();
            });
        });

        it('does not execute when workspacePath is undefined', async () => {
            render(<WorkspaceEditor {...createMockProps({ workspacePath: undefined })} />);

            fireEvent.change(getScratchTextarea(), { target: { value: 'echo hello' } });
            await clickAndFlush('workspaceDashboard.editor.runScratch');

            await vi.waitFor(() => {
                expect(mockRunCommand).not.toHaveBeenCalled();
            });
        });
    });

    // ── Save scratchpad as doc ────────────────────────────────────

    describe('save scratchpad as doc', () => {
        it('writes scratchpad content to docs directory with default name', async () => {
            render(<WorkspaceEditor {...createMockProps()} />);

            fireEvent.change(getScratchTextarea(), { target: { value: 'Documentation content' } });
            await clickAndFlush('workspaceDashboard.editor.saveScratchDoc');

            await vi.waitFor(() => {
                expect(mockWriteFile).toHaveBeenCalledWith(
                    'C:\\workspace\\docs\\scratch-note.md',
                    'Documentation content'
                );
            });
        });

        it('uses custom scratch name for doc file', async () => {
            render(<WorkspaceEditor {...createMockProps()} />);

            const inputs = screen.getAllByRole('textbox');
            const nameInput = inputs.find(
                el => el.tagName === 'INPUT' && (el as HTMLInputElement).value === 'scratch-note'
            );
            expect(nameInput).toBeDefined();

            fireEvent.change(nameInput!, { target: { value: 'my-design-doc' } });
            fireEvent.change(getScratchTextarea(), { target: { value: 'Design notes' } });
            await clickAndFlush('workspaceDashboard.editor.saveScratchDoc');

            await vi.waitFor(() => {
                expect(mockWriteFile).toHaveBeenCalledWith(
                    'C:\\workspace\\docs\\my-design-doc.md',
                    'Design notes'
                );
            });
        });

        it('shows saved status message after doc save', async () => {
            render(<WorkspaceEditor {...createMockProps()} />);

            fireEvent.change(getScratchTextarea(), { target: { value: 'content' } });
            await clickAndFlush('workspaceDashboard.editor.saveScratchDoc');

            await vi.waitFor(() => {
                expect(screen.getByText('workspaceDashboard.editor.scratchSavedDoc')).toBeInTheDocument();
            });
        });

        it('does not save doc when workspacePath is undefined', async () => {
            render(<WorkspaceEditor {...createMockProps({ workspacePath: undefined })} />);

            fireEvent.change(getScratchTextarea(), { target: { value: 'content' } });
            await clickAndFlush('workspaceDashboard.editor.saveScratchDoc');

            await vi.waitFor(() => {
                expect(mockWriteFile).not.toHaveBeenCalled();
            });
        });
    });

    // ── Save scratchpad as task ───────────────────────────────────

    describe('save scratchpad as task', () => {
        it('writes scratchpad content to tasks directory with default name', async () => {
            render(<WorkspaceEditor {...createMockProps()} />);

            fireEvent.change(getScratchTextarea(), { target: { value: 'Fix the login bug' } });
            await clickAndFlush('workspaceDashboard.editor.saveScratchTask');

            await vi.waitFor(() => {
                expect(mockWriteFile).toHaveBeenCalledWith(
                    'C:\\workspace\\tasks\\scratch-note.txt',
                    'Fix the login bug'
                );
            });
        });

        it('uses custom scratch name for task file', async () => {
            render(<WorkspaceEditor {...createMockProps()} />);

            const inputs = screen.getAllByRole('textbox');
            const nameInput = inputs.find(
                el => el.tagName === 'INPUT' && (el as HTMLInputElement).value === 'scratch-note'
            );
            fireEvent.change(nameInput!, { target: { value: 'login-fix' } });
            fireEvent.change(getScratchTextarea(), { target: { value: 'Fix login' } });
            await clickAndFlush('workspaceDashboard.editor.saveScratchTask');

            await vi.waitFor(() => {
                expect(mockWriteFile).toHaveBeenCalledWith(
                    'C:\\workspace\\tasks\\login-fix.txt',
                    'Fix login'
                );
            });
        });

        it('shows saved status message after task save', async () => {
            render(<WorkspaceEditor {...createMockProps()} />);

            fireEvent.change(getScratchTextarea(), { target: { value: 'task content' } });
            await clickAndFlush('workspaceDashboard.editor.saveScratchTask');

            await vi.waitFor(() => {
                expect(screen.getByText('workspaceDashboard.editor.scratchSavedTask')).toBeInTheDocument();
            });
        });

        it('does not save task when workspacePath is undefined', async () => {
            render(<WorkspaceEditor {...createMockProps({ workspacePath: undefined })} />);

            fireEvent.change(getScratchTextarea(), { target: { value: 'task' } });
            await clickAndFlush('workspaceDashboard.editor.saveScratchTask');

            await vi.waitFor(() => {
                expect(mockWriteFile).not.toHaveBeenCalled();
            });
        });
    });

    // ── Edge cases ────────────────────────────────────────────────

    describe('edge cases', () => {
        it('saves empty scratchpad content to doc file without error', async () => {
            render(<WorkspaceEditor {...createMockProps()} />);

            await clickAndFlush('workspaceDashboard.editor.saveScratchDoc');

            await vi.waitFor(() => {
                expect(mockWriteFile).toHaveBeenCalledWith(
                    expect.stringContaining('docs'),
                    ''
                );
            });
        });

        it('saves empty scratchpad content to task file without error', async () => {
            render(<WorkspaceEditor {...createMockProps()} />);

            await clickAndFlush('workspaceDashboard.editor.saveScratchTask');

            await vi.waitFor(() => {
                expect(mockWriteFile).toHaveBeenCalledWith(
                    expect.stringContaining('tasks'),
                    ''
                );
            });
        });

        it('calls writeFile when saving doc even if content will cause issues', async () => {
            render(<WorkspaceEditor {...createMockProps()} />);

            fireEvent.change(getScratchTextarea(), { target: { value: 'special chars: <>|' } });
            await clickAndFlush('workspaceDashboard.editor.saveScratchDoc');

            await vi.waitFor(() => {
                expect(mockWriteFile).toHaveBeenCalledWith(
                    expect.stringContaining('docs'),
                    'special chars: <>|'
                );
            });
        });

        it('calls writeFile when saving task with multiline content', async () => {
            render(<WorkspaceEditor {...createMockProps()} />);

            fireEvent.change(getScratchTextarea(), { target: { value: 'line1\nline2\nline3' } });
            await clickAndFlush('workspaceDashboard.editor.saveScratchTask');

            await vi.waitFor(() => {
                expect(mockWriteFile).toHaveBeenCalledWith(
                    expect.stringContaining('tasks'),
                    'line1\nline2\nline3'
                );
            });
        });

        it('runs command with extra whitespace between arguments', async () => {
            render(<WorkspaceEditor {...createMockProps()} />);

            fireEvent.change(getScratchTextarea(), { target: { value: 'git   status  --short' } });
            await clickAndFlush('workspaceDashboard.editor.runScratch');

            await vi.waitFor(() => {
                // split(/\s+/) collapses multiple spaces
                expect(mockRunCommand).toHaveBeenCalledWith('git', ['status', '--short'], 'C:\\workspace');
            });
        });

        it('can save doc and task sequentially with different content', async () => {
            render(<WorkspaceEditor {...createMockProps()} />);

            fireEvent.change(getScratchTextarea(), { target: { value: 'doc content' } });
            await clickAndFlush('workspaceDashboard.editor.saveScratchDoc');

            await vi.waitFor(() => {
                expect(mockWriteFile).toHaveBeenCalledWith(
                    expect.stringContaining('docs'),
                    'doc content'
                );
            });

            fireEvent.change(getScratchTextarea(), { target: { value: 'task content' } });
            await clickAndFlush('workspaceDashboard.editor.saveScratchTask');

            await vi.waitFor(() => {
                expect(mockWriteFile).toHaveBeenCalledWith(
                    expect.stringContaining('tasks'),
                    'task content'
                );
            });

            expect(mockWriteFile).toHaveBeenCalledTimes(2);
        });
    });
});
