import DOMPurify from 'dompurify'
import { AlertCircle, Bookmark, Brain, Check, ChevronDown, ChevronUp, Clock, Code2, Copy, Eye, FileCode, ListTodo, Smile, Sparkles, ThumbsDown, ThumbsUp, Volume2, VolumeX } from 'lucide-react'
import mermaid from 'mermaid'
import { Highlight, themes } from 'prism-react-renderer'
import { isValidElement, memo, useEffect, useId, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import LogoAntigravity from '@/assets/antigravity.svg'
import LogoOpenAI from '@/assets/chatgpt.svg'
import LogoClaude from '@/assets/claude.svg'
import LogoCopilot from '@/assets/copilot.png'
import LogoOllama from '@/assets/ollama.svg'
import { Language, useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'
import { Message } from '@/types'

import 'katex/dist/katex.min.css'
import '@renderer/features/chat/components/MessageBubble.css'

// Initialize mermaid
mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    fontFamily: 'inherit'
})

// Copy Button Component
const CopyButton = memo(({ text, t }: { text: string, t: (key: string) => string }) => {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <button onClick={handleCopy} className="p-1.5 hover:bg-accent/50 rounded-md transition-colors text-muted-foreground hover:text-foreground" title={t('messageBubble.copy')}>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
    )
})

const BookmarkButton = memo(({ active, onClick, t }: { active: boolean; onClick: () => void, t: (key: string) => string }) => {
    return (
        <button onClick={onClick} className={cn("p-1.5 hover:bg-accent/50 rounded-md transition-all duration-300", active ? "text-amber-400 bg-amber-400/10 shadow-[0_0_10px_rgba(251,191,36,0.1)]" : "text-muted-foreground hover:text-foreground")} title={active ? t('messageBubble.removeBookmark') : t('messageBubble.addBookmark')}>
            <Bookmark className={cn("w-3.5 h-3.5", active && "fill-current")} />
        </button>
    )
})

const RatingButtons = memo(({ rating, onRate, t }: { rating?: 1 | -1 | 0 | undefined; onRate: (val: 1 | -1 | 0) => void, t: (key: string) => string }) => {
    return (
        <div className="flex items-center gap-1 border-l border-border/50 pl-2 ml-1">
            <button
                onClick={() => onRate(rating === 1 ? 0 : 1)}
                className={cn(
                    "p-1.5 rounded-md transition-all duration-200",
                    rating === 1 ? "text-emerald-400 bg-emerald-400/10" : "text-muted-foreground hover:text-emerald-400 hover:bg-emerald-400/5"
                )}
                title={t('messageBubble.goodAnswer')}
            >
                <ThumbsUp className={cn("w-3.5 h-3.5", rating === 1 && "fill-current")} />
            </button>
            <button
                onClick={() => onRate(rating === -1 ? 0 : -1)}
                className={cn(
                    "p-1.5 rounded-md transition-all duration-200",
                    rating === -1 ? "text-red-400 bg-red-400/10" : "text-muted-foreground hover:text-red-400 hover:bg-red-400/5"
                )}
                title={t('messageBubble.badAnswer')}
            >
                <ThumbsDown className={cn("w-3.5 h-3.5", rating === -1 && "fill-current")} />
            </button>
        </div>
    )
})

// Copy as Markdown Button Component (#55)
const CopyMarkdownButton = memo(({ text, role, t }: { text: string; role: string, t: (key: string) => string }) => {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        const markdown = `**${role === 'user' ? t('messageBubble.user') : t('messageBubble.assistant')}:**\n\n${text}`
        await navigator.clipboard.writeText(markdown)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <button onClick={handleCopy} className="p-1.5 hover:bg-accent/50 rounded-md transition-colors text-muted-foreground hover:text-foreground" title={t('messageBubble.copyAsMarkdown')}>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Code2 className="w-3.5 h-3.5" />}
        </button>
    )
})

// Copy as HTML Button Component
const CopyHtmlButton = memo(({ text, t }: { text: string, t: (key: string) => string }) => {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        // Simple html conversion
        const html = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
            .replace(/\n/g, '<br/>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')

        await navigator.clipboard.writeText(html)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <button onClick={handleCopy} className="p-1.5 hover:bg-accent/50 rounded-md transition-colors text-muted-foreground hover:text-foreground" title={t('messageBubble.copyAsHtml')}>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Code2 className="w-3.5 h-3.5 rotate-90" />}
        </button>
    )
})

