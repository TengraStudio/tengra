import React, { useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Loader2 } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

interface CodeEditorProps {
    value?: string;
    language?: string;
    onChange?: (value: string | undefined) => void;
    theme?: string;
    readOnly?: boolean;
    className?: string;
    showMinimap?: boolean;
    fontSize?: number;
    initialLine?: number;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
    value,
    language = 'typescript',
    onChange,
    readOnly = false,
    className,
    showMinimap = true,
    fontSize,
    initialLine
}) => {
    const { isLight } = useTheme();
    const editorRef = useRef<any>(null);
    const decorationRef = useRef<string[]>([]);
    const monacoRef = useRef<any>(null);

    const updateDecorations = (editor: any) => {
        if (!editor) return;
        const model = editor.getModel();
        if (!model) return;

        const lineCount = model.getLineCount();
        const newDecorations: any[] = [];

        for (let i = 1; i <= lineCount; i++) {
            const lineContent = model.getLineContent(i).trim();
            if (lineContent.length > 5 && !lineContent.startsWith('//') && !lineContent.startsWith('*')) {
                newDecorations.push({
                    range: { startLineNumber: i, startColumn: 1, endLineNumber: i, endColumn: 1 },
                    options: {
                        isWholeLine: false,
                        glyphMarginClassName: 'ai-gutter-sparkle',
                        glyphMarginHoverMessage: { value: 'AI Refactor / Explain' }
                    }
                });
            }
        }

        decorationRef.current = editor.deltaDecorations(decorationRef.current, newDecorations);
    };

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        // Initial decorations
        updateDecorations(editor);

        // Click handler for gutter
        editor.onMouseDown((e: any) => {
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

        // Inline Completions (Ghost Text)
        monaco.languages.registerInlineCompletionsProvider(language, {
            provideInlineCompletions: async (model: any, position: any) => {
                const textBefore = model.getValueInRange({
                    startLineNumber: 1,
                    startColumn: 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                });

                if (textBefore.trim().length === 0) return { items: [] };

                try {
                    // Call backend for suggestion
                    const suggestion = await (window.electron as any).project.getCompletion(textBefore);
                    if (!suggestion) return { items: [] };

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
                } catch (error) {
                    return { items: [] };
                }
            },
            freeInlineCompletions: () => { }
        });
    };

    // Auto-scroll to initial line
    React.useEffect(() => {
        if (editorRef.current && initialLine) {
            const editor = editorRef.current;
            setTimeout(() => {
                editor.revealLineInCenter(initialLine);
                editor.setPosition({ lineNumber: initialLine, column: 1 });
                editor.focus();
            }, 100);
        }
    }, [initialLine, editorRef.current]);

    // React to theme changes
    const monacoTheme = isLight ? 'light' : 'vs-dark';

    return (
        <div className={`relative w-full h-full overflow-hidden ${className}`}>
            <Editor
                height="100%"
                defaultLanguage={language}
                language={language}
                value={value}
                onChange={onChange}
                theme={monacoTheme}
                onMount={handleEditorDidMount}
                loading={
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Initializing Editor...
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
