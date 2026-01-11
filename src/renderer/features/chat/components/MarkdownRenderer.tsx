import React, { useState, useEffect, useMemo, isValidElement } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import mermaid from 'mermaid'
import { Code2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MonacoBlock } from './MonacoBlock'
import { useTranslation, Language } from '@/i18n'

// Initialize mermaid
mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    fontFamily: 'inherit'
})

const MermaidDiagram = ({ code }: { code: string }) => {
    const [svg, setSvg] = useState<string>('')
    const [error, setError] = useState<string | null>(null)
    const id = useMemo(() => `mermaid-${Math.random().toString(36).substr(2, 9)}`, [])

    useEffect(() => {
        const render = async () => {
            try {
                const { svg } = await mermaid.render(id, code)
                setSvg(svg)
                setError(null)
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err)
                setError(message)
            }
        }
        render()
    }, [code, id])

    if (error) return <pre className="text-xs text-red-400 bg-red-500/10 p-2 rounded">{error}</pre>
    return <div dangerouslySetInnerHTML={{ __html: svg }} className="my-4 flex justify-center bg-white/5 p-4 rounded-xl border border-white/10" />
}

interface MarkdownRendererProps {
    content: string
    isSpeaking?: boolean
    onSpeak?: (text: string) => void
    onStop?: () => void
    onCodeConvert?: (imageUrl: string) => void
    isUser?: boolean
    language?: Language
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
    content,
    isSpeaking,
    onSpeak,
    onStop,
    onCodeConvert,
    isUser,
    language = 'en'
}) => {
    const { t } = useTranslation(language)
    return (
        <div className="markdown-body">
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '')
                        const isInline = !match
                        const codeString = String(children).replace(/\n$/, '')
                        if (match && match[1] === 'mermaid') return <MermaidDiagram code={codeString} />

                        return (isInline || !match) ? (
                            <code className="bg-muted/50 rounded px-1.5 py-0.5 font-mono text-xs font-semibold text-primary/80" {...props}>
                                {children}
                            </code>
                        ) : (
                            <MonacoBlock
                                language={match[1] || 'text'}
                                code={codeString}
                                isSpeaking={isSpeaking}
                                onSpeak={() => onSpeak?.(codeString)}
                                onStop={onStop}
                                i18nLanguage={language}
                            />
                        )
                    },
                    img: ({ src, alt }) => (
                        <span className="block my-2 relative group/image">
                            <img src={src} alt={alt || 'Image'} className="max-w-full max-h-96 rounded-lg border border-white/10 cursor-pointer hover:opacity-90 transition-opacity whitespace-pre-wrap" onClick={() => src && window.electron?.openExternal(src)} />
                            {alt && <span className="text-xs text-muted-foreground mt-1 block font-medium">{alt}</span>}
                            {src && !isUser && onCodeConvert && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onCodeConvert(src)
                                    }}
                                    className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide opacity-0 group/image:opacity-100 transition-all flex items-center gap-2 transform translate-y-2 group-hover/image:translate-y-0"
                                >
                                    <Code2 className="w-3.5 h-3.5" />
                                    {t('workspace.convertToCode')}
                                </button>
                            )}
                        </span>
                    ),
                    a: ({ href, children }) => (
                        <a href={href} className="text-primary hover:underline underline-offset-4 font-medium" onClick={(e) => { e.preventDefault(); if (href) window.electron?.openExternal(href) }}>{children}</a>
                    ),
                    li: ({ children }) => {
                        const isCheckbox = Array.isArray(children) && children.some(c => {
                            if (!isValidElement(c)) return false
                            const element = c as React.ReactElement<{ type?: string }>
                            return element.props?.type === 'checkbox'
                        })
                        return <li className={cn(isCheckbox ? "list-none -ml-4" : "list-disc", "my-1")}>{children}</li>
                    },
                    input: ({ type, checked, ...props }) => {
                        if (type === 'checkbox') return <input type="checkbox" checked={checked} readOnly className="mr-2 accent-primary scale-110 align-middle" {...props} />
                        return <input {...props} />
                    },
                    ul: ({ children }) => <ul className="pl-4 my-2 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-4 my-2 space-y-1">{children}</ol>,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}
