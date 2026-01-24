import { useEffect, useRef, useState } from 'react'

interface CodeEditorProps {
    content: string
    language?: string | undefined
    onChange?: ((value: string) => void) | undefined
    readonly?: boolean | undefined
}

// Dynamic import type
type EditorView = import('@codemirror/view').EditorView

export const CodeEditor = ({ content, language = 'javascript', onChange, readonly = false }: CodeEditorProps) => {
    const editorRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!editorRef.current) { return }

        let view: EditorView | null = null
        let mounted = true

        const initEditor = async () => {
            try {
                // Dynamic imports to avoid fully mixing meta-package and scoped packages (though we now strictly use scoped)
                const [
                    { EditorState },
                    { EditorView, lineNumbers, highlightActiveLineGutter, drawSelection, dropCursor, keymap, hoverTooltip, highlightActiveLine },
                    { defaultKeymap, history, historyKeymap },
                    { javascript },
                    { json },
                    { markdown },
                    { html },
                    { css },
                    { python },
                    { oneDark },
                    { closeBrackets, autocompletion, closeBracketsKeymap, completionKeymap }
                ] = await Promise.all([
                    import('@codemirror/state'),
                    import('@codemirror/view'),
                    import('@codemirror/commands'),
                    import('@codemirror/lang-javascript'),
                    import('@codemirror/lang-json'),
                    import('@codemirror/lang-markdown'),
                    import('@codemirror/lang-html'),
                    import('@codemirror/lang-css'),
                    import('@codemirror/lang-python'),
                    import('@codemirror/theme-one-dark'),
                    import('@codemirror/autocomplete')
                ])

                if (!mounted || !editorRef.current) { return }

                const getLanguageExtension = (lang: string) => {
                    switch (lang) {
                        case 'json': return json()
                        case 'markdown': return markdown()
                        case 'html': return html()
                        case 'css': return css()
                        case 'python': return python()
                        case 'typescript':
                        case 'javascript':
                        default: return javascript()
                    }
                }

                // Minimal setup equivalent to basicSetup but safe
                const minimalSetup = [
                    lineNumbers(),
                    highlightActiveLineGutter(),
                    history(),
                    drawSelection(),
                    dropCursor(),
                    EditorState.allowMultipleSelections.of(true),
                    highlightActiveLine(),
                    closeBrackets(),
                    autocompletion(),
                    keymap.of([
                        ...closeBracketsKeymap,
                        ...defaultKeymap,
                        ...historyKeymap,
                        ...completionKeymap
                    ])
                ]

                const startState = EditorState.create({
                    doc: content,
                    extensions: [
                        ...minimalSetup,
                        getLanguageExtension(language),
                        oneDark,
                        EditorView.theme({
                            "&": { height: "100%" },
                            ".cm-scroller": { overflow: "auto" },
                            ".cm-tooltip": { zIndex: "9999 !important" }
                        }),
                        EditorState.readOnly.of(readonly),
                        EditorView.updateListener.of((update) => {
                            if (update.docChanged && onChange) {
                                onChange(update.state.doc.toString())
                            }
                        }),
                        // Simple LSP Hover
                        hoverTooltip(async (view, pos) => {
                            const { from, to, text } = view.state.doc.lineAt(pos)
                            let start = pos, end = pos
                            while (start > from && /\w/.test(text[start - from - 1] || '')) { start-- }
                            while (end < to && /\w/.test(text[end - from] || '')) { end++ }
                            if (start === end) { return null }

                            const word = text.slice(start - from, end - from)

                            return {
                                pos: start,
                                end,
                                above: true,
                                create() {
                                    const dom = document.createElement("div")
                                    dom.className = "p-2 bg-popover border border-border/50 rounded text-xs text-foreground shadow-xl backdrop-blur-md"
                                    dom.textContent = `Symbol: ${word}`
                                    return { dom }
                                }
                            }
                        })
                    ]
                })

                view = new EditorView({
                    state: startState,
                    parent: editorRef.current
                })

                viewRef.current = view
                setIsLoading(false)
            } catch (err) {
                console.error('Failed to initialize CodeMirror:', err)
                setError(err instanceof Error ? err.message : 'Failed to load editor')
                setIsLoading(false)
            }
        }

        void initEditor()

        return () => {
            mounted = false
            if (view) {
                view.destroy()
            }
        }
        // Note: content and onChange are intentionally excluded to avoid recreating editor on every change
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [language, readonly])

    if (error) {
        return (
            <div className="h-full w-full flex items-center justify-center text-red-500 text-sm">
                <span>Editor error: {error}</span>
            </div>
        )
    }

    return (
        <div className="h-full w-full relative">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span>Loading editor...</span>
                    </div>
                </div>
            )}
            <div ref={editorRef} className="h-full w-full overflow-auto text-sm" />
        </div>
    )
}
