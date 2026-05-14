/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CodeEditor } from '@/components/ui/CodeEditor';

const mockRegisterInlineCompletionsProvider = vi.fn(() => ({
    dispose: vi.fn(),
}));
const mockRegisterCommand = vi.fn(() => ({
    dispose: vi.fn(),
}));
const mockRegisterHoverProvider = vi.fn(() => ({
    dispose: vi.fn(),
}));
const mockRegisterCodeActionProvider = vi.fn(() => ({
    dispose: vi.fn(),
}));
const mockRegisterDefinitionProvider = vi.fn(() => ({
    dispose: vi.fn(),
}));
const mockSetModelMarkers = vi.fn();
const mockSetEagerModelSync = vi.fn();
const mockSetCompilerOptions = vi.fn();
const mockSetDiagnosticsOptions = vi.fn();
const mockMonacoEditorComponent = vi.fn((_props?: { path?: string; options?: object }) => <div data-testid="mock-monaco-editor" />);

const mockModel = {
    uri: {
        toString: () => 'file:////workspace/src/index.tsx',
    },
    getLineCount: () => 1,
    getLineContent: () => 'const answer = 42;',
    getLineMaxColumn: () => 19,
    getValue: () => 'const answer = 42;',
    getValueInRange: () => 'const answer = 42;',
};

const mockEditor = {
    getModel: () => mockModel,
    deltaDecorations: vi.fn(() => []),
    addAction: vi.fn(() => ({
        dispose: vi.fn(),
    })),
    onMouseDown: vi.fn(() => ({
        dispose: vi.fn(),
    })),
    onDidChangeModelContent: vi.fn(() => ({
        dispose: vi.fn(),
    })),
    setPosition: vi.fn(),
    setScrollTop: vi.fn(),
    onDidChangeCursorPosition: vi.fn(),
    onDidScrollChange: vi.fn(),
    revealLineInCenter: vi.fn(),
    focus: vi.fn(),
};

const mockMonaco = {
    MarkerSeverity: {
        Hint: 1,
        Info: 2,
        Warning: 4,
        Error: 8,
    },
    editor: {
        defineTheme: vi.fn(),
        setTheme: vi.fn(),
        setModelMarkers: mockSetModelMarkers,
        registerCommand: mockRegisterCommand,
        OverviewRulerLane: {
            Right: 4,
        },
        MinimapPosition: {
            Inline: 1,
        },
        MouseTargetType: {
            GUTTER_GLYPH_MARGIN: 2,
        },
    },
    Uri: {
        parse: (value: string) => ({ toString: () => value }),
    },
    Range: class {
        constructor(
            public startLineNumber: number,
            public startColumn: number,
            public endLineNumber: number,
            public endColumn: number
        ) { }
    },
    languages: {
        registerInlineCompletionsProvider: mockRegisterInlineCompletionsProvider,
        registerHoverProvider: mockRegisterHoverProvider,
        registerCodeActionProvider: mockRegisterCodeActionProvider,
        registerDefinitionProvider: mockRegisterDefinitionProvider,
        typescript: {
            JsxEmit: { ReactJSX: 4 },
            ModuleResolutionKind: { NodeJs: 2 },
            ModuleKind: { ESNext: 99 },
            ScriptTarget: { ES2022: 9 },
            javascriptDefaults: {
                setEagerModelSync: mockSetEagerModelSync,
                setCompilerOptions: mockSetCompilerOptions,
                setDiagnosticsOptions: mockSetDiagnosticsOptions,
            },
            typescriptDefaults: {
                setEagerModelSync: mockSetEagerModelSync,
                setCompilerOptions: mockSetCompilerOptions,
                setDiagnosticsOptions: mockSetDiagnosticsOptions,
            },
        },
    },
};

vi.mock('@monaco-editor/react', () => {
    const MockMonacoEditor = ({
        onMount,
        path,
        options,
    }: {
        onMount: (editorInstance: typeof mockEditor, monacoInstance: typeof mockMonaco) => void;
        path?: string;
        options?: object;
    }) => {
        useEffect(() => {
            onMount(mockEditor, mockMonaco);
        }, [onMount]);

        return mockMonacoEditorComponent({ path, options });
    };

    return {
        default: MockMonacoEditor,
    };
});

vi.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ isLight: false }),
}));

vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('@/store/settings.store', () => ({
    useSettingsStore: (selector: (snapshot: {
        settings: {
            general: {
                inlineSuggestionsEnabled: boolean;
                inlineSuggestionsSource: 'custom';
                inlineSuggestionsProvider: string;
                inlineSuggestionsModel: string;
            }
        }
    }) => unknown) =>
        selector({
            settings: {
                general: {
                    inlineSuggestionsEnabled: true,
                    inlineSuggestionsSource: 'custom',
                    inlineSuggestionsProvider: 'openai',
                    inlineSuggestionsModel: 'gpt-4o-mini',
                },
            },
        }),
}));

vi.mock('@/store/code-editor-health.store', () => ({
    recordCodeEditorFailure: vi.fn(),
    recordCodeEditorSuccess: vi.fn(),
    setCodeEditorUiState: vi.fn(),
}));

vi.mock('@/utils/monaco-loader.util', () => ({
    ensureMonacoInitialized: vi.fn(async () => mockMonaco),
}));

vi.mock('@/utils/textmate-loader', () => ({
    initTextMateSupport: vi.fn(async () => { }),
}));

