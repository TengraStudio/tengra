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
import { diffLines } from 'diff';
import type { editor } from 'monaco-editor';
import React from 'react';

import { resolveCssColorVariable } from '@/lib/theme-css';

interface UseCodeEditorDirtyDecorationsOptions {
    editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>;
    monacoRef: React.MutableRefObject<Monaco | null>;
    editorMounted: boolean;
    savedValue?: string;
}

function computeModifiedLineNumbers(savedValue: string, currentValue: string): number[] {
    if (savedValue === currentValue) {return [];}
    
    const normOriginal = savedValue.replace(/\r\n/g, '\n');
    const normModified = currentValue.replace(/\r\n/g, '\n');

    const changes = diffLines(normOriginal, normModified);
    const modifiedLines: number[] = [];
    let currentLine = 1;

    for (let i = 0; i < changes.length; i++) {
        const change = changes[i];
        if (change.added || change.removed) {
            // For dirty decorations, we just mark all lines in the added/removed block
            const count = change.count ?? 1;
            for (let j = 0; j < count; j++) {
                modifiedLines.push(currentLine + j);
            }
            if (change.added) {
                currentLine += count;
            }
        } else {
            currentLine += change.count ?? 0;
        }
    }
    
    return [...new Set(modifiedLines)];
}

export function useCodeEditorDirtyDecorations({
    editorRef,
    monacoRef,
    editorMounted,
    savedValue,
}: UseCodeEditorDirtyDecorationsOptions): void {
    const decorationIdsRef = React.useRef<string[]>([]);
    const dirtyDecorationColor = React.useMemo(
        () => resolveCssColorVariable('editor-dirty-decoration', 'hsl(38 92% 50%)'),
        []
    );

    React.useEffect(() => {
        const editorInstance = editorRef.current;
        const monaco = monacoRef.current;

        if (!editorMounted || !editorInstance || !monaco) {
            return;
        }
        const activeEditor = editorInstance;

        const applyDirtyDecorations = () => {
            const model = editorInstance.getModel();
            if (!model || typeof savedValue !== 'string') {
                decorationIdsRef.current = activeEditor.deltaDecorations(decorationIdsRef.current, []);
                return;
            }

            const modifiedLineNumbers = computeModifiedLineNumbers(savedValue, model.getValue());
            if (modifiedLineNumbers.length === 0) {
                decorationIdsRef.current = activeEditor.deltaDecorations(decorationIdsRef.current, []);
                return;
            }

            const decorations: editor.IModelDeltaDecoration[] = modifiedLineNumbers.map(lineNumber => ({
                range: new monaco.Range(lineNumber, 1, lineNumber, 1),
                options: {
                    isWholeLine: true,
                    overviewRuler: {
                        color: dirtyDecorationColor,
                        position: monaco.editor.OverviewRulerLane.Right,
                    },
                    minimap: {
                        color: dirtyDecorationColor,
                        position: monaco.editor.MinimapPosition.Inline,
                    },
                },
            }));

            decorationIdsRef.current = activeEditor.deltaDecorations(
                decorationIdsRef.current,
                decorations
            );
        };

        applyDirtyDecorations();
        const subscription = activeEditor.onDidChangeModelContent(() => {
            applyDirtyDecorations();
        });

        return () => {
            subscription.dispose();
            decorationIdsRef.current = activeEditor.deltaDecorations(decorationIdsRef.current, []);
        };
    }, [dirtyDecorationColor, editorMounted, editorRef, monacoRef, savedValue]);
}
