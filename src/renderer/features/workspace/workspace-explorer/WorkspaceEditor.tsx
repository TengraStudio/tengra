import type { FileSearchResult } from '@shared/types/common';
import { X } from 'lucide-react';
import * as React from 'react';
import {
    useCallback,
    useEffect,
    useReducer,
    useRef,
    useState,
} from 'react';

import { CodeEditor } from '@/components/ui/CodeEditor';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { EditorTab, Workspace } from '@/types';
import { getLanguageFromExtension } from '@/utils/language-map';

import { useEditorAIReview } from './useEditorAIReview';
import { useEditorMacros } from './useEditorMacros';


export interface WorkspaceEditorProps {
    activeTab: EditorTab | null;
    updateTabContent: (value: string) => void;
    saveActiveTab?: (options?: { silent?: boolean }) => Promise<void>;
    autoSaveEnabled?: boolean;
    workspaceKey?: string;
    workspacePath?: string;
    workspaceEditorSettings?: Workspace['editor'];
    emptyState: React.ReactNode;
    onOpenFile?: (path: string, line?: number) => void;
}

interface EditorViewState {
    lineNumber: number;
    column: number;
    scrollTop: number;
}

const MAX_EDITOR_VIEW_STATE_ENTRIES = 40;
const VIEW_STATE_SCROLL_PERSIST_DELAY_MS = 120;
const AUTO_SAVE_DELAY_MS = 700;

/* ------------------------------------------------------------------ */
/*  Workspace tools reducer – groups rename, scratch, test, settings  */
/* ------------------------------------------------------------------ */

interface WorkspaceToolsState {
    enableInlayHints: boolean;
    enableCodeLens: boolean;
    performanceOverride: boolean;
    semanticPreview: string;
    renameFrom: string;
    renameTo: string;
    excludePattern: string;
    renameImpact: string;
    testOutput: string;
    diagnosticLines: string[];
    scratchNote: string;
    scratchName: string;
}

type WorkspaceToolsAction =
    | { type: 'SET_INLAY_HINTS'; value: boolean }
    | { type: 'SET_CODE_LENS'; value: boolean }
    | { type: 'SET_PERF_OVERRIDE'; value: boolean }
    | { type: 'SET_SEMANTIC_PREVIEW'; value: string }
    | { type: 'SET_RENAME_FROM'; value: string }
    | { type: 'SET_RENAME_TO'; value: string }
    | { type: 'SET_EXCLUDE_PATTERN'; value: string }
    | { type: 'SET_RENAME_IMPACT'; value: string }
    | { type: 'SET_TEST_RESULTS'; output: string; lines: string[] }
    | { type: 'SET_SCRATCH_NOTE'; value: string }
    | { type: 'SET_SCRATCH_NAME'; value: string };

function workspaceToolsReducer(state: WorkspaceToolsState, action: WorkspaceToolsAction): WorkspaceToolsState {
    switch (action.type) {
        case 'SET_INLAY_HINTS': return { ...state, enableInlayHints: action.value };
        case 'SET_CODE_LENS': return { ...state, enableCodeLens: action.value };
        case 'SET_PERF_OVERRIDE': return { ...state, performanceOverride: action.value };
        case 'SET_SEMANTIC_PREVIEW': return { ...state, semanticPreview: action.value };
        case 'SET_RENAME_FROM': return { ...state, renameFrom: action.value };
        case 'SET_RENAME_TO': return { ...state, renameTo: action.value };
        case 'SET_EXCLUDE_PATTERN': return { ...state, excludePattern: action.value };
        case 'SET_RENAME_IMPACT': return { ...state, renameImpact: action.value };
        case 'SET_TEST_RESULTS': return { ...state, testOutput: action.output, diagnosticLines: action.lines };
        case 'SET_SCRATCH_NOTE': return { ...state, scratchNote: action.value };
        case 'SET_SCRATCH_NAME': return { ...state, scratchName: action.value };
    }
}

const WORKSPACE_TOOLS_INITIAL: WorkspaceToolsState = {
    enableInlayHints: true,
    enableCodeLens: true,
    performanceOverride: false,
    semanticPreview: '',
    renameFrom: '',
    renameTo: '',
    excludePattern: 'dist|build|generated',
    renameImpact: '',
    testOutput: '',
    diagnosticLines: [],
    scratchNote: '',
    scratchName: 'scratch-note',
};

