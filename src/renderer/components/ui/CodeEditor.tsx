import Editor, { Monaco, OnChange,OnMount } from '@monaco-editor/react';
import { Loader2 } from 'lucide-react';
import type * as monaco from 'monaco-editor';
import React, { useRef } from 'react';

import { useTheme } from '@/hooks/useTheme';
import { Language, useTranslation } from '@/i18n';
import { normalizeLanguage } from '@/utils/language-map';
import { initTextMateSupport } from '@/utils/textmate-loader';

export interface CodeEditorProps {
    value?: string | undefined;
    language?: string | undefined;
    onChange?: OnChange | undefined;
    theme?: string | undefined;
    readOnly?: boolean | undefined;
    className?: string | undefined;
    showMinimap?: boolean | undefined;
    fontSize?: number | undefined;
    initialLine?: number | undefined;
    appLanguage?: Language | undefined; // UI language
}

// Track if TextMate has been initialized globally
let textMateInitialized = false;
let textMateInitializing = false;

export const CodeEditor: React.FC<CodeEditorProps> = ({
    value,
    language = 'typescript',
    onChange,
    readOnly = false,
    className,
    showMinimap = true,
    fontSize,
    initialLine,
    appLanguage
}) => {
    const { isLight } = useTheme();
    const { t } = useTranslation(appLanguage);
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const decorationRef = useRef<string[]>([]);
    const monacoRef = useRef<Monaco | null>(null);

    // Normalize the language to a Monaco-compatible ID
    const normalizedLanguage = normalizeLanguage(language);

    const updateDecorations = (editor: monaco.editor.IStandaloneCodeEditor) => {
        if (!editor) { return; }
        const model = editor.getModel();
        if (!model) { return; }

        const lineCount = model.getLineCount();
        const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];

        for (let i = 1; i <= lineCount; i++) {
            const lineContent = model.getLineContent(i).trim();
            if (lineContent.length > 5 && !lineContent.startsWith('//') && !lineContent.startsWith('*')) {
                newDecorations.push({
                    range: { startLineNumber: i, startColumn: 1, endLineNumber: i, endColumn: 1 },
                    options: {
                        isWholeLine: false,
                        glyphMarginClassName: 'ai-gutter-sparkle',
                        glyphMarginHoverMessage: { value: t('ssh.editor.aiRefactor') }
                    }
                });
            }
        }

        decorationRef.current = editor.deltaDecorations(decorationRef.current, newDecorations);
    };

    const handleEditorDidMount: OnMount = async (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        // Initialize TextMate support (only once globally)
        if (!textMateInitialized && !textMateInitializing) {
            textMateInitializing = true;
            try {
                await initTextMateSupport(monaco);
                textMateInitialized = true;
                console.warn('[CodeEditor] TextMate support initialized');
            } catch (error) {
                console.warn('[CodeEditor] TextMate initialization failed, using Monaco defaults:', error);
            } finally {
                textMateInitializing = false;
            }
        }


        // Initial decorations
        updateDecorations(editor);

        // Click handler for gutter
        editor.onMouseDown((e: monaco.editor.IEditorMouseEvent) => {
            if (e.target.type === 2) { // 2 = Gutter Glyph Margin
                const line = e.target.position.lineNumber;
                document.dispatchEvent(new CustomEvent('ai-refactor-request', {
                    detail: { line, content: editor.getModel()?.getLineContent(line) }
                }));
            }
        });

        // Update on content change
        editor.onDidChangeModelContent(() => {
            // Debounce would be better here
            setTimeout(() => updateDecorations(editor), 500);
        });
    };

    // Inline Completions Provider registration
    React.useEffect(() => {
        if (!monacoRef.current) { return; }
        const monaco = monacoRef.current;

        const provider = monaco.languages.registerInlineCompletionsProvider(normalizedLanguage, {
            provideInlineCompletions: async (model: monaco.editor.ITextModel, position: monaco.Position) => {
                const textBefore = model.getValueInRange({
                    startLineNumber: 1,
                    startColumn: 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                });

                if (textBefore.trim().length === 0) { return { items: [] }; }

                try {
                    // Call backend for suggestion
                    const suggestion = await window.electron.project.getCompletion(textBefore);
                    if (!suggestion) { return { items: [] }; }

                    return {
                        items: [{
                            insertText: suggestion,
                            range: {
                                startLineNumber: position.lineNumber,
                                startColumn: position.column,
                                endLineNumber: position.lineNumber,
                                endColumn: position.column
                            }
                        }]
                    };
                } catch {
                    return { items: [] };
                }
            },
            freeInlineCompletions: () => { },
            handleItemDidShow: () => { }
        });

        return () => {
            provider.dispose();
        };
    }, [normalizedLanguage]);

    React.useEffect(() => {
        if (editorRef.current && initialLine) {
            const editor = editorRef.current;
            setTimeout(() => {
                editor.revealLineInCenter(initialLine);
                editor.setPosition({ lineNumber: initialLine, column: 1 });
                editor.focus();
            }, 100);
        }
    }, [initialLine]);

    // React to theme changes
    const monacoTheme = isLight ? 'light' : 'vs-dark';

    return (
        <div className={`relative w-full h-full overflow-hidden ${className}`}>
            <Editor
                height="100%"
                defaultLanguage={normalizedLanguage}
                language={normalizedLanguage}
                value={value ?? ''}
                onChange={onChange}
                theme={monacoTheme}
                onMount={handleEditorDidMount}
                loading={
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        {t('ssh.editor.initializing')}
                    </div>
                }
                options={{
                    minimap: { enabled: showMinimap },
                    fontSize: fontSize || 14,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    fontLigatures: true,
                    scrollBeyondLastLine: false,
                    readOnly: readOnly,
                    automaticLayout: true,
                    padding: { top: 16, bottom: 16 },
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                    formatOnPaste: true,
                    tabSize: 4,
                    glyphMargin: true,
                    lineNumbers: 'on',
                    folding: true,
                    lineDecorationsWidth: 10,
                }}
            />
        </div>
    );
};
