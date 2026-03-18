import React from 'react';

import { CodeEditor } from '@/components/ui/CodeEditor';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { EditorTab } from '@/types';
import { getLanguageFromExtension } from '@/utils/language-map';

import { useEditorAIReview } from './useEditorAIReview';
import { useEditorMacros } from './useEditorMacros';
import { useEditorSnippets } from './useEditorSnippets';

export interface WorkspaceEditorProps {
    activeTab: EditorTab | null;
    updateTabContent: (value: string) => void;
    workspaceKey?: string;
    workspacePath?: string;
    emptyState: React.ReactNode;
}

interface EditorViewState {
    lineNumber: number;
    column: number;
    scrollTop: number;
}

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
    React.useEffect(() => {
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
function useViewStatePersistence(storageKey: string): Record<string, EditorViewState> {
    const [viewStateMap] = React.useState<Record<string, EditorViewState>>(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) {
                return {};
            }
            return JSON.parse(raw) as Record<string, EditorViewState>;
        } catch {
            return {};
        }
    });

    return viewStateMap;
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

    const previewSemanticRefactor = React.useCallback(() => {
        if (!activeTab) {
            return;
        }
        dispatch({ type: 'SET_SEMANTIC_PREVIEW', value: activeTab.content.replace(/\bvar\b/g, 'const').slice(0, 1200) });
        setStatusMessage(t('workspaceDashboard.editor.semanticPreviewReady'));
    }, [activeTab, dispatch, setStatusMessage, t]);

    const applySemanticRefactor = React.useCallback(() => {
        if (!activeTab) {
            return;
        }
        updateTabContent(activeTab.content.replace(/\bvar\b/g, 'const'));
        setStatusMessage(t('workspaceDashboard.editor.semanticApplied'));
    }, [activeTab, setStatusMessage, t, updateTabContent]);

    const previewRename = React.useCallback(async () => {
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

/** Test runner and scratchpad actions. */
function useTestAndScratchActions({ activeTab, workspacePath, dispatch, tools, setStatusMessage }: WorkspaceActionDeps) {
    const { t } = useTranslation();

    const runTestCommand = React.useCallback(async (mode: 'nearest' | 'file' | 'suite') => {
        if (!workspacePath) {
            return;
        }
        const fileArg = activeTab?.name ?? '';
        const commandByMode: Record<'nearest' | 'file' | 'suite', string[]> = {
            nearest: ['test', '--', fileArg],
            file: ['test', '--', fileArg],
            suite: ['test'],
        };
        const result = await window.electron.runCommand('npm', commandByMode[mode], workspacePath);
        const output = `${result.stdout}\n${result.stderr}`.trim();
        const lines = output.split('\n').filter(line => /fail|pass|error/i.test(line)).slice(0, 20);
        dispatch({ type: 'SET_TEST_RESULTS', output, lines });
    }, [activeTab?.name, dispatch, workspacePath]);

    const runScratchCommand = React.useCallback(async () => {
        if (!workspacePath || !tools.scratchNote.trim()) {
            return;
        }
        const parts = tools.scratchNote.trim().split(/\s+/);
        const command = parts[0];
        if (!command) {
            return;
        }
        const result = await window.electron.runCommand(command, parts.slice(1), workspacePath);
        dispatch({ type: 'SET_TEST_RESULTS', output: `${result.stdout}\n${result.stderr}`.trim(), lines: [] });
    }, [dispatch, workspacePath, tools.scratchNote]);

    const saveScratchAsDoc = React.useCallback(async () => {
        if (!workspacePath) {
            return;
        }
        await window.electron.files.writeFile(`${workspacePath}\\docs\\${tools.scratchName}.md`, tools.scratchNote);
        setStatusMessage(t('workspaceDashboard.editor.scratchSavedDoc'));
    }, [workspacePath, tools.scratchName, tools.scratchNote, setStatusMessage, t]);

    const saveScratchAsTask = React.useCallback(async () => {
        if (!workspacePath) {
            return;
        }
        await window.electron.files.writeFile(`${workspacePath}\\tasks\\${tools.scratchName}.txt`, tools.scratchNote);
        setStatusMessage(t('workspaceDashboard.editor.scratchSavedTask'));
    }, [workspacePath, tools.scratchName, tools.scratchNote, setStatusMessage, t]);

    return { runTestCommand, runScratchCommand, saveScratchAsDoc, saveScratchAsTask };
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
    workspaceKey = 'global',
    workspacePath,
    emptyState
}) => {
    void useTranslation();
    const hasUnsavedChanges = Boolean(activeTab && activeTab.content !== activeTab.savedContent);
    const activeLanguage = activeTab ? getLanguageFromExtension(activeTab.name) : 'typescript';
    const [statusMessage, setStatusMessage] = React.useState('');
    const [tools, dispatch] = React.useReducer(workspaceToolsReducer, WORKSPACE_TOOLS_INITIAL);

    const viewStateMap = useViewStatePersistence(`workspace.editor.viewstate:${workspaceKey}`);
    void (activeTab ? viewStateMap[activeTab.path] : undefined);
    useUnsavedChangesGuard(hasUnsavedChanges);

    const snippetHook = useEditorSnippets({ activeTab, activeLanguage, workspaceKey, updateTabContent, setStatusMessage });
    const aiReview = useEditorAIReview({ activeTab, workspacePath });
    const macros = useEditorMacros({ updateTabContent, setStatusMessage });
    const actionDeps: WorkspaceActionDeps = { activeTab, workspacePath, updateTabContent, dispatch, tools, setStatusMessage };
    const refactorActions = useRefactorActions(actionDeps);
    const testScratchActions = useTestAndScratchActions(actionDeps);
    void snippetHook;
    void refactorActions;
    void testScratchActions;

    const performanceMode = !tools.performanceOverride && (activeTab?.content.length ?? 0) > 20000;

    const handleEditorChange = React.useCallback((val?: string) => {
        if (!activeTab) {
            return;
        }
        const nextValue = val ?? '';
        updateTabContent(nextValue);
        if (macros.recording && nextValue !== activeTab.content) {
            macros.appendStep(nextValue);
        }
    }, [activeTab, macros, updateTabContent]);

    return (
        <div className="absolute inset-0 overflow-hidden"> 
            {statusMessage && (
                <div className="absolute top-12 right-2 z-20 text-xs text-muted-foreground rounded border border-border/40 bg-background/90 px-2 py-1">
                    {statusMessage}
                </div>
            )}
            {tools.semanticPreview && (
                <pre className="absolute top-20 right-2 z-20 w-[440px] max-h-48 overflow-auto text-[11px] rounded border border-border/40 bg-background/90 p-2">
                    {tools.semanticPreview}
                </pre>
            )} 
            {activeTab?.type === 'image' ? (
                <div className="absolute inset-0 flex items-center justify-center p-8 bg-background overflow-auto z-10">
                    <div className="relative max-w-full max-h-full shadow-2xl bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiMxMTEiLz48cGF0aCBkPSJNMCAwSDhWOFMwIDAgMCAweiIgZmlsbD0iIzIyMiIvPjwvc3ZnPg==')] rounded-lg border border-white/10 p-1">
                        <img src={activeTab.content} alt={activeTab.name} className="max-w-full max-h-[80vh] object-contain rounded" />
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
                        showMinimap={!performanceMode}
                        enableInlayHints={tools.enableInlayHints}
                        enableCodeLens={tools.enableCodeLens}
                        performanceMode={performanceMode}
                        performanceMarkPrefix="workspace:editor"
                    />
                </div>
            )}
            {tools.testOutput && (
                <pre className="absolute bottom-2 right-2 z-20 w-[480px] max-w-[90%] max-h-52 overflow-auto text-[11px] rounded border border-border/40 bg-background/90 p-2">
                    {tools.testOutput}
                </pre>
            )}
            {(aiReview.reviewSummary || aiReview.bugSummary || aiReview.performanceSummary) && (
                <pre className="absolute bottom-56 right-2 z-20 w-[520px] max-w-[90%] max-h-56 overflow-auto text-[11px] rounded border border-border/40 bg-background/90 p-2">
                    {[aiReview.reviewSummary, aiReview.bugSummary, aiReview.performanceSummary].filter(Boolean).join('\n\n')}
                </pre>
            )}
            {!activeTab && emptyState}
        </div>
    );
};
