import { safeJsonParse } from '@shared/utils/sanitize.util'
import DOMPurify from 'dompurify'
import { AlertCircle, Bookmark, Brain, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, Code2, Copy, Eye, FileCode, ListTodo, Smile, Sparkles, ThumbsDown, ThumbsUp, Volume2, VolumeX } from 'lucide-react'
import { Highlight, themes } from 'prism-react-renderer'
import { isValidElement, memo, useEffect, useId, useMemo, useRef, useState } from 'react'
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
import { Message, MessageVariant } from '@/types'

import 'katex/dist/katex.min.css'
import '@renderer/features/chat/components/MessageBubble.css'

const COLLAPSE_THRESHOLD = 30

// --- Types ---

interface MessageProps {
    message: Message
    isLast: boolean
    backend?: string
    isStreaming?: boolean
    language: Language
    onSpeak?: (text: string) => void
    onStop?: () => void
    isSpeaking?: boolean
    onCodeConvert?: (imageUrl: string) => void
    onReact?: (emoji: string) => void
    onBookmark?: (isBookmarked: boolean) => void
    onRate?: (rating: 1 | -1 | 0) => void
    onApprovePlan?: () => void
    streamingSpeed?: number | null
    streamingReasoning?: string
    id?: string
    isFocused?: boolean
    onSourceClick?: (path: string) => void
}

// --- Helper Functions ---

const getSpecialModelLogo = (name: string) => {
    const families = [
        { key: 'llama', short: 'LL', color: 'blue', title: 'Llama Family' },
        { key: 'mistral', short: 'M', color: 'orange', title: 'Mistral Family' },
        { key: 'mixtral', short: 'M', color: 'orange', title: 'Mistral Family' },
        { key: 'deepseek', short: 'DS', color: 'indigo', title: 'DeepSeek' },
        { key: 'qwen', short: 'Q', color: 'purple', title: 'Qwen' },
        { key: 'phi', short: 'Φ', color: 'cyan', title: 'Phi' }
    ]
    const match = families.find(f => name.includes(f.key))
    if (match) {
        return { short: match.short, color: match.color, title: match.title }
    }
    return null
}

const getInferredProvider = (name: string) => {
    if (name.startsWith('gpt-') || name.startsWith('o1-')) { return 'openai' }
    if (name.startsWith('claude-')) { return 'anthropic' }
    if (name.startsWith('grok-')) { return 'groq' }
    if (name.startsWith('antigravity-')) { return 'antigravity' }
    return null
}

const getProviderLogoInfo = (modelName: string, provider?: string, backend?: string) => {
    const name = modelName.toLowerCase()
    const inferred = getInferredProvider(name)
    const effective = (provider ?? backend ?? inferred ?? 'ollama').toLowerCase()

    const logoMap: Record<string, { logo: string | null; key: string; color: string; short?: string }> = {
        openai: { logo: LogoOpenAI, key: 'openai', color: 'emerald' },
        codex: { logo: LogoOpenAI, key: 'openai', color: 'emerald' },
        gpt: { logo: LogoOpenAI, key: 'openai', color: 'emerald' },
        anthropic: { logo: LogoClaude, key: 'anthropic', color: 'orange' },
        claude: { logo: LogoClaude, key: 'anthropic', color: 'orange' },
        antigravity: { logo: LogoAntigravity, key: 'antigravity', color: 'yellow' },
        github: { logo: LogoCopilot, key: 'copilot', color: 'black' },
        copilot: { logo: LogoCopilot, key: 'copilot', color: 'black' },
        groq: { logo: null, key: 'groq', color: 'red', short: 'G' }
    }

    const matchedKey = Object.keys(logoMap).find(k => effective.includes(k))
    if (matchedKey) { return logoMap[matchedKey] }
    return { logo: LogoOllama, key: effective, color: 'muted' }
}

// --- Icons & UI Elements ---

const MessageIcon = ({ short, color, title }: { short: string; color: string; title: string }) => (
    <div className={cn("w-6 h-6 rounded-md border flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1", `bg-${color}-500/10 border-${color}-500/10`)} title={title}>
        <span className={cn("font-black text-[10px]", `text-${color}-400`)}>{short}</span>
    </div>
)

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

const AssistantLogo = memo(({ displayModel, provider, backend }: { displayModel?: string; provider?: string; backend?: string }) => {
    const modelName = (displayModel ?? '').toString().toLowerCase()
    const special = getSpecialModelLogo(modelName)
    if (special) { return <MessageIcon {...special} /> }
    const info = getProviderLogoInfo(modelName, provider, backend)
    if (info.logo) {
        return (
            <div className={cn("w-6 h-6 rounded-md border flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1", `bg-${info.color}-500/10 border-${info.color}-500/10`)} title={info.key.toUpperCase()}>
                <img src={info.logo} className="w-full h-full opacity-70" alt={info.key} />
            </div>
        )
    }
    return <MessageIcon short={info.short ?? 'AI'} color={info.color} title={info.key.toUpperCase()} />
})
AssistantLogo.displayName = 'AssistantLogo'

