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

interface UseCodeEditorGitBlameOptions {
    editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>;
    monacoRef: React.MutableRefObject<Monaco | null>;
    editorMounted: boolean;
    filePath?: string;
    rootPath?: string;
}

export function useCodeEditorGitBlame({
    editorRef,
    monacoRef,
    editorMounted,
    filePath,
    rootPath,
}: UseCodeEditorGitBlameOptions): void {
    const decorationIdsRef = React.useRef<string[]>([]);
    const timerRef = React.useRef<NodeJS.Timeout | null>(null);

    React.useEffect(() => {
        const editorInstance = editorRef.current;
        const monaco = monacoRef.current;

        if (!editorMounted || !editorInstance || !monaco || !filePath || !rootPath) {
            return;
        }

        const fetchBlame = async (lineNumber: number) => {
            try {
                const result = await window.electron.git.getBlame(rootPath, filePath, lineNumber);
                if (result.success && result.lines && result.lines.length > 0) {
                    const lineInfo = result.lines[0];
                    const blameText = `    ${lineInfo.author}, ${lineInfo.authorTime} • ${lineInfo.summary}`;

                    const decorations: editor.IModelDeltaDecoration[] = [
                        {
                            range: new monaco.Range(lineNumber, 1, lineNumber, 1),
                            options: {
                                isWholeLine: false,
                                after: {
                                    content: blameText,
                                    inlineClassName: 'git-blame-inline',
                                },
                            },
                        },
                    ];

                    decorationIdsRef.current = editorInstance.deltaDecorations(
                        decorationIdsRef.current,
                        decorations
                    );
                } else {
                    decorationIdsRef.current = editorInstance.deltaDecorations(decorationIdsRef.current, []);
                }
            } catch (error) {
                console.error('Failed to fetch blame:', error);
            }
        };

        const debouncedFetchBlame = (lineNumber: number) => {
            if (timerRef.current) {clearTimeout(timerRef.current);}
            timerRef.current = setTimeout(() => fetchBlame(lineNumber), 500);
        };

        const subscription = editorInstance.onDidChangeCursorPosition((e) => {
            debouncedFetchBlame(e.position.lineNumber);
        });

        // Initial fetch for current position
        const currentPos = editorInstance.getPosition();
        if (currentPos) {
            fetchBlame(currentPos.lineNumber);
        }

        return () => {
            subscription.dispose();
            if (timerRef.current) {clearTimeout(timerRef.current);}
            if (editorInstance) {
                decorationIdsRef.current = editorInstance.deltaDecorations(decorationIdsRef.current, []);
            }
        };
    }, [editorMounted, editorRef, monacoRef, filePath, rootPath]);
}
