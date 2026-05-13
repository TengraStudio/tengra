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

interface UseCodeEditorGitDecorationsOptions {
    editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>;
    monacoRef: React.MutableRefObject<Monaco | null>;
    editorMounted: boolean;
    originalContent?: string;
    gitStatus?: string;
}

interface GitDecorationRange {
    start: number;
    end: number;
}

function computeGitDecorations(original: string, modified: string) {
    const normOriginal = original.replace(/\r\n/g, '\n');
    const normModified = modified.replace(/\r\n/g, '\n');

    const changes = diffLines(normOriginal, normModified);
    const added: GitDecorationRange[] = [];
    const modifiedLines: GitDecorationRange[] = [];
    const deleted: number[] = [];

    let currentLine = 1;

    for (let i = 0; i < changes.length; i++) {
        const change = changes[i];
        const nextChange = changes[i + 1];

        if (change.added) {
            const prevChange = changes[i - 1];
            if (prevChange?.removed) {
                modifiedLines.push({
                    start: currentLine,
                    end: currentLine + (change.count ?? 1) - 1,
                });
            } else {
                added.push({
                    start: currentLine,
                    end: currentLine + (change.count ?? 1) - 1,
                });
            }
            currentLine += change.count ?? 0;
        } else if (change.removed) {
            if (!nextChange?.added) {
                deleted.push(currentLine);
            }
            // If followed by added, we handle it in the next iteration as modified
        } else {
            currentLine += change.count ?? 0;
        }
    }

    return { added, modified: modifiedLines, deleted };
}

export function useCodeEditorGitDecorations({
    editorRef,
    monacoRef,
    editorMounted,
    originalContent,
    gitStatus,
}: UseCodeEditorGitDecorationsOptions): void {
    const decorationIdsRef = React.useRef<string[]>([]);
    const gitAddedColor = React.useMemo(
        () => resolveCssColorVariable('git-added', 'hsl(142 71% 45%)'),
        []
    );
    const gitModifiedColor = React.useMemo(
        () => resolveCssColorVariable('git-modified', 'hsl(210 100% 50%)'),
        []
    );

    React.useEffect(() => {
        const editorInstance = editorRef.current;
        const monaco = monacoRef.current;

        if (!editorMounted || !editorInstance || !monaco) {
            return;
        }
        const activeEditor = editorInstance;

        const applyGitDecorations = () => {
            const model = editorInstance.getModel();
            if (!model) {return;}

            const isNewFile = gitStatus === 'A' || gitStatus === '?' || gitStatus === '??' || gitStatus?.includes('A');

            if (isNewFile && !originalContent) {
                const lineCount = model.getLineCount();
                const decorations: editor.IModelDeltaDecoration[] = [
                    {
                        range: new monaco.Range(1, 1, lineCount, 1),
                        options: {
                            isWholeLine: true,
                            linesDecorationsClassName: 'git-gutter-added',
                            overviewRuler: {
                                color: gitAddedColor,
                                position: monaco.editor.OverviewRulerLane.Full,
                            },
                        },
                    },
                ];
                decorationIdsRef.current = activeEditor.deltaDecorations(
                    decorationIdsRef.current,
                    decorations
                );
                return;
            }

            const { added, modified, deleted } = computeGitDecorations(originalContent || '', model.getValue());

            const decorations: editor.IModelDeltaDecoration[] = [
                ...added.map(range => ({
                    range: new monaco.Range(range.start, 1, range.end, 1),
                    options: {
                        isWholeLine: true,
                        linesDecorationsClassName: 'git-gutter-added',
                        overviewRuler: {
                            color: gitAddedColor,
                            position: monaco.editor.OverviewRulerLane.Full,
                        },
                    },
                })),
                ...modified.map(range => ({
                    range: new monaco.Range(range.start, 1, range.end, 1),
                    options: {
                        isWholeLine: true,
                        linesDecorationsClassName: 'git-gutter-modified',
                        overviewRuler: {
                            color: gitModifiedColor,
                            position: monaco.editor.OverviewRulerLane.Full,
                        },
                    },
                })),
                ...deleted.map(lineNumber => ({
                    range: new monaco.Range(lineNumber, 1, lineNumber, 1),
                    options: {
                        isWholeLine: true,
                        linesDecorationsClassName: 'git-gutter-deleted',
                    },
                })),
            ];

            decorationIdsRef.current = activeEditor.deltaDecorations(
                decorationIdsRef.current,
                decorations
            );
        };

        applyGitDecorations();
        const subscription = activeEditor.onDidChangeModelContent(() => {
            applyGitDecorations();
        });

        return () => {
            subscription.dispose();
            decorationIdsRef.current = activeEditor.deltaDecorations(decorationIdsRef.current, []);
        };
    }, [gitAddedColor, gitModifiedColor, editorMounted, editorRef, monacoRef, originalContent, gitStatus]);
}
