import React from 'react';

import { CodeMirrorEditor } from '@/components/ui/CodeMirrorEditor';
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
    projectKey?: string;
    projectPath?: string;
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
    projectPath: string | undefined;
    updateTabContent: (value: string) => void;
    dispatch: React.Dispatch<WorkspaceToolsAction>;
    tools: WorkspaceToolsState;
    setStatusMessage: (msg: string) => void;
}

/** Semantic refactoring and rename preview actions. */
function useRefactorActions(deps: WorkspaceActionDeps) {
    const { activeTab, projectPath, updateTabContent, dispatch, tools, setStatusMessage } = deps;
    const { t } = useTranslation();

    const previewSemanticRefactor = React.useCallback(() => {
        if (!activeTab) {
            return;
        }
        dispatch({ type: 'SET_SEMANTIC_PREVIEW', value: activeTab.content.replace(/\bvar\b/g, 'const').slice(0, 1200) });
        setStatusMessage(t('projectDashboard.editor.semanticPreviewReady'));
    }, [activeTab, dispatch, setStatusMessage, t]);

    const applySemanticRefactor = React.useCallback(() => {
        if (!activeTab) {
            return;
        }
        updateTabContent(activeTab.content.replace(/\bvar\b/g, 'const'));
        setStatusMessage(t('projectDashboard.editor.semanticApplied'));
    }, [activeTab, setStatusMessage, t, updateTabContent]);

    const previewRename = React.useCallback(async () => {
        if (!projectPath || !tools.renameFrom || !tools.renameTo) {
            return;
        }
        const preview = await window.electron.code.previewRenameSymbol(projectPath, tools.renameFrom, tools.renameTo, 200);
        const excluded = preview.updatedFiles.filter(file => new RegExp(tools.excludePattern, 'i').test(file));
        if (excluded.length > 0) {
            dispatch({ type: 'SET_RENAME_IMPACT', value: t('projectDashboard.editor.renameBlocked', { count: excluded.length }) });
            return;
        }
        dispatch({ type: 'SET_RENAME_IMPACT', value: t('projectDashboard.editor.renameImpact', { files: preview.totalFiles, occurrences: preview.totalOccurrences }) });
    }, [dispatch, projectPath, tools.excludePattern, tools.renameFrom, tools.renameTo, t]);

    return { previewSemanticRefactor, applySemanticRefactor, previewRename };
}

