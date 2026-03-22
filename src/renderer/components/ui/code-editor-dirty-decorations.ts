import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import React from 'react';

interface UseCodeEditorDirtyDecorationsOptions {
    editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>;
    monacoRef: React.MutableRefObject<Monaco | null>;
    editorMounted: boolean;
    savedValue?: string;
}

function computeModifiedLineNumbers(savedValue: string, currentValue: string): number[] {
    const savedLines = savedValue.split(/\r?\n/);
    const currentLines = currentValue.split(/\r?\n/);

    let startIndex = 0;
    const maxPrefix = Math.min(savedLines.length, currentLines.length);
    while (startIndex < maxPrefix && savedLines[startIndex] === currentLines[startIndex]) {
        startIndex += 1;
    }

    if (startIndex === savedLines.length && startIndex === currentLines.length) {
        return [];
    }

    let savedEndIndex = savedLines.length - 1;
    let currentEndIndex = currentLines.length - 1;
    while (
        savedEndIndex >= startIndex &&
        currentEndIndex >= startIndex &&
        savedLines[savedEndIndex] === currentLines[currentEndIndex]
    ) {
        savedEndIndex -= 1;
        currentEndIndex -= 1;
    }

    const firstLineNumber = Math.max(1, startIndex + 1);
    const lastLineNumber = Math.max(firstLineNumber, currentEndIndex + 1);
    const modifiedLineNumbers: number[] = [];
    for (let lineNumber = firstLineNumber; lineNumber <= lastLineNumber; lineNumber += 1) {
        modifiedLineNumbers.push(lineNumber);
    }
    return modifiedLineNumbers;
}

export function useCodeEditorDirtyDecorations({
    editorRef,
    monacoRef,
    editorMounted,
    savedValue,
}: UseCodeEditorDirtyDecorationsOptions): void {
    const decorationIdsRef = React.useRef<string[]>([]);

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
                        color: '#f59e0b',
                        position: monaco.editor.OverviewRulerLane.Right,
                    },
                    minimap: {
                        color: '#f59e0b',
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
    }, [editorMounted, editorRef, monacoRef, savedValue]);
}
