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
import type { FileSearchResult } from '@shared/types/common';
import type { WorkspaceDefinitionLocation } from '@shared/types/workspace';
import type { editor, IMarkdownString, IPosition, IRange, languages } from 'monaco-editor';
import React from 'react';

import { appLogger } from '@/utils/renderer-logger';

type MonacoWithMarkdown = Monaco & {
    MarkdownString: new (value: string) => IMarkdownString;
};

const GO_TO_DEFINITION_ACTION_ID = 'tengra.workspace.openSymbol';
const FIND_REFERENCES_ACTION_ID = 'tengra.workspace.symbolHistory';
const FIND_RELATED_ACTION_ID = 'tengra.workspace.relatedSymbols';
const MAX_REFERENCES_RESULTS = 200;
const MAX_RELATED_PREVIEW_ITEMS = 4;

export interface CodeEditorNavigationTarget {
    filePath: string;
    lineNumber: number;
    column?: number;
}

export interface CodeEditorWorkspaceResultsPayload {
    symbol: string;
    results: FileSearchResult[];
}

interface SymbolAtPosition {
    range: IRange;
    word: string;
}

interface WorkspaceIntelligenceLabels {
    open: string;
    history: string;
    related: string;
}

interface MonacoCodeActionKindShape {
    value: string;
}

interface MonacoKeyCodeShape {
    F12?: number;
}

interface MonacoKeyModShape {
    Shift?: number;
}

interface UseWorkspaceEditorIntelligenceOptions {
    editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>;
    monacoRef: React.MutableRefObject<Monaco | null>;
    editorMounted: boolean;
    workspacePath?: string;
    filePath?: string;
    language: string;
    labels: WorkspaceIntelligenceLabels;
    onNavigateToLocation?: (target: CodeEditorNavigationTarget) => void;
    onShowWorkspaceResults?: (payload: CodeEditorWorkspaceResultsPayload) => void;
}

function normalizeLineNumber(value: number): number {
    return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}

function normalizeDisplayPath(rootPath: string, candidatePath: string): string {
    const normalizedRoot = rootPath.replace(/\\/g, '/').replace(/\/+$/, '');
    const normalizedCandidate = candidatePath.replace(/\\/g, '/');
    if (normalizedCandidate.startsWith(`${normalizedRoot}/`)) {
        return normalizedCandidate.slice(normalizedRoot.length + 1);
    }
    return normalizedCandidate;
}

function toEditorError(error: Error | null | undefined): Error {
    if (error instanceof Error) {
        return error;
    }
    return new Error('Unknown workspace intelligence error');
}

function logWorkspaceIntelligenceWarning(message: string, error: Error | null | undefined): void {
    appLogger.warn('WorkspaceIntelligence', message, {
        error: toEditorError(error).message,
    });
}

function resolveQuickFixKind(monaco: Monaco): string {
    const kindCandidate = (
        monaco.languages as typeof monaco.languages & {
            CodeActionKind?: { QuickFix?: MonacoCodeActionKindShape };
        }
    ).CodeActionKind?.QuickFix;

    return kindCandidate?.value ?? 'quickfix';
}

function resolveEditorKeybindings(monaco: Monaco): {
    definition: number[];
    references: number[];
} {
    const keyCode = (monaco as Monaco & { KeyCode?: MonacoKeyCodeShape }).KeyCode?.F12;
    const shiftMod = (monaco as Monaco & { KeyMod?: MonacoKeyModShape }).KeyMod?.Shift;

    if (typeof keyCode !== 'number') {
        return {
            definition: [],
            references: [],
        };
    }

    return {
        definition: [keyCode],
        references: typeof shiftMod === 'number' ? [shiftMod | keyCode] : [],
    };
}

function resolveSymbolAtPosition(
    model: editor.ITextModel,
    position: { lineNumber: number; column: number }
): SymbolAtPosition | null {
    const wordAtPosition = model.getWordAtPosition(position);
    if (!wordAtPosition?.word) {
        return null;
    }

    return {
        word: wordAtPosition.word.trim(),
        range: {
            startLineNumber: position.lineNumber,
            startColumn: wordAtPosition.startColumn,
            endLineNumber: position.lineNumber,
            endColumn: wordAtPosition.endColumn,
        },
    };
}

