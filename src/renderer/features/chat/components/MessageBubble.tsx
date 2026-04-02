import { safeJsonParse } from '@shared/utils/sanitize.util';
import DOMPurify from 'dompurify';
import {
    AlertCircle,
    Bookmark,
    Brain,
    Check,
    ChevronLeft,
    ChevronRight,
    Clock,
    Code2,
    Copy,
    Eye,
    FileCode,
    ListTodo,
    RotateCcw,
    Shield,
    Smile,
    Sparkles,
    ThumbsDown,
    ThumbsUp,
    Volume2,
    VolumeX,
} from 'lucide-react';
import { Highlight, themes } from 'prism-react-renderer';
import React, { isValidElement, lazy, memo, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import LogoAntigravity from '@/assets/antigravity.svg';
import LogoOpenAI from '@/assets/chatgpt.svg';
import LogoClaude from '@/assets/claude.svg';
import LogoCopilot from '@/assets/copilot.png';
import LogoOllama from '@/assets/ollama.svg';
import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { Attachment, Message, MessageVariant } from '@/types';

import { AttachmentList } from './input/AttachmentList';
import { TypingIndicator } from './TypingIndicator';

import 'katex/dist/katex.min.css';
import '@renderer/features/chat/components/MessageBubble.css';

// --- Types ---

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

interface MessageProps {
    message: Message;
    isLast: boolean;
    backend?: string;
    isStreaming?: boolean;
    language: Language;
    onSpeak?: (text: string) => void;
    onStop?: () => void;
    isSpeaking?: boolean;
    onCodeConvert?: (imageUrl: string) => void;
    onReact?: (emoji: string) => void;
    onBookmark?: (isBookmarked: boolean) => void;
    onRate?: (rating: 1 | -1 | 0) => void;
    onRegenerate?: () => void;
    onApprovePlan?: () => void;
    streamingSpeed?: number | null;
    streamingReasoning?: string;
    id?: string;
    isFocused?: boolean;
    onSourceClick?: (path: string) => void;
    footerConfig?: {
        showTimestamp?: boolean;
        showTokens?: boolean;
        showModel?: boolean;
        showResponseTime?: boolean;
    };
}

// --- Helper Functions ---

const getSpecialModelLogo = (name: string, t: TranslationFn) => {
    const families = [
        { key: 'llama', short: 'LL', color: 'blue', title: t('messageBubble.modelFamilies.llama') },
        {
            key: 'mistral',
            short: 'M',
            color: 'orange',
            title: t('messageBubble.modelFamilies.mistral'),
        },
        {
            key: 'mixtral',
            short: 'M',
            color: 'orange',
            title: t('messageBubble.modelFamilies.mistral'),
        },
        {
            key: 'deepseek',
            short: 'DS',
            color: 'indigo',
            title: t('messageBubble.modelFamilies.deepseek'),
        },
        { key: 'qwen', short: 'Q', color: 'purple', title: t('messageBubble.modelFamilies.qwen') },
        { key: 'phi', short: 'Φ', color: 'cyan', title: t('messageBubble.modelFamilies.phi') },
    ];
    const match = families.find(f => name.includes(f.key));
    if (match) {
        return { short: match.short, color: match.color, title: match.title };
    }
    return null;
};

const getInferredProvider = (name: string) => {
    if (name.startsWith('gpt-') || name.startsWith('o1-')) {
        return 'openai';
    }
    if (name.startsWith('claude-')) {
        return 'anthropic';
    }
    if (name.startsWith('grok-')) {
        return 'groq';
    }
    if (name.startsWith('antigravity-')) {
        return 'antigravity';
    }
    return null;
};

const getProviderLogoInfo = (modelName: string, provider?: string, backend?: string) => {
    const name = modelName.toLowerCase();
    const inferred = getInferredProvider(name);
    const effective = (provider ?? backend ?? inferred ?? 'ollama').toLowerCase();

    const logoMap: Record<
        string,
        { logo: string | null; key: string; color: string; short?: string }
    > = {
        openai: { logo: LogoOpenAI, key: 'openai', color: 'emerald' },
        codex: { logo: LogoOpenAI, key: 'openai', color: 'emerald' },
        gpt: { logo: LogoOpenAI, key: 'openai', color: 'emerald' },
        anthropic: { logo: LogoClaude, key: 'anthropic', color: 'orange' },
        claude: { logo: LogoClaude, key: 'anthropic', color: 'orange' },
        antigravity: { logo: LogoAntigravity, key: 'antigravity', color: 'yellow' },
        github: { logo: LogoCopilot, key: 'copilot', color: 'black' },
        copilot: { logo: LogoCopilot, key: 'copilot', color: 'black' },
        groq: { logo: null, key: 'groq', color: 'red', short: 'G' },
    };

    const matchedKey = Object.keys(logoMap).find(k => effective.includes(k));
    if (matchedKey) {
        return logoMap[matchedKey];
    }
    return { logo: LogoOllama, key: effective, color: 'muted' };
};

// --- Icons & UI Elements ---

const MessageIcon = ({ short, color, title }: { short: string; color: string; title: string }) => (
    <div
        className={cn(
            'w-6 h-6 rounded-md border flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1',
            `bg-${color}-500/10 border-${color}-500/10`
        )}
        title={title}
    >
        <span className={cn('font-bold text-xxs', `text-${color}-400`)}>{short}</span>
    </div>
);

const ResponseProgress = () => (
    <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden bg-primary/5">
        <div
            className="h-full w-full bg-primary/40 animate-pulse"
            style={{
                background:
                    'linear-gradient(90deg, transparent 0%, var(--primary) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
            }}
        />
    </div>
);

const handleToolbarArrowNavigation = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
        return;
    }

    const controls = Array.from(
        event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])')
    );
    if (controls.length === 0) {
        return;
    }

    const activeIndex = controls.findIndex(control => control === document.activeElement);
    let nextIndex = activeIndex >= 0 ? activeIndex : 0;

    if (event.key === 'ArrowDown') {
        nextIndex = (nextIndex + 1) % controls.length;
    } else if (event.key === 'ArrowUp') {
        nextIndex = (nextIndex - 1 + controls.length) % controls.length;
    } else if (event.key === 'Home') {
        nextIndex = 0;
    } else if (event.key === 'End') {
        nextIndex = controls.length - 1;
    }

    controls[nextIndex]?.focus();
    event.preventDefault();
};

const ImageSkeleton = ({ t }: { t: TranslationFn }) => (
    <div className="w-72 h-72 rounded-xl bg-accent/30 border border-border/50 flex flex-col items-center justify-center gap-4 relative overflow-hidden group/skel">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/30 to-transparent -translate-x-full animate-slide-shimmer" />
        <div className="w-12 h-12 rounded-full bg-accent/30 flex items-center justify-center animate-pulse">
            <Sparkles className="w-6 h-6 text-primary/40" />
        </div>
        <div className="space-y-2 text-center">
            <div className="text-xxs font-bold text-muted-foreground/40 animate-pulse">
                {t('messageBubble.TengraDrawing')}
            </div>
            <div className="flex gap-1 justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-bounce" />
            </div>
        </div>
    </div>
);

const AssistantLogo = memo(
    ({
        displayModel,
        provider,
        backend,
        t,
    }: {
        displayModel?: string;
        provider?: string;
        backend?: string;
        t: TranslationFn;
    }) => {
        const modelName = (displayModel ?? '').toString().toLowerCase();
        const special = getSpecialModelLogo(modelName, t);
        if (special) {
            return <MessageIcon {...special} />;
        }
        const info = getProviderLogoInfo(modelName, provider, backend);
        if (info.logo) {
            return (
                <div
                    className={cn(
                        'w-6 h-6 rounded-md border flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1',
                        `bg-${info.color}-500/10 border-${info.color}-500/10`
                    )}
                    title={info.key.toUpperCase()}
                >
                    <img src={info.logo} className="w-full h-full opacity-70" alt={info.key} />
                </div>
            );
        }
        return (
            <MessageIcon
                short={info.short ?? t('common.ai')}
                color={info.color}
                title={info.key.toUpperCase()}
            />
        );
    }
);
AssistantLogo.displayName = 'AssistantLogo';

const QuotaErrorCard = memo(
    ({
        details,
        t,
    }: {
        details: { message: string; resets_at: number | null; model: string | null };
        t: TranslationFn;
    }) => (
        <div className="p-4 rounded-2xl bg-gradient-to-br from-destructive/10 to-warning/10 border border-destructive/20 text-destructive max-w-md animate-in fade-in zoom-in duration-300">
            <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-full bg-destructive/20">
                    <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                    <div className="font-bold text-sm">
                        {t('messageBubble.quotaExceeded')}
                    </div>
                    {details.model && (
                        <div className="text-xs opacity-70 mt-0.5">{details.model}</div>
                    )}
                </div>
            </div>
            <p className="text-sm opacity-90 leading-relaxed mb-3">{details.message}</p>
            {details.resets_at && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/10 text-xs font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                        {t('messageBubble.resetsAt')}{' '}
                        {new Date(details.resets_at * 1000).toLocaleString()}
                    </span>
                </div>
            )}
        </div>
    )
);
QuotaErrorCard.displayName = 'QuotaErrorCard';