const QuotaErrorCard = memo(({ details, t }: { details: { message: string; resets_at: number | null; model: string | null }; t: (key: string) => string }) => (
    <div className="p-4 rounded-2xl bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/20 text-red-400 max-w-md animate-in fade-in zoom-in duration-300">
        <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-full bg-red-500/20"><AlertCircle className="w-5 h-5" /></div>
            <div>
                <div className="font-bold text-sm uppercase tracking-tight">{t('messageBubble.quotaExceeded')}</div>
                {details.model && <div className="text-xs opacity-70 mt-0.5">{details.model}</div>}
            </div>
        </div>
        <p className="text-sm opacity-90 leading-relaxed mb-3">{details.message}</p>
        {details.resets_at && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/10 text-xs font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>{t('messageBubble.resetsAt')} {new Date(details.resets_at * 1000).toLocaleString()}</span>
            </div>
        )}
        <div className="mt-3 flex gap-2">
            <button className="px-3 py-1.5 text-xs rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors" onClick={() => { if (window.electron?.openExternal) { window.electron.openExternal('https://ai.google.dev/pricing') } }}>
                {t('messageBubble.checkQuotas')}
            </button>
        </div>
    </div>
))
QuotaErrorCard.displayName = 'QuotaErrorCard'

const CopyButton = memo(({ text, t }: { text: string; t: (key: string) => string }) => {
    const [copied, setCopied] = useState(false)
    const handleCopy = async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }
    return (
        <button onClick={() => { void handleCopy() }} className="p-1.5 hover:bg-accent/50 rounded-md transition-colors text-muted-foreground hover:text-foreground" title={t('messageBubble.copy')}>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
    )
})
CopyButton.displayName = 'CopyButton'

const BookmarkButton = memo(({ active, onClick, t }: { active: boolean; onClick: () => void; t: (key: string) => string }) => (
    <button onClick={onClick} className={cn("p-1.5 hover:bg-accent/50 rounded-md transition-all duration-300", active ? "text-amber-400 bg-amber-400/10 shadow-[0_0_10px_rgba(251,191,36,0.1)]" : "text-muted-foreground hover:text-foreground")} title={active ? t('messageBubble.removeBookmark') : t('messageBubble.addBookmark')}>
        <Bookmark className={cn("w-3.5 h-3.5", active && "fill-current")} />
    </button>
))
BookmarkButton.displayName = 'BookmarkButton'

const RatingButtons = memo(({ rating, onRate, t }: { rating?: 1 | -1 | 0; onRate: (val: 1 | -1 | 0) => void; t: (key: string) => string }) => (
    <div className="flex items-center gap-1 border-l border-border/50 pl-2 ml-1">
        <button onClick={() => onRate(rating === 1 ? 0 : 1)} className={cn("p-1.5 rounded-md transition-all duration-200", rating === 1 ? "text-emerald-400 bg-emerald-400/10" : "text-muted-foreground hover:text-emerald-400 hover:bg-emerald-400/5")} title={t('messageBubble.goodAnswer')}>
            <ThumbsUp className={cn("w-3.5 h-3.5", rating === 1 && "fill-current")} />
        </button>
        <button onClick={() => onRate(rating === -1 ? 0 : -1)} className={cn("p-1.5 rounded-md transition-all duration-200", rating === -1 ? "text-red-400 bg-red-400/10" : "text-muted-foreground hover:text-red-400 hover:bg-red-400/5")} title={t('messageBubble.badAnswer')}>
            <ThumbsDown className={cn("w-3.5 h-3.5", rating === -1 && "fill-current")} />
        </button>
    </div>
))
RatingButtons.displayName = 'RatingButtons'

// --- Markdown Specifics ---

const MermaidDiagram = memo(({ code }: { code: string }) => {
    const [svg, setSvg] = useState<string>('')
    const [error, setError] = useState<string | null>(null)
    const id = useId()
    useEffect(() => {
        let mounted = true
        const render = async () => {
            try {
                const m = await import('mermaid')
                const mermaid = m.default || m
                mermaid.initialize({
                    startOnLoad: false,
                    theme: 'dark',
                    securityLevel: 'loose',
                    fontFamily: 'inherit'
                })
                const { svg: renderedSvg } = await mermaid.render(id.replace(/:/g, ''), code)
                if (mounted) {
                    setSvg(DOMPurify.sanitize(renderedSvg))
                    setError(null)
                }
            } catch (err) { if (mounted) setError(err instanceof Error ? err.message : String(err)) }
        }
        void render()
        return () => { mounted = false }
    }, [code, id])
    if (error) { return <pre className="text-xs text-red-400 bg-red-500/10 p-2 rounded">{error}</pre> }
    if (!svg) { return <div className="my-4 h-32 flex items-center justify-center bg-accent/10 rounded-xl border border-white/5 animate-pulse"><div className="text-xs text-muted-foreground">Rendering Diagram...</div></div> }
    return <div dangerouslySetInnerHTML={{ __html: svg }} className="my-4 flex justify-center bg-accent/30 p-4 rounded-xl border border-border/50" />
})
MermaidDiagram.displayName = 'MermaidDiagram'

