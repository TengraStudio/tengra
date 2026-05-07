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

import type { WorkspaceIssue } from '@/types/workspace';
import { appLogger } from '@/utils/renderer-logger';

const DIAGNOSTICS_OWNER = 'tengra-lsp';
const DIAGNOSTICS_DEBOUNCE_MS = 250;

interface UseCodeEditorDiagnosticsOptions {
    editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>;
    monacoRef: React.MutableRefObject<Monaco | null>;
    editorMounted: boolean;
    workspacePath?: string;
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

function toMarkerSeverity(monaco: Monaco, severity: WorkspaceIssue['severity']): number {
    switch (severity) {
        case 'error':
            return monaco.MarkerSeverity.Error;
        case 'warning':
            return monaco.MarkerSeverity.Warning;
        case 'info':
            return monaco.MarkerSeverity.Info;
        case 'hint':
            return monaco.MarkerSeverity.Hint;
        default:
            return monaco.MarkerSeverity.Warning;
    }
}

function toMarkerData(
    monaco: Monaco,
    model: editor.ITextModel,
    issue: WorkspaceIssue
): editor.IMarkerData {
    const startLineNumber = Math.max(1, issue.line);
    const startColumn = clampColumn(model, startLineNumber, issue.column ?? 1);
    const endColumn = Math.min(
        model.getLineMaxColumn(startLineNumber),
        Math.max(startColumn + 1, startColumn)
    );

    return {
        severity: toMarkerSeverity(monaco, issue.severity),
        message: issue.message,
        source: issue.source,
        code: typeof issue.code === 'number' ? String(issue.code) : issue.code,
        startLineNumber,
        startColumn,
        endLineNumber: startLineNumber,
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
    workspacePath,
    filePath,
}: UseCodeEditorDiagnosticsOptions): void {
    React.useEffect(() => {
        const editorInstance = editorRef.current;
        const monaco = monacoRef.current;
        const model = editorInstance?.getModel();

        if (!editorMounted || !editorInstance || !monaco || !model) {
            return;
        }

        let disposed = false;
        let requestVersion = 0;
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;

        const runDiagnostics = (): void => {
            if (!workspacePath || !filePath) {
                clearDiagnostics(monaco, model);
                return;
            }

            const nextRequestVersion = requestVersion + 1;
            requestVersion = nextRequestVersion;
            const currentModelUri = model.uri.toString();
            const content = model.getValue();

            void window.electron.workspace
                .getFileDiagnostics(workspacePath, filePath, content)
                .then(issues => {
                    if (disposed || nextRequestVersion !== requestVersion) {
                        return;
                    }
                    const activeModel = editorInstance.getModel();
                    if (activeModel?.uri.toString() !== currentModelUri) {
                        return;
                    }
                    const markers = issues.map(issue => toMarkerData(monaco, activeModel, issue));
                    monaco.editor.setModelMarkers(activeModel, DIAGNOSTICS_OWNER, markers);
                })
                .catch(error => {
                    if (disposed) {
                        return;
                    }
                    appLogger.warn('CodeEditorDiagnostics', 'Failed to refresh editor diagnostics', {
                        error: error instanceof Error ? error.message : String(error),
                    });
                    clearDiagnostics(monaco, model);
                });
        };

        const scheduleDiagnostics = (): void => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            debounceTimer = setTimeout(() => {
                runDiagnostics();
            }, DIAGNOSTICS_DEBOUNCE_MS);
        };

        const contentListener = editorInstance.onDidChangeModelContent(() => {
            scheduleDiagnostics();
        });

        runDiagnostics();

        return () => {
            disposed = true;
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            contentListener.dispose();
            clearDiagnostics(monaco, model);
        };
    }, [
        editorMounted,
        editorRef,
        filePath,
        monacoRef,
        workspacePath,
    ]);
}

