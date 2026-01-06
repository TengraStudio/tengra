import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, Copy, X, Sparkles } from 'lucide-react'

interface QuickActionBarProps {
    onExplain: (text: string) => void
    onTranslate: (text: string) => void
}

export function QuickActionBar({ onExplain, onTranslate }: QuickActionBarProps) {
    const [isVisible, setIsVisible] = useState(false)
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const [selectedText, setSelectedText] = useState('')
    const barRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleSelectionChange = () => {
            const selection = window.getSelection()
            const text = selection?.toString().trim()

            if (text && text.length > 2) {
                const range = selection?.getRangeAt(0)
                const rect = range?.getBoundingClientRect()
                const anchorNode = selection?.anchorNode
                const parentElement = anchorNode?.parentElement

                // Check if selection is within allowed areas (CodeMirror, Markdown content, etc.)
                const isAllowedArea = parentElement?.closest('.cm-editor') ||
                    parentElement?.closest('.prose') ||
                    parentElement?.closest('.message-content')

                if (rect && isAllowedArea) {
                    setSelectedText(text)
                    setPosition({
                        x: rect.left + rect.width / 2,
                        y: rect.top - 10
                    })
                    setIsVisible(true)
                }
            } else {
                if (isVisible) {
                    // Slight delay to allow clicking the bar itself
                    setTimeout(() => {
                        const activeSelection = window.getSelection()?.toString().trim()
                        if (!activeSelection) setIsVisible(false)
                    }, 100)
                }
            }
        }

        document.addEventListener('mouseup', handleSelectionChange)
        document.addEventListener('keyup', handleSelectionChange)
        return () => {
            document.removeEventListener('mouseup', handleSelectionChange)
            document.removeEventListener('keyup', handleSelectionChange)
        }
    }, [isVisible])

    const handleCopy = () => {
        navigator.clipboard.writeText(selectedText)
        setIsVisible(false)
    }

    if (!isVisible) return null

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    ref={barRef}
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    style={{
                        position: 'fixed',
                        left: position.x,
                        top: position.y,
                        transform: 'translate(-50%, -100%)',
                        zIndex: 1000
                    }}
                    className="flex items-center gap-1 p-1 bg-card/95 border border-border rounded-xl shadow-2xl backdrop-blur-xl"
                    onMouseDown={(e) => e.preventDefault()} // Prevent losing selection
                >
                    <button
                        onClick={() => { onExplain(selectedText); setIsVisible(false) }}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-primary/20 text-foreground rounded-lg transition-colors text-xs font-medium"
                    >
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <span>AÃ§Ä±kla</span>
                    </button>
                    <div className="w-px h-4 bg-border/50 mx-0.5" />
                    <button
                        onClick={() => { onTranslate(selectedText); setIsVisible(false) }}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-primary/20 text-foreground rounded-lg transition-colors text-xs font-medium"
                    >
                        <Globe className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Ã‡evir</span>
                    </button>
                    <div className="w-px h-4 bg-border/50 mx-0.5" />
                    <button
                        onClick={handleCopy}
                        className="p-1.5 hover:bg-white/10 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                        title="Kopyala"
                    >
                        <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setIsVisible(false)}
                        className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-400 rounded-lg transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
