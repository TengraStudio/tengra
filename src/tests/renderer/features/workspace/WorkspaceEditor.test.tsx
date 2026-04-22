/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceEditor, WorkspaceEditorProps } from '@/features/workspace/components/workspace/WorkspaceEditor';
import type { WorkspaceSnippet } from '@/features/workspace/utils/snippet-manager';
import { EditorTab } from '@/types';

const {
    mockCreateWorkspaceShareCode,
    mockFilterWorkspaceSnippets,
    mockLoadWorkspaceSnippets,
    mockLoadReviewRuleConfig,
    mockParseWorkspaceShareCode,
    mockRunBugDetectionAnalysis,
    mockRunCodeReviewAnalysis,
    mockRunPerformanceSuggestionAnalysis,
    mockSaveWorkspaceSnippets,
    mockSaveReviewRuleConfig,
} = vi.hoisted(() => ({
    mockCreateWorkspaceShareCode: vi.fn(() => 'share-code'),
    mockFilterWorkspaceSnippets: vi.fn((snippets: WorkspaceSnippet[]) => snippets),
    mockLoadWorkspaceSnippets: vi.fn(() => [
        {
            id: 'snippet-1',
            name: 'Reusable snippet',
            language: 'typescript',
            workspaceKey: 'test-workspace',
            content: 'const snippet = true;',
            createdAt: 1,
        },
    ]),
    mockLoadReviewRuleConfig: vi.fn(() => ({
        detectConsoleLog: true,
        detectAnyType: true,
        detectUnsafeEval: false,
    })),
    mockParseWorkspaceShareCode: vi.fn((): WorkspaceSnippet | null => null),
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
    mockSaveWorkspaceSnippets: vi.fn(),
    mockSaveReviewRuleConfig: vi.fn(),
}));

vi.mock('@/components/ui/CodeEditor', () => ({
    CodeEditor: ({
        value,
        language,
        onChange,
        initialPosition,
        initialScrollTop,
        onCursorPositionChange,
        onScrollPositionChange,
        onNavigateToLocation,
        onShowWorkspaceResults,
    }: {
        value: string;
        language: string;
        onChange: (value?: string) => void;
        initialPosition?: { lineNumber: number; column: number } | null;
        initialScrollTop?: number | null;
        onCursorPositionChange?: (position: { lineNumber: number; column: number }) => void;
        onScrollPositionChange?: (scrollTop: number) => void;
        onNavigateToLocation?: (target: { filePath: string; lineNumber: number }) => void;
        onShowWorkspaceResults?: (payload: {
            symbol: string;
            results: Array<{ file: string; line: number; text: string; type?: string }>;
        }) => void;
    }) => (
        <div
            data-testid="code-editor"
            data-language={language}
            data-initial-line={initialPosition?.lineNumber ?? ''}
            data-initial-column={initialPosition?.column ?? ''}
            data-initial-scroll-top={initialScrollTop ?? ''}
        >
            <textarea
                aria-label="code-editor-input"
                data-testid="code-editor-input"
                value={value}
                onChange={event => onChange(event.target.value)}
            />
            <button
                type="button"
                onClick={() => onCursorPositionChange?.({ lineNumber: 8, column: 3 })}
            >
                trigger-cursor-change
            </button>
            <button
                type="button"
                onClick={() => onScrollPositionChange?.(240)}
            >
                trigger-scroll-change
            </button>
            <button
                type="button"
                onClick={() =>
                    onNavigateToLocation?.({
                        filePath: 'C:\\workspace\\related.ts',
                        lineNumber: 27,
                    })}
            >
                trigger-open-location
            </button>
            <button
                type="button"
                onClick={() =>
                    onShowWorkspaceResults?.({
                        symbol: 'Widget',
                        results: [
                            {
                                file: 'C:\\workspace\\related.ts',
                                line: 27,
                                text: 'const widget = new Widget();',
                                type: 'content',
                            },
                        ],
                    })}
            >
                trigger-workspace-results
            </button>
        </div>
    ),
}));

vi.mock('@/features/workspace/utils/dev-ai-assistant', () => ({
    loadReviewRuleConfig: mockLoadReviewRuleConfig,
    runBugDetectionAnalysis: mockRunBugDetectionAnalysis,
    runCodeReviewAnalysis: mockRunCodeReviewAnalysis,
    runPerformanceSuggestionAnalysis: mockRunPerformanceSuggestionAnalysis,
    saveReviewRuleConfig: mockSaveReviewRuleConfig,
}));