function resolveImportSpecifierAtPosition(
    model: editor.ITextModel,
    position: { lineNumber: number; column: number }
): SymbolAtPosition | null {
    const lineContent = model.getLineContent(position.lineNumber);
    const specifierPattern = /['"`]([^'"`]+)['"`]/g;
    for (const match of lineContent.matchAll(specifierPattern)) {
        const fullMatch = match[0];
        const specifier = match[1]?.trim();
        const matchIndex = match.index;
        if (!specifier || typeof matchIndex !== 'number' || fullMatch.length < 2) {
            continue;
        }

        const startColumn = matchIndex + 2;
        const endColumn = startColumn + specifier.length;
        if (position.column < startColumn || position.column > endColumn) {
            continue;
        }

        return {
            word: specifier,
            range: {
                startLineNumber: position.lineNumber,
                startColumn,
                endLineNumber: position.lineNumber,
                endColumn,
            },
        };
    }

    return null;
}

function toMonacoFileUri(filePath: string): string {
    const normalizedPath = filePath.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
    if (/^[a-zA-Z]+:\/\//.test(normalizedPath)) {
        return normalizedPath;
    }
    if (/^[A-Za-z]:\//.test(normalizedPath)) {
        return `file:///${normalizedPath}`;
    }
    if (normalizedPath.startsWith('/')) {
        return `file://${normalizedPath}`;
    }
    return `file:///${normalizedPath}`;
}

function buildDefinitionHoverContents(
    monaco: Monaco,
    workspacePath: string,
    navigationTarget: SymbolAtPosition,
    definitions: WorkspaceDefinitionLocation[]
): languages.Hover | null {
    const firstDefinition = definitions[0];
    if (!firstDefinition) {
        return null;
    }

    const relativePath = normalizeDisplayPath(workspacePath, firstDefinition.file);
    return {
        range: new monaco.Range(
            navigationTarget.range.startLineNumber,
            navigationTarget.range.startColumn,
            navigationTarget.range.endLineNumber,
            navigationTarget.range.endColumn
        ),
        contents: [
            new (monaco as unknown as MonacoWithMarkdown).MarkdownString(`**${navigationTarget.word}**`),
            new (monaco as unknown as MonacoWithMarkdown).MarkdownString(`\`${relativePath}:${normalizeLineNumber(firstDefinition.line)}\``),
        ],
    };
}

function resolveSymbolFromSelection(editorInstance: editor.IStandaloneCodeEditor): string | null {
    const model = editorInstance.getModel();
    const position = editorInstance.getPosition();
    if (!model || !position) {
        return null;
    }

    const selectedText = model.getValueInRange(editorInstance.getSelection() ?? {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
    }).trim();

    if (selectedText.length > 0) {
        return selectedText;
    }

    return resolveSymbolAtPosition(model, position)?.word ?? null;
}

function buildHoverContents(
    monaco: Monaco,
    workspacePath: string,
    symbol: string,
    definition: FileSearchResult | null,
    relationships: FileSearchResult[]
): languages.Hover['contents'] {
    const contents: languages.Hover['contents'] = [new (monaco as unknown as MonacoWithMarkdown).MarkdownString(`**${symbol}**`)];

    if (definition) {
        const definitionPath = normalizeDisplayPath(workspacePath, definition.file);
        contents.push(new (monaco as unknown as MonacoWithMarkdown).MarkdownString(`\`${definitionPath}:${normalizeLineNumber(definition.line)}\``));
    }

    if (relationships.length > 0) {
        const preview = relationships
            .slice(0, MAX_RELATED_PREVIEW_ITEMS)
            .map(item => {
                const relativePath = normalizeDisplayPath(workspacePath, item.file);
                return `- \`${relativePath}:${normalizeLineNumber(item.line)}\``;
            })
            .join('\n');
        contents.push(new (monaco as unknown as MonacoWithMarkdown).MarkdownString(preview));
    }

    return contents;
}

