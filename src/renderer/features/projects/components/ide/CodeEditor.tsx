import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { hoverTooltip } from '@codemirror/view'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { python } from '@codemirror/lang-python'
import { oneDark } from '@codemirror/theme-one-dark'

interface CodeEditorProps {
    content: string
    language?: string
    onChange?: (value: string) => void
    readonly?: boolean
}

export const CodeEditor = ({ content, language = 'javascript', onChange, readonly = false }: CodeEditorProps) => {
    const editorRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)

    useEffect(() => {
        if (!editorRef.current) return

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

        const startState = EditorState.create({
            doc: content,
            extensions: [
                basicSetup,
                getLanguageExtension(language),
                oneDark,
                EditorView.theme({
                    "&": { height: "100%" },
                    ".cm-scroller": { overflow: "auto" }
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
                    while (start > from && /\w/.test(text[start - from - 1])) start--
                    while (end < to && /\w/.test(text[end - from])) end++
                    if (start == end) return null

                    const word = text.slice(start - from, end - from)

                    return {
                        pos: start,
                        end,
                        above: true,
                        create() {
                            const dom = document.createElement("div")
                            dom.className = "p-2 bg-black border border-white/20 rounded text-xs text-white"
                            dom.textContent = `Symbol: ${word}`
                            return { dom }
                        }
                    }
                })
            ]
        })

        const view = new EditorView({
            state: startState,
            parent: editorRef.current
        })

        viewRef.current = view

        return () => {
            view.destroy()
        }
    }, [])

    // Update content if it changes externally (careful with loops)
    useEffect(() => {
        if (viewRef.current && content !== viewRef.current.state.doc.toString()) {
            viewRef.current.dispatch({
                changes: { from: 0, to: viewRef.current.state.doc.length, insert: content }
            })
        }
    }, [content])

    return (
        <div ref={editorRef} className="h-full w-full overflow-auto text-sm" />

    )
}