vi.mock('@/features/workspace/utils/snippet-manager', () => ({
    createWorkspaceShareCode: mockCreateWorkspaceShareCode,
    filterWorkspaceSnippets: mockFilterWorkspaceSnippets,
    loadWorkspaceSnippets: mockLoadWorkspaceSnippets,
    parseWorkspaceShareCode: mockParseWorkspaceShareCode,
    saveWorkspaceSnippets: mockSaveWorkspaceSnippets,
    createShareCode: mockCreateWorkspaceShareCode,
    filterSnippets: mockFilterWorkspaceSnippets,
    parseShareCode: mockParseWorkspaceShareCode,
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
        saveActiveTab: vi.fn().mockResolvedValue(undefined),
        workspaceKey: 'test-workspace',
        workspacePath: 'C:\\workspace',
        emptyState: <div data-testid="empty-state">empty-state</div>,
        ...overrides,
    };
}

async function clickAndFlush(label: string): Promise<void> {
    await act(async () => {
        fireEvent.click(screen.getByText(label));
        await Promise.resolve();
    });
}

describe('WorkspaceEditor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('auto-saves dirty code tabs when workspace auto-save is enabled', async () => {
        vi.useFakeTimers();
        const saveActiveTab = vi.fn().mockResolvedValue(undefined);

        render(
            <WorkspaceEditor
                {...createMockProps({
                    activeTab: createMockTab({
                        content: 'const x = 2;',
                        savedContent: 'const x = 1;',
                    }),
                    autoSaveEnabled: true,
                    saveActiveTab,
                })}
            />
        );

        await act(async () => {
            vi.advanceTimersByTime(701);
            await Promise.resolve();
        });

        expect(saveActiveTab).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });

    it('renders action controls for snippet and AI workflows', () => {
        render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

        expect(screen.getByRole('combobox')).toBeInTheDocument();
        expect(screen.getByText('workspaceDashboard.editor.insertSnippet')).toBeInTheDocument();
        expect(screen.getByText('workspaceDashboard.editor.saveSnippet')).toBeInTheDocument();
        expect(screen.getByText('workspaceDashboard.editor.aiReview')).toBeInTheDocument();
        expect(screen.getByText('workspaceDashboard.editor.aiBugScan')).toBeInTheDocument();
        expect(screen.getByText('workspaceDashboard.editor.aiPerf')).toBeInTheDocument();
    });

    it('saves the current file as a snippet from the action controls', () => {
        render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

        fireEvent.click(screen.getByText('workspaceDashboard.editor.saveSnippet'));

        expect(mockSaveWorkspaceSnippets).toHaveBeenCalledTimes(1);
        expect(mockSaveWorkspaceSnippets).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'file.ts',
                    content: 'const x = 1;',
                    language: 'typescript',
                    workspaceKey: 'test-workspace',
                }),
            ])
        );
        expect(screen.getByText('workspaceDashboard.editor.snippetSaved')).toBeInTheDocument();
    });

    it('inserts the selected snippet into the active tab', () => {
        const updateTabContent = vi.fn();
        render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab(), updateTabContent })} />);

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'snippet-1' } });
        fireEvent.click(screen.getByText('workspaceDashboard.editor.insertSnippet'));

        expect(updateTabContent).toHaveBeenCalledWith('const x = 1;\nconst snippet = true;');
        expect(screen.getByText('workspaceDashboard.editor.snippetInserted')).toBeInTheDocument();
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

    it('restores persisted editor cursor and scroll state for the active file', () => {
        localStorage.setItem(
            'workspace.editor.viewstate:test-workspace',
            JSON.stringify({
                'C:\\workspace\\file.ts': {
                    lineNumber: 14,
                    column: 6,
                    scrollTop: 320,
                },
            })
        );

        render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

        const editor = screen.getByTestId('code-editor');
        expect(editor).toHaveAttribute('data-initial-line', '14');
        expect(editor).toHaveAttribute('data-initial-column', '6');
        expect(editor).toHaveAttribute('data-initial-scroll-top', '320');
    });

    it('persists editor cursor and scroll state per workspace file', () => {
        vi.useFakeTimers();
        try {
            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

            fireEvent.click(screen.getByText('trigger-cursor-change'));
            fireEvent.click(screen.getByText('trigger-scroll-change'));
            act(() => {
                vi.runAllTimers();
            });

            const persistedState = JSON.parse(
                localStorage.getItem('workspace.editor.viewstate:test-workspace') ?? '{}'
            ) as Record<string, { lineNumber: number; column: number; scrollTop: number }>;

            expect(persistedState['C:\\workspace\\file.ts']).toMatchObject({
                lineNumber: 8,
                column: 3,
                scrollTop: 240,
            });
        } finally {
            vi.useRealTimers();
        }
    });

    it('opens resolved editor navigation targets through the workspace shell callback', () => {
        const onOpenFile = vi.fn();

        render(
            <WorkspaceEditor
                {...createMockProps({
                    activeTab: createMockTab(),
                    onOpenFile,
                })}
            />
        );

        fireEvent.click(screen.getByText('trigger-open-location'));

        expect(onOpenFile).toHaveBeenCalledWith('C:\\workspace\\related.ts', 27);
    });

    it('renders workspace intelligence results and opens the selected result', () => {
        const onOpenFile = vi.fn();

        render(
            <WorkspaceEditor
                {...createMockProps({
                    activeTab: createMockTab(),
                    onOpenFile,
                })}
            />
        );

        fireEvent.click(screen.getByText('trigger-workspace-results'));
        fireEvent.click(screen.getByText('related.ts'));

        expect(onOpenFile).toHaveBeenCalledWith('C:\\workspace\\related.ts', 27);
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

        fireEvent.click(screen.getByText('workspaceDashboard.editor.aiBugScan'));

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

            await clickAndFlush('workspaceDashboard.editor.exportSnippets');

            await vi.waitFor(() => {
                expect(mockWriteText).toHaveBeenCalledWith(
                    expect.stringContaining('"name"')
                );
                expect(screen.getByText('workspaceDashboard.editor.snippetExported')).toBeInTheDocument();
            });
        });

        it('imports snippets from clipboard JSON and persists them', async () => {
            const importedSnippet = [{
                id: 'imported-1',
                name: 'Imported',
                language: 'javascript',
                workspaceKey: 'other',
                content: 'const imported = true;',
                createdAt: 1,
            }];
            mockReadText.mockResolvedValueOnce({ success: true, text: JSON.stringify(importedSnippet) });

            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

            await clickAndFlush('workspaceDashboard.editor.importSnippets');

            await vi.waitFor(() => {
                expect(mockSaveWorkspaceSnippets).toHaveBeenCalled();
            });
            expect(screen.getByText('workspaceDashboard.editor.snippetImported')).toBeInTheDocument();
        });

        it('shows error when importing invalid clipboard content', async () => {
            mockReadText.mockResolvedValueOnce({ success: true, text: 'not-json' });

            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

            await clickAndFlush('workspaceDashboard.editor.importSnippets');

            await vi.waitFor(() => {
                expect(screen.getByText('workspaceDashboard.editor.snippetImportFailed')).toBeInTheDocument();
            });
        });

        it('shows error when clipboard read fails on import', async () => {
            mockReadText.mockResolvedValueOnce({ success: false, text: '' });

            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

            await clickAndFlush('workspaceDashboard.editor.importSnippets');

            await vi.waitFor(() => {
                expect(screen.getByText('workspaceDashboard.editor.snippetImportFailed')).toBeInTheDocument();
            });
        });

        it('shares selected snippet as share code to clipboard', async () => {
            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

            // Select the snippet first
            fireEvent.change(screen.getByRole('combobox'), { target: { value: 'snippet-1' } });
            await clickAndFlush('workspaceDashboard.editor.shareSnippet');

            await vi.waitFor(() => {
                expect(mockCreateWorkspaceShareCode).toHaveBeenCalled();
                expect(mockWriteText).toHaveBeenCalledWith('share-code');
                expect(screen.getByText('workspaceDashboard.editor.snippetShareCodeCopied')).toBeInTheDocument();
            });
        });

        it('imports a snippet from share code on clipboard', async () => {
            const parsedSnippet = {
                id: 'parsed-1',
                name: 'Shared',
                language: 'typescript',
                workspaceKey: 'global',
                content: 'shared code',
                createdAt: Date.now(),
            };
            mockReadText.mockResolvedValueOnce({ success: true, text: 'valid-share-code' });
            mockParseWorkspaceShareCode.mockReturnValueOnce(parsedSnippet);

            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

            await clickAndFlush('workspaceDashboard.editor.importShareCode');

            await vi.waitFor(() => {
                expect(mockParseWorkspaceShareCode).toHaveBeenCalledWith('valid-share-code');
                expect(mockSaveWorkspaceSnippets).toHaveBeenCalled();
            });
            expect(screen.getByText('workspaceDashboard.editor.snippetImported')).toBeInTheDocument();
        });

        it('shows error when share code is invalid', async () => {
            mockReadText.mockResolvedValueOnce({ success: true, text: 'invalid-code' });
            mockParseWorkspaceShareCode.mockReturnValueOnce(null);

            render(<WorkspaceEditor {...createMockProps({ activeTab: createMockTab() })} />);

            await clickAndFlush('workspaceDashboard.editor.importShareCode');

            await vi.waitFor(() => {
                expect(screen.getByText('workspaceDashboard.editor.snippetImportFailed')).toBeInTheDocument();
            });
        });
    }); 
});
