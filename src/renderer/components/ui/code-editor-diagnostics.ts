/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import React from 'react';
import * as protocol from 'vscode-languageserver-protocol';

import { setAnalyzing, useFileDiagnostics } from '@/store/diagnostics.store';
import { appLogger } from '@/utils/renderer-logger';

const DIAGNOSTICS_OWNER = 'tengra-lsp';

type WorkspaceCodeAction =
    | protocol.CodeAction
    | {
        title: string;
        command: string;
        arguments?: unknown[];
    };

interface UseCodeEditorDiagnosticsOptions {
    editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>;
    monacoRef: React.MutableRefObject<Monaco | null>;
    editorMounted: boolean;
    workspaceId?: string;
    filePath?: string;
}

function clampColumn(
    model: editor.ITextModel,
    lineNumber: number,
    column: number
): number {
    const lineMaxColumn = model.getLineMaxColumn(lineNumber);
    return Math.min(Math.max(1, column), lineMaxColumn);
}

function toMarkerSeverity(monaco: Monaco, severity: number | undefined): number {
    switch (severity) {
        case 1: // Error
            return monaco.MarkerSeverity.Error;
        case 2: // Warning
            return monaco.MarkerSeverity.Warning;
        case 3: // Information
            return monaco.MarkerSeverity.Info;
        case 4: // Hint
            return monaco.MarkerSeverity.Hint;
        default:
            return monaco.MarkerSeverity.Warning;
    }
}

function toMarkerData(
    monaco: Monaco,
    model: editor.ITextModel,
    diag: protocol.Diagnostic
): editor.IMarkerData {
    const startLineNumber = Math.max(1, diag.range.start.line + 1);
    const startColumn = clampColumn(model, startLineNumber, diag.range.start.character + 1);
    const endLineNumber = Math.max(1, diag.range.end.line + 1);
    const endColumn = clampColumn(model, endLineNumber, diag.range.end.character + 1);

    return {
        severity: toMarkerSeverity(monaco, diag.severity),
        message: diag.message,
        source: diag.source ?? 'tengra',
        code: typeof diag.code === 'number' ? String(diag.code) : (diag.code as string),
        startLineNumber,
        startColumn,
        endLineNumber,
        endColumn,
    };
}

function clearDiagnostics(monaco: Monaco, model: editor.ITextModel): void {
    monaco.editor.setModelMarkers(model, DIAGNOSTICS_OWNER, []);
}

