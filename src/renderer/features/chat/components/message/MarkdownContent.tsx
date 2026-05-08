/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { isValidElement, lazy, memo, Suspense, useMemo } from 'react';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import { useThrottle } from '@/hooks/useThrottle';
import { cn } from '@/lib/utils';
import { Attachment, ChatError, ToolCall } from '@/types';

import { AttachmentList } from '../input/AttachmentList';
import { MonacoBlock } from '../MonacoBlock';
import { TypingIndicator } from '../TypingIndicator';

import { MarkdownImage } from './MarkdownImage';
import { PermissionErrorCard } from './PermissionErrorCard';
import { QuotaErrorCard } from './QuotaErrorCard';

/* Batch-02: Extracted Long Classes */
const C_MARKDOWNCONTENT_1 = "whitespace-pre-wrap font-mono text-sm rounded-lg px-4 py-2 border border-border/30 overflow-x-auto text-foreground/90 leading-relaxed";


type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

const LazyReactMarkdown = lazy(() => import('react-markdown'));
const STREAMING_PLAIN_TEXT_PREVIEW_THRESHOLD = 12000;

const flattenNodeText = (node: React.ReactNode): string => {
    if (typeof node === 'string' || typeof node === 'number') {
        return String(node);
    }
    if (Array.isArray(node)) {
        return node.map(flattenNodeText).join('');
    }
    return '';
};

function normalizeMarkdownSpacing(input: string): string {
    // Goal: keep markdown readable without huge vertical gaps.
    // Keep fenced code blocks intact; only normalize regular text.
    const src = (input ?? '').replace(/\r\n/g, '\n');
    const lines = src.split('\n');

    let inFence = false;
    const out: string[] = [];
    let buf: string[] = [];

    const flushBuf = () => {
        if (buf.length === 0) {
            return;
        }
        let text = buf.join('\n');
        // Collapse excessive blank lines.
        text = text.replace(/\n{3,}/g, '\n\n');
        // Tighten lists: remove extra blank lines between consecutive list items.
        text = text.replace(
            /(^|\n)(\s*(?:[-*+]|\d+\.)\s+[^\n]+)\n\s*\n(?=\s*(?:[-*+]|\d+\.)\s+)/gm,
            '$1$2\n'
        );
        out.push(text);
        buf = [];
    };

    for (const line of lines) {
        const trimmed = line.trimStart();
        if (trimmed.startsWith('```')) {
            flushBuf();
            out.push(line);
            inFence = !inFence;
            continue;
        }
        if (inFence) {
            out.push(line);
        } else {
            buf.push(line);
        }
    }
    flushBuf();

    return out.join('\n');
}

export interface MarkdownContentProps {
    content: string;
    onSpeak?: (text: string) => void;
    onStop?: () => void;
    isSpeaking?: boolean;
    onCodeConvert?: (imageUrl: string) => void;
    t: TranslationFn;
    error?: ChatError | null;
    toolCalls?: ToolCall[];
}

/**
 * MarkdownContent component
 * 
 * Renders markdown strings using react-markdown with Support for:
 * - GFM (GitHub Flavored Markdown)
 * - Math (KaTeX)
 * - Syntax highlighting (MonacoBlock)
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
    }: MarkdownContentProps) => {
        const normalized = useMemo(() => normalizeMarkdownSpacing(content), [content]);
        return (
            <div className="markdown-body">
                <Suspense fallback={<div className="text-sm text-muted-foreground">{t('common.loading')}</div>}>
                    <LazyReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeRaw, rehypeKatex]}
                        components={{
                            pre: ({ children }) => <>{children}</>,
                            code: props => {
                                const className = typeof props.className === 'string' ? props.className : undefined;
                                const codeText = flattenNodeText(props.children);
                                const shouldUseMonaco = (
                                    (typeof className === 'string' && className.includes('language-'))
                                    || codeText.includes('\n')
                                );
                                if (shouldUseMonaco && codeText.trim().length > 0) {
                                    return (
                                        <MonacoBlock
                                            className={className}
                                            code={codeText}
                                            isSpeaking={isSpeaking}
                                            onStop={onStop}
                                            onSpeak={onSpeak}
                                            t={t}
                                        />
                                    );
                                }
                                return (
                                    <code className={className}>
                                        {props.children}
                                    </code>
                                );
                            },
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
                                        className={cn(isCheckbox ? 'list-none -ms-4' : 'list-disc')}
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
                            ul: ({ children }) => <ul className="ps-4">{children}</ul>,
                            ol: ({ children }) => (
                                <ol className="list-decimal ps-4">{children}</ol>
                            ),
                        }}
                    >
                        {normalized}
                    </LazyReactMarkdown>
                </Suspense>
            </div>
        );
    }
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
    attachments?: Attachment[];
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
        attachments,
        t,
        isUser,
    }: MessageBubbleContentProps) => {
        const throttledContent = useThrottle(displayContent, isStreaming ? 100 : 0);
        
        const markdownNode = useMemo(
            () => (
                <MarkdownContent
                    content={throttledContent}
                    onSpeak={onSpeak}
                    onStop={onStop}
                    isSpeaking={isSpeaking}
                    onCodeConvert={onCodeConvert}
                    t={t}
                />
            ),
            [throttledContent, onSpeak, onStop, isSpeaking, onCodeConvert, t]
        );
        const shouldUseStreamingPlainTextPreview = useMemo(() => {
            if (showRawMarkdown || isUser || !isStreaming) {
                return false;
            }
            return displayContent.length >= STREAMING_PLAIN_TEXT_PREVIEW_THRESHOLD;
        }, [displayContent.length, isStreaming, isUser, showRawMarkdown]);

        // Detect permission error in tool calls
        const hasPermissionError = useMemo(() => {
            if (isUser || !displayContent) {return false;}
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
        if (showRawMarkdown || isUser || shouldUseStreamingPlainTextPreview) {
            return (
                <div className="flex flex-col gap-2">
                    <AttachmentList attachments={attachments ?? []} onRemove={() => {}} t={t} />
                    <div className={C_MARKDOWNCONTENT_1}>
                        {displayContent}
                    </div>
                </div>
            );
        }
        return (
            <div className="flex flex-col gap-2">
                <AttachmentList attachments={attachments ?? []} onRemove={() => {}} t={t} />
                {markdownNode}
            </div>
        );
    }
);

MessageBubbleContent.displayName = 'MessageBubbleContent';