/* ------------------------------------------------------------------ */
/*  Small utility hooks                                                */
/* ------------------------------------------------------------------ */

/** Warns the user before closing the window when there are unsaved changes. */
function useUnsavedChangesGuard(hasUnsavedChanges: boolean): void {
    useEffect(() => {
        if (!hasUnsavedChanges) {
            return undefined;
        }
        const handler = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => { window.removeEventListener('beforeunload', handler); };
    }, [hasUnsavedChanges]);
}

/** Persists and restores per-file view state from localStorage. */
function sanitizeViewStateEntry(value: RendererDataValue): EditorViewState | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    const entry = value as Record<string, RendererDataValue>;

    const lineNumber =
        typeof entry.lineNumber === 'number' && Number.isFinite(entry.lineNumber)
            ? Math.max(1, Math.floor(entry.lineNumber))
            : 1;
    const column =
        typeof entry.column === 'number' && Number.isFinite(entry.column)
            ? Math.max(1, Math.floor(entry.column))
            : 1;
    const scrollTop =
        typeof entry.scrollTop === 'number' && Number.isFinite(entry.scrollTop)
            ? Math.max(0, Math.floor(entry.scrollTop))
            : 0;

    return {
        lineNumber,
        column,
        scrollTop,
    };
}

function sanitizeViewStateMap(raw: string | null): Record<string, EditorViewState> {
    if (!raw) {
        return {};
    }

    try {
        const parsed = JSON.parse(raw) as Record<string, RendererDataValue>;
        const nextState: Record<string, EditorViewState> = {};
        for (const [filePath, value] of Object.entries(parsed)) {
            const normalizedPath = filePath.trim();
            const entry = sanitizeViewStateEntry(value);
            if (!normalizedPath || !entry) {
                continue;
            }
            nextState[normalizedPath] = entry;
        }
        return nextState;
    } catch {
        return {};
    }
}

function buildNextViewStateMap(
    currentState: Record<string, EditorViewState>,
    filePath: string,
    nextEntry: EditorViewState
): Record<string, EditorViewState> {
    const preservedEntries = Object.entries(currentState)
        .filter(([existingPath]) => existingPath !== filePath)
        .slice(0, MAX_EDITOR_VIEW_STATE_ENTRIES - 1);

    return Object.fromEntries([[filePath, nextEntry], ...preservedEntries]);
}

function useViewStatePersistence(
    storageKey: string
): [
    Record<string, EditorViewState>,
    (filePath: string, patch: Partial<EditorViewState>) => void
] {
    const [viewStateMap, setViewStateMap] = useState<Record<string, EditorViewState>>(() => {
        try {
            return sanitizeViewStateMap(localStorage.getItem(storageKey));
        } catch {
            return {};
        }
    });

    const persistViewState = useCallback(
        (filePath: string, patch: Partial<EditorViewState>) => {
            const normalizedPath = filePath.trim();
            if (!normalizedPath) {
                return;
            }

            setViewStateMap(prevState => {
                const previousEntry = prevState[normalizedPath] ?? {
                    lineNumber: 1,
                    column: 1,
                    scrollTop: 0,
                };
                const nextEntry: EditorViewState = {
                    lineNumber: Math.max(1, Math.floor(patch.lineNumber ?? previousEntry.lineNumber)),
                    column: Math.max(1, Math.floor(patch.column ?? previousEntry.column)),
                    scrollTop: Math.max(0, Math.floor(patch.scrollTop ?? previousEntry.scrollTop)),
                };

                if (
                    previousEntry.lineNumber === nextEntry.lineNumber &&
                    previousEntry.column === nextEntry.column &&
                    previousEntry.scrollTop === nextEntry.scrollTop
                ) {
                    return prevState;
                }

                const nextState = buildNextViewStateMap(prevState, normalizedPath, nextEntry);
                try {
                    localStorage.setItem(storageKey, JSON.stringify(nextState));
                } catch {
                    // Ignore persistence failures in restricted environments.
                }
                return nextState;
            });
        },
        [storageKey]
    );

    return [viewStateMap, persistViewState];
}