const MermaidDiagram = memo(({ code }: { code: string }) => {
    const [svg, setSvg] = useState<string>('')
    const [error, setError] = useState<string | null>(null)
    const id = useId()

    useEffect(() => {
        const render = async () => {
            try {
                const { svg } = await mermaid.render(id, code)
                setSvg(DOMPurify.sanitize(svg))
                setError(null)
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err)
                setError(message)
            }
        }
        render()
    }, [code, id])

    if (error) { return <pre className="text-xs text-red-400 bg-red-500/10 p-2 rounded">{error}</pre> }
    return <div dangerouslySetInnerHTML={{ __html: svg }} className="my-4 flex justify-center bg-accent/30 p-4 rounded-xl border border-border/50" />
})

// Enhanced Typing Indicator (#45)
const TypingDots = ({ t }: { t: (key: string) => string }) => (
    <div className="flex gap-2 items-center px-2 py-3">
        <div className="flex gap-1.5 items-center">
            <div className="w-2 h-2 bg-gradient-to-r from-primary to-purple-500 rounded-full animate-bounce [animation-delay:-0.3s] shadow-lg shadow-primary/30" />
            <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-bounce [animation-delay:-0.15s] shadow-lg shadow-purple-500/30" />
            <div className="w-2 h-2 bg-gradient-to-r from-pink-500 to-primary rounded-full animate-bounce shadow-lg shadow-pink-500/30" />
        </div>
        <span className="text-[10px] text-muted-foreground/50 font-medium animate-pulse">{t('messageBubble.thinking')}</span>
    </div>
)

const ResponseProgress = () => (
    <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden bg-primary/5">
        <div className="h-full w-full bg-primary/40 animate-[shimmer_2s_infinite_linear]" style={{ background: 'linear-gradient(90deg, transparent 0%, var(--primary) 50%, transparent 100%)', backgroundSize: '200% 100%' }} />
    </div>
)

const ImageSkeleton = ({ t }: { t: (key: string) => string }) => (
    <div className="w-[300px] h-[300px] rounded-xl bg-accent/30 border border-border/50 flex flex-col items-center justify-center gap-4 relative overflow-hidden group/skel">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/30 to-transparent -translate-x-full animate-slide-shimmer" />
        <div className="w-12 h-12 rounded-full bg-accent/30 flex items-center justify-center animate-pulse">
            <Sparkles className="w-6 h-6 text-primary/40" />
        </div>
        <div className="space-y-2 text-center">
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 animate-pulse">{t('messageBubble.orbitDrawing')}</div>
            <div className="flex gap-1 justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-bounce" />
            </div>
        </div>
    </div>
)

interface MessageProps {
    message: Message
    isLast: boolean
    backend?: string | undefined
    isStreaming?: boolean | undefined
    language: Language
    onSpeak?: ((text: string) => void) | undefined
    onStop?: (() => void) | undefined
    isSpeaking?: boolean | undefined
    onCodeConvert?: ((imageUrl: string) => void) | undefined
    onReact?: ((emoji: string) => void) | undefined
    onBookmark?: ((isBookmarked: boolean) => void) | undefined
    onRate?: ((rating: 1 | -1 | 0) => void) | undefined
    onApprovePlan?: (() => void) | undefined
    streamingSpeed?: number | null | undefined
    streamingReasoning?: string | undefined
    id?: string | undefined
    isFocused?: boolean | undefined
    onSourceClick?: ((path: string) => void) | undefined
}

