import { useState, useEffect, useMemo, isValidElement } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import mermaid from 'mermaid'
import { useTranslation, Language } from '../i18n'
import { cn } from '@/lib/utils'
import { Copy, Check, ChevronDown, ChevronUp, Eye, Code2, AlertCircle, Clock } from 'lucide-react'
import { Highlight, themes } from 'prism-react-renderer'
import LogoAntigravity from '@/assets/antigravity.svg'
import LogoClaude from '@/assets/claude.svg'
import LogoOllama from '@/assets/ollama.svg'
import LogoOpenAI from '@/assets/chatgpt.svg'
import LogoGemini from '@/assets/gemini.png'
import LogoCopilot from '@/assets/copilot.png'

interface ToolCall {
    id: string
    name: string
    arguments: any
}

interface ToolResult {
    toolCallId: string
    name: string
    result: any
    isImage?: boolean
    error?: any
}

interface Message {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    images?: string[]
    toolCalls?: ToolCall[]
    toolResults?: ToolResult[]
    timestamp: Date
    provider?: string
    model?: string
    isPinned?: boolean
    reactions?: string[]
}

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
        <button onClick={handleCopy} className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-zinc-400 hover:text-white" title="Kopyala">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
    )
}



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

const TypingDots = () => (
    <div className="flex gap-1.5 items-center px-1 py-2">
        <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
    </div>
)

interface MessageProps {
    message: Message
    isLast: boolean
    backend?: string
    isStreaming?: boolean
    language: Language
}

