import React, { useState, useEffect, useMemo, isValidElement } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import mermaid from 'mermaid'
import { Highlight, themes } from 'prism-react-renderer'
import { Volume2, VolumeX, Code2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CopyButton } from './MessageActions'

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
            } catch (err: any) {
                setError(err.message)
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
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
    content,
    isSpeaking,
    onSpeak,
    onStop,
    onCodeConvert,
    isUser
}) => {
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
                            <div className="not-prose my-3 rounded-xl overflow-hidden border border-border/30 bg-[#0d1117] group/code transition-premium">
                                <div className="flex items-center justify-between px-4 py-2 bg-muted/20 border-b border-border/20 backdrop-blur-sm">
                                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60 group-hover/code:opacity-100 transition-opacity">{match[1] || 'code'}</span>
                                    <div className="flex items-center gap-1.5">
                                        {isSpeaking ? (
                                            <button onClick={onStop} className="p-1 px-1.5 hover:bg-white/10 rounded-md transition-colors text-primary" title="Durdur">
                                                <VolumeX className="w-3.5 h-3.5" />
                                            </button>
                                        ) : (
                                            <button onClick={() => onSpeak?.(codeString)} className="p-1 px-1.5 hover:bg-white/10 rounded-md transition-colors text-muted-foreground hover:text-foreground" title="Sesli Oku">
                                                <Volume2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <CopyButton text={codeString} />
                                    </div>
                                </div>
                                <Highlight theme={themes.vsDark} code={codeString} language={match[1] || 'text'}>
                                    {({ style, tokens, getLineProps, getTokenProps }) => (
                                        <pre className="p-4 overflow-x-auto m-0 !bg-transparent text-sm leading-relaxed" style={style}>
                                            {tokens.map((line, i) => (
                                                <div key={i} {...getLineProps({ line })} className="flex">
                                                    <span className="select-none text-muted-foreground/30 mr-4 text-xs inline-block w-4 text-right shrink-0">{i + 1}</span>
                                                    <div className="flex-1">
                                                        {line.map((token, key) => <span key={key} {...getTokenProps({ token })} />)}
                                                    </div>
                                                </div>
                                            ))}
                                        </pre>
                                    )}
                                </Highlight>
                            </div>
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
                                    Koda Ã‡evir
                                </button>
                            )}
                        </span>
                    ),
                    a: ({ href, children }) => (
                        <a href={href} className="text-primary hover:underline underline-offset-4 font-medium" onClick={(e) => { e.preventDefault(); if (href) window.electron?.openExternal(href) }}>{children}</a>
                    ),
                    li: ({ children }) => {
                        const isCheckbox = Array.isArray(children) && children.some(c => isValidElement(c) && (c.props as any).type === 'checkbox')
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
