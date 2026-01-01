import React, { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import mermaid from 'mermaid'
import { Message } from '../types'
import { ToolDisplay } from './ToolDisplay'
import { cn } from '@/lib/utils'
import { Copy, Check } from 'lucide-react'
import { Highlight, themes } from 'prism-react-renderer'

// Initialize mermaid
mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    fontFamily: 'inherit'
})

// Copy Button Component
function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
            title="Kopyala"
        >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
    )
}

// Mermaid Diagram Component
function MermaidDiagram({ code }: { code: string }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [svg, setSvg] = useState<string>('')
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const renderDiagram = async () => {
            try {
                const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`
                const { svg } = await mermaid.render(id, code)
                setSvg(svg)
                setError(null)
            } catch (e: any) {
                setError(e.message || 'Diagram render hatası')
            }
        }
        renderDiagram()
    }, [code])

    if (error) {
        return (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <div className="font-medium mb-1">Mermaid Hatası</div>
                <div className="font-mono text-xs opacity-80">{error}</div>
            </div>
        )
    }

    return (
        <div
            ref={containerRef}
            className="my-2 p-4 rounded-lg bg-zinc-900/50 border border-white/5 overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    )
}

interface MessageProps {
    message: Message
    isLast: boolean
    userAvatar?: string
    aiAvatar?: string
}

export function MessageBubble({ message, isLast, userAvatar, aiAvatar }: MessageProps) {
    const isUser = message.role === 'user'
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [isThoughtExpanded, setIsThoughtExpanded] = useState(false)

    const { thought, plan, displayContent } = React.useMemo(() => {
        if (!message.content) return { thought: null, plan: null, displayContent: '' }

        let content = message.content
        let thought = null
        let plan = null

        // Extract Thought
        const thinkMatch = /<think>([\s\S]*?)(?:<\/think>|$)/.exec(content)
        if (thinkMatch) {
            thought = thinkMatch[1]
            content = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '')
        }

        // Extract Plan
        const planMatch = /<plan>([\s\S]*?)(?:<\/plan>|$)/.exec(content)
        if (planMatch) {
            plan = planMatch[1]
            content = content.replace(/<plan>[\s\S]*?(?:<\/plan>|$)/, '')
        }

        return { thought, plan, displayContent: content.trim() }
    }, [message.content])

    React.useEffect(() => {
        // Auto-expand if we are strictly in thinking phase (no content yet)
        if (isLast && thought && !displayContent && !isThoughtExpanded) {
            setIsThoughtExpanded(true)
        }
    }, [isLast, thought, displayContent])

    return (
        <div className={cn(
            "flex w-full animate-fade-in",
            isUser ? "justify-end" : "justify-start"
        )}>
            <div className={cn(
                "flex max-w-[85%] md:max-w-[75%] gap-3",
                isUser ? "flex-row-reverse" : "flex-row"
            )}>
                {/* Assistant Avatar */}
                {!isUser && (
                    <div className="w-8 h-8 rounded-full bg-background/20 backdrop-blur-md border border-white/10 flex items-center justify-center shrink-0 shadow-sm mt-1 overflow-hidden">
                        {aiAvatar?.startsWith('http') ? (
                            <img src={aiAvatar} className="w-full h-full object-cover" alt="AI" />
                        ) : (
                            <span className="text-sm">{aiAvatar || '✨'}</span>
                        )}
                    </div>
                )}

                {/* User Avatar */}
                {isUser && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 shadow-sm mt-1 overflow-hidden">
                        {userAvatar?.startsWith('http') ? (
                            <img src={userAvatar} className="w-full h-full object-cover" alt="User" />
                        ) : (
                            <span className="text-sm">{userAvatar || '👤'}</span>
                        )}
                    </div>
                )}

                <div className={cn(
                    "flex flex-col gap-1 min-w-0",
                    isUser ? "items-end" : "items-start"
                )}>
                    {/* Plan UI */}
                    {plan && (
                        <div className="w-full mb-3 glass-card p-3 animate-fade-in">
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-blue-500/10">
                                <span className="text-blue-400 text-sm">📋</span>
                                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Plan</span>
                            </div>
                            <div className="text-sm text-foreground/80 checkbox-list">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        li: ({ children }) => {
                                            const isCheckbox = Array.isArray(children) && children.some(c => React.isValidElement(c) && (c.props as any).type === 'checkbox')
                                            return <li className={cn(isCheckbox ? "list-none -ml-4" : "list-disc", "my-0.5")}>{children}</li>
                                        },
                                        input: ({ type, checked }) => {
                                            if (type === 'checkbox') {
                                                return <input type="checkbox" checked={checked} readOnly className="mr-2 accent-blue-400 scale-105 align-middle" />
                                            }
                                            return null
                                        },
                                        ul: ({ children }) => <ul className="pl-4 my-1 space-y-0.5">{children}</ul>,
                                        p: ({ children }) => <p className="my-1">{children}</p>
                                    }}
                                >
                                    {plan}
                                </ReactMarkdown>
                            </div>
                        </div>
                    )}

                    {/* Thinking Process UI */}
                    {thought && (
                        <div className="w-full mb-1">
                            <button
                                onClick={() => setIsThoughtExpanded(!isThoughtExpanded)}
                                className="flex items-center gap-2 text-xs text-muted-foreground/60 hover:text-foreground/80 transition-colors select-none"
                            >
                                <span className={cn("transition-transform duration-200", isThoughtExpanded ? "rotate-90" : "")}>▶</span>
                                <span className="font-medium">Düşünce Süreci</span>
                                {isLast && !displayContent && <span className="animate-pulse">...</span>}
                            </button>

                            {isThoughtExpanded && (
                                <div className="mt-2 pl-3 border-l-2 border-border/40 text-sm text-muted-foreground/80 italic animate-fa-in bg-white/5 backdrop-blur-md rounded-r-md p-2">
                                    <div className="whitespace-pre-wrap font-mono text-xs opacity-90 leading-relaxed">
                                        {thought}
                                        {isLast && !displayContent && <span className="animate-pulse inline-block w-1.5 h-3 ml-1 bg-current align-middle" />}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Bubble */}
                    <div className={cn(
                        "rounded-[20px] px-5 py-3 text-[15px] leading-relaxed shadow-sm whitespace-pre-wrap break-words",
                        isUser
                            ? "message-bubble-user rounded-tr-md"
                            : "message-bubble-ai rounded-tl-md"
                    )}>
                        {!thought && !displayContent ? (
                            <span className="italic opacity-50">...</span>
                        ) : (
                            displayContent ? (
                                <div className="markdown-body">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm, remarkMath]}
                                        rehypePlugins={[rehypeKatex]}
                                        components={{
                                            code({ node, className, children, ...props }) {
                                                const match = /language-(\w+)/.exec(className || '')
                                                const isInline = !match
                                                const codeString = String(children).replace(/\n$/, '')

                                                // Mermaid support
                                                if (match && match[1] === 'mermaid') {
                                                    return <MermaidDiagram code={codeString} />
                                                }

                                                return isInline ? (
                                                    <code className="bg-black/10 dark:bg-white/10 rounded px-1 py-0.5 font-mono text-[0.9em]" {...props}>
                                                        {children}
                                                    </code>
                                                ) : (
                                                    <div className="not-prose my-2 rounded-lg overflow-hidden border border-border/50 bg-zinc-950 group/code">
                                                        <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
                                                            <span className="text-xs text-zinc-400">{match?.[1] || 'code'}</span>
                                                            <CopyButton text={codeString} />
                                                        </div>
                                                        <Highlight theme={themes.nightOwl} code={codeString} language={match?.[1] || 'text'}>
                                                            {({ style, tokens, getLineProps, getTokenProps }) => (
                                                                <pre className="p-3 overflow-x-auto m-0" style={style}>
                                                                    {tokens.map((line, i) => (
                                                                        <div key={i} {...getLineProps({ line })}>
                                                                            <span className="select-none text-zinc-600 mr-4 text-xs inline-block w-6 text-right">{i + 1}</span>
                                                                            {line.map((token, key) => (
                                                                                <span key={key} {...getTokenProps({ token })} />
                                                                            ))}
                                                                        </div>
                                                                    ))}
                                                                </pre>
                                                            )}
                                                        </Highlight>
                                                    </div>
                                                )
                                            },
                                            a: ({ href, children }) => (
                                                <a href={href} className="text-blue-500 hover:underline underline-offset-4" onClick={(e) => {
                                                    e.preventDefault()
                                                    if (href) window.electron.openExternal(href)
                                                }}>{children}</a>
                                            ),
                                            li: ({ children }) => {
                                                const isCheckbox = Array.isArray(children) && children.some(c => React.isValidElement(c) && (c.props as any).type === 'checkbox')
                                                return <li className={cn(isCheckbox ? "list-none -ml-4" : "list-disc", "my-1")}>{children}</li>
                                            },
                                            input: ({ type, checked, ...props }) => {
                                                if (type === 'checkbox') {
                                                    return <input type="checkbox" checked={checked} readOnly className="mr-2 accent-blue-500 scale-110 align-middle" {...props} />
                                                }
                                                return <input {...props} />
                                            },
                                            ul: ({ children }) => <ul className="pl-4 my-2 space-y-0.5">{children}</ul>,
                                            ol: ({ children }) => <ol className="list-decimal pl-4 my-2 space-y-0.5">{children}</ol>,
                                        }}
                                    >
                                        {displayContent}
                                    </ReactMarkdown>
                                </div>
                            ) : null
                        )}

                        {/* Show images if attached (User side usually) */}
                        {message.images && message.images.length > 0 && (
                            <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                                {message.images.map((img, i) => (
                                    <div key={i} className="rounded-lg overflow-hidden border border-black/10 dark:border-white/10 w-48 h-48 shrink-0">
                                        <img src={`data:image/jpeg;base64,${img}`} alt="User upload" className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Tool Calls & Results */}
                    {message.toolCalls && message.toolCalls.length > 0 && (
                        <div className="flex flex-col gap-2 w-full mt-2">
                            {message.toolCalls.map((toolCall, idx) => (
                                <ToolDisplay
                                    key={idx}
                                    toolCall={toolCall}
                                    result={message.toolResults?.find(r => r.toolCallId === toolCall.id)}
                                    isExecuting={!message.toolResults?.find(r => r.toolCallId === toolCall.id)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Meta info (time, stats) & Actions */}
                    {!isUser && (
                        <div className="flex items-center gap-2 mt-1 px-1">
                            {message.timestamp && (
                                <span className="text-[10px] text-muted-foreground/50">
                                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}

                            <button
                                onClick={() => {
                                    if (isSpeaking) {
                                        window.speechSynthesis.cancel()
                                        setIsSpeaking(false)
                                    } else {
                                        window.speechSynthesis.cancel()
                                        // Simple markdown strip from displayContent
                                        const cleanText = (displayContent || thought || "")
                                            .replace(/#{1,6} /g, '')
                                            .replace(/(\*\*|__)(.*?)\1/g, '$2')
                                            .replace(/(\*|_)(.*?)\1/g, '$2')
                                            .replace(/`{3}[\s\S]*?`{3}/g, 'Kod bloğu')
                                            .replace(/`(.+?)`/g, '$1')
                                            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

                                        const utter = new SpeechSynthesisUtterance(cleanText)
                                        utter.lang = 'tr-TR' // Configure from settings later?
                                        utter.onend = () => setIsSpeaking(false)
                                        window.speechSynthesis.speak(utter)
                                        setIsSpeaking(true)
                                    }
                                }}
                                className={cn(
                                    "p-1 rounded-full bg-transparent hover:bg-muted/50 transition-colors opacity-0 group-hover:opacity-100",
                                    isSpeaking ? "opacity-100 text-purple-400" : "text-muted-foreground/40 hover:text-foreground/70"
                                )}
                                title={isSpeaking ? "Okumayı Durdur" : "Sesli Oku"}
                            >
                                {isSpeaking ? (
                                    <span className="block w-2 h-2 bg-current rounded-sm animate-pulse" />
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Meta for user - simple */}
                    {isUser && message.timestamp && (
                        <div className="text-[10px] text-muted-foreground/50 px-1 mt-1 text-right">
                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}


