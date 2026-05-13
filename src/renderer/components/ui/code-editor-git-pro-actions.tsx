/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { diffLines } from 'diff';
import type { editor } from 'monaco-editor';
import React from 'react';
import ReactDOM from 'react-dom';

import { Button } from '@/components/ui/button';

interface useCodeEditorGitProActionsOptions {
    editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>;
    monacoRef: React.MutableRefObject<typeof import('monaco-editor') | null>;
    editorMounted: boolean;
    originalContent?: string;
    onOpenDiff?: (lineNumber: number) => void;
}

export function useCodeEditorGitProActions({
    editorRef,
    monacoRef,
    editorMounted,
    originalContent,
    onOpenDiff,
}: useCodeEditorGitProActionsOptions) {
    const [menuState, setMenuState] = React.useState<{
        lineNumber: number;
        top: number;
        left: number;
        change: {
            startLine: number;
            type: string;
            original: string[];
            modified: string[];
        };
    } | null>(null);

    const decorationIdsRef = React.useRef<string[]>([]);

    const handleRevert = () => {
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        if (!editor || !monaco || !menuState) {return;}

        const { change } = menuState;
        const model = editor.getModel();
        if (!model) {return;}

        const { startLine, original, modified, type } = change;
        const range = type === 'added' 
            ? new monaco.Range(startLine, 1, startLine + modified.length - 1, model.getLineMaxColumn(startLine + modified.length - 1))
            : new monaco.Range(startLine, 1, startLine + Math.max(0, modified.length - 1), model.getLineMaxColumn(startLine + Math.max(0, modified.length - 1)));

        const text = original.join('\n') + (original.length > 0 ? '\n' : '');

        editor.executeEdits('git-revert', [
            {
                range,
                text,
                forceMoveMarkers: true,
            },
        ]);
        setMenuState(null);
    };


    React.useEffect(() => {
        const editor = editorRef.current;
        const monaco = monacoRef.current;

        if (!editorMounted || !editor || !monaco || !originalContent) {return;}

        const updateDecorations = () => {
            const currentValue = editor.getValue();
            const normOriginal = originalContent.replace(/\r\n/g, '\n');
            const normModified = currentValue.replace(/\r\n/g, '\n');

            const changes = diffLines(normOriginal, normModified);
            let currentLine = 1;
            const newDecorations: editor.IModelDeltaDecoration[] = [];

            for (const change of changes) {
                const lineCount = change.count ?? 0;
                if (change.added || change.removed) {
                    const startLine = currentLine;
                    const endLine = change.added ? currentLine + lineCount - 1 : currentLine;
                    
                    const prevChange = changes[changes.indexOf(change) - 1];
                    const changeData = {
                        startLine,
                        type: change.added ? (prevChange?.removed ? 'modified' : 'added') : 'deleted',
                        original: change.removed ? change.value.split('\n').filter(l => l !== '') : (prevChange?.removed ? prevChange.value.split('\n').filter(l => l !== '') : []),
                        modified: change.added ? change.value.split('\n').filter(l => l !== '') : [],
                    };

                    newDecorations.push({
                        range: new monaco.Range(startLine, 1, startLine, 1),
                        options: {
                            glyphMarginClassName: 'git-action-glyph-bulb',
                            glyphMarginHoverMessage: { value: 'Click to see Git actions' },
                            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
                        },
                    });
                }
                if (!change.removed) {
                    currentLine += lineCount;
                }
            }

            console.log(`[GitActions] Applied ${newDecorations.length} glyph bulb decorations`);
            decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, newDecorations);
        };

        const disposable = editor.onDidChangeModelContent(() => updateDecorations());
        
        // Listen for clicks on the glyph margin
        const mouseDisposable = editor.onMouseDown((e) => {
            if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
                const lineNumber = e.target.position!.lineNumber;
                
                // Find the change for this line
                const currentValue = editor.getValue();
                const normOriginal = originalContent.replace(/\r\n/g, '\n');
                const normModified = currentValue.replace(/\r\n/g, '\n');
                const changes = diffLines(normOriginal, normModified);
                
                let currentLine = 1;
                let activeChange = null;
                for (const change of changes) {
                    const lineCount = change.count ?? 0;
                    if (change.added || change.removed) {
                        const startLine = currentLine;
                        const endLine = change.added ? currentLine + lineCount - 1 : currentLine;
                        if (lineNumber >= startLine && lineNumber <= endLine) {
                            const prevChange = changes[changes.indexOf(change) - 1];
                            activeChange = {
                                startLine,
                                type: change.added ? (prevChange?.removed ? 'modified' : 'added') : 'deleted',
                                original: change.removed ? change.value.split('\n').filter(l => l !== '') : (prevChange?.removed ? prevChange.value.split('\n').filter(l => l !== '') : []),
                                modified: change.added ? change.value.split('\n').filter(l => l !== '') : [],
                            };
                            break;
                        }
                    }
                    if (!change.removed) {
                        currentLine += lineCount;
                    }
                }

                if (activeChange) {
                    // Position the menu
                    const coords = editor.getScrolledVisiblePosition(e.target.position!);
                    if (coords) {
                        const editorRect = editor.getDomNode()?.getBoundingClientRect();
                        if (editorRect) {
                            setMenuState({
                                lineNumber,
                                top: coords.top + editorRect.top,
                                left: editorRect.left + 50, // Slightly to the right of glyph margin
                                change: activeChange
                            });
                        }
                    }
                }
            } else {
                setMenuState(null);
            }
        });

        updateDecorations();

        return () => {
            disposable.dispose();
            mouseDisposable.dispose();
            editor.deltaDecorations(decorationIdsRef.current, []);
        };
    }, [editorMounted, editorRef, monacoRef, originalContent]);

    const renderMenu = () => {
        if (!menuState) {return null;}

        return ReactDOM.createPortal(
            <div 
                className="fixed z-[1000] w-48 p-2 bg-popover border border-border shadow-xl rounded-md animate-in fade-in zoom-in duration-100"
                style={{ 
                    top: `${menuState.top}px`, 
                    left: `${menuState.left}px` 
                }}
                onMouseLeave={() => setMenuState(null)}
            >
                <div className="flex flex-col gap-1">
                    <div className="px-2 py-1 text-[10px] uppercase font-bold text-muted-foreground border-b border-border/50 mb-1">
                        Git Actions - Line {menuState.lineNumber}
                    </div>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="justify-start text-xs h-8 hover:bg-blue-500/10 hover:text-blue-500"
                        onClick={handleRevert}
                    >
                        Revert Changes
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="justify-start text-xs h-8 hover:bg-blue-500/10 hover:text-blue-500"
                        onClick={() => {
                            if (onOpenDiff) {onOpenDiff(menuState.lineNumber);}
                            setMenuState(null);
                        }}
                    >
                        Open Diff View
                    </Button>
                </div>
            </div>,
            document.body
        );
    };

    return { renderMenu };
}
