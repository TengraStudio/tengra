import { gutter, GutterMarker } from "@codemirror/view"

class AIGutterMarker extends GutterMarker {
    toDOM() {
        const span = document.createElement("span")
        span.textContent = "✨"
        span.className = "cm-ai-gutter-icon text-yellow-400 hover:scale-110 transition-transform cursor-pointer opacity-0 group-hover:opacity-100"
        span.title = "AI Refactor"
        span.onclick = (e) => {
            e.preventDefault()
            e.stopPropagation()
            // Dispatch custom event that ProjectWorkspace can listen to?
            // Or callback? extensions don't easily accept react callbacks unless passed dynamically.
            const line = (e.target as HTMLElement).parentElement?.getAttribute('data-line')
            document.dispatchEvent(new CustomEvent('ai-refactor-request', {
                detail: { line: Number(line) }
            }))
        }
        return span
    }
}

export const aiGutter = gutter({
    class: "cm-ai-gutter group",
    lineMarker(_view, line) {
        if (line.length > 5) return new AIGutterMarker()
        return null
    },
    initialSpacer: () => new AIGutterMarker()
})