/** Test runner and scratchpad actions. */
function useTestAndScratchActions({ activeTab, projectPath, dispatch, tools, setStatusMessage }: WorkspaceActionDeps) {
    const { t } = useTranslation();

    const runTestCommand = React.useCallback(async (mode: 'nearest' | 'file' | 'suite') => {
        if (!projectPath) {
            return;
        }
        const fileArg = activeTab?.name ?? '';
        const commandByMode: Record<'nearest' | 'file' | 'suite', string[]> = {
            nearest: ['test', '--', fileArg],
            file: ['test', '--', fileArg],
            suite: ['test'],
        };
        const result = await window.electron.runCommand('npm', commandByMode[mode], projectPath);
        const output = `${result.stdout}\n${result.stderr}`.trim();
        const lines = output.split('\n').filter(line => /fail|pass|error/i.test(line)).slice(0, 20);
        dispatch({ type: 'SET_TEST_RESULTS', output, lines });
    }, [activeTab?.name, dispatch, projectPath]);

    const runScratchCommand = React.useCallback(async () => {
        if (!projectPath || !tools.scratchNote.trim()) {
            return;
        }
        const parts = tools.scratchNote.trim().split(/\s+/);
        const command = parts[0];
        if (!command) {
            return;
        }
        const result = await window.electron.runCommand(command, parts.slice(1), projectPath);
        dispatch({ type: 'SET_TEST_RESULTS', output: `${result.stdout}\n${result.stderr}`.trim(), lines: [] });
    }, [dispatch, projectPath, tools.scratchNote]);

    const saveScratchAsDoc = React.useCallback(async () => {
        if (!projectPath) {
            return;
        }
        await window.electron.files.writeFile(`${projectPath}\\docs\\${tools.scratchName}.md`, tools.scratchNote);
        setStatusMessage(t('projectDashboard.editor.scratchSavedDoc'));
    }, [projectPath, tools.scratchName, tools.scratchNote, setStatusMessage, t]);

    const saveScratchAsTask = React.useCallback(async () => {
        if (!projectPath) {
            return;
        }
        await window.electron.files.writeFile(`${projectPath}\\tasks\\${tools.scratchName}.txt`, tools.scratchNote);
        setStatusMessage(t('projectDashboard.editor.scratchSavedTask'));
    }, [projectPath, tools.scratchName, tools.scratchNote, setStatusMessage, t]);

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
 * - CodeMirror editor for text/code types
 * - Empty state when no file is open
 */
export const WorkspaceEditor: React.FC<WorkspaceEditorProps> = ({
    activeTab,
    updateTabContent,
    projectKey = 'global',
    projectPath,
    emptyState
}) => {
    const { t } = useTranslation();
    const hasUnsavedChanges = Boolean(activeTab && activeTab.content !== activeTab.savedContent);
    const activeLanguage = activeTab ? getLanguageFromExtension(activeTab.name) : 'typescript';
    const [statusMessage, setStatusMessage] = React.useState('');
    const [tools, dispatch] = React.useReducer(workspaceToolsReducer, WORKSPACE_TOOLS_INITIAL);

    const viewStateMap = useViewStatePersistence(`workspace.editor.viewstate:${projectKey}`);
    void (activeTab ? viewStateMap[activeTab.path] : undefined);
    useUnsavedChangesGuard(hasUnsavedChanges);

    const snippetHook = useEditorSnippets({ activeTab, activeLanguage, projectKey, updateTabContent, setStatusMessage });
    const aiReview = useEditorAIReview({ activeTab, projectPath });
    const macros = useEditorMacros({ updateTabContent, setStatusMessage });
    const actionDeps: WorkspaceActionDeps = { activeTab, projectPath, updateTabContent, dispatch, tools, setStatusMessage };
    const refactorActions = useRefactorActions(actionDeps);
    const testScratchActions = useTestAndScratchActions(actionDeps);

    const performanceMode = !tools.performanceOverride && (activeTab?.content.length ?? 0) > 20000;
    const capabilityBadge = React.useMemo(() => {
        const completion = ['typescript', 'javascript', 'json', 'markdown', 'python'].includes(activeLanguage);
        return `${completion ? 'completion' : 'no-completion'} | ${completion ? 'hover' : 'no-hover'} | ${completion ? 'diagnostics' : 'no-diagnostics'}`;
    }, [activeLanguage]);

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
            <div className="absolute top-2 right-2 z-20 flex items-center gap-2 rounded border border-border/50 bg-background/90 p-2 text-xs flex-wrap max-w-[92%]">
                <select
                    value={snippetHook.selectedSnippetId}
                    onChange={event => snippetHook.setSelectedSnippetId(event.target.value)}
                    className="rounded border border-border/50 bg-background px-1 py-1"
                >
                    <option value="">{t('projectDashboard.editor.selectSnippet')}</option>
                    {snippetHook.snippets.map(snippet => (
                        <option key={snippet.id} value={snippet.id}>{snippet.name}</option>
                    ))}
                </select>
                <button className="secondary-btn text-xs px-2 py-1" onClick={snippetHook.insertSelectedSnippet}>
                    {t('projectDashboard.editor.insertSnippet')}
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={snippetHook.saveCurrentAsSnippet}>
                    {t('projectDashboard.editor.saveSnippet')}
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void snippetHook.exportSnippets(); }}>
                    {t('projectDashboard.editor.exportSnippets')}
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void snippetHook.importSnippets(); }}>
                    {t('projectDashboard.editor.importSnippets')}
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void snippetHook.shareSelectedSnippet(); }}>
                    {t('projectDashboard.editor.shareSnippet')}
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void snippetHook.importShareCode(); }}>
                    {t('projectDashboard.editor.importShareCode')}
                </button>
                <label className="flex items-center gap-1">
                    <input
                        type="checkbox"
                        checked={aiReview.reviewRules.detectConsoleLog}
                        onChange={event => aiReview.setReviewRules({ ...aiReview.reviewRules, detectConsoleLog: event.target.checked })}
                    />
                    review:console
                </label>
                <label className="flex items-center gap-1">
                    <input
                        type="checkbox"
                        checked={aiReview.reviewRules.detectAnyType}
                        onChange={event => aiReview.setReviewRules({ ...aiReview.reviewRules, detectAnyType: event.target.checked })}
                    />
                    review:any
                </label>
                <label className="flex items-center gap-1">
                    <input
                        type="checkbox"
                        checked={aiReview.reviewRules.detectUnsafeEval}
                        onChange={event => aiReview.setReviewRules({ ...aiReview.reviewRules, detectUnsafeEval: event.target.checked })}
                    />
                    review:eval
                </label>
                <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void aiReview.runAiCodeReview(); }}>
                    AI Review
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={aiReview.runAiBugScan}>
                    AI Bug Scan
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={aiReview.runAiPerformanceScan}>
                    AI Perf
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={refactorActions.previewSemanticRefactor}>
                    {t('projectDashboard.editor.semanticPreview')}
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={refactorActions.applySemanticRefactor}>
                    {t('projectDashboard.editor.semanticApply')}
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void testScratchActions.runTestCommand('nearest'); }}>
                    {t('projectDashboard.editor.runNearestTest')}
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void testScratchActions.runTestCommand('file'); }}>
                    {t('projectDashboard.editor.runFileTest')}
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void testScratchActions.runTestCommand('suite'); }}>
                    {t('projectDashboard.editor.runSuiteTest')}
                </button>
                <label className="flex items-center gap-1">
                    <input type="checkbox" checked={tools.enableInlayHints} onChange={e => dispatch({ type: 'SET_INLAY_HINTS', value: e.target.checked })} />
                    {t('projectDashboard.editor.inlayHints')}
                </label>
                <label className="flex items-center gap-1">
                    <input type="checkbox" checked={tools.enableCodeLens} onChange={e => dispatch({ type: 'SET_CODE_LENS', value: e.target.checked })} />
                    {t('projectDashboard.editor.codeLens')}
                </label>
                <label className="flex items-center gap-1">
                    <input type="checkbox" checked={macros.recording} onChange={e => macros.setRecording(e.target.checked)} />
                    {t('projectDashboard.editor.recordMacro')}
                </label>
                <button className="secondary-btn text-xs px-2 py-1" onClick={macros.replayMacro}>
                    {t('projectDashboard.editor.replayMacro')}
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void macros.exportMacro(); }}>
                    {t('projectDashboard.editor.exportMacro')}
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void macros.importMacro(); }}>
                    {t('projectDashboard.editor.importMacro')}
                </button>
                {performanceMode && (
                    <button className="secondary-btn text-xs px-2 py-1" onClick={() => dispatch({ type: 'SET_PERF_OVERRIDE', value: true })}>
                        {t('projectDashboard.editor.performanceModeAuto')}
                    </button>
                )}
                <span className="rounded border border-border/40 px-2 py-1 text-[10px] text-muted-foreground">
                    {capabilityBadge}
                </span>
            </div>
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
            <div className="absolute bottom-2 left-2 z-20 w-[520px] max-w-[90%] rounded border border-border/50 bg-background/90 p-2 space-y-2 text-xs">
                <div className="font-medium">{t('projectDashboard.editor.renameGuard')}</div>
                <div className="flex gap-1">
                    <input value={tools.renameFrom} onChange={e => dispatch({ type: 'SET_RENAME_FROM', value: e.target.value })} placeholder={t('projectDashboard.editor.renameFrom')} className="px-1 py-1 border border-border/40 rounded bg-background" />
                    <input value={tools.renameTo} onChange={e => dispatch({ type: 'SET_RENAME_TO', value: e.target.value })} placeholder={t('projectDashboard.editor.renameTo')} className="px-1 py-1 border border-border/40 rounded bg-background" />
                    <input value={tools.excludePattern} onChange={e => dispatch({ type: 'SET_EXCLUDE_PATTERN', value: e.target.value })} placeholder={t('projectDashboard.editor.excludePattern')} className="px-1 py-1 border border-border/40 rounded bg-background" />
                    <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void refactorActions.previewRename(); }}>
                        {t('projectDashboard.editor.previewRename')}
                    </button>
                </div>
                {tools.renameImpact && <div className="text-muted-foreground">{tools.renameImpact}</div>}
                {tools.diagnosticLines.length > 0 && (
                    <div aria-live="polite" className="max-h-20 overflow-auto">
                        {tools.diagnosticLines.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)}
                    </div>
                )}
                <div className="font-medium">{t('projectDashboard.editor.scratchpad')}</div>
                <div className="flex gap-1">
                    <input value={tools.scratchName} onChange={e => dispatch({ type: 'SET_SCRATCH_NAME', value: e.target.value })} className="px-1 py-1 border border-border/40 rounded bg-background" />
                    <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void testScratchActions.runScratchCommand(); }}>
                        {t('projectDashboard.editor.runScratch')}
                    </button>
                    <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void testScratchActions.saveScratchAsDoc(); }}>
                        {t('projectDashboard.editor.saveScratchDoc')}
                    </button>
                    <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void testScratchActions.saveScratchAsTask(); }}>
                        {t('projectDashboard.editor.saveScratchTask')}
                    </button>
                </div>
                <textarea value={tools.scratchNote} onChange={e => dispatch({ type: 'SET_SCRATCH_NOTE', value: e.target.value })} className="w-full min-h-[70px] px-1 py-1 border border-border/40 rounded bg-background" />
                <div className="text-muted-foreground">{t('projectDashboard.editor.keyboardOnlyHint')}</div>
            </div>
            {activeTab?.type === 'image' ? (
                <div className="absolute inset-0 flex items-center justify-center p-8 bg-background overflow-auto z-10">
                    <div className="relative max-w-full max-h-full shadow-2xl bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiMxMTEiLz48cGF0aCBkPSJNMCAwSDhWOFMwIDAgMCAweiIgZmlsbD0iIzIyMiIvPjwvc3ZnPg==')] rounded-lg border border-white/10 p-1">
                        <img src={activeTab.content} alt={activeTab.name} className="max-w-full max-h-[80vh] object-contain rounded" />
                    </div>
                </div>
            ) : (
                <div className={cn("absolute inset-0 transition-opacity duration-300", !activeTab && "opacity-0 pointer-events-none")}>
                    <CodeMirrorEditor
                        content={activeTab?.content ?? ''}
                        language={activeTab ? getLanguageFromExtension(activeTab.name) : 'typescript'}
                        onChange={handleEditorChange}
                        readonly={false}
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
