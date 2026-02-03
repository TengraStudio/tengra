import type { Monaco, OnChange } from '@monaco-editor/react';
import { Loader2 } from 'lucide-react';
import type { editor } from 'monaco-editor';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTheme } from '@/hooks/useTheme';
import { Language, useTranslation } from '@/i18n';
import { normalizeLanguage } from '@/utils/language-map';
import { initTextMateSupport } from '@/utils/textmate-loader';

type MonacoEditorInstance = editor.IStandaloneCodeEditor;

const loadMonaco = async () => {
    const [{ default: Editor, loader }, monaco] = await Promise.all([import('@monaco-editor/react'), import('monaco-editor')]);
    try { await loader.init(); } catch (e) { window.electron.log.error('Failed pre-load Monaco', e); }
    return { Editor, loader, monaco };
};

export interface CodeEditorProps {
    value?: string; language?: string; onChange?: OnChange; theme?: string; readOnly?: boolean;
    className?: string; showMinimap?: boolean; fontSize?: number; initialLine?: number; appLanguage?: Language;
}

let textMateInitialized = false;
let textMateInitializing = false;

const useMonacoLoader = () => {
    const [monacoComponents, setMonacoComponents] = useState<{ Editor: React.ComponentType<Record<string, unknown>>, loader: unknown, monaco: Monaco } | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        loadMonaco().then(({ Editor, loader, monaco }) => {
            setMonacoComponents({ Editor: Editor as React.ComponentType<Record<string, unknown>>, loader, monaco });
            setLoading(false);
        }).catch(e => {
            window.electron.log.error('Failed to load Monaco', e);
            setLoading(false);
        });
    }, []);
    return { monacoComponents, loading };
};

const useEditorDecorations = (monaco: Monaco | null, t: (key: string) => string) => {
    const decorationRef = useRef<string[]>([]);
    return useCallback((editor: MonacoEditorInstance) => {
        if (!monaco) {
            return;
        }
        const model = editor.getModel();
        if (!model) {
            return;
        }
        const lineCount = model.getLineCount();
        const newDecorations: editor.IModelDeltaDecoration[] = [];
        for (let i = 1; i <= lineCount; i++) {
            const content = model.getLineContent(i).trim();
            if (content.length > 5 && !content.startsWith('//') && !content.startsWith('*')) {
                newDecorations.push({
                    range: { startLineNumber: i, startColumn: 1, endLineNumber: i, endColumn: 1 },
                    options: { isWholeLine: false, glyphMarginClassName: 'ai-gutter-sparkle', glyphMarginHoverMessage: { value: t('ssh.editor.aiRefactor') } }
                });
            }
        }
        decorationRef.current = editor.deltaDecorations(decorationRef.current, newDecorations);
    }, [monaco, t]);
};

const useInlineCompletions = (monacoRef: React.MutableRefObject<Monaco | null>, normalizedLanguage: string, hasMonaco: boolean) => {
    useEffect(() => {
        if (!monacoRef.current || !hasMonaco) {
            return;
        }
        const monaco = monacoRef.current;
        const prov = monaco.languages.registerInlineCompletionsProvider(normalizedLanguage, {
            provideInlineCompletions: async (model: editor.ITextModel, pos: { lineNumber: number; column: number }) => {
                const before = model.getValueInRange({ startLineNumber: 1, startColumn: 1, endLineNumber: pos.lineNumber, endColumn: pos.column });
                if (before.trim().length === 0) {
                    return { items: [] };
                }
                try {
                    const sug = await window.electron.project.getCompletion(before);
                    if (!sug) {
                        return { items: [] };
                    }
                    return { items: [{ insertText: sug, range: { startLineNumber: pos.lineNumber, startColumn: pos.column, endLineNumber: pos.lineNumber, endColumn: pos.column } }] };
                } catch {
                    return { items: [] };
                }
            },
            freeInlineCompletions: () => { }, handleItemDidShow: () => { }
        });
        return () => { prov.dispose(); };
    }, [normalizedLanguage, hasMonaco, monacoRef]);
};