export function MessageBubble({ message, isLast, backend, isStreaming, language }: MessageProps) {
    const { t } = useTranslation(language)
    const isUser = message.role === 'user'
    const [isThoughtExpanded, setIsThoughtExpanded] = useState(false)
    const [showRawMarkdown, setShowRawMarkdown] = useState(false)
    const [isContentExpanded, setIsContentExpanded] = useState(false)

    const COLLAPSE_THRESHOLD = 30

    const getAssistantLogo = () => {
        if (isUser) return null
        const modelName = (message.model || '').toString().toLowerCase()
        const inferredProvider = modelName.startsWith('gpt-') || modelName.startsWith('o1-')
            ? 'openai'
            : modelName.startsWith('claude-')
                ? 'anthropic'
                : modelName.startsWith('gemini-')
                    ? 'gemini'
                    : modelName.startsWith('grok-')
                        ? 'groq'
                        : modelName.startsWith('antigravity-')
                            ? 'antigravity'
                            : ''
        const provider = message.provider || backend || inferredProvider || 'ollama'
        const p = provider.toLowerCase()

        if (p.includes('openai') || p.includes('codex') || p.includes('gpt')) {
            return (
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-sm mt-1 overflow-hidden p-1" title="OpenAI">
                    <img src={LogoOpenAI} className="w-full h-full invert" alt="OpenAI" />
                </div>
            )
        }
        if (p.includes('anthropic') || p.includes('claude')) {
            return (
                <div className="w-8 h-8 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0 shadow-sm mt-1 overflow-hidden p-1" title="Claude">
                    <img src={LogoClaude} className="w-full h-full invert" alt="Claude" />
                </div>
            )
        }
        if (p.includes('gemini')) {
            return (
                <div className="w-8 h-8 rounded-full bg-blue-600 border border-white/10 flex items-center justify-center shrink-0 shadow-sm mt-1 overflow-hidden p-0 bg-gradient-to-br from-blue-500 to-purple-500" title="Gemini">
                    <img src={LogoGemini} className="w-full h-full object-cover" alt="Gemini" />
                </div>
            )
        }
        if (p.includes('antigravity')) {
            return (
                <div className="w-8 h-8 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center shrink-0 shadow-sm mt-1 overflow-hidden p-1" title="Antigravity">
                    <img src={LogoAntigravity} className="w-full h-full" alt="Antigravity" />
                </div>
            )
        }
        if (p.includes('github') || p.includes('copilot')) {
            return (
                <div className="w-8 h-8 rounded-full bg-black border border-white/10 flex items-center justify-center shrink-0 shadow-sm mt-1 overflow-hidden p-1">
                    <img src={LogoCopilot} className="w-full h-full object-cover" alt="Copilot" />
                </div>
            )
        }
        if (p.includes('groq')) {
            return (
                <div className="w-8 h-8 rounded-full bg-[#f55036] border border-white/10 flex items-center justify-center shrink-0 shadow-sm mt-1 overflow-hidden p-1">
                    <span className="font-bold text-white text-xs">G</span>
                </div>
            )
        }
        return (
            <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 shadow-sm mt-1 overflow-hidden p-1.5" title="Ollama/Local">
                <img src={LogoOllama} className="w-full h-full" alt="Ollama" />
            </div>
        )
    }

    const { thought, plan, displayContent } = useMemo(() => {
        if (!message.content) return { thought: null, plan: null, displayContent: '' }
        let content = message.content
        let thought = null
        let plan = null
        const thinkMatch = /<think>([\s\S]*?)(?:<\/think>|$)/.exec(content)
        if (thinkMatch) {
            thought = thinkMatch[1]
            content = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '')
        }
        const planMatch = /<plan>([\s\S]*?)(?:<\/plan>|$)/.exec(content)
        if (planMatch) {
            plan = planMatch[1]
            content = content.replace(/<plan>[\s\S]*?(?:<\/plan>|$)/, '')
        }
        return { thought, plan, displayContent: content.trim() }
    }, [message.content])

    useEffect(() => {
        if (isLast && thought && !displayContent && !isThoughtExpanded) {
            setIsThoughtExpanded(true)
        }
    }, [isLast, thought, displayContent, isThoughtExpanded])

    const lineCount = displayContent?.split('\n').length || 0
    const isLongContent = lineCount > COLLAPSE_THRESHOLD
    const shouldShowCollapsed = isLongContent && !isContentExpanded && !isUser
    const visibleContent = shouldShowCollapsed
        ? displayContent?.split('\n').slice(0, COLLAPSE_THRESHOLD).join('\n') + '\n...'
        : displayContent

    // Detect various quota/rate limit errors
    const is429Error = displayContent.includes('429') && (
        displayContent.includes('usage_limit_reached') ||
        displayContent.includes('usage limit') ||
        displayContent.includes('RESOURCE_EXHAUSTED') ||
        displayContent.includes('rate limit') ||
        displayContent.includes('Rate limit') ||
        displayContent.includes('quota')
    );

    // Parse error details for quota card
    const parseQuotaError = () => {
        try {
            // Try parsing JSON from error
            const jsonMatch = displayContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const errData = JSON.parse(jsonMatch[0]);
                return {
                    message: errData.error?.message || errData.message || 'Kullanım sınırına ulaşıldı',
                    resets_at: errData.error?.resets_at || errData.resets_at,
                    model: errData.error?.model || errData.model
                };
            }
        } catch { }
        return { message: 'Kullanım sınırına ulaşıldı. Lütfen daha sonra tekrar deneyin.', resets_at: null, model: null };
    };

    const quotaDetails = is429Error ? parseQuotaError() : null;

    const contentNode = (
        <div className="flex flex-col gap-2">
            {is429Error ? (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/20 text-red-400 max-w-md animate-in fade-in zoom-in duration-300">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-full bg-red-500/20">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="font-bold text-sm uppercase tracking-tight">Kota Sınırı Aşıldı</div>
                            {quotaDetails?.model && (
                                <div className="text-xs opacity-70 mt-0.5">{quotaDetails.model}</div>
                            )}
                        </div>
                    </div>
                    <p className="text-sm opacity-90 leading-relaxed mb-3">
                        {quotaDetails?.message || 'Kullanım limitinize ulaştınız. Lütfen sıfırlanma süresini bekleyin veya farklı bir model deneyin.'}
                    </p>
                    {quotaDetails?.resets_at && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/10 text-xs font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Sıfırlanma: {new Date(quotaDetails.resets_at * 1000).toLocaleString()}</span>
                        </div>
                    )}
                    <div className="mt-3 flex gap-2">
                        <button
                            className="px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                            onClick={() => window.electron.openExternal('https://ai.google.dev/pricing')}
                        >
                            Kotaları İncele
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {displayContent && !isUser && (
                        <div className="flex items-center gap-2 mb-1">
                            <button
                                onClick={() => setShowRawMarkdown(!showRawMarkdown)}
                                className={cn(
                                    "flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors",
                                    showRawMarkdown ? "bg-primary/20 text-primary" : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
                                )}
                            >
                                {showRawMarkdown ? <Eye className="w-3 h-3" /> : <Code2 className="w-3 h-3" />}
                                {showRawMarkdown ? t('chat.render') : t('chat.raw')}
                            </button>
                        </div>
                    )}

                    {!thought && !displayContent ? (
                        isStreaming ? <TypingDots /> : <span className="italic opacity-50">...</span>
                    ) : (
                        displayContent ? (
                            showRawMarkdown ? (
                                <pre className="whitespace-pre-wrap font-mono text-sm bg-black/30 rounded-lg p-3 border border-white/5 overflow-x-auto text-foreground/90 leading-relaxed">
                                    {visibleContent}
                                </pre>
                            ) : (
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
                                                    <code className="bg-accent/40 rounded px-1 py-0.5 font-mono text-sm uppercase" {...props}>
                                                        {children}
                                                    </code>
                                                ) : (
                                                    <div className="not-prose my-2 rounded-lg overflow-hidden border border-border/40 bg-black group/code">
                                                        <div className="flex items-center justify-between px-3 py-1.5 bg-card border-b border-border">
                                                            <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest">{match[1] || 'code'}</span>
                                                            <div className="flex items-center gap-1">
                                                                <CopyButton text={codeString} />
                                                            </div>
                                                        </div>
                                                        <Highlight theme={themes.nightOwl} code={codeString} language={match[1] || 'text'}>
                                                            {({ style, tokens, getLineProps, getTokenProps }) => (
                                                                <pre className="p-3 overflow-x-auto m-0" style={style}>
                                                                    {tokens.map((line, i) => (
                                                                        <div key={i} {...getLineProps({ line })}>
                                                                            <span className="select-none text-zinc-600 mr-4 text-xs inline-block w-6 text-right">{i + 1}</span>
                                                                            {line.map((token, key) => <span key={key} {...getTokenProps({ token })} />)}
                                                                        </div>
                                                                    ))}
                                                                </pre>
                                                            )}
                                                        </Highlight>
                                                    </div>
                                                )
                                            },
                                            img: ({ src, alt }) => (
                                                <span className="block my-2">
                                                    <img src={src} alt={alt || 'Image'} className="max-w-full max-h-96 rounded-lg border border-white/10 cursor-pointer hover:opacity-90 transition-opacity whitespace-pre-wrap" onClick={() => src && window.electron.openExternal(src)} />
                                                    {alt && <span className="text-xs text-muted-foreground mt-1 block font-medium">{alt}</span>}
                                                </span>
                                            ),
                                            a: ({ href, children }) => (
                                                <a href={href} className="text-primary hover:underline underline-offset-4 font-medium" onClick={(e) => { e.preventDefault(); if (href) window.electron.openExternal(href) }}>{children}</a>
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
                                        {visibleContent}
                                    </ReactMarkdown>
                                </div>
                            )
                        ) : null
                    )}
                </>
            )}

            {isLongContent && !isUser && !is429Error && (
                <button onClick={() => setIsContentExpanded(!isContentExpanded)} className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
                    {isContentExpanded ? <><ChevronUp className="w-3.5 h-3.5" /> {t('chat.collapse')}</> : <><ChevronDown className="w-3.5 h-3.5" /> {lineCount - COLLAPSE_THRESHOLD} {t('chat.moreLines')}</>}
                </button>
            )}
        </div>
    )

    return (
        <div className={cn("flex w-full animate-fade-in group", isUser ? "justify-end" : "justify-start")}>
            <div className={cn("flex max-w-[85%] md:max-w-[75%] gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
                {!isUser && getAssistantLogo()}
                <div className={cn("flex flex-col gap-1 min-w-0", isUser ? "items-end" : "items-start")}>
                    {plan && (
                        <div className="w-full mb-3 bg-primary/5 border border-primary/10 rounded-xl p-3 animate-fade-in">
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-primary/10">
                                <span className="text-xs font-black text-primary uppercase tracking-widest">{t('chat.plan')}</span>
                            </div>
                            <div className="text-sm text-foreground/80"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ li: ({ children }) => <li className="list-disc ml-4 my-0.5">{children}</li> }}>{plan}</ReactMarkdown></div>
                        </div>
                    )}
                    {thought && (
                        <div className="w-full mb-1">
                            <button onClick={() => setIsThoughtExpanded(!isThoughtExpanded)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 hover:text-primary transition-colors select-none">
                                <span className={cn("transition-transform duration-200", isThoughtExpanded ? "rotate-90" : "")}>▶</span>
                                <span>{t('chat.thought')}</span>
                            </button>
                            {isThoughtExpanded && (
                                <div className="mt-2 pl-3 border-l-2 border-primary/20 text-sm text-muted-foreground/70 italic animate-fade-in bg-primary/5 rounded-r-md p-3">
                                    <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed">{thought}</div>
                                </div>
                            )}
                        </div>
                    )}
                    <div className={cn("rounded-[24px] px-5 py-3 text-base leading-relaxed shadow-sm whitespace-pre-wrap break-words border", isUser ? "bg-primary text-white border-transparent rounded-tr-sm" : "bg-transparent border-transparent pl-0")}>
                        {contentNode}
                    </div>
                </div>
            </div>
        </div>
    )
}