function useEditorAutoSave(args: {
    activeTab: EditorTab | null;
    autoSaveEnabled: boolean;
    saveActiveTab?: (options?: { silent?: boolean }) => Promise<void>;
}): void {
    const { activeTab, autoSaveEnabled, saveActiveTab } = args;
    const autoSaveRequestIdRef = useRef(0);

    useEffect(() => {
        if (!autoSaveEnabled || activeTab?.type !== 'code') {
            return undefined;
        }
        if (activeTab.content === activeTab.savedContent) {
            return undefined;
        }

        autoSaveRequestIdRef.current += 1;
        const requestId = autoSaveRequestIdRef.current;
        const timeoutId = window.setTimeout(() => {
            if (requestId !== autoSaveRequestIdRef.current) {
                return;
            }
            if (saveActiveTab) {
                void saveActiveTab({ silent: true });
            }
        }, AUTO_SAVE_DELAY_MS);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [activeTab, autoSaveEnabled, saveActiveTab]);
}

/* ------------------------------------------------------------------ */
/*  Workspace action callbacks (rename, semantic, test, scratch)      */
/* ------------------------------------------------------------------ */

interface WorkspaceActionDeps {
    activeTab: EditorTab | null;
    workspacePath: string | undefined;
    updateTabContent: (value: string) => void;
    dispatch: React.Dispatch<WorkspaceToolsAction>;
    tools: WorkspaceToolsState;
    setStatusMessage: (msg: string) => void;
}

/** Semantic refactoring and rename preview actions. */
function useRefactorActions(deps: WorkspaceActionDeps) {
    const { activeTab, workspacePath, updateTabContent, dispatch, tools, setStatusMessage } = deps;
    const { t } = useTranslation();

    const previewSemanticRefactor = useCallback(() => {
        if (!activeTab) {
            return;
        }
        dispatch({ type: 'SET_SEMANTIC_PREVIEW', value: activeTab.content.replace(/\bvar\b/g, 'const').slice(0, 1200) });
        setStatusMessage(t('workspaceDashboard.editor.semanticPreviewReady'));
    }, [activeTab, dispatch, setStatusMessage, t]);

    const applySemanticRefactor = useCallback(() => {
        if (!activeTab) {
            return;
        }
        updateTabContent(activeTab.content.replace(/\bvar\b/g, 'const'));
        setStatusMessage(t('workspaceDashboard.editor.semanticApplied'));
    }, [activeTab, setStatusMessage, t, updateTabContent]);

    const previewRename = useCallback(async () => {
        if (!workspacePath || !tools.renameFrom || !tools.renameTo) {
            return;
        }
        const preview = await window.electron.code.previewRenameSymbol(workspacePath, tools.renameFrom, tools.renameTo, 200);
        const excluded = preview.updatedFiles.filter(file => new RegExp(tools.excludePattern, 'i').test(file));
        if (excluded.length > 0) {
            dispatch({ type: 'SET_RENAME_IMPACT', value: t('workspaceDashboard.editor.renameBlocked', { count: excluded.length }) });
            return;
        }
        dispatch({ type: 'SET_RENAME_IMPACT', value: t('workspaceDashboard.editor.renameImpact', { files: preview.totalFiles, occurrences: preview.totalOccurrences }) });
    }, [dispatch, workspacePath, tools.excludePattern, tools.renameFrom, tools.renameTo, t]);

    return { previewSemanticRefactor, applySemanticRefactor, previewRename };
}


/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

/**
 * WorkspaceEditor Component
 *
 * Handles the display of the active file:
 * - Image preview for image types
 * - Monaco editor for text/code types
 * - Empty state when no file is open
 */
export const WorkspaceEditor: React.FC<WorkspaceEditorProps> = ({
    activeTab,
    updateTabContent,
    saveActiveTab,
    autoSaveEnabled = false,
    workspaceKey = 'global',
    workspacePath,
    workspaceEditorSettings,
    emptyState,
    onOpenFile,
}) => {
    const { t } = useTranslation();
    const hasUnsavedChanges = Boolean(activeTab && activeTab.content !== activeTab.savedContent);
    const [statusMessage, setStatusMessage] = useState('');
    const [tools, dispatch] = useReducer(workspaceToolsReducer, WORKSPACE_TOOLS_INITIAL);
    const [workspaceResults, setWorkspaceResults] = useState<{
        symbol: string;
        results: FileSearchResult[];
    } | null>(null);

    const [viewStateMap, persistViewState] = useViewStatePersistence(
        `workspace.editor.viewstate:${workspaceKey}`
    );
    const activeViewState = activeTab ? viewStateMap[activeTab.path] : undefined;
    const pendingScrollStateRef = useRef<{ path: string; scrollTop: number } | null>(null);
    const scrollPersistTimeoutRef = useRef<number | null>(null);
    useUnsavedChangesGuard(hasUnsavedChanges);
    useEditorAutoSave({ activeTab, autoSaveEnabled, saveActiveTab });

    const aiReview = useEditorAIReview({ activeTab, workspacePath });
    const macros = useEditorMacros({ updateTabContent, setStatusMessage });
    const actionDeps: WorkspaceActionDeps = { activeTab, workspacePath, updateTabContent, dispatch, tools, setStatusMessage };
    const refactorActions = useRefactorActions(actionDeps); 
    void macros;
    void refactorActions;

    const performanceMode = !tools.performanceOverride && (activeTab?.content.length ?? 0) > 20000;

    const flushPendingScrollState = useCallback(() => {
        if (scrollPersistTimeoutRef.current !== null) {
            window.clearTimeout(scrollPersistTimeoutRef.current);
            scrollPersistTimeoutRef.current = null;
        }

        const pendingState = pendingScrollStateRef.current;
        if (!pendingState) {
            return;
        }

        pendingScrollStateRef.current = null;
        persistViewState(pendingState.path, { scrollTop: pendingState.scrollTop });
    }, [persistViewState]);

    useEffect(() => {
        return () => {
            flushPendingScrollState();
        };
    }, [flushPendingScrollState]);

    useEffect(() => {
        flushPendingScrollState();
    }, [activeTab?.path, flushPendingScrollState]);

    useEffect(() => {
        const rafId = requestAnimationFrame(() => {
            setWorkspaceResults(null);
        });
        return () => cancelAnimationFrame(rafId);
    }, [activeTab?.path]);

    const handleEditorChange = useCallback((val?: string) => {
        if (!activeTab) {
            return;
        }
        const nextValue = val ?? '';
        updateTabContent(nextValue);
        if (macros.recording && nextValue !== activeTab.content) {
            macros.appendStep(nextValue);
        }
    }, [activeTab, macros, updateTabContent]);

    const handleCursorPositionChange = useCallback(
        (position: { lineNumber: number; column: number }) => {
            if (!activeTab) {
                return;
            }
            persistViewState(activeTab.path, position);
        },
        [activeTab, persistViewState]
    );

    const handleScrollPositionChange = useCallback(
        (scrollTop: number) => {
            if (!activeTab) {
                return;
            }

            pendingScrollStateRef.current = {
                path: activeTab.path,
                scrollTop: Math.max(0, Math.floor(scrollTop)),
            };
            if (scrollPersistTimeoutRef.current !== null) {
                window.clearTimeout(scrollPersistTimeoutRef.current);
            }
            scrollPersistTimeoutRef.current = window.setTimeout(() => {
                flushPendingScrollState();
            }, VIEW_STATE_SCROLL_PERSIST_DELAY_MS);
        },
        [activeTab, flushPendingScrollState]
    );

    const handleWorkspaceResultSelect = useCallback(
        (path: string, line?: number) => {
            setWorkspaceResults(null);
            onOpenFile?.(path, line);
        },
        [onOpenFile]
    );

    return (
        <div className="absolute inset-0 overflow-hidden">  
            {statusMessage && (
                <div className="absolute top-12 right-2 z-20 typo-caption text-muted-foreground rounded border border-border/40 bg-background/90 px-2 py-1">
                    {statusMessage}
                </div>
            )}
            {tools.semanticPreview && (
                <pre className="absolute top-20 right-2 z-20 tw-w-440 max-h-48 overflow-auto tw-text-11 rounded border border-border/40 bg-background/90 p-2">
                    {tools.semanticPreview}
                </pre>
            )} 
            {activeTab?.type === 'image' ? (
                <div className="absolute inset-0 flex items-center justify-center p-8 bg-background overflow-auto z-10">
                    <div className="relative max-w-full max-h-full shadow-2xl tw-bg-checker rounded-lg border border-border/40 p-1">
                        <img src={activeTab.content} alt={activeTab.name} className="max-w-full tw-max-h-80vh object-contain rounded" />
                    </div>
                </div>
            ) : (
                <div className={cn("absolute inset-0 transition-opacity duration-300", !activeTab && "opacity-0 pointer-events-none")}>
                    <CodeEditor
                        value={activeTab?.content ?? ''}
                        language={activeTab ? getLanguageFromExtension(activeTab.name) : 'typescript'}
                        onChange={handleEditorChange}
                        readOnly={false}
                        initialLine={activeTab?.initialLine}
                        initialPosition={
                            activeTab?.initialLine
                                ? null
                                : activeViewState
                                    ? {
                                        lineNumber: activeViewState.lineNumber,
                                        column: activeViewState.column,
                                    }
                                    : null
                        }
                        initialScrollTop={activeTab?.initialLine ? null : activeViewState?.scrollTop ?? null}
                        onCursorPositionChange={handleCursorPositionChange}
                        onScrollPositionChange={handleScrollPositionChange}
                        showMinimap={!performanceMode}
                        savedValue={activeTab?.savedContent}
                        enableInlayHints={tools.enableInlayHints}
                        enableCodeLens={tools.enableCodeLens}
                        performanceMode={performanceMode}
                        performanceMarkPrefix="workspace:editor"
                        workspacePath={workspacePath}
                        filePath={activeTab?.path}
                        workspaceEditorSettings={workspaceEditorSettings}
                        onNavigateToLocation={target => {
                            onOpenFile?.(target.filePath, target.lineNumber);
                        }}
                        onShowWorkspaceResults={payload => {
                            setWorkspaceResults(payload);
                        }}
                    />
                </div>
            )}
            {workspaceResults && (
                <div className="absolute bottom-2 left-2 z-20 tw-w-440 tw-max-w-90p rounded border border-border/40 bg-background/95 shadow-2xl backdrop-blur">
                    <div className="flex items-center justify-between gap-3 border-b border-border/40 px-3 py-2">
                        <div className="min-w-0">
                            <div className="truncate typo-caption font-semibold text-foreground">
                                {workspaceResults.symbol}
                            </div>
                            <div className="tw-text-10 text-muted-foreground/70">
                                {workspaceResults.results.length}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setWorkspaceResults(null)}
                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                            aria-label={t('common.close')}
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <div className="max-h-64 overflow-auto">
                        {workspaceResults.results.map(result => {
                            const resultFileName = result.file.split(/[\\/]/).pop() ?? result.file;
                            return (
                                <button
                                    key={`${result.file}:${result.line}:${result.type ?? 'result'}`}
                                    type="button"
                                    onClick={() => handleWorkspaceResultSelect(result.file, result.line)}
                                    className="flex w-full items-start gap-3 border-b border-border/20 px-3 py-2 text-left transition-colors hover:bg-muted/40"
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate tw-text-12 font-medium text-foreground">
                                            {resultFileName}
                                        </span>
                                        <span className="block truncate font-mono tw-text-11 text-muted-foreground/80">
                                            {result.text.trim()}
                                        </span>
                                    </span>
                                    <span className="shrink-0 font-mono tw-text-10 tabular-nums text-muted-foreground/60">
                                        {result.line}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
            {tools.testOutput && (
                <pre className="absolute bottom-2 right-2 z-20 tw-w-480 tw-max-w-90p max-h-52 overflow-auto tw-text-11 rounded border border-border/40 bg-background/90 p-2">
                    {tools.testOutput}
                </pre>
            )}
            {(aiReview.reviewSummary || aiReview.bugSummary || aiReview.performanceSummary) && (
                <pre className="absolute bottom-56 right-2 z-20 tw-w-520 tw-max-w-90p max-h-56 overflow-auto tw-text-11 rounded border border-border/40 bg-background/90 p-2">
                    {[aiReview.reviewSummary, aiReview.bugSummary, aiReview.performanceSummary].filter(Boolean).join('\n\n')}
                </pre>
            )}
            {!activeTab && emptyState}
        </div>
    );
};