const CodeBlock = memo(({ className, children, isSpeaking, onStop, onSpeak, t }: {
    className?: string; children?: React.ReactNode; isSpeaking?: boolean; onStop?: () => void; onSpeak?: (text: string) => void; t: (key: string) => string;
}) => {
    const match = /language-(\w+)/.exec(className ?? '')
    const codeString = String(children).replace(/\n$/, '')
    if (match?.[1] === 'mermaid') { return <MermaidDiagram code={codeString} /> }
    if (!match) { return <code className="bg-muted/50 rounded px-1.5 py-0.5 font-mono text-xs font-semibold text-primary/80">{children}</code> }
    const language = match[1]
    return (
        <div className="not-prose my-3 rounded-xl overflow-hidden border border-border/30 bg-muted/30 group/code transition-premium">
            <div className="flex items-center justify-between px-4 py-2 bg-muted/20 border-b border-border/20 backdrop-blur-sm">
                <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60 group-hover/code:opacity-100 transition-opacity">{language}</span>
                <div className="flex items-center gap-1.5">
                    {isSpeaking ? (
                        <button onClick={onStop} className="p-1 px-1.5 hover:bg-accent/50 rounded-md transition-colors text-primary" title={t('messageBubble.stop')}><VolumeX className="w-3.5 h-3.5" /></button>
                    ) : (
                        <button onClick={() => onSpeak?.(codeString)} className="p-1 px-1.5 hover:bg-accent/50 rounded-md transition-colors text-muted-foreground hover:text-foreground" title={t('messageBubble.speakAloud')}><Volume2 className="w-3.5 h-3.5" /></button>
                    )}
                    <CopyButton text={codeString} t={t} />
                </div>
            </div>
            <Highlight theme={themes.vsDark} code={codeString} language={language}>
                {({ style, tokens, getLineProps, getTokenProps }) => (
                    <pre className="p-4 overflow-x-auto m-0 !bg-transparent text-sm leading-relaxed" style={style}>
                        {tokens.map((line, i) => (
                            <div key={i} {...getLineProps({ line })} className="flex">
                                <span className="select-none text-muted-foreground/30 mr-4 text-xs inline-block w-4 text-right shrink-0">{i + 1}</span>
                                <div className="flex-1">{line.map((token, key) => <span key={key} {...getTokenProps({ token })} />)}</div>
                            </div>
                        ))}
                    </pre>
                )}
            </Highlight>
        </div>
    )
})
CodeBlock.displayName = 'CodeBlock'

const MarkdownImage = memo(({ src, alt, onCodeConvert, t }: { src?: string; alt?: string; onCodeConvert?: (url: string) => void; t: (key: string) => string }) => (
    <span className="block my-2 relative group/image">
        <img src={src} alt={alt ?? 'Image'} className="max-w-full max-h-96 rounded-lg border border-border/50 cursor-pointer hover:opacity-90 transition-opacity whitespace-pre-wrap" onClick={() => { if (src && window.electron?.openExternal) { window.electron.openExternal(src) } }} />
        {alt && <span className="text-xs text-muted-foreground mt-1 block font-medium">{alt}</span>}
        {src && onCodeConvert && (
            <button
                onClick={(e) => { e.stopPropagation(); onCodeConvert(src) }}
                className="absolute top-2 right-2 bg-background/60 hover:bg-background/80 backdrop-blur-md border border-border/50 text-foreground px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide opacity-0 group-hover/image:opacity-100 transition-all flex items-center gap-2 transform translate-y-2 group-hover/image:translate-y-0"
            >
                <Code2 className="w-3.5 h-3.5" />{t('messageBubble.convertToCode')}
            </button>
        )}
    </span>
))
MarkdownImage.displayName = 'MarkdownImage'

const MarkdownContent = memo(({ content, onSpeak, onStop, isSpeaking, onCodeConvert, t }: {
    content: string; onSpeak?: (text: string) => void; onStop?: () => void; isSpeaking?: boolean; onCodeConvert?: (imageUrl: string) => void; t: (key: string) => string;
}) => (
    <div className="markdown-body">
        <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
                code: (props) => <CodeBlock {...props} isSpeaking={isSpeaking} onStop={onStop} onSpeak={onSpeak} t={t} />,
                img: (props) => <MarkdownImage {...props} onCodeConvert={onCodeConvert} t={t} />,
                a: ({ href, children }) => (<a href={href} className="text-primary hover:underline underline-offset-4 font-medium" onClick={(e) => { e.preventDefault(); if (href && window.electron?.openExternal) { window.electron.openExternal(href) } }}>{children}</a>),
                li: ({ children }) => {
                    const isCheckbox = Array.isArray(children) && children.some(c => isValidElement(c) && (c as React.ReactElement<{ type?: string }>).props?.type === 'checkbox')
                    return <li className={cn(isCheckbox ? "list-none -ml-4" : "list-disc", "my-1")}>{children}</li>
                },
                input: ({ type, checked, ...props }) => {
                    if (type === 'checkbox') { return <input type="checkbox" checked={checked} readOnly className="mr-2 accent-primary scale-110 align-middle" {...props} /> }
                    return <input {...props} />
                },
                ul: ({ children }) => <ul className="pl-4 my-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 my-2 space-y-1">{children}</ol>,
            }}
        >{content}</ReactMarkdown>
    </div>
))
MarkdownContent.displayName = 'MarkdownContent'

// --- Sections ---