const CopyButton = memo(({ text, t }: { text: string; t: TranslationFn }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button
            type="button"
            onClick={() => {
                void handleCopy();
            }}
            className="p-1.5 hover:bg-accent/50 rounded-md transition-colors text-muted-foreground hover:text-foreground"
            title={t('messageBubble.copy')}
            aria-label={t('messageBubble.copy')}
        >
            {copied ? (
                <Check className="w-3.5 h-3.5 text-success" />
            ) : (
                <Copy className="w-3.5 h-3.5" />
            )}
        </button>
    );
});
CopyButton.displayName = 'CopyButton';

const BookmarkButton = memo(
    ({ active, onClick, t }: { active: boolean; onClick: () => void; t: TranslationFn }) => (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'p-1.5 hover:bg-accent/50 rounded-md transition-all duration-300',
                active
                    ? 'text-warning bg-warning/10 glow-warning'
                    : 'text-muted-foreground hover:text-foreground'
            )}
            title={active ? t('messageBubble.removeBookmark') : t('messageBubble.addBookmark')}
            aria-label={active ? t('messageBubble.removeBookmark') : t('messageBubble.addBookmark')}
            aria-pressed={active}
        >
            <Bookmark className={cn('w-3.5 h-3.5', active && 'fill-current')} />
        </button>
    )
);
BookmarkButton.displayName = 'BookmarkButton';

const RatingButtons = memo(
    ({
        rating,
        onRate,
        t,
    }: {
        rating?: 1 | -1 | 0;
        onRate: (val: 1 | -1 | 0) => void;
        t: TranslationFn;
    }) => (
        <div className="flex items-center gap-1 border-s border-border/50 ps-2 ms-1">
            <button
                type="button"
                onClick={() => onRate(rating === 1 ? 0 : 1)}
                className={cn(
                    'p-1.5 rounded-md transition-all duration-200',
                    rating === 1
                        ? 'text-success bg-success/10'
                        : 'text-muted-foreground hover:text-success hover:bg-success/5'
                )}
                title={t('messageBubble.goodAnswer')}
                aria-label={t('messageBubble.goodAnswer')}
                aria-pressed={rating === 1}
            >
                <ThumbsUp className={cn('w-3.5 h-3.5', rating === 1 && 'fill-current')} />
            </button>
            <button
                type="button"
                onClick={() => onRate(rating === -1 ? 0 : -1)}
                className={cn(
                    'p-1.5 rounded-md transition-all duration-200',
                    rating === -1
                        ? 'text-destructive bg-destructive/10'
                        : 'text-muted-foreground hover:text-destructive hover:bg-destructive/5'
                )}
                title={t('messageBubble.badAnswer')}
                aria-label={t('messageBubble.badAnswer')}
                aria-pressed={rating === -1}
            >
                <ThumbsDown className={cn('w-3.5 h-3.5', rating === -1 && 'fill-current')} />
            </button>
        </div>
    )
);
RatingButtons.displayName = 'RatingButtons';

const ToolRecoveryNotice = memo(
    ({
        interruptedToolNames,
        onRegenerate,
        t,
    }: {
        interruptedToolNames: string[];
        onRegenerate?: () => void;
        t: TranslationFn;
    }) => {
        if (interruptedToolNames.length === 0) {
            return null;
        }

        return (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                <div className="flex min-w-0 items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                        {t('tools.failed')}: {interruptedToolNames.join(', ')}
                    </span>
                </div>
                {onRegenerate && (
                    <button
                        type="button"
                        onClick={onRegenerate}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-warning/30 px-2 py-1 font-semibold hover:bg-warning/10 transition-colors"
                        aria-label={t('messageBubble.regenerate')}
                        title={t('messageBubble.regenerate')}
                    >
                        <RotateCcw className="w-3 h-3" />
                        <span>{t('messageBubble.regenerate')}</span>
                    </button>
                )}
            </div>
        );
    }
);
ToolRecoveryNotice.displayName = 'ToolRecoveryNotice';

// --- Markdown Specifics ---

const MermaidDiagram = memo(({ code, t }: { code: string; t: TranslationFn }) => {
    const [svg, setSvg] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const id = useId();
    useEffect(() => {
        let mounted = true;
        const render = async () => {
            try {
                const m = await import('mermaid');
                const mermaid = m.default;
                mermaid.initialize({
                    startOnLoad: false,
                    theme: 'dark',
                    // Using 'loose' security level for better diagram support
                    // Safe because SVG output is sanitized with DOMPurify (line 233)
                    securityLevel: 'loose',
                    fontFamily: 'inherit',
                });
                const { svg: renderedSvg } = await mermaid.render(id.replace(/:/g, ''), code);
                if (mounted) {
                    setSvg(DOMPurify.sanitize(renderedSvg));
                    setError(null);
                }
            } catch (err) {
                if (mounted) {
                    setError(err instanceof Error ? err.message : String(err));
                }
            }
        };
        void render();
        return () => {
            mounted = false;
        };
    }, [code, id]);
    if (error) {
        return (
            <pre className="text-xs text-destructive bg-destructive/10 p-2 rounded">{error}</pre>
        );
    }
    if (!svg) {
        return (
            <div className="my-4 h-32 flex items-center justify-center bg-accent/10 rounded-xl border border-border/40 animate-pulse">
                <div className="text-xs text-muted-foreground">
                    {t('messageBubble.renderingDiagram')}
                </div>
            </div>
        );
    }
    return (
        <div
            dangerouslySetInnerHTML={{ __html: svg }}
            className="my-4 flex justify-center bg-accent/30 p-4 rounded-xl border border-border/50"
        />
    );
});
MermaidDiagram.displayName = 'MermaidDiagram';

