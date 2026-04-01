import { MonacoBlock } from '@renderer/features/chat/components/MonacoBlock';
import DOMPurify from 'dompurify';
import { Code2 } from 'lucide-react';
import React, { isValidElement, memo, useEffect, useId, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import 'katex/dist/katex.min.css';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

// Dynamic mermaid loader
const loadMermaid = async () => {
    const mermaid = await import('mermaid');

    // Initialize mermaid only once per session
    if (!mermaid.default.mermaidAPI.getConfig().startOnLoad) {
        mermaid.default.initialize({
            startOnLoad: false,
            theme: 'dark',
            // Using 'loose' security level for better diagram support
            // This allows HTML tags in diagrams. Safe because:
            // 1. Diagram SVG output is sanitized with DOMPurify before rendering (line 44)
            // 2. User diagrams are from LLM responses, not arbitrary external input
            // 3. The diagrams are displayed in a controlled context
            securityLevel: 'loose',
            fontFamily: 'inherit'
        });
    }

    return mermaid.default;
};

const MermaidDiagram = ({ code, t }: { code: string; t: TranslationFn }) => {
    const [svg, setSvg] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const id = useId();

    useEffect(() => {
        const render = async () => {
            try {
                setLoading(true);
                const mermaid = await loadMermaid();
                const { svg } = await mermaid.render(id, code);
                setSvg(DOMPurify.sanitize(svg));
                setError(null);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                setError(message);
            } finally {
                setLoading(false);
            }
        };
        void render();
    }, [code, id]);

    if (loading) {
        return (
            <div className="my-4 flex justify-center bg-muted/30 p-8 rounded-xl border border-border/50">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">{t('markdown.loadingDiagram')}</span>
                </div>
            </div>
        );
    }

    if (error) { return <pre className="text-xs text-destructive bg-destructive/10 p-2 rounded">{error}</pre>; }
    return <div dangerouslySetInnerHTML={{ __html: svg }} className="my-4 flex justify-center bg-muted/30 p-4 rounded-xl border border-border/50" />;
};

interface MarkdownRendererProps {
    content: string
    isSpeaking?: boolean | undefined
    onSpeak?: ((text: string) => void) | undefined
    onStop?: (() => void) | undefined
    onCodeConvert?: ((imageUrl: string) => void) | undefined
    isUser?: boolean | undefined
    language?: Language | undefined
}

export const MarkdownRenderer = memo<MarkdownRendererProps>(({
    content,
    isSpeaking,
    onSpeak,
    onStop,
    onCodeConvert,
    isUser,
    language = 'en'
}) => {
    const { t } = useTranslation(language);
    return (
        <div className="markdown-body">
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className ?? '');
                        const codeString = String(children).replace(/\n$/, '');
                        if (match?.[1] === 'mermaid') { return <MermaidDiagram code={codeString} t={t} />; }

                        return !match ? (
                            <code {...props}>
                                {children}
                            </code>
                        ) : (
                            <MonacoBlock
                                language={match[1] || 'text'}
                                code={codeString}
                                isSpeaking={isSpeaking}
                                onSpeak={() => { onSpeak?.(codeString); }}
                                onStop={onStop}
                                i18nLanguage={language}
                            />
                        );
                    },
                    img: ({ src, alt }) => (
                        <span className="block my-2 relative group/image">
                            <img src={src} alt={alt ?? t('messageBubble.imageAlt')} className="max-w-full max-h-96 rounded-lg border border-border/50 cursor-pointer hover:opacity-90 transition-opacity whitespace-pre-wrap" onClick={() => { if (src) { window.electron.openExternal(src); } }} />
                            {alt && <span className="text-xs text-muted-foreground mt-1 block font-medium">{alt}</span>}
                            {src && !isUser && onCodeConvert && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCodeConvert(src);
                                    }}
                                    className="absolute top-2 right-2 bg-background/85 hover:bg-background/90 backdrop-blur-md border border-border/50 text-foreground px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide opacity-0 group/image:opacity-100 transition-all flex items-center gap-2 transform translate-y-2 group-hover/image:translate-y-0"
                                >
                                    <Code2 className="w-3.5 h-3.5" />
                                    {t('workspace.convertToCode')}
                                </button>
                            )}
                        </span>
                    ),
                    a: ({ href, children }) => (
                        <a href={href} className="text-primary hover:underline underline-offset-4 font-medium" onClick={(e) => { e.preventDefault(); if (href) { window.electron.openExternal(href); } }}>{children}</a>
                    ),
                    li: ({ children }) => {
                        const isCheckbox = Array.isArray(children) && children.some(c => {
                            if (!isValidElement(c)) { return false; }
                            const element = c as React.ReactElement<{ type?: string }>;
                            return element.props.type === 'checkbox';
                        });
                        return <li className={cn(isCheckbox ? "list-none -ml-4" : "")}>{children}</li>;
                    },
                    input: ({ type, checked, ...props }) => {
                        if (type === 'checkbox') { return <input type="checkbox" checked={checked} readOnly className="mr-2 accent-primary scale-110 align-middle" {...props} />; }
                        return <input {...props} />;
                    },
                    ul: ({ children }) => <ul>{children}</ul>,
                    ol: ({ children }) => <ol>{children}</ol>,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
});
MarkdownRenderer.displayName = 'MarkdownRenderer';