const useEditorLifecycle = (editorRef: React.MutableRefObject<MonacoEditorInstance | null>, monacoRef: React.MutableRefObject<Monaco | null>, updateDecorations: (editor: MonacoEditorInstance) => void) => {
    return useCallback(async (editor: MonacoEditorInstance, monaco: Monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        if (!textMateInitialized && !textMateInitializing) {
            textMateInitializing = true;
            try {
                await initTextMateSupport(monaco);
                textMateInitialized = true;
            } catch (e) {
                window.electron.log.warn('[CodeEditor] TextMate initialization failed', e as Error);
            } finally {
                textMateInitializing = false;
            }
        }
        updateDecorations(editor);
        editor.onMouseDown(e => {
            if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
                const line = e.target.position?.lineNumber;
                if (line) {
                    document.dispatchEvent(new CustomEvent('ai-refactor-request', { detail: { line, content: editor.getModel()?.getLineContent(line) } }));
                }
            }
        });
        editor.onDidChangeModelContent(() => {
            setTimeout(() => { updateDecorations(editor); }, 500);
        });
    }, [updateDecorations, editorRef, monacoRef]);
};

const LoadingOverlay = ({ className, t }: { className?: string, t: (k: string) => string }) => (
    <div className={`relative w-full h-full overflow-hidden ${className} flex items-center justify-center`}>
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-sm">{t('common.loading')}</span>
        </div>
    </div>
);

const useEditorInitialLine = (editorRef: React.MutableRefObject<MonacoEditorInstance | null>, initialLine?: number) => {
    useEffect(() => {
        if (editorRef.current && initialLine) {
            const ed = editorRef.current;
            setTimeout(() => {
                ed.revealLineInCenter(initialLine);
                ed.setPosition({ lineNumber: initialLine, column: 1 });
                ed.focus();
            }, 100);
        }
    }, [initialLine, editorRef]);
};

const EditorContainer: React.FC<{
    Editor: React.ComponentType<Record<string, unknown>>,
    normalizedLanguage: string,
    value: string,
    onChange?: OnChange,
    theme: string,
    onMount: (e: MonacoEditorInstance, m: Monaco) => void,
    loading: React.ReactNode,
    options: editor.IStandaloneEditorConstructionOptions,
    className?: string
}> = ({ Editor, normalizedLanguage, value, onChange, theme, onMount, loading, options, className }) => (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
        <Editor height="100%" defaultLanguage={normalizedLanguage} language={normalizedLanguage} value={value} onChange={onChange} theme={theme} onMount={onMount} loading={loading} options={options} />
    </div>
);

export const CodeEditor: React.FC<CodeEditorProps> = ({ value, language = 'typescript', onChange, readOnly = false, className, showMinimap = true, fontSize, initialLine, appLanguage }) => {
    const { isLight } = useTheme();
    const { t } = useTranslation(appLanguage);
    const editorRef = useRef<MonacoEditorInstance | null>(null);
    const monacoRef = useRef<Monaco | null>(null);
    const { monacoComponents, loading } = useMonacoLoader();
    const updateDecorations = useEditorDecorations(monacoComponents?.monaco ?? null, t);
    const normalizedLanguage = normalizeLanguage(language);

    useInlineCompletions(monacoRef, normalizedLanguage, !!monacoComponents);
    useEditorInitialLine(editorRef, initialLine);

    const handleEditorDidMount = useEditorLifecycle(editorRef, monacoRef, updateDecorations);

    const editorOptions = useMemo((): editor.IStandaloneEditorConstructionOptions => ({
        minimap: { enabled: showMinimap }, fontSize: fontSize ?? 14, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontLigatures: true, scrollBeyondLastLine: false, readOnly, automaticLayout: true, padding: { top: 16, bottom: 16 }, smoothScrolling: true, cursorBlinking: 'smooth', cursorSmoothCaretAnimation: 'on', formatOnPaste: true, tabSize: 4, glyphMargin: true, lineNumbers: 'on', folding: true, lineDecorationsWidth: 10
    }), [showMinimap, fontSize, readOnly]);

    if (loading || !monacoComponents) {
        return <LoadingOverlay className={className} t={t} />;
    }

    return (
        <EditorContainer
            Editor={monacoComponents.Editor}
            normalizedLanguage={normalizedLanguage}
            value={value ?? ''}
            onChange={onChange}
            theme={isLight ? 'light' : 'vs-dark'}
            onMount={(e: MonacoEditorInstance, m: Monaco) => { void handleEditorDidMount(e, m); }}
            loading={<div className="flex items-center justify-center h-full text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" />{t('ssh.editor.initializing')}</div>}
            options={editorOptions}
            className={className}
        />
    );
};