const CodeBlock = memo(
    ({
        className,
        children,
        isSpeaking,
        onStop,
        onSpeak,
        t,
    }: {
        className?: string;
        children?: React.ReactNode;
        isSpeaking?: boolean;
        onStop?: () => void;
        onSpeak?: (text: string) => void;
        t: TranslationFn;
    }) => {
        const match = /language-(\w+)/.exec(className ?? '');
        const codeString = String(children).replace(/\n$/, '');
        if (match?.[1] === 'mermaid') {
            return <MermaidDiagram code={codeString} t={t} />;
        }
        if (!match) {
            return (
                <code className="bg-muted/50 rounded px-1.5 py-0.5 font-mono text-xs font-semibold text-primary/80">
                    {children}
                </code>
            );
        }
        const language = match[1];
        return (
            <div className="not-prose my-3 rounded-xl overflow-hidden border border-border/30 bg-muted/30 group/code transition-premium">
                <div className="flex items-center justify-between px-4 py-2 bg-muted/20 border-b border-border/20 backdrop-blur-sm">
                    <span className="text-xxs text-muted-foreground font-bold opacity-60 group-hover/code:opacity-100 transition-opacity">
                        {language}
                    </span>
                    <div className="flex items-center gap-1.5">
                        {isSpeaking ? (
                            <button
                                type="button"
                                onClick={onStop}
                                className="p-1 px-1.5 hover:bg-accent/50 rounded-md transition-colors text-primary"
                                title={t('messageBubble.stop')}
                                aria-label={t('messageBubble.stop')}
                            >
                                <VolumeX className="w-3.5 h-3.5" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => onSpeak?.(codeString)}
                                className="p-1 px-1.5 hover:bg-accent/50 rounded-md transition-colors text-muted-foreground hover:text-foreground"
                                title={t('messageBubble.speakAloud')}
                                aria-label={t('messageBubble.speakAloud')}
                            >
                                <Volume2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                        <CopyButton text={codeString} t={t} />
                    </div>
                </div>
                <Highlight theme={themes.vsDark} code={codeString} language={language}>
                    {({ style, tokens, getLineProps, getTokenProps }) => (
                        <pre
                            className="p-4 overflow-x-auto m-0 !bg-transparent text-sm leading-relaxed"
                            style={style}
                        >
                            {tokens.map((line, i) => (
                                <div key={i} {...getLineProps({ line })} className="flex">
                                    <span className="select-none text-muted-foreground/30 mr-4 text-xs inline-block w-4 text-right shrink-0">
                                        {i + 1}
                                    </span>
                                    <div className="flex-1">
                                        {line.map((token, key) => (
                                            <span key={key} {...getTokenProps({ token })} />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </pre>
                    )}
                </Highlight>
            </div>
        );
    }
);
CodeBlock.displayName = 'CodeBlock';

const MarkdownImage = memo(
    ({
        src,
        alt,
        onCodeConvert,
        t,
    }: {
        src?: string;
        alt?: string;
        onCodeConvert?: (url: string) => void;
        t: TranslationFn;
    }) => (
        <span className="block my-2 relative group/image">
            <img
                src={src}
                alt={alt ?? t('messageBubble.imageAlt')}
                className="max-w-full max-h-96 rounded-lg border border-border/50 cursor-pointer hover:opacity-90 transition-opacity whitespace-pre-wrap"
                onClick={() => {
                    if (src) {
                        window.electron.openExternal(src);
                    }
                }}
            />
            {alt && (
                <span className="text-xs text-muted-foreground mt-1 block font-medium">{alt}</span>
            )}
            {src && onCodeConvert && (
                <button
                    onClick={e => {
                        e.stopPropagation();
                        onCodeConvert(src);
                    }}
                    className="absolute top-2 right-2 bg-background/60 hover:bg-background/80 backdrop-blur-md border border-border/50 text-foreground px-3 py-1.5 rounded-lg text-xs font-bold opacity-0 group-hover/image:opacity-100 transition-all flex items-center gap-2 transform translate-y-2 group-hover/image:translate-y-0"
                >
                    <Code2 className="w-3.5 h-3.5" />
                    {t('messageBubble.convertToCode')}
                </button>
            )}
        </span>
    )
);
MarkdownImage.displayName = 'MarkdownImage';

const MarkdownContent = memo(
    ({
        content,
        onSpeak,
        onStop,
        isSpeaking,
        onCodeConvert,
        t,
    }: {
        content: string;
        onSpeak?: (text: string) => void;
        onStop?: () => void;
        isSpeaking?: boolean;
        onCodeConvert?: (imageUrl: string) => void;
        t: TranslationFn;
    }) => (
        <div className="markdown-body">
            <Suspense fallback={<div className="text-sm text-muted-foreground">{t('common.loading')}</div>}>
                <LazyReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                        code: props => (
                            <CodeBlock
                                {...props}
                                isSpeaking={isSpeaking}
                                onStop={onStop}
                                onSpeak={onSpeak}
                                t={t}
                            />
                        ),
                        img: props => <MarkdownImage {...props} onCodeConvert={onCodeConvert} t={t} />,
                        a: ({ href, children }) => (
                            <a
                                href={href}
                                className="text-primary hover:underline underline-offset-4 font-medium"
                                onClick={e => {
                                    e.preventDefault();
                                    if (href) {
                                        window.electron.openExternal(href);
                                    }
                                }}
                            >
                                {children}
                            </a>
                        ),
                        li: ({ children }) => {
                            const isCheckbox =
                                Array.isArray(children) &&
                                children.some(
                                    c =>
                                        isValidElement(c) &&
                                        (c as React.ReactElement<{ type?: string }>).props.type ===
                                        'checkbox'
                                );
                            return (
                                <li
                                    className={cn(isCheckbox ? 'list-none -ms-4' : 'list-disc', 'my-1')}
                                >
                                    {children}
                                </li>
                            );
                        },
                        input: ({ type, checked, ...props }) => {
                            if (type === 'checkbox') {
                                return (
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        readOnly
                                        className="mr-2 accent-primary scale-110 align-middle"
                                        {...props}
                                    />
                                );
                            }
                            return <input {...props} />;
                        },
                        ul: ({ children }) => <ul className="ps-4 my-2 space-y-1">{children}</ul>,
                        ol: ({ children }) => (
                            <ol className="list-decimal ps-4 my-2 space-y-1">{children}</ol>
                        ),
                    }}
                >
                    {content}
                </LazyReactMarkdown>
            </Suspense>
        </div>
    )
);
MarkdownContent.displayName = 'MarkdownContent';

// --- Sections ---
const LazyReactMarkdown = lazy(() => import('react-markdown'));

const ThoughtSection = memo(
    ({
        thought,
        isThoughtExpanded,
        setIsThoughtExpanded,
        t,
    }: {
        thought: string | null;
        isThoughtExpanded: boolean;
        setIsThoughtExpanded: (expanded: boolean) => void;
        t: TranslationFn;
    }) => {
        if (!thought) {
            return null;
        }
        return (
            <div className="w-full mb-3">
                <button
                    onClick={() => setIsThoughtExpanded(!isThoughtExpanded)}
                    className={cn(
                        'flex items-center gap-2 group/thought transition-all duration-300',
                        isThoughtExpanded ? 'mb-2' : 'mb-0'
                    )}
                >
                    <div
                        className={cn(
                            'flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 select-none',
                            isThoughtExpanded
                                ? 'bg-primary/10 border-primary/20 text-primary shadow-sm shadow-primary/10'
                                : 'bg-accent/30 border-border/50 text-muted-foreground/60 hover:bg-accent/50 hover:border-border hover:text-primary/70'
                        )}
                    >
                        <div
                            className={cn(
                                'p-1 rounded-full',
                                isThoughtExpanded ? 'bg-primary/20' : 'bg-accent/30'
                            )}
                        >
                            <Brain
                                className={cn(
                                    'w-3.5 h-3.5',
                                    isThoughtExpanded ? 'animate-pulse' : ''
                                )}
                            />
                        </div>
                        <span className="text-xxs font-bold">
                            {isThoughtExpanded
                                ? t('messageBubble.TengraThinking')
                                : t('messageBubble.showThought')}
                        </span>
                        <Sparkles
                            className={cn(
                                'w-3 h-3 transition-opacity duration-300',
                                isThoughtExpanded ? 'opacity-100' : 'opacity-0'
                            )}
                        />
                        <span
                            className={cn(
                                'text-xxxs transition-transform duration-300 ms-1',
                                isThoughtExpanded ? 'rotate-180' : 'rotate-0'
                            )}
                        >
                            ▼
                        </span>
                    </div>
                </button>
                {isThoughtExpanded && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="relative ps-4 border-s-2 border-primary/20 py-1">
                            <div className="absolute -start-0.5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/40 via-primary/10 to-transparent" />
                            <div className="bg-gradient-to-br from-primary/[0.03] to-transparent rounded-2xl p-4 border border-border/20">
                                <div className="whitespace-pre-wrap font-mono text-xxs leading-relaxed text-muted-foreground/80 selection:bg-primary/20 drop-shadow-sm">
                                    {thought}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }
);
ThoughtSection.displayName = 'ThoughtSection';

const PlanSection = memo(
    ({
        plan,
        isLast,
        isStreaming,
        onApprovePlan,
        t,
    }: {
        plan: string | null;
        isLast: boolean;
        isStreaming?: boolean;
        onApprovePlan?: () => void;
        t: TranslationFn;
    }) => {
        if (!plan) {
            return null;
        }
        return (
            <div className="w-full mb-4 bg-gradient-to-br from-primary/[0.07] to-accent-foreground/[0.02] border border-primary/20 rounded-2xl p-4 shadow-lg shadow-primary/5 animate-fade-in relative overflow-hidden group/plan">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/plan:opacity-20 transition-opacity">
                    <ListTodo className="w-12 h-12" />
                </div>
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-primary/10">
                    <div className="p-1.5 rounded-lg bg-primary/20">
                        <ListTodo className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-xs font-bold text-primary">
                        {t('chat.plan')}
                    </span>
                </div>
                <div className="text-xs text-foreground/90 leading-relaxed font-medium">
                    <Suspense fallback={<div className="text-xs text-muted-foreground">{t('common.loading')}</div>}>
                        <LazyReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                li: ({ children }) => (
                                    <li className="flex gap-2.5 my-1.5 items-start">
                                        <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                                        <span>{children}</span>
                                    </li>
                                ),
                                ul: ({ children }) => <ul className="space-y-1">{children}</ul>,
                            }}
                        >
                            {plan}
                        </LazyReactMarkdown>
                    </Suspense>
                </div>
                {isLast && !isStreaming && onApprovePlan && (
                    <div className="mt-4 pt-4 border-t border-primary/10 flex justify-end">
                        <button
                            onClick={onApprovePlan}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20"
                        >
                            <Check className="w-3.5 h-3.5" />
                            {t('messageBubble.approvePlan')}
                        </button>
                    </div>
                )}
            </div>
        );
    }
);
PlanSection.displayName = 'PlanSection';

const PlanAndThought = memo(
    ({
        plan,
        thought,
        isLast,
        isStreaming,
        onApprovePlan,
        isThoughtExpanded,
        setIsThoughtExpanded,
        t,
    }: {
        plan: string | null;
        thought: string | null;
        isLast: boolean;
        isStreaming?: boolean;
        onApprovePlan?: () => void;
        isThoughtExpanded: boolean;
        setIsThoughtExpanded: (v: boolean) => void;
        t: TranslationFn;
    }) => (
        <>
            <PlanSection
                plan={plan}
                isLast={isLast}
                isStreaming={isStreaming}
                onApprovePlan={onApprovePlan}
                t={t}
            />
            <ThoughtSection
                thought={thought}
                isThoughtExpanded={isThoughtExpanded}
                setIsThoughtExpanded={setIsThoughtExpanded}
                t={t}
            />
        </>
    )
);
PlanAndThought.displayName = 'PlanAndThought';

const PermissionErrorCard = memo(({ t }: { t: TranslationFn }) => {
    const handleConfigure = useCallback(() => {
        window.dispatchEvent(
            new CustomEvent('tengra:open-model-selector', {
                detail: { tab: 'permissions' },
            })
        );
    }, []);

    return (
        <div className="group relative overflow-hidden rounded-3xl border border-destructive/20 bg-destructive/5 p-6 transition-all duration-300 hover:border-destructive/30 hover:bg-destructive/10">
            <div className="absolute right-0 top-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-destructive/10 blur-3xl transition-all duration-500 group-hover:bg-destructive/20" />

            <div className="relative flex flex-col gap-5">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/20 text-destructive shadow-lg shadow-destructive/10 ring-1 ring-destructive/20">
                        <Shield className="h-6 w-6" />
                    </div>
                    <div className="flex flex-col">
                        <h3 className="tw-text-14 font-bold tw-tracking-20 text-foreground">
                            {t('workspaceAgent.permissions.error') || 'Permission Denied'}
                        </h3>
                        <p className="tw-text-11 font-medium text-muted-foreground/70">
                            {t('workspaceAgent.permissions.securityBlock') || 'Action blocked by safety policy'}
                        </p>
                    </div>
                </div>

                <div className="rounded-2xl bg-background/40 p-4 border border-destructive/10">
                    <p className="tw-text-12 leading-relaxed text-muted-foreground/80">
                        {t('workspaceAgent.permissions.description') ||
                            'This action was blocked by the workspace agent\'s permission policy. You can choose to allow specific commands or paths in the settings.'}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleConfigure}
                        className="flex h-10 items-center justify-center gap-2 rounded-xl bg-destructive px-6 tw-text-11 font-bold tw-tracking-20 text-destructive-foreground shadow-lg shadow-destructive/20 transition-all hover:-translate-y-0.5 hover:bg-destructive/90 active:translate-y-0"
                    >
                        {t('workspaceAgent.permissions.configure') || 'Configure Permissions'}
                    </button>
                    <div className="tw-text-10 font-bold tw-tracking-40 text-muted-foreground/40 uppercase">
                        {t('workspaceAgent.permissions.requiresApproval') || 'Action Protected'}
                    </div>
                </div>
            </div>
        </div>
    );
});
PermissionErrorCard.displayName = 'PermissionErrorCard';

const MessageBubbleContent = memo(
    ({
        showRawMarkdown,
        quotaDetails,
        displayContent,
        images,
        isStreaming,
        onSpeak,
        onStop,
        isSpeaking,
        onCodeConvert,
        attachments,
        t,
        isUser,
    }: MessageBubbleContentProps) => {
        const markdownNode = useMemo(
            () => (
                <MarkdownContent
                    content={displayContent}
                    onSpeak={onSpeak}
                    onStop={onStop}
                    isSpeaking={isSpeaking}
                    onCodeConvert={onCodeConvert}
                    t={t}
                />
            ),
            [displayContent, onSpeak, onStop, isSpeaking, onCodeConvert, t]
        );

        // Detect permission error in tool calls
        const hasPermissionError = useMemo(() => {
            if (isUser || !displayContent) {return false;}
            // The content might contain tool call indicators or the displayContent itself might be the error
            // However, based on the backend implementation, we should check if any tool result has errorType === 'permission'
            // Since we don't have the raw message object here, we check the displayContent for the specific marker
            return displayContent.includes('errorType') && displayContent.includes('permission');
        }, [displayContent, isUser]);

        if (quotaDetails) {
            return <QuotaErrorCard details={quotaDetails} t={t} />;
        }

        if (hasPermissionError) {
            return <PermissionErrorCard t={t} />;
        }
        if (!displayContent && images.length === 0) {
            return isStreaming ? (
                <TypingIndicator />
            ) : (
                <span className="opacity-50">...</span>
            );
        }
        if (!displayContent) {
            return null;
        }
        if (showRawMarkdown || isUser) {
            return (
                <div className="flex flex-col gap-2">
                    <AttachmentList attachments={attachments} onRemove={() => { }} t={t} />
                    <div className="whitespace-pre-wrap font-mono text-sm bg-accent/20 rounded-lg p-3 border border-border/30 overflow-x-auto text-foreground/90 leading-relaxed">
                        {displayContent}
                    </div>
                </div>
            );
        }
        return (
            <div className="flex flex-col gap-2">
                <AttachmentList attachments={attachments} onRemove={() => { }} t={t} />
                {markdownNode}
            </div>
        );
    }
);
MessageBubbleContent.displayName = 'MessageBubbleContent';

const MessageActions = memo(
    ({
        displayContent,
        message,
        isSpeaking,
        onStop,
        onSpeak,
        onBookmark,
        onReact,
        onRate,
        onRegenerate,
        t,
    }: {
        displayContent: string;
        message: Message;
        isSpeaking?: boolean;
        onStop?: () => void;
        onSpeak?: (text: string) => void;
        onBookmark?: (isBookmarked: boolean) => void;
        onReact?: (emoji: string) => void;
        onRate?: (rating: 1 | -1 | 0) => void;
        onRegenerate?: () => void;
        t: TranslationFn;
    }) => (
        <div
            className="absolute start-full ms-4 top-0 flex flex-col gap-1 opacity-0 group-hover/bubble:opacity-100 group-focus-within/bubble:opacity-100 transition-all duration-200"
            role="toolbar"
            aria-label={t('messageBubble.actions')}
            aria-orientation="vertical"
            onKeyDown={handleToolbarArrowNavigation}
        >
            {isSpeaking ? (
                <button
                    type="button"
                    onClick={onStop}
                    className="p-1.5 bg-muted/20 hover:bg-muted/40 rounded-lg text-primary transition-all border border-border/50 backdrop-blur-sm"
                    title={t('messageBubble.stop')}
                    aria-label={t('messageBubble.stop')}
                >
                    <VolumeX className="w-3.5 h-3.5" />
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => onSpeak?.(displayContent)}
                    className="p-1.5 bg-muted/20 hover:bg-muted/40 rounded-lg text-muted-foreground hover:text-foreground transition-all border border-border/50 backdrop-blur-sm"
                    title={t('messageBubble.speakAloud')}
                    aria-label={t('messageBubble.speakAloud')}
                >
                    <Volume2 className="w-3.5 h-3.5" />
                </button>
            )}
            <CopyButton text={displayContent} t={t} />
            <BookmarkButton
                active={!!message.isBookmarked}
                onClick={() => onBookmark?.(!message.isBookmarked)}
                t={t}
            />
            {onRegenerate && (
                <button
                    type="button"
                    onClick={onRegenerate}
                    className="p-1.5 bg-muted/20 hover:bg-muted/40 rounded-lg text-muted-foreground hover:text-foreground transition-all border border-border/50 backdrop-blur-sm"
                    title={t('messageBubble.regenerate')}
                    aria-label={t('messageBubble.regenerate')}
                >
                    <RotateCcw className="w-3.5 h-3.5" />
                </button>
            )}
            <div className="relative group/react">
                <button
                    type="button"
                    className="p-1.5 bg-muted/20 hover:bg-muted/40 rounded-lg text-muted-foreground hover:text-foreground transition-all border border-border/50 backdrop-blur-sm"
                    title={t('messageBubble.react')}
                    aria-label={t('messageBubble.react')}
                    aria-haspopup="true"
                >
                    <Smile className="w-3.5 h-3.5" />
                </button>
                <div
                    className="absolute bottom-full mb-2 bg-popover border border-border/50 rounded-full px-2 py-1 shadow-xl flex gap-1 opacity-0 group-hover/react:opacity-100 group-focus-within/react:opacity-100 pointer-events-none group-hover/react:pointer-events-auto group-focus-within/react:pointer-events-auto transition-all scale-90 group-hover/react:scale-100 group-focus-within/react:scale-100 origin-bottom"
                    role="group"
                    aria-label={t('messageBubble.emojiReactions')}
                >
                    {['👍', '👎', '❤️', '🎉', '🚀'].map(emoji => (
                        <button
                            type="button"
                            key={emoji}
                            onClick={() => onReact?.(emoji)}
                            className="hover:scale-125 transition-transform text-sm p-1"
                            aria-label={emoji}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>
            {onRate && <RatingButtons rating={message.rating} onRate={onRate} t={t} />}
        </div>
    )
);
MessageActions.displayName = 'MessageActions';

const MessageImages = memo(({ images, t }: { images: string[]; t: TranslationFn }) => {
    if (images.length === 0) {
        return null;
    }
    return (
        <div className="flex gap-3 flex-wrap mb-4">
            {images.map((img, i) =>
                img === '__LOADING_IMAGE__' ? (
                    <ImageSkeleton key={i} t={t} />
                ) : (
                    <div key={i} className="relative group/img-container">
                        <img
                            src={img}
                            alt={t('messageBubble.attachedImage', { index: i + 1 })}
                            className="max-w-full md:max-w-md max-h-screen object-contain rounded-xl border border-border/50 cursor-pointer hover:opacity-90 transition-all duration-300 shadow-2xl"
                            onClick={() => {
                                window.electron.openExternal(img);
                            }}
                        />
                        <div className="absolute inset-0 bg-background/40 opacity-0 group-hover/img-container:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
                            <Eye className="w-6 h-6 text-foreground" />
                        </div>
                    </div>
                )
            )}
        </div>
    );
});
MessageImages.displayName = 'MessageImages';

const MessageSources = memo(
    ({
        sources,
        onSourceClick,
        t,
    }: {
        sources: string[];
        onSourceClick?: (p: string) => void;
        t: TranslationFn;
    }) => {
        if (sources.length === 0) {
            return null;
        }
        return (
            <div className="flex flex-wrap gap-2 mt-3 animate-fade-in">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-primary/5 border border-primary/10 text-xxs text-primary font-bold mb-1">
                    <Sparkles className="w-3 h-3" />
                    {t('chat.sources')}
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {sources.map((path, idx) => (
                        <button
                            key={idx}
                            onClick={() => onSourceClick?.(path)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/30 border border-border/30 hover:border-primary/50 hover:bg-primary/5 transition-all text-xs text-muted-foreground hover:text-foreground group/chip"
                            title={path}
                        >
                            <FileCode className="w-3.5 h-3.5 text-primary/60 group-hover/chip:text-primary" />
                            <span>{path.split(/[\\/]/).pop() ?? path}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }
);
MessageSources.displayName = 'MessageSources';

const MessageVariants = memo(
    ({
        variants,
        variantIndex,
        setVariantIndex,
        t,
    }: {
        variants: MessageVariant[];
        variantIndex: number;
        setVariantIndex: (idx: number) => void;
        t: TranslationFn;
    }) => (
        <div className="flex flex-col gap-2 mt-3 select-none">
            <div className="flex items-center gap-1 flex-wrap bg-muted/10 rounded-lg p-1 border border-border/30">
                {variants.map((v, idx) => (
                    <button
                        key={idx}
                        onClick={() => setVariantIndex(idx)}
                        className={cn(
                            'px-2.5 py-1 rounded-md text-xxs font-bold transition-all flex items-center gap-2 border',
                            idx === variantIndex
                                ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20 scale-102'
                                : 'hover:bg-accent/50 text-muted-foreground border-transparent'
                        )}
                    >
                        {(
                            v.label ??
                            v.model ??
                            t('messageBubble.responseShort', { index: idx + 1 })
                        ).slice(0, 20)}{' '}
                        {idx === variantIndex && <Check className="w-2.5 h-2.5" />}
                    </button>
                ))}
            </div>
            <div className="flex items-center gap-2 justify-center mt-1">
                <button
                    disabled={variantIndex === 0}
                    onClick={() => setVariantIndex(variantIndex - 1)}
                    className="p-1 px-1.5 rounded bg-accent/30 hover:bg-accent/50 disabled:opacity-30 transition-colors"
                >
                    <ChevronLeft className="w-3 h-3" />
                </button>
                <span className="text-xxs text-muted-foreground/60 font-bold">
                    {variantIndex + 1} / {variants.length}
                </span>
                <button
                    disabled={variantIndex === variants.length - 1}
                    onClick={() => setVariantIndex(variantIndex + 1)}
                    className="p-1 px-1.5 rounded bg-accent/30 hover:bg-accent/50 disabled:opacity-30 transition-colors"
                >
                    <ChevronRight className="w-3 h-3" />
                </button>
            </div>
        </div>
    )
);
MessageVariants.displayName = 'MessageVariants';

const RawToggle = memo(
    ({ active, onClick, t }: { active: boolean; onClick: () => void; t: TranslationFn }) => (
        <div className="flex items-center gap-2 mb-1">
            <button
                onClick={onClick}
                className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors',
                    active
                        ? 'bg-primary/20 text-primary'
                        : 'bg-accent/30 text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )}
            >
                {active ? <Eye className="w-3 h-3" /> : <Code2 className="w-3 h-3" />}
                {active ? t('chat.render') : t('chat.raw')}
            </button>
        </div>
    )
);
RawToggle.displayName = 'RawToggle';

interface QuotaDetails {
    message: string;
    resets_at: number | null;
    model: string | null;
}

interface MessageBubbleContentProps {
    isUser: boolean;
    isStreaming?: boolean;
    displayContent: string;
    quotaDetails: QuotaDetails | null;
    images: string[];
    showRawMarkdown: boolean;
    onSpeak?: (text: string) => void;
    onStop?: () => void;
    isSpeaking?: boolean;
    onCodeConvert?: (imageUrl: string) => void;
    onSourceClick?: (source: string) => void;
    attachments: Attachment[];
    t: TranslationFn;
}

interface MessageActionsContextProps {
    displayContent: string;
    message: Message;
    isSpeaking?: boolean;
    onStop?: () => void;
    onSpeak?: (text: string) => void;
    onBookmark?: (isBookmarked: boolean) => void;
    onReact?: (emoji: string) => void;
    onRate?: (rating: 1 | -1 | 0) => void;
    onRegenerate?: () => void;
    onSourceClick?: (path: string) => void;
    showRawMarkdown: boolean;
    setShowRawMarkdown: (val: boolean) => void;
    t: TranslationFn;
}

interface MessageBubbleInnerProps {
    isUser: boolean;
    isStreaming?: boolean;
    displayContent: string;
    quotaDetails: QuotaDetails | null;
    message: Message;
    contentProps: MessageBubbleContentProps;
    actionsContextProps: MessageActionsContextProps;
}

const createToggleVisibilityFlags = (
    displayContent: string,
    hasImages: boolean,
    isUser: boolean,
    quotaDetails: QuotaDetails | null
) => ({
    showToggle: Boolean(displayContent && !hasImages && !isUser && !quotaDetails),
    showActions: Boolean(!isUser && displayContent && !quotaDetails),
});

const BubbleContentSection = memo(
    ({
        contentProps,
        message,
        showToggle,
        setShowRawMarkdown,
        t,
    }: {
        contentProps: MessageBubbleContentProps;
        message: Message;
        showToggle: boolean;
        setShowRawMarkdown: (val: boolean) => void;
        t: TranslationFn;
    }) => {
        return (
            <div className="flex flex-col gap-2">
                <MessageImages images={contentProps.images} t={t} />
                {showToggle && (
                    <RawToggle
                        active={contentProps.showRawMarkdown}
                        onClick={() => setShowRawMarkdown(!contentProps.showRawMarkdown)}
                        t={t}
                    />
                )}
                <MessageBubbleContent {...contentProps} />
                <MessageSources
                    sources={message.sources ?? []}
                    onSourceClick={contentProps.onSourceClick}
                    t={t}
                />
            </div>
        );
    }
);
BubbleContentSection.displayName = 'BubbleContentSection';

const MessageBubbleInner = memo(
    ({
        isUser,
        isStreaming,
        displayContent,
        quotaDetails,
        message,
        contentProps,
        actionsContextProps,
    }: MessageBubbleInnerProps) => {
        const { showToggle, showActions } = createToggleVisibilityFlags(
            displayContent,
            contentProps.images.length > 0,
            isUser,
            quotaDetails
        );
        const bubbleClass = isUser
            ? 'bg-muted/10 px-4 py-3 rounded-tr-sm border border-border/50 text-foreground/90'
            : 'bg-transparent';

        return (
            <div
                className={cn(
                    'rounded-2xl px-0 py-1 text-base leading-relaxed whitespace-pre-wrap break-words border-none relative group/bubble w-full overflow-hidden',
                    bubbleClass
                )}
            >
                {isStreaming && <ResponseProgress />}
                <BubbleContentSection
                    contentProps={contentProps}
                    message={message}
                    showToggle={showToggle}
                    setShowRawMarkdown={actionsContextProps.setShowRawMarkdown}
                    t={actionsContextProps.t}
                />
                {showActions && (
                    <MessageActions
                        displayContent={displayContent}
                        message={message}
                        isSpeaking={actionsContextProps.isSpeaking}
                        onStop={actionsContextProps.onStop}
                        onSpeak={actionsContextProps.onSpeak}
                        onBookmark={actionsContextProps.onBookmark}
                        onReact={actionsContextProps.onReact}
                        onRate={actionsContextProps.onRate}
                        onRegenerate={actionsContextProps.onRegenerate}
                        t={actionsContextProps.t}
                    />
                )}
                {isUser && (
                    <svg
                        className="absolute -bottom-px -right-2 w-2 h-2.5 text-muted/10 fill-current pointer-events-none"
                        viewBox="0 0 8 10"
                    >
                        <path d="M0 0 L8 10 L0 10 Z" />
                        {/* Simple tail path */}
                    </svg>
                )}
            </div>
        );
    }
);
MessageBubbleInner.displayName = 'MessageBubbleInner';

// --- Main Hook Logic ---

interface ParsedMessageSections {
    thought: string | null;
    plan: string | null;
    displayContent: string;
}

const messageContentParseCache = new Map<string, ParsedMessageSections>();

const parseTagSection = (
    content: string,
    tagName: 'think' | 'plan'
): { value: string | null; content: string } => {
    const match = new RegExp(`<${tagName}>([\\s\\S]*?)(?:<\\/${tagName}>|$)`).exec(content);
    if (!match) {
        return { value: null, content };
    }
    return {
        value: match[1],
        content: content.replace(new RegExp(`<${tagName}>[\\s\\S]*?(?:<\\/${tagName}>|$)`), ''),
    };
};

const parseMessageTaggedSections = (
    content: string,
    reasoning: string | undefined,
    streaming: string | undefined
): ParsedMessageSections => {
    const thoughtSection = parseTagSection(content, 'think');
    const planSection = parseTagSection(thoughtSection.content, 'plan');
    return {
        thought: streaming ?? reasoning ?? thoughtSection.value,
        plan: planSection.value,
        displayContent: planSection.content.trim(),
    };
};

const useMessageContent = (
    raw: Message['content'],
    reasoning: string | undefined,
    streaming: string | undefined
) =>
    useMemo(() => {
        const content =
            typeof raw === 'string'
                ? raw
                : Array.isArray(raw)
                    ? raw
                        .map(c => {
                            if (typeof c === 'string') {
                                return c;
                            }
                            if (c.type === 'text') {
                                return c.text;
                            }
                            return '';
                        })
                        .join('')
                    : '';
        const cacheKey = `${content}::${reasoning ?? ''}`;
        if (!streaming) {
            const cached = messageContentParseCache.get(cacheKey);
            if (cached) {
                return cached;
            }
        }
        const parsed = parseMessageTaggedSections(content, reasoning, streaming);
        if (!streaming) {
            messageContentParseCache.set(cacheKey, parsed);
            if (messageContentParseCache.size > 500) {
                const oldest = messageContentParseCache.keys().next().value;
                if (oldest) {
                    messageContentParseCache.delete(oldest);
                }
            }
        }
        return parsed;
    }, [raw, reasoning, streaming]);

interface QuotaErrorResponse {
    message?: string;
    resets_at?: number;
    model?: string;
    error?: {
        message?: string;
        resets_at?: number;
        model?: string;
    };
}

const useQuotaDetails = (is429: boolean, content: string, t: TranslationFn) =>
    useMemo(() => {
        if (!is429) {
            return null;
        }
        try {
            const m = content.match(/\{[\s\S]*\}/);
            if (m) {
                const d = safeJsonParse<QuotaErrorResponse>(m[0], {});
                const o = d.error ?? d;
                return {
                    message: o.message ?? t('messageBubble.quotaExceeded'),
                    resets_at: o.resets_at ?? null,
                    model: o.model ?? null,
                };
            }
        } catch {
            /* skip */
        }
        return { message: t('messageBubble.quotaMessage'), resets_at: null, model: null };
    }, [is429, content, t]);

interface MessageFooterProps {
    message: Message;
    displayContent: string;
    language: Language;
    isStreaming?: boolean;
    streamingSpeed?: number | null;
    config?: MessageProps['footerConfig'];
}

const MessageFooter = memo(
    ({ message, displayContent, language, isStreaming, streamingSpeed, config }: MessageFooterProps) => {
        const { t } = useTranslation(language);
        
        // Default to showing everything if no config provided
        const showTimestamp = config?.showTimestamp ?? true;
        const showTokens = config?.showTokens ?? true;
        const showModel = config?.showModel ?? true;
        const showResponseTime = config?.showResponseTime ?? true;

        return (
            <div className="flex items-center gap-3 mt-2 text-xxs text-muted-foreground/40 font-medium">
                {showTimestamp && (
                    <span>
                        {new Date(message.timestamp).toLocaleTimeString(t('common.locale'), {
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </span>
                )}
                {showTokens && (
                    <>
                        <span className="h-1 rounded-full bg-muted-foreground/20" />
                        <span>
                            {t('messageBubble.tokenEstimate', {
                                count: Math.ceil(displayContent.length / 4),
                            })}
                        </span>
                    </>
                )}
                {showModel && message.model && (
                    <>
                        <span className="h-1 rounded-full bg-muted-foreground/20" />
                        <span className="truncate max-w-32">{message.model}</span>
                    </>
                )}
                {showResponseTime && message.responseTime && (
                    <>
                        <span className="h-1 rounded-full bg-muted-foreground/20" />
                        <span className="text-success/60">
                            {(message.responseTime / 1000).toFixed(1)}
                            {t('messageBubble.secondsShort')}
                        </span>
                    </>
                )}
                {message.isBookmarked && (
                    <>
                        <span className="h-1 rounded-full bg-muted-foreground/20" />
                        <span className="text-warning/60 flex items-center gap-1">
                            <Bookmark className="w-2.5 h-2.5 fill-current" />
                        </span>
                    </>
                )}
                {isStreaming && streamingSpeed && (
                    <>
                        <span className="h-1 rounded-full bg-muted-foreground/20" />
                        <span className="text-primary animate-pulse font-bold">
                            {streamingSpeed.toFixed(1)} {t('messageBubble.tokensPerSecond')}
                        </span>
                    </>
                )}
            </div>
        );
    }
);
MessageFooter.displayName = 'MessageFooter';

const MessageVariantCard = memo(
    ({
        variant,
        isSelected,
        onClick,
        t,
        isUser,
        isStreaming,
        onSpeak,
        onStop,
        isSpeaking,
        showRawMarkdown,
        footerConfig,
    }: {
        variant: MessageVariant;
        isSelected: boolean;
        onClick: () => void;
        t: TranslationFn;
        isUser: boolean;
        isStreaming?: boolean;
        onSpeak?: (text: string) => void;
        onStop?: () => void;
        isSpeaking?: boolean;
        showRawMarkdown: boolean;
        footerConfig?: MessageProps['footerConfig'];
    }) => {
        const { displayContent } = useMessageContent(variant.content, undefined, undefined);
        const is429 = useMemo(
            () => displayContent.includes('429') || displayContent.includes('RESOURCE_EXHAUSTED'),
            [displayContent]
        );
        const quota = useQuotaDetails(is429, displayContent, t);
        const variantInterrupted = variant.status === 'interrupted' || typeof variant.error === 'string';

        return (
            <div
                onClick={onClick}
                className={cn(
                    'relative flex flex-col gap-2 p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md',
                    isSelected
                        ? 'bg-card border-primary/50 ring-1 ring-primary/20 shadow-sm'
                        : 'bg-card/50 border-border/40 hover:bg-card hover:border-primary/30'
                )}
            >
                <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-border/20">
                    <div className="flex items-center gap-2">
                        <AssistantLogo
                            displayModel={variant.model}
                            provider={variant.provider}
                            t={t}
                        />
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-foreground/90">
                                {variant.model ?? t('messageBubble.unknownModel')}
                            </span>
                            <span className="text-xxs text-muted-foreground">
                                {variant.provider}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {variantInterrupted && (
                            <span className="rounded-full bg-destructive/10 px-2 py-1 text-xxs font-semibold text-destructive">
                                {t('tools.failed')}
                            </span>
                        )}
                        {isSelected && (
                            <div className="bg-primary/10 text-primary p-1 rounded-full">
                                <Check className="w-3 h-3" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 min-h-24">
                    <MessageBubbleContent
                        showRawMarkdown={showRawMarkdown}
                        quotaDetails={quota}
                        displayContent={displayContent}
                        images={[]}
                        isStreaming={isStreaming}
                        onSpeak={onSpeak}
                        onStop={onStop}
                        isSpeaking={isSpeaking}
                        attachments={[]}
                        t={t}
                        isUser={isUser}
                    />
                </div>

                <MessageFooter
                    message={{
                        id: variant.id ?? 'v',
                        content: variant.content,
                        role: 'assistant',
                        timestamp: variant.timestamp,
                        model: variant.model,
                        provider: variant.provider,
                    } as Message}
                    displayContent={displayContent}
                    language={t('common.locale') as Language}
                    isStreaming={isStreaming}
                    config={footerConfig}
                />
            </div>
        );
    }
);
MessageVariantCard.displayName = 'MessageVariantCard';

const MessageVariantsGrid = memo(
    ({
        variants,
        selectedVariantId,
        onVariantClick,
        t,
        isUser,
        backend,
        isStreaming,
        onSpeak,
        onStop,
        isSpeaking,
        showRawMarkdown,
        footerConfig,
    }: {
        variants: MessageVariant[];
        selectedVariantId: string | null;
        onVariantClick: (id: string) => void;
        t: TranslationFn;
        isUser: boolean;
        backend?: string;
        isStreaming: boolean;
        onSpeak?: (text: string) => void;
        onStop?: () => void;
        isSpeaking?: boolean;
        showRawMarkdown: boolean;
        footerConfig?: MessageProps['footerConfig'];
    }) => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {variants.map(variant => (
                <MessageVariantCard
                    key={variant.id}
                    variant={variant}
                    isSelected={
                        !!(
                            selectedVariantId === variant.id ||
                            (!selectedVariantId && variant.isSelected)
                        )
                    }
                    onClick={() => onVariantClick(variant.id)}
                    t={t}
                    isUser={isUser}
                    isStreaming={Boolean(isStreaming && variant.model === backend)}
                    onSpeak={onSpeak}
                    onStop={onStop}
                    isSpeaking={isSpeaking}
                    showRawMarkdown={showRawMarkdown}
                    footerConfig={footerConfig}
                />
            ))}
        </div>
    )
);
MessageVariantsGrid.displayName = 'MessageVariantsGrid';

// --- Variant Rendering Logic ---

const VariantsView = memo(
    ({
        message,
        backend,
        isStreaming,
        language: _language,
        onSpeak,
        onStop,
        isSpeaking,
        showRawMarkdown,
        t,
        footerConfig,
    }: {
        message: Message;
        backend?: string;
        isStreaming?: boolean;
        language: Language;
        onSpeak?: (text: string) => void;
        onStop?: () => void;
        isSpeaking?: boolean;
        showRawMarkdown: boolean;
        t: TranslationFn;
        footerConfig?: MessageProps['footerConfig'];
    }) => {
        const variants = message.variants ?? [];
        const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

        const handleVariantClick = (vId: string) => {
            setSelectedVariantId(vId);
        };

        return (
            <div className={cn('w-full animate-fade-in py-2 group')}>
                <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="bg-primary/10 p-1.5 rounded-lg">
                        <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-xs font-bold text-muted-foreground">
                        {t('chat.modelComparison')}
                    </span>
                </div>
                <MessageVariantsGrid
                    variants={variants}
                    selectedVariantId={selectedVariantId}
                    onVariantClick={handleVariantClick}
                    t={t}
                    isUser={false}
                    backend={backend}
                    isStreaming={!!isStreaming}
                    onSpeak={onSpeak}
                    onStop={onStop}
                    isSpeaking={isSpeaking}
                    showRawMarkdown={showRawMarkdown}
                    footerConfig={footerConfig}
                />
            </div>
        );
    }
);
VariantsView.displayName = 'VariantsView';

interface SingleMessageViewProps {
    message: Message;
    isLast: boolean;
    backend?: string;
    isStreaming?: boolean;
    language: Language;
    onSpeak?: (text: string) => void;
    onStop?: () => void;
    isSpeaking?: boolean;
    onCodeConvert?: (imageUrl: string) => void;
    onReact?: (emoji: string) => void;
    onBookmark?: (isBookmarked: boolean) => void;
    onRate?: (rating: 1 | -1 | 0) => void;
    onRegenerate?: () => void;
    onApprovePlan?: () => void;
    streamingSpeed?: number | null;
    streamingReasoning?: string;
    id?: string;
    isFocused?: boolean;
    onSourceClick?: (path: string) => void;
    footerConfig?: MessageProps['footerConfig'];
}

interface ContentRenderContext {
    isUser: boolean;
    isStreaming?: boolean;
    displayContent: string;
    quotaDetails: QuotaDetails | null;
    images: string[];
    attachments: Attachment[];
    showRawMarkdown: boolean;
    callbacks: {
        onSpeak?: (text: string) => void;
        onStop?: () => void;
        isSpeaking?: boolean;
        onCodeConvert?: (imageUrl: string) => void;
    };
    t: TranslationFn;
}

interface ActionsContext {
    message: Message;
    displayContent: string;
    callbacks: {
        isSpeaking?: boolean;
        onStop?: () => void;
        onSpeak?: (text: string) => void;
        onBookmark?: (isBookmarked: boolean) => void;
        onReact?: (emoji: string) => void;
        onRate?: (rating: 1 | -1 | 0) => void;
        onRegenerate?: () => void;
        onSourceClick?: (path: string) => void;
    };
    state: {
        showRawMarkdown: boolean;
        setShowRawMarkdown: (val: boolean) => void;
    };
    t: TranslationFn;
}

const buildMessageContentProps = (ctx: ContentRenderContext): MessageBubbleContentProps => ({
    isUser: ctx.isUser,
    isStreaming: ctx.isStreaming,
    displayContent: ctx.displayContent,
    quotaDetails: ctx.quotaDetails,
    images: ctx.images,
    attachments: ctx.attachments,
    showRawMarkdown: ctx.showRawMarkdown,
    onSpeak: ctx.callbacks.onSpeak,
    onStop: ctx.callbacks.onStop,
    isSpeaking: ctx.callbacks.isSpeaking,
    onCodeConvert: ctx.callbacks.onCodeConvert,
    t: ctx.t,
});

const buildActionsContextProps = (ctx: ActionsContext): MessageActionsContextProps => ({
    displayContent: ctx.displayContent,
    message: ctx.message,
    isSpeaking: ctx.callbacks.isSpeaking,
    onStop: ctx.callbacks.onStop,
    onSpeak: ctx.callbacks.onSpeak,
    onBookmark: ctx.callbacks.onBookmark,
    onReact: ctx.callbacks.onReact,
    onRate: ctx.callbacks.onRate,
    onRegenerate: ctx.callbacks.onRegenerate,
    onSourceClick: ctx.callbacks.onSourceClick,
    showRawMarkdown: ctx.state.showRawMarkdown,
    setShowRawMarkdown: ctx.state.setShowRawMarkdown,
    t: ctx.t,
});

const buildWrapperClasses = (isUser: boolean, isFocused?: boolean): string =>
    cn(
        'flex w-full animate-fade-in group/message transition-all duration-300 rounded-2xl p-2',
        isUser ? 'justify-end' : 'justify-start',
        isFocused && 'bg-primary/5 ring-1 ring-primary/20 shadow-lg shadow-primary/5'
    );

const buildContentWrapperClasses = (isUser: boolean): string =>
    cn('flex max-w-4xl md:max-w-3xl gap-3', isUser ? 'flex-row-reverse' : 'flex-row');

const buildColumnWrapperClasses = (isUser: boolean): string =>
    cn('flex flex-col gap-1 min-w-0', isUser ? 'items-end' : 'items-start');

const SingleMessageViewContent = memo(
    ({
        message,
        backend,
        isUser,
        isStreaming,
        interruptedToolNames,
        isThoughtExpanded,
        setIsThoughtExpanded,
        plan,
        thought,
        isLast,
        onApprovePlan,
        displayContent,
        quotaDetails,
        contentProps,
        actionsContextProps,
        hasReactions,
        onReact,
        id,
        isFocused,
        language,
        streamingSpeed,
        t,
        footerConfig,
    }: {
        message: Message;
        backend?: string;
        isUser: boolean;
        isStreaming?: boolean;
        interruptedToolNames: string[];
        isThoughtExpanded: boolean;
        setIsThoughtExpanded: (v: boolean) => void;
        plan: string | null;
        thought: string | null;
        isLast: boolean;
        onApprovePlan?: () => void;
        displayContent: string;
        quotaDetails: QuotaDetails | null;
        contentProps: MessageBubbleContentProps;
        actionsContextProps: MessageActionsContextProps;
        hasReactions: boolean;
        onReact?: (emoji: string) => void;
        id?: string;
        isFocused?: boolean;
        language: Language;
        streamingSpeed?: number | null;
        t: TranslationFn;
        footerConfig?: MessageProps['footerConfig'];
    }) => {
        const wrapperClasses = buildWrapperClasses(isUser, isFocused);
        const contentWrapperClasses = buildContentWrapperClasses(isUser);
        const columnWrapperClasses = buildColumnWrapperClasses(isUser);

        return (
            <div id={id} className={wrapperClasses}>
                <div className={contentWrapperClasses}>
                    {!isUser && (
                        <AssistantLogo
                            displayModel={message.model}
                            provider={message.provider}
                            backend={backend}
                            t={t}
                        />
                    )}
                    <div className={columnWrapperClasses}>
                        <PlanAndThought
                            plan={plan}
                            thought={thought}
                            isLast={isLast}
                            isStreaming={isStreaming}
                            onApprovePlan={onApprovePlan}
                            isThoughtExpanded={isThoughtExpanded}
                            setIsThoughtExpanded={setIsThoughtExpanded}
                            t={t}
                        />
                        <ToolRecoveryNotice
                            interruptedToolNames={interruptedToolNames}
                            onRegenerate={actionsContextProps.onRegenerate}
                            t={t}
                        />
                        <MessageBubbleInner
                            isUser={isUser}
                            isStreaming={isStreaming}
                            displayContent={displayContent}
                            quotaDetails={quotaDetails}
                            message={message}
                            contentProps={contentProps}
                            actionsContextProps={actionsContextProps}
                        />
                        {hasReactions && (
                            <div className="flex flex-wrap gap-1 mt-1 mb-1 px-1">
                                {message.reactions?.map((e, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => onReact?.(e)}
                                        className="px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-xxs hover:bg-primary/20 transition-colors"
                                    >
                                        {e}
                                    </button>
                                ))}
                            </div>
                        )}
                        {!isUser && !quotaDetails && (displayContent || contentProps.images.length > 0) && (
                            <MessageFooter
                                message={message}
                                displayContent={displayContent}
                                language={language}
                                isStreaming={isStreaming}
                                streamingSpeed={streamingSpeed}
                                config={footerConfig}
                            />
                        )}
                    </div>
                </div>
            </div>
        );
    }
);
SingleMessageViewContent.displayName = 'SingleMessageViewContent';

const initializeMessageState = () => ({
    isThoughtExpanded: false,
    showRawMarkdown: false,
});

type MessageState = ReturnType<typeof initializeMessageState>;

const SingleMessageView = memo(
    ({
        message,
        isLast,
        backend,
        isStreaming,
        language: _language,
        onSpeak,
        onStop,
        isSpeaking,
        onCodeConvert,
        onReact,
        onBookmark,
        onRate,
        onRegenerate,
        onApprovePlan,
        streamingSpeed,
        streamingReasoning,
        id,
        isFocused,
        onSourceClick,
        footerConfig,
    }: SingleMessageViewProps) => {
        const { t } = useTranslation(_language);
        const isUser = message.role === 'user';
        const [state, setState] = useState<MessageState>(initializeMessageState);
        const { isThoughtExpanded, showRawMarkdown } = state;
        const setIsThoughtExpanded = useCallback((v: boolean) =>
            setState(s => ({ ...s, isThoughtExpanded: v })), []);
        const setShowRawMarkdown = useCallback((v: boolean) => setState(s => ({ ...s, showRawMarkdown: v })), []);

        const { thought, plan, displayContent } = useMessageContent(
            message.content,
            message.reasoning,
            streamingReasoning
        );
        const interruptedToolNames = useMemo(() => {
            const recovery = message.metadata?.recovery;
            if (!recovery || typeof recovery !== 'object' || Array.isArray(recovery)) {
                return [];
            }
            const recoveryRecord = recovery as Record<string, RendererDataValue>;
            if (!Array.isArray(recoveryRecord.interruptedToolNames)) {
                return [];
            }
            return recoveryRecord.interruptedToolNames.filter(
                (toolName: RendererDataValue): toolName is string => typeof toolName === 'string'
            );
        }, [message.metadata]);

        const autoExpandDone = useRef(false);
        useEffect(() => {
            if (
                isLast &&
                thought &&
                !displayContent &&
                !isThoughtExpanded &&
                !autoExpandDone.current
            ) {
                setTimeout(() => {
                    setIsThoughtExpanded(true);
                }, 0);
                autoExpandDone.current = true;
            }
        }, [isLast, thought, displayContent, isThoughtExpanded]);

        // PERF-002-2: Memoize expensive computations
        const is429 = useMemo(
            () =>
                displayContent.includes('429') ||
                displayContent.includes('RESOURCE_EXHAUSTED') ||
                displayContent.includes('Rate limit') ||
                displayContent.includes('quota'),
            [displayContent]
        );
        const quota = useQuotaDetails(is429, displayContent, t);
        const images = useMemo(
            () => (message.images ?? []).filter((img): img is string => typeof img === 'string'),
            [message.images]
        );
        const hasReactions = useMemo(
            () => (message.reactions?.length ?? 0) > 0,
            [message.reactions]
        );

        const contentCtx: ContentRenderContext = {
            isUser,
            isStreaming,
            displayContent,
            quotaDetails: quota,
            images,
            attachments: message.attachments || [],
            showRawMarkdown,
            callbacks: { onSpeak, onStop, onCodeConvert },
            t,
        };

        const actionsCtx: ActionsContext = {
            message,
            displayContent,
            callbacks: { isSpeaking, onStop, onSpeak, onBookmark, onReact, onRate, onRegenerate, onSourceClick },
            state: { showRawMarkdown, setShowRawMarkdown },
            t,
        };

        const contentProps = buildMessageContentProps(contentCtx);
        const actionsContextProps = buildActionsContextProps(actionsCtx);

        return (
            <SingleMessageViewContent
                message={message}
                backend={backend}
                isUser={isUser}
                isStreaming={isStreaming}
                interruptedToolNames={interruptedToolNames}
                isThoughtExpanded={isThoughtExpanded}
                setIsThoughtExpanded={setIsThoughtExpanded}
                plan={plan}
                thought={thought}
                isLast={isLast}
                onApprovePlan={onApprovePlan}
                displayContent={displayContent}
                quotaDetails={quota}
                contentProps={contentProps}
                actionsContextProps={actionsContextProps}
                hasReactions={hasReactions}
                onReact={onReact}
                id={id}
                isFocused={isFocused}
                language={_language}
                streamingSpeed={streamingSpeed}
                t={t}
                footerConfig={footerConfig}
            />
        );
    }
);
SingleMessageView.displayName = 'SingleMessageView';

const MESSAGE_PROP_PRIMITIVE_KEYS: (keyof MessageProps)[] = [
    'isLast',
    'isStreaming',
    'isFocused',
    'backend',
    'language',
    'streamingSpeed',
    'streamingReasoning',
    'id',
];

const MESSAGE_FIELD_KEYS: (keyof Message)[] = [
    'id',
    'role',
    'timestamp',
    'model',
    'provider',
    'isBookmarked',
    'rating',
];

const areStringArraysEqual = (
    left: string[] | undefined,
    right: string[] | undefined
): boolean => {
    if (left === right) {
        return true;
    }
    if ((left?.length ?? -1) !== (right?.length ?? -1) || !left || !right) {
        return false;
    }
    for (let i = 0; i < left.length; i++) {
        if (left[i] !== right[i]) {
            return false;
        }
    }
    return true;
};

const areMessageContentsEqual = (leftContent: Message['content'], rightContent: Message['content']): boolean => {
    if (typeof leftContent === 'string' && typeof rightContent === 'string') {
        return leftContent === rightContent;
    }
    if (!Array.isArray(leftContent) || !Array.isArray(rightContent)) {
        return false;
    }
    if (leftContent.length !== rightContent.length) {
        return false;
    }
    for (let i = 0; i < leftContent.length; i++) {
        const left = leftContent[i];
        const right = rightContent[i];
        if (left.type !== right.type) {
            return false;
        }
        if (left.type === 'text') {
            if (right.type !== 'text' || left.text !== right.text) {
                return false;
            }
            continue;
        }
        if (
            right.type !== 'image_url' ||
            left.image_url.url !== right.image_url.url ||
            left.image_url.detail !== right.image_url.detail
        ) {
            return false;
        }
    }
    return true;
};

const areMessageVariantsEqual = (
    leftVariants: MessageVariant[] | undefined,
    rightVariants: MessageVariant[] | undefined
): boolean => {
    if (leftVariants === rightVariants) {
        return true;
    }
    if ((leftVariants?.length ?? -1) !== (rightVariants?.length ?? -1) || !leftVariants || !rightVariants) {
        return false;
    }
    for (let i = 0; i < leftVariants.length; i++) {
        const left = leftVariants[i];
        const right = rightVariants[i];
        const timestampsMatch =
            left.timestamp instanceof Date && right.timestamp instanceof Date
                ? left.timestamp.getTime() === right.timestamp.getTime()
                : String(left.timestamp) === String(right.timestamp);
        if (
            left.id !== right.id ||
            left.content !== right.content ||
            left.model !== right.model ||
            left.provider !== right.provider ||
            left.label !== right.label ||
            left.status !== right.status ||
            left.error !== right.error ||
            left.isSelected !== right.isSelected ||
            !timestampsMatch
        ) {
            return false;
        }
    }
    return true;
};

const areMessagePropsEqual = (prev: MessageProps, next: MessageProps) => {
    if (MESSAGE_PROP_PRIMITIVE_KEYS.some(key => prev[key] !== next[key])) {
        return false;
    }

    const pm = prev.message;
    const nm = next.message;
    if (pm === nm) {
        return true;
    }

    if (MESSAGE_FIELD_KEYS.some(key => pm[key] !== nm[key])) {
        return false;
    }

    if (!areMessageContentsEqual(pm.content, nm.content)) {
        return false;
    }

    if (
        !areStringArraysEqual(pm.images, nm.images) ||
        !areStringArraysEqual(pm.sources, nm.sources) ||
        !areStringArraysEqual(pm.reactions, nm.reactions)
    ) {
        return false;
    }

    if (JSON.stringify(pm.metadata ?? {}) !== JSON.stringify(nm.metadata ?? {})) {
        return false;
    }

    if (JSON.stringify(prev.footerConfig ?? {}) !== JSON.stringify(next.footerConfig ?? {})) {
        return false;
    }

    return areMessageVariantsEqual(pm.variants, nm.variants);
};

export const MessageBubble = memo(
    ({
        message,
        isLast,
        backend,
        isStreaming,
        language,
        onSpeak,
        onStop,
        isSpeaking,
        onCodeConvert,
        onReact,
        onBookmark,
        onRate,
        onRegenerate,
        onApprovePlan,
        streamingSpeed,
        streamingReasoning,
        id,
        isFocused,
        onSourceClick,
        footerConfig,
    }: MessageProps) => {
        const { t } = useTranslation(language);
        const variants = message.variants ?? [];
        const uniqueVariantsContent = new Set(
            variants.map(v => (typeof v.content === 'string' ? v.content.trim() : ''))
        );
        const hasVariants =
            variants.length > 1 &&
            message.role !== 'user' &&
            uniqueVariantsContent.size > 1;

        if (hasVariants) {
            return (
                <div
                    id={id}
                    className={cn(
                        'w-full animate-fade-in py-2 group',
                        isFocused && 'bg-primary/5 ring-1 ring-primary/20 rounded-xl'
                    )}
                >
                    <VariantsView
                        message={message}
                        backend={backend}
                        isStreaming={isStreaming}
                        language={language}
                        onSpeak={onSpeak}
                        onStop={onStop}
                        isSpeaking={isSpeaking}
                        showRawMarkdown={false}
                        t={t}
                        footerConfig={footerConfig}
                    />
                </div>
            );
        }

        return (
            <SingleMessageView
                message={message}
                isLast={isLast}
                backend={backend}
                isStreaming={isStreaming}
                language={language}
                onSpeak={onSpeak}
                onStop={onStop}
                isSpeaking={isSpeaking}
                onCodeConvert={onCodeConvert}
                onReact={onReact}
                onBookmark={onBookmark}
                onRate={onRate}
                onRegenerate={onRegenerate}
                onApprovePlan={onApprovePlan}
                streamingSpeed={streamingSpeed}
                streamingReasoning={streamingReasoning}
                id={id}
                isFocused={isFocused}
                onSourceClick={onSourceClick}
                footerConfig={footerConfig}
            />
        );
    },
    areMessagePropsEqual
);
MessageBubble.displayName = 'MessageBubble';

