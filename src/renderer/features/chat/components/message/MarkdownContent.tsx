import React, { isValidElement, lazy, memo, Suspense, useMemo } from 'react';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import { cn } from '@/lib/utils';

import { TypingIndicator } from '../TypingIndicator';

import { CodeBlock } from './CodeBlock';
import { MarkdownImage } from './MarkdownImage';
import { QuotaErrorCard } from './QuotaErrorCard';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

const LazyReactMarkdown = lazy(() => import('react-markdown'));

export interface MarkdownContentProps {
    content: string;
    onSpeak?: (text: string) => void;
    onStop?: () => void;
    isSpeaking?: boolean;
    onCodeConvert?: (imageUrl: string) => void;
    t: TranslationFn;
}

/**
 * MarkdownContent component
 * 
 * Renders markdown strings using react-markdown with Support for:
 * - GFM (GitHub Flavored Markdown)
 * - Math (KaTeX)
 * - Syntax highlighting (CodeBlock)
 * - Customized link handling
 * - Custom list and checkbox rendering
 */
export const MarkdownContent = memo(
    ({
        content,
        onSpeak,
        onStop,
        isSpeaking,
        onCodeConvert,
        t,
    }: MarkdownContentProps) => (
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

export interface MessageBubbleContentProps {
    showRawMarkdown: boolean;
    quotaDetails: { message: string; resets_at: number | null; model: string | null } | null;
    displayContent: string;
    images: string[];
    isStreaming?: boolean;
    onSpeak?: (text: string) => void;
    onStop?: () => void;
    isSpeaking?: boolean;
    onCodeConvert?: (imageUrl: string) => void;
    attachments?: string[];
    t: TranslationFn;
    isUser: boolean;
}

/**
 * MessageBubbleContent component
 * 
 * High-level content renderer that decides whether to show:
 * - Quota error
 * - Typing indicator
 * - Raw markdown (for users or when toggled)
 * - Rendered markdown
 */
export const MessageBubbleContent = memo(
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
        if (quotaDetails) {
            return <QuotaErrorCard details={quotaDetails} t={t} />;
        }
        if (!displayContent && images.length === 0) {
            return isStreaming ? (
                <TypingIndicator />
            ) : (
                <span className="italic opacity-50">...</span>
            );
        }
        if (!displayContent) {
            return null;
        }
        if (showRawMarkdown || isUser) {
            return (
                <div className="whitespace-pre-wrap font-mono text-sm bg-accent/20 rounded-lg p-3 border border-border/30 overflow-x-auto text-foreground/90 leading-relaxed">
                    {displayContent}
                </div>
            );
        }
        return markdownNode;
    }
);

MessageBubbleContent.displayName = 'MessageBubbleContent';