describe('CodeEditor inline suggestions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(window, 'electron', {
            value: {
                workspace: {
                    getInlineSuggestion: vi.fn(),
                    getFileDiagnostics: vi.fn().mockResolvedValue([]),
                    getFileDefinition: vi.fn().mockResolvedValue([]),
                    trackInlineSuggestionStats: vi.fn().mockResolvedValue({ success: true }),
                },
                code: {
                    findDefinition: vi.fn().mockResolvedValue(null),
                    getSymbolRelationships: vi.fn().mockResolvedValue([]),
                    findReferences: vi.fn().mockResolvedValue([]),
                },
                log: {
                    warn: vi.fn(),
                    error: vi.fn(),
                },
            },
            configurable: true,
            writable: true,
        });
    });

    it('registers the inline completions provider after the editor mounts', async () => {
        render(<CodeEditor value="const answer = 42;" language="typescript" />);

        await waitFor(() => {
            expect(mockRegisterInlineCompletionsProvider).toHaveBeenCalledWith(
                'typescript',
                expect.objectContaining({
                    provideInlineCompletions: expect.any(Function),
                })
            );
        });
    });

    it('registers workspace code actions when Monaco omits CodeActionKind metadata', async () => {
        render(
            <CodeEditor
                value="const answer = 42;"
                language="typescript"
                workspacePath="/workspace"
                filePath="/workspace/index.ts"
            />
        );

        await waitFor(() => {
            expect(mockRegisterCodeActionProvider).toHaveBeenCalledWith(
                'typescript',
                expect.objectContaining({
                    providedCodeActionKinds: ['quickfix'],
                })
            );
        });
    });

    it('passes the workspace file path to the Monaco model as a file URI', async () => {
        render(
            <CodeEditor
                value="export const value = 1;"
                language="typescript"
                workspacePath="/workspace"
                filePath="/workspace/src/index.tsx"
            />
        );

        await waitFor(() => {
            expect(mockMonacoEditorComponent).toHaveBeenCalledWith(
                expect.objectContaining({
                    path: 'file:///workspace/src/index.tsx',
                })
            );
        });
    });

    it('requests backend file diagnostics and applies them as Monaco markers', async () => {
        const getFileDiagnosticsMock = vi.fn().mockResolvedValue([
            {
                severity: 'error',
                message: 'Type mismatch',
                file: 'src/index.tsx',
                line: 1,
                column: 7,
                source: 'typescript',
                code: 2322,
            },
        ]);
        Object.defineProperty(window, 'electron', {
            value: {
                workspace: {
                    getInlineSuggestion: vi.fn(),
                    getFileDiagnostics: getFileDiagnosticsMock,
                    getFileDefinition: vi.fn().mockResolvedValue([]),
                    trackInlineSuggestionStats: vi.fn().mockResolvedValue({ success: true }),
                },
                code: {
                    findDefinition: vi.fn().mockResolvedValue(null),
                    getSymbolRelationships: vi.fn().mockResolvedValue([]),
                    findReferences: vi.fn().mockResolvedValue([]),
                },
                log: {
                    warn: vi.fn(),
                    error: vi.fn(),
                },
            },
            configurable: true,
            writable: true,
        });

        render(
            <CodeEditor
                value="const answer = 42;"
                language="typescript"
                workspacePath="/workspace"
                filePath="/workspace/src/index.tsx"
            />
        );

        await waitFor(() => {
            const firstCall = getFileDiagnosticsMock.mock.calls[0];
            expect(firstCall).toBeDefined();
            const normalizedWorkspacePath = String(firstCall?.[0]).replace(/\\\\/g, '\\');
            const normalizedFilePath = String(firstCall?.[1]).replace(/\\\\/g, '\\');
            expect(normalizedWorkspacePath).toBe('/workspace');
            expect(normalizedFilePath).toBe('/workspace/src/index.tsx');
            expect(firstCall?.[2]).toBe('const answer = 42;');
            expect(mockSetModelMarkers).toHaveBeenCalledWith(
                mockModel,
                'tengra-lsp',
                [
                    expect.objectContaining({
                        message: 'Type mismatch',
                        source: 'typescript',
                        code: '2322',
                        startLineNumber: 1,
                        startColumn: 7,
                        severity: 8,
                    }),
                ]
            );
        });
    });

    it('registers a definition provider and enables the main editor minimap', async () => {
        render(
            <CodeEditor
                value="import { Popover } from '@/components/ui/popover';"
                language="typescript"
                workspacePath="/workspace"
                filePath="/workspace/src/index.tsx"
            />
        );

        await waitFor(() => {
            expect(mockRegisterDefinitionProvider).toHaveBeenCalledWith(
                'typescript',
                expect.objectContaining({
                    provideDefinition: expect.any(Function),
                })
            );
            expect(mockMonacoEditorComponent).toHaveBeenCalledWith(
                expect.objectContaining({
                    options: expect.objectContaining({
                        minimap: expect.objectContaining({
                            enabled: true,
                            showSlider: 'always',
                        }),
                    }),
                })
            );
        });
    });

    it('adds minimap dirty markers when the editor content differs from the saved value', async () => {
        render(
            <CodeEditor
                value="const answer = 42;"
                savedValue="const answer = 1;"
                language="typescript"
            />
        );

        await waitFor(() => {
            expect(mockEditor.deltaDecorations).toHaveBeenCalledWith(
                expect.any(Array),
                expect.arrayContaining([
                    expect.objectContaining({
                        options: expect.objectContaining({
                            minimap: expect.objectContaining({
                                color: expect.any(String),
                            }),
                            overviewRuler: expect.objectContaining({
                                color: expect.any(String),
                            }),
                        }),
                    }),
                ])
            );
        });
    });
});