function buildCodeActions(
    monaco: Monaco,
    symbol: string,
    labels: WorkspaceIntelligenceLabels,
    onNavigateToLocation?: (target: CodeEditorNavigationTarget) => void,
    onShowWorkspaceResults?: (payload: CodeEditorWorkspaceResultsPayload) => void
): languages.CodeAction[] {
    const actions: languages.CodeAction[] = [];
    const quickFixKind = resolveQuickFixKind(monaco);

    if (onNavigateToLocation) {
        actions.push({
            title: labels.open,
            kind: quickFixKind,
            command: {
                id: GO_TO_DEFINITION_ACTION_ID,
                title: labels.open,
                arguments: [symbol],
            },
        });
    }

    if (onShowWorkspaceResults || onNavigateToLocation) {
        actions.push({
            title: labels.history,
            kind: quickFixKind,
            command: {
                id: FIND_REFERENCES_ACTION_ID,
                title: labels.history,
                arguments: [symbol],
            },
        });
        actions.push({
            title: labels.related,
            kind: quickFixKind,
            command: {
                id: FIND_RELATED_ACTION_ID,
                title: labels.related,
                arguments: [symbol],
            },
        });
    }

    return actions;
}

export function useWorkspaceEditorIntelligence({
    editorRef,
    monacoRef,
    editorMounted,
    workspacePath,
    filePath,
    language,
    labels,
    onNavigateToLocation,
    onShowWorkspaceResults,
}: UseWorkspaceEditorIntelligenceOptions): void {
    React.useEffect(() => {
        let disposed = false;
        const editorInstance = editorRef.current;
        const monaco = monacoRef.current;

        if (!editorMounted || !editorInstance || !monaco || !workspacePath || !filePath) {
            return;
        }

        const modifierPressedRef = { current: false };

        const navigateToDefinition = async (symbolArg?: string): Promise<void> => {
            if (!onNavigateToLocation || disposed) {
                return;
            }

            const symbol = symbolArg?.trim() || resolveSymbolFromSelection(editorInstance);
            if (!symbol || disposed) {
                return;
            }

            try {
                const definition = await window.electron.code.findDefinition(workspacePath, symbol);
                if (!definition || disposed) {
                    return;
                }
                onNavigateToLocation({
                    filePath: definition.file,
                    lineNumber: normalizeLineNumber(definition.line),
                });
            } catch (error) {
                if (!disposed) {
                    logWorkspaceIntelligenceWarning('[CodeEditor] Failed to resolve definition', toEditorError(error instanceof Error ? error : undefined));
                }
            }
        };

        const resolveDefinitionAtPosition = async (
            position: IPosition
        ): Promise<WorkspaceDefinitionLocation[]> => {
            if (disposed) return [];
            const model = editorInstance.getModel();
            if (!model || model.isDisposed()) {
                return [];
            }

            try {
                const results = await window.electron.workspace.getFileDefinition(
                    workspacePath,
                    filePath,
                    model.getValue(),
                    position.lineNumber,
                    position.column
                );
                if (disposed) return [];
                return results;
            } catch (error) {
                if (!disposed) {
                    logWorkspaceIntelligenceWarning(
                        '[CodeEditor] Failed to resolve LSP definition at position',
                        toEditorError(error instanceof Error ? error : undefined)
                    );
                }
                return [];
            }
        };

        const showWorkspaceResults = async (
            symbolArg: string | undefined,
            resolver: (query: string) => Promise<FileSearchResult[]>
        ): Promise<void> => {
            if (disposed) return;
            const symbol = symbolArg?.trim() || resolveSymbolFromSelection(editorInstance);
            if (!symbol || disposed) {
                return;
            }

            try {
                const resolvedResults = await resolver(symbol);
                if (disposed) return;
                
                const limitedResults = resolvedResults
                    .filter(item => item.file.trim().length > 0)
                    .slice(0, MAX_REFERENCES_RESULTS);

                if (limitedResults.length === 0 || disposed) {
                    return;
                }

                if (onShowWorkspaceResults) {
                    onShowWorkspaceResults({
                        symbol,
                        results: limitedResults,
                    });
                    return;
                }

                if (onNavigateToLocation) {
                    const firstResult = limitedResults[0];
                    if (firstResult) {
                        onNavigateToLocation({
                            filePath: firstResult.file,
                            lineNumber: normalizeLineNumber(firstResult.line),
                        });
                    }
                }
            } catch (error) {
                if (!disposed) {
                    logWorkspaceIntelligenceWarning('[CodeEditor] Failed to resolve workspace symbol results', toEditorError(error instanceof Error ? error : undefined));
                }
            }
        };

        const hoverProvider = monaco.languages.registerHoverProvider(language, {
            provideHover: async (model: editor.ITextModel, position: IPosition) => {
                if (disposed || model.isDisposed()) return null;
                const activeModel = editorInstance.getModel();
                if (model.uri.toString() !== activeModel?.uri.toString()) {
                    return null;
                }

                if (!modifierPressedRef.current) {
                    return null;
                }

                const importTarget = resolveImportSpecifierAtPosition(model, position);
                if (importTarget) {
                    const definitions = await resolveDefinitionAtPosition(position);
                    if (disposed || model.isDisposed()) return null;
                    return buildDefinitionHoverContents(
                        monaco,
                        workspacePath,
                        importTarget,
                        definitions
                    );
                }

                const symbolAtPosition = resolveSymbolAtPosition(model, position);
                if (!symbolAtPosition) {
                    return null;
                }

                try {
                    const [definition, relationships] = await Promise.all([
                        window.electron.code.findDefinition(workspacePath, symbolAtPosition.word),
                        window.electron.code.getSymbolRelationships(
                            workspacePath,
                            symbolAtPosition.word,
                            MAX_RELATED_PREVIEW_ITEMS
                        ),
                    ]);

                    if (disposed || model.isDisposed()) return null;

                    if (!definition && relationships.length === 0) {
                        return null;
                    }

                    return {
                        range: new monaco.Range(
                            symbolAtPosition.range.startLineNumber,
                            symbolAtPosition.range.startColumn,
                            symbolAtPosition.range.endLineNumber,
                            symbolAtPosition.range.endColumn
                        ),
                        contents: buildHoverContents(
                            monaco,
                            workspacePath,
                            symbolAtPosition.word,
                            definition,
                            relationships
                        ),
                    };
                } catch (error) {
                    if (!disposed) {
                        logWorkspaceIntelligenceWarning('[CodeEditor] Failed to build hover data', toEditorError(error instanceof Error ? error : undefined));
                    }
                    return null;
                }
            },
        });

        const definitionProvider = monaco.languages.registerDefinitionProvider(language, {
            provideDefinition: async (model: editor.ITextModel, position: IPosition) => {
                if (disposed || model.isDisposed()) return [];
                const activeModel = editorInstance.getModel();
                if (model.uri.toString() !== activeModel?.uri.toString()) {
                    return [];
                }

                const definitions = await resolveDefinitionAtPosition(position);
                if (disposed || model.isDisposed()) return [];
                
                return definitions.map(definition => ({
                    uri: monaco.Uri.parse(toMonacoFileUri(definition.file)),
                    range: new monaco.Range(
                        definition.line,
                        definition.column,
                        definition.line,
                        definition.column
                    ),
                }));
            },
        });

        const quickFixKind = resolveQuickFixKind(monaco);
        const keybindings = resolveEditorKeybindings(monaco);

        const codeActionProvider = monaco.languages.registerCodeActionProvider(language, {
            providedCodeActionKinds: [quickFixKind],
            provideCodeActions: (model: editor.ITextModel, range: IRange) => {
                if (disposed || model.isDisposed()) return { actions: [], dispose: () => {} };
                const activeModel = editorInstance.getModel();
                if (model.uri.toString() !== activeModel?.uri.toString()) {
                    return {
                        actions: [],
                        dispose: () => {},
                    };
                }

                const symbol = model.getValueInRange(range).trim()
                    || resolveSymbolAtPosition(model, {
                        lineNumber: range.startLineNumber,
                        column: range.startColumn,
                    })?.word
                    || '';

                if (!symbol) {
                    return {
                        actions: [],
                        dispose: () => {},
                    };
                }

                return {
                    actions: buildCodeActions(
                        monaco,
                        symbol,
                        labels,
                        onNavigateToLocation,
                        onShowWorkspaceResults
                    ),
                    dispose: () => {},
                };
            },
        } as unknown as languages.CodeActionProvider);

        const goToDefinitionAction = editorInstance.addAction({
            id: GO_TO_DEFINITION_ACTION_ID,
            label: labels.open,
            keybindings: keybindings.definition,
            run: async () => {
                if (disposed) return;
                await navigateToDefinition();
            },
        });

        const findReferencesAction = editorInstance.addAction({
            id: FIND_REFERENCES_ACTION_ID,
            label: labels.history,
            keybindings: keybindings.references,
            run: async () => {
                if (disposed) return;
                await showWorkspaceResults(
                    undefined,
                    symbol => window.electron.code.findReferences(workspacePath, symbol)
                );
            },
        });

        const findRelatedAction = editorInstance.addAction({
            id: FIND_RELATED_ACTION_ID,
            label: labels.related,
            run: async () => {
                if (disposed) return;
                await showWorkspaceResults(
                    undefined,
                    symbol =>
                        window.electron.code.getSymbolRelationships(
                            workspacePath,
                            symbol,
                            MAX_REFERENCES_RESULTS
                        )
                );
            },
        });

        const mouseSubscription = editorInstance.onMouseDown(event => {
            if (disposed) return;
            const position = event.target.position;
            const mouseEvent = event.event;
            if (!position || !mouseEvent.leftButton || (!mouseEvent.ctrlKey && !mouseEvent.metaKey)) {
                return;
            }

            void resolveDefinitionAtPosition(position).then(definitions => {
                if (disposed) return;
                const firstDefinition = definitions[0];
                if (!firstDefinition || !onNavigateToLocation) {
                    return;
                }
                onNavigateToLocation({
                    filePath: firstDefinition.file,
                    lineNumber: firstDefinition.line,
                    column: firstDefinition.column,
                });
            });
        });

        const handleModifierState = (event: KeyboardEvent) => {
            if (disposed) return;
            modifierPressedRef.current = event.ctrlKey || event.metaKey;
        };
        const resetModifierState = () => {
            modifierPressedRef.current = false;
        };
        window.addEventListener('keydown', handleModifierState);
        window.addEventListener('keyup', handleModifierState);
        window.addEventListener('blur', resetModifierState);

        const diagnosticsCleanup = window.electron.ipcRenderer.on('lsp:diagnostics-updated', (_event, data: {
            uri: string;
            diagnostics: any[];
        }) => {
            if (disposed || !editorInstance || !monaco) return;
            const model = editorInstance.getModel();
            if (!model || model.isDisposed()) return;

            // Match current file URI
            const currentFileUri = toMonacoFileUri(filePath);
            
            const normalizedDataUri = decodeURIComponent(data.uri).toLowerCase();
            const normalizedCurrentUri = decodeURIComponent(currentFileUri).toLowerCase();
            
            if (normalizedDataUri !== normalizedCurrentUri) {
                return;
            }

            const markers = data.diagnostics.map(d => ({
                severity: d.severity === 1 ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
                message: d.message,
                startLineNumber: d.range.start.line + 1,
                startColumn: d.range.start.character + 1,
                endLineNumber: d.range.end.line + 1,
                endColumn: d.range.end.character + 1,
                source: d.source || 'lsp',
                code: d.code?.toString(),
            }));

            monaco.editor.setModelMarkers(model, 'lsp', markers);
        });

        return () => {
            disposed = true;
            hoverProvider.dispose();
            definitionProvider.dispose();
            codeActionProvider.dispose();
            goToDefinitionAction.dispose();
            findReferencesAction.dispose();
            findRelatedAction.dispose();
            mouseSubscription.dispose();
            window.removeEventListener('keydown', handleModifierState);
            window.removeEventListener('keyup', handleModifierState);
            window.removeEventListener('blur', resetModifierState);
            diagnosticsCleanup();
        };
    }, [
        editorMounted,
        editorRef,
        filePath,
        labels,
        language,
        monacoRef,
        onNavigateToLocation,
        onShowWorkspaceResults,
        workspacePath,
    ]);
}

