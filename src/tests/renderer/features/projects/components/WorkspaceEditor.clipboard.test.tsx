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
    mockSaveProjectSnippets,
} = vi.hoisted(() => ({
    mockCreateShareCode: vi.fn(() => 'share-code'),
    mockFilterSnippets: vi.fn((snippets: ProjectSnippet[]) => snippets),
    mockLoadProjectSnippets: vi.fn((): ProjectSnippet[] => [
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
    mockSaveProjectSnippets: vi.fn(),
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
    runBugDetectionAnalysis: vi.fn(() => ({
        classification: 'safe',
        confidenceScore: 0.75,
        fixSuggestions: [],
        regressionSuggestions: [],
    })),
    runCodeReviewAnalysis: vi.fn(async () => ({ reviewComments: [] })),
    runPerformanceSuggestionAnalysis: vi.fn(() => ({
        profilingNotes: [], databaseNotes: [], bundleNotes: [],
        cachingNotes: [], lazyLoadingNotes: [], performanceBudgets: [],
        buildTimeNotes: [], runtimeMonitoringNotes: [],
    })),
    saveReviewRuleConfig: vi.fn(),
}));

vi.mock('@/features/projects/utils/snippet-manager', () => ({
    createShareCode: mockCreateShareCode,
    filterSnippets: mockFilterSnippets,
    loadProjectSnippets: mockLoadProjectSnippets,
    parseShareCode: mockParseShareCode,
    saveProjectSnippets: mockSaveProjectSnippets,
}));

vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/lib/utils', () => ({
    cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/utils/language-map', () => ({
    getLanguageFromExtension: (filename: string) => {
        const ext = filename.split('.').pop() ?? '';
        const map: Record<string, string> = { ts: 'typescript', js: 'javascript' };
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

describe('WorkspaceEditor clipboard snippet import/export', () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    const mockReadText = vi.fn().mockResolvedValue({ success: true, text: '' });

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        Object.defineProperty(window, 'electron', {
            value: {
                clipboard: { writeText: mockWriteText, readText: mockReadText },
                runCommand: vi.fn(),
                files: { writeFile: vi.fn() },
                code: { previewRenameSymbol: vi.fn() },
            },
            configurable: true,
            writable: true,
        });
    });

    describe('export snippets to clipboard', () => {
        it('copies all filtered snippets as JSON to clipboard', async () => {
            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

            fireEvent.click(screen.getByText('projectDashboard.editor.exportSnippets'));

            await vi.waitFor(() => {
                expect(mockWriteText).toHaveBeenCalledTimes(1);
                const payload = mockWriteText.mock.calls[0][0] as string;
                const parsed = JSON.parse(payload) as ProjectSnippet[];
                expect(Array.isArray(parsed)).toBe(true);
                expect(parsed[0].name).toBe('Reusable snippet');
                expect(screen.getByText('projectDashboard.editor.snippetExported')).toBeInTheDocument();
            });
        });

        it('exports empty array when no snippets exist', async () => {
            mockLoadProjectSnippets.mockReturnValueOnce([]);
            mockFilterSnippets.mockReturnValueOnce([]);

            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

            fireEvent.click(screen.getByText('projectDashboard.editor.exportSnippets'));

            await vi.waitFor(() => {
                expect(mockWriteText).toHaveBeenCalledTimes(1);
                const payload = mockWriteText.mock.calls[0][0] as string;
                expect(JSON.parse(payload)).toEqual([]);
            });
        });
    });

    describe('import snippets from clipboard', () => {
        it('imports valid snippet array from clipboard and persists', async () => {
            const importedSnippets: ProjectSnippet[] = [
                { id: 'imp-1', name: 'Imported', language: 'javascript', projectKey: 'other', content: 'let a = 1;', createdAt: 1 },
                { id: 'imp-2', name: 'Imported2', language: 'typescript', projectKey: 'global', content: 'let b = 2;', createdAt: 2 },
            ];
            mockReadText.mockResolvedValueOnce({ success: true, text: JSON.stringify(importedSnippets) });

            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);
            fireEvent.click(screen.getByText('projectDashboard.editor.importSnippets'));

            await vi.waitFor(() => {
                expect(mockSaveProjectSnippets).toHaveBeenCalledTimes(1);
                const saved = mockSaveProjectSnippets.mock.calls[0][0] as ProjectSnippet[];
                expect(saved.length).toBeGreaterThanOrEqual(2);
            });
            expect(screen.getByText('projectDashboard.editor.snippetImported')).toBeInTheDocument();
        });

        it('fails gracefully when clipboard is empty', async () => {
            mockReadText.mockResolvedValueOnce({ success: true, text: '' });

            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);
            fireEvent.click(screen.getByText('projectDashboard.editor.importSnippets'));

            await vi.waitFor(() => {
                expect(screen.getByText('projectDashboard.editor.snippetImportFailed')).toBeInTheDocument();
            });
            expect(mockSaveProjectSnippets).not.toHaveBeenCalled();
        });

        it('fails gracefully when clipboard read returns failure', async () => {
            mockReadText.mockResolvedValueOnce({ success: false, text: '' });

            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);
            fireEvent.click(screen.getByText('projectDashboard.editor.importSnippets'));

            await vi.waitFor(() => {
                expect(screen.getByText('projectDashboard.editor.snippetImportFailed')).toBeInTheDocument();
            });
        });

        it('fails gracefully when clipboard contains invalid JSON', async () => {
            mockReadText.mockResolvedValueOnce({ success: true, text: '{not valid json' });

            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);
            fireEvent.click(screen.getByText('projectDashboard.editor.importSnippets'));

            await vi.waitFor(() => {
                expect(screen.getByText('projectDashboard.editor.snippetImportFailed')).toBeInTheDocument();
            });
        });

        it('fails when clipboard JSON is not an array', async () => {
            mockReadText.mockResolvedValueOnce({ success: true, text: '{"name":"not-array"}' });

            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);
            fireEvent.click(screen.getByText('projectDashboard.editor.importSnippets'));

            await vi.waitFor(() => {
                expect(screen.getByText('projectDashboard.editor.snippetImportFailed')).toBeInTheDocument();
            });
        });

        it('filters out snippets with missing name or content fields', async () => {
            const mixedSnippets = [
                { id: '1', name: 'Valid', content: 'code', language: 'ts', projectKey: 'g', createdAt: 1 },
                { id: '2', name: 123, content: 'code' },
                { id: '3', name: 'NoContent' },
            ];
            mockReadText.mockResolvedValueOnce({ success: true, text: JSON.stringify(mixedSnippets) });

            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);
            fireEvent.click(screen.getByText('projectDashboard.editor.importSnippets'));

            await vi.waitFor(() => {
                expect(mockSaveProjectSnippets).toHaveBeenCalledTimes(1);
                const saved = mockSaveProjectSnippets.mock.calls[0][0] as ProjectSnippet[];
                const imported = saved.filter(s => s.name === 'Valid');
                expect(imported).toHaveLength(1);
            });
        });

        it('handles large content in clipboard without error', async () => {
            const largeContent = 'x'.repeat(100_000);
            const largeSnippets: ProjectSnippet[] = [
                { id: 'large-1', name: 'Large', language: 'typescript', projectKey: 'g', content: largeContent, createdAt: 1 },
            ];
            mockReadText.mockResolvedValueOnce({ success: true, text: JSON.stringify(largeSnippets) });

            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);
            fireEvent.click(screen.getByText('projectDashboard.editor.importSnippets'));

            await vi.waitFor(() => {
                expect(mockSaveProjectSnippets).toHaveBeenCalledTimes(1);
                const saved = mockSaveProjectSnippets.mock.calls[0][0] as ProjectSnippet[];
                const largeSaved = saved.find(s => s.name === 'Large');
                expect(largeSaved?.content).toBe(largeContent);
            });
        });
    });

    describe('share code clipboard flows', () => {
        it('copies share code for selected snippet to clipboard', async () => {
            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

            fireEvent.change(screen.getByRole('combobox'), { target: { value: 'snippet-1' } });
            fireEvent.click(screen.getByText('projectDashboard.editor.shareSnippet'));

            await vi.waitFor(() => {
                expect(mockCreateShareCode).toHaveBeenCalled();
                expect(mockWriteText).toHaveBeenCalledWith('share-code');
                expect(screen.getByText('projectDashboard.editor.snippetShareCodeCopied')).toBeInTheDocument();
            });
        });

        it('does nothing when no snippet is selected for share', async () => {
            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

            fireEvent.click(screen.getByText('projectDashboard.editor.shareSnippet'));

            await vi.waitFor(() => {
                expect(mockWriteText).not.toHaveBeenCalled();
            });
        });

        it('imports valid share code from clipboard', async () => {
            const parsed: ProjectSnippet = {
                id: 'shared-1', name: 'Shared', language: 'typescript',
                projectKey: 'global', content: 'shared()', createdAt: Date.now(),
            };
            mockReadText.mockResolvedValueOnce({ success: true, text: 'TENGRA:abc123' });
            mockParseShareCode.mockReturnValueOnce(parsed);

            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);
            fireEvent.click(screen.getByText('projectDashboard.editor.importShareCode'));

            await vi.waitFor(() => {
                expect(mockParseShareCode).toHaveBeenCalledWith('TENGRA:abc123');
                expect(mockSaveProjectSnippets).toHaveBeenCalled();
            });
            expect(screen.getByText('projectDashboard.editor.snippetImported')).toBeInTheDocument();
        });

        it('shows error when share code parse returns null', async () => {
            mockReadText.mockResolvedValueOnce({ success: true, text: 'invalid-share' });
            mockParseShareCode.mockReturnValueOnce(null);

            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);
            fireEvent.click(screen.getByText('projectDashboard.editor.importShareCode'));

            await vi.waitFor(() => {
                expect(screen.getByText('projectDashboard.editor.snippetImportFailed')).toBeInTheDocument();
            });
        });

        it('shows error when clipboard read fails for share code import', async () => {
            mockReadText.mockResolvedValueOnce({ success: false, text: '' });

            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);
            fireEvent.click(screen.getByText('projectDashboard.editor.importShareCode'));

            await vi.waitFor(() => {
                expect(screen.getByText('projectDashboard.editor.snippetImportFailed')).toBeInTheDocument();
            });
        });

        it('shows error when clipboard is empty for share code import', async () => {
            mockReadText.mockResolvedValueOnce({ success: true, text: '' });

            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);
            fireEvent.click(screen.getByText('projectDashboard.editor.importShareCode'));

            await vi.waitFor(() => {
                expect(screen.getByText('projectDashboard.editor.snippetImportFailed')).toBeInTheDocument();
            });
        });
    });
});