export function useCodeEditorDiagnostics({
    editorRef,
    monacoRef,
    editorMounted,
    workspaceId,
    filePath,
}: UseCodeEditorDiagnosticsOptions): void {
    // Generate URI for the file
    const uri = React.useMemo(() => {
        if (!filePath) { return undefined; }
        const slashPath = filePath.replace(/\\/g, '/').replace(/\/+/g, '/');
        if (/^[A-Za-z]:\//.test(slashPath)) {
            return `file:///${slashPath}`;
        }
        return `file://${slashPath}`;
    }, [filePath]);

    const fileDiagnostics = useFileDiagnostics(workspaceId, uri);

    // Pull diagnostics on demand when model changes or file opens
    const triggerPull = React.useCallback(() => {
        if (!workspaceId || !filePath || !editorRef.current) { return; }

        const model = editorRef.current.getModel();
        if (!model) { return; }

        const languageId = model.getLanguageId();

        setAnalyzing(workspaceId, true);
        window.electron.workspace.pullDiagnostics({
            workspaceId,
            filePath,
            languageId
        }).finally(() => {
            setAnalyzing(workspaceId, false);
        }).catch(err => {
            appLogger.warn('CodeEditorDiagnostics', 'Failed to pull diagnostics', { error: err });
        });
    }, [workspaceId, filePath, editorRef]);

    React.useEffect(() => {
        if (!editorMounted) { return; }
        triggerPull();
    }, [editorMounted, triggerPull]);

    // Listen for file save to trigger diagnostics pull
    const saveDebounceRef = React.useRef<NodeJS.Timeout | null>(null);
    React.useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.filePath === filePath && detail?.workspaceId === workspaceId) {
                if (saveDebounceRef.current) {
                    clearTimeout(saveDebounceRef.current);
                }
                saveDebounceRef.current = setTimeout(() => {
                    triggerPull();
                    saveDebounceRef.current = null;
                }, 300);
            }
        };
        window.addEventListener('tengra:file-saved', handler);
        return () => {
            window.removeEventListener('tengra:file-saved', handler);
            if (saveDebounceRef.current) {
                clearTimeout(saveDebounceRef.current);
            }
        };
    }, [filePath, workspaceId, triggerPull]);

    React.useEffect(() => {
        const editorInstance = editorRef.current;
        const monaco = monacoRef.current;
        const model = editorInstance?.getModel();

        if (!editorMounted || !editorInstance || !monaco || !model || !uri) {
            return;
        }

        if (!fileDiagnostics) {
            clearDiagnostics(monaco, model);
            return;
        }

        try {
            const markers = fileDiagnostics.diagnostics.map(diag => toMarkerData(monaco, model, diag));
            monaco.editor.setModelMarkers(model, DIAGNOSTICS_OWNER, markers);
        } catch (error) {
            appLogger.warn('CodeEditorDiagnostics', 'Failed to update editor markers', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }, [
        editorMounted,
        editorRef,
        monacoRef,
        uri,
        fileDiagnostics
    ]);

    // Register CodeActionProvider for Quick Fixes
    React.useEffect(() => {
        const monaco = monacoRef.current;
        if (!editorMounted || !monaco || !workspaceId || !filePath) { return; }

        const model = editorRef.current?.getModel();
        if (!model) { return; }

        const languageId = model.getLanguageId();

        const disposable = monaco.languages.registerCodeActionProvider(languageId, {
            provideCodeActions: async (model, range, _context, _token) => {
                if (model.uri.toString() !== uri) { return { actions: [], dispose: () => { } }; }

                const lspRange = {
                    start: { line: range.startLineNumber - 1, character: range.startColumn - 1 },
                    end: { line: range.endLineNumber - 1, character: range.endColumn - 1 }
                };

                // Map Monaco markers back to LSP diagnostics if possible, or just send what we have
                const relevantDiagnostics = fileDiagnostics?.diagnostics.filter(d => {
                    const dStartLine = d.range.start.line + 1;
                    return dStartLine >= range.startLineNumber && dStartLine <= range.endLineNumber;
                }) ?? [];

                try {
                    const actions = await window.electron.workspace.getCodeActions({
                        workspaceId,
                        filePath,
                        languageId,
                        range: lspRange,
                        diagnostics: relevantDiagnostics
                    });

                    if (!actions) { return { actions: [], dispose: () => { } }; }

                    const typedActions = actions as WorkspaceCodeAction[];

                    return {
                        actions: typedActions.map(action => {
                            if ('command' in action && !('edit' in action)) {
                                // It's a Command
                                const commandAction = action as Extract<WorkspaceCodeAction, { command: string }>;
                                return {
                                    title: commandAction.title,
                                    command: {
                                        id: commandAction.command,
                                        arguments: commandAction.arguments,
                                        title: commandAction.title
                                    },
                                    kind: 'quickfix'
                                };
                            } else {
                                // It's a CodeAction
                                const ca = action as protocol.CodeAction;
                                return {
                                    title: ca.title,
                                    kind: ca.kind || 'quickfix',
                                    diagnostics: ca.diagnostics ? ca.diagnostics.map(d => toMarkerData(monacoRef.current as Monaco, model, d)) : undefined,
                                    isPreferred: ca.isPreferred,
                                    edit: ca.edit ? {
                                        edits: Object.entries(ca.edit.changes || {}).flatMap(([u, changes]: [string, protocol.TextEdit[]]) =>
                                            changes.map((c: protocol.TextEdit) => ({
                                                resource: monaco.Uri.parse(u),
                                                versionId: undefined,
                                                textEdit: {
                                                    range: {
                                                        startLineNumber: c.range.start.line + 1,
                                                        startColumn: c.range.start.character + 1,
                                                        endLineNumber: c.range.end.line + 1,
                                                        endColumn: c.range.end.character + 1
                                                    },
                                                    text: c.newText
                                                }
                                            }))
                                        )
                                    } : undefined,
                                    command: ca.command ? {
                                        id: ca.command.command,
                                        arguments: ca.command.arguments,
                                        title: ca.command.title
                                    } : undefined
                                };
                            }
                        }),
                        dispose: () => { }
                    };
                } catch (err) {
                    appLogger.warn('CodeEditorDiagnostics', 'Failed to provide code actions', { error: err });
                    return { actions: [], dispose: () => { } };
                }
            }
        });

        return () => disposable.dispose();
    }, [editorMounted, monacoRef, editorRef, workspaceId, filePath, uri, fileDiagnostics]);
}
