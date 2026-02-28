import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceEditor, WorkspaceEditorProps } from '@/features/projects/components/workspace/WorkspaceEditor';
import type { ProjectSnippet } from '@/features/projects/utils/snippet-manager';
import { EditorTab } from '@/types';

const {
    mockCreateShareCode,
    mockFilterSnippets,
    mockLoadProjectSnippets,
    mockLoadReviewRuleConfig,
    mockParseShareCode,
    mockRunBugDetectionAnalysis,
    mockRunCodeReviewAnalysis,
    mockRunPerformanceSuggestionAnalysis,
    mockSaveProjectSnippets,
    mockSaveReviewRuleConfig,
} = vi.hoisted(() => ({
    mockCreateShareCode: vi.fn(() => 'share-code'),
    mockFilterSnippets: vi.fn((snippets: ProjectSnippet[]) => snippets),
    mockLoadProjectSnippets: vi.fn(() => [
        {
            id: 'snippet-1',
            name: 'Reusable snippet',
            language: 'typescript',
            projectKey: 'test-project',
            content: 'const snippet = true;',
            createdAt: 1,
        },
    ]),
    mockLoadReviewRuleConfig: vi.fn(() => ({
        detectConsoleLog: true,
        detectAnyType: true,
        detectUnsafeEval: false,
    })),
    mockParseShareCode: vi.fn((): ProjectSnippet | null => null),
    mockRunBugDetectionAnalysis: vi.fn(() => ({
        classification: 'safe',
        confidenceScore: 0.75,
        fixSuggestions: ['fix-one'],
        regressionSuggestions: ['regression-one'],
    })),
    mockRunCodeReviewAnalysis: vi.fn(async () => ({
        reviewComments: ['review-one'],
    })),
    mockRunPerformanceSuggestionAnalysis: vi.fn(() => ({
        profilingNotes: ['profile-one'],
        databaseNotes: [],
        bundleNotes: [],
        cachingNotes: [],
        lazyLoadingNotes: [],
        performanceBudgets: [],
        buildTimeNotes: [],
        runtimeMonitoringNotes: [],
    })),
    mockSaveProjectSnippets: vi.fn(),
    mockSaveReviewRuleConfig: vi.fn(),
}));

vi.mock('@/components/ui/CodeMirrorEditor', () => ({
    CodeMirrorEditor: ({
        content,
        language,
        onChange,
    }: {
        content: string;
        language: string;
        onChange: (value?: string) => void;
    }) => (
        <div data-testid="code-editor" data-language={language}>
            <textarea
                aria-label="code-editor-input"
                data-testid="code-editor-input"
                value={content}
                onChange={event => onChange(event.target.value)}
            />
        </div>
    ),
}));

vi.mock('@/features/projects/utils/dev-ai-assistant', () => ({
    loadReviewRuleConfig: mockLoadReviewRuleConfig,
    runBugDetectionAnalysis: mockRunBugDetectionAnalysis,
    runCodeReviewAnalysis: mockRunCodeReviewAnalysis,
    runPerformanceSuggestionAnalysis: mockRunPerformanceSuggestionAnalysis,
    saveReviewRuleConfig: mockSaveReviewRuleConfig,
}));

vi.mock('@/features/projects/utils/snippet-manager', () => ({
    createShareCode: mockCreateShareCode,
    filterSnippets: mockFilterSnippets,
    loadProjectSnippets: mockLoadProjectSnippets,
    parseShareCode: mockParseShareCode,
    saveProjectSnippets: mockSaveProjectSnippets,
}));

vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('@/lib/utils', () => ({
    cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/utils/language-map', () => ({
    getLanguageFromExtension: (filename: string) => {
        const ext = filename.split('.').pop() ?? '';
        const map: Record<string, string> = {
            ts: 'typescript',
            js: 'javascript',
            json: 'json',
            md: 'markdown',
            png: 'image',
        };
        return map[ext] ?? 'plaintext';
    },
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
        activeTab: null,
        updateTabContent: vi.fn(),
        projectKey: 'test-project',
        projectPath: 'C:\\workspace',
        emptyState: <div data-testid="empty-state">empty-state</div>,
        ...overrides,
    };
}

describe('WorkspaceEditor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('renders action controls for snippet and AI workflows', () => {
        render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

        expect(screen.getByRole('combobox')).toBeInTheDocument();
        expect(screen.getByText('projectDashboard.editor.insertSnippet')).toBeInTheDocument();
        expect(screen.getByText('projectDashboard.editor.saveSnippet')).toBeInTheDocument();
        expect(screen.getByText('AI Review')).toBeInTheDocument();
        expect(screen.getByText('AI Bug Scan')).toBeInTheDocument();
        expect(screen.getByText('AI Perf')).toBeInTheDocument();
    });

    it('saves the current file as a snippet from the action controls', () => {
        render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

        fireEvent.click(screen.getByText('projectDashboard.editor.saveSnippet'));

        expect(mockSaveProjectSnippets).toHaveBeenCalledTimes(1);
        expect(mockSaveProjectSnippets).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'file.ts',
                    content: 'const x = 1;',
                    language: 'typescript',
                    projectKey: 'test-project',
                }),
            ])
        );
        expect(screen.getByText('projectDashboard.editor.snippetSaved')).toBeInTheDocument();
    });

    it('inserts the selected snippet into the active tab', () => {
        const updateTabContent = vi.fn();
        render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab(), updateTabContent })} />);

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'snippet-1' } });
        fireEvent.click(screen.getByText('projectDashboard.editor.insertSnippet'));

        expect(updateTabContent).toHaveBeenCalledWith('const x = 1;\nconst snippet = true;');
        expect(screen.getByText('projectDashboard.editor.snippetInserted')).toBeInTheDocument();
    });

    it('renders the code editor in the main area and forwards changes', () => {
        const updateTabContent = vi.fn();
        render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab(), updateTabContent })} />);

        const editor = screen.getByTestId('code-editor');
        expect(editor).toHaveAttribute('data-language', 'typescript');

        fireEvent.change(screen.getByTestId('code-editor-input'), {
            target: { value: 'const y = 2;' },
        });

        expect(updateTabContent).toHaveBeenCalledWith('const y = 2;');
    });

    it('renders the image preview in the main area for image tabs', () => {
        render(
            <WorkspaceEditor
                {...createMockProps({
                    activeTab: createMockTab({
                        type: 'image',
                        name: 'preview.png',
                        content: 'data:image/png;base64,image',
                    }),
                })}
            />
        );

        const image = screen.getByRole('img');
        expect(image).toHaveAttribute('src', 'data:image/png;base64,image');
        expect(image).toHaveAttribute('alt', 'preview.png');
    });

    it('renders the empty state when there is no active tab', () => {
        render(<WorkspaceEditor {...createMockProps()} />);

        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    it('registers and cleans up the beforeunload guard for unsaved changes', () => {
        const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
        const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

        const { unmount } = render(
            <WorkspaceEditor
                {...createMockProps({
                    activeTab: createMockTab({
                        content: 'const changed = true;',
                        savedContent: 'const x = 1;',
                    }),
                })}
            />
        );

        expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

        unmount();

        expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    });

    it('renders bug scan output in the report panel', () => {
        render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

        fireEvent.click(screen.getByText('AI Bug Scan'));

        expect(mockRunBugDetectionAnalysis).toHaveBeenCalledWith('const x = 1;');
        expect(screen.getByText(/classification: safe/)).toBeInTheDocument();
        expect(screen.getByText(/confidence: 0.75/)).toBeInTheDocument();
    });

    // REF-005: Clipboard-backed snippet import/export tests
    describe('clipboard snippet flows', () => {
        const mockWriteText = vi.fn().mockResolvedValue(undefined);
        const mockReadText = vi.fn().mockResolvedValue({ success: true, text: '' });

        beforeEach(() => {
            Object.defineProperty(window, 'electron', {
                value: {
                    clipboard: {
                        writeText: mockWriteText,
                        readText: mockReadText,
                    },
                    runCommand: vi.fn(),
                    files: { writeFile: vi.fn() },
                },
                configurable: true,
                writable: true,
            });
        });

        it('exports snippets to clipboard as JSON', async () => {
            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

            fireEvent.click(screen.getByText('projectDashboard.editor.exportSnippets'));

            await vi.waitFor(() => {
                expect(mockWriteText).toHaveBeenCalledWith(
                    expect.stringContaining('"name"')
                );
                expect(screen.getByText('projectDashboard.editor.snippetExported')).toBeInTheDocument();
            });
        });

        it('imports snippets from clipboard JSON and persists them', async () => {
            const importedSnippet = [{
                id: 'imported-1',
                name: 'Imported',
                language: 'javascript',
                projectKey: 'other',
                content: 'const imported = true;',
                createdAt: 1,
            }];
            mockReadText.mockResolvedValueOnce({ success: true, text: JSON.stringify(importedSnippet) });

            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

            fireEvent.click(screen.getByText('projectDashboard.editor.importSnippets'));

            await vi.waitFor(() => {
                expect(mockSaveProjectSnippets).toHaveBeenCalled();
            });
            expect(screen.getByText('projectDashboard.editor.snippetImported')).toBeInTheDocument();
        });

        it('shows error when importing invalid clipboard content', async () => {
            mockReadText.mockResolvedValueOnce({ success: true, text: 'not-json' });

            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

            fireEvent.click(screen.getByText('projectDashboard.editor.importSnippets'));

            await vi.waitFor(() => {
                expect(screen.getByText('projectDashboard.editor.snippetImportFailed')).toBeInTheDocument();
            });
        });

        it('shows error when clipboard read fails on import', async () => {
            mockReadText.mockResolvedValueOnce({ success: false, text: '' });

            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

            fireEvent.click(screen.getByText('projectDashboard.editor.importSnippets'));

            await vi.waitFor(() => {
                expect(screen.getByText('projectDashboard.editor.snippetImportFailed')).toBeInTheDocument();
            });
        });

        it('shares selected snippet as share code to clipboard', async () => {
            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

            // Select the snippet first
            fireEvent.change(screen.getByRole('combobox'), { target: { value: 'snippet-1' } });
            fireEvent.click(screen.getByText('projectDashboard.editor.shareSnippet'));

            await vi.waitFor(() => {
                expect(mockCreateShareCode).toHaveBeenCalled();
                expect(mockWriteText).toHaveBeenCalledWith('share-code');
                expect(screen.getByText('projectDashboard.editor.snippetShareCodeCopied')).toBeInTheDocument();
            });
        });

        it('imports a snippet from share code on clipboard', async () => {
            const parsedSnippet = {
                id: 'parsed-1',
                name: 'Shared',
                language: 'typescript',
                projectKey: 'global',
                content: 'shared code',
                createdAt: Date.now(),
            };
            mockReadText.mockResolvedValueOnce({ success: true, text: 'valid-share-code' });
            mockParseShareCode.mockReturnValueOnce(parsedSnippet);

            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

            fireEvent.click(screen.getByText('projectDashboard.editor.importShareCode'));

            await vi.waitFor(() => {
                expect(mockParseShareCode).toHaveBeenCalledWith('valid-share-code');
                expect(mockSaveProjectSnippets).toHaveBeenCalled();
            });
            expect(screen.getByText('projectDashboard.editor.snippetImported')).toBeInTheDocument();
        });

        it('shows error when share code is invalid', async () => {
            mockReadText.mockResolvedValueOnce({ success: true, text: 'invalid-code' });
            mockParseShareCode.mockReturnValueOnce(null);

            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

            fireEvent.click(screen.getByText('projectDashboard.editor.importShareCode'));

            await vi.waitFor(() => {
                expect(screen.getByText('projectDashboard.editor.snippetImportFailed')).toBeInTheDocument();
            });
        });
    });

    // REF-006: Scratchpad command and file-save tests
    describe('scratchpad actions', () => {
        const mockRunCommand = vi.fn().mockResolvedValue({ stdout: 'output', stderr: '' });
        const mockWriteFile = vi.fn().mockResolvedValue(undefined);

        beforeEach(() => {
            Object.defineProperty(window, 'electron', {
                value: {
                    clipboard: {
                        writeText: vi.fn(),
                        readText: vi.fn().mockResolvedValue({ success: false, text: '' }),
                    },
                    runCommand: mockRunCommand,
                    files: { writeFile: mockWriteFile },
                },
                configurable: true,
                writable: true,
            });
        });

        it('runs a scratchpad command and displays output', async () => {
            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

            const textareas = screen.getAllByRole('textbox');
            const scratchTextarea = textareas.find(el => el.tagName === 'TEXTAREA' && el.classList.contains('min-h-[70px]'));
            expect(scratchTextarea).toBeDefined();
            fireEvent.change(scratchTextarea!, { target: { value: 'echo hello' } });
            fireEvent.click(screen.getByText('projectDashboard.editor.runScratch'));

            await vi.waitFor(() => {
                expect(mockRunCommand).toHaveBeenCalledWith('echo', ['hello'], 'C:\\workspace');
            });
        });

        it('saves scratchpad content as a doc file', async () => {
            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

            const textareas = screen.getAllByRole('textbox');
            const scratchTextarea = textareas.find(el => el.tagName === 'TEXTAREA' && el.classList.contains('min-h-[70px]'));
            fireEvent.change(scratchTextarea!, { target: { value: 'My documentation notes' } });
            fireEvent.click(screen.getByText('projectDashboard.editor.saveScratchDoc'));

            await vi.waitFor(() => {
                expect(mockWriteFile).toHaveBeenCalledWith(
                    expect.stringContaining('docs'),
                    'My documentation notes'
                );
            });
        });

        it('saves scratchpad content as a task file', async () => {
            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

            const textareas = screen.getAllByRole('textbox');
            const scratchTextarea = textareas.find(el => el.tagName === 'TEXTAREA' && el.classList.contains('min-h-[70px]'));
            fireEvent.change(scratchTextarea!, { target: { value: 'Task description' } });
            fireEvent.click(screen.getByText('projectDashboard.editor.saveScratchTask'));

            await vi.waitFor(() => {
                expect(mockWriteFile).toHaveBeenCalledWith(
                    expect.stringContaining('tasks'),
                    'Task description'
                );
            });
        });

        it('does not run scratch command when scratchpad is empty', async () => {
            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

            fireEvent.click(screen.getByText('projectDashboard.editor.runScratch'));

            await vi.waitFor(() => {
                expect(mockRunCommand).not.toHaveBeenCalled();
            });
        });
    });
});
