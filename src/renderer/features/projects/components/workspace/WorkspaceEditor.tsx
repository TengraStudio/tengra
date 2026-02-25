import React from 'react';

import { CodeEditor } from '@/components/ui/CodeEditor';
import {
    loadReviewRuleConfig,
    ReviewRuleConfig,
    runBugDetectionAnalysis,
    runCodeReviewAnalysis,
    runPerformanceSuggestionAnalysis,
    saveReviewRuleConfig
} from '@/features/projects/utils/dev-ai-assistant';
import {
    createShareCode,
    filterSnippets,
    loadProjectSnippets,
    parseShareCode,
    ProjectSnippet,
    saveProjectSnippets,
} from '@/features/projects/utils/snippet-manager';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { EditorTab } from '@/types';
import { getLanguageFromExtension } from '@/utils/language-map';

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
    const [allSnippets, setAllSnippets] = React.useState<ProjectSnippet[]>([]);
    const [selectedSnippetId, setSelectedSnippetId] = React.useState('');
    const [snippetStatus, setSnippetStatus] = React.useState('');
    const [enableInlayHints, setEnableInlayHints] = React.useState(true);
    const [enableCodeLens, setEnableCodeLens] = React.useState(true);
    const [performanceOverride, setPerformanceOverride] = React.useState(false);
    const [semanticPreview, setSemanticPreview] = React.useState('');
    const [renameFrom, setRenameFrom] = React.useState('');
    const [renameTo, setRenameTo] = React.useState('');
    const [excludePattern, setExcludePattern] = React.useState('dist|build|generated');
    const [renameImpact, setRenameImpact] = React.useState('');
    const [testOutput, setTestOutput] = React.useState('');
    const [scratchNote, setScratchNote] = React.useState('');
    const [scratchName, setScratchName] = React.useState('scratch-note');
    const [recordMacro, setRecordMacro] = React.useState(false);
    const [macroSteps, setMacroSteps] = React.useState<string[]>([]);
    const [diagnosticLines, setDiagnosticLines] = React.useState<string[]>([]);
    const [viewStateMap, setViewStateMap] = React.useState<Record<string, EditorViewState>>({});
    const [reviewRules, setReviewRules] = React.useState<ReviewRuleConfig>(() => loadReviewRuleConfig());
    const [reviewSummary, setReviewSummary] = React.useState('');
    const [bugSummary, setBugSummary] = React.useState('');
    const [performanceSummary, setPerformanceSummary] = React.useState('');
    const activeLanguage = activeTab ? getLanguageFromExtension(activeTab.name) : 'typescript';
    const performanceMode = !performanceOverride && (activeTab?.content.length ?? 0) > 20000;
    const snippets = React.useMemo(
        () => filterSnippets(allSnippets, activeLanguage, projectKey),
        [activeLanguage, allSnippets, projectKey]
    );
    const viewStateStorageKey = `workspace.editor.viewstate:${projectKey}`;
    const activeViewState = activeTab ? viewStateMap[activeTab.path] : undefined;
    const capabilityBadge = React.useMemo(() => {
        const completion = ['typescript', 'javascript', 'json', 'markdown', 'python'].includes(activeLanguage);
        const diagnostics = completion;
        const hover = completion;
        return `${completion ? 'completion' : 'no-completion'} | ${hover ? 'hover' : 'no-hover'} | ${diagnostics ? 'diagnostics' : 'no-diagnostics'}`;
    }, [activeLanguage]);

    React.useEffect(() => {
        setAllSnippets(loadProjectSnippets());
    }, []);

    React.useEffect(() => {
        try {
            const raw = localStorage.getItem(viewStateStorageKey);
            if (!raw) {
                return;
            }
            const parsed = JSON.parse(raw) as Record<string, EditorViewState>;
            setViewStateMap(parsed);
        } catch {
            setViewStateMap({});
        }
    }, [viewStateStorageKey]);

    const persistViewState = React.useCallback((next: Record<string, EditorViewState>) => {
        setViewStateMap(next);
        localStorage.setItem(viewStateStorageKey, JSON.stringify(next));
    }, [viewStateStorageKey]);

    React.useEffect(() => {
        saveReviewRuleConfig(reviewRules);
    }, [reviewRules]);

    React.useEffect(() => {
        if (!hasUnsavedChanges) {
            return undefined;
        }
        const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', beforeUnloadHandler);
        return () => {
            window.removeEventListener('beforeunload', beforeUnloadHandler);
        };
    }, [hasUnsavedChanges]);

    const persistSnippets = React.useCallback((next: ProjectSnippet[]) => {
        setAllSnippets(next);
        saveProjectSnippets(next);
    }, []);

    const saveCurrentAsSnippet = React.useCallback(() => {
        if (!activeTab) {
            return;
        }
        const snippet: ProjectSnippet = {
            id: `${Date.now()}`,
            name: activeTab.name,
            language: activeLanguage,
            projectKey,
            content: activeTab.content,
            createdAt: Date.now(),
        };
        persistSnippets([snippet, ...allSnippets]);
        setSnippetStatus(t('projectDashboard.editor.snippetSaved'));
    }, [activeLanguage, activeTab, allSnippets, persistSnippets, projectKey, t]);

    const insertSelectedSnippet = React.useCallback(() => {
        if (!activeTab) {
            return;
        }
        const snippet = snippets.find(entry => entry.id === selectedSnippetId);
        if (!snippet) {
            return;
        }
        updateTabContent(`${activeTab.content}\n${snippet.content}`);
        setSnippetStatus(t('projectDashboard.editor.snippetInserted'));
    }, [activeTab, selectedSnippetId, snippets, t, updateTabContent]);

    const exportSnippets = React.useCallback(async () => {
        const exportPayload = JSON.stringify(snippets, null, 2);
        await window.electron.clipboard.writeText(exportPayload);
        setSnippetStatus(t('projectDashboard.editor.snippetExported'));
    }, [snippets, t]);

    const importSnippets = React.useCallback(async () => {
        const clipboard = await window.electron.clipboard.readText();
        if (!clipboard.success || !clipboard.text) {
            setSnippetStatus(t('projectDashboard.editor.snippetImportFailed'));
            return;
        }
        try {
            const imported = JSON.parse(clipboard.text) as ProjectSnippet[];
            if (!Array.isArray(imported)) {
                setSnippetStatus(t('projectDashboard.editor.snippetImportFailed'));
                return;
            }
            const normalized = imported
                .filter(snippet => typeof snippet.name === 'string' && typeof snippet.content === 'string')
                .map(snippet => ({
                    id: `${Date.now()}-${snippet.name}`,
                    name: snippet.name,
                    language: snippet.language || 'all',
                    projectKey: snippet.projectKey || 'global',
                    content: snippet.content,
                    createdAt: Date.now(),
                }));
            persistSnippets([...normalized, ...allSnippets]);
            setSnippetStatus(t('projectDashboard.editor.snippetImported'));
        } catch {
            setSnippetStatus(t('projectDashboard.editor.snippetImportFailed'));
        }
    }, [allSnippets, persistSnippets, t]);

    const shareSelectedSnippet = React.useCallback(async () => {
        const snippet = snippets.find(entry => entry.id === selectedSnippetId);
        if (!snippet) {
            return;
        }
        const shareCode = createShareCode(snippet);
        await window.electron.clipboard.writeText(shareCode);
        setSnippetStatus(t('projectDashboard.editor.snippetShareCodeCopied'));
    }, [selectedSnippetId, snippets, t]);

    const importShareCode = React.useCallback(async () => {
        const clipboard = await window.electron.clipboard.readText();
        if (!clipboard.success || !clipboard.text) {
            setSnippetStatus(t('projectDashboard.editor.snippetImportFailed'));
            return;
        }
        const parsed = parseShareCode(clipboard.text);
        if (!parsed) {
            setSnippetStatus(t('projectDashboard.editor.snippetImportFailed'));
            return;
        }
        persistSnippets([parsed, ...allSnippets]);
        setSnippetStatus(t('projectDashboard.editor.snippetImported'));
    }, [allSnippets, persistSnippets, t]);

    const previewSemanticRefactor = React.useCallback(() => {
        if (!activeTab) {
            return;
        }
        const next = activeTab.content.replace(/\bvar\b/g, 'const');
        setSemanticPreview(next.slice(0, 1200));
        setSnippetStatus(t('projectDashboard.editor.semanticPreviewReady'));
    }, [activeTab, t]);

    const applySemanticRefactor = React.useCallback(() => {
        if (!activeTab) {
            return;
        }
        updateTabContent(activeTab.content.replace(/\bvar\b/g, 'const'));
        setSnippetStatus(t('projectDashboard.editor.semanticApplied'));
    }, [activeTab, t, updateTabContent]);

    const previewRename = React.useCallback(async () => {
        if (!projectPath || !renameFrom || !renameTo) {
            return;
        }
        const preview = await window.electron.code.previewRenameSymbol(projectPath, renameFrom, renameTo, 200);
        const excluded = preview.updatedFiles.filter(file => new RegExp(excludePattern, 'i').test(file));
        if (excluded.length > 0) {
            setRenameImpact(t('projectDashboard.editor.renameBlocked', { count: excluded.length }));
            return;
        }
        setRenameImpact(t('projectDashboard.editor.renameImpact', { files: preview.totalFiles, occurrences: preview.totalOccurrences }));
    }, [excludePattern, projectPath, renameFrom, renameTo, t]);

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
        setTestOutput(output);
        const lines = output
            .split('\n')
            .filter(line => /fail|pass|error/i.test(line))
            .slice(0, 20);
        setDiagnosticLines(lines);
    }, [activeTab?.name, projectPath]);

    const handleEditorChange = React.useCallback((val?: string) => {
        if (!activeTab) {
            return;
        }
        const nextValue = val ?? '';
        updateTabContent(nextValue);
        if (!recordMacro) {
            return;
        }
        const prev = activeTab.content;
        if (nextValue !== prev) {
            setMacroSteps(previous => [...previous, nextValue].slice(-20));
        }
    }, [activeTab, recordMacro, updateTabContent]);

    const replayMacro = React.useCallback(() => {
        if (macroSteps.length === 0) {
            return;
        }
        const lastStep = macroSteps[macroSteps.length - 1];
        if (!lastStep) {
            return;
        }
        updateTabContent(lastStep);
        setSnippetStatus(t('projectDashboard.editor.macroReplayed'));
    }, [macroSteps, t, updateTabContent]);

    const exportMacro = React.useCallback(async () => {
        await window.electron.clipboard.writeText(JSON.stringify(macroSteps));
        setSnippetStatus(t('projectDashboard.editor.macroExported'));
    }, [macroSteps, t]);

    const importMacro = React.useCallback(async () => {
        const clip = await window.electron.clipboard.readText();
        if (!clip.success || !clip.text) {
            return;
        }
        try {
            const parsed = JSON.parse(clip.text) as string[];
            if (Array.isArray(parsed)) {
                setMacroSteps(parsed.filter(step => typeof step === 'string').slice(-20));
                setSnippetStatus(t('projectDashboard.editor.macroImported'));
            }
        } catch {
            setSnippetStatus(t('projectDashboard.editor.macroImportFailed'));
        }
    }, [t]);

    const runScratchCommand = React.useCallback(async () => {
        if (!projectPath || !scratchNote.trim()) {
            return;
        }
        const parts = scratchNote.trim().split(/\s+/);
        const command = parts[0];
        const args = parts.slice(1);
        if (!command) {
            return;
        }
        const result = await window.electron.runCommand(command, args, projectPath);
        setTestOutput(`${result.stdout}\n${result.stderr}`.trim());
    }, [projectPath, scratchNote]);

    const saveScratchAsDoc = React.useCallback(async () => {
        if (!projectPath) {
            return;
        }
        const path = `${projectPath}\\docs\\${scratchName}.md`;
        await window.electron.files.writeFile(path, scratchNote);
        setSnippetStatus(t('projectDashboard.editor.scratchSavedDoc'));
    }, [projectPath, scratchName, scratchNote, t]);

    const saveScratchAsTask = React.useCallback(async () => {
        if (!projectPath) {
            return;
        }
        const path = `${projectPath}\\tasks\\${scratchName}.txt`;
        await window.electron.files.writeFile(path, scratchNote);
        setSnippetStatus(t('projectDashboard.editor.scratchSavedTask'));
    }, [projectPath, scratchName, scratchNote, t]);

    const runAiCodeReview = React.useCallback(async () => {
        if (!activeTab) {
            return;
        }
        const report = await runCodeReviewAnalysis(projectPath, activeTab.name, activeTab.content, reviewRules);
        setReviewSummary(report.reviewComments.join('\n'));
    }, [activeTab, projectPath, reviewRules]);

    const runAiBugScan = React.useCallback(() => {
        if (!activeTab) {
            return;
        }
        const report = runBugDetectionAnalysis(activeTab.content);
        const lines = [
            `classification: ${report.classification}`,
            `confidence: ${report.confidenceScore.toFixed(2)}`,
            ...report.fixSuggestions,
            ...report.regressionSuggestions,
        ];
        setBugSummary(lines.join('\n'));
    }, [activeTab]);

    const runAiPerformanceScan = React.useCallback(() => {
        if (!activeTab) {
            return;
        }
        const report = runPerformanceSuggestionAnalysis(activeTab.content);
        const lines = [
            ...report.profilingNotes,
            ...report.databaseNotes,
            ...report.bundleNotes,
            ...report.cachingNotes,
            ...report.lazyLoadingNotes,
            ...report.performanceBudgets,
            ...report.buildTimeNotes,
            ...report.runtimeMonitoringNotes,
        ];
        setPerformanceSummary(lines.join('\n'));
    }, [activeTab]);

    return (
        <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-2 right-2 z-20 flex items-center gap-2 rounded border border-border/50 bg-background/90 p-2 text-xs flex-wrap max-w-[92%]">
                <select
                    value={selectedSnippetId}
                    onChange={event => setSelectedSnippetId(event.target.value)}
                    className="rounded border border-border/50 bg-background px-1 py-1"
                >
                    <option value="">{t('projectDashboard.editor.selectSnippet')}</option>
                    {snippets.map(snippet => (
                        <option key={snippet.id} value={snippet.id}>{snippet.name}</option>
                    ))}
                </select>
                <button className="secondary-btn text-xs px-2 py-1" onClick={insertSelectedSnippet}>
                    {t('projectDashboard.editor.insertSnippet')}
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={saveCurrentAsSnippet}>
                    {t('projectDashboard.editor.saveSnippet')}
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void exportSnippets(); }}>
                    {t('projectDashboard.editor.exportSnippets')}
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void importSnippets(); }}>
                    {t('projectDashboard.editor.importSnippets')}
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void shareSelectedSnippet(); }}>
                    {t('projectDashboard.editor.shareSnippet')}
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void importShareCode(); }}>
                    {t('projectDashboard.editor.importShareCode')}
                </button>
                <label className="flex items-center gap-1">
                    <input
                        type="checkbox"
                        checked={reviewRules.detectConsoleLog}
                        onChange={event => setReviewRules({ ...reviewRules, detectConsoleLog: event.target.checked })}
                    />
                    review:console
                </label>
                <label className="flex items-center gap-1">
                    <input
                        type="checkbox"
                        checked={reviewRules.detectAnyType}
                        onChange={event => setReviewRules({ ...reviewRules, detectAnyType: event.target.checked })}
                    />
                    review:any
                </label>
                <label className="flex items-center gap-1">
                    <input
                        type="checkbox"
                        checked={reviewRules.detectUnsafeEval}
                        onChange={event => setReviewRules({ ...reviewRules, detectUnsafeEval: event.target.checked })}
                    />
                    review:eval
                </label>
                <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void runAiCodeReview(); }}>
                    AI Review
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={runAiBugScan}>
                    AI Bug Scan
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={runAiPerformanceScan}>
                    AI Perf
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={previewSemanticRefactor}>
                    {t('projectDashboard.editor.semanticPreview')}
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={applySemanticRefactor}>
                    {t('projectDashboard.editor.semanticApply')}
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void runTestCommand('nearest'); }}>
                    {t('projectDashboard.editor.runNearestTest')}
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void runTestCommand('file'); }}>
                    {t('projectDashboard.editor.runFileTest')}
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void runTestCommand('suite'); }}>
                    {t('projectDashboard.editor.runSuiteTest')}
                </button>
                <label className="flex items-center gap-1">
                    <input type="checkbox" checked={enableInlayHints} onChange={e => setEnableInlayHints(e.target.checked)} />
                    {t('projectDashboard.editor.inlayHints')}
                </label>
                <label className="flex items-center gap-1">
                    <input type="checkbox" checked={enableCodeLens} onChange={e => setEnableCodeLens(e.target.checked)} />
                    {t('projectDashboard.editor.codeLens')}
                </label>
                <label className="flex items-center gap-1">
                    <input type="checkbox" checked={recordMacro} onChange={e => setRecordMacro(e.target.checked)} />
                    {t('projectDashboard.editor.recordMacro')}
                </label>
                <button className="secondary-btn text-xs px-2 py-1" onClick={replayMacro}>
                    {t('projectDashboard.editor.replayMacro')}
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void exportMacro(); }}>
                    {t('projectDashboard.editor.exportMacro')}
                </button>
                <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void importMacro(); }}>
                    {t('projectDashboard.editor.importMacro')}
                </button>
                {performanceMode && (
                    <button className="secondary-btn text-xs px-2 py-1" onClick={() => setPerformanceOverride(true)}>
                        {t('projectDashboard.editor.performanceModeAuto')}
                    </button>
                )}
                <span className="rounded border border-border/40 px-2 py-1 text-[10px] text-muted-foreground">
                    {capabilityBadge}
                </span>
            </div>
            {snippetStatus && (
                <div className="absolute top-12 right-2 z-20 text-xs text-muted-foreground rounded border border-border/40 bg-background/90 px-2 py-1">
                    {snippetStatus}
                </div>
            )}
            {semanticPreview && (
                <pre className="absolute top-20 right-2 z-20 w-[440px] max-h-48 overflow-auto text-[11px] rounded border border-border/40 bg-background/90 p-2">
                    {semanticPreview}
                </pre>
            )}
            <div className="absolute bottom-2 left-2 z-20 w-[520px] max-w-[90%] rounded border border-border/50 bg-background/90 p-2 space-y-2 text-xs">
                <div className="font-medium">{t('projectDashboard.editor.renameGuard')}</div>
                <div className="flex gap-1">
                    <input value={renameFrom} onChange={e => setRenameFrom(e.target.value)} placeholder={t('projectDashboard.editor.renameFrom')} className="px-1 py-1 border border-border/40 rounded bg-background" />
                    <input value={renameTo} onChange={e => setRenameTo(e.target.value)} placeholder={t('projectDashboard.editor.renameTo')} className="px-1 py-1 border border-border/40 rounded bg-background" />
                    <input value={excludePattern} onChange={e => setExcludePattern(e.target.value)} placeholder={t('projectDashboard.editor.excludePattern')} className="px-1 py-1 border border-border/40 rounded bg-background" />
                    <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void previewRename(); }}>
                        {t('projectDashboard.editor.previewRename')}
                    </button>
                </div>
                {renameImpact && <div className="text-muted-foreground">{renameImpact}</div>}
                {diagnosticLines.length > 0 && (
                    <div aria-live="polite" className="max-h-20 overflow-auto">
                        {diagnosticLines.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)}
                    </div>
                )}
                <div className="font-medium">{t('projectDashboard.editor.scratchpad')}</div>
                <div className="flex gap-1">
                    <input value={scratchName} onChange={e => setScratchName(e.target.value)} className="px-1 py-1 border border-border/40 rounded bg-background" />
                    <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void runScratchCommand(); }}>
                        {t('projectDashboard.editor.runScratch')}
                    </button>
                    <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void saveScratchAsDoc(); }}>
                        {t('projectDashboard.editor.saveScratchDoc')}
                    </button>
                    <button className="secondary-btn text-xs px-2 py-1" onClick={() => { void saveScratchAsTask(); }}>
                        {t('projectDashboard.editor.saveScratchTask')}
                    </button>
                </div>
                <textarea value={scratchNote} onChange={e => setScratchNote(e.target.value)} className="w-full min-h-[70px] px-1 py-1 border border-border/40 rounded bg-background" />
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
                    <CodeEditor
                        value={activeTab?.content ?? ''}
                        language={activeTab ? getLanguageFromExtension(activeTab.name) : 'typescript'}
                        onChange={handleEditorChange}
                        className="h-full w-full"
                        showMinimap={true}
                        fontSize={16}
                        initialLine={activeTab?.initialLine}
                        enableInlayHints={enableInlayHints}
                        enableCodeLens={enableCodeLens}
                        performanceMode={performanceMode}
                        aiSafetyFilterEnabled={true}
                        aiContextLimit={6000}
                        initialPosition={
                            activeViewState
                                ? { lineNumber: activeViewState.lineNumber, column: activeViewState.column }
                                : null
                        }
                        initialScrollTop={activeViewState?.scrollTop ?? null}
                        onCursorPositionChange={position => {
                            if (!activeTab) {
                                return;
                            }
                            persistViewState({
                                ...viewStateMap,
                                [activeTab.path]: {
                                    lineNumber: position.lineNumber,
                                    column: position.column,
                                    scrollTop: viewStateMap[activeTab.path]?.scrollTop ?? 0,
                                },
                            });
                        }}
                        onScrollPositionChange={scrollTop => {
                            if (!activeTab) {
                                return;
                            }
                            persistViewState({
                                ...viewStateMap,
                                [activeTab.path]: {
                                    lineNumber: viewStateMap[activeTab.path]?.lineNumber ?? 1,
                                    column: viewStateMap[activeTab.path]?.column ?? 1,
                                    scrollTop,
                                },
                            });
                        }}
                    />
                </div>
            )}
            {testOutput && (
                <pre className="absolute bottom-2 right-2 z-20 w-[480px] max-w-[90%] max-h-52 overflow-auto text-[11px] rounded border border-border/40 bg-background/90 p-2">
                    {testOutput}
                </pre>
            )}
            {(reviewSummary || bugSummary || performanceSummary) && (
                <pre className="absolute bottom-56 right-2 z-20 w-[520px] max-w-[90%] max-h-56 overflow-auto text-[11px] rounded border border-border/40 bg-background/90 p-2">
                    {[reviewSummary, bugSummary, performanceSummary].filter(Boolean).join('\n\n')}
                </pre>
            )}
            {!activeTab && emptyState}
        </div>
    );
};