export const MessageBubble = memo(({ message, isLast, backend, isStreaming, language, onSpeak, onStop, isSpeaking, onCodeConvert, onReact, onBookmark, onRate, onApprovePlan, streamingSpeed, streamingReasoning, id, isFocused, onSourceClick }: MessageProps) => {
    const { t } = useTranslation(language)
    const isUser = message.role === 'user'
    const [isThoughtExpanded, setIsThoughtExpanded] = useState(false)
    const [showRawMarkdown, setShowRawMarkdown] = useState(false)
    const [isContentExpanded, setIsContentExpanded] = useState(false)

    const COLLAPSE_THRESHOLD = 30

    const getAssistantLogo = () => {
        if (isUser) { return null }
        const modelName = (message.model || '').toString().toLowerCase()
        const inferredProvider = modelName.startsWith('gpt-') || modelName.startsWith('o1-')
            ? 'openai'
            : modelName.startsWith('claude-')
                ? 'anthropic'

                : modelName.startsWith('grok-')
                    ? 'groq'
                    : modelName.startsWith('antigravity-')
                        ? 'antigravity'
                        : ''
        const provider = message.provider || backend || inferredProvider || 'ollama'
        const p = provider.toLowerCase()

        // Brand Icons for Providers
        if (p.includes('openai') || p.includes('codex') || p.includes('gpt')) {
            return (
                <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/10 flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1" title="OpenAI">
                    <img src={LogoOpenAI} className="w-full h-full opacity-70" alt="OpenAI" />
                </div>
            )
        }
        if (p.includes('anthropic') || p.includes('claude')) {
            return (
                <div className="w-6 h-6 rounded-md bg-orange-500/10 border border-orange-500/10 flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1" title="Claude">
                    <img src={LogoClaude} className="w-full h-full opacity-70" alt="Claude" />
                </div>
            )
        }


        // Family Icons for Local/Ollama Models
        if (modelName.includes('llama')) {
            return (
                <div className="w-6 h-6 rounded-md bg-blue-500/10 border border-blue-500/10 flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1" title="Llama Family">
                    <span className="font-black text-blue-400 text-[10px]">LL</span>
                </div>
            )
        }
        if (modelName.includes('mistral') || modelName.includes('mixtral')) {
            return (
                <div className="w-6 h-6 rounded-md bg-orange-500/20 border border-orange-500/20 flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1" title="Mistral Family">
                    <span className="font-black text-orange-400 text-[10px]">M</span>
                </div>
            )
        }
        if (modelName.includes('deepseek')) {
            return (
                <div className="w-6 h-6 rounded-md bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1" title="DeepSeek">
                    <span className="font-black text-indigo-400 text-[10px]">DS</span>
                </div>
            )
        }
        if (modelName.includes('qwen')) {
            return (
                <div className="w-6 h-6 rounded-md bg-purple-500/20 border border-purple-500/20 flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1" title="Qwen">
                    <span className="font-black text-purple-400 text-[10px]">Q</span>
                </div>
            )
        }
        if (modelName.includes('phi')) {
            return (
                <div className="w-6 h-6 rounded-md bg-cyan-500/20 border border-cyan-500/20 flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1" title="Phi">
                    <span className="font-black text-cyan-400 text-[10px]">Î¦</span>
                </div>
            )
        }

        // Default Fallbacks
        if (p.includes('antigravity')) {
            return (
                <div className="w-6 h-6 rounded-md bg-yellow-500/10 border border-yellow-500/10 flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1" title="Antigravity">
                    <img src={LogoAntigravity} className="w-full h-full opacity-70" alt="Antigravity" />
                </div>
            )
        }
        if (p.includes('github') || p.includes('copilot')) {
            return (
                <div className="w-6 h-6 rounded-md bg-black border border-border/50 flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1">
                    <img src={LogoCopilot} className="w-full h-full object-cover opacity-70" alt="Copilot" />
                </div>
            )
        }
        if (p.includes('groq')) {
            return (
                <div className="w-6 h-6 rounded-md bg-[#f55036]/10 border border-[#f55036]/10 flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1">
                    <span className="font-bold text-[#f55036] text-[10px]">G</span>
                </div>
            )
        }
        return (
            <div className="w-6 h-6 rounded-md bg-muted/30 border border-border/50 flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1" title="Ollama/Local">
                <img src={LogoOllama} className="w-full h-full opacity-50" alt="Ollama" />
            </div>
        )
    }

    const { thought, plan, displayContent } = useMemo(() => {
        let content = typeof message.content === 'string'
            ? message.content
            : Array.isArray(message.content)
                ? message.content.map((c) => {
                    if (typeof c === 'string') { return c }
                    return typeof c.text === 'string' ? c.text : ''
                }).join('')
                : ''
        let thought = message.reasoning || null
        let plan = null

        // If no structured reasoning, try to extract from content (Ollama fallback)
        if (!thought) {
            const thinkMatch = /<think>([\s\S]*?)(?:<\/think>|$)/.exec(content)
            if (thinkMatch) {
                thought = thinkMatch[1] || null
                content = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '')
            }
        }

        const planMatch = /<plan>([\s\S]*?)(?:<\/plan>|$)/.exec(content)
        if (planMatch) {
            plan = planMatch[1] || null
            content = content.replace(/<plan>[\s\S]*?(?:<\/plan>|$)/, '')
        }
        return {
            thought: streamingReasoning || thought,
            plan,
            displayContent: content.trim()
        }
    }, [message.content, message.reasoning, streamingReasoning])

    // During render, determine if thought should be auto-expanded
    const shouldAutoExpand = isLast && thought && !displayContent && !isThoughtExpanded

    useEffect(() => {
        if (shouldAutoExpand) {
            const timer = setTimeout(() => setIsThoughtExpanded(true), 0)
            return () => clearTimeout(timer)
        }
        return undefined
    }, [shouldAutoExpand])

    const lineCount = displayContent?.split('\n').length || 0
    const isLongContent = lineCount > COLLAPSE_THRESHOLD
    const shouldShowCollapsed = isLongContent && !isContentExpanded && !isUser
    const visibleContent = shouldShowCollapsed
        ? displayContent?.split('\n').slice(0, COLLAPSE_THRESHOLD).join('\n') + '\n...'
        : displayContent

    // Detect various quota/rate limit errors
    const is429Error = displayContent.includes('429') ||
        displayContent.includes('RESOURCE_EXHAUSTED') ||
        displayContent.includes('Rate limit or quota exceeded') ||
        displayContent.includes('Quota or rate limit exceeded') ||
        (displayContent.includes('usage_limit_reached') ||
            displayContent.includes('usage limit') ||
            displayContent.includes('rate limit') ||
            displayContent.includes('Rate limit') ||
            displayContent.includes('quota'));

    // Parse error details for quota card
    const parseQuotaError = () => {
        try {
            // Try parsing JSON from error
            const jsonMatch = displayContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const errData = JSON.parse(jsonMatch[0]);
                return {
                    message: errData.error?.message || errData.message || t('messageBubble.quotaExceeded'),
                    resets_at: errData.error?.resets_at || errData.resets_at,
                    model: errData.error?.model || errData.model
                };
            }
        } catch { /* JSON parse failed */ }
        return { message: t('messageBubble.quotaMessage'), resets_at: null, model: null };
    };

    const quotaDetails = is429Error ? parseQuotaError() : null;

    // Image gallery
    const imageGallery = message.images && message.images.length > 0 && (
        <div className="flex gap-3 flex-wrap mb-4">
            {message.images.map((img, i) => (
                typeof img !== 'string' ? null :
                    img === '__LOADING_IMAGE__' ? (
                        <ImageSkeleton key={`skel-${i}`} t={t} />
                    ) : (
                        <div key={i} className="relative group/img-container">
                            <img
                                src={img}
                                alt={`Attached ${i + 1}`}
                                className="max-w-full md:max-w-md max-h-[500px] object-contain rounded-xl border border-border/50 cursor-pointer hover:opacity-90 transition-all duration-300 shadow-2xl"
                                onClick={() => window.open(img, '_blank')}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img-container:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
                                <Eye className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    )
            ))}
        </div>
    );

    const contentNode = (
        <div className="flex flex-col gap-2">
            {imageGallery}
            {is429Error ? (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/20 text-red-400 max-w-md animate-in fade-in zoom-in duration-300">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-full bg-red-500/20">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="font-bold text-sm uppercase tracking-tight">{t('messageBubble.quotaExceeded')}</div>
                            {quotaDetails?.model && (
                                <div className="text-xs opacity-70 mt-0.5">{quotaDetails.model}</div>
                            )}
                        </div>
                    </div>
                    <p className="text-sm opacity-90 leading-relaxed mb-3">
                        {quotaDetails?.message || t('messageBubble.quotaMessage')}
                    </p>
                    {quotaDetails?.resets_at && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/10 text-xs font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{t('messageBubble.resetsAt')} {new Date(quotaDetails.resets_at * 1000).toLocaleString()}</span>
                        </div>
                    )}
                    <div className="mt-3 flex gap-2">
                        <button
                            className="px-3 py-1.5 text-xs rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors"
                            onClick={() => window.electron.openExternal('https://ai.google.dev/pricing')}
                        >
                            {t('messageBubble.checkQuotas')}
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
                                    showRawMarkdown ? "bg-primary/20 text-primary" : "bg-accent/30 text-muted-foreground hover:text-foreground hover:bg-accent/50"
                                )}
                            >
                                {showRawMarkdown ? <Eye className="w-3 h-3" /> : <Code2 className="w-3 h-3" />}
                                {showRawMarkdown ? t('chat.render') : t('chat.raw')}
                            </button>
                        </div>
                    )}

                    {!thought && !displayContent && (!message.images || message.images.length === 0) ? (
                        isStreaming ? <TypingDots t={t} /> : <span className="italic opacity-50">...</span>
                    ) : (
                        displayContent ? (
                            showRawMarkdown ? (
                                <pre className="whitespace-pre-wrap font-mono text-sm bg-accent/20 rounded-lg p-3 border border-border/30 overflow-x-auto text-foreground/90 leading-relaxed">
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
                                                if (match?.[1] === 'mermaid') { return <MermaidDiagram code={codeString} /> }
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
                                                                    <button onClick={onStop} className="p-1 px-1.5 hover:bg-accent/50 rounded-md transition-colors text-primary" title={t('messageBubble.stop')}>
                                                                        <VolumeX className="w-3.5 h-3.5" />
                                                                    </button>
                                                                ) : (
                                                                    <button onClick={() => onSpeak?.(codeString)} className="p-1 px-1.5 hover:bg-accent/50 rounded-md transition-colors text-muted-foreground hover:text-foreground" title={t('messageBubble.speakAloud')}>
                                                                        <Volume2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                                <CopyButton text={codeString} t={t} />
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
                                                    <img src={src} alt={alt || 'Image'} className="max-w-full max-h-96 rounded-lg border border-border/50 cursor-pointer hover:opacity-90 transition-opacity whitespace-pre-wrap" onClick={() => src && window.electron.openExternal(src)} />
                                                    {alt && <span className="text-xs text-muted-foreground mt-1 block font-medium">{alt}</span>}
                                                    {src && !isUser && onCodeConvert && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                onCodeConvert(src)
                                                            }}
                                                            className="absolute top-2 right-2 bg-background/60 hover:bg-background/80 backdrop-blur-md border border-border/50 text-foreground px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide opacity-0 group-hover/image:opacity-100 transition-all flex items-center gap-2 transform translate-y-2 group-hover/image:translate-y-0"
                                                        >
                                                            <Code2 className="w-3.5 h-3.5" />
                                                            {t('messageBubble.convertToCode')}
                                                        </button>
                                                    )}
                                                </span>
                                            ),
                                            a: ({ href, children }) => (
                                                <a href={href} className="text-primary hover:underline underline-offset-4 font-medium" onClick={(e) => { e.preventDefault(); if (href) { window.electron.openExternal(href) } }}>{children}</a>
                                            ),
                                            li: ({ children }) => {
                                                const isCheckbox = Array.isArray(children) && children.some(c => {
                                                    if (!isValidElement(c)) { return false }
                                                    const element = c as React.ReactElement<{ type?: string }>
                                                    return element.props?.type === 'checkbox'
                                                })
                                                return <li className={cn(isCheckbox ? "list-none -ml-4" : "list-disc", "my-1")}>{children}</li>
                                            },
                                            input: ({ type, checked, ...props }) => {
                                                if (type === 'checkbox') { return <input type="checkbox" checked={checked} readOnly className="mr-2 accent-primary scale-110 align-middle" {...props} /> }
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

            {message.sources && message.sources.length > 0 && !isUser && (
                <div className="flex flex-wrap gap-2 mt-3 animate-fade-in">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-primary/5 border border-primary/10 text-[10px] text-primary font-bold uppercase tracking-wider mb-1">
                        <Sparkles className="w-3 h-3" />
                        {t('chat.sources')}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {message.sources.map((path, idx) => {
                            const fileName = path.split(/[\\/]/).pop() || path
                            return (
                                <button
                                    key={idx}
                                    onClick={() => onSourceClick?.(path)}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/30 border border-border/30 hover:border-primary/50 hover:bg-primary/5 transition-all text-xs text-muted-foreground hover:text-foreground group/chip"
                                    title={path}
                                >
                                    <FileCode className="w-3.5 h-3.5 text-primary/60 group-hover/chip:text-primary" />
                                    <span>{fileName}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            {isLongContent && !isUser && !is429Error && (
                <button onClick={() => setIsContentExpanded(!isContentExpanded)} className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-accent/30 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all">
                    {isContentExpanded ? <><ChevronUp className="w-3.5 h-3.5" /> {t('chat.collapse')}</> : <><ChevronDown className="w-3.5 h-3.5" /> {lineCount - COLLAPSE_THRESHOLD} {t('chat.moreLines')}</>}
                </button>
            )}
        </div>
    )

    return (
        <div id={id} className={cn("flex w-full animate-fade-in group transition-all duration-300 rounded-2xl p-2", isUser ? "justify-end" : "justify-start", isFocused && "bg-primary/5 ring-1 ring-primary/20 shadow-lg shadow-primary/5")}>
            <div className={cn("flex max-w-[85%] md:max-w-[75%] gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
                {!isUser && getAssistantLogo()}
                <div className={cn("flex flex-col gap-1 min-w-0", isUser ? "items-end" : "items-start")}>
                    {plan && (
                        <div className="w-full mb-4 bg-gradient-to-br from-primary/[0.07] to-purple-500/[0.02] border border-primary/20 rounded-2xl p-4 shadow-lg shadow-primary/5 animate-fade-in relative overflow-hidden group/plan">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/plan:opacity-20 transition-opacity">
                                <ListTodo className="w-12 h-12" />
                            </div>
                            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-primary/10">
                                <div className="p-1.5 rounded-lg bg-primary/20">
                                    <ListTodo className="w-4 h-4 text-primary" />
                                </div>
                                <span className="text-xs font-black text-primary uppercase tracking-[0.2em]">{t('chat.plan')}</span>
                            </div>
                            <div className="text-[13px] text-foreground/90 leading-relaxed font-medium">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        li: ({ children }) => (
                                            <li className="flex gap-2.5 my-1.5 items-start">
                                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                                                <span>{children}</span>
                                            </li>
                                        ),
                                        ul: ({ children }) => <ul className="space-y-1">{children}</ul>
                                    }}
                                >
                                    {plan}
                                </ReactMarkdown>
                            </div>
                            {isLast && !isStreaming && onApprovePlan && (
                                <div className="mt-4 pt-4 border-t border-primary/10 flex justify-end">
                                    <button
                                        onClick={onApprovePlan}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20"
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                        {t('messageBubble.approvePlan')}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    {thought && (
                        <div className="w-full mb-3">
                            <button
                                onClick={() => setIsThoughtExpanded(!isThoughtExpanded)}
                                className={cn(
                                    "flex items-center gap-2 group/thought transition-all duration-300",
                                    isThoughtExpanded ? "mb-2" : "mb-0"
                                )}
                            >
                                <div className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 select-none",
                                    isThoughtExpanded
                                        ? "bg-primary/10 border-primary/20 text-primary shadow-sm shadow-primary/10"
                                        : "bg-accent/30 border-border/50 text-muted-foreground/60 hover:bg-accent/50 hover:border-border hover:text-primary/70"
                                )}>
                                    <div className={cn(
                                        "p-1 rounded-full",
                                        isThoughtExpanded ? "bg-primary/20" : "bg-accent/30"
                                    )}>
                                        <Brain className={cn("w-3.5 h-3.5", isThoughtExpanded ? "animate-pulse" : "")} />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.15em]">{isThoughtExpanded ? t('messageBubble.orbitThinking') : t('messageBubble.showThought')}</span>
                                    <Sparkles className={cn("w-3 h-3 transition-opacity duration-300", isThoughtExpanded ? "opacity-100" : "opacity-0")} />
                                    <span className={cn("text-[8px] transition-transform duration-300 ml-1", isThoughtExpanded ? "rotate-180" : "rotate-0")}>▼</span>
                                </div>
                            </button>
                            {isThoughtExpanded && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="relative pl-4 border-l-2 border-primary/20 py-1">
                                        <div className="absolute -left-[2px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-primary/40 via-primary/10 to-transparent" />
                                        <div className="bg-gradient-to-br from-primary/[0.03] to-transparent rounded-2xl p-4 border border-border/20">
                                            <div className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground/80 selection:bg-primary/20 drop-shadow-sm">
                                                {thought}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <div className={cn("rounded-2xl px-0 py-1 text-[15px] leading-[1.65] whitespace-pre-wrap break-words border-none relative group/bubble w-full overflow-hidden", isUser ? "bg-muted/10 px-4 py-3 rounded-tr-sm border border-border/50 text-foreground/90" : "bg-transparent")}>
                        {isStreaming && <ResponseProgress />}
                        {contentNode}
                        {!isUser && displayContent && !is429Error && (
                            <div className="absolute left-full ml-4 top-0 flex flex-col gap-1 opacity-0 group-hover/bubble:opacity-100 transition-all duration-200">
                                {isSpeaking ? (
                                    <button onClick={onStop} className="p-1.5 bg-muted/20 hover:bg-muted/40 rounded-lg text-primary transition-all border border-border/50 backdrop-blur-sm" title={t('messageBubble.stop')}>
                                        <VolumeX className="w-3.5 h-3.5" />
                                    </button>
                                ) : (
                                    <button onClick={() => onSpeak?.(displayContent)} className="p-1.5 bg-muted/20 hover:bg-muted/40 rounded-lg text-muted-foreground hover:text-foreground transition-all border border-border/50 backdrop-blur-sm" title={t('messageBubble.speakAloud')}>
                                        <Volume2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                <CopyButton text={displayContent} t={t} />
                                <CopyMarkdownButton text={displayContent} role={message.role} t={t} />
                                <CopyHtmlButton text={displayContent} t={t} />
                                <BookmarkButton active={!!message.isBookmarked} onClick={() => onBookmark?.(!message.isBookmarked)} t={t} />
                                <div className="relative group/react">
                                    <button className="p-1.5 bg-muted/20 hover:bg-muted/40 rounded-lg text-muted-foreground hover:text-foreground transition-all border border-border/50 backdrop-blur-sm" title={t('messageBubble.react')}>
                                        <Smile className="w-3.5 h-3.5" />
                                    </button>
                                    <div className="absolute bottom-full mb-2 bg-[#1a1b26] border border-border/50 rounded-full px-2 py-1 shadow-xl flex gap-1 opacity-0 group-hover/react:opacity-100 pointer-events-none group-hover/react:pointer-events-auto transition-all scale-90 group-hover/react:scale-100 origin-bottom">
                                        {['👍', '👎', '❤️', '🎉', '🚀'].map(emoji => (
                                            <button
                                                key={emoji}
                                                onClick={() => onReact?.(emoji)}
                                                className="hover:scale-125 transition-transform text-sm p-1"
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {onRate && <RatingButtons rating={message.rating} onRate={onRate} t={t} />}
                            </div>
                        )}
                    </div>
                    {/* Display current reactions (#56) */}
                    {message.reactions && message.reactions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1 mb-1 px-1">
                            {message.reactions.map((emoji, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => onReact?.(emoji)}
                                    className="px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] hover:bg-primary/20 transition-colors"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                    {/* Message Footer: Timestamp & Token Count (#51, #61) */}
                    {!isUser && displayContent && !is429Error && (
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground/40 font-medium">
                            <span>{message.timestamp ? new Date(message.timestamp).toLocaleTimeString(language === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                            <span className="w-1 h-1 rounded-full bg-muted-foreground/20" />
                            <span>~{Math.ceil(displayContent.length / 4)} token</span>
                            {message.model && (
                                <>
                                    <span className="w-1 h-1 rounded-full bg-muted-foreground/20" />
                                    <span className="truncate max-w-[120px]">{message.model}</span>
                                </>
                            )}
                            {message.responseTime && (
                                <>
                                    <span className="w-1 h-1 rounded-full bg-muted-foreground/20" />
                                    <span className="text-emerald-400/60">{(message.responseTime / 1000).toFixed(1)}s</span>
                                </>
                            )}
                            {message.isBookmarked && (
                                <>
                                    <span className="w-1 h-1 rounded-full bg-muted-foreground/20" />
                                    <span className="text-amber-400/60 flex items-center gap-1"><Bookmark className="w-2.5 h-2.5 fill-current" /> {t('messageBubble.favorite')}</span>
                                </>
                            )}
                            {isStreaming && streamingSpeed !== null && streamingSpeed !== undefined && (
                                <>
                                    <span className="w-1 h-1 rounded-full bg-muted-foreground/20" />
                                    <span className="text-primary animate-pulse font-bold">{streamingSpeed.toFixed(1)} tps</span>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
})
