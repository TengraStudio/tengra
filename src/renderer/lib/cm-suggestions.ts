/**
 * AI Gutter extension for CodeMirror
 * Must be loaded dynamically to avoid circular dependency issues
 */

import type { Extension } from '@codemirror/state'

let aiGutterExtension: Extension | null = null

/**
 * Creates the AI gutter extension dynamically
 * Call this function only after CodeMirror is loaded
 */
export async function createAIGutter(): Promise<Extension> {
    if (aiGutterExtension) {
        return aiGutterExtension
    }

    const { gutter, GutterMarker } = await import('@codemirror/view')

    class AIGutterMarker extends GutterMarker {
        toDOM() {
            const span = document.createElement("span")
            span.textContent = "✨"
            span.className = "cm-ai-gutter-icon text-yellow-400 hover:scale-110 transition-transform cursor-pointer opacity-0 group-hover:opacity-100"
            span.title = "AI Refactor"
            span.onclick = (e) => {
                e.preventDefault()
                e.stopPropagation()
                const line = (e.target as HTMLElement).parentElement?.getAttribute('data-line')
                document.dispatchEvent(new CustomEvent('ai-refactor-request', {
                    detail: { line: Number(line) }
                }))
            }
            return span
        }
    }

    aiGutterExtension = gutter({
        class: "cm-ai-gutter group",
        lineMarker(_view, line) {
            if (line.length > 5) return new AIGutterMarker()
            return null
        },
        initialSpacer: () => new AIGutterMarker()
    })

    return aiGutterExtension
}
