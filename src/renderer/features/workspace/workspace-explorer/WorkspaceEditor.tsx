/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { FileSearchResult } from '@shared/types/common';
import { X } from 'lucide-react';
import * as React from 'react';
import {
    useCallback,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from 'react';

import { CodeEditor } from '@/components/ui/CodeEditor';
import {
    createWorkspaceShareCode,
    filterWorkspaceSnippets,
    loadWorkspaceSnippets,
    parseWorkspaceShareCode,
    saveWorkspaceSnippets,
    WorkspaceSnippet,
} from '@/features/workspace/utils/snippet-manager';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { EditorTab, Workspace } from '@/types';
import { getLanguageFromExtension } from '@/utils/language-map';

import { useEditorAIReview } from './useEditorAIReview';
import { useEditorMacros } from './useEditorMacros';

const FLOATING_PANEL_BASE = 
    "absolute z-20 rounded border border-border/40 bg-background/90 p-2 shadow-sm font-sans";


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

interface ClipboardResult {
    success: boolean;
    text: string;
}

function normalizeWorkspaceBasePath(workspacePath: string): string {
    return workspacePath.replace(/[\\/]+$/, '');
}

function toWorkspaceFilePath(
    workspacePath: string,
    folder: 'docs' | 'tasks',
    fileName: string
): string {
    return `${normalizeWorkspaceBasePath(workspacePath)}\\${folder}\\${fileName}`;
}

function normalizeImportedSnippet(
    candidate: unknown,
    workspaceKey: string
): WorkspaceSnippet | null {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return null;
    }
    const parsed = candidate as Partial<WorkspaceSnippet>;
    if (typeof parsed.name !== 'string' || parsed.name.trim() === '') {
        return null;
    }
    if (typeof parsed.content !== 'string') {
        return null;
    }

    const now = Date.now();
    return {
        id: typeof parsed.id === 'string' && parsed.id.trim() !== '' ? parsed.id : `${now}`,
        name: parsed.name,
        content: parsed.content,
        language: typeof parsed.language === 'string' && parsed.language.trim() !== '' ? parsed.language : 'plaintext',
        workspaceKey:
            typeof parsed.workspaceKey === 'string' && parsed.workspaceKey.trim() !== ''
                ? parsed.workspaceKey
                : workspaceKey,
        createdAt: typeof parsed.createdAt === 'number' && Number.isFinite(parsed.createdAt) ? parsed.createdAt : now,
    };
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
    const [snippets, setSnippets] = useState<WorkspaceSnippet[]>(() => loadWorkspaceSnippets());
    const [selectedSnippetId, setSelectedSnippetId] = useState('');

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
    const activeLanguage = activeTab ? getLanguageFromExtension(activeTab.name) : 'plaintext';
    const filteredSnippets = useMemo(
        () => filterWorkspaceSnippets(snippets, activeLanguage, workspaceKey),
        [activeLanguage, snippets, workspaceKey]
    );
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

    const handleSaveSnippet = useCallback(() => {
        if (!activeTab) {
            return;
        }
        const now = Date.now();
        const snippet: WorkspaceSnippet = {
            id: `${now}`,
            name: activeTab.name,
            language: getLanguageFromExtension(activeTab.name),
            workspaceKey,
            content: activeTab.content,
            createdAt: now,
        };
        const nextSnippets = [snippet, ...snippets];
        saveWorkspaceSnippets(nextSnippets);
        setSnippets(nextSnippets);
        setSelectedSnippetId(snippet.id);
        setStatusMessage(t('workspaceDashboard.editor.snippetSaved'));
    }, [activeTab, snippets, t, workspaceKey]);

    const handleInsertSnippet = useCallback(() => {
        if (!activeTab) {
            return;
        }
        const selectedSnippet = filteredSnippets.find(snippet => snippet.id === selectedSnippetId);
        if (!selectedSnippet) {
            return;
        }
        const prefix = activeTab.content.length > 0 && !activeTab.content.endsWith('\n') ? '\n' : '';
        updateTabContent(`${activeTab.content}${prefix}${selectedSnippet.content}`);
        setStatusMessage(t('workspaceDashboard.editor.snippetInserted'));
    }, [activeTab, filteredSnippets, selectedSnippetId, t, updateTabContent]);

    const handleExportSnippets = useCallback(async () => {
        try {
            const clipboard = window.electron?.clipboard;
            if (!clipboard || typeof clipboard.writeText !== 'function') {
                throw new Error('clipboard-not-available');
            }
            await clipboard.writeText(JSON.stringify(filteredSnippets));
            setStatusMessage(t('workspaceDashboard.editor.snippetExported'));
        } catch {
            setStatusMessage(t('workspaceDashboard.editor.snippetImportFailed'));
        }
    }, [filteredSnippets, t]);

    const handleImportSnippets = useCallback(async () => {
        try {
            const clipboard = window.electron?.clipboard;
            if (!clipboard || typeof clipboard.readText !== 'function') {
                throw new Error('clipboard-not-available');
            }

            const result = await clipboard.readText() as ClipboardResult;
            if (!result.success || result.text.trim() === '') {
                throw new Error('clipboard-empty');
            }

            const parsed = JSON.parse(result.text) as unknown;
            if (!Array.isArray(parsed)) {
                throw new Error('clipboard-not-array');
            }

            const imported = parsed
                .map(entry => normalizeImportedSnippet(entry, workspaceKey))
                .filter((entry): entry is WorkspaceSnippet => entry !== null);

            if (imported.length === 0) {
                throw new Error('clipboard-invalid-snippets');
            }

            const nextSnippets = [...snippets, ...imported];
            saveWorkspaceSnippets(nextSnippets);
            setSnippets(nextSnippets);
            if (selectedSnippetId === '' && imported[0]) {
                setSelectedSnippetId(imported[0].id);
            }
            setStatusMessage(t('workspaceDashboard.editor.snippetImported'));
        } catch {
            setStatusMessage(t('workspaceDashboard.editor.snippetImportFailed'));
        }
    }, [selectedSnippetId, snippets, t, workspaceKey]);

    const handleShareSnippet = useCallback(async () => {
        const selectedSnippet = filteredSnippets.find(snippet => snippet.id === selectedSnippetId);
        if (!selectedSnippet) {
            return;
        }

        try {
            const clipboard = window.electron?.clipboard;
            if (!clipboard || typeof clipboard.writeText !== 'function') {
                throw new Error('clipboard-not-available');
            }
            const shareCode = createWorkspaceShareCode(selectedSnippet);
            await clipboard.writeText(shareCode);
            setStatusMessage(t('workspaceDashboard.editor.snippetShareCodeCopied'));
        } catch {
            setStatusMessage(t('workspaceDashboard.editor.snippetImportFailed'));
        }
    }, [filteredSnippets, selectedSnippetId, t]);

    const handleImportShareCode = useCallback(async () => {
        try {
            const clipboard = window.electron?.clipboard;
            if (!clipboard || typeof clipboard.readText !== 'function') {
                throw new Error('clipboard-not-available');
            }

            const result = await clipboard.readText() as ClipboardResult;
            if (!result.success || result.text.trim() === '') {
                throw new Error('clipboard-empty');
            }

            const parsedSnippet = parseWorkspaceShareCode(result.text.trim());
            if (!parsedSnippet) {
                throw new Error('invalid-share-code');
            }

            const nextSnippets = [parsedSnippet, ...snippets];
            saveWorkspaceSnippets(nextSnippets);
            setSnippets(nextSnippets);
            setSelectedSnippetId(parsedSnippet.id);
            setStatusMessage(t('workspaceDashboard.editor.snippetImported'));
        } catch {
            setStatusMessage(t('workspaceDashboard.editor.snippetImportFailed'));
        }
    }, [snippets, t]);

    const handleRunScratchCommand = useCallback(async () => {
        const rawCommand = tools.scratchNote.trim();
        if (!workspacePath || rawCommand === '') {
            return;
        }

        const [command, ...args] = rawCommand.split(/\s+/).filter(Boolean);
        if (!command) {
            return;
        }

        try {
            const executeCommand = window.electron?.runCommand;
            if (typeof executeCommand !== 'function') {
                throw new Error('run-command-not-available');
            }
            const result = await executeCommand(command, args, workspacePath);
            const stdout = typeof result?.stdout === 'string' ? result.stdout : '';
            const stderr = typeof result?.stderr === 'string' ? result.stderr : '';
            const output = [stdout, stderr].filter(Boolean).join('\n');
            dispatch({
                type: 'SET_TEST_RESULTS',
                output,
                lines: output === '' ? [] : output.split('\n'),
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            dispatch({
                type: 'SET_TEST_RESULTS',
                output: message,
                lines: [message],
            });
        }
    }, [tools.scratchNote, workspacePath]);

    const handleSaveScratchDoc = useCallback(async () => {
        if (!workspacePath) {
            return;
        }
        const writeFile = window.electron?.files?.writeFile;
        if (typeof writeFile !== 'function') {
            return;
        }

        const scratchName = tools.scratchName.trim() || 'scratch-note';
        const targetPath = toWorkspaceFilePath(workspacePath, 'docs', `${scratchName}.md`);
        await writeFile(targetPath, tools.scratchNote);
        setStatusMessage(t('workspaceDashboard.editor.scratchSavedDoc'));
    }, [tools.scratchName, tools.scratchNote, t, workspacePath]);

    const handleSaveScratchTask = useCallback(async () => {
        if (!workspacePath) {
            return;
        }
        const writeFile = window.electron?.files?.writeFile;
        if (typeof writeFile !== 'function') {
            return;
        }

        const scratchName = tools.scratchName.trim() || 'scratch-note';
        const targetPath = toWorkspaceFilePath(workspacePath, 'tasks', `${scratchName}.txt`);
        await writeFile(targetPath, tools.scratchNote);
        setStatusMessage(t('workspaceDashboard.editor.scratchSavedTask'));
    }, [tools.scratchName, tools.scratchNote, t, workspacePath]);

    const handleAiReview = useCallback(async () => {
        await aiReview.runAiCodeReview();
    }, [aiReview]);

    const handleAiBugScan = useCallback(() => {
        aiReview.runAiBugScan();
    }, [aiReview]);

    const handleAiPerformance = useCallback(() => {
        aiReview.runAiPerformanceScan();
    }, [aiReview]);

    return (
        <div className="absolute inset-0 overflow-hidden">  
            {activeTab?.type === 'code' && (
                <div className={cn(FLOATING_PANEL_BASE, "left-2 top-2 right-2 flex max-h-80 flex-col gap-2 overflow-auto bg-background/95 p-3")}>
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            className="h-8 min-w-40 rounded border border-border/40 bg-background px-2 text-12"
                            value={selectedSnippetId}
                            onChange={event => setSelectedSnippetId(event.target.value)}
                            aria-label={t('workspaceDashboard.editor.insertSnippet')}
                        >
                            <option value="">--</option>
                            {filteredSnippets.map(snippet => (
                                <option key={snippet.id} value={snippet.id}>
                                    {snippet.name}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            className="rounded border border-border/40 bg-muted/30 px-2 py-1 text-12"
                            onClick={handleInsertSnippet}
                        >
                            {t('workspaceDashboard.editor.insertSnippet')}
                        </button>
                        <button
                            type="button"
                            className="rounded border border-border/40 bg-muted/30 px-2 py-1 text-12"
                            onClick={handleSaveSnippet}
                        >
                            {t('workspaceDashboard.editor.saveSnippet')}
                        </button>
                        <button
                            type="button"
                            className="rounded border border-border/40 bg-muted/30 px-2 py-1 text-12"
                            onClick={() => { void handleExportSnippets(); }}
                        >
                            {t('workspaceDashboard.editor.exportSnippets')}
                        </button>
                        <button
                            type="button"
                            className="rounded border border-border/40 bg-muted/30 px-2 py-1 text-12"
                            onClick={() => { void handleImportSnippets(); }}
                        >
                            {t('workspaceDashboard.editor.importSnippets')}
                        </button>
                        <button
                            type="button"
                            className="rounded border border-border/40 bg-muted/30 px-2 py-1 text-12"
                            onClick={() => { void handleShareSnippet(); }}
                        >
                            {t('workspaceDashboard.editor.shareSnippet')}
                        </button>
                        <button
                            type="button"
                            className="rounded border border-border/40 bg-muted/30 px-2 py-1 text-12"
                            onClick={() => { void handleImportShareCode(); }}
                        >
                            {t('workspaceDashboard.editor.importShareCode')}
                        </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            className="rounded border border-border/40 bg-muted/30 px-2 py-1 text-12"
                            onClick={() => { void handleAiReview(); }}
                        >
                            {t('workspaceDashboard.editor.aiReview')}
                        </button>
                        <button
                            type="button"
                            className="rounded border border-border/40 bg-muted/30 px-2 py-1 text-12"
                            onClick={handleAiBugScan}
                        >
                            {t('workspaceDashboard.editor.aiBugScan')}
                        </button>
                        <button
                            type="button"
                            className="rounded border border-border/40 bg-muted/30 px-2 py-1 text-12"
                            onClick={handleAiPerformance}
                        >
                            {t('workspaceDashboard.editor.aiPerf')}
                        </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="text"
                            value={tools.scratchName}
                            onChange={event => dispatch({ type: 'SET_SCRATCH_NAME', value: event.target.value })}
                            className="h-8 w-44 rounded border border-border/40 bg-background px-2 text-12"
                        />
                        <button
                            type="button"
                            className="rounded border border-border/40 bg-muted/30 px-2 py-1 text-12"
                            onClick={() => { void handleRunScratchCommand(); }}
                        >
                            {t('workspaceDashboard.editor.runScratch')}
                        </button>
                        <button
                            type="button"
                            className="rounded border border-border/40 bg-muted/30 px-2 py-1 text-12"
                            onClick={() => { void handleSaveScratchDoc(); }}
                        >
                            {t('workspaceDashboard.editor.saveScratchDoc')}
                        </button>
                        <button
                            type="button"
                            className="rounded border border-border/40 bg-muted/30 px-2 py-1 text-12"
                            onClick={() => { void handleSaveScratchTask(); }}
                        >
                            {t('workspaceDashboard.editor.saveScratchTask')}
                        </button>
                    </div>
                    <textarea
                        value={tools.scratchNote}
                        onChange={event => dispatch({ type: 'SET_SCRATCH_NOTE', value: event.target.value })}
                        className="min-h-70 w-full rounded border border-border/40 bg-background p-2 text-12"
                    />
                </div>
            )}
            {statusMessage && (
                <div className={cn(FLOATING_PANEL_BASE, "top-12 right-2 typo-caption text-muted-foreground px-2 py-1")}>
                    {statusMessage}
                </div>
            )}
            {tools.semanticPreview && (
                <pre className={cn(FLOATING_PANEL_BASE, "top-20 right-2 w-440 max-h-48 overflow-auto text-11")}>
                    {tools.semanticPreview}
                </pre>
            )} 
            {activeTab?.type === 'image' ? (
                <div className="absolute inset-0 flex items-center justify-center p-8 bg-background overflow-auto z-10">
                    <div className="relative max-w-full max-h-full shadow-2xl bg-checker rounded-lg border border-border/40 p-1">
                        <img src={activeTab.content} alt={activeTab.name} className="max-w-full max-h-80vh object-contain rounded" />
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
                <div className={cn(FLOATING_PANEL_BASE, "bottom-2 left-2 w-440 max-w-90p bg-background/95 shadow-2xl backdrop-blur p-0")}>
                    <div className="flex items-center justify-between gap-3 border-b border-border/40 px-3 py-2">
                        <div className="min-w-0">
                            <div className="truncate typo-caption font-semibold text-foreground">
                                {workspaceResults.symbol}
                            </div>
                            <div className="text-10 text-muted-foreground/70">
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
                                        <span className="block truncate text-12 font-medium text-foreground">
                                            {resultFileName}
                                        </span>
                                        <span className="block truncate font-mono text-11 text-muted-foreground/80">
                                            {result.text.trim()}
                                        </span>
                                    </span>
                                    <span className="shrink-0 font-mono text-10 tabular-nums text-muted-foreground/60">
                                        {result.line}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
            {tools.testOutput && (
                <pre className={cn(FLOATING_PANEL_BASE, "bottom-2 right-2 w-480 max-w-90p max-h-52 overflow-auto text-11")}>
                    {tools.testOutput}
                </pre>
            )}
            {(aiReview.reviewSummary || aiReview.bugSummary || aiReview.performanceSummary) && (
                <pre className={cn(FLOATING_PANEL_BASE, "bottom-56 right-2 w-520 max-w-90p max-h-56 overflow-auto text-11")}>
                    {[aiReview.reviewSummary, aiReview.bugSummary, aiReview.performanceSummary].filter(Boolean).join('\n\n')}
                </pre>
            )}
            {!activeTab && emptyState}
        </div>
    );
};