const ThoughtSection = memo(({ thought, isThoughtExpanded, setIsThoughtExpanded, t }: { thought: string | null; isThoughtExpanded: boolean; setIsThoughtExpanded: (expanded: boolean) => void; t: (key: string) => string; }) => {
    if (!thought) { return null }
    return (
        <div className="w-full mb-3">
            <button onClick={() => setIsThoughtExpanded(!isThoughtExpanded)} className={cn("flex items-center gap-2 group/thought transition-all duration-300", isThoughtExpanded ? "mb-2" : "mb-0")}>
                <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 select-none", isThoughtExpanded ? "bg-primary/10 border-primary/20 text-primary shadow-sm shadow-primary/10" : "bg-accent/30 border-border/50 text-muted-foreground/60 hover:bg-accent/50 hover:border-border hover:text-primary/70")}>
                    <div className={cn("p-1 rounded-full", isThoughtExpanded ? "bg-primary/20" : "bg-accent/30")}><Brain className={cn("w-3.5 h-3.5", isThoughtExpanded ? "animate-pulse" : "")} /></div>
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
                            <div className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground/80 selection:bg-primary/20 drop-shadow-sm">{thought}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
})
ThoughtSection.displayName = 'ThoughtSection'

const PlanSection = memo(({ plan, isLast, isStreaming, onApprovePlan, t }: { plan: string | null; isLast: boolean; isStreaming?: boolean; onApprovePlan?: () => void; t: (key: string) => string; }) => {
    if (!plan) { return null }
    return (
        <div className="w-full mb-4 bg-gradient-to-br from-primary/[0.07] to-purple-500/[0.02] border border-primary/20 rounded-2xl p-4 shadow-lg shadow-primary/5 animate-fade-in relative overflow-hidden group/plan">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/plan:opacity-20 transition-opacity"><ListTodo className="w-12 h-12" /></div>
            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-primary/10">
                <div className="p-1.5 rounded-lg bg-primary/20"><ListTodo className="w-4 h-4 text-primary" /></div>
                <span className="text-xs font-black text-primary uppercase tracking-[0.2em]">{t('chat.plan')}</span>
            </div>
            <div className="text-[13px] text-foreground/90 leading-relaxed font-medium">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ li: ({ children }) => (<li className="flex gap-2.5 my-1.5 items-start"><div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" /><span>{children}</span></li>), ul: ({ children }) => <ul className="space-y-1">{children}</ul> }}>{plan}</ReactMarkdown>
            </div>
            {isLast && !isStreaming && onApprovePlan && (
                <div className="mt-4 pt-4 border-t border-primary/10 flex justify-end">
                    <button onClick={onApprovePlan} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20"><Check className="w-3.5 h-3.5" />{t('messageBubble.approvePlan')}</button>
                </div>
            )}
        </div>
    )
})
PlanSection.displayName = 'PlanSection'

const PlanAndThought = memo(({ plan, thought, isLast, isStreaming, onApprovePlan, isThoughtExpanded, setIsThoughtExpanded, t }: {
    plan: string | null; thought: string | null; isLast: boolean; isStreaming?: boolean; onApprovePlan?: () => void; isThoughtExpanded: boolean; setIsThoughtExpanded: (v: boolean) => void; t: (key: string) => string;
}) => (
    <>
        <PlanSection plan={plan} isLast={isLast} isStreaming={isStreaming} onApprovePlan={onApprovePlan} t={t} />
        <ThoughtSection thought={thought} isThoughtExpanded={isThoughtExpanded} setIsThoughtExpanded={setIsThoughtExpanded} t={t} />
    </>
))
PlanAndThought.displayName = 'PlanAndThought'

const MessageBubbleContent = memo(({ showRawMarkdown, quotaDetails, thought, displayContent, images, isStreaming, visibleContent, onSpeak, onStop, isSpeaking, onCodeConvert, t, isUser }: {
    showRawMarkdown: boolean; quotaDetails: { message: string; resets_at: number | null; model: string | null } | null; thought: string | null; displayContent: string; images: string[]; isStreaming?: boolean; visibleContent: string; onSpeak?: (text: string) => void; onStop?: () => void; isSpeaking?: boolean; onCodeConvert?: (imageUrl: string) => void; t: (key: string) => string; isUser?: boolean;
}) => {
    if (quotaDetails) { return <QuotaErrorCard details={quotaDetails} t={t} /> }
    if (!thought && !displayContent && images.length === 0) { return isStreaming ? <TypingDots t={t} /> : <span className="italic opacity-50">...</span> }
    if (!displayContent) { return null }
    if (showRawMarkdown || isUser) { return <div className="whitespace-pre-wrap font-mono text-sm bg-accent/20 rounded-lg p-3 border border-border/30 overflow-x-auto text-foreground/90 leading-relaxed">{visibleContent}</div> }
    return <MarkdownContent content={visibleContent} onSpeak={onSpeak} onStop={onStop} isSpeaking={isSpeaking} onCodeConvert={onCodeConvert} t={t} />
})
MessageBubbleContent.displayName = 'MessageBubbleContent'

const MessageActions = memo(({ displayContent, message, isSpeaking, onStop, onSpeak, onBookmark, onReact, onRate, t }: {
    displayContent: string; message: Message; isSpeaking?: boolean; onStop?: () => void; onSpeak?: (text: string) => void; onBookmark?: (isBookmarked: boolean) => void; onReact?: (emoji: string) => void; onRate?: (rating: 1 | -1 | 0) => void; t: (key: string) => string;
}) => (
    <div className="absolute left-full ml-4 top-0 flex flex-col gap-1 opacity-0 group-hover/bubble:opacity-100 transition-all duration-200">
        {isSpeaking ? (
            <button onClick={onStop} className="p-1.5 bg-muted/20 hover:bg-muted/40 rounded-lg text-primary transition-all border border-border/50 backdrop-blur-sm" title={t('messageBubble.stop')}><VolumeX className="w-3.5 h-3.5" /></button>
        ) : (
            <button onClick={() => onSpeak?.(displayContent)} className="p-1.5 bg-muted/20 hover:bg-muted/40 rounded-lg text-muted-foreground hover:text-foreground transition-all border border-border/50 backdrop-blur-sm" title={t('messageBubble.speakAloud')}><Volume2 className="w-3.5 h-3.5" /></button>
        )}
        <CopyButton text={displayContent} t={t} />
        <BookmarkButton active={!!message.isBookmarked} onClick={() => onBookmark?.(!message.isBookmarked)} t={t} />
        <div className="relative group/react">
            <button className="p-1.5 bg-muted/20 hover:bg-muted/40 rounded-lg text-muted-foreground hover:text-foreground transition-all border border-border/50 backdrop-blur-sm" title={t('messageBubble.react')}><Smile className="w-3.5 h-3.5" /></button>
            <div className="absolute bottom-full mb-2 bg-popover border border-border/50 rounded-full px-2 py-1 shadow-xl flex gap-1 opacity-0 group-hover/react:opacity-100 pointer-events-none group-hover/react:pointer-events-auto transition-all scale-90 group-hover/react:scale-100 origin-bottom">
                {['👍', '👎', '❤️', '🎉', '🚀'].map(emoji => (<button key={emoji} onClick={() => onReact?.(emoji)} className="hover:scale-125 transition-transform text-sm p-1">{emoji}</button>))}
            </div>
        </div>
        {onRate && <RatingButtons rating={message.rating} onRate={onRate} t={t} />}
    </div>
))
MessageActions.displayName = 'MessageActions'

const MessageImages = memo(({ images, t }: { images: string[]; t: (key: string) => string }) => {
    if (images.length === 0) { return null }
    return (
        <div className="flex gap-3 flex-wrap mb-4">
            {images.map((img, i) => (
                img === '__LOADING_IMAGE__' ? <ImageSkeleton key={i} t={t} /> : (
                    <div key={i} className="relative group/img-container">
                        <img src={img} alt={`Attached ${i + 1}`} className="max-w-full md:max-w-md max-h-[500px] object-contain rounded-xl border border-border/50 cursor-pointer hover:opacity-90 transition-all duration-300 shadow-2xl" onClick={() => { if (img && window.electron?.openExternal) { window.electron.openExternal(img) } }} />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img-container:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none"><Eye className="w-6 h-6 text-white" /></div>
                    </div>
                )
            ))}
        </div>
    )
})
MessageImages.displayName = 'MessageImages'

const MessageSources = memo(({ sources, onSourceClick, t }: { sources: string[]; onSourceClick?: (p: string) => void; t: (key: string) => string }) => {
    if (sources.length === 0) { return null }
    return (
        <div className="flex flex-wrap gap-2 mt-3 animate-fade-in">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-primary/5 border border-primary/10 text-[10px] text-primary font-bold uppercase tracking-wider mb-1"><Sparkles className="w-3 h-3" />{t('chat.sources')}</div>
            <div className="flex flex-wrap gap-1.5">
                {sources.map((path, idx) => (
                    <button key={idx} onClick={() => onSourceClick?.(path)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/30 border border-border/30 hover:border-primary/50 hover:bg-primary/5 transition-all text-xs text-muted-foreground hover:text-foreground group/chip" title={path}><FileCode className="w-3.5 h-3.5 text-primary/60 group-hover/chip:text-primary" /><span>{path.split(/[\\/]/).pop() ?? path}</span></button>
                ))}
            </div>
        </div>
    )
})
MessageSources.displayName = 'MessageSources'

const MessageVariants = memo(({ variants, variantIndex, setVariantIndex, t: _t }: { variants: MessageVariant[]; variantIndex: number; setVariantIndex: (idx: number) => void; t: (key: string) => string; }) => (
    <div className="flex flex-col gap-2 mt-3 select-none">
        <div className="flex items-center gap-1 flex-wrap bg-muted/10 rounded-lg p-1 border border-border/30">
            {variants.map((v, idx) => (<button key={idx} onClick={() => setVariantIndex(idx)} className={cn("px-2.5 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-2 border", idx === variantIndex ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20 scale-[1.02]" : "hover:bg-accent/50 text-muted-foreground border-transparent")}>{(v.label ?? v.model ?? `Res ${idx + 1}`).slice(0, 20)} {idx === variantIndex && <Check className="w-2.5 h-2.5" />}</button>))}
        </div>
        <div className="flex items-center gap-2 justify-center mt-1">
            <button disabled={variantIndex === 0} onClick={() => setVariantIndex(variantIndex - 1)} className="p-1 px-1.5 rounded bg-accent/30 hover:bg-accent/50 disabled:opacity-30 transition-colors"><ChevronLeft className="w-3 h-3" /></button>
            <span className="text-[10px] text-muted-foreground/60 font-bold">{variantIndex + 1} / {variants.length}</span>
            <button disabled={variantIndex === variants.length - 1} onClick={() => setVariantIndex(variantIndex + 1)} className="p-1 px-1.5 rounded bg-accent/30 hover:bg-accent/50 disabled:opacity-30 transition-colors"><ChevronRight className="w-3 h-3" /></button>
        </div>
    </div>
))
MessageVariants.displayName = 'MessageVariants'

const RawToggle = memo(({ active, onClick, t }: { active: boolean; onClick: () => void; t: (key: string) => string }) => (
    <div className="flex items-center gap-2 mb-1">
        <button onClick={onClick} className={cn("flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors", active ? "bg-primary/20 text-primary" : "bg-accent/30 text-muted-foreground hover:text-foreground hover:bg-accent/50")}>
            {active ? <Eye className="w-3 h-3" /> : <Code2 className="w-3 h-3" />}
            {active ? t('chat.render') : t('chat.raw')}
        </button>
    </div>
))
RawToggle.displayName = 'RawToggle'

const MoreLines = memo(({ expanded, count, onClick, t }: { expanded: boolean; count: number; onClick: () => void; t: (key: string) => string }) => (
    <button onClick={onClick} className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-accent/30 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all">
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {expanded ? t('chat.collapse') : `${count} ${t('chat.moreLines')}`}
    </button>
))
MoreLines.displayName = 'MoreLines'

interface MessageBubbleInnerProps {
    isUser: boolean
    isStreaming?: boolean
    displayContent: string
    quotaDetails: { message: string; resets_at: number | null; model: string | null } | null
    images: string[]
    showRawMarkdown: boolean
    visibleContent: string
    thought: string | null
    onSpeak?: (text: string) => void
    onStop?: () => void
    isSpeaking?: boolean
    onCodeConvert?: (imageUrl: string) => void
    message: Message
    onBookmark?: (isBookmarked: boolean) => void
    onReact?: (emoji: string) => void
    onRate?: (rating: 1 | -1 | 0) => void
    onSourceClick?: (path: string) => void
    setIsContentExpanded: (val: boolean) => void
    isContentExpanded: boolean
    lineCount: number
    setShowRawMarkdown: (val: boolean) => void
    t: (key: string) => string
}

const MessageBubbleInner = memo(({ isUser, isStreaming, displayContent, quotaDetails, images, showRawMarkdown, visibleContent, thought, onSpeak, onStop, isSpeaking, onCodeConvert, message, onBookmark, onReact, onRate, onSourceClick, setIsContentExpanded, isContentExpanded, lineCount, setShowRawMarkdown, t }: MessageBubbleInnerProps) => {
    const showToggle = displayContent && !isUser && !quotaDetails
    const showMore = lineCount > COLLAPSE_THRESHOLD && !isUser && !quotaDetails
    const showActions = !isUser && displayContent && !quotaDetails
    return (
        <div className={cn("rounded-2xl px-0 py-1 text-[15px] leading-[1.65] whitespace-pre-wrap break-words border-none relative group/bubble w-full overflow-hidden", isUser ? "bg-muted/10 px-4 py-3 rounded-tr-sm border border-border/50 text-foreground/90" : "bg-transparent")}>
            {isStreaming && <ResponseProgress />}
            <div className="flex flex-col gap-2">
                <MessageImages images={images} t={t} />
                {showToggle && <RawToggle active={showRawMarkdown} onClick={() => setShowRawMarkdown(!showRawMarkdown)} t={t} />}
                <MessageBubbleContent showRawMarkdown={showRawMarkdown} quotaDetails={quotaDetails} thought={thought} displayContent={displayContent} images={images} isStreaming={isStreaming} visibleContent={visibleContent} onSpeak={onSpeak} onStop={onStop} isSpeaking={isSpeaking} onCodeConvert={onCodeConvert} t={t} isUser={isUser} />
                <MessageSources sources={message.sources ?? []} onSourceClick={onSourceClick} t={t} />
                {showMore && <MoreLines expanded={isContentExpanded} count={lineCount - COLLAPSE_THRESHOLD} onClick={() => setIsContentExpanded(!isContentExpanded)} t={t} />}
            </div>
            {showActions && <MessageActions displayContent={displayContent} message={message} isSpeaking={isSpeaking} onStop={onStop} onSpeak={onSpeak} onBookmark={onBookmark} onReact={onReact} onRate={onRate} t={t} />}
        </div>
    )
})
MessageBubbleInner.displayName = 'MessageBubbleInner'

// --- Main Hook Logic ---

const useMessageContent = (raw: Message['content'], reasoning: string | undefined, streaming: string | undefined) => useMemo(() => {
    let content = typeof raw === 'string' ? raw : (Array.isArray(raw) ? raw.map((c) => typeof c === 'string' ? c : (c.text ?? '')).join('') : '')
    let r = reasoning ?? null
    if (!r) {
        const m = /<think>([\s\S]*?)(?:<\/think>|$)/.exec(content)
        if (m) { r = m[1] ?? null; content = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '') }
    }
    const pm = /<plan>([\s\S]*?)(?:<\/plan>|$)/.exec(content)
    let p = null
    if (pm) { p = pm[1] ?? null; content = content.replace(/<plan>[\s\S]*?(?:<\/plan>|$)/, '') }
    return { thought: streaming ?? r, plan: p, displayContent: content.trim() }
}, [raw, reasoning, streaming])

const useQuotaDetails = (is429: boolean, content: string, t: (key: string) => string) => useMemo(() => {
    if (!is429) { return null }
    try {
        const m = content.match(/\{[\s\S]*\}/)
        if (m) {
            const d = safeJsonParse<Record<string, unknown>>(m[0], {})
            const o = (d.error ?? d) as { message?: string; resets_at?: number; model?: string }
            return { message: o.message ?? t('messageBubble.quotaExceeded'), resets_at: o.resets_at ?? null, model: o.model ?? null }
        }
    } catch { /* skip */ }
    return { message: t('messageBubble.quotaMessage'), resets_at: null, model: null }
}, [is429, content, t])

const MessageVariantCard = memo(({ variant, isSelected, onClick, t, isUser, isStreaming, onSpeak, onStop, isSpeaking }: { variant: MessageVariant; isSelected: boolean; onClick: () => void; t: (key: string) => string; isUser: boolean; isStreaming?: boolean; onSpeak?: (text: string) => void; onStop?: () => void; isSpeaking?: boolean }) => {
    const { thought, plan, displayContent } = useMessageContent(variant.content, undefined, undefined)
    const [showRawMarkdown, setShowRawMarkdown] = useState(false)
    const [isContentExpanded, setIsContentExpanded] = useState(false)
    const lineCount = displayContent.split('\n').length
    const visibleContent = (lineCount > COLLAPSE_THRESHOLD && !isContentExpanded) ? displayContent.split('\n').slice(0, COLLAPSE_THRESHOLD).join('\n') + '\n...' : displayContent
    const is429 = displayContent.includes('429') || displayContent.includes('RESOURCE_EXHAUSTED')
    const quota = useQuotaDetails(is429, displayContent, t)

    return (
        <div
            onClick={onClick}
            className={cn(
                "relative flex flex-col gap-2 p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md",
                isSelected ? "bg-card border-primary/50 ring-1 ring-primary/20 shadow-sm" : "bg-card/50 border-border/40 hover:bg-card hover:border-primary/30"
            )}
        >
            <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-border/20">
                <div className="flex items-center gap-2">
                    <AssistantLogo displayModel={variant.model} provider={variant.provider} />
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-foreground/90">{variant.model || 'Unknown Model'}</span>
                        <span className="text-[10px] text-muted-foreground">{variant.provider}</span>
                    </div>
                </div>
                {isSelected && <div className="bg-primary/10 text-primary p-1 rounded-full"><Check className="w-3 h-3" /></div>}
            </div>

            <div className="flex-1 min-h-[100px]">
                <MessageBubbleContent
                    showRawMarkdown={showRawMarkdown}
                    quotaDetails={quota}
                    thought={thought}
                    displayContent={displayContent}
                    images={[]}
                    isStreaming={isStreaming}
                    visibleContent={visibleContent}
                    onSpeak={onSpeak}
                    onStop={onStop}
                    isSpeaking={isSpeaking}
                    t={t}
                    isUser={isUser}
                />
            </div>

            <div className="mt-2 text-[10px] text-muted-foreground/40 font-medium flex justify-between items-center">
                <span>{new Date(variant.timestamp).toLocaleTimeString()}</span>
                {lineCount > COLLAPSE_THRESHOLD && (
                    <button onClick={(e) => { e.stopPropagation(); setIsContentExpanded(!isContentExpanded); }} className="flex items-center gap-1 hover:text-primary transition-colors bg-accent/30 hover:bg-accent/50 px-2 py-1 rounded">
                        {isContentExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {isContentExpanded ? t('chat.collapse') : t('chat.readMore')}
                    </button>
                )}
            </div>
        </div>
    )
})
MessageVariantCard.displayName = 'MessageVariantCard'

export const MessageBubble = memo(({ message, isLast, backend, isStreaming, language, onSpeak, onStop, isSpeaking, onCodeConvert, onReact, onBookmark, onRate, onApprovePlan, streamingSpeed, streamingReasoning, id, isFocused, onSourceClick }: MessageProps) => {
    const { t } = useTranslation(language)
    const isUser = message.role === 'user'
    const [isThoughtExpanded, setIsThoughtExpanded] = useState(false)
    const [showRawMarkdown, setShowRawMarkdown] = useState(false)
    const [isContentExpanded, setIsContentExpanded] = useState(false)

    // Multi-Model State
    const variants = message.variants ?? []
    const hasVariants = variants.length > 1
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)

    // Determine active content
    // If we have variants, we prioritize the selected one, or the one marked isSelected, or the first one.
    // However, for the LIST view, we render the grid.
    // For single view (no variants), we rely on message.content.

    // We only use this for Single View fallback
    const activeVariant = selectedVariantId ? variants.find(v => v.id === selectedVariantId) : (variants.find(v => v.isSelected) || variants[0])
    const rawContent = hasVariants ? (activeVariant?.content || '') : message.content
    const rawReasoning = hasVariants ? undefined : message.reasoning // Variants don't have reasoning in current UI logic separate from content usually, but hook splits it.

    const { thought, plan, displayContent } = useMessageContent(rawContent, rawReasoning, streamingReasoning)

    const autoExpandDone = useRef(false)
    useEffect(() => {
        if (isLast && thought && !displayContent && !isThoughtExpanded && !autoExpandDone.current && !hasVariants) {
            setTimeout(() => { setIsThoughtExpanded(true) }, 0)
            autoExpandDone.current = true
        }
    }, [isLast, thought, displayContent, isThoughtExpanded, hasVariants])

    const lineCount = displayContent.split('\n').length
    const visibleContent = (lineCount > COLLAPSE_THRESHOLD && !isContentExpanded && !isUser) ? displayContent.split('\n').slice(0, COLLAPSE_THRESHOLD).join('\n') + '\n...' : displayContent
    const is429 = displayContent.includes('429') || displayContent.includes('RESOURCE_EXHAUSTED') || displayContent.includes('Rate limit') || displayContent.includes('quota')
    const quota = useQuotaDetails(is429, displayContent, t)
    const images = (message.images ?? []).filter((img): img is string => typeof img === 'string')

    const handleVariantClick = (vId: string) => {
        setSelectedVariantId(vId)
        // Optionally update DB to mark as selected?
    }

    if (hasVariants && !isUser) {
        return (
            <div id={id} className={cn("w-full animate-fade-in py-2 group", isFocused && "bg-primary/5 ring-1 ring-primary/20 rounded-xl")}>
                <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="bg-primary/10 p-1.5 rounded-lg"><Sparkles className="w-4 h-4 text-primary" /></div>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('chat.modelComparison')}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {variants.map((variant) => (
                        <MessageVariantCard
                            key={variant.id}
                            variant={variant}
                            isSelected={!!(selectedVariantId === variant.id || (!selectedVariantId && variant.isSelected))}
                            onClick={() => handleVariantClick(variant.id)}
                            t={t}
                            isUser={isUser}
                            isStreaming={Boolean(isStreaming && (variant.model === backend))}
                            onSpeak={onSpeak}
                            onStop={onStop}
                            isSpeaking={isSpeaking}
                        />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div id={id} className={cn("flex w-full animate-fade-in group transition-all duration-300 rounded-2xl p-2", isUser ? "justify-end" : "justify-start", isFocused && "bg-primary/5 ring-1 ring-primary/20 shadow-lg shadow-primary/5")}>
            <div className={cn("flex max-w-[85%] md:max-w-[75%] gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
                {!isUser && <AssistantLogo displayModel={message.model} provider={message.provider} backend={backend} />}
                <div className={cn("flex flex-col gap-1 min-w-0", isUser ? "items-end" : "items-start")}>
                    <PlanAndThought plan={plan} thought={thought} isLast={isLast} isStreaming={isStreaming} onApprovePlan={onApprovePlan} isThoughtExpanded={isThoughtExpanded} setIsThoughtExpanded={setIsThoughtExpanded} t={t} />
                    <MessageBubbleInner isUser={isUser} isStreaming={isStreaming} displayContent={displayContent} quotaDetails={quota} images={images} showRawMarkdown={showRawMarkdown} visibleContent={visibleContent} thought={thought} onSpeak={onSpeak} onStop={onStop} isSpeaking={isSpeaking} onCodeConvert={onCodeConvert} message={message} onBookmark={onBookmark} onReact={onReact} onRate={onRate} onSourceClick={onSourceClick} setIsContentExpanded={setIsContentExpanded} isContentExpanded={isContentExpanded} lineCount={lineCount} setShowRawMarkdown={setShowRawMarkdown} t={t} />
                    {message.reactions && message.reactions.length > 0 && (<div className="flex flex-wrap gap-1 mt-1 mb-1 px-1">{message.reactions.map((e, idx) => (<button key={idx} onClick={() => onReact?.(e)} className="px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] hover:bg-primary/20 transition-colors">{e}</button>))}</div>)}
                    {!isUser && displayContent && !quota && (<div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground/40 font-medium"><span>{new Date(message.timestamp).toLocaleTimeString(language === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span><span className="w-1 h-1 rounded-full bg-muted-foreground/20" /><span>~{Math.ceil(displayContent.length / 4)} token</span>{message.model && (<><span className="w-1 h-1 rounded-full bg-muted-foreground/20" /><span className="truncate max-w-[120px]">{message.model}</span></>)}{message.responseTime && (<><span className="w-1 h-1 rounded-full bg-muted-foreground/20" /><span className="text-emerald-400/60">{(message.responseTime / 1000).toFixed(1)}s</span></>)}{message.isBookmarked && (<><span className="w-1 h-1 rounded-full bg-muted-foreground/20" /><span className="text-amber-400/60 flex items-center gap-1"><Bookmark className="w-2.5 h-2.5 fill-current" /> {t('messageBubble.favorite')}</span></>)}{isStreaming && streamingSpeed && (<><span className="w-1 h-1 rounded-full bg-muted-foreground/20" /><span className="text-primary animate-pulse font-bold">{streamingSpeed.toFixed(1)} tps</span></>)}</div>)}
                </div>
            </div>
        </div>
    )
})
MessageBubble.displayName = 'MessageBubble'
