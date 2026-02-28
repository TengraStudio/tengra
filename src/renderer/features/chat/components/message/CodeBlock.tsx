import React, { memo } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { Volume2, VolumeX } from 'lucide-react';
import { CopyButton } from './CopierRatingBookmark';
import { MermaidDiagram } from './MermaidDiagram';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

export interface CodeBlockProps {
    className?: string;
    children?: React.ReactNode;
    isSpeaking?: boolean;
    onStop?: () => void;
    onSpeak?: (text: string) => void;
    t: TranslationFn;
}

/**
 * CodeBlock component
 * 
 * Renders syntax-highlighted code blocks or Mermaid diagrams.
 * Includes copy to clipboard and text-to-speech functionality.
 */
export const CodeBlock = memo(
    ({
        className,
        children,
        isSpeaking,
        onStop,
        onSpeak,
        t,
    }: CodeBlockProps) => {
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
                    <span className="text-xxs text-muted-foreground uppercase font-black tracking-widest opacity-60 group-hover/code:opacity-100 transition-opacity">
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
